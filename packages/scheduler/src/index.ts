/**
 * @inevitable/scheduler — cognitive scheduling.
 * Spec: spec/kernel/cognitive-scheduler.md, spec/scheduler/cognitive-scheduling.md.
 * Phase 1C provides the work-item contract and a priority-ordered ready queue; Phase 1D adds the
 * {@link DepthScheduler} (preemption, weighted fairness, budgets, backpressure/load-shedding).
 */
import type { CognitiveWorkItem } from "@inevitable/protocols";

export type { CognitiveWorkItem };

export type {
  SchedulerEvent,
  SchedulerEventType,
  Budget,
  DepthSchedulerOptions,
  AdmissionResult,
} from "./depth-scheduler";
export { DepthScheduler } from "./depth-scheduler";

export interface Scheduler {
  submit(item: CognitiveWorkItem): void;
  /** Pop the highest-priority ready item (priority 1 = highest), FIFO within a priority. */
  next(): CognitiveWorkItem | undefined;
  size(): number;
}

/** Reference in-memory ready queue. Deterministic: ties broken by submission order. */
export class PriorityReadyQueue implements Scheduler {
  private readonly items: Array<{ item: CognitiveWorkItem; seq: number }> = [];
  private seq = 0;

  submit(item: CognitiveWorkItem): void {
    this.items.push({ item, seq: this.seq++ });
    this.items.sort((a, b) => a.item.priority - b.item.priority || a.seq - b.seq);
  }

  next(): CognitiveWorkItem | undefined {
    return this.items.shift()?.item;
  }

  size(): number {
    return this.items.length;
  }
}
