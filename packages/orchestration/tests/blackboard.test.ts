import { describe, it, expect } from "vitest";
import { InMemoryBlackboard } from "../src/index";

describe("InMemoryBlackboard", () => {
  it("stores values and bumps a monotonic version on each write", () => {
    const bb = new InMemoryBlackboard();
    const e1 = bb.put("learner_state", { mastery: 0.4 });
    expect(e1.version).toBe(1);
    bb.put("open_questions", ["why?"]);
    expect(bb.version()).toBe(2);
    expect(bb.get<{ mastery: number }>("learner_state")?.mastery).toBe(0.4);
    expect(bb.entries()).toHaveLength(2);
  });

  it("overwrites a key with a newer version", () => {
    const bb = new InMemoryBlackboard();
    bb.put("k", 1);
    const e2 = bb.put("k", 2);
    expect(e2.version).toBe(2);
    expect(bb.get<number>("k")).toBe(2);
    expect(bb.entries()).toHaveLength(1);
  });
});
