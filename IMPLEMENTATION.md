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

**Phases 1A–1E, 2A–2D, the 2E durable-substrate milestone, all of P2 (Identity, Continuity &
Context — P2.1 through P2.6), all of P3 (the ULI core — P3.1 through P3.3), all of P4
(Multi-Agent Cognition — P4.1 through P4.2), all of P5 (Digital Twin — P5.1), all of P6
(Governed Self-Evolution — P6.1), P7.1 (Platform SDK + MCP manifestation), all of Phase S1
(Cognitive Surface maturity — the living loop + interactive timeline graph + interaction protocol,
S1.0 through S1.4), and the **S-UCS immersive Cognitive Surface redesign** (fullscreen whiteboard +
overlays/HUD/launchers; Agent Observatory with surfaced reasoning + work-timing; synchronized
word-level narration; progressive `surface.block.delta` streaming; inline multimodal; cognitive-pipeline
activity timeline) are complete. `pnpm verify` is green across the whole monorepo**
(codegen, typecheck, test, lint, format).

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
- **P2.4 — Context-lease-bounded retrieval** — *durable knowledge made retrievable.* (DPS-005, ADR-0012.)
  New package `@inevitable/context`: a `ContextAssembler` does VectorStore-backed semantic retrieval over
  the learner's durable memory and assembles a bounded `WorkingMemoryContext` under the session
  `ContextLease` — fail-closed bounds (tier `memory_layers`, `allowed_users`, `token_budget`, expiry;
  exclusions counted). A deterministic local embedding (token-hash bag-of-words) keeps retrieval offline +
  replay-safe. `buildDemoSession.assembleContext(query)` indexes the durable tiers, assembles, and writes
  the admitted items into the `working` tier (distributed; session scratch, never captured/seeded); the
  gateway calls it each ask. Boundary: it retrieves/bounds/assembles; *consuming* it in agent prompts is
  P3 (adaptive prompt assembly).
- **P2.5 — Intent inference** — *goal → a real intent lease.* (spec/kernel/intent-inference, ADR-0013.)
  A governed, model-backed `IntentInferenceUnit` (`agent.intent`, deterministic fallback) interprets the
  goal into `{interpreted_goal, scope, constraints, confidence}` and re-interprets the session intent lease
  **in place** (stable `intent_id` = surface `session_id`), emitting `intent.received` → `intent.interpreted`.
  Replaces the hardcoded, goal-independent lease. The gateway calls `inferIntent(goal)` best-effort (never
  changes the untrusted-degradation path). Boundary: it interprets + binds the lease; driving
  curriculum/retrieval from the interpreted goal/scope is a follow-up.
- **P2.6 — Capability registry (dynamic grant/revoke)** — *the governance immune system.*
  (spec/kernel/capability-registry, ADR-0014.) A fine-grained `CapabilityRegistry` (`@inevitable/kernel`)
  grants/revokes individual named capabilities per subject, retained for audit. A new governance policy
  **GOV-P03** (opt-in by presence of a `capabilities` context) blocks a dispatch whose required capability
  (`dispatch.<agentId>`) is revoked/absent — a no-op where no registry is wired, so existing paths are
  unaffected. `buildDemoSession` grants the learner the dispatch capabilities and threads the registry
  through every dispatcher; revoking one blocks that agent's next dispatch (the cycle degrades gracefully).
  In-memory (durable grants deferred). **P2 is complete.**
