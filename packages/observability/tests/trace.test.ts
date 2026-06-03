import { describe, it, expect } from "vitest";
import { SeededIdGenerator } from "@inevitable/shared";
import { newRootTrace, childSpan, traceFields } from "../src/trace";

describe("trace context", () => {
  it("creates a root trace with no parent", () => {
    const ctx = newRootTrace("corr-1", { tenant: "t1" }, new SeededIdGenerator());
    expect(ctx.parentSpanId).toBeNull();
    expect(ctx.cognitionId).toBe("corr-1");
    expect(ctx.baggage.tenant).toBe("t1");
  });

  it("derives a child span sharing trace + cognition id", () => {
    const gen = new SeededIdGenerator();
    const root = newRootTrace("corr-1", {}, gen);
    const child = childSpan(root, { step: "reason" }, gen);
    expect(child.traceId).toBe(root.traceId);
    expect(child.cognitionId).toBe(root.cognitionId);
    expect(child.parentSpanId).toBe(root.spanId);
    expect(child.spanId).not.toBe(root.spanId);
    expect(child.baggage.step).toBe("reason");
  });

  it("projects to flat envelope fields", () => {
    const ctx = newRootTrace("corr-1", {}, new SeededIdGenerator());
    expect(traceFields(ctx)).toEqual({
      trace_id: ctx.traceId,
      span_id: ctx.spanId,
      correlation_id: "corr-1",
    });
  });
});
