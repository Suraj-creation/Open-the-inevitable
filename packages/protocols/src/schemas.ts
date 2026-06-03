/**
 * Canonical schema documents, loaded as data. The JSON Schemas under `schemas/` are the
 * single source of truth (ADR-0003); TypeScript types in `src/generated/` are derived from them.
 */
import cognitiveIdentity from "../schemas/cognitive-identity.schema.json";
import capabilityEnvelope from "../schemas/capability-envelope.schema.json";
import contextLease from "../schemas/context-lease.schema.json";
import intentLease from "../schemas/intent-lease.schema.json";
import governanceDecision from "../schemas/governance-decision.schema.json";
import cognitionPacket from "../schemas/cognition-packet.schema.json";
import cognitiveEvent from "../schemas/cognitive-event.schema.json";
import memoryMutation from "../schemas/memory-mutation.schema.json";
import reasoningTrace from "../schemas/reasoning-trace.schema.json";
import unitDescriptor from "../schemas/unit-descriptor.schema.json";
import cognitionSyscall from "../schemas/cognition-syscall.schema.json";
import cognitionSyscallResult from "../schemas/cognition-syscall-result.schema.json";
import cognitiveWorkItem from "../schemas/cognitive-work-item.schema.json";
import agentManifest from "../schemas/agent-manifest.schema.json";
import unitLifecycleState from "../schemas/unit-lifecycle-state.schema.json";
import eventFamilyRegistration from "../schemas/event-family-registration.schema.json";

/** A JSON Schema document with the metadata the registry relies on. */
export interface SchemaDocument {
  readonly $id: string;
  readonly title: string;
  readonly $schema?: string;
  readonly [key: string]: unknown;
}

export const SCHEMAS: readonly SchemaDocument[] = [
  cognitiveIdentity,
  capabilityEnvelope,
  contextLease,
  intentLease,
  governanceDecision,
  cognitionPacket,
  cognitiveEvent,
  memoryMutation,
  reasoningTrace,
  unitDescriptor,
  cognitionSyscall,
  cognitionSyscallResult,
  cognitiveWorkItem,
  agentManifest,
  unitLifecycleState,
  eventFamilyRegistration,
] as SchemaDocument[];

export const SCHEMA_BY_ID: Readonly<Record<string, SchemaDocument>> = Object.fromEntries(
  SCHEMAS.map((schema) => [schema.$id, schema]),
);
