/**
 * @inevitable/evaluation — Cognitive Evaluation Layer (Layer 2, ADR-0027).
 *
 * Spec: spec/evaluation/cognitive-evaluation-architecture.md
 */
export type {
  DepthGateContext,
  EvaluationRecord,
  ReasoningScorecard,
  ScorecardContext,
  ScorecardDimension,
  ScorecardVerdict,
} from "./types";
export { EVALUATION_PASS_THRESHOLD } from "./types";

export {
  ExplanationScorecard,
  ResearchScorecard,
  DEFAULT_SCORECARDS,
  scorecardForTrace,
} from "./scorecards";

export type { EvaluationEngineDeps, EvaluateResult } from "./engine";
export { CognitiveEvaluationEngine } from "./engine";

export type { BenchmarkTrace, BenchmarkResult } from "./benchmark";
export { BenchmarkRunner } from "./benchmark";
