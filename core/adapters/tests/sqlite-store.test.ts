import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import {
  CONFORMANCE_KINDS,
  KERNEL_KINDS,
  KindRegistry,
  defineKind,
  runCausalStoreConformance,
  shape,
  str,
} from "@uci/kernel";
import { SqliteCausalStore } from "../src/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const dirs: string[] = [];
const tempDb = () => {
  const dir = mkdtempSync(join(tmpdir(), "uci-sqlite-"));
  dirs.push(dir);
  return join(dir, "uci.sqlite");
};
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe("SqliteCausalStore", () => {
  it("satisfies the causal-store conformance suite", async () => {
    const path = tempDb();
    await runCausalStoreConformance(() =>
      SqliteCausalStore.open(path, { registry: CONFORMANCE_KINDS }),
    );
  });

  it("a kill inside an open write transaction loses nothing committed and leaks nothing uncommitted", async () => {
    const path = tempDb();
    const registry = new KindRegistry([
      ...KERNEL_KINDS,
      defineKind("crash.note", 1, shape({ text: str })),
    ]);
    for (let run = 0; run < 3; run++) {
      const marker = join(dirname(path), `held-${run}`);
      const child = spawn(
        process.execPath,
        [
          "--disable-warning=ExperimentalWarning",
          "--import",
          "tsx",
          join(here, "fixtures", "crash-child.ts"),
          path,
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
        if (Date.now() - started > 30_000)
          throw new Error(`child never reached the crash point: ${stderr}`);
        await new Promise((r) => setTimeout(r, 25));
      }
      child.kill(); // SIGKILL-equivalent on Windows (TerminateProcess)
      await new Promise((r) => child.once("exit", r));
    }

    const store = await SqliteCausalStore.open(path, { registry });
    const records = await store.read("process/P-crash");
    await store.close();
    const texts = records
      .filter((r) => r.kind === "crash.note")
      .map((r) => (r.data as { text: string }).text);
    // 3 runs: each claims (1 lease record) and commits run+1 notes: 1+2+3 = 6 notes, 3 leases.
    expect(texts).toHaveLength(6);
    expect(texts.some((t) => t.startsWith("uncommitted"))).toBe(false);
    expect(records.filter((r) => r.kind === "lease.claimed")).toHaveLength(3);
    expect(records.every((r, i) => r.seq === i + 1)).toBe(true);
  }, 120_000);
});
