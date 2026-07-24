/**
 * In-session episodes (R5, ADR-0061) — the temporal learning arc of a session, as a PURE projection.
 *
 * An episode is a bounded arc of cognition for one concept: the surfaced frames the learner actually
 * saw (`composed`/`promoted`), in the order they appeared, with the pedagogical roles they moved
 * through (teach → practice → assessment → checkpoint) and the mastery outcome read from the
 * timeline. This is a function of already-canonical state (frames + timeline) — it emits no events
 * and owns no truth (ADR-0007), so it is exactly replay-safe. The timeline is the concept *graph*;
 * episodes are the session's *temporal* arc.
 */
import type { FrameKind } from "./frames";
import type { SurfaceState } from "./projection";

export interface Episode {
  /** Stable within a session (one episode per concept arc) — `ep-` + concept id. */
  readonly episode_id: string;
  readonly concept_id: string;
  /** The concept's title — from the timeline node, else the frame's core concept, else its title. */
  readonly title: string;
  /** The surfaced frames in this arc, in ordinal order. */
  readonly frame_ids: readonly string[];
  /** The distinct pedagogical roles this arc moved through, in first-appearance order. */
  readonly arc: readonly FrameKind[];
  /** Mastery outcome, read from the timeline node (not re-derived here). */
  readonly status: "in_progress" | "mastered";
  /** Mastery confidence (0..1) when a checkpoint exists for the concept, else null. */
  readonly confidence: number | null;
  readonly started_ordinal: number;
  readonly ended_ordinal: number;
}

/** A frame the learner actually saw — planned-only/speculative/invalidated frames are not episodes. */
function isSurfaced(status: string): boolean {
  return status === "composed" || status === "promoted";
}

/**
 * Derive the session's episodes from folded state (ADR-0061). Groups surfaced frames by concept in
 * first-appearance order; each episode's status/confidence come from the timeline node. Frames with
 * no concept are skipped (an episode is a concept arc). Deterministic given the state.
 */
export function deriveEpisodes(state: SurfaceState | null): Episode[] {
  if (!state) return [];
  const timelineByConcept = new Map(
    (state.timeline?.nodes ?? []).map((n) => [n.concept_id, n] as const),
  );
  const order: string[] = []; // concept ids in first-appearance order
  const byConcept = new Map<
    string,
    { frames: { id: string; ordinal: number; kind: FrameKind; coreTitle: string | null }[] }
  >();
  const surfaced = [...state.frames].filter((f) => isSurfaced(f.status) && f.concept_id);
  surfaced.sort((a, b) => a.ordinal - b.ordinal);
  for (const frame of surfaced) {
    const conceptId = frame.concept_id!;
    let bucket = byConcept.get(conceptId);
    if (!bucket) {
      bucket = { frames: [] };
      byConcept.set(conceptId, bucket);
      order.push(conceptId);
    }
    const core = frame.mccr?.core_concept?.content;
    bucket.frames.push({
      id: frame.frame_id,
      ordinal: frame.ordinal,
      kind: frame.kind,
      coreTitle: core && core.kind === "text" ? core.text : null,
    });
  }
  return order.map((conceptId) => {
    const frames = byConcept.get(conceptId)!.frames;
    const node = timelineByConcept.get(conceptId);
    const arc: FrameKind[] = [];
    for (const f of frames) if (!arc.includes(f.kind)) arc.push(f.kind);
    const title = node?.title || frames.find((f) => f.coreTitle)?.coreTitle || conceptId;
    return {
      episode_id: `ep-${conceptId}`,
      concept_id: conceptId,
      title,
      frame_ids: frames.map((f) => f.id),
      arc,
      status: node?.status === "mastered" ? "mastered" : "in_progress",
      confidence: node?.confidence ?? null,
      started_ordinal: frames[0]!.ordinal,
      ended_ordinal: frames[frames.length - 1]!.ordinal,
    };
  });
}

/** The resume anchor: the most recent episode (highest ending ordinal), or null when none. */
export function currentEpisode(episodes: readonly Episode[]): Episode | null {
  if (episodes.length === 0) return null;
  return episodes.reduce((latest, e) => (e.ended_ordinal >= latest.ended_ordinal ? e : latest));
}
