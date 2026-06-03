/**
 * Cognitive fibers — lightweight cooperative coroutines of cognitive control flow.
 * A fiber is a generator that `yield`s typed {@link Effect}s at explicit scheduling points and is
 * resumed by the engine. Cooperative (not preemptive) scheduling is what makes interleaving
 * deterministic and therefore replayable. Spec: spec/execution/cognitive-execution-engine.md.
 */
import type { CognitiveEvent } from "@inevitable/protocols";

/** A single reasoning step recorded for observability (spec/protocols/reasoning-trace-protocol.md). */
export interface ReasoningStep {
  readonly label: string;
  readonly detail?: string;
}

/** Publish a Cognitive Event (routed to the engine's sink/bus if one is configured). */
export interface EmitEffect {
  readonly kind: "emit";
  readonly event: CognitiveEvent;
}
/** Create a child fiber (lineage-stamped); resumes with the child fiber id. */
export interface SpawnEffect {
  readonly kind: "spawn";
  readonly routine: FiberRoutine;
  readonly priority: number;
  readonly label: string | undefined;
}
/** Suspend until the engine resolves `token`; resumes with the resolved value. */
export interface AwaitEffect {
  readonly kind: "await";
  readonly token: string;
}
/** Yield for `ticks` logical ticks (cooperative pacing / fairness). */
export interface SleepEffect {
  readonly kind: "sleepLogical";
  readonly ticks: number;
}
/** Record a reasoning step into the execution journal. */
export interface ReasonEffect {
  readonly kind: "reason";
  readonly step: ReasoningStep;
}

export type Effect = EmitEffect | SpawnEffect | AwaitEffect | SleepEffect | ReasonEffect;

export type FiberStatus = "ready" | "running" | "waiting" | "done" | "failed";

/**
 * The cooperative API handed to a routine. Each method is a delegating generator: a routine uses
 * `yield*` to perform the effect and receive its typed resume value, e.g.
 * `const id = yield* ctx.spawn(child)` or `const v = yield* ctx.awaitValue<number>("token")`.
 */
export interface FiberContext {
  readonly fiberId: string;
  emit(event: CognitiveEvent): Generator<Effect, void, unknown>;
  spawn(
    routine: FiberRoutine,
    opts?: { priority?: number; label?: string },
  ): Generator<Effect, string, unknown>;
  awaitValue<T = unknown>(token: string): Generator<Effect, T, unknown>;
  sleep(ticks: number): Generator<Effect, void, unknown>;
  reason(label: string, detail?: string): Generator<Effect, void, unknown>;
}

/** A cognitive routine: a generator body driven cooperatively by the execution engine. */
export type FiberRoutine<R = unknown> = (ctx: FiberContext) => Generator<Effect, R, unknown>;

/** Build the cooperative context for a fiber. The single cast per effect lives here, not in routines. */
export function makeFiberContext(fiberId: string): FiberContext {
  return {
    fiberId,
    *emit(event: CognitiveEvent): Generator<Effect, void, unknown> {
      yield { kind: "emit", event };
    },
    *spawn(
      routine: FiberRoutine,
      opts?: { priority?: number; label?: string },
    ): Generator<Effect, string, unknown> {
      const childId = yield {
        kind: "spawn",
        routine,
        priority: opts?.priority ?? 5,
        label: opts?.label,
      };
      return childId as string;
    },
    *awaitValue<T = unknown>(token: string): Generator<Effect, T, unknown> {
      const value = yield { kind: "await", token };
      return value as T;
    },
    *sleep(ticks: number): Generator<Effect, void, unknown> {
      yield { kind: "sleepLogical", ticks };
    },
    *reason(label: string, detail?: string): Generator<Effect, void, unknown> {
      yield { kind: "reason", step: { label, detail } };
    },
  };
}

/** Public, serializable view of a fiber (never exposes the live generator). */
export interface FiberView {
  readonly id: string;
  readonly priority: number;
  readonly parentId: string | undefined;
  readonly label: string | undefined;
  readonly step: number;
  readonly status: FiberStatus;
  readonly result?: unknown;
  readonly error?: string;
}
