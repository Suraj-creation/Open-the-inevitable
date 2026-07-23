---
name: cse-cognitive-scene
spec:
  id: CSE-012
  title: The Cognitive Scene & Actors — Frames Elevated to Living Cognitive Space
  domain: source-environment
  status: draft
  owner: product-architecture
  last_reviewed: 2026-07-10
  upstream_dependencies:
    - source-environment/CSE-008-source-surface-projection
    - source-environment/CSE-011-cognitive-director
    - surface/cognitive-surface-runtime
    - surface/surface-event-architecture
    - surface/inline-multimodal-artifacts
    - architecture-decisions/ADR-0030-cognitive-frames-mccr-narration-split
    - architecture-decisions/ADR-0033-the-cognitive-theater
    - architecture-decisions/ADR-0007-surface-choreography-and-timing
    - design/cognitive-design-language-v1
  downstream_dependencies:
    - source-environment/CSE-013-knowledge-cinematography
    - source-environment/CSE-014-cognitive-interaction-grammar
    - source-environment/CSE-016-creative-cognition
    - indexes/event-index
    - surface/surface-event-architecture
  related_protocols: [cognitive-event-protocol, cognition-packet-protocol]
  related_events: [surface.scene.opened, surface.scene.actor.entered, surface.scene.actor.transformed, surface.scene.actor.exited, surface.scene.evolved, surface.scene.lighting.changed, surface.scene.closed, surface.frame.composed]
  related_runtime_systems: [surface-session, frame-planner, surface-composer, choreographer]
  related_governance_systems: [governance-kernel, capability-envelope]
  related_observability_systems: [cognitive-observability, otel-edge]
  semantic_tags: [source-environment, scene, actors, living-frame, evolution, attention, surface]
  canonical_references:
    - architecture-decisions/ADR-0030-cognitive-frames-mccr-narration-split
    - architecture-decisions/ADR-0033-the-cognitive-theater
    - source-environment/CSE-008-source-surface-projection#3
---

# CSE-012 — The Cognitive Scene & Actors

## 1. Purpose

Elevates the ADR-0030 **Cognitive Frame** into a **Cognitive Scene**: a living, inhabitable space
that evolves under the learner's attention and interaction rather than a slide that is composed,
narrated, and superseded. The Scene is where the Director's directives (CSE-011) and the
cinematographer's shots (CSE-013) become something a person stands inside. It builds on frames —
it does not replace them (ADR-0033 L2).

## 2. Philosophy

- **The learner inhabits cognition; they do not watch it.** A Scene responds in place: a question
  reshapes an actor, a manipulation runs a simulation, an agent's contribution enters as a new
  actor — without necessarily starting a new ask.
- **MCCR is the skeleton; the Scene is the body.** The Minimal Complete Cognitive Representation
  (ADR-0030) remains the persistent visual memory of the concept. Actors, lighting, and evolution
  are the living tissue around it. Strip them and a Scene is byte-identical to today's frame.
- **Actors, not widgets.** A diagram, an equation, a video, a simulation, an overlay, a voice line
  are *cognitive actors* on one stage, choreographed toward one understanding — not independent UI
  components with their own logic.
- **Everything is still a fold.** Scene evolution is event-sourced; layout and camera timing stay
  client projections (D5/ADR-0007).

## 3. Primitives

### 3.1 `CognitiveScene`

```json
{
  "scene_id": "scn_...",
  "frame_ref": "frame_... (the ADR-0030 frame this scene wraps; its MCCR is the skeleton)",
  "concept_ref": "...",
  "state": "cognitive state this scene serves (CSE-011 §3.1)",
  "actors": ["act_..."],
  "lighting": { "focus_actor_ref": "act_...", "cdl_state": "learning|...", "recession": ["dimmed act_ids"] },
  "evolution_log_ref": "the scene-delta stream that has mutated this scene in place",
  "directive_ref": "dir_... (the Director directive this scene realizes)"
}
```

A Scene upserts by `scene_id` into `SurfaceState` (like a frame). Which scene is on screen is a
client projection over the Choreographer cursor (ADR-0007) — no `active_scene_id` in canonical
state.

### 3.2 `Actor`

A cognitive element on the stage, wrapping existing block/MCCR/media primitives:

```json
{
  "actor_id": "act_...",
  "kind": "text-anchor | equation | diagram | figure | table | image | video | simulation | overlay | voice | citation | annotation | creation-canvas",
  "content_ref": "MCCR element id | block id | media content_ref | source anchor",
  "role": "protagonist | support | evidence | contrast | aside",
  "provenance_class": "evidence | inference | frontier",
  "entrances": ["shot refs that bring it in (CSE-013)"],
  "can_evolve": true
}
```

Actors reuse SRF-006 media (bytes out-of-band), CSE-008 source viewports/highlights, and MCCR
elements — the Scene composes them; it does not invent new content storage.

### 3.3 Scene Deltas (the evolution channel — the core new capability)

A typed, event-sourced mutation of a live Scene *without a new ask*:

