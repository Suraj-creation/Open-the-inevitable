# The Inevitable Implementation Skeleton

This repository is transitioning from completed Phase 1D substrate deepening into Phase 1E product
cognition implementation. Phases 1A–1D are complete: spec infrastructure, kernel/protocol/event/runtime
specs, foundational packages, deterministic execution, world-state graph, memory tiers, scheduler
depth, infrastructure adapters, and the OpenTelemetry edge. See
`spec/implementation-roadmaps/phase-1c-package-contracts.md` and
`spec/implementation-roadmaps/phase-1d-substrate.md`.

The canonical **product specification** now lives at `spec/product/Broader-feature-product.md` (with a
complete feature catalog under `spec/product/features/`). Read it before any product/feature/agent/
pedagogy/memory/orchestration work — it maps every product capability onto the COS primitives below.

## Developer Quickstart

```bash
corepack enable                # or: npm i -g pnpm@9.15.0
pnpm install
pnpm codegen                   # generate TS types from canonical JSON Schemas
pnpm verify                    # codegen + typecheck + test + lint + format:check
```

Per-package: `pnpm --filter @inevitable/<name> run {typecheck,test,lint}`. Tooling decisions are
recorded in `spec/architecture-decisions/ADR-0004-monorepo-and-tooling.md`.

The codebase must not treat the current architecture notes as competing foundations. `spec/advanced-agent-architecture.md`, `spec/next-generation-cognitive-operating-system-blueprint.md`, `spec/spec-folder-ecosystem.md`, and `spec/vision-application/*` are complementary references governed by the spec system.

Implementation begins as a cognitive operating system substrate, not as a conventional AI app.

## Current Boundary

The current structure establishes the code ownership map only:

- `apps/` contains user-facing and API surfaces.
- `packages/` contains reusable cognitive OS primitives.
- `services/` contains deployable control-plane and data-plane services.
- `infrastructure/` contains environment, deployment, and operations assets.
- `tests/` contains verification suites across units, integration, replay, governance, and failure modes.
- `tools/` contains developer and spec automation.

Phase 1C has implemented the foundational packages under `packages/` (see traceability map below).
Each package derives from its governing spec; JSON Schema is the canonical contract form (ADR-0003).

## Implementation Traceability (Phase 1C)

| Package | Spec domain | Key contracts |
|---|---|---|
| `@inevitable/shared` | kernel/cognitive-identity, replay | branded ids, Result, HLC, Clock, errors |
| `@inevitable/protocols` | protocols/\*, events/event-taxonomy | 16 JSON Schemas, registry, ajv validator, codegen |
| `@inevitable/observability` | observability/cognitive-observability | trace envelope, structured logger, OTel bridge, metrics |
| `@inevitable/events` | protocols/cognitive-event, communication/UCB | event factory, family registry, replay-safe bus, dead-letter |
| `@inevitable/governance` | kernel/governance-kernel | policy engine, decision records, enforcement middleware |
| `@inevitable/kernel` | kernel/\* | identity, capability envelope, context/intent leases |
| `@inevitable/runtime` | runtime/cognitive-unit-runtime, protocols/cognitive-unit-abi | lifecycle FSM, ABI, manifest loader, unit host |
| `@inevitable/scheduler` | kernel/cognitive-scheduler, scheduler/cognitive-scheduling | priority queue + DepthScheduler (preemption/fairness/budgets/backpressure) |
| `@inevitable/memory` | protocols/memory-mutation, memory/memory-tiers | validating store + TieredMemoryStore (tiers/projections/decay/distribution) |
| `@inevitable/orchestration` | orchestration/\* | versioned blackboard (foundation) |
| `@inevitable/contracts` | infrastructure adapters (ADR-0003) | transport/graph/vector/model/tool adapter interfaces |
| `@inevitable/tooling` | tooling/, developer-experience/ | schema/protocol introspection |
| `@inevitable/product-cognition` | product/product-cognition-runtime, product/features/F01/F02/F03/F04/F05/F06/F07/F13/F14 | onboarding/session initialization, learning-path projection, MVP agent manifests, runtime dispatch, deterministic learning loop, mastery checkpoints |

### Phase 1D additions

| Package / Service | Spec domain | Key contracts |
|---|---|---|
| `@inevitable/execution` | execution/cognitive-execution-engine, replay/deterministic-replay | deterministic execution engine + cooperative cognitive fibers + execution journal |
| `@inevitable/world-state` | world-state/world-state-graph | world-state delta protocol, materialized graph, acyclic prerequisite enforcement, snapshots |
| `@inevitable/adapters` | interop/infrastructure-adapters (ADR-0005) | in-memory reference adapters + conformance harness; NATS/Qdrant/Neo4j/Postgres (edge-provisioned) |
| `@inevitable/data-plane` (service) | telemetry/otel-edge, data-plane/ | OTel SDK bootstrap (edge) + bus→OTel observability-sink bridge |

