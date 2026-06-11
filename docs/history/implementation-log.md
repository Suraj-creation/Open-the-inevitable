# Implementation Log — Detailed Build Narratives

Append-only, newest at the bottom. This file holds the detailed, dated narratives of what each
phase delivered — the level of detail that does NOT belong in `CLAUDE.md` (constitution) or
`IMPLEMENTATION.md` (current state). Abstract milestone entries live in `CHANGELOG.md`.

When a phase lands: append one dated section here, rewrite `IMPLEMENTATION.md`'s Current State
and Active Frontier, add an abstract entry to `CHANGELOG.md`, and rewrite `CLAUDE.md` §5
(Current Posture, ≤8 lines).

---

## Phase 1D — Substrate Deepening (delivered)

Whole-monorepo verify passed: 17/17 typecheck, 17/17 test, 16/16 lint, format clean across 16
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

## Product topology setup (2026-06-03)

The complete product feature-spec suite created under `spec/product/features/`:

- F01-F05: onboarding, navigation, prerequisites, adaptive explanation, persistent memory.
- F06-F12: agent ecosystem, real-time orchestration, interdisciplinary graph, living-universe
  experience, research/innovation acceleration, institutional intelligence, governed evolution.
- F13-F15: identity/personas/modes, assessment/mastery/depth verification, content ingestion and
  universal knowledge substrate.
- F16: **The Cognitive Surface — Universal Multimodal Substrate** — the convergent surface from which
  all manifestations (whiteboard, living document, presentation, authoring canvas, notebook,
  knowledge-graph explorer, simulation, and long-horizon IDE co-editor) are projected. Backed by the
  deep-research dossier `spec/research/cognitive-surface-frontier-research.md`.

The canonical master-vision file is `spec/vision-application/The_Inevitable_Master_Vision.md`;
the old `Ambition-deep-committments.md` path remains only as a compatibility pointer.

## Phase 1E — initial runtime bridge (2026-06-03)

`@inevitable/product-cognition` delivered the first product-cognition runtime package:

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

## Phase 1E — architectural review + strengthening (2026-06-03)

A research-grade audit of `@inevitable/product-cognition` surfaced and fixed:

- **C1 (critical):** `LearningPathProjector.project()` mutated world-state before detecting cycles or
  unknown prerequisites, leaving the graph dirty on failure. Fixed: Kahn's algorithm (topological
  sort) validates the full concept seed graph *before* applying any delta — atomicity preserved.
- **C2 (critical):** `DeterministicMvpUnit` generated response packet IDs by appending `"ff"` to the
  input ID, bypassing the canonical `IdGenerator` and breaking the `cp-<24hex>` format. Fixed: inject
  `IdGenerator` into the unit and use `newPacketId()`.
- **S1 (significant):** `assertOk` was duplicated in `onboarding.ts` and `mastery.ts`. Extracted to
  `types.ts` as `assertWorldStateOk` with a scoped name and doc comment.
- **S2 (significant):** `ProductRuntimeDispatcher` had no recovery path from a unit Quarantine
  transition — subsequent dispatches would call `host.handle()` on a non-Ready host and deadlock.
  Fixed: reset `activated = false` on execution failure so the next dispatch re-activates.
- **S3 (significant):** `DeterministicLearningLoop` emitted no orchestration events, making the loop
  boundary invisible to replay and observability. Fixed: added `learning.loop.started` and
  `learning.loop.completed` events with injected bus/clock/idGenerator.
- **M1/M2 (tests):** Added test cases for scheduler-rejection (budget exceeded) and host-failure
  (throwing unit). Verified dispatcher returns typed `E_PRODUCT_RUNTIME_DISPATCH` errors in both.
- **M3 (tests):** Learning-loop test now asserts the prerequisite edge is in the world-state graph
  and the new loop events appear in the bus log.
- **cycle-guard (tests):** `learning-path.test.ts` asserts world-state node/edge counts are
  unchanged after a failed projection (proving C1 fix works).

Post-strengthening: 18/18 typecheck, 9 product-cognition tests (up from 6), format clean.
Branch `codex/phase-1e-product-cognition` merged to master (commit `3e3206b`).

## Phase 1E — supervisor routing + OTel trace capture + fiber dispatch (2026-06-09)

Branch `codex/phase-1e-supervisor-orchestration`:

1. **`SupervisorUnit`** (`packages/product-cognition/src/supervisor.ts`) — a `CognitiveUnit` that
   reads the `WorldStateGraph` (mastery checkpoints + concept phase-tracking props) and returns a
   `SupervisorRoutingDecision` embedded in `content.routing_decision` of the response packet.
   Routing precedence: `complete` > `revision` > `assessment` > `practice` > `explanation`.
   Spec: `spec/agents/supervisor-agent.md`, `spec/product/product-cognition-runtime.md §7`.
