/**
 * KnowledgeGraphEngine — unit tests (DPS-006, ADR-0015).
 * Validates concept seeding, prerequisite decomposition, learner-state derivation,
 * nextConcept routing, and cross-domain bridges.
 */
import { describe, expect, test } from "vitest";
import { WorldStateGraph } from "../src/graph";
import { KnowledgeGraphEngine, type ConceptSpec } from "../src/kg-engine";

function makeWorld() {
  return new WorldStateGraph({ acyclicEdgeTypes: ["prerequisite_of"] });
}

const NEURAL_NET_GRAPH: readonly ConceptSpec[] = [
  { id: "linear-algebra", label: "Linear Algebra", domain: "mathematics", layer: 3 },
  { id: "gradient-descent", label: "Gradient Descent", domain: "optimization", layer: 3 },
  {
    id: "perceptron",
    label: "The Perceptron",
    domain: "machine-learning",
    layer: 2,
    prerequisites: ["linear-algebra"],
  },
  {
    id: "neural-networks",
    label: "Neural Networks",
    domain: "machine-learning",
    layer: 2,
    prerequisites: ["perceptron", "gradient-descent"],
  },
];

describe("KnowledgeGraphEngine — seeding", () => {
  test("seedConcepts writes concept nodes into world-state", () => {
    const world = makeWorld();
    const kg = new KnowledgeGraphEngine(world);
    kg.seedConcepts(NEURAL_NET_GRAPH);

    const nodes = world.nodesByType("concept");
    expect(nodes).toHaveLength(4);
    expect(nodes.map((n) => n.props["conceptId"]).sort()).toEqual([
      "gradient-descent",
      "linear-algebra",
      "neural-networks",
      "perceptron",
    ]);
  });

  test("seedConcepts writes prerequisite_of edges with correct direction", () => {
    const world = makeWorld();
    const kg = new KnowledgeGraphEngine(world);
    kg.seedConcepts(NEURAL_NET_GRAPH);

    expect(world.hasPath("concept:linear-algebra", "concept:perceptron", "prerequisite_of")).toBe(
      true,
    );
    expect(
      world.hasPath("concept:gradient-descent", "concept:neural-networks", "prerequisite_of"),
    ).toBe(true);
    expect(
      world.hasPath("concept:linear-algebra", "concept:neural-networks", "prerequisite_of"),
    ).toBe(true);
  });

  test("seedConcepts is idempotent — re-seeding does not duplicate nodes", () => {
    const world = makeWorld();
    const kg = new KnowledgeGraphEngine(world);
    kg.seedConcepts(NEURAL_NET_GRAPH);
    kg.seedConcepts(NEURAL_NET_GRAPH);

    expect(world.nodesByType("concept")).toHaveLength(4);
    expect(kg.size()).toBe(4);
  });
});

describe("KnowledgeGraphEngine — decompose", () => {
  test("decompose returns leaves before goal (topological order)", () => {
    const world = makeWorld();
    const kg = new KnowledgeGraphEngine(world);
    kg.seedConcepts(NEURAL_NET_GRAPH);

    const order = kg.decompose("neural-networks");

    // linear-algebra must come before perceptron; gradient-descent before neural-networks
    expect(order.indexOf("linear-algebra")).toBeLessThan(order.indexOf("perceptron"));
    expect(order.indexOf("gradient-descent")).toBeLessThan(order.indexOf("neural-networks"));
    expect(order.indexOf("perceptron")).toBeLessThan(order.indexOf("neural-networks"));
    expect(order.at(-1)).toBe("neural-networks");
  });

  test("decompose of a root concept returns just itself", () => {
    const world = makeWorld();
    const kg = new KnowledgeGraphEngine(world);
    kg.seedConcepts(NEURAL_NET_GRAPH);

    expect(kg.decompose("linear-algebra")).toEqual(["linear-algebra"]);
  });

  test("decompose of an unknown concept returns [unknownId] without throwing", () => {
    const world = makeWorld();
    const kg = new KnowledgeGraphEngine(world);
    expect(kg.decompose("nonexistent")).toEqual(["nonexistent"]);
  });
});

