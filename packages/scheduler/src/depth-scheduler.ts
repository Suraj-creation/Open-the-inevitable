/**
 * DepthScheduler — production cognitive scheduling: priority dispatch with weighted fairness,
 * per-requester budgets, preemption of lower-priority running work, and bounded-queue backpressure
 * with value-based load-shedding. Deterministic given an identical sequence of operations.
 * Spec: spec/scheduler/cognitive-scheduling.md.
 */
import type { CognitiveWorkItem } from "@inevitable/protocols";

export type SchedulerEventType = "scheduled" | "preempted" | "shed" | "budget_exceeded";

export interface SchedulerEvent {
  readonly type: SchedulerEventType;
  readonly workId: string;
  readonly requesterCid: string;
  readonly priority: number;
  readonly reason?: string;
}

/** Per-requester remaining budget; reserved at admission, refunded on shed/cancel. */
export interface Budget {
  costRemaining?: number;
  timeRemaining?: number;
}

export interface DepthSchedulerOptions {
  /** Max concurrently running items (bounded slots). Default 1. */
  maxConcurrency?: number;
  /** Max ready-queue depth before backpressure/shedding kicks in. Default unbounded. */
  maxQueueDepth?: number;
  /** Weighted fairness across requesters to bound starvation. Default true. */
  fairness?: boolean;
  /** Per-requester budgets (`requester_cid` → Budget). */
  budgets?: Map<string, Budget>;
  /** Observability hook; every scheduling decision is surfaced (no silent caps). */
  onEvent?: (event: SchedulerEvent) => void;
}

export interface AdmissionResult {
  readonly admitted: boolean;
  readonly reason?: "budget" | "shed";
  /** If a queued item was shed to admit this one. */
  readonly shedWorkId?: string;
}

interface Entry {
  readonly item: CognitiveWorkItem;
  readonly seq: number;
}

export class DepthScheduler {
  private readonly readyQ: Entry[] = [];
  private readonly running = new Map<string, Entry>();
  private readonly serviceCount = new Map<string, number>();
  private readonly budgets: Map<string, Budget>;
  private readonly maxConcurrency: number;
  private readonly maxQueueDepth: number;
  private readonly fairness: boolean;
  private readonly onEvent: (event: SchedulerEvent) => void;
  private seq = 0;

  constructor(options: DepthSchedulerOptions = {}) {
    this.maxConcurrency = Math.max(1, options.maxConcurrency ?? 1);
    this.maxQueueDepth = Math.max(1, options.maxQueueDepth ?? Number.MAX_SAFE_INTEGER);
    this.fairness = options.fairness ?? true;
    this.budgets = options.budgets ?? new Map();
    this.onEvent = options.onEvent ?? (() => undefined);
  }

  /** Admit a work item subject to budget and backpressure. */
  submit(item: CognitiveWorkItem): AdmissionResult {
    if (!this.canAfford(item)) {
      this.emit("budget_exceeded", item, "insufficient budget");
      return { admitted: false, reason: "budget" };
    }

    if (this.readyQ.length >= this.maxQueueDepth) {
      const worstIdx = this.worstReadyIndex();
      const worst = worstIdx >= 0 ? this.readyQ[worstIdx] : undefined;
      if (worst && worst.item.priority > item.priority) {
        // The incoming item is higher value: shed the worst queued item to make room.
        this.readyQ.splice(worstIdx, 1);
        this.refund(worst.item);
        this.emit("shed", worst.item, "backpressure");
        this.charge(item);
        this.readyQ.push({ item, seq: this.seq++ });
        return { admitted: true, shedWorkId: worst.item.work_id };
      }
      // Otherwise shed the incoming item (it is the least valuable).
      this.emit("shed", item, "backpressure");
      return { admitted: false, reason: "shed" };
    }

    this.charge(item);
    this.readyQ.push({ item, seq: this.seq++ });
    return { admitted: true };
  }

