import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { ScriptedTutorFaculty } from "@uci/env-tutor";
import { type CrashPoint, processStream, runStep, write, type ModelFaculty } from "@uci/harness";
import { type CausalRecord, foldLedger, ManualClock } from "@uci/kernel";
import { openRuntime, resume, runUntilDone, start, type Runtime } from "../../src/index.js";
import { cleanup, rederive, stateFingerprint, tempDir } from "./helpers.js";

afterEach(cleanup);
const here = dirname(fileURLToPath(import.meta.url));

class Crash extends Error {}

const POINTS: CrashPoint[] = [
  "after-admission",
  "after-verification",
  "after-manifest",
  "model-started",
  "after-model-output",
  "after-decision",
  "external-started",
  "external-performed",
  "after-settle",
];

/** Run completed steps until `upTo` steps are done. */
async function advance(
  rt: Runtime,
  handle: Awaited<ReturnType<typeof start>>,
  faculty: ModelFaculty,
  upTo: number,
) {
  for (let i = 0; i < 60; i++) {
    const done = (await rt.store.read(processStream("P1"))).filter(
      (r) => r.kind === "step.completed",
    ).length;
    if (done >= upTo) return;
    await runStep({ handle, faculty, env: rt.env });
  }
  throw new Error("did not reach the target step");
}

function invariants(records: readonly CausalRecord[], rt: Runtime) {
  const ledger = foldLedger(records);
  for (const [id, e] of ledger) expect(e.settled, `${id} settled`).toBeDefined();
  const settledCounts = new Map<string, number>();
  for (const r of records.filter((x) => x.kind === "effect.settled")) {
    const id = (r.data as { effectId: string }).effectId;
    settledCounts.set(id, (settledCounts.get(id) ?? 0) + 1);
  }
  for (const [id, n] of settledCounts) expect(n, `${id} settled exactly once`).toBe(1);
  for (const [key, n] of rt.env.channel.keyCounts()) expect(n, `${key} delivered once`).toBe(1);
  expect(records.every((r, i) => r.seq === i + 1)).toBe(true);
}

describe("restart: a crash at every durable boundary loses nothing and repeats nothing", () => {
  for (const crashStep of [3, 9]) {
    for (const point of POINTS) {
      it(`step ${crashStep}, crash ${point}`, async () => {
        const dir = tempDir();
        const clock = new ManualClock();
        const faculty = new ScriptedTutorFaculty();
        const rt = await openRuntime(dir, clock);
        const handle = await start(rt, "P1", "worker-1");
        await advance(rt, handle, faculty, crashStep - 1);
        await expect(
          runStep({
            handle,
            faculty,
            env: rt.env,
            crash: (p) => {
              if (p === point) throw new Crash(p);
            },
          }),
        ).rejects.toBeInstanceOf(Crash);
        await rt.close(); // the process dies: nothing in memory survives

        const rt2 = await openRuntime(dir, clock);
        const resumed = await resume(rt2, "P1", "worker-2", faculty);
        // The old owner is fenced out: its token no longer commits anything.
        await expect(
          write({ ...handle, store: rt2.store }, [
            { kind: "step.completed", v: 1, data: { step: 99, outcome: "failed" } },
          ]),
        ).rejects.toThrow(/fence/);
        const done = await runUntilDone({ handle: resumed.handle, faculty, env: rt2.env });
        expect(done.status).toBe("concluded");

        const records = await rt2.store.read(processStream("P1"));
        invariants(records, rt2);
        const notice = records.find((r) => r.kind === "continuity.notice");
        expect((notice?.data as { resumeAttempt: number }).resumeAttempt).toBe(1);
        if (point === "external-performed") {
          // Delivered before the crash: reconciled as delivered from the channel, never resent.
          expect(
            records.some(
              (r) =>
                r.kind === "effect.reconciled" &&
                (r.data as { finding: string }).finding === "delivered",
            ),
          ).toBe(true);
        }
        if (point === "external-started") {
          expect(
            records.some(
              (r) =>
                r.kind === "effect.reconciled" &&
                (r.data as { finding: string }).finding === "not_delivered",
            ),
          ).toBe(true);
        }
        if (point === "model-started") {
          expect(
            records.some(
              (r) =>
                r.kind === "effect.settled" &&
                (r.data as { outcome: string }).outcome === "abandoned",
            ),
          ).toBe(true);
        }
        const { mismatches } = await rederive(rt2.store, records);
        expect(mismatches).toEqual([]);
        expect(stateFingerprint(records)).toBe(
          stateFingerprint(await rt2.store.read(processStream("P1"))),
        );
        await rt2.close();
      }, 60_000);
    }
  }
});

