# Implementation Status & Traceability

This file answers exactly one question: **what exists in the codebase right now — where it
traces, how it is verified, and what is next.** It is a current-state document, not a history.

- Abstract milestone history → `CHANGELOG.md`
- Detailed dated build narratives → `docs/history/implementation-log.md`
- Phase plans → `spec/implementation-roadmaps/`
- Why and how to build → `CLAUDE.md` (constitution) and the owning specs under `spec/`

**Update doctrine:** when a phase lands, *replace* "Current State" and "Active Frontier" below,
update the traceability table if a package was added, append one detailed dated section to
`docs/history/implementation-log.md`, add one abstract entry to `CHANGELOG.md`, and rewrite
`CLAUDE.md` §5 (≤8 lines). Never append dated narrative sections to this file.

## Developer Quickstart

```bash
corepack enable                # or: npm i -g pnpm@9.15.0
pnpm install
pnpm codegen                   # generate TS types from canonical JSON Schemas
pnpm verify                    # codegen + typecheck + test + lint + format:check
```

Per-package: `pnpm --filter @inevitable/<name> run {typecheck,test,lint}`. Tooling decisions:
`spec/architecture-decisions/ADR-0004-monorepo-and-tooling.md`. JSON Schema is the canonical
contract form (ADR-0003). Heavy infrastructure clients are never workspace dependencies —
adapters use guarded dynamic imports (ADR-0005).

## Code Ownership Map

- `apps/` — user-facing and API surfaces.
- `packages/` — reusable cognitive OS primitives (the substrate + product runtimes).
- `services/` — deployable control-plane and data-plane services.
- `infrastructure/` — environment, deployment, and operations assets.
- `tests/` — cross-cutting verification suites (units, integration, replay, governance, failure).
- `tools/` — developer and spec automation.
- `spec/` — the governing spec system (architectural law; see `CLAUDE.md`).

## Current State

**Phases 1A–1E, 2A, and 2B are complete. `pnpm verify` is green across the whole monorepo**
(19 packages/apps + 1 service: codegen, typecheck, test, lint, format).

- **1A** — spec ecosystem (`spec/meta/`, `spec/indexes/`), ADRs, domain map, ownership skeleton.
- **1B** — kernel / protocol / event / runtime foundational specs; ADR-0003 (tech stack).
- **1C** — foundational packages: shared, protocols, observability, events, kernel, governance,
  runtime, scheduler, memory, orchestration, contracts, tooling.
- **1D** — substrate deepening: deterministic execution + fibers, world-state graph, memory
  tiers, scheduler depth, infrastructure adapters + conformance harness, OTel edge.
- **Product topology** — feature-spec suite F01–F16 under `spec/product/features/`; master PRD
  at `spec/product/Broader-feature-product.md`.
- **1E** — `@inevitable/product-cognition`: onboarding (F01/F13), learning-path projection
  (F02/F03), MVP agent manifests (F06), runtime dispatch + deterministic MVP unit (F06/F07),
  mastery checkpoints (F14), supervisor routing with confidence weighting, fibered learning
  loop (D2-replayable), OTel span capture, and a governance gate at the dispatch boundary.
- **2A** — `@inevitable/surface`: the Cognitive Surface Runtime (specs SRF-001…004 under
  `spec/surface/`) — cognition blocks with mandatory provenance, the `surface.*` event family,
  living timeline as world-state projection, agent contribution runtime, deterministic
  fold-based replay, full trace capture, multimodal provider seam, and an end-to-end
  governance-gated `SurfaceSession` ("Teach me Neural Networks" acceptance flow).
- **2B** — Real Cognition on the Surface: the Model Invocation Protocol
  (`spec/protocols/model-invocation-protocol.md`, D3 realized), `model.*` event family,
  Null/Gemini/Recording model runtimes in `@inevitable/adapters` (no vendor SDK in the
  workspace), `ModelBackedUnit` in `@inevitable/product-cognition` (same governed dispatch
  path, layered F04 output, visible deterministic fallback), `SurfaceSession.expand()`
  progressive deepening, and `apps/cli` + `pnpm demo` — the first runnable surface. D3
  acceptance: seeded record→replay reproduces a byte-identical frame, provider never
  re-invoked.

