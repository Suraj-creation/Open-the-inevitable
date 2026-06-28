import { describe, expect, test } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type {
  CognitionBlock,
  CognitionBlockType,
  CognitiveFrame,
  SurfaceState,
  TimelineProjection,
} from "@inevitable/surface/client";
import { SurfaceView } from "../src/SurfaceView";

function block(
  type: CognitionBlockType,
  title: string,
  content: Record<string, unknown>,
): CognitionBlock {
  return {
    block_id: `blk-${type}`,
    surface_id: "srf-1",
    block_type: type,
    version: 1,
    created_at: "2026-06-12T00:00:00.000Z",
    hlc: "hlc-1",
    title,
    content,
    concept_ids: [],
    classification: "internal",
    confidence: 0.88,
    provenance: {
      packet_id: "cp-1",
      producer_cid: "cog-exp",
      agent_id: type,
      source_event_id: "evt-1",
      world_state_nodes: [],
      memory_mutation_id: null,
      trace_id: "trace-1",
      reason: `produced a ${type} block`,
    },
  };
}

const timeline: TimelineProjection = {
  timeline_id: "tl-1",
  surface_id: "srf-1",
  goal: "Teach me Neural Networks",
  path_node_id: "path-1",
  entry_point: "beginner",
  completed: false,
  version: 1,
  nodes: [
    {
      concept_id: "linear-algebra",
      node_id: "n-la",
      title: "Linear Algebra",
      order: 0,
      prerequisites: [],
      layer: 0,
      status: "mastered",
      confidence: 0.9,
      milestone: false,
      mastery_target: { min_confidence: 0.6 },
    },
    {
      concept_id: "neural-networks",
      node_id: "n-nn",
      title: "Neural Networks",
      order: 1,
      prerequisites: ["linear-algebra"],
      layer: 1,
      status: "locked",
      confidence: null,
      milestone: true,
      mastery_target: { min_confidence: 0.6 },
    },
  ],
  edges: [{ from: "linear-algebra", to: "neural-networks", edge_type: "prerequisite_of" }],
};

const fixture: SurfaceState = {
  surface_id: "srf-1",
  session_id: "sess-1",
  learner_cid: "cog-l",
  status: "active",
  goal: "Teach me Neural Networks",
  blocks: [
    block("explanation", "What is a perceptron", { summary: "A linear classifier." }),
    block("image", "Perceptron diagram", {}),
  ],
  timeline,
  agents_joined: ["cog-exp"],
  contributions: [],
  routing_decisions: [
    {
      target_agent: "explanation",
      reason: "learner needs the core idea first",
      concept_id: "perceptron",
      producer_cid: "cog-sup",
      hlc: "hlc-1",
    },
  ],
  narration: [],
  focus: null,
  presence: [],
  streaming_blocks: [],
  agent_reasoning: [],
  agent_work_timings: [],
  frames: [],
  speculative_frames: [],
  narration_scripts: [],
  image_decisions: [],
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
  version: 6,
  last_hlc: "hlc-6",
};

function render(state: SurfaceState | null, status: "live" | "connecting" | "idle" = "live") {
  return renderToStaticMarkup(
    <SurfaceView
      surfaceId="srf-1"
      state={state}
      status={status}
      onAsk={() => {}}
      onExpand={() => {}}
    />,
  );
}

