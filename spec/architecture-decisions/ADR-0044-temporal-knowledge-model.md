# ADR-0044: The Temporal Knowledge Model via Web-Grounded Temporal Research (M9 TKM T1)

**Status:** Accepted
**Date:** 2026-07-16
**Related:** CSE-006 §3.3 (the Temporal Knowledge Model), CSE-006 §8 (sparse timelines are honest),
ADR-0043 (Frontier T1 — the web-grounding capability + grounding law this reuses), ADR-0041 (the
Claim Graph — supersession edges a later tier folds in), CSE-004 (the Temporal transformation),
CSE-009 §3 (the Cognitive Time Machine's Concept Timeline — the downstream view), blueprint M9

## Context

CSE-006 defines three living-knowledge structures. Two are built: the **Claim Graph** (ADR-0041)
and the **Frontier Overlay** (ADR-0043). The third is the **Temporal Knowledge Model** (§3.3): per
concept, an ordered series of **epistemic states** — origin → milestones → shifts → current debate →
open problems — that turns a concept from a static definition into a trajectory through time. It
powers the Cognitive Time Machine's Concept Timeline (CSE-009 §3) and the Temporal transformation
(CSE-004).

CSE-006 §3.3 says the model is "built from citation lineage (layer 6), claim supersession edges, and
frontier entries." At the gateway those historical inputs are thin — L6 citation canonicalization
and claim `supersedes` edges are not yet populated there (deferred with the model-backed
canonicalization cutover). But Frontier T1 just proved a governed, honest way to reach real
historical facts: **web grounding with real citations**. The same seam gives the timeline real
origin dates, key papers, and paradigm shifts — each backed by a fetchable source.

The governing law is CSE-006 §8: **sparse timelines are honest**. A new or niche concept shows a
short strip, never a padded fiction. Combined with the ADR-0043 grounding law (no state without a
citable origin), the timeline is only ever as long as its real, grounded evidence.

## Decisions

### 1. TKM T1 is web-grounded temporal research producing a grounded Concept Timeline

A `TemporalResearchUnit` (privileged `temporal` agent — it reaches outside the learner's sources)
researches a concept's development over time via the ADR-0043 `webSearch` capability and produces a
**`ConceptTimeline`**: an ordered series of `EpistemicState`s, each with a `kind` (origin | milestone
| shift | current-debate | open-problem), a short `label` + `summary`, an optional `era` (a year or
decade — **null when unknown, never invented**), and **≥1 real `external_refs`**. The grounding law
is enforced at the parser: **a state with no real citation is dropped**; an empty timeline is honest,
never fabricated. The model call is D3-recorded (with its citations), so replay shows the timeline as
it was then. States are ordered chronologically by parseable era, preserving the model's order as the
stable tiebreak.

### 2. It is a distinct structure + agent, parallel to Frontier — not a Frontier mode

The Frontier Overlay is the *present/future edge* (unordered typed entries); the Temporal Model is
the *past → present trajectory* (an ordered timeline with eras). Different output shape, different
purpose — so a separate `temporal` agent + unit + `source.timeline.updated` event, reusing the
web-grounding adapter capability and the `FrontierExternalRef` citation type. Together they give a
concept both axes: where it came from and where it is going.

### 3. On demand, in the reserved research channel, honestly sparse

`SourceHub.researchTimeline(conceptRef, versionId?)` runs the unit on demand (like `fuse` /
`researchFrontier` — progressive + attention-driven), builds + caches the timeline, and emits
`source.timeline.updated`. `POST /api/surface/:id/timeline { concept_ref }`. The web renders the
states as a vertical strip in the reserved research channel (the source stays sacred). **Absent a
model the route returns an honest-empty timeline**; a thin strip for a niche concept is shown as-is,
never padded.

## Consequences

- A concept becomes a trajectory the learner can walk: how the idea began, the milestones and
  paradigm shifts that shaped it, and where the debate stands now — each step grounded in a real
  source. CSE-006's living-knowledge trio is complete.
- Reuses the ADR-0043 web-grounding capability and citation type — one new agent, one new event, no
  new adapter work.
- The Concept Timeline UI (CSE-009 §3) and the Temporal transformation (CSE-004) now have their data
  substrate.

## Deferred (named scope)

- **Assembly from existing structures** (CSE-006 §3.3 as-written): folding L6 citation lineage +
  claim `supersedes` edges + already-researched frontier entries into the timeline once those are
  populated at the gateway (the model-backed canonicalization cutover). T1 researches the timeline
  directly; the assembly enrichment is the next tier.
- **The Cognitive Time Machine** (CSE-009 §3) — the full scrub-through-time interface — and the
  **Temporal transformation** (CSE-004). T1 lands the data + a static strip.
- **Per-era precise citation attribution** (groundingSupports span mapping, as in ADR-0043) — T1
  attaches the grounded citation pool per state (capped).
- **Curated seed timelines for pre-digital foundational concepts** (CSE-006 §8 open question — where
  citation lineage thins before ~1990).

## Rejected

- **A model-recall timeline without web grounding**: a fabricated date or paper is worse than a short
  timeline (CSE-006 §4/§6/§8). Every state is backed by a real citation or dropped.
- **Padding a sparse timeline** to look complete: forbidden by CSE-006 §8 — a niche concept honestly
  shows a short strip.
- **A `frontier`-agent mode for the timeline**: the ordered-trajectory output differs enough from the
  present-edge entries that a shared mode would blur both; a distinct agent keeps each legible.
- **Eager whole-corpus timeline building**: progressive + attention-driven — research the concept the
  learner is exploring, on request.
