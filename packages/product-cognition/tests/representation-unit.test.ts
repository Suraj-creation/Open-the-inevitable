/**
 * RepresentationUnit — the RIA (CSE-018, ADR-0058). Model-backed role/hierarchy assignment over the
 * closed MCCR vocabulary, grounded to the composer's actual elements, with a degraded-empty fallback
 * so a model failure never regresses a frame (the caller uses its deterministic parity plan).
 */
import { describe, expect, test } from "vitest";
import type { ModelRuntime } from "@inevitable/contracts";
import type { CognitionPacket } from "@inevitable/protocols";
import { SeededIdGenerator } from "@inevitable/shared";
import { MVP_AGENT_MANIFESTS } from "../src/agent-catalog";
import { RepresentationUnit, parseRepresentation } from "../src/representation-unit";

const manifest = MVP_AGENT_MANIFESTS.find((m) => m.id === "agent.representation")!;

function stub(text: string, finishReason?: "stop" | "refusal" | "max_tokens"): ModelRuntime {
  return {
    async generate() {
      return { text, model: "stub-model", finishReason: finishReason ?? ("stop" as const) };
    },
    async embed() {
      return [];
    },
  };
}

function packet(content: Record<string, unknown>): CognitionPacket {
  return {
    packet_id: "cp-000000000000000000000001",
    schema_version: "1.0.0",
    source_cid: "cog-learner",
    target_cid: "cog-representation",
    tenant_id: null,
    session_id: "intent-001",
    causation_id: "intent-001",
    correlation_id: "cp-000000000000000000000002",
    timestamp: "2026-07-18T00:00:00.000Z",
    hlc: "00000000000000000000:0:test",
    sequence_number: 0,
    packet_type: "intent",
    intent: "plan representation",
    concept_ids: ["entropy"],
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

const ELEMENTS = [
  { element_id: "el-core_concept", type: "core_concept" },
  { element_id: "el-misconception", type: "misconception" },
];

describe("parseRepresentation", () => {
  test("keeps only known element ids and clamps to the vocabularies (grounding)", () => {
    const known = new Set(ELEMENTS.map((e) => e.element_id));
    const product = parseRepresentation(
      JSON.stringify({
        composition: [
          { element_id: "el-core_concept", epistemic_role: "canonical", hierarchy: "primary" },
          {
            element_id: "el-misconception",
            epistemic_role: "misconception",
            hierarchy: "supporting",
          },
          { element_id: "el-invented", epistemic_role: "insight", hierarchy: "primary" }, // not known
          { element_id: "el-core_concept", epistemic_role: "bogus", hierarchy: "weird" }, // dup + bad
        ],
        exclusions: ["a tangential aside"],
        adaptivity: "full scaffolding — novice",
      }),
      known,
    );
    // The invented element is dropped; the duplicate is ignored; bad enums never leak.
    expect(product.composition).toHaveLength(2);
    expect(product.composition.map((c) => c.element_id).sort()).toEqual([
      "el-core_concept",
      "el-misconception",
    ]);
    expect(product.exclusions).toEqual(["a tangential aside"]);
    expect(product.adaptivity).toContain("novice");
    expect(product.degraded).toBe(false);
  });
});

describe("RepresentationUnit", () => {
  test("valid model output becomes a model-representation response", async () => {
    const unit = new RepresentationUnit({
      manifest,
      model: stub(
        JSON.stringify({
          composition: [
            { element_id: "el-core_concept", epistemic_role: "canonical", hierarchy: "primary" },
          ],
          exclusions: [],
          adaptivity: "balanced",
        }),
      ),
      idGenerator: new SeededIdGenerator("ria"),
    });
    const emissions = await unit.execute(packet({ concept_title: "Entropy", elements: ELEMENTS }));
    const content = emissions.packets?.[0]?.content as Record<string, unknown>;
    expect(content["response_kind"]).toBe("model-representation");
    const product = content["representation"] as { composition: unknown[]; degraded: boolean };
    expect(product.composition).toHaveLength(1);
    expect(product.degraded).toBe(false);
    expect(emissions.trace?.determinism_level).toBe("D3");
  });

  test("malformed output degrades empty so the caller keeps the deterministic floor", async () => {
    const unit = new RepresentationUnit({
      manifest,
      model: stub("not json"),
      idGenerator: new SeededIdGenerator("ria-fb"),
    });
    const emissions = await unit.execute(packet({ concept_title: "Entropy", elements: ELEMENTS }));
    const content = emissions.packets?.[0]?.content as Record<string, unknown>;
    expect(content["response_kind"]).toBe("deterministic-representation");
    const product = content["representation"] as { composition: unknown[]; degraded: boolean };
    expect(product.composition).toHaveLength(0);
    expect(product.degraded).toBe(true);
  });
});
