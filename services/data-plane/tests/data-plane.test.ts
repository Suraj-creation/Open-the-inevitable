import { describe, it, expect } from "vitest";
import { InMemoryEventBus, createEvent } from "@inevitable/events";
import type { ObservabilitySink } from "@inevitable/contracts";
import { ManualClock, SeededIdGenerator, hlcInit } from "@inevitable/shared";
import {
  bootstrapOtel,
  OtelObservabilitySink,
  bridgeBusToSink,
  createDataPlane,
} from "../src/index";

function sampleEvent() {
  const { event } = createEvent(
    {
      eventType: "reasoning.step.recorded",
      producerCid: "cog-000000000001",
      producerType: "test",
      payload: {},
    },
    { clock: new ManualClock(1000), hlc: hlcInit("t"), idGenerator: new SeededIdGenerator() },
  );
  return event;
}

describe("data-plane — OTel edge", () => {
  it("bootstrapOtel returns an inert handle when the SDK is not installed (offline)", async () => {
    const handle = await bootstrapOtel({ serviceName: "test" });
    expect(handle.active).toBe(false);
    await expect(handle.shutdown()).resolves.toBeUndefined();
  });

  it("bridges every bus event to the observability sink", async () => {
    const seen: string[] = [];
    const sink: ObservabilitySink = {
      trace: (event) => void seen.push(event.event_id),
      metric: () => undefined,
    };
    const bus = new InMemoryEventBus();
    bridgeBusToSink(bus, sink);
    const event = sampleEvent();
    await bus.publish(event);
    expect(seen).toEqual([event.event_id]);
  });

  it("OtelObservabilitySink records spans/metrics without throwing (no-op provider)", () => {
    const sink = new OtelObservabilitySink("test");
    expect(() => sink.trace(sampleEvent())).not.toThrow();
    expect(() => sink.metric("cos.events", 1, { kind: "reasoning" })).not.toThrow();
  });

  it("createDataPlane assembles bus + sink + otel and shuts down cleanly", async () => {
    const plane = await createDataPlane({ serviceName: "test" });
    expect(plane.otel.active).toBe(false);
    await plane.bus.publish(sampleEvent());
    await expect(plane.shutdown()).resolves.toBeUndefined();
  });
});
