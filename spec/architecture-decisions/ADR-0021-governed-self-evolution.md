# ADR-0021 — Governed Self-Evolution Architecture

**Status:** Accepted  
**Date:** 2026-06-20  
**Spec:** `spec/evolution/DPS-010-governed-self-evolution.md`  
**Replaces:** n/a  
**Related:** ADR-0017 (CognitiveAnalysisEngine publish callback), ADR-0018 (ProposalBlackboard),
ADR-0019 (ToolRuntime), ADR-0020 (TwinRegistry)

## Context

P6 adds the capstone invariant: *governed self-evolution.* The system must be able to propose
pedagogical changes, shadow-test them against synthetic learners, pass a governance gate, and
execute a reversible rollout — all replayably and auditably.

Six design decisions must be locked before implementation to preserve architectural integrity.

---

## D1: EvolutionEngine lives in `@inevitable/orchestration`

**Decision:** Add `EvolutionEngine` to `packages/orchestration/src/evolution.ts`, exported from
`packages/orchestration/src/index.ts`.

**Rationale:** Evolution proposals are an orchestration concern — they govern *how agents are
directed* going forward, sitting above the execution layer and alongside `ProposalBlackboard` (which
governs per-session agent arbitration). This mirrors the natural grouping: orchestration is where
the COS decides how to coordinate its own cognitive effort, both within a session (blackboard) and
across sessions (evolution engine).

Alternative considered: a separate `@inevitable/evolution` package. Rejected — the surface area does
not justify the package overhead; `@inevitable/orchestration` already has the orchestration
primitives and is a natural home.

---

## D2: Shadow testing is deterministic (no model calls; outcome projected from proposal + seed)

**Decision:** The `ShadowEvaluator` projects outcomes from the `ProposalConfiguration` and
`SyntheticLearnerSeed` using a deterministic formula — no model is invoked.

**Rationale:**
1. **Reproducibility**: shadow tests must yield the same result under replay. Any non-determinism
   (model temperature, network latency) breaks replay equivalence — a foundational invariant.
2. **Offline safety**: tests and CI must run fully offline (ADR-0005); model calls are guarded
   optional. Shadow testing without a model keeps verification green by default.
3. **Simplicity for P6.1**: the real value is the *lifecycle* (proposal → evaluate → approve →
   rollout/rollback) and its governance integration, not the sophistication of the simulation.
   Real replay-based evaluation over historical session events is deferred to P6.2+.

The projection formula:
- Base pass rate: `mean(masteryLevel) / 5` per synthetic learner (normalized 0→1; 0.4 floor if no mastery)
- `depth_adjustment`: `+ min(0.95, base + targetDepthDelta * 0.05)`; confidence delta `+ targetDepthDelta * 0.03`
- `strategy_shift`: `+ 0.1` pass rate; `+ 0.05` confidence delta
- `curriculum_reorder`: `+ 0.05` pass rate; `+ 0.02` confidence delta
- `driftDetected`: `simulatedPassRate < 0.4`
- `overallPassRate`: mean across all synthetic learners
- `recommendation`: `"approve"` if `overallPassRate >= 0.6`, else `"reject"`

---

## D3: Governance gate injected as a callback (no hard dep on `@inevitable/governance`)

**Decision:** `EvolutionEngineOptions.guard?: (action: string) => boolean` is the governance seam.
The engine calls it with `"evolution.approve"` in `approve()`. The composition root wires the real
`guard()` from `@inevitable/governance`.

**Rationale:** Consistent with ADR-0017 D1 (`CognitiveAnalysisEngine.publish` callback) and
ADR-0020 D1 (`TwinRegistry.publish` callback). Hard deps on sibling packages at the same substrate
layer violate the dependency direction principle (§2 law). The injected callback pattern keeps
`@inevitable/orchestration` free of a direct `@inevitable/governance` dep while still providing a
real governance seam.

Default behavior (`guard` not provided): `approve()` always proceeds — safe for unit tests and
offline environments. The seam is always tested by injecting a false-returning callback.

---

## D4: ProposalStatus FSM — transitions, idempotency, and data preservation

**Decision:**

```
proposed → evaluated → approved → rolled_out
                           └──────────────────► rolled_back (idempotent terminal)
```

- `propose()` → `"proposed"` (always)
- `evaluate()` → `"evaluated"` (throws if not `"proposed"`)
- `approve()` → `"approved"` (throws if not `"evaluated"` or recommendation is `"reject"` or guard returns false)
- `rollout()` → `"rolled_out"` (throws if not `"approved"`)
- `rollback()`:
  - From `"approved"` or `"rolled_out"`: transitions to `"rolled_back"`, emits `evolution.rollback.completed`
  - From `"rolled_back"`: idempotent — returns current state, no re-emit
  - From `"proposed"` or `"evaluated"`: throws (not a valid rollback source)
- Data (proposal + evaluation result + all timestamps) is preserved on `"rolled_back"` for audit

**Rationale:** Rollback from `"proposed"` or `"evaluated"` is semantically wrong — there is nothing
to roll back because nothing has been applied. Rollback from `"approved"` is valid because the
commitment has been made. Idempotency on terminal state mirrors the `TwinRegistry.terminate()`
design (ADR-0020 D4).

---

## D5: `evolution.rollback.completed` added to the event taxonomy

**Decision:** Add `evolution.rollback.completed` to the `evolution.*` family in
`spec/events/event-taxonomy.md` (the family row's examples field).

**Rationale:** The taxonomy row already includes `proposal.created, experiment.started,
shadow_result.recorded, rollout.completed`. Rollback is a first-class lifecycle transition that must
be observable and replayable — omitting it would create a silent state change (violating the
"no important cognitive action should happen silently" principle). Adding to the examples list is an
additive (MINOR) change per the taxonomy evolution strategy.

---

## D6: DemoFixture exposes `evolution: EvolutionEngine` + lifecycle helpers + default synthetic learners

**Decision:** `DemoFixture` in `apps/cli/src/wiring.ts` gains:

```typescript
readonly evolution: EvolutionEngine;
readonly proposeEvolution: (kind: ProposalKind, description: string, config: ProposalConfiguration) => EvolutionProposal;
readonly evaluateEvolution: (proposalId: string) => EvaluationResult;
readonly approveEvolution: (proposalId: string) => EvolutionProposal;
readonly rolloutEvolution: (proposalId: string) => EvolutionProposal;
readonly rollbackEvolution: (proposalId: string) => EvolutionProposal;
```

Three default `SyntheticLearnerSeed` entries (wired in `wiring.ts`) seed the evaluator with
plausible learner states covering zero-knowledge, intermediate, and advanced learner profiles.

**Rationale:** Consistent with the DemoFixture extension pattern established in ADR-0018 D6,
ADR-0019 D5, and ADR-0020 D6. The lifecycle helpers hide the `proposalId` threading from demo
callers. Default synthetic learners make `evaluate()` useful out of the box without requiring
callers to supply seeds.

The `EvolutionEngine` is wired with:
- The demo's shared `clock` and `idGenerator`
- A `publish` callback using `createEvent` + `bus.publish` + local HLC (same pattern as `TwinRegistry`)
- A `guard` callback wrapping `guard()` from `@inevitable/governance` with the demo's governance engine
