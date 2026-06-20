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
});
