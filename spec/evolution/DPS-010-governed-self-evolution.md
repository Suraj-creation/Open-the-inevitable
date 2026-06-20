```yaml
spec:
  id: DPS-010
  title: Governed Self-Evolution
  domain: evolution
  status: active
  owner: evolution-engine
  last_reviewed: 2026-06-20
  upstream_dependencies:
    - kernel/governance-kernel
    - observability/cognitive-observability (DPS-007)
    - orchestration/DPS-008-proposal-blackboard
    - persistence/DPS-009-digital-twin
    - persistence/DPS-004-shared-learner-cognition
  downstream_dependencies:
    - product/product-cognition-runtime
  related_protocols:
    - cognitive-event-protocol
    - governance-decision-protocol
  related_events:
    - evolution.proposal.created
    - evolution.experiment.started
    - evolution.shadow_result.recorded
    - evolution.rollout.completed
    - evolution.rollback.completed
  related_runtime_systems:
    - universal-cognitive-bus
    - governance-kernel
    - cognitive-analysis-engine
  related_governance_systems:
    - governance-kernel (guard at approve)
  related_observability_systems:
    - cognitive-observability (DPS-007 signals consumed by shadow evaluator)
  semantic_tags:
    - evolution
    - self-improvement
    - shadow-testing
    - synthetic-learners
    - governance
    - rollout
    - rollback
  non_goals:
    - Real model invocations during shadow testing (P6.1 is deterministic simulation)
    - Durable proposal persistence across restarts (P6.2+)
    - Replay-based evaluation over historical events (P6.2+)
    - Multi-agent consensus on proposals (deferred)
    - Applying rolled-out proposals to the runtime configuration (P6.2+)
```

# DPS-010 — Governed Self-Evolution

## Purpose

Define the governed lifecycle for pedagogical evolution proposals: how the COS proposes a change to
its own teaching strategy, validates it against synthetic learners, receives governance approval, and
is rolled out or rolled back — all in a replayable, auditable manner.

This is the capstone invariant: *a system that improves its own pedagogy through governed evolution.*

Self-evolution without governance is reckless mutation. This spec makes every evolutionary change a
first-class governed artifact with a deterministic shadow-test signal, a mandatory approval gate, and
reversibility by design.

## Concepts

### EvolutionProposal

A typed, lifecycle-tracked artifact that captures a proposed change to pedagogy:

- `proposalId` — stable, globally unique identifier (format: `evol-<hex12>`)
- `kind` — the nature of the proposed change (see `ProposalKind`)
- `description` — human-readable summary of the proposed change
- `configuration` — the change parameters (kind-dependent)
- `createdAt` — HLC timestamp of proposal creation
- `status` — current position in the lifecycle FSM (see below)
- `evaluationResult` — populated after `evaluate()` completes
- Timestamps for `approvedAt`, `rolledOutAt`, `rolledBackAt`

### ProposalKind

- `depth_adjustment` — change the target explanation depth (F04 layers); configuration carries `targetDepthDelta`
- `strategy_shift` — change the teaching strategy (e.g., example-first vs. principle-first); configuration carries `strategyParameters`
- `curriculum_reorder` — change the ordering weight of concepts in the curriculum scheduler

### ProposalStatus FSM

```
proposed ──evaluate()──► evaluated ──approve()──► approved ──rollout()──► rolled_out
                                                      │                       │
                                               rollback()               rollback()
                                                      │                       │
                                                      ▼                       ▼
                                                 rolled_back            rolled_back
```

- `proposed`: minted by `propose()`; awaiting evaluation
- `evaluated`: shadow tests complete; carries `evaluationResult` with a deterministic `recommendation`
- `approved`: passed the governance gate at `approve()`; ready for rollout
- `rolled_out`: applied; live (emits `evolution.rollout.completed`)
- `rolled_back`: reverted; data preserved for audit (idempotent terminal state)

**Invalid transitions throw.** Each state transition emits the appropriate `evolution.*` event.
`rolled_back` is a terminal state; any action after rollback throws.

### SyntheticLearnerSeed

A pre-defined, deterministic learner state used for shadow testing — not a real learner:

- `learnerId` — always prefixed `synthetic-`; never resolves to a real `LearnerRegistry` entry
- `masteryMap` — known mastery state (`conceptId → { level, confidence }`)
- `goals` — target concepts the synthetic learner is working toward

### ShadowEvaluator

The shadow evaluator runs deterministic simulations of learning episodes under the proposed
configuration against each `SyntheticLearnerSeed`. It does not invoke a model. It projects the
expected outcome metrics from the proposal configuration and the synthetic learner's current state:

- `simulatedPassRate` — projected concept pass rate under the new strategy
- `confidenceDelta` — projected confidence change
- `driftDetected` — whether the projection indicates instability

