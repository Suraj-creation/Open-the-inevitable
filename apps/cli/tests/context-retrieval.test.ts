/**
 * Context-lease-bounded retrieval, integrated (DPS-005). A returning learner's new surface (seeded with
 * prior cognition by DPS-004) assembles its relevant prior knowledge into working memory on demand,
 * bounded by the session's context lease. A fresh learner assembles nothing. Deterministic, offline.
 */
import { describe, expect, test } from "vitest";
import { NullModelRuntime } from "@inevitable/adapters";
import { buildDemoSession, demoAsk, extractLearnerCognition } from "../src/wiring";

const GOAL = "Teach me Neural Networks";
const LEARNER = "user-demo";

async function masteredSession(seed: string) {
  const fixture = buildDemoSession({ seed, modelFactory: () => new NullModelRuntime() });
  await fixture.surface.start(GOAL);
  const asked = await fixture.surface.ask(demoAsk(GOAL));
  if (!asked.ok) throw asked.error;
  return fixture;
}

describe("DPS-005 — context-lease-bounded retrieval (integration)", () => {
  test("a returning learner's new surface assembles prior knowledge under its lease", async () => {
    const first = await masteredSession("ctx-a");
    const seed = extractLearnerCognition(first.world, first.memory, LEARNER);
    const second = buildDemoSession({
      seed: "ctx-b",
      modelFactory: () => new NullModelRuntime(),
      learnerSeed: seed,
    });

    const ctx = await second.assembleContext("linear algebra geometry");
    expect(ctx.leaseExpired).toBe(false);
    expect(ctx.items.length).toBeGreaterThan(0);
    expect(ctx.items.some((i) => i.text.includes("linear"))).toBe(true);
    expect(ctx.tokensUsed).toBeLessThanOrEqual(ctx.tokenBudget);
    // The admitted items were written into the working tier (distributed working memory).
    expect(second.memory.byLayer("working").length).toBeGreaterThan(0);
  });

  test("a fresh learner assembles an empty context (nothing to draw on)", async () => {
    const fresh = buildDemoSession({
      seed: "ctx-fresh",
      modelFactory: () => new NullModelRuntime(),
    });
    const ctx = await fresh.assembleContext("linear algebra");
    expect(ctx.items).toEqual([]);
    expect(fresh.memory.byLayer("working").length).toBe(0);
  });

  test("assembly is deterministic for the same prior knowledge + query", async () => {
    const seedA = extractLearnerCognition(
      (await masteredSession("ctx-det")).world,
      (await masteredSession("ctx-det")).memory,
      LEARNER,
    );
    const fa = buildDemoSession({
      seed: "ctx-out",
      modelFactory: () => new NullModelRuntime(),
      learnerSeed: seedA,
    });
    const fb = buildDemoSession({
      seed: "ctx-out",
      modelFactory: () => new NullModelRuntime(),
      learnerSeed: seedA,
    });
    const ca = await fa.assembleContext("linear algebra");
    const cb = await fb.assembleContext("linear algebra");
    expect(ca.items.map((i) => i.text)).toEqual(cb.items.map((i) => i.text));
    expect(ca.tokensUsed).toBe(cb.tokensUsed);
  });
});
