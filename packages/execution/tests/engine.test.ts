import { describe, it, expect } from "vitest";
import { ManualClock, SeededIdGenerator } from "@inevitable/shared";
import type { CognitiveEvent } from "@inevitable/protocols";
import { ExecutionEngine, type ExecutionEngineOptions, type FiberRoutine } from "../src/index";

function freshEngine(extra: Partial<ExecutionEngineOptions> = {}): ExecutionEngine {
  return new ExecutionEngine({
    clock: new ManualClock(),
    idGenerator: new SeededIdGenerator(),
    ...extra,
  });
}

describe("ExecutionEngine — determinism", () => {
  const program: FiberRoutine = function* (ctx) {
    yield* ctx.reason("start");
    const a = yield* ctx.spawn(
      function* (c) {
        yield* c.reason("child-a");
      },
      { priority: 2, label: "A" },
    );
    const b = yield* ctx.spawn(
      function* (c) {
        yield* c.reason("child-b");
      },
      { priority: 1, label: "B" },
    );
    yield* ctx.reason("spawned", `${a}|${b}`);
    return "root-done";
  };

  it("produces byte-identical journals across two runs with the same seed + clock", async () => {
    const e1 = freshEngine();
    const e2 = freshEngine();
    e1.submit(program, { label: "root" });
    e2.submit(program, { label: "root" });
    await e1.runToQuiescence();
    await e2.runToQuiescence();
    expect(JSON.stringify(e1.journal)).toEqual(JSON.stringify(e2.journal));
    expect(e1.journal.length).toBeGreaterThan(0);
  });
});

describe("ExecutionEngine — cooperative scheduling", () => {
  it("dispatches ready fibers by ascending priority", async () => {
    const e = freshEngine();
    e.submit(
      function* (ctx) {
        yield* ctx.reason("low");
      },
      { priority: 5 },
    );
    e.submit(
      function* (ctx) {
        yield* ctx.reason("high");
      },
      { priority: 1 },
    );
    await e.runToQuiescence();
    const order = e.journal.filter((j) => j.kind === "reason").map((j) => j.detail.label);
    expect(order).toEqual(["high", "low"]);
  });

  it("sleepLogical defers a fiber by the given number of logical ticks", async () => {
    const e = freshEngine();
    e.submit(function* (ctx) {
      yield* ctx.reason("before");
      yield* ctx.sleep(2);
      yield* ctx.reason("after");
    });
    e.submit(function* (ctx) {
      yield* ctx.reason("other");
    });
    await e.runToQuiescence();
    const order = e.journal.filter((j) => j.kind === "reason").map((j) => j.detail.label);
    // "after" must come last: it is gated behind the logical sleep.
    expect(order[order.length - 1]).toBe("after");
    expect(order).toContain("other");
  });
});

describe("ExecutionEngine — await / resolve", () => {
  it("suspends on await and resumes with the resolved value", async () => {
    const e = freshEngine();
    let captured: unknown;
    e.submit(function* (ctx) {
      captured = yield* ctx.awaitValue<number>("answer");
    });
    await e.runToQuiescence();
    expect(e.isQuiescent()).toBe(true);
    expect(e.pendingTokens()).toContain("answer");
    expect(captured).toBeUndefined();

    e.resolve("answer", 42);
    await e.runToQuiescence();
    expect(captured).toBe(42);
    expect(e.pendingTokens()).toEqual([]);
  });
});

describe("ExecutionEngine — emit", () => {
  it("routes emit effects to the configured sink", async () => {
    const seen: CognitiveEvent[] = [];
    const e = freshEngine({ sink: (ev: CognitiveEvent) => void seen.push(ev) });
    const event = {
      event_type: "reasoning.step.recorded",
      payload: {},
    } as unknown as CognitiveEvent;
    e.submit(function* (ctx) {
      yield* ctx.emit(event);
    });
    await e.runToQuiescence();
    expect(seen).toHaveLength(1);
    expect(seen[0]?.event_type).toBe("reasoning.step.recorded");
  });
});

describe("ExecutionEngine — safety", () => {
  it("fails a runaway fiber with loop-limit", async () => {
    const e = freshEngine({ maxStepsPerFiber: 5 });
    const id = e.submit(function* (ctx) {
      for (;;) yield* ctx.reason("tick");
    });
    await e.runToQuiescence();
    expect(e.view(id)?.status).toBe("failed");
    expect(e.view(id)?.error).toBe("loop-limit");
  });

  it("fail-fast cancels descendant fibers", async () => {
    const e = freshEngine({ onFiberError: "fail-fast" });
    let childId = "";
    const parent: FiberRoutine = function* (ctx) {
      childId = yield* ctx.spawn(function* (c) {
        yield* c.awaitValue("never");
      });
      yield* ctx.reason("after-spawn");
      throw new Error("boom");
    };
    const pid = e.submit(parent);
    await e.runToQuiescence();
    expect(e.view(pid)?.status).toBe("failed");
    expect(e.view(pid)?.error).toBe("boom");
    expect(e.view(childId)?.status).toBe("failed");
    expect(e.view(childId)?.error).toContain("ancestor-failed");
  });
});
