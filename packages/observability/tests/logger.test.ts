import { describe, it, expect } from "vitest";
import { SeededIdGenerator } from "@inevitable/shared";
import { StructuredLogger, MemorySink } from "../src/logger";
import { InMemoryMeter } from "../src/metrics";
import { newRootTrace } from "../src/trace";

describe("StructuredLogger", () => {
  it("captures structured records with a deterministic clock", () => {
    const sink = new MemorySink();
    const log = new StructuredLogger({ level: "debug", sink, nowMs: () => 1000 });
    log.info("hello", { a: 1 });
    expect(sink.records).toHaveLength(1);
    expect(sink.records[0]).toMatchObject({
      level: "info",
      message: "hello",
      timestampMs: 1000,
      fields: { a: 1 },
    });
  });

  it("filters below the configured level", () => {
    const sink = new MemorySink();
    const log = new StructuredLogger({ level: "warn", sink });
    log.info("ignored");
    log.error("kept");
    expect(sink.records.map((r) => r.message)).toEqual(["kept"]);
  });

  it("binds trace context on child loggers", () => {
    const sink = new MemorySink();
    const ctx = newRootTrace("corr-1", {}, new SeededIdGenerator());
    const log = new StructuredLogger({ level: "info", sink }).child(ctx, { unit: "uli" });
    log.info("traced");
    expect(sink.records[0]?.cognitionId).toBe("corr-1");
    expect(sink.records[0]?.traceId).toBe(ctx.traceId);
    expect(sink.records[0]?.fields).toMatchObject({ unit: "uli" });
  });
});

describe("InMemoryMeter", () => {
  it("aggregates counters and histograms by label set", () => {
    const meter = new InMemoryMeter();
    const c = meter.counter("cos_events_total");
    c.add(1, { family: "agent" });
    c.add(2, { family: "agent" });
    const h = meter.histogram("cos_confidence");
    h.record(0.8);
    h.record(0.9);
    const snap = meter.snapshot();
    expect(snap.counters["cos_events_total{family=agent}"]).toBe(3);
    expect(snap.histograms["cos_confidence"]).toEqual([0.8, 0.9]);
  });
});
