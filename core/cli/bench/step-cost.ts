/**
 * H-PCS2, cost side (journal hypothesis-20261002-aa25): harness overhead per step when the working
 * state is a projection recomputed from records, at L = 100, 1000 and 5000 records in a process's
 * stream, on Postgres (and SQLite for reference); and the time for a host to hydrate 20 processes of
 * 1000 records. The scripted reasoner and the tutor environment take well under a millisecond, so a
 * step's wall time is the harness's overhead. Padding is real recorded evidence written through the
 * single writer path (it is folded like any other evidence).
 *
 *   pnpm --filter @uci/cli exec tsx bench/step-cost.ts            prints one JSON result
 */
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PostgresCausalStore } from "@uci/adapters";
import { startPg } from "@uci/adapters/testing";
import { ScriptedTutorFaculty } from "@uci/env-tutor";
import { type ProcessHandle, PROCESS_KINDS, runStep, startProcess, write } from "@uci/harness";
import { Host } from "@uci/host";
import { evidenceHash, ManualClock } from "@uci/kernel";
import {
  DEFAULT_ENVELOPE,
  OBJECTIVE,
  openRuntime,
  type Runtime,
  sqliteStore,
  type StoreFactory,
} from "../src/index.js";

const SIZES = [100, 1000, 5000];
const PER_SIZE = 2;

async function pad(handle: ProcessHandle, total: number): Promise<void> {
  const batch = 250;
  for (let done = handle.seen?.length ?? 0; done < total; done += batch) {
    const n = Math.min(batch, total - done);
    const evidence = Array.from({ length: n }, (_, i) => ({
      mediaType: "text/plain",
      content: `environment note ${done + i}`,
    }));
    await write(
      handle,
      evidence.map((e, i) => ({
        kind: "evidence.recorded",
        v: 1,
        data: {
          evidenceHash: evidenceHash(e.mediaType, e.content),
          mediaType: e.mediaType,
          source: "environment",
          trust: "data",
          ref: `note-${done + i}`,
        },
      })),
      evidence,
    );
  }
}

const quantile = (xs: number[], q: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))] ?? 0;
};

async function stepCosts(rt: Runtime, size: number, tag: string): Promise<number[]> {
  const times: number[] = [];
  for (let k = 0; k < PER_SIZE; k++) {
    const processId = `B${tag}${size}x${k}`;
    const handle = await startProcess({
      store: rt.store,
      clock: rt.clock,
      processId,
      entityId: "L1",
      owner: "bench",
      envelope: DEFAULT_ENVELOPE,
      grantedBy: "owner",
      objective: OBJECTIVE,
      env: rt.env,
    });
    await pad(handle, size);
    const faculty = new ScriptedTutorFaculty();
    for (let i = 0; i < 40; i++) {
      const t0 = performance.now();
      const o = await runStep({ handle, faculty, env: rt.env });
      times.push(performance.now() - t0);
      if (o.status === "concluded" || o.status === "escalated" || o.status === "waiting") break;
    }
  }
  return times;
}

async function measure(name: string, store: StoreFactory) {
  const rt = await openRuntime(
    mkdtempSync(join(tmpdir(), "uci-bench-")),
    new ManualClock(),
    undefined,
    undefined,
    store,
  );
  const steps: Record<string, { samples: number; p50: number; p95: number; max: number }> = {};
  for (const size of SIZES) {
    const t = await stepCosts(rt, size, name.slice(0, 1));
    steps[`L${size}`] = {
      samples: t.length,
      p50: Math.round(quantile(t, 0.5)),
      p95: Math.round(quantile(t, 0.95)),
      max: Math.round(Math.max(...t)),
    };
  }
  // Hydration: 20 processes of ~1000 records, taken by a fresh host.
  for (let i = 0; i < 20; i++) {
    const handle = await startProcess({
      store: rt.store,
      clock: rt.clock,
      processId: `H${i}`,
      entityId: "L1",
      owner: "bench",
      envelope: DEFAULT_ENVELOPE,
      grantedBy: "owner",
      objective: OBJECTIVE,
      env: rt.env,
    });
    await pad(handle, 1000);
  }
  const host = new Host({
    store: rt.store,
    clock: rt.clock,
    owner: "bench-host",
    env: rt.env,
    faculty: new ScriptedTutorFaculty(),
  });
  const t0 = performance.now();
  const taken = await host.boot();
  const hydrateMs = Math.round(performance.now() - t0);
  await host.stop();
  await rt.close();
  return { engine: name, steps, hydrate: { processes: taken.length, ms: hydrateMs } };
}

const server = await startPg("cli-bench");
const url = await server.database("bench");
const postgres = await measure("postgres", () =>
  PostgresCausalStore.open({ connectionString: url, registry: PROCESS_KINDS, max: 8 }),
);
const sqlite = await measure("sqlite", sqliteStore);
await server.stop();
const pass = {
  "p95 <= 150ms at L1000": (postgres.steps["L1000"]?.p95 ?? Infinity) <= 150,
  "p95 <= 600ms at L5000": (postgres.steps["L5000"]?.p95 ?? Infinity) <= 600,
  "20 x L1000 hydrate <= 5s": postgres.hydrate.ms <= 5000,
};
console.log(JSON.stringify({ hypothesis: "H-PCS2 cost side", postgres, sqlite, pass }, null, 2));
