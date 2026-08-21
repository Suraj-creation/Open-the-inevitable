/**
 * Reflection — the return path that turns a lived episode into a governed policy proposal (04 §1;
 * 10 §3 "the reflection/consolidation return path" — the intelligence plane's `agent.strategy-outcome`
 * distillate is recorded today but never read back; this closes that socket). Attribution gate
 * (04 §1.3): reflection ≠ learning — it only PROPOSES; nothing changes until the governor accepts.
 *
 * v1 rule (one dimension): reinforce the strategy actually used toward its observed outcome (a bounded
 * EMA step), so the policy's argmax converges to the learner's best-fit strategy.
 */
import type { AdaptivePolicy } from "./adaptive-policy";
import type { ExplanationStrategy } from "./constitution";

export interface PolicyProposal {
  readonly proposal_id: string;
  readonly policy_ref: string;
  readonly base_version: number;
  readonly strategy: ExplanationStrategy;
  /** Signed change to the strategy's weight (governor validates against `adaptation_bounds`). */
  readonly weight_delta: number;
  readonly rationale: string;
  /** Event ids this proposal is attributed to — provenance for replay (metric C). */
  readonly evidence: readonly string[];
}

export interface ReflectInput {
  readonly policy: AdaptivePolicy;
  readonly strategy: ExplanationStrategy;
  readonly score: number;
  readonly evidence: readonly string[];
  readonly proposalId: string;
}

export class Reflection {
  constructor(private readonly learningRate = 0.6) {}

  reflect(input: ReflectInput): PolicyProposal {
    const current = input.policy.strategy_weights[input.strategy];
    // Move the used strategy's weight toward its observed score (bounded EMA step). Positive when the
    // strategy taught well; negative when it did not — evidence, not aspiration.
    const delta = this.learningRate * (input.score - current);
    return {
      proposal_id: input.proposalId,
      policy_ref: input.policy.ref,
      base_version: input.policy.version,
      strategy: input.strategy,
      weight_delta: delta,
      rationale: `strategy "${input.strategy}" scored ${input.score.toFixed(2)}; adjust weight by ${delta.toFixed(3)}`,
      evidence: input.evidence,
    };
  }
}
