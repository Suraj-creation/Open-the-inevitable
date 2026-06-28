---
name: F09-living-universe-experience
spec:
  id: F09
  title: Living-Universe Experience & Immersive Roadmap
  pillar: P9
  domain: product
  status: draft
  owner: product-architecture
  last_reviewed: 2026-06-03
  upstream_dependencies:
    - product/Broader-feature-product
    - product/features/F02-dynamic-cognitive-navigation
    - product/features/F04-adaptive-multimodal-explanation
    - product/features/F07-realtime-cognitive-orchestration
    - product/features/F08-interdisciplinary-knowledge-graph
    - product/features/F16-cognitive-surface
    - runtime/cognitive-unit-runtime
    - world-state/world-state-graph
  downstream_dependencies:
    - product/features/F10-research-innovation-acceleration
    - product/features/F13-identity-personas-modes
    - product/features/F14-assessment-mastery-depth
  related_protocols: [cognition-packet-protocol, cognitive-event-protocol, reasoning-trace-protocol]
  related_events: [surface.rendered, artifact.created, whiteboard.updated, modality.selected, simulation.started, voice.turn.transcribed]
  related_runtime_systems: [world-state-graph, cognitive-unit-runtime, deterministic-execution-engine, cognitive-scheduler]
  related_governance_systems: [governance-kernel, capability-envelope, human-governance, cognitive-safety]
  related_observability_systems: [cognitive-observability, learner-outcome-telemetry, otel-edge, reasoning-trace]
  semantic_tags: [ux, living-universe, whiteboard, canvas, multimodal, immersive, ar-vr, voice]
  canonical_references:
    - product/Broader-feature-product#11-multimodal--immersive-experience
    - vision-application/Vision#xxviii-beyond-screens--holographic-arvr-immersive-future
---

# F09 — Living-Universe Experience & Immersive Roadmap

## 1. Purpose

F09 defines the experience philosophy and multimodal surface architecture of The Inevitable. The
product must not feel like an LMS, dashboard, quiz app, or chatbot. It should feel like navigating a
living universe of knowledge: timeline, canvas, whiteboard, graph, document, simulation, voice, and
future immersive spaces all projecting the same cognitive state.

The feature's purpose is to make knowledge inspectable, manipulable, and alive without violating
the underlying COS invariants.

F09 owns the **experience** — what the surface feels like and the immersive/AR-VR/voice roadmap. The
**substrate it renders on** — the single Cognition Block primitive, its scene-graph / block-document /
dataflow-DAG projections, the render runtime, and the collaboration+replay model — is owned by
[F16 — The Cognitive Surface](./F16-cognitive-surface.md). Every surface listed above (timeline,
canvas, whiteboard, graph, document, simulation, voice) is a *projection* of the F16 substrate.

## 2. Scope & Boundaries

- **In scope:** living timeline UX philosophy, whiteboard/canvas as cognition surface, multimodal
  artifact interaction, immersive roadmap, voice roadmap, simulation placement, and continuity
  across surfaces.
- **Out of scope:** prerequisite graph construction (F03), explanation generation policy (F04),
  content ingestion (F15), the convergent surface **substrate** (the Cognition Block primitive, its
  projections, the render runtime, and the collaboration+replay model — owned by
  [F16](./F16-cognitive-surface.md)), and production UI component implementation details.
- **Non-goals:** marketing-page aesthetics, decorative immersion, gamified dopamine loops, or UI
  state that cannot be replayed from events.

## 3. Personas & Modes

| Persona | Surface posture |
|---|---|
| Child / beginner | Large, concrete, tactile representations; one concept focus |
| Student | Timeline + explanation + practice as the primary triad |
| Researcher | Dense graph, papers, hypotheses, and frontier annotations |
| Educator | Classroom whiteboard, cohort overlays, and teaching-signature controls |
| Institution | Aggregate map views and governance dashboards |
| Open Mode | Lightweight, exploratory canvas with ephemeral or consolidatable state |

## 4. Narrative Experience

The first product screen is not a landing page. It is the learning surface. A learner sees a living
timeline, a concept workspace, and an Open Mode input. Upload a PDF and the document becomes
selectable knowledge. Ask a question and a side path unfolds. Draw on the whiteboard and the sketch
becomes an artifact the system can explain, reference, and remember. A simulation appears when it is
the clearest representation, not because animation is impressive.

The surface is cinematic only when the cognition demands it. Otherwise it is quiet, navigable, and
deep.

