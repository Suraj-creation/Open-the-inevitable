---
name: F16-cognitive-surface
spec:
  id: F16
  title: The Cognitive Surface — Universal Multimodal Substrate
  pillar: cross-cutting
  domain: product
  status: draft
  owner: product-architecture
  last_reviewed: 2026-06-04
  upstream_dependencies:
    - product/Broader-feature-product
    - product/features/F04-adaptive-multimodal-explanation
    - product/features/F07-realtime-cognitive-orchestration
    - product/features/F09-living-universe-experience
    - product/features/F15-content-ingestion-knowledge-substrate
    - product/features/F05-persistent-cognitive-memory
    - world-state/world-state-graph
    - execution/cognitive-execution-engine
    - events/event-taxonomy
    - research/cognitive-surface-frontier-research
  downstream_dependencies:
    - product/features/F09-living-universe-experience
    - product/features/F02-dynamic-cognitive-navigation
    - product/features/F10-research-innovation-acceleration
    - product/features/F11-institutional-collective-intelligence
    - product/features/F14-assessment-mastery-depth
  related_protocols: [cognition-packet-protocol, cognitive-event-protocol, memory-mutation-protocol, reasoning-trace-protocol, cognitive-unit-abi]
  related_events: [block.created, block.updated, block.retyped, block.linked, projection.rendered, projection.switched, blocktype.registered, surface.rendered, surface.reshaped, whiteboard.updated, whiteboard.artifact.created, modality.selected, simulation.started, surface.replay.scrubbed]
  related_runtime_systems: [world-state-graph, deterministic-execution-engine, cognitive-unit-runtime, cognitive-scheduler, universal-cognitive-bus, versioned-blackboard]
  related_governance_systems: [governance-kernel, capability-envelope, human-governance, cognitive-safety]
  related_observability_systems: [cognitive-observability, reasoning-trace, learner-outcome-telemetry, otel-edge]
  semantic_tags:
    [cognitive-surface, whiteboard, substrate-primitive, cognition-block, scene-graph, block-document,
     dataflow-dag, crdt, event-sourcing, replay, webgpu, render-anything, multimodal, generative-ui,
     post-application, ide-co-editor]
  canonical_references:
    - research/cognitive-surface-frontier-research
    - product/Broader-feature-product#11-multimodal--immersive-experience
    - product/features/F09-living-universe-experience
    - world-state/world-state-graph
    - replay/deterministic-replay
---

# F16 — The Cognitive Surface — Universal Multimodal Substrate

## 1. Purpose

F16 defines the **unifying technical substrate of the convergent surface** — the single
representational model from which every manifestation of *The Inevitable* is projected: the
whiteboard, the living document, the presentation, the authoring canvas, the notebook, the
knowledge-graph explorer, the simulation stage, and (on the long horizon) the IDE co-editor. Its
thesis, grounded in [`research/cognitive-surface-frontier-research.md`](../../research/cognitive-surface-frontier-research.md):
**convergence belongs at the substrate layer, not the application layer.** Humanity's fragmented
knowledge-work surfaces share ~80% of a data model (typed objects + layout + media + collaboration)
but duplicate it incompatibly; F16 unifies that substrate so that *all* media can render and react
**simultaneously**, with "explanation over explanation," while every cognition-affecting action
remains a governed, event-sourced, deterministically-replayable projection of world-state.

F16 is the substrate; **F09 is the experience** rendered on it. Where F09 owns *what the surface
feels like* and the immersive/AR-VR/voice roadmap, F16 owns *the one object model, render runtime,
collaboration+replay model, and block-type registry* the experience is built from.

## 2. Scope & Boundaries

- **In scope:** the **Cognition Block** substrate primitive and its three projections (scene-graph /
  block-document / dataflow-DAG); the extensible **block-type registry** (render-anything); the
  surface's **event-sourcing + deterministic-replay** model; the **real-time collaboration (CRDT)**
  model and its reconciliation with replay; the **render tier** (WebGPU / DOM / sandboxed execution);
  the **AI-native rendering contract** (agents emit typed mutations, not opaque HTML); manifestation
  projection (R1–R8); load-governed density.