## Implementation Doctrine

Every implementation unit must be traceable to:

1. A spec domain.
2. A protocol or event contract where applicable.
3. An observability contract.
4. A failure-mode contract.
5. A verification strategy.

If a stronger design is discovered through research or local reference repositories, update the spec first, document the decision, then implement.

## Phase 1D (delivered, `pnpm verify` green)

Whole-monorepo verify passes: **17/17 typecheck, 17/17 test, 16/16 lint, format clean** across 16
packages + 1 service. Spec-first throughout (owning specs written/updated before code). Delivered:

1. **Deterministic execution engine + cognitive fibers** (`@inevitable/execution`) — cooperative
   coroutines, closed effect set, append-only execution journal, byte-identical replay (D2),
   loop-limit + fail-fast lineage safety. Spec: `spec/execution/`, `spec/replay/`.
2. **World-state graph** (`@inevitable/world-state`) — typed delta protocol, materialized view,
   neighbor/type/path queries, acyclic prerequisite enforcement, snapshot/restore. Spec: `spec/world-state/`.
3. **Memory tiers** (`@inevitable/memory`) — `TieredMemoryStore` with per-tier logs, projections,
   reinforcement/decay as mutations, redaction, and subscription-based real-time distribution.
   Spec: `spec/memory/memory-tiers.md`.
4. **Scheduler depth** (`@inevitable/scheduler`) — `DepthScheduler` with preemption, weighted
   fairness, per-requester budgets, and backpressure/load-shedding. Spec: `spec/scheduler/`.
5. **Infrastructure adapters** (`@inevitable/adapters`) — in-memory reference adapters + a
   backend-agnostic conformance harness (the in-memory bus is the reference semantics), plus
   dependency-optional NATS/Qdrant/Neo4j/Postgres adapters (edge-provisioned). ADR-0005; `spec/interop/`.
6. **OTel edge** (`services/data-plane`) — dependency-optional OTel SDK bootstrap + a bus→OTel
   observability-sink bridge. Spec: `spec/telemetry/otel-edge.md`.

### Product topology setup (delivered, 2026-06-03)

The complete product feature-spec suite now exists under `spec/product/features/`:

- F01-F05: onboarding, navigation, prerequisites, adaptive explanation, persistent memory.
- F06-F12: agent ecosystem, real-time orchestration, interdisciplinary graph, living-universe
  experience, research/innovation acceleration, institutional intelligence, governed evolution.
- F13-F15: identity/personas/modes, assessment/mastery/depth verification, content ingestion and
  universal knowledge substrate.
- F16: **The Cognitive Surface — Universal Multimodal Substrate** — the convergent surface from which
  all manifestations (whiteboard, living document, presentation, authoring canvas, notebook,
  knowledge-graph explorer, simulation, and long-horizon IDE co-editor) are projected. Backed by the
  deep-research dossier `spec/research/cognitive-surface-frontier-research.md`. Spec-only; intentionally
  not yet implemented (no UI package exists — `@inevitable/product-cognition` remains no-UI/no-LLM).

The canonical master-vision file is
`spec/vision-application/The_Inevitable_Master_Vision.md`; the old
`Ambition-deep-committments.md` path remains only as a compatibility pointer.

### Phase 1E initial runtime bridge (started, 2026-06-03)

`@inevitable/product-cognition` now provides the first product-cognition runtime package:

- `ProductOnboardingService` initializes F01/F13 learner sessions through Cognitive Identity,
  Capability Envelope, Context Lease, Intent Lease, world-state learner/intent nodes, semantic seed
  memory, and onboarding events.
- `LearningPathProjector` projects F02/F03 concept/prerequisite DAGs into `@inevitable/world-state`
  and relies on graph acyclicity enforcement for prerequisite safety.
- `MVP_AGENT_MANIFESTS` exposes schema-valid F06 manifests for Supervisor, Curriculum, Explanation,
  Practice, Assessment, Revision, and Memory agents.
- `ProductRuntimeDispatcher` and `DeterministicMvpUnit` convert product intents into
  `CognitionPacket` + `CognitiveWorkItem` pairs, admit them through `DepthScheduler`, and execute
  one runtime-hosted MVP agent through `CognitiveUnitHost`.
- `DeterministicLearningLoop` composes learning-path projection, explanation dispatch, practice
  dispatch, and mastery recording into the first no-LLM explanation/practice loop.
- `MasteryCheckpointRecorder` records F14 mastery checkpoints as world-state nodes/edges, semantic
  memory mutations, and `mastery.*` events.

### Next (Phase 1E)

Add packet-level trace capture, runtime-hosted supervisor routing across the MVP agent set, and
governed model-output recording at the adapter edge for deterministic replay D3/D4.
