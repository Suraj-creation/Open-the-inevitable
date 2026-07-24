/**
 * EpisodesPanel (R5, ADR-0061) — the session's learning arc, made visible. Verifies each episode
 * shows its title, pedagogical arc, and mastery outcome; that the voiced episode is marked current;
 * and that it degrades to an honest "no episodes yet" note. Pure projection over folded state.
 */
import { describe, expect, test } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { SurfaceState } from "@inevitable/surface/client";
import { EpisodesPanel } from "../src/components/EpisodesPanel";

function frame(
  frame_id: string,
  concept_id: string,
  ordinal: number,
  kind: string,
  coreText: string | null = null,
) {
  return {
    frame_id,
    surface_id: "srf",
    ordinal,
    status: "composed",
    kind,
    concept_id,
    title: frame_id,
    layout: null,
    mccr: coreText ? { core_concept: { content: { kind: "text", text: coreText } } } : null,
    segment_ids: [],
  };
}

function makeState(
  frames: unknown[],
  nodes: { concept_id: string; title: string; status: string; confidence: number | null }[] = [],
): SurfaceState {
  return {
    frames,
    timeline: nodes.length > 0 ? { nodes } : null,
  } as unknown as SurfaceState;
}

describe("EpisodesPanel (ADR-0061)", () => {
  test("renders each episode's title, arc, and mastery outcome", () => {
    const state = makeState(
      [
        frame("cfr-1", "entropy", 1000, "teach", "Entropy"),
        frame("cfr-2", "entropy", 1100, "practice"),
        frame("cfr-3", "gibbs", 1200, "teach", "Gibbs free energy"),
      ],
      [{ concept_id: "entropy", title: "Entropy", status: "mastered", confidence: 0.9 }],
    );
    const html = renderToStaticMarkup(<EpisodesPanel state={state} activeFrameId="cfr-3" />);
    expect(html).toContain("Entropy");
    expect(html).toContain("Gibbs free energy");
    expect(html).toContain("taught → practiced"); // the arc, human-labeled
    expect(html).toContain("mastered · 90%");
    expect(html).toContain("in progress");
    // The episode containing the voiced frame (cfr-3 = gibbs) is the current one.
    expect(html).toContain('data-current="true"');
  });

  test("degrades to an honest note when there are no episodes yet", () => {
    const html = renderToStaticMarkup(<EpisodesPanel state={makeState([])} />);
    expect(html).toContain("episodes-empty");
    expect(html).toContain("No episodes yet");
  });
});
