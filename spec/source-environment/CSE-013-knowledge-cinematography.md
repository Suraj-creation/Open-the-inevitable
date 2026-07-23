---
name: cse-knowledge-cinematography
spec:
  id: CSE-013
  title: Knowledge Cinematography — The Shot Grammar of Understanding
  domain: source-environment
  status: draft
  owner: product-architecture
  last_reviewed: 2026-07-10
  upstream_dependencies:
    - source-environment/CSE-008-source-surface-projection
    - source-environment/CSE-011-cognitive-director
    - source-environment/CSE-012-cognitive-scene
    - architecture-decisions/ADR-0007-surface-choreography-and-timing
    - architecture-decisions/ADR-0033-the-cognitive-theater
    - design/cognitive-design-language-v1
    - design/cognitive-design-language-v2
  downstream_dependencies:
    - source-environment/CSE-009-experience-catalog
    - design/cognitive-design-language-v3
  related_protocols: [cognitive-event-protocol]
  related_events: [surface.shot.planned, surface.shot.cut, surface.source.viewport.changed, surface.scene.lighting.changed]
  related_runtime_systems: [choreographer, surface-composer, frame-planner]
  related_governance_systems: [governance-kernel]
  related_observability_systems: [cognitive-observability]
  semantic_tags: [source-environment, cinematography, motion, attention, shot-grammar, pedagogy, camera]
  canonical_references:
    - architecture-decisions/ADR-0007-surface-choreography-and-timing
    - source-environment/CSE-008-source-surface-projection#4
    - design/cognitive-design-language-v1#3
---

# CSE-013 — Knowledge Cinematography

## 1. Purpose

Cinema has a grammar for guiding a viewer's attention and emotion — the cut, the zoom, the reveal,
the establishing shot. Understanding deserves the same. This spec defines the **shot grammar of
cognition**: a first-class vocabulary of camera moves over the Scene, each chosen for a
*pedagogical* reason, that binds the CDL's motion verbs and CSE-008's viewport plans into
choreographed attention. Motion becomes pedagogy, not decoration (ADR-0033 organ 3).

## 2. Philosophy

- **Every move means something.** A shot is selected because it serves comprehension — orienting
  before diving, spotlighting the symbol under discussion, dissolving from a wrong model to a
  right one. A move with no cognitive reason is a defect.
- **Selection is pedagogy; rendering is design.** CSE owns *which shot, why, when* (a decision on
  the blackboard). The CDL owns *how the shot looks and eases* (motion tokens). This spec never
  sets pixels, durations-as-clocks, or easing curves.
- **Logical, not temporal.** A shot carries order and intent; the client Choreographer realizes
  timing against narration and audio (ADR-0007). Canonical state has no playback position.
- **Reduced motion is a first-class rendering, not a fallback.** Every shot declares a discrete,
  non-animated realization; motion is an enhancement over it, never a requirement (accessibility,
  ADR-0033 open question).

## 3. Primitives — The Shot Vocabulary

A **Shot** is `{ shot_id, scene_ref, kind, subject, from, to, intent, cdl_motion_ref,
narration_anchor_ref?, cause }`. The `kind` vocabulary (extensible registry):

