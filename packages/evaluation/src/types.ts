/**
 * Core types for the Cognitive Evaluation Layer (Layer 2, ADR-0027).
 *
 * Evaluation is the counterpart, for *cognition*, of adapter conformance for *infrastructure*:
 * it answers "was that cognition good?" rather than "what happened?"
 *
 * Spec: spec/evaluation/cognitive-evaluation-architecture.md
 */
import type { ReasoningTrace } from "@inevitable/protocols";

// ---------------------------------------------------------------------------
// Scorecard context — passed alongside a ReasoningTrace to provide domain context.
// Defined here (not imported from @inevitable/surface) to avoid circular deps.
// ---------------------------------------------------------------------------

/** A depth-gate context extracted from a surface cycle (mirroring DepthGateRecord shape). */
export interface DepthGateContext {
  readonly passed: boolean;
  readonly passed_count: number;
  readonly total_count: number;
  readonly tests: readonly {
    readonly kind: string;
    readonly passed: boolean;
    readonly confidence: number;
  }[];
}

export interface ScorecardContext {
  readonly concept_id: string;
  /** Present when the cycle ran five-test depth verification (S2.2, F14). */
  readonly depthGate?: DepthGateContext;
  /** The learner's reported mastery confidence for this cycle. */
  readonly masteryConfidence?: number;
}

// ---------------------------------------------------------------------------
// Scorecard verdict
// ---------------------------------------------------------------------------

export interface ScorecardDimension {
  readonly name: string;
  readonly score: number;
  readonly passed: boolean;
  readonly evidence: string;
}

export interface ScorecardVerdict {
  readonly scorecard_id: string;
  readonly concept_id: string;
  readonly score: number;
  readonly passed: boolean;
  readonly dimension_scores: readonly ScorecardDimension[];
  readonly strategy: string;
  /** D1 = heuristic (default); D3 = model-backed LLM judge (non-deterministic, recorded). */
  readonly determinism_level: "D0" | "D1" | "D3";
}

// ---------------------------------------------------------------------------
// EvaluationRecord — foldable into SurfaceState
// ---------------------------------------------------------------------------

export interface EvaluationRecord {
  readonly concept_id: string;
  readonly scorecard_id: string;
  readonly score: number;
  readonly passed: boolean;
  readonly dimension_scores: readonly ScorecardDimension[];
  readonly hlc: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Minimum score for a scorecard verdict to count as passing (ADR-0027). */
export const EVALUATION_PASS_THRESHOLD = 0.7;

// ---------------------------------------------------------------------------
// ReasoningScorecard interface — pure D1 function
// ---------------------------------------------------------------------------

export interface ReasoningScorecard {
  readonly scorecard_id: string;
  readonly pass_threshold: number;
  /**
   * Pure function — no I/O, no model calls. Determinism level D1.
   * Given a reasoning trace and contextual domain information, emits a scored verdict.
   */
  score(trace: ReasoningTrace, context: ScorecardContext): ScorecardVerdict;
}
