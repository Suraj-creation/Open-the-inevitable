/**
 * Source Fusion + the Claim primitive (CSE M9 T1; CSE-015, CSE-006, ADR-0040).
 *
 * Fusion reconciles many sources into ONE cognitive environment: a concept understood from all
 * sources at once — corroboration strengthened, each source's emphasis composed, coverage gaps
 * named — while every treatment stays traceable to its source anchors (Source Law: Grounded).
 *
 * `reconcileConcept` is a PURE function of each source's treatment (deterministic, replay-safe;
 * no model, no network — CSE-015 §2 "reconciliation, not averaging"). The model-backed fused
 * *explanation* synthesis (CSE-015 §3.1) is T2. The Claim types are present, but T1 never
 * fabricates a contradiction: `detectContradictions` returns [] absent extracted claim data
 * (CSE-006 §2/§6 — a false contradiction is worse than none).
 */

// ---------------------------------------------------------------------------
// The Claim primitive (CSE-006 §3.1)
// ---------------------------------------------------------------------------

export type ClaimEpistemicStatus =
  | "established"
  | "supported"
  | "contested"
  | "speculative"
  | "superseded";

export type ClaimEdgeType =
  | "supports"
  | "contradicts"
  | "refines"
  | "replicates"
  | "fails-to-replicate"
  | "supersedes";

export interface ClaimEdge {
  readonly type: ClaimEdgeType;
  readonly target_claim: string;
  readonly evidence_anchors: readonly string[];
}

export interface Claim {
  readonly claim_id: string;
  readonly statement: string;
  /** Source anchors (structural region paths) asserting this claim — Grounded (CSE-006 §3.1). */
  readonly anchors: readonly string[];
  /** Concept ids this claim is about (kebab-case, KG-compatible) — the `about` edge targets. */
  readonly about_concepts: readonly string[];
  readonly source_version_id: string;
  readonly epistemic_status: ClaimEpistemicStatus;
  readonly edges: readonly ClaimEdge[];
}

export type ContradictionNature = "empirical" | "interpretive" | "value";

export interface Contradiction {
  readonly claim_ids: readonly string[];
  readonly source_version_ids: readonly string[];
  readonly nature: ContradictionNature;
  /** A short, honest note on the disagreement — never asserts a winner (CSE-006 §2). */
  readonly rationale?: string;
}

// ---------------------------------------------------------------------------
// Fusion primitives (CSE-015 §3)
// ---------------------------------------------------------------------------

export type Coverage = "full" | "partial" | "absent";
export type TreatmentEmphasis =
  | "definition"
  | "derivation"
  | "application"
  | "intuition"
  | "critique";

/** How one source treats a concept — the fusion input, drawn from the anchor index. */
export interface SourceTreatment {
  readonly source_version_id: string;
  readonly title: string;
  readonly anchor_refs: readonly string[];
  readonly emphasis: TreatmentEmphasis;
  readonly coverage: Coverage;
  /** A short representative quote (evidence stays traceable — never blurred). */
  readonly quote: string | null;
}

export interface FusedConcept {
  readonly concept_ref: string;
  readonly source_treatments: readonly SourceTreatment[];
  readonly reconciliation: {
    /** Corroborated when ≥2 sources cover the concept — fusion strengthens agreement (§2). */
    readonly corroborated: boolean;
    readonly corroborating_source_ids: readonly string[];
    /** Each covering source's distinct emphasis (fusion composes complements). */
    readonly complements: readonly {
      readonly aspect: TreatmentEmphasis;
      readonly from_source: string;
    }[];
    /** Cross-source contradictions — only from extracted claim data; [] absent claims (§honest). */
    readonly contradictions: readonly Contradiction[];
  };
  readonly confidence: number;
  /**
   * The claims each source makes about this concept (M9 T2, CSE-006 §3.1). Optional: absent when no
   * model extracted claims (honest — the T1 coverage view). Every claim stays traceable to its
   * source anchors — fusion never blurs provenance. The Contradiction Explorer joins its
   * `claim_ids` back to these summaries.
   */
  readonly claims?: readonly ClaimSummary[];
  /**
   * The fused explanation (M9 T3, CSE-015 §3.1): a model-woven prose understanding drawn from all
   * contributing sources, citing each by name and surfacing disagreement honestly. Optional: absent
   * when no model synthesized (honest — the T2 structured view). `fused_explanation_ref`.
   */
  readonly synthesis?: FusedSynthesis;
}

/**
 * A fused explanation of one concept (CSE-015 §3.1). Inference-class: prose woven from the
 * contributing sources, never outside knowledge, citing every source it draws on and never
 * flattening a live disagreement (CSE-015 §2/§6).
 */
