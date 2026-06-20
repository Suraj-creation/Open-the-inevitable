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
