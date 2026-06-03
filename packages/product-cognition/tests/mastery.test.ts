import { describe, expect, test } from "vitest";
import { InMemoryEventBus } from "@inevitable/events";
import { TieredMemoryStore } from "@inevitable/memory";
import { ManualClock, SeededIdGenerator } from "@inevitable/shared";
import { WorldStateGraph } from "@inevitable/world-state";
import { MasteryCheckpointRecorder } from "../src/mastery";

describe("MasteryCheckpointRecorder", () => {
  test("records mastery as event-sourced graph state and semantic memory", async () => {
    const clock = new ManualClock(Date.UTC(2026, 5, 3));
    const idGenerator = new SeededIdGenerator("mastery");
    const world = new WorldStateGraph({ clock, nodeId: "mastery" });
    const memory = new TieredMemoryStore();
    const bus = new InMemoryEventBus({ idGenerator });
    const recorder = new MasteryCheckpointRecorder({ world, memory, bus, clock, idGenerator });

    const checkpoint = await recorder.record({
      ownerUserId: "user-1",
      conceptId: "gradient-descent",
      assessorCid: "cog-000000000001",
      passed: true,
      confidence: 0.91,
      evidence: [{ kind: "transfer", result: "solved novel optimization problem" }],
    });

    expect(world.getNode(checkpoint.checkpointNodeId)?.props["passed"]).toBe(true);
    expect(memory.projectionOf("semantic", checkpoint.checkpointNodeId)?.confidence).toBe(0.91);
    expect(bus.replay({ subject: "mastery.>" }).map((event) => event.event_type)).toEqual([
      "mastery.checkpoint.created",
      "mastery.verified",
    ]);
  });
});
