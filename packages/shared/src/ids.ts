/**
 * Typed COS identifiers and their generators.
 *
 * Spec: spec/kernel/cognitive-identity.md, spec/protocols/cognition-packet-protocol.md,
 *       spec/protocols/cognitive-event-protocol.md.
 *
 * Identifiers are branded strings. Generation is funneled through an {@link IdGenerator}
 * so tests and deterministic replay can inject a non-random source.
 */
import { randomUUID } from "node:crypto";
import type { Brand } from "./branded";

export type Cid = Brand<string, "Cid">;
export type PacketId = Brand<string, "PacketId">;
export type EventId = Brand<string, "EventId">;
export type LeaseId = Brand<string, "LeaseId">;
export type EnvelopeId = Brand<string, "EnvelopeId">;
export type IntentId = Brand<string, "IntentId">;
export type MutationId = Brand<string, "MutationId">;
export type TraceId = Brand<string, "TraceId">;
export type SpanId = Brand<string, "SpanId">;
export type DecisionId = Brand<string, "DecisionId">;
export type WorkId = Brand<string, "WorkId">;
export type SyscallId = Brand<string, "SyscallId">;

/** Source of identifier entropy. Inject a deterministic generator for replay/tests. */
export interface IdGenerator {
  /** Returns N hex characters of entropy. */
  hex(length: number): string;
  /** Returns a UUID v4 string. */
  uuid(): string;
}

export class CryptoIdGenerator implements IdGenerator {
  hex(length: number): string {
    return this.uuid().replace(/-/g, "").slice(0, length);
  }
  uuid(): string {
    return randomUUID();
  }
}

/**
 * Deterministic generator for tests/replay. Produces stable, monotonically suffixed ids.
 */
export class SeededIdGenerator implements IdGenerator {
  private counter = 0;
  constructor(private readonly seed: string = "seed") {}
  hex(length: number): string {
    const n = (this.counter++).toString(16).padStart(length, "0");
    return n.slice(-length);
  }
  uuid(): string {
    const h = (this.counter++).toString(16).padStart(32, "0");
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
  }
}

const defaultGenerator: IdGenerator = new CryptoIdGenerator();

export function newCid(gen: IdGenerator = defaultGenerator): Cid {
  return `cog-${gen.hex(12)}` as Cid;
}
export function newPacketId(gen: IdGenerator = defaultGenerator): PacketId {
  return `cp-${gen.hex(24)}` as PacketId;
}
export function newEventId(gen: IdGenerator = defaultGenerator): EventId {
  return `evt-${gen.hex(24)}` as EventId;
}
export function newLeaseId(gen: IdGenerator = defaultGenerator): LeaseId {
  return `lease-${gen.hex(12)}` as LeaseId;
}
export function newEnvelopeId(gen: IdGenerator = defaultGenerator): EnvelopeId {
  return `env-${gen.hex(12)}` as EnvelopeId;
}
export function newIntentId(gen: IdGenerator = defaultGenerator): IntentId {
  return `intent-${gen.hex(12)}` as IntentId;
}
export function newMutationId(gen: IdGenerator = defaultGenerator): MutationId {
  return `mut-${gen.hex(16)}` as MutationId;
}
export function newDecisionId(gen: IdGenerator = defaultGenerator): DecisionId {
  return `dec-${gen.hex(16)}` as DecisionId;
}
export function newWorkId(gen: IdGenerator = defaultGenerator): WorkId {
  return `work-${gen.hex(12)}` as WorkId;
}
export function newSyscallId(gen: IdGenerator = defaultGenerator): SyscallId {
  return `sys-${gen.hex(16)}` as SyscallId;
}
export function newTraceId(gen: IdGenerator = defaultGenerator): TraceId {
  return gen.hex(32) as TraceId;
}
export function newSpanId(gen: IdGenerator = defaultGenerator): SpanId {
  return gen.hex(16) as SpanId;
}

const CID_PATTERN = /^cog-[0-9a-f]{12}$/;
export function isCid(value: string): value is Cid {
  return CID_PATTERN.test(value);
}
