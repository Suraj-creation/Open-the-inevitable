export type { OnboardingInput, OnboardingSession, PersonaClass, ProductMode } from "./types";
export type { ConceptSeed, LearningPathInput, LearningPathProjection } from "./learning-path";
export { LearningPathProjector } from "./learning-path";
export type {
  DepthTestKind,
  DepthTestResult,
  DeterministicLearningLoopDeps,
  DeterministicLearningLoopInput,
  DeterministicLearningLoopResult,
  LearningLoopMasteryInput,
} from "./learning-loop";
export { DeterministicLearningLoop } from "./learning-loop";
export { MVP_AGENT_MANIFESTS, minimalAgentSet } from "./agent-catalog";
export type {
  ProductDispatchInput,
  ProductDispatchResult,
  ProductRuntimeAgentId,
  ProductRuntimeDispatcherDeps,
  RuntimeAgentBinding,
} from "./runtime-dispatch";
export { DeterministicMvpUnit, ProductRuntimeDispatcher } from "./runtime-dispatch";
export type {
  DepthGateOutcome,
  MasteryCheckpoint,
  MasteryCheckpointInput,
  MasteryCheckpointRecorderDeps,
} from "./mastery";
export { MasteryCheckpointRecorder } from "./mastery";
export type { ProductOnboardingDeps } from "./onboarding";
export { ProductOnboardingService } from "./onboarding";
export type { SupervisorRoutingDecision, SupervisorTargetAgent } from "./supervisor";
export { MASTERY_CONFIDENCE_THRESHOLD, SupervisorUnit } from "./supervisor";
export {
  PRODUCT_DISPATCH_POLICIES,
  productDispatchCapabilityGate,
  productDispatchClassificationGate,
  productDispatchTrustGate,
} from "./product-dispatch-policies";
export type {
  FiberedLearningLoopDeps,
  FiberedLearningLoopInput,
  FiberedLearningLoopResult,
} from "./fiber-learning-loop";
export { FiberedLearningLoop } from "./fiber-learning-loop";
export type { ModelBackedRole, ModelBackedUnitDeps, ModelLayeredOutput } from "./model-backed-unit";
export { ModelBackedUnit, parseModelLayeredOutput } from "./model-backed-unit";
export type {
  CurriculumConcept,
  CurriculumEdge,
  CurriculumUnitDeps,
  GeneratedCurriculum,
} from "./curriculum-unit";
export {
  CurriculumUnit,
  curriculumSlug,
  deterministicCurriculum,
  parseCurriculumOutput,
} from "./curriculum-unit";
export type { ResearchOutput, ResearchUnitDeps } from "./research-unit";
export { ResearchUnit, deterministicResearch, parseResearchOutput } from "./research-unit";
export type {
  ComposerElement,
  ComposerImagePlan,
  ComposerNarrationSegment,
  ComposerOutput,
  SurfaceComposerUnitDeps,
} from "./surface-composer-unit";
export {
  SurfaceComposerUnit,
  deterministicComposition,
  parseComposerOutput,
} from "./surface-composer-unit";
export type {
  FrameArchetype,
  FramePlan,
  FramePlannerUnitDeps,
  LookaheadEntry,
  PlannableSlot,
  PlannerFrameEntry,
  PlannerFrameIntent,
} from "./frame-planner-unit";
export {
  FRAME_ARCHETYPES,
  FramePlannerUnit,
  PLANNABLE_SLOTS,
  PLANNER_FRAME_INTENTS,
  deterministicPlan,
  parseFramePlan,
} from "./frame-planner-unit";
export type { ImagePlan, ImagePlannerUnitDeps } from "./image-planner-unit";
export { ImagePlannerUnit, deterministicImagePlan, parseImagePlan } from "./image-planner-unit";
export type {
  RepresentationProduct,
  RepresentationElementAssignment,
  RepresentationUnitDeps,
} from "./representation-unit";
export {
  RepresentationUnit,
  degradedRepresentation,
  parseRepresentation,
} from "./representation-unit";
export type {
  CanonicalizableLayer,
  RegionInput,
  SourceCanonicalizerUnitDeps,
} from "./source-canonicalizer-unit";
export {
  SourceCanonicalizerUnit,
  parseSemanticLayerOutput,
  parseCitationLayerOutput,
  deterministicSemanticLayer,
  deterministicCitationLayer,
  FALLBACK_LAYER_CONFIDENCE,
  MODEL_LAYER_CONFIDENCE,
} from "./source-canonicalizer-unit";
export type {
  CanonicalizerDispatch,
  SourceCanonicalizationServiceDeps,
  SemanticCanonicalizationResult,
  CitationCanonicalizationResult,
  MeaningConstructionResult,
} from "./source-canonicalization-service";
export type { ConceptInput, MeaningRepresentationUnitDeps } from "./meaning-representation-unit";
export {
  MeaningRepresentationUnit,
  parseMeaningLayerOutput,
  deterministicMeaningLayer,
  FALLBACK_MEANING_CONFIDENCE,
  MODEL_MEANING_CONFIDENCE,
} from "./meaning-representation-unit";
export { SourceCanonicalizationService } from "./source-canonicalization-service";
export type { ClaimMode, ClaimForContrast, ClaimReasoningUnitDeps } from "./claim-reasoning-unit";
export {
  ClaimReasoningUnit,
  parseClaimExtractionOutput,
  parseContradictionOutput,
  deterministicClaimExtraction,
  FALLBACK_CLAIM_CONFIDENCE,
  MODEL_CLAIM_CONFIDENCE,
} from "./claim-reasoning-unit";
export type {
  ClaimDispatch,
  ClaimEmit,
  ClaimGraphServiceDeps,
  ClaimExtractionResult,
  ContradictionDetectionResult,
} from "./claim-graph-service";
export {
  ClaimGraphService,
  claimNodeId,
  SOURCE_CLAIM_RECORDED,
  SOURCE_CONTRADICTION_DETECTED,
} from "./claim-graph-service";
export type {
  FusionSynthesisUnitDeps,
  SynthesisTreatment,
  SynthesisClaim,
  SynthesisContradiction,
} from "./fusion-synthesis-unit";
export {
  FusionSynthesisUnit,
  parseSynthesisOutput,
  deterministicSynthesis,
  FALLBACK_SYNTHESIS_CONFIDENCE,
  MODEL_SYNTHESIS_CONFIDENCE,
} from "./fusion-synthesis-unit";
export type { FrontierResearchUnitDeps } from "./frontier-research-unit";
export { FrontierResearchUnit, parseFrontierEntries } from "./frontier-research-unit";
export type { TemporalResearchUnitDeps } from "./temporal-research-unit";
export { TemporalResearchUnit, parseEpistemicStates } from "./temporal-research-unit";
export type { CreationAssistUnitDeps, AssistProduct } from "./creation-assist-unit";
export { CreationAssistUnit, parseAssist, deterministicAssist } from "./creation-assist-unit";
export type { AnswerAssessment, AssessmentUnitDeps } from "./assessment-unit";
export { AssessmentUnit, deterministicAssessment, parseAnswerAssessment } from "./assessment-unit";
export type { InferredIntent, IntentInferenceUnitDeps } from "./intent-inference-unit";
export {
  IntentInferenceUnit,
  deterministicIntent,
  parseIntentOutput,
} from "./intent-inference-unit";
export type {
  CreateTwinParams,
  TwinConsent,
  TwinRegistryOptions,
  TwinSnapshot,
  TwinState,
  TwinStatus,
} from "./twin";
export { TwinRegistry } from "./twin";
