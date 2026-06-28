import { describe, expect, test } from "vitest";

import { BenchmarkRunner } from "../src/benchmark";
import type { BenchmarkTrace } from "../src/benchmark";

const FIXED_NOW = Date.UTC(2026, 5, 25);

function makeExplanationBenchmarkTrace(overrides: Record<string, unknown> = {}): BenchmarkTrace {
  return {
    trace: {
      trace_id: `t-${Math.random().toString(36).slice(2)}`,
      producer_cid: "agent.explanation",
      task_interpretation: "explain gradient descent",
      strategy: "chain",
      claims: [
        {
          claim_id: "c1",
          statement: "Gradient descent minimises the loss function",
          confidence: 0.9,
        },
      ],
      decision: "Weights update proportionally to negative gradient of the loss",
      self_critique: null,
      determinism_level: "D1" as const,
      ...overrides,
    },
    context: {
      concept_id: "gradient-descent",
      masteryConfidence: 0.8,
    },
  };
}

describe("BenchmarkRunner", () => {
  test("runs empty trace set with no errors", async () => {
    const runner = new BenchmarkRunner(FIXED_NOW);
    const result = await runner.run([]);
    expect(result.total).toBe(0);
    expect(result.passed).toBe(0);
    expect(result.passRate).toBe(0);
    expect(result.eventCount).toBe(0);
  });

  test("collects one evaluation record per trace", async () => {
    const runner = new BenchmarkRunner(FIXED_NOW);
    const traces = [makeExplanationBenchmarkTrace(), makeExplanationBenchmarkTrace()];
    const result = await runner.run(traces);
    expect(result.total).toBe(2);
    expect(result.records).toHaveLength(2);
    expect(result.eventCount).toBe(2);
  });

  test("passRate is 1 when all traces pass", async () => {
    const runner = new BenchmarkRunner(FIXED_NOW);
    const traces = [makeExplanationBenchmarkTrace(), makeExplanationBenchmarkTrace()];
    const result = await runner.run(traces);
    // masteryConfidence = 0.8 >= 0.6 → should pass with explanation-v1 fallback
    expect(result.passed).toBe(result.total);
    expect(result.passRate).toBe(1);
  });

  test("D0: same input produces same records across runs", async () => {
    const trace: BenchmarkTrace = {
      trace: {
        trace_id: "fixed-trace",
        producer_cid: "agent.explanation",
        task_interpretation: "explain backprop",
        strategy: "chain",
        claims: [
          {
            claim_id: "c1",
            statement: "Backprop propagates gradients backwards",
            confidence: 0.85,
          },
        ],
        decision: "Use chain rule to propagate error gradients from output to input layers",
        self_critique: null,
        determinism_level: "D1" as const,
      },
      context: { concept_id: "backprop", masteryConfidence: 0.75 },
    };

    const runner1 = new BenchmarkRunner(FIXED_NOW);
    const runner2 = new BenchmarkRunner(FIXED_NOW);
    const [r1, r2] = await Promise.all([runner1.run([trace]), runner2.run([trace])]);

    expect(r1.records[0]?.score).toBe(r2.records[0]?.score);
    expect(r1.records[0]?.passed).toBe(r2.records[0]?.passed);
    expect(r1.passRate).toBe(r2.passRate);
  });
});
