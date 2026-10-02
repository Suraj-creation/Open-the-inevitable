import { rmSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ScriptedTutorFaculty } from "@uci/env-tutor";
import { type ArmResult, ARMS, evaluate, runArm, SEEDS, setupFork } from "../../src/battery.js";

/**
 * The Tier R runner and scorer, validated on scripted faculties before any live run: the same
 * protocol must reproduce the Tier S findings (scripted B equals scripted A on every check; the
 * floor-only arm never revises the contradicted belief; staleness-off fails C-R5).
 */
describe("Tier R runner and scorer on scripted faculties", () => {
  it("reproduces the Tier S findings through the live protocol", async () => {
    const { dir, at } = await setupFork();
    const seed = SEEDS[0];
    if (!seed) throw new Error("no seed");
    const X = () => new ScriptedTutorFaculty();
    const Y = () => new ScriptedTutorFaculty("scripted-tutor-B@1");
    const results: ArmResult[] = [];
    for (const arm of ARMS)
      results.push(await runArm({ src: dir, at, arm, seed, X, Y, backoffMs: 0 }));
    rmSync(dir, { recursive: true, force: true });
    const get = (arm: string) => results.find((r) => r.arm === arm);
    console.log(
      "TIER-R-SCRIPTED",
      JSON.stringify(
        results.map((r) => ({ arm: r.arm, killed: r.killedInsideEffect, ...r.score })),
      ),
    );
    expect(get("B")?.killedInsideEffect).toBe(true);
    expect(get("B")?.score).toMatchObject({
      ...get("A_X")?.score,
      firstDecision: expect.any(Number),
    });
    expect(get("A_X")?.score.revised).toBe(true);
    expect(get("B")?.score.revised).toBe(true);
    expect(get("C")?.score.revised).toBe(false);
    expect(get("D")?.score.CR5).toBe(false);
    expect(get("B")?.score.CR5).toBe(true);
    expect(
      results.every((r) => r.duplicateDeliveries === 0 && r.derivabilityMismatches === 0),
    ).toBe(true);
    const e = evaluate(results);
    expect(e.spendUsd).toBe(0);
  }, 300_000);
});