### 4.1 Immersive composition law (S-UCS)

The production manifestation of this experience is a **single living cognitive environment**, not a
dashboard of panels. The composition law:

- **The whiteboard is the product.** The Cognitive Stage (the focused, evolving cognition) occupies
  essentially the entire viewport. Every other affordance is an **overlay, floating HUD, contextual
  panel, or transient launcher** layered over it — never a permanent region competing for space.
- **The board holds only the MCCR (UCS, ADR-0030).** The board is the learner's *visual memory*, not a
  document: it carries only the **Minimal Complete Cognitive Representation** — distilled anchors (core
  concept, definition, key formula, diagram, relationship, mental model, table, key example, memory
  cue, image) that deserve persistent attention. The teaching prose moves entirely to the voice. The
  board exists to *preserve* understanding; the narration *constructs* it.
- **Progressive Cognitive Frames, never an infinite document.** Learning unfolds as a sequence of
  **Cognitive Frames** (SRF-001 §4.7), each a viewport-complete cognitive state that fits one screen
  with **no manual scrolling**; when a frame's narration completes, the surface transitions naturally to
  the next. A planner prepares likely next frames ahead as discardable speculation (governed, budgeted,
  re-planned on every learner signal — never static pre-generation, ADR-0030).
- **The Agent Observatory.** The agent ensemble is inspectable on demand, not permanently docked: a
  compact **AGENTS** control with live status pills (generating/routing/waiting/synthesizing/
  evaluating) opens an overlay exposing, per cognitive unit, its responsibility, current task,
  contribution, reasoning summary, decision trace, confidence, latency, routing, dependencies, and
  completion state. Nothing important about the reasoning stays hidden (powered by
  `surface.agent.reasoning.summary` + `surface.agent.work.timing`, SRF-002).
- **Synchronized narration.** Voice and board are one experience: as the narration script plays, the
  *specific MCCR element* being discussed becomes visually active — a subtle marker moving under the
  current idea like a teacher's pointer, not a paragraph highlight (a client projection over segment
  audio `currentTime` mapping `anchor_ref` → `focus.target_type:"element"`, ADR-0007/0030).
- **Streaming cognition.** A frame *materializes* progressively — layout reserved, then anchors, then
  streaming text, then images — so the learner watches understanding form rather than reading a finished
  document (`surface.block.delta` / `surface.frame.element.delta`, SRF-002/SRF-005).
- **Inline multimodal.** Illustrations appear *beside the concept they explain* (a render projection
  over `image`/`video`/`simulation` blocks sharing `concept_ids`), never as detached assets.
- **Navigation as launchers.** PATH/timeline and the concept graph remain fully accessible via a
  floating launcher → dismissible overlay, preserving capability without consuming the board.
- **Transport as a HUD.** Playback/interaction controls float and auto-hide on idle, returning on
  intent — full function, maximal immersion.

Every capability already implemented (Timeline/Scene, PATH, orchestration, assessment, practice, image,
concept, routing, TTS, transport, interrupt, Go-Deeper/Simpler/Example/Challenge/Ask, observability,
agent contribution tracking) is **preserved** — this law governs *presentation*, not feature set. The
UI is a projection (F16, SRF-001); this composition adds no canonical state.

## 5. ULI / UALRCI Hooks

- ULI's seven layers are represented as progressively richer surfaces, not as labels.
- UALRCI's dual-coding strategy requires at least two representations when a concept is difficult.
- Research transition uses visual graph/frontier maps to show where known knowledge ends.
- Universal Accessibility requires every immersive affordance to have a non-immersive equivalent.

## 6. Agents Involved

| Agent | Role |
|---|---|
| Supervisor | Decides which surface receives which contribution |
| Explanation / Simulation | Chooses and renders multimodal representations |
| Curriculum | Keeps the timeline consistent with prerequisite and mastery state |
| Memory | Persists meaningful artifacts and surface state through mutations |
| Research / Innovation | Places frontier breadcrumbs, hypotheses, and synthesis maps |
| Socio-Ethical | Checks sensitive representations and domain framing |
| Auto Note Builder | Converts surface activity into Living Notebooks |

## 7. Cognitive OS Primitives Used

- **World-State Graph** is the source of truth for rendered nodes, artifacts, relations, and mastery.
- **Cognition Packet** represents surface actions such as selection, sketch, voice, upload, and
  node entry.
