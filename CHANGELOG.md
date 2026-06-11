# Changelog

All notable changes to The Inevitable are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/); the project uses Conventional Commits.

Entries are **milestone-level abstractions** — what shipped and why it matters, a short
paragraph or a few bullets per milestone. Implementation detail lives in the owning specs and
`docs/history/implementation-log.md`; current codebase state lives in `IMPLEMENTATION.md`.

## [Unreleased]

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
