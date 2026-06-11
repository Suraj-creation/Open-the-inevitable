# The Inevitable — Project Handoff

_Generated: 2026-06-05 · Branch: master · Commit: f6e307f_

---

## 1. PROJECT SNAPSHOT

- **Mission:** Build a Cognitive Operating System (COS) for human learning — not an AI chat app. The platform is a governed, event-sourced, deterministic runtime where agents, memory, orchestration, and learner state are all projections of a unified world-state.
- **Current phase:** Phase 1E (active) — wiring the first product-cognition slice through the substrate. Phase 1D (complete) provides the execution engine, world-state graph, memory tiers, scheduler, adapters, and OTel edge.
- **Primary objective:** Turn the COS substrate into a working explanation→practice→mastery loop, then route that loop through a multi-agent supervisor.
- **Defining constraint:** Spec-first. Code that diverges from a spec is invalid. Heavy infrastructure clients (NATS, Qdrant, Neo4j, Postgres) are NOT workspace deps — loaded via guarded dynamic import; monorepo verifies offline.
- **Core primitives:** CognitionPacket (typed semantic exchange), CognitiveWorkItem (scheduler unit), CognitiveUnitHost (runtime lifecycle), WorldStateGraph (learner knowledge DAG), TieredMemoryStore (memory-mutation protocol), DepthScheduler (preemption/fairness/budgets), ExecutionEngine (deterministic cognitive fibers).
- **16 packages + 1 service** under `packages/` and `services/data-plane`. Product feature surface is `@inevitable/product-cognition`.
- **Product law:** 16 feature specs F01–F16 under `spec/product/features/`. Master PRD: `spec/product/Broader-feature-product.md`. Features map onto COS primitives — no feature bypasses the kernel.
- **The gap that defines all near-term work:** `DeterministicLearningLoop` runs one agent (explanation then practice). It needs a `SupervisorUnit` routing CognitionPackets to the right specialist agent based on learner world-state, plus OTel trace capture per dispatch.

---

## 2. CURRENT STATE

| Field | Value |
|---|---|
| Branch | `master` |
| Commit | `f6e307f` (docs: record Phase 1E architectural review in IMPLEMENTATION.md) |
| Ahead of origin | 3 commits (not pushed) |
| Working tree | Clean |
| Typecheck | 18/18 ✓ |
| Tests | 18 suites — product-cognition: 9, kernel: 13, events: 11, shared: 11, runtime: 9, governance: 7, observability: 7, memory: 9, world-state: 6, execution: 7, scheduler: 5, adapters: 4, data-plane: 4, others: pass |
| Lint | 17/17 ✓ |
| Format | Prettier clean ✓ |
| Deployment | None — no deployed environment; verify runs offline |

---

## 3. COMPLETED WORK

**Phase 1A–1C (spec ecosystem + foundational packages)**
Spec infrastructure (~70 domain folders, 10 meta specs, retrieval indexes), ADR-0001–0004, kernel/protocol/event/runtime specs, 12 foundational packages: `shared`, `protocols` (16 JSON Schemas + codegen), `observability`, `events`, `governance`, `kernel`, `runtime`, `scheduler` (Phase 1C base), `memory` (base), `orchestration`, `contracts`, `tooling`.

**Phase 1D (substrate deepening)**
Deterministic execution engine + cognitive fibers (`@inevitable/execution`), world-state graph with acyclic prerequisite enforcement + snapshots (`@inevitable/world-state`), TieredMemoryStore with tiers/projections/decay/subscription (`@inevitable/memory` deepened), DepthScheduler with preemption/fairness/budgets/backpressure (`@inevitable/scheduler` deepened), infrastructure adapters with conformance harness + dependency-optional NATS/Qdrant/Neo4j/Postgres (`@inevitable/adapters`), OTel SDK edge bootstrap + bus→OTel sink (`services/data-plane`). ADR-0005.

**Product topology**
F01–F16 feature specs authored. Master PRD at `spec/product/Broader-feature-product.md`. Retrieval index and `spec/product/features/README.md` coherent. Canonical master vision at `spec/vision-application/The_Inevitable_Master_Vision.md`.