- **Cognitive Event** records every meaningful surface mutation.
- **Reasoning Trace** explains modality and representation choices.
- **Memory Mutation** stores durable artifacts, notes, and preferences.
- **Execution Journal** supports replay of deterministic surface state.

## 8. Events, Protocols & State Transitions

Emits:

- `surface.rendered`, `surface.reshaped`, `surface.focus.changed`
- `whiteboard.updated`, `whiteboard.artifact.created`, `whiteboard.artifact.linked`
- `modality.selected`, `modality.swapped`, `simulation.started`, `simulation.completed`
- `artifact.created`, `artifact.annotated`, `artifact.consolidated`
- `voice.turn.transcribed`, `voice.documentation.generated`
- `immersive.mode.entered`, `immersive.mode.exited` (frontier roadmap)

State transitions:

1. Timeline node selected -> concept workspace focused.
2. Artifact created -> world-state node with provenance.
3. Artifact becomes useful -> memory mutation consolidates it.
4. Surface closes -> durable artifacts remain; ephemeral interactions decay.

## 9. Memory & World-State Effects

The surface writes artifact and interaction events. Memory decides what persists. Whiteboard
objects, selected document spans, simulation states, voice transcripts, and generated notes all
become typed graph nodes or memory artifacts only through governed mutation. Surface layout itself
is replayable session state, not hidden UI-local truth.

## 10. Governance, Safety, Privacy, Ethics

- Voice, camera, sensor, AR/VR, and ambient inputs are strictly opt-in and capability-scoped.
- Immersion must serve understanding, not attention capture.
- Learners can inspect what artifacts were remembered and why.
- Simulations in high-stakes domains require source grounding and safety disclaimers.
- Classroom surfaces respect institutional and minor-consent policy.

## 11. Observability

- Telemetry: modality-usefulness, surface-switch friction, artifact-to-memory ratio, simulation
  learning lift, whiteboard consolidation quality, and accessibility fallbacks used.
- Reasoning trace required for modality selection and immersive transitions.
- Replay determinism: **full** for surface state, artifact references, and accepted mutations;
  **trace-level** for generated media whose binary output is stored as artifact provenance.

## 12. Failure Semantics

| Failure | Behavior |
|---|---|
| Surface cannot render simulation | Fall back to diagram/text and emit `modality.degraded` |
| Artifact memory mutation rejected | Keep ephemeral artifact in session; surface reason if learner-visible |
| Voice transcription low confidence | Ask clarification and avoid committing memory |
| Immersive mode unavailable | Preserve identical learning path in standard surface |
| UI event log gap | Mark replay degraded and recover from last consistent world-state snapshot |

## 13. Architecture Conformance Statement

- UI state that affects cognition is event-sourced.
- Surface artifacts become memory only through Memory Mutation.
- Modality choices emit reasoning traces.
- Sensor and immersive inputs require capability envelopes and consent.
- The surface consumes world-state projections and does not become a hidden data store.

## 14. Success Metrics

- Learner surface comprehension: users can explain where they are in their path without instruction.
- Modality helpfulness > 80% for automatically selected modalities.
- Artifact-to-memory precision: durable artifacts remain useful after one week.
- Accessibility parity: every immersive pathway has a non-immersive equivalent.
- Surface replay coverage: 100% of cognition-affecting UI actions have event records.

## 15. MVP -> Advanced -> Frontier Phasing

- **MVP:** living timeline, concept workspace, Open Mode, artifact events, and whiteboard-as-artifact
  semantics.
- **Advanced:** interactive simulations, living notebooks, document split-pane, classroom
  whiteboard, voice transcription with documentation.
- **Frontier:** AR/VR/holographic classrooms, ambient multimodal companion, zero-latency voice, and
  physically grounded simulation environments.

## 16. Open Questions

- Which surface artifact schema should become canonical first: whiteboard, document span,
  simulation, or voice transcript?
- What is the threshold for persisting a whiteboard action as memory rather than session-only
  state?
- How should immersive experiences be evaluated for learning depth rather than novelty?
- Which accessibility constraints become hard governance rules?

## 17. References

- `spec/product/Broader-feature-product.md` §11 and §11.1.
- [F16 — The Cognitive Surface](./F16-cognitive-surface.md) (the substrate F09 renders on) and the
  research dossier [`spec/research/cognitive-surface-frontier-research.md`](../../research/cognitive-surface-frontier-research.md).
- `spec/vision-application/Vision.md` §XXVIII and §XXXVI.
- `spec/world-state/world-state-graph.md`.
- `spec/replay/deterministic-replay.md`.
