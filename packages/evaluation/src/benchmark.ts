/**
 * BenchmarkRunner — D0 replay of a recorded cognitive session event log.
 *
 * Replays a fixed set of events through the CognitiveEvaluationEngine and collects
 * all EvaluationRecords. Because all inputs are fixed (no model calls, no I/O), output
 * is byte-identical across runs — determinism level D0.
 *
 * Spec: spec/evaluation/cognitive-evaluation-architecture.md §6.
 */
import { InMemoryEventBus } from "@inevitable/events";
import type { ReasoningTrace } from "@inevitable/protocols";
import { ManualClock } from "@inevitable/shared";

import { CognitiveEvaluationEngine } from "./engine";
import type { EvaluationRecord, ScorecardContext } from "./types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BenchmarkTrace {
  readonly trace: ReasoningTrace;
  readonly context: ScorecardContext;
}

export interface BenchmarkResult {
  readonly records: readonly EvaluationRecord[];
  readonly passed: number;
  readonly total: number;
  readonly passRate: number;
  readonly eventCount: number;
}

// ---------------------------------------------------------------------------
// BenchmarkRunner
// ---------------------------------------------------------------------------

/**
 * Runs a fixed set of (trace, context) pairs through the evaluation engine.
 *
 * The clock is frozen at `fixedNowMs` so output is deterministic across wall-clock time.
 * Provide a `fixedNowMs` captured at benchmark record time (pass via `args` in workflows —
 * never call Date.now() inside here, or D0 breaks).
 */
export class BenchmarkRunner {
  constructor(private readonly fixedNowMs: number) {}

  async run(traces: readonly BenchmarkTrace[]): Promise<BenchmarkResult> {
    const clock = new ManualClock(this.fixedNowMs);
    const bus = new InMemoryEventBus();

    const engine = new CognitiveEvaluationEngine({
      bus,
      clock,
      nodeId: "benchmark",
      producerCid: "benchmark.runner",
    });

    const records: EvaluationRecord[] = [];
    for (const { trace, context } of traces) {
      const result = await engine.evaluate(trace, context);
      records.push(result.record);
    }

    const passed = records.filter((r) => r.passed).length;
    return {
      records,
      passed,
      total: records.length,
      passRate: records.length === 0 ? 0 : passed / records.length,
      eventCount: bus.log.length,
    };
  }
}
