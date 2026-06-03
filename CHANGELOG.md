# Changelog

All notable changes to The Inevitable are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/); the project uses Conventional Commits.

## [Unreleased]

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
