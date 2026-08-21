/**
 * LearnerSimulator — a deterministic environment for the L2 gate (§11.5). It has a hidden preferred
 * explanation strategy; an output whose strategy matches teaches best, adjacent strategies partly,
 * distant ones least. It is purely deterministic (no randomness) so measurements A/B/D are clean and
 * replayable. It is a mechanism harness, NOT a model of a real human — the identical instrumented
 * loop is validated against real learner telemetry before Phase 3.
 */
import type { ExplanationStrategy } from "./constitution";
import { EXPLANATION_STRATEGIES } from "./constitution";
import type { CognitiveOutput } from "./faculty";

export interface Assessment {
  /** Outcome score in [0,1] — the Constitution's `evaluation_metric`. */
  readonly score: number;
  readonly passed: boolean;
}

export class LearnerSimulator {
  constructor(
    private readonly preferred: ExplanationStrategy,
    /** How strongly strategy-fit dominates the score (0..1). */
    private readonly sensitivity = 0.5,
  ) {}

  assess(output: CognitiveOutput): Assessment {
    const fit = output.strategy === this.preferred ? 1 : adjacency(output.strategy, this.preferred);
    const score = clamp01((1 - this.sensitivity) * 0.5 + this.sensitivity * fit);
    return { score, passed: score >= 0.6 };
  }

  get preferredStrategy(): ExplanationStrategy {
    return this.preferred;
  }
}

/** Graded partial credit: strategies adjacent in canonical order are partly satisfying. */
function adjacency(a: ExplanationStrategy, b: ExplanationStrategy): number {
  const distance = Math.abs(EXPLANATION_STRATEGIES.indexOf(a) - EXPLANATION_STRATEGIES.indexOf(b));
  return distance === 1 ? 0.4 : 0.1;
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}
