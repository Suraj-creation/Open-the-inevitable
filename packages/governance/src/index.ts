/**
 * @inevitable/governance — governance as a kernel primitive.
 * Spec: spec/kernel/governance-kernel.md, spec/meta/protocol-governance.md.
 */
export type {
  Policy,
  PolicyRequest,
  PolicyOutcome,
  PolicyType,
  Decision,
  GovernanceDecision,
} from "./policy";

export type { DecisionListener, GovernanceEngineOptions } from "./engine";
export { GovernanceEngine } from "./engine";

export {
  DEFAULT_POLICIES,
  noPiiInPublicOutput,
  lowConfidenceRequiresReview,
} from "./default-policies";

export type { GuardResult } from "./middleware";
export { guard, assertAllowed } from "./middleware";
