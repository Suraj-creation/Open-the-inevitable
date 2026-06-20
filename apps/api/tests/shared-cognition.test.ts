/**
 * Shared per-learner cognitive memory at the gateway (DPS-004 / ADR-0011).
 *
 * A returning learner's NEW surface draws on the mastery they earned in a prior surface: the
 * supervisor routes the already-mastered concept to `complete` instead of re-explaining. Proven both
 * in memory within one process and across a simulated restart (the profile loads from disk). A
 * brand-new learner always starts fresh (control).
 */
import { beforeAll, describe, expect, test } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NullVoiceRuntime } from "@inevitable/adapters";
import type { SurfaceAskResult } from "@inevitable/surface";
import { SurfaceHost } from "../src/host";

beforeAll(() => {
  delete process.env["GEMINI_API_KEY"];
});

async function ask(host: SurfaceHost, surfaceId: string, goal: string): Promise<SurfaceAskResult> {
  const served = await host.get(surfaceId);
  if (!served) throw new Error(`surface ${surfaceId} not found`);
  const result = await served.ask(goal);
  if (!result.ok) throw result.error;
  return result.value;
}

async function create(host: SurfaceHost, goal: string, learnerId?: string): Promise<string> {
  const created = await host.create(goal, learnerId !== undefined ? { learnerId } : {});
  if (!created.ok) throw created.error;
  return created.value.surfaceId;
}

async function createWithLearner(
  host: SurfaceHost,
  goal: string,
): Promise<{ surfaceId: string; learnerId: string }> {
  const created = await host.create(goal, {});
  if (!created.ok) throw created.error;
  return { surfaceId: created.value.surfaceId, learnerId: created.value.learnerId };
}

describe("DPS-004 — shared per-learner cognition (gateway)", () => {
  test("in-memory: a returning learner's new surface routes from prior mastery", async () => {
    const host = new SurfaceHost({ voiceRuntime: new NullVoiceRuntime() });
    const goal = "Teach me Photosynthesis";

    const first = await createWithLearner(host, goal);
    const firstAsk = await ask(host, first.surfaceId, goal);
    expect(firstAsk.routing.targetAgent).toBe("explanation"); // fresh learner, nothing mastered yet

    // Same learner, a NEW surface: prior mastery carries within the process.
    const secondSurface = await create(host, goal, first.learnerId);
    const secondAsk = await ask(host, secondSurface, goal);
    expect(secondAsk.routing.targetAgent).toBe("complete");

    // Control: a brand-new learner still starts fresh.
    const otherSurface = await create(host, goal);
    const otherAsk = await ask(host, otherSurface, goal);
    expect(otherAsk.routing.targetAgent).toBe("explanation");
  });

  test("across a restart: prior mastery loads from disk and seeds the new surface", async () => {
    const dir = mkdtempSync(join(tmpdir(), "cos-shared-cog-"));
    try {
      const goal = "Teach me Recursion";

      let host = new SurfaceHost({ persistDir: dir, voiceRuntime: new NullVoiceRuntime() });
      const first = await createWithLearner(host, goal);
      const firstAsk = await ask(host, first.surfaceId, goal);
      expect(firstAsk.routing.targetAgent).toBe("explanation");

      // Restart: a fresh gateway over the same directory. The cognition profile loads from disk.
      host = new SurfaceHost({ persistDir: dir, voiceRuntime: new NullVoiceRuntime() });
      const secondSurface = await create(host, goal, first.learnerId);
      const secondAsk = await ask(host, secondSurface, goal);
      expect(secondAsk.routing.targetAgent).toBe("complete");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
