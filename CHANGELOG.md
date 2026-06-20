# Changelog

All notable changes to The Inevitable are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/); the project uses Conventional Commits.

Entries are **milestone-level abstractions** — what shipped and why it matters, a short
paragraph or a few bullets per milestone. Implementation detail lives in the owning specs and
`docs/history/implementation-log.md`; current codebase state lives in `IMPLEMENTATION.md`.

## [Unreleased]

> **Phase 2 (Identity, Continuity & Context) is complete** — P2.1 through P2.6.

### Added — Phase 2 (P2.6): Capability Registry — the governance immune system

- **Capabilities can now be granted and revoked dynamically at runtime.** A fine-grained
  `CapabilityRegistry` (`@inevitable/kernel`) tracks individual named capabilities per subject
  (grant/revoke/has/granted/list, revoked grants retained for audit) — complementing the coarse,
  all-or-nothing capability *envelope*. Authored **spec/kernel/capability-registry.md** + **ADR-0014**.
- **Governance consults it on every dispatch (GOV-P03), opt-in by presence.** A new policy blocks a
  dispatch whose required capability (`dispatch.<agentId>`) is revoked/absent — but only when the request
  carries a `capabilities` context, so paths with no registry wired are unaffected. `buildDemoSession`
  grants the learner the dispatch capabilities and threads the registry through every dispatcher; revoking
  one immediately blocks that agent's next dispatch (the cycle degrades gracefully). In-memory for now
  (durable grants deferred).

### Added — Phase 2 (P2.5): Intent Inference — goal → a real intent lease

- **The intent lease now reflects the learner's actual goal.** A governed, model-backed
  `IntentInferenceUnit` (`agent.intent`, deterministic fallback) interprets the goal into
  `{interpreted_goal, scope, constraints, confidence}` and re-interprets the session intent lease **in
  place** (stable `intent_id` = surface `session_id`), emitting `intent.received` → `intent.interpreted`.
  This replaces the hardcoded, goal-independent placeholder, satisfying the architecture law in substance.
  Authored **spec/kernel/intent-inference.md** + **ADR-0013**. The gateway calls `inferIntent` best-effort
  (never altering the untrusted-degradation path). Boundary: interprets + binds the lease; driving
  curriculum/retrieval from the interpreted goal/scope is a follow-up.

### Added — Phase 2 (P2.4): Context-Lease-Bounded Retrieval — durable knowledge made retrievable

- **A learner's durable knowledge is now retrieved on demand, bounded by their context lease.** New
  package `@inevitable/context`: a `ContextAssembler` does VectorStore-backed semantic retrieval over the
  learner's durable memory and assembles a bounded `WorkingMemoryContext` under the session `ContextLease`
  — fail-closed bounds (tier, user, token budget, expiry; exclusions counted). A deterministic local
  embedding keeps retrieval offline and replay-safe. Authored **DPS-005** (`spec/persistence/`) +
  **ADR-0012**. `buildDemoSession.assembleContext(query)` indexes the durable tiers, assembles, and writes
  admitted items into the `working` tier (distributed; session scratch); the gateway calls it each ask.
  Boundary: retrieves/bounds/assembles — *consuming* it in agent prompts is P3 (adaptive prompting).

### Added — Phase 2 (P2.3): Shared Per-Learner Cognitive Memory — continuity of *cognition*