describe("KnowledgeGraphEngine — learnerState", () => {
  test("all concepts are pending before any mastery checkpoint", () => {
    const world = makeWorld();
    const kg = new KnowledgeGraphEngine(world);
    kg.seedConcepts(NEURAL_NET_GRAPH);

    const state = kg.learnerState("user-alice");
    expect(state.every((s) => s.phase === "pending")).toBe(true);
    expect(state.every((s) => !s.mastered)).toBe(true);
  });

  test("a passing mastery checkpoint makes the concept complete", () => {
    const world = makeWorld();
    const kg = new KnowledgeGraphEngine(world);
    kg.seedConcepts(NEURAL_NET_GRAPH);

    // Simulate mastery recorder: upsert a passing checkpoint node
    world.apply({
      kind: "upsert_node",
      id: "mastery:user-alice:linear-algebra:chk1",
      type: "mastery_checkpoint",
      props: {
        ownerUserId: "user-alice",
        conceptId: "linear-algebra",
        passed: true,
        confidence: 0.9,
      },
    });

    const state = kg.learnerState("user-alice");
    const la = state.find((s) => s.conceptId === "linear-algebra")!;
    expect(la.mastered).toBe(true);
    expect(la.confidence).toBe(0.9);
    expect(la.phase).toBe("complete");

    const others = state.filter((s) => s.conceptId !== "linear-algebra");
    expect(others.every((s) => s.phase === "pending")).toBe(true);
  });

  test("a failing checkpoint leaves the concept in assessing phase, not mastered", () => {
    const world = makeWorld();
    const kg = new KnowledgeGraphEngine(world);
    kg.seedConcepts(NEURAL_NET_GRAPH);

    world.apply({
      kind: "upsert_node",
      id: "mastery:user-bob:gradient-descent:chk1",
      type: "mastery_checkpoint",
      props: {
        ownerUserId: "user-bob",
        conceptId: "gradient-descent",
        passed: false,
        confidence: 0.3,
      },
    });

    const state = kg.learnerState("user-bob");
    const gd = state.find((s) => s.conceptId === "gradient-descent")!;
    expect(gd.mastered).toBe(false);
    expect(gd.phase).toBe("assessing");
  });
});

describe("KnowledgeGraphEngine — nextConcept", () => {
  test("returns the root prerequisite when nothing is mastered", () => {
    const world = makeWorld();
    const kg = new KnowledgeGraphEngine(world);
    kg.seedConcepts(NEURAL_NET_GRAPH);

    const next = kg.nextConcept("user-carol", "neural-networks");
    // first unmastered in topological order — either linear-algebra or gradient-descent
    expect(["linear-algebra", "gradient-descent"]).toContain(next?.id);
  });

  test("skips mastered concepts and returns next unmastered", () => {
    const world = makeWorld();
    const kg = new KnowledgeGraphEngine(world);
    kg.seedConcepts(NEURAL_NET_GRAPH);

    // Mastered linear-algebra
    world.apply({
      kind: "upsert_node",
      id: "mastery:user-dave:linear-algebra:chk1",
      type: "mastery_checkpoint",
      props: {
        ownerUserId: "user-dave",
        conceptId: "linear-algebra",
        passed: true,
        confidence: 0.9,
      },
    });

    const order = kg.decompose("neural-networks");
    const next = kg.nextConcept("user-dave", "neural-networks");
    // linear-algebra is done; next should come after it in topological order
    expect(next).toBeDefined();
    expect(next!.id).not.toBe("linear-algebra");
    expect(order.indexOf(next!.id)).toBeGreaterThan(order.indexOf("linear-algebra"));
  });

  test("returns undefined when all concepts are mastered", () => {
    const world = makeWorld();
    const kg = new KnowledgeGraphEngine(world);
    kg.seedConcepts(NEURAL_NET_GRAPH);

    for (const spec of NEURAL_NET_GRAPH) {
      world.apply({
        kind: "upsert_node",
        id: `mastery:user-eve:${spec.id}:chk1`,
        type: "mastery_checkpoint",
        props: { ownerUserId: "user-eve", conceptId: spec.id, passed: true, confidence: 0.9 },
      });
    }

    expect(kg.nextConcept("user-eve", "neural-networks")).toBeUndefined();
  });
});

describe("KnowledgeGraphEngine — addBridge", () => {
  test("addBridge writes a bridges_to edge in world-state", () => {
    const world = makeWorld();
    const kg = new KnowledgeGraphEngine(world);
    kg.seedConcepts(NEURAL_NET_GRAPH);

    kg.addBridge("linear-algebra", "gradient-descent", "vectors enable gradient math");

    expect(world.hasPath("concept:linear-algebra", "concept:gradient-descent", "bridges_to")).toBe(
      true,
    );
  });
});
