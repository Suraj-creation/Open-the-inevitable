import { describe, it, expect } from "vitest";
import {
  DepthScheduler,
  type Budget,
  type CognitiveWorkItem,
  type SchedulerEvent,
} from "../src/index";

function work(
  id: string,
  priority: number,
  requester = "cog-000000000001",
  extra: Partial<CognitiveWorkItem> = {},
): CognitiveWorkItem {
  return {
    work_id: id,
    work_type: "student_interaction",
    requester_cid: requester,
    priority,
    ...extra,
  } as CognitiveWorkItem;
}

describe("DepthScheduler — preemption", () => {
  it("a higher-priority arrival preempts the lowest-priority running item", () => {
    const events: SchedulerEvent[] = [];
    const s = new DepthScheduler({ maxConcurrency: 1, onEvent: (e) => events.push(e) });
    s.submit(work("low", 5));
    expect(s.dispatch()?.work_id).toBe("low");
    expect(s.runningCount()).toBe(1);

    s.submit(work("high", 1));
    expect(s.dispatch()?.work_id).toBe("high"); // preempts "low"
    expect(events.some((e) => e.type === "preempted" && e.workId === "low")).toBe(true);

    s.complete("high");
    expect(s.dispatch()?.work_id).toBe("low"); // requeued victim runs next
  });
});

describe("DepthScheduler — fairness", () => {
  it("interleaves requesters so a flooding requester cannot starve others", () => {
    const s = new DepthScheduler({ maxConcurrency: 10, fairness: true });
    s.submit(work("r1a", 5, "r1"));
    s.submit(work("r1b", 5, "r1"));
    s.submit(work("r1c", 5, "r1"));
    s.submit(work("r2a", 5, "r2"));
    const order = [s.dispatch(), s.dispatch(), s.dispatch(), s.dispatch()].map((i) => i?.work_id);
    expect(order[0]).toBe("r1a");
    expect(order[1]).toBe("r2a"); // r2 served before r1's backlog despite arriving last
    expect(order.slice(2).sort()).toEqual(["r1b", "r1c"]);
  });
});

describe("DepthScheduler — budgets", () => {
  it("reserves budget at admission and rejects work that exceeds it", () => {
    const events: SchedulerEvent[] = [];
    const budgets = new Map<string, Budget>([["r1", { costRemaining: 1.0 }]]);
    const s = new DepthScheduler({ budgets, onEvent: (e) => events.push(e) });

    expect(s.submit(work("a", 5, "r1", { cost_budget_usd: 0.6 })).admitted).toBe(true);
    const rejected = s.submit(work("b", 5, "r1", { cost_budget_usd: 0.6 }));
    expect(rejected.admitted).toBe(false);
    expect(rejected.reason).toBe("budget");
    expect(events.some((e) => e.type === "budget_exceeded" && e.workId === "b")).toBe(true);
    expect(budgets.get("r1")?.costRemaining).toBeCloseTo(0.4, 5);
  });
});

describe("DepthScheduler — backpressure", () => {
  it("sheds the least-valuable item under queue pressure, surfacing every drop", () => {
    const events: SchedulerEvent[] = [];
    const s = new DepthScheduler({
      maxConcurrency: 1,
      maxQueueDepth: 2,
      onEvent: (e) => events.push(e),
    });
    expect(s.submit(work("a", 5)).admitted).toBe(true);
    expect(s.submit(work("b", 5)).admitted).toBe(true);

    // Queue full (a,b). A higher-value item (priority 1) sheds the worst queued item.
    const c = s.submit(work("c", 1));
    expect(c.admitted).toBe(true);
    expect(c.shedWorkId).toBe("b");
    expect(events.some((e) => e.type === "shed" && e.workId === "b")).toBe(true);

    // Queue full (a,c). A lower-value item (priority 9) is itself shed.
    const d = s.submit(work("d", 9));
    expect(d.admitted).toBe(false);
    expect(d.reason).toBe("shed");
    expect(events.some((e) => e.type === "shed" && e.workId === "d")).toBe(true);
  });
});
