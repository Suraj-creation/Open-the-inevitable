# ADR-0027: Cognitive Evaluation Layer — Layer 2 Activation

**Status:** Accepted
**Date:** 2026-06-25
**Supersedes:** none
**Related:** [ADR-0021](ADR-0021-governed-self-evolution.md) (EvolutionEngine — evaluation gates
approve()), [ADR-0023](ADR-0023-emergent-cognitive-architecture.md) (Layer 2 direction),
[ADR-0026](ADR-0026-research-mode-and-readiness-gating.md) (reasoning traces from research agents),
`spec/architecture/Cognitive-Architecture.md` §2 Layer 2,
`spec/evaluation/cognitive-evaluation-architecture.md`,
`spec/implementation-roadmaps/cognitive-surface-maturity.md` (Phase S4)

## Context

The substrate produces rich reasoning evidence on every cycle: `ReasoningTrace` records attached
to each agent output, `DepthGateOutcome` with five verified tests, `MasteryCheckpoint` verdicts,
and research frontier records. But today **no system reads this evidence to say whether the
cognition itself was good** — only the learner's mastery outcome is measured.

Three disconnected fragments partially address this:
1. `ShadowEvaluator` (`@inevitable/orchestration`) — a deterministic placeholder used exclusively
   by `EvolutionEngine`; it approximates a pass-rate heuristic but never reads reasoning traces.
2. `CognitiveAnalysisEngine` (`@inevitable/observability`) — post-hoc drift/calibration/outcome
   observability over the event log; tells you *what happened*, not *whether it was good*.
3. `MasteryCheckpointRecorder` — per-learner verdicts; the gold signal for mastery, not for
   reasoning quality.

The activation trigger (Cognitive-Architecture.md Layer 2) has now been hit: `EvolutionEngine
.approve()` requires real evaluation evidence (not the placeholder shadow heuristic) before a
self-evolution proposal may be trusted with rollout. Simultaneously, S4 introduces educator mode
and twin analytics that need per-cycle reasoning quality as foldable surface state.

The decision: how to **unify the three fragments** into a governed Cognitive Evaluation Layer that
produces replayable, scored verdicts from existing evidence — without new infrastructure.

## Decision

### 1. A new `@inevitable/evaluation` package implements the Cognitive Evaluation Layer

The package contains:
- `CognitiveEvaluationEngine` — the primary API; consumes reasoning traces + mastery checkpoints
  + depth gate records; scores them against registered scorecards; emits `evaluation.*` events.
- `ReasoningScorecard` — an interface (= a cognitive unit ABI extension) that converts a
  `ReasoningTrace` into a `ScorecardVerdict` with a `score` (0–1), `passed` flag, and
  `dimension_scores`.
- `ExplanationScorecard` — concrete scorecard for explanation reasoning traces; applies UALRCI's
  five-test rubric (Explanation, Application, Connection, Teaching, Edge Case) reading from the
  already-recorded `DepthGateOutcome`.
- `ResearchScorecard` — concrete scorecard for research frontier traces; measures frontier
  novelty, gap specificity, hypothesis seedability, and source quality.
- `EvaluationRecord` — the foldable result persisted in `SurfaceState`:
  `{ concept_id, scorecard_id, score, passed, dimension_scores, hlc }`.
- `BenchmarkRunner` — replays a recorded surface session (D0: the event log is deterministic)
  and accumulates `EvaluationRecord[]` for regression tracking.

### 2. Evaluation is pure, deterministic, and replayable

Scoring a `ReasoningTrace` is a **pure function** — no model calls, no side effects, no I/O.
The `ReasoningTrace` carries all necessary fields (`determinism_level`, `strategy`, `claims`,
`uncertainty_estimate`, `decision`), so scoring is D1 (deterministic, algorithm-derived).
`BenchmarkRunner` output is D0 (given the same event log, produces the identical score vector).

This is the critical property: evaluation runs can serve as regression baselines without flakiness.

### 3. `ShadowEvaluator` is replaced by `CognitiveEvaluationEngine` in `EvolutionEngine.approve()`