- **A returning learner's new surface now draws on prior mastery.** Until now each surface was
  cognitively blank even for a known learner — the supervisor re-taught already-mastered concepts. A
  per-learner **cognition profile** (the learner's mastery subgraph + durable-tier memory) is now
  captured across surfaces and **seeded** into a new surface at create, so the supervisor routes an
  already-mastered concept to `complete` on the very first ask. Authored **DPS-004 — Shared Per-Learner
  Cognitive Memory** (`spec/persistence/`) and **ADR-0011**. This is the moment "persistent cognitive
  memory of each learner" becomes literally true *across* sessions, and the substrate on-ramp to the
  Digital Twin (P5).
- **The cut follows the tier semantics.** Only durable knowledge carries — mastery checkpoints (scoped
  by `ownerUserId`), the concepts they verify, and `semantic`/`procedural`/`reflective` memory. Session
  scratch (`working`/`episodic`) and per-surface block/timeline state never leak across surfaces.
- **Capture-then-seed, around the canonical record, never in it.** After each `ask` the learner-durable
  subset is extracted and merged (idempotent, id-keyed) into the profile held in the `LearnerRegistry`
  (in memory always; on disk at `<dir>/learners/<id>.cognition.json`). Seeding runs before `start()` and
  emits no `surface.*` event — silent state reconstruction, the same discipline as DPS-002
  `hydrate`/`restore`; seed and `restore` are mutually exclusive (create seeds, resume restores).
- **Proven in memory and across a restart.** Cross-surface carry works within one process and across a
  simulated restart (profile loaded from disk); a brand-new learner still starts blank. `pnpm verify`
  stays green fully offline; shared cognition rides on the opt-in `COS_PERSIST_DIR` for durability.

### Added — Phase 2 (P2.2): Durable Learner Identity — continuity of *who*

- **Learners are now first-class and durable.** The hardcoded single demo learner (every user shared
  one identity, surfaces belonged to no one) is replaced by a durable `LearnerRegistry`: a learner is
  `{ learnerId, cid, trustLevel, surfaces[] }`, minted once and resolved on return. A known `learnerId`
  reuses the **same** identity (cid + trust) across a process restart; an unknown id is never claimed
  (no spoofing). Authored **DPS-003 — Durable Learner Identity & Resume-by-Learner** + **ADR-0010**.
- **The real learner is threaded through the governed substrate.** `onboarding()` is now
  learner-parameterized (ids derived from the learner, not hardcoded); the surface's world-state learner
  node and the dispatch governance gate use the learner's own `cid`/`trust_level`. The demo learner
  remains the default for the CLI and tests.
- **Resume-by-learner.** New `GET /api/learner/:learnerId` returns the learner profile + the surfaces
  they own; `POST /api/surface` accepts a `learnerId` and returns the owning `learner_id`. Rehydration
  loads the learner so a resumed surface keeps the correct identity and trust.
- **Fixed a latent id-collision bug.** Gateway-hosted surfaces now use a `CryptoIdGenerator` — the
  seeded generator is seed-independent, so the previous "unique seed per surface" intent actually minted
  identical surface ids; concurrently-hosted surfaces would have collided.

### Added — Phase 2 (P2.1): Cognitive Continuity — a restored surface comes back alive

- **A surface now survives a restart *and keeps going*.** DPS-001 could reconstruct a surface read-side;
  this closes the deferred gap so a restored surface is **live** — a new `ask`/`expand` is accepted and
  appends fresh cognition exactly where the learner left off. Authored **DPS-002 — Cognitive Continuity
  & Rehydration** (`spec/persistence/`) and **ADR-0009**.
- **Three substrates restored from their own durable artifacts.** Added `EventBus.hydrate()` (load a
  durable event log into a fresh bus *without* re-delivery, validation, or governance — they were
  applied at first publish), `SurfaceSession.resume(surfaceId)` (adopt the persisted id without
  re-emitting `surface.created`), and a `buildDemoSession` restore path that injects a restored
  world-state snapshot + replayed memory mutations + the hydrated event log. World-state and memory are
  each event-sourced on their own logs (not the bus), so their snapshots are persisted alongside it.
- **Resumed sessions use a `CryptoIdGenerator`.** Replay determinism is already guaranteed by the
  recorded events; the resumed session only needs globally-unique ids for *new* cognition, so random
  UUIDs are used — no fragile id-counter state to persist, no collisions with recorded ids.
- **The gateway upgrades a restored surface to live.** With `COS_PERSIST_DIR` set it persists
  `world.json` + `memory.json` after each command and, on a cold-miss, rehydrates a live session
  (restore + hydrate + `resume`), falling back to DPS-001 read-side reconstruction only when the
  snapshots are absent or corrupt. Proven: a new ask after a simulated restart appends fresh cognition
  with prior state intact and no id collisions.

### Added — Phase 2E: Durable Substrate — the floor under event sourcing

- **The substrate now has a persistent existence independent of any process.** Following a
  Chief-Architect gap analysis, the highest-leverage gap was that all state — event log, world-state,
  memory, media — was in-memory, so a restart was total data loss and the COS's own invariants (event
  sourcing, replay, persistent learner memory) held only within one process lifetime. Authored
  **DPS-001 — Durable Cognitive Persistence** (`spec/persistence/`) and **ADR-0008**: the event log is
  the unit of durability (world-state/memory are replay projections of it); out-of-band media is
  persisted separately; durability is a sink, never part of the canonical record.
