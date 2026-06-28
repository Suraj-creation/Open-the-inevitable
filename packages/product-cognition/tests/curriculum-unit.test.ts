/**
 * CurriculumUnit — goal → concept DAG through the governed path
 * (spec/product/product-cognition-runtime.md §12). Deterministic: stub models only.
 */
import { describe, expect, test } from "vitest";
import type { ModelRuntime } from "@inevitable/contracts";
import type { CognitionPacket } from "@inevitable/protocols";
import { SeededIdGenerator } from "@inevitable/shared";
import { MVP_AGENT_MANIFESTS } from "../src/agent-catalog";
import {
  CurriculumUnit,
  deterministicCurriculum,
  parseCurriculumOutput,
} from "../src/curriculum-unit";

const curriculumManifest = MVP_AGENT_MANIFESTS.find((m) => m.id === "agent.curriculum")!;

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

const GOOD_CURRICULUM = JSON.stringify({
  concepts: [
    { id: "qubits", title: "Qubits", prerequisites: [] },
    { id: "superposition", title: "Superposition", prerequisites: ["qubits"] },
    { id: "entanglement", title: "Entanglement", prerequisites: ["superposition", "nonexistent"] },
  ],
  focus_concept_id: "qubits",
  explanation_prompt: "Explain qubits with intuition",
  practice_prompt: "One qubit measurement exercise",
});

function packet(content: Record<string, unknown>): CognitionPacket {
  return {
    packet_id: "cp-000000000000000000000001",
    schema_version: "1.0.0",
    source_cid: "cog-learner",
    target_cid: "cog-cur",
    tenant_id: null,
    session_id: "intent-001",
    causation_id: "intent-001",
    correlation_id: "cp-000000000000000000000002",
    timestamp: "2026-06-12T00:00:00.000Z",
    hlc: "00000000000000000000:0:test",
    sequence_number: 0,
    packet_type: "intent",
    intent: "curriculum",
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

describe("parseCurriculumOutput", () => {
  test("dedupes ids, drops unknown prerequisites, and keeps the focus", () => {
    const parsed = parseCurriculumOutput("```json\n" + GOOD_CURRICULUM + "\n```");
    expect(parsed.concepts.map((c) => c.id)).toEqual(["qubits", "superposition", "entanglement"]);
    const entanglement = parsed.concepts.find((c) => c.id === "entanglement")!;
    expect(entanglement.prerequisites).toEqual(["superposition"]); // "nonexistent" dropped
    expect(parsed.focusConceptId).toBe("qubits");
    expect(parsed.explanationPrompt).toBe("Explain qubits with intuition");
  });

  test("defaults focus to the first prerequisite-free concept when missing/invalid", () => {
    const parsed = parseCurriculumOutput(
      JSON.stringify({
        concepts: [
          { id: "a", title: "A", prerequisites: ["b"] },
          { id: "b", title: "B", prerequisites: [] },
        ],
        focus_concept_id: "does-not-exist",
      }),
    );
    expect(parsed.focusConceptId).toBe("b");
  });

  test("rejects output without a non-empty concepts array", () => {
    expect(() => parseCurriculumOutput('{"focus_concept_id":"x"}')).toThrowError(/concepts/);
    expect(() => parseCurriculumOutput("not json")).toThrowError(/valid JSON/);
  });

  test("parses layer, domain, and typed edges; clamps layer and drops invalid edge types (S2.4)", () => {
    const enriched = JSON.stringify({
      concepts: [
        { id: "calculus", title: "Calculus", prerequisites: [], layer: 3, domain: "mathematics" },
        {
          id: "ml",
          title: "Machine Learning",
          prerequisites: ["calculus"],
          layer: 2,
          domain: "machine-learning",
        },
        {
          id: "deep-learning",
          title: "Deep Learning",
          prerequisites: ["ml"],
          layer: 99,
          domain: "machine-learning",
        },
      ],
      edges: [
        { from: "calculus", to: "ml", type: "applies_to" },
        { from: "ml", to: "deep-learning", type: "frontier_of" },
        { from: "calculus", to: "ml", type: "invalid-type" },
        { from: "calculus", to: "nonexistent", type: "applies_to" },
      ],
      focus_concept_id: "calculus",
    });
    const parsed = parseCurriculumOutput(enriched);
    expect(parsed.concepts[0]?.layer).toBe(3);
    expect(parsed.concepts[0]?.domain).toBe("mathematics");
    expect(parsed.concepts[1]?.layer).toBe(2);
    expect(parsed.concepts[2]?.layer).toBe(6);
    expect(parsed.edges).toHaveLength(2);
    expect(parsed.edges?.[0]).toEqual({ from: "calculus", to: "ml", type: "applies_to" });
    expect(parsed.edges?.[1]).toEqual({ from: "ml", to: "deep-learning", type: "frontier_of" });
  });
});

describe("deterministicCurriculum", () => {
  test("produces a deterministic, acyclic 3-node chain from the goal", () => {
    const a = deterministicCurriculum("Teach me Quantum Computing");
    const b = deterministicCurriculum("Teach me Quantum Computing");
    expect(a).toEqual(b);
    expect(a.concepts.map((c) => c.id)).toEqual([
      "foundations-of-teach-me-quantum-computing",
      "core-of-teach-me-quantum-computing",
      "applying-teach-me-quantum-computing",
    ]);
    expect(a.focusConceptId).toBe("foundations-of-teach-me-quantum-computing");
    expect(a.concepts[0]!.prerequisites).toEqual([]);
  });
});

describe("CurriculumUnit", () => {
  test("valid model output becomes a model-curriculum response packet", async () => {
    const unit = new CurriculumUnit({
      manifest: curriculumManifest,
      model: stubModel(GOOD_CURRICULUM),
      idGenerator: new SeededIdGenerator("cur"),
    });
    const emissions = await unit.execute(packet({ goal: "Teach me Quantum Computing" }));
    const content = emissions.packets?.[0]?.content as Record<string, unknown>;
    expect(content["response_kind"]).toBe("model-curriculum");
    expect((content["concepts"] as unknown[]).length).toBe(3);
    expect(content["focus_concept_id"]).toBe("qubits");
    expect(emissions.packets?.[0]?.confidence).toBe(0.85);
    expect(emissions.trace?.determinism_level).toBe("D3");
  });

  test("non-curriculum output falls back to the deterministic scaffold, visibly degraded", async () => {
    // The NullModelRuntime returns layered text, not concepts — the unit must degrade gracefully.
    const unit = new CurriculumUnit({
      manifest: curriculumManifest,
      model: stubModel(JSON.stringify({ layers: { layer_0: "x" }, summary: "s", confidence: 0.9 })),
      idGenerator: new SeededIdGenerator("cur-fb"),
    });
    const emissions = await unit.execute(packet({ goal: "Teach me Neural Networks" }));
    const content = emissions.packets?.[0]?.content as Record<string, unknown>;
    expect(content["response_kind"]).toBe("deterministic-curriculum");
    expect(content["fallback_reason"]).toBe("E_MODEL_OUTPUT_MALFORMED");
    expect(content["focus_concept_id"]).toBe("foundations-of-teach-me-neural-networks");
    expect(emissions.packets?.[0]?.confidence).toBeLessThanOrEqual(0.5);
  });
});
