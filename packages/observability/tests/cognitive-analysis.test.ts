/**
 * CognitiveAnalysisEngine — drift detection, confidence calibration, learning-outcome signals.
 * Spec: spec/observability/DPS-007-observability-analysis.md, ADR-0017.
 */
import { describe, expect, test } from "vitest";
import { CognitiveAnalysisEngine } from "../src/cognitive-analysis";
import { InMemoryMeter } from "../src/metrics";

function masteryEvent(conceptId: string, confidence: number, passed: boolean) {
  return {
    event_type: "mastery.checkpoint.created",
    payload: { concept_id: conceptId, confidence, passed },
  };
}

function loopCompleted(conceptId: string, confidence: number, passed: boolean) {
  return {
    event_type: "learning.loop.completed",
    payload: {
      focus_concept_id: conceptId,
      mastery_confidence: confidence,
      mastery_passed: passed,
    },
  };
}

describe("DriftDetector", () => {
  test("driftStats returns null before any events", () => {
    const engine = new CognitiveAnalysisEngine({ meter: new InMemoryMeter() });
    expect(engine.driftStats()).toBeNull();
  });

  test("driftStats reflects rolling mean when baseline and rolling window match", () => {
    const engine = new CognitiveAnalysisEngine({ meter: new InMemoryMeter() });
    [0.9, 0.8, 0.85].forEach((c) => engine.handleEvent(masteryEvent("math", c, true)));
    const stats = engine.driftStats()!;
    expect(stats.rollingMean).toBeCloseTo((0.9 + 0.8 + 0.85) / 3, 5);
    // rolling ≈ baseline → drift score ≈ 0
    expect(stats.driftScore).toBeCloseTo(0, 5);
  });

  test("detects drift when rolling mean drops well below the long-term baseline", () => {
    const emitted: string[] = [];
    const engine = new CognitiveAnalysisEngine({
      meter: new InMemoryMeter(),
      driftWindowSize: 5,
      driftThreshold: 0.1,
      publish: (type) => emitted.push(type),
    });
    // Seed 5 high-confidence samples (establishes baseline)
    [0.9, 0.85, 0.92, 0.88, 0.9].forEach((c) => engine.handleEvent(masteryEvent("math", c, true)));
    expect(emitted).toHaveLength(0);
    // Fill window with low-confidence samples (rolling mean drops)
    [0.3, 0.35, 0.4, 0.3, 0.35].forEach((c) => engine.handleEvent(masteryEvent("math", c, false)));
    expect(emitted.some((e) => e === "observability.drift.detected")).toBe(true);
  });

  test("drift.detected payload contains severity field", () => {
    const payloads: Record<string, unknown>[] = [];
    const engine = new CognitiveAnalysisEngine({
      meter: new InMemoryMeter(),
      driftWindowSize: 5,
      driftThreshold: 0.1,
      publish: (type, payload) => {
        if (type === "observability.drift.detected") payloads.push(payload);
      },
    });
    [0.9, 0.9, 0.9, 0.9, 0.9].forEach((c) => engine.handleEvent(masteryEvent("m", c, true)));
    [0.1, 0.1, 0.1, 0.1, 0.1].forEach((c) => engine.handleEvent(masteryEvent("m", c, false)));
    expect(payloads.length).toBeGreaterThan(0);
    expect(["warning", "critical"]).toContain(payloads[0]?.["severity"]);
  });

  test("records cos.drift.estimate histogram metric per concept", () => {
    const meter = new InMemoryMeter();
    const engine = new CognitiveAnalysisEngine({ meter });
    [0.8, 0.4].forEach((c) => engine.handleEvent(masteryEvent("math", c, true)));
    const snap = meter.snapshot();
    const keys = Object.keys(snap.histograms);
    expect(keys.some((k) => k.includes("cos.drift.estimate"))).toBe(true);
  });

  test("ignores events with missing confidence or passed fields", () => {
    const engine = new CognitiveAnalysisEngine({ meter: new InMemoryMeter() });
    engine.handleEvent({ event_type: "mastery.checkpoint.created", payload: {} });
    expect(engine.driftStats()).toBeNull();
  });

  test("unknown event types are silently ignored", () => {
    const engine = new CognitiveAnalysisEngine({ meter: new InMemoryMeter() });
    engine.handleEvent({ event_type: "some.other.event", payload: { confidence: 0.9 } });
    expect(engine.driftStats()).toBeNull();
  });
});

