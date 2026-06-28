import { describe, expect, test } from "vitest";
import { InMemoryEventBus } from "@inevitable/events";
import { ManualClock, SeededIdGenerator } from "@inevitable/shared";
import { WorldStateGraph } from "@inevitable/world-state";
import { SurfaceTimelineBuilder, type SurfaceTimelineInput } from "../src/timeline";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface Fixture {
  world: WorldStateGraph;
  bus: InMemoryEventBus;
  builder: SurfaceTimelineBuilder;
}

function makeFixture(seed = "timeline-test"): Fixture {
  const clock = new ManualClock(Date.UTC(2026, 5, 11));
  const idGenerator = new SeededIdGenerator(seed);
  const bus = new InMemoryEventBus({ idGenerator });
  const world = new WorldStateGraph({
    clock,
    nodeId: "timeline-test",
    acyclicEdgeTypes: ["prerequisite_of"],
  });
  const builder = new SurfaceTimelineBuilder({
    world,
    bus,
    clock,
    idGenerator,
    nodeId: "timeline-test",
    producerCid: "cog-timeline-learner",
  });
  return { world, bus, builder };
}

/** "Teach me Neural Networks" seed DAG. */
function neuralNetworksInput(): SurfaceTimelineInput {
  return {
    surface_id: "srf-test",
    goal: "Teach me Neural Networks",
    path_id: "path-nn",
    owner_user_id: "user-nn",
    concepts: [
      { id: "linear-algebra", title: "Linear Algebra" },
      { id: "calculus", title: "Calculus" },
      { id: "gradient-descent", title: "Gradient Descent", prerequisites: ["calculus"] },
      {
        id: "perceptron",
        title: "The Perceptron",
        prerequisites: ["linear-algebra"],
      },
      {
        id: "backpropagation",
        title: "Backpropagation",
        prerequisites: ["gradient-descent", "perceptron"],
      },
      {
        id: "neural-networks",
        title: "Neural Networks",
        prerequisites: ["backpropagation"],
      },
    ],
  };
}