## Traceability Map

Every package derives from its governing spec; code that violates spec contracts is invalid
implementation even if it works locally.

| Package / Service | Spec domain | Key contracts |
|---|---|---|
| `@inevitable/shared` | kernel/cognitive-identity, replay | branded ids, Result, HLC, Clock, errors |
| `@inevitable/protocols` | protocols/\*, events/event-taxonomy | 16 JSON Schemas, registry, ajv validator, codegen |
| `@inevitable/observability` | observability/cognitive-observability | trace envelope, structured logger, OTel bridge, metrics |
| `@inevitable/events` | protocols/cognitive-event, communication/UCB | event factory, family registry, replay-safe bus, dead-letter |
| `@inevitable/governance` | kernel/governance-kernel | policy engine, decision records, enforcement middleware |
| `@inevitable/kernel` | kernel/\* | identity, capability envelope, context/intent leases |
| `@inevitable/runtime` | runtime/cognitive-unit-runtime, protocols/cognitive-unit-abi | lifecycle FSM, ABI, manifest loader, unit host |
| `@inevitable/scheduler` | kernel/cognitive-scheduler, scheduler/ | DepthScheduler: preemption, fairness, budgets, backpressure |
| `@inevitable/memory` | protocols/memory-mutation, memory/memory-tiers | TieredMemoryStore: tiers, projections, decay, distribution |
| `@inevitable/orchestration` | orchestration/\* | versioned blackboard (foundation) |
| `@inevitable/contracts` | interop (ADR-0003) | transport/graph/vector/model/tool adapter interfaces |
| `@inevitable/tooling` | tooling/, developer-experience/ | schema/protocol introspection |
| `@inevitable/execution` | execution/, replay/ | deterministic engine, cognitive fibers, execution journal |
| `@inevitable/world-state` | world-state/world-state-graph | delta protocol, materialized graph, acyclicity, snapshots |
| `@inevitable/adapters` | interop/infrastructure-adapters (ADR-0005), protocols/model-invocation | in-memory reference adapters + conformance harness; NATS/Qdrant/Neo4j/Postgres (edge-provisioned); Null/Gemini/Recording model runtimes (D3 seam) |
| `@inevitable/product-cognition` | product/product-cognition-runtime, agents/supervisor-agent, protocols/model-invocation, features F01–F07/F13/F14 | onboarding, path projection, manifests, governed dispatch, supervisor routing, fibered learning loop, mastery checkpoints, ModelBackedUnit (F04 layers) |
| `@inevitable/surface` | surface/ (SRF-001…004), features F09/F16 | cognition blocks, surface.\* events, timeline projection, contribution runtime, fold/replay, trace capture, provider registry, SurfaceSession (+ expand) |
| `@inevitable/cli` (app) | surface/, product/product-cognition-runtime, protocols/model-invocation | demo composition root: full governed substrate wired into one terminal surface (`pnpm demo`) |
| `@inevitable/data-plane` (service) | telemetry/otel-edge, data-plane/ | OTel SDK bootstrap (edge) + bus→OTel observability sink |

## Active Frontier — Phase 2C: The Visible Surface

1. **Web surface projection** — a real UI renderer over `SurfaceState` (the runtime is the
   product; the UI renders the fold and writes back only through typed dispatches). Streaming
   from the bus to the client; `SurfaceState` never becomes client-owned truth.
2. **Multimodal media providers** — Gemini image/voice/live behind the SRF-004 interfaces,
   through the same D3 recording seam proven in Phase 2B.
3. **Blackboard + `surface.agent.disagreed`** — F07 proposal arbitration before block generation.
4. **Deeper F04 layers** — extend `expand()` beyond layers 0–1 (conceptual framework,
   mathematical, applied).
5. **`reasoning.step.recorded`** emission from fiber loop phases (observability completeness).
6. **Persistence edge** — durable event log / world-state snapshots behind the existing adapter
   contracts, so sessions survive the process.

## Implementation Doctrine

Every implementation unit must be traceable to:

1. A spec domain.
2. A protocol or event contract where applicable.
3. An observability contract.
4. A failure-mode contract.
5. A verification strategy.

If a stronger design is discovered through research or the local reference repositories, update
the spec first, document the decision (ADR when major), then implement.
