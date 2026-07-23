# ADR-0039: Cognitive Theater T2 — Cinematography + the Interaction Grammar

**Status:** Accepted
**Date:** 2026-07-12
**Related:** ADR-0033 (the Cognitive Theater — four organs, locks L1–L6), ADR-0038 (Theater T1 —
Director + Scene, the substrate this completes), CSE-013 (Knowledge Cinematography), CSE-014
(the Interaction Grammar), CSE-012 (Scene evolution channel), CSE-008 (viewport plans/highlights),
ADR-0007 (choreography/no-clock), ADR-0024 (surface interaction protocol), SRF-002 (schema 1.9.0),
blueprint M8

## Context

ADR-0038 landed the Theater's first two organs — the Director (time) and the Scene (space). Two
remain: **Cinematography** (motion — the camera) and the **Interaction Grammar** (the audience as
actor). M7 built the Scene's evolution channel (`surface.scene.evolved`) but wired only the
Director-caused path; the learner cannot yet evolve a Scene in place. And motion is still styling,
not a pedagogical grammar. M8 T2 lands both, completing the four-organ Theater. Three decisions.

## Decisions

### 1. The Cinematographer is a composer role emitting a deterministic shot list (CSE-013 §8 resolved)

Per CSE-013 §8 (and mirroring the M5 ViewportPlanner decision), the Cinematographer is a **composer
role, not a separate unit** — one compose→record→render path. `planShots` is a **pure function** of
the Scene's actors, the Director's directive, and the recorded narration segments: it emits an
`establish` shot when a Scene opens (orient before detail), a `spotlight` shot per narration
segment bound to the discussed actor (the camera follows the voice), and a `hold` when the directive
is `demanding` or the pacing is `silence` (stillness is a first-class output, ADR-0033 L6). Every
shot is deterministic and replay-safe. Shots emit `surface.shot.planned`; the realized cut is a
client projection over ordered shots + audio (ADR-0007) — canonical state carries the shot *list*,
never a pixel timeline. `surface.shot.cut` is reserved for a client-confirmed realization but is
not required in T1 (the existing `surface.source.viewport.changed` / `surface.scene.lighting.changed`
already carry the concrete moves).

**Reduced-motion equivalence is mandatory and test-enforced (CSE-013 §6, ADR-0033 open question
closed).** Every shot kind maps to a discrete, non-animated realization in a single exported table
(`spotlight` → instant highlight; `morph` → before/after with caption; `pan` → jump + orientation
note; `hold` → stillness). A conformance test asserts every registered shot kind has a realization
— motion is an enhancement over the discrete form, never a requirement.

### 2. Interaction is typed cognitive intent that evolves the Scene in place (CSE-014)

The seven ADR-0024 kinds become the full **interaction grammar** — ~25 primitives across seven
classes (Attend / Mark / Ask / Reason / Express / Navigate / Govern-flow). Every interaction is
interpreted **deterministically** into a typed `cognitive_intent` (`interpretIntent(kind, target,
note)` — a pure function; free-text asks that need a model are D3-recorded, deferred to when
free-text lands), emitted as `surface.intent.expressed`. **The learner always wins** (ADR-0033 L5):
an interaction pre-empts pending directives; the Director re-plans around it. Routing (CSE-014 §4):

- **Mark** (annotate / circle / highlight / pin) → a learner-caused **`surface.scene.evolved`**
  (`annotate` delta, `cause: "learner"`) on the current Scene — the evolution channel M7 built,
  now driven by the learner. The Scene mutates *in place*; no new ask, no teleport (spatial
  stability, CDL "the board is sacred").
- **Ask** (ask-why / ask-simpler / ask-deeper / ask-example / define) → the existing reframe path
  (an enrichment re-frame of the last ask) plus, when a live Scene exists, a `reveal` delta.
- **Navigate / Govern-flow** → the existing Director/focus paths (jump/branch/interrupt).

`surface.interaction.applied` gains two effects — `scene-evolved`, `annotated` — closing the loop.
Learner marks as *durable memory mutations* (surviving version migration) are a named later
increment; T1 records them as canonical scene deltas + interaction records (fully replayable).

### 3. One additive step to schema 1.9.0; backward-compatible (ADR-0033 L2/L3)

`surface.shot.*` and `surface.intent.expressed` join `surface` at schema **1.9.0**, additive and
replay-preserving. The extended interaction kinds are additive to the existing
`surface.interaction.received` payload (an unknown kind still folds; the runtime capability-gates
and honestly refuses out-of-scope kinds, ADR-0024 discipline). A 1.8.0 log with no shot/intent
events folds identically. All shots, intents, and scene deltas are folds; camera timing and layout
stay client projections (L3).

## Consequences

- The four-organ Theater is complete: a Director conducts, Scenes are inhabited, the camera moves
  for cognitive reasons, and the learner acts on cognition through a semantic grammar that evolves
  the Scene in place — every decision inspectable (L4).
- Cinematography is deterministic and accessibility-first: the reduced-motion table + conformance
  test make motion an enhancement, never a barrier.
- The Scene evolution channel finally closes its loop — M7's `surface.scene.evolved` now has a
  learner-caused producer, proving the "audience is also an actor" architecture end-to-end.
- Deferred with named scope: free-text ask interpretation (model-backed, D3); durable
  learner-mark memory mutations; the Reason/Express classes' deep routing (Claim Graph M9,
  Teaching Theatre CSE-009); enrichment-loop hardening (CSE-007 §4); `surface.shot.cut`
  client-confirmed realization; CDL v3 spatial/audio motion language.

## Rejected

- A standalone Cinematographer unit (CSE-013 §8 leaning: role keeps one compose→record→render path;
  a unit adds a dispatch hop with no T1 benefit).
- Animation curves / durations in canonical shot events (violates ADR-0007 — timing is client).
- A separate interaction event family (extends `surface.interaction.*` additively, exactly as the
  Theater extends `surface.frame.*` — ADR-0033 rejected forking families).
- Learner marks as scene deltas *only* forever (they should become durable memory; T1 records the
  canonical delta now and lifts it to a memory mutation in a named increment).
