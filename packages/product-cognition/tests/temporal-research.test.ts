/**
 * CSE M9 TKM T1 — the Temporal Knowledge Model as governed cognition (CSE-006 §3.3/§8, ADR-0044).
 * Covers the grounding law (no state without a real citation), chronological ordering by era, the
 * sparse-honesty (null era kept, never invented), and the unit's model / honest-empty paths.
 */
import { describe, expect, it } from "vitest";
import type { ModelGenerationRequest, ModelGenerationResult } from "@inevitable/contracts";
import { CosError } from "@inevitable/shared";
import { MVP_AGENT_MANIFESTS, TemporalResearchUnit, parseEpistemicStates } from "../src/index";

const CITATIONS = [
  { uri: "https://en.wikipedia.org/wiki/Backpropagation", title: "Backpropagation" },
];

// Deliberately out of order + a null era + an unknown kind + a dup, to exercise the parser.
const STATES_JSON = JSON.stringify({
  states: [
    {
      kind: "milestone",
      label: "Backpropagation popularized",
      summary: "Rumelhart et al.",
      era: "1986",
    },
    {
      kind: "origin",
      label: "Roots in control theory",
      summary: "Chain-rule optimization.",
      era: "1960s",
    },
    { kind: "open-problem", label: "Biological plausibility", summary: "Debated.", era: null },
    { kind: "shift", label: "Deep learning revival", summary: "GPU-scale training.", era: "2012" },
    { kind: "not-a-kind", label: "dropped", summary: "x", era: "1900" },
    { kind: "milestone", label: "Backpropagation popularized", summary: "dup", era: "1986" },
  ],
});

function manifest() {
  const found = MVP_AGENT_MANIFESTS.find((m) => m.id === "agent.temporal");
  if (!found) throw new Error("temporal manifest missing from catalog");
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
    packet_id: "pkt-tkm-1",
    schema_version: "1.0.0",
    source_cid: "cog-test",
    target_cid: "agent.temporal",
    tenant_id: null,
    session_id: null,
    causation_id: null,
    correlation_id: null,
    timestamp: "2026-07-16T00:00:00Z",
    hlc: "0000000000000001-00000000-test",
    sequence_number: 0,
    packet_type: "request",
    intent: "timeline-research",
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

describe("parseEpistemicStates (grounding law + chronological order, CSE-006 §3.3/§8)", () => {
  it("returns NOTHING without real citations — the grounding law comes first", () => {
    expect(parseEpistemicStates(STATES_JSON, [], "t")).toEqual([]);
  });

  it("orders by era year (undated sink to their phase), drops unknown/dupes, keeps a null era", () => {
    const states = parseEpistemicStates(STATES_JSON, CITATIONS, "2026-07-16T00:00:00Z");
    // 1960s → 1986 → 2012 chronologically; the undated open-problem sinks to the end.
    expect(states.map((s) => s.label)).toEqual([
      "Roots in control theory",
      "Backpropagation popularized",
      "Deep learning revival",
      "Biological plausibility",
    ]);
    expect(states.every((s) => s.external_refs.length > 0)).toBe(true); // grounded
    expect(states.find((s) => s.kind === "open-problem")?.era).toBeNull(); // unknown, not invented
  });

  it("returns [] on unparseable text (honest, never a guess)", () => {
    expect(parseEpistemicStates("not json", CITATIONS, "t")).toEqual([]);
  });
});

describe("TemporalResearchUnit.execute", () => {
  it("produces grounded, ordered epistemic states when the search returns citations (D3)", async () => {
    const unit = new TemporalResearchUnit({
      manifest: manifest(),
      model: stubModel({ text: STATES_JSON, citations: CITATIONS }),
    });
    const emissions = await unit.execute(packet({ concept_ref: "backpropagation" }));
    const content = (emissions.packets?.[0]?.content ?? {}) as Record<string, unknown>;
    expect(content["response_kind"]).toBe("model-temporal-research");
    expect(content["degraded"]).toBe(false);
    expect((content["states"] as unknown[]).length).toBe(4);
    expect(emissions.trace?.determinism_level).toBe("D3");
  });

  it("is honestly degraded-empty when the model returns NO citation (never a fabricated history)", async () => {
    const unit = new TemporalResearchUnit({
      manifest: manifest(),
      model: stubModel({ text: STATES_JSON }), // no citations
    });
    const emissions = await unit.execute(packet({ concept_ref: "backpropagation" }));
    const content = (emissions.packets?.[0]?.content ?? {}) as Record<string, unknown>;
    expect(content["states"]).toEqual([]);
    expect(content["degraded"]).toBe(true);
  });

  it("falls back to honest-empty on model failure", async () => {
    const unit = new TemporalResearchUnit({ manifest: manifest(), model: failingModel() });
    const emissions = await unit.execute(packet({ concept_ref: "backpropagation" }));
    const content = (emissions.packets?.[0]?.content ?? {}) as Record<string, unknown>;
    expect(content["response_kind"]).toBe("timeline-unavailable");
    expect(content["states"]).toEqual([]);
    expect(content["degraded"]).toBe(true);
  });
});
