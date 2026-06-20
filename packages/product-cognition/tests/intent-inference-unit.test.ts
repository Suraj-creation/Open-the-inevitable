/**
 * IntentInferenceUnit — goal → bounded, confidence-scored intent through the governed path
 * (spec/kernel/intent-inference.md). Deterministic: stub models only.
 */
import { describe, expect, test } from "vitest";
import type { ModelRuntime } from "@inevitable/contracts";
import type { CognitionPacket } from "@inevitable/protocols";
import { SeededIdGenerator } from "@inevitable/shared";
import { MVP_AGENT_MANIFESTS } from "../src/agent-catalog";
import {
  IntentInferenceUnit,
  deterministicIntent,
  parseIntentOutput,
} from "../src/intent-inference-unit";

const intentManifest = MVP_AGENT_MANIFESTS.find((m) => m.id === "agent.intent")!;

function stubModel(text: string, finishReason?: "stop" | "refusal"): ModelRuntime {
  return {
    async generate() {
      return { text, model: "stub-model", finishReason: finishReason ?? ("stop" as const) };
    },
    async embed() {
      return [];
    },
  };
}

const GOOD_INTENT = JSON.stringify({
  interpreted_goal: "Build a working understanding of how photosynthesis converts light to energy",
  scope: ["biology", "chemistry"],
  constraints: ["beginner-friendly"],
  confidence: 0.82,
});

function packet(content: Record<string, unknown>): CognitionPacket {
  return {
    packet_id: "cp-000000000000000000000001",
    schema_version: "1.0.0",
    source_cid: "cog-learner",
    target_cid: "cog-int",
    tenant_id: null,
    session_id: "intent-001",
    causation_id: "intent-001",
    correlation_id: "cp-000000000000000000000002",
    timestamp: "2026-06-20T00:00:00.000Z",
    hlc: "00000000000000000000:0:test",
    sequence_number: 0,
    packet_type: "intent",
    intent: "interpret",
    concept_ids: [],
    domain_ids: [],
    content,
    evidence: [],
    confidence: 1,
    uncertainty_estimate: 0,
    reasoning_depth: 0,
    classification: "internal",
    policy_tags: [],
    requires_human_review: false,
    priority: 5,
    expiry: null,
    trace_id: "00000000000000000000000000000001",
    span_id: "0000000000000001",
  };
}

describe("parseIntentOutput", () => {
  test("parses interpreted goal, scope, constraints, confidence (fences tolerated)", () => {
    const parsed = parseIntentOutput("```json\n" + GOOD_INTENT + "\n```");
    expect(parsed.interpretedGoal).toContain("photosynthesis");
    expect(parsed.scope).toEqual(["biology", "chemistry"]);
    expect(parsed.constraints).toEqual(["beginner-friendly"]);
    expect(parsed.confidence).toBeCloseTo(0.82);
  });

  test("defaults confidence when absent and clamps out-of-range", () => {
    expect(parseIntentOutput('{"interpreted_goal":"x"}').confidence).toBe(0.7);
    expect(parseIntentOutput('{"interpreted_goal":"x","confidence":5}').confidence).toBe(1);
  });

  test("rejects output without interpreted_goal or invalid JSON", () => {
    expect(() => parseIntentOutput('{"scope":[]}')).toThrowError(/interpreted_goal/);
    expect(() => parseIntentOutput("not json")).toThrowError(/valid JSON/);
  });
});

describe("deterministicIntent", () => {
  test("is the goal verbatim at confidence 0.5 (deterministic, offline-safe)", () => {
    const a = deterministicIntent("Teach me Photosynthesis");
    const b = deterministicIntent("Teach me Photosynthesis");
    expect(a).toEqual(b);
    expect(a.interpretedGoal).toBe("Teach me Photosynthesis");
    expect(a.scope).toEqual([]);
    expect(a.confidence).toBe(0.5);
  });
});

describe("IntentInferenceUnit", () => {
  test("valid model output becomes a model-intent response packet", async () => {
    const unit = new IntentInferenceUnit({
      manifest: intentManifest,
      model: stubModel(GOOD_INTENT),
      idGenerator: new SeededIdGenerator("int"),
    });
    const emissions = await unit.execute(packet({ goal: "Teach me Photosynthesis" }));
    const content = emissions.packets?.[0]?.content as Record<string, unknown>;
    expect(content["response_kind"]).toBe("model-intent");
    expect(content["interpreted_goal"]).toContain("photosynthesis");
    expect(content["scope"]).toEqual(["biology", "chemistry"]);
    expect(emissions.packets?.[0]?.confidence).toBeCloseTo(0.82);
    expect(emissions.trace?.determinism_level).toBe("D3");
  });

  test("non-intent output falls back to the deterministic interpretation, visibly degraded", async () => {
    const unit = new IntentInferenceUnit({
      manifest: intentManifest,
      model: stubModel(JSON.stringify({ layers: { layer_0: "x" }, summary: "s" })),
      idGenerator: new SeededIdGenerator("int-fb"),
    });
    const emissions = await unit.execute(packet({ goal: "Teach me Recursion" }));
    const content = emissions.packets?.[0]?.content as Record<string, unknown>;
    expect(content["response_kind"]).toBe("deterministic-intent");
    expect(content["fallback_reason"]).toBe("E_MODEL_OUTPUT_MALFORMED");
    expect(content["interpreted_goal"]).toBe("Teach me Recursion");
    expect(emissions.packets?.[0]?.confidence).toBe(0.5);
  });
});
