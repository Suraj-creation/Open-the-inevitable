```yaml
spec:
  title: Cognitive Evaluation Architecture
  domain: evaluation
  status: draft
  owner: evaluation-team
  last_reviewed: 2026-06-25
  upstream_dependencies:
    - protocols/cognitive-unit-abi
    - protocols/reasoning-trace-protocol
    - protocols/cognitive-event-protocol
    - observability/cognitive-observability
    - world-state/mastery-checkpoints
  downstream_dependencies:
    - orchestration/governed-self-evolution
    - surface/cognitive-surface-runtime
    - surface/surface-event-architecture
  related_protocols:
    - cognitive-unit-abi
    - reasoning-trace-protocol
    - governance-decision-protocol
  related_governance_systems:
    - governance-kernel
    - evolution-engine
  semantic_tags: [evaluation, scorecard, reasoning-quality, benchmark, deterministic, layer-2]
  canonical_references:
    - spec/architecture/Cognitive-Architecture.md#layer-2
    - spec/architecture-decisions/ADR-0027-cognitive-evaluation-layer
    - ../architecture/uci-architecture.md
```

# Cognitive Evaluation Architecture

**Layer 2 of the Emergent Cognitive Layers** — *the layer that measures whether cognition is
actually getting better.*

## 1. Purpose and scope

This spec governs the `@inevitable/evaluation` package: its types, interfaces, scorecard protocol,
benchmark mechanism, event family, and integration contracts with `EvolutionEngine` and
`SurfaceSession`. It is the **deepening spec** for Layer 2 as named in
`spec/architecture/Cognitive-Architecture.md`.

Evaluation answers a question observability cannot: **"was that cognition good?"** Observability
records *what happened* (drift, calibration, outcome). Evaluation scores *whether it was good*
(reasoning quality, explanation depth, research novelty). The two are complementary, not competitive.

## 2. The three unified fragments

Before this spec, evaluation existed in three disconnected pieces:

| Fragment | Lives in | Role | Gap |
|---|---|---|---|
| `ShadowEvaluator` | `@inevitable/orchestration` | EvolutionEngine heuristic | Placeholder; never reads reasoning traces |
| `CognitiveAnalysisEngine` | `@inevitable/observability` | Drift/calibration/outcome post-hoc | Observability only; no quality scoring |
| `MasteryCheckpointRecorder` | `@inevitable/product-cognition` | Per-learner mastery verdicts | Learner signal; not reasoning-quality signal |

This spec unifies them under a single architecture: `CognitiveEvaluationEngine` is the new primary
evaluator; the others remain in their packages with updated docstrings declaring their narrow roles.

## 3. Core types

### 3.1 `ScorecardDimension`

```typescript
interface ScorecardDimension {
  readonly name: string;         // e.g. "explanation", "application", "novelty"
  readonly score: number;        // 0.0–1.0
  readonly passed: boolean;
  readonly evidence: string;     // one sentence of justification
}
```

### 3.2 `ScorecardVerdict`

```typescript
interface ScorecardVerdict {
  readonly scorecard_id: string;
  readonly concept_id: string;
  readonly score: number;              // 0.0–1.0 weighted average of dimension_scores
  readonly passed: boolean;            // score >= scorecard.pass_threshold
  readonly dimension_scores: readonly ScorecardDimension[];
  readonly strategy: string;           // mirrors ReasoningTrace.strategy
  readonly determinism_level: "D0" | "D1";
}
```

### 3.3 `EvaluationRecord`

The foldable surface state type:

```typescript
interface EvaluationRecord {
  readonly concept_id: string;
  readonly scorecard_id: string;
  readonly score: number;
  readonly passed: boolean;
  readonly dimension_scores: readonly ScorecardDimension[];
  readonly hlc: string;
}
```

### 3.4 `ReasoningScorecard` (interface)

```typescript
interface ReasoningScorecard {
  readonly scorecard_id: string;
  readonly pass_threshold: number;
  /** Pure function — no I/O, no model calls. Determinism level D1. */
  score(trace: ReasoningTrace, context: ScorecardContext): ScorecardVerdict;
}

interface ScorecardContext {
  readonly concept_id: string;
  readonly depthGate?: DepthGateOutcome;   // present for explanation scorecards
  readonly masteryConfidence?: number;
}
```

## 4. Concrete scorecards

### 4.1 `ExplanationScorecard` (`scorecard_id: "explanation-v1"`)

Scores explanation reasoning traces using the UALRCI five-test rubric. Reads the already-recorded
`DepthGateOutcome` from the surface cycle.

| Dimension | Source | Pass condition |
|---|---|---|
| `explanation` | `depthGate.tests.find(t => t.kind === "explanation")` | test.passed |
| `application` | `depthGate.tests.find(t => t.kind === "application")` | test.passed |
| `connection` | `depthGate.tests.find(t => t.kind === "connection")` | test.passed |
| `teaching` | `depthGate.tests.find(t => t.kind === "teaching")` | test.passed |
| `edge_case` | `depthGate.tests.find(t => t.kind === "edge_case")` | test.passed |

Score = `passed_count / total_count` (0–1). Pass threshold: 0.6 (3 of 5 tests).

When no `depthGate` is present, falls back to `masteryConfidence` as a single-dimension proxy
(score = confidence, pass threshold = 0.6). This preserves backward-compatibility with cycles that
predate five-test depth verification.

### 4.2 `ResearchScorecard` (`scorecard_id: "research-v1"`)

Scores research frontier reasoning traces (`strategy === "frontier-mapping"`).