2. **OTel trace capture** (`packages/product-cognition/src/runtime-dispatch.ts`) — `withSpan()` from
   `@inevitable/observability` wraps `host.handle()` in `ProductRuntimeDispatcher.dispatch()`.
   Span attributes: `cos.packet_id`, `cos.agent_id`, `cos.agent_unit_type`, `cos.intent`,
   `cos.concept_ids`, `cos.trace_id`, `cos.span_id`. Spec: `spec/product/product-cognition-runtime.md §8`.
3. **`FiberedLearningLoop`** (`packages/product-cognition/src/fiber-learning-loop.ts`) — multi-step
   learning cycle (supervisor routing → explanation dispatch → practice dispatch → mastery recording)
   expressed as a deterministic `FiberRoutine` driven by `@inevitable/execution` `ExecutionEngine`.
   Produces an append-only D2-replayable execution journal. Bridge events (`learning.fiber.supervisor.
   routing.requested`, `learning.fiber.dispatch.requested`, `learning.fiber.mastery.record.requested`)
   carry tokens resolved by async handlers; `supervisor.route` is emitted post-cycle for observability.
   Phase-tracking props (`explanation_dispatched:<userId>`, `practice_dispatched:<userId>`) are written
   to concept nodes in the world-state after each successful dispatch so the supervisor's next routing
   reads them. Spec: `spec/product/product-cognition-runtime.md §9`.
4. **Eager-resolve buffer in `ExecutionEngine`** (`packages/execution/src/engine.ts`) — `resolve(token, value)`
   buffers the resolution when no fiber is currently waiting (the emit→await bridge fires `resolve()`
   inside the sink before the fiber has processed its subsequent `awaitValue` yield). The value is
   consumed the moment any fiber later yields `await(token)`. Spec: `spec/execution/cognitive-execution-engine.md §5`.
5. **Specs updated**: `spec/agents/supervisor-agent.md` (new), `spec/product/product-cognition-runtime.md`
   §7–§9, `spec/execution/cognitive-execution-engine.md` §4–§5.

All `pnpm verify` gates passed: 18/18 typecheck, 18/18 lint, all tests green (8 execution + 26
product-cognition + all prior packages), format clean.

## Phase 1E — governance dispatch gate + confidence-weighted routing (2026-06-11)

1. **`PRODUCT_DISPATCH_POLICIES`** (`packages/product-cognition/src/product-dispatch-policies.ts`) —
   `GOV-P01-DISPATCH-TRUST` (blocks `trust_level < 1`; privileged agents memory/curriculum require
   `trust_level ≥ 3`; unknown agents blocked) and `GOV-P02-DISPATCH-CLASSIFICATION` (flags a
   `"public"` classification ceiling for review). Spec: `spec/product/product-cognition-runtime.md §10`.
2. **Governance gate in `ProductRuntimeDispatcher.dispatch()`** — an optional `GovernanceEngine`
   is evaluated via `guard()` as the FIRST check, before any state mutation or scheduler admission.
   Blocked dispatches return `E_PRODUCT_RUNTIME_DISPATCH` with `decisionId`, `policyId`, `reason`,
   `outcome` in details. Governance is a kernel primitive, not a moderation layer.
3. **Confidence-weighted supervisor routing** — `MASTERY_CONFIDENCE_THRESHOLD = 0.6`; a passing
   mastery checkpoint with `max(confidence) < 0.6` routes to `revision` instead of `complete`.
   Spec: `spec/agents/supervisor-agent.md §10`.
4. **Tests**: `governance.test.ts` (9 — trust gate, privileged agents, allowlist, classification,
   decision metadata) + 3 confidence-routing tests. 38 product-cognition tests green.

## Phase 2A — Cognitive Surface Runtime (2026-06-11)

The first real product manifestation: a runtime where cognition itself becomes visible. New
spec domain `spec/surface/` (four specs) + new package `@inevitable/surface`. The UI is merely
a projection; the runtime is the product. Built entirely ON the existing substrate — no substrate
redesign.

**Specs (spec-first, authored before implementation):**

1. `spec/surface/cognitive-surface-runtime.md` — surface lifecycle (created → active → closed),
   Cognition Block model (typed, versioned, provenance-mandatory), SurfaceState as a
   deterministic fold over the `surface.*` event log, agent contribution model, renderer-as-pure-
   projection, replay + trace-capture contracts, governance/failure semantics.
