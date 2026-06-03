import { describe, expect, test } from "vitest";
import { InMemoryEventBus } from "@inevitable/events";
import {
  CapabilityService,
  ContextLeaseService,
  IdentityService,
  IntentLeaseService,
} from "@inevitable/kernel";
import { TieredMemoryStore } from "@inevitable/memory";
import { ManualClock, SeededIdGenerator } from "@inevitable/shared";
import { WorldStateGraph } from "@inevitable/world-state";
import { ProductOnboardingService } from "../src/onboarding";

describe("ProductOnboardingService", () => {
  test("initializes a learner session through kernel, memory, world-state, and events", async () => {
    const clock = new ManualClock(Date.UTC(2026, 5, 3));
    const idGenerator = new SeededIdGenerator("phase-1e");
    const bus = new InMemoryEventBus({ idGenerator });
    const world = new WorldStateGraph({
      clock,
      nodeId: "product",
      acyclicEdgeTypes: ["prerequisite_of"],
    });
    const memory = new TieredMemoryStore();
    const service = new ProductOnboardingService({
      identity: new IdentityService({ clock, idGenerator }),
      capabilities: new CapabilityService({ clock, idGenerator }),
      contexts: new ContextLeaseService({ clock, idGenerator }),
      intents: new IntentLeaseService({ clock, idGenerator }),
      memory,
      world,
      bus,
      clock,
      idGenerator,
    });

    const session = await service.initialize({
      ownerUserId: "user-1",
      persona: "student",
      mode: "student",
      goal: "Understand neural networks",
      consentMemoryScopes: ["working", "semantic"],
    });

    expect(session.learnerIdentity.unit_type).toBe("human.student");
    expect(session.contextLease.memory_layers).toEqual(["working", "semantic"]);
    expect(session.intentLease.interpreted_goal).toBe("Understand neural networks");
    expect(world.getNode(session.learnerNodeId)?.type).toBe("learner");
    expect(world.getNode(session.intentNodeId)?.type).toBe("intent");
    expect(memory.history("semantic")).toHaveLength(1);
    expect(bus.replay({ subject: "onboarding.*" }).map((event) => event.event_type)).toEqual([
      "onboarding.started",
      "onboarding.completed",
    ]);
  });
});
