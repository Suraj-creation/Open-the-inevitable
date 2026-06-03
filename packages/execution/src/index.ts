/**
 * @inevitable/execution — deterministic cognitive execution engine + cooperative cognitive fibers.
 * Spec: spec/execution/cognitive-execution-engine.md, spec/replay/deterministic-replay.md.
 */
export type {
  Effect,
  EmitEffect,
  SpawnEffect,
  AwaitEffect,
  SleepEffect,
  ReasonEffect,
  ReasoningStep,
  FiberStatus,
  FiberContext,
  FiberRoutine,
  FiberView,
} from "./fiber";
export { makeFiberContext } from "./fiber";

export type {
  ExecutionEngineOptions,
  ExecutionJournalEntry,
  JournalKind,
  EngineCheckpoint,
  FiberErrorPolicy,
} from "./engine";
export { ExecutionEngine } from "./engine";
