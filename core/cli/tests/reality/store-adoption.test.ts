import { afterEach, describe, expect, it } from "vitest";
import { ScriptedTutorFaculty } from "@uci/env-tutor";
import { processStream } from "@uci/harness";
import { ManualClock } from "@uci/kernel";
import { openRuntime, runUntilDone, start } from "../../src/index.js";
import { cleanup, tempDir } from "./helpers.js";

/** The harness on store contract v2 (S2 phase D): atomic start, environment binding, residency cache. */
afterEach(cleanup);

describe("starting a process", () => {
  it("is one commit: claim, authority, objective, affordances and environment binding together", async () => {
    const rt = await openRuntime(tempDir(), new ManualClock());
    await start(rt, "P1", "w");
    const records = await rt.store.read(processStream("P1"));
    expect(records.map((r) => r.kind)).toEqual([
      "lease.claimed",
      "authority.granted",
      "objective.set",
      "evidence.recorded",
      "environment.bound",
    ]);
    const bound = records[4]?.data as { packId: string; version: string; descriptionHash: string };
    expect(bound).toMatchObject({ packId: rt.env.id, version: rt.env.version });
    const description = await rt.store.getEvidence("L1", bound.descriptionHash);
    expect(JSON.parse(description?.content ?? "{}")).toHaveProperty("actions");
    expect(new Set(records.map((r) => r.at)).size).toBe(1);
    await rt.close();
  });
});

describe("the residency cache", () => {
  it("always equals a fresh read of the store", async () => {
    const rt = await openRuntime(tempDir(), new ManualClock());
    const handle = await start(rt, "P1", "w");
    const outcome = await runUntilDone({
      handle,
      faculty: new ScriptedTutorFaculty(),
      env: rt.env,
    });
    expect(outcome.status).toBe("concluded");
    expect(handle.seen).toEqual(await rt.store.read(processStream("P1")));
    await rt.close();
  });
});