```json
{
  "delta_id": "scd_...",
  "scene_id": "scn_...",
  "op": "actor.enter | actor.transform | actor.exit | lighting.change | reveal | annotate | branch",
  "cause": "director | agent | learner | cinematography",
  "payload": "op-specific (e.g. a transformation output, a highlight, a new actor)",
  "interaction_ref": "int_... (if learner-caused, CSE-014)"
}
```

Scene deltas are what make the frame *live*. A learner circling a term (CSE-014) → `annotate`
delta; an agent answering an in-scene "why?" → `actor.enter` delta; a Director recap directive →
`reveal` delta. The evolution log folds into the Scene; replay reconstructs every mutation.

## 4. Architecture

- A Scene opens when the FramePlanner/composer produces a frame *and* the Director assigns it a
  target state: `surface.scene.opened` wraps `surface.frame.composed` (additive — a frame without
  a Scene wrapper renders exactly as today).
- **In-place evolution vs. new frame.** The runtime decides: a bounded response (answer a
  question, run a simulation, add one actor) is a **scene delta** on the current Scene; a genuine
  topic move is a **new frame/Scene** (FramePlanner territory). This boundary is a Director input,
  keeping spatial stability (the learner is not teleported for every micro-interaction — CDL "the
  board is sacred").
- **Lighting** is the Scene's attention model: one focal actor at a time (CDL "one focal accent"),
  siblings recede (CDL focus-recession). Lighting changes are deltas, realized by cinematography.
- Actors enter/transform/exit via shots (CSE-013); the Scene owns *what* is on stage, cinematography
  owns *how* it moves.

## 5. Event Subfamily — `surface.scene.*` (proposed, additive under `surface`)

| Event | Emitted when | Payload core |
|---|---|---|
| `surface.scene.opened` | a frame is wrapped as a living Scene | scene_id, frame_ref, concept_ref, state, directive_ref |
| `surface.scene.actor.entered` | an actor joins the stage | scene_id, actor (§3.2), entrance shot_ref? |
| `surface.scene.actor.transformed` | an actor is re-expressed in place (CSE-004) | scene_id, actor_id, transformation_ref |
| `surface.scene.actor.exited` | an actor leaves | scene_id, actor_id, reason |
| `surface.scene.evolved` | a scene delta applied | full scene delta (§3.3) |
| `surface.scene.lighting.changed` | focus/recession changed | scene_id, focus_actor_ref, cdl_state |
| `surface.scene.closed` | scene retired (topic move / session end) | scene_id, reason |

## 6. Runtime Semantics, Governance & Determinism

- Scenes and actors are folds; actor content is produced by existing governed units (composer,
  transformation executors CSE-004, media adapters). Actor side effects (play video, run
  simulation, generate image) are governed tool/model invocations (§blueprint law 5).
- **Determinism.** Model/media-backed actor content records before use (D3); replay folds recorded
  deltas and never re-invokes. Camera timing of entrances is client projection (ADR-0007).
- Grounded actors (evidence class) require source anchors; inference/frontier actors render in
  their provenance channel (CSE-008 §7).

## 7. Failure Semantics & Replay

| Failure | Behavior |
|---|---|
| Actor content generation fails | Actor enters in a degraded/placeholder state with retry; Scene stays coherent; evented (CSE-002 honesty) |
| A scene delta references a missing actor | Delta rejected, evented; Scene unchanged (never a corrupt fold) |
| Too many live actors (attention overload) | Director/lighting forces recession/exit; interruption budget applies to actor entrances (ADR-0033 L6) |
| Client cannot animate an entrance | Actor appears via the discrete reduced-motion realization (CSE-013 §6); canonical state unaffected |

Replay: the `surface.scene.*` subfamily folds deterministically; a replayed session reproduces
every actor entrance, transformation, lighting change, and learner-caused evolution in order. A
1.x log with no scene events folds to the identical frame view (backward compatibility, ADR-0033 L2).

## 8. Open Questions

- Multi-learner co-presence in one Scene: server-authoritative deltas first vs. CRDT (dossier risk
  #2 favors server-authoritative first; defer CRDT to the co-presence phase).
- The in-place-evolution vs. new-frame boundary heuristic — needs usage data; start conservative
  (favor new frames on topic ambiguity to protect spatial stability).
- Whether `creation-canvas` actors (CSE-016) need a distinct persistence path from ephemeral
  actors — likely yes (creations are durable outputs); decide with CSE-016.

## Implementation status (R3, ADR-0057)

Scenes are built (actors from MCCR, lighting, evolution log, shots) and folded; until R3 only the
board tint + learner Mark badges rendered. **R3d** renders the Scene's **lighting** (§4): the
`recession` actor set (non-protagonist actors) maps through `actor.content_ref` to the MCCR
elements, which the board dims gently (opacity only, readability preserved) so the focus reads
first — never dimming the element currently being spoken. **Deferred:** actor-level in-place
evolution animations beyond the learner-Mark path; co-presence; the creation-canvas actor (CSE-016).
