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

**Live model (optional):** copy `.env.example` → `.env` and set `GEMINI_API_KEY`. The Surface
Gateway (`apps/api`) and CLI demo (`apps/cli`) load `.env` at startup and use real Gemini
(`gemini-2.5-flash`, recorded as `model.*` events, D3) when the key is present, else the
deterministic NullModelRuntime runs the identical governed path. `@google/genai` is provisioned at
the workspace root (guarded dynamic import; never a substrate dependency).

## Code Ownership Map

- `apps/` — user-facing and API surfaces.
- `packages/` — reusable cognitive OS primitives (the substrate + product runtimes).
- `services/` — deployable control-plane and data-plane services.
- `infrastructure/` — environment, deployment, and operations assets.
- `tests/` — cross-cutting verification suites (units, integration, replay, governance, failure).
- `tools/` — developer and spec automation.
- `spec/` — the governing spec system (architectural law; see `CLAUDE.md`).

## Current State

**Phases 1A–1E, 2A–2D, the 2E durable-substrate milestone, and P2.1–P2.2 (live write-continuity +
durable learner identity) are complete. `pnpm verify` is green across the whole monorepo** (21
packages/apps + 1 service: codegen, typecheck, test, lint, format).

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
- **2C** — The Visible Surface: SRF-005 streaming/sync protocol + ADR-0006. `apps/api` — a
  zero-dependency `node:http` **Surface Gateway** (SSE event stream down, a typed command
  envelope up, `Last-Event-ID` resume, governed at the boundary, `gateway.*` boundary
  observability). `apps/web` — a **Vite + React** viewport that folds the live stream with the
  same `foldSurfaceEvents` (via `@inevitable/surface/client`) and renders it as regions
  (timeline · cognition stream · provenance inspector) through a **block-renderer registry keyed
  by `block_type`** (provider-agnostic; multimodal types render typed placeholders).
  Replay-equivalence is a tested invariant: the client fold ≡ the server's `SurfaceState`.
  `pnpm dev:gateway` + `pnpm dev:web`.
- **2D (in progress)** — *The living, interactive classroom — cognition made visible over time.*
  - **Curriculum generation**: `CurriculumUnit` (F02/F03) turns any goal into a prerequisite-ordered
    concept DAG through the governed path (model-backed; deterministic scaffold fallback) — the
    timeline is generated, not seeded.
  - **Choreography** (`SurfaceChoreographer`; ADR-0007; SRF-002 schema 1.1.0): three additive
    `surface.*` events — `narration.segment`, `focus.changed`, `presence.updated` — fold into a
    choreography slice (`narration`/`focus`/`presence`), so cognition is *synchronized and
    attention-directed*. The explanation is narrated segment-by-segment and **re-narrated on
    interactive `expand()`**. Dynamic generation is core; static pre-generation is a non-goal; replay
    stays exact because timing is a **client projection**, never baked into the log.
  - **The Cognitive Stage** (`apps/web`): a redesigned "theater of thought" — a central spotlighted
    stage, a living-timeline spine that lights up in sync, an agent-presence ensemble (sigils, not
    cartoons), provenance-on-demand (the `/trace` chain), and a narration track with transport —
    driven by a client `useChoreographer` (pure projection; owns no truth).
  - **Gemini voice** (SRF-004): `GeminiVoiceRuntime` + deterministic `NullVoiceRuntime` in
    `@inevitable/adapters`; narration audio served **out-of-band** via the gateway media route
    (`GET /api/surface/:id/media/:artifactId`); the segment carries only a reference + duration, bytes
    never on the stream. Real Gemini wired end-to-end via `.env` (`GEMINI_API_KEY`). Verified live
    in-browser: "Teach me Neural Networks" → a real curriculum, a spotlighted narrated explanation,
    agent presence, and provenance.
- **2E — Durable substrate (first milestone)** — *the floor under event sourcing made literal.*
  Durable cognitive persistence (DPS-001, ADR-0008): a pure-`node:fs` `FileEventTransport`
  (append-only JSONL, passes the existing `EventTransport` conformance harness) and a `FileMediaStore`,
  both behind the existing contracts; in-memory stays the reference semantics and the offline default.
  When `COS_PERSIST_DIR` is set, the gateway mirrors every surface event to a per-surface durable log
  and narration audio to disk, and reconstructs a surface **read-side** after a process restart (the
  server talks to a `ServedSurface` seam, so live and restored surfaces are interchangeable). Proven:
  a fresh gateway over the same directory folds the durable log to a **byte-identical** `SurfaceState`,
  and out-of-band audio still resolves.
