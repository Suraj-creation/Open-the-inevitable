/**
 * Structured Semantic Explanation — the explanation block becomes typed, role-tagged semantic objects
 * aligned to the canonical EpistemicRole vocabulary (no parallel role system) and enriched at the
 * single block-construction chokepoint (so every path produces identical durable content).
 */
import { describe, expect, test } from "vitest";
import { ManualClock, SeededIdGenerator } from "@inevitable/shared";
import {
  EXPLANATION_ROLE_VOCAB_VERSION,
  coerceEpistemicRole,
  createCognitionBlock,
  explanationSectionRole,
  sectionsFromRoleTexts,
  structureExplanation,
  type EpistemicRole,
  type SemanticSection,
} from "../src/index";

const VALID_ROLES: ReadonlySet<EpistemicRole> = new Set<EpistemicRole>([
  "canonical",
  "definition",
  "reasoning",
  "example",
  "warning",
  "misconception",
  "insight",
  "memory-cue",
  "observation",
  "evidence",
  "structural",
]);

function ctx() {
  return { clock: new ManualClock(0), idGenerator: new SeededIdGenerator("s"), hlc: "0" };
}

describe("structureExplanation — role-tagged sections aligned to the EpistemicRole authority", () => {
  test("maps the 7-layer model to sections in canonical order with the expected roles", () => {
    const sections = structureExplanation({
      layer_0: "Think of it like a solar panel.",
      layer_2: "Formally, photosynthesis is …",
      layer_4: "Worked example: …",
    });
    expect(sections.map((s) => s.key)).toEqual(["layer_0", "layer_2", "layer_4"]);
    expect(sections.map((s) => s.role)).toEqual(["insight", "definition", "example"]);
    expect(sections.map((s) => s.order)).toEqual([0, 1, 2]);
    for (const s of sections) expect(VALID_ROLES.has(s.role)).toBe(true);
  });

  test("every role it can emit is a member of the EpistemicRole authority (no parallel vocab)", () => {
    for (const key of [
      "layer_0",
      "layer_1",
      "layer_2",
      "layer_3",
      "layer_4",
      "layer_5",
      "layer_6",
      "unknown_x",
    ]) {
      expect(VALID_ROLES.has(explanationSectionRole(key))).toBe(true);
    }
  });

  test("skips empty / non-string layers and is deterministic (pure fold)", () => {
    const layers = { layer_0: "x", layer_1: "   ", layer_2: 42 as unknown as string };
    const a = structureExplanation(layers);
    const b = structureExplanation(layers);
    expect(a).toEqual(b);
    expect(a.map((s) => s.key)).toEqual(["layer_0"]);
  });

  test("unknown extra layers are forward-compatible (observation), appended after the canonical set", () => {
    const sections = structureExplanation({ layer_0: "x", layer_9: "future modality" });
    expect(sections.map((s) => s.role)).toEqual(["insight", "observation"]);
  });
});

describe("createCognitionBlock — Structured Semantic Explanation enrichment (single chokepoint)", () => {
  test("an explanation block with layers gains durable sections + the vocab version", () => {
    const result = createCognitionBlock(
      {
        surface_id: "srf-1",
        block_type: "explanation",
        title: "Photosynthesis",
        content: { summary: "How plants make food.", layers: { layer_0: "story", layer_2: "def" } },
        provenance: {
          packet_id: null,
          producer_cid: "agent.explanation",
          agent_id: "explanation",
          world_state_nodes: [],
          memory_mutation_id: null,
          trace_id: null,
          reason: "test",
        },
      },
      ctx(),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const sections = result.value.content["sections"] as SemanticSection[];
    expect(sections.map((s) => s.role)).toEqual(["insight", "definition"]);
    expect(result.value.content["role_vocab_version"]).toBe(EXPLANATION_ROLE_VOCAB_VERSION);
    // Legacy layers are preserved (back-compat).
    expect(result.value.content["layers"]).toBeDefined();
  });

  test("content already carrying sections is left untouched (e.g. agent-emitted)", () => {
    const pre: SemanticSection[] = [
      { key: "custom", role: "warning", title: "Careful", text: "…", order: 0 },
    ];
    const result = createCognitionBlock(
      {
        surface_id: "srf-1",
        block_type: "explanation",
        title: "T",
        content: { sections: pre, layers: { layer_0: "ignored" } },
        provenance: {
          packet_id: null,
          producer_cid: "a",
          agent_id: "explanation",
          world_state_nodes: [],
          memory_mutation_id: null,
          trace_id: null,
          reason: "t",
        },
      },
      ctx(),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.content["sections"]).toEqual(pre);
    expect(result.value.content["role_vocab_version"]).toBeUndefined();
  });

  test("non-explanation blocks are never enriched", () => {
    const result = createCognitionBlock(
      {
        surface_id: "srf-1",
        block_type: "practice",
        title: "P",
        content: { layers: { layer_0: "x" } },
        provenance: {
          packet_id: null,
          producer_cid: "a",
          agent_id: "practice",
          world_state_nodes: [],
          memory_mutation_id: null,
          trace_id: null,
          reason: "t",
        },
      },
      ctx(),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.content["sections"]).toBeUndefined();
  });
});

describe("coerceEpistemicRole / sectionsFromRoleTexts — the harness→surface integration boundary", () => {
  test("coerces arbitrary and aliased role strings to valid EpistemicRoles", () => {
    expect(coerceEpistemicRole("insight")).toBe("insight");
    expect(coerceEpistemicRole("intuition")).toBe("insight");
    expect(coerceEpistemicRole("Derivation")).toBe("reasoning");
    expect(coerceEpistemicRole("nonsense")).toBe("observation");
    for (const role of ["definition", "example", "warning", "frontier", "code", "visual"]) {
      expect(VALID_ROLES.has(coerceEpistemicRole(role))).toBe(true);
    }
  });

  test("builds ordered SemanticSections from a faculty's role-tagged output, skipping empty text", () => {
    const sections = sectionsFromRoleTexts([
      { role: "intuition", title: "Intuition", text: "Think of a solar panel." },
      { role: "definition", title: "Definition", text: "   " },
      { role: "definition", title: "Definition", text: "Converts light energy." },
    ]);
    expect(sections.map((s) => s.role)).toEqual(["insight", "definition"]);
    expect(sections.map((s) => s.key)).toEqual(["section-0", "section-1"]);
    expect(sections.map((s) => s.order)).toEqual([0, 1]);
    for (const s of sections) expect(VALID_ROLES.has(s.role)).toBe(true);
  });
});
