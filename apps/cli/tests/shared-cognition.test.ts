/**
 * Shared per-learner cognitive memory (DPS-004 / ADR-0011) — the mechanism, deterministic & offline.
 *
 * A learner masters a concept in one surface; the learner-durable subset (mastery subgraph +
 * durable-tier memory) is extracted and seeded into a NEW surface, so the supervisor routes the
 * already-mastered concept to `complete` instead of re-explaining it. Session scratch does not carry,
 * and seeding is silent (no surface.* event).
 */
import { describe, expect, test } from "vitest";
import { NullModelRuntime } from "@inevitable/adapters";
import { buildDemoSession, demoAsk, extractLearnerCognition } from "../src/wiring";

const GOAL = "Teach me Neural Networks";
const FOCUS = "linear-algebra"; // demoAsk's focus concept
const LEARNER = "user-demo"; // the default demo learner's userId

async function masteredSession(seed: string) {
  const fixture = buildDemoSession({ seed, modelFactory: () => new NullModelRuntime() });
  await fixture.surface.start(GOAL);
  const asked = await fixture.surface.ask(demoAsk(GOAL));
  if (!asked.ok) throw asked.error;
  return { fixture, asked: asked.value };
}

describe("DPS-004 — shared per-learner cognition (mechanism)", () => {
  test("a fresh surface routes the focus concept to explanation", async () => {
    const { asked } = await masteredSession("sc-fresh");
    expect(asked.routing.targetAgent).toBe("explanation");
    expect(asked.blocks.some((b) => b.block_type === "explanation")).toBe(true);
  });

  test("extract captures the mastery subgraph + durable memory, not session scratch", async () => {
    const { fixture } = await masteredSession("sc-extract");
    const seed = extractLearnerCognition(fixture.world, fixture.memory, LEARNER);
    expect(seed.worldNodes.some((n) => n.type === "mastery_checkpoint")).toBe(true);
    expect(seed.worldNodes.some((n) => n.type === "concept")).toBe(true);
    expect(seed.memoryMutations.some((m) => m.memory_layer === "semantic")).toBe(true);
    // Session scratch (working/episodic) is never carried.
    expect(seed.memoryMutations.every((m) => m.memory_layer !== "working")).toBe(true);
    expect(seed.memoryMutations.every((m) => m.memory_layer !== "episodic")).toBe(true);
  });

  test("a seeded NEW surface starts with prior mastery and routes it to complete", async () => {
    const first = await masteredSession("sc-a");
    const seed = extractLearnerCognition(first.fixture.world, first.fixture.memory, LEARNER);

    const second = buildDemoSession({
      seed: "sc-b",
      modelFactory: () => new NullModelRuntime(),
      learnerSeed: seed,
    });
    // Prior mastery is present in world-state BEFORE any ask.
    expect(second.world.nodesByType("mastery_checkpoint").length).toBeGreaterThan(0);

    await second.surface.start(GOAL);
    const asked = await second.surface.ask(demoAsk(GOAL));
    if (!asked.ok) throw asked.error;
    expect(asked.value.routing.targetAgent).toBe("complete");
    expect(asked.value.routing.conceptId).toBe(FOCUS);
    // No re-explanation: the early-exit cycle produces no explanation block.
    expect(asked.value.blocks.some((b) => b.block_type === "explanation")).toBe(false);
  });

  test("seeding emits no surface.* events (silent state reconstruction)", async () => {
    const first = await masteredSession("sc-silent-a");
    const seed = extractLearnerCognition(first.fixture.world, first.fixture.memory, LEARNER);
    const second = buildDemoSession({
      seed: "sc-silent-b",
      modelFactory: () => new NullModelRuntime(),
      learnerSeed: seed,
    });
    expect(second.bus.replay({ subject: "surface.>" }).length).toBe(0);
  });
});