2. `spec/surface/surface-event-architecture.md` — the `surface.*` event family (16 subtypes:
   created, timeline.generated/updated/completed, block.generated/modified, agent.joined/
   contributed/disagreed, memory.attached, visual.generated, simulation.started,
   explanation.expanded, reasoning.recorded, contribution.dropped, session.closed) with ordering
   laws and replay semantics. Registered in `spec/events/event-taxonomy.md` + `spec/indexes/event-index.md`.
3. `spec/surface/surface-timeline-engine.md` — the Living Timeline: a pure projection of
   world-state (concept DAG + mastery checkpoints + phase-tracking props) with status derivation
   (mastered/in_progress/available/locked), milestone detection, mutation-as-re-projection, and
   `surface.timeline.completed` transition-edge semantics.
4. `spec/surface/multimodal-provider-abstraction.md` — Gemini preparation layer: Image/Video/
   Voice/LiveSession/Multimodal provider adapter contracts, ProviderRegistry, deterministic
   NullProvider, D3 recording seam for Phase 2B. No vendor SDKs in `@inevitable/surface`.

**Implementation (`packages/surface`, 31 tests):**

1. **`CognitionBlock`** (`src/blocks.ts`) — 14 block types; mandatory `BlockProvenance`
   (packet_id, producer_cid, agent_id, source_event_id, world_state_nodes, memory_mutation_id,
   trace_id, reason); typed validation errors (`E_SURFACE_BLOCK`).
2. **`SurfaceTimelineBuilder`** (`src/timeline.ts`) — composes the existing
   `LearningPathProjector` (Kahn-validated DAG into world-state); deterministic topological
   ordering; status derivation mirroring the supervisor's confidence threshold; silent
   idempotent refreshes; completed emitted exactly once.
3. **`foldSurfaceEvents`** (`src/projection.ts`) — the replay primitive: pure fold from
   bus-ordered `surface.*` events to `SurfaceState`; forward-compatible (unknown subtypes count
   version only); enriches block provenance with the announcing event id at fold time.
4. **`AgentContributionRuntime`** (`src/contribution.ts`) — converts governed dispatch results
   (`ProductDispatchResult`) into blocks; emits agent.joined (first contribution) →
   block.generated → agent.contributed; `contributionFromDispatch()` extracts packet linkage,
   confidence, classification, and trace id from the response packet.
5. **`SurfaceSession`** (`src/session.ts`) — the live session: `start()` (world-state node first,
   then `surface.created`), `ask()` (living timeline → `FiberedLearningLoop` cycle → routing/
   explanation/practice/assessment blocks → `surface.memory.attached` for the mastery mutation →
   timeline re-projection), `close()`, `state()` (pure fold over bus replay — no separate state
   store), `trace(blockId)` (full provenance chain).
6. **`TextSurfaceRenderer`** (`src/renderer.ts`) — pure `SurfaceState → frame` projection proving
   UI-is-projection; future scene-graph/immersive renderers consume the same state.
7. **Provider layer** (`src/providers.ts`) — adapter interfaces + `ProviderRegistry` +
   deterministic `NullMultimodalProvider` (artifact is a pure function of the request).
8. **Trace capture** (`src/trace.ts`) — `traceBlock()` resolves block → events → packet → agent →
   world-state nodes (existence-checked) → memory mutation.

**Acceptance (verified in `tests/session.test.ts`):** start a session → ask "Teach me Neural
Networks" → living timeline generated (topologically ordered, statuses derived) → cognition
blocks appear (routing, explanation, practice, assessment) → supervisor decision visible
(`surface.reasoning.recorded` + routing block) → world-state updated (phase props + mastery
checkpoint) → session replays deterministically (identical seeds ⇒ deep-equal state; fold of
replayed log ⇒ live state) → every visible artifact traces to its sources → governance-gated
sessions produce zero agent blocks for untrusted learners.

## Phase 2B — Real Cognition on the Surface (2026-06-12)

Frontier chosen by repository-wide assessment (not roadmap inertia): the runtime was complete
but every thought in it was canned — no LLM existed anywhere. Phase 2B re-scoped "Multimodal
Cognitive Surface" to **model-backed cognition + D3 recorded replay + first runnable demo**;
media modalities deferred to 2C.

**Specs (spec-first):**

1. `spec/protocols/model-invocation-protocol.md` (NEW) — typed model invocation; invocation-key
   determinism (`<unit_id>:<packet_id>:<purpose>` + recorder-assigned ordinal);
   record-before-use law; replay-never-invokes law; fail-closed on replay miss
   (`E_MODEL_REPLAY_MISS`); error taxonomy; governance (network capability, cost ceilings, keys
   never in events); recording classification (`internal`/`sensitive`).