describe("SurfaceView — the Cognitive Stage (a projection of SurfaceState)", () => {
  test("spotlights the focused explanation on the stage, with the living timeline in sync", () => {
    const html = render(fixture);
    // Brand + living-timeline spine
    expect(html).toContain("The Inevitable");
    expect(html).toContain("Path");
    expect(html).toContain("Linear Algebra");
    expect(html).toContain("Neural Networks");
    // The focused explanation takes the stage (title + lede)
    expect(html).toContain("What is a perceptron");
    expect(html).toContain("A linear classifier.");
    // Agents are visible characters; provenance explains "why this"
    expect(html).toContain("Agents");
    expect(html).toContain("Why this");
    expect(html).toContain("produced a explanation block");
  });

  test("a focused multimodal block renders a designed media slot, never a provider branch", () => {
    const focused: SurfaceState = {
      ...fixture,
      focus: { target_type: "block", target_id: "blk-image", reason: "show it", spotlight: true },
    };
    const html = render(focused);
    expect(html).toContain("awaiting generation");
    expect(html).toContain("Image");
  });

  test("renders a poised empty stage before any cognition", () => {
    const html = render(null, "connecting");
    expect(html).toContain("conn-connecting");
    // The stage is listening / understanding — never an empty dashboard.
    expect(html.includes("listening") || html.includes("Understanding")).toBe(true);
  });

  test("UCS frame path: the board renders the MCCR, not the prose explanation block (ADR-0030)", () => {
    const frame: CognitiveFrame = {
      frame_id: "cfr-1",
      surface_id: "srf-1",
      ordinal: 1000,
      status: "composed",
      concept_id: "perceptron",
      title: "What the perceptron is",
      layout: null,
      mccr: {
        frame_id: "cfr-1",
        core_concept: {
          element_id: "el-core_concept",
          type: "core_concept",
          slot: "headline",
          reveal_order: 0,
          concept_id: "perceptron",
          content: { kind: "text", text: "The perceptron" },
        },
        definition: {
          element_id: "el-definition",
          type: "definition",
          slot: "definition",
          reveal_order: 1,
          concept_id: "perceptron",
          content: { kind: "text", text: "A threshold-weighted linear classifier." },
        },
        key_formula: {
          element_id: "el-key_formula",
          type: "key_formula",
          slot: "formula",
          reveal_order: 2,
          concept_id: "perceptron",
          content: { kind: "formula", latex: "y=\\mathbb{1}[w\\cdot x>b]", plain: "y = 1 if ..." },
        },
        diagram: null,
        relationship: null,
        mental_model: null,
        table: null,
        key_example: null,
        memory_cue: null,
        image: null,
        elements: [],
      },
      segment_ids: [],
      speculative_of: null,
      invalidation_reason: null,
      trigger_assumption: null,
      provenance: {
        planner_packet_id: null,
        composer_packet_id: "cp-1",
        producer_cid: "agent.composer",
        source_event_id: "evt-1",
        world_state_nodes: [],
        trace_id: null,
        reason: "composed",
      },
      version: 1,
      hlc: "hlc-1",
    };
    // The flat elements index drives rendering.
    const m = frame.mccr!;
    (m as { elements: unknown }).elements = [m.core_concept, m.definition, m.key_formula];

    const withFrame: SurfaceState = { ...fixture, frames: [frame] };
    const html = render(withFrame);

    // The board shows distilled MCCR anchors.
    expect(html).toContain("The perceptron");
    expect(html).toContain("A threshold-weighted linear classifier.");
    expect(html).toContain("Key formula");
    expect(html).toContain("y=\\mathbb{1}");
    // It does NOT render the legacy prose explanation block content.
    expect(html).not.toContain("A linear classifier."); // the fixture's explanation block summary
  });

  test("UCS Phase 2: the Observatory composition panel lists the progressive frame sequence (ADR-0030)", () => {
    const mk = (id: string, ordinal: number, title: string, concept: string): CognitiveFrame => {
      const core = {
        element_id: "el-core_concept",
        type: "core_concept" as const,
        slot: "core_concept",
        reveal_order: 0,
        concept_id: concept,
        content: { kind: "text" as const, text: title },
      };
      const def = {
        element_id: "el-definition",
        type: "definition" as const,
        slot: "definition",
        reveal_order: 1,
        concept_id: concept,
        content: { kind: "text" as const, text: `${title} — defined.` },
      };
      return {
        frame_id: id,
        surface_id: "srf-1",
        ordinal,
        status: "composed",
        concept_id: concept,
        title,
        layout: null,
        mccr: {
          frame_id: id,
          core_concept: core,
          definition: def,
          key_formula: null,
          diagram: null,
          relationship: null,
          mental_model: null,
          table: null,
          key_example: null,
          memory_cue: null,
          image: null,
          elements: [core, def],
        },
        segment_ids: ["s0", "s1"],
        speculative_of: null,
        invalidation_reason: null,
        trigger_assumption: null,
        provenance: {
          planner_packet_id: "cp-plan",
          composer_packet_id: "cp-1",
          producer_cid: "agent.composer",
          source_event_id: "evt-1",
          world_state_nodes: [],
          trace_id: null,
          reason: "composed",
        },
        version: 1,
        hlc: "hlc-1",
      };
    };
    const withFrames: SurfaceState = {
      ...fixture,
      frames: [
        mk("cfr-1", 1000, "Intuition first", "perceptron"),
        mk("cfr-2", 2000, "The map, precisely", "perceptron"),
      ],
    };
    const html = render(withFrames);
    // The composition panel surfaces the sequence (titles, anchors, density), in order.
    expect(html).toContain("Composition");
    expect(html).toContain("Intuition first");
    expect(html).toContain("The map, precisely");
    expect(html).toContain("2/6 anchors");
    // The board (FrameDeck) renders the latest frame's MCCR, not the prose explanation block.
    expect(html).toContain("The map, precisely — defined.");
    expect(html).not.toContain("A linear classifier.");
  });

  test("makes multi-agent cognition visible: ensemble panel, typed graph edges, interaction controls (S1.4)", () => {
    const withEnsemble: SurfaceState = {
      ...fixture,
      proposals: [
        {
          proposal_id: "pr-1",
          agent_cid: "cog-exp",
          agent_id: "explanation",
          topic: "explanation:perceptron",
          summary: "A perceptron is a linear threshold unit.",
          confidence: 0.82,
          hlc: "h1",
        },
        {
          proposal_id: "pr-2",
          agent_cid: "challenger",
          agent_id: "revision",
          topic: "explanation:perceptron",
          summary: "Frame it as a decision boundary.",
          confidence: 0.61,
          hlc: "h2",
        },
      ],
      syntheses: [
        {
          topic: "explanation:perceptron",
          chosen_proposal_ids: ["pr-1"],
          block_ids: [],
          rationale: "primary explanation selected; challenger concurred",
          producer_cid: "cog-l",
          hlc: "h3",
        },
      ],
    };
    const html = renderToStaticMarkup(
      <SurfaceView
        surfaceId="srf-1"
        state={withEnsemble}
        status="live"
        onAsk={() => {}}
        onExpand={() => {}}
        onInteract={() => {}}
      />,
    );
    // Ensemble proposals (with confidence) + arbiter synthesis are visible
    expect(html).toContain("Ensemble");
    expect(html).toContain("82%");
    expect(html).toContain("challenger concurred");
    // The timeline renders as a graph with typed edges (the prerequisite spine)
    expect(html).toContain("edge-prerequisite_of");
    // In-stream interaction controls are present when onInteract is wired
    expect(html).toContain("Go deeper");
    expect(html).toContain("Interrupt");
  });

  test("renders a concept-map block as an inline structured visual (S2.1a)", () => {
    const mapBlock = block("concept", "Concept map — Linear Algebra", {
      map: {
        focus: "linear-algebra",
        nodes: [
          { id: "linear-algebra", title: "Linear Algebra", layer: 0, status: "available" },
          { id: "neural-networks", title: "Neural Networks", layer: 1, status: "locked" },
        ],
        edges: [{ from: "linear-algebra", to: "neural-networks", type: "prerequisite_of" }],
      },
    });
    const html = render({ ...fixture, blocks: [mapBlock] });
    // The map renders as an SVG with the concepts as nodes + a typed edge (cognition you can see)
    expect(html).toContain("conceptmap-svg");
    expect(html).toContain("cm-prerequisite_of");
    expect(html).toContain("Neural Networks");
  });

  test("immersive composition: fullscreen whiteboard with Agents control + Path launcher (S-UCS)", () => {
    const html = render(fixture);
    // The Agents Observatory control and the floating Path launcher are the on-demand chrome
    expect(html).toContain("agents-btn");
    expect(html).toContain("path-launcher");
    // Observatory + Path are mounted overlays (projection stays SSR-stable), toggled via data-open
    expect(html).toContain('class="overlay overlay--right observatory"');
    expect(html).toContain('data-open="false"');
    // The capabilities they host remain reachable: agents, ensemble inputs, and the path graph
    expect(html).toContain("Agent Observatory");
    expect(html).toContain("edge-prerequisite_of");
  });
});
