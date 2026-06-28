import { describe, expect, test } from "vitest";
import { InMemoryEventBus } from "@inevitable/events";
import { ManualClock, SeededIdGenerator } from "@inevitable/shared";

import { CognitiveEvaluationEngine } from "../src/engine";
import type { ScorecardContext } from "../src/types";

const FIXED_NOW = Date.UTC(2026, 5, 25);

function makeEngine() {
  const clock = new ManualClock(FIXED_NOW);
  const idGenerator = new SeededIdGenerator("eval-engine-test");
  const bus = new InMemoryEventBus({ idGenerator, validate: true });
  const engine = new CognitiveEvaluationEngine({
    bus,
    clock,
    idGenerator,
    nodeId: "engine-test",
    producerCid: "engine.evaluation.test",
  });
  return { bus, engine };
}

function makeExplanationTrace(overrides: Record<string, unknown> = {}) {
  return {
    trace_id: "t001",
    producer_cid: "agent.explanation",
    task_interpretation: "explain backpropagation",
    strategy: "chain",
    claims: [
      { claim_id: "c1", statement: "Backprop computes gradients via chain rule", confidence: 0.9 },
    ],
    decision: "The network applies gradient descent after each forward pass to update weights",
    self_critique: null,
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

describe("CognitiveEvaluationEngine", () => {
  test("emits evaluation.reasoning.completed on the bus", async () => {
    const { bus, engine } = makeEngine();
    const ctx: ScorecardContext = { concept_id: "backprop", depthGate: depthGatePassed };
    await engine.evaluate(makeExplanationTrace(), ctx);
    const events = bus.log.filter((e) => e.event_type === "evaluation.reasoning.completed");
    expect(events).toHaveLength(1);
  });

  test("verdict and record reflect passing evaluation", async () => {
    const { engine } = makeEngine();
    const ctx: ScorecardContext = { concept_id: "backprop", depthGate: depthGatePassed };
    const { verdict, record } = await engine.evaluate(makeExplanationTrace(), ctx);
    expect(verdict.passed).toBe(true);
    expect(record.passed).toBe(true);
    expect(record.concept_id).toBe("backprop");
    expect(record.scorecard_id).toBe("explanation-v1");
    expect(record.hlc).toBeTruthy();
  });

  test("event payload contains trace_id and concept_id", async () => {
    const { bus, engine } = makeEngine();
    const ctx: ScorecardContext = { concept_id: "gradient-descent" };
    await engine.evaluate(makeExplanationTrace({ trace_id: "my-trace" }), ctx);
    const event = bus.log.find((e) => e.event_type === "evaluation.reasoning.completed");
    const payload = event?.payload as Record<string, unknown> | undefined;
    expect(payload?.["trace_id"]).toBe("my-trace");
    expect(payload?.["concept_id"]).toBe("gradient-descent");
  });

  test("selects research scorecard for frontier-mapping strategy", async () => {
    const { engine } = makeEngine();
    const ctx: ScorecardContext = { concept_id: "interp" };
    const researchTrace = makeExplanationTrace({
      strategy: "frontier-mapping",
      claims: [
        {
          claim_id: "r1",
          statement:
            "Sparse autoencoders for mechanistic interpretability at 70B scale remain unproven in practice",
          confidence: 0.7,
        },
      ],
      decision: "No existing method scales interpretability circuits past 7B parameters reliably",
      self_critique: "Could test if sparse SAE probing extends further given recent results",
      retrieved_context: [{ source: "arxiv", excerpt: "..." }],
    });
    const { verdict } = await engine.evaluate(researchTrace, ctx);
    expect(verdict.scorecard_id).toBe("research-v1");
  });

  test("throws for unknown strategy with no fallback scorecard", async () => {
    const ctx: ScorecardContext = { concept_id: "x" };
    // Remove all scorecards
    const engineNoScorecards = new CognitiveEvaluationEngine({
      bus: new InMemoryEventBus(),
      clock: new ManualClock(FIXED_NOW),
      scorecards: new Map(),
    });
    await expect(
      engineNoScorecards.evaluate(makeExplanationTrace({ strategy: "mystery" }), ctx),
    ).rejects.toThrow("no scorecard");
  });

  test("event is marked replayable and permanent", async () => {
    const { bus, engine } = makeEngine();
    const ctx: ScorecardContext = { concept_id: "backprop", depthGate: depthGatePassed };
    await engine.evaluate(makeExplanationTrace(), ctx);
    const event = bus.log.find((e) => e.event_type === "evaluation.reasoning.completed");
    expect(event?.replay_behavior).toBe("replayable");
    expect(event?.retention).toBe("permanent");
  });
});