- **Out of scope (owned elsewhere):** **modality *selection* policy and DSP** ([F04](./F04-adaptive-multimodal-explanation.md)) — F16 *renders* the modality F04 *chooses*; **agent
  *arbitration* and the bus/blackboard/scheduler** ([F07](./F07-realtime-cognitive-orchestration.md)) — F16 *places* the proposals F07 *accepts*; **experience philosophy + immersive/AR-VR/voice
  roadmap** ([F09](./F09-living-universe-experience.md)); **content ingestion / select-to-expand
  source handling** ([F15](./F15-content-ingestion-knowledge-substrate.md)); **memory tiering &
  consolidation policy** ([F05](./F05-persistent-cognitive-memory.md)); **prerequisite graph &
  knowledge graph** ([F03](./F03-recursive-prerequisite-intelligence.md), [F08](./F08-interdisciplinary-knowledge-graph.md)).
- **Non-goals:** a freeform canvas that is its own source of truth; persistence that bypasses Memory
  Mutation; agent-generated HTML blobs that cannot be replayed or governed; "everything visible at
  once" maximalism; immersion or animation for spectacle rather than understanding; **static
  pre-generation of all content** — the surface is a live, continuously-planning, interactive
  classroom where cognition is generated dynamically on demand (SRF-001 §2; ADR-0007 §7), not a
  lesson frozen at generation time and replayed. Look-ahead frame planning (ADR-0030) does not violate
  this: speculative frames are governed, budgeted, discardable, and re-planned on every learner signal,
  never surfaced until promoted — anticipation, not pre-generation.

## 3. Personas & Modes

| Persona | Surface-substrate posture |
|---|---|
| Child / beginner | Few blocks, large, one focus; block density hard-capped by working-memory budget |
| Student | Block-document + scene-graph projections (timeline, concept workspace, whiteboard) |
| Researcher | Dense graph + dataflow-DAG (notebooks, executable diagrams, frontier maps) |
| Educator | Shared scene-graph (classroom whiteboard), cohort overlays, replay scrubber |
| Institution | Aggregate projections; governance/observability overlays; no raw learner memory |
| Open Mode | Lightweight ephemeral blocks; consolidate-on-keep only |

All personas share **one substrate**; persona affects projection defaults, density budget, and
governance posture — never which laws apply (PRD §3).

## 4. Narrative Experience

The learner sees not "an app" but a space. A paragraph of an uploaded PDF, selected, *expands in
place* into a child explanation block. The same surface, a tap later, is a whiteboard where a sketch
becomes an object the system can reference and remember; a tap later, a slide; a tap later, a live
simulation whose state is replayable; on the developer's horizon, a pane of code beside its
plain-language logic. Nothing is a separate program — each is a **projection of the same blocks**.
Agents place contributions *onto* the surface (a research breadcrumb, a prerequisite descent) without
seizing it. At any moment a learner or teacher can scrub the session back and watch it reconstruct
exactly, and ask "why is this here?" to see the cited reason. The surface feels less like using
software and more like entering a living space of thought — *and every bit of it is accountable.*

## 5. ULI / UALRCI Hooks

- **Seven layers** render as **stacked layer-renders on a single block** (explanation-over-explanation);
  peeling a layer is a retrieval opportunity, not just a view change.
- **Prerequisite-descent on stall:** when F04/F14 emit confusion/low-mastery signals, the surface
  *descends* a block into its prerequisite sub-graph in place, then re-ascends — adapting to
  **element-interactivity load**, not subjective difficulty (research §S6; expertise-reversal).
- **Dual coding** is applied **conditionally** per CTML principles (research §S2/§S8), not as a blanket
  "always show a picture."
- **Retrieval/generation bias:** the surface prefers learner-*constructed* representations
  (select-to-expand, predict-then-reveal, teach-back) over passive re-presentation (research §S5).
