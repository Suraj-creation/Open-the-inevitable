# ADR-0017 — Cognitive Observability Analysis Engine (P3.3)

**Status:** Accepted  
**Deciders:** Architect  
**Date:** 2026-06-20  
**Spec:** `spec/observability/DPS-007-observability-analysis.md`

---

## Context

The system captures reasoning traces, mastery checkpoints, and learning-loop events but performs no
post-hoc analysis of these signals. Three invariants from §25.4 of the blueprint are currently
unmet:

- *Observability tracks reasoning quality, memory influence, drift, disagreement, confidence, and
  learning outcomes.*
- The governance immune system has no signal with which to act autonomously.
- Self-evolution (P6) requires drift and calibration signals as input.

Three analysis problems must be solved:

1. **Drift detection** — Is the system's confidence in its outputs declining over time?
2. **Confidence calibration** — Does model-reported confidence match actual learner outcomes?
3. **Learning-outcome signals** — Are learners mastering concepts efficiently?

---

## Decision 1 — Analysis engine is an event-driven subscriber, not a call-path hook

The analysis engine subscribes to existing bus events and emits analysis events back. It is NOT
wired into any production call path (no hooks in `MasteryCheckpointRecorder`, no changes to
`ModelBackedUnit`, no changes to `FiberedLearningLoop`).

**Rationale:** Preserves the no-side-effect substrate invariant. The bus is the coupling point.
Event-driven analysis is independently deployable, testable, and replayable from the bus log.

---

## Decision 2 — Analysis engine lives in `@inevitable/observability`

The engine lives as `packages/observability/src/cognitive-analysis.ts` alongside the existing
primitive layer (logger, metrics, trace, otel). No new package is required.

**Rationale:** Observability analysis is a natural extension of the observability package. The
engine requires only the `Meter` interface (already in the package) and an injectable `publish`
callback (no runtime dep on `@inevitable/events` needed).

---

## Decision 3 — `publish` callback injected at composition root; engine has no bus dependency

The engine accepts an optional `publish: (eventType, payload) => void` callback. The composition
root (`apps/cli/src/wiring.ts`) provides a callback that wraps `createEvent` + `bus.publish`.
Without the callback, the engine operates in metrics-only mode (safe for isolated tests).

**Rationale:** Keeps `@inevitable/observability` free of a dependency on `@inevitable/events`.
The package remains a pure primitive layer. Tests inject a mock callback, not a live bus.

---

## Decision 4 — Drift detection uses a sliding window over mastery-checkpoint confidence

Subscribe to `mastery.checkpoint.created` (payload: `concept_id`, `confidence`, `passed`).
Maintain a global rolling window of N confidence values. Baseline = historical mean (all samples).
Drift score = `max(0, baseline_mean - rolling_mean)`. Emit `observability.drift.detected` when:
- window has ≥ `min(5, windowSize)` samples, AND
- drift_score > `driftThreshold` (default 0.15)

Severity: `critical` if drift_score > `2 × driftThreshold`, else `warning`.

**Rationale:** Uses the only consistently-available confidence signal — mastery checkpoints. A
sliding window catches sustained degradation without over-reacting to a single outlier.

---

## Decision 5 — Confidence calibration uses 5 equal-width bins over [0, 1]

Bins: `[0.0,0.2)`, `[0.2,0.4)`, `[0.4,0.6)`, `[0.6,0.8)`, `[0.8,1.0]`.  
Calibration error per bin = `|bin_center − pass_rate_in_bin|`.  
Emit `observability.confidence.calibration_warning` when bin has ≥ `calibrationMinSamples`
samples AND `calibration_error > calibrationWarningThreshold` (defaults: 5 samples, 0.25 error).  
Metric: `cos.confidence.calibration_error` histogram with `band` label.

**Rationale:** Calibration curves are standard in probabilistic forecasting. Five bins provide
enough resolution at realistic mastery-checkpoint volumes.

---

## Decision 6 — Learning-outcome signals aggregate per concept from `learning.loop.completed`

Subscribe to `learning.loop.completed` (payload: `focus_concept_id`, `mastery_passed`,
`mastery_confidence`). Per concept: track `attempts`, `passes`, `confidence_sum`.  
Emit `observability.learning_outcome.summary` on each event.  
Metric: `cos.learning.outcome_rate` counter with `concept_id` and `passed` labels.

**Rationale:** Learning outcomes are the most direct signal of pedagogy quality. Concept-level
aggregation is the smallest granularity that is useful for self-evolution (P6).

---

## Consequences

- `DemoFixture` gains an `analysis: CognitiveAnalysisEngine` field — callers can inspect drift,
  calibration, and outcome stats after a session.
- Three new event types enter the bus: `observability.drift.detected`,
  `observability.confidence.calibration_warning`, `observability.learning_outcome.summary`.
- Meets the reasoning-quality observability invariant (§25.4) without modifying any existing unit.
- P6 (governed self-evolution) can consume `observability.*` events and `cos.*` metrics as inputs.

---

## Alternatives Rejected

- **Hook into `MasteryCheckpointRecorder.record()`** — couples analysis to product-cognition;
  violates separation of concerns. Rejected.
- **Separate `@inevitable/cognitive-analysis` package** — premature; one file in observability
  is sufficient for P3.3. Revisit if analysis grows into its own domain. Rejected.
- **OTel-native analysis (span-based)** — OTel is a transport bridge, not an analysis engine.
  Analysis belongs in domain code that understands COS semantics. Rejected.
