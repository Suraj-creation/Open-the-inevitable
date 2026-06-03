/**
 * Deterministic cognitive execution engine. Drives {@link FiberRoutine}s cooperatively, interpreting
 * a closed set of {@link Effect}s, and appends every interpreted step to an append-only execution
 * journal stamped with an HLC. Given the same routines, inputs, injected `IdGenerator`, and `Clock`,
 * two engines produce byte-identical journals — the basis of deterministic replay (D2).
 * Spec: spec/execution/cognitive-execution-engine.md, spec/replay/deterministic-replay.md.
 */
import {
  type Clock,
  type Hlc,
  type IdGenerator,
  SystemClock,
  CryptoIdGenerator,
  hlcInit,
  hlcTick,
  hlcToString,
} from "@inevitable/shared";
import type { CognitiveEvent } from "@inevitable/protocols";
import {
  type Effect,
  type FiberRoutine,
  type FiberStatus,
  type FiberView,
  makeFiberContext,
} from "./fiber";

export type JournalKind = Effect["kind"] | "spawn-root" | "complete" | "fail";

export interface ExecutionJournalEntry {
  readonly seq: number;
  readonly fiberId: string;
  readonly step: number;
  readonly kind: JournalKind;
  readonly hlc: string;
  readonly detail: Record<string, unknown>;
}

/** Lineage failure policy: isolate the failed fiber, or cancel its descendants. */
export type FiberErrorPolicy = "isolate" | "fail-fast";

export interface ExecutionEngineOptions {
  clock?: Clock;
  idGenerator?: IdGenerator;
  engineId?: string;
  /** Optional sink for `emit` effects (e.g. the Universal Cognitive Bus). */
  sink?: (event: CognitiveEvent) => void | Promise<void>;
  /** Per-fiber step ceiling (loop protection / cognitive safety). */
  maxStepsPerFiber?: number;
  onFiberError?: FiberErrorPolicy;
}

export interface EngineCheckpoint {
  readonly journal: readonly ExecutionJournalEntry[];
  readonly fibers: readonly FiberView[];
  readonly tickCount: number;
}

interface FiberRec {
  readonly id: string;
  readonly priority: number;
  readonly parentId: string | undefined;
  readonly label: string | undefined;
  readonly spawnSeq: number;
  step: number;
  status: FiberStatus;
  readonly gen: Generator<Effect, unknown, unknown>;
  resume: unknown;
  result: unknown;
  error: string | undefined;
}

const DEFAULT_MAX_STEPS = 10_000;
const DEFAULT_MAX_TICKS = 1_000_000;

export class ExecutionEngine {
  private readonly clock: Clock;
  private readonly idGenerator: IdGenerator;
  private readonly sink: ((event: CognitiveEvent) => void | Promise<void>) | undefined;
  private readonly maxStepsPerFiber: number;
  private readonly onFiberError: FiberErrorPolicy;

  private readonly fibers = new Map<string, FiberRec>();
  private readonly ready: string[] = [];
  private readonly waiting = new Map<string, Set<string>>();
  private readonly sleepers: Array<{ fiberId: string; wakeAt: number }> = [];
  private readonly journalEntries: ExecutionJournalEntry[] = [];

  private hlc: Hlc;
  private journalSeq = 0;
  private spawnSeq = 0;
  private tickCount = 0;

  constructor(options: ExecutionEngineOptions = {}) {
    this.clock = options.clock ?? new SystemClock();
    this.idGenerator = options.idGenerator ?? new CryptoIdGenerator();
    this.sink = options.sink;
    this.maxStepsPerFiber = Math.max(1, options.maxStepsPerFiber ?? DEFAULT_MAX_STEPS);
    this.onFiberError = options.onFiberError ?? "isolate";
    this.hlc = hlcInit(options.engineId ?? "engine");
  }

  /** Submit a top-level (root) fiber. Returns the new fiber id. */
  submit(routine: FiberRoutine, opts?: { priority?: number; label?: string }): string {
    const id = this.createFiber(routine, undefined, opts?.priority ?? 5, opts?.label);
    this.appendJournal(id, 0, "spawn-root", { priority: opts?.priority ?? 5, label: opts?.label });
    return id;
  }