- **Depth, not fluency:** R8 self-restructuring targets substrate-derived mastery signals, never
  in-session smoothness (research §S3/§S4).

## 6. Agents Involved

| Agent | Role on the surface | Emits / subscribes |
|---|---|---|
| Supervisor (F07) | Decides which accepted proposal gets surfaced and where | subscribes `agent.output.accepted`; F16 renders placement |
| Explanation / Simulation (F04) | Chooses modality/representation; F16 renders it | emits `modality.selected`; F16 emits `projection.rendered` |
| Curriculum (F03) | Keeps timeline/graph projections consistent with mastery state | subscribes graph deltas |
| Memory (F05) | Consolidates durable blocks via Memory Mutation | subscribes `block.*`; commits mutations |
| Research / Innovation (F10) | Places frontier breadcrumbs/hypotheses as blocks | emits proposals to blackboard |
| Auto Note Builder | Projects surface activity into Living Notebooks (block-document) | subscribes `block.*` |
| Socio-Ethical | Reviews sensitive representations before render | governance pre-check |

F16 introduces **no new agent**; it is the rendering/persistence substrate the existing ecosystem
acts through.

## 7. Cognitive OS Primitives Used

- **World-State Graph** — the **source of truth**; the surface renders its projection and writes back
  only via typed deltas. The Cognition Block is a typed world-state node.
- **Cognition Packet** — surface actions (create/move/retype/link/select/sketch) and agent rendering
  instructions are typed packets, never bare strings or HTML.
- **Cognitive Event** — every block/projection mutation is an event (`block.*`, `projection.*`,
  `surface.*`).
- **Memory Mutation** — durable artifacts (kept sketches, living notebooks, doc spans, sim states)
  persist *only* through the Memory Mutation Protocol (F05).
- **Reasoning Trace** — every representation/projection/layout choice and every load-governed collapse
  emits a trace.
- **Execution Journal** — deterministic replay of surface state (reuse `@inevitable/execution`).
- **Cognitive Unit ABI / Scheduler / Blackboard / Bus** — agents reach the surface only through F07's
  governed coordination, never via hidden direct render calls.

## 8. Events, Protocols & State Transitions

**The substrate primitive.** `CognitionBlock { id, type, properties: Map<Prop,Value>, children: BlockId[],
parent, provenance }`. One polymorphic atom (Notion-style); `type` is the **block-type registry** key
governing interpretation and rendering. Three **projections** select how a set of blocks is rendered:

1. **Scene-graph projection** — spatial/freeform (whiteboard, diagrams, simulation, slide layout);
   blocks as a tree of property maps `Map<BlockId, Map<Prop,Value>>` (Figma model).
2. **Block-document projection** — linear/rich-text (docs, notes, living books, PDF-as-living-doc);
   ordered `children` form the spine (Notion / ProseMirror-class rich text inside text blocks).
3. **Dataflow-DAG projection** — computational/executable (notebooks, executable diagrams, IDE);
   edges = variable read/write dependencies; deterministic execution order, no hidden state (Marimo).

**Events emitted:**

- `block.created`, `block.updated`, `block.retyped`, `block.moved`, `block.linked`, `block.deleted`
- `projection.rendered`, `projection.switched`, `surface.density.collapsed`
- `blocktype.registered`, `blocktype.deprecated`
- `surface.replay.scrubbed`, `surface.snapshot.created`
- Reuses F09: `surface.rendered`, `surface.reshaped`, `whiteboard.updated`,
  `whiteboard.artifact.created/linked`, `simulation.started/completed`
- Consumes F04 `modality.selected/swapped`; consumes F07 `agent.output.accepted`.

**State transitions:**

1. World-state node created/updated → `block.created/updated` → projection re-renders.
2. Manifestation change → `projection.switched` (same blocks, different render).
3. Block referenced/kept beyond threshold → Memory Mutation consolidates it (F05).
4. Density exceeds working-memory budget → `surface.density.collapsed` (auto-summarize) with trace.
5. Session close → ephemeral blocks decay; durable blocks remain as world-state/memory.

