/**
 * Cognitive observability analysis engine — drift detection, confidence calibration,
 * and learning-outcome signals.
 *
 * Event-driven: receives domain events via handleEvent(); emits analysis signals through
 * the optional publish callback injected at the composition root. Operates in metrics-only
 * mode when publish is absent (safe for isolated tests).
 *
 * Spec: spec/observability/DPS-007-observability-analysis.md, ADR-0017.
 */

import type { Counter, Histogram, Meter } from "./metrics";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface AnalysisEngineOptions {
  readonly meter: Meter;
  /** Rolling window size for drift detection. Default: 20. */
  readonly driftWindowSize?: number;
  /** Confidence drop (from baseline) that triggers drift detection. Default: 0.15. */
  readonly driftThreshold?: number;
  /** Minimum per-bin samples before a calibration warning is emitted. Default: 5. */
  readonly calibrationMinSamples?: number;
  /** Calibration error threshold for warnings. Default: 0.25. */
  readonly calibrationWarningThreshold?: number;
  /**
   * If provided, analysis signals are emitted as events via this callback.
   * The composition root wraps createEvent + bus.publish here (ADR-0017 §Decision 3).
   */
  readonly publish?: (eventType: string, payload: Record<string, unknown>) => void;
}

export interface CalibrationBin {
  readonly band: string;
  readonly center: number;
  readonly total: number;
  readonly passed: number;
  readonly passRate: number;
  readonly calibrationError: number;
}

export interface ConceptOutcomeStats {
  readonly conceptId: string;
  readonly totalAttempts: number;
  readonly passCount: number;
  readonly passRate: number;
  readonly meanConfidence: number;
}

export interface DriftStats {
  readonly rollingMean: number;
  readonly baselineMean: number;
  readonly driftScore: number;
}

// ---------------------------------------------------------------------------
// Internal calibration bin definitions
// ---------------------------------------------------------------------------

interface BinDef {
  readonly band: string;
  readonly center: number;
  readonly low: number;
  readonly high: number;
}

const BINS: readonly BinDef[] = [
  { band: "[0.0,0.2)", center: 0.1, low: 0, high: 0.2 },
  { band: "[0.2,0.4)", center: 0.3, low: 0.2, high: 0.4 },
  { band: "[0.4,0.6)", center: 0.5, low: 0.4, high: 0.6 },
  { band: "[0.6,0.8)", center: 0.7, low: 0.6, high: 0.8 },
  { band: "[0.8,1.0]", center: 0.9, low: 0.8, high: 1.01 },
];

function findBin(confidence: number): BinDef | undefined {
  return BINS.find((b) => confidence >= b.low && confidence < b.high);
}

function round3(v: number): number {
  return Math.round(v * 1000) / 1000;
}

// ---------------------------------------------------------------------------
// CognitiveAnalysisEngine
// ---------------------------------------------------------------------------

export class CognitiveAnalysisEngine {
  // Drift detection
  private readonly confidenceWindow: number[] = [];
  private readonly windowSize: number;
  private readonly driftThreshold: number;
  private baselineSum = 0;
  private baselineCount = 0;
  private lastEmittedRollingMean: number | null = null;

  // Confidence calibration
  private readonly binState = new Map<string, { total: number; passed: number }>();
  private readonly calibrationMinSamples: number;
  private readonly calibrationWarningThreshold: number;

  // Learning-outcome tracking
  private readonly conceptState = new Map<
    string,
    { attempts: number; passes: number; confidenceSum: number }
  >();

  // Metrics
  private readonly driftHistogram: Histogram;
  private readonly calibrationHistogram: Histogram;
  private readonly outcomeCounter: Counter;

  private readonly publish:
    | ((eventType: string, payload: Record<string, unknown>) => void)
    | undefined;

  constructor(options: AnalysisEngineOptions) {
    this.windowSize = options.driftWindowSize ?? 20;
    this.driftThreshold = options.driftThreshold ?? 0.15;
    this.calibrationMinSamples = options.calibrationMinSamples ?? 5;
    this.calibrationWarningThreshold = options.calibrationWarningThreshold ?? 0.25;
    this.publish = options.publish;

    this.driftHistogram = options.meter.histogram("cos.drift.estimate");
    this.calibrationHistogram = options.meter.histogram("cos.confidence.calibration_error");
    this.outcomeCounter = options.meter.counter("cos.learning.outcome_rate");
  }

  /**
   * Route an incoming bus event to the appropriate analysis handler.
   * Called by the subscription wiring in the composition root (ADR-0017 §Decision 1).
   */
  handleEvent(event: { event_type: string; payload: Record<string, unknown> }): void {
    if (event.event_type === "mastery.checkpoint.created") {
      this.onMasteryCheckpoint(event.payload);
    } else if (event.event_type === "learning.loop.completed") {
      this.onLearningLoopCompleted(event.payload);
    }
  }

  // ---------------------------------------------------------------------------
  // Handler: mastery.checkpoint.created
  // ---------------------------------------------------------------------------

  private onMasteryCheckpoint(payload: Record<string, unknown>): void {
    const confidence = typeof payload["confidence"] === "number" ? payload["confidence"] : null;
    const passed = typeof payload["passed"] === "boolean" ? payload["passed"] : null;
    if (confidence === null || passed === null) return;

    const conceptId = typeof payload["concept_id"] === "string" ? payload["concept_id"] : null;

    this.runDriftAnalysis(confidence, conceptId);
    this.runCalibrationAnalysis(confidence, passed);
  }