2. `spec/events/event-taxonomy.md` + `event-index.md` — `model.*` family (output.recorded,
   invocation.failed; owner runtime; permanent; replayable).
3. `spec/replay/deterministic-replay.md` — D3 marked realized via `model.output.recorded` v1.0.0.
4. `spec/surface/multimodal-provider-abstraction.md` §6/§12 — D3 seam concretized; text path
   shipped 2B, media modalities 2C.
5. `spec/product/product-cognition-runtime.md` — §11 Model-Backed Unit Contract (prompt
   assembly, JSON layered output, fallback semantics); §9 D3 extension point realized;
   non-goals reworded (no vendor SDKs, not "no LLM calls").
6. `spec/surface/cognitive-surface-runtime.md` §6.1 — `expand(blockId, layer)` step: expansion
   IS the typed modification (`surface.explanation.expanded` merges layers, bumps version).
7. `spec/indexes/` — protocol-index, dependency-graph (Phase 2B block).

**Implementation:**

1. `@inevitable/contracts` — `ModelGenerationRequest`/`ModelGenerationResult` (system,
   temperature, seed, responseSchema, invocation_key, finishReason, usage); `ModelRuntime`
   widened additively.
2. `@inevitable/events` — `DEFAULT_EVENT_FAMILIES` gained `model` (and the previously missing
   `surface`) registrations.
3. `packages/adapters/src/model.ts` (NEW) — `NullModelRuntime` (deterministic layered JSON,
   pure function of request); `GeminiModelRuntime` (guarded dynamic import of `@google/genai`,
   `GenAiClientLike` local narrowing, `fromClient()` test seam, finish-reason mapping);
   `RecordingModelRuntime` (record mode publishes `model.output.recorded` BEFORE returning —
   publish failure discards the result; replay mode resolves by `(invocation_key, ordinal)`
   from recordings and never invokes the inner provider).
4. `packages/product-cognition/src/model-backed-unit.ts` (NEW) — same `CognitiveUnit` ABI as
   `DeterministicMvpUnit`; persona/system prompt from manifest role + F04 layer-0-first
   pedagogy; world-state concept-title enrichment; timeout race; JSON parse/validation
   (`parseModelLayeredOutput`); response packet `response_kind: "model-cognition"` with
   `content.layers`/`summary`, model confidence, populated `ReasoningTrace`
   (`determinism_level: "D3"`); typed failures → fallback unit stamped
   `deterministic-fallback` + `fallback_reason`, confidence ≤ 0.5.
5. `@inevitable/surface` — fold case for `surface.explanation.expanded` (merge layers, bump
   block version); `SurfaceSession.expand()` re-dispatching through an injected
   `GovernedDispatcher` (structural interface; no bypass); renderer prints summary + layers.
6. `apps/cli` (NEW workspace app) + root `pnpm demo` — `buildDemoSession()` composition root
   (seeded; supervisor deterministic, explanation/practice model-backed with deterministic
   fallbacks, full governance), `main.ts` live event ticker + frame rendering; Gemini when
   `GEMINI_API_KEY` set, null model otherwise; recording always on.

**Tests (20 new; all deterministic, zero network, no SDK installed):** adapters ×9 (null
determinism, record-before-use ordering, ordinals, failure events, replay-never-invokes,
fail-closed miss, connect-without-SDK ⇒ `E_ADAPTER_UNAVAILABLE`, fake-client mapping);
product-cognition ×7 (parser, model-cognition packet + trace, malformed/refusal fallbacks,
no-fallback throw, governance blocks model unit with zero model calls); surface ×2 (expansion
fold merge, unknown-block tolerance); apps/cli ×2 (null-model determinism, **D3 acceptance:
seeded record→replay byte-identical frame with provider tripwire never invoked**).

Verification: full `pnpm verify` green (19 turbo tasks per gate across packages, apps, and
services); `pnpm demo` renders the
living surface in the terminal — timeline, model recordings, blocks with layered content,
expansion to layer 1, full provenance trace, 19 surface events + 3 model recordings.

## Instruction-system governance redesign (2026-06-11)

`CLAUDE.md` rewritten as a repository constitution (identity/mission, architectural laws,
canonical reference map including `spec/cognitive_surface/` and `spec/vision-application/`,
working doctrine, replace-only Current Posture capped at 8 lines, and explicit Constitution
Governance rules). `IMPLEMENTATION.md` restructured as a current-state document (state +
traceability + active frontier; dated narratives moved to this file). `CHANGELOG.md` scoped to
abstract milestone entries.