## 9. Memory & World-State Effects

The surface **writes events, not memory.** Block mutations are world-state deltas + events. Durable
persistence is **two-tier**: (a) all actions are ephemeral, replayable session events; (b) a block
becomes a durable **Memory Mutation** only when the learner explicitly keeps it **or** an agent's
consolidation predicate fires with a reasoning trace (e.g., referenced ≥N times, or tied to a
mastered concept). Surface layout is replayable session state, never hidden UI-local truth. This
resolves F09 Open Question #2 (the persistence threshold).

## 10. Governance, Safety, Privacy, Ethics

- **Capability + consent gating:** voice/camera/sensor/immersive block types require a capability
  envelope and granular, revocable consent; minors/institutions default to minimum observation.
- **Agent rendering is governed and typed:** agents emit typed block mutations through the
  cognition-packet/event protocol — **never opaque HTML** — so every rendered element is governable,
  reasoning-traced, and replayable. Executable blocks run in sandboxed iframe/WASM and their effects
  are journaled.
- **Pedagogical integrity:** density and modality are governed by cognitive-load evidence; no
  engagement/fluency-maximizing dark patterns; "acceleration by omission" is a governance violation.
- **Inspect & redact:** a learner can inspect which blocks were remembered and why, and redact them;
  redaction propagates through memory + events.
- **Cognitive safety:** load-governed density caps simultaneous live elements; runaway agent rendering
  is rate-limited by F07 budgets.

## 11. Observability

- **Reasoning trace required** for: representation/projection choice, layout placement of agent
  proposals, and every load-governed density collapse.
- **Telemetry:** block-to-memory ratio, projection-switch friction, density-collapse frequency,
  modality-usefulness (with F04), agent-placement acceptance, accessibility-fallback usage, render
  frame budget adherence.
- **Replay determinism:** **full** for block state, projection, accepted mutations, and event order;
  **trace-level** for generated media binaries (stored as artifact provenance) and for sandboxed
  execution output (recorded at the adapter edge).

## 12. Failure Semantics

| Failure | Behavior |
|---|---|
| WebGPU unavailable | Fall back WebGL2 → Canvas2D → DOM; emit `modality.degraded`; preserve identical learning path |
| Concurrent-edit conflict | Resolve via per-property CRDT/LWW under server-assigned order; unresolved → `disagreement.raised` (F07) |
| Replay divergence detected | Recover from last consistent world-state snapshot; mark replay degraded; CI determinism gate must catch before ship |
| Block-type render handler missing/crashes | Render provenance placeholder + text fallback; emit `blocktype.render.failed` |
| MCCR composer unavailable (no model / offline) | Fall back to the legacy explanation-block + narrated-text path; frame slices stay empty; legacy logs fold deep-equal (ADR-0030) |
| MCCR element renderer missing | Render the element's plain/text form; never block the frame (graceful degradation, ADR-0030) |
| Memory mutation rejected | Keep ephemeral block in session; surface reason if learner-visible |
| Density/perf collapse (too many live media) | Auto-collapse to summaries per load budget; never silently drop without an event |
| Sandboxed execution escape attempt | Terminate sandbox; emit governance event; do not persist effects |

## 13. Architecture Conformance Statement

Restating the subset of the ten non-negotiable laws (blueprint §25.4) F16 must honor:

- **No bare-string / opaque-blob exchange** — blocks and agent rendering instructions are typed
  cognition packets; agents never emit raw HTML into the cognitive store.
- **Event sourcing of all cognition-affecting state** — 100% of cognition-affecting surface actions
  are events; the surface is a projection, never a hidden store.
- **Deterministic replay** — server-ordered event log + commutative reducers + snapshots yield
  byte-identical reconstruction (reuse `@inevitable/execution`).
- **Memory only via Memory Mutation** — durable artifacts pass through F05's protocol.
- **Reasoning traces for cognitive decisions** — representation/projection/layout/collapse choices.
- **Governance on side-effecting capability** — sensor/immersive/executable blocks pass governance;
  consent-scoped.