  private runDriftAnalysis(confidence: number, conceptId: string | null): void {
    // Advance sliding window
    this.confidenceWindow.push(confidence);
    if (this.confidenceWindow.length > this.windowSize) {
      this.confidenceWindow.shift();
    }

    // Update long-term baseline
    this.baselineSum += confidence;
    this.baselineCount++;

    const baselineMean = this.baselineSum / this.baselineCount;
    const rollingMean =
      this.confidenceWindow.reduce((a, b) => a + b, 0) / this.confidenceWindow.length;
    const driftScore = Math.max(0, baselineMean - rollingMean);

    this.driftHistogram.record(driftScore, {
      concept_id: conceptId ?? "unknown",
    });

    const minRequired = Math.min(5, this.windowSize);
    if (
      this.confidenceWindow.length >= minRequired &&
      driftScore > this.driftThreshold &&
      rollingMean !== this.lastEmittedRollingMean
    ) {
      this.lastEmittedRollingMean = rollingMean;
      this.publish?.("observability.drift.detected", {
        concept_id: conceptId,
        window_size: this.confidenceWindow.length,
        rolling_mean_confidence: round3(rollingMean),
        baseline_mean_confidence: round3(baselineMean),
        drift_score: round3(driftScore),
        severity: driftScore > this.driftThreshold * 2 ? "critical" : "warning",
      });
    }
  }

  private runCalibrationAnalysis(confidence: number, passed: boolean): void {
    const bin = findBin(confidence);
    if (!bin) return;

    const prev = this.binState.get(bin.band) ?? { total: 0, passed: 0 };
    const updated = { total: prev.total + 1, passed: prev.passed + (passed ? 1 : 0) };
    this.binState.set(bin.band, updated);

    const passRate = updated.passed / updated.total;
    const calibrationError = Math.abs(bin.center - passRate);
    this.calibrationHistogram.record(calibrationError, { band: bin.band });

    if (
      updated.total >= this.calibrationMinSamples &&
      calibrationError > this.calibrationWarningThreshold
    ) {
      this.publish?.("observability.confidence.calibration_warning", {
        confidence_band: bin.band,
        band_center: bin.center,
        pass_rate: round3(passRate),
        calibration_error: round3(calibrationError),
        sample_count: updated.total,
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Handler: learning.loop.completed
  // ---------------------------------------------------------------------------

  private onLearningLoopCompleted(payload: Record<string, unknown>): void {
    const conceptId =
      typeof payload["focus_concept_id"] === "string" ? payload["focus_concept_id"] : null;
    const passed =
      typeof payload["mastery_passed"] === "boolean" ? payload["mastery_passed"] : null;
    const confidence =
      typeof payload["mastery_confidence"] === "number" ? payload["mastery_confidence"] : null;
    if (!conceptId || passed === null || confidence === null) return;

    const prev = this.conceptState.get(conceptId) ?? {
      attempts: 0,
      passes: 0,
      confidenceSum: 0,
    };
    const updated = {
      attempts: prev.attempts + 1,
      passes: prev.passes + (passed ? 1 : 0),
      confidenceSum: prev.confidenceSum + confidence,
    };
    this.conceptState.set(conceptId, updated);

    const passRate = updated.passes / updated.attempts;
    const meanConfidence = updated.confidenceSum / updated.attempts;

    this.outcomeCounter.add(1, { concept_id: conceptId, passed: String(passed) });

    this.publish?.("observability.learning_outcome.summary", {
      concept_id: conceptId,
      total_attempts: updated.attempts,
      pass_count: updated.passes,
      pass_rate: round3(passRate),
      mean_confidence: round3(meanConfidence),
    });
  }

  // ---------------------------------------------------------------------------
  // Inspection API (for fixture / tests)
  // ---------------------------------------------------------------------------

  /** Current drift stats, or null if no events have been processed. */
  driftStats(): DriftStats | null {
    if (this.confidenceWindow.length === 0) return null;
    const baselineMean = this.baselineSum / this.baselineCount;
    const rollingMean =
      this.confidenceWindow.reduce((a, b) => a + b, 0) / this.confidenceWindow.length;
    return {
      rollingMean,
      baselineMean,
      driftScore: Math.max(0, baselineMean - rollingMean),
    };
  }

  /** Current calibration stats across all 5 confidence bins. */
  calibrationStats(): CalibrationBin[] {
    return BINS.map((b) => {
      const state = this.binState.get(b.band) ?? { total: 0, passed: 0 };
      const passRate = state.total > 0 ? state.passed / state.total : 0;
      return {
        band: b.band,
        center: b.center,
        total: state.total,
        passed: state.passed,
        passRate,
        calibrationError: Math.abs(b.center - passRate),
      };
    });
  }

  /** Per-concept learning-outcome stats, or undefined if no events for this concept. */
  outcomeStats(conceptId: string): ConceptOutcomeStats | undefined {
    const s = this.conceptState.get(conceptId);
    if (!s) return undefined;
    return {
      conceptId,
      totalAttempts: s.attempts,
      passCount: s.passes,
      passRate: s.passes / s.attempts,
      meanConfidence: s.confidenceSum / s.attempts,
    };
  }
}