export interface FusedSynthesis {
  /** The woven explanation — grounded in the sources, each named inline. */
  readonly prose: string;
  /** Source version ids the synthesis draws on — a subset of the contributing sources (the gate). */
  readonly cited_source_ids: readonly string[];
  /** True when the synthesis explicitly surfaces a cross-source disagreement (never smoothed away). */
  readonly acknowledges_disagreement: boolean;
  /** True when the model was unavailable and this is the deterministic alignment view (honest). */
  readonly degraded: boolean;
}

/** A claim as surfaced on a fused concept — the source's own words, traceable to its anchors. */
export interface ClaimSummary {
  readonly claim_id: string;
  readonly statement: string;
  readonly source_version_id: string;
  readonly epistemic_status: ClaimEpistemicStatus;
  readonly anchor_refs: readonly string[];
}

export interface CoverageGap {
  readonly concept_ref: string;
  readonly reason: string;
  readonly suggested_action: string;
}

export interface FusionResult {
  readonly concept_refs: readonly string[];
  readonly source_version_ids: readonly string[];
  readonly concepts: readonly FusedConcept[];
  readonly gaps: readonly CoverageGap[];
}

// ---------------------------------------------------------------------------
// Reconciliation (pure, deterministic)
// ---------------------------------------------------------------------------

/**
 * Reconcile one concept across its source treatments (CSE-015 §3.1). Deterministic: given the
 * same treatments (+ optional extracted claims) it yields the same FusedConcept. Corroboration
 * needs ≥2 sources with non-absent coverage; complements pair each covering source with its
 * emphasis; contradictions come ONLY from the claim graph (T1 passes none ⇒ [], never invented).
 * Confidence rises with corroborating breadth and coverage depth.
 */
export function reconcileConcept(
  conceptRef: string,
  treatments: readonly SourceTreatment[],
  contradictions: readonly Contradiction[] = [],
): FusedConcept {
  const covering = treatments.filter((t) => t.coverage !== "absent");
  const corroboratingIds = covering.map((t) => t.source_version_id);
  const corroborated = covering.length >= 2;
  const complements = covering.map((t) => ({
    aspect: t.emphasis,
    from_source: t.source_version_id,
  }));
  // Confidence: 0 with no coverage; ~0.55 for a single source; approaching 0.9 as more sources
  // corroborate; a `full` treatment counts more than a `partial` one. Deterministic + bounded.
  const depth = covering.reduce((sum, t) => sum + (t.coverage === "full" ? 1 : 0.5), 0);
  const confidence =
    covering.length === 0 ? 0 : Math.min(0.9, 0.35 + 0.2 * depth + (corroborated ? 0.1 : 0));
  return {
    concept_ref: conceptRef,
    source_treatments: treatments,
    reconciliation: {
      corroborated,
      corroborating_source_ids: corroboratingIds,
      complements,
      contradictions,
    },
    confidence: Math.round(confidence * 100) / 100,
  };
}

/**
 * Coverage gaps (CSE-015 §3.3): target concepts that NO fused source covers — an honest
 * research/ingestion prompt, never a blank. Deterministic over the fused set.
 */
export function detectGaps(
  targetConceptRefs: readonly string[],
  fused: readonly FusedConcept[],
): CoverageGap[] {
  const covered = new Set(
    fused
      .filter((f) => f.source_treatments.some((t) => t.coverage !== "absent"))
      .map((f) => f.concept_ref),
  );
  return targetConceptRefs
    .filter((c) => !covered.has(c))
    .map((concept_ref) => ({
      concept_ref,
      reason: "no attached source covers this concept",
      suggested_action: "add a source that covers it, or research the frontier",
    }));
}

/**
 * Cross-source contradiction detection over the Claim Graph (CSE-006 §3.1). T1: reads existing
 * `contradicts` edges between claims from DIFFERENT sources — honest, never fabricated. Returns []
 * when there is no claim data (claim extraction is T2). A value/interpretive disagreement is
 * labeled as such, never presented as an empirical (factual) one (CSE-006 §3.1).
 */
export function detectContradictions(claims: readonly Claim[]): Contradiction[] {
  if (claims.length === 0) return [];
  const byId = new Map(claims.map((c) => [c.claim_id, c]));
  const seen = new Set<string>();
  const contradictions: Contradiction[] = [];
  for (const claim of claims) {
    for (const edge of claim.edges) {
      if (edge.type !== "contradicts") continue;
      const target = byId.get(edge.target_claim);
      if (!target || target.source_version_id === claim.source_version_id) continue; // same source
      const key = [claim.claim_id, target.claim_id].sort().join("|");
      if (seen.has(key)) continue;
      seen.add(key);
      contradictions.push({
        claim_ids: [claim.claim_id, target.claim_id].sort(),
        source_version_ids: [claim.source_version_id, target.source_version_id].sort(),
        // T1 default: interpretive. Empirical/value classification needs semantic analysis of the
        // claims (T2); until then we never present a disagreement as an empirical (factual) one.
        nature: "interpretive",
      });
    }
  }
  return contradictions;
}
