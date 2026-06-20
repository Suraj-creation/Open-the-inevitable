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

## Phase 2C — The Visible Surface (2026-06-12)

The Cognitive Surface became visible and live in a browser — the first moment a human can open
The Inevitable and watch cognition unfold. The runtime stays the source of truth; the UI is a
projection. Built on a deliberate architectural re-review (the user's three considerations):

**Re-review decisions.** (1) *Layout primitives* stay at the projection layer, not canonical —
SRF-001 already declares "layout state remains outside the canonical record," so canonical
`SurfaceNode/Region/Layout` would both be speculative complexity *and* a law violation. The
foundation went where it belongs: a client block-renderer registry + region composition.
(2) *The Surface is a Runtime, not a UI* and *provider-agnostic rendering* — codified in ADR-0006;
the registry keys on `block_type`, never on provider. (3) *Cognitive environment, not
prompt→response* — baked into the transport via a persistent session + a typed command envelope.

**Specs (spec-first).** `spec/surface/surface-streaming-sync-protocol.md` (SRF-005): snapshot +
incremental SSE delivery (`id` = bus sequence), `Last-Event-ID` resume / re-snapshot, the typed
command channel as the only mutation path, the network trust boundary, replay equivalence (client
fold ≡ server state), and the cognitive-environment framing. `spec/architecture-decisions/ADR-0006-surface-gateway-transport.md`:
SSE-down + POST-up over `node:http` (zero runtime deps; chosen over WebSocket for clean
events-down/intents-up separation and replay-friendly resume), React+Vite for the leaf app, and
the three principles above. Registered the `gateway.*` family (recorded-observation,
non-replayable) in the taxonomy, event-index, dependency-graph, and `family-registry.ts` — kept a
*separate* family so the canonical `surface.*` fold never sees ephemeral connection events.

**Implementation.**
- `@inevitable/surface` gained a browser-safe `./client` export (`src/client.ts`) re-exporting only
  `foldSurfaceEvents` + pure types — the fold's runtime imports are all type-only, so the browser
  bundle pulls zero Node deps. The *same* fold runs server-side and in the browser.
- `apps/api` (Surface Gateway): `host.ts` registers long-lived sessions (reusing the CLI's proven
  `buildDemoSession`, one unique seed per surface so id-spaces never collide; `gateway.*` events use
  a *separate* id generator so they never perturb the session's seeded determinism). `server.ts` is
  a `node:http` router: `POST /api/surface` (enter), `POST /api/surface/:id/command` (typed
  `ask|expand|close`), `GET …/stream` (SSE snapshot + live, `Last-Event-ID` resume, `: snapshot-complete`
  marker), `GET …/state`, `GET …/trace/:blockId`. Governance is unchanged — every mutation crosses
  `ProductRuntimeDispatcher`.
- `apps/web` (Vite + React): `useSurfaceStream` (EventSource → accumulate → `foldStream`),
  `SurfaceView` (regions: timeline rail · cognition stream · provenance inspector), `blocks.tsx`
  (the `block_type` registry; text renderer default, typed media placeholders), `App` (enter →
  auto-ask → live), `api.ts` (typed command client). `vite.config.ts` aliases the `./client` source
  and proxies `/api` to the gateway.

**Verification.** Full `pnpm verify` green — 21 turbo tasks per gate (was 19) across packages +
apps + services. `apps/api` in-process tests (6): snapshot fold ≡ `session.state()`, strict
sequence order, `Last-Event-ID` resume with no gaps/dupes, live command frames after snapshot, the
governed boundary (untrusted ask → zero agent blocks), and unknown-command rejection. `apps/web`
tests (5): `SurfaceView` renders timeline/blocks/routing/provenance and the multimodal placeholder
via `renderToStaticMarkup`; `foldStream` reconstructs state from a synthetic event log. Manual e2e:
`pnpm dev:gateway` (:8787) + `pnpm dev:web` (http://localhost:5173) — enter a goal, watch the
timeline and cognition blocks stream in live, deepen an explanation block.

Governance-relevant nuance discovered + spec-aligned: an untrusted `ask` *degrades* (200, zero
agent blocks) rather than erroring, per SRF-001 §10; a single-dispatch `expand` returns a typed
governance error. SRF-005 §10/§11 were tightened to record both behaviors.

## Phase 2D — Curriculum Generation & Live Gemini (2026-06-12)

The first 2D increment: any goal generates its own living timeline, and real Gemini cognition runs
end-to-end.

**Live Gemini.** Standardized on `GEMINI_API_KEY` (the user's key saved to a gitignored `.env`;
`.env.example` committed). Added a zero-dependency `.env` loader (`apps/api/src/env.ts`,
`apps/cli/src/env.ts`) since tsx/node don't auto-load `.env` across all supported versions — it sets
only keys not already present (real env wins). `@google/genai` provisioned at the workspace root
(edge-provisioned per ADR-0005; the adapter still imports it via a guarded dynamic import, so it is
never a substrate dependency and typecheck never sees it). The provisioned-SDK reality made the
adapter's old "SDK absent → E_ADAPTER_UNAVAILABLE" test obsolete; rewrote it to assert the
guarded-import *contract* (typed Result, resolves a client offline, no network until `generate()`).
The gateway test was made hermetic (clears `GEMINI_API_KEY` in `beforeAll`) so tests never make live
calls. Verified live: gateway reports `model: gemini`; a real ask returns genuine `gemini-2.5-flash`
cognition (confidence 1, no `fallback_reason`).

**Curriculum generation (PCR §12).** `CurriculumUnit` (`packages/product-cognition/src/curriculum-unit.ts`)
is the F02/F03 curriculum agent: goal → prerequisite-ordered concept DAG, dispatched through the
*same* governed path (a privileged agent, GOV-P01 trust ≥ 3; governance gate + scheduler + OTel +
D3 recording all apply). Self-contained: model attempt + inline deterministic scaffold fallback
(`Foundations → Core → Applying <goal>`), so the NullModelRuntime (which returns layered text, not
concepts) and any model failure still yield a real, deterministic, acyclic timeline.
`parseCurriculumOutput` de-dupes ids, drops prerequisites referencing unknown ids, and defaults the
focus to the first prerequisite-free concept. `buildDemoSession` (the shared composition root in
`@inevitable/cli`) gained a governed `generateCurriculum(goal) → SurfaceAskInput`; the gateway
`host.ask` and the CLI `main.ts` now generate a curriculum per goal instead of the seeded
`demoAsk` DAG (kept as a fixture for tests).

**A bug found by the live e2e.** The first arbitrary-goal run fell back to the scaffold even with
Gemini connected. A throwaway probe showed `finishReason: max_tokens` — gemini-2.5-flash spends
output budget on internal "thinking", and a 5–8 concept DAG overran the 1024-token request, so the
JSON truncated and parse failed. Fix: raised the curriculum request to `maxTokens: 4096`
(`responseSchema` itself was fine — it produced clean, fence-free JSON). Re-verified live: "Teach me
Photosynthesis" → a 7-concept, foundational-first photosynthesis curriculum.

**Verification.** Full `pnpm verify` green — 22 typecheck / 22 test / 21 lint tasks, format clean.
New: `curriculum-unit.test.ts` (6 — parser dedupe/drop-unknown-prereq/focus-default, deterministic
scaffold determinism, model-curriculum happy path, non-curriculum-output fallback). Gateway tests
updated for the curriculum-first flow (untrusted ask blocked at the privileged curriculum dispatch →
zero agent blocks). The CLI demo (D3 record/replay) is unchanged — it drives `surface.ask(demoAsk)`
directly.

---

## Phase 2D — The Cognitive Stage: synchronized, narrated, visible cognition (2026-06-14)

A deep product-experience review preceded this work: the founder judged the visible surface still
"felt like a typical AI app." We studied OpenMAIC (open.maic.chat) live, re-read the Cognitive
Surface research corpus and F09/F16, mined the reference repos, and diagnosed the gap precisely — the
trajectory `Runtime → Event Stream → React UI` was correct but stopped one layer short: there was no
**choreography layer** turning the event stream into *time-synchronized, attention-directed,
multi-agent visible cognition*, and the viewport rendered state as a static 3-column dashboard. The
fix grafts OpenMAIC's grammar of synchronized attention (timed narration, spotlight, staged reveal,
speaker presence over a transport) onto our governed, replayable substrate — expressed as
`surface.*` events, not a frozen lesson.

**S1 — Choreography foundation (spec-first).** Authored **ADR-0007 (Surface Choreography & Timing)**
and updated SRF-002 (schema 1.1.0) / SRF-001 / event-taxonomy. Added three additive `surface.*`
subtypes — `narration.segment`, `focus.changed`, `presence.updated` — and folded them into a new
choreography slice on `SurfaceState` (`narration[]`, `focus`, `presence[]`) in `projection.ts`,
preserving forward-compatibility and replay equivalence. The central resolution: events carry only
**logical order + durations, never a playback clock**; the animation schedule is a client projection,
so `fold(events)` stays byte-identical.

**S2 — Choreography producer.** Added `SurfaceChoreographer` (`packages/surface/src/narration.ts`): a
deterministic sentence/clause segmenter + emitters for presence → narration.segment (with focus) →
presence. Wired into `SurfaceSession.ask()` (narrate the freshly-generated explanation) and
`expand()` (**re-narrate the freshly-generated deeper layer** — interaction drives live
re-explanation). The `TextSurfaceRenderer` surfaces narration + presence. **Principle codified
(SRF-001 §2, ADR-0007 §7, F16 non-goal):** the surface is a *live, continuously-planning, interactive
classroom* — explanations are generated dynamically on demand (the product default is the
model-backed `ModelBackedUnit`; `DeterministicMvpUnit` is only the offline fallback); static
pre-generation is a non-goal; "not deterministic" applies to *generation*, while *replay* stays exact
via recorded outputs.

**S3 — The Cognitive Stage (the milestone).** Rebuilt `apps/web` as a theater of thought: a
`CognitiveStage` (spotlighted focused concept + dim context ribbon), a `LivingTimeline` spine that
glows in sync with focus, an `AgentPresence` ensemble (per-role sigils + presence states), a
`ProvenancePeek` (the `/trace` chain — "why this appeared"), and a `NarrationTrack` with transport,
all driven by a client `useChoreographer` (pure projection; cursor + transport over the folded
narration). A new design language (`tokens.css`) — deep observatory palette, editorial serif
(Fraunces) for concepts/narration, geometric grotesk for chrome, light-models-attention, restrained
cubic-bezier motion, `prefers-reduced-motion` honored. Guided by the high-end-visual-design skill.
Verified live in-browser against the real Gemini gateway: "Teach me Neural Networks" rendered a real
curriculum spine, a spotlighted narrated *Vectors and Matrices* explanation with an unfolding
Intuition layer, three contributing agents, and provenance — no console errors.

**S4 — Gemini voice + out-of-band media.** Added `GeminiVoiceRuntime` + deterministic
`NullVoiceRuntime` (`@inevitable/adapters/voice.ts`): Gemini TTS → base64 PCM → WAV wrap + duration
from sample count; guarded dynamic import + `fromClient` test seam, mirroring the model adapter. A
gateway `MediaStore` + route `GET /api/surface/:id/media/:artifactId` serve audio **out-of-band**
(bytes never on the SSE stream); a `createVoiceSynthesizer` bridge stores bytes and returns only a
`voice {artifact_id, content_ref, duration_ms, provider_id}` reference, threaded through
`buildDemoSession` into the choreographer. The client `useChoreographer` plays the audio and uses its
`ended`/`currentTime` as the pacing ground truth, falling back to a reading-time estimate for
text-only segments. Updated SRF-004/SRF-005.

**S5 — Polish & docs.** Global `:focus-visible` rings (keyboard navigability), contrast bumps on
instructional text, reduced-motion. Docs updated (this entry, CHANGELOG, IMPLEMENTATION, CLAUDE §5).

**Verification.** Full `pnpm verify` green across all 21 tasks (typecheck/test/lint/format). New
tests: `projection.test.ts` (+4 choreography fold/replay), `narration.test.ts` (7 — segmenter,
collection, emit→fold round trip), `session.test.ts` (+1 live model-backed narration via an injected
fake `ModelRuntime`), adapters `voice.test.ts` (5 — WAV header, Null determinism, Gemini fromClient,
empty/throw), gateway `voice-media.test.ts` (2 — narration carries voice, media route serves WAV).
Replay equivalence (client fold ≡ server state) re-confirmed with all new events present.

## 2026-06-18 — Architectural roadmap + Phase 2E (Durable Substrate, P1)

**Chief-Architect gap analysis.** Before resuming feature work, ran a repo-wide maturity audit (three
parallel substrate/spec/product explorations). Finding: the cognitive path is genuinely
PRODUCTION-grade and deterministic, but **all state is in-memory** — a process restart is total data
loss, so event sourcing, replay, temporal cognition, and persistent learner memory hold only within
one process lifetime, and no second manifestation can share substrate state. Produced a minimal phased
roadmap (P1 durable persistence → P2 identity/continuity/context → P3 KG engine + explanation depth +
observability analysis → P4 multi-agent cognition → P5 digital twin → P6 governed self-evolution; P7
platform/SDK as continuous discipline). Many specced domains (federation, cognitive-ir/isa/compiler,
query-engine, networking, economics, filesystem, consensus) consciously deferred off the critical path.

**P1 — Durable substrate (spec-first).** Authored **DPS-001** (`spec/persistence/durable-cognitive-persistence.md`)
and **ADR-0008**: the event log is the unit of durability (world-state/memory are replay projections of
it; snapshots are a later optimization); out-of-band media is persisted separately (it is never in the
log); persistence is a sink, never part of the canonical record; the determinism ladder's "event log
preserved" becomes literal/cross-process (not a new rung). Registered `persistence` in the domain index,
added a Phase 2E dependency block, and noted durability in the replay spec.

**Implementation (pure `node:fs`, behind existing contracts).** `FileEventTransport`
(`packages/adapters/src/durable.ts`): append-only JSONL, per-subject monotonic sequence, ordered
subject-matched replay, reopen-safe, torn-final-line tolerant; preserves each event's original bus
`sequence`. Zero native/third-party deps (`node:fs` is a builtin, so it is always available — the
ideal offline default) and it passes the *same* `runEventTransportConformance` harness as the
in-memory reference. Refactored `apps/api/src/media.ts` into a `MediaStore` interface +
`InMemoryMediaStore` (default) + `FileMediaStore` (disk). The gateway (`host.ts`) gained a
`ServedSurface` seam so the server (`server.ts`) talks to live and restored surfaces identically; when
`COS_PERSIST_DIR` is set it mirrors every surface event to a per-surface durable log (one buffering
sink, flushed once the surface id is known — nothing missed, nothing double-written) and reconstructs
a surface **read-side** on restart by folding the durable log. Live write-continuity after restart
(world-state rehydration) is explicitly P2; a restored surface returns a typed signal for live commands.

**Verification.** Full `pnpm verify` green (21/21 typecheck/test/lint + format). New tests: adapters
`durable.test.ts` (conformance pass, reopen + sequence preservation, catch-all subject) and gateway
`durable-persistence.test.ts` (a fresh gateway over the same dir folds the durable log to a
byte-identical `SurfaceState`; out-of-band WAV resolves post-restart; a restored surface rejects live
`ask` with a typed error). CLAUDE.md untouched (it is now timeless; §5 is a pure pointer).

## 2026-06-19 — Phase 2.1 (Cognitive Continuity / live rehydration)

**Gap closed.** DPS-001 deferred *write-continuity*: a restored surface could be viewed but not driven.
This increment (the first of P2) makes a restored surface live. Investigation confirmed the crux:
world-state and tiered memory are each event-sourced on their *own* logs (the `WorldStateGraph` keeps a
private delta log + `snapshot()`/`restore()`; `TieredMemoryStore` keeps per-tier mutation logs +
`history()`), **not** on the event bus — so P1's durable event log alone cannot rebuild them. The
id-collision risk (the `SeededIdGenerator` counter is seed-independent, so a "fresh seed" would re-emit
identical ids) is sidestepped by giving the resumed session a `CryptoIdGenerator`.

**Spec-first.** Authored DPS-002 (`spec/persistence/cognitive-continuity-and-rehydration.md`) + ADR-0009:
restore three artifacts each from its own source of truth; `hydrate` not replay-through-publish (no
re-run side effects); resumed sessions use crypto ids; a `resume()` path distinct from `start()`; the
gateway upgrades a restored surface to live, falling back to read-side only on missing/corrupt snapshots.
Registered DPS-002 in the dependency graph; the domain index already carried `persistence`.

**Implementation.** `EventBus.hydrate(events)` (events package): load into an empty bus, advance the
sequence past the max, no delivery/validation/governance. `SurfaceSession.resume(surfaceId)` (surface):
adopt the id, emit/write nothing. `buildDemoSession` (cli): exposes `memory` on the fixture and takes an
optional `restore` (world snapshot + memory mutations + events + surfaceId) → `world.restore`, replay
`memory.commit`, `bus.hydrate`, and a `CryptoIdGenerator`. Gateway `host.ts`: `persistSnapshots()`
writes `world.json` + `memory.json` after each command; `get()` is now async and, on a cold-miss,
`rehydrate()`s a live session (re-attaching the durable sink so new events keep appending) or falls back
to read-side `resumedServed`. `server.ts` awaits `host.get`.

**Verification.** Full `pnpm verify` green (21/21 + format). New tests: events `bus.test.ts` (+2 —
hydrate loads without delivery + continues the sequence; refuses a non-empty bus); gateway
`continuity.test.ts` (a new ask after restart appends fresh cognition with prior state intact and unique
ids; expand works live). The DPS-001 "rejects live commands" test was repurposed to cover the DPS-002
failure mode (missing snapshots → read-only fallback). CLAUDE.md untouched (timeless).

## 2026-06-19 — Phase 2.2 (Durable Learner Identity & Resume-by-Learner)

**Gap closed.** Every surface was owned by one hardcoded demo learner (`cog-demo-learner`/`user-demo`):
all users shared an identity, surfaces belonged to no one, nothing persisted across a learner's
sessions. This increment makes the learner first-class and durable — continuity of *who*, layered on
P2.1's continuity of *state*, and the precondition for the Digital Twin.

**Spec-first.** DPS-003 (`spec/persistence/durable-learner-identity.md`) + ADR-0010: a durable learner
registry at the gateway boundary; resolve-or-mint on create (known id reuses identity + trust; unknown
id never claimed); the real learner threaded through `onboarding()`; resume-by-learner via a learner
route; identity minted via the shared `newCid` authority (kernel `IdentityService` as sole authority is
a noted future refinement). Registered DPS-003 in the dependency graph.

**Implementation.** `apps/api/src/learners.ts` — `LearnerRegistry` (resolveOrCreate / get / recordSurface;
file-backed at `<dir>/learners/<id>.json`, in-memory otherwise). `apps/cli/src/wiring.ts` — `onboarding()`
takes a `LearnerDescriptor {userId,cid,trustLevel}` with ids derived from `userId`; `buildDemoSession`
gains `learner` and `idGenerator` options (the demo learner remains the default). `apps/api/src/host.ts`
— `create()` resolves-or-mints the learner, threads the descriptor, records the surface↔learner
association, writes `learnerId` into `meta.json`, returns `{surfaceId, learnerId}`; `rehydrate()` loads
the learner by `meta.learnerId` (read-side fallback if missing) and threads it so a resumed surface keeps
the right identity; `getLearner()` added. `apps/api/src/server.ts` — `POST /api/surface` accepts
`learnerId` and returns `learner_id`; new `GET /api/learner/:learnerId`.

**Latent bug fixed.** The `SeededIdGenerator` is seed-independent (only its counter drives output), so
the gateway's "unique seed per surface" never actually separated id-spaces — two surfaces minted the
same `srf-…` id (exposed by the first multi-surface test). Gateway-hosted surfaces now use a
`CryptoIdGenerator` (resumed sessions already did); the broader `SeededIdGenerator` fix is left out of
scope (wide blast radius on seeded-id assertions across packages) and noted.

**Verification.** Full `pnpm verify` green (21/21 + format). New test: `learner-identity.test.ts` (3 —
distinct learners by default + surface ownership; a known learnerId reuses identity across a restart and
accrues surfaces, first surface still rehydrates live; an unknown id is never claimed). All prior gateway
tests stay green under crypto surface ids. CLAUDE.md untouched (timeless).

## Phase 2 — P2.3: Shared Per-Learner Cognitive Memory (2026-06-20)

Continuity of *cognition*, the fourth movement of the continuity arc (durability → state → identity →
cognition) and the substrate on-ramp to the Digital Twin (P5). Full `pnpm verify` green (21/21 + format),
fully offline.

**The gap.** After P2.2 a learner was durable and owned surfaces, but each surface's world-state and
memory were per-surface: mastery earned in surface A was invisible to surface B even for the same learner,
so the supervisor re-taught already-mastered concepts the moment a new surface opened. This was the
explicit deferred next increment of DPS-003.

**Spec-first.** Authored **DPS-004 — Shared Per-Learner Cognitive Memory** (`spec/persistence/`) and
**ADR-0011**. The cut follows the memory-tier semantics: a learner's *durable knowledge* carries across
surfaces; *session scratch* does not. A learner's **cognition profile** is the deduplicated union, across
their surfaces, of (a) the mastery subgraph — `mastery_checkpoint` nodes scoped by `ownerUserId`, the
`concept` nodes they verify, and the assess edges between carried nodes — and (b) durable-tier memory
mutations (`semantic`/`procedural`/`reflective`). It is a *derived projection* of the per-surface durable
artifacts (which remain the unit of durability, DPS-001), never a second source of truth. Registered
DPS-004/ADR-0011 in the persistence domain index.

**Design — capture-then-seed, around the canonical record.** Verified the linchpin first: mastery
checkpoints carry `props.ownerUserId = session.intentLease.owner_user_id`, and the supervisor queries
exactly that — so seeding surface B (same `userId`) with surface A's mastery short-circuits routing to
`complete`. After each `ask` the gateway extracts the learner-durable subset from the live surface and
merges it (idempotent, id-keyed: nodes/edges by id, mutations by `mutation_id`) into the profile. On
surface **create** for a resolved learner the profile is seeded into the fresh substrate **before**
`start()` — applied via `world.apply`/`memory.commit` while nothing is wired, so it is silent state
reconstruction: no `surface.*` event fires, no subscriber is re-triggered, no model is re-invoked (the
same discipline as DPS-002 `hydrate`/`restore`). Seed and `restore` are mutually exclusive: create seeds
a new surface; resume restores an existing one (which already contains the cognition seeded at its create).

**Implementation.** `apps/cli/src/wiring.ts` — `LearnerCognitionSeed` type, `extractLearnerCognition()`
(pure read of the mastery subgraph + durable tiers), an internal `applyLearnerSeed()` (best-effort/
fail-soft), and a `learnerSeed` build option applied in the `else if` branch beside `restore`.
`apps/api/src/learners.ts` — `LearnerRegistry` gains an in-memory cognition map + `readCognition()` /
`mergeCognition()`, persisted to `<dir>/learners/<id>.cognition.json` when durable (in memory otherwise,
so cross-surface carry works in-process without persistence). `apps/api/src/host.ts` — `HostedSurface`
carries the owning `learnerId`; `create()` loads the profile and passes `learnerSeed`; a `captureCognition()`
runs after each `ask` (guarded for legacy surfaces with no learner). Decision: the extract/seed seam lives
in the composition root (`buildDemoSession`), co-located with the existing `DemoRestore` machinery that
`apps/api` already reuses; promoting it into a substrate package is a noted future refinement once a second
manifestation needs it (the §2 discipline already holds — apps depend on the substrate, never the reverse).

**Verification.** New tests: `apps/cli/tests/shared-cognition.test.ts` (4 — a fresh surface routes to
`explanation`; extract captures the mastery subgraph + durable memory but not session scratch; a seeded new
surface starts with prior mastery and routes the mastered concept to `complete` with no re-explanation;
seeding emits no `surface.*` event). `apps/api/tests/shared-cognition.test.ts` (2 — cross-surface carry in
memory within one process, with a fresh-learner control; carry across a simulated restart with the profile
loaded from disk). All prior tests stay green. CLAUDE.md untouched (timeless).

**Scope note.** P2.3 makes durable knowledge *present* in a new surface; making it *retrieved on demand*
(context-lease-bounded, VectorStore-backed working-memory assembly) is the next P2 increment. The profile
a surface carries is a point-in-time snapshot taken at create; continuous cross-surface convergence and
cross-surface consolidation/decay are deferred (naturally twin concerns).

## Phase 2 — P2.4–P2.6: Context, Intent & Capabilities (P2 complete) (2026-06-20)

The final three increments of P2 (Identity, Continuity & Context). Each spec-first; full `pnpm verify`
green throughout (22 tasks, fully offline). With these, **P2 is complete**: a learner is durable
(P2.2), their state and cognition carry across surfaces (P2.1/P2.3), their durable knowledge is
retrievable under a lease (P2.4), their goal becomes a real intent lease (P2.5), and their capabilities
are dynamically governable (P2.6).

**P2.4 — Context-lease-bounded retrieval (DPS-005 / ADR-0012).** New package `@inevitable/context`:
`ContextAssembler` (VectorStore-backed; the `@inevitable/contracts` adapter, `InMemoryVectorStore` by
default) + a deterministic token-hash bag-of-words `embedText` (offline + replay-safe; model embeddings
a future refinement). `assemble({query, lease})` ranks indexed durable-memory items by cosine and
admits them fail-closed under the `ContextLease`: tier (`memory_layers`), user (`allowed_users`), token
budget, expiry — reporting `excludedByLease`/`droppedForBudget`. `buildDemoSession.assembleContext(query)`
indexes the durable tiers (semantic/procedural/reflective), assembles, and commits admitted items into
the `working` tier (the distribution channel; working is session scratch, excluded from DPS-004 capture);
gateway `runAsk` calls it each ask. Tests: context pkg (7) + cli integration (3). Boundary: assembles;
agent-prompt consumption is P3.

**P2.5 — Intent inference (spec/kernel/intent-inference / ADR-0013).** `IntentInferenceUnit`
(`@inevitable/product-cognition`, `agent.intent`) — model-backed with deterministic fallback, same
governed ABI as `CurriculumUnit`. `inferIntent(goal)` interprets → `{interpreted_goal, scope,
constraints, confidence}` and re-interprets the session intent lease **in place** (keeps `intent_id` =
surface `session_id` stable, so surface identity doesn't fork), emitting `intent.received` →
`intent.interpreted` (intent family already registered). `agent.intent` added to STUDENT_AGENTS (trust≥1)
+ `ProductRuntimeAgentId`/`workTypeFor`. Gateway calls it best-effort before curriculum (untrusted
degradation unchanged — verified by the existing gateway test still passing). Tests: unit (6) + cli
integration (3). Boundary: interprets + binds; driving curriculum/retrieval from the interpreted
goal/scope is a follow-up.

**P2.6 — Capability registry (spec/kernel/capability-registry / ADR-0014).** `CapabilityRegistry`
(`@inevitable/kernel`): per-subject grant/revoke/has/granted/list of individual named capabilities,
revoked grants retained for audit; in-memory (durable grants deferred). New governance policy
**GOV-P03-DISPATCH-CAPABILITY** — opt-in by presence of a `capabilities` context; blocks a dispatch whose
required `dispatch.<agentId>` is revoked/absent; no-op otherwise (so existing dispatcher tests, which wire
no registry, are unaffected). `ProductRuntimeDispatcher` gains an optional `capabilityRegistry` (structural
type — no kernel dep) and populates `context.capabilities = registry.granted(subjectCid)`.
`buildDemoSession` grants the learner `dispatch.<agentId>` for all agents and threads the registry through
every dispatcher; revoking `dispatch.explanation` blocks the explanation dispatch in a live cycle (the
cycle still produces the routing block — graceful degradation). Tests: kernel registry (6) + product
GOV-P03 policy (3) + cli immune-system integration (3).

**Design notes.** GOV-P03's opt-in-by-presence was the key to landing the capability gate without
disrupting any existing governed path (only `buildDemoSession`-wired dispatchers carry a registry).
Intent re-interpretation is in place (not a new lease) specifically because the surface's `session_id`
is the lease `intent_id` — minting a new lease mid-session would fork surface identity. Both intent
inference and context retrieval deliberately stop at "produce/bind/assemble"; consuming the interpreted
intent + assembled context in agent prompts is adaptive prompt assembly (P3/F04 depth). Per the founder's
doc-cadence guidance, IMPLEMENTATION.md / CHANGELOG.md / this log were refreshed once at P2 completion
(not per sub-phase); the spec folder (DPS/ADR/kernel specs) was updated per sub-phase. CLAUDE.md
untouched (timeless).
