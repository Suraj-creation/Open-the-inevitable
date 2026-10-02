import {
  type AdmissionResult,
  admitInput,
  type EnvironmentPack,
  type InputSubmission,
  type ModelFaculty,
  type Mode,
  type ProcessHandle,
  processStream,
  readProcess,
  resumeProcess,
  runStep,
  startProcess,
  type StartOptions,
  type StepOutcome,
} from "@uci/harness";
import {
  type CausalRecord,
  type CausalStore,
  type Clock,
  type EffectIntended,
  type EffectSettled,
  INBOX_PREFIX,
} from "@uci/kernel";

/**
 * A host owns many long-lived processes on one store. It holds no cognitive state: residency is a
 * cache, and everything that decides what happens next (what a process is waiting on, when time
 * would wake it, how long a failed call must back off) is derived from records, so a fresh host
 * on another machine continues exactly where a dead one stopped.
 *
 * Each process is driven by a doorbell (OpenCode §19.4): `ring` during a drain sets `pendingWake`,
 * re-checked when the drain ends with no await between the check and the release, so no wakeup is
 * ever lost. A `FencedError` means a newer host has taken the process: this host lets it go.
 */
export interface HostOptions {
  readonly store: CausalStore;
  readonly clock: Clock;
  /** This host's identity in lease records. */
  readonly owner: string;
  readonly env: EnvironmentPack;
  readonly faculty: ModelFaculty;
  readonly mode?: Mode;
  /** Base and cap of the backoff after a failed model call (derived from records). */
  readonly backoffMs?: number;
  readonly maxBackoffMs?: number;
  /** Safety bound on steps per drain. */
  readonly maxStepsPerDrain?: number;
  readonly onOutcome?: (processId: string, outcome: StepOutcome) => void;
}

interface Doorbell {
  pendingWake: boolean;
  readonly done: Promise<void>;
}

const TERMINAL = new Set(["process.concluded", "process.escalated"]);

export class Host {
  private readonly owned = new Map<string, ProcessHandle>();
  private readonly bells = new Map<string, Doorbell>();
  /** When each owned process should next be woken by time alone (from records, never authoritative). */
  private readonly wakeAt = new Map<string, string>();
  private stopped = false;

  constructor(private readonly o: HostOptions) {}

  /**
   * Take every process on the store that is not finished and is bound to this host's environment:
   * hydration at a step boundary, recovery mid-step. Each is rung once so it resumes or parks.
   */
  async boot(): Promise<string[]> {
    const taken: string[] = [];
    for (const stream of await this.o.store.streams("process/")) {
      const records = await this.o.store.read(stream);
      if (records.some((r) => TERMINAL.has(r.kind))) continue;
      const bound = records.find((r) => r.kind === "environment.bound")?.data as
        | { packId: string }
        | undefined;
      if (bound && bound.packId !== this.o.env.id) continue;
      const processId = records[0]?.processId ?? stream.slice("process/".length);
      await this.take(processId);
      taken.push(processId);
    }
    for (const id of taken) this.ring(id);
    return taken;
  }

  /** Start a new process on this host and drive it. */
  async start(o: Omit<StartOptions, "store" | "clock" | "owner" | "env">): Promise<void> {
    const handle = await startProcess({
      ...o,
      store: this.o.store,
      clock: this.o.clock,
      owner: this.o.owner,
      env: this.o.env,
    });
    this.owned.set(o.processId, handle);
    this.ring(o.processId);
  }

  /** Admit an input (the channel's entry point) and wake its process if this host owns it. */
  async admit(s: InputSubmission): Promise<AdmissionResult> {
    const result = await admitInput(this.o.store, this.o.clock, s);
    if (result.inputId && !result.duplicate) this.ring(s.processId);
    return result;
  }

  /** The doorbell. Lost-wakeup-free: a ring during a drain is never dropped. */
  ring(processId: string): void {
    if (this.stopped || !this.owned.has(processId)) return;
    const bell = this.bells.get(processId);
    if (bell) {
      bell.pendingWake = true;
      return;
    }
    const state: { pendingWake: boolean; done?: Promise<void> } = { pendingWake: false };
    const done = (async () => {
      for (;;) {
        state.pendingWake = false;
        try {
          await this.drain(processId);
        } catch (e) {
          // A drain that failed leaves the process to the next ring or host; nothing is lost.
          this.o.onOutcome?.(processId, { status: "retry", step: 0, detail: String(e) });
        }
        // No await between this check and the release: a ring cannot fall in between.
        if (!state.pendingWake || this.stopped || !this.owned.has(processId)) {
          this.bells.delete(processId);
          return;
        }
      }
    })();
    this.bells.set(processId, Object.assign(state, { done }) as Doorbell);
  }

  /** Wake every owned process whose time has come (call on a clock tick). */
  tick(): void {
    const now = this.o.clock.now();
    for (const [id, at] of this.wakeAt)
      if (at <= now) {
        this.wakeAt.delete(id);
        this.ring(id);
      }
  }