**Phase 1E — product-cognition bridge (reviewed + strengthened 2026-06-03)**
`@inevitable/product-cognition` provides: F01/F13 onboarding (identity/envelope/leases/world-state/memory/events), F02/F03 learning-path projection (Kahn's pre-validation before world-state mutation — C1 fix), F06 MVP agent manifests (7 agents, schema-valid), F14 mastery checkpoints, `ProductRuntimeDispatcher` + `DeterministicMvpUnit` (scheduler-admitted dispatch, C2 canonical packet IDs, S2 recovery from quarantine), `DeterministicLearningLoop` (first no-LLM explanation→practice→mastery cycle, S3 loop observability events).

---

## 4. ACTIVE WORK

**Supervisor-routed agent flow** — MEDIUM confidence (spec authored, implementation not started)

The next implementation target. `DeterministicLearningLoop` currently dispatches to hardcoded explanation/practice agents. The architecture requires a `SupervisorUnit` that reads learner world-state (mastery nodes, active concept, session intent) and routes CognitionPackets to the correct specialist. No code written yet.

**Packet-level OTel trace capture** — MEDIUM confidence (seam identified, not wired)

`ProductRuntimeDispatcher.dispatch()` already propagates `trace_id`/`span_id` in packets. The span creation call (`@inevitable/observability`) is not yet wired around `host.handle()`. The `@opentelemetry/api` dep is already present.

**ExecutionEngine fiber dispatch** — LOW confidence (design only)

Plan: express multi-step cognitive sequences (plan→explain→practice→assess→route) as deterministic `FiberRoutine`s in the `ExecutionEngine` rather than imperative async/await. Gives a D2-replayable execution journal. Not started.

---

## 5. ARCHITECTURAL MEMORY

**Decision:** Heavy infrastructure clients are never workspace dependencies.
**Reason:** `pnpm verify` must pass offline; CI must not require live NATS/Postgres/Qdrant/Neo4j.
**Tradeoffs:** Adapter loading is slightly more complex (guarded dynamic import + `E_ADAPTER_UNAVAILABLE`). Type inference across the adapter boundary requires local interface narrowing.
**Alternatives rejected:** Optional peer deps (still pulled in by some package managers), conditional workspace deps (breaks lockfile determinism).

---

**Decision:** JSON Schema Draft 2020-12 is the canonical contract form; TypeScript types are generated from schemas, not authored directly.
**Reason:** Protocol contracts must be language-neutral so Python/Rust cognitive units can plug in. TypeScript types from `pnpm codegen` are git-ignored under `src/generated/`.
**Tradeoffs:** `pnpm codegen` must run before typecheck; a forgotten codegen step fails type checks in a confusing way.
**Alternatives rejected:** TypeScript-first with zod inference (couples contract to TS runtime), protobuf (heavy toolchain, not web-friendly).

---

**Decision:** World-state mutations are pre-validated with Kahn's topological sort before any delta is applied (C1 fix).
**Reason:** Partial world-state mutation on failure (orphaned nodes/edges) violates the atomicity invariant and makes graphs inconsistent. The fix: validate the full concept seed graph in memory first, then apply all deltas or none.
**Tradeoffs:** Slightly more CPU per projection. Graph must be representable in memory for validation pass.
**Alternatives rejected:** Two-phase commit with rollback (more complex, rollback is itself a mutation), optimistic apply + compensating deltas (violates no-orphaned-state invariant).

---

**Decision:** `ProductRuntimeDispatcher` resets `activated = false` on unit execution failure (S2 fix).
**Reason:** A failing unit transitions `CognitiveUnitHost` to Quarantined state. Without the reset, the next dispatch calls `host.handle()` on a Quarantined host → throws → deadlocks the dispatcher permanently.
**Tradeoffs:** Re-activation on every retry has a small overhead; the unit lifecycle FSM must tolerate re-activation from Registered.
**Alternatives rejected:** Exposing host state externally (breaks encapsulation), creating a new host on each dispatch (loses checkpoint state).

---

**Decision:** `DeterministicLearningLoop` emits `learning.loop.started` / `learning.loop.completed` events (S3 fix).
**Reason:** Without observable boundaries, the loop is invisible to replay, tracing, and the governance kernel. OTel traces and execution journal entries cannot establish causality across a loop that emits nothing.
**Tradeoffs:** Loop requires bus + clock + idGenerator injection (slightly heavier constructor).
**Alternatives rejected:** Logging only (not observable to replay), span-only tracing (not part of the event-sourced COS event log).

---

**Decision:** OTel API only in libraries; SDK registered once at `services/data-plane` edge.
**Reason:** Libraries that register their own SDK compete with each other and with the host process. No-op tracer means library instrumentation is always safe even without an SDK.
**Tradeoffs:** Traces appear only when the data-plane service is running. Tests run against no-op tracer by default.
**Alternatives rejected:** SDK in each package (SDK conflicts, import duplication), manual span creation (no standardization).

---

## 6. OPEN PROBLEMS

**Problem:** `DeterministicLearningLoop` has no real LLM — it uses `DeterministicMvpUnit` which returns a canned response.
**Impact:** The explanation and practice "content" in packets is structurally correct but semantically empty. The loop cannot adapt to learner needs until a real model adapter is wired.
**Possible causes:** Design choice — Phase 1E is explicitly no-LLM to prove substrate correctness first.
**Recommended investigation:** When adding model calls, the adapter `resolve()` seam in `ExecutionEngine` is where D3 model-output recording hooks in. See `spec/replay/deterministic-replay.md` D3 level.

---

**Problem:** `SupervisorUnit` does not exist. All routing is hardcoded in `DeterministicLearningLoop`.
**Impact:** The platform cannot select agents based on learner state. Every session runs the same explanation→practice sequence regardless of mastery, concept gaps, or risk class.
**Possible causes:** Not yet implemented.
**Recommended investigation:** Read `spec/agents/` and `spec/product/features/F06.md` before implementing. The supervisor reads world-state mastery nodes for the focus concept and routes based on `passed`/`confidence` thresholds.

---

**Problem:** No packet-level OTel spans in `ProductRuntimeDispatcher`.
**Impact:** Distributed traces cannot correlate learner session → scheduler admission → agent execution. The `trace_id`/`span_id` in packets are generated but never linked to OTel spans.
**Possible causes:** Not yet wired (S3 fixed loop boundary events; dispatcher span creation is the next step).
**Recommended investigation:** `withSpan()` in `@inevitable/observability`; create a parent span in `dispatch()` using `packet.trace_id` as the remote context.

---

## 7. IMMEDIATE NEXT STEPS

1. **Spec first:** Update `spec/product/product-cognition-runtime.md` to define `SupervisorUnit` routing contract — intent→agent mapping, learner-state read pattern, routing decision event.
2. **Implement `SupervisorUnit`** in `packages/product-cognition/src/supervisor.ts`: reads world-state mastery nodes for the focus concept; emits a `supervisor.route` decision event; selects target agent CID. Extend `ProductRuntimeAgentId` routing table.
3. **Wire `SupervisorUnit` into `DeterministicLearningLoop`**: replace hardcoded explanation/practice pair with a supervisor-routed dispatch step.
4. **Add packet-level OTel span creation** in `ProductRuntimeDispatcher.dispatch()`: call `withSpan(packet.trace_id, ...)` from `@inevitable/observability` around `host.handle()`; attach `cos.packet_id`, `cos.agent_id`, `cos.intent`, `cos.concept_ids` as span attributes.
5. **Test `SupervisorUnit` routing**: 3 cases — concept not mastered → routes to explanation; explanation complete but practice not done → routes to practice; both done → routes to assessment. Assert `supervisor.route` events in bus log.
6. **Test dispatcher OTel spans**: mock tracer; assert span is created with correct trace_id correlation; assert span ends on both success and failure paths.
7. **`pnpm verify`** — confirm 18+/18 typecheck, all tests pass, lint clean.
8. **Update `IMPLEMENTATION.md`** — Phase 1E supervisor section.
9. **Update memory file** `the-inevitable-phase-status.md` — mark supervisor routing done when complete.
10. **ADR if needed**: if `ExecutionEngine` fiber wiring changes the dispatch contract meaningfully, write ADR-0006 before implementing.

---

## 8. KNOWN RISKS

**Dispatcher assumes single-agent per instance.** `ProductRuntimeDispatcher` wraps one `CognitiveUnitHost`. Multi-agent orchestration requires either multiple dispatcher instances or a refactor to host the full agent registry. This becomes load-bearing when `SupervisorUnit` needs to invoke sub-agents within a single dispatch cycle.

**`DeterministicMvpUnit` response content is structurally valid but semantically empty.** Tests pass because they check packet structure, not content quality. Any test that assumes semantic correctness of `content.response_kind = "deterministic-product-cognition"` will break when a real model adapter is substituted.

**Three commits ahead of `origin/master` — not pushed.** If the local machine is lost before a push, commits `3ab96bb`, `3e3206b`, `f6e307f` (containing all Phase 1D + 1E code) are unrecoverable from remote.

**`ExecutionEngine` not yet wired into product dispatch.** Multi-step cognitive workflows are expressed as imperative async/await chains. When fibers are introduced, the `FiberContext.spawn()` / `await()` semantics change the execution model non-trivially. This migration needs a spec update before touching code.

**No real infrastructure tests.** The conformance harness (`packages/adapters/src/conformance.ts`) tests canonical semantics against the in-memory reference adapter. No integration tests run against live NATS, Postgres, Qdrant, or Neo4j. Behavioral divergence will surface only when real adapters are provisioned.

---

## 9. CONTEXT REQUIRED FOR CONTINUATION — READ THESE FIRST

| File | Why |
|---|---|
| `IMPLEMENTATION.md` | Phase completion status and next-step description |
| `spec/product/Broader-feature-product.md` | Master PRD — every product capability maps onto COS primitives here |
| `spec/product/product-cognition-runtime.md` | Governing spec for `@inevitable/product-cognition` |
| `spec/product/features/F06.md` | Agent ecosystem — supervisor routing semantics |
| `spec/product/features/F07.md` | Real-time cognitive orchestration — governs multi-agent dispatch |
| `spec/execution/cognitive-execution-engine.md` | Fiber model, effect set, journal — needed before fiber dispatch |
| `spec/replay/deterministic-replay.md` | D0–D4 levels — needed before D3 model-output recording |
| `spec/architecture-decisions/ADR-0005-infrastructure-adapters.md` | Adapter pattern — required before touching any external client |
| `packages/product-cognition/src/runtime-dispatch.ts` | Active dispatcher — where OTel spans need to be wired |
| `packages/product-cognition/src/learning-loop.ts` | Active loop — where supervisor routing replaces hardcoded agents |
| `CLAUDE.md` | Project instructions — mandatory read-first spec order, doctrines |

---

## 10. AGENT STARTUP PROMPT

```
You are continuing work on The Inevitable — a spec-governed Cognitive Operating System (COS) for 
human learning. This is NOT a chat app. It is a deterministic, event-sourced cognitive runtime 
where agents, memory, orchestration, and learner state are governed kernel primitives.

CURRENT PHASE: Phase 1E — product-cognition bridge.

WHAT EXISTS:
- 16 packages + 1 service. All tests pass (18/18 suites), clean on master at commit f6e307f.
- @inevitable/product-cognition provides: onboarding (F01/F13), learning-path projection with 
  cycle-guard (F02/F03), 7 MVP agent manifests (F06), scheduler-admitted dispatch via 
  ProductRuntimeDispatcher + DeterministicMvpUnit, DeterministicLearningLoop 
  (explanation→practice→mastery cycle with loop boundary events).

WHAT IS MISSING (your immediate work):
1. SupervisorUnit — a CognitiveUnit that reads world-state mastery nodes for the focus concept 
   and emits a supervisor.route decision selecting the correct target agent.
2. Packet-level OTel span creation in ProductRuntimeDispatcher.dispatch() — use 
   withSpan() from @inevitable/observability, correlate using packet.trace_id/span_id.

CONSTRAINTS (non-negotiable):
- Spec-first: read and update spec/product/product-cognition-runtime.md BEFORE writing code.
- Never bypass the DepthScheduler, CognitiveUnitHost, or EventBus.
- No heavy client packages as workspace deps — use guarded dynamic import.
- pnpm verify must remain green (18+/18 typecheck, all tests, lint).
- Do not commit unless explicitly asked.
- Build: npm i -g pnpm@9.15.0 if turbo cannot find pnpm.

IMMEDIATE TASK:
1. Update spec/product/product-cognition-runtime.md with the SupervisorUnit routing contract.
2. Implement packages/product-cognition/src/supervisor.ts — SupervisorUnit class that reads 
   world-state mastery nodes and routes to: explanation (not mastered), practice (explanation 
   done), assessment (practice done), revision (assessment failed).
3. Add tests: 3 routing cases + assert supervisor.route event in bus log.
4. Run pnpm verify.

READ FIRST: IMPLEMENTATION.md, spec/product/Broader-feature-product.md, 
spec/product/product-cognition-runtime.md, spec/product/features/F06.md, CLAUDE.md.
```
