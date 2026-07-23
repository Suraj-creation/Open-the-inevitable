/**
 * CSE M6 — the Understanding Map (CSE-005 §3.4, ADR-0037). The pure projection renders EVIDENCE,
 * never a score: episodes, mastery movements, confusions, and blind spots (path concepts never
 * engaged). Tested without a network — the fetch container is a thin wrapper over this view.
 */
import { describe, expect, test } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { SurfaceState, TimelineProjection } from "@inevitable/surface/client";
import { UnderstandingMapView, type UnderstandingData } from "../src/components/UnderstandingMap";

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
      concept_id: "backprop",
      node_id: "n-bp",
      title: "Backpropagation",
      order: 1,
      prerequisites: ["linear-algebra"],
      layer: 1,
      status: "available",
      confidence: null,
      milestone: true,
      mastery_target: { min_confidence: 0.6 },
    },
  ],
  edges: [],
};

const state = { timeline } as unknown as SurfaceState;

const data: UnderstandingData = {
  episodes: [
    {
      artifact_id: "ia-ep-1",
      concept_refs: ["linear-algebra"],
      outcome: { summary: "1 concept, 3 contributions, 1 gate pass" },
    },
  ],
  deltas: [
    {
      artifact_id: "ia-d-1",
      concepts_touched: ["linear-algebra"],
      mastery_movements: [{ concept_ref: "linear-algebra", direction: "advanced" }],
      confusions_opened: [],
      confusions_resolved: ["linear-algebra"],
    },
  ],
};

describe("UnderstandingMapView (evidence, never a score)", () => {
  test("renders episodes, movements, and confusion counts from the intelligence plane", () => {
    const html = renderToStaticMarkup(<UnderstandingMapView data={data} state={state} />);
    expect(html).toContain("Episodes");
    expect(html).toContain("1 concept, 3 contributions");
    expect(html).toContain("linear-algebra");
    expect(html).toContain("1</strong> mastery advance"); // movement surfaced
    expect(html).toContain("1</strong> confusion"); // resolved count
  });

  test("surfaces blind spots — path concepts never engaged in any episode", () => {
    const html = renderToStaticMarkup(<UnderstandingMapView data={data} state={state} />);
    // linear-algebra was touched; backprop is on the path but never engaged → a blind spot.
    expect(html).toContain("Blind spots");
    expect(html).toContain("Backpropagation");
    expect(html).not.toContain('umap-chip--blind">Linear Algebra');
  });

  test("a learner with no episodes shows honest emptiness, never a fabricated map", () => {
    const empty: UnderstandingData = { episodes: [], deltas: [] };
    const html = renderToStaticMarkup(<UnderstandingMapView data={empty} state={state} />);
    expect(html).toContain("No episodes yet");
  });
});