  /** Ring processes whose inbox other writers changed, until `signal` aborts. */
  async watchInboxes(signal: AbortSignal): Promise<void> {
    for await (const change of this.o.store.watch(INBOX_PREFIX, signal))
      this.ring(change.stream.slice(INBOX_PREFIX.length));
  }

  /** Resolves when no process is being driven. */
  async idle(): Promise<void> {
    while (this.bells.size) await Promise.all([...this.bells.values()].map((b) => b.done));
  }

  owns(processId: string): boolean {
    return this.owned.has(processId);
  }

  ownedProcesses(): string[] {
    return [...this.owned.keys()];
  }

  /** When time alone would next wake this process, if ever (derived from its records). */
  nextWake(processId: string): string | undefined {
    return this.wakeAt.get(processId);
  }

  /** Stop driving (in-flight steps finish); ownership stays in the store until another host claims. */
  async stop(): Promise<void> {
    this.stopped = true;
    await this.idle();
  }

  /**
   * The process's records after `afterSeq`, in order, without gaps or repeats, then each new record
   * as it commits, until `signal` aborts. The cursor a surface streams from (Last-Event-ID = seq).
   */
  async *tail(
    processId: string,
    afterSeq: number,
    signal: AbortSignal,
  ): AsyncIterable<CausalRecord> {
    const stream = processStream(processId);
    let cursor = afterSeq;
    const drainNew = async function* (store: CausalStore) {
      for (const r of await store.read(stream, cursor + 1)) {
        cursor = r.seq;
        yield r;
      }
    };
    yield* drainNew(this.o.store);
    for await (const change of this.o.store.watch(stream, signal)) {
      if (change.stream !== stream || change.seq <= cursor) continue;
      yield* drainNew(this.o.store);
    }
  }

  // ---------------------------------------------------------------- internals

  private async take(processId: string): Promise<void> {
    const { handle } = await resumeProcess({
      store: this.o.store,
      clock: this.o.clock,
      processId,
      owner: this.o.owner,
      env: this.o.env,
      faculty: `${this.o.faculty.id}/${this.o.faculty.model}`,
    });
    this.owned.set(processId, handle);
  }

  private async drain(processId: string): Promise<void> {
    const handle = this.owned.get(processId);
    if (!handle) return;
    for (let i = 0; i < (this.o.maxStepsPerDrain ?? 200); i++) {
      if (this.stopped) return;
      // Durable backoff: a failed model call's wait is read from the records, not remembered.
      const retryAt = backoffUntil(await readProcess(handle), this.o);
      if (retryAt && retryAt > this.o.clock.now()) {
        this.wakeAt.set(processId, retryAt);
        return;
      }
      let outcome: StepOutcome;
      try {
        outcome = await runStep({
          handle,
          faculty: this.o.faculty,
          env: this.o.env,
          ...(this.o.mode ? { mode: this.o.mode } : {}),
        });
      } catch (e) {
        if ((e as Error).name === "FencedError") {
          // A newer host owns this process now: let it go, never fight for it.
          this.owned.delete(processId);
          this.wakeAt.delete(processId);
          return;
        }
        throw e;
      }
      this.o.onOutcome?.(processId, outcome);
      switch (outcome.status) {
        case "completed":
          this.wakeAt.delete(processId);
          continue;
        case "retry":
          continue; // a rejected proposal re-asks now; a failed call is caught by the backoff check
        case "waiting":
          if (outcome.until) this.wakeAt.set(processId, outcome.until);
          else this.wakeAt.delete(processId);
          return;
        default:
          // concluded, escalated, denied: nothing more for this host to drive.
          this.wakeAt.delete(processId);
          return;
      }
    }
  }
}

/**
 * When the next model call may be attempted, derived from records: after N consecutive failed
 * model-call attempts in the current ask, base × 2^(N-1) (capped) from the last failure.
 */
export function backoffUntil(
  records: readonly CausalRecord[],
  o: Pick<HostOptions, "backoffMs" | "maxBackoffMs">,
): string | undefined {
  const intents = new Map(
    records
      .filter((r) => r.kind === "effect.intended")
      .map((r) => [(r.data as EffectIntended).effectId, r.data as EffectIntended]),
  );
  let failures = 0;
  let lastAt: string | undefined;
  for (const r of [...records].reverse()) {
    if (r.kind === "step.completed" || r.kind === "proposal.rejected") break;
    if (r.kind !== "effect.settled") continue;
    const settled = r.data as EffectSettled;
    if (intents.get(settled.effectId)?.effectClass !== "model-call") continue;
    if (settled.outcome !== "failed") break;
    failures++;
    lastAt ??= r.at;
  }
  if (!failures || !lastAt) return undefined;
  const delay = Math.min(o.maxBackoffMs ?? 30_000, (o.backoffMs ?? 1_000) * 2 ** (failures - 1));
  return new Date(Date.parse(lastAt) + delay).toISOString();
}
