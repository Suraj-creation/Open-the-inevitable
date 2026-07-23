/**
 * @inevitable/source-environment — the Cognitive Source Environment foundation (M1).
 *
 * Owns: source identity/versions (content-addressed), the Source Anchor (multi-selector, pure
 * resolution, cross-version migration), the eight-layer artifact model, the anchor index,
 * progressive canonicalization behind modality adapters, the `source.*` event family emission,
 * and the replay fold.
 *
 * Specs: spec/source-environment/CSE-002 (canonical representation), ADR-0032;
 * blueprint: spec/implementation-roadmaps/cse-implementation-blueprint.md (M1).
 */
export type { SourceId, SourceVersionId, AnchorId, LayerArtifactId } from "./ids";
export { newSourceId, newSourceVersionId, newAnchorId, newLayerArtifactId } from "./ids";

export type { SourceModality, SourceProvenance, SourceVersion } from "./identity";
export {
  SOURCE_MODALITIES,
  CONSENT_REQUIRED_MODALITIES,
  contentHash,
  isSourceModality,
} from "./identity";

export type {
  SourceLayer,
  SourceLayerArtifact,
  StructuralLayerContent,
  StructuralRegion,
  VisualLayerContent,
  VisualPage,
  SemanticConcept,
  SemanticLayerContent,
  TermDefinition,
  CitationReference,
  CitationLayerContent,
  MeaningLayerContent,
  MeaningUnit,
  MeaningUnitKind,
  TemporalSegment,
  TemporalLayerContent,
} from "./layers";
export {
  SOURCE_LAYERS,
  SHARED_LAYERS,
  LEARNER_CONDITIONED_LAYERS,
  MEANING_UNIT_KINDS,
  isSourceLayer,
} from "./layers";

export type {
  AnchorGranularity,
  AnchorSelector,
  AnchorSelectorType,
  SourceAnchor,
  ResolvedRegion,
  AnchorResolution,
  AnchorMigration,
  AnchorMigrationStatus,
  CreateAnchorInput,
} from "./anchors";
export { ANCHOR_GRANULARITIES, createAnchor, resolveAnchor, migrateAnchor } from "./anchors";

export { AnchorIndex } from "./anchor-index";

export type { ModalityAdapter, ParsedSource } from "./reference-adapters";
export {
  MarkdownReferenceAdapter,
  PlainTextReferenceAdapter,
  CodeReferenceAdapter,
  WebReferenceAdapter,
  VideoTranscriptAdapter,
  NotebookReferenceAdapter,
  DatasetReferenceAdapter,
} from "./reference-adapters";

export type {
  SourceEventType,
  SourceVersionRegisteredPayload,
  SourceLayerConstructedPayload,
  SourceLayerDegradedPayload,
  SourceAnchorMigratedPayload,
  SourceFusionComposedPayload,
  SourceFusionConceptReconciledPayload,
  SourceFusionGapDetectedPayload,
  SourceFusionSynthesizedPayload,
  SourceFrontierUpdatedPayload,
  SourceTimelineUpdatedPayload,
  SourceCreationStartedPayload,
  SourceCreationAssistedPayload,
  SourceCreationCompletedPayload,
  SourceCreationContributedPayload,
  SourceConsentGrantedPayload,
  SourceConsentRevokedPayload,
  SourceRedactionCascadedPayload,
  SourceContradictionDetectedPayload,
} from "./events";

export type {
  ConsentEnvelope,
  Creation,
  CreationAssist,
  CreationAssistKind,
  CreationKind,
  CreationStatus,
  CritiqueFinding,
  CreationReferenceRef,
  ScaffoldSlot,
} from "./creation";
export {
  CREATION_KINDS,
  CREATION_ASSIST_KINDS,
  isCreationKind,
  isCreationAssistKind,
} from "./creation";

export type {
  FrontierEntry,
  FrontierEntryKind,
  FrontierExternalRef,
  FrontierOverlay,
} from "./frontier";
export { FRONTIER_ENTRY_KINDS, isFrontierEntryKind } from "./frontier";

export type { ConceptTimeline, EpistemicState, EpistemicStateKind } from "./temporal";
export { EPISTEMIC_STATE_KINDS, isEpistemicStateKind } from "./temporal";
export { SOURCE_EVENT_TYPES } from "./events";

export type {
  Claim,
  ClaimEdge,
  ClaimEdgeType,
  ClaimEpistemicStatus,
  ClaimSummary,
  Contradiction,
  ContradictionNature,
  Coverage,
  CoverageGap,
  FusedConcept,
  FusedSynthesis,
  FusionResult,
  SourceTreatment,
  TreatmentEmphasis,
} from "./fusion";
export { reconcileConcept, detectGaps, detectContradictions } from "./fusion";

export type {
  CanonicalSourceEnvironment,
  RegisterVersionInput,
  CreateAnchorRequest,
  SourceEnvironmentStoreDeps,
  SourceEnvironmentProjection,
} from "./store";
export { SourceEnvironmentStore } from "./store";

export { foldSourceEvents } from "./projection";

export type {
  SourceCacheStats,
  SourceCognitionActivity,
  SourceCognitionEntry,
  SourceCognitionState,
  SourceLayerHealth,
} from "./cognition-projection";
export { foldSourceCognition } from "./cognition-projection";
