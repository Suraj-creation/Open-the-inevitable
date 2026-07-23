/**
 * CSE M9 Frontier T1 — the living-knowledge overlay as governed cognition (CSE-006 §3.2, ADR-0043).
 * The load-bearing law: NO frontier entry without a real citation. Covers the grounding parser
 * (empty citations ⇒ empty overlay, whatever the model wrote), the model path (entries backed by
 * real citations), and honest-empty degradation (no web / failure ⇒ empty, never fabricated).
 */
import { describe, expect, it } from "vitest";
import type { ModelGenerationRequest, ModelGenerationResult } from "@inevitable/contracts";
import { CosError } from "@inevitable/shared";
import { FrontierResearchUnit, MVP_AGENT_MANIFESTS, parseFrontierEntries } from "../src/index";

const CITATIONS = [
  { uri: "https://arxiv.org/abs/2401.1", title: "A 2024 Survey" },
  { uri: "https://example.edu/notes", title: "Lecture Notes" },
];

const ENTRIES_JSON = JSON.stringify({
  entries: [
    { kind: "latest-research", summary: "Second-order methods are gaining ground." },
    { kind: "open-question", summary: "Convergence on non-convex loss remains open." },
    { kind: "not-a-kind", summary: "dropped — unknown kind" },
    { kind: "practice", summary: "" }, // dropped — empty summary
    { kind: "latest-research", summary: "Second-order methods are gaining ground." }, // dup — dropped
  ],
});

function manifest() {
  const found = MVP_AGENT_MANIFESTS.find((m) => m.id === "agent.frontier");
  if (!found) throw new Error("frontier manifest missing from catalog");
  return found;
}

function stubModel(result: Partial<ModelGenerationResult> & { text: string }) {
  return {
    generate: async (_req: ModelGenerationRequest): Promise<ModelGenerationResult> => ({
      model: "stub-model",
      finishReason: "stop" as const,
      ...result,
    }),
    embed: async () => [0],
  };
}

function failingModel() {
  return {
    generate: async (): Promise<ModelGenerationResult> => {
      throw new CosError("E_MODEL_UNAVAILABLE", "offline");
    },
    embed: async () => [0],
  };
}

function packet(content: Record<string, unknown>) {
  return {
    packet_id: "pkt-frontier-1",
    schema_version: "1.0.0",
    source_cid: "cog-test",
    target_cid: "agent.frontier",
    tenant_id: null,
    session_id: null,
    causation_id: null,
    correlation_id: null,
    timestamp: "2026-07-16T00:00:00Z",
    hlc: "0000000000000001-00000000-test",
    sequence_number: 0,
    packet_type: "request",
    intent: "frontier-research",
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
    priority: 4,
    expiry: null,
  } as never;
}

describe("parseFrontierEntries (the grounding law, CSE-006 §4/§6)", () => {
  it("returns NOTHING when there are no real citations — even with valid entry text", () => {
    expect(parseFrontierEntries(ENTRIES_JSON, [], "2026-07-16T00:00:00Z")).toEqual([]);
  });

  it("admits valid entries backed by the real citation pool; drops unknown/empty/dupes", () => {
    const entries = parseFrontierEntries(ENTRIES_JSON, CITATIONS, "2026-07-16T00:00:00Z");
    expect(entries.map((e) => e.kind)).toEqual(["latest-research", "open-question"]);
    expect(entries[0]?.external_refs).toEqual(CITATIONS); // grounded in the real citations
    expect(entries.every((e) => e.as_of === "2026-07-16T00:00:00Z")).toBe(true);
  });

  it("returns [] on unparseable text (honest, never a guess)", () => {
    expect(parseFrontierEntries("not json", CITATIONS, "t")).toEqual([]);
  });
});

describe("FrontierResearchUnit.execute", () => {
  it("produces grounded frontier entries when the search returns real citations (D3)", async () => {
    const unit = new FrontierResearchUnit({
      manifest: manifest(),
      model: stubModel({ text: ENTRIES_JSON, citations: CITATIONS }),
    });
    const emissions = await unit.execute(packet({ concept_ref: "gradient-descent" }));
    const content = (emissions.packets?.[0]?.content ?? {}) as Record<string, unknown>;
    expect(content["response_kind"]).toBe("model-frontier-research");
    expect(content["degraded"]).toBe(false);
    expect((content["entries"] as unknown[]).length).toBe(2);
    expect(emissions.trace?.determinism_level).toBe("D3");
  });

  it("is honestly degraded-empty when the model returns NO citations (never fabricated)", async () => {
    const unit = new FrontierResearchUnit({
      manifest: manifest(),
      model: stubModel({ text: ENTRIES_JSON }), // no citations
    });
    const emissions = await unit.execute(packet({ concept_ref: "gradient-descent" }));
    const content = (emissions.packets?.[0]?.content ?? {}) as Record<string, unknown>;
    expect(content["entries"]).toEqual([]);
    expect(content["degraded"]).toBe(true);
  });

  it("falls back to honest-empty on model failure (no web ⇒ no frontier)", async () => {
    const unit = new FrontierResearchUnit({ manifest: manifest(), model: failingModel() });
    const emissions = await unit.execute(packet({ concept_ref: "gradient-descent" }));
    const content = (emissions.packets?.[0]?.content ?? {}) as Record<string, unknown>;
    expect(content["response_kind"]).toBe("frontier-unavailable");
    expect(content["entries"]).toEqual([]);
    expect(content["degraded"]).toBe(true);
    expect(content["fallback_reason"]).toBe("E_MODEL_UNAVAILABLE");
  });
});