- **A pure-`node:fs` durable backend behind the existing contracts.** Added `FileEventTransport`
  (append-only JSONL, per-subject sequence, ordered replay) to `@inevitable/adapters` — zero native or
  third-party dependencies, fully offline and Windows-safe, validated by the *same* `EventTransport`
  conformance harness as the in-memory reference. Added a `FileMediaStore` for out-of-band audio.
  In-memory stays the reference semantics and the default; Postgres/NATS remain swappable later behind
  the same contracts.
- **Cross-process surface recovery.** When `COS_PERSIST_DIR` is set, the Surface Gateway mirrors every
  surface event to a per-surface durable log and narration audio to disk, and reconstructs a surface
  **read-side** after a restart (the server now talks to a `ServedSurface` seam, so live and restored
  surfaces are interchangeable). Proven: a fresh gateway over the same directory folds the durable log
  to a **byte-identical** `SurfaceState`, and out-of-band audio still resolves. Live write-continuity
  after restart (world-state rehydration) is deferred to the next phase (Identity, Continuity & Context).

### Added — Phase 2D: The Cognitive Stage — synchronized, narrated, visible cognition

- **The surface became a theater of thought, not a dashboard.** Following a deep product-experience
  review (a live study of OpenMAIC + the Cognitive Surface research corpus), `apps/web` was rebuilt
  as the **Cognitive Stage**: one central stage spotlights the concept being understood; a
  living-timeline spine lights up in sync; an agent-presence ensemble shows each cognitive unit as a
  character (geometric sigils, not cartoons); provenance ("why this appeared") is one tap away; and a
  narration track with transport sits below. A premium, restrained "cognitive instrument" design
  language (deep observatory palette, editorial serif, light-models-attention, motion only to direct
  attention) replaces the generic 3-column layout.
- **Cognition is now synchronized and attention-directed.** Added a choreography sub-family to
  `surface.*` (schema 1.1.0): `surface.narration.segment`, `surface.focus.changed`,
  `surface.presence.updated`, folded into a new choreography slice (`narration`/`focus`/`presence`).
  A runtime `SurfaceChoreographer` narrates the generated explanation segment-by-segment with focus
  + presence, and **re-narrates on interactive `expand()`**. A client `useChoreographer` paces the
  unfolding (a pure projection that owns no truth).
- **The classroom is live and interactive, never a frozen lesson.** Codified as a core principle
  (SRF-001 §2; F16 non-goal): explanations are **generated dynamically on demand** (model-backed,
  Gemini), the learner can interject at any moment, and the surface re-explains. *Generation* is
  live and adaptive; *replay* stays byte-exact (recorded outputs) — the explicit contrast with
  OpenMAIC's pre-generated deck.
- **The surface speaks.** Added Gemini voice (`GeminiVoiceRuntime` + deterministic `NullVoiceRuntime`
  in `@inevitable/adapters`): narration audio is served **out-of-band** via a new gateway media route
  (`GET /api/surface/:id/media/:artifactId`); events carry only a reference + duration, bytes never
  touch the stream. Authored **ADR-0007 — Surface Choreography & Timing** (logical cues + client
  playback clock; audio duration as ground truth; binaries out-of-band; recorded for replay) and
  updated SRF-001/002/004/005, F09/F16.

### Added — Phase 2D (in progress): Curriculum Generation & Live Gemini

