/**
 * Deck model — the pure frame→slide projection behind the downloadable session (issue 11).
 * Every exporter (pptx today; PDF/Markdown/LaTeX later) derives from this one canonical model.
 */
import { describe, expect, test } from "vitest";
import type { CognitiveFrame, Mccr, MccrElement, SurfaceState } from "@inevitable/surface/client";
import { buildDeckModel } from "../src/export/deck-model";

function el(
  type: MccrElement["type"],
  revealOrder: number,
  content: MccrElement["content"],
): MccrElement {
  return {
    element_id: `el-${type}`,
    type,
    slot: type,
    reveal_order: revealOrder,
    concept_id: "fourier",
    content,
  };
}

function mccr(frameId: string): Mccr {
  const core = el("core_concept", 0, { kind: "text", text: "Fourier transform" });
  const def = el("definition", 1, { kind: "text", text: "Decomposes a signal into frequencies." });
  const formula = el("key_formula", 2, {
    kind: "formula",
    latex: "X(f)=\\int x(t)e^{-2\\pi ift}dt",
    plain: "X of f equals the integral…",
    lines: [],
  });
  const misconception = el("misconception", 3, {
    kind: "text",
    text: "It does NOT lose time information — the phase carries it.",
  });
  return {
    frame_id: frameId,
    core_concept: core,
    definition: def,
    key_formula: formula,
    diagram: null,
    relationship: null,
    mental_model: null,
    table: null,
    key_example: null,
    memory_cue: null,
    misconception,
    image: null,
    source_viewport: null,
    process: null,
    code: null,
    elements: [core, def, formula, misconception],
  };
}

function frame(id: string, ordinal: number, status: CognitiveFrame["status"]): CognitiveFrame {
  return {
    frame_id: id,
    surface_id: "srf-1",
    ordinal,
    status,
    kind: "teach",
    concept_id: "fourier",
    title: `Frame ${ordinal}`,
    layout: null,
    mccr: status === "planned" ? null : mccr(id),
    segment_ids: [],
    speculative_of: null,
    invalidation_reason: null,
    trigger_assumption: null,
    provenance: {
      planner_packet_id: null,
      composer_packet_id: "cp-1",
      producer_cid: "agent.composer",
      source_event_id: null,
      world_state_nodes: [],
      trace_id: null,
      reason: "composed",
    },
    version: 1,
    hlc: `hlc-${ordinal}`,
  };
}

function state(frames: CognitiveFrame[]): SurfaceState {
  return {
    surface_id: "srf-1",
    session_id: "sess-1",
    learner_cid: "cog-l",
    status: "active",
    goal: "Teach me Fourier analysis",
    blocks: [],
    timeline: {
      timeline_id: "tl-1",
      surface_id: "srf-1",
      nodes: [
        {
          concept_id: "fourier",
          title: "Fourier transform",
          layer: 0,
          status: "in_progress",
          confidence: 0.4,
          milestone: false,
          mastery_target: { min_confidence: 0.6 },
        },
      ],
      edges: [],
    } as unknown as SurfaceState["timeline"],
    agents_joined: [],
    contributions: [],
    routing_decisions: [],
    narration: [],
    focus: null,
    presence: [],
    streaming_blocks: [],
    agent_reasoning: [],
    agent_work_timings: [],
    frames,
    speculative_frames: [],
    narration_scripts: [
      {
        script_id: "nsc-1",
        frame_id: "cfr-a",
        segments: [
          {
            segment_id: "nsc-1-s0",
            anchor_ref: "core_concept",
            intent: "introduce",
            text: "Imagine a prism splitting light.",
            reveal_ids: [],
            pause_after: false,
          },
          {
            segment_id: "nsc-1-s1",
            anchor_ref: "definition",
            intent: "build",
            text: "Every signal is a sum of pure tones.",
            reveal_ids: [],
            pause_after: false,
          },
        ],
        hlc: "hlc-s",
      },
    ],
    image_decisions: [],
    cognition_health: [],
    streaming_frame_elements: [],
    disagreements: [],
    proposals: [],
    syntheses: [],
    interactions: [],
    depth_gates: [],
    prerequisite_descents: [],
    research_frontiers: [],
    motivation_surfaced: false,
    evaluation_records: [],
    mode: "student",
    current_projection: "timeline",
    ask_progress: null,
    sources: [],
    viewport_plans: [],
    viewport_changes: [],
    source_highlights: [],
    sync_bindings: [],
    resume_card: null,
    director_directives: [],
    latest_directive: null,
    affect_signals: [],
    latest_affect: null,
    attention_budget: null,
    scenes: [],
    expressed_intents: [],
    representations: [],
    version: 3,
    last_hlc: "hlc-3",
  };
}

describe("buildDeckModel", () => {
  test("one surfaced frame becomes one slide; the core concept is the slide title", () => {
    const model = buildDeckModel(state([frame("cfr-a", 1, "composed")]));
    expect(model.slides).toHaveLength(1);
    expect(model.slides[0]?.title).toBe("Fourier transform");
    expect(model.goal).toBe("Teach me Fourier analysis");
    expect(model.path[0]?.title).toBe("Fourier transform");
  });

  test("anchors become typed blocks in reveal order (core concept excluded from the body)", () => {
    const model = buildDeckModel(state([frame("cfr-a", 1, "composed")]));
    const kinds = model.slides[0]!.blocks.map((b) => b.kind);
    expect(kinds).toEqual(["text", "formula", "text"]); // definition, formula, misconception
    const roles = model.slides[0]!.blocks.flatMap((b) => (b.kind === "text" ? [b.role] : []));
    expect(roles).toEqual(["definition", "misconception"]);
  });

  test("the narration script becomes speaker notes", () => {
    const model = buildDeckModel(state([frame("cfr-a", 1, "composed")]));
    expect(model.slides[0]?.notes).toContain("prism splitting light");
    expect(model.slides[0]?.notes).toContain("sum of pure tones");
  });

  test("planned/speculative frames never export; slides sort by ordinal", () => {
    const model = buildDeckModel(
      state([
        frame("cfr-b", 2, "composed"),
        frame("cfr-a", 1, "promoted"),
        frame("cfr-c", 3, "planned"),
      ]),
    );
    expect(model.slides.map((s) => s.ordinal)).toEqual([1, 2]);
  });

  test("is deterministic (same state ⇒ same model)", () => {
    const s = state([frame("cfr-a", 1, "composed")]);
    expect(buildDeckModel(s)).toEqual(buildDeckModel(s));
  });
});
