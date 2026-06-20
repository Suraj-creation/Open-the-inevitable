import { describe, expect, test } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type {
  CognitionBlock,
  CognitionBlockType,
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
  completed: false,
  version: 1,
  nodes: [
    {
      concept_id: "linear-algebra",
      node_id: "n-la",
      title: "Linear Algebra",
      order: 0,
      prerequisites: [],
      status: "mastered",
      milestone: false,
      mastery_target: { min_confidence: 0.6 },
    },
    {
      concept_id: "neural-networks",
      node_id: "n-nn",
      title: "Neural Networks",
      order: 1,
      prerequisites: ["linear-algebra"],
      status: "locked",
      milestone: true,
      mastery_target: { min_confidence: 0.6 },
    },
  ],
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
  disagreements: [],
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
});