- **Any goal now yields its own living timeline.** Added `CurriculumUnit`
  (`@inevitable/product-cognition`) — the F02/F03 curriculum agent that turns a learner goal into a
  prerequisite-ordered concept DAG, dispatched through the **same governed path** as every unit
  (privileged agent, GOV-P01 trust ≥ 3; governance gate, scheduler, OTel span, D3 recording all
  apply). Model-backed with an inline deterministic scaffold fallback, so offline/seeded runs still
  produce a real, deterministic timeline. The Surface Gateway generates a curriculum per goal
  instead of the seeded Neural-Networks DAG. Spec: PCR §12.
- **Real Gemini cognition wired end-to-end.** `.env` loading (a zero-dependency loader in
  `apps/api` and `apps/cli`; `GEMINI_API_KEY`), `@google/genai` provisioned at the workspace root
  (edge-provisioned per ADR-0005, guarded dynamic import — never a substrate dependency). With a key
  present, explanations/practice and generated curricula are real `gemini-2.5-flash` cognition
  recorded as `model.*` events (D3); without it, the deterministic NullModelRuntime runs the
  identical governed path.

### Added — Phase 2C: The Visible Surface

- The Cognitive Surface is now **visible and live in a browser** — the first moment a human can
  open The Inevitable and watch it think. The runtime stays the product; the UI is a projection.
- Authored **SRF-005 — Surface Streaming & Sync Protocol** (`spec/surface/surface-streaming-sync-protocol.md`)
  and **ADR-0006 — Surface Gateway Transport**: events stream down via SSE (frame `id` = bus
  sequence, `Last-Event-ID` resume), typed commands flow up via HTTP POST through the governed
  dispatch path; the client folds the stream with the *same* `foldSurfaceEvents` the runtime uses,
  so replay equivalence (client fold ≡ server state) is a contract, never client-owned truth.
  Codified three principles: the surface is a runtime not a UI, rendering is provider-agnostic,
  and a cognitive environment is entered (not a prompt→response exchange). Registered a `gateway.*`
  boundary-observability event family (recorded-observation, never folded into canonical state).
- Added `@inevitable/api` — a zero-dependency `node:http` **Surface Gateway** that hosts persistent
  surface sessions, streams `surface.*` over SSE, and routes a typed command envelope
  (`ask | expand | close`, extensible) through governance. In-process tests prove fold≡state,
  sequence ordering, resume, the governed boundary, and command extensibility.
- Added `@inevitable/web` — a **Vite + React** viewport that folds the live stream
  (`@inevitable/surface/client`, a new browser-safe export) and renders it as regions (living
  timeline · cognition stream · provenance inspector) via a **block-renderer registry keyed by
  `block_type`** — provider-agnostic, with multimodal types rendering typed placeholders so future
  media is additive, not a rewrite. `pnpm dev:gateway` + `pnpm dev:web`.

### Added — Phase 2B: Real Cognition on the Surface

- Authored the **Model Invocation Protocol** (`spec/protocols/model-invocation-protocol.md`):
  the only sanctioned way a cognitive unit invokes a generative model — record-before-use,
  replay-never-invokes, fail-closed on a replay miss. Registered the `model.*` event family
  (permanent, replayable) and realized determinism level **D3** from the replay spec.
- Added model runtime adapters in `@inevitable/adapters`: deterministic `NullModelRuntime`,
  `GeminiModelRuntime` (first real provider, guarded dynamic import of the Gemini SDK — never a
  workspace dependency), and `RecordingModelRuntime` (the D3 recording seam with record/replay
  modes).
- Added `ModelBackedUnit` to `@inevitable/product-cognition`: real model-generated
  explanation/practice/assessment cognition through the **same** governed dispatch path
  (governance gate, scheduler admission, OTel span), with layered output (F04 layers 0–1),
  populated reasoning traces, and visible deterministic fallback on model failure.
- Added progressive deepening to `@inevitable/surface`: `SurfaceSession.expand(blockId, layer)`
  re-dispatches through the governed explanation dispatcher and emits
  `surface.explanation.expanded` — the typed modification the fold merges into the block.
- Added `apps/cli` + `pnpm demo` — the first runnable manifestation: a living Cognitive Surface
  in the terminal (timeline, blocks, supervisor decisions, expansion, trace) over Gemini when
  `GEMINI_API_KEY` is set, or the deterministic null model otherwise.
