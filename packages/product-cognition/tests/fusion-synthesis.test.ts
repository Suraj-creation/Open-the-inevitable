/**
 * CSE M9 T3 — the fused explanation synthesis (CSE-015 §3.1, ADR-0042). Covers the two gates
 * enforced at the parser (grounding: cited sources ⊆ contributing sources; disagreement honesty:
 * a synthesis over contradicting sources must acknowledge it), the deterministic per-source
 * alignment fallback (honest degraded, never a fabricated consensus), and the unit's model/fallback
 * paths.
 */
import { describe, expect, it } from "vitest";
import type { ModelGenerationRequest, ModelGenerationResult } from "@inevitable/contracts";
import { CosError } from "@inevitable/shared";
import {
  FALLBACK_SYNTHESIS_CONFIDENCE,
  FusionSynthesisUnit,
  MVP_AGENT_MANIFESTS,
  deterministicSynthesis,
  parseSynthesisOutput,
  type SynthesisClaim,
  type SynthesisContradiction,
  type SynthesisTreatment,
} from "../src/index";

const TITLE_TO_VERSION = new Map([
  ["optimization textbook", "srcv-a"],
  ["ml lecture notes", "srcv-b"],
]);

const TREATMENTS: SynthesisTreatment[] = [
  {
    source_version_id: "srcv-a",
    title: "Optimization Textbook",
    quote: "Steps against the gradient.",
    emphasis: "definition",
    coverage: "full",
  },
  {
    source_version_id: "srcv-b",
    title: "ML Lecture Notes",
    quote: "Rolls downhill.",
    emphasis: "intuition",
    coverage: "partial",
  },
];
const CLAIMS: SynthesisClaim[] = [
  {
    source_version_id: "srcv-a",
    statement: "Gradient descent converges to the global minimum.",
    epistemic_status: "established",
  },
  {
    source_version_id: "srcv-b",
    statement: "Gradient descent can stall at a local minimum.",
    epistemic_status: "contested",
  },
];
const CONTRADICTIONS: SynthesisContradiction[] = [
  {
    nature: "empirical",
    rationale: "global vs local minimum",
    statements: ["converges to the global minimum", "can stall at a local minimum"],
  },
];

function manifest() {
  const found = MVP_AGENT_MANIFESTS.find((m) => m.id === "agent.synthesis");
  if (!found) throw new Error("synthesis manifest missing from catalog");
  return found;
}

function stubModel(text: string) {
  return {
    generate: async (_req: ModelGenerationRequest): Promise<ModelGenerationResult> => ({
      text,
      model: "stub-model",
      finishReason: "stop" as const,
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
    packet_id: "pkt-synth-1",
    schema_version: "1.0.0",
    source_cid: "cog-test",
    target_cid: "agent.synthesis",
    tenant_id: null,
    session_id: null,
    causation_id: null,
    correlation_id: null,
    timestamp: "2026-07-16T00:00:00Z",
    hlc: "0000000000000001-00000000-test",
    sequence_number: 0,
    packet_type: "request",
    intent: "fusion-synthesis",
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

describe("parseSynthesisOutput (grounding + disagreement gates, CSE-015 §3.1/§6)", () => {
  it("maps cited titles to versions and drops any source the fusion did not contribute", () => {
    const json = JSON.stringify({
      prose:
        "GD steps against the gradient [Optimization Textbook]; it rolls downhill [ML Lecture Notes].",
      cited_sources: ["Optimization Textbook", "ML Lecture Notes", "Some Blog I Invented"],
      acknowledges_disagreement: false,
    });
    const s = parseSynthesisOutput(json, TITLE_TO_VERSION, false);
    expect(s.cited_source_ids).toEqual(["srcv-a", "srcv-b"]); // invented source dropped
    expect(s.degraded).toBe(false);
    expect(s.acknowledges_disagreement).toBe(false);
  });

  it("FORCES acknowledges_disagreement when the sources contradict (never flattens it)", () => {
    const json = JSON.stringify({
      prose: "A woven account [Optimization Textbook].",
      cited_sources: ["Optimization Textbook"],
      acknowledges_disagreement: false, // model tried to smooth it over…
    });
    const s = parseSynthesisOutput(json, TITLE_TO_VERSION, true);
    expect(s.acknowledges_disagreement).toBe(true); // …the gate forces honesty
  });

  it("throws on empty prose, or when no cited source survives the grounding gate", () => {
    expect(() =>
      parseSynthesisOutput(
        JSON.stringify({ prose: "", cited_sources: ["Optimization Textbook"] }),
        TITLE_TO_VERSION,
        false,
      ),
    ).toThrowError(/empty prose/);
    expect(() =>
      parseSynthesisOutput(
        JSON.stringify({ prose: "x", cited_sources: ["Nonexistent"] }),
        TITLE_TO_VERSION,
        false,
      ),
    ).toThrowError(/grounding gate/);
  });
});

describe("deterministicSynthesis (the honest per-source alignment view, CSE-015 §6)", () => {
  it("weaves each source's claim attributed by name, cites them, and notes disagreement", () => {
    const s = deterministicSynthesis("gradient-descent", TREATMENTS, CLAIMS, CONTRADICTIONS);
    expect(s.degraded).toBe(true);
    expect(new Set(s.cited_source_ids)).toEqual(new Set(["srcv-a", "srcv-b"]));
    expect(s.acknowledges_disagreement).toBe(true);
    expect(s.prose).toContain("Optimization Textbook");
    expect(s.prose).toContain("ML Lecture Notes");
    expect(s.prose).toContain("disagree");
  });
});

describe("FusionSynthesisUnit.execute", () => {
  it("produces a grounded model synthesis (D3)", async () => {
    const json = JSON.stringify({
      prose: "One account [Optimization Textbook] and [ML Lecture Notes].",
      cited_sources: ["Optimization Textbook", "ML Lecture Notes"],
      acknowledges_disagreement: true,
    });
    const unit = new FusionSynthesisUnit({ manifest: manifest(), model: stubModel(json) });
    const emissions = await unit.execute(
      packet({
        concept_ref: "gradient-descent",
        treatments: TREATMENTS,
        claims: CLAIMS,
        contradictions: CONTRADICTIONS,
      }),
    );
    const content = (emissions.packets?.[0]?.content ?? {}) as Record<string, unknown>;
    expect(content["response_kind"]).toBe("model-fused-synthesis");
    const synthesis = content["synthesis"] as { cited_source_ids: string[]; degraded: boolean };
    expect(synthesis.cited_source_ids).toHaveLength(2);
    expect(synthesis.degraded).toBe(false);
    expect(emissions.trace?.determinism_level).toBe("D3");
  });

  it("falls back to the deterministic alignment view on model failure (honest degraded)", async () => {
    const unit = new FusionSynthesisUnit({ manifest: manifest(), model: failingModel() });
    const emissions = await unit.execute(
      packet({
        concept_ref: "gradient-descent",
        treatments: TREATMENTS,
        claims: CLAIMS,
        contradictions: CONTRADICTIONS,
      }),
    );
    const content = (emissions.packets?.[0]?.content ?? {}) as Record<string, unknown>;
    expect(content["response_kind"]).toBe("deterministic-fused-synthesis");
    expect(content["confidence"]).toBe(FALLBACK_SYNTHESIS_CONFIDENCE);
    const synthesis = content["synthesis"] as {
      degraded: boolean;
      acknowledges_disagreement: boolean;
    };
    expect(synthesis.degraded).toBe(true);
    expect(synthesis.acknowledges_disagreement).toBe(true);
  });
});
