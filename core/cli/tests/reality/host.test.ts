import { afterEach, describe, expect, it } from "vitest";
import { ScriptedTutorFaculty } from "@uci/env-tutor";
import {
  FacultyError,
  type FacultyRequest,
  type FacultyResponse,
  type ModelFaculty,
  processStream,
} from "@uci/harness";
import { Host } from "@uci/host";
import { type CausalRecord, DAY_MS, ManualClock } from "@uci/kernel";
import { DEFAULT_ENVELOPE, OBJECTIVE, openRuntime, type Runtime } from "../../src/index.js";
import { cleanup, tempDir } from "./helpers.js";

/**
 * The host (S2 phase F; journal criteria-20261002-cf81 items 6, 7 and 9): durable waiting on a
 * person across any number of host restarts, time derived from records, and the newest host
 * taking over a process without a duplicate effect.
 */
afterEach(cleanup);

const count = (records: readonly CausalRecord[], kind: string) =>
  records.filter((r) => r.kind === kind).length;
const modelCalls = (records: readonly CausalRecord[]) =>
  records.filter(
    (r) =>
      r.kind === "effect.intended" &&
      (r.data as { effectClass: string }).effectClass === "model-call",
  ).length;

function host(rt: Runtime, owner: string, faculty: ModelFaculty = new ScriptedTutorFaculty()) {
  return new Host({ store: rt.store, clock: rt.clock, owner, env: rt.env, faculty });
}

async function startOn(h: Host) {
  await h.start({
    processId: "P1",
    entityId: "L1",
    envelope: DEFAULT_ENVELOPE,
    grantedBy: "owner",
    objective: OBJECTIVE,
  });
  await h.idle();
}

describe("waiting on a person", () => {
  it("parks at zero cost through 50 host restarts, then resumes exactly once per answer to mastery", async () => {
    const clock = new ManualClock();
    const rt = await openRuntime(tempDir(), clock, undefined, undefined, undefined, "external");
    await startOn(host(rt, "host-0"));
    const parked = await rt.store.read(processStream("P1"));
    expect(parked.at(-1)?.kind).toBe("process.waiting");
    const callsWhileParked = modelCalls(parked);

    let last: Host | undefined;
    for (let i = 1; i <= 50; i++) {
      last = host(rt, `host-${i}`);
      expect(await last.boot()).toEqual(["P1"]);
      await last.idle();
    }
    const after = await rt.store.read(processStream("P1"));
    expect(count(after, "process.escalated")).toBe(0);
    expect(count(after, "continuity.notice")).toBe(0);
    expect(modelCalls(after)).toBe(callsWhileParked);
    expect(count(after, "process.waiting")).toBe(count(parked, "process.waiting"));

    // The learner answers in its own time; each answer wakes the process for exactly one more turn.
    const h = last as Host;
    for (let turn = 0; turn < 40; turn++) {
      const records = await rt.store.read(processStream("P1"));
      if (records.some((r) => r.kind === "process.concluded")) break;
      await rt.learner?.answer();
      h.ring("P1");
      await h.idle();
    }
    const done = await rt.store.read(processStream("P1"));
    expect(done.some((r) => r.kind === "process.concluded")).toBe(true);
    expect([...rt.env.channel.keyCounts().values()].every((n) => n === 1)).toBe(true);
    await rt.close();
  }, 120_000);
});