- D3 acceptance proven in tests: a seeded record run replayed from its `model.output.recorded`
  events reproduces a byte-identical surface frame without ever re-invoking the provider.

### Added — Phase 2A: Cognitive Surface Runtime

- Authored the Phase 2A surface spec suite under `spec/surface/`:
  `cognitive-surface-runtime.md` (SRF-001 — cognition blocks, surface state as a deterministic
  fold over the `surface.*` event log, session/projection/renderer separation),
  `surface-event-architecture.md` (SRF-002 — the 16-subtype `surface.*` event family, permanent
  retention, replayable), `surface-timeline-engine.md` (SRF-003 — timeline as a pure projection of
  world-state concept DAG + mastery checkpoints), and `multimodal-provider-abstraction.md`
  (SRF-004 — image/video/voice/live/multimodal provider adapters with a deterministic
  NullProvider; no vendor SDKs).
- Added `@inevitable/surface`, the first product manifestation package: typed `CognitionBlock`
  creation with mandatory provenance, `SurfaceTimelineBuilder` (wraps `LearningPathProjector`;
  Kahn-ordered, mastery-aware status derivation), `foldSurfaceEvents` pure event-fold projection,
  `AgentContributionRuntime` (agent.joined / block.generated / agent.contributed),
  `traceBlock` provenance resolver (block → events → packet → agent → world-state → memory),
  `TextSurfaceRenderer`, `ProviderRegistry` + `NullMultimodalProvider`, and `SurfaceSession`
  composing `FiberedLearningLoop` end-to-end ("Teach me Neural Networks" acceptance flow).
- Registered the `surface.*` family in `spec/events/event-taxonomy.md` and the retrieval indexes
  (`spec/indexes/event-index.md`, `spec/indexes/dependency-graph.md`).

### Added — Phase 1E: Governance Dispatch Gate & Confidence Routing

- Wired `@inevitable/governance` into `ProductRuntimeDispatcher`: GOV-P01 trust gate and GOV-P02
  classification gate evaluate every product dispatch before scheduler admission; denials emit
  governed decision records instead of executing.
- Added confidence-weighted supervisor routing: a passing mastery checkpoint below the
  `MASTERY_CONFIDENCE_THRESHOLD` (0.6) routes to revision instead of complete.

### Added — Cognitive Surface: Deep Research & F16 Feature Spec

- Authored **F16 — The Cognitive Surface — Universal Multimodal Substrate**
  (`spec/product/features/F16-cognitive-surface.md`), a cross-cutting feature spec defining the
  convergent multimodal substrate from which the whiteboard, living document, presentation,
  Canva/Word-class authoring canvas, notebook, knowledge-graph explorer, simulation stage, and
  (long-horizon) IDE co-editor are all *projected*. Core decision: a single typed **Cognition Block**
  primitive rendered three ways (scene-graph / block-document / dataflow-DAG), synced as a
  per-property CRDT, and journaled as events so the surface is a deterministically-replayable,
  governed projection of the world-state graph. Agents render via *typed mutations*, never opaque HTML.
- Added the deep-research dossier `spec/research/cognitive-surface-frontier-research.md` (31 sources;
  primary-source-graded findings across cognitive science, tools-for-thought lineage, substrate
  teardowns, the collaboration-vs-replay tension, rendering, AI-native UI, and immersive horizons)
  and its reusable commission `spec/research/cognitive-surface-deep-research-prompt.md`.
- Propagated F16 across the spec system: master PRD §7/§11/§15/§20 and frontmatter, `CLAUDE.md` and
  `CODEX.md` feature catalogs, `spec/product/README.md`, `spec/product/features/README.md`, and the
  retrieval index `spec/indexes/product-feature-index.md`; cross-linked F09 ↔ F16 (experience ↔ substrate).

### Added — Product Topology Setup

- Completed the product feature-spec suite under `spec/product/features/` (F01-F15), covering the
  first product-cognition slice, agent ecosystem, orchestration, interdisciplinary graph, immersive
  surface, research/innovation, institutional intelligence, governed evolution, identity/modes,
  mastery/depth verification, and content ingestion.
