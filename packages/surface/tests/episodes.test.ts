/**
 * In-session episodes (R5, ADR-0061) — `deriveEpisodes` is a pure projection over folded state: it
 * groups the surfaced frames by concept in first-appearance order, records the pedagogical arc, and
 * reads mastery status/confidence from the timeline. `currentEpisode` is the resume anchor.
 */
import { describe, expect, test } from "vitest";
import { currentEpisode, deriveEpisodes } from "../src/episodes";
import type { SurfaceState } from "../src/projection";

function frame(
  frame_id: string,
  concept_id: string | null,
  ordinal: number,
  kind: string,
  status = "composed",
  coreText: string | null = null,
) {
  return {
    frame_id,
    surface_id: "srf",
    ordinal,
    status,
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

describe("deriveEpisodes (ADR-0061)", () => {
  test("groups surfaced frames by concept (first-appearance order) with the pedagogical arc", () => {
    const state = makeState([
      frame("cfr-1", "entropy", 1000, "teach", "composed", "Entropy"),
      frame("cfr-2", "entropy", 1100, "teach", "composed"),
      frame("cfr-3", "entropy", 1200, "practice", "promoted"),
      frame("cfr-4", "gibbs", 1300, "teach", "composed", "Gibbs free energy"),
    ]);
    const episodes = deriveEpisodes(state);
    expect(episodes.map((e) => e.concept_id)).toEqual(["entropy", "gibbs"]);
    const entropy = episodes[0]!;
    expect(entropy.title).toBe("Entropy");
    expect(entropy.frame_ids).toEqual(["cfr-1", "cfr-2", "cfr-3"]);
    expect(entropy.arc).toEqual(["teach", "practice"]); // distinct kinds, in order
    expect(entropy.started_ordinal).toBe(1000);
    expect(entropy.ended_ordinal).toBe(1200);
    expect(entropy.status).toBe("in_progress"); // no timeline node ⇒ not mastered
  });

  test("skips non-surfaced frames and frames with no concept", () => {
    const state = makeState([
      frame("cfr-1", "entropy", 1000, "teach", "composed"),
      frame("cfr-2", "entropy", 1100, "teach", "planned"), // not surfaced
      frame("cfr-3", "entropy", 1150, "teach", "speculative"), // not surfaced
      frame("cfr-4", null, 1200, "teach", "composed"), // no concept
    ]);
    const episodes = deriveEpisodes(state);
    expect(episodes).toHaveLength(1);
    expect(episodes[0]!.frame_ids).toEqual(["cfr-1"]);
  });

  test("reads mastery status + confidence from the timeline node", () => {
    const state = makeState(
      [frame("cfr-1", "entropy", 1000, "teach", "composed")],
      [{ concept_id: "entropy", title: "Entropy", status: "mastered", confidence: 0.88 }],
    );
    const ep = deriveEpisodes(state)[0]!;
    expect(ep.status).toBe("mastered");
    expect(ep.confidence).toBe(0.88);
    expect(ep.title).toBe("Entropy"); // timeline title wins
  });

  test("currentEpisode is the most recent arc; empty state yields none", () => {
    expect(deriveEpisodes(null)).toEqual([]);
    expect(currentEpisode([])).toBeNull();
    const state = makeState([
      frame("cfr-1", "entropy", 1000, "teach", "composed"),
      frame("cfr-2", "gibbs", 2000, "teach", "composed"),
    ]);
    const episodes = deriveEpisodes(state);
    expect(currentEpisode(episodes)?.concept_id).toBe("gibbs");
  });
});