describe("durable time", () => {
  it("an expectation that falls due while the host is down expires at the first boundary after boot", async () => {
    const clock = new ManualClock();
    const rt = await openRuntime(tempDir(), clock, undefined, undefined, undefined, "external");
    const first = host(rt, "host-a");
    await startOn(first);
    const due = first.nextWake("P1");
    expect(due).toBeDefined();
    await first.stop();

    clock.advance(3 * DAY_MS); // past the expectation's due time, while no host runs
    const bootSeq = (await rt.store.read(processStream("P1"))).at(-1)?.seq ?? 0;
    const second = host(rt, "host-b");
    await second.boot();
    await second.idle();
    const records = await rt.store.read(processStream("P1"));
    const expired = records.find(
      (r) =>
        r.seq > bootSeq &&
        r.kind === "claim.asserted" &&
        (r.data as { method?: string }).method === "expiry",
    );
    const nextManifest = records.find((r) => r.seq > bootSeq && r.kind === "manifest.recorded");
    expect(expired).toBeDefined();
    expect(expired?.seq).toBeLessThan(nextManifest?.seq ?? Infinity);
    await rt.close();
  });

  it("a running host is woken by its clock when the expectation falls due", async () => {
    const clock = new ManualClock();
    const rt = await openRuntime(tempDir(), clock, undefined, undefined, undefined, "external");
    const h = host(rt, "host-a");
    await startOn(h);
    const due = h.nextWake("P1") as string;
    clock.advance(Date.parse(due) - Date.parse(clock.now()) + 1);
    h.tick();
    await h.idle();
    const records = await rt.store.read(processStream("P1"));
    expect(
      records.some(
        (r) => r.kind === "claim.asserted" && (r.data as { method?: string }).method === "expiry",
      ),
    ).toBe(true);
    await rt.close();
  });

  it("the backoff after a failed model call is read from records, so a new host honours it", async () => {
    let calls = 0;
    const inner = new ScriptedTutorFaculty();
    const flaky: ModelFaculty = {
      id: "flaky@1",
      model: "flaky@1",
      async respond(request: FacultyRequest): Promise<FacultyResponse> {
        calls++;
        if (calls <= 2) throw new FacultyError("flaky: 503", "rejected", true);
        return inner.respond(request);
      },
    };
    const clock = new ManualClock();
    const rt = await openRuntime(tempDir(), clock, undefined, undefined, undefined, "external");
    const a = host(rt, "host-a", flaky);
    await startOn(a);
    expect(calls).toBe(1);
    expect(a.nextWake("P1")).toBe(new Date(Date.parse(clock.now()) + 1_000).toISOString());

    const b = host(rt, "host-b", flaky);
    await b.boot();
    await b.idle();
    expect(calls).toBe(1); // the new host waits out the recorded backoff instead of calling again

    clock.advance(1_000);
    b.tick();
    await b.idle();
    expect(calls).toBe(2);
    expect(b.nextWake("P1")).toBe(new Date(Date.parse(clock.now()) + 2_000).toISOString());
    clock.advance(2_000);
    b.tick();
    await b.idle();
    expect(calls).toBeGreaterThanOrEqual(3);
    const records = await rt.store.read(processStream("P1"));
    expect(records.some((r) => r.kind === "step.completed")).toBe(true);
    await rt.close();
  });
});

describe("deploy overlap", () => {
  it("the newest host takes over; the old one lets go at its first fenced write; no effect repeats", async () => {
    const clock = new ManualClock();
    const rt = await openRuntime(tempDir(), clock, undefined, undefined, undefined, "external");
    const oldHost = host(rt, "host-old");
    await startOn(oldHost);
    const newHost = host(rt, "host-new");
    expect(await newHost.boot()).toEqual(["P1"]);
    await newHost.idle();

    await rt.learner?.answer();
    oldHost.ring("P1"); // the old host still believes it owns P1
    newHost.ring("P1");
    await Promise.all([oldHost.idle(), newHost.idle()]);
    expect(oldHost.owns("P1")).toBe(false);
    expect(newHost.owns("P1")).toBe(true);

    for (let turn = 0; turn < 40; turn++) {
      if ((await rt.store.read(processStream("P1"))).some((r) => r.kind === "process.concluded"))
        break;
      await rt.learner?.answer();
      newHost.ring("P1");
      await newHost.idle();
    }
    const records = await rt.store.read(processStream("P1"));
    expect(records.some((r) => r.kind === "process.concluded")).toBe(true);
    expect([...rt.env.channel.keyCounts().values()].every((n) => n === 1)).toBe(true);
    await rt.close();
  }, 120_000);
});