- Normalized the canonical master-vision reference to
  `spec/vision-application/The_Inevitable_Master_Vision.md`; retained
  `Ambition-deep-committments.md` as a compatibility pointer for older links.
- Updated Phase 1D/Phase 1E continuity docs so future work starts from product-cognition
  implementation rather than re-authoring the feature catalog.

### Added — Phase 1E: Product Cognition Runtime

- Added `@inevitable/product-cognition`, the first bridge package from product features to the
  completed Cognitive OS substrate.
- Added F01/F13 onboarding/session initialization over kernel identity, capability envelopes,
  context leases, intent leases, world-state, semantic memory, and onboarding events.
- Added F02/F03 deterministic learning-path projection into `@inevitable/world-state`, preserving
  prerequisite DAG acyclicity through the graph package.
- Added F06 minimal agent manifest catalog validated by the existing runtime manifest loader.
- Added runtime-hosted product dispatch: product intents now become `CognitionPacket` +
  `CognitiveWorkItem` pairs, pass through `DepthScheduler`, and execute a deterministic MVP unit via
  `CognitiveUnitHost`.
- Added `DeterministicLearningLoop`, composing graph-backed path projection, explanation dispatch,
  practice dispatch, and mastery checkpoint recording into the first no-LLM learning loop.
- Added F14 mastery checkpoint recorder that emits graph state, semantic memory mutations, and
  `mastery.*` events.

### Added — Phase 1D: Substrate Deepening

- `@inevitable/execution`: deterministic execution engine, cooperative cognitive fibers, closed
  effect set, append-only execution journal, and replay-oriented lineage safety.
- `@inevitable/world-state`: typed world-state deltas, materialized graph view, path/neighbor/type
  queries, DAG edge enforcement, snapshots, and subscriptions.
- `@inevitable/memory`: expanded tiered memory store with per-tier mutation logs, projections,
  reinforcement/decay mutations, redaction, and subscription fanout.
- `@inevitable/scheduler`: depth scheduler with preemption, weighted fairness, budgets, and
  observable backpressure/load-shedding.
- `@inevitable/adapters`: in-memory reference adapters, backend-agnostic conformance harness, and
  dependency-optional NATS/Qdrant/Neo4j/Postgres adapter boundaries.
- `@inevitable/data-plane`: dependency-optional OTel bootstrap and bus-to-observability sink bridge.

### Added — Phase 1C: Foundational Infrastructure

- Monorepo foundation: pnpm workspaces + Turborepo, strict TypeScript (ESM), Vitest, ESLint 9,
  Prettier, Husky + commitlint, GitHub Actions CI (ADR-0004).
- `@inevitable/shared`: branded identifiers, `Result`, hybrid logical clock, injectable `Clock`,
  typed error hierarchy, spec-traceability helpers.
- `@inevitable/protocols`: canonical JSON Schemas (Draft 2020-12) extracted from the Phase 1B specs,
  schema registry, ajv validators, generated TypeScript types, and a conformance/contract test harness.
- `@inevitable/observability`: OpenTelemetry-aligned cognitive trace envelope, correlation/cognition
  trace IDs, structured logger.
- `@inevitable/events`: event envelope + family registry, replay-safe in-memory bus with dead-letter
  handling, governance interceptor hook.
- `@inevitable/kernel`: identity, capability envelope, context/intent lease services with in-memory
  registries and governance hooks.
- `@inevitable/governance`: policy interface, decision records, priority-ordered evaluation engine,
  enforcement middleware, default policies.
- `@inevitable/runtime`: cognitive-unit ABI interface, 13-state lifecycle FSM, manifest loader.
- Interface scaffolds: `@inevitable/scheduler`, `@inevitable/memory`, `@inevitable/orchestration`,
  `@inevitable/contracts`, `@inevitable/tooling`.

### Added — Phase 1B: Kernel, Protocols, Events & Runtime Specs

- Foundational specs for kernel primitives, kernel-internals syscalls, core protocols, event
  taxonomy, and the cognitive-unit runtime; ADR-0003 (tech stack). See
  `spec/implementation-roadmaps/phase-1b-kernel-protocols-runtime.md`.