function recordMastery(
  world: WorldStateGraph,
  userId: string,
  conceptId: string,
  confidence: number,
  passed = true,
): void {
  world.apply({
    kind: "upsert_node",
    id: `mastery:${userId}:${conceptId}:t`,
    type: "mastery_checkpoint",
    props: { ownerUserId: userId, conceptId, passed, confidence },
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("SurfaceTimelineBuilder.build()", () => {
  test("generates a topologically ordered living timeline with correct initial statuses", async () => {
    const { builder } = makeFixture();
    const result = await builder.build(neuralNetworksInput());

    expect(result.ok).toBe(true);
    if (!result.ok) throw result.error;
    const timeline = result.value;

    // Topological order with declaration-order tie-break
    const order = timeline.nodes.map((n) => n.concept_id);
    expect(order).toEqual([
      "linear-algebra",
      "calculus",
      "gradient-descent",
      "perceptron",
      "backpropagation",
      "neural-networks",
    ]);

    // Roots are available, dependents locked
    const status = new Map(timeline.nodes.map((n) => [n.concept_id, n.status]));
    expect(status.get("linear-algebra")).toBe("available");
    expect(status.get("calculus")).toBe("available");
    expect(status.get("gradient-descent")).toBe("locked");
    expect(status.get("neural-networks")).toBe("locked");

    // The target concept is the milestone (no dependents)
    const milestones = timeline.nodes.filter((n) => n.milestone).map((n) => n.concept_id);
    expect(milestones).toEqual(["neural-networks"]);

    expect(timeline.completed).toBe(false);
    expect(timeline.version).toBe(1);
  });

  test("emits surface.timeline.generated then surface.timeline.updated", async () => {
    const { builder, bus } = makeFixture("timeline-events");
    const result = await builder.build(neuralNetworksInput());
    expect(result.ok).toBe(true);

    const events = bus.replay({ subject: "surface.timeline.>" }).map((e) => e.event_type);
    expect(events).toEqual(["surface.timeline.generated", "surface.timeline.updated"]);
  });

  test("rejects a prerequisite cycle without emitting events", async () => {
    const { builder, bus } = makeFixture("timeline-cycle");
    const result = await builder.build({
      surface_id: "srf-test",
      goal: "Cyclic",
      path_id: "path-cycle",
      owner_user_id: "user-nn",
      concepts: [
        { id: "a", title: "A", prerequisites: ["b"] },
        { id: "b", title: "B", prerequisites: ["a"] },
      ],
    });

    expect(result.ok).toBe(false);
    expect(bus.replay({ subject: "surface.>" })).toHaveLength(0);
  });

  test("is deterministic: identical inputs and seeds produce deep-equal projections", async () => {
    const a = await makeFixture("det-seed").builder.build(neuralNetworksInput());
    const b = await makeFixture("det-seed").builder.build(neuralNetworksInput());
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) expect(a.value).toEqual(b.value);
  });
});

describe("SurfaceTimelineBuilder.refresh() — the timeline is alive", () => {
  test("mastery unlocks dependents: locked → available, mastered marked", async () => {
    const { builder, world, bus } = makeFixture("timeline-mastery");
    const input = neuralNetworksInput();
    const built = await builder.build(input);
    expect(built.ok).toBe(true);

    // Learner masters calculus with high confidence
    recordMastery(world, "user-nn", "calculus", 0.9);
    const refreshed = await builder.refresh("mastery-recorded");
    expect(refreshed.ok).toBe(true);
    if (!refreshed.ok) throw refreshed.error;

    const status = new Map(refreshed.value.nodes.map((n) => [n.concept_id, n.status]));
    expect(status.get("calculus")).toBe("mastered");
    expect(status.get("gradient-descent")).toBe("available"); // unlocked
    expect(status.get("backpropagation")).toBe("locked"); // perceptron still missing
    expect(refreshed.value.version).toBe(2);

    const updated = bus.replay({ subject: "surface.timeline.updated" });
    expect(updated).toHaveLength(2); // initial + this refresh
    expect((updated[1]?.payload as Record<string, unknown>)?.["reason"]).toBe("mastery-recorded");
  });

  test("low-confidence pass does NOT mark mastered (consistency with supervisor threshold)", async () => {
    const { builder, world } = makeFixture("timeline-low-conf");
    await builder.build(neuralNetworksInput());

    recordMastery(world, "user-nn", "calculus", 0.45); // below 0.6
    const refreshed = await builder.refresh();
    expect(refreshed.ok).toBe(true);
    if (!refreshed.ok) throw refreshed.error;

    const calculus = refreshed.value.nodes.find((n) => n.concept_id === "calculus");
    expect(calculus?.status).not.toBe("mastered");
  });

  test("phase props mark nodes in_progress", async () => {
    const { builder, world } = makeFixture("timeline-phase");
    await builder.build(neuralNetworksInput());

    world.apply({
      kind: "set_node_prop",
      id: "concept:linear-algebra",
      key: "explanation_dispatched:user-nn",
      value: true,
    });
    const refreshed = await builder.refresh();
    expect(refreshed.ok).toBe(true);
    if (!refreshed.ok) throw refreshed.error;

    const la = refreshed.value.nodes.find((n) => n.concept_id === "linear-algebra");
    expect(la?.status).toBe("in_progress");
  });

  test("unchanged world-state refreshes silently (no event, same version)", async () => {
    const { builder, bus } = makeFixture("timeline-silent");
    const built = await builder.build(neuralNetworksInput());
    expect(built.ok).toBe(true);

    const before = bus.replay({ subject: "surface.>" }).length;
    const refreshed = await builder.refresh();
    expect(refreshed.ok).toBe(true);
    if (!refreshed.ok) throw refreshed.error;
    expect(refreshed.value.version).toBe(1);
    expect(bus.replay({ subject: "surface.>" }).length).toBe(before);
  });

  test("mastering every node emits surface.timeline.completed exactly once", async () => {
    const { builder, world, bus } = makeFixture("timeline-complete");
    const input = neuralNetworksInput();
    await builder.build(input);

    for (const concept of input.concepts) {
      recordMastery(world, "user-nn", concept.id, 0.95);
    }
    const refreshed = await builder.refresh("all-mastered");
    expect(refreshed.ok).toBe(true);
    if (!refreshed.ok) throw refreshed.error;
    expect(refreshed.value.completed).toBe(true);

    // A second refresh after an unrelated change must not re-emit completed
    world.apply({
      kind: "set_node_prop",
      id: "concept:calculus",
      key: "explanation_dispatched:user-nn",
      value: true,
    });
    await builder.refresh("noise");

    const completedEvents = bus.replay({ subject: "surface.timeline.completed" });
    expect(completedEvents).toHaveLength(1);
    expect((completedEvents[0]?.payload as Record<string, unknown>)?.["mastered_count"]).toBe(6);
  });
});

describe("SurfaceTimelineBuilder — cognitive graph (S1.1)", () => {
  test("projects the prerequisite spine as typed edges + depth layers + null confidence", async () => {
    const { builder } = makeFixture("timeline-graph");
    const result = await builder.build(neuralNetworksInput());
    expect(result.ok).toBe(true);
    if (!result.ok) throw result.error;
    const tl = result.value;

    // Prerequisite spine surfaces as typed edges (from prereq → dependent).
    expect(tl.edges).toContainEqual({
      from: "backpropagation",
      to: "neural-networks",
      edge_type: "prerequisite_of",
    });
    expect(tl.edges.filter((e) => e.edge_type === "prerequisite_of")).toHaveLength(5);

    // Layer falls back to prerequisite-chain depth when the concept node carries no KG layer.
    const layer = new Map(tl.nodes.map((n) => [n.concept_id, n.layer]));
    expect(layer.get("linear-algebra")).toBe(0);
    expect(layer.get("gradient-descent")).toBe(1);
    expect(layer.get("neural-networks")).toBe(3);

    // No mastery yet → confidence is null; default entry point is "beginner".
    expect(tl.nodes.every((n) => n.confidence === null)).toBe(true);
    expect(tl.entry_point).toBe("beginner");
  });

  test("captures mastery confidence on the node after a checkpoint", async () => {
    const { builder, world } = makeFixture("timeline-graph-conf");
    await builder.build(neuralNetworksInput());
    recordMastery(world, "user-nn", "linear-algebra", 0.82);
    const refreshed = await builder.refresh();
    expect(refreshed.ok).toBe(true);
    if (!refreshed.ok) throw refreshed.error;
    const la = refreshed.value.nodes.find((n) => n.concept_id === "linear-algebra");
    expect(la?.confidence).toBe(0.82);
    expect(la?.status).toBe("mastered");
  });

  test("surfaces informational typed edges seeded in world-state", async () => {
    const { builder, world } = makeFixture("timeline-graph-edges");
    await builder.build(neuralNetworksInput());
    world.apply({
      kind: "upsert_edge",
      id: "edge:applies_to:neural-networks:perceptron",
      from: "concept:neural-networks",
      to: "concept:perceptron",
      type: "applies_to",
      props: {},
    });
    const refreshed = await builder.refresh("edge-added");
    expect(refreshed.ok).toBe(true);
    if (!refreshed.ok) throw refreshed.error;
    expect(refreshed.value.edges).toContainEqual({
      from: "neural-networks",
      to: "perceptron",
      edge_type: "applies_to",
    });
  });

  test("reproject changes entry point, bumps version, emits graph.entrypoint.changed; idempotent", async () => {
    const { builder, bus } = makeFixture("timeline-graph-entry");
    const built = await builder.build(neuralNetworksInput());
    expect(built.ok).toBe(true);
    if (!built.ok) throw built.error;
    const v0 = built.value.version;

    const re = await builder.reproject("research");
    expect(re.ok).toBe(true);
    if (!re.ok) throw re.error;
    expect(re.value.entry_point).toBe("research");
    expect(re.value.version).toBe(v0 + 1);
    expect(bus.replay({ subject: "surface.graph.entrypoint.changed" })).toHaveLength(1);

    // Re-projecting to the same entry point is a silent no-op.
    const again = await builder.reproject("research");
    expect(again.ok).toBe(true);
    if (!again.ok) throw again.error;
    expect(again.value.version).toBe(v0 + 1);
    expect(bus.replay({ subject: "surface.graph.entrypoint.changed" })).toHaveLength(1);
  });
});
