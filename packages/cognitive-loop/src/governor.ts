/**
 * AdaptationGovernor — governance is intrinsic to cognition, evaluated BEFORE the state change
 * (CLAUDE.md §3; 10 §4 process 14 "Adaptation Governor"). It is the thinnest real instance of the
 * propose → evaluate → accept/version → (rollback) shape the EvolutionEngine generalizes at Phase 6.
 * A proposal is accepted only if it stays within the Constitution's `allowed_strategies` and
 * `adaptation_bounds` and is not stale; acceptance MINTS A NEW VERSIONED policy object (immutable
 * lineage) — it never mutates in place, and never touches the agent's identity.
 */
import type { AdaptivePolicy } from "./adaptive-policy";
import type { Constitution, ExplanationStrategy } from "./constitution";
import type { PolicyProposal } from "./reflection";

export interface GovernanceDecision {
  readonly accepted: boolean;
  readonly reason: string;
  /** The new policy version when accepted; undefined when rejected. */
  readonly policy?: AdaptivePolicy;
}

export interface GovernInput {
  readonly constitution: Constitution;
  readonly policy: AdaptivePolicy;
  readonly proposal: PolicyProposal;
}

export class AdaptationGovernor {
  govern(input: GovernInput): GovernanceDecision {
    const { constitution, policy, proposal } = input;

    if (!constitution.allowed_strategies.includes(proposal.strategy)) {
      return {
        accepted: false,
        reason: `strategy "${proposal.strategy}" is outside the Constitution's allowed set`,
      };
    }
    if (
      Math.abs(proposal.weight_delta) > constitution.adaptation_bounds.maxWeightDeltaPerProposal
    ) {
      return {
        accepted: false,
        reason: `weight delta ${proposal.weight_delta.toFixed(3)} exceeds adaptation bound ${constitution.adaptation_bounds.maxWeightDeltaPerProposal}`,
      };
    }
    if (proposal.base_version !== policy.version) {
      return {
        accepted: false,
        reason: `proposal is stale (base v${proposal.base_version} ≠ current v${policy.version})`,
      };
    }

    const nextWeights: Record<ExplanationStrategy, number> = { ...policy.strategy_weights };
    nextWeights[proposal.strategy] = clampNonNeg(
      nextWeights[proposal.strategy] + proposal.weight_delta,
    );
    const next: AdaptivePolicy = {
      ...policy,
      version: policy.version + 1,
      strategy_weights: nextWeights,
      derived_from_proposal: proposal.proposal_id,
      parent_version: policy.version,
    };
    return { accepted: true, reason: "within Constitution bounds", policy: next };
  }
}

function clampNonNeg(n: number): number {
  return n < 0 ? 0 : n;
}
