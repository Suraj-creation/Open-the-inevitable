import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { SqliteCausalStore } from "@uci/adapters";
import { ScriptedTutorFaculty } from "@uci/env-tutor";
import { PROCESS_KINDS, processStream } from "@uci/harness";
import { ManualClock } from "@uci/kernel";
import { openRuntime, runUntilDone, start } from "../../src/index.js";
import { cleanup, rederive, stateFingerprint, tempDir } from "./helpers.js";

afterEach(cleanup);

describe("the closed loop (uninterrupted)", () => {
  it("reaches verified mastery through decisions, effects, observations and verifier resolutions", async () => {
    const dir = tempDir();
    const clock = new ManualClock();
    const rt = await openRuntime(dir, clock);
    const handle = await start(rt, "P1", "worker-1");
    const faculty = new ScriptedTutorFaculty();
    const steps: string[] = [];
    const done = await runUntilDone({ handle, faculty, env: rt.env }, 40, (o) =>
      steps.push(`${o.step}:${o.status}${o.detail ? `(${o.detail})` : ""}`),
    );
    expect(done.status, steps.join(" ")).toBe("concluded");

    const records = await rt.store.read(processStream("P1"));
    const kinds = records.map((r) => r.kind);
    expect(kinds).toContain("process.concluded");

    // Stages: mastery rests on verifier resolutions of environment-selected probes, never on the model.
    const probeResolutions = records.filter(
      (r) =>
        r.kind === "claim.asserted" &&
        (r.data as { method?: string }).method === "answer-key:probe",
    );
    expect(
      probeResolutions.slice(-3).every((r) => (r.data as { outcome: string }).outcome === "held"),
    ).toBe(true);
    const inferredVerified = records.filter(
      (r) =>
        r.kind === "claim.asserted" &&
        (r.data as { origin: string; standing: string }).origin === "inferred" &&
        (r.data as { standing: string }).standing === "verified",
    );
    expect(inferredVerified).toHaveLength(0);
    expect(records.filter((r) => r.kind === "proposal.rejected")).toHaveLength(0);

    // Settle: every logical effect delivered exactly once.
    for (const [key, count] of rt.env.channel.keyCounts()) expect(count, key).toBe(1);

    // Derivability: every request reproduces from records; no answer key in anything sent.
    const { mismatches, prompts } = await rederive(rt.store, records);
    expect(mismatches).toEqual([]);
    for (const secret of rt.env.verifierPrivate())
      for (const p of prompts)
        expect(p.includes(`= ${secret}`) || p.includes(`key ${secret}`)).toBe(false);

    // Every manifest pins objective and authority, and cites record seqs.
    const manifests = records.filter((r) => r.kind === "manifest.recorded");
    for (const m of manifests) {
      const items = (m.data as { items: { ref: string; record: number }[] }).items;
      expect(items.some((i) => i.ref === "objective:O1")).toBe(true);
      expect(items.some((i) => i.ref === "authority:A")).toBe(true);
      expect(items.every((i) => i.record > 0 && i.record < m.seq)).toBe(true);
    }

    // Projections rebuild identically after the store is closed and reopened.
    const before = stateFingerprint(records);
    await rt.close();
    const reopened = await SqliteCausalStore.open(join(dir, "uci.sqlite"), {
      registry: PROCESS_KINDS,
    });
    expect(stateFingerprint(await reopened.read(processStream("P1")))).toBe(before);
    await reopened.close();
  }, 60_000);
});