`EvolutionEngine.approve()` (ADR-0021) accepts an injected `guard` callback and currently uses
a placeholder heuristic (`overallPassRate >= 0.6`). In S4.2, the composition root injects a real
guard backed by `CognitiveEvaluationEngine`:
- The guard evaluates the synthetic learner sessions from `EvolutionEngine.evaluate()` through
  the registered scorecards.
- If `scorecard.overall_score < EVALUATION_PASS_THRESHOLD (0.7)`, the guard returns `false`
  and `approve()` returns an error — the proposal cannot roll out.
- The `ShadowEvaluator` class is NOT deleted (backward-compat); it is deprecated in its docstring
  and the `EvolutionEngine` documentation now recommends the evaluation-backed guard.

### 4. `EvaluationRecord` is foldable in `SurfaceState`

A new `evaluation_records: readonly EvaluationRecord[]` field is added to `SurfaceState`. After
each cycle, `SurfaceSession.ask()` emits `evaluation.reasoning.completed` events for any
agent output whose `ReasoningTrace` is present. These events fold into `evaluation_records`,
making per-cycle reasoning quality visible to educator mode and twin analytics without any new
query path.

### 5. `evaluation.*` event subfamily — additive and replayable

New events (permanent retention, replayable, internal classification):
- `evaluation.reasoning.completed` — emitted after each cycle's scoring; payload: `{ surface_id,
  concept_id, scorecard_id, score, passed, dimension_scores }`.
- `evaluation.benchmark.run` — emitted when a `BenchmarkRunner` completes a full session replay;
  payload: `{ session_id, record_count, overall_score }`.

These events are always emitted **after** the primary surface events for the same cycle, so
existing fold ordering is unchanged (D3: surface events first, evaluation events trailing).

### 6. The `evaluation` family joins the event taxonomy as a permanent, replayable family

Same lifecycle contract as `evolution.*`: permanent retention, replayable, internal, owned by the
evaluation package. Producers: `CognitiveEvaluationEngine`, `BenchmarkRunner`. Consumers:
`EvolutionEngine` guard, educator-mode surface fold, twin analytics.

## Non-goals

- **New inference**: evaluation never invokes a model. All scoring is over existing evidence.
- **External evaluation services**: no third-party evaluation API. Evaluation is a substrate primitive.
- **Replacing `CognitiveAnalysisEngine`**: observability tells you *what happened*; evaluation tells
  you *whether it was good*. They remain complementary and independent.
- **Cognitive IR / self-improving architecture** (Layer 5): this is the foundation, not the apex.
- **Research scorecard completeness**: the `ResearchScorecard` shipped in S4.1 is an MVP version;
  a richer novelty/evidence/cross-domain rubric requires Layer 3 (Knowledge) and Layer 4 (Research)
  to be further developed.

## Consequences

- `@inevitable/evaluation` becomes the thirteenth non-service package in the monorepo.
- `EvolutionEngine.approve()` now requires a passing evaluation scorecard for any real rollout;
  the existing `ShadowEvaluator` path continues to work for tests that inject the old guard.
- `SurfaceState` gains `evaluation_records` (additive, backward-compatible fold).
- Educator mode (S4.3) can read `state.evaluation_records` to show learner reasoning quality
  without any additional query or API call.
- The `evaluation.*` event family is permanent and replayable — benchmark regressions are exact.
- The three disconnected evaluation fragments are now architecturally unified under one roof, with
  clear boundaries: `MasteryCheckpointRecorder` = learner verdict; `CognitiveAnalysisEngine` =
  observability/drift; `CognitiveEvaluationEngine` = reasoning quality scoring.

## Determinism levels

| Operation | Level | Reason |
|---|---|---|
| `ReasoningScorecard.score(trace)` | D1 | Pure function over recorded trace — algorithm only |
| `BenchmarkRunner.run(eventLog)` | D0 | Deterministic fold over a fixed event log |
| `evaluation.reasoning.completed` event | D3 | Emitted after primary surface events; replayable |
| `EvolutionEngine` guard via evaluation | D1 | Guard reads scorecard verdict — no model |