  /** Provide a value for a pending `await(token)`, moving every waiting fiber back to ready. */
  resolve(token: string, value: unknown): void {
    const waiters = this.waiting.get(token);
    if (!waiters) return;
    for (const fiberId of waiters) {
      const rec = this.fibers.get(fiberId);
      if (!rec || rec.status !== "waiting") continue;
      rec.resume = value;
      rec.status = "ready";
      this.ready.push(fiberId);
    }
    this.waiting.delete(token);
  }

  /** Run until no fiber is ready and no sleeper remains (quiescence). */
  async runToQuiescence(maxTicks = DEFAULT_MAX_TICKS): Promise<void> {
    let guard = 0;
    while (guard++ < maxTicks) {
      this.wakeSleepers();
      const fiberId = this.popReady();
      if (fiberId === undefined) {
        if (this.sleepers.length === 0) return;
        this.tickCount++; // advance logical time so sleepers can wake
        continue;
      }
      await this.runFiber(fiberId);
      this.tickCount++;
    }
    throw new Error(`ExecutionEngine exceeded ${maxTicks} ticks (possible non-terminating run)`);
  }

  get journal(): readonly ExecutionJournalEntry[] {
    return this.journalEntries;
  }

  isQuiescent(): boolean {
    return this.ready.length === 0 && this.sleepers.length === 0;
  }

  /** Tokens that at least one fiber is currently awaiting. */
  pendingTokens(): string[] {
    return [...this.waiting.keys()];
  }

  view(id: string): FiberView | undefined {
    const rec = this.fibers.get(id);
    return rec ? this.toView(rec) : undefined;
  }

  views(): FiberView[] {
    return [...this.fibers.values()].map((rec) => this.toView(rec));
  }

  snapshot(): EngineCheckpoint {
    return { journal: [...this.journalEntries], fibers: this.views(), tickCount: this.tickCount };
  }

  // --- internals ---------------------------------------------------------

  private createFiber(
    routine: FiberRoutine,
    parentId: string | undefined,
    priority: number,
    label: string | undefined,
  ): string {
    const id = `fib-${this.idGenerator.hex(12)}`;
    const ctx = makeFiberContext(id);
    const rec: FiberRec = {
      id,
      priority,
      parentId,
      label,
      spawnSeq: this.spawnSeq++,
      step: 0,
      status: "ready",
      gen: routine(ctx),
      resume: undefined,
      result: undefined,
      error: undefined,
    };
    this.fibers.set(id, rec);
    this.ready.push(id);
    return id;
  }

  private popReady(): string | undefined {
    if (this.ready.length === 0) return undefined;
    let bestIdx = 0;
    let best = this.fibers.get(this.ready[0] as string);
    for (let i = 1; i < this.ready.length; i++) {
      const candidate = this.fibers.get(this.ready[i] as string);
      if (!candidate) continue;
      if (
        !best ||
        candidate.priority < best.priority ||
        (candidate.priority === best.priority && candidate.spawnSeq < best.spawnSeq)
      ) {
        best = candidate;
        bestIdx = i;
      }
    }
    const [id] = this.ready.splice(bestIdx, 1);
    return id;
  }

  private wakeSleepers(): void {
    for (let i = this.sleepers.length - 1; i >= 0; i--) {
      const sleeper = this.sleepers[i];
      if (sleeper && sleeper.wakeAt <= this.tickCount) {
        const rec = this.fibers.get(sleeper.fiberId);
        this.sleepers.splice(i, 1);
        if (rec && rec.status === "waiting") {
          rec.status = "ready";
          this.ready.push(rec.id);
        }
      }
    }
  }

  private async runFiber(fiberId: string): Promise<void> {
    const rec = this.fibers.get(fiberId);
    if (!rec) return;
    rec.status = "running";

    if (rec.step >= this.maxStepsPerFiber) {
      this.fail(rec, "loop-limit");
      return;
    }

    let next: IteratorResult<Effect, unknown>;
    const resume = rec.resume;
    rec.resume = undefined;
    try {
      next = rec.gen.next(resume);
    } catch (error) {
      this.fail(rec, error instanceof Error ? error.message : String(error));
      return;
    }

    if (next.done) {
      rec.status = "done";
      rec.result = next.value;
      this.advanceHlc();
      this.appendJournal(rec.id, ++rec.step, "complete", {});
      return;
    }

    await this.interpret(rec, next.value);
  }

