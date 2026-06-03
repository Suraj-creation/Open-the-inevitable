/**
 * Governance engine — evaluates a request against priority-ordered policies and emits an
 * explainable {@link GovernanceDecision}. The first applicable policy that blocks, modifies, or
 * requires review wins; otherwise the request is allowed. Spec: spec/kernel/governance-kernel.md.
 */
import { newDecisionId, type IdGenerator, CryptoIdGenerator } from "@inevitable/shared";
import type { Policy, PolicyRequest, GovernanceDecision } from "./policy";

export type DecisionListener = (decision: GovernanceDecision) => void;

export interface GovernanceEngineOptions {
  idGenerator?: IdGenerator;
  /** Invoked for every decision so callers can emit governance.* events / audit it. */
  onDecision?: DecisionListener;
}

export class GovernanceEngine {
  private readonly policies: Policy[] = [];
  private readonly idGenerator: IdGenerator;
  private readonly onDecision: DecisionListener | undefined;

  constructor(policies: readonly Policy[] = [], options: GovernanceEngineOptions = {}) {
    this.idGenerator = options.idGenerator ?? new CryptoIdGenerator();
    this.onDecision = options.onDecision;
    for (const policy of policies) this.register(policy);
  }

  register(policy: Policy): void {
    this.policies.push(policy);
    this.policies.sort((a, b) => a.priority - b.priority);
  }

  list(): readonly Policy[] {
    return this.policies;
  }

  evaluate(request: PolicyRequest): GovernanceDecision {
    for (const policy of this.policies) {
      if (!policy.appliesTo(request)) continue;
      const outcome = policy.evaluate(request);
      if (outcome.decision === "allow") continue;
      return this.finalize(request, policy, outcome);
    }
    return this.finalize(
      request,
      { id: "default-allow", version: "1.0.0" },
      { decision: "allow", reason: "no policy objected" },
    );
  }

  private finalize(
    request: PolicyRequest,
    policy: { id: string; version: string },
    outcome: {
      decision: GovernanceDecision["decision"];
      reason: string;
      modifiedPayload?: Record<string, unknown>;
      evidence?: string[];
      reviewPath?: string;
    },
  ): GovernanceDecision {
    const decision: GovernanceDecision = {
      decision_id: newDecisionId(this.idGenerator),
      subject_cid: request.subjectCid,
      resource: request.resource,
      action: request.action,
      context: request.context ?? {},
      decision: outcome.decision,
      reason: outcome.reason,
      policy_id: policy.id,
      policy_version: policy.version,
      evidence: outcome.evidence ?? [],
      modified_payload: outcome.modifiedPayload ?? null,
      review_path: outcome.reviewPath ?? null,
      expires_at: null,
    };
    this.onDecision?.(decision);
    return decision;
  }
}
