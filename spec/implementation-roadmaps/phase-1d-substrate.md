# Phase 1D — Substrate Deepening Roadmap

## Goal

Turn the Phase 1C package foundations into the executable **cognitive substrate** the product pillars
run on: deterministic execution, a unified world-state graph, tiered distributive memory, a real
scheduler, swappable infrastructure adapters, and telemetry at the deployment edge. Implementation
remains subordinate to specs (spec-first): each owning spec was written/updated before its code.

## Scope & Owning Specs

| Capability | Owning spec(s) | Package / Service |
|---|---|---|
| Deterministic execution engine + cognitive fibers | `spec/execution/cognitive-execution-engine.md`, `spec/replay/deterministic-replay.md` | `@inevitable/execution` |
| World-state graph + delta protocol | `spec/world-state/world-state-graph.md` | `@inevitable/world-state` |
| Memory tiers, consolidation, decay, distribution | `spec/memory/memory-tiers.md` | `@inevitable/memory` (expanded) |
| Scheduler depth (preemption/fairness/budgets/backpressure) | `spec/scheduler/cognitive-scheduling.md` | `@inevitable/scheduler` (expanded) |
| Infrastructure adapters + conformance harness | `spec/architecture-decisions/ADR-0005-infrastructure-adapters.md`, `spec/interop/infrastructure-adapters.md` | `@inevitable/adapters` |
| OpenTelemetry edge wiring | `spec/telemetry/otel-edge.md` | `services/data-plane` |

## Completed in This Pass (2026-06-03)

- **`@inevitable/execution`** — `ExecutionEngine` drives `FiberRoutine` coroutines cooperatively over a
  closed effect set (`emit`/`spawn`/`await`/`sleepLogical`/`reason`); every step appends to an
  append-only execution journal stamped with an HLC. Determinism (D2): same routines + seeded
  `IdGenerator` + `ManualClock` → byte-identical journals. Safety: per-fiber loop-limit, `isolate`
  /`fail-fast` lineage policy. (7 tests)
- **`@inevitable/world-state`** — `WorldStateGraph` folds typed `WorldStateDelta`s into a materialized,
  versioned view; queries (`getNode`/`neighbors`/`nodesByType`/`hasPath`); acyclicity enforced for DAG
  edge classes (e.g. `prerequisite_of`); snapshot/restore; change subscription. (6 tests)
- **`@inevitable/memory`** — `TieredMemoryStore`: per-`memory_layer` validated mutation logs +
  current-state projections; reinforcement/decay expressed as mutations; redaction; subscription-based
  real-time distribution (the substrate for F05's "every agent has context in real time"). (9 tests)
- **`@inevitable/scheduler`** — `DepthScheduler`: priority dispatch with weighted fairness, reserved
  per-requester budgets, preemption of lower-priority running work, and bounded-queue backpressure with
  value-based shedding — every drop surfaced as an event (no silent caps). (5 tests)
- **`@inevitable/adapters`** — reference `InMemoryEventTransport` (mirrors the Universal Cognitive Bus)
  and `InMemoryVectorStore`, a backend-agnostic **conformance harness**, and dependency-optional
  `NatsEventTransport` / `QdrantVectorStore` / `Neo4jGraphStore` / `PostgresRelationalStore` whose
  `connect()` returns `E_ADAPTER_UNAVAILABLE` offline. (4 tests)
- **`services/data-plane`** — `bootstrapOtel()` (dependency-optional NodeSDK) + `OtelObservabilitySink`
  + `bridgeBusToSink()`; `createDataPlane()` assembles bus → sink → OTel. (4 tests)

## Verification (green)

`pnpm verify` (codegen → typecheck → test → lint → format:check):

- Typecheck: **17/17** projects.
- Tests: **17/17** suites pass (Phase 1D adds execution 7, world-state 6, memory +7, scheduler +4,
  adapters 4, data-plane 4).
- Lint + format: clean.

## Architecture-Law Conformance

- Determinism/replay: injected clocks/ids + append-only journals and delta/mutation logs (D0–D2).
- No bare-string exchange; world-state changes are typed deltas; memory writes are typed mutations.
- No silent caps: scheduler shedding/preemption and budget exhaustion all emit events.
- Governance/observability seams preserved: emit effects route through a sink; restricted telemetry is
  redacted at the OTel edge; adapters preserve event classification.
- Contracts-first: backends sit behind `@inevitable/contracts`; correctness defined once by the
  conformance harness (ADR-0005).

## Product Topology Setup (completed 2026-06-03)

The full feature-spec suite `F01`-`F16` now exists under `spec/product/features/`, with the canonical
topology indexed in `spec/product/README.md`, `spec/product/features/README.md`, and
`spec/indexes/product-feature-index.md`. The master vision reference has also been normalized:
`spec/vision-application/The_Inevitable_Master_Vision.md` is the canonical file, while
`Ambition-deep-committments.md` is retained only as a compatibility pointer.

## Next Steps (Phase 1E)

The first product-cognition runtime bridge now exists as `@inevitable/product-cognition`, binding
persona/intent onboarding, graph-backed learning paths, MVP agent manifests, scheduler-admitted
runtime dispatch, the first deterministic explanation/practice loop, memory mutation proposals, and
mastery checkpoints to the existing kernel/runtime/scheduler/world-state/memory/event primitives.

Continue Phase 1E by adding packet-level trace capture, runtime-hosted supervisor routing across the
MVP agent set, and model-output recording at the adapter edge for deterministic replay D3/D4. Live
adapter conformance (NATS/Postgres/Neo4j/Qdrant) runs in an infrastructure-provisioned pipeline.
