/**
 * Browser-safe surface client surface — the projection layer's shared truth function.
 *
 * This entry exposes ONLY pure, Node-free pieces so a remote viewport (apps/web) can fold the
 * streamed `surface.*` event log into `SurfaceState` with the SAME function the runtime uses.
 * Replay equivalence (SRF-005 §6.2) holds because there is exactly one fold.
 *
 * Import boundary: `foldSurfaceEvents` (from ./projection) has no runtime imports — its only
 * dependencies are type-only and erased at compile. Everything else here is a `type` re-export.
 * Do NOT add runtime value exports that import Node APIs (e.g. anything pulling in @inevitable/shared)
 * — that would break the browser bundle and the "the UI is a projection" boundary.
 *
 * Spec: spec/surface/surface-streaming-sync-protocol.md §2, §6; spec/surface/cognitive-surface-runtime.md §4.5.
 */
export { foldSurfaceEvents } from "./projection";
export type {
  SurfaceState,
  SurfaceContributionRecord,
  SurfaceRoutingRecord,
  SurfaceFocus,
  FocusTargetType,
  NarrationSegment,
  NarrationVoice,
  AgentPresence,
  AgentPresenceState,
  DisagreementRecord,
  ProposalRecord,
  SynthesisRecord,
  InteractionRecord,
  InteractionKind,
  DepthGateRecord,
  PrerequisiteDescentRecord,
  ResearchFrontierRecord,
  ResumeCardRecord,
  EvaluationRecord,
  ProductMode,
  ProjectionMode,
  StreamingBlockBuffer,
  AgentReasoningRecord,
  AgentWorkTimingRecord,
  AgentWorkStatus,
} from "./projection";
export type {
  RepresentationPlan,
  RepresentationElementPlan,
  RepresentationHierarchy,
  RepresentationDensity,
  EpistemicRole,
  ExpertiseLevel,
  RepresentationAdaptivity,
} from "./representation";
export { EPISTEMIC_ROLE_ORDER } from "./representation";
export { deriveEpisodes, currentEpisode } from "./episodes";
export type { Episode } from "./episodes";
export type { SemanticSection } from "./semantic-explanation";
export type {
  CognitionBlock,
  CognitionBlockType,
  BlockProvenance,
  BlockClassification,
} from "./blocks";
export type {
  CognitiveFrame,
  CognitiveFrameStatus,
  FrameLayout,
  FrameLayoutSlot,
  FrameProvenance,
  ImageDecisionRecord,
  Mccr,
  MccrDiagram,
  MccrElement,
  MccrElementContent,
  MccrElementType,
  MccrImageArtifact,
  NarrationIntent,
  NarrationScriptRecord,
  NarrationScriptSegment,
  StreamingFrameElementBuffer,
} from "./frames";
export type {
  TimelineProjection,
  SurfaceTimelineNode,
  TimelineNodeStatus,
  SurfaceTimelineEdge,
  TimelineEdgeType,
  TimelineEntryPoint,
} from "./timeline";
export type {
  AffectSignalRecord,
  AffectState,
  AttentionBudgetRecord,
  DirectiveRecord,
  DirectiveScale,
  DirectorState,
  SceneActor,
  SceneDeltaRecord,
  SceneLighting,
  SceneRecord,
} from "./theater";
export type { SceneShot, ShotKind } from "./cinematography";
export type { ExpressedIntentRecord, InteractionClass, InteractionRouting } from "./interaction";
export type {
  FrontierEntryView,
  FrontierOverlayView,
  SourceBindingRecord,
  SourceHighlightAmplitude,
  SourceHighlightLifetime,
  SourceHighlightRecord,
  SourceHighlightRole,
  SourceProvenanceClass,
  SourceRegionView,
  SourceSyncBinding,
  SourceSyncBindingRecord,
  SourceViewport,
  SourceViewportChangeRecord,
  SourceViewportPlanRecord,
  ViewportChangeCause,
  ViewportEmphasis,
  SurfaceFrontierProvider,
  SourceRenderDecision,
  SourceRenderPlacement,
  PlanSourceRenderInput,
} from "./source-projection";
export { planSourceRender } from "./source-projection";
