/**
 * @inevitable/intelligence — Cognitive Intelligence Persistence (ADR-0035, CIP-001/002).
 * The distiller registry that folds the Chronicle Plane into the Intelligence Plane:
 * deterministic distillers, the canonical IntelligenceArtifact envelope, governance guards
 * (opt-out, cohort minimum, deletion cascade), and the `intelligence.*` lifecycle.
 */
export type {
  ArtifactId,
  IntelligenceArtifact,
  IntelligenceKind,
  IntelligenceRegime,
  ArtifactEpistemics,
} from "./artifact";
export { INTELLIGENCE_KINDS, INTELLIGENCE_EVENT_TYPES, newArtifactId } from "./artifact";

export type { DistillContext, Distillate, Distiller } from "./distillers";
export {
  REGISTRY_V1,
  episodeAssembler,
  understandingDelta,
  misconceptionTracker,
  interventionOutcome,
  strategyOutcome,
  collaborationDistiller,
  consolidationDriver,
} from "./distillers";

export type { DistillationGovernance, DistillSessionInput, DistillSessionResult } from "./registry";
export { distillSession, emitDistilled, redactLearnerArtifacts } from "./registry";
