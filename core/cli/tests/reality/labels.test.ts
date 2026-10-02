import { afterEach, describe, expect, it } from "vitest";
import { ScriptedTutorFaculty } from "@uci/env-tutor";
import {
  compileContext,
  compileWorkingState,
  processStream,
  forgetPerson,
  REQUEST_MEDIA_TYPE,
  startProcess,
} from "@uci/harness";
import { type CausalRecord, ManualClock } from "@uci/kernel";
import { DEFAULT_ENVELOPE, OBJECTIVE, openRuntime, runUntilDone, start } from "../../src/index.js";
import { rederive } from "../../src/inspect.js";
import { cleanup, tempDir } from "./helpers.js";

/**
 * Consent labels propagate through every derivation; every model call replays from its stored
 * bytes; forgetting one entity removes its content everywhere it would be rendered (S2 criteria 11
 * and 12; journal criteria-20261002-cf81).
 */
afterEach(cleanup);

async function concludedRun() {
  const rt = await openRuntime(tempDir(), new ManualClock());
  const handle = await start(rt, "P1", "w");
  const outcome = await runUntilDone({ handle, faculty: new ScriptedTutorFaculty(), env: rt.env });
  expect(outcome.status).toBe("concluded");
  return { rt, records: await rt.store.read(processStream("P1")) };
}

describe("consent labels", () => {
  it("every record carries the labels of every record it was caused by (0 violations)", async () => {
    const { rt, records } = await concludedRun();
    const bySeq = new Map(records.map((r) => [r.seq, r]));
    const violations: string[] = [];
    for (const r of records)
      for (const c of r.causes) {
        const cause =
          c.stream === r.stream ? bySeq.get(c.seq) : (await rt.store.read(c.stream, c.seq))[0];
        for (const l of cause?.labels ?? [])
          if (!r.labels.includes(l))
            violations.push(`${r.kind}#${r.seq} lacks ${l} from ${c.stream}#${c.seq}`);
      }
    expect(violations).toEqual([]);
    await rt.close();
  });

  it("what derives from a learner's words carries the learner's consent: outputs, decisions, claims, the conclusion", async () => {
    const { rt, records } = await concludedRun();
    const consented = (r: CausalRecord) => r.labels.includes("consent:learning");
    const firstInput = records.find((r) => r.kind === "input.delivered");
    const after = records.filter((r) => r.seq > (firstInput?.seq ?? 0));
    for (const kind of ["manifest.recorded", "decision.made", "process.concluded"])
      expect(after.filter((r) => r.kind === kind).every(consented), kind).toBe(true);
    expect(
      after
        .filter(
          (r) =>
            r.kind === "evidence.recorded" &&
            (r.data as { source: string }).source === "model-output",
        )
        .every(consented),
    ).toBe(true);
    // The stored evidence itself carries the label, not only the record citing it.
    const output = after.find(
      (r) =>
        r.kind === "evidence.recorded" && (r.data as { source: string }).source === "model-output",
    );
    const stored = await rt.store.getEvidence(
      "L1",
      (output?.data as { evidenceHash: string }).evidenceHash,
    );
    expect(stored?.labels).toContain("consent:learning");
    await rt.close();
  });
});

describe("replay", () => {
  it("reconstructs every model call from its stored bytes after a renderer change", async () => {
    const { rt, records } = await concludedRun();
    const manifests = records.filter((r) => r.kind === "manifest.recorded").length;
    const requests = records.filter((r) => r.kind === "request.recorded");
    expect(requests).toHaveLength(manifests);
    const sameRenderer = await rederive(rt.store, records);
    expect(sameRenderer).toMatchObject({ mismatches: [], replayedFromBytes: 0 });
    const changed = await rederive(rt.store, records, { rendererVersion: "renderer@changed" });
    expect(changed.mismatches).toEqual([]);
    expect(changed.replayedFromBytes).toBe(manifests);
    expect(changed.prompts).toEqual(sameRenderer.prompts);
    const bytes = await rt.store.getEvidence(
      "L1",
      (requests[0]?.data as { evidenceHash: string }).evidenceHash,
    );
    expect(bytes?.mediaType).toBe(REQUEST_MEDIA_TYPE);
    await rt.close();
  });
});

describe("forget", () => {
  it("removes one entity's content from every rendering while another entity's identical content survives", async () => {
    const clock = new ManualClock();
    const rt = await openRuntime(tempDir(), clock);
    await start(rt, "P1", "w");
    await startProcess({
      store: rt.store,
      clock,
      processId: "P2",
      entityId: "L2",
      owner: "w",
      envelope: { ...DEFAULT_ENVELOPE, admits: [{ principal: "L2", role: "person" }] },
      grantedBy: "owner",
      objective: OBJECTIVE,
      env: rt.env,
    });
    const secret = "my phone number is 555-0100";
    await rt.say("P1", secret);
    await rt.say("P2", secret);
    const render = async (pid: string) => {
      const records = await rt.store.read(processStream(pid));
      // Deliver happens at a step; render the inbox content through a delivered-input view instead.
      const ws = await compileWorkingState(rt.store, records, clock.now());
      return { ws, ctx: compileContext(ws, { id: "t", model: "t" }, "bridge") };
    };
    // Deliver both inputs by running one step each.
    const { runStep, resumeProcess } = await import("@uci/harness");
    for (const pid of ["P1", "P2"]) {
      const { handle } = await resumeProcess({
        store: rt.store,
        clock,
        processId: pid,
        owner: "w2",
        env: rt.env,
        faculty: "scripted",
      });
      await runStep({ handle, faculty: new ScriptedTutorFaculty(), env: rt.env });
    }
    expect((await render("P1")).ctx.request.prompt).toContain(secret);
    expect(await forgetPerson(rt.store, "L1")).toBeGreaterThan(0);
    const p1 = await render("P1");
    expect(p1.ctx.request.prompt).not.toContain(secret);
    expect(p1.ctx.request.prompt).toContain("[forgotten]");
    expect((await render("P2")).ctx.request.prompt).toContain(secret);
    expect((await rt.store.read(processStream("P1"))).length).toBeGreaterThan(5);
    await rt.close();
  });
});
