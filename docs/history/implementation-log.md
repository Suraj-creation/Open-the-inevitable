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

---

## Phase 3 (P3.1–P3.3) — The ULI Core: Knowledge Graph, Explanation Depth, Observability Analysis
**Date: 2026-06-20**

All three sub-phases delivered spec-first (ADR + DPS authored before code; domain-index updated per
sub-phase). `pnpm verify` green across all 22 tasks throughout. Per doc-cadence guidance:
IMPLEMENTATION.md / CHANGELOG.md / this log refreshed once at P3 completion; spec folder updated
per sub-phase. Three commits on master:

### P3.1 — Knowledge-Graph Engine (`commit 25442b8`)

**Rationale:** World-state was a generic delta-sourced graph. The ULI requires recursive prerequisite
decomposition to a zero-knowledge start, which demands KG semantics layered on top of it — but as a
domain query layer, not a second store (the substrate stays singular). ADR-0015 resolves the design.

**Delivered:**
- `KnowledgeGraphEngine` (`packages/world-state/src/kg-engine.ts`): wraps `WorldStateGraph` as a
  query layer. Concept nodes → `concept:<id>` (matching the mastery recorder's convention). Prereq
  edges → `prerequisite_of` (DAG-enforced by graph's existing acyclicity). Bridge edges →
  `bridges_to` (informational; no acyclicity). `seedConcepts` is idempotent. Internal `Map` is a
  non-authoritative fast path for registry queries; the graph is the truth.
- API: `decompose(goalConceptId)` (DFS topo sort — leaves first), `learnerState(userId)` (reads
  mastery checkpoints + phase props from world-state), `nextConcept(userId, goal?)` (first unmastered
  in topo order), `addBridge(from, to)` (cross-domain bridge).
- `ConceptLayer` (0–6), `ConceptSpec`, `LearnerConceptState` exported from the package index.
- 13 unit tests + 4 integration tests in the CLI fixture.
- `DemoFixture.kg` pre-seeded with 4 ML concepts (linear-algebra → perceptron, gradient-descent →
  neural-networks) that feed adaptive depth in P3.2.
- Spec: `spec/world-state/knowledge-graph-engine.md` (DPS-006), `spec/architecture-decisions/ADR-0015`.

### P3.2 — F04 Layers 2–6 + Adaptive Prompt Assembly (`commit 1c8d0bb`)

**Rationale:** Explanation depth was layers 0–1 (Intuition + Visual). Layers 2–6 (Conceptual,
Mathematical, Applied, Advanced, Research) complete the F04 seven-layer model and make the system
a genuine Universal Learning Intelligence. ADR-0016 governs adaptive depth and assembled-context
threading, closing the P2.4/P2.5 prompt-consumption boundary that was deferred.

**Delivered:**
- `ModelLayeredOutput` extended to optional layers 2–6. `parseModelLayeredOutput` reads all seven.
  `LAYER_NAMES` constant maps each layer to a prompt instruction.
- `buildRequest` reads `packet.content.layer` (requested depth) and `world.getNode("concept:<id>")`
  `.props.layer` (natural depth); target = `max(requested, natural)`. System prompt includes layer
  instructions up to targetLayer; token budget = `max(1024, 512 × (targetLayer + 1))`.
- Assembled context threading: `SurfaceAskInput.assembledContextItems` → `FiberedLearningLoopInput.
  assembledContextItems` → `handleDispatch` content injection → `packet.content.assembled_context_items`
  → "Prior learner knowledge" block in `buildRequest` system prompt. Plain `{text, score}` objects;
  no cross-package type deps.
- Practice and assessment roles stay at layer 0 regardless of concept natural layer.
- 3 new spy-model tests in `model-backed-unit.test.ts`; 2 new parse tests.
- Spec: `spec/architecture-decisions/ADR-0016`.

### P3.3 — Cognitive Observability Analysis (`commit 8c4e1f9`)

**Rationale:** The §25.4 invariant ("observability tracks reasoning quality, drift, confidence,
learning outcomes") was unmet — traces and mastery events were captured but never analyzed.
Self-evolution (P6) needs drift and calibration signals as inputs. ADR-0017 makes the analysis
engine a pure event-driven subscriber so it never touches the production call path.

**Delivered:**
- `CognitiveAnalysisEngine` (`packages/observability/src/cognitive-analysis.ts`): 
  - **Drift detector**: sliding window of N confidence values (default: 20). Baseline = long-term
    mean. Drift score = `max(0, baseline - rolling_mean)`. Emits `observability.drift.detected`
    with severity when score > driftThreshold (default 0.15). Records `cos.drift.estimate` histogram.
  - **Confidence calibrator**: 5 equal-width bins over [0, 1]. Per-bin: tracks pass/fail counts,
    computes `|bin_center - pass_rate|`. Emits `observability.confidence.calibration_warning` when
    calibration error > threshold (default 0.25) with ≥ minSamples (default 5). Records
    `cos.confidence.calibration_error` histogram.
  - **Learning-outcome tracker**: per-concept `{attempts, passes, confidenceSum}`. Emits
    `observability.learning_outcome.summary` after each `learning.loop.completed`. Records
    `cos.learning.outcome_rate` counter.
  - `publish` callback injected at composition root (wiring.ts wraps `createEvent + bus.publish`).
    Engine has zero dependency on `@inevitable/events` — operates in metrics-only mode without a
    callback (safe for isolated tests).
  - Inspection API: `driftStats()`, `calibrationStats()`, `outcomeStats(conceptId)`.
  - `DemoFixture.analysis` exposes the engine; bus subscribes to `mastery.checkpoint.created` and
    `learning.loop.completed` at session build time.
  - 15 unit tests covering all three analysis dimensions + edge cases (missing fields, unknown events,
    below-threshold no-emit, well-calibrated bin no-emit).
- Spec: `spec/observability/DPS-007-observability-analysis.md`, `spec/architecture-decisions/ADR-0017`.

**P3 closes the ULI core.** The system now has a traversable knowledge graph with recursive
prerequisite decomposition, universal explanation depth (all seven F04 layers), adaptive prompts that
consume real context and KG-derived depth, and a cognitive quality signal loop (drift + calibration +
outcomes) that P6 self-evolution will read as its inputs.

---

## Phase 4 — Multi-Agent Cognition (2026-06-20)

### P4.1 — Proposal Blackboard + surface.agent.disagreed

**Goal:** make multiple agents visibly contend. The FiberedLearningLoop previously dispatched exactly one agent per phase (explanation or practice). P4.1 adds a concurrent challenger dispatch and records both proposals on a typed blackboard.

**ProposalBlackboard** (`packages/orchestration/src/proposals.ts`, DPS-008, ADR-0018) wraps `InMemoryBlackboard` with a typed proposal lifecycle: `propose(key, agentCid, value)` accumulates proposals for a key; `arbitrate(key, winnerCid, reason)` records the winner. Both logs are append-only. The blackboard version increments on every write (audit/replay friendly).

**Concurrent dispatch.** `FiberedLearningLoop.handleDispatch` was modified (ADR-0018 D2): when `challengerDispatcher` is present in deps, the explanation phase runs both dispatchers concurrently via `Promise.all([explanationDispatcher.dispatch(...), challengerDispatcher.dispatch(...)])`. The fiber routine is unchanged — the fan-out happens in the bridge layer, preserving D2 byte-identical journals. The explanation result is always the authoritative output; the challenger is a cognitive probe.

**Disagreement detection** (ADR-0018 D4): Jaccard similarity on the word-sets of each agent's `layer_0` text. If the similarity is < 0.3 (< 30% word overlap), the outputs are declared divergent. If either agent's `layer_0` is absent, no disagreement is declared. Private helpers: `wordSet`, `jaccardSimilarity`, `extractLayer0`, `outputsDisagree`.

**Emission** (ADR-0018 D5): a new `private orchestrationHlc: Hlc` field on the class (initialized in the constructor, separate from the run-scoped HLC) so bridge-layer events get their own monotonic clock. `emitDisagreement` builds a `surface.agent.disagreed` event via `createEvent` and publishes to `this.deps.bus`.

**Surface routing** (ADR-0018 D6): `FiberedLearningLoopInput.surfaceId?: string` is threaded from `SurfaceSession.ask()` (which has `this.surfaceId`) into the loop input. When present, the disagreement payload includes `surface_id` so the surface fold picks it up.

**Fold.** `SurfaceState` gains `readonly disagreements: DisagreementRecord[]`. `foldSurfaceEvents` handles `surface.agent.disagreed` by appending a `DisagreementRecord`. Three new projection tests cover: single disagreement, multiple accumulating in order, and empty initial state.

**Package change:** `@inevitable/product-cognition/package.json` adds `@inevitable/orchestration` as a dependency. `apps/cli/package.json` also adds `@inevitable/orchestration`. `pnpm install` run to update the lockfile.

**Challenger agent:** uses `DeterministicMvpUnit(manifest("revision"), idGenerator)` in `buildDemoSession` — `ModelBackedRole` only covers explanation/practice/assessment; model-backed revision is P7.

**Tests added:** `packages/orchestration/tests/proposals.test.ts` (14 tests — propose, multi-agent, independence, arbitration, timestamps, snapshots); `packages/surface/tests/projection.test.ts` extended with 4 disagreement fold tests.

### P4.2 — Governed Tool Runtime

**Goal:** implement the `ToolRuntime` contract (`packages/contracts`) with a governed in-process adapter, observable via the event bus.

**InMemoryToolRuntime** (`packages/adapters/src/tools.ts`, ADR-0019): `register(spec, handler)` at composition time; `discover()` → `Promise<Array<{name, sideEffecting}>>` (the contract's exact shape); `invoke(name, params)` → capability check + event emission + handler call. Handler throws are caught and returned as `err(E_TOOL_HANDLER_THROWN)`.

**Governance** (ADR-0019 D3): the `checkCapability?: (ownerCid, capability) => boolean` callback pattern (same as P3.3's `publish` callback injection) avoids a hard dependency on `@inevitable/kernel`. At invocation time: `checkCapability(ownerCid, 'tool.${name}')`. Denial returns `err(E_TOOL_CAPABILITY_DENIED)` before the handler runs.

**Observability** (ADR-0019 D4): `tool.invoked` emitted before the handler; `tool.completed` emitted after (with `ok`, `durationMs`, optional `error`). The `emitEvent` helper uses the class's own HLC (initialized in constructor) and publishes to the bus. No bus → no events, no errors.

**Event taxonomy:** `tool.*` family added to `spec/events/event-taxonomy.md` (90d retention, replayable).

**Demo wiring** (`apps/cli/src/wiring.ts`): `search-concepts` tool registered (queries `world.snapshot().nodes` for `concept` type nodes matching the keyword parameter); `tool.search-concepts` capability pre-granted to the learner via `capabilities.grant`; `DemoFixture.tools: InMemoryToolRuntime` exposed.

**Tests:** `packages/adapters/tests/tools.test.ts` — 15 tests covering: discover empty/populated, invoke not-found, invoke handler success/err/throw, capability deny/allow/absent, event emission success/failure/no-bus.

**Format fix:** `clock.nowMs()` (not `clock.now()`) — caught by typecheck. Prettier applied to `tools.ts` and `fiber-learning-loop.ts` before commit.

**P4 closes the multi-agent orchestration phase.** The COS substrate now expresses visible agent disagreement, a proposal board for arbitration audit, and a governed tool ecosystem. These feed P6 (self-evolution can arbitrate over competing pedagogical proposals) and P5 (the digital twin can observe agent disagreements across a learner's history).

---

## Phase P5 — Digital Twin Lifecycle (2026-06-20)

**Goal:** give learners a named, consent-scoped cognitive artifact that persists independently of any session or surface — a governance-first entry into the Digital Twin / Identical Agent vision.

### P5.1 — TwinRegistry + twin.* events

**Architecture decision (ADR-0020):** the twin is a `product-cognition` primitive, not a gateway or surface concern. It uses the injected `publish` callback pattern established in P3.3 (ADR-0017 D1) — `TwinRegistry` accepts `publish?: (eventType, payload) => void` — keeping it free of a hard `@inevitable/events` dependency while remaining fully observable.

**`TwinState` and `TwinConsent`** (`packages/product-cognition/src/twin.ts`): `TwinConsent` records `learnerId`, `grantedAt`, `allowedSurfaces`, `allowedAgents`, and optional `expiresAt` at mint time. `TwinSnapshot` captures `masteryMap` (conceptId → `{level, confidence}` from `mastery_checkpoint` world nodes), `memoryDigest` (one entry per durable memory layer), and `goals` (empty in P5.1; cross-session goals arrive in P5.2+). `TwinStatus` is `"active" | "exported" | "terminated"`.

**Snapshot caller pattern (ADR-0020 D2):** `TwinRegistry.create()` accepts a pre-built `TwinSnapshot` from the caller. The `buildTwinSnapshot(cognition, nowMs)` helper in `apps/cli/src/wiring.ts` extracts the snapshot from a `LearnerCognitionSeed` (DPS-004). This keeps the registry free of `WorldStateGraph`/`TieredMemoryStore` deps (same pattern as `ContextAssembler` receiving pre-indexed items, not crawling memory itself).

**Lifecycle transitions (ADR-0020 D4):**
- `create(params)` → `active` + `twin.created` event
- `branch(twinId, displayName)` → new `active` twin with `branchedFrom` pointer + inherited consent + snapshot at branch time + `twin.branched` event; throws `CosError("E_TWIN_NOT_FOUND")` or `CosError("E_TWIN_TERMINATED")` on invalid input
- `export(twinId)` → `exported` (idempotent; repeated export returns current state, emits once) + `twin.exported`
- `terminate(twinId)` → `terminated` (idempotent; data never deleted; audit-friendly) + `twin.terminated`

**Branch semantics (ADR-0020 D3):** copy-at-fork — the child starts with the parent's current snapshot but evolves independently. `branchedFrom` is an immutable lineage pointer. Consent inherits to the branch. Branching a terminated twin is an error.

**Event wiring in `apps/cli/src/wiring.ts`:** a local `twinHlc` variable + `createEvent` + `bus.publish` inside the `publish` callback, identical to the `analysis` wiring from P3.3. The `twins: TwinRegistry` is exposed on `DemoFixture` alongside four helpers: `createTwin(displayName)` (extracts cognition from current world+memory, builds snapshot, mints twin with full-access consent), `branchTwin(twinId, displayName)`, `exportTwin(twinId)`, `terminateTwin(twinId)`.

**Event taxonomy:** `twin.*` family added to `spec/events/event-taxonomy.md` (1y-archive, replayable, `internal` classification). Twins carry learner-private cognitive state, so 1y-archive mirrors the intent-family retention.

**Spec files:** `spec/persistence/DPS-009-digital-twin.md` (purpose, lifecycle diagram, event payloads, snapshot semantics, consent model, API surface, non-goals), `spec/architecture-decisions/ADR-0020-digital-twin-architecture.md` (6 decisions: D1–D6).

**Tests:** `packages/product-cognition/tests/twin.test.ts` — 23 tests across create/get/list/branch/export/terminate. Key coverage: idempotency of export (emits once, returns same timestamp); idempotency of terminate (emits once); branch from terminated throws; data preserved on terminated twin (snapshot + consent intact); parent twin unchanged after branch.

**Note on `CosError` throw-checking:** the tests use `.toThrow("not found")` and `.toThrow("terminated")` rather than `.toThrow("E_TWIN_NOT_FOUND")` because `CosError.message` is the human-readable second argument (the code is the `.code` property). Matching the message string is correct and informative.

**P5 closes the Digital Twin phase.** The COS substrate now has a governed twin lifecycle with a full event audit trail. Deferred to P5.2+: IdenticalAgent (model-backed; speaks as the learner using `TwinState` as context), consent enforcement at query time (access blocked by `allowedSurfaces`/`allowedAgents`), durable twin persistence across restarts (`FileEventTransport` pattern, DPS-001), and streaming twin state from live session events. These deferred items require the `IdenticalAgent` model ABI and cross-process twin replay — consciously out of scope for P5.1.

---

## 2026-06-20 — P6.1: Governed Self-Evolution

**What shipped:** `EvolutionEngine` in `packages/orchestration/src/evolution.ts` (DPS-010, ADR-0021) — the capstone invariant: governed self-improvement. The engine manages pedagogical change proposals through a typed FSM from conception to live rollout, with deterministic shadow testing and a real governance gate.

**Architecture decisions:**

- **D1 (location):** `EvolutionEngine` lands in `@inevitable/orchestration` alongside `ProposalBlackboard`. Both are orchestration concerns — one governs per-session agent arbitration, the other governs cross-session pedagogical evolution.
- **D2 (deterministic shadow testing):** The `ShadowEvaluator` projects outcomes from `ProposalConfiguration` + `SyntheticLearnerSeed` using a closed-form formula (base mastery rate + kind-specific delta) — no model invoked. This preserves replay-safety (ADR-0005: model calls are guarded optional) and keeps `pnpm verify` green fully offline.
- **D3 (governance callback):** `approve()` calls an injected `guard: (action: string) => boolean` callback. The composition root wraps `guard()` from `@inevitable/governance`. Same injection pattern as `CognitiveAnalysisEngine` (ADR-0017) and `TwinRegistry` (ADR-0020).
- **D4 (FSM):** `proposed → evaluated → approved → rolled_out | rolled_back`. `rollback()` is valid from `"approved"` or `"rolled_out"` only; idempotent from `"rolled_back"`; throws from earlier states (nothing to roll back). Data preserved on `"rolled_back"` for audit.
- **D5 (event taxonomy):** `evolution.rollback.completed` added to the `evolution.*` family (permanent, replayable) — the existing taxonomy listed `rollout.completed` but omitted the rollback event, creating a silent state change.
- **D6 (DemoFixture):** `evolution: EvolutionEngine` + five lifecycle helpers. Three built-in `SyntheticLearnerSeed` profiles (beginner: no mastery; intermediate: 2 concepts at level 3; advanced: 3 concepts at level 4). The real governance guard calls `guard()` from `@inevitable/governance` with `resource: "evolution.proposal"` and `action: "evolution.approve"`.

**Shadow evaluator projection formula (ADR-0021 D2):**
- Base pass rate: `mean(masteryLevel) / 5` (0.4 floor if no mastery entries)
- `depth_adjustment`: `min(0.95, base + delta * 0.05)`; confidence delta `delta * 0.03`
- `strategy_shift`: `min(0.95, base + 0.1)`; confidence delta `0.05`
- `curriculum_reorder`: `min(0.95, base + 0.05)`; confidence delta `0.02`
- `driftDetected`: `simulatedPassRate < 0.4`
- `overallPassRate`: mean across all synthetic learners; `recommendation: "approve"` if `≥ 0.6`

**Event wiring:** `publish` callback wraps `createEvent` + `bus.publish` + per-engine local HLC (`hlcInit("demo-evolution")`) — same pattern as all other engines. Events: `evolution.proposal.created`, `evolution.experiment.started`, `evolution.shadow_result.recorded`, `evolution.rollout.completed`, `evolution.rollback.completed`.

**Governance wiring in wiring.ts:** `guard: (action) => governanceGuard(governance, { subjectCid: session.learnerIdentity.cid, resource: "evolution.proposal", action, context: {} }).allowed` — calling the real governance engine with the current PRODUCT_DISPATCH_POLICIES. (P6.2 can add a dedicated GOV-P04 evolution policy.)

**Tests:** `packages/orchestration/tests/evolution.test.ts` — 26 tests covering propose/get/list/evaluate/approve/rollout/rollback. Key coverage: shadow evaluator produces "approve" for intermediate+advanced seeds with `depth_adjustment +2` (overallPassRate ≥ 0.6); "reject" for beginner-only seed with `targetDepthDelta: -1`; governance guard returning `false` blocks `approve()`; `rollback()` is idempotent (second call returns current state, no re-emit); data (evaluationResult) intact after rollback; `evaluate()` throws when not "proposed"; `rollout()` throws when not "approved"; empty synthetic learners → overallPassRate 0 → "reject".

**Deferred to P6.2+:** applying the rolled-out configuration to the live runtime (proposal state is advisory in P6.1); durable persistence of proposals across restarts (`FileEventTransport` pattern); replay-based evaluation over real historical session events (CognitiveAnalysisEngine signals → P6.2 evaluation loop); multi-agent consensus on proposals; GOV-P04 dedicated evolution policy.

**P6 closes the roadmap's core phases.** The COS now satisfies all six foundational invariants from §25.4: event sourcing, persistent memory, governed orchestration, reasoning-quality observability, self-evolution, and temporal cognition. P7 (Platform API/SDK + duplex transport) is the next frontier — hardening the substrate's public surface for a second manifestation (MCP or CLI as the first cheap proof).

---

## 2026-06-20 — P7.1: Platform SDK + MCP Manifestation

**Goal:** Prove the §2 substrate-independence law by deploying two real artifacts — a typed HTTP client (`@inevitable/sdk`) and a stdio MCP server (`apps/mcp`) — both using zero substrate package imports, requiring zero core changes.

**Spec:** `spec/cognitive-developer-platform/SDK-001-platform-sdk.md`, `spec/architecture-decisions/ADR-0022-platform-sdk-and-mcp-manifestation.md`.

**The law (§2):** "manifestations depend on the substrate, the substrate on its contracts, contracts on nothing — no vendor, model, transport, or store leaks past its adapter." P7.1 makes this verifiable at the filesystem level: `grep "@inevitable" packages/sdk/src` and `grep "@inevitable" apps/mcp/src` must return empty (except the `@inevitable/sdk` import in `apps/mcp`).

**`@inevitable/sdk` (`packages/sdk`):** A typed HTTP client for the COS Surface Gateway. Zero `@inevitable/*` workspace dependencies — not even `@inevitable/protocols`. All types (`CosSurface`, `CosLearner`, `CosCommand`, `CosStreamFrame`, `CosClientError`) defined inline in `src/types.ts`. `CosClient` (`src/client.ts`) maps the full `apps/api` surface: `POST /api/surface` → `createSurface`; `POST /api/surface/:id/command` (type:ask/expand/close) → `ask/expand/close`; `GET /api/surface/:id/state` → `getState`; `GET /api/learner/:id` → `getLearner`. Injectable `fetch` (ADR-0022 D2) enables hermetic unit tests with no running server. 11 tests in `packages/sdk/tests/client.test.ts` covering field mapping (snake_case → camelCase), error propagation, base-URL normalization, and the correct command shapes for each method.

**`apps/mcp`:** A pure stdio MCP server. Only COS import: `@inevitable/sdk`. Zero substrate package imports; zero new external deps. `src/rpc.ts` — a minimal JSON-RPC 2.0 router (~70 lines): `register/dispatch/listenStdio`; MCP notifications (id null or absent) yield no response per spec; handler errors wrapped in `{code: -32000}` error responses; parse errors yield `{code: -32700}`. `src/tools.ts` — 4 MCP tools: `cos_create_surface`, `cos_ask`, `cos_expand`, `cos_get_state`; each wraps the matching `CosClient` method and returns `{content: [{type:"text", text: JSON.stringify(result)}]}`; errors return `{isError: true, content: [{type:"text", text: message}]}`. `src/index.ts` — wires the router with `initialize` (server capabilities) + `tools/list` + `tools/call` + `listenStdio()`; reads `COS_API_URL` env var (default `http://localhost:8787`). 8 tests in `apps/mcp/tests/rpc.test.ts` covering: dispatch → result; method-not-found (−32601); parse-error (−32700); null-id notification → null; absent-id notification → null; handler errors (−32000); params forwarding; async handlers.

**Verify:** `pnpm verify` green across all 24 packages+apps+services (codegen + typecheck + test + lint + format). One typecheck fix: `handler(...)` returns `Promise<unknown> | unknown` — wrapped in `Promise.resolve()` before `.catch()`. One lint fix: `CosClient` used only as type in `tools.ts` function signature — converted to `import { type CosClient, ... }`. Prettier run on 3 files. All clean.

**Deferred to P7.2+:** duplex WebSocket transport (ADR-0006 explicitly deferred); multi-user CRDT; auth at the SDK boundary; SSE streaming helper in the SDK; integration tests against a live gateway instance.

## 2026-06-21 — Phase S1: Cognitive Surface maturity (static viewer → living environment)

Prompted by a forward-looking founder review. Three independent code audits confirmed the assessment: the surface was a sophisticated streaming/replay engine playing back a **deterministic, single-agent-per-phase, single-cycle** reasoning trace over a **flat prerequisite spine**, with `ask|expand|close` interactivity and client-only playback — a "living illusion," not a living environment. Roadmap at `spec/implementation-roadmaps/cognitive-surface-maturity.md`. The governing principle for every increment: a **composition over the existing substrate** (cognitive units, the event log, `ProposalBlackboard`, the fold, governance, D3 recording) — no new infrastructure, no new adapter contract, `foldSurfaceEvents` stays pure, record→replay byte-identical, governance preserved. `pnpm verify` green at every sub-phase boundary.

**S1.0 — Spec-first.** ADR-0024 (Surface Interaction Protocol — learner intents as governed replayable events; interrupt as cooperative cancellation, not preemption). ADR-0025 (Cognitive Ensemble Orchestration — concurrent proposals → arbiter synthesis; extends ADR-0018, promotes the blackboard to live arbitration; focused ~6–8 ensemble expanding later). SRF-002 → schema_version 1.2.0 with four new sub-families (`surface.proposal.*`, `surface.synthesis.recorded`, `surface.graph.*`, `surface.interaction.*`) + fold mapping. SRF-003 extended to a cognitive multi-graph (typed edges + entry points), kept a pure projection. Event taxonomy updated.

**S1.1 — Timeline as a cognitive graph.** `KnowledgeGraphEngine.addEdge(from, to, type)` adds typed edges (`depends_on`/`applies_to`/`research_adjacent`/`frontier_of`/`bridges_to`) alongside the legacy `addBridge`. `SurfaceTimelineBuilder` now projects `edges[]` (the prerequisite spine derived from the seeds + informational edges read from world-state via `neighbors`), per-node `layer` (KG-seeded layer prop, else computed prerequisite-chain depth, capped at 6) and `confidence` (from the best mastery checkpoint), an `entry_point`, and a `reproject(entryPoint)` that emits `surface.graph.entrypoint.changed`. `TimelineProjection`/`SurfaceTimelineNode` extended; the fold carries the graph through `surface.timeline.updated` unchanged + folds `surface.graph.entrypoint.changed`. Client types re-exported. 4 new timeline tests (typed-edge spine, depth layers, mastery confidence, reproject idempotence).

**S1.2 — Cognitive ensemble loop.** The P4.1 challenger `Promise.all` (a discarded probe) was generalized into a deterministic **N-member fan-out** in `FiberedLearningLoop.handleDispatch`: members iterate in fixed order (so id/HLC advance deterministically), each publishes a proposal to the live `ProposalBlackboard` and emits `surface.proposal.proposed` (summary + confidence) + parallel `surface.presence.updated` (thinking→contributing); the arbiter emits `surface.synthesis.recorded` (chosen proposals + rationale); divergence still emits `surface.agent.disagreed`. The primary explanation remains the authoritative surfaced result → determinism + replay unchanged. `SurfaceState` gained `proposals[]`/`syntheses[]` (pure fold). Already wired in `apps/cli/wiring.ts` (challenger + blackboard), so visible end-to-end. New ensemble test (proposals=2, one synthesis, parallel presence, surface_id stamped).

**S1.3 — Surface Interaction protocol.** Gateway command envelope extended with `interrupt | jump | branch | challenge | request_depth | request_simplify | request_example`. `SurfaceSession.interact()` emits `surface.interaction.received` → performs the effect → `surface.interaction.applied`, folded into a new `interactions[]` slice. Effects: `jump`/`branch` emit `surface.focus.changed` (refocused/reprojected); reshaping kinds re-frame the cached last-ask through the governed `ask` path (dispatched); `interrupt` sets a cooperative flag. The flag is threaded into the loop as `isInterrupted()` and checked at fiber phase boundaries (early-exits as `phase:interrupted`) — live-only, so replay re-folds recorded events and determinism holds. Threaded through the `ServedSurface` seam (live delegates; restored surface returns the read-only signal). New loop interrupt test + session interaction test.

**S1.4 — Experience layer (`apps/web`).** The flat `LivingTimeline` `<ol>` spine was deleted and replaced by an interactive `TimelineGraph`: depth-layered SVG (columns by layer, rows by topological order), typed edges drawn distinctly (prerequisite/dependency solid; applies/research/bridge/frontier dashed), clickable nodes issuing `jump` (and a ⤳ affordance issuing `branch`), a beginner/intermediate/advanced/research entry-point selector (a pure client projection that highlights suggested start nodes), and living status (status-colored nodes, confidence bars, focus glow). New `EnsemblePanel` in the right rail surfaces live proposals (agent sigil + confidence bar + summary), a disagreement flag, and the arbiter's synthesis rationale. `NarrationTrack` gained in-stream interaction controls (Interrupt / Go deeper / Simpler / Example / Challenge) wired to the new gateway `interact` command via `api.ts`. `SurfaceView` re-laid-out coherently; `styles.css` extended with graph/ensemble/interject styles using the existing token system. New web test asserting the ensemble panel, typed graph edges, and interaction controls render.

**Verify:** `pnpm verify` green across all 24 packages+apps+services at each boundary (codegen + typecheck + test + lint + format). Replay-equivalence preserved (client fold ≡ server `SurfaceState`); the timeline graph rides inside the existing `surface.timeline.updated` projection; all new learner/agent activity is governed `surface.*` events folded deterministically.

**Deferred to S2+:** inline multimodal block instantiation (diagram/image/voice/simulation via the SRF-004 provider seam, recorded for replay) + new spec SRF-006; five-test depth verification (F14); prerequisite-descent on confusion (F03); live curriculum-generated graph (not seeded); readiness-gated research/innovation agents and ensemble expansion toward the full F06 roster (S3); modes/twin/collaboration + the Cognitive Evaluation layer (S4).


---

## Phase S3 — Research mode + ensemble expansion (2026-06-25)

All four sub-phases landed spec-first. `pnpm verify` green after every boundary (25 tasks, codegen + typecheck + test + lint + format).

**S3.0 — Spec-first.** ADR-0026 authored (`spec/architecture-decisions/ADR-0026-research-mode-and-readiness-gating.md`): documents research-readiness threshold design (0.75 gate-backed / 0.85 fallback), D3 event ordering law (frontier.detected emitted BEFORE any agent dispatch), ResearchUnit ABI, frontier KG edge seeding, ensemble expansion manifests. Event taxonomy updated with `surface.research.frontier.detected`, `surface.research.frontier.surfaced`, `surface.research.frontier.deferred`, `surface.motivation.surfaced`. Roadmap expanded: S3.0–S3.4 sub-phases added to `cognitive-surface-maturity.md`.

**S3.1 — Research-readiness gate: events + SurfaceState fold.** `ResearchFrontierRecord` interface added to `packages/surface/src/projection.ts`; `research_frontiers: readonly ResearchFrontierRecord[]` and `motivation_surfaced: boolean` added to `SurfaceState` and `MutableSurfaceState`. Three new fold cases in `foldSurfaceEvents`: `frontier.detected` (appends record surfaced=false), `frontier.surfaced` (flips matching record or appends), `motivation.surfaced` (sets flag); `frontier.deferred` falls to default (version-only). `resolveResearchReadiness()` private method in `SurfaceSession.ask()` step 8: emits `frontier.detected` (D3) before any dispatch; emits `frontier.deferred` when below threshold but mastery passed. 5 new projection tests + exports updated in index/client. 60 surface tests green.

**S3.2 — ResearchUnit: model-backed research cognitive unit.** `packages/product-cognition/src/research-unit.ts`: full `ResearchUnit implements CognitiveUnit` — same ABI as `CurriculumUnit`. `ResearchOutput` = `{frontier, gap, hypothesis_seed, source_note}`. `parseResearchOutput` strips fences + validates all four fields (error messages prefixed with `E_MODEL_OUTPUT_MALFORMED` for testability). `deterministicResearch` deterministic fallback. D3 trace for model path, D2 for deterministic. `runResearchFrontier()` in session: dispatches research agent, emits `frontier.surfaced` (D3), contributes `research` block, seeds `frontier_of` KG edge in world-state. `"research"/"motivation"/"reflection"/"debate"` added to `ProductRuntimeAgentId` union and `workTypeFor` exhaustiveness switch in `runtime-dispatch.ts`. MVP agent catalog and `minimalAgentSet()` snapshot updated. 15 new unit tests (`research-unit.test.ts`). Wired in `apps/cli/src/wiring.ts`.

**S3.3 — Motivation pass.** `motivationDispatcher?: GovernedDispatcher` added to `SurfaceSessionDeps`. Step 9 in `ask()`: fires `resolveMotivation()` when mastery passed + `0.6 ≤ confidence < 0.75`. D3: emits `surface.motivation.surfaced` before any dispatch; optional `motivationDispatcher` dispatches `agent.motivation` and contributes a `motivation` block. `"motivation"` added to `COGNITION_BLOCK_TYPES`. Two new session tests: motivation surfaced on barely-passed mastery; NOT surfaced above 0.75 threshold.

**S3.4 — UI: research/motivation block renderers + frontier edge styling.** `ResearchBody` (frontier/gap/hypothesis/source-note structured rows with research-accent tag labels) and `MotivationBody` (message + confidence, green-tinted card) added to `apps/web/src/blocks.tsx` and wired into the renderer registry. `frontier_of` and `research_adjacent` edges now use `--agent-research` (#8ab4ff) at distinct opacities (0.8 / 0.5) in `styles.css` rather than the generic `--ink-faint` group. Research/motivation block CSS added: `.research-body`, `.research-tag`, `.research-hypothesis`, `.research-source`, `.motivation-body`, `.motivation-message`, `.motivation-conf`.

## 2026-06-26 — S-UCS: Universal Cognitive Surface immersive redesign

A presentation-level redesign (plus the observability plumbing needed to make it honest) that turns the surface from a 3-pane dashboard into one living cognitive environment. The whiteboard is the product; everything else floats over it. Every prior capability is preserved — re-homed, not removed. Spec-first; `pnpm verify` green at every phase boundary.

**Phase 0 — Specs & ADRs.** ADR-0028 (block-delta streaming projection: a transient `streaming_blocks` buffer cleared by the whole block, so `fold([delta...,generated]) == fold([generated])` and replay equivalence holds) and ADR-0029 (surface agent-observability events; latency is real-clock, deterministic-per-log, excluded from canonical block content). SRF-002 schema 1.2.0 -> 1.3.0: `surface.block.delta`, `surface.agent.reasoning.summary`, `surface.agent.work.timing` added to the catalog, sub-family paragraphs, ordering law, fold semantics, evolution. SRF-001 SurfaceState extended (`streaming_blocks`, `agent_reasoning`, `agent_work_timings`) + fold table. SRF-005 §4.6 (streaming deltas over the same SSE channel preserve §6.2). SRF-004 (word-level sync is a client projection — no provider word-timestamps; inline placement is a render projection). cognitive-unit-ABI (host publishes `emissions.trace` as `reasoning.completed`). F09 §4.1 (immersive composition law). event-taxonomy surface row updated.

**Phase 1 — Fullscreen whiteboard shell.** `SurfaceView.tsx` rewritten: the `.surface` grid became a fullscreen container with the stage filling the viewport and a slim floating top bar. New reusable `Overlay` primitive (always mounted, CSS-toggled via `data-open`, Escape-to-close — SSR-stable so existing capability assertions keep passing). New `AgentsButton` (live status pills from `state.presence`) and `PathLauncher` (floating button -> center overlay hosting `TimelineGraph`/`SceneCanvas` + projection toggle). `styles.css`: fullscreen layout + overlay/launcher/agents classes + floating transport HUD. Visually verified against the live Gemini gateway.

**Phase 2 — Agent Observatory + plumbing.** `projection.ts`: `StreamingBlockBuffer`/`AgentReasoningRecord`/`AgentWorkTimingRecord` types; three new `SurfaceState` slices + fold cases (delta -> transient buffer; whole block clears it; reasoning append; work-timing upsert-by-`work_id`). `fiber-learning-loop.ts` `emitAgentWork()` emits the reasoning summary (from each dispatch's `emissions.trace`) + work timing (measured latency) for the standard and ensemble paths. `host.ts` publishes `reasoning.completed` when a trace is present. New `ReasoningPanel` + enriched `Observatory`. 3 new projection tests incl. delta replay-equivalence + `contributeStreaming`. Reasoning panel confirmed live.

**Phase 3 — Synchronized narration + transport HUD.** `useChoreographer` gains `progress` (rAF over audio `currentTime` / reading-time estimate). New `TransportHud` (supersedes `NarrationTrack`): the current sentence streams as word spans with spoken/active highlight (teleprompter); controls auto-hide on idle via `useAutoHide` and return on intent. Visually verified.

**Phase 4 — Streaming cognitive content.** `AgentContributionRuntime.contributeStreaming` pre-allocates the block, emits paced ordered `surface.block.delta` chunks, then the whole block. `SurfaceSession` streams the explanation via `revealChunks()` when `streamRevealMs > 0` (gateway 45ms; CLI/tests off -> whole block, byte-identical determinism). `CognitiveStage` renders the transient buffer with a caret. Gateway replay-equivalence test passes with streaming enabled.

**Phase 5 — Inline media + activity timeline.** `CognitiveStage` co-locates media blocks sharing the focused concept inline (excluded from the ribbon). New `ActivityTimeline` (clickable, ordered, labeled pipeline steps) replaces the static facet ribbon. Confirmed live (ROUTE -> MAP).

**Phase 6 — Polish, a11y, verify.** `prefers-reduced-motion` reset; removed orphaned `.facet` CSS. Restarted the dev gateway against the new backend and verified the full stack end-to-end. Status docs updated. Final `pnpm verify` green across the monorepo.

---

## UCS — Cognitive Frames, MCCR & the narration-script split (2026-06-26)

The Universal Cognitive Surface stops being a growing document. Root cause removed: the explanation
agent's 7-layer prose was both rendered on the board (`ProseBody`) and spoken verbatim
(`narrateBlock`→`collectNarrationTexts`). The redesign (ADR-0030) splits the two: the board holds only
the **Minimal Complete Cognitive Representation (MCCR)** — distilled anchors — while a **separate paced
narration script** carries the teaching, and learning divides into viewport-complete **Cognitive Frames**.
Scope this milestone: Phase 0 (spec law) + Phase 1 (vertical slice), `pnpm verify` 25/25 green.

**Phase 0 — spec-first.** ADR-0030 records six locked decisions (Frame = top-level folded slice; MCCR =
frame-level content with deterministic client-rendered diagram/table; narration as a separate artifact;
narration↔region sync as a client projection; active frame is a client projection — no `active_frame_id`,
no `surface.frame.activated`; governed/budgeted/discardable look-ahead) and reconciles look-ahead with the
"no static pre-generation" non-goal. SRF-001 (§4.7 Cognitive Frame, §4.8 MCCR, §4.3 slices, §6.1 lifecycle,
§7 transitions), SRF-002 (8 new events, `FocusTargetType` += element/frame, `NarrationSegment` +=
frame_id/anchor_ref/intent, ordering laws 8–11, §7 fold rules, schema 1.4.0), SRF-005 (§4.7 frame element
deltas + §6.2 replay extension + §11 tests), F16 (§2 non-goal note, §12 fallback rows), F09 §4.1 (board=MCCR,
progressive frames, element-targeted narration) updated.

**Phase 1a — substrate.** New `packages/surface/src/frames.ts`: `CognitiveFrame`, `Mccr`, `MccrElement`
(text/formula/relationship/diagram/table/image content), `NarrationScriptRecord`, `ImageDecisionRecord`,
`StreamingFrameElementBuffer`, plus defensive plain-JSON fold readers. `projection.ts`: `FocusTargetType`
gains `element`/`frame`; `NarrationSegment` gains `frame_id`/`anchor_ref`/`intent`; `SurfaceState` gains
`frames`/`speculative_frames` (upsert by frame_id), `narration_scripts` (by script_id), `image_decisions`
(append), `streaming_frame_elements` (transient, cleared by compose). Eight `surface.frame.*` fold cases.
Ten new projection tests prove the replay-equivalence properties (planned→composed convergence, element-delta
transient clear, speculation prepared→invalidated absent from `frames[]`, prepared→promoted copy, purity).

**Phase 1b — Surface Composer.** `SurfaceComposerUnit` (`@inevitable/product-cognition`): one model call →
`{mccr, narration_script, image_plan}` (avoids show/speak divergence), strict parser (nulls dangling
anchor_refs; requires a core concept + a script), deterministic world-state fallback (confidence ≤ 0.5),
live depth-bias steering. `composer`/`frameplanner`/`imageplanner` manifests added to the agent catalog;
`ProductRuntimeAgentId` + `workTypeFor` + `DISPATCH_CAPABILITIES` extended. 8 unit tests.

**Phase 1c — session integration.** `SurfaceSession.composeFocusFrame` (behind a new `composerDispatcher`
dep): dispatches the composer; folds an inline `image` MCCR element when `image_plan.helps` + a generator is
wired (image-as-cognition); emits `surface.frame.composed` → `surface.image.decided` →
`surface.narration.script.produced`; voices the script via the new `SurfaceChoreographer.narrateScript`
(one narration segment per script segment, each spotlighting its MCCR element via `focus.target_type:"element"`);
surfaces composer reasoning (`surface.agent.reasoning.summary`). Absent a composer dispatcher the legacy
explanation-block path runs unchanged. `buildDemoSession` gains an opt-in `composer` flag. Two session tests
prove the end-to-end frame path and its deterministic replay.

**Phase 1d — frontend.** New `FrameStage` (viewport-complete, no scroll via `useFitToViewport` uniform
downscale), `MccrElement` (type-keyed renderer registry; pure-SVG diagram projection, KaTeX deferred),
`HighlightLayer` (one soft moving marker measuring the spotlit element; snaps under reduced-motion via the
global rule), `frames.ts` pure helpers, `useChoreographer` `activeFrameId`/`highlightElementId` projections.
`SurfaceView` renders `FrameStage` when `state.frames` is non-empty, else the legacy `CognitiveStage`. Frame
types exported from `@inevitable/surface/client`. Web tests: frame helpers + a render test proving the board
shows MCCR anchors and not the prose explanation.

**Deferred (tracked):** gateway cutover (`apps/api/host.ts` `composer:true` + migrating the gateway/voice-media/
continuity/durable-persistence integration tests from explanation-block/`expand` assertions to the frame path;
investigate the empty-narration observed under the gateway's governed+curriculum-built ask); Phase 2
(`FramePlannerUnit` + multi-frame decomposition + frame transitions + N+1 buffering + Observatory composition
panel); Phase 3 (governed look-ahead speculation + `lookaheadBudget` live-config); Phase 4 (`ImagePlannerUnit`).

## UCS — Gateway cutover: the live product renders frames (2026-06-27)

The Surface Gateway now serves the frame path end-to-end. `apps/api/host.ts` sets `composer:true` on
both `buildDemoSession` call sites (create + rehydrate); the CLI/debug harness deliberately stays on the
legacy explanation-block path so `expand` and the substrate keep coverage. Root cause of the earlier
empty-narration under the gateway: the GOV-P01 trust gate's `STUDENT_AGENTS` allowlist didn't include
`composer`, so the governed composer dispatch was blocked → `composeFocusFrame` degraded → no frame, no
narration. Fix: added `composer`/`frameplanner`/`imageplanner` to `STUDENT_AGENTS` (trust ≥ 1) — presenting
a learner's own session is core student-facing cognition, not a privileged shared-KG mutation (curriculum
stays privileged at trust ≥ 3). Gateway integration tests migrated to the frame path: `gateway.test.ts`
(replay-equivalence still asserts client-fold ≡ server-state — now over `surface.frame.*`; "live command
effects" opens the stream then asks and asserts `surface.frame.composed` + `surface.narration.script.produced`
arrive live), `voice-media.test.ts` (narration now from `narrateScript`), `continuity.test.ts` +
`durable-persistence.test.ts` (assert a composed frame survives restart; `expand`-on-restored re-scoped to a
fresh-ask-composes-a-frame check). `pnpm verify` 25/25 green. Deferred: `expand()` (layer-deepening) has no
frame counterpart yet; Phases 2–4.

## UCS — Phase 2: frame decomposition, transitions, N+1 buffering (2026-06-27)

One concept now unfolds as a SEQUENCE of Cognitive Frames instead of a single slide. New
`FramePlannerUnit` (`@inevitable/product-cognition`) mirrors `SurfaceComposerUnit`'s model-backed ABI:
one model call → `{frames[], pacing}`, where each entry carries `title`, `sub_focus` (the teaching
slice), `archetype`, `slots` (the MCCR anchors it will fill), and `intent`. The parser validates
archetypes/slots/intents to safe defaults, forces `core_concept` into every frame, caps at `maxFrames`
(default 5, density law), and throws on zero frames so the unit degrades to a deterministic single-frame
plan (Phase 1 parity) — visibly via `fallback_reason`.

`SurfaceSession` threads a new optional `framePlannerDispatcher`. When both composer + planner are wired
(`onPlannerFramePath`), `ask()` step 4 calls `planAndComposeFrames`: dispatch the governed planner →
read `frame_plan` → for each entry, `composeFrameViaComposer` emits `surface.frame.planned` (layout
reserved, SRF-002 law 8) then dispatches the composer **steered by `sub_focus`/`frame_focus`** so each
frame distills different anchors → `emitFrameArtifacts` lands composed → image.decided → script.produced →
reasoning.summary → voiced narration (the exact Phase-1 order, lifted into one shared helper so the
composer-only path stays byte-identical). Practice and the mastery checkpoint render as their own
**deterministic** frames (`composeDeterministicFrame`, no model) so the whole lesson is frame-based;
ordinals are sparse + monotone (`nextFrameOrdinal`, ×1000) for promotion-friendliness. The planner's
decomposition reasoning is surfaced to the Observatory (ADR-0029). Composer-only (no planner) keeps the
single-frame Phase-1 path unchanged; the legacy explanation-block path remains the graceful fallback.

Frontend: a new `FrameDeck` replaces the bare `FrameStage` mount in `SurfaceView`. It cross-dissolves the
prior frame out + the incoming frame in as the choreographer cursor crosses a frame boundary (a pure
projection over `activeFrameId`; `frame-enter`/`frame-exit` keyframes collapse to an instant swap under
`prefers-reduced-motion`) and buffers the **N+1** frame off-stage to pre-warm its illustration. New pure
helpers `activeFrameIndex`/`nextFrame` (Node-free, tested). The Observatory gained `CompositionPanel`: the
ordered frame queue with status, MCCR anchor chips, the per-frame density check against the ~6-anchor
budget, narration count, image decision, and a look-ahead sub-list (empty until Phase 3).

Wiring: `frameplanner` added to the CLI `DISPATCH_CAPABILITIES`; `buildDemoSession` gains an opt-in
`framePlanner?` flag (requires `composer`). The gateway sets `framePlanner:true` on both call sites, so the
live product decomposes concepts into progressive frames; the CLI/debug harness stays single-frame/legacy.
New tests: 10 planner-unit cases; a surface session multi-frame test (2 teaching + practice + assessment
frames, monotone ordinals, narration spans every frame, planner reasoning in Observatory, planned-before-
composed-before-narration ordering) + its replay-equivalence twin; web `frames`/`surface-view` tests for the
deck helpers + Composition panel. Gateway/continuity/durable-persistence integration tests pass unchanged
with the planner live (more frames, same invariants). `pnpm verify` 25/25 green. Deferred: Phase 3 (governed
look-ahead speculation + `lookaheadBudget` live-config), Phase 4 (`ImagePlannerUnit`), `expand()`-on-frames.

## UCS — Phase 3 (governed look-ahead) + Phase 4 (Image Agent) (2026-06-29)

Closed the two remaining UCS phases (ADR-0030), completing the Cognitive Frames redesign end to end.

**Phase 3 — governed look-ahead speculation.** The `FramePlannerUnit` now emits a discardable
`lookahead[]` bet alongside its frame plan — one entry carrying a `trigger_assumption` (the prediction
the speculation rests on). `LiveEvolutionConfig` gains a governed `lookaheadBudget` (raised/lowered only
by an evolution rollout carrying a numeric `lookaheadBudget` parameter; `0` in tests/CLI, seeded to `1`
at the gateway, read live via an injected `getLookaheadBudget` callback — the same direction-safe pattern
as `getDepthBias`). After a clean forward step (mastery ran, no confusion descent), `SurfaceSession`
binds the bet to the next concept in the path and speculatively pre-composes its opening frame through
the SAME governed composer dispatch (`dispatchComposerForConcept`, extracted so the on-screen and
speculative paths share one code path). The full MCCR + narration script + image decision are recorded
under `surface.frame.speculation.prepared` (into the `speculative_frames[]` slice) but **never voiced or
surfaced**. On the next ask, `reconcileSpeculations` runs first: a still-speculative frame whose
`concept_id` matches the focus is **promoted** (`surface.frame.promoted` with a final sparse ordinal — a
true skip-recompute, since the promoted frame keeps its `frame_id` so its recorded script + image resolve,
then it is voiced), and `planAndComposeFrames` skips the plan's opening entry so the sequence never
double-opens; every diverging bet is **invalidated** (`surface.frame.speculation.invalidated`, provably
never copied into `frames[]`). Budget 0 emits no speculation events at all (byte-identical to Phase 2).

**Phase 4 — the Image Agent.** New `ImagePlannerUnit` (`@inevitable/product-cognition`,
`agent.imageplanner`; capabilities `image.decide`/`image.prompt`/`image.refine`) owns the
image-as-cognition decision, promoted out of the composer's inline `image_plan`. One model call decides
`{ helps, prompt, rationale, caption, labels[] }`: an image earns its place only when spatial structure
carries meaning the board's anchors cannot; when it does the agent produces the generation prompt, a
one-line caption, and 2–6 callout labels that make it an *explanatory* image; `refine` mode re-plans from
feedback. Deterministic fallback is `helps=false` (offline/seeded runs never fabricate media). Wired at
the gateway (`imagePlanner:true`), it drives generation via the SRF-004 `MediaGenerator` seam and folds
the image (with caption + labels) into the MCCR `image` element in the concept's region; the web
`MccrElement` renders the caption + labels as absolutely-positioned callouts. Absent the agent, the
composer's inline decision remains the fallback (Phase 1–3 parity). The MCCR image content type gained
optional `caption`/`labels` (additive, defaulted in the fold — replay-safe).

New tests: 3 planner look-ahead-parsing cases; 4 surface session Phase 3 cases (prepare→promote,
prepare→invalidate, budget-0 no-op, and a two-ask replay-equivalence twin); 8 `ImagePlannerUnit` cases;
2 surface session Phase 4 cases (Image Agent drives caption/labels + a replay-equivalence twin). Spec:
`inline-multimodal-artifacts.md` §4.1 documents the Image Agent. `pnpm verify` 25/25 green.

---

## UCS Experience Alignment — Hardening Pass 1 (delivered 2026-07-02)

Guided by the comprehensive implementation review (`spec/research/ucs-implementation-review-2026-07.md`,
verdict: *architecture faithful, experience not — 4.5/10*). This pass fixed the deepest root causes across
three coherent subsystems; `pnpm verify` green (25/25) at the gate.

**1 — Model reliability (the highest-leverage root cause).** The live audit found the Frame Planner and
Image Agent falling back to their deterministic paths on *every* call, and the composer flaky. Root cause:
`gemini-2.5-flash` is a thinking model whose thinking tokens are drawn from `maxOutputTokens`; the units'
small budgets (2048/1024) starved the JSON response to empty text → parse failure → silent fallback.
Fixes: added `thinkingBudget` to `ModelGenerationRequest` (`@inevitable/contracts`) and mapped it to
`config.thinkingConfig` in the Gemini adapter; raised all three units' timeouts 20s→60s and budgets
(composer 4096→8192/think 2048, planner 2048→4096/think 1024, imageplanner 1024→2048/think 512); sanitized
the composer's `responseSchema` (empty-`properties` OBJECT array items 400 Gemini's structured output);
made `parseComposerOutput` salvage a rich MCCR that omits only `core_concept` (synthesizing it from the
title) instead of discarding the whole response; and stopped treating quota (429) as long-backoff transient
so exhaustion fails fast. New tests lock the salvage behavior.

**2 — Kill the demo fixture at the gateway.** `buildDemoSession` ran on a `ManualClock` frozen at
2026-06-11, so every gateway event timestamp and work-timing latency was fiction. Added an injectable
`clock` to `DemoOptions`; the gateway (`apps/api/src/host.ts`) passes a real `SystemClock` at both create
and rehydrate while the CLI/tests keep the deterministic `ManualClock`. Onboarding leases are now computed
from the clock (byte-identical under the frozen clock; never expired under real time). Added real
`surface.agent.work.timing` emission around the composer/planner/imageplanner dispatches, and made
`surface.image.decided` record `helps:true` only when an image actually reached the board (N10).

**3 — Visual cognition on the board.** A new dependency-free, XSS-safe LaTeX→HTML renderer
(`apps/web/src/latex.ts`) turns key-formula anchors into real mathematics (Greek, sub/superscripts,
fractions, roots, blackboard-bold, operators) with the spoken `plain` form as the accessible fallback — no
learner ever sees raw `\sigma`. `MccrElement` now lays diagrams out by their `kind` (flow = directed row,
tree = layered, axes = plane, node-graph = ring; arrowheads on directed edges), shows a "+N more" table
cue instead of silent truncation, centers/enlarges sparse 2–3 anchor frames, and suppresses the duplicate
frame title. New tests: LaTeX rendering + XSS-safety, per-kind diagram layout determinism.

Deferred to later passes (tracked): real pedagogy (answerable practice + honest gate), path-scoped asks +
continuity, highlight-geometry + audio-failure fallback, cognitive color language + feedback states,
staged element reveal + live images, and pipeline parallelization.

## UCS Experience Alignment — Hardening Pass 2 (delivered 2026-07-03)

Continued from Pass 1, on the review's R0/R2 lines. `pnpm verify` green (26/26 typecheck+test, 25/25 lint,
format clean) at the gate.

**Pedagogy — the board stops lying about content (N3).** The practice Cognitive Frame was displaying
`input.practicePrompt` — the meta-instruction *to* the Coach ("Give one concrete practice problem for X")
— while the Coach's real generated problem lived only in the legacy practice block. A new `dispatchText`
helper extracts the actual produced text (summary → layer_0 → text) from `cycle.practice`, and the frame
now shows THAT. The practice check segment carries `pause_after: true`. (The full answerable-practice loop
+ learner-graded honest mastery gate — removing the fabricated `DEMO_DEPTH_TESTS`/auto-pass — is deferred
to the path-scoped learning-loop pass; it restructures the flow ~100 tests assume and must not be
half-landed.)

**Narration / choreography (review issues 11, 12, 16).** `pause_after` is now honored end-to-end: it flows
from the composer/deterministic frame → `surface.narration.segment` → the folded `NarrationSegment` →
`useChoreographer`, which holds ~1.4s after a paused segment. The `HighlightLayer` geometry bug is fixed —
it measured relative to `.frame-grid` but was positioned inside `.frame-fit` (offset by the title) and the
fit scale was applied twice; it now measures within its own positioned ancestor and divides the screen
delta by the scale, so the marker sits exactly over the anchor at any zoom. The audio-failure stall is
fixed: the voiced branch adds an `error` listener, a `play()`-rejection fallback timer, and a watchdog, so
a 404 / blocked autoplay / silent stall can never freeze the surface.

Threaded through `packages/surface` (session.ts, narration.ts, projection.ts) and `apps/web`
(useChoreographer.ts, HighlightLayer.tsx, FrameStage.tsx). `NarrationSegment` gained a required
`pause_after` (folded from the event; legacy segments default false).

## UCS Experience Alignment — Hardening Pass 3: the learning loop (delivered 2026-07-03)

The deepest pass: closing the loop so understanding compounds instead of restarting, making the product
stop lying about mastery, giving cognition a color language, and fixing the SSE/fold correctness bugs.
`pnpm verify` green (26/26 typecheck+test, 25/25 lint, format) at the gate.

**The learning loop (review §4.8/4.9, N4–N6).** Added a path-scoped `advance` command
(`{ type:"advance", concept_id? }`) to the gateway server + `ServedSurface`. `SurfaceHost` now caches the
first ask's curriculum per hosted surface and `runAdvance` reuses it — teaching the next (or a requested)
concept by moving only the focus, never regenerating the DAG. This preserves the mastered path and the
concept-id space (so look-ahead speculation can promote), fixing the "every ask restarts the universe"
pathology. `resolveNextConcept` picks the requested concept, else the first not-yet-mastered node from the
folded timeline, else the next in order. The web gained a persistent **Continue ribbon** (never
auto-hidden — the dead-end fix), path-node clicks now call `advance` (were focus-only no-ops), and the
client carries a **learner credential** (bearer token in localStorage; `enterSurface` authenticates and
persists the minted `api_key`) so a returning learner resumes prior mastery (F05). `main.ts` defaults
`COS_PERSIST_DIR` to `.cos-data` in dev so continuity survives restart. A new gateway test proves the path
is byte-preserved across an advance and the lesson moves forward.

**Honest pedagogy (review N2/N3).** The practice frame now shows the Coach's real generated problem
(`dispatchText(cycle.practice)`), not `input.practicePrompt`. The gateway's mastery input dropped the
fabricated `DEMO_DEPTH_TESTS` and "solved correctly" evidence — no `depthTests` ⇒ the
`MasteryCheckpointRecorder` emits no `assessment.gate.evaluated`, so the product never claims a 5/5 gate
the learner didn't earn. The checkpoint frame is labeled by truth: "Mastery verified — N/N" only with a
real graded gate (CLI demo + session tests keep theirs), else "Ready to practice — …". `pause_after` holds
the practice check frame.

**Cognitive color language (review §16).** A per-frame `--stage-tint` (derived from the frame's kind —
learning/practice/assessment/research — a pure projection, ADR-0007) washes the stage in ~6% and tints the
highlight marker + active-element border. Token aliases (`--border`, `--surface`, `--bg-*`, `--ink-*`,
`--warn`, `--status-warn`) were defined against the canonical vocabulary, repairing the ADR-0030 CSS layer
(Educator overlay, chip borders, image-callout contrast).

**Feedback & error states (review N8, issue 10).** `App` shows a "working" pulse on every command
(cleared when new cognition streams in or after a safety timeout) and routes `enterSurface`/`sendCommand`
failures to a real, dismissible error banner; `sendCommand` throws on a non-ok gateway response.

**Correctness hardening (review N11/N12, issue 20).** Narration segments upsert by `segment_id` (and
frame `segment_ids` dedupe) so SSE redelivery never duplicates speech; `streamSurface` subscribes before
replaying the snapshot and dedupes by sequence (no gap, no double); `SurfaceHost.serialize` runs mutating
commands serially per surface so two asks cannot interleave. Deferred (own pass, touches the
replay-equivalence invariant): incremental client fold vs the O(n²) refold; the learner answer-graded
mastery upgrade; motion/a11y/font polish.

## UCS Experience Alignment — Hardening Pass 4: earned mastery + honest cognition (delivered 2026-07-03)

The fourth pass closes the review's remaining P0 integrity items and two R2 experience items.
`pnpm verify` green (26/26 typecheck+test, 25/25 lint, format) at the gate.

**Fallback health law (review §22 / root-cause #1).** A new `surface.cognition.degraded` event is emitted
from `SurfaceSession` whenever a unit response carries `fallback_reason` (composer/planner/imageplanner/
assessment), folded into a new `cognition_health` slice, and surfaced as a "degraded: <units>" badge in
the SurfaceView header. A session silently running on deterministic fallbacks is now visibly distinct
from a healthy one.

**Earned mastery — the Grader (review N2/P0.1/P0.2, F14).** New `AssessmentUnit` (product-cognition;
`agent.assessment`) grades a learner's actual answer into a structured, evidence-bearing verdict
(`{ passed, confidence, feedback, tests: DepthTestResult[], graded }`) with per-aspect evidence tied to
what the learner wrote; honest deterministic fallback (offline → recorded, ungraded, never a fabricated
pass). Wired: `SurfaceSession.submitAnswer` records the answer as a genuine interaction, dispatches the
grader, emits an honest `surface.assessment.gate.evaluated` + an "Assessment —" Cognitive Frame with the
feedback + assessment reasoning/timing; `assessmentDispatcher` in the CLI composition root; an `answer`
command + `ServedSurface.answer` (serialized) at the gateway; an answer `<textarea>` panel on practice
frames in the web. 6 grader unit tests + a gateway integration test (answer recorded → honest assessment
frame). Mastery is now earned from real learner evidence.

**Staged reveal (review §24/N13).** `useChoreographer` projects `revealedElementIds` (accumulated from the
active frame's segment `reveal_ids` up to the cursor) and `frameAnchoredElementIds`; `FrameDeck`/
`FrameStage`/`MccrElement` fade+rise each element in as the narration reaches it (orphans + core_concept
show immediately; space reserved via opacity so no reflow; reduced-motion → instant).

**Observatory truth + a11y (review §18/N16/§17b).** The image decision's prompt/rationale is rendered in
the CompositionPanel; the agent registry gained revision→Challenger, composer→Composer,
frameplanner→Planner, imageplanner→Illustrator (all names now friendly); timeline concept nodes are
keyboard-activatable (Enter/Space). Deferred polish (noted): overlay focus-trap, self-hosted fonts,
motion-budget consolidation, Scene drag-closes-overlay, entry-picker.

## UCS Experience Alignment — Hardening Pass 5: the UI/UX last mile (delivered 2026-07-03)

The remaining review items were almost entirely UI/UX; this pass closes them in four sub-phases.
`pnpm verify` green (26/26 typecheck+test, 25/25 lint, format) at the gate.

**U1 — accessibility & design-system floor (§17, §23).** `Overlay` gained a focus trap + restore +
`aria-modal="true"` (Tab cycles within the panel; focus returns to the opener on close). The transport
HUD no longer collapses to `display:none` on idle — the narration line + play/pause stay, only dense
rows fade, and any keyboard focus within restores the full HUD. Scrub ticks get a ≥24px hit area via
transparent padding + `background-clip`. Fonts moved to a non-blocking load (`index.html` preconnect +
print-swap; the `@import` removed from tokens.css). `--t-2xs` raised to 0.7rem (~11px). The frenetic
1.2/1.6/1.8s `breathe` pulses were unified to 2.6s.

**U2 — navigation (§21, §24).** Frame-level transport: `TransportHud` derives named frame ticks
(narration grouped by `frame_id` → title) that scrub to each frame's first segment. Research frontiers
surface as a dismissible nudge chip that turns readiness into a research ask (F10). URL routing:
`App` reads `?s=<id>` on load and `pushState`s it on enter, so a surface is linkable/resumable (the
gateway already rehydrates). "Go deeper" was already reachable via the `request_depth` interject verb.

**U3 — a first-class thinking surface (§11, §12, §16).** `MccrElementView` reveals Simpler/Deeper/Why?
affordances on hover/focus that dispatch targeted reshaping interactions (threaded FrameStage→FrameDeck→
SurfaceView→onInteract); mastered timeline nodes gain a persistent gold-leaf fill/stroke; a header
"another view" affordance opens the ensemble when `disagreements` exist.

**U4 — feedback & Observatory IA (§9, §18).** The working indicator now shows the live pipeline phase
(`phaseOf` over folded state); reshaping verbs show a per-control pending ack; the Observatory is split
into "Understanding" (composition/ensemble/provenance) and "Instrumentation" (presence/reasoning/latency).

Deferred (needs external assets / non-UI): vendored woff2 self-host; live Imagen generation; incremental
client fold (perf — touches replay-equivalence); hard-gating advancement on a passed answer.

---

## 2026-07-04 — Cognitive Design Language v1: audit, design system, full surface migration

The CDL process ran its collaborative phases end-to-end in one arc: **(1) a complete UX/UI
audit** of the live surface (code-level + screenshots at 1440/1280×650/834/390; evidence in
`outputs/ui-audit/`, findings in `spec/design/proposals/ux-audit-2026-07.md`) found four P0
classes — colliding fixed-bottom chrome (transport HUD + answer panel + frontier + continue, all
independently `position:fixed`), clip-or-shrink frame overflow, uniform anchor weight, and a
media-player HUD consuming 11% of viewport height while idle; **(2) a proposed design language**
(`spec/design/proposals/cognitive-design-language-v1-proposal.md`) synthesizing Liquid
Glass/visionOS material doctrine, calm technology, CLT, and the spec corpus's own experience law
(quiet-navigable-deep, MCCR/narration split, pedagogical integrity) into five principles, seven
depth planes, an 8-state color language, type roles, and a motion vocabulary; **(3) review** —
all four direction questions approved (Voice Line + Thread; warm neutral void; foundation-first
order); **(4) migration**: `tokens.css` rewritten as the CDL token layer (all legacy names
aliased), `VoiceLine.tsx` + `SystemGem.tsx` replacing `TransportHud`/`AgentsButton` (deleted,
with `useAutoHide`), `.stage-wrap` restructured into board-plane + in-flow `.board-slots`
(answer/frontier/continue), `useFitToViewport` replaced by `useDensityRecomposition` (priority
fold → disclosure chips → P5 focus-plane reopen; bidirectional with a fold-twice anti-oscillation
ledger; downscale floor 0.85 as last resort; sparse-grid decorative min-height removed because it
inflated measurements and blocked unfolds), anchor hierarchy CSS (Canon core concept unboxed,
Gloss definition under a state edge-light, memory-cue reflection tint), focus recession,
form/continue frame transitions keyed on persisting `concept_id`, SVG label truncation +
`<title>` tooltips in `TimelineGraph`/`ConceptMap` (labels can no longer collide), P5 glass
overlays, touch-visible anchor actions, safe-area insets, and narrow-viewport fixes;
**(5) formalization**: `spec/design/cognitive-design-language-v1.md` is the permanent design law.
Verified: full `pnpm verify` green (26 web tests among them); live visual pass on a real Gemini
session at three viewports, including the practice frame whose audit screenshot had been an
illegible five-layer pileup and now renders as state-lit board + in-layout answer slot. Honest
limits recorded in the spec §13 (FLIP continuity, force-directed constellation, consolidate
motion, woff2 self-host). Next: CDL Phase 6 (public landing experience) and Phase 7 (product-wide
UX refinement).

---

## 2026-07-04 — CDL v1.1 (Phase 7, first tranche): continuity, constellation, consolidate, self-hosted fonts

Closed the four v1 frontier items recorded in `spec/design/cognitive-design-language-v1.md` §13,
each verified with `pnpm verify` green:

- **Self-hosted fonts.** Downloaded the latin-subset woff2 for Fraunces (variable), Space Grotesk
  (variable), and Space Mono (400/700) into `apps/web/public/fonts/`; `@font-face` moved into
  `tokens.css`; `index.html` now preloads the two primary faces and no longer touches
  fonts.googleapis.com / fonts.gstatic.com. Verified in-browser: `document.fonts` reports the local
  faces loaded, zero external font requests.
- **Shared-element FLIP continuity.** `FrameDeck` gains a `useLayoutEffect` that, on a `continue`
  transition (same `concept_id` across frames), measures the outgoing and incoming
  `.mccr-el--core_concept` rects and animates the incoming anchor from the old position via the Web
  Animations API (the View Transition API can't express two co-mounted frames). The `continue` CSS
  transition became a pure crossfade so only the shared anchor carries motion. Verified: the
  incoming core concept runs both the crossfade and the 620ms transform on a real same-concept
  scrub.
- **Force-directed constellation path.** `TimelineGraph.layout()` rewritten from depth-columns to a
  deterministic force simulation (seeded phyllotaxis init nudged by layer, fixed 320-iteration
  budget with cooling, edge springs + pairwise repulsion + gentle layer/center bias), followed by a
  hard overlap-resolution relaxation so node boxes can never touch. Edges are curved filaments
  between centers; labels truncate with `<title>` tooltips. Fully pure/replay-safe (no
  `Math.random`). Verified: 8-node curriculum renders with 0 box overlaps.
- **Consolidate motion.** New `ConsolidationLayer` + `SurfaceView` mastery-diff effect: the first
  observed timeline seeds a baseline without firing (a resumed session's prior mastery doesn't
  replay); each newly-mastered concept spawns a gold mote that drifts and shrinks toward the Path
  launcher (WAAPI, reduced-motion aware), then removes itself.

Also normalized two pre-CDL hardcoded-purple active chips (entry mode / projection toggle) to the
state token. Deleted no files; added `ConsolidationLayer.tsx`, `public/fonts/*.woff2`. CDL spec
§13, IMPLEMENTATION.md, CHANGELOG all updated. Next: CDL Phase 6 (public landing experience —
storyboard first, then per-asset Higgsfield generation).

---

## 2026-07-04 — CDL v2 + the continuous cinematic landing (Phase 6) + Phase 7 close

**Phase 7 close:** spatial `descend`/`ascend` frame transitions keyed on `prerequisite_descents`
(zoom-through with an ember breadcrumb "↓ Prerequisite of X"), viewport-relative unfold headroom in
density recomposition.

**CDL v2** (`spec/design/cognitive-design-language-v2.md`, ACTIVE): the v1 laws held, plus — one
continuous world (traversal, not sections; anchors of stillness inside flow), cognition alive in
every frame (motes/filaments/traces substrate), everything transforms/nothing cuts (morph as the
core motion law), the world breathes, glass as optical instrument (refraction/specular/lens tier).
New motion verbs (emerge/traverse/crystallize/dissolve-forward/rack/swell-settle), animation
hierarchy (ambient→structural→focal→cinematic-peak, one peak at a time), hybrid rendering
architecture (one WebGL canvas + graded video loops + CDL glass + one scroll clock), full
reduced-motion static-narrative degrade, WebGL always aria-hidden/decorative.

**The landing** (`apps/web/src/landing/`, route `/`; enter flow now behind the CTA; `?s=` links
skip straight to the surface): `cdl/world.ts` — typed movement config (eight anchors M0–M7 with
form/hue/density/luminance/camera + copy; `worldStateAt` blends everything continuously;
`stillOpacityAt` drives the text layer); `landing/progress.ts` — module-singleton journey clock
(scroll → eased current, off React's hot path); `landing/formTargets.ts` — deterministic seeded
(mulberry32, no Math.random) particle positions for all eight forms (mote/cloud/neuron/graph/
companion/ladder/civilization/settle); `landing/World.tsx` — R3F canvas, one shader-material point
cloud with aFrom/aTo retargeting buffers + density gating + breathing drift, camera rig
(dolly/crane/pointer parallax), atmospheric background grading; `landing/Landing.tsx` — still-point
stage + rAF driver + legibility scrims + lens-glass CTA + M3 real-surface capture
(`public/cinema/surface-still.webp`, ffmpeg 1.3MB→29KB) + static fallback. Fixes en route: shader
precision mismatch (uBlend highp), first/last still-opacity edge case, particle size/brightness and
background-grade tuning for legibility. Deps added to apps/web (manifestation only): three 0.171,
@react-three/fiber 9.6, @react-three/drei 10.7, gsap 3.15 (driver currently hand-rolled rAF;
GSAP reserved for asset choreography). A pnpm store corruption (virtual-store-dir mismatch after an
interrupted install) was resolved with a clean node_modules reinstall; note `.npmrc` uses
node-linker=hoisted — packages live at the root, not `.pnpm`.

Verified: `pnpm verify` green; production build (main 290KB/90KB gz + lazy World 853KB/230KB gz);
live journey at all eight anchors at 1536 + 500px; reduced-motion static narrative verified via
matchMedia init-script override (no canvas, 8 sections, full copy).

**Higgsfield:** CLI authorized (workspace selected) but generation returns
`job_minimum_basic_plan_required` (free plan, 0 credits) — the 7-loop film (H0,H1,H2,H4a,H4b,H5,H6;
one visual DNA, master style token in storyboard §2) is fully specced and slot-ready; generate H0
first when the plan is upgraded.

## UCS Production Hardening — ADR-0031 (2026-07-09)

The comprehensive review (`spec/research/ucs-implementation-review-2026-07.md`) verdict — "the
architecture is faithful, the experience is not" — drove a full production-hardening pass across
the surface's client, cognition units, session pipeline, adapters, and Observatory. Whole-monorepo
`pnpm verify` green (codegen + typecheck + test + lint + format). Delivered:

1. **Exactly-once narration playback** (`apps/web/src/narration-player.ts` + rewritten
   `useChoreographer.ts`). Root cause of every duplicate/silent narration: the playback effect
   depended on the folded segments array, so ANY streamed event re-ran it and re-invoked
   `audio.play()` on an ended element (HTML restarts ended audio from zero). The new
   framework-free `NarrationPlayer` owns the audio element: one session per segment_id (re-entrant
   play is idempotent; a completed segment never self-replays), epoch + AbortController guards on
   `ended`/`error`/rejected-`play()`/watchdog/rAF, reading-time degradation on any audio failure,
   `readyState`-gated audio-clock progress, live rate changes without restart. Word-caption
   progress moved to an external store subscribed at the caption leaf (`useSyncExternalStore`,
   snapshot = spoken-word index) — the 60 Hz clock re-renders one line. 13 fake-clock tests pin
   every race (duplicate ended, watchdog + late ended, error fallback, autoplay rejection,
   pause/resume, rate rescale). `useSurfaceStream` batches SSE bursts per animation frame with
   event-id watermark dedupe (kills the O(n²) refold spikes).
2. **Density law + MCCR 1.5.0** (additive; SRF-002 §12). Composer prompt rewritten from "≤6, omit
   if unsure" to a density law (5–7 anchors typical, ≤8; worked examples with results; complete
   definitions; misconception named with correction; never filler). New `misconception` element
   type end-to-end: contract (`frames.ts`), planner slots, composer schema/parse, fold, board
   rendering with confusion-ember identity, fold order, deck export. `key_formula.lines[]`
   multi-line derivations (stacked textbook rendering). `diagram.kind: "cycle"` with edge-chain
   ring ordering (`cycleOrder`).
3. **KaTeX behind the math seam** (`latex.ts`): lazy chunk (`ensureKatex`), in-place upgrade via
   `subscribeMathRenderer`/`mathRendererVersion` + `FormulaView`, dependency-free fallback kept
   for first paint/SSR/tests/load-failure. Test proves the upgrade path produces KaTeX markup.
4. **Semantic visual grammar** (styles.css): per-role identity at structural amplitude — formula
   (learning cyan), worked example (practice green edge), mental model (discovery amber, italic
   serif), misconception (ember left edge, full-width), memory cue (reflection), table (research);
   role-colored tags so the eye navigates by role; diagram node `group` → deterministic 5-hue
   palette; real dashed axis lines on `axes`; `breathe` durations unified at 2.6s.
5. **Truthful degradation + image path**: `E_MODEL_OUTPUT_TRUNCATED` on `finishReason ===
   "max_tokens"` in composer/frame-planner/image-planner (tests per unit); `GeminiImageRuntime`
   gets one bounded transient retry and passes the ImagePlanner's full authored prompt (~600 chars,
   was truncated to 120 — a live image-quality bug); client `ImageView` keeps caption + callout
   labels on the board when an artifact 404s (honest degradation, never a blank hole). Rejected:
   cascading to the null SVG card (decoration violates image-as-cognition).
6. **Ask pipeline** (`session.ts`): `surface.ask.progress` events (interpreting → planning →
   composing → voicing → ready) + latest-wins `ask_progress` fold slice + Voice Line phase display
   and busy-guarded ask affordance; `planAndComposeFrames` split into `prepareFrameEntry` /
   `surfaceFrameEntry` and pipelined one-ahead (frame N+1's composer dispatch overlaps frame N's
   voicing; ordinals stay ordered; interrupt honored between frames, draining in-flight work);
   speculation (`prepareLookahead`) detached from the ask's critical path with a `settle()`
   quiescence API (auto-awaited at next ask + close; speculation tests updated); one-ask-at-a-time
   guard (`askInFlight`) — a concurrent ask errors instead of silently resetting state.
7. **Observatory as OS inspector**: `HealthPanel` (per-unit fallback counts + last reason; zero
   fallbacks is an explicit claim), playback diagnostics line (mode/position/rate), and
   `EventInspector` — the searchable raw event log (filter by type/payload, newest first,
   expandable JSON, render-capped) wired App → SurfaceView → Observatory. Composition panel's
   density budget updated to 8. Table disclosure: rows beyond 8 open the full table on a fixed
   glass focus plane ("+N more rows" is a button, not a dead note).
8. **Downloadable cognitive session** (`apps/web/src/export/`): `buildDeckModel` — the pure,
   tested frame→slide projection (core concept as title, anchors as typed role-labeled blocks,
   narration script as speaker notes, path as cover; only composed/promoted frames export) — and
   `exportSessionAsPptx` (pptxgenjs, lazy chunk): CDL dark stage, per-state accent, two-column
   flow with definition full-width, native vector diagrams reusing `layoutDiagram`, embedded
   images with caption fallback, overflow disclosed into notes. "⭳ Deck" button in the top bar.

Specs: `spec/architecture-decisions/ADR-0031-ucs-production-hardening.md` (9 decisions + 4
rejections), SRF-002 §12 schema 1.5.0 note. New deps (apps/web only, both lazy-chunked): katex,
pptxgenjs.

## Cognitive Source Environment — spec domain authored (2026-07-09)

Spec-first milestone, no code. Adopted the Cognitive Source Environment (CSE) as a first-class
COS subsystem via `spec/architecture-decisions/ADR-0032-cognitive-source-environment.md` and
authored the owning domain `spec/source-environment/` (README + CSE-001…CSE-010), superseding the
consolidated founding draft (preserved verbatim at `spec/research/cse-draft-v1-2026-07.md`;
original remains at the repo root).

What the domain locks in:

1. **CSE-001 Foundations** — Principle Zero (sources are evidence; understanding is the
   substrate), the Cognitive Source Constitution (9 commitments), twelve Source Laws, the
   draft-subsystem → COS-domain mapping (UCS/PCM/CAE/CO/RIL already exist), UCI/COS/ULI
   terminology reconciliation, and non-goals (no document mode, no chat-container, no summarizer).
2. **CSE-002 Canonical representation** — content-addressed SourceIdentity/SourceVersion, eight
   understanding layers split along the Principle Zero seam (shared L1–L6 vs. learner-conditioned
   L7–L8), **progressive attention-driven canonicalization** (usable at L1 + anchor index; deep
   layers follow learner trajectory under budgeted intent leases), and the domain's load-bearing
   new primitive: the **Source Anchor** (multi-selector, pure-function resolution, cross-version
   migration). `source.*` event family registered in the taxonomy. Human-as-source consent
   envelopes with all-party consent and redaction cascades.
3. **CSE-003 Meaning Representation Layer** — eleven MeaningUnit kinds (intent, causal-model,
   analogy-map, abstraction-ladder, counterfactual, explanatory-frame, reasoning-pattern,
   conceptual-compression, interpretation-set, transfer-map, misconception-hypothesis); shared
   candidates + learner-conditioned selection; validated via ADR-0027 evaluation.
4. **CSE-004 Transformation algebra** — five core transformations under meaning-preservation
   contracts, refusal-over-approximation, provenance propagation, composability.
5. **CSE-005 Episodic cognition** — Episodes and **Understanding Deltas** as memory-tier
   citizens; eleven-stage development ladder with evidence-gated transitions; real forgetting
   (redaction cascade).
6. **CSE-006 Living knowledge** — Claim Graph, Frontier Overlays (through ADR-0026 gating),
   temporal knowledge model; aggregate instructional improvement only via the EvolutionEngine
   (ADR-0021) with a blocking privacy-mechanism ADR before CSE-P4.
7. **CSE-007 Source agent society** — activation predicates, the **Enrichment Decision** loop
   (propose→arbitrate→decide→record→render, generalizing `surface.image.decided`; silence is a
   first-class outcome), desirable-difficulty governor, and the mixed-initiative interruption
   budget.
8. **CSE-008 Source–surface projection** — `source_viewport` MCCR element, **Semantic Viewport**
   plans with stability laws, **Semantic Highlight** grammar (role registry; CDL owns optics),
   the **Attention Contract** (generalizes ADR-0030 narration `anchor_ref` to source anchors),
   multi-source alignment, per-modality specifics (PDF/video/web/code/dataset/human), and the
   proposed `surface.source.*` subfamily (schema 1.5.0 → 1.6.0, additive; lands in SRF-002 at
   implementation).
9. **CSE-009 Experience catalog** — the draft's ~25 UI components re-expressed as projection
   archetypes (layout never canonical, D5), plus cross-cutting UX law (provenance affordances,
   interruption throttling, honest loading/error states, accessibility).
10. **CSE-010 Delivery** — phases CSE-P1 (anchored PDF end-to-end) … CSE-P6 (knowledge universe,
    human sources), capability-not-engagement success metrics, consolidated risks, verification
    bar (governance/replay/failure tests; offline fixture sources).

Traceability updated: domain-index, event-index, protocol-index, capability-index,
dependency-graph, product-feature-index cross-cuts, spec-folder-ecosystem inventory,
event-taxonomy (`source.*` row), F15 (downstream dep + scope pointer to the new domain).

## Cognitive Theater + Supabase backend graduation — specs authored (2026-07-10)

Spec-first milestone, no code. Two ADRs + six new CSE specs + five deepenings + CDL v3 scope + a
phase-by-phase implementation roadmap, in response to a founder architectural review of the CSE
domain (12 architectural directions). Verdict on the 12: several were already law (SRF-001 "runtime
not renderer"); the genuinely missing abstraction was a cross-temporal conductor; the rest were
one stage-reframe + deepenings.

- **ADR-0033 The Cognitive Theater** — unifies four organs over the ADR-0030 frame substrate
  (additive, backward-compatible, replay-preserving): Director (time), Scene (space), Cinematography
  (motion), Interaction (input). Six binding locks (director conducts not renders; frames not
  discarded; everything still a fold; every pedagogical decision inspectable; the learner always
  wins; silence/stillness first-class). Full §25.4 conformance.
- **CSE-011 Cognitive Director** — the nested direction loop (moment→concept→lesson→module→domain→
  research_program→lifetime), the Cognitive Directive (target state + pacing + intensity +
  rationale + considered alternatives + evidence), the affective/attention channel
  (`surface.affect.*`), silence as output, evolution-governed pacing policy (ADR-0021). The CDL
  names the states; the Director drives the transitions.
- **CSE-012 Cognitive Scene & Actors** — frames elevated to living, inhabitable Scenes; actors
  (diagram/equation/video/sim/overlay/voice as choreographed elements); the scene-delta evolution
  channel (in-place mutation without a new ask); lighting; `surface.scene.*`. MCCR stays the
  skeleton; a scene-less frame folds identically (L2).
- **CSE-013 Knowledge Cinematography** — the shot grammar of understanding (establish, semantic-zoom,
  pan, spotlight, reveal, dissolve, morph, split, merge, macro-to-micro, orientation, rack-focus,
  hold); selection is pedagogy (CSE), rendering is design (CDL); logical shots not playback clocks;
  mandatory reduced-motion equivalence per shot.
- **CSE-014 Cognitive Interaction Grammar** — ~25 primitives in seven intent classes (Attend/Mark/
  Ask/Reason/Express/Navigate/Govern-flow); every act is typed cognitive intent routed to Director/
  blackboard, never UI manipulation; extends ADR-0024; annotations as durable mutations.
- **CSE-015 Source Fusion** — many sources reconciled into one environment (FusedConcept,
  reconciliation edges, coverage map, `source.fusion.*`); evolution of CSE-008 §10 alignment;
  grounding + disagreement-honesty gated by ADR-0027.
- **CSE-016 Creative Cognition** — creation as first-class (essay/hypothesis/experiment/model/proof/
  design…); the assist grammar (scaffold/critique/provocation/reference, never ghostwriting —
  Constitution #5); authorship integrity + the contribution loop (`source.creation.*`).
- **Deepenings:** CSE-005 (§3.4 inspectable progressive world model + §3.5 affective/attention
  signal), CSE-006 (§5 continuous frontier horizon — research in every lesson), CSE-007 (§6a deep
  cognitive transparency envelope, uniform across enrichment/director/shot/interaction decisions;
  interruption budget now spends on motion too), CSE-008 (§9a Theater seam, §10 fusion evolution),
  CSE-002 (§3.3 Fused Source Environment forward-ref).
- **CDL v3 (proposed scope)** — extends the design language from visual+motion into twelve
  sensory/temporal channels (audio, spatial, interaction, attention, emotional pacing, cognitive
  load, temporal rhythm, narrative, cinematography, transition grammar); PROPOSED, not active;
  v1/v2 remain ACTIVE; token landing follows the CDL governance path.
- **ADR-0034 Supabase persistence graduation** — Supabase-first (Postgres + pgvector + Storage +
  Auth + Realtime) behind the eight-contract seam; contract→Supabase mapping table; six locks
  (substrate never imports @supabase/pg; conformance-harness drop-in; Postgres event table is the
  source of truth; migrations version-controlled; secrets gitignored + bytes out-of-band; RLS
  multi-tenancy from day one). GraphStore stays Postgres (world-state is already a fold);
  WorkflowRuntime deferred; NATS/Neo4j/Qdrant/Temporal are documented graduation targets.
- **Roadmap** `spec/implementation-roadmaps/cse-cognitive-theater-and-backend.md` — three
  interleaved tracks with a hard order: B0 backend foundation (Supabase + adapters + RLS) → CSE-P1
  anchored PDF → CSE-P2 meaning/episodes → T1 Director+Scene → T2 cinematography/interaction +
  CSE-P3 transformations → CSE-P4 living knowledge/fusion → CSE-P5 video/web/code → CSE-P6
  universe/human-sources/creation; two blocking sub-ADRs (page-render at P1; aggregation-privacy
  before P4). Backend chosen: Supabase via the Supabase MCP server, specs-first then wiring.

Traceability updated: event-index (theater + fusion + creation subfamilies), event-taxonomy
(surface.* theater subfamilies + source.* fusion/creation), domain-index, dependency-graph
(theater + backend chains), source-environment README, CHANGELOG. Next: guide Supabase MCP server
setup, then Track B0 (provision + core schema + Postgres-backed adapters).

## CSE M1 — Foundation primitives: @inevitable/source-environment (2026-07-10)

First implementation increment of the CSE domain (ADR-0032), per the new
`spec/implementation-roadmaps/cse-implementation-blueprint.md` (Phase 0 validation pass — no
architectural weaknesses found; Phase 1 repo-impact map + milestones M1–M12; this = M1).
`pnpm verify` green: 26 tasks (25 prior + new package); 23 new tests.

- **New package `packages/source-environment`** (deps: shared/protocols/events only — inward):
  - `identity.ts` — SourceVersion: content-addressed (sha-256), immutable, `supersedes` version
    chain; 14 modalities; consent-required modality list (human sources refuse ingestion without
    a consent envelope, CSE-002 §8).
  - `anchors.ts` — the **Source Anchor**: 6 selector kinds (structural, text-quote, region,
    temporal, code, data), ≥2-distinct-selectors law enforced at **creation** (never resolution —
    replay safety); `resolveAnchor` = total pure function, selector disagreement ⇒ `unstable`
    (never a guess), quote ambiguity without prefix/suffix disambiguator ⇒ refuse. **Design note
    caught in test design:** `migrateAnchor` must prefer *content identity* (quote/code selectors)
    over structural paths — plain resolveAnchor's `unstable` on path/quote disagreement is correct
    at read time but wrong for migration, where that disagreement IS the moved signal. Statuses:
    resolved (same path) / moved (structural selector refreshed to new path) / orphaned (retained,
    preserved-quote rendering; never deleted).
  - `layers.ts` — the eight layers with the Principle Zero seam (SHARED_LAYERS L1–L6 /
    LEARNER_CONDITIONED L7–L8); immutable `SourceLayerArtifact` with confidence + honest
    `degraded` marking.
  - `reference-adapters.ts` — deterministic offline Markdown/PlainText adapters (CSE-002 §7):
    heading-stack paths (`h1-1/h2-2/para-3`), per-scope kind counters, char offsets, code fences
    (unterminated fence kept, not dropped); byte-identical re-parse proven.
  - `store.ts` — `SourceEnvironmentStore`: state-then-emit event emission (createEvent + HLC
    threading, same pattern as surface's AgentContributionRuntime); idempotent registration per
    (source, content_hash) — re-upload emits nothing; progressive usability (usable at L1 + anchor
    index); confidence floor ⇒ `source.layer.degraded`; `createAnchorAt` refuses non-resolving
    anchors at creation; `migrateAnchors` events every migration.
  - `anchor-index.ts` — per-version queries: byConcept / byGranularity / within(pathPrefix) /
    findByText.
  - `projection.ts` — `foldSourceEvents`: pure fold over the `source.*` log; replay tests prove
    fold ≡ live `store.project()` (deep-equal, twice) and that refused transitions leave no events.
- **`packages/events`**: `source` family registered in DEFAULT_EVENT_FAMILIES
  (owner source-environment, permanent, replayable) — publish-side law satisfied.
- **Secrets hygiene**: rotated Supabase values scrubbed from `.env` to labeled placeholders (user
  fills directly, never via chat); `.env.example` documents the six SUPABASE_* keys.
- Tests (23): identity/versioning/idempotency/consent-refusal (4), anchor creation law + pure
  resolution + disambiguation + disagreement (7), canonicalization determinism/usability/anchor
  index/unsupported-modality/empty-content/degraded-OCR honesty (6), migration
  moved/orphaned/resolved/not-canonicalized (3), replay equivalence + state-then-emit + empty fold
  (3).

Next: M2 = B0.3 Supabase adapters (gated on rotated creds landing in `.env`) + `0002_sources`
migration; then M3 canonicalization-as-governed-cognition (units/manifests/leases + L2/L6).

## CSE M2 / B0.3 — Supabase-first backend adapters, live-proven (2026-07-10)

ADR-0034 realized in code. `pnpm verify` green (27 packages); hermetic suite 8 tests; **live
conformance passed against the real Supabase Postgres (ap-south-1)**.

- **Migration `supabase/migrations/0002_sources.sql`** applied + verified live: `transport_events`
  (per-subject monotonic sequences, unique(subject,sequence), global id order) + the CSE M1
  durable home (`sources`, `source_versions` w/ unique(source_id, content_hash) idempotency,
  `layer_artifacts`, `anchors`, `anchor_migrations`, `consent_envelopes`). 15 public tables total,
  RLS enabled on every one (deny-by-default).
- **`packages/adapters/src/supabase.ts`** (external-adapter discipline: guarded import, local
  client narrowing, `fromPool()`/injected-fetch seams):
  - `PostgresEventTransport` — EventTransport over `transport_events`; race-safe per-subject
    sequencing via single-statement `INSERT…SELECT COALESCE(MAX+1,0)…ON CONFLICT DO NOTHING
    RETURNING` + bounded retry (contention exhaustion → typed `E_ADAPTER_PUBLISH_CONTENTION`);
    process-local fan-out (FileEventTransport semantics; LISTEN/NOTIFY documented later step);
    replay in global insertion order with JS `matchSubject` wildcard filtering.
  - `PgVectorStore` — VectorStore over pgvector `vectors` (0001); cosine similarity
    (`1 - (embedding <=> $)`), exact scan (index when dims pinned at CSE-P2).
  - `SupabaseStorageObjectStore` — async object store over Storage REST (bucket ensure, put→
    `storage://bucket/path` content_ref, get w/ mime); deliberately NOT the sync gateway
    MediaStore — that interface adapts at gateway cutover rather than forcing sync-over-HTTP.
  - SQL surface exported as constants (`TRANSPORT_SQL`, `VECTOR_SQL`) so hermetic fakes switch on
    exact statements, never regexes.
- **Testing pattern:** the SAME conformance harness as the in-memory reference runs (a) hermetic
  against scripted fake pools and (b) live, gated on `COS_SUPABASE_LIVE=1` + `SUPABASE_DB_URL`
  (live transport test creates/drops a unique smoke table; never runs in CI). Contention retry +
  honest exhaustion covered. Storage round-trip via injected fetch.
- **`pg` provisioned at the workspace root** (edge client beside `@google/genai`; guarded dynamic
  import, not a substrate dep). Existing `adapters.test.ts` graceful-absence case updated
  accordingly (absence still proven by NATS/Qdrant/Neo4j); `PostgresRelationalStore` (external.ts,
  pre-existing) now connects and served as the live smoke's DDL runner.
- Network facts (this dev env): Supabase Management API over 443 works (Bearer PAT; used for
  migrations); direct DB 5432 AND pooler 5432/6543 are OPEN → live smoke uses the real driver.
- Deferred to **M2b** (coherent slice, not an omission): `COS_BACKEND=supabase` gateway cutover —
  belongs with world/memory snapshot persistence redesign so the gateway isn't half file/half
  Postgres. Storage live smoke gated on `SUPABASE_SERVICE_ROLE_KEY` (not yet provided).

Next: M3 — canonicalization as governed cognition (units + manifests + leases; L2 semantic + L6
citation layers, D3-recorded; world-state concept bindings), then M4 PDF modality (page-render
sub-ADR) → M5 source–surface projection.

## CSE M3 — Canonicalization as governed cognition, live-proven (2026-07-10)

Blueprint M3 delivered: layer construction stopped being a library call and became a governed,
manifested, D3-recorded cognitive act. `pnpm verify` green (27 packages); 12 new tests; **live
end-to-end with real Gemini**: 3 concepts extracted from a fixture source with a genuine inferred
prerequisite (backpropagation ← chain-rule), bound into the world-state KG, evidence-anchored —
`degraded: false`.

- **`SourceCanonicalizerUnit`** (`packages/product-cognition`, agent `canonicalizer`): one unit,
  two layers (L2 semantic / L6 citation via packet content), full CognitiveUnit ABI (governance
  gate, scheduler admission, OTel, D3 recording apply unchanged). **PRIVILEGED (GOV-P01 trust ≥3)**
  — it reshapes the shared KG, same class as `curriculum`/`memory` (asserted by test).
  **Grounding law at the contract boundary:** parsers DROP evidence paths not present in the input
  region set; concepts with zero surviving evidence are DISCARDED; hallucinated prerequisites
  cleaned (CSE-002 Grounded / CSE-003 §6). Deterministic fallbacks (heading-derived concepts;
  regex-harvested `(Author, YYYY)`/`[n]` citations — year range 1500–2099 after the Boltzmann-1877
  regex bug) carry confidence 0.45 — deliberately BELOW the store's 0.5 floor, so fallback layers
  land as honest `source.layer.degraded`. `thinkingBudget: 0` on structured calls (truncation
  found live, same class as ADR-0031's finding).
- **`SourceCanonicalizationService`**: prepare regions (char-budgeted, truncation REPORTED) →
  governed dispatch → `recordLayerArtifact` → **KG binding** (seedConcepts w/ domain default
  "source", layer default 2 — Layer-3 activation per ADR-0023/0032) → **evidence anchors**
  (structural + text-quote redundant selectors per concept; ambiguous/unresolvable evidence
  skipped and counted, never guessed). Intent-lease id threaded through packets/results.
- **`source-environment` store additions:** `recordLayerArtifact` (generalized layer landing;
  enforces the canonicalization DAG — deeper layers refuse before structural exists) and
  `prioritize` (attention-driven `source.canonicalization.prioritized` hint). L2/L6 content types
  (`SemanticLayerContent`, `CitationLayerContent`) exported.
- Registrations: manifest seed (agent-catalog + pinned-list test), PRIVILEGED_AGENTS,
  ProductRuntimeAgentId + workTypeFor("curriculum_planning").
- **Supabase Storage live-proven** with the new service-role key: bucket create + upload +
  download round-trip (200s) — every ADR-0034 seam now verified live (Postgres events, pgvector,
  Storage). All keys in gitignored `.env`; user will rotate everything post-build.
- Live findings: first Gemini semantic call truncated (thinking tokens) → fallback fired → layer
  recorded DEGRADED — the honesty law working as designed before the fix landed.

Next: M4 — PDF modality (page-render fidelity sub-ADR, PDF adapter at the edge, visual layer +
OCR confidence) → M5 source–surface projection (`surface.source.*` 1.6.0, source frames,
viewport/highlight/sync on the live surface).

## ADR-0035 — Cognitive Intelligence Persistence: specs authored, M3.5 inserted (2026-07-10)

Spec-first response to a founder architectural direction ("runtime intelligence evaporates;
persist cognition, not conversations; full authority to challenge the abstraction"). Audit
confirmed the thesis in code: `ProductRuntimeDispatcher` DROPS the full ReasoningTrace every unit
returns (only trace_id reaches the OTel span; ADR-0029 surfaces a summary subset on one path);
consolidation machinery exists but nothing drives it; world-state/memory durability = file
snapshots (M2b gap); CSE-005 episodes/deltas specced, unbuilt.

**The challenge that survived:** cognition does NOT disappear here — law #9 means it is already
*chronicled*; what's missing is *distillation*. A second "intelligence DB" agents write directly
would fork the source of truth. So CIPL was accepted in name (**Cognitive Intelligence
Persistence, CIP**) and inverted in architecture: a **two-plane substrate** — the Chronicle Plane
(append-only truth, strengthened: full traces published, never dropped) folded by **governed
Distillers** (manifested units; evented `intelligence.*` lifecycle: distilled/superseded/
quarantined/consumed) into the **Intelligence Plane** (IntelligenceArtifacts as world-state nodes
+ memory-tier mutations, Postgres/RLS, versioned via supersedes, provenance-linked to chronicle
segments, fully re-derivable by replay). One law: emit to the chronicle and/or register a
distiller — no third way. Admission test: "can future intelligence emerge from this?" requires a
NAMED consumer; `intelligence.consumed` events make the test self-enforcing.

- **ADR-0035** — decision, 7 locks (incl. learner/shared regimes: learner-scoped = RLS +
  disclosed + deletable-with-cascade; shared = cohort minimums + consumption only via ADR-0021
  Evolution Proposals; learning-model-never-psycho-profile as law; M3.5 absorbs M2b; CSE-005
  episodes pull forward from M6), alternatives (parallel DB / extend-F05 / extend-ADR-0017 /
  defer — all rejected with reasons), §25.4 conformance.
- **New domain `spec/intelligence/`**: CIP-001 (substrate, IntelligenceArtifact envelope w/
  epistemics {confidence, method_version, provenance_refs, supersedes, decay}, distiller
  contract, intelligence taxonomy mapping all founder categories → kinds with named consumers,
  personalization doctrine: "personalization that cannot be shown to the learner is forbidden");
  CIP-002 (19-subsystem cognition audit table — produced/chronicled/evaporates/distills-into;
  distiller registry v1: episode-assembler, understanding-delta, misconception-tracker,
  intervention-outcome, strategy-outcome, collaboration, consolidation-driver; physical mapping;
  M3.5 plan C1→W1→D1→B1→G1→V incl. the plane re-derivation drill).
- Traceability: ecosystem inventory, domain-index, event-index + taxonomy (`intelligence.*`
  family: permanent/replayable), dependency-graph, blueprint M3.5 row, theater roadmap insertion.
- Skills question resolved: obra/superpowers already installed (active skill set);
  claude-mem/headroom/context-mode declined — duplicate harness-native memory/context systems.

Next: implement M3.5 per CIP-002 §4, then M4 PDF → M5 projection (both now produce into a
listening plane).

## CSE M3.5 (first landing) — the system starts remembering its own thinking (2026-07-10)

ADR-0035/CIP-002 §4 implemented through C1→D1→G1→V; `pnpm verify` green (28 packages incl. new
`@inevitable/intelligence`); 16 new tests; live-proven against Supabase.

- **C1 — chronicle law closed.** `ProductRuntimeDispatcher.publishTrace`: every dispatch now
  publishes `reasoning.trace.recorded` with the FULL ReasoningTrace (interpretation, strategy,
  claims, decision, self-critique, uncertainty) — best-effort by design (recorded-observation;
  publish failure never fails a successful dispatch). Tests: full body chronicled; no fabrication
  when a unit returns no trace. This closes the audit's highest-value gap for ALL agents at once.
- **W1 (partial) — the plane's physical home.** Migration `0003_intelligence.sql` applied+verified
  live: ONE canonical `intelligence_artifacts` table for every kind (envelope = schema, body =
  jsonb; regime check constraint; RLS). `intelligence` family registered (permanent/replayable).
  Remaining W1: world-state/memory Postgres cutover + gateway `COS_BACKEND` wiring (next
  increment, with session-close distillation).
- **D1 — `@inevitable/intelligence`** (28th package): the distiller registry. Seven deterministic
  registry-v1 distillers as pure folds (episode-assembler, understanding-delta,
  misconception-tracker, intervention-outcome [temporal-correlation heuristic at honest 0.6
  confidence], strategy-outcome [joins C1 traces × evaluation — C1 pays off immediately],
  collaboration-distiller, consolidation-driver). `distillSession` orchestrator stamps the
  canonical envelope (method_version, provenance_refs = exact event ids, supersedes, decay);
  `emitDistilled` lifecycle; backfill (B1) IS this same function over replayed logs.
- **G1 — governance proven.** Learner opt-out skips all learner-regime distillers (reported,
  never silent); shared-regime kinds REFUSED without a cohort guard (safe default until the
  aggregation-privacy ADR), skipped below minimum, admitted above; the admission law drops
  consumerless distillates; `redactLearnerArtifacts` + `PostgresIntelligenceStore.redactLearner`
  = the deletion cascade — **proven live: upsert → list → redact → 0 rows in real Postgres.**
- **V — the plane re-derivation drill.** Same chronicle + same seeds ⇒ byte-identical artifacts,
  run twice (the recovery property the whole layer rests on).
- Adapters: `PostgresIntelligenceStore` + `INTELLIGENCE_SQL` (same discipline: SQL constants,
  fromPool seam; structural row type so adapters stay leaf-level, no workspace dep on
  intelligence).

Next (M3.5 completion): gateway session-close wiring (`distillSession` → store → `emitDistilled`
in apps/api), W1 world/memory Postgres cutover, historical backfill over `.cos-data` logs — then
M4 PDF modality lands on a system that compounds.

## CSE M3.5 CLOSED — gateway distillation, chronicle mirror, historical backfill (2026-07-10)

The remaining three pieces landed; `pnpm verify` green; the plane is populated with real history.

- **Session-close distillation (D1 wiring).** New gateway seam `apps/api/src/intelligence.ts`
  (`IntelligenceSink`): on every surface close, the host folds the session's full bus chronicle
  through `distillSession` → artifacts land in-memory (inspection: `host.intelligence.artifactsFor`)
  AND durably in Postgres when `COS_BACKEND=supabase` + `SUPABASE_DB_URL` (the `supabaseBackendUrl()`
  env gate keeps dev/tests offline; bracketed placeholder URLs count as unset) → THEN
  `intelligence.distilled` lifecycle emits (state-then-emit). Best-effort: distillation can never
  fail a close. Legacy surfaces without a durable learner attribute as `cog-unattributed-<id>`.
  Hermetic host-level tests: create→ask→close yields a `learner.episode` with provenance;
  empty-session close stores nothing and never fails.
- **W1 slice — chronicle mirror.** The per-surface durable sink now also mirrors every event into
  Postgres `transport_events` (fire-and-forget; file logs stay authoritative for rehydration).
  Activates with the same env gate. The FULL snapshot/rehydration Postgres cutover (world/memory
  delta-native storage, async rehydration paths) is explicitly its own future verify-green
  increment — the one honest remainder of W1.
- **B1 — historical backfill, DURABLE.** `pnpm backfill:intelligence`
  (apps/api/src/backfill-intelligence.ts; run from repo root): replayed all 13 durable surfaces
  under `.cos-data` (~3,490 events) through the registry → **41 IntelligenceArtifacts upserted to
  the live Postgres plane** (11 learner.episode, 10 learner.understanding-delta, 20
  agent.collaboration) — verified by SQL count against Supabase. Telling audit detail: zero
  `agent.strategy-outcome` artifacts in history because pre-C1 sessions never chronicled traces —
  the exact evaporation ADR-0035 diagnosed; every session from now on distills them.
- Gotcha: the backfill script defaults to `<cwd>/.cos-data` — run from the repo root (or set
  COS_PERSIST_DIR).

**M3.5 status: CLOSED** (C1 ✓ chronicle law · W1 ✓ plane store + chronicle mirror, snapshot
cutover deferred as named increment · D1 ✓ registry + gateway wiring · B1 ✓ durable backfill ·
G1 ✓ opt-out/cohort/admission/cascade incl. live · V ✓ re-derivation drill). Next: **M4 — PDF
modality** (page-render fidelity sub-ADR → edge PDF adapter → visual layer + OCR confidence →
bytes through Supabase Storage), landing real books on a system that now compounds what it learns.

## CSE M4 — PDF modality, live-proven end-to-end (2026-07-10)

Real books can now enter the Cognitive Source Environment. `pnpm verify` green; live e2e proven
against Supabase Storage + real Gemini.

- **ADR-0036 — page-render fidelity pipeline** (closes CSE-008 §14): rendering of record =
  CLIENT-native pdf.js from the canonical bytes (fidelity proof collapses to
  `sha256(served) === content_hash` — byte identity, proven live: `true`); anchor substrate =
  server-extracted geometry at ingestion. Tiles rejected (raster ceiling, render-hash fragility);
  HTML conversion rejected outright (destructive rewrite). Thumbnails later; OCR deferred with
  honest degradation.
- **Binary adapter seam** (source-environment): `ModalityAdapter.parseBinary?(bytes)` beside
  `parse?(text)`; `registerVersion` accepts `string | Uint8Array` (hash + content_ref only in the
  canonical record); `canonicalize` routes by content type with honest refusal on mismatch, and
  lands the **visual (L3) layer in the same pass** when the parse yields page geometry.
  `StructuralRegion` gains optional `page` + `bbox`; new `VisualLayerContent` (pages w/ dimensions
  + `textless` flag).
- **Region selectors resolve** (anchors.ts): page match + bbox overlap ≥50% of selector area,
  highest coverage wins, exact ties refuse — proven live on real PDF geometry.
- **`PdfjsModalityAdapter`** (`packages/adapters/src/pdf.ts`): guarded import of
  `pdfjs-dist/legacy` (root edge, like pg/@google/genai) + `fromModule` seam; line assembly from
  positioned text items; block grouping by line-height gaps (**anchor on median line height ×2 —
  median-gap collapses sparse pages into one block, found by test**); heading heuristic (single
  short line ≥1.2× median size); textless pages → one honest 0.1-confidence "OCR pending"
  placeholder (never fabricated text); overall confidence = text-page ratio. Gotchas pinned:
  pdfjs v5 puts `destroy()` on the loading task, not the document proxy; **pdfjs TRANSFERS
  (detaches) the input buffer to its worker — hand it `bytes.slice()`** or the caller's canonical
  bytes are consumed (broke the determinism test until fixed). `pdf-lib` (root devDep) builds
  fixture PDFs; tests gate on module presence so the workspace verifies without edge libs.
- **Live e2e (the M4 exit):** real 2-page PDF (page 2 textless) → Storage
  `storage://cos-media/sources/<hash>.pdf` → fidelity `true` → structural+visual layers (4
  regions; page 2 honestly textless) → region anchor resolved → **live Gemini semantic layer:
  4 concepts with a real prerequisite CHAIN (divergence ← learning-rate ← gradient-descent ←
  loss-function), KG-bound, 5 evidence anchors, degraded:false** → final env
  structural+visual+semantic.

Next: **M5 — source–surface projection** (`surface.source.*` at schema 1.6.0 into SRF-002,
`source_viewport` MCCR element, semantic viewports + highlights + attention contract realized in
apps/web with client-native pdf.js) — the first learner-visible CSE: a real book rendering inside
the Cognitive Surface.

## 2026-07-11 — CSE M5: Source–Surface Projection — the first learner-visible CSE (`surface.source.*` 1.6.0, Living Reference)

The milestone where the Canonical Source Environment becomes *experience*: a real book renders
inside the Cognitive Surface, taught by the agent society. Verify green (27 tasks); live e2e
proven with a real PDF + real Gemini.

- **Spec-first (SRF-002 → schema 1.6.0, additive).** Six `surface.source.*` events joined the
  catalog with payload shapes, ordering law 12, and §7 fold mappings: `attached`,
  `viewport.planned`, `viewport.changed`, `highlight.applied`/`.cleared`, `sync.bound`. Evolution
  note records that CSE-008's remaining events (overlay/alignment/media.intent/annotation) stay
  proposed and activate with M9/M10/CSE-014. Event-index + CSE-008 §8 marked implemented.
- **`packages/surface`** — `source-projection.ts` (browser-safe): typed fold records + defensive
  readers + **`planSourceProjection`**, the deterministic composer-role viewport planner
  (blueprint decision: one compose→record→render path). ≤3 viewports/frame (focus-first),
  exactly one focal highlight per frame (CSE-008 §5.2), narration segments bound to viewports in
  reading order (clamped — minimum dwell holds at the tail); null on no anchors/segments (honest
  absence). Five new `SurfaceState` slices: `sources[]`, `viewport_plans[]` (upsert),
  `viewport_changes[]` (append-only history — the client derives the current view),
  `source_highlights[]` (cleared marks, never removes), `sync_bindings[]`. **`source_viewport`
  MCCR element** (12th type): the primary evidence anchor ON the board — quote + page/bbox region
  in the evidence provenance channel, injected by the session before `surface.frame.composed` so
  the fold carries it canonically. `SurfaceSession.attachSource()` + the
  **`SourceEvidenceProvider` seam** (`sourceEvidence` dep; best-effort — provider failure ⇒ frame
  without projection, never a failed composition). Ordering per law 12: composed → script →
  viewport.planned → highlights → sync.bound → viewport.changed(cause=plan). 8 new tests
  (planner shape/determinism, fold slices, clear scopes, replay equivalence).
- **Gateway (`apps/api`)** — `sources.ts` **SourceHub**: host-level cross-surface registry
  (own bus; markdown/text reference adapters + `PdfjsModalityAdapter` best-effort; canonical
  bytes kept for serving + uploaded to Supabase Storage when configured). Routes:
  `POST /api/sources` (raw bytes, register+canonicalize), `GET /api/sources/:id/content`
  (canonical bytes + `X-Content-Hash` — the ADR-0036 fidelity proof, exposed via CORS),
  `POST /api/surface/:id/sources` (bind → `surface.source.attached`). `evidenceFor` prefers
  existing concept-bound anchors (L2 canonicalization), else **attention-driven anchor creation**
  (CSE-003 realized): deterministic title-token match over structural regions (singular/plural
  tolerant) → `createAnchorAt` with structural + text-quote (+ region) selectors — the act of
  teaching deepens the environment; no match ⇒ honest `[]`, never fabricated evidence. Host wires
  the seam as a late-bound closure over per-surface bindings (attach-after-create works);
  `ServedSurface.attachSource`. Honest M5 scope: hub is process-lifetime (bytes durable in
  Storage; durable source-store rehydration = named later increment). Gateway e2e test: upload →
  content-hash → attach → deterministic ask → full projection chain asserted, bindings validated
  against recorded script segment ids.
- **Web (`apps/web`)** — **`SourceReference`**, the Living Reference pane beside the FrameDeck:
  client-native rendering from canonical bytes (ADR-0036) — pdf.js page canvas + bbox highlight
  overlays for PDF; the source's own text with char-located `<mark>`s for text modalities;
  **fidelity badge** = WebCrypto sha-256(fetched) vs `X-Content-Hash` ("✓ exact" / amber
  "altered" — the one reserved warning). Attention contract realized: current narration segment →
  recorded-script twin (1:1 voiced order) → binding → viewport glide + focal highlight; **learner
  scroll pauses auto-follow** ("Resume guide" re-syncs; the learner always wins — canonical
  `cause:"learner"` events land with the CSE-014 interaction grammar). Highlight optics BY ROLE
  via CDL state hues (components never pick colors). `source_viewport` renders on the board as an
  evidence quote in the source's voice. pdf.js buffer-detach defense carried over from M4
  (`bytes.slice()`).
- **Live e2e (real PDF, real Gemini, running gateway):** registered `structural+visual`;
  `sha256(served) === X-Content-Hash === content_hash → true`; attached; taught
  "Gradient Descent Algorithm" → viewport plan (2 viewports, focus p1 bbox[72,720,166,20]),
  6 highlights (3 focal — one per frame), attention contract 6 segments bound,
  `viewport.changed cause=plan`, and the composed frame carrying `source_viewport` (p1). Also
  proven honest: the first taught concept (a prerequisite the PDF does not cover) produced NO
  projection — the seam declined to fabricate evidence.
- **Learned:** a live multi-frame Gemini ask exceeds undici's 300s header timeout — e2e drivers
  fire the command and poll `/state` instead of blocking on the response. Live curricula start at
  prerequisites, so source-projection e2e must advance to a concept the source actually covers
  (which is itself the correct behaviour being verified).

Next: **M6 — meaning + episodes** (MRL v1 units; episodes + understanding deltas + resume cards;
Understanding Map v1) per the CSE blueprint, or the named W1 remainder / durable source-store
increment as sequencing dictates.

## 2026-07-11 — CSE M6: Meaning + Episodes — MRL v1, Resume Cards, Understanding Map (ADR-0037)

The layer where the system starts to remember *what understanding formed* around a source, and
show the learner their own mind. Verify green (27 tasks); MRL proven live with real Gemini; the
Understanding Map confirmed rendering live in a real browser via chrome-devtools.

- **Spec-first (ADR-0037).** Three decisions fixed: (1) MRL v1 kind set = `intent`, `analogy-map`,
  `misconception-hypothesis`, `conceptual-compression` (closes CSE-003 §8 Q1); (2) MRL units land
  as the L7 `meaning` layer artifact + world-state nodes with `expresses` edges; (3) episodic
  projections = one canonical event (`surface.resume.projected`, SRF-002 → schema **1.7.0**) +
  one read-side view (Understanding Map over the intelligence plane, no new canonical events).
  Event-index + CSE-003/CSE-005 cross-links updated.
- **MRL v1 (`MeaningRepresentationUnit`, `meaning` privileged agent).** Governed model-backed unit
  with the same discipline as the M3 canonicalizer: grounding law at the parser (a unit citing no
  known anchor/concept is discarded; anchors/concepts not in the input are dropped), `thinkingBudget:0`
  on the structured call, and a deterministic fallback (intent + compressions only — never
  fabricated analogies) landing at **0.45 < floor ⇒ honest `source.layer.degraded`**. New L7 types
  `MeaningUnit`/`MeaningLayerContent` in source-environment. `SourceCanonicalizationService.constructMeaning`
  records the layer + places MRL world nodes `mrl:<version>:<unit>` with `expresses` edges to
  concept nodes. **The L7→L8 hinge made real:** a unit grounded only on region anchors backfills
  its `concept_refs` from the SEMANTIC layer's `concept → evidence_paths` map (shared-evidence
  inference, never invention) — discovered live when the meaning agent grounded on anchors and
  minted no concept refs, leaving 0 graph edges; the backfill turned that into 14 edges.
- **Resume cards.** `SurfaceSession.projectResumeCard` emits `surface.resume.projected`, folded
  latest-wins into `SurfaceState.resume_card`. Host emits it at surface creation for a returning
  learner, derived **only** from the intelligence plane's latest `learner.episode` +
  `learner.understanding-delta` artifacts (CSE-005 §3.2 law) — a fresh learner gets no card (honest
  absence). `IntelligenceSink.latestFor`/`learnerArtifacts` merge the in-memory plane with Postgres
  (a restarted gateway still remembers). Web `ResumeCard` chip on the board-slot column (reflective
  tone, dismissible, "See your map").
- **Understanding Map v1.** `GET /api/learner/:id/understanding` (bearer-authed, own-only — the
  route IS the disclosure, CSE-005 §3.3) projects the learner's episodes + deltas. Web
  `UnderstandingMap` overlay + a "Mind" affordance in the top bar: episodes, mastery movements,
  confusions opened/resolved, and **blind spots** (path concepts never engaged) — evidence, never
  a score (CSE-005 §3.4). `UnderstandingMapView` is a pure, testable projection.
- **Live proofs.** MRL smoke (real Gemini): structural → semantic (7 concepts, KG-bound) → meaning
  `degraded:false | units=5 | {compression:2, intent:2, misconception:1} | worldNodes=5 | 14
  expresses edges` (e.g. `mrl:…:conceptual-compression-1 → concept:gradient-descent`). Gateway test:
  fresh learner → NO resume card; ask + close → returning learner gets a resume card + populated
  Understanding Map (episodes with concept refs); unauthenticated map read refused (401). **Browser
  (chrome-devtools):** entered a live surface, opened the Mind map — rendered honest "No episodes
  yet", "What moved" (0/0), and all 8 curriculum concepts as blind-spot chips; zero console errors
  (screenshot `docs/history/m6-understanding-map.png`).
- **Gotchas:** two independent Gemini calls (semantic, meaning) mint slightly different concept ids
  → the anchor→concept backfill is what binds the MRL to the KG; `eslint no-non-null-asserted-optional-chain`
  forbids `x?.[0]!` (guard with `?? {}` or an explicit throw); pinned `minimalAgentSet()` and the
  web SurfaceState fixtures must be updated deliberately when a slice/agent is added.

Next: **M7 — Director + Scene** (CSE-011/012 organs, `surface.director.*`/`surface.scene.*`, the
affect channel) per the blueprint, closing CSE-P2 and opening the Cognitive Theater.

## 2026-07-12 — CSE M7 T1: the Cognitive Theater — Director + Scene (ADR-0033/0038)

The surface gains its missing conductor and stops being a narrated slide deck: a Director that
decides *what cognitive state the learner should enter next and at what pace*, and Scenes that
wrap frames as living, inhabitable space. Verify green (27 tasks); the Theater flows end-to-end
through a real ask (gateway test) and live Gemini (smoke). Scoped as **T1** — the two organs that
change the architecture; cinematography (CSE-013) and the full interaction grammar (CSE-014)
follow in M8.

- **Spec-first (ADR-0038; SRF-002 → schema 1.8.0).** Three decisions: (1) the Director is an
  **authored pedagogy FSM** in T1 (CSE-011 §10 resolved) — a pure function of folded signals, so
  every directive is deterministic and replay re-derives it; (2) **Scenes wrap frames additively**
  (ADR-0033 L2) — a 1.7.0 log with no scene/director events folds byte-identically; (3) one
  additive subfamily pair — `surface.director.*` (directive / state.entered / pacing.set /
  affect.observed / attention.budgeted) + `surface.scene.*` (opened / actor.entered / evolved /
  lighting.changed / closed) — the Director conducts, never renders (L1). Ordering law 13; fold
  mapping; evolution note; event-index + CSE-011/012 marked implemented.
- **`packages/surface/theater.ts` (browser-safe).** Typed records (Directive, AffectSignal,
  AttentionBudget, Scene, Actor, SceneDelta) + defensive readers; the **`decideDirective` FSM**
  — an authored priority ladder encoding the pedagogy (confusion/frustration → *struggling* slow +
  support; assessment → *assessing*; failed gate / practice → *practicing*; mastered + frontier →
  *mastering* brisk; mastered → *consolidating* with **silence** as a first-class output, L6;
  opening beat → *orienting*; else *learning*), every directive carrying rationale + a rejected
  alternative + confidence (L4); **`inferAffect`** — behavioral-only, honest absence when there is
  no evidence (never a guessed emotion, CSE-011 §9). Six new fold slices: `director_directives[]`
  + `latest_directive`, `affect_signals[]` + `latest_affect`, `attention_budget`, `scenes[]`
  (upsert by scene_id, actors upsert by actor_id, deltas append to the evolution log, lighting
  replaces, closed marks). 12 tests (FSM determinism, replay equivalence, evolution log,
  backward-compat).
- **Session wiring (behind a `theater` dep flag; gateway on, CLI/tests off → L2 byte-identical).**
  After each composed frame, `emitTheaterForFrame` reads the current folded signals, runs the
  affect channel + the FSM, and emits (law-13 order): `affect.observed` → `director.directive` →
  `director.state.entered` → `scene.opened` (MCCR elements as actors, protagonist lit) → per-actor
  `actor.entered` → `lighting.changed`. Actors derive from the MCCR (`actorsFromMccr`); the
  source_viewport carries the evidence provenance channel. The 109-test surface suite stayed green
  unchanged — the L2 backward-compat proof.
- **Web.** The board's CDL hue now follows the Director: `FrameDeck` maps the active frame's Scene
  state (or `latest_directive.target_state`) → tint via `directorStateToTint`, overriding the old
  title heuristic; three new tint tokens (reflection/mastery/struggle). A **`DirectorBadge`** in
  the top bar shows the current state + tempo and opens "why this pace" — the rationale + rejected
  alternative + confidence (L4 made visible).
- **Live proofs.** Gateway test (real HTTP, Null model, full ask): directives with rationale +
  rejected alternatives, `latest_directive.entered_state === target_state`, scenes wrapping real
  frames with a lit protagonist, affect signals all behavioral-inference. Live smoke (real Gemini):
  Director issued an *orienting* directive ("Getting oriented in Functions and Their Graphs before
  the details"), `entered=orienting`, and the Scene wrapped a real composed frame with 7 actors, a
  lit protagonist, focal set. Full `pnpm verify` green.
- **Gotchas:** the "why this pace" popover is interaction-gated (SSR shows the chip, not the open
  popover) — the web test asserts the chip + the affordance, not the popover body; three new
  SurfaceState slices meant updating the two pinned web fixtures deliberately; `.superpowers/`
  (untracked scratch) added to `.prettierignore`.

Next: **M8 — agent society + interaction + cinematography** (CSE-013 shot grammar, CSE-014
interaction grammar realizing scene deltas from learner acts, enrichment-loop hardening).

## 2026-07-12 — CSE M8 T2: the Cognitive Theater completed — Cinematography + Interaction Grammar (ADR-0039)

The Theater's four organs are all live: a Director conducts, Scenes are inhabited, the camera moves
for cognitive reasons, and the learner acts on cognition through a semantic grammar that evolves the
Scene in place. Verify green (27 tasks); the shot grammar + interaction grammar flow end-to-end
through the gateway and live Gemini. Scoped as **T2** — the two remaining organs; enrichment-loop
hardening (CSE-007 §4) stays a named later increment.

- **Spec-first (ADR-0039; SRF-002 → schema 1.9.0).** Three decisions: (1) the Cinematographer is a
  **composer role** (CSE-013 §8 resolved) — `planShots` is a pure function; (2) interaction is
  **typed cognitive intent that evolves the Scene in place** (CSE-014) — Mark-class acts drive the
  learner-caused `surface.scene.evolved` path M7 built; (3) one additive step — `surface.shot.*`
  (`planned`, `cut`) + `surface.intent.expressed` + the extended `surface.interaction.received`
  grammar + two new `applied` effects (`scene-evolved`, `annotated`). Ordering law 14; fold mapping;
  evolution note; event-index + CSE-013/014 marked implemented.
- **Cinematography (`packages/surface/cinematography.ts`).** The shot vocabulary (14 kinds) + a
  pure **`planShots`** composer-role planner: `establish` on scene open (orient before detail),
  a `spotlight` per narration segment bound to the discussed actor (the camera follows the voice),
  and a `hold` under a `demanding`/silent directive (stillness, ADR-0033 L6). **Accessibility law
  test-enforced:** `REDUCED_MOTION_REALIZATION` maps every shot kind to a discrete realization; a
  conformance test asserts exhaustive coverage — motion is an enhancement, never a barrier. Shots
  co-locate into `SceneRecord.shots[]` via `surface.shot.planned`.
- **Interaction grammar (`packages/surface/interaction.ts`).** The ~25-primitive registry across
  seven classes (attend / mark / ask / reason / express / navigate / govern-flow) + a pure
  **`interpretIntent`** (kind + target + note → cognitive_intent + class + routing; an unknown kind
  degrades to a safe `ask-why`, never a guessed intent — CSE-014 §7). `interact()` emits
  `surface.intent.expressed` after `received`; **Mark-class acts (annotate/circle/highlight/pin)
  evolve the current Scene in place** via a learner-caused `surface.scene.evolved` (`cause:
  "learner"`, carrying the interaction ref) — the "audience is also an actor" organ, closing the
  loop M7 opened. New `applied` effects `scene-evolved`/`annotated`. Gateway `interact` route + web
  `SurfaceInteractionKind` extended with the grammar.
- **Web.** A **Mark** affordance on every anchor (MccrElement action → `onInteract("annotate",
  elementId)`); a marked anchor renders a durable ✎ + soft discovery-hue ring (`markedElementIds`
  derived from the active Scene's evolution log — the learner's acts become visible on the board).
  The spotlight shot is realized by the existing narration-driven HighlightLayer; the shot list is
  recorded for the Observatory.
- **Live proofs.** Gateway test (real HTTP, full ask): every opened Scene carries a shot list that
  opens with `establish`, every shot declares its reduced-motion realization; a learner `annotate`
  → effect `scene-evolved`, typed intent (`class: mark`) with the note carried, a learner-caused
  scene delta in the evolution log. Live smoke (real Gemini): shots `establish, spotlight` with
  reduced-motion realizations on all; a learner `annotate` → effect `scene-evolved`, intent
  `annotate → mark`, a learner scene delta in the evolution log. Full `pnpm verify` green.
- **Gotchas:** the folded `ExpressedIntentRecord` field is `cls` (the event payload key is `class`
  — a reserved word mapped by the reader); two new SurfaceState-adjacent slices
  (`SceneRecord.shots`, `expressed_intents`) meant updating the two pinned web fixtures; the web
  `onElementAction` signature gained the element id so a Mark targets its anchor.

Next: **M9 — fusion + living knowledge** (CSE-006 Claim Graph + frontier overlays; CSE-015 Source
Fusion), or enrichment-loop hardening (CSE-007) as sequencing dictates.

## 2026-07-12 — CSE M9 T1: Source Fusion + the Claim primitive (ADR-0040)

Many sources reconciled into one understanding: a concept understood from all attached sources at
once — corroboration where they overlap, each source's emphasis composed, coverage gaps named —
while every treatment stays traceable to its own source's anchors (fusion never blurs provenance).
Verify green (27 tasks); proven end-to-end through the gateway and a live confirmation. Scoped as
**T1** — deterministic reconciliation + the Claim primitive; frontier overlays (governed web
research) + the model-backed fused *explanation* synthesis stay a named T2.

- **Spec-first (ADR-0040).** Three decisions: (1) fusion reconciliation is a **pure function** of
  the anchor index (deterministic, replay-safe — CSE-015 §2); (2) the Claim primitive is typed
  structure and **contradictions are honest or absent** (T1 never fabricates one — a false
  contradiction is worse than none, CSE-006 §2/§6); (3) fusion is a governed capability over the
  M5 SourceHub emitting `source.fusion.*`. New `source.*` family events registered:
  `source.claim.recorded`, `source.contradiction.detected`, `source.fusion.composed`,
  `source.fusion.concept.reconciled`, `source.fusion.gap.detected`. Event-index + CSE-006/015 status.
- **`packages/source-environment/fusion.ts` (pure).** The Claim primitive (Claim + typed epistemic
  edges + Contradiction) and the fusion primitives (SourceTreatment, FusedConcept, CoverageGap).
  **`reconcileConcept`** — deterministic: per-source coverage (full/partial/absent), corroboration
  when ≥2 sources cover a concept, complements by each source's emphasis, bounded confidence.
  **`detectGaps`** — target concepts no source covers (an honest research/ingestion prompt, never a
  blank). **`detectContradictions`** — reads cross-source `contradicts` edges from the Claim Graph,
  returns `[]` absent claim data, and labels a disagreement `interpretive` (never presented as an
  empirical/factual one in T1). 8 tests.
- **Gateway (`SourceHub.fuse` + `POST /api/surface/:id/fuse`).** Fuses over exactly the surface's
  bound sources: gathers each source's treatment from its concept-bound anchors (reusing the M5
  evidence path — never cross-source), reconciles per concept, detects gaps, and emits
  `source.fusion.*` on the hub bus (separate id/hlc stream). Returns the fusion for the web view.
  Gateway test: two markdown sources overlapping on "gradient descent" but neither covering
  "backpropagation" → gradient-descent corroborated (both sources' anchors preserved, no fabricated
  contradiction), backpropagation an honest gap.
- **Web (`FusedView`).** A "Fuse" top-bar affordance once ≥2 sources are bound → the fused view:
  per-concept coverage across sources, corroboration + confidence, each source's emphasis (every
  source named — provenance preserved), and honest gaps. `FusedViewPanel` is a pure testable
  projection.
- **Live proof.** Against the running gateway: two real markdown sources → gradient-descent
  `corroborated=true`, 2 sources, confidence 0.75; backpropagation named as a gap —
  `M9 FUSION LIVE SMOKE: PASSED`. Full `pnpm verify` green.
- **Gotchas:** fusion events use a separate id/hlc stream on the hub bus (like the gateway's
  determinism safeguard) so they never perturb the store's seeded ids; the emphasis heuristic is
  coarse in T1 (section-granularity anchor ⇒ definition, else intuition) — real emphasis
  classification is T2 with the meaning layer.

Next: **M9 T2 / M10** — frontier overlays + the research web-fetch loop (CSE-006), the model-backed
fused explanation synthesis + fusion-as-Scene with split/merge shots (CSE-015/CSE-013), or the
video/web/code modalities (M10) as sequencing dictates.

## 2026-07-16 — CSE M9 T2: the Claim Graph + cross-source contradiction detection (ADR-0041)

The "living knowledge" half of M9: sources are no longer only reconciled *where they overlap* —
where they genuinely **disagree** is surfaced too, each disagreement typed by nature and each claim
anchored to its source. This lights up T1's dormant `detectContradictions` with real claim edges.
Model-backed cognition (gateway-on, CLI untouched — the feature is a website capability); verify
green (28 tasks) and proven live through the gateway's fusion engine with real Gemini.

- **Spec-first (ADR-0041).** Claims are **world-state graph nodes** + `source.claim.recorded` events
  (CSE-006 §3.1), not a new layer. One privileged `claim` agent, two modes (the canonicalizer's
  dual-mode precedent). Fusion reads real `contradicts` edges; provenance never blurs. CSE-006 §3.1
  marked implemented; event-index updated.
- **`ClaimReasoningUnit` (`@inevitable/product-cognition`).** `extract` — per-source claims grounded
  on region anchors and/or concept refs (ungrounded dropped; deterministic fallback = one claim per
  *defined* concept, honest degraded, no degenerate label-claims). `contrast` — cross-source
  contradiction detection classifying `nature` (empirical | interpretive | value); honest-absence
  fallback (never fabricates; same-source pairs and unknown ids dropped; <2 sources ⇒ no model call).
- **`ClaimGraphService`.** `extractClaims` namespaces claim ids per source version, binds world-state
  `claim` nodes + `about` edges, emits `source.claim.recorded`; `detectContradictions` writes
  `contradicts` edges + emits `source.contradiction.detected`. Deterministic orchestration; the model
  call is the only non-determinism (D3-recordable). 13 unit/service tests.
- **Fusion light-up (gateway).** `SourceHub.enableClaimReasoning(model)` — host-wired when a real
  model is available (recorded on the hub bus, D3). `fuse()` extracts each bound source's claims
  (cached per version+concept-set), detects cross-source contradictions, passes each concept's
  contradictions into `reconcileConcept`, and attaches per-concept claim summaries. `claimIsAbout`
  falls back to a statement-token match (the same the attention anchorer uses) so anchor-grounded
  claims attach to the fused concept without a persisted semantic layer. **Absent a model, fusion is
  byte-identical to T1** (the T1 gateway test unchanged); 3 hermetic SourceHub integration tests.
- **Web (`FusedView`).** The Claim/Contradiction explorer: "What each source claims" (each attributed
  to its source) + "Where the sources disagree" (typed nature + neutral rationale, value/interpretive
  never shown as factual). `api.ts` gained `ClaimView`/`ContradictionView`; 1 web test.
- **Live proof (through the website backend, real Gemini).** Two sources genuinely disagreeing about
  gradient descent → 5 grounded claims (2 from A `established`, 3 from B `supported`, provenance
  preserved) → **2 genuine cross-source contradictions, both `empirical`** with real rationales
  ("guaranteed to converge to the global minimum" vs "does not generally find the global minimum").
  `apps/api/scripts/m9t2-claim-smoke.ts` (`M9 T2 CLAIM-GRAPH LIVE SMOKE: PASSED`).
- **Gotchas:** the free-tier model burst-limits rapid structured calls — a failed extract lands as
  honest absence (no fabrication), and the smoke retries past the burst window; at the gateway the
  concept vocabulary is slugs only (no semantic layer), so claim→concept attribution leans on the
  statement-token fallback — the full model-backed L2/L6 gateway cutover stays a named future increment.

Deferred (ADR-0041): frontier overlays + governed web-research (CSE-006 §3.2); the model-backed
fused *explanation* synthesis + fusion-as-Scene (CSE-015/013); the Temporal Knowledge Model
(CSE-006 §3.3); claim quarantine-by-judge; the aggregate self-improving instructional layer (needs
the privacy-mechanism ADR). Next: **M9 T3 / M10** as sequencing dictates.

## 2026-07-16 — CSE M9 T3: the fused explanation synthesis (ADR-0042)

The fusion *experience*: after T1 reconciled coverage and T2 lit up the Claim Graph, T3 weaves them
into ONE explanation per concept — grounded in the sources, citing each by name, surfacing
disagreement honestly. The Fused view's headline is now prose ("one understanding drawn from many
sources"), the T2 claims/contradictions beneath it as evidence. Model-backed cognition (gateway-on,
CLI untouched — a website capability); verify green (28 tasks) and proven live through the gateway's
fusion engine with real Gemini.

- **Spec-first (ADR-0042).** A distinct cognition (generation, not extraction) → its own privileged
  `synthesis` agent + `FusionSynthesisUnit`, not a `claim` mode. Two gates enforced at the parser:
  **grounding** (cited sources ⊆ the contributing sources — no invented provenance) and
  **disagreement honesty** (a synthesis over contradicting sources MUST acknowledge it — CSE-015
  §6 / CSE-003 §6). New `source.fusion.synthesized` event. CSE-015 §3.1 marked implemented;
  event-index updated.
- **`FusionSynthesisUnit` (`@inevitable/product-cognition`).** Reads a concept's T1 treatments (with
  quotes), T2 claims, and T2 contradictions; the model weaves prose that cites each source inline by
  name; the parser maps cited titles → version ids and drops any the fusion did not contribute, and
  forces `acknowledges_disagreement` when contradictions were supplied. Deterministic fallback = the
  honest per-source alignment view in prose (each source's claim attributed by name + an explicit
  disagreement note), never a fabricated consensus. 6 unit tests (both gates + fallback + execute).
- **Fusion wiring.** `SourceHub.enableClaimReasoning` → `enableFusionCognition` (wires the claim unit
  *and* the synthesis unit over one recorded model, D3). `fuse()` synthesizes each concept with
  material, attaches `FusedConcept.synthesis`, and emits `source.fusion.synthesized`. **Absent a
  model, no synthesis attaches and fusion is byte-identical to T2** (the T1/T2 gateway tests
  unchanged); the hermetic `sources-claim` test now also asserts the synthesis (cites both, forces
  disagreement acknowledgement, byte-identical when disabled).
- **Web (`FusedView`).** The fused explanation renders as the concept headline (a distinct discovery
  plane), with a meta line ("woven from N sources · surfaces a disagreement · alignment view when
  degraded"); the claims/contradictions explorer sits beneath as evidence. `api.ts` gained
  `FusedSynthesisView`; 1 web test.
- **Live proof (real Gemini, through the website backend).** `apps/api/scripts/m9t2-claim-smoke.ts`:
  two sources on gradient descent → a real fused synthesis citing both sources, `degraded=false`
  (`M9 T2+T3 FUSION LIVE SMOKE ... synthesis PASSED`). The T2 contradiction path was proven live
  earlier (2 empirical cross-source contradictions).
- **Gotchas:** the free-tier model burst-limits rapid structured calls — a failed source extract
  degrades to the heading-fallback claim (honest, grounded on the heading anchor) and the synthesis
  still weaves both sources; the deeper ADR-0027 entailment audit (does the prose follow from the
  cited anchors?), fusion-as-Scene, and source-set caching stay named deferrals.

Deferred (ADR-0042): the ADR-0027 grounding/entailment judge; fusion-as-Scene with split/merge shots;
fused-synthesis caching by source-set hash. Next: **M9 frontier overlays / Temporal Knowledge Model
(CSE-006 §3.2/§3.3), or M10** (video/web/code modalities) as sequencing dictates.

## 2026-07-16 — CSE M9 Frontier T1: living-knowledge overlays via governed web research (ADR-0043)

The headline "living knowledge" capability, and the COS's first governed reach **outside** the
learner's uploaded sources: beside a concept, the current edge of its field — latest research, open
questions, competing theories, future directions — each grounded in a real, clickable citation. The
source stays sacred (CSE-006 §2): the frontier renders in its own reserved channel, never annotating
over evidence. Gateway-on, CLI untouched — a website capability. Verify green (28 tasks) and proven
live with real Gemini web grounding.

- **The load-bearing law (CSE-006 §4/§6): no frontier entry without a citable origin.** A model
  asserting a frontier claim from training memory with an invented URL is forbidden — worse than an
  empty frontier. So frontier research uses **real web grounding**, not unaided recall.
- **Spec-first (ADR-0043).** Web-grounded generation is a first-class, D3-recorded model capability;
  the FrontierOverlay is typed + grounded + time-versioned; frontier research is a governed unit, on
  demand, in a reserved provenance channel. CSE-006 §3.2 marked implemented; event-index updated.
- **Adapter (web grounding).** `ModelGenerationRequest.webSearch` + `ModelGenerationResult.citations`
  (additive). `GeminiModelRuntime` attaches the `googleSearch` tool (mutually exclusive with
  `responseSchema`) and extracts real citations from `groundingMetadata` (deduped by uri).
  `NullModelRuntime` returns none. **`RecordingModelRuntime` records + replays citations** — the
  fetch is recorded-before-use, so replay shows the frontier as it was then (time-travel honesty).
  3 adapter tests (tool attached, citations extracted/deduped, record→replay round-trip).
- **`FrontierOverlay` primitive** (`packages/source-environment/frontier.ts`): 7 entry kinds,
  `FrontierExternalRef`, time-versioned overlay. `source.frontier.updated` event.
- **`FrontierResearchUnit`** (privileged `frontier` agent — it reaches outside the learner's
  sources): model-backed with web grounding; the parser enforces the grounding law (no real citation
  ⇒ no entry, whatever the model wrote); honest-empty degradation on no-web/failure (never a
  fabricated frontier). 6 unit tests.
- **Gateway.** `SourceHub.enableFusionCognition` also wires the frontier unit;
  `researchFrontier(conceptRef, versionId?)` runs it on demand, builds + caches the overlay, and
  emits `source.frontier.updated`. `ServedSurface.researchFrontier` + `POST /api/surface/:id/frontier`.
  Honest-empty without a model. 3 hermetic SourceHub tests (grounded overlay, degraded-empty without
  citations, empty without the unit).
- **Web (`FrontierPanel`).** A "🔭 Frontier" affordance researches the focus concept; entries render
  by kind in the reserved research channel (CDL research state), each a live external link; the panel
  declares itself a separate channel ("the source stays sacred"). Honest empty/degraded messaging.
  `api.ts` `FrontierView` + `researchFrontier`; 1 web test.
- **Live proof (real Gemini web grounding, `apps/api/scripts/m9-frontier-smoke.ts`).** "transformer
  neural networks" → 8 typed frontier entries across all kinds (Mamba/SSMs, MoE in 2025/26 frontier
  models, RoPE/GQA, agentic multimodal systems, attention-interpretability limits), **every one
  grounded in a real web citation** — `M9 FRONTIER LIVE SMOKE: PASSED`.
- **Gotchas:** grounding citations are Google `grounding-api-redirect` URLs (they resolve to the real
  sources) — precise per-entry attribution via groundingSupports span mapping is deferred; T1 attaches
  the search's grounded citation pool per entry (capped).

Deferred (ADR-0043): the ADR-0026 readiness-gating surfacing pipeline
(`surface.research.frontier.detected/surfaced/deferred`), the frontier as a standing Scene actor
(§5) with the Director raising the horizon, the budgeted refresh cadence + volatility scoring
(§4/§8), the capability-envelope tool-runtime routing, and promotion of frontier entries into Claims
(§3.1). Next: the Temporal Knowledge Model (CSE-006 §3.3), the readiness-gating pipeline, or M10
(video/web/code modalities).

## 2026-07-16 — CSE M9 TKM T1: the Temporal Knowledge Model via web-grounded temporal research (ADR-0044)

The third and final living-knowledge structure (Claim Graph ✓, Frontier Overlay ✓, Temporal Model
✓): each concept becomes a trajectory through time — origin → milestones → paradigm shifts → current
debate → open problems — every state grounded in a real, clickable citation, and honestly sparse
(a niche concept shows a short strip, never padded). Gateway-on, CLI untouched — a website
capability. Verify green (28 tasks); proven live with real Gemini web grounding.

- **Spec-first (ADR-0044).** TKM T1 = web-grounded temporal research (reusing the ADR-0043 grounding
  capability + citation type), a distinct structure + `temporal` agent parallel to Frontier (present
  edge vs past→present trajectory). Grounding law + "sparse is honest" (CSE-006 §8) enforced.
  CSE-006 §3.3 marked implemented; `source.timeline.updated` in the event-index.
- **`ConceptTimeline` primitive** (`packages/source-environment/temporal.ts`): `EpistemicState`
  (5 kinds origin/milestone/shift/current-debate/open-problem, an optional `era`, ≥1 real
  `external_refs`), ordered `states`, `degraded`.
- **`TemporalResearchUnit`** (privileged `temporal` agent): model-backed with web grounding; the
  parser enforces the grounding law (no real citation ⇒ no state), keeps a null era (never invents a
  date — §8), and **orders states chronologically** by parseable era year (undated sink to their
  phase rank, model order the stable tiebreak). Honest-empty on no-web/failure. 6 unit tests
  (grounding, ordering, sparse honesty, execute paths).
- **Gateway.** `SourceHub.enableFusionCognition` also wires the temporal unit;
  `researchTimeline(conceptRef, versionId?)` runs it on demand, builds + caches the timeline, emits
  `source.timeline.updated`. `ServedSurface.researchTimeline` + `POST /api/surface/:id/timeline`.
  3 hermetic SourceHub tests (grounded + ordered, degraded-empty without citations, empty without
  the unit).
- **Web (`TimelinePanel`).** A "⧖ Timeline" affordance traces the focus concept through time — an
  ordered vertical strip (era markers, kind labels, grounded citation links) in the reserved research
  channel, honestly sparse. `api.ts` `TimelineView`; 1 web test.
- **Live proof (real Gemini web grounding, `apps/api/scripts/m9-timeline-smoke.ts`).**
  "backpropagation" → 7 chronologically-ordered epistemic states (Rosenblatt 1962 → modern
  formulation → MLP popularization 1980s → GPU resurgence → vanishing-gradient + biological-
  plausibility debates → ongoing alternatives), **every one grounded in a real web citation**, years
  non-decreasing — `M9 TIMELINE LIVE SMOKE: PASSED`.
- **Gotchas:** citations are Google `grounding-api-redirect` URLs (resolve to real sources); the era
  sort keys on the leading 4-digit year (`mid-1980s` → 1980), undated states sink by phase rank.

**CSE-006 living knowledge is complete** (all three structures). Deferred (ADR-0044): assembly from
L6 citation lineage + claim `supersedes` edges + frontier entries once populated at the gateway; the
Cognitive Time Machine UI (CSE-009 §3) + the Temporal transformation (CSE-004); curated seed
timelines for pre-digital concepts. Next: the ADR-0026 readiness-gating surfacing pipeline, or M10
(video/web/code modalities).

## 2026-07-17 — CSE M9 LKS T1: grounding the proactive frontier (ADR-0045)

Resolved a real honesty inconsistency between two frontier systems. S3 (ADR-0026) already surfaced a
frontier *proactively* on verified mastery — but its content was an **ungrounded model breadcrumb**
("no external fetch, no citation grounding"), which contradicted the CSE-006 §4/§6 grounding law the
web-grounded Frontier/Timeline (ADR-0043/0044) enforce. LKS T1 feeds the **real, cited** frontier
into the existing readiness gate: proactive *and* grounded. Gateway-on, CLI untouched. Verify green
(28 tasks).

- **Spec-first (ADR-0045, amends ADR-0026).** The readiness gate stays the "when" (verified mastery);
  the grounding law stays the "what". A `frontierProvider` seam surfaces the grounded frontier —
  **grounded-or-deferred, never the ungrounded breadcrumb when a provider is wired**. Precedence:
  provider wins; absent a provider, the legacy ungrounded `ResearchUnit` path runs unchanged (CLI/tests
  byte-identical). CSE-006 §5 marked.
- **Session (`packages/surface`).** Browser-safe `FrontierOverlayView` + `SurfaceFrontierProvider`
  seam (mirrors the M5 `sourceEvidence` seam — the surface package owns the view type, the host adapts
  the CSE `FrontierOverlay`). `resolveResearchReadiness` prefers the grounded provider: `runGroundedFrontier`
  surfaces the cited frontier (`surface.research.frontier.surfaced { grounded: true, entries }` + a
  research block) or defers honestly when nothing is citable — never blocks, never fabricates.
  `ResearchFrontierRecord` gained optional `grounded` + `entries[]`; the fold reads them (replay shows
  exactly what surfaced).
- **Gateway.** `host.ts` wires `frontierProvider` over `SourceHub.researchFrontier` (maps
  `FrontierOverlay` → the surface view, over the first bound source). With a real model the frontier
  is grounded; with the null model the SourceHub yields honest-empty and the gate defers. The CLI
  wires no provider → the ungrounded path is preserved there.
- **Web (`blocks.tsx`).** The `research` block renders the grounded, cited frontier (entries by kind +
  external links, reserved research channel) when `content.grounded`; the legacy frontier/gap/hypothesis
  breadcrumb still renders otherwise.
- **Tests.** Session (2): grounded surfacing on verified mastery (cited, one surfaced event, grounded
  block) + honest deferral when nothing citable (detected+deferred, no surfaced, no block); projection
  fold (1): grounded flag + cited entries fold; web (2): `ResearchBody` grounded vs legacy. No live
  smoke — the readiness→grounded-surfacing logic is fully hermetic and the real frontier research was
  already proven live (`m9-frontier-smoke`); a full-ask live run would be the slow fire-and-poll path.
- **Gotchas:** the gateway now always wires the `frontierProvider`, so the ungrounded `researchDispatcher`
  is dormant there (grounded precedence); readiness fires only on verified mastery, so the (bounded,
  best-effort) frontier web call is rare, not per-ask.

Deferred (ADR-0045): background/streamed surfacing so the readiness ask never waits; the Cognitive
Director explicitly raising the horizon (a `researching` directive); proactive timeline surfacing;
frontier/timeline as Scene actors; retiring the ungrounded `ResearchUnit` once every manifestation
wires a provider. Next: the Director horizon-raise / Scene actors, or M10 (video/web/code modalities).

## 2026-07-17 — CSE M10 T1: the code modality (ADR-0046)

The first M10 modality, and a proof of the modality-extension seam: a code file becomes a full
Canonical Source Environment — its constructs are anchor-addressable regions, and because every
deeper layer (concepts, anchors, fusion, claims, synthesis, frontier, timeline) operates over the
structural layer, **the entire M1–M9 pipeline works over code with zero downstream change**.
Deterministic, offline, gateway-on. Verify green (28 tasks); proven live with real Gemini.

- **Spec-first (ADR-0046).** Code is the most tractable new modality — text (no fetch/binary/
  transcription), real structure (top-level constructs), deterministic. It rides the M1 `parse` seam;
  nothing downstream changes. CSE-002 §7 + the blueprint M10 row marked; web + video (temporal layer/
  concept scrubber/media intents) deferred within M10.
- **`CodeReferenceAdapter`** (`packages/source-environment/reference-adapters.ts`; modality `code`,
  already in `SOURCE_MODALITIES`). `splitCodeBlocks` treats a **column-0 declaration** (a
  language-agnostic construct regex across TS/JS/Python/Go/Rust/Java-family) as a boundary: each
  construct becomes a **heading region** (the signature, so it nests + labels) + a **code region**
  (the body until the next construct); a leading **preamble** captures imports; paths reuse the
  markdown `assignPaths` nesting → byte-identical structural layers. Nested constructs stay inside
  their parent in T1 (honest coarse structure); a construct-less file folds to one region; empty is
  refused. 6 tests (TS + Python + no-construct fallback + empty guard + determinism + store-integration
  register→canonicalize→replay-equal).
- **Gateway.** `SourceHub` registers the code adapter; `code` MIME added. The generic
  `POST /api/sources?modality=code` route + canonicalize + `evidenceFor` + fusion/frontier/timeline
  then all work over code unchanged.
- **Web.** Code renders in the Living Reference via the existing text path (a monospace `<pre>` with
  region highlights); a `[data-modality="code"]` CSS treatment gives it a code panel + monospace font.
- **Live proof (real Gemini, `apps/api/scripts/m10-code-smoke.ts`).** A TS gradient-descent file →
  canonicalized into 5 regions (2 constructs) → real L2 semantic extracted **5 concepts over the code**
  (Gradient Descent Optimizer, Gradient Function, Loss Function, Learning Rate, Theta Parameters),
  all KG-bound, 9 evidence anchors, `degraded:false` — `M10 CODE LIVE SMOKE: PASSED`.
- **Gotchas:** the T1 parse is a heuristic (column-0 constructs), not an AST — nested methods live in
  their class body; `apps/api` doesn't declare `@inevitable/world-state`, so the smoke imports it from
  source (the M3/M6 workspace-resolution workaround).

Deferred (ADR-0046): the **web** modality (governed HTTP fetch + HTML → structural, capability
envelope) and the **video** modality (transcript + temporal layer + concept scrubber + governed media
intents — the M10 headline); per-language AST parsing; code-aware syntax-highlighting as a layer.
Next: the web or video modality (M10 T2), or M11 (creative cognition).

## 2026-07-17 — CSE M10 T2: the web modality (ADR-0047)

The second M10 modality — the single most common learning source — and the modality-extension seam
proven a second time. A web page's HTML becomes a full Canonical Source Environment; because every
deeper layer operates over the structural layer, the entire M1–M9 pipeline works over web pages
unchanged. Deterministic, offline, gateway-on. Verify green (28 tasks); proven live over a real
Wikipedia page + real Gemini.

- **Spec-first (ADR-0047).** The one real design question — the fetch — is split: HTML → structural
  extraction (pure, deterministic) vs fetching a URL (a governed ToolRuntime invocation behind a
  capability envelope, CSE-002 §7 / ADR-0026). T2 does the extraction and **defers the server-side
  fetch**: the client supplies the page's HTML (it already loaded the page), so the gateway performs
  no outbound request — no SSRF/capability surface before value ships. CSE-002 §7 + blueprint M10
  markers updated.
- **`WebReferenceAdapter`** (`packages/source-environment/reference-adapters.ts`; modality `web`,
  already in `SOURCE_MODALITIES`). `splitHtmlBlocks` strips non-content (script/style/svg/comments)
  and boilerplate (nav/footer/aside), extracts block elements in document order (`<h1>`–`<h6>` →
  heading with level, `<p>`/`<blockquote>` → paragraph, `<li>` → list, `<pre>` → code), strips inline
  tags, decodes named + numeric HTML entities, and tidies a space left before punctuation by a
  stripped tag; paths reuse the markdown `assignPaths` nesting → byte-identical layers. Dependency-
  free (no DOM library — CSE-002 §7). A tag-less body folds to one readable region; an all-markup
  page (or empty) is refused. 6 tests (structure + order + boilerplate strip + entity decode + inline
  strip + heading nesting + fallback/empty + determinism + store register→canonicalize→replay-equal).
- **Gateway.** `SourceHub` registers the web adapter; `web` MIME (text/html) added. The generic
  `POST /api/sources?modality=web` + the whole pipeline then work over web pages.
- **Live proof (real page + real Gemini, `apps/api/scripts/m10-web-smoke.ts`).** The real Wikipedia
  "Gradient descent" article (556 KB HTML) → **612 structural regions (18 headings)** → real L2
  semantic extracted **7 concepts** (Gradient Descent, Differentiable Multivariate Function, Gradient,
  Step Size/Learning Rate, Local Minimum, Convex Function, Stochastic Gradient Descent), KG-bound, 13
  anchors, `degraded:false` — `M10 WEB LIVE SMOKE: PASSED`. The harness fetches (standing in for the
  client) with an embedded-sample fallback if the live page is unreachable — the modality under test
  is the parse, not the fetch.
- **Gotchas:** char offsets index the cleaned HTML (advisory — text-modality resolution uses
  text-quote + structural path); the region budget truncates a large page to the model's char cap
  (reported, never silent); `apps/api` lacks `@inevitable/world-state`, so the smoke imports it from
  source (the M3/M6 workspace-resolution workaround).

Deferred (ADR-0047): the **governed server-side crawler** (URL fetch behind a capability envelope —
scheme/host allowlist, SSRF guard, robots, rate limit, provenance), feeding the same adapter;
readability-grade main-content extraction + table/figure structure; and the **video** modality
(transcript + temporal layer + concept scrubber + governed media intents — the remaining M10 member).
Next: the video modality, the governed crawler, or M11 (creative cognition, CSE-016).

## 2026-07-17 — CSE M10 T3: the video modality + the L4 temporal layer (ADR-0048)

The third M10 modality — and the one that introduces the time dimension. A video's timed transcript
becomes a full Canonical Source Environment: cue regions (structural) plus the **L4 `temporal`
layer** (per-region timecodes), the first implementation of that declared-but-empty layer. Because
every deeper layer operates over the structural layer, the whole M1–M9 pipeline works over video
unchanged. **M10's three modalities — code, web, video — are complete.** Verify green (28 tasks);
proven live over a transcript + real Gemini.

- **Spec-first (ADR-0048).** The hard part — audio→text transcription — is a governed media
  capability (CSE-002 §7), so T3 follows the web-T2 pattern: the client/upstream supplies the timed
  transcript; T3 turns it into layers; transcription is deferred. CSE-002 §7 + blueprint M10 markers
  updated (M10 complete).
- **`TemporalLayerContent`** (`layers.ts`): `{ segments: [{ region_path, start_ms, end_ms }],
  duration_ms }` — the L4 layer, real cue timings only (never fabricated). `ParsedSource.temporal?`
  added; `SourceEnvironmentStore.canonicalize` records it in the same pass it records the PDF `visual`
  layer (ADR-0036 precedent) — no new event.
- **`VideoTranscriptAdapter`** (modality `video`, already in `SOURCE_MODALITIES`): parses **WebVTT**,
  **SRT**, and a **JSON** `{start,end,text}` array; timecodes (`HH:MM:SS.mmm` / `,mmm` / `MM:SS.mmm`)
  → milliseconds; each cue → a `paragraph` region in time order + a temporal segment (regions 1:1
  with cues). Deterministic, dependency-free (no media/subtitle library). An untimed transcript (no
  cues) is refused — that's the `text` modality, not `video` (no invented time). 6 tests (VTT/SRT/JSON
  + timecode parse + refuse-untimed + determinism + store register→canonicalize→temporal-recorded).
- **Gateway.** `SourceHub` registers the adapter; `video` MIME (text/vtt). The generic
  `POST /api/sources?modality=video` + the whole pipeline work over transcripts.
- **Web.** The transcript renders via the existing text path with a `[data-modality="video"]`
  treatment; the interactive concept scrubber (concept → timecode seek over the L4 layer) is deferred.
- **Live proof (real Gemini, `apps/api/scripts/m10-video-smoke.ts`).** A WebVTT gradient-descent
  lecture → **4 cue regions + a 4-segment temporal layer** (0–8/8–16/16–24/24–32s, duration 32s) →
  real L2 semantic extracted **8 concepts** (Gradient Descent, Loss Function, Learning Rate,
  Convex/Non-Convex Loss Surface, Global/Local Minimum, SGD), KG-bound, 8 anchors, `degraded:false` —
  `M10 VIDEO LIVE SMOKE: PASSED`.
- **Gotchas:** the `RegExp` constructor swallows a leading-BOM pattern, and a literal BOM in source
  trips `no-irregular-whitespace` — the VTT BOM strip was dropped (the header block is skipped
  regardless); `apps/api` lacks `@inevitable/world-state`, so the smoke imports it from source.

Deferred (ADR-0048): **audio→text transcription** (a governed media capability); the **interactive
concept scrubber** (concept → seek) + the **Temporal transformation** (CSE-004); **governed media
intents** (play/seek/clip) + a video keyframe visual (L3) layer; speaker/chapter structure. With code
+ web + video done, M10 is complete. Next: the governed server-side web crawler, or M11 (creative
cognition, CSE-016).

## 2026-07-17 — CSE M11 T1: Creative Cognition — the system as thinking partner, never ghostwriter (ADR-0049)

The COS crosses from *helping you understand* to *helping you make* — but under a hard constitutional
line (Constitution #5, the No-Ghostwriter law). A `Creation` is the learner's artifact-in-progress;
their `draft` is theirs. The system may only attach **disclosed assists**, and the law is enforced
**structurally, not by prompt**: an assist can be exactly one of scaffold (labelled empty slots),
critique (adversarial findings on the draft), provocation (generative questions), or reference
(grounded pointers) — there is no prose/content/draft field anywhere for a model to write the artifact
into, so even a model that tried to ghostwrite has nowhere to put it. Website capability
(gateway-on, CLI untouched); verify green (28 tasks); proven live with real Gemini.

- **Spec-first (ADR-0049, CSE-016).** CSE-016 §2/§3.2 implemented markers set; the four
  `source.creation.*` events (started/evolved/critiqued/completed) registered in the event index.
- **`creation.ts`** (`@inevitable/source-environment`): `Creation` (learner_cid, kind, title,
  concept_refs, `draft` = the learner's own words, assists, status, as_of), `CreationAssist`
  (assist_id, kind, agent_cid, `disclosed: true`, exactly one of `slots`/`findings`/`questions`/`refs`,
  optional `degraded`) — **no field can hold the artifact**. `CREATION_KINDS` (12), `CREATION_ASSIST_KINDS`
  (4), `ScaffoldSlot`/`CritiqueFinding`/`CreationReferenceRef`, `isCreationKind`/`isCreationAssistKind`.
- **`CreationAssistUnit`** (`@inevitable/product-cognition`): model-backed, privileged `creation` agent
  (trust ≥ 3), one output schema per mode — **each schema omits any prose field**, so the parser
  literally has no slot to read an essay from. Deterministic, honest fallbacks per mode
  (`SCAFFOLD_TEMPLATES` per kind, `GENERIC_PROVOCATIONS`/`GENERIC_CRITIQUE`, concept-ref pointers);
  `thinkingBudget:0`, timeout wrapper, D2/D3 trace. Catalog + `PRIVILEGED_AGENTS` updated.
- **SourceHub seam (`apps/api/src/sources.ts`).** `startCreation`/`assistCreation`/`completeCreation`
  over one `RecordingModelRuntime` (wired in `enableFusionCognition`, gemini-gated); emits the four
  `source.creation.*` events on the hub bus. The deterministic assist grammar is available **even with
  no model** (it's pure and safe — no-ghostwriter holds without D3), so the deterministic gateway path
  still offers real scaffolds/questions/refs. The system **never** writes `creation.draft`.
- **Gateway routes.** `POST /api/surface/:id/creation` (open), `/creation/:cid/assist { mode, draft? }`
  (offer a disclosed assist), `/creation/:cid/complete { draft? }`. `ServedSurface` methods + resumed
  read-only stubs.
- **Web — the Create panel (`apps/web`).** The learner authors in a draft textarea (their words, in
  the authored channel); the four assist buttons render results in a **separate column beside** the
  draft, each stamped `disclosed assist · agent.creation` — never merged into the draft. New violet
  authorship channel in the CDL (distinct from research/practice; amber stays reserved for degraded).
  `CreationView`/`CreationAssistView` api types + `startCreation`/`assistCreation`/`completeCreation`.
- **Tests.** Gateway: open → scaffold/critique/provocation → complete, asserting the assist has **none**
  of {prose, content, draft, text, body, essay}, the draft is byte-identical after every assist, and
  every assist is disclosed. Web: `CreationBody` renders the draft + disclosed assists, and the draft
  textarea contains **only** the learner's text (never the scaffold's slot labels).
- **Live proof (real Gemini, `apps/api/scripts/m11-creation-smoke.ts`).** An essay draft → four
  model-backed assists (`degraded:false`): scaffold **9 slots**, critique **3 findings**, provocation
  **9 questions**, reference **2 refs**; every assist checked for the forbidden artifact fields (none
  present) and the learner's draft verified byte-intact after each — `M11 CREATION LIVE SMOKE: PASSED`.

Deferred (ADR-0049): the **contribution loop** (`source.creation.contributed` — a completed creation
re-enters the source environment as a citable source) + co-write-on-request; a Director `creating`
state + a Scene-actor authoring canvas. Next: M12 (observability + production hardening + E2E matrix),
or the governed server-side web crawler.

## 2026-07-17 — CSE M12 T1: deep-transparency surfacing — the source plane's cognition made observable (ADR-0050)

M12 is the production-hardening milestone (deep-transparency surfacing, perf/caching/streaming, full
test matrix); ADR-0050 scopes it into three tranches and delivers **T1**. The gap it closes: the
`SourceHub` emits a rich `source.*` cognition stream (canonicalization, claims, contradictions,
fusion, frontier, timeline, creation) **plus** the D3 `model.output.recorded` events on its own bus —
all replayable, but **nothing observed it**. The source environment reasoned in the dark. That is a
direct miss against the §2 observability invariant ("reasoning quality, disagreement, confidence,
honest degradation") and the product thesis ("the runtime is the product; cognition becomes
visible"). Website capability (gateway-on, CLI untouched); verify green (28 tasks); no new events, no
new store, no replay change.

- **Spec-first (ADR-0050, CSE-002 §11).** M12 tranched: T1 transparency surfacing (this), T2
  perf/caching/streaming, T3 full E2E/failure/replay matrix. CSE-002 §11 marked implemented for the
  transparency projection.
- **`foldSourceCognition(events)`** (`@inevitable/source-environment/cognition-projection.ts`, zero
  Node imports): a **pure, deterministic** observability projection — deliberately separate from
  `foldSourceEvents` (which reconstructs store state for replay). Returns `SourceCognitionState`:
  `activity` (a count per cognition family), `layers` (per (version, layer) confidence + degraded —
  honest degradation surfaced, last-wins), `model_invocations` (D3 `model.output.recorded` count),
  `degraded_count`, and `recent[]` (newest-first, capped, each entry `{event_type, at (hlc),
  producer_cid, summary, confidence?, degraded}` — provenance-bearing). Folding the same log twice is
  deep-equal (replay equivalence). 6 tests (counts + noise-ignored, layer health, D3/degraded counts,
  recent ordering/cap, determinism, honest-empty).
- **Gateway.** `SourceHub.cognition(recentLimit)` folds `this.bus.log`; host-level route
  `GET /api/sources/cognition?recent=` (the source substrate is shared cross-surface, so the read is
  host-level, not per-surface). Strictly read-only — observation never mutates cognition.
- **Web — the Source Cognition panel** (`SourceCognitionPanel` + pure `SourceCognitionBody`): a
  "Runtime" header button opens the deep-transparency read — activity tiles, layer-health chips
  (confidence % + a degraded badge in the reserved ember, never alarm), and a provenance-bearing
  reasoning feed. Rendered in the research channel. `SourceCognitionView` api types + `fetchSourceCognition()`.
- **Tests.** Gateway: the read is honestly empty before any source work, then after register + create +
  assist reports non-zero `versions_registered`/`layers_constructed`/`creations_started`/
  `creation_assists`, `total_events` grows, and **every** recent entry is provenance-bearing with a
  human summary and a `source.*`/`model.output.recorded` type. Web: `SourceCognitionBody` surfaces the
  D3 model-call count, layer health with `data-degraded`, and the provenance feed.
- **No live smoke:** T1 adds no new model calls — it is a pure fold + read over cognition already
  live-proven in M3/M9/M11; the deterministic gateway test exercises it end-to-end over real HTTP.

Deferred (ADR-0050): **T2** perf/caching/streaming (content-hash/concept-set-keyed memoization of
canonicalization/fusion/frontier/timeline; streamed long cognition; lease-governed budgets); **T3**
the full CSE E2E happy path + the CSE-002 §10 failure/replay/governance matrix formalized per tier;
wiring source-cognition quality into the Intelligence Plane distillers + `CognitiveAnalysisEngine`
drift/calibration over source confidence; a durable cross-restart transparency read.

## 2026-07-17 — CSE M12 T3: the full CSE test matrix — production hardening (ADR-0050)

T3 formalizes the CSE-002 §11 test matrix (executing the plan decided in ADR-0050 — no new ADR).
An audit first: the **substrate tier was already comprehensively covered** — unknown modality
(`E_SOURCE_MODALITY_UNSUPPORTED`), empty parse (`E_SOURCE_PARSE_EMPTY`), low-confidence layer →
`source.layer.degraded` (visible), anchor miss/unstable/orphaned (refuse-to-guess) + evented, the
consent-required-modality gate (`E_SOURCE_CONSENT_REQUIRED`), and replay fold-equivalence. The real
gaps were at the **gateway boundary — the actual website surface**, which had one test per slice but
no coherent full-surface walk and no proof its failure paths degrade honestly. T3 closes both.
Verify green (28 tasks); website capability (gateway-on, CLI untouched).

- **CSE E2E happy path** (`apps/api/tests/gateway.test.ts`): one coherent walk over the whole
  environment through the real HTTP boundary on the deterministic path — register two overlapping
  markdown sources → attach both → teach (folded state carries a timeline + composed frame) → fuse
  (corroboration on the shared concept, an honest gap on the uncovered one) → frontier + timeline
  (with no model they **degrade honestly** — `degraded:true`, empty, routes still 200; never a
  fabricated frontier/history) → open + assist a creation → and the **M12 T1 transparency read
  reflects the whole walk** (2 versions, ≥2 layers, ≥1 fusion/frontier/timeline, 1 creation + 1
  assist, `degraded_count ≥ 2` surfaced, every recent entry provenance-bearing).
- **Failure boundary** (`apps/api/tests/gateway.test.ts`): every CSE route returns a typed error,
  never a blank success — unknown modality → 422 `E_SOURCE_GATEWAY` (message names the modality),
  empty body → 400, unknown source content → 404, attach without a version id → 400, fuse with no
  bound sources → 422, assist an unknown creation → 422, unknown surface → 404. Honest degradation
  at the boundary (Constitution #4).
- **Spec:** CSE-002 §11 marked implemented (substrate + gateway tiers), with the consent-revocation
  **cascade/redaction** lifecycle (`source.consent.revoked`/`source.redaction.cascaded`) called out
  as unbuilt — only the registration gate exists; the cascade is a named later increment (a feature,
  not a test gap). No new source files — T3 is test + spec hardening.

Deferred (ADR-0050): **T2** perf/caching/streaming; the consent-revocation cascade/redaction
lifecycle; source-cognition quality → Intelligence Plane distillers + `CognitiveAnalysisEngine`
drift/calibration; a durable cross-restart transparency read. With T1 (transparency) + T3 (test
matrix) done, M12 has T2 (performance) remaining. Next: **M12 T2**, or the governed web crawler.

## 2026-07-17 — CSE M12 T2: governed memoization + cache-hit transparency (ADR-0050) — M12 COMPLETE

The performance tranche, delivered as **memoization + cache observability** (the concrete, testable
core), with the load-bearing law that **caching must not change replay output**. Frontier, timeline,
and claims were already cached; the gap was `fuse()`, which recomputed every call (re-running the
synthesis model per concept). Verify green (28 tasks); gateway-on, CLI untouched. **This completes
M12 (T1 transparency + T3 test matrix + T2 performance) — and the CSE domain M1–M12.**

- **Fusion memoization (`apps/api/src/sources.ts`).** `fuse()` now memoizes by
  `sorted(source-version-ids) + sorted(concept-refs)`. Source versions are content-addressed +
  immutable (new content ⇒ new version id), so the key is **staleness-free** and reconciliation over
  a fixed version set is deterministic: a hit returns the identical `FusionResult` with **no
  re-emission and no model call**. That is the replay-safety law — a cache hit leaves the source log
  byte-for-byte unchanged.
- **Cache-hit telemetry (CSE-002 §11's named metric).** A live `cacheCounters` records hits/misses
  per cognition kind (fusion, frontier, timeline, claims — the last three instrumented at their
  existing cache points). `SourceHub.cognition()` snapshots it into `SourceCacheStats`
  (hits/misses/hit_rate/by_kind), a new field on `SourceCognitionState` that `foldSourceCognition`
  echoes from `opts.cache` (the fold stays pure — cache stats are a live counter, not a log fold, so
  they're injected, not folded). Surfaced in the web Runtime panel ("N hits / M misses · X% hit
  rate — memoized cognition, replay-identical").
- **Tests.** source-environment: the projection echoes injected cache stats + defaults zeroed (fold
  stays pure). Gateway (the key one): fuse twice over the same sources+concept → the second is a
  cache hit → the result is deep-equal, `total_events` is **unchanged** after the hit (nothing
  re-emitted), and `cache.by_kind.fusion.hits ≥ 1` — proving memoization doesn't change replay
  output, exercised against the T3-locked E2E surface. Web: the Runtime panel renders the hit rate.
- **Deferred (named):** streaming of long-running cognition + lease-governed budget/backpressure —
  the heavier half of T2's original scope, a separately-scoped increment. Memoization + telemetry
  land here; streaming does not.

With M12 complete, the CSE roadmap milestones M1–M12 are all delivered. Remaining CSE work is the
named deferred set (streaming/backpressure; consent-revocation cascade; the governed server-side web
crawler; M11 contribution loop; source-cognition → Intelligence-Plane wiring).

## 2026-07-17 — CSE contribution loop: a creation becomes a Cognitive Source (ADR-0051)

The first post-roadmap increment (M11 follow-on) — it closes the mission arc's final step:
Read → Understand → Master → Create → **Contribute**. A completed `Creation` can be consented into
the shared substrate as a first-class Cognitive Source, making the system **recursive**: its output
becomes its input. Verify green (28 tasks); gateway-on, CLI untouched; deterministic (no model call —
fully replay-safe).

- **Spec-first (ADR-0051, CSE-016).** New decision: creations-as-sources, under two laws — **consent**
  (CSE-002 §8: sharing is explicit, never automatic) and **authorship integrity** (CSE-016 §6: only
  the learner's `draft` becomes source content; the disclosed assists stay provenance, so the
  No-Ghostwriter law holds through the loop). CSE-016 implementation-status updated.
- **Primitives.** `origin: "creation"` added to `SourceProvenance` (a creation-derived source is a
  distinct, honest provenance origin — not an upload). `Creation.contributed_as?: string | null`.
  New `source.creation.contributed` event + `SourceCreationContributedPayload`; folded into
  `foldSourceCognition` (activity `creations_contributed` + a recent-feed summary).
- **`SourceHub.contributeCreation(id, {consent})`.** Refuses unless the creation is `completed` AND
  consent is explicit (typed errors, never a silent share); refuses an empty draft. Registers the
  draft via the ordinary M1 pipeline (`register` → `canonicalize`, modality `markdown`) with
  `origin:"creation"` provenance (attributed to the learner) + a `consent_ref`, records
  `contributed_as`, emits `source.creation.contributed`. `register` gained an optional provenance
  override. Host `ServedSurface.contributeCreation` also **binds the new source to the surface**, so
  the learner can immediately teach/fuse from their own contribution. Route
  `POST /api/surface/:id/creation/:cid/contribute { consent }`.
- **Web.** A completed creation shows an **explicit consent-to-share** affordance ("Contribute —
  consent to share as a source", with a plain-language note that nothing is shared otherwise); once
  contributed, a badge shows the recursion + reaffirms only-your-words-became-the-source.
  `contributeCreation()` api + `CreationView.contributed_as`.
- **Tests.** Gateway (the recursion proof): contribute-before-complete → 422; contribute-without-
  consent → 422; with consent → a new source version whose canonical bytes are served with a matching
  `X-Content-Hash` (first-class, fidelity-provable), `contributed_as` recorded, and
  `creations_contributed` + a `source.creation.contributed` entry in the transparency read. Web:
  the consent affordance pre-contribution and the contributed badge after; No-Ghostwriter framing
  reaffirmed. No live smoke (deterministic — registering + canonicalizing markdown needs no model).

Deferred (ADR-0051): community sharing/discovery (F11); the durable consent envelope + revoke→
redaction cascade (retract a contributed creation); creation-as-source deeper enrichment (L2/L6,
claim extraction back into the graph); the transitive attribution graph. Next candidates: the
governed web crawler; streaming/backpressure; source-cognition → Intelligence-Plane wiring.

## 2026-07-18 — The governed web crawler: SSRF-safe server-side acquisition (ADR-0052)

Completes the web modality both ways: it had the client-supplied-HTML path (ADR-0047); now it has
governed server-side fetch. The point of the increment is not "fetch a URL" — it is *fetch a URL
under a policy that cannot be tricked into reaching what it must not* (SSRF is the whole risk). The
last genuine acquisition **capability** gap. Verify green (28 tasks); gateway-on, CLI untouched;
hermetic (the fetch seam is injectable — the suite never touches the network).

- **Spec-first (ADR-0052).** Deny-by-default URL policy; deferred DNS-rebinding hardening, robots/
  rate-limit, multi-page crawl, non-HTML-by-URL. ADR-0047's deferred crawler marked landed.
- **`apps/api/src/crawler.ts`.** `validateCrawlUrl` — a **pure, network-free** policy run before any
  byte and again on every redirect hop: rejects non-http(s) schemes, credentialed URLs, and
  `localhost`/loopback (127/8, ::1)/private (10/8, 172.16–31, 192.168, fc00::/7)/link-local
  (169.254/16 incl. the 169.254.169.254 cloud-metadata address, fe80::/10)/CGNAT/multicast/
  IPv4-mapped hosts. `createGovernedWebFetcher` wraps `fetch` with **manual redirect handling**
  (each hop re-validated — a public URL can't 302 into 127.0.0.1), a redirect cap, timeout, streamed
  **size cap** (aborts past the ceiling), and an **HTML-only content-type gate**. Every rejection is a
  typed `CosError`. 12 unit tests (each SSRF vector + the fetcher's content-type/redirect/size guards).
- **`SourceHub.crawl(url)`** (injectable `webFetch`, default governed): validate → fetch → register
  the HTML as a `web`-modality source with `origin:"web"` + `attributed_source` = the final
  (post-redirect) URL, through the ordinary M1 pipeline. A re-crawl of a changed page mints a new
  version (CSE-002 supersedes). Host threads a `webFetch` dep (so `SurfaceHost({webFetch})` injects a
  fake); route `POST /api/sources/crawl { url }`.
- **Tests.** Gateway (hermetic, fake fetch injected via `startWithCrawler`): a fetched page becomes a
  web source whose canonical bytes serve with a matching `X-Content-Hash`; an internal URL
  (169.254.169.254) → 422 `E_CRAWL_HOST_BLOCKED` **with no fetch**; a `file://` URL → 422
  `E_CRAWL_SCHEME_BLOCKED`. No live smoke (the SSRF policy is the value and is exhaustively unit-tested;
  the fetch seam is faked to keep the suite offline).

Deferred (ADR-0052): DNS-rebinding hardening (validate the *resolved* address + pin it); robots.txt /
politeness / per-origin rate limit under a lease; recursive/multi-page crawl; non-HTML-by-URL (PDF →
PDF modality); allowlisted internal fetch for tenant-approved hosts. Next candidates: streaming/
backpressure; community sharing (F11); source-cognition → Intelligence-Plane wiring.

## 2026-07-18 — The knowledge commons: discovery of contributed creations (ADR-0053)

The payoff of the contribution loop: a contribution nobody can find is a tree falling in an empty
forest. The commons makes contributed creations **discoverable**, turning the recursion into genuine
*collective* intelligence — a learner can find what peers made and build on it. This is the
learner-to-learner slice of F11; F11's educator/institution/cohort machinery (teaching signatures,
cohort analytics, policy envelopes, human governance) remains its own milestone. Verify green (28
tasks); gateway-on, CLI untouched; deterministic.

- **Spec-first (ADR-0053).** Load-bearing law: **learner sovereignty** — the commons is a projection
  of the ADR-0051 consented-contribution set, so a private/in-progress/completed-but-not-contributed
  creation *never* appears; every entry is attributed (Constitution #4). Least-disclosure: an entry is
  the contributed source's public face + author, never the learner's other data.
- **`SourceHub` commons catalog.** `CommonsEntry` (source_version_id, creation_id, title, kind,
  `author_cid`, concept_refs, content_hash, contributed_at). `contributeCreation` appends an entry on
  the consented contribution; `commons()` returns the catalog newest-first. Route
  `GET /api/sources/commons` (host-level — the substrate is shared, so the commons is too). Reuse
  rides the **existing** `POST /api/surface/:id/sources` attach — no new attach path; once attached, a
  peer's creation is an ordinary bound source (teachable, fusable).
- **Web — the Commons panel** (`CommonsPanel` + pure `CommonsBody`): a "Commons" header button lists
  shared creations (kind, title, author, concepts) each with an "Attach to my surface" action → the
  learner builds on a peer's work. `CommonsEntryView` + `fetchCommons()` + `attachSource()` api.
- **Tests.** Gateway (the collective-intelligence proof): learner A completes but doesn't contribute →
  the commons is empty (**privacy** — uncontributed work never leaks); A consents → the entry appears,
  attributed, with concepts; learner B (a **different** surface) attaches it and **fuses over it** —
  the peer's source shows up in B's fusion treatments. Web: `CommonsBody` renders attributed entries +
  the attach affordance (idempotent — "✓ Attached" after). No live smoke (deterministic read + attach).

Deferred (ADR-0053): moderation/endorsement + socio-ethical review (F11); cross-tenant/institutional
visibility governance; differential privacy for commons-derived signals; retraction (needs the durable
consent envelope + revoke→redaction cascade); the full F11 educator/cohort layer. Next candidates:
streaming/backpressure; source-cognition → Intelligence-Plane wiring; the durable consent envelope.

## 2026-07-18 — Consent envelope + revoke → redaction cascade: the right to un-share (ADR-0054)

Consent was one-way — a learner could share (ADR-0051) but never take back. That is the wrong shape
for a sovereignty-preserving system, and it was the governance primitive two increments already
pointed at (the commons's missing retraction half; CSE-002 §8's revocation). This implements the
`source.consent.*` / `source.redaction.*` events that were declared and left empty, completing the
consent story both directions. Verify green (28 tasks); gateway-on, CLI untouched; deterministic
(no model call — replay-safe). The honest boundary named up front: revocation stops **all future
disclosure**; it does not un-teach an already-taught downstream copy (deferred).

- **Spec-first (ADR-0054, CSE-002 §8).** `ConsentEnvelope` becomes the first-class unit consent is
  tracked + revoked in. Redaction withdraws **content + reachability** while preserving the version's
  **identity** — the event-sourcing-safe way to forget (hard-delete would break replay). A redacted
  source returns **410 Gone**, never a dishonest 404 (Constitution #4).
- **Primitives (source-environment).** `ConsentEnvelope` type (consent_ref, source_version_id,
  learner_cid, scope, granted_at, `status: active|revoked`, revoked_at). Payload interfaces for the
  three (previously typeless) events; folded into `foldSourceCognition` (activity
  `consents_granted`/`consents_revoked`/`redactions` + recent-feed summaries).
- **`SourceHub`.** `contributeCreation` now records the envelope + emits `source.consent.granted`.
  `revokeContribution(creationId)`: flips the envelope → `revoked` (emits `source.consent.revoked`),
  then **cascades** — delist from the commons, `redactedVersions.add` + delete the served bytes,
  clear the creation's `contributed_as` — and emits `source.redaction.cascaded { redacted_counts }`.
  `content()` + `registered()` refuse a redacted version (withhold + block reuse); `isRedacted()` lets
  the content route return 410. Host `ServedSurface.revokeCreation` also unbinds the redacted version
  from the surface; route `POST /api/surface/:id/creation/:cid/revoke`.
- **Web.** A contributed creation now shows a **"Revoke & redact — take it back"** affordance
  (sovereignty, in the reserved ember); `revokeCreation()` api.
- **Tests.** Gateway (the cascade proof): contribute → in commons + content serves → revoke → commons
  empty, `contributed_as` null, content route **410**, a *new* learner's attach **422**, and the
  consent lifecycle observable in the transparency read (granted=1, revoked=1, redactions=1). Web: the
  revoke affordance renders on a contributed creation. Projection: grant/revoke/redaction fold. No live
  smoke (deterministic).

Deferred (ADR-0054): retroactive retraction of already-taught downstream copies; multi-party
all-party consent + utterance-granular human-session ingestion (CSE-002 §8.2/§8.4); durable envelope
persistence across restart (Postgres `consent_envelopes`); partial (region/claim-level) redaction;
third-party/institutional revocation under F11 policy. Next candidates: streaming/backpressure;
source-cognition → Intelligence-Plane wiring; moderation/endorsement on the commons.

---

## 2026-07 — The public ecosystem: full company website on the CDL

Elevated the public presence from a single landing journey to the complete public manifestation of
Universal Cognitive Infrastructure. Process: five parallel corpus syntheses (design law v1/v2/v3
scope; vision/philosophy with quotable thesis lines; product truths incl. the full CSE pipeline and
No-Ghostwriter law; architecture credibility — 10 invariants, 53 ADRs, 8 adapters, D0–D3, five
layers; current web-code state) → information architecture (quality over count: 8 substantive
regions, not 30 thin pages) → build.

Shipped in `apps/web`: react-router-dom (SPA library mode) with the journey at `/`, lazy routes for
`/vision /philosophy /surface /source /infrastructure /research /roadmap /about`, `/enter` for the
enter card, and the `?s=` surface contract preserved at any path (raw pushState inside the mounted
SurfaceApp is deliberate — the router only gates mounting). New `src/site/` module: `Page` scaffold
(title/meta, per-page cognitive-state hue grading, scroll restoration), `Ambient` (deterministic
seeded 2D canvas of motes/filaments — living cognition on every page without three.js; reduced-
motion static), `SiteNav` (whisper glass, active-region state-light filament, mobile glass
disclosure), `SiteFooter` (ecosystem map + mission line), and primitives (Reveal via
IntersectionObserver `materialize`, PageHero, Section, GlassCard, Quote, LensFigure, NextStep
page-chaining) + `site.css` (law-list, pipeline, ladder, stats, lens, next treatments — all on CDL
tokens). Landing integration: its topbar replaced by SiteNav(onJourney), SiteFooter rises after the
spacer (journey progress now computed against the SPACER height so the footer doesn't stretch
choreography; `.landing-after` z-5 opaque). Copy: authored per-page from the corpus — Vision leads
with "We have democratized information. We have not democratized understanding."; Philosophy
carries the values-hierarchy + refusals + kernel laws; Surface/Source describe only shipping
capabilities; Infrastructure lists the §25.4 invariants verbatim with true stats (53 ADRs, 27
packages/apps, 8 adapters, D3); Roadmap separates now(verified)/next(specified)/horizon(intent);
About holds mission + posture + contact. Hygiene: SEO description/OG/theme-color, SVG favicon,
per-page titles. Verified: tsc/eslint clean first pass, 66 web tests green, `pnpm verify` green,
production build with per-page 2–3KB gz chunks, live tour at 1440 + 500px incl. mobile nav +
journey-end footer. Known deferred: SSG/prerender for per-page SEO; Higgsfield film still blocked
on workspace plan.

---

## CSE Production Readiness — R0 (integrity) + R1 (the Source Dock) — 2026-07-18

A production-readiness audit (`spec/research/cse-production-readiness-audit-2026-07.md`, companion to
the 2026-07-02 UCS review) asked one question: *if a learner uploads a textbook, paper, site, code,
or video today, do they experience a living cognitive environment where the source itself teaches?*
The answer was **no** — substrate 9/10, CSE-as-experienced 3/10. Five structural gaps: no acquisition
UI (zero web callers of `/api/sources` or `/crawl`); teaching source-adjacent (prompts source-blind,
Director anchor always null, lexical post-hoc anchors, positional sync); the Theater folded-but-
unrendered; a web app that never closed a session (starving episode distillation); and a
process-lifetime source plane that forgot consent revocations on restart. The audit's roadmap R0
(integrity) and R1 (the front door) landed this session, spec-first. `pnpm verify` green (27 tasks +
format). No commit (the user commits).

**Spec-first artifacts.** ADR-0055 (CSE production integrity — the five R0 decisions, rejected
alternatives incl. id-alias remapping, sendBeacon, visibilitychange-close). CSE-017 (the Source Dock
projection archetype) + ADR-0056 (its acquisition decisions — raw-bytes upload, honest refusal before
upload, response-driven narrative). SRF-002 records schema 1.10.0 (typed frame kind). README + the
`spec/source-environment` contents table updated.

**R0.1 — the durable source plane (ADR-0055 D1/D2).**
- `SourceEnvironmentStore.registerVersion` gained an optional `version_id`, so rehydration replays a
  registration under its ORIGINAL id (identity stable across restarts; the content hash is still the
  identity — CSE-002 §3.1). Dedupe-by-hash still wins on identical re-registration.
- New `apps/api/src/source-persistence.ts` — `SourcePlanePersistence` (pure `node:fs`, the DPS-001
  pattern): `<dir>/sources/catalog.json` written atomically (tmp + rename) + `bytes/<content_hash>.bin`
  content-addressed. Corrupt/missing catalog → `null` (start empty, never a boot failure). Redacted
  bytes are deleted at redaction time — the withholding itself is durable.
- `SourceHub` gained a `persistence` dep + a `versionMeta` registry: `register`, all creation
  mutations, `contributeCreation`, and `revokeContribution` persist best-effort; `revokeContribution`
  deletes on-disk bytes only when no other non-redacted version shares the hash. `rehydrate()` replays
  every non-redacted version through the M1 `registerVersion → canonicalize` pipeline under its
  original ids, restores bytes/titles/commons/consent/creations, and bumps the `crt-`/`asst-` seq past
  the restored max (collision guard). Redacted versions restore identity only (route still 410).
- `SurfaceHost` builds the persistence when `COS_PERSIST_DIR` is set, exposes a `ready` promise
  (rehydrate-at-boot), and the server `await host.ready` before any route — never a half-loaded plane.
  On surface rehydrate, `sourceBindings` are rebound by folding the restored event log's `state.sources`
  and filtering to versions the hub still serves (D3) — the Living Reference/evidence seam/Fuse gate
  survive restarts.
- Proof: `apps/api/tests/source-durability.test.ts` (2 tests) — a registered source serves identical
  bytes + hash under its original id across a restart and is re-attachable; a contribution's commons
  entry persists; a revocation's 410 + commons delisting survive two restarts.

**R0.2 — contribution emits its attach event (ADR-0055 D5).** `contributeCreation` now binds the new
source through the same `fixture.surface.attachSource(...)` path every other binding uses, so
`surface.source.attached` lands on the canonical log and the client fold (and the `canFuse` gate) agree
with the server — state no longer changes without its event.

**R0.3 — the web closes its session (ADR-0055 D4).** `closeSurface(surfaceId, reason)` in `api.ts`
POSTs the `close` command with `fetch(..., {keepalive:true})` (not `sendBeacon` — the command channel
is JSON + needs headers). `SurfaceView` fires it once per surface on `pagehide` (not
`visibilitychange`, which would kill a live lesson on a tab switch). Distillation (episodes/deltas/
resume cards, host `close`) now runs for the product's only real client. Test: `close-surface.test.ts`.

**R0.4 — typed frame kind (ADR-0055 D6, SRF-002 1.10.0).** `CognitiveFrame` gained
`kind: "teach"|"practice"|"assessment"|"checkpoint"`. Producers set it at every creation site
(planner=teach, practice, checkpoint, assessment, speculation=teach); `emitFrameArtifacts` /
`composeDeterministicFrame` thread it onto `surface.frame.planned`/`.composed`; the fold's
`readFrameKind` prefers the field and falls back to the retired `title.startsWith("practice")`
heuristic only for pre-1.10.0 logs. Internal consumers (`DirectorSignals.isPractice/isAssessment`,
the grading practice-frame lookup) and web consumers (`SurfaceView` answer affordance, `FrameStage`
tint, `deck-model` slide state) read the typed kind via new `frames.ts` helpers `frameRole` /
`isPracticeFrame`. Test: `frames.test.ts` proves a practice frame titled "Make it your own" classifies
by kind, and a pre-1.10.0 log falls back to the title.

**R1 — the Source Dock (CSE-017, ADR-0056).**
- Gateway: `readBytes` caps uploads at 25 MiB → 413 (`PayloadTooLargeError`).
- Web `api.ts`: `registerSource({content,modality,title})` (raw bytes as a Blob for binary, string for
  text) + `crawlSource(url)`; both throw the gateway's own message on refusal so the dock shows it
  verbatim. `RegisteredSourceView` mirrors the gateway summary.
- `components/SourceDock.tsx`: a `＋ Source` top-bar affordance opens an overlay (reusing the commons
  glass shell) with file drag/drop + picker, a URL field (governed crawl), and a paste path. Pure,
  tested helpers: `inferModality` (extension → modality; PDF binary; code extensions; **honest refusal
  before upload** for epub/pptx/ipynb/docx/audio/image/csv with the nearest working path) and
  `describeLayers` (the canonicalization narrative from the registration summary's own
  `layers_available`/`degraded_layers`/`usable` — no invented copy). On success it auto-attaches so the
  Living Reference appears. `styles.css` gained the `source-dock-*` grammar. Test: `source-dock.test.ts`
  (modality inference incl. refusal; the narrative incl. degraded + unusable).

**Verification.** Per-package: source-environment 57, surface 122, web 71, api 58 — all green. Full
`pnpm verify` green (27 turbo tasks + prettier). The audit's severest gap (no front door) and its
ethically load-bearing gap (revocation lost on restart) are both closed. **Next:** R2 — source-anchored
teaching (the pipeline inversion), the heart of the vision.

---

## CSE R2 — Source-Anchored Teaching (the pipeline inversion) — 2026-07-18

The audit's central finding — teaching is *source-adjacent, not source-anchored* — is answered here.
Before R2, even a bound source never shaped the lesson: the curriculum came from the goal string, the
frame-planner and composer prompts contained no source text, the Director's `focus.source_anchor_ref`
was hardcoded `null`, and anchors were bolted on *after* composition by lexical token-overlap with
index-positional narration sync. R2 inverts the pipeline so the source is the medium of teaching.
Spec-first (ADR-0057 + CSE-008 §15 + CSE-011 §11); six sub-phases, each falling back to goal-mode when
no source is bound so nothing regresses; `pnpm verify` green (27 tasks) at the landing. No commit.

**R2a — source excerpts into the planner + composer prompts.** `SurfaceSession.sourceExcerptsFor`
resolves the focus concept's anchored passages (`{anchor_ref, quote(≤600), path}`, ≤3) via the existing
`sourceEvidence` seam *before* dispatch, and threads them as `source_excerpts` into the frame-planner
(`dispatchFramePlan`) and composer (`dispatchComposerForConcept`) request content. Both units'
`buildRequest` read the excerpts and, when present, engage a "SOURCE MODE" directive + a `SOURCE
PASSAGES` prompt block instructing them to teach FROM the passage (quote it, name its figures, never
invent beyond it). Fallback: no excerpts ⇒ today's goal-only prompt, byte-identical. Proof: a
capturing-stub composer test asserts the passage text reaches the prompt in source mode and is absent
in goal mode.

**R2b — the Director selects the source region.** `DirectorSignals` gained `sourceAnchorRef`;
`decideDirective` sets `focus.source_anchor_ref` from it (was structurally `null` — CSE-011 §4 now
fulfilled). `emitTheaterForFrame` passes the resolved `evidence[0].anchor_id`. Deterministic + replay-
safe (the Director stays a pure function of folded signals). The model-backed "expert-gaze" ranking
that would pick the MOST pedagogically-meaningful region (vs the lexical resolver) is a named
follow-on; the structural fix (a real anchor, not null) ships.

**R2c — "Teach this source" mode: the document becomes the timeline.** New store accessors
`structuralRegions` / `semanticConcepts`; `SourceHub.curriculumFor(versionId)` derives a curriculum
from the source's own structure — L2 semantic concepts prerequisite-ordered (Kahn's, cycle-tolerant)
when present, else the L1 heading outline as a linear reading-order chain (unique ids, each section
depending on the prior). Titles are the source's own labels/headings, so the evidence seam resolves
each concept to its region (feeding R2a/R2b). Host seam `ServedSurface.teachSource(versionId?)` builds
a `SurfaceAskInput` from the curriculum, caches it (so `advance` walks the rest of the document), and
runs the ask; route `POST /api/surface/:id/teach-source`. Read-only on a rehydrated-without-snapshots
surface. Proof: a 3-heading markdown doc → a 3-section curriculum in reading order; the null-model
gateway path is fully deterministic.

**R2d — semantic narration↔anchor sync + typed highlight roles + entailment gate.**
`planSourceProjection` gained an optional `segments: {segment_id, text, anchor_ref}[]` input
(`recordFrameArtifacts` now returns it). When present: each segment binds to the anchor its text best
matches by Jaccard overlap of significant words; the highlight role is typed from the segment's MCCR
slot (`definition`→definition, `misconception`→misconception, `key_formula`→mathematical-focus, …)
instead of the hardcoded `evidence`; and an **entailment gate** (`ENTAILMENT_THRESHOLD = 0.08`)
degrades a non-supported segment to viewport-oriented-but-NO-highlight — never a wrong pointer (the
audit's "visual authority amplifies grounding errors" risk). Id allocation order (plan → viewports →
highlights) is unchanged, so the legacy positional path (no `segments`) stays byte-identical on replay;
the pre-R2d tests pass untouched. Proof: definition/misconception segments light their matching anchors
with typed roles; an off-topic segment lights nothing.

**R2e — source-as-stage projection archetype.** `SurfaceView` derives `sourceMode = hasSource &&
viewport_plans present` (actively teaching FROM the source, not merely attached). In source mode the
`board-plane--source-stage` layout gives the Living Reference the dominant width + leading order and
recedes the MCCR board to a companion gloss column (spatial contiguity, Mayer #5); a source attached
for fusion (no viewport plans) stays the aside. CSS-only inversion + reduced-motion/responsive
handling. Proof: the web renders `board-plane--source-stage` with viewport plans present, and does not
when a source is merely attached.

**R2f — landing.** Strengthened the teach-source gateway test into a deterministic end-to-end proof of
the whole walk (register → attach → teach-source → the timeline is the document's sections + a viewport
plan exists + the Director's focus anchor is populated), so R2a–R2e are verified wired together in CI
without a live model. A Gemini-live E2E of the full cinematic walk is a named manual follow-on.
Per-package tests green: source-environment 57, product-cognition 199, surface 125, web 75, api 64.
Full `pnpm verify` green (27 tasks + prettier). **Next:** R3 — render the Theater (shots, pacing,
lighting, progressive derivation are folded-but-unrendered today).

---

## CSE R3 — Rendering the Cognitive Theater (R3a–R3c) — 2026-07-18

The audit found the Theater's craft folded-but-unrendered: cinematography shots, Director pacing, and
derivations were computed, emitted, and folded into `SurfaceState` yet had no client consumer — dead
at render. R3 wires those consumers. No new architecture (the events already exist per
ADR-0033/0038/0039); every motion is reduced-motion-safe. Spec notes in CSE-011 §11 (pacing) and
CSE-013 §-impl (shots). `pnpm verify` green (27 tasks) throughout. This landing covers R3a–R3c; R3d
(Scene lighting) and R3e (attention-budget producer + affect) remain. No commit.

**R3a — progressive derivation.** A multi-line `key_formula` (`MccrElement.tsx` `FormulaView`) now
stages its derivation lines in sequence while the formula is the active (spoken) element — a CSS
stagger keyed to a per-line `--line-index`, so the learner watches the derivation constructed on the
board rather than receiving it whole. `renderContent` threads the element's `active` state to
`FormulaView`; under `prefers-reduced-motion: reduce` the stagger is disabled and every line is
present at once (the animation only ever governs entrance, never presence). Test:
`apps/web/tests/mccr-formula.test.tsx` (staged when active + all lines present; no staging class when
inactive).

**R3b — Director pacing consumed.** `useChoreographer` used a fixed `PAUSE_AFTER_MS = 1400` for the
inter-segment hold; the Director's `pacing` (`tempo`/`dwell_hint_ms`/`silence`) was folded but
ignored. New pure, exported `pacingHoldMs(pacing, pauseAfter)`: tempo scales the teacher's pause
(slow 1.5×, measured 1×, brisk 0.7×), and `silence: true` holds the surface deliberately still even
on an unmarked segment ("silence is a first-class output", CSE-011 §9); with no directive it returns
the legacy constant (nothing regresses). The hook reads the latest directive's pacing via a ref (no
stale closure) and calls `pacingHoldMs` on segment completion. Test: `apps/web/tests/pacing.test.ts`
(tempo ordering; silence holds; null-directive fallback).

**R3c — cinematography shots consumer.** `surface.shot.*` (the 14-kind grammar, `cinematography.ts`)
was planned/emitted/folded with zero web consumers. `FrameDeck` now reads the active frame's Scene's
latest shot and sets `data-shot={kind}` on the deck; CSS realizes a subtle per-kind board move
(semantic-zoom-in/out, establish/orientation, hold=stillness), all gated under
`prefers-reduced-motion: no-preference` so a reduced-motion client gets the discrete baseline
(CSE-013 §6). Amplitudes are deliberately tiny (≤2%) — a legible move, never spectacle. Test:
`apps/web/tests/surface-view.test.tsx` (a Scene with a shot renders `data-shot`). **Deferred:**
binding each shot to its exact narration segment; tuning the full motion vocabulary with live visual
iteration; shots over the source pane. Tests green: web 80, surface 125. Full `pnpm verify` green.
**Next:** R3d (Scene lighting — focal actor emphasis + sibling recession) + R3e (the
`surface.attention.budgeted` producer + learner-visible affect with opt-out) complete R3.

### R3 continued — R3d/R3e complete the rendered Theater — 2026-07-18

**R3d — Scene lighting.** Scenes were built + folded but only the board tint + learner Mark badges
rendered. `FrameDeck` now maps the active Scene's `lighting.recession` (actor ids) through
`actor.content_ref` to the MCCR element ids and passes them as `recededElementIds` to `FrameStage`,
which sets `data-lit="recede"` on those elements — the board dims them gently (opacity 0.78, a CSS
transition; readability preserved). The element currently being spoken is guarded from recession
(never fight the narration). Test: `mccr-formula.test.tsx` (receded → `data-lit=recede`; active → none).

**R3e — attention-budget producer + affect visibility.** `surface.attention.budgeted` had a fold
slice but no producer; `SurfaceSession.emitTheaterForFrame` now emits it with a session-time
heuristic over frames composed (`high|medium|low|depleted`, CSE-011 §10's "start heuristic"), so the
Director's silence-on-depletion and the learner-visible budget rest on a real signal. New
`AffectChip` (`apps/web`) renders the folded affect (`latest_affect`) + a low/depleted budget as a
compact, learner-visible chip beside the DirectorBadge, with an opt-out (localStorage) — affect is
behavioral inference, never a hidden score (CSE-005 §3.5). Test: `affect-chip.test.tsx` (affect
shown; budget only when low; nothing when neither; opt-out is interactive). Spec notes: CSE-011 §11,
CSE-012 §-impl, CSE-013 §-impl. Tests green: surface 125, web 85. **R3 complete.** Next: R4 — the
Representation Intelligence Agent (Production Goal II).

---

## CSE R4 — Representation Intelligence: spec + the R4a foundation — 2026-07-18

Production Goal II from the audit: representation itself should be a governed cognitive capability,
not a fixed template. Spec-first: **CSE-018** (Representation Intelligence — the `RepresentationPlan`;
the ten representation laws incl. No Hidden Knowledge, Progressive Construction, Persistent Residue,
Semantic Typography, Expertise Reversal; the MCCR 2.0 grammar set; the pipeline position after the
composer, before cinematography; the deterministic-fallback rollout) + **ADR-0058** (RIA adoption —
a new privileged `agent.representation` unit; a plan over a closed vocabulary, never freeform UI;
deterministic fallback = current rendering so it can never regress a frame; the plan recorded +
replayable + inspectable; the RIA assigns CDL roles, never invents them). CSE README + SRF-002
1.11.0 updated.

**R4a — the safe foundation.** New `packages/surface/src/representation.ts`: the `RepresentationPlan`
type (composition of `{element_id, hierarchy: primary|supporting|residue, epistemic_role}`,
exclusions, `plan_kind`) + pure `planRepresentation` (a deterministic type→hierarchy/role mapping —
core_concept/definition = primary; memory_cue = residue; the rest supporting; roles canonical/
definition/reasoning/misconception/memory-cue/evidence/…). `SurfaceSession.emitFrameArtifacts` emits
`surface.representation.planned` after the composed frame (extracting the element list from the final
MCCR incl. the source_viewport). `projection.ts` gains the `representations` slice + a
`readRepresentationPlan` fold (upsert by frame_id). Exported from the package index + the client
entry (for R4b's web consumption). This is PARITY metadata over the same elements — a frame with no
plan renders byte-identically — so R4a is purely additive and cannot regress a frame; role
rendering (R4b), the derivation/misconception grammars (R4c), and model-backed planning (R4d) layer
over this floor. Tests: `packages/surface/tests/representation.test.ts` (the type→role mapping,
unknown-type fallback, the fold upsert). Web fixtures updated for the new slice; the gateway
replay-equivalence holds with the new event. Tests green: surface 128, web 85, api unchanged. Full
`pnpm verify` green (27 tasks). **Next:** R4b — render the epistemic roles as the CDL's per-element
visual language (the learner recognizes the KIND of knowledge without labels).

### R4 continued — R4d density + R4-model (the model-backed RIA) — 2026-07-18

**R4d — density verdict.** `RepresentationPlan` gained `density: {count, budget: 8, within_budget}`
(CSE-018 Law 3), computed deterministically in `planRepresentation`, folded, exported. Over-budget
frames are flagged (the signal to split the frame upstream, never to hide content). Tests in
`representation.test.ts`.

**R4-model — the model-backed RIA, wired end-to-end.** New
`packages/product-cognition/src/representation-unit.ts` `RepresentationUnit` (mirrors
`ImagePlannerUnit`): given the frame's elements + concept + learner expertise, it assigns each
element's epistemic role + representational hierarchy, names exclusions, and records an adaptivity
note. Output is GROUNDED — only element_ids the composer actually produced, enums clamped to the
CSE-018 vocabularies; a malformed/refused/timed-out model DEGRADES to an empty composition, and the
caller falls back to the deterministic `planRepresentation` floor, so a model failure can never
regress a frame (ADR-0058 D3). Wiring: manifest seed `representation` (→ `agent.representation`) +
`MVP_AGENT_IDS`; `ProductRuntimeAgentId` gains `representation` (+ the `workTypeFor` case); a
`representationDispatcher` in `apps/cli/src/wiring.ts`; a `representationDispatcher` session dep +
`SurfaceSession.planRepresentationFor` (dispatch → merge model roles/hierarchy over the deterministic
floor per element, keep session-computed density, `plan_kind: "model"`; any failure → the floor);
`buildDemoSession` `representation?` option (gateway-on) + gateway `representation: true` in
create + rehydrate. Tests: `representation-unit.test.ts` (grounding drops invented ids + clamps bad
enums; a valid model output → D3 model-representation; malformed → degraded-empty). Gotchas fixed:
the manifest id is `agent.<seed>` (find on `agent.representation`); `agent-catalog.test`'s
`minimalAgentSet()` is order-exact (add the id at its `MVP_AGENT_IDS` position). One transient
parallel-load flake on the gateway http tests under full verify; green on a clean re-run.

**R4 = Representation Intelligence COMPLETE (core + model-backed).** Production Goal II's engine is in:
the RIA plans hierarchy + epistemic roles + derivation labels + density deterministically, refined by
a governed model unit, all replay-safe behind the deterministic floor. Remaining (R4e): the
misconception-dissolve grammar + the rest of the MCCR 2.0 grammar set (algorithm/process/graph/
structure/code) + per-element image rationale. `pnpm verify` green (27 tasks). No commit.

### R4e — the MCCR 2.0 render-grammar set completes — 2026-07-23

R4 shipped the Representation Intelligence Agent (deterministic + model-backed) but left the richer
MCCR 2.0 *grammars* named-but-thin. R4e lands them — each a purely additive, replay-safe, reduced-
motion-safe grammar, all sub-phases of ADR-0058 (no new ADR/spec per the proportion doctrine):

- **Misconception-dissolve** (CSE-013). The misconception stopped being a flat one-liner: the
  composer now emits `{wrong, correction}`, folded to a `misconception` content kind, and the board
  shows the wrong belief struck through *resolving down into* the correction (Law 2 Progressive
  Construction). Legacy string misconceptions degrade to plain text; the dissolve animates only
  while spoken; reduced motion keeps both halves.
- **Image rationale** (Law 9). Every pedagogical image already recorded *why* it earns its place;
  R4e carries that rationale onto the board's image element and surfaces it as a quiet opt-in
  disclosure (F16 causal transparency) — shown in both the rendered and failed-image paths.
- **Process / algorithm grammar** (§6). A new first-class `process` MCCR element — an ordered
  procedure of `{text, detail?}` steps that stages in one step at a time while spoken (the
  derivation feel). Density-aware (folds late under pressure); exports as a numbered text block.
- **Code grammar** (§6). A new first-class `code` element — language-tagged source with indentation
  preserved and per-line `note` annotations on the taught lines; the noted lines carry a left accent
  that brightens while the anchor is spoken. Exports verbatim (notes as trailing comments).

Two new element types (`process`, `code`) threaded the whole seam: composer SLOT_ORDER + structured
schema + grounded parse (bare-string tolerant) + prompt guidance; the `MccrElementContent` union +
`Mccr` slot + `readMccr` fold; the web renderer (`StepsView`/`CodeView` + CSS) + `FOLD_ORDER` +
deck/pptx export maps. The typecheck caught every full-`Mccr` fixture that needed the new slots (six
across three web test files) — all patched. Tests: composer parse (dissolve ×3, process ×2, code
×2), fold (misconception, image rationale, process, code), web render (dissolve, image rationale,
process, code). `pnpm verify` green (27 tasks). No commit.

**R4e = the MCCR 2.0 grammar set is complete.** Named set covered: algorithm/process ✓, code ✓,
misconception-dissolve ✓, image rationale ✓; graph/structure were already served by the `diagram`
element's kinds (node-graph/tree/flow/cycle/axes).

**Law 8 (expertise-reversal) — R4 fully closed.** `planRepresentation` gained an optional
`expertise` (novice/intermediate/expert): an EXPERT recedes pure-scaffold *supporting* anchors
(worked examples `example`, analogies `insight`) to `residue` — the classic expertise-reversal
effect, where scaffolding that helps a novice is redundant to an expert. Novice/intermediate keep
the floor hierarchy; **absent expertise ⇒ un-adapted floor with `adaptivity: null`, byte-parity with
the pre-Law-8 plan**. The plan gained `adaptivity: {expertise, note} | null` (folded + exported),
and `planRepresentationFor` now CARRIES the model RIA's adaptivity note (previously emitted then
silently discarded) — expertise adaptation is now observable + replayable. Threaded via an optional
`getExpertise` session dep (same IoC pattern as `getDepthBias`); live derivation from mastery history
is the documented hookup (deferred). The hierarchy change flows to `data-hierarchy` + the density
fold through existing R4b consumers — non-inert. Tests: representation.test.ts (expert demotes +
adaptivity recorded; novice keeps scaffolding; floor parity + null; fold reconstructs adaptivity).
`pnpm verify` green (27 tasks), format clean first pass. No commit.

**R4 = Representation Intelligence COMPLETE — all of Production Goal II delivered** (deterministic +
model-backed RIA; hierarchy, epistemic roles, derivation/misconception/process/code grammars, image
rationale, density, expertise-reversal). Next frontier: R5 compounding & breadth.

---

## 2026-08-21 — Cognitive Runtime execution phase: harness foundation + Structured Semantic Explanation

Branch `feat/uci-cognitive-runtime` (base `ff2d098`). Graduation from architecture/spec into **controlled
implementation**. Three things landed, `pnpm verify` green throughout.

### 1. Persistent-cognition architecture (specs + walking skeleton)
Corpus **file 10** (master architecture) gained the walking-skeleton methodology (§11.0), the
four-measurement L2 exit gate (§11.5: longitudinal · transfer · replay · ablation), the locked canonical
figure (§2.1), and the Prime/RLM-is-mechanism-not-ontology boundary (§0.3). Corpus **file 11**
(Cognitive Harness Runtime — DeepSeek-Harness synthesis, studied from dsh's own source): capability seams
+ protected kernel, durable-vs-live events, the ContextManifest + reconstruction law, the generalized
action pipeline, transactional formation, the dsh **reference-only** strategy. **ADR-0066** records the
direction. New package **`@inevitable/cognitive-loop`** — the L2 walking skeleton: Constitution + Adaptive
Policy (versioned Cognitive Object) + Context Compiler v1 + governed reflect→policy loop + durable causal
event log + **ContextManifest** (reconstruct-from-log) + **CapabilityRegistry/CognitiveHarness**
(transactional compose, inspectable `describe()`). 10 tests, all four L2 measurements + governance-is-real
+ reconstruction-law green.

### 2. Audit — the existing canonical authorities (corrects "build a Semantic Visual Language")
- **Design system is already canonical:** the **Cognitive Design Language** (CDL v1/v2 active, v3
  proposed) — 8 cognitive states, 7 planes, 7 typography roles, motion/space tokens in
  `apps/web/src/tokens.css`, governed spec-first under `spec/design/`. **No parallel system built.**
- **Semantic role vocabulary is already canonical:** `EpistemicRole` (11 roles) in
  `packages/surface/src/representation.ts`, already rendered token-driven via `data-epistemic-role` on MCCR
  board elements. The explanation *block* was the one learner-facing surface still unstructured prose.
- Student/teacher mode: types exist (F13, `ProductMode` defaults `student`) but **not wired to dispatch**.
  Document intelligence: **CSE-002** 8-layer pipeline is the one canonical document architecture.
- **Legacy agent audit (23 units):** KEEP (learner-facing + load-bearing: explanation, curriculum,
  practice, assessment, intent, composer, frameplanner, imageplanner, representation, memory, + the CSE
  units canonicalizer/meaning/claim/synthesis/frontier/temporal/creation) · GENERALIZE into substrate
  faculties (revision→memory consolidation, motivation/reflection→surface composition) · CONVERT-TO-SKILL
  (debate → an `ask_why` deepener). No agent deleted; none converted to a new permanent micro-agent.

### 3. First Student-Mode vertical slice — Structured Semantic Explanation
Migrated the explanation block from an unstructured prose blob into **typed, role-tagged Semantic
Sections**, aligned to the existing `EpistemicRole` vocabulary + the CDL (no new roles, no new colours).
`packages/surface/src/semantic-explanation.ts` (new): `SemanticSection`, a total `explanationSectionRole`,
a pure `structureExplanation` mapping the F04 seven layers → epistemic roles (intuition→insight,
visual→structural, definition→definition, math→reasoning, applied→example, extensions→observation,
frontier→evidence), stamped with `EXPLANATION_ROLE_VOCAB_VERSION` for reproducibility. Enrichment runs at
the single block-construction chokepoint (`createCognitionBlock`), so every path — contribute, streaming,
replay-fold — yields identical **durable** sections; legacy `layers` preserved (back-compat); content
already carrying `sections` left untouched. Renderer (`apps/web/src/blocks.tsx` `ProseBody`) emits each
section with `data-epistemic-role`; `styles.css` role→hue mapping **generalized to one shared authority**
(`[data-epistemic-role]` covers board + explanation, no duplicated colour constants) + a token-driven
`.section` treatment (role-hue border + label; colour never the sole signal). Tests: surface (7) —
mapping/order/roles ∈ authority, purity, forward-compat, chokepoint enrichment, no-double-enrich,
non-explanation-untouched; web (2) — token-driven render + legacy fallback.

### Status
- **IMPLEMENTED (this branch, verify-green):** cognitive-loop harness + ContextManifest + capability
  registry; structured semantic explanation (producer + durable + token-driven render).
- **PARTIAL:** the harness is a self-contained seed — not yet driving the live gateway explanation; the
  structured explanation runs in the real surface path but the *producing* explanation is still the
  legacy `ModelBackedUnit` (deterministic layer→role mapping, not model-emitted roles).
- **DEFERRED (recorded, next dependency order):** (1) harness↔gateway integration — the governed process
  drives real explanation; (2) model emits role-tagged sections directly (beyond the fixed 7 layers);
  (3) student/teacher mode-aware dispatch (wire F13 into the Supervisor); (4) document-grounded
  explanation on the surface (CSE); (5) live HookBus + generalized action pipeline (file 11 §12 order).
- **Next dependency:** harness↔gateway integration — the smallest step that makes the governed cognitive
  process actually produce the (now structured, token-driven) explanation a learner sees.
