/**
 * Stable, ergonomic references to canonical schema `$id`s. Use these instead of string
 * literals so consumers get autocomplete and a single point of change on version bumps.
 */
export const SCHEMA_IDS = {
  cognitiveIdentity: "cos:protocol:cognitive-identity:1.0.0",
  capabilityEnvelope: "cos:protocol:capability-envelope:1.0.0",
  contextLease: "cos:protocol:context-lease:1.0.0",
  intentLease: "cos:protocol:intent-lease:1.0.0",
  governanceDecision: "cos:protocol:governance-decision:1.0.0",
  cognitionPacket: "cos:protocol:cognition-packet:1.0.0",
  cognitiveEvent: "cos:protocol:cognitive-event:1.0.0",
  memoryMutation: "cos:protocol:memory-mutation:1.0.0",
  reasoningTrace: "cos:protocol:reasoning-trace:1.0.0",
  unitDescriptor: "cos:protocol:unit-descriptor:1.0.0",
  cognitionSyscall: "cos:protocol:cognition-syscall:1.0.0",
  cognitionSyscallResult: "cos:protocol:cognition-syscall-result:1.0.0",
  cognitiveWorkItem: "cos:protocol:cognitive-work-item:1.0.0",
  agentManifest: "cos:protocol:agent-manifest:1.0.0",
  unitLifecycleState: "cos:protocol:unit-lifecycle-state:1.0.0",
  eventFamilyRegistration: "cos:registry:event-family:1.0.0",
} as const;

export type SchemaId = (typeof SCHEMA_IDS)[keyof typeof SCHEMA_IDS];
