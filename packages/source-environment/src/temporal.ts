/**
 * The Temporal Knowledge Model (CSE M9 TKM T1; CSE-006 §3.3, ADR-0044).
 *
 * Per concept, an ordered series of epistemic states — origin → milestones → shifts → current
 * debate → open problems — that turns a concept from a static definition into a trajectory through
 * time. Every state is grounded in a real, citable origin (no citable origin, no state — CSE-006
 * §4/§6), and timelines are HONESTLY SPARSE: a new or niche concept shows a short strip, never a
 * padded fiction (CSE-006 §8).
 *
 * Pure types; the grounded production (model + web) lives in the TemporalResearchUnit. Reuses the
 * FrontierExternalRef citation type (the same real, fetchable-origin contract).
 */
import type { FrontierExternalRef } from "./frontier";

/** The five phases of a concept's trajectory through time (CSE-006 §3.3). */
export const EPISTEMIC_STATE_KINDS = [
  "origin",
  "milestone",
  "shift",
  "current-debate",
  "open-problem",
] as const;

export type EpistemicStateKind = (typeof EPISTEMIC_STATE_KINDS)[number];

export function isEpistemicStateKind(value: string): value is EpistemicStateKind {
  return (EPISTEMIC_STATE_KINDS as readonly string[]).includes(value);
}

/** One point on a concept's timeline, grounded in ≥1 real citation. */
export interface EpistemicState {
  readonly kind: EpistemicStateKind;
  /** A short title, e.g. "Backpropagation popularized". */
  readonly label: string;
  /** One grounded sentence — what the sources say, never invented history. */
  readonly summary: string;
  /** A year or decade ("1986", "2010s") — null when unknown; NEVER fabricated (CSE-006 §8). */
  readonly era: string | null;
  /** Real citations backing this state (≥1 required; the grounding law drops states with none). */
  readonly external_refs: readonly FrontierExternalRef[];
  readonly as_of: string;
}

/**
 * A concept's temporal knowledge model — its states in chronological order. `degraded` marks an
 * honest absence (no model / no web / nothing citable found), never a fabricated history; a sparse
 * timeline (few states) is honest, not degraded.
 */
export interface ConceptTimeline {
  readonly timeline_id: string;
  readonly concept_ref: string;
  readonly source_version_id: string | null;
  readonly states: readonly EpistemicState[];
  readonly as_of: string;
  readonly degraded: boolean;
}
