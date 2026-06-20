export {
  COGNITION_BLOCK_TYPES,
  createCognitionBlock,
  type BlockClassification,
  type BlockProvenance,
  type CognitionBlock,
  type CognitionBlockType,
  type CreateBlockContext,
  type CreateBlockInput,
} from "./blocks";
export {
  AgentContributionRuntime,
  contributionFromDispatch,
  type AgentContribution,
  type AgentContributionRuntimeDeps,
} from "./contribution";
export {
  foldSurfaceEvents,
  type AgentPresence,
  type AgentPresenceState,
  type FocusTargetType,
  type NarrationSegment,
  type NarrationVoice,
  type SurfaceContributionRecord,
  type SurfaceFocus,
  type SurfaceRoutingRecord,
  type SurfaceState,
} from "./projection";
export {
  NullMultimodalProvider,
  ProviderRegistry,
  surfaceProviderError,
  type ImageGenerationProvider,
  type LiveSessionHandle,
  type LiveSessionProvider,
  type MediaArtifact,
  type MediaModality,
  type MediaRequest,
  type MultimodalProvider,
  type ProviderDescriptor,
  type VideoGenerationProvider,
  type VoiceProvider,
} from "./providers";
export {
  SurfaceChoreographer,
  segmentNarration,
  collectNarrationTexts,
  type NarrateBlockInput,
  type NarrateInput,
  type PresenceInput,
  type SurfaceChoreographerDeps,
  type VoiceSynthesisRequest,
  type VoiceSynthesizer,
} from "./narration";
export { TextSurfaceRenderer, type SurfaceRenderer } from "./renderer";
export {
  SurfaceSession,
  type GovernedDispatcher,
  type SurfaceAskInput,
  type SurfaceAskResult,
  type SurfaceSessionDeps,
} from "./session";
export {
  SurfaceTimelineBuilder,
  type SurfaceTimelineBuilderDeps,
  type SurfaceTimelineInput,
  type SurfaceTimelineNode,
  type TimelineNodeStatus,
  type TimelineProjection,
} from "./timeline";
export { traceBlock, type BlockTrace } from "./trace";
