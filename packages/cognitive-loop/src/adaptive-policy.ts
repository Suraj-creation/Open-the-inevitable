/**
 * AdaptivePolicy — the DYNAMIC, addressable, versioned Cognitive Object the loop accumulates into
 * (10 §2.1 "Cognitive Objects (persistent identity)"; 03 §1.2 Adaptive Policy). Unlike a session, it
 * is object-centric: a stable `ref` (cog://policy/<agent>/<learner>) whose versions form an
 * append-only lineage, each derived from the prior version by exactly one governed proposal
 * (immutable lineage, never mutate-in-place). For the L2 walking skeleton the ONE adapted dimension
 * is the Explainer's per-learner strategy preference — deliberately one dimension (§11.5).
 */
import type { ExplanationStrategy } from "./constitution";
import { EXPLANATION_STRATEGIES } from "./constitution";

/** Addressable Cognitive Object identity (10 §7 gap 1 — objects, not session-scoped blocks). */
export type CognitiveObjectRef = `cog://policy/${string}/${string}`;

export function policyRef(agentId: string, learnerCid: string): CognitiveObjectRef {
  return `cog://policy/${agentId}/${learnerCid}`;
}

export interface AdaptivePolicy {
  readonly ref: CognitiveObjectRef;
  readonly version: number;
  readonly agent_id: string;
  readonly learner_cid: string;
  readonly constitution_id: string;
  /** Preference weight per strategy; the compiler selects argmax. Weights are not normalized. */
  readonly strategy_weights: Readonly<Record<ExplanationStrategy, number>>;
  /** Provenance: the accepted proposal id that produced this version (null for the seed v1). */
  readonly derived_from_proposal: string | null;
  /** Provenance: the prior version this was derived from (null for the seed v1). */
  readonly parent_version: number | null;
}

/** The seed (v1) policy — uniform weights, no preference yet learned. */
export function seedPolicy(
  agentId: string,
  learnerCid: string,
  constitutionId: string,
): AdaptivePolicy {
  const weights = Object.fromEntries(EXPLANATION_STRATEGIES.map((s) => [s, 1])) as Record<
    ExplanationStrategy,
    number
  >;
  return {
    ref: policyRef(agentId, learnerCid),
    version: 1,
    agent_id: agentId,
    learner_cid: learnerCid,
    constitution_id: constitutionId,
    strategy_weights: weights,
    derived_from_proposal: null,
    parent_version: null,
  };
}

/** Deterministic argmax with stable tiebreak by EXPLANATION_STRATEGIES order (replay-safe). */
export function preferredStrategy(policy: AdaptivePolicy): ExplanationStrategy {
  let best: ExplanationStrategy = EXPLANATION_STRATEGIES[0] ?? "concrete-first";
  let bestW = Number.NEGATIVE_INFINITY;
  for (const s of EXPLANATION_STRATEGIES) {
    const w = policy.strategy_weights[s];
    if (w > bestW) {
      bestW = w;
      best = s;
    }
  }
  return best;
}

/**
 * Port: versioned Cognitive Object store. In-memory for the skeleton; the Postgres-backed store
 * (the same seam as PostgresLearnerStore) drops in at the L1.5 Cognitive-State-Integrity gate.
 */
export interface PolicyStore {
  get(ref: CognitiveObjectRef): AdaptivePolicy | undefined;
  put(policy: AdaptivePolicy): void;
  history(ref: CognitiveObjectRef): readonly AdaptivePolicy[];
}

export class InMemoryPolicyStore implements PolicyStore {
  private readonly versions = new Map<string, AdaptivePolicy[]>();

  get(ref: CognitiveObjectRef): AdaptivePolicy | undefined {
    const list = this.versions.get(ref);
    return list && list.length > 0 ? list[list.length - 1] : undefined;
  }

  put(policy: AdaptivePolicy): void {
    const list = this.versions.get(policy.ref) ?? [];
    list.push(policy);
    this.versions.set(policy.ref, list);
  }

  history(ref: CognitiveObjectRef): readonly AdaptivePolicy[] {
    return this.versions.get(ref) ?? [];
  }
}
