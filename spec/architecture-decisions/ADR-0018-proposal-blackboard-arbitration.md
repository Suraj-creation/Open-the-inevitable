# ADR-0018 — Proposal Blackboard Arbitration (P4.1)

**Status:** accepted
**Date:** 2026-06-20
**Phase:** P4.1

---

## Context

The FiberedLearningLoop runs a single agent dispatch per concept phase (explanation or practice). F07
(Real-Time Cognitive Orchestration) requires multiple agents to visibly contend: write proposals,
detect disagreement, arbitrate, and expose the conflict on the cognitive surface as
`surface.agent.disagreed`.

The InMemoryBlackboard (Phase 1C) provides versioned key-value storage. P4.1 wraps it with a typed
proposal lifecycle (propose/arbitrate) and wires a concurrent parallel dispatch in the fiber bridge
handler.

---

## Decisions

### D1 — ProposalBlackboard wraps InMemoryBlackboard

A new class `ProposalBlackboard` in `packages/orchestration/src/proposals.ts` wraps
`InMemoryBlackboard` and adds typed APIs:
- `propose(key, agentCid, value)` — appends a proposal to the key's list
- `proposals(key)` — returns all proposals for a key
- `arbitrate(key, winnerCid, reason)` — records an arbitration result
- `arbitrations()` — returns all arbitrations (append-only, audit-friendly)

**Why:** The raw blackboard stores one value per key; proposals are multi-valued (N agents per
concept). A typed wrapper keeps the arbitration record separate and replayable without modifying the
base blackboard contract.

### D2 — Parallel dispatch in the bridge handler, not the fiber routine

The explanation and challenger dispatches run concurrently via `Promise.all` inside `handleDispatch`,
not inside the fiber routine itself. The fiber emits a single `learning.fiber.dispatch.requested` for
the explanation phase; the bridge handler is where the split happens.

**Why:** Fiber routines must be synchronous and pure (D2 byte-identical journals). Async fan-out
belongs in the bridge layer (the async side of the emit/await/resolve protocol). This preserves
D2 replayability — the journal records only the explanation result, not the concurrent probe.

### D3 — Challenger is the `revision` agent (existing manifest)

The challenger dispatcher targets `agent.revision` — an existing manifest with a different
pedagogical perspective (critique and re-frame vs. intuitive build-up). No new manifest is needed
for P4.1.

**Why:** Reuse over invention. The revision agent already has its own governance policies and model
prompt. A distinct manifest (e.g. `agent.challenger`) belongs in a future phase when a dedicated
adversarial agent is specified.

### D4 — Disagreement = Jaccard similarity < 0.3 on layer_0 text

Word-set Jaccard similarity on the `layer_0` (intuition) text of each response. If similarity < 0.3
(less than 30% word overlap), the outputs disagree. When either agent's `layer_0` is absent, no
disagreement is declared.

**Why:** Jaccard on the most accessible layer (layer_0) is a fast, vendor-independent proxy for
semantic divergence. It catches fundamentally different explanations without a second model call. A
future P6 signal can replace this with a dedicated judge agent.

### D5 — `surface.agent.disagreed` is emitted by the fiber bridge handler via a class-level HLC

The `FiberedLearningLoop` maintains a private `orchestrationHlc` (separate from the run-scoped HLC)
for events emitted from the bridge layer. It uses `createEvent` directly and publishes to
`this.deps.bus`.

**Why:** Bridge-layer events (emitted after async dispatch, outside the fiber journal) need their
own HLC to avoid interleaving with the fiber's run-scoped HLC. The class-level HLC is reset at each
`run()` call by a new `hlcInit`.

**Why not thread makeEvent:** `makeEvent` is a closure over the run-scoped HLC ref, which is local
to `run()`. Passing it into the bridge handler would require a mutable field anyway; a dedicated
`orchestrationHlc` is cleaner.

### D6 — `surfaceId` is threaded through `FiberedLearningLoopInput`

`FiberedLearningLoopInput` gains an optional `surfaceId?: string`. When present, the
`surface.agent.disagreed` payload includes `surface_id` so the surface fold picks it up. When
absent (e.g. CLI demo without a SurfaceSession), the event is on the bus but matches no fold.

**Why:** The fiber loop operates at the product-cognition layer, below the surface. It does not
hold a surface reference. Threading the `surfaceId` as an input field keeps the dependency
direction correct (substrate → manifestation is forbidden; manifestation passes its ID to the
substrate, not the other way around).

---

## Consequences

- `FiberedLearningLoopDeps` gains `challengerDispatcher?: ProductRuntimeDispatcher` and
  `proposals?: ProposalBlackboard` (both optional; zero impact on existing callers).
- `FiberedLearningLoopInput` gains `surfaceId?: string` (optional).
- `SurfaceSession.ask()` passes `surfaceId: this.surfaceId!` to `loop.run()`.
- `SurfaceState` gains `disagreements: readonly DisagreementRecord[]`.
- `foldSurfaceEvents` handles `surface.agent.disagreed`.
- `apps/cli/src/wiring.ts` exposes `proposals: ProposalBlackboard` in `DemoFixture` and wires a
  challenger dispatcher (revision agent) + the blackboard into the fiber loop.
- No existing tests break (all new deps are optional).