| Dimension | Heuristic | Pass condition |
|---|---|---|
| `frontier_specificity` | frontier length > 40 chars && not generic template | length > 40 |
| `gap_clarity` | gap not empty && gap differs from frontier | present && distinct |
| `hypothesis_seedability` | hypothesis starts with "Could" or "What if" | prefix match |
| `source_actionability` | source_note references domain or literature | non-empty |

Score = `passed_dimensions / 4`. Pass threshold: 0.5 (2 of 4 dimensions).

**MVP note:** This scorecard is heuristic-only. A richer rubric (novelty against the KG, cross-
domain synthesis score, peer comparison) requires Layer 3 (Knowledge) and Layer 4 (Research) and
will be delivered in a future phase.

## 5. `CognitiveEvaluationEngine`

```typescript
class CognitiveEvaluationEngine {
  constructor(deps: {
    bus: EventBus;
    scorecards?: ReadonlyMap<string, ReasoningScorecard>;
    clock?: Clock;
    idGenerator?: IdGenerator;
  })

  /**
   * Score a reasoning trace from a surface cycle. Pure, D1.
   * Emits `evaluation.reasoning.completed` to the bus.
   */
  async evaluate(
    surfaceId: string,
    context: ScorecardContext,
    trace: ReasoningTrace,
  ): Promise<ScorecardVerdict>

  /**
   * Evaluate all traces from a full event-log replay (BenchmarkRunner path). D0.
   * Emits `evaluation.benchmark.run`.
   */
  async benchmark(
    sessionId: string,
    events: readonly CognitiveEvent[],
    scorecardId: string,
  ): Promise<readonly ScorecardVerdict[]>
}
```

The default scorecard registry contains `ExplanationScorecard` and `ResearchScorecard`. Additional
scorecards are registered at construction time by the composition root.

## 6. `BenchmarkRunner`

Replays a recorded surface session deterministically (D0):

1. Accepts an `events: readonly CognitiveEvent[]` (the event log from `bus.replay()`).
2. Extracts all `surface.reasoning.recorded` events — each carries a `ReasoningTrace` in its
   payload.
3. For each trace, calls `CognitiveEvaluationEngine.evaluate()` with the matching depth-gate
   context (extracted from `surface.depth_gate.recorded` events by `concept_id`).
4. Returns `readonly ScorecardVerdict[]` — one per trace found.
5. Emits `evaluation.benchmark.run` with the aggregate score.

Because the event log is deterministic (D0) and scoring is a pure function (D1), benchmark output
is reproducible byte-for-byte.

## 7. Integration: `EvolutionEngine.approve()` guard

The composition root (e.g., `apps/cli/src/wiring.ts`) provides `EvolutionEngine` with a guard
backed by `CognitiveEvaluationEngine`:

```typescript
const evaluationGuard = async (proposal: EvolutionProposal): Promise<boolean> => {
  // The engine's shadow evaluation already produced synthetic learner sessions.
  // Evaluate the reasoning traces from those sessions.
  const traces = proposal.shadowResults.flatMap(r => r.reasoningTraces ?? []);
  if (traces.length === 0) return proposal.evaluation.overallPassRate >= 0.6; // legacy fallback
  const verdicts = await Promise.all(
    traces.map(t => evaluationEngine.evaluate(proposal.id, { concept_id: t.concept_id }, t))
  );
  const avgScore = verdicts.reduce((s, v) => s + v.score, 0) / verdicts.length;
  return avgScore >= EVALUATION_PASS_THRESHOLD; // 0.7
};
```

`EVALUATION_PASS_THRESHOLD = 0.7`: above the mastery threshold (0.6), below perfection.

## 8. Integration: `SurfaceState` fold

`SurfaceSession.ask()` evaluates the cycle's reasoning trace after the primary blocks are
contributed (step 10, after S3.3 motivation step 9):

```
10. Evaluate cycle reasoning (S4.2, ADR-0027):
    - If cycle has a ReasoningTrace, call evaluationEngine.evaluate().
    - Emit evaluation.reasoning.completed.
    - Fold into evaluation_records.
```

The fold case in `foldSurfaceEvents`:

```typescript
case "evaluation.reasoning.completed": {
  state.evaluation_records.push({
    concept_id: payload["concept_id"] as string,
    scorecard_id: payload["scorecard_id"] as string,
    score: payload["score"] as number,
    passed: payload["passed"] as boolean,
    dimension_scores: (payload["dimension_scores"] ?? []) as ScorecardDimension[],
    hlc: event.hlc,
  });
  break;
}
```

## 9. Event family: `evaluation.*`

| Event | Trigger | Payload |
|---|---|---|
| `evaluation.reasoning.completed` | Per-cycle, after primary surface events | `{ surface_id, concept_id, scorecard_id, score, passed, dimension_scores }` |
| `evaluation.benchmark.run` | After `BenchmarkRunner.run()` completes | `{ session_id, scorecard_id, record_count, overall_score }` |

Retention: permanent. Replay: replayable. Classification: internal.
Ordering law: always emitted **after** all `surface.*` events for the same cycle.

## 10. Observability contract

`CognitiveEvaluationEngine` emits evaluation events to the bus on every `evaluate()` call. These
events are queryable via `bus.replay({ subject: "evaluation.>" })` and serve as the regression
baseline for benchmark runs.

## 11. Non-goals

- No model calls in evaluation — D1 only.
- No new store — events are the record.
- No replacement of `CognitiveAnalysisEngine` or `MasteryCheckpointRecorder`.
- No novelty scoring that requires cross-KG comparison (Layer 3 dependency — future phase).
