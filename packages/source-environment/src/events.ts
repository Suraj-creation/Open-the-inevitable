/**
 * The `source.*` cognitive event family — environment-side canonical events of the CSE.
 * Family registered in @inevitable/events DEFAULT_EVENT_FAMILIES (owner: source-environment,
 * permanent, replayable). Acquisition-side `artifact.*` events remain with F15.
 * Spec: spec/source-environment/CSE-002-canonical-source-representation.md §9.
 */

export const SOURCE_EVENT_TYPES = {
  versionRegistered: "source.version.registered",
  layerConstructed: "source.layer.constructed",
  layerDegraded: "source.layer.degraded",
  canonicalizationPrioritized: "source.canonicalization.prioritized",
  anchorMigrated: "source.anchor.migrated",
  consentGranted: "source.consent.granted",
  consentRevoked: "source.consent.revoked",
  redactionCascaded: "source.redaction.cascaded",
  // CSE M9 T1 — Living Knowledge (CSE-006) + Source Fusion (CSE-015).
  claimRecorded: "source.claim.recorded",
  contradictionDetected: "source.contradiction.detected",
  fusionComposed: "source.fusion.composed",
  fusionConceptReconciled: "source.fusion.concept.reconciled",
  fusionGapDetected: "source.fusion.gap.detected",
  // CSE M9 T3 — the model-backed fused explanation synthesis (CSE-015 §3.1).
  fusionSynthesized: "source.fusion.synthesized",
  // CSE M9 Frontier T1 — the living-knowledge overlay (CSE-006 §3.2).
  frontierUpdated: "source.frontier.updated",
  // CSE M9 TKM T1 — the Temporal Knowledge Model / Concept Timeline (CSE-006 §3.3).
  timelineUpdated: "source.timeline.updated",
  // CSE M11 T1 — Creative Cognition (CSE-016 §5).
  creationStarted: "source.creation.started",
  creationEvolved: "source.creation.evolved",
  creationCritiqued: "source.creation.critiqued",
  creationCompleted: "source.creation.completed",
  // CSE M11 contribution loop (ADR-0051) — a completed creation becomes a Cognitive Source.
  creationContributed: "source.creation.contributed",
} as const;

export type SourceEventType = (typeof SOURCE_EVENT_TYPES)[keyof typeof SOURCE_EVENT_TYPES];

export interface SourceVersionRegisteredPayload {
  readonly source_id: string;
  readonly version_id: string;
  readonly modality: string;
  readonly content_hash: string;
  readonly content_ref: string;
  readonly supersedes: string | null;
}

export interface SourceLayerConstructedPayload {
  readonly source_id: string;
  readonly version_id: string;
  readonly layer: string;
  readonly artifact_id: string;
  readonly confidence: number;
  readonly produced_by: string;
}

export interface SourceLayerDegradedPayload extends SourceLayerConstructedPayload {
  readonly reason: string;
}

export interface SourceAnchorMigratedPayload {
  readonly anchor_id: string;
  readonly from_version: string;
  readonly to_version: string;
  readonly status: "resolved" | "moved" | "orphaned";
}

// CSE M9 T1 — Source Fusion (CSE-015 §5) + Claim Graph (CSE-006 §3.1).

export interface SourceFusionComposedPayload {
  readonly learner_cid: string | null;
  readonly concept_refs: readonly string[];
  readonly source_version_ids: readonly string[];
}

export interface SourceFusionConceptReconciledPayload {
  readonly concept_ref: string;
  readonly source_version_ids: readonly string[];
  readonly corroborated: boolean;
  readonly confidence: number;
}

export interface SourceFusionGapDetectedPayload {
  readonly concept_ref: string;
  readonly reason: string;
  readonly suggested_action: string;
}

export interface SourceContradictionDetectedPayload {
  readonly claim_ids: readonly string[];
  readonly source_version_ids: readonly string[];
  /** empirical | interpretive | value — a value disagreement is never presented as factual. */
  readonly nature: "empirical" | "interpretive" | "value";
}

// CSE M9 T3 — the fused explanation synthesis (CSE-015 §3.1).

export interface SourceFusionSynthesizedPayload {
  readonly concept_ref: string;
  /** The sources the synthesis draws on (a subset of the contributing sources — the grounding gate). */
  readonly source_version_ids: readonly string[];
  readonly acknowledges_disagreement: boolean;
  readonly degraded: boolean;
}

// CSE M9 Frontier T1 — the living-knowledge overlay (CSE-006 §3.2).

export interface SourceFrontierUpdatedPayload {
  readonly overlay_id: string;
  readonly concept_ref: string;
  readonly source_version_id: string | null;
  readonly entry_count: number;
  /** Distinct external origins cited across the overlay's entries (real, fetchable). */
  readonly citation_count: number;
  readonly as_of: string;
  readonly degraded: boolean;
}

// CSE M9 TKM T1 — the Temporal Knowledge Model / Concept Timeline (CSE-006 §3.3).

export interface SourceTimelineUpdatedPayload {
  readonly timeline_id: string;
  readonly concept_ref: string;
  readonly source_version_id: string | null;
  readonly state_count: number;
  readonly citation_count: number;
  readonly as_of: string;
  readonly degraded: boolean;
}

// CSE M11 T1 — Creative Cognition (CSE-016 §5).

export interface SourceCreationStartedPayload {
  readonly creation_id: string;
  readonly learner_cid: string | null;
  readonly kind: string;
  readonly concept_refs: readonly string[];
}

export interface SourceCreationAssistedPayload {
  readonly creation_id: string;
  /** scaffold | critique | provocation | reference — never `generate` (Constitution #5). */
  readonly assist_kind: string;
  readonly agent_cid: string;
  readonly disclosed: true;
  readonly degraded: boolean;
}

export interface SourceCreationCompletedPayload {
  readonly creation_id: string;
  readonly kind: string;
  readonly assist_count: number;
}

/** A completed creation was consented into the substrate as a Cognitive Source (ADR-0051). */
export interface SourceCreationContributedPayload {
  readonly creation_id: string;
  readonly kind: string;
  /** The source version the creation became — now citable/fusable like any other source. */
  readonly source_version_id: string;
  readonly content_hash: string;
  /** The disclosed authorship trail travels as provenance, never as source content (CSE-016 §6). */
  readonly assist_count: number;
  readonly consent_ref: string;
}

// CSE-002 §8 consent lifecycle (ADR-0054) — durable envelope + revoke → redaction cascade.

export interface SourceConsentGrantedPayload {
  readonly consent_ref: string;
  readonly source_version_id: string;
  readonly learner_cid: string | null;
  /** What the consent covers (e.g. "commons" — shared into the knowledge commons). */
  readonly scope: string;
}

export interface SourceConsentRevokedPayload {
  readonly consent_ref: string;
  readonly source_version_id: string;
  readonly learner_cid: string | null;
}

/** The redaction that follows a revocation — content + reachability withdrawn, identity preserved. */
export interface SourceRedactionCascadedPayload {
  readonly consent_ref: string;
  readonly source_version_id: string;
  readonly redacted_counts: {
    /** Commons entries delisted. */
    readonly commons_entries: number;
    /** Source versions whose bytes were withheld (content route now 410). */
    readonly content_withheld: number;
  };
}
