# Source-First Cognitive Surface — Design

**Date:** 2026-07-24
**Status:** Approved (brainstorm) — pending implementation plan
**Owning specs:** CSE-008 (source-anchored teaching), CSE-011/012/013 (Director/Scene/Cinematography),
CSE-017 (Source Dock), ADR-0056/0057/0060. This design is the front-door reorientation the CSE
production-readiness audit implied but never wired.

## Problem (from real usage)

Entering the Cognitive Surface **requires a topic**, and teaching begins in goal-mode immediately.
Uploading a document lands as a *side attachment* while the goal-mode lesson keeps running — the two
are unsynchronized parallel tracks, and the lesson never actually teaches *from* the document. The
whole source-anchored substrate exists in the runtime (R2a source excerpts into composing, R2c
`teachSource` "the document is the timeline", R2d semantic highlight sync, R2e source-as-stage,
fusion→frames, the RIA) but **is orphaned from the actual web experience**: the front door is
topic-first, the web never calls `teachSource`, and source-as-stage never engages because teaching is
never source-anchored.

Confirmed in code: `apps/web/src/App.tsx` blocks entry without a topic and fires `ask {goal}` on
enter; the Source Dock only appears *after* entry and auto-attaches (`SourceDock.tsx:145`); no web
caller of `teachSource`; `sourceMode` (source-as-stage) only turns on once `viewport_plans` exist,
which only happens under source-anchored teaching, which is never triggered.

## Goal

A learner enters immediately, optionally without a topic, uploads one or more sources, and **learns
from the sources themselves**. When teaching references a concept/paragraph/figure/equation/page, the
agent navigates to that location in the source, renders the relevant region, highlights it, and
synchronizes narration with the source in real time. It should feel like an expert researcher walking
you through the material — not a chatbot answer beside an ignored PDF.

## Non-goals (this phase)

- Not rebuilding the cognition (composer/Director/RIA are reused as-is).
- Phase 1 does **not** render real PDF page images — it uses the existing quote/region source
  viewport; real page rendering is Phase 2 (D).
- Cross-document *navigation/compare* UX is Phase 3 (E); fusion→frames already supplies cross-source
  synthesis under the hood.

## Decisions (locked in brainstorm)

1. **Scope:** flow reorientation first (A topic-optional entry + B source drives teaching + C
   consent), then D live page rendering, then E multi-doc — one spec, phased build.
2. **Teaching mode = topic-adaptive:** no topic + source → teach the source (document is the
   timeline); topic + source → teach the topic composed from the source; mid-session upload → consent
   → re-anchor from the next frame + a "Teach this source" restart.
3. **Approach = reuse + rewire, with a visible "analyzing your sources" phase.** Consent = attach for
   now (a first-class consent/pause toggle is a later refinement).

## Phase 1 design — A + B + C + analyze

### A. Entry reorientation (`apps/web/src/App.tsx`, enter card)

- The enter card gains a **source affordance beside a now-optional topic field**, reusing the Source
  Dock helpers (`inferModality`, upload/drag-drop/paste/URL; honest refusal before upload).
- "Enter" is enabled when there is **either** a non-empty topic **or** ≥1 staged source. (Neither →
  disabled with a hint.)
- Submit branches:
  - **topic only** → `enterSurface(topic, mode)` → `ask {topic}` (unchanged).
  - **source(s) only** → register each → `enterSurface(derivedGoal, mode)` → attach each →
    `teachSource(surfaceId)`. `derivedGoal` = `Learn from "<primary source title>"` (cosmetic; the
    timeline comes from the document).
  - **topic + source(s)** → register → `enterSurface(topic, mode)` → attach → `ask {topic}` (already
    source-anchored via R2a because sources are attached before the ask).

### The "Understanding your sources…" phase

- After registration and before teaching begins, a transient entry state surfaces the
  canonicalization summary already produced at registration (`describeLayers`: which layers were
  built, structural sections/figures grasped, degraded layers named honestly). Keyed off registration
  completion; no new server work. This makes "deep-analyze first, then build the environment" visible.

### B. Source drives teaching

- Add web client `teachSource(surfaceId)` → `POST /api/surface/:id/teach-source` (route exists, R2c).
- Because attach happens **before** the ask/teach, the existing substrate now runs for real:
  source-anchored composing (R2a), typed semantic highlight + entailment-gated sync (R2d), and
  source-as-stage (R2e, `sourceMode` engages once `viewport_plans` exist). The document region renders
  and the discussed lines highlight in sync with narration.
- **Mid-session:** once a source is consented (attached), subsequent `ask`s are source-anchored
  automatically; a **"Teach this source"** control calls `teachSource` to restart the timeline from
  the document.

### C. Consent (opt-in to use a document)

- **Entry uploads auto-attach** (implicit consent — the learner chose to learn from them).
- **Mid-session Dock uploads register but no longer auto-attach.** Each pending source shows a
  **"Use this document"** action; tapping it performs the attach (= the consent signal), after which
  teaching weaves it in. This is the only behavioral change to `SourceDock` (split register from
  attach; entry path attaches immediately, mid-session path attaches on consent).
- "Stop using" (detach) is a small follow-on, not required for the opt-in the learner asked for.

### Data flow / API

- **Web:** `teachSource(surfaceId)` added to `api.ts`; `enterSurface` accepts an optional/derived
  goal; `registerSource`/`attachSource` reused; the enter card stages sources client-side before
  create.
- **Server:** no new events — consent reuses `surface.source.attached`; the create route already
  tolerates a missing goal (defaults it). Everything stays event-sourced and replay-safe (ADR-0007).

### Failure modes

- Source registration fails at entry → surfaced error + topic-only fallback (never a dead-end).
- `teachSource` finds no usable structure → fall back to goal-mode teaching with an honest note.
- Consent withheld → the source stays unattached; teaching is unaffected (honest absence).

### Testing

- Web: entry source-only → `teachSource` fired (not `ask`); topic+source → attach-then-`ask`;
  topic-only → unchanged; mid-session upload → **not** attached until "Use this document"; consent tap
  → attach; "Teach this source" → `teachSource`. Enter-enabled logic (topic OR source).
- Gateway: goal-less create tolerated; `teach-source` E2E already covered (`teach-source.test.ts`).
- `pnpm verify` stays green.

## Phase 2 (D) — live document rendering (fast-follow, same spec)

Upgrade the source viewport from a text quote to the **actual document**: render real PDF pages
(pdf.js or extracted page images via the visual/L3 layer), auto-navigate to the region being
discussed, and highlight the exact lines/bbox in sync with narration. Requires: a document-viewer
component, a page/region → viewport binding off the existing `source_viewport`/`viewport_plans`, and
the PDF visual layer (page geometry already modeled in canonicalization L3). Design detail deferred to
the Phase-2 plan.

## Phase 3 (E) — multi-document cross-understanding (fast-follow, same spec)

Deep-analyze all attached sources, build cross-document understanding, and let the agent compare/
connect/resolve references across them. Fusion→frames (ADR-0060) already composes reconciled
cross-source synthesis; Phase 3 adds the multi-document navigation + compare UX and a unified
"environment" view over ≥2 sources. Design detail deferred to the Phase-3 plan.

## Traceability

Reuses: R2a (source excerpts → composing), R2c `teachSource`, R2d (semantic sync), R2e (source-as-
stage), R1.1/R1.2 (registerSource/attachSource/Source Dock), fusion→frames (ADR-0060). New: web
`teachSource` client call, entry-card source affordance + topic-optional branching, the analyze
phase, consent-gated mid-session attach. An ADR (source-first entry as a product-law reorientation)
accompanies implementation.