  /**
   * Dispatch the next item. If all slots are busy, a strictly-higher-priority ready item preempts the
   * lowest-priority running item (which is re-queued with its reservation intact).
   */
  dispatch(): CognitiveWorkItem | undefined {
    if (this.readyQ.length === 0) return undefined;
    const idx = this.selectReadyIndex();
    const entry = this.readyQ[idx];
    if (!entry) return undefined;

    if (this.running.size >= this.maxConcurrency) {
      const victim = this.lowestPriorityRunning();
      if (victim && entry.item.priority < victim.item.priority) {
        this.running.delete(victim.item.work_id);
        this.emit("preempted", victim.item, `preempted by ${entry.item.work_id}`);
        this.readyQ.push({ item: victim.item, seq: this.seq++ });
      } else {
        return undefined; // no free slot and nothing preemptible
      }
    }

    const selIdx = this.readyQ.indexOf(entry);
    if (selIdx >= 0) this.readyQ.splice(selIdx, 1);
    this.serviceCount.set(
      entry.item.requester_cid,
      (this.serviceCount.get(entry.item.requester_cid) ?? 0) + 1,
    );
    this.running.set(entry.item.work_id, entry);
    this.emit("scheduled", entry.item);
    return entry.item;
  }

  /** Mark a running item finished, freeing its slot. */
  complete(workId: string): void {
    this.running.delete(workId);
  }

  queueDepth(): number {
    return this.readyQ.length;
  }
  runningCount(): number {
    return this.running.size;
  }
  servicedCount(requesterCid: string): number {
    return this.serviceCount.get(requesterCid) ?? 0;
  }

  // --- internals ---------------------------------------------------------

  private canAfford(item: CognitiveWorkItem): boolean {
    const budget = this.budgets.get(item.requester_cid);
    if (!budget) return true;
    const cost = item.cost_budget_usd ?? 0;
    const time = item.max_time_seconds ?? 0;
    if (budget.costRemaining !== undefined && cost > budget.costRemaining) return false;
    if (budget.timeRemaining !== undefined && time > budget.timeRemaining) return false;
    return true;
  }

  private charge(item: CognitiveWorkItem): void {
    const budget = this.budgets.get(item.requester_cid);
    if (!budget) return;
    if (budget.costRemaining !== undefined) budget.costRemaining -= item.cost_budget_usd ?? 0;
    if (budget.timeRemaining !== undefined) budget.timeRemaining -= item.max_time_seconds ?? 0;
  }

  private refund(item: CognitiveWorkItem): void {
    const budget = this.budgets.get(item.requester_cid);
    if (!budget) return;
    if (budget.costRemaining !== undefined) budget.costRemaining += item.cost_budget_usd ?? 0;
    if (budget.timeRemaining !== undefined) budget.timeRemaining += item.max_time_seconds ?? 0;
  }

  private selectReadyIndex(): number {
    let bestIdx = 0;
    let best = this.readyQ[0];
    for (let i = 1; i < this.readyQ.length; i++) {
      const candidate = this.readyQ[i];
      if (!candidate || !best) continue;
      if (this.better(candidate, best)) {
        best = candidate;
        bestIdx = i;
      }
    }
    return bestIdx;
  }

  private better(candidate: Entry, best: Entry): boolean {
    if (candidate.item.priority !== best.item.priority) {
      return candidate.item.priority < best.item.priority;
    }
    if (this.fairness) {
      const cs = this.serviceCount.get(candidate.item.requester_cid) ?? 0;
      const bs = this.serviceCount.get(best.item.requester_cid) ?? 0;
      if (cs !== bs) return cs < bs;
    }
    return candidate.seq < best.seq;
  }

  private worstReadyIndex(): number {
    let worstIdx = -1;
    let worst: Entry | undefined;
    for (let i = 0; i < this.readyQ.length; i++) {
      const candidate = this.readyQ[i];
      if (!candidate) continue;
      if (
        !worst ||
        candidate.item.priority > worst.item.priority ||
        (candidate.item.priority === worst.item.priority && candidate.seq > worst.seq)
      ) {
        worst = candidate;
        worstIdx = i;
      }
    }
    return worstIdx;
  }

  private lowestPriorityRunning(): Entry | undefined {
    let worst: Entry | undefined;
    for (const entry of this.running.values()) {
      if (!worst || entry.item.priority > worst.item.priority) worst = entry;
    }
    return worst;
  }

  private emit(type: SchedulerEventType, item: CognitiveWorkItem, reason?: string): void {
    this.onEvent({
      type,
      workId: item.work_id,
      requesterCid: item.requester_cid,
      priority: item.priority,
      reason,
    });
  }
}
