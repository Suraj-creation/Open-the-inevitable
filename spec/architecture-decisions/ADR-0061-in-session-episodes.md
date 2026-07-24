# ADR-0061: In-session episodes (episodic session structure)

**Status:** Accepted
**Date:** 2026-07-24
**Related:** ADR-0007 (projections own no truth), ADR-0030 (Frames), ADR-0055 (typed frame kind),
SRF-003 (timeline), the CSE production-readiness audit R5 (compounding).

## Context

A session's cognition unfolds as a stream of frames across concepts, but there is no first-class
notion of an **episode** — a bounded learning arc (a concept introduced → taught → practiced →
mastered). The learner can't see the shape of what they did this session, and there's no anchor for
"resume where you left off." The timeline exists, but it is the concept *graph* (prerequisite
structure), not the *temporal* arc of the session.

## Decision

In-session episodes are a **pure projection** over the folded `SurfaceState` (ADR-0007 — owns no
truth, emits no events). `deriveEpisodes(state)` groups the *surfaced* frames (`composed`/`promoted`)
by `concept_id` in first-appearance order; each episode carries its frame span (ids + start/end
ordinal), the pedagogical arc it went through (the distinct frame `kind`s — teach/practice/
assessment/checkpoint), and its mastery `status` + `confidence` read from the timeline node. Because
it is a function of already-canonical frames + timeline, it is replay-safe and adds no state. Surfaced
read-only in the Observatory; the most recent episode is the resume anchor (`currentEpisode`).

## Rejected alternatives

- **Emitting `surface.episode.opened/closed` events.** Premature — in-session episodes need no new
  canonical state; a derivation is exact and replay-safe. Event-bearing episodes belong to the later
  *cross-session episodic memory* milestone (persist + recall across sessions), not here.
- **Grouping by the timeline's prerequisite structure.** That is the concept graph; an episode is the
  temporal teaching arc, which is the frame stream's order, not the dependency order.

## Deferred

- Cross-session episodic memory — persisting episodes into the long-term store and recalling them in
  a later session ("last week you learned X").
- Jump-to-episode navigation (scrub the choreographer to an episode's first segment) and
  episode-level narrative summaries.
