import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { PostgresCausalStore } from "@uci/adapters";
import { type PgServer, startPg } from "@uci/adapters/testing";
import { ScriptedTutorFaculty } from "@uci/env-tutor";
import { PROCESS_KINDS, processStream } from "@uci/harness";
import { Host } from "@uci/host";
import { type CausalRecord, ManualClock } from "@uci/kernel";
import {
  DEFAULT_ENVELOPE,
  OBJECTIVE,
  openRuntime,
  sqliteStore,
  type StoreFactory,
} from "../../src/index.js";
import { cleanup, tempDir } from "./helpers.js";

/**
 * The tail cursor a surface streams from (S2 criterion 10): every record of a process exactly once
 * and in order, while the process is driven by one host and then another, on SQLite and on Postgres
 * with NOTIFY on and off (the poll fallback alone must suffice).
 */
afterEach(cleanup);

async function tailAcrossHandoff(store: StoreFactory) {
  const clock = new ManualClock();
  const rt = await openRuntime(tempDir(), clock, undefined, undefined, store);
  const faculty = new ScriptedTutorFaculty();
  const a = new Host({
    store: rt.store,
    clock,
    owner: "host-a",
    env: rt.env,
    faculty,
    maxStepsPerDrain: 3,
  });
  await a.start({
    processId: "P1",
    entityId: "L1",
    envelope: DEFAULT_ENVELOPE,
    grantedBy: "owner",
    objective: OBJECTIVE,
  });

  // A reader that owns nothing tails the process from the beginning.
  const controller = new AbortController();
  const seen: CausalRecord[] = [];
  const reader = new Host({ store: rt.store, clock, owner: "reader", env: rt.env, faculty });
  const tailing = (async () => {
    for await (const r of reader.tail("P1", 0, controller.signal)) {
      seen.push(r);
      if (r.kind === "process.concluded") controller.abort();
    }
  })();

  await a.idle();
  await a.stop(); // host A leaves after three steps; host B takes the process over
  const b = new Host({ store: rt.store, clock, owner: "host-b", env: rt.env, faculty });
  await b.boot();
  await b.idle();
  await Promise.race([tailing, new Promise((r) => setTimeout(r, 15_000))]);
  controller.abort();

  const all = await rt.store.read(processStream("P1"));
  expect(all.some((r) => r.kind === "process.concluded")).toBe(true);
  expect(seen.map((r) => r.seq)).toEqual(all.map((r) => r.seq));
  expect(new Set(seen.map((r) => r.seq)).size).toBe(seen.length);
  await rt.close();
}

describe("tail cursor", () => {
  it("sqlite: every record exactly once, in order, across a host handoff", async () => {
    await tailAcrossHandoff(sqliteStore);
  }, 60_000);

  describe("postgres", () => {
    let server: PgServer | undefined;
    let url = "";
    beforeAll(async () => {
      server = await startPg("cli-tail");
      url = await server.database("tail");
    }, 180_000);
    afterAll(async () => {
      await server?.stop();
    });
    let schema = 0;
    const pgStore =
      (listen: boolean): StoreFactory =>
      () =>
        PostgresCausalStore.open({
          connectionString: url,
          schema: `tail_${++schema}`,
          registry: PROCESS_KINDS,
          listen,
          max: 4,
        });

    it("with NOTIFY: every record exactly once, in order, across a host handoff", async () => {
      await tailAcrossHandoff(pgStore(true));
    }, 60_000);

    it("without NOTIFY (poll fallback only): the same", async () => {
      await tailAcrossHandoff(pgStore(false));
    }, 60_000);
  });
});