- **P2.1 — Live write-continuity (rehydration)** — *a restored surface comes back drivable.* Continuity
  & Rehydration (DPS-002, ADR-0009): `EventBus.hydrate()` (load history without re-delivery),
  `SurfaceSession.resume()` (adopt the persisted id without re-emitting creation), and a
  `buildDemoSession` restore path that injects a restored world-state snapshot + replayed memory
  mutations + hydrated event log and a `CryptoIdGenerator` (new ids unique by construction; recorded
  events keep their original ids). The gateway persists `world.json` + `memory.json` after each command
  and, on a cold-miss, **rehydrates a live session** so a restored surface accepts new `ask`/`expand`
  (falling back to DPS-001 read-side reconstruction only when snapshots are absent/corrupt). Proven: a
  new ask after a simulated restart appends fresh cognition with prior state intact and no id collisions.
- **P2.2 — Durable learner identity & resume-by-learner** — *continuity of who.* Durable Learner
  Identity (DPS-003, ADR-0010): a first-class, durable `LearnerRegistry` (`apps/api/src/learners.ts`)
  replaces the hardcoded demo learner — a learner is `{learnerId, cid, trustLevel, surfaces[]}`, minted
  once and resolved on return (a known `learnerId` reuses the same `cid`/trust across a restart; an
  unknown id is never claimed). The real learner is threaded through the substrate (`onboarding()` is
  now learner-parameterized; the surface's world-state learner node + governed dispatch use the
  learner's own `cid`/trust). New route `GET /api/learner/:learnerId` lists a learner's surfaces
  (resume-by-learner); rehydration loads the learner so a resumed surface keeps the right identity.
  Fixed a latent bug en route: gateway surfaces now use a `CryptoIdGenerator` (the seeded generator is
  seed-independent, so distinct seeds alone minted identical surface ids).
- **P2.3 — Shared per-learner cognitive memory** — *continuity of cognition.* Shared Per-Learner
  Cognitive Memory (DPS-004, ADR-0011): a returning learner's **new** surface now draws on what they
  already mastered. The learner-durable subset of a surface — the mastery subgraph (`mastery_checkpoint`
  nodes scoped by `ownerUserId`, their `concept` nodes + assess edges) plus durable-tier memory
  (`semantic`/`procedural`/`reflective`) — is **captured** after each `ask` and **merged** (idempotent,
  id-keyed) into a per-learner cognition profile held in the `LearnerRegistry` (in memory always; on disk
  at `<dir>/learners/<id>.cognition.json`). On surface **create** for a resolved learner the profile is
  **seeded** silently into the fresh substrate before `start()` (`extractLearnerCognition` + a
  `learnerSeed` build option), so the supervisor routes an already-mastered concept to `complete` on the
  first `ask` instead of re-explaining it. Session scratch (`working`/`episodic`) and per-surface block
  state never carry; seeding emits no `surface.*` event (silent reconstruction, like DPS-002
  `hydrate`/`restore`); seed and `restore` are mutually exclusive (create seeds, resume restores). Proven
  in memory within one process **and** across a restart (profile loaded from disk); a fresh learner still
  starts blank. This is the substrate on-ramp to the Digital Twin (P5).

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
| `@inevitable/adapters` | interop/infrastructure-adapters (ADR-0005), protocols/model-invocation, surface/multimodal-provider-abstraction, persistence/durable-cognitive-persistence (ADR-0008) | in-memory reference adapters + conformance harness; NATS/Qdrant/Neo4j/Postgres (edge-provisioned); **`FileEventTransport`** (durable JSONL event log, passes the conformance harness); Null/Gemini/Recording model runtimes (D3 seam); Null/Gemini **voice runtimes** (SRF-004, out-of-band WAV) |
| `@inevitable/product-cognition` | product/product-cognition-runtime, agents/supervisor-agent, protocols/model-invocation, features F01–F07/F13/F14 | onboarding, path projection, manifests, governed dispatch, supervisor routing, fibered learning loop, mastery checkpoints, ModelBackedUnit (F04 layers), CurriculumUnit (goal → concept DAG, PCR §12) |
| `@inevitable/surface` | surface/ (SRF-001…004), features F09/F16 | cognition blocks, surface.\* events, timeline projection, contribution runtime, fold/replay, trace capture, provider registry, SurfaceSession (+ expand), **`SurfaceChoreographer`** (narration/focus/presence choreography, ADR-0007) |
| `@inevitable/cli` (app) | surface/, product/product-cognition-runtime, protocols/model-invocation | demo composition root: full governed substrate wired into one terminal surface (`pnpm demo`) |
| `@inevitable/api` (app) | surface/surface-streaming-sync-protocol (SRF-005), ADR-0006/0007/0008/0009/0010/0011, product/product-cognition-runtime §12, persistence/durable-cognitive-persistence + cognitive-continuity-and-rehydration + durable-learner-identity + shared-learner-cognition | Surface Gateway: node:http SSE stream + typed command envelope, governed boundary, `gateway.*` observability, per-goal curriculum generation, `.env`/Gemini, out-of-band media route + Gemini/Null voice wiring, durable persistence + cross-process resume (`COS_PERSIST_DIR`; `ServedSurface` seam, `File{EventTransport,MediaStore}`), live rehydration (world/memory snapshots → drivable restored surface), **durable `LearnerRegistry`** (first-class learners own surfaces; resume-by-learner via `GET /api/learner/:id`; **per-learner cognition profile** seeds a returning learner's new surface with prior mastery) |
| `@inevitable/web` (app) | surface/surface-streaming-sync-protocol (SRF-005), surface/ (SRF-001), ADR-0007, F09/F16 | Vite + React **Cognitive Stage**: folds the live stream (`@inevitable/surface/client`); `useChoreographer` playback (narration/focus/presence, audio); block-renderer registry (provider-agnostic) |
| `@inevitable/data-plane` (service) | telemetry/otel-edge, data-plane/ | OTel SDK bootstrap (edge) + bus→OTel observability sink |

## Active Frontier — the architectural roadmap (gap analysis → phased build)

A Chief-Architect gap analysis (three parallel substrate/spec/product audits) established the
sequencing: the substrate's cognitive path is PRODUCTION-grade, but everything was in-memory. **P1
(durable persistence) shipped above (Phase 2E milestone)** — the floor under event sourcing, replay,
continuity, the digital twin, and every future manifestation. Next, in dependency order:

1. **P2 — Identity, Continuity & Context** *(in progress).* ✓ **P2.1 live write-continuity**,
   ✓ **P2.2 durable learner identity + resume-by-learner**, and ✓ **P2.3 shared per-learner cognitive
   memory** (a returning learner's new surface draws on prior mastery — the substrate on-ramp to the
   twin) shipped above. **Next within P2:** **context-lease-bounded retrieval** (VectorStore-backed
   working-memory assembly — make the now-present durable knowledge *retrieved on demand*); a capability
   **registry** (dynamic grant/revoke); **intent inference** (goal → intent lease). (Auth that binds a
   learner to a credentialed user is a separate later concern.)
2. **P3 — Knowledge-graph engine, explanation depth & observability analysis (the ULI core).**
   Shape world-state into a KG (recursive prerequisite decomposition to a zero-knowledge start, layer
   indexing, cross-domain bridges); extend F04 to layers 2–6 with adaptive prompt assembly; add
   observability *analysis* (drift, confidence calibration, learning-outcome signals).
3. **P4 — Multi-agent cognition.** Real blackboard arbitration + `surface.agent.disagreed` (F07);
   wire the (built but unwired) DepthScheduler for concurrent dispatch; governed tool runtime (MCP).
4. **P5 — Digital Twin / Personal Cognitive Companion** (consent-scoped twin-state over durable
   memory+events; snapshot/branch/export/terminate).
5. **P6 — Governed self-evolution** (proposals → shadow tests on synthetic learners → replay-based
   evaluation → governed rollout/rollback).
6. **P7 — Platform API/SDK + duplex** (harden the substrate's public surface so mobile/desktop/CLI/MCP
   attach as manifestations; MCP/CLI is the cheap first second-manifestation). Discipline now, phase later.

Nearer-term surface polish that rides alongside: visual media on the stage (Gemini image/video behind
SRF-004; slots already designed), the spatial Living-Canvas projection (second F16 manifestation),
and curriculum-quality/caching. Deferred research tier (consciously off the critical path):
federation, cognitive-ir/isa/compiler, query-engine, networking, economics, filesystem, consensus.

## Implementation Doctrine

Every implementation unit must be traceable to:

1. A spec domain.
2. A protocol or event contract where applicable.
3. An observability contract.
4. A failure-mode contract.
5. A verification strategy.

If a stronger design is discovered through research or the local reference repositories, update
the spec first, document the decision (ADR when major), then implement.
