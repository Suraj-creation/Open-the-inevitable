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
import { CreationBody } from "../src/components/CreationPanel";
import { SourceCognitionBody } from "../src/components/SourceCognitionPanel";
import { CommonsBody } from "../src/components/CommonsPanel";
import type { CommonsEntryView, CreationView, SourceCognitionView } from "../src/api";

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
      kind: "teach",
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
          content: {
            kind: "formula",
            latex: "y=\\mathbb{1}[w\\cdot x>b]",
            plain: "y = 1 if ...",
            lines: [],
          },
        },
        diagram: null,
        relationship: null,
        mental_model: null,
        table: null,
        key_example: null,
        memory_cue: null,
        misconception: null,
        image: null,
        source_viewport: null,
        process: null,
        code: null,
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
    // The formula is RENDERED (\cdot → ·), never shown as raw LaTeX to a learner.
    expect(html).toContain("·");
    expect(html).not.toContain("\\mathbb"); // raw LaTeX macros must never reach the board
    expect(html).not.toContain("\\cdot");
    // It does NOT render the legacy prose explanation block content.
    expect(html).not.toContain("A linear classifier."); // the fixture's explanation block summary
  });

  test("CSE M7: the Director badge surfaces the current cognitive state + pace and 'why this pace'", () => {
    const withDirective: SurfaceState = {
      ...fixture,
      latest_directive: {
        directive_id: "dir-1",
        scale: "concept",
        target_state: "practicing",
        pacing: { tempo: "measured", dwell_hint_ms: 3600, silence: false },
        intensity: "normal",
        focus: { concept_ref: "neural-networks", source_anchor_ref: null },
        rationale:
          "Time to work it through — practice on Neural Networks turns recognition into understanding.",
        considered: [
          {
            alternative_state: "learning",
            rejected_because: "you have seen the idea; doing it is the next step",
          },
        ],
        evidence_refs: ["frame:cfr-1"],
        confidence: 0.7,
        entered_state: "practicing",
        hlc: "hlc-d",
      },
    };
    const html = render(withDirective);
    // The chip names the state + tempo the Director chose (the popover with the full rationale opens
    // on click — the "why this pace" affordance, ADR-0033 L4).
    expect(html).toContain("Practicing");
    expect(html).toContain("measured");
    expect(html).toContain('data-state="practicing"');
    expect(html).toContain("Why this pace?");
  });

  test("CSE M8: a marked anchor renders a durable mark on the board (interaction grammar)", () => {
    const core = {
      element_id: "el-core_concept",
      type: "core_concept" as const,
      slot: "core_concept",
      reveal_order: 0,
      concept_id: "perceptron",
      content: { kind: "text" as const, text: "The perceptron" },
    };
    const frame: CognitiveFrame = {
      frame_id: "cfr-mark",
      surface_id: "srf-1",
      ordinal: 1000,
      status: "composed",
      concept_id: "perceptron",
      title: "The perceptron",
      kind: "teach",
      layout: null,
      mccr: {
        frame_id: "cfr-mark",
        core_concept: core,
        definition: null,
        key_formula: null,
        diagram: null,
        relationship: null,
        mental_model: null,
        table: null,
        key_example: null,
        memory_cue: null,
        misconception: null,
        image: null,
        source_viewport: null,
        process: null,
        code: null,
        elements: [core],
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
    const withMark: SurfaceState = {
      ...fixture,
      frames: [frame],
      scenes: [
        {
          scene_id: "scn-mark",
          frame_ref: "cfr-mark",
          concept_ref: "perceptron",
          state: "learning",
          directive_ref: "dir-1",
          actors: [],
          lighting: { focus_actor_ref: null, cdl_state: "learning", recession: [] },
          evolution_log: [
            {
              delta_id: "scd-1",
              op: "annotate",
              cause: "learner",
              payload: { kind: "annotate", target_anchor_ref: "el-core_concept" },
              interaction_ref: "ix-1",
              hlc: "h1",
            },
          ],
          shots: [],
          closed: false,
          hlc: "h1",
        },
      ],
    };
    const html = renderToStaticMarkup(
      <SurfaceView
        surfaceId="srf-1"
        state={withMark}
        status="live"
        onAsk={() => {}}
        onExpand={() => {}}
        onInteract={() => {}}
      />,
    );
    // The core-concept anchor is marked (the learner's act on cognition is visible on the board).
    expect(html).toContain('data-marked="true"');
    expect(html).toContain("mccr-el-mark");
    // The Mark affordance is offered on anchors (the board is manipulable, CSE-014).
    expect(html).toContain("Mark this");
  });

  test("CSE M6: a returning learner's resume card surfaces their understanding, not a page position", () => {
    const withResume: SurfaceState = {
      ...fixture,
      resume_card: {
        episode_ref: "ia-episode-1",
        delta_ref: "ia-delta-1",
        summary: "2 concepts, 5 contributions, 1 gate pass, 1 confusion",
        last_concept_ref: "neural-networks",
        concepts_touched: ["linear-algebra", "neural-networks"],
        open_confusions: [{ description: "depth gate failed", concept_ref: "neural-networks" }],
        days_since: 3,
        hlc: "hlc-r",
      },
    };
    const html = render(withResume);
    expect(html).toContain("Welcome back");
    expect(html).toContain("3d since");
    expect(html).toContain("2 concepts, 5 contributions");
    expect(html).toContain("Still open");
    // The map affordance is always offered from the card (the "Pick up" CTA needs onAdvance wired).
    expect(html).toContain("See your map");
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
        kind: "teach",
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
          misconception: null,
          image: null,
          source_viewport: null,
          process: null,
          code: null,
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
    expect(html).toContain("2/8 anchors");
    // The board (FrameDeck) renders the latest frame's MCCR, not the prose explanation block.
    expect(html).toContain("The map, precisely — defined.");
    expect(html).not.toContain("A linear classifier.");
  });

  test("CSE M5: a bound source renders the Living Reference beside the board, evidence on the frame", () => {
    const core = {
      element_id: "el-core_concept",
      type: "core_concept" as const,
      slot: "core_concept",
      reveal_order: 0,
      concept_id: "entropy",
      content: { kind: "text" as const, text: "Entropy" },
    };
    const evidence = {
      element_id: "el-source_viewport",
      type: "source_viewport" as const,
      slot: "source_viewport",
      reveal_order: 11,
      concept_id: "entropy",
      content: {
        kind: "source_viewport" as const,
        source_version_id: "srcv-1",
        anchor_ref: "anc-1",
        quote: "Entropy counts the number of microscopic configurations of a system.",
        region: { path: "p1/blk-2", page: 1, bbox: null, char_start: 24, char_end: 96 },
      },
    };
    const frame: CognitiveFrame = {
      frame_id: "cfr-src",
      surface_id: "srf-1",
      ordinal: 1000,
      status: "composed",
      concept_id: "entropy",
      title: "What entropy counts",
      kind: "teach",
      layout: null,
      mccr: {
        frame_id: "cfr-src",
        core_concept: core,
        definition: null,
        key_formula: null,
        diagram: null,
        relationship: null,
        mental_model: null,
        table: null,
        key_example: null,
        memory_cue: null,
        misconception: null,
        image: null,
        source_viewport: evidence,
        process: null,
        code: null,
        elements: [core, evidence],
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
    const region = {
      path: "p1/blk-2",
      page: 1,
      bbox: null,
      char_start: 24,
      char_end: 96,
      quote: "Entropy counts the number of microscopic configurations of a system.",
    };
    const withSource: SurfaceState = {
      ...fixture,
      frames: [frame],
      sources: [
        {
          source_id: "src-1",
          source_version_id: "srcv-1",
          modality: "markdown",
          title: "Statistical Mechanics",
          layers_available: ["structural"],
          content_ref: "gateway://sources/abc",
          hlc: "h1",
        },
      ],
      viewport_plans: [
        {
          plan_id: "vpp-1",
          frame_id: "cfr-src",
          source_version_id: "srcv-1",
          viewports: [
            { viewport_id: "vp-1", anchor_ref: "anc-1", emphasis: "focus", ordinal: 0, region },
          ],
          hlc: "h1",
        },
      ],
      source_highlights: [
        {
          highlight_id: "hl-1",
          frame_id: "cfr-src",
          source_version_id: "srcv-1",
          anchor_ref: "anc-1",
          role: "evidence",
          amplitude: "focal",
          lifetime: "held",
          provenance_class: "evidence",
          decided_by: "viewport-planner",
          region,
          cleared: false,
          hlc: "h1",
        },
      ],
      sync_bindings: [
        {
          frame_id: "cfr-src",
          script_id: "nsc-1",
          bindings: [{ segment_id: "nsc-1-s0", viewport_ref: "vp-1", highlight_refs: ["hl-1"] }],
          hlc: "h1",
        },
      ],
    };
    const html = render(withSource);
    // The Living Reference pane stands beside the board, named for its source.
    expect(html).toContain("source-reference");
    expect(html).toContain("Statistical Mechanics");
    // Before bytes stream in, the viewport's preserved quote renders — honest, never blank.
    expect(html).toContain("Entropy counts the number of microscopic configurations");
    // Evidence joined the board itself: the source_viewport MCCR element in its own channel.
    expect(html).toContain("From the source");
    expect(html).toContain("mccr-source");
    expect(html).toContain("p. 1");
    // R2e (ADR-0057 D5): actively teaching FROM the source (viewport plans present) ⇒ the document
    // takes the stage — the source-stage layout engages, not the source-as-aside default.
    expect(html).toContain("board-plane--source-stage");
  });

  test("R3c: the Cinematographer's shot realizes on the board (data-shot) — the shot grammar rendered", () => {
    const frame: CognitiveFrame = {
      frame_id: "cfr-shot",
      surface_id: "srf-1",
      ordinal: 1000,
      status: "composed",
      kind: "teach",
      concept_id: "perceptron",
      title: "The perceptron",
      layout: null,
      mccr: {
        frame_id: "cfr-shot",
        core_concept: {
          element_id: "el-core_concept",
          type: "core_concept",
          slot: "headline",
          reveal_order: 0,
          concept_id: "perceptron",
          content: { kind: "text", text: "The perceptron" },
        },
        elements: [
          {
            element_id: "el-core_concept",
            type: "core_concept",
            slot: "headline",
            reveal_order: 0,
            concept_id: "perceptron",
            content: { kind: "text", text: "The perceptron" },
          },
        ],
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
    } as unknown as CognitiveFrame;
    const withShot: SurfaceState = {
      ...fixture,
      frames: [frame],
      scenes: [
        {
          scene_id: "scn-1",
          frame_ref: "cfr-shot",
          concept_ref: "perceptron",
          state: "learning",
          directive_ref: "dir-1",
          actors: [],
          lighting: { focal_actor_ref: null, recede_actor_refs: [] },
          evolution_log: [],
          shots: [
            {
              shot_id: "shot-1",
              scene_ref: "scn-1",
              kind: "semantic-zoom-in",
              subject: "el-core_concept",
              intent: "zoom to the decision rule",
              narration_anchor_ref: "core_concept",
              reduced_motion: "jump to the detailed level with a level label",
              cause: "cinematography",
              hlc: "h1",
            },
          ],
          closed: false,
          hlc: "h1",
        },
      ] as unknown as SurfaceState["scenes"],
    };
    const html = render(withShot);
    expect(html).toContain('data-shot="semantic-zoom-in"');
  });

  test("source-as-stage engages only when teaching FROM the source, not merely attaching one (R2e)", () => {
    // A source attached with NO viewport plans (e.g. bound for fusion) stays an aside, not the stage.
    const attachedOnly: SurfaceState = {
      ...fixture,
      sources: [
        {
          source_id: "src-1",
          source_version_id: "srcv-1",
          modality: "markdown",
          title: "A reference",
          layers_available: ["structural"],
          content_ref: "gateway://sources/abc",
          hlc: "h1",
        },
      ],
      viewport_plans: [],
    };
    const html = render(attachedOnly);
    expect(html).toContain("board-plane--with-source");
    expect(html).not.toContain("board-plane--source-stage");
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

  // CSE M11 T1 — Creative Cognition: the learner authors; the system only ever attaches disclosed
  // assists. The projection renders the draft as the learner's own words and the assists BESIDE it —
  // structure/findings/questions/refs, never merged into the draft (the no-ghostwriter law, visible).
  test("CSE M11: the creation panel shows the learner's draft and disclosed assists, never writing the artifact", () => {
    const learnerDraft = "Gradient descent walks downhill; I think the step size matters.";
    const creation: CreationView = {
      creation_id: "crt-1",
      learner_cid: "learner-1",
      kind: "essay",
      title: "Why learning rate matters",
      concept_refs: ["gradient-descent", "learning-rate"],
      draft: learnerDraft,
      status: "critiqued",
      as_of: "2026-07-17T00:00:00.000Z",
      assists: [
        {
          assist_id: "asst-1",
          kind: "scaffold",
          agent_cid: "agent.creation",
          disclosed: true,
          as_of: "2026-07-17T00:00:00.000Z",
          slots: [
            { label: "Thesis", hint: "the one idea the essay argues" },
            { label: "Evidence", hint: "the facts that support it" },
          ],
        },
        {
          assist_id: "asst-2",
          kind: "provocation",
          agent_cid: "agent.creation",
          disclosed: true,
          as_of: "2026-07-17T00:00:00.000Z",
          questions: ["What would have to be false for this to break?"],
        },
      ],
    };
    const html = renderToStaticMarkup(
      <CreationBody
        creation={creation}
        draft={learnerDraft}
        onDraft={() => {}}
        onAssist={() => {}}
        onComplete={() => {}}
        onContribute={() => {}}
        onRevoke={() => {}}
        busy={null}
      />,
    );
    // The draft is the learner's own words, shown in the authored channel.
    expect(html).toContain("Your words");
    expect(html).toContain(learnerDraft);
    // The assists render beside the draft, each stamped as a disclosed assist from the creation agent.
    expect(html).toContain("disclosed assist · agent.creation");
    expect(html).toContain("Thesis");
    expect(html).toContain("the one idea the essay argues");
    expect(html).toContain("What would have to be false for this to break?");
    // The no-ghostwriter law, visible: the scaffold gives structure, not content — the draft area
    // contains ONLY the learner's text, never the assist's slot labels.
    const draftArea = html.slice(html.indexOf('class="creation-draft"'));
    const draftValue = draftArea.slice(0, draftArea.indexOf("</textarea>"));
    expect(draftValue).toContain(learnerDraft);
    expect(draftValue).not.toContain("Thesis");
  });

  // ADR-0051 — the contribution loop: a completed creation offers an EXPLICIT consent affordance to
  // share as a source; once contributed, it shows the recursion (others can build on it).
  test("the contribution affordance is explicit-consent on completion, and shows contributed state", () => {
    const base: CreationView = {
      creation_id: "crt-1",
      learner_cid: "learner-1",
      kind: "essay",
      title: "On step size",
      concept_refs: ["gradient-descent"],
      draft: "The learning rate trades speed against stability.",
      status: "completed",
      as_of: "2026-07-17T00:00:00.000Z",
      assists: [],
    };
    // Completed but not yet contributed → an explicit consent-to-share affordance is offered.
    const before = renderToStaticMarkup(
      <CreationBody
        creation={base}
        draft={base.draft}
        onDraft={() => {}}
        onAssist={() => {}}
        onComplete={() => {}}
        onContribute={() => {}}
        onRevoke={() => {}}
        busy={null}
      />,
    );
    expect(before).toContain("consent to share as a source");
    expect(before).toContain("knowledge commons");

    // Once contributed, the recursion is shown — and the No-Ghostwriter framing is reaffirmed.
    const after = renderToStaticMarkup(
      <CreationBody
        creation={{ ...base, contributed_as: "sv-42" }}
        draft={base.draft}
        onDraft={() => {}}
        onAssist={() => {}}
        onComplete={() => {}}
        onContribute={() => {}}
        onRevoke={() => {}}
        busy={null}
      />,
    );
    expect(after).toContain("Contributed as a Cognitive Source");
    expect(after).toContain("Only your words became the source");
    expect(after).not.toContain("consent to share as a source");
    // ADR-0054 — sovereignty: once contributed, the author can take it back (revoke + redact).
    expect(after).toContain("take it back");
    expect(after).toContain("creation-revoke-btn");
  });

  // CSE M12 T1 — deep-transparency: the source plane's reasoning made visible, honestly (degradation
  // surfaced, provenance on every line, real D3 model-call count).
  test("CSE M12: the source cognition panel surfaces activity, layer health, and a provenance feed", () => {
    const cognition: SourceCognitionView = {
      activity: {
        versions_registered: 2,
        layers_constructed: 5,
        layers_degraded: 1,
        claims_recorded: 4,
        contradictions_detected: 1,
        fusions_composed: 1,
        syntheses: 1,
        frontier_updates: 1,
        timeline_updates: 0,
        creations_started: 1,
        creation_assists: 2,
        creations_completed: 1,
        creations_contributed: 0,
        consents_granted: 1,
        consents_revoked: 0,
        redactions: 0,
      },
      layers: [
        { version_id: "v1", layer: "semantic", confidence: 0.82, degraded: false },
        { version_id: "v1", layer: "citation", confidence: 0.4, degraded: true },
      ],
      model_invocations: 6,
      degraded_count: 1,
      total_events: 18,
      cache: {
        hits: 3,
        misses: 1,
        hit_rate: 0.75,
        by_kind: { fusion: { hits: 2, misses: 1 }, frontier: { hits: 1, misses: 0 } },
      },
      recent: [
        {
          event_type: "source.fusion.synthesized",
          at: "hlc-0009",
          producer_cid: "cog-source-fusion",
          summary: 'wove a fused explanation of "gradient-descent"',
          confidence: null,
          degraded: false,
        },
        {
          event_type: "source.layer.degraded",
          at: "hlc-0004",
          producer_cid: "cog-source-hub",
          summary: "degraded the citation layer — below floor",
          confidence: 0.4,
          degraded: true,
        },
      ],
    };
    const html = renderToStaticMarkup(<SourceCognitionBody cognition={cognition} />);
    // Activity + the D3 model-call count are surfaced honestly.
    expect(html).toContain("6 model calls (D3)");
    expect(html).toContain("Claims");
    // Layer health shows confidence and marks honest degradation (never hidden).
    expect(html).toContain("citation");
    expect(html).toContain('data-degraded="true"');
    expect(html).toContain("degraded");
    // The reasoning feed is provenance-bearing.
    expect(html).toContain("cog-source-fusion");
    expect(html).toContain("wove a fused explanation");
    // M12 T2 — the cache hit rate is surfaced (memoized cognition, replay-identical).
    expect(html).toContain("3 hits / 1 misses");
    expect(html).toContain("75% hit rate");
  });

  // ADR-0053 — the knowledge commons: peers' contributed creations, attributed, with an attach action.
  test("the commons lists attributed contributed creations with an attach affordance", () => {
    const entries: CommonsEntryView[] = [
      {
        source_version_id: "sv-1",
        creation_id: "crt-1",
        title: "Why the learning rate matters",
        kind: "essay",
        author_cid: "learner-ada",
        concept_refs: ["gradient-descent", "learning-rate"],
        content_hash: "abc123",
        contributed_at: "2026-07-18T00:00:00.000Z",
      },
    ];
    const available = renderToStaticMarkup(
      <CommonsBody entries={entries} attached={new Set()} attaching={null} onAttach={() => {}} />,
    );
    // The entry is attributed to its author and shows its kind + concepts (honest provenance).
    expect(available).toContain("Why the learning rate matters");
    expect(available).toContain("by learner-ada");
    expect(available).toContain("gradient-descent");
    // Before attaching, the affordance invites reuse.
    expect(available).toContain("Attach to my surface");

    // Once attached, the state reflects it (idempotent — no double-attach).
    const attachedHtml = renderToStaticMarkup(
      <CommonsBody
        entries={entries}
        attached={new Set(["sv-1"])}
        attaching={null}
        onAttach={() => {}}
      />,
    );
    expect(attachedHtml).toContain("✓ Attached");
    expect(attachedHtml).not.toContain("Attach to my surface");
  });
});