  private async interpret(rec: FiberRec, effect: Effect): Promise<void> {
    this.advanceHlc();
    rec.step++;
    switch (effect.kind) {
      case "emit": {
        this.appendJournal(rec.id, rec.step, "emit", { event_type: effect.event.event_type });
        if (this.sink) await this.sink(effect.event);
        this.refileReady(rec);
        return;
      }
      case "spawn": {
        const childId = this.createFiber(effect.routine, rec.id, effect.priority, effect.label);
        this.appendJournal(rec.id, rec.step, "spawn", {
          childId,
          priority: effect.priority,
          label: effect.label,
        });
        rec.resume = childId;
        this.refileReady(rec);
        return;
      }
      case "await": {
        this.appendJournal(rec.id, rec.step, "await", { token: effect.token });
        rec.status = "waiting";
        let set = this.waiting.get(effect.token);
        if (!set) {
          set = new Set<string>();
          this.waiting.set(effect.token, set);
        }
        set.add(rec.id);
        return;
      }
      case "sleepLogical": {
        this.appendJournal(rec.id, rec.step, "sleepLogical", { ticks: effect.ticks });
        if (effect.ticks <= 0) {
          this.refileReady(rec);
        } else {
          rec.status = "waiting";
          this.sleepers.push({ fiberId: rec.id, wakeAt: this.tickCount + effect.ticks });
        }
        return;
      }
      case "reason": {
        this.appendJournal(rec.id, rec.step, "reason", {
          label: effect.step.label,
          detail: effect.step.detail,
        });
        this.refileReady(rec);
        return;
      }
    }
  }

  private refileReady(rec: FiberRec): void {
    rec.status = "ready";
    this.ready.push(rec.id);
  }

  private fail(rec: FiberRec, reason: string): void {
    rec.status = "failed";
    rec.error = reason;
    this.advanceHlc();
    this.appendJournal(rec.id, ++rec.step, "fail", { reason });
    if (this.onFiberError === "fail-fast") this.cancelDescendants(rec.id, reason);
  }

  private cancelDescendants(ancestorId: string, reason: string): void {
    for (const rec of this.fibers.values()) {
      if (rec.status === "done" || rec.status === "failed") continue;
      if (this.hasAncestor(rec, ancestorId)) {
        rec.status = "failed";
        rec.error = `ancestor-failed:${reason}`;
        this.removeFromReady(rec.id);
        this.removeFromWaiting(rec.id);
        this.advanceHlc();
        this.appendJournal(rec.id, ++rec.step, "fail", { reason: rec.error });
      }
    }
  }

  private hasAncestor(rec: FiberRec, ancestorId: string): boolean {
    let parentId = rec.parentId;
    while (parentId !== undefined) {
      if (parentId === ancestorId) return true;
      parentId = this.fibers.get(parentId)?.parentId;
    }
    return false;
  }

  private removeFromReady(id: string): void {
    const idx = this.ready.indexOf(id);
    if (idx >= 0) this.ready.splice(idx, 1);
  }

  private removeFromWaiting(id: string): void {
    for (const set of this.waiting.values()) set.delete(id);
    for (let i = this.sleepers.length - 1; i >= 0; i--) {
      if (this.sleepers[i]?.fiberId === id) this.sleepers.splice(i, 1);
    }
  }

  private advanceHlc(): void {
    this.hlc = hlcTick(this.hlc, this.clock);
  }

  private appendJournal(
    fiberId: string,
    step: number,
    kind: JournalKind,
    detail: Record<string, unknown>,
  ): void {
    this.journalEntries.push({
      seq: this.journalSeq++,
      fiberId,
      step,
      kind,
      hlc: hlcToString(this.hlc),
      detail,
    });
  }

  private toView(rec: FiberRec): FiberView {
    return {
      id: rec.id,
      priority: rec.priority,
      parentId: rec.parentId,
      label: rec.label,
      step: rec.step,
      status: rec.status,
      result: rec.result,
      error: rec.error,
    };
  }
}
