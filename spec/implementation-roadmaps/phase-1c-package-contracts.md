# Phase 1C - Foundational Infrastructure Implementation Roadmap

## Goal

Establish the executable Cognitive OS substrate: a production-grade TypeScript monorepo whose
packages implement the Phase 1B specs, with JSON Schema as the canonical contract form
([ADR-0003](../architecture-decisions/ADR-0003-tech-stack.md)) and a green CI gate. Implementation
remains subordinate to specs ([ADR-0001](../architecture-decisions/ADR-0001-spec-first-cos-foundation.md)).

## Scope

- Monorepo + tooling foundation ([ADR-0004](../architecture-decisions/ADR-0004-monorepo-and-tooling.md)).
- Twelve foundational packages derived from Phase 1B specs.
- Contracts-first: types generated from canonical JSON Schemas; runtime validation via ajv.
- Observability-first and replay-safe primitives (injected clocks/ids, append-only event log).

## Completed in This Pass (2026-06-02)

**Foundation**
- pnpm 9 workspaces + Turborepo; strict TypeScript (ESM, `verbatimModuleSyntax`,
  `noUncheckedIndexedAccess`); Vitest; ESLint 9 flat config + Prettier; Husky + commitlint;
  GitHub Actions CI; `ADR-0004`.

**Packages** (each: typed interfaces, tests, spec references)
- `@inevitable/shared` — branded ids, `Result`, hybrid logical clock, injectable `Clock`, typed errors, spec-ref.
- `@inevitable/protocols` — 16 canonical JSON Schemas, schema registry, ajv (2020-12) validator,
  `json-schema-to-typescript` codegen, conformance/contract harness.
- `@inevitable/observability` — cognitive trace envelope, structured logger, OpenTelemetry bridge, metrics.
- `@inevitable/events` — event factory, family registry (taxonomy), replay-safe in-memory bus,
  dead-letter, governance interception.
- `@inevitable/governance` — policy interface, priority-ordered engine, decision records, enforcement middleware, default policies.
- `@inevitable/kernel` — identity, capability envelope, context/intent lease services (in-memory registries, invariants, governance hook).
- `@inevitable/runtime` — 13-state lifecycle FSM, cognitive-unit ABI, manifest loader, unit host emitting `agent.*` events.
- `@inevitable/scheduler` — work-item priority queue (foundation).
- `@inevitable/memory` — validating memory-mutation store (foundation).
- `@inevitable/orchestration` — versioned blackboard (foundation).
- `@inevitable/contracts` — pluggable infrastructure adapter interfaces (transport/workflow/graph/vector/relational/model/tool/observability).
- `@inevitable/tooling` — schema/protocol introspection.

## Verification (green)

`pnpm verify` (= codegen → typecheck → test → lint → format:check), reproduced in CI:

- Typecheck: 12/12 packages.
- Tests: 96 passing (Vitest) across unit, contract/conformance, and lifecycle/bus integration.
- Schema validation: 16/16 schemas compile; all example fixtures validate; invalid fixtures rejected.
- Lint + format: clean.

Determinism is built in: ids and clocks are injectable (`SeededIdGenerator`, `ManualClock`); the bus
log is append-only and replays in sequence order — the foundation for deterministic replay.

## Architecture-Law Conformance

- No bare-string exchange: packets/events are typed + schema-validated.
- No memory write without a Memory Mutation (`@inevitable/memory` rejects malformed mutations).
- Context/intent access via leases (`@inevitable/kernel`).
- Side-effecting capability grants pass governance (`assertAllowed`).
- No runtime without manifest + identity + capability envelope (lifecycle gates `Admitted`).
- Events carry causality + versioning; lifecycle transitions emit `agent.*` events.

## Next Steps (Phase 1D)

1. Concrete adapters behind `@inevitable/contracts` (NATS transport; Postgres/Neo4j/Qdrant).
2. Scheduler: preemption, fairness, budgets, backpressure, load-shedding (`spec/scheduler/`).
3. Cognitive threading/fibers + deterministic execution engine (`spec/execution/`, `spec/replay/`).
4. World-state graph + temporal cognition + memory tiers/consolidation (`spec/world-state/`, `spec/memory/`).
5. OTel SDK/exporters at the `services/` edge; first deployable control-plane/data-plane service.

Write or update the owning spec first, then implement.
