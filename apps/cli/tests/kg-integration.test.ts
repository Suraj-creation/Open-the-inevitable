/**
 * KnowledgeGraphEngine integration — verifies the KG engine is seeded, queryable, and
 * reflects real learner mastery progression through a governed demo session (DPS-006, ADR-0015).
 */
import { describe, expect, test } from "vitest";
import { NullModelRuntime } from "@inevitable/adapters";
import { buildDemoSession, demoAsk } from "../src/wiring";

const GOAL = "Teach me Neural Networks";

function build() {
  return buildDemoSession({ seed: "kg-int", modelFactory: () => new NullModelRuntime() });
}

describe("KG engine integration", () => {
  test("fixture has a seeded KG with the demo concept graph", () => {
    const fixture = build();
    expect(fixture.kg.size()).toBe(4);
    const concepts = fixture.kg
      .concepts()
      .map((c) => c.id)
      .sort();
    expect(concepts).toEqual([
      "gradient-descent",
      "linear-algebra",
      "neural-networks",
      "perceptron",
    ]);
  });

  test("decompose(neural-networks) returns prerequisites in learning order", () => {
    const fixture = build();
    const order = fixture.kg.decompose("neural-networks");
    expect(order.indexOf("linear-algebra")).toBeLessThan(order.indexOf("perceptron"));
    expect(order.indexOf("gradient-descent")).toBeLessThan(order.indexOf("neural-networks"));
    expect(order.at(-1)).toBe("neural-networks");
  });

  test("nextConcept returns a root prerequisite before any mastery is recorded", () => {
    const fixture = build();
    const next = fixture.kg.nextConcept("user-demo", "neural-networks");
    expect(next).toBeDefined();
    expect(["linear-algebra", "gradient-descent"]).toContain(next?.id);
  });

  test("learnerState reflects mastery after a governed ask", async () => {
    const fixture = build();
    await fixture.surface.start(GOAL);
    const result = await fixture.surface.ask(demoAsk(GOAL));
    expect(result.ok).toBe(true);

    // After an ask, at least one concept should have moved past 'pending' (explanation was dispatched).
    const state = fixture.kg.learnerState("user-demo");
    const nonPending = state.filter((s) => s.phase !== "pending");
    expect(nonPending.length).toBeGreaterThanOrEqual(1);
  });

  test("generateCurriculum seeds concept layer/domain and typed edges into the KG (S2.4)", async () => {
    // Stub model returns a curriculum with layer/domain on concepts and typed cross-concept edges.
    const ENRICHED_CURRICULUM = JSON.stringify({
      concepts: [
        {
          id: "linear-algebra",
          title: "Linear Algebra",
          prerequisites: [],
          layer: 3,
          domain: "mathematics",
        },
        {
          id: "statistics",
          title: "Statistics",
          prerequisites: [],
          layer: 3,
          domain: "mathematics",
        },
        {
          id: "ml",
          title: "Machine Learning",
          prerequisites: ["linear-algebra", "statistics"],
          layer: 2,
          domain: "machine-learning",
        },
      ],
      edges: [
        { from: "linear-algebra", to: "statistics", type: "bridges_to" },
        { from: "ml", to: "linear-algebra", type: "applies_to" },
      ],
      focus_concept_id: "linear-algebra",
      explanation_prompt: "Explain linear algebra as the geometry of data",
      practice_prompt: "One matrix-vector exercise",
    });
    const fixture = buildDemoSession({
      seed: "kg-s24",
      modelFactory: () => ({
        async generate() {
          return { text: ENRICHED_CURRICULUM, model: "stub", finishReason: "stop" as const };
        },
        async embed() {
          return [];
        },
      }),
    });

    const result = await fixture.generateCurriculum("Teach me Machine Learning");
    expect(result.ok).toBe(true);

    // After generateCurriculum the KG contains the three curriculum concepts
    // (linear-algebra upserts the existing demo concept; statistics + ml are new → total 6).
    expect(fixture.kg.size()).toBeGreaterThanOrEqual(5);
    const ids = fixture.kg.concepts().map((c) => c.id);
    expect(ids).toContain("linear-algebra");
    expect(ids).toContain("statistics");
    expect(ids).toContain("ml");

    // Typed edges must be present in world-state so the timeline builder can project them.
    const snapshot = fixture.world.snapshot();
    const bridgesToEdge = snapshot.edges.find(
      (e) =>
        e.type === "bridges_to" &&
        e.from === "concept:linear-algebra" &&
        e.to === "concept:statistics",
    );
    expect(bridgesToEdge).toBeDefined();
    const appliesToEdge = snapshot.edges.find(
      (e) =>
        e.type === "applies_to" && e.from === "concept:ml" && e.to === "concept:linear-algebra",
    );
    expect(appliesToEdge).toBeDefined();

    // The returned SurfaceAskInput includes the three concepts for the timeline builder.
    const input = result.ok ? result.value : null;
    expect(input?.concepts.map((c) => c.id)).toContain("linear-algebra");
    expect(input?.concepts.map((c) => c.id)).toContain("statistics");
    expect(input?.concepts.map((c) => c.id)).toContain("ml");
  });
});