describe("restart: a real OS-level kill mid-effect", () => {
  it("killing the process inside an external effect, then resuming in a new process, completes with no resend", async () => {
    const dir = tempDir();
    const marker = join(dir, "held");
    const child = spawn(
      process.execPath,
      [
        "--disable-warning=ExperimentalWarning",
        "--import",
        "tsx",
        join(here, "fixtures", "kill-child.ts"),
        dir,
        marker,
        "5",
      ],
      { cwd: join(here, "..", ".."), stdio: ["ignore", "ignore", "pipe"] },
    );
    let stderr = "";
    child.stderr.on("data", (d: Buffer) => (stderr += d.toString()));
    const started = Date.now();
    while (!existsSync(marker)) {
      if (child.exitCode !== null) throw new Error(`child exited early: ${stderr}`);
      if (Date.now() - started > 60_000)
        throw new Error(`child never reached the kill point: ${stderr}`);
      await new Promise((r) => setTimeout(r, 25));
    }
    child.kill();
    await new Promise((r) => child.once("exit", r));

    const clock = new ManualClock();
    const faculty = new ScriptedTutorFaculty();
    const rt = await openRuntime(dir, clock);
    const resumed = await resume(rt, "P1", "worker-after-kill", faculty);
    const done = await runUntilDone({ handle: resumed.handle, faculty, env: rt.env });
    expect(done.status).toBe("concluded");
    const records = await rt.store.read(processStream("P1"));
    invariants(records, rt);
    expect(records.some((r) => r.kind === "effect.reconciled")).toBe(true);
    await rt.close();
  }, 120_000);
});

describe("recovery policy", () => {
  it("escalates to a person when interrupted repeatedly (resume budget)", async () => {
    const dir = tempDir();
    const clock = new ManualClock();
    const faculty = new ScriptedTutorFaculty();
    const rt = await openRuntime(dir, clock);
    await start(rt, "P1", "w0");
    let last;
    for (let i = 1; i <= 11; i++) last = await resume(rt, "P1", `w${i}`, faculty);
    expect(last?.escalated).toBe(true);
    const records = await rt.store.read(processStream("P1"));
    expect(records.some((r) => r.kind === "process.escalated")).toBe(true);
    const step = await runStep({ handle: last!.handle, faculty, env: rt.env });
    expect(step.status).toBe("escalated");
    await rt.close();
  });

  it("admits an input once even if the channel holds it twice, and delivers input that arrived while down", async () => {
    const dir = tempDir();
    const clock = new ManualClock();
    const faculty = new ScriptedTutorFaculty();
    const rt = await openRuntime(dir, clock);
    const handle = await start(rt, "P1", "w0");
    await runStep({ handle, faculty, env: rt.env });
    await rt.close();
    const rt2 = await openRuntime(dir, clock);
    // The same submission sent twice while the process is down (a client retry) is one admission.
    const first = await rt2.say("P1", "hello", "client-retry-1");
    const again = await rt2.say("P1", "hello", "client-retry-1");
    expect(first.duplicate).toBe(false);
    expect(again).toEqual({ inputId: first.inputId, duplicate: true });
    const resumed = await resume(rt2, "P1", "w1", faculty);
    await runStep({ handle: resumed.handle, faculty, env: rt2.env });
    const delivered = (await rt2.store.read(processStream("P1"))).filter(
      (r) =>
        r.kind === "input.delivered" && (r.data as { inputId: string }).inputId === first.inputId,
    );
    expect(delivered).toHaveLength(1);
    await rt2.close();
  });
});
