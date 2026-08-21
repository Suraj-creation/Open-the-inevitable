/**
 * Constitution — the STATIC, governed, versioned identity of a living cognitive agent
 * (spec/research/living-cognitive-agents/02; 10 §6 "STATIC (Constitution — governed, versioned)").
 * It is what the agent IS and MAY do; the agent never changes it — only governed authoring does.
 * All Layer-B/C adaptation is BOUNDED by it: the Adaptive Policy (the dynamic Cognitive Object) may
 * only move within `allowed_strategies` and `adaptation_bounds`. For the L2 walking skeleton the
 * Constitution is promoted from an AgentManifest (10 §10 — "promote the manifest to a governed
 * Constitution"), and the single adapted dimension is the Explainer's teaching strategy.
 */

/** The one adapted dimension for L2: the entry-angle the Explainer leads with. */
export type ExplanationStrategy = "concrete-first" | "abstract-first" | "visual-first";

/** Canonical order — the deterministic tiebreak for argmax selection (replay-safe). */
export const EXPLANATION_STRATEGIES: readonly ExplanationStrategy[] = [
  "concrete-first",
  "abstract-first",
  "visual-first",
];

export interface AdaptationBounds {
  /** Max absolute change to any single strategy weight in one accepted proposal (governor-enforced). */
  readonly maxWeightDeltaPerProposal: number;
}

export interface Constitution {
  readonly constitution_id: string;
  readonly version: number;
  readonly agent_id: string;
  readonly identity: string;
  readonly role: string;
  /** The bound within which adaptation is allowed — a policy may never drive a strategy outside this. */
  readonly allowed_strategies: readonly ExplanationStrategy[];
  /** Actions the agent may never take (governor-enforced; identity and authority are immutable). */
  readonly forbidden_actions: readonly string[];
  readonly adaptation_bounds: AdaptationBounds;
  /** The single outcome metric this agent is evaluated and adapted against (one dimension, L2). */
  readonly evaluation_metric: string;
}

/** Minimal structural view of an AgentManifest — enough to promote it to a Constitution (10 §10). */
export interface ManifestLike {
  readonly id: string;
  readonly role: string;
  readonly capabilities?: readonly string[];
  readonly policies?: readonly string[];
}

type ConstitutionOverrides = Partial<
  Pick<
    Constitution,
    | "allowed_strategies"
    | "forbidden_actions"
    | "adaptation_bounds"
    | "evaluation_metric"
    | "version"
  >
>;

/** Promote a manifest to a governed Constitution. Overrides let a test tighten the allowed set. */
export function constitutionFromManifest(
  manifest: ManifestLike,
  overrides: ConstitutionOverrides = {},
): Constitution {
  return {
    constitution_id: `constitution:${manifest.id}`,
    version: overrides.version ?? 1,
    agent_id: manifest.id,
    identity: manifest.id,
    role: manifest.role,
    allowed_strategies: overrides.allowed_strategies ?? EXPLANATION_STRATEGIES,
    forbidden_actions: overrides.forbidden_actions ?? [
      "change_identity",
      "exceed_adaptation_bounds",
      "adopt_forbidden_strategy",
    ],
    adaptation_bounds: overrides.adaptation_bounds ?? { maxWeightDeltaPerProposal: 0.5 },
    evaluation_metric: overrides.evaluation_metric ?? "learner_outcome_score",
  };
}
