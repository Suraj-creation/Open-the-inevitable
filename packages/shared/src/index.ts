/**
 * @inevitable/shared — foundational COS primitives shared across kernel, protocols, events,
 * runtime, governance, and observability packages.
 *
 * Spec anchors: spec/kernel/cognitive-identity.md, spec/protocols/*, spec/replay/*.
 */
export type { Brand } from "./branded";

export type {
  Cid,
  PacketId,
  EventId,
  LeaseId,
  EnvelopeId,
  IntentId,
  MutationId,
  TraceId,
  SpanId,
  DecisionId,
  WorkId,
  SyscallId,
  IdGenerator,
} from "./ids";
export {
  CryptoIdGenerator,
  SeededIdGenerator,
  newCid,
  newPacketId,
  newEventId,
  newLeaseId,
  newEnvelopeId,
  newIntentId,
  newMutationId,
  newDecisionId,
  newWorkId,
  newSyscallId,
  newTraceId,
  newSpanId,
  isCid,
} from "./ids";

export type { Result, Ok, Err } from "./result";
export { ok, err, isOk, isErr, mapResult, unwrap } from "./result";

export type { CosErrorOptions } from "./errors";
export {
  CosError,
  ProtocolValidationError,
  CapabilityDeniedError,
  LeaseInvalidError,
  GovernanceBlockedError,
  KernelPanicError,
  NotFoundError,
  InvalidTransitionError,
} from "./errors";

export type { Clock } from "./clock";
export { SystemClock, ManualClock } from "./clock";

export type { Hlc } from "./hlc";
export {
  hlcInit,
  hlcTick,
  hlcReceive,
  hlcCompare,
  hlcHappensBefore,
  hlcToString,
  hlcParse,
} from "./hlc";

export type { SpecRef } from "./spec-ref";
export { specRef } from "./spec-ref";
