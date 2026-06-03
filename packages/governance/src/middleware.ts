/**
 * Enforcement middleware. Side-effecting actions must pass governance (architecture law).
 * `assertAllowed` is the guard kernel services call before honoring a privileged action.
 */
import { GovernanceBlockedError } from "@inevitable/shared";
import type { GovernanceEngine } from "./engine";
import type { PolicyRequest, GovernanceDecision } from "./policy";

export interface GuardResult {
  readonly decision: GovernanceDecision;
  readonly allowed: boolean;
  readonly requiresReview: boolean;
}

export function guard(engine: GovernanceEngine, request: PolicyRequest): GuardResult {
  const decision = engine.evaluate(request);
  return {
    decision,
    allowed: decision.decision !== "block",
    requiresReview: decision.decision === "review",
  };
}

/** Throw {@link GovernanceBlockedError} if the request is blocked; otherwise return the decision. */
export function assertAllowed(
  engine: GovernanceEngine,
  request: PolicyRequest,
): GovernanceDecision {
  const decision = engine.evaluate(request);
  if (decision.decision === "block") {
    throw new GovernanceBlockedError(decision.reason ?? "blocked by governance", {
      specRef: "spec/kernel/governance-kernel.md",
      details: { decisionId: decision.decision_id, policyId: decision.policy_id },
    });
  }
  return decision;
}