- **Leases** — surface access to learner context is context/intent-lease-bound.
- **Manifest + identity + envelope** — any executable/agentic block runs as a Cognitive Unit.

## 14. Success Metrics

- **Surface comprehension:** users can explain where they are without instruction (parity with F09).
- **Projection coherence:** switching manifestations preserves block identity and provenance 100%.
- **Replay coverage:** 100% of cognition-affecting surface actions reconstruct byte-identically.
- **Render budget:** target 60fps interaction; bounded node counts per the performance budget
  (research §Part 6) on commodity hardware.
- **Block-to-memory precision:** durable blocks remain useful after one week (parity with F09).
- **Depth not fluency:** R8 reshapes correlate with F14 mastery gains, **not** with session dwell time
  (guards against the fluency illusion, research §S3/§S4).
- **Accessibility parity:** every block type has a verified non-immersive, low-bandwidth fallback.

## 15. MVP → Advanced → Frontier Phasing

- **MVP:** Cognition Block + block-document & scene-graph projections; block-type registry; DOM +
  Canvas2D render; surface as projection client of `@inevitable/world-state` + `@inevitable/events`;
  whiteboard-as-artifact; select-to-expand; reasoning-trace + replay scrubber wired to the existing
  event log. Manifestations R2 → R1 → R3 (basic). Aligns with F09 MVP.
- **Advanced:** CRDT collaboration + presence; WebGPU spatial render; dataflow-DAG projection
  (notebooks); living notebooks; document split-pane; classroom whiteboard; load-governed density;
  multi-agent placement (F07). Manifestations R5, R7, R8. Aligns with F09 Advanced.
- **Frontier:** sandboxed IDE / pair-programming co-editor blocks; physically-grounded simulation;
  voice blocks with auto-documentation; AR/VR/holographic projection (accessibility-parity enforced,
  justified only by intrinsic-load reduction per concept). Manifestations R4, R6. Aligns with F09
  Frontier.

## 16. Open Questions

- **CRDT library + canonical-order protocol** (Yjs vs. Automerge vs. Loro; how server-assigned order
  feeds `@inevitable/events`) — warrants an ADR under `spec/architecture-decisions/` co-owned with
  the world-state and events domains (the central collab-vs-replay tension, research §Part 4/§Part 6).
- **Block-type registry governance** — who may register a block type, and how render handlers are
  versioned/sandboxed/audited.
- **Load-governed density policy** — the exact working-memory/element-interactivity budget function
  and how it adapts with expertise (research §S6).
- **Boundary with F04** — does the block carry the modality, or does F04 own it and F16 only render?
  (Proposed: F04 *selects*, F16 *renders*; the block records the selection + trace.)
- **Sandboxing model for executable/IDE blocks** — iframe vs. WASM vs. micro-VM; effect-journaling
  granularity for replay (D3/D4).

## 17. References

- **Research dossier:** [`spec/research/cognitive-surface-frontier-research.md`](../../research/cognitive-surface-frontier-research.md)
  and its commission [`spec/research/cognitive-surface-deep-research-prompt.md`](../../research/cognitive-surface-deep-research-prompt.md).
- [`../Broader-feature-product.md`](../Broader-feature-product.md) §11, §11.1, §14.
- [F09](./F09-living-universe-experience.md) (experience/immersive — F16 is its substrate),
  [F04](./F04-adaptive-multimodal-explanation.md) (modality selection/DSP),
  [F07](./F07-realtime-cognitive-orchestration.md) (arbitration/placement),
  [F15](./F15-content-ingestion-knowledge-substrate.md) (ingestion/select-to-expand),
  [F05](./F05-persistent-cognitive-memory.md) (memory).
- `spec/world-state/world-state-graph.md`, `spec/execution/cognitive-execution-engine.md`,
  `spec/replay/deterministic-replay.md`, `spec/events/event-taxonomy.md`.
