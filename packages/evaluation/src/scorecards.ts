/**
 * Concrete reasoning scorecards for the Cognitive Evaluation Layer (ADR-0027).
 *
 * ExplanationScorecard — UALRCI five-test rubric (Explanation/Application/Connection/Teaching/EdgeCase).
 * ResearchScorecard    — Research frontier quality (specificity/gap/hypothesis/source).
 *
 * All scorecards are pure D1 functions: no model calls, no I/O, no side effects.
 * Spec: spec/evaluation/cognitive-evaluation-architecture.md §4.
 */
import type { ReasoningTrace } from "@inevitable/protocols";

import type {
  ReasoningScorecard,
  ScorecardContext,
  ScorecardDimension,
  ScorecardVerdict,
} from "./types";

// ---------------------------------------------------------------------------
// ExplanationScorecard
// ---------------------------------------------------------------------------

const EXPLANATION_DIMENSIONS = [
  "explanation",
  "application",
  "connection",
  "teaching",
  "edge_case",
] as const;

/**
 * Scores explanation reasoning traces using the UALRCI five-test rubric.
 * Reads from `context.depthGate` when present; falls back to `masteryConfidence`.
 */
export class ExplanationScorecard implements ReasoningScorecard {
  readonly scorecard_id = "explanation-v1";
  readonly pass_threshold = 0.6;

  score(trace: ReasoningTrace, context: ScorecardContext): ScorecardVerdict {
    const dimensions: ScorecardDimension[] = [];

    if (context.depthGate) {
      for (const dim of EXPLANATION_DIMENSIONS) {
        const test = context.depthGate.tests.find((t) => t.kind === dim);
        if (test) {
          dimensions.push({
            name: dim,
            score: test.passed ? test.confidence : test.confidence * 0.4,
            passed: test.passed,
            evidence: test.passed ? `${dim} test passed` : `${dim} test not passed`,
          });
        } else {
          dimensions.push({
            name: dim,
            score: 0,
            passed: false,
            evidence: `${dim} test not recorded`,
          });
        }
      }
    } else {
      const conf = context.masteryConfidence ?? 0;
      const passed = conf >= this.pass_threshold;
      dimensions.push({
        name: "mastery_confidence",
        score: conf,
        passed,
        evidence: `mastery confidence ${Math.round(conf * 100)}% (fallback — no depth gate)`,
      });
    }

    const score = dimensions.reduce((s, d) => s + d.score, 0) / dimensions.length;
    return {
      scorecard_id: this.scorecard_id,
      concept_id: context.concept_id,
      score,
      passed: score >= this.pass_threshold,
      dimension_scores: dimensions,
      strategy: trace.strategy,
      determinism_level: "D1",
    };
  }
}

// ---------------------------------------------------------------------------
// ResearchScorecard
// ---------------------------------------------------------------------------

/**
 * Scores research frontier reasoning traces (`strategy === "frontier-mapping"`).
 * MVP: heuristic-only. Richer novelty scoring requires Layer 3 (Knowledge).
 */
export class ResearchScorecard implements ReasoningScorecard {
  readonly scorecard_id = "research-v1";
  readonly pass_threshold = 0.5;

  score(trace: ReasoningTrace, context: ScorecardContext): ScorecardVerdict {
    const claim = trace.claims[0];
    const frontier = claim?.statement ?? "";

    const decision = trace.decision ?? "";

    const frontierLength = frontier.trim().length;
    const frontierSpecific = frontierLength > 40;

    const gapClarity =
      decision.length > 20 &&
      decision.toLowerCase() !== frontier.toLowerCase().slice(0, decision.length);

    const hypothesisText = trace.self_critique ?? "";
    const hypothesisSeedable =
      /^could|^what if/i.test(hypothesisText.trim()) || hypothesisText.length > 20;

    const sourceActionable = (trace.retrieved_context?.length ?? 0) > 0 || frontierLength > 60;

    const dimensions: ScorecardDimension[] = [
      {
        name: "frontier_specificity",
        score: frontierSpecific ? 1 : frontierLength > 20 ? 0.5 : 0,
        passed: frontierSpecific,
        evidence: frontierSpecific
          ? `frontier is specific (${frontierLength} chars)`
          : `frontier too short or generic (${frontierLength} chars)`,
      },
      {
        name: "gap_clarity",
        score: gapClarity ? 1 : 0.3,
        passed: gapClarity,
        evidence: gapClarity ? "gap is distinct from frontier" : "gap unclear or matches frontier",
      },
      {
        name: "hypothesis_seedability",
        score: hypothesisSeedable ? 1 : 0,
        passed: hypothesisSeedable,
        evidence: hypothesisSeedable
          ? "hypothesis seed present"
          : "no hypothesis seed in self_critique",
      },
      {
        name: "source_actionability",
        score: sourceActionable ? 1 : 0.3,
        passed: sourceActionable,
        evidence: sourceActionable ? "source context present" : "source note not substantive",
      },
    ];

    const score = dimensions.reduce((s, d) => s + d.score, 0) / dimensions.length;
    return {
      scorecard_id: this.scorecard_id,
      concept_id: context.concept_id,
      score,
      passed: score >= this.pass_threshold,
      dimension_scores: dimensions,
      strategy: trace.strategy,
      determinism_level: "D1",
    };
  }
}

export const DEFAULT_SCORECARDS: ReadonlyMap<string, ReasoningScorecard> = new Map<
  string,
  ReasoningScorecard
>([
  ["explanation-v1", new ExplanationScorecard()],
  ["research-v1", new ResearchScorecard()],
]);

/** Select the best scorecard for a given reasoning trace strategy. */
export function scorecardForTrace(
  strategy: string,
  scorecards: ReadonlyMap<string, ReasoningScorecard>,
): ReasoningScorecard | undefined {
  if (strategy === "frontier-mapping") return scorecards.get("research-v1");
  return scorecards.get("explanation-v1");
}
