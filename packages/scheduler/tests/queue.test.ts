import { describe, it, expect } from "vitest";
import { PriorityReadyQueue, type CognitiveWorkItem } from "../src/index";

function work(id: string, priority: number): CognitiveWorkItem {
  return {
    work_id: id,
    work_type: "student_interaction",
    requester_cid: "cog-0123456789ab",
    priority,
  } as CognitiveWorkItem;
}

describe("PriorityReadyQueue", () => {
  it("dispatches by ascending priority, FIFO within a priority", () => {
    const q = new PriorityReadyQueue();
    q.submit(work("a", 5));
    q.submit(work("b", 1));
    q.submit(work("c", 1));
    q.submit(work("d", 3));
    expect([q.next()?.work_id, q.next()?.work_id, q.next()?.work_id, q.next()?.work_id]).toEqual([
      "b",
      "c",
      "d",
      "a",
    ]);
    expect(q.size()).toBe(0);
    expect(q.next()).toBeUndefined();
  });
});
