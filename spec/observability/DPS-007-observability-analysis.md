# DPS-007 — Cognitive Observability Analysis Engine

**Domain:** `observability`  
**Spec ID:** DPS-007  
**Status:** Accepted  
**Decision:** ADR-0017  
**Upstream specs:** `spec/observability/cognitive-observability.md`, `spec/protocols/reasoning-trace-protocol.md`  
**Downstream specs:** P6 self-evolution (consumes emitted signals)  
**Semantic tags:** `observability`, `drift`, `calibration`, `learning-outcomes`

---

## 1. Purpose

The Cognitive Observability Analysis Engine satisfies the §25.4 invariant:

> *Observability tracks reasoning quality, memory influence, drift, disagreement, confidence,
> and learning outcomes.*

It is the analysis layer that consumes raw observability signals (events + traces + mastery
checkpoints) and produces interpretable cognitive-quality metrics and events.

---

## 2. Subscribed Events

| Event type | Source | Payload fields used |
|---|---|---|
| `mastery.checkpoint.created` | `MasteryCheckpointRecorder` | `concept_id`, `confidence`, `passed` |
| `learning.loop.completed` | `LearningLoop` / `FiberedLearningLoop` | `focus_concept_id`, `mastery_confidence`, `mastery_passed` |

---

## 3. Emitted Events

All emitted events use producer type `system.analysis` and classification `internal`.

### `observability.drift.detected`

Emitted when sustained confidence drift is detected (ADR-0017 Decision 4).

```json
{
  "concept_id": "<string | null>",
  "window_size": "<number>",
  "rolling_mean_confidence": "<0..1>",
  "baseline_mean_confidence": "<0..1>",
  "drift_score": "<0..1>",
  "severity": "warning | critical"
}
```

Retention policy: 30 days, non-replayable (observability signal; not a source-of-truth event).

### `observability.confidence.calibration_warning`

Emitted when a confidence bin's pass rate diverges from the bin center by more than
`calibrationWarningThreshold` with sufficient samples (ADR-0017 Decision 5).

```json
{
  "confidence_band": "[0.6,0.8)",
  "band_center": 0.7,
  "pass_rate": 0.35,
  "calibration_error": 0.35,
  "sample_count": 12
}
```

Retention policy: 30 days, non-replayable.

### `observability.learning_outcome.summary`

Emitted after every `learning.loop.completed` event (ADR-0017 Decision 6).

```json
{
  "concept_id": "<string>",
  "total_attempts": "<number>",
  "pass_count": "<number>",
  "pass_rate": "<0..1>",
  "mean_confidence": "<0..1>"
}
```

Retention policy: 30 days, non-replayable.

---

## 4. Metrics

| Metric name | Type | Labels | Description |
|---|---|---|---|
| `cos.drift.estimate` | Histogram | `concept_id` | Per-sample drift score (0..1) |
| `cos.confidence.calibration_error` | Histogram | `band` | Per-sample calibration error (0..1) |
| `cos.learning.outcome_rate` | Counter | `concept_id`, `passed` | Count of mastery events by concept + outcome |

---

## 5. Configuration Parameters

| Parameter | Default | Description |
|---|---|---|
| `driftWindowSize` | 20 | Rolling window for drift detection |
| `driftThreshold` | 0.15 | Confidence drop (from baseline) to trigger drift.detected |
| `calibrationMinSamples` | 5 | Minimum per-bin samples before calibration warning |
| `calibrationWarningThreshold` | 0.25 | Max calibration error before warning |

---

## 6. Analysis Algorithms

### 6.1 Drift Detection

```
baseline_mean := sum(all_confidence_samples) / count(all_confidence_samples)
rolling_mean  := mean(confidenceWindow)
drift_score   := max(0, baseline_mean - rolling_mean)
```

Trigger: `window.length >= min(5, driftWindowSize)` AND `drift_score > driftThreshold`.  
Severity: `critical` if `drift_score > 2 × driftThreshold`, else `warning`.

### 6.2 Confidence Calibration

For each incoming `(confidence, passed)` pair:
1. Place into calibration bin `b` where `b.low ≤ confidence < b.high`.
2. Increment `b.total`, optionally `b.passed`.
3. Compute `pass_rate = b.passed / b.total`.
4. `calibration_error = |b.center − pass_rate|`.
5. If `b.total >= calibrationMinSamples` AND `calibration_error > calibrationWarningThreshold`:
   emit `observability.confidence.calibration_warning`.

### 6.3 Learning-Outcome Aggregation

For each incoming `(focus_concept_id, mastery_passed, mastery_confidence)`:
1. Increment `concept.attempts`, optionally `concept.passes`.
2. Accumulate `concept.confidence_sum`.
3. Emit `observability.learning_outcome.summary` with current aggregates.

---

## 7. Non-Goals

- This spec does NOT define cross-agent disagreement analysis (requires P4 multi-agent arbitration).
- This spec does NOT define rollout/rollback decisions (P6).
- The analysis engine does NOT modify any agent, world-state, or memory — it is read-only over
  the bus.
- Per-session drift (single-learner trajectory) is not tracked; drift is a global system signal.

---

## 8. Governance and Observability

- The engine itself is observable via the metrics it emits.
- Emitted events can trigger governance interceptors if they match bus governance patterns.
- The engine has no authority to block, revise, or replay events — only to emit analysis signals.