| Shot | Cognitive use | Realizes over |
|---|---|---|
| `establish` | Orient before detail — show the whole before the part | Scene / concept map |
| `semantic-zoom-in` / `-out` | Move between abstraction levels (CSE-003 ladder) | viewport granularity |
| `pan` | Traverse a structure while preserving continuity | source viewport plan (CSE-008 §4) |
| `spotlight` | Direct attention to the actor under discussion | Scene lighting (CSE-012) |
| `reveal` | Progressive disclosure of a derivation/argument step | MCCR reveal order |
| `dissolve` | Replace one representation with another (misconception → correct model) | actor transform |
| `morph` | Show continuous transformation (equation → graph) | representational transform (CSE-004) |
| `split` | Compare two things side by side | multi-actor / multi-source (CSE-015) |
| `merge` | Fuse two views into one understanding | source fusion (CSE-015) |
| `macro-to-micro` | Zoom from phenomenon to mechanism | ladder + viewport |
| `orientation` | A deliberate zoom-out "where are we" beat between long jumps | required by CSE-008 §4.3 stability law |
| `rack-focus` | Shift focus between two present actors without moving the camera | lighting recession |
| `hold` | Deliberate stillness — let the learner think | *no motion* (silence's visual twin) |

`hold` and the absence of a shot are first-class (ADR-0033 L6): the cinematographer may choose
stillness.

## 4. Architecture

- The **Cinematographer** is a capability of the Scene/composer seam (may be a unit or a composer
  role — implementation decision, CSE-007 §8 pattern). It subscribes to Director directives
  (CSE-011: a `demanding` intensity favors fewer, longer holds; an `exploring` state favors pans
  and splits) and Scene deltas (an `actor.enter` needs an entrance shot).
- A shot **selection** is an Enrichment-style decision (CSE-007 §4): proposed with rationale,
  arbitrated against attention budget and the "one focal accent" law, recorded. It emits
  `surface.shot.planned`; the realized cut emits `surface.shot.cut` (or reuses
  `surface.source.viewport.changed` / `surface.scene.lighting.changed` where those already carry
  the move).
- **Composition with narration.** Shots bind to narration segments via `narration_anchor_ref`
  (the same anchor mechanism as CSE-008 §6): the spotlight fires as the sentence about that symbol
  is spoken. Timing is client-realized.

## 5. Cognitive Transparency

Every shot answers *"why did the view move here, now?"* from its `intent` + the selection
rationale (CSE-007 transparency, ADR-0033 L4). A learner (or educator) can inspect the
cinematography of a whole lesson as a shot list in the Observatory (CSE-009).

## 6. Governance, Accessibility & Determinism

- **Reduced-motion equivalence (mandatory):** every shot kind maps to a discrete realization
  (`spotlight` → instant highlight; `morph` → before/after with a caption; `pan` → jump with an
  orientation note). A conformance test asserts every registered shot has one (ADR-0033 open
  question closed by test).
- **Vestibular safety:** no shot may induce large-field rapid motion; `prefers-reduced-motion`
  collapses all shots to discrete realizations (CDL law).
- **Determinism:** shots are logical; the animation schedule is a client projection over ordered
  shots + audio time (ADR-0007). Replay reproduces the shot *list*, not a pixel timeline.
- Shot selection respects the interruption/attention budget (CSE-007 §6): unsolicited camera
  motion is budgeted exactly like unsolicited content.

## 7. Failure Semantics

| Failure | Behavior |
|---|---|
| Client cannot animate a shot | Discrete realization used; canonical state unaffected |
| Shot references an off-stage actor | Shot dropped, evented; no broken cut |
| Attention budget depleted | Cinematographer defaults to `hold`; no unsolicited moves |
| Narration anchor unresolved | Shot fires on logical order without the tight audio bind; evented |

## 8. Open Questions

- Whether the Cinematographer is a distinct unit or a composer role (leaning: role, to keep one
  compose→record→render path per CSE-007 §8).
- The shot registry's governance: closed enum vs. registry-with-review (leaning registry, mirroring
  CSE-004/CSE-007 extension pattern).
- Interaction with CDL v3 spatial/audio language for 3D/immersive projections (F09 frontier) —
  coordinate at CDL v3.

## Implementation status (R3, ADR-0057)

The shot grammar was planned/emitted/folded but had **no client consumer** — the camera moves were
dead at render. **R3c** wires the consumer: the web reads the active frame's Scene's latest shot and
realizes it as a subtle, pedagogically-meaningful board move (`data-shot` on the frame deck →
per-kind CSS), with every animation gated under `prefers-reduced-motion: no-preference` so a
reduced-motion client gets the discrete baseline (§6). Amplitudes are deliberately tiny — a legible
move, never spectacle. **Deferred:** binding each shot to its exact narration segment
(`narration_anchor_ref`) so the move fires as the sentence is spoken (§4); tuning the full 14-kind
motion vocabulary with live visual iteration; shots over the source pane (with R2's source-as-stage).
