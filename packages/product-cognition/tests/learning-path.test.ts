import { describe, expect, test } from "vitest";
import { ManualClock } from "@inevitable/shared";
import { WorldStateGraph } from "@inevitable/world-state";
import { LearningPathProjector } from "../src/learning-path";

describe("LearningPathProjector", () => {
  test("projects a prerequisite DAG into world-state and rejects cycles", () => {
    const world = new WorldStateGraph({
      clock: new ManualClock(Date.UTC(2026, 5, 3)),
      nodeId: "learning-path",
      acyclicEdgeTypes: ["prerequisite_of"],
    });
    const projector = new LearningPathProjector(world);

    const result = projector.project({
      pathId: "path-neural-networks",
      ownerUserId: "user-1",
      concepts: [
        { id: "linear-algebra", title: "Linear Algebra" },
        { id: "gradient-descent", title: "Gradient Descent", prerequisites: ["linear-algebra"] },
        { id: "backpropagation", title: "Backpropagation", prerequisites: ["gradient-descent"] },
      ],
    });

    expect(result.ok).toBe(true);
    expect(
      world.hasPath("concept:linear-algebra", "concept:backpropagation", "prerequisite_of"),
    ).toBe(true);

    const nodeCountBefore = world.nodeCount();
    const edgeCountBefore = world.edgeCount();

    const cycle = projector.project({
      pathId: "path-cycle",
      ownerUserId: "user-1",
      concepts: [
        { id: "a", title: "A", prerequisites: ["b"] },
        { id: "b", title: "B", prerequisites: ["a"] },
      ],
    });
    expect(cycle.ok).toBe(false);
    if (!cycle.ok) expect(cycle.error.code).toBe("E_PRODUCT_LEARNING_PATH");

    // C1 fix: world-state must be clean (no partial mutations from the failed projection)
    expect(world.nodeCount()).toBe(nodeCountBefore);
    expect(world.edgeCount()).toBe(edgeCountBefore);
  });

  test("rejects a concept referencing an unknown prerequisite without touching world-state", () => {
    const world = new WorldStateGraph({
      clock: new ManualClock(Date.UTC(2026, 5, 3)),
      nodeId: "lp-unknown",
      acyclicEdgeTypes: ["prerequisite_of"],
    });
    const projector = new LearningPathProjector(world);

    const result = projector.project({
      pathId: "path-bad",
      ownerUserId: "user-1",
      concepts: [{ id: "calculus", title: "Calculus", prerequisites: ["algebra"] }],
    });
    expect(result.ok).toBe(false);
    // Nothing written to world-state
    expect(world.nodeCount()).toBe(0);
    expect(world.edgeCount()).toBe(0);
  });
});
