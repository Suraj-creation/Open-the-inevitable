/**
 * @inevitable/kernel — cognitive kernel primitives.
 * Spec: spec/kernel/*, spec/kernel-internals/cognition-syscalls.md.
 */
export type { IssueIdentityInput, SpawnChildInput, IdentityServiceOptions } from "./identity";
export { IdentityService } from "./identity";

export type { GrantEnvelopeInput, CapabilityServiceOptions } from "./capability";
export { CapabilityService } from "./capability";

export type { RequestContextLeaseInput, ContextLeaseServiceOptions } from "./context-lease";
export { ContextLeaseService } from "./context-lease";

export type { CreateIntentLeaseInput, IntentLeaseServiceOptions } from "./intent-lease";
export { IntentLeaseService } from "./intent-lease";
