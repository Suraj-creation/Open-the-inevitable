/**
 * ResearchUnit — post-mastery research frontier agent (F10, ADR-0026).
 * Deterministic: stub models only.
 */
import { describe, expect, test } from "vitest";
import type { ModelRuntime } from "@inevitable/contracts";
import type { CognitionPacket } from "@inevitable/protocols";
import { SeededIdGenerator } from "@inevitable/shared";
import { MVP_AGENT_MANIFESTS } from "../src/agent-catalog";
import { ResearchUnit, deterministicResearch, parseResearchOutput } from "../src/research-unit";

const researchManifest = MVP_AGENT_MANIFESTS.find((m) => m.id === "agent.research")!;

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

const GOOD_RESEARCH = JSON.stringify({
  frontier: "Researchers are actively exploring non-uniform FFT algorithms for sparse grids.",
  gap: "No O(n log n) algorithm exists for arbitrarily placed sampling nodes.",
  hypothesis_seed:
    "Could sparse-grid FFT generalise to arbitrary node placement using interpolation?",
  source_note:
    "Survey recent numerical analysis literature and SIAM Journal on Scientific Computing.",
});

function packet(content: Record<string, unknown>): CognitionPacket {
  return {
    packet_id: "cp-rsch-000000000000000001",
    schema_version: "1.0.0",
    source_cid: "cog-learner",
    target_cid: "cog-res",
    tenant_id: null,
    session_id: "intent-001",
    causation_id: "intent-001",
    correlation_id: "cp-rsch-000000000000000002",
    timestamp: "2026-06-25T00:00:00.000Z",
    hlc: "00000000000000000000:0:test",
    sequence_number: 0,
    packet_type: "intent",
    intent: "research frontier: Fourier Analysis",
    concept_ids: ["fourier-analysis"],
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

describe("parseResearchOutput", () => {
  test("parses all four required fields from valid JSON", () => {
    const result = parseResearchOutput(GOOD_RESEARCH);
    expect(result.frontier).toContain("non-uniform FFT");
    expect(result.gap).toContain("O(n log n)");
    expect(result.hypothesis_seed).toContain("Could sparse-grid");
    expect(result.source_note).toContain("numerical analysis");
  });

  test("strips markdown fences before parsing", () => {
    const fenced = "```json\n" + GOOD_RESEARCH + "\n```";
    const result = parseResearchOutput(fenced);
    expect(result.frontier).toBeTruthy();
  });

  test("throws E_MODEL_OUTPUT_MALFORMED on non-JSON input", () => {
    expect(() => parseResearchOutput("not json")).toThrow("E_MODEL_OUTPUT_MALFORMED");
  });

  test("throws E_MODEL_OUTPUT_MALFORMED when a required field is missing", () => {
    const missing = JSON.stringify({ frontier: "x", gap: "y", hypothesis_seed: "z" });
    expect(() => parseResearchOutput(missing)).toThrow("E_MODEL_OUTPUT_MALFORMED");
  });

  test("throws E_MODEL_OUTPUT_MALFORMED when a field is empty string", () => {
    const empty = JSON.stringify({
      frontier: "x",
      gap: "",
      hypothesis_seed: "z",
      source_note: "s",
    });
    expect(() => parseResearchOutput(empty)).toThrow("E_MODEL_OUTPUT_MALFORMED");
  });
});

describe("deterministicResearch", () => {
  test("returns a valid scaffold from concept title and domain", () => {
    const r = deterministicResearch("Fourier Analysis", "signal-processing");
    expect(r.frontier).toContain("signal-processing");
    expect(r.gap).toContain("Fourier Analysis");
    expect(r.hypothesis_seed).toMatch(/Could|What if/i);
    expect(r.source_note).toBeTruthy();
  });

  test("handles empty domain gracefully", () => {
    const r = deterministicResearch("Graph Theory", "");
    expect(r.frontier).toBeTruthy();
    expect(r.hypothesis_seed).toBeTruthy();
  });
});

describe("ResearchUnit", () => {
  test("agent.research manifest is registered in MVP_AGENT_MANIFESTS", () => {
    expect(researchManifest).toBeDefined();
    expect(researchManifest.id).toBe("agent.research");
    expect(researchManifest.capabilities).toContain("research.frontier.map");
  });

  test("execute() uses deterministic fallback when model throws", async () => {
    const unit = new ResearchUnit({
      manifest: researchManifest,
      model: {
        async generate() {
          throw new Error("model unavailable");
        },
        async embed() {
          return [];
        },
      },
      idGenerator: new SeededIdGenerator("research-fallback"),
    });
    const p = packet({
      concept_id: "fourier",
      concept_title: "Fourier Analysis",
      domain: "mathematics",
    });
    const emissions = await unit.execute(p);
    expect(emissions.packets).toHaveLength(1);
    const content = emissions.packets![0]!.content as Record<string, unknown>;
    expect(content["response_kind"]).toBe("deterministic-research");
    expect(content["fallback_reason"]).toBeTruthy();
    expect(typeof content["frontier"]).toBe("string");
    expect(typeof content["gap"]).toBe("string");
  });

  test("execute() uses model output when model succeeds", async () => {
    const unit = new ResearchUnit({
      manifest: researchManifest,
      model: stubModel(GOOD_RESEARCH),
      idGenerator: new SeededIdGenerator("research-model"),
    });
    const p = packet({
      concept_id: "fourier",
      concept_title: "Fourier Analysis",
      domain: "mathematics",
    });
    const emissions = await unit.execute(p);
    expect(emissions.packets).toHaveLength(1);
    const content = emissions.packets![0]!.content as Record<string, unknown>;
    expect(content["response_kind"]).toBe("model-research");
    expect(content["frontier"]).toContain("non-uniform FFT");
    expect(content["hypothesis_seed"]).toContain("Could sparse-grid");
  });

  test("execute() falls back to deterministic when model returns refusal", async () => {
    const unit = new ResearchUnit({
      manifest: researchManifest,
      model: stubModel("I cannot help with that.", "refusal"),
      idGenerator: new SeededIdGenerator("research-refusal"),
    });
    const p = packet({
      concept_id: "fourier",
      concept_title: "Fourier Analysis",
      domain: "mathematics",
    });
    const emissions = await unit.execute(p);
    expect(emissions.packets).toHaveLength(1);
    const content = emissions.packets![0]!.content as Record<string, unknown>;
    expect(content["response_kind"]).toBe("deterministic-research");
  });

  test("execute() extracts concept_title from packet content", async () => {
    const unit = new ResearchUnit({
      manifest: researchManifest,
      model: stubModel(GOOD_RESEARCH),
      idGenerator: new SeededIdGenerator("research-title"),
    });
    const p = packet({ concept_title: "Topological Data Analysis", domain: "mathematics" });
    const emissions = await unit.execute(p);
    expect(emissions.packets![0]!.content).toBeTruthy();
  });

  test("reasoning trace is produced with the correct determinism level", async () => {
    const unit = new ResearchUnit({
      manifest: researchManifest,
      model: stubModel(GOOD_RESEARCH),
      idGenerator: new SeededIdGenerator("research-trace"),
    });
    const p = packet({ concept_id: "fourier", concept_title: "Fourier Analysis" });
    const emissions = await unit.execute(p);
    expect(emissions.trace).toBeDefined();
    expect(emissions.trace!.determinism_level).toBe("D3");
    expect(emissions.trace!.strategy).toBe("frontier-mapping");
  });

  test("deterministic fallback trace has D2 level", async () => {
    const unit = new ResearchUnit({
      manifest: researchManifest,
      model: {
        async generate() {
          throw new Error("offline");
        },
        async embed() {
          return [];
        },
      },
      idGenerator: new SeededIdGenerator("research-d2"),
    });
    const p = packet({ concept_id: "fourier", concept_title: "Fourier Analysis" });
    const emissions = await unit.execute(p);
    expect(emissions.trace!.determinism_level).toBe("D2");
  });
});
