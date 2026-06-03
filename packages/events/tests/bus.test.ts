import { describe, it, expect } from "vitest";
import { ManualClock, hlcInit, SeededIdGenerator } from "@inevitable/shared";
import type { CognitiveEvent } from "@inevitable/protocols";
import { InMemoryEventBus } from "../src/in-memory-bus";
import { createEvent, type EventClassification } from "../src/event-factory";
import { DeadLetterQueue } from "../src/dead-letter";

function makeEvent(type: string, classification: EventClassification = "internal"): CognitiveEvent {
  const { event } = createEvent(
    {
      eventType: type,
      producerCid: "cog-0123456789ab",
      producerType: "agent",
      payload: { ok: true },
      classification,
    },
    { clock: new ManualClock(1000), hlc: hlcInit("node-a"), idGenerator: new SeededIdGenerator() },
  );
  return event;
}

describe("InMemoryEventBus", () => {
  it("publishes valid events, assigns sequence, appends to the log", async () => {
    const bus = new InMemoryEventBus();
    const result = await bus.publish(makeEvent("agent.completed"));
    expect(result.status).toBe("published");
    expect(result.sequence).toBe(0);
    expect(bus.log).toHaveLength(1);
  });

  it("delivers only to subject-matching subscribers", async () => {
    const bus = new InMemoryEventBus();
    const got: string[] = [];
    bus.subscribe("agent.*", (e) => {
      got.push(e.event_type);
    });
    bus.subscribe("memory.>", (e) => {
      got.push(`MEM:${e.event_type}`);
    });
    await bus.publish(makeEvent("agent.completed"));
    await bus.publish(makeEvent("memory.mutation.committed"));
    expect(got).toEqual(["agent.completed", "MEM:memory.mutation.committed"]);
  });

  it("dead-letters schema-invalid events without logging them", async () => {
    const bus = new InMemoryEventBus();
    const result = await bus.publish({
      event_type: "agent.completed",
    } as unknown as CognitiveEvent);
    expect(result.status).toBe("invalid");
    expect(bus.log).toHaveLength(0);
    expect(bus.deadLetterQueue.size()).toBe(1);
    expect(bus.deadLetterQueue.list()[0]?.reason).toBe("schema-invalid");
  });

  it("blocks events when governance returns block", async () => {
    const bus = new InMemoryEventBus({
      governance: {
        evaluate: (event, direction) => ({
          decision:
            direction === "publish" && event.classification === "restricted" ? "block" : "allow",
          reason: "restricted classification",
        }),
      },
    });
    const result = await bus.publish(makeEvent("agent.completed", "restricted"));
    expect(result.status).toBe("blocked");
    expect(bus.log).toHaveLength(0);
    expect(bus.deadLetterQueue.list()[0]?.reason).toBe("governance-blocked");
  });

  it("dead-letters a failing handler but still records the event (event sourcing)", async () => {
    const dlq = new DeadLetterQueue();
    const bus = new InMemoryEventBus({ deadLetter: dlq, maxDeliveryAttempts: 2 });
    bus.subscribe("agent.*", () => {
      throw new Error("boom");
    });
    const result = await bus.publish(makeEvent("agent.completed"));
    expect(result.status).toBe("published");
    expect(bus.log).toHaveLength(1);
    expect(dlq.size()).toBe(1);
    expect(dlq.list()[0]?.attempts).toBe(2);
  });

  it("replays the log deterministically by sequence and subject", async () => {
    const bus = new InMemoryEventBus();
    await bus.publish(makeEvent("agent.completed"));
    await bus.publish(makeEvent("memory.mutation.committed"));
    await bus.publish(makeEvent("agent.failed"));
    const agents = bus.replay({ subject: "agent.*" });
    expect(agents.map((e) => e.event_type)).toEqual(["agent.completed", "agent.failed"]);
    expect(bus.replay({ fromSequence: 1 })).toHaveLength(2);
  });

  it("stops delivering after unsubscribe", async () => {
    const bus = new InMemoryEventBus();
    let count = 0;
    const sub = bus.subscribe("agent.*", () => {
      count += 1;
    });
    await bus.publish(makeEvent("agent.completed"));
    sub.unsubscribe();
    await bus.publish(makeEvent("agent.completed"));
    expect(count).toBe(1);
  });
});