The `overallPassRate` is the mean across all synthetic learners. The `recommendation` is `"approve"`
if `overallPassRate >= 0.6`, else `"reject"`.

**Why deterministic?** Shadow testing must be reproducible. Determinism also means the test suite
runs fully offline, consistent with ADR-0005 (guarded optional model access).

### EvaluationResult

- `proposalId`
- `evaluatedAt` — HLC timestamp
- `shadowResults` — one `ShadowResult` per synthetic learner
- `overallPassRate` — mean simulated pass rate
- `recommendation` — `"approve"` | `"reject"`

## EvolutionEngine API

```
EvolutionEngine
  .propose(params: ProposeParams): EvolutionProposal
      → mints proposal; emits evolution.proposal.created
  .evaluate(proposalId): EvaluationResult
      → throws if not "proposed"
      → runs ShadowEvaluator per synthetic learner; emits evolution.experiment.started then
        evolution.shadow_result.recorded per learner; sets status to "evaluated"
  .approve(proposalId): EvolutionProposal
      → throws if not "evaluated"
      → throws if evaluationResult.recommendation === "reject"
      → calls injected guard("evolution.approve") → throws if false (governance blocked)
      → sets status to "approved"; emits evolution.rollout.completed (approval marker)
  .rollout(proposalId): EvolutionProposal
      → throws if not "approved"
      → sets status to "rolled_out"; emits evolution.rollout.completed
  .rollback(proposalId): EvolutionProposal
      → valid from "approved" or "rolled_out" only; idempotent from "rolled_back"
      → throws if in "proposed" or "evaluated" state
      → sets status to "rolled_back"; emits evolution.rollback.completed (only on first call)
      → data (proposal, evaluation result) preserved for audit
  .get(proposalId): EvolutionProposal | undefined
  .list(): readonly EvolutionProposal[]
```

### EvolutionEngineOptions

```
EvolutionEngineOptions
  clock?: Clock            — defaults to SystemClock
  idGenerator?: IdGenerator — defaults to CryptoIdGenerator
  publish?:                — callback wrapping createEvent + bus.publish (same pattern as
    (eventType: string,      CognitiveAnalysisEngine / TwinRegistry)
     payload: Record<string, unknown>) => void
  guard?:                  — governance gate; returns true = allowed; defaults to () => true
    (action: string) => boolean
```

**No hard dependency on `@inevitable/events` or `@inevitable/governance`.** Callers inject both
behaviors via callbacks (consistent with ADR-0017 D1 and ADR-0020 D1).

## Events Emitted

All events use the `evolution.*` family (permanent, replayable per the event taxonomy):

| Event type | Trigger | Key payload fields |
|---|---|---|
| `evolution.proposal.created` | `propose()` | `proposal_id`, `kind`, `description`, `status` |
| `evolution.experiment.started` | `evaluate()` (once) | `proposal_id`, `synthetic_learner_count` |
| `evolution.shadow_result.recorded` | `evaluate()` (per learner) | `proposal_id`, `learner_id`, `simulated_pass_rate`, `confidence_delta`, `drift_detected` |
| `evolution.rollout.completed` | `rollout()` | `proposal_id`, `status: "rolled_out"` |
| `evolution.rollback.completed` | `rollback()` (first call) | `proposal_id`, `status: "rolled_back"` |

Note: `evolution.rollback.completed` is additive to the taxonomy (see ADR-0021 D5).

## Governance Integration

The governance gate is injected as an optional `guard` callback in `EvolutionEngineOptions`.
The composition root (wiring.ts) wraps the real `@inevitable/governance` `guard()` call. The
engine itself has no hard dep on the governance package.

`approve()` calls `guard("evolution.approve")`. If the callback returns `false`, `approve()` throws
`CosError("E_GOVERNANCE_BLOCKED", "evolution approve blocked by governance")`.

## Observability

- `evolution.*` events are the primary audit trail — every state transition is observable
- `EvaluationResult` (including per-learner `ShadowResult` array) is carried in the payload of
  `evolution.shadow_result.recorded` events for downstream analysis
- `CognitiveAnalysisEngine` outcome signals (DPS-007) are the intended *inputs* to future
  evaluation rounds once real session history is replayed (P6.2+)

## Testing and Validation

- **Unit:** proposal FSM transitions; shadow evaluator determinism; event payloads; error cases
- **Contract:** governance guard integration (injected callback)
- **Replay:** `evolution.*` events are replayable; proposal state is reconstructible from event log
- **Failure:** invalid transitions throw with typed `CosError`; governance block throws; rollback
  from invalid state throws

## Non-Goals (P6.1)

- Applying the rolled-out configuration to the live runtime (proposal state is advisory in P6.1)
- Real model invocations in shadow testing
- Durable persistence of proposals across restarts
- Replay-based evaluation over actual recorded session history
- Multi-agent proposal consensus
