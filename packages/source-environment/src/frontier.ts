/**
 * The Frontier Overlay (CSE M9 Frontier T1; CSE-006 §3.2, ADR-0043).
 *
 * A typed link set from a concept (in a source's context) to living knowledge — latest research,
 * open questions, competing theories, future directions. The source stays sacred; the frontier is
 * an overlay that renders in its own reserved provenance channel and NEVER edits or annotates over
 * evidence (CSE-006 §2). Every entry is grounded in a real, citable external origin — no frontier
 * entry exists without one (CSE-006 §4/§6); an overlay with no grounded entry is honestly empty.
 *
 * These are pure types; the grounded production (model + web) lives in the FrontierResearchUnit.
 */

/** The seven kinds of living-knowledge link a concept carries (CSE-006 §3.2). */
export const FRONTIER_ENTRY_KINDS = [
  "latest-research",
  "practice",
  "alternative-explanation",
  "open-question",
  "competing-theory",
  "interdisciplinary",
  "future-direction",
] as const;

export type FrontierEntryKind = (typeof FRONTIER_ENTRY_KINDS)[number];

export function isFrontierEntryKind(value: string): value is FrontierEntryKind {
  return (FRONTIER_ENTRY_KINDS as readonly string[]).includes(value);
}

/** A real, fetchable citation — the grounding origin of a frontier entry (never invented). */
export interface FrontierExternalRef {
  readonly uri: string;
  readonly title: string;
}

/** One typed frontier link from a concept to the living edge, grounded in ≥1 external ref. */
export interface FrontierEntry {
  readonly kind: FrontierEntryKind;
  /** A short summary of the frontier point — inference over the cited sources, never their words. */
  readonly summary: string;
  /** Real citations backing this entry (≥1 required; the grounding law drops entries with none). */
  readonly external_refs: readonly FrontierExternalRef[];
  /** When this entry was researched (HLC/ISO) — overlays are time-versioned (CSE-006 §4). */
  readonly as_of: string;
}

/**
 * A concept's living-knowledge overlay. `source_version_id` is the context source (null for a
 * concept researched outside any one source). `degraded` marks an honest staleness/absence
 * (fetch denied, budget exhausted, or no model — CSE-006 §6), never a fabricated frontier.
 */
export interface FrontierOverlay {
  readonly overlay_id: string;
  readonly concept_ref: string;
  readonly source_version_id: string | null;
  readonly entries: readonly FrontierEntry[];
  readonly as_of: string;
  readonly degraded: boolean;
}
