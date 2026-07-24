# ADR-0062: Source-first Cognitive Surface (topic-optional entry + source-driven teaching)

**Status:** Accepted
**Date:** 2026-07-24
**Related:** the approved design `docs/superpowers/specs/2026-07-24-source-first-cognitive-surface-design.md`,
ADR-0056 (Source Dock), ADR-0057 (R2 source-anchored teaching + `teachSource`), ADR-0060
(fusion→frames), CSE-008/017. Product law under `spec/product/` (F16 Cognitive Surface).

## Context

The web front door required a topic and started goal-mode teaching immediately; an uploaded document
landed as a side attachment while the lesson ignored it — two unsynchronized tracks. The whole
source-anchored substrate (R2a–e, `teachSource`, source-as-stage, fusion→frames) existed but was
orphaned from the actual experience (the web never called `teachSource`; source-as-stage never
engaged because teaching was never source-anchored). Real-usage feedback: let learners enter without a
topic, upload sources, and learn *from* the sources — synchronized, agent-navigated.

## Decision

Make entry **source-first and topic-optional**, and make the source **drive teaching** (Phase 1 of
the design). Teaching is **topic-adaptive**: source(s) with no topic → `teachSource` (the document is
the timeline); topic + source(s) → `ask` composed from the source (already source-anchored via R2a
once attached before the ask); topic only → unchanged goal-mode. Entry uploads are **implicitly
consented** and auto-attached; **mid-session uploads require consent** ("Use this document" attaches
it into the ongoing lesson; "Teach this source" rebuilds the lesson from it) — a mid-session source
never silently hijacks teaching. Entry first **analyzes the sources** (canonicalization narrative)
before teaching. No new events: consent reuses `surface.source.attached`; the substrate is reused,
not rebuilt. Live real-page document rendering (D) and multi-document cross-understanding (E) are the
same design's later phases.

## Rejected alternatives

- **Keep topic-first; treat sources as a side panel.** The status quo — it produced the unsynchronized
  two-track experience the feedback rejected.
- **Auto-use every uploaded source.** Rejected — a mid-session upload must not silently redirect the
  lesson; consent is the learner's, per document (CSE-002 §8 sovereignty in spirit).
- **A first-class server-side consent/pause flag now.** Deferred — attach *is* the consent signal for
  the opt-in the learner asked for; a pausable in-use toggle is a later refinement.
- **Rebuild the cognition for source teaching.** Unnecessary — the source-anchored substrate already
  exists; the gap was wiring it to the front door.

## Deferred

- Phase 2 (D): render the actual document (real PDF pages) with auto-navigation + in-sync highlight.
- Phase 3 (E): multi-document cross-understanding + compare/navigate UX.
- A pausable consent state ("stop using" without detaching); an educator/cohort source flow.