- **P3.1 — Knowledge-graph engine** — *world-state shaped into a domain query layer for ULI.*
  (spec/world-state/knowledge-graph-engine, DPS-006, ADR-0015.) `KnowledgeGraphEngine` wraps
  `WorldStateGraph` as a domain query layer — not a separate store. Concept nodes use `concept:<id>`,
  prerequisite edges are `prerequisite_of` (DAG-enforced via the graph's existing acyclicity), bridge edges
  are `bridges_to` (informational; no acyclicity requirement). `seedConcepts` is idempotent (upsert). Core
  API: `decompose(goalConceptId)` (topological sort to zero-knowledge start), `learnerState(userId)` (reads
  mastery checkpoints + phase-tracking props), `nextConcept(userId, goal?)` (first unmastered in topo order),
  `addBridge(from, to)` (cross-domain bridge). `DemoFixture.kg` pre-seeded with a 4-concept ML graph
  (linear-algebra → perceptron, gradient-descent → neural-networks).
- **P3.2 — Explanation depth (F04 layers 2–6) + adaptive prompt assembly** — *the seven-layer model consumed
  in adaptive prompts.* (ADR-0016.) `ModelBackedUnit` output schema extended to all seven layers (0: Intuition,
  1: Visual, 2: Conceptual, 3: Mathematical, 4: Applied, 5: Advanced, 6: Research). Target depth =
  `max(requestedLayer, concept.naturalLayer)` — the KG layer annotation drives adaptive depth. Assembled
  context (P2.4) threaded via `SurfaceAskInput.assembledContextItems` → `FiberedLearningLoopInput` →
  `dispatch.content.assembled_context_items` → `ModelBackedUnit.buildRequest` as a "Prior learner knowledge"
  block in the system prompt. Token budget scales: `max(1024, 512 × (targetLayer + 1))`. Practice and
  assessment stay at layer 0. Closes the deferred P2.4/P2.5 prompt-consumption boundary.
- **P3.3 — Cognitive observability analysis** — *drift detection, confidence calibration, learning outcomes.*
  (spec/observability/DPS-007, ADR-0017.) `CognitiveAnalysisEngine` (`@inevitable/observability`): event-driven
  subscriber to `mastery.checkpoint.created` and `learning.loop.completed`; emits `observability.drift.detected`
  (sliding-window confidence drop > 0.15 from baseline), `observability.confidence.calibration_warning`
  (|bin_center − pass_rate| > 0.25 with ≥ 5 samples), and `observability.learning_outcome.summary` (per-concept
  attempts/pass-rate/mean-confidence). Records `cos.drift.estimate`, `cos.confidence.calibration_error`, and
  `cos.learning.outcome_rate` metrics. `publish` callback injected at the composition root — engine has no
  bus dependency. Satisfies the §25.4 reasoning-quality observability invariant. `DemoFixture.analysis` exposes
  the inspection API. **P3 is complete.**
- **P4.1 — Proposal blackboard + `surface.agent.disagreed`** — *multi-agent cognition made visible.*
  (DPS-008, ADR-0018.) `ProposalBlackboard` (`@inevitable/orchestration`) wraps `InMemoryBlackboard`
  with a typed proposal lifecycle: `propose/proposals/arbitrate/arbitrations` — append-only, audit-friendly.
  `FiberedLearningLoop.handleDispatch` runs explanation + challenger (`agent.revision`) concurrently via
  `Promise.all` when `challengerDispatcher` is present; Jaccard similarity on `layer_0` text < 0.3 triggers
  `surface.agent.disagreed` emission. `SurfaceState.disagreements[]` folds `surface.agent.disagreed`.
  `surfaceId` threaded through `FiberedLearningLoopInput` from `SurfaceSession.ask()` for fold routing.
  `DemoFixture.proposals` exposes the board. All new deps optional — no existing tests broken.
- **P4.2 — Governed tool runtime** — *`tool.*` event family + capability-gated invocation.*
  (ADR-0019.) `InMemoryToolRuntime` (`@inevitable/adapters`): `register/discover/invoke`; optional
  `checkCapability` callback for `tool.<name>` governance (no hard dep on `@inevitable/kernel`); emits
  `tool.invoked` + `tool.completed` when bus present. `tool.*` added to event taxonomy. `apps/cli`
  registers `search-concepts` demo tool, grants `tool.search-concepts`, exposes `DemoFixture.tools`.
  **P4 is complete.**
- **P6.1 — Governed self-evolution** — *proposals → shadow tests → governance gate → rollout / rollback.*
  (DPS-010, ADR-0021.) `EvolutionEngine` (`@inevitable/orchestration`): full proposal FSM (`proposed →
  evaluated → approved → rolled_out | rolled_back`); deterministic `ShadowEvaluator` projects outcomes from
  `ProposalConfiguration` + `SyntheticLearnerSeed` (no model calls — replay-safe); governance gate injected
  as a `guard` callback at `approve()` (same injection pattern as ADR-0017/ADR-0020); every state transition
  emits an `evolution.*` event (`proposal.created`, `experiment.started`, `shadow_result.recorded`,
  `rollout.completed`, `rollback.completed` — permanent, replayable); `rollback()` is idempotent from
  `"approved"` or `"rolled_out"`, data preserved for audit. `evolution.rollback.completed` added to the event
  taxonomy. `DemoFixture.evolution` + five lifecycle helpers + three default synthetic learner profiles
  (beginner/intermediate/advanced) wired with the real governance guard. 26 new tests. **P6 is complete.**
- **P7.1 — Platform SDK + MCP manifestation** — *§2 substrate-independence law proven by a real second manifestation.*
  (SDK-001, ADR-0022.) Two new packages prove the law mechanically:
  `@inevitable/sdk` (`packages/sdk`) — a typed HTTP client for the COS Surface Gateway with zero workspace
  dependencies (not even `@inevitable/protocols`); `grep "@inevitable" packages/sdk/src` returns empty.
  `CosClient` wraps all `apps/api` HTTP surface: `createSurface`, `ask`, `expand`, `close`, `getState`,
  `getLearner`; injectable `fetch` for hermetic unit tests (11 new tests); all API types defined inline (no
  structural leakage from internal protocols). `apps/mcp` — a pure stdio MCP server; its only COS import is
  `@inevitable/sdk` (zero substrate packages); implements a minimal JSON-RPC 2.0 router (~70 lines, no
  `@modelcontextprotocol/sdk` external dep, ADR-0022 D3) + 4 MCP tools (`cos_create_surface`, `cos_ask`,
  `cos_expand`, `cos_get_state`); configured entirely via `COS_API_URL` env var (ADR-0022 D4). The §2 law
  verification is explicit in test comments in both packages (ADR-0022 D5). 8 new RPC router tests.
  `pnpm verify` green across all 24 packages+apps (codegen, typecheck, test, lint, format). **P7.1 is complete.**
- **P5.1 — Digital Twin lifecycle** — *consent-scoped cognitive artifact: create / branch / export / terminate.*
  (DPS-009, ADR-0020.) `TwinRegistry` (`@inevitable/product-cognition`, `publish` callback pattern from
  ADR-0017/P3.3): manages `TwinState` lifecycle — `create(params)` mints a twin from a caller-supplied
  `TwinSnapshot` (ADR-0020 D2: caller builds the snapshot from `LearnerCognitionSeed`/DPS-004, keeping
  the registry free of world-state/memory deps); `branch(twinId, displayName)` forks a twin with inherited
  consent + snapshot captured at branch time (`branchedFrom` lineage pointer); `export(twinId)` marks the
  twin as exported (idempotent); `terminate(twinId)` irrevocably deactivates it (data preserved for audit;
  idempotent). Every transition emits a `twin.*` event (`twin.created`, `twin.branched`, `twin.exported`,
  `twin.terminated`) via the injected `publish` callback — wired in `apps/cli/wiring.ts` with `createEvent`
  + `bus.publish` + local HLC. `twin.*` family registered in the event taxonomy (1y-archive, replayable).
  `buildTwinSnapshot(cognition, nowMs)` helper extracts a `TwinSnapshot` from a `LearnerCognitionSeed`
  (mastery map from `mastery_checkpoint` nodes; memory digest per durable layer). `DemoFixture` exposes
  `twins: TwinRegistry` + four lifecycle helpers (`createTwin`, `branchTwin`, `exportTwin`, `terminateTwin`).
  23 new tests in `packages/product-cognition/tests/twin.test.ts`. **P5 is complete.**

- **Phase S1 — Cognitive Surface maturity: static viewer → living environment** — *the surface now shows
  understanding unfolding.* Roadmap: `spec/implementation-roadmaps/cognitive-surface-maturity.md`. Every
  increment is a composition over the existing substrate — no new infrastructure, the fold stays pure,
  record→replay byte-identical, governance preserved.
  - **S1.0** spec-first: **ADR-0024** (Surface Interaction Protocol), **ADR-0025** (Cognitive Ensemble
    Orchestration); **SRF-002 → schema 1.2.0** (new `surface.proposal.*`/`synthesis.recorded`/`graph.*`/
    `interaction.*` subfamilies); **SRF-003** (timeline-as-cognitive-graph + entry points); event taxonomy.
  - **S1.1** timeline-as-graph: `KnowledgeGraphEngine.addEdge` (typed edges: `depends_on`/`applies_to`/
    `research_adjacent`/`frontier_of`/`bridges_to`); `SurfaceTimelineBuilder` projects `edges[]`, per-node
    `layer` (KG layer or prerequisite-depth) + `confidence`, `entry_point`, and `reproject()` — pure projection.
  - **S1.2** cognitive ensemble: the challenger `Promise.all` generalized to an N-member fan-out; each member
    publishes a proposal to the live `ProposalBlackboard`; the arbiter emits `surface.synthesis.recorded`;
    `surface.proposal.proposed` + parallel `presence`; disagreement preserved. Primary explanation stays
    authoritative (determinism). `SurfaceState` gains `proposals[]`/`syntheses[]`. Wired in `apps/cli/wiring.ts`.
  - **S1.3** interaction protocol: gateway command envelope +
    `interrupt|jump|branch|challenge|request_depth|request_simplify|request_example` → `SurfaceSession.interact()`
    → `surface.interaction.received`/`applied` folded into `interactions[]`; **interrupt** is cooperative
    cancellation at fiber yield points (`isInterrupted()` → `phase:interrupted`); reshaping kinds re-frame the
    last ask through the governed path. Threaded through the `ServedSurface` seam.
  - **S1.4** experience layer (`apps/web`): interactive `TimelineGraph` (depth-layered SVG, typed edges,
    clickable jump/branch, entry-point selector, confidence rings + focus glow) replacing the flat
    `LivingTimeline`; `EnsemblePanel` (proposals + confidence + disagreement + synthesis); in-stream interaction
    controls in `NarrationTrack`; coherent `SurfaceView` layout. **Phase S1 is complete.**

## Traceability Map

Every package derives from its governing spec; code that violates spec contracts is invalid
implementation even if it works locally.

| Package / Service | Spec domain | Key contracts |
|---|---|---|
| `@inevitable/shared` | kernel/cognitive-identity, replay | branded ids, Result, HLC, Clock, errors |
| `@inevitable/protocols` | protocols/\*, events/event-taxonomy | 16 JSON Schemas, registry, ajv validator, codegen |
| `@inevitable/observability` | observability/cognitive-observability, DPS-007 | trace envelope, structured logger, OTel bridge, metrics, **`CognitiveAnalysisEngine`** (drift/calibration/outcome signals, ADR-0017) |
| `@inevitable/events` | protocols/cognitive-event, communication/UCB | event factory, family registry, replay-safe bus, dead-letter |
| `@inevitable/governance` | kernel/governance-kernel | policy engine, decision records, enforcement middleware |
| `@inevitable/kernel` | kernel/\* (incl. capability-registry) | identity, capability envelope, **`CapabilityRegistry`** (dynamic grant/revoke, GOV-P03), context/intent leases |
| `@inevitable/runtime` | runtime/cognitive-unit-runtime, protocols/cognitive-unit-abi | lifecycle FSM, ABI, manifest loader, unit host |
| `@inevitable/scheduler` | kernel/cognitive-scheduler, scheduler/ | DepthScheduler: preemption, fairness, budgets, backpressure |
| `@inevitable/memory` | protocols/memory-mutation, memory/memory-tiers | TieredMemoryStore: tiers, projections, decay, distribution |
| `@inevitable/orchestration` | orchestration/\*, DPS-008, DPS-010 | versioned blackboard (foundation), **`ProposalBlackboard`** (typed proposal/arbitrate lifecycle, ADR-0018), **`EvolutionEngine`** (governed self-evolution: proposal FSM, deterministic shadow testing, governance gate, `evolution.*` events, ADR-0021) |
| `@inevitable/contracts` | interop (ADR-0003) | transport/graph/vector/model/tool adapter interfaces |
| `@inevitable/tooling` | tooling/, developer-experience/ | schema/protocol introspection |
| `@inevitable/execution` | execution/, replay/ | deterministic engine, cognitive fibers, execution journal |
| `@inevitable/world-state` | world-state/world-state-graph, DPS-006 | delta protocol, materialized graph, acyclicity, snapshots, **`KnowledgeGraphEngine`** (concept seeding, prereq decomposition, learner-state queries, cross-domain bridges, ADR-0015) |
| `@inevitable/context` | persistence/context-lease-bounded-retrieval (DPS-005), kernel/context-lease, memory/memory-tiers | `ContextAssembler` (VectorStore-backed, lease-bounded working-memory assembly), deterministic local embedding |
| `@inevitable/adapters` | interop/infrastructure-adapters (ADR-0005), protocols/model-invocation, surface/multimodal-provider-abstraction, persistence/durable-cognitive-persistence (ADR-0008), ADR-0019 | in-memory reference adapters + conformance harness; NATS/Qdrant/Neo4j/Postgres (edge-provisioned); **`FileEventTransport`** (durable JSONL event log); Null/Gemini/Recording model runtimes (D3 seam); Null/Gemini **voice runtimes** (SRF-004, out-of-band WAV); **`InMemoryToolRuntime`** (governed `tool.*` invocation with capability check + event emission, ADR-0019) |
| `@inevitable/product-cognition` | product/product-cognition-runtime, agents/supervisor-agent, protocols/model-invocation, kernel/intent-inference + capability-registry, features F01–F07/F13/F14, ADR-0016, DPS-009 | onboarding, path projection, manifests, governed dispatch (GOV-P01/P02/**P03 capability gate**), supervisor routing, fibered learning loop, mastery checkpoints, **ModelBackedUnit (F04 all 7 layers 0–6; adaptive depth from KG; assembled context in prompts)**, CurriculumUnit (goal → concept DAG, PCR §12), **IntentInferenceUnit** (goal → intent lease), **`TwinRegistry`** (consent-scoped digital twin lifecycle; create/branch/export/terminate; `twin.*` events, ADR-0020) |
| `@inevitable/surface` | surface/ (SRF-001…004), features F09/F16 | cognition blocks, surface.\* events, timeline projection, contribution runtime, fold/replay, trace capture, provider registry, SurfaceSession (+ expand), **`SurfaceChoreographer`** (narration/focus/presence choreography, ADR-0007) |
| `@inevitable/cli` (app) | surface/, product/product-cognition-runtime, protocols/model-invocation | demo composition root: full governed substrate wired into one terminal surface (`pnpm demo`) |
| `@inevitable/api` (app) | surface/surface-streaming-sync-protocol (SRF-005), ADR-0006…0014, product/product-cognition-runtime §12, persistence/{durable-cognitive-persistence, cognitive-continuity-and-rehydration, durable-learner-identity, shared-learner-cognition, context-lease-bounded-retrieval}, kernel/{intent-inference, capability-registry} | Surface Gateway: node:http SSE stream + typed command envelope, governed boundary, `gateway.*` observability, per-goal curriculum generation, `.env`/Gemini, out-of-band media route + Gemini/Null voice wiring, durable persistence + cross-process resume (`COS_PERSIST_DIR`; `ServedSurface` seam, `File{EventTransport,MediaStore}`), live rehydration, **durable `LearnerRegistry`** (resume-by-learner via `GET /api/learner/:id`; per-learner cognition profile seeds prior mastery); each ask runs **intent inference** + **lease-bounded context assembly** under the **capability gate** |
| `@inevitable/web` (app) | surface/surface-streaming-sync-protocol (SRF-005), surface/ (SRF-001), ADR-0007, F09/F16 | Vite + React **Cognitive Stage**: folds the live stream (`@inevitable/surface/client`); `useChoreographer` playback (narration/focus/presence, audio); block-renderer registry (provider-agnostic) |
| `@inevitable/sdk` (package) | cognitive-developer-platform/SDK-001, ADR-0022 | **Platform SDK** — typed HTTP client for the COS Surface Gateway; **zero `@inevitable/*` workspace deps** (proves §2 law); `CosClient` (createSurface/ask/expand/close/getState/getLearner); injectable `fetch`; SDK types defined inline |
| `@inevitable/mcp` (app) | cognitive-developer-platform/SDK-001, ADR-0022 | **MCP stdio server** — only COS dep is `@inevitable/sdk`; pure JSON-RPC 2.0 router (~70 lines, no external MCP SDK); 4 tools (`cos_create_surface`, `cos_ask`, `cos_expand`, `cos_get_state`); `COS_API_URL` env-var configured |
| `@inevitable/data-plane` (service) | telemetry/otel-edge, data-plane/ | OTel SDK bootstrap (edge) + bus→OTel observability sink |

## Active Frontier — the architectural roadmap (gap analysis → phased build)

A Chief-Architect gap analysis (three parallel substrate/spec/product audits) established the
sequencing: the substrate's cognitive path is PRODUCTION-grade, but everything was in-memory. **P1
(durable persistence) shipped above (Phase 2E milestone)** — the floor under event sourcing, replay,
continuity, the digital twin, and every future manifestation. Next, in dependency order:

1. **P2 — Identity, Continuity & Context** ✓ **COMPLETE.** ✓ P2.1 live write-continuity, ✓ P2.2 durable
   learner identity + resume-by-learner, ✓ P2.3 shared per-learner cognitive memory, ✓ P2.4
   context-lease-bounded retrieval, ✓ P2.5 intent inference, ✓ P2.6 capability registry (dynamic
   grant/revoke) — all shipped above. *Deferred within the theme (deliberate):* durable capability grants;
   auth that binds a learner to a credentialed user.
2. **P3 — Knowledge-graph engine, explanation depth & observability analysis (the ULI core).** ✓ **COMPLETE.**
   ✓ P3.1 KG engine (DPS-006, ADR-0015): `KnowledgeGraphEngine` over `WorldStateGraph`, prereq DAG,
   learner-state queries. ✓ P3.2 F04 layers 2–6 + adaptive prompt assembly (ADR-0016): target depth from KG,
   assembled context consumed in explanation prompts. ✓ P3.3 Cognitive observability analysis (DPS-007,
   ADR-0017): `CognitiveAnalysisEngine` — drift detection, confidence calibration, learning-outcome signals.
3. **P4 — Multi-agent cognition.** ✓ **COMPLETE.** ✓ P4.1 `ProposalBlackboard` + concurrent challenger
   dispatch + `surface.agent.disagreed` fold (ADR-0018, DPS-008). ✓ P4.2 `InMemoryToolRuntime` +
   `tool.*` event family + capability-gated invocation (ADR-0019).
4. **P5 — Digital Twin / Personal Cognitive Companion.** ✓ **COMPLETE.** ✓ P5.1 `TwinRegistry` in
   `@inevitable/product-cognition`: consent-scoped twin lifecycle (create/branch/export/terminate),
   `TwinSnapshot` from `LearnerCognitionSeed` (DPS-004), `twin.*` event family (DPS-009, ADR-0020).
   *Deferred within the theme:* IdenticalAgent (model-backed agent speaking as the learner using
   TwinState as context; P5.2+), consent enforcement at query time (P5.2+), durable twin persistence
   across restarts (P5.2+, `FileEventTransport` pattern from DPS-001).
5. **P6 — Governed self-evolution.** ✓ **COMPLETE.** ✓ P6.1 `EvolutionEngine` in
   `@inevitable/orchestration`: proposal FSM, deterministic shadow testing, governance gate at approve,
   rollout/rollback lifecycle, `evolution.*` event family (DPS-010, ADR-0021). *Deferred within the theme:*
   applying rolled-out proposals to the live runtime configuration; durable proposal persistence; replay-based
   evaluation over real recorded session history; multi-agent consensus on proposals.
6. **P7 — Platform API/SDK + duplex.** ✓ **P7.1 COMPLETE.** ✓ `@inevitable/sdk` (zero substrate deps,
   injectable fetch, all `apps/api` routes typed) + `apps/mcp` (stdio MCP server via `@inevitable/sdk` only,
   pure JSON-RPC 2.0 router, 4 tools, `COS_API_URL` env-var). §2 law proven mechanically: a second
   manifestation drives the substrate with zero core changes. *Deferred within the theme:* duplex
   WebSocket transport (ADR-0006 explicitly deferred); multi-user CRDT; auth at the SDK boundary.

**Surface maturity track (`spec/implementation-roadmaps/cognitive-surface-maturity.md`).** A forward-looking
review re-centered the active frontier on the **Cognitive Surface** — the primary manifestation — closing the
gap from a deterministic single-agent playback to a living cognitive environment. ✓ **Phase S1 COMPLETE**
(living loop + interactive timeline graph + interaction protocol; S1.0–S1.4 above). Next, in order:

- **S2 — Deeper cognition + inline multimodal** ✓ **COMPLETE.** Five-test depth verification (F14),
  prerequisite-descent on confusion (F03 via depth-gate failure), structured concept maps (SRF-006 §4
  deterministic path), generated-media pipeline (`image` blocks, bytes-out-of-band, SRF-006), live
  curriculum KG edges, narration track.
- **S3 — Research mode + ensemble expansion** ✓ **COMPLETE.** ADR-0026 (research-readiness gating,
  D3 event ordering, ResearchUnit ABI); `ResearchFrontierRecord` + `motivation_surfaced` fold
  (`projection.ts`); `ResearchUnit` model-backed CognitiveUnit with deterministic fallback; readiness
  gate (0.75 depth-gate threshold / 0.85 fallback); `surface.research.frontier.*` + `surface.motivation.surfaced`
  events; motivation dispatch + `motivation` block; `research`/`motivation` block renderers
  (`blocks.tsx`); research-accented `frontier_of`/`research_adjacent` edges in `TimelineGraph`;
  `"research"/"motivation"/"reflection"/"debate"` added to `ProductRuntimeAgentId` + agent catalog.
- **S4 — Modes, twin, collaboration, evaluation** (in progress):
  - **S4.1 + S4.2 COMPLETE** — **Cognitive Evaluation Layer** (ADR-0027, Cognitive-Architecture Layer 2).
    New `@inevitable/evaluation` package (25th package): `ExplanationScorecard` (UALRCI five-test rubric;
    reads `DepthGateContext` when present, falls back to `masteryConfidence`), `ResearchScorecard` (4
    heuristic dimensions), `ReasoningScorecard` interface (pure D1), `CognitiveEvaluationEngine` (selects
    scorecard by strategy, emits `evaluation.reasoning.completed` — permanent, replayable), `BenchmarkRunner`
    (D0 determinism: `ManualClock` + fixed traces). `EVALUATION_PASS_THRESHOLD = 0.7` exported.
    Wired into `EvolutionEngine.approve()` as an optional `evaluationGuard` callback (throws
    `E_EVALUATION_GATE` when gate fails). `SurfaceState.evaluation_records` folds
    `surface.evaluation.recorded` (surface-prefixed wrapper emitted by `SurfaceSession.ask()` step 10
    after the cycle; avoids circular dependency: evaluation never imports surface). `apps/cli/wiring.ts`
    creates `CognitiveEvaluationEngine` and wires both the session and the evolution guard.
    `pnpm verify` green (25/25 tasks).
  - **S4.3 COMPLETE** — **Educator mode** (S4.3). `surface.mode.set` event registered in taxonomy + SRF-002.
    `OnboardingSession.mode?: ProductMode` added; threaded from `DemoOptions.mode` → `onboarding()` →
    `SurfaceSession.start()` (emits `surface.mode.set` immediately after `surface.created`).
    `SurfaceState.mode: ProductMode` folds `surface.mode.set` (defaults to "student"). `ProductMode`
    and `EvaluationRecord` re-exported from `@inevitable/surface/client`. API: `POST /api/surface`
    accepts `mode`, validated + passed to `buildDemoSession()`. Web: mode selector chip
    (student/educator) on the entry screen; `EducatorOverlay` component renders in educator mode,
    surfacing `evaluation_records`, `depth_gates`, `routing_decisions`, and `contributions` from
    `SurfaceState`; CSS styled to observatory palette. `pnpm verify` 25/25 green.
  - **S4.4 COMPLETE** — **Scene-graph projection** (S4.4). F16's second surface manifestation: spatial
    block canvas alongside the existing timeline graph. `ProjectionMode = "timeline" | "scene"` exported
    from `@inevitable/surface/client`. `SurfaceState.current_projection: ProjectionMode` folds
    `surface.projection.switched` (defaults to "timeline"); `surface.scene.block.placed` is observational
    only (version-only fold, D5: layout non-canonical). Both new events registered in the event taxonomy
    (SRF-002). `SceneCanvas` React component: SVG-based spatial view of `state.blocks` — auto-grid layout
    (3-col), drag-to-reposition (local state, non-canonical), mouse-wheel zoom/pan, concept-edge overlays
    (dashed lines between blocks sharing `concept_ids`), focus glow (drop-shadow filter on focused block),
    per-type color bars. `SurfaceView` gains a "Timeline / Scene" chip toggle in the surface header;
    the active projection rail renders either `TimelineGraph` or `SceneCanvas` (both use `grid-area:
    timeline`). CSS: `.proj-bar`, `.proj-chip`, `.proj-chip--active`, scene block/edge/empty styles.
    Fold test: `current_projection` defaults to "timeline", `surface.projection.switched` updates it,
    `surface.scene.block.placed` is version-only. `pnpm verify` 25/25 green.

- **S-UCS — Universal Cognitive Surface immersive redesign** ✓ **COMPLETE.** Presentation redesign +
  observability plumbing (ADR-0028, ADR-0029; SRF-001/002/004/005 → schema 1.3.0; F09 §4.1; cognitive-unit-ABI).
  - *Frontend (`apps/web`):* fullscreen Cognitive Stage; everything else floats — slim top bar with
    `AgentsButton` (live status pills), floating `PathLauncher` → center `Overlay` (timeline/scene + entry
    selector), right-docked `Observatory` (presence + new `ReasoningPanel` + ensemble + provenance), and a
    floating, auto-hiding `TransportHud` (`useAutoHide`) with **word-level synchronized narration** (a
    teleprompter driven by `useChoreographer.progress` over audio `currentTime`). `CognitiveStage` renders the
    **streaming preview** (transient buffer + caret) and **inline media** (blocks sharing `concept_ids`); the
    facet ribbon became a clickable `ActivityTimeline` (cognitive pipeline). `prefers-reduced-motion` honored.
  - *Backend:* `surface.block.delta` (ADR-0028) folds into a transient `streaming_blocks` buffer cleared by
    the whole block — replay equivalence preserved (`fold([delta…, generated]) ≡ fold([generated])`);
    `AgentContributionRuntime.contributeStreaming` (paced, gated by `streamRevealMs`, gateway-only — CLI/tests
    emit the whole block). `surface.agent.reasoning.summary` + `surface.agent.work.timing` (ADR-0029) folded
    into `agent_reasoning` / `agent_work_timings`, emitted by the fiber loop from each dispatch's
    `emissions.trace` + measured latency; `CognitiveUnitHost` now publishes `reasoning.completed` from
    `emissions.trace` (closes the ABI `outcome` contract). New `SurfaceState` slices exported via
    `@inevitable/surface/client`. `pnpm verify` green; the gateway replay-equivalence test passes with live
    streaming enabled.

- **UCS — Cognitive Frames, MCCR & the narration-script split** (ADR-0030; SRF-001 §4.7–§4.8, SRF-002 →
  schema 1.4.0, SRF-005 §4.7, F16/F09). The board stops being a growing document: it holds only the **Minimal
  Complete Cognitive Representation (MCCR)** — distilled anchors (concept, definition, formula, diagram,
  relationship, mental model, table, example, memory cue, image) — while a **separate paced narration script**
  carries the teaching. Learning divides into viewport-complete **Cognitive Frames** that never scroll.
  - *Phase 0 (spec law)* ✓ — ADR-0030 + SRF-001/002/004/005 + F16/F09 updated; eight `surface.frame.*` events
    (planned/composed/element.delta/narration.script.produced/image.decided/speculation.prepared/.invalidated/promoted)
    with ordering laws 8–11.
  - *Phase 1 (vertical slice)* ✓ — `packages/surface/src/frames.ts` (`CognitiveFrame`/`Mccr`/`MccrElement` +
    defensive fold readers); `SurfaceState` gains `frames`/`speculative_frames`/`narration_scripts`/
    `image_decisions`/`streaming_frame_elements` with replay-equivalence proofs (`fold([planned,composed]) ≡
    fold([composed])`, transient element deltas, speculation discard/promote). `SurfaceComposerUnit`
    (`@inevitable/product-cognition`, one model call → `{mccr, narration_script, image_plan}`, deterministic
    world-state fallback) + `composer`/`frameplanner`/`imageplanner` manifests. `SurfaceSession.composeFocusFrame`
    (behind `composerDispatcher`) emits the frame, the separate script, and the image decision, voices the
    script with **element-targeted focus** (`choreographer.narrateScript`), and surfaces composer reasoning to
    the Observatory; legacy explanation-block path is the graceful fallback (F16 §12). Frontend `FrameStage` +
    `MccrElement` (registry) + `HighlightLayer` (moving marker) + `useFitToViewport` (no-scroll) +
    `useChoreographer` `activeFrameId`/`highlightElementId`; `SurfaceView` selects FrameStage when frames exist.
    `pnpm verify` 25/25 green.
  - *Gateway cutover* ✓ — the **live product now renders the frame path**: `apps/api/host.ts` sets
    `composer:true` (CLI/debug stays on the legacy explanation-block path so `expand` + the substrate stay
    covered). Governance fix: `composer`/`frameplanner`/`imageplanner` added to the `STUDENT_AGENTS` allowlist
    (GOV-P01, trust ≥ 1) — presenting a learner's own session is core student cognition, not a privileged
    KG mutation. Gateway integration tests (gateway/voice-media/continuity/durable-persistence) migrated from
    explanation-block/`expand` assertions to the frame path; the SRF-005 replay-equivalence test passes with the
    composer live (client fold of streamed `surface.frame.*` ≡ server state). `pnpm verify` 25/25 green.
  - *Phase 2 (frame decomposition)* ✓ — `FramePlannerUnit` (`@inevitable/product-cognition`, one model call →
    `{frames[], pacing}` with per-frame `title`/`sub_focus`/`archetype`/`slots`, deterministic single-frame
    fallback, density-capped). `SurfaceSession.planAndComposeFrames` (behind `framePlannerDispatcher`) decomposes
    the concept into a **progressive sequence** of frames — each `surface.frame.planned` (layout reserved) →
    `surface.frame.composed` (composer steered by `sub_focus` so each frame distills different anchors) — and
    renders **practice & assessment as their own deterministic frames** (sparse monotone ordinals). Frontend
    `FrameDeck` cross-dissolves between frames as the narration cursor crosses a boundary and **buffers the N+1
    frame off-stage** (image pre-warm); Observatory `CompositionPanel` surfaces the frame queue (status, MCCR
    anchors, density budget, image decision, look-ahead). Planner wired at the gateway (`framePlanner:true`);
    CLI stays single-frame/legacy. `pnpm verify` 25/25 green.
    *Active frontier:* Phase 3 (governed look-ahead speculation + `lookaheadBudget` live-config),
    Phase 4 (Image agent), and `expand()`-on-frames (deferred decision).

These layers are the manifestation of `spec/architecture/Cognitive-Architecture.md` (ADR-0023). Deferred
research tier (consciously off the critical path): federation, cognitive-ir/isa/compiler, query-engine,
networking, economics, filesystem, consensus.

## Implementation Doctrine

Every implementation unit must be traceable to:

1. A spec domain.
2. A protocol or event contract where applicable.
3. An observability contract.
4. A failure-mode contract.
5. A verification strategy.

If a stronger design is discovered through research or the local reference repositories, update
the spec first, document the decision (ADR when major), then implement.