describe("ConfidenceCalibrator", () => {
  test("calibrationStats returns all 5 bins", () => {
    const engine = new CognitiveAnalysisEngine({ meter: new InMemoryMeter() });
    const bins = engine.calibrationStats();
    expect(bins).toHaveLength(5);
  });

  test("correctly computes pass rate per bin", () => {
    const engine = new CognitiveAnalysisEngine({ meter: new InMemoryMeter() });
    // 2 events in [0.8,1.0] bin — 1 passed, 1 failed → pass_rate = 0.5
    engine.handleEvent(masteryEvent("c", 0.9, true));
    engine.handleEvent(masteryEvent("c", 0.85, false));
    const bin = engine.calibrationStats().find((b) => b.band === "[0.8,1.0]")!;
    expect(bin.total).toBe(2);
    expect(bin.passRate).toBeCloseTo(0.5);
    expect(bin.calibrationError).toBeCloseTo(0.4); // |0.9 - 0.5|
  });

  test("emits calibration_warning when error exceeds threshold with enough samples", () => {
    const emitted: Record<string, unknown>[] = [];
    const engine = new CognitiveAnalysisEngine({
      meter: new InMemoryMeter(),
      calibrationMinSamples: 3,
      calibrationWarningThreshold: 0.2,
      publish: (type, payload) => {
        if (type === "observability.confidence.calibration_warning") emitted.push(payload);
      },
    });
    // High-confidence events but all failing → bin [0.8,1.0] calibration error ≈ 0.9
    [0.9, 0.85, 0.88].forEach((c) => engine.handleEvent(masteryEvent("c", c, false)));
    expect(emitted.length).toBeGreaterThan(0);
    expect(emitted[0]?.["confidence_band"]).toBe("[0.8,1.0]");
    expect(emitted[0]?.["pass_rate"]).toBe(0);
  });

  test("does not emit calibration_warning below minimum sample count", () => {
    const emitted: string[] = [];
    const engine = new CognitiveAnalysisEngine({
      meter: new InMemoryMeter(),
      calibrationMinSamples: 10,
      calibrationWarningThreshold: 0.1,
      publish: (type) => emitted.push(type),
    });
    // 3 events with large calibration error, but below minSamples=10
    [0.9, 0.85, 0.88].forEach((c) => engine.handleEvent(masteryEvent("c", c, false)));
    expect(
      emitted.filter((e) => e === "observability.confidence.calibration_warning"),
    ).toHaveLength(0);
  });

  test("records cos.confidence.calibration_error histogram metric", () => {
    const meter = new InMemoryMeter();
    const engine = new CognitiveAnalysisEngine({ meter });
    engine.handleEvent(masteryEvent("c", 0.7, true));
    const snap = meter.snapshot();
    const keys = Object.keys(snap.histograms);
    expect(keys.some((k) => k.includes("cos.confidence.calibration_error"))).toBe(true);
  });

  test("well-calibrated bin does not emit warning", () => {
    const emitted: string[] = [];
    const engine = new CognitiveAnalysisEngine({
      meter: new InMemoryMeter(),
      calibrationMinSamples: 3,
      calibrationWarningThreshold: 0.2,
      publish: (type) => emitted.push(type),
    });
    // [0.8,1.0] bin: center=0.9, 4 pass + 0 fail → pass_rate=1.0, error=0.1 < 0.2
    [0.9, 0.85, 0.88, 0.92].forEach((c) => engine.handleEvent(masteryEvent("c", c, true)));
    expect(
      emitted.filter((e) => e === "observability.confidence.calibration_warning"),
    ).toHaveLength(0);
  });
});

describe("LearningOutcomeTracker", () => {
  test("outcomeStats returns undefined before any events", () => {
    const engine = new CognitiveAnalysisEngine({ meter: new InMemoryMeter() });
    expect(engine.outcomeStats("gradient-descent")).toBeUndefined();
  });

  test("accumulates outcomes per concept across multiple loop.completed events", () => {
    const engine = new CognitiveAnalysisEngine({ meter: new InMemoryMeter() });
    engine.handleEvent(loopCompleted("gradient-descent", 0.8, true));
    engine.handleEvent(loopCompleted("gradient-descent", 0.6, false));
    const stats = engine.outcomeStats("gradient-descent")!;
    expect(stats.totalAttempts).toBe(2);
    expect(stats.passCount).toBe(1);
    expect(stats.passRate).toBeCloseTo(0.5);
    expect(stats.meanConfidence).toBeCloseTo(0.7);
  });

  test("tracks different concepts independently", () => {
    const engine = new CognitiveAnalysisEngine({ meter: new InMemoryMeter() });
    engine.handleEvent(loopCompleted("algebra", 0.8, true));
    engine.handleEvent(loopCompleted("calculus", 0.6, false));
    expect(engine.outcomeStats("algebra")?.passCount).toBe(1);
    expect(engine.outcomeStats("calculus")?.passCount).toBe(0);
  });

  test("emits learning_outcome.summary event on each loop.completed", () => {
    const emitted: Record<string, unknown>[] = [];
    const engine = new CognitiveAnalysisEngine({
      meter: new InMemoryMeter(),
      publish: (type, payload) => {
        if (type === "observability.learning_outcome.summary") emitted.push(payload);
      },
    });
    engine.handleEvent(loopCompleted("neural-nets", 0.75, true));
    engine.handleEvent(loopCompleted("neural-nets", 0.9, true));
    expect(emitted).toHaveLength(2);
    expect(emitted[1]?.["pass_rate"]).toBeCloseTo(1.0);
    expect(emitted[1]?.["total_attempts"]).toBe(2);
  });

  test("records cos.learning.outcome_rate counter with concept_id and passed labels", () => {
    const meter = new InMemoryMeter();
    const engine = new CognitiveAnalysisEngine({ meter });
    engine.handleEvent(loopCompleted("concepts", 0.8, true));
    const snap = meter.snapshot();
    const keys = Object.keys(snap.counters);
    expect(
      keys.some(
        (k) => k.includes("cos.learning.outcome_rate") && k.includes("concept_id=concepts"),
      ),
    ).toBe(true);
  });

  test("ignores learning.loop.completed events with missing fields", () => {
    const engine = new CognitiveAnalysisEngine({ meter: new InMemoryMeter() });
    engine.handleEvent({ event_type: "learning.loop.completed", payload: {} });
    expect(engine.outcomeStats("any")).toBeUndefined();
  });
});
