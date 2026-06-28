import { describe, expect, test } from "vitest";

import { ExplanationScorecard, ResearchScorecard } from "../src/scorecards";
import type { ScorecardContext } from "../src/types";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeTrace(overrides: Record<string, unknown> = {}) {
  return {
    trace_id: "trace-001",
    producer_cid: "agent.explanation",
    task_interpretation: "explain neural networks",
    strategy: "chain",
    claims: [
      {
        claim_id: "c1",
        statement: "Neural networks are computational models inspired by biological neurons",
        confidence: 0.9,
      },
    ],
    decision: "Neural networks learn via gradient descent, adjusting weights to minimise loss",
    self_critique: "Could also mention perceptrons as a historical foundation",
    retrieved_context: [{ source: "textbook", excerpt: "..." }],
    determinism_level: "D1" as const,
    ...overrides,
  };
}

const depthGatePassed: ScorecardContext["depthGate"] = {
  passed: true,
  passed_count: 5,
  total_count: 5,
  tests: [
    { kind: "explanation", passed: true, confidence: 0.9 },
    { kind: "application", passed: true, confidence: 0.85 },
    { kind: "connection", passed: true, confidence: 0.8 },
    { kind: "teaching", passed: true, confidence: 0.75 },
    { kind: "edge_case", passed: true, confidence: 0.7 },
  ],
};

const depthGateFailed: ScorecardContext["depthGate"] = {
  passed: false,
  passed_count: 2,
  total_count: 5,
  tests: [
    { kind: "explanation", passed: true, confidence: 0.85 },
    { kind: "application", passed: false, confidence: 0.4 },
    { kind: "connection", passed: false, confidence: 0.3 },
    { kind: "teaching", passed: true, confidence: 0.7 },
    { kind: "edge_case", passed: false, confidence: 0.2 },
  ],
};

// ---------------------------------------------------------------------------
// ExplanationScorecard
// ---------------------------------------------------------------------------

describe("ExplanationScorecard", () => {
  const scorecard = new ExplanationScorecard();

  test("passes when all five depth-gate tests pass", () => {
    const ctx: ScorecardContext = { concept_id: "nn", depthGate: depthGatePassed };
    const verdict = scorecard.score(makeTrace(), ctx);
    expect(verdict.passed).toBe(true);
    expect(verdict.score).toBeGreaterThanOrEqual(0.6);
    expect(verdict.dimension_scores).toHaveLength(5);
    expect(verdict.determinism_level).toBe("D1");
    expect(verdict.scorecard_id).toBe("explanation-v1");
  });

  test("fails when most depth-gate tests fail", () => {
    const ctx: ScorecardContext = { concept_id: "nn", depthGate: depthGateFailed };
    const verdict = scorecard.score(makeTrace(), ctx);
    expect(verdict.passed).toBe(false);
    expect(verdict.score).toBeLessThan(0.6);
  });

  test("falls back to masteryConfidence when no depthGate", () => {
    const ctx: ScorecardContext = { concept_id: "nn", masteryConfidence: 0.8 };
    const verdict = scorecard.score(makeTrace(), ctx);
    expect(verdict.passed).toBe(true);
    expect(verdict.dimension_scores).toHaveLength(1);
    expect(verdict.dimension_scores[0]?.name).toBe("mastery_confidence");
  });

  test("fails via masteryConfidence below threshold", () => {
    const ctx: ScorecardContext = { concept_id: "nn", masteryConfidence: 0.3 };
    const verdict = scorecard.score(makeTrace(), ctx);
    expect(verdict.passed).toBe(false);
  });

  test("records concept_id and strategy in verdict", () => {
    const ctx: ScorecardContext = { concept_id: "backprop", depthGate: depthGatePassed };
    const verdict = scorecard.score(makeTrace({ strategy: "socratic" }), ctx);
    expect(verdict.concept_id).toBe("backprop");
    expect(verdict.strategy).toBe("socratic");
  });
});

// ---------------------------------------------------------------------------
// ResearchScorecard
// ---------------------------------------------------------------------------

describe("ResearchScorecard", () => {
  const scorecard = new ResearchScorecard();

  function makeResearchTrace(overrides: Record<string, unknown> = {}) {
    return makeTrace({
      strategy: "frontier-mapping",
      claims: [
        {
          claim_id: "r1",
          statement:
            "Mechanistic interpretability of transformer circuits at scale remains an open problem — existing techniques plateau past 7B params",
          confidence: 0.7,
        },
      ],
      decision:
        "There is no scalable method for enumerating attention head functions in models larger than 7B parameters",
      self_critique:
        "Could test if sparse-autoencoders extend further; preliminary evidence suggests yes",
      retrieved_context: [{ source: "arxiv-2024", excerpt: "..." }],
      ...overrides,
    });
  }

  test("passes for a specific, well-formed research trace", () => {
    const ctx: ScorecardContext = { concept_id: "mechanistic-interp" };
    const verdict = scorecard.score(makeResearchTrace(), ctx);
    expect(verdict.passed).toBe(true);
    expect(verdict.score).toBeGreaterThan(0.5);
    expect(verdict.dimension_scores).toHaveLength(4);
    expect(verdict.determinism_level).toBe("D1");
    expect(verdict.scorecard_id).toBe("research-v1");
  });

  test("scores frontier_specificity low for short frontier", () => {
    const ctx: ScorecardContext = { concept_id: "nn" };
    const verdict = scorecard.score(
      makeResearchTrace({
        claims: [{ claim_id: "r1", statement: "ML is hard", confidence: 0.5 }],
      }),
      ctx,
    );
    const frontierDim = verdict.dimension_scores.find((d) => d.name === "frontier_specificity");
    expect(frontierDim?.passed).toBe(false);
  });

  test("hypothesis_seedability: passes when self_critique starts with 'Could'", () => {
    const ctx: ScorecardContext = { concept_id: "nn" };
    const verdict = scorecard.score(
      makeResearchTrace({ self_critique: "Could investigate sparse SAEs further" }),
      ctx,
    );
    const dim = verdict.dimension_scores.find((d) => d.name === "hypothesis_seedability");
    expect(dim?.passed).toBe(true);
  });

  test("hypothesis_seedability: passes when self_critique starts with 'What if'", () => {
    const ctx: ScorecardContext = { concept_id: "nn" };
    const verdict = scorecard.score(
      makeResearchTrace({ self_critique: "What if we probe later layers only?" }),
      ctx,
    );
    const dim = verdict.dimension_scores.find((d) => d.name === "hypothesis_seedability");
    expect(dim?.passed).toBe(true);
  });
});
