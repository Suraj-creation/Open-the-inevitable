import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  CONFORMANCE_KINDS,
  defineKind,
  KERNEL_KINDS,
  KindRegistry,
  runCausalStoreConformance,
  runConcurrencyConformance,
  shape,
  str,
} from "@uci/kernel";
import { MIGRATIONS, PostgresCausalStore } from "../src/index.js";
import { type PgServer, startPg } from "../src/testing.js";

/**
 * The Postgres causal store against the same contract as SQLite (S2 criteria 1 and 2): conformance
 * v2, a seeded race of two instances, checksummed and lock-serialised migrations, and a real kill
 * inside an open transaction.
 */
const here = dirname(fileURLToPath(import.meta.url));
let server: PgServer;
beforeAll(async () => {
  server = await startPg("adapters");
}, 180_000);
afterAll(async () => {
  await server?.stop();
});

describe("PostgresCausalStore", () => {
  it("satisfies the causal-store conformance suite", async () => {
    const url = await server.database("conformance");
    await runCausalStoreConformance((o) =>
      PostgresCausalStore.open({
        connectionString: url,
        registry: o?.registry ?? CONFORMANCE_KINDS,
        max: 4,
        ...(o?.beforeCommit ? { beforeCommit: o.beforeCommit } : {}),
      }),
    );
  }, 120_000);

  it("keeps every invariant when two instances race claims, appends and admissions", async () => {
    const url = await server.database("race");
    const report = await runConcurrencyConformance(
      (o) =>
        PostgresCausalStore.open({
          connectionString: url,
          registry: o?.registry ?? CONFORMANCE_KINDS,
          max: 8,
        }),
      { operations: 1200, seed: 20261002, parallel: 8 },
    );
    expect(report.acknowledgedAppends).toBeGreaterThan(100);
    expect(report.fencedRejections).toBeGreaterThan(0);
    expect(report.duplicateAdmissions).toBeGreaterThan(0);
  }, 300_000);

  it("migrations are applied once under concurrent starters, recorded with checksums, and refuse drift", async () => {
    const url = await server.database("migrations");
    const stores = await Promise.all(
      Array.from({ length: 4 }, () =>
        PostgresCausalStore.open({ connectionString: url, registry: CONFORMANCE_KINDS, max: 2 }),
      ),
    );
    for (const s of stores) await s.close();
    const client = new pg.Client({ connectionString: url });
    await client.connect();
    const rows = await client.query("select version, checksum from uci.schema_migrations");
    expect(rows.rows.map((r) => r.version)).toEqual(MIGRATIONS.map((m) => m.version));
    await client.query("update uci.schema_migrations set checksum = 'tampered' where version = 1");
    await client.end();
    await expect(
      PostgresCausalStore.open({ connectionString: url, registry: CONFORMANCE_KINDS, max: 2 }),
    ).rejects.toThrow(/changed after it was applied/);
  }, 120_000);

  it("a kill inside an open write transaction loses nothing committed and leaks nothing uncommitted", async () => {
    const url = await server.database("crash");
    const registry = new KindRegistry([
      ...KERNEL_KINDS,
      defineKind("crash.note", 1, shape({ text: str })),
    ]);
    const markers = mkdtempSync(join(tmpdir(), "uci-pg-crash-"));
    try {
      for (let run = 0; run < 3; run++) {
        const marker = join(markers, `held-${run}`);
        const child = spawn(
          process.execPath,
          [
            "--import",
            "tsx",
            join(here, "fixtures", "crash-child-pg.ts"),
            url,
            marker,
            String(run + 1),
          ],
          { cwd: join(here, ".."), stdio: ["ignore", "ignore", "pipe"] },
        );
        let stderr = "";
        child.stderr.on("data", (d: Buffer) => (stderr += d.toString()));
        const started = Date.now();
        while (!existsSync(marker)) {
          if (child.exitCode !== null) throw new Error(`child exited early: ${stderr}`);
          if (Date.now() - started > 60_000)
            throw new Error(`child never reached the crash point: ${stderr}`);
          await new Promise((r) => setTimeout(r, 25));
        }
        child.kill();
        await new Promise((r) => child.once("exit", r));
      }
      const store = await PostgresCausalStore.open({ connectionString: url, registry, max: 2 });
      const records = await store.read("process/P-crash");
      await store.close();
      const texts = records
        .filter((r) => r.kind === "crash.note")
        .map((r) => (r.data as { text: string }).text);
      expect(texts).toEqual([
        "committed-0",
        "committed-0",
        "committed-1",
        "committed-0",
        "committed-1",
        "committed-2",
      ]);
      expect(records.every((r, i) => r.seq === i + 1)).toBe(true);
    } finally {
      rmSync(markers, { recursive: true, force: true });
    }
  }, 300_000);
});
