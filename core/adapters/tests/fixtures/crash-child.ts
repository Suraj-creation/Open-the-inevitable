/**
 * Crash-test child: commits `committed` batches, then opens one more write transaction and blocks
 * inside it (after the inserts, before COMMIT), signalling the parent through a marker file. The
 * parent kills this process while it is held there.
 */
import { closeSync, openSync, writeSync } from "node:fs";
import { KERNEL_KINDS, KindRegistry, defineKind, shape, str } from "@uci/kernel";
import { SqliteCausalStore } from "../../src/index.js";

const [dbPath, marker, committedArg] = process.argv.slice(2) as [string, string, string];
const committed = Number(committedArg);
const registry = new KindRegistry([
  ...KERNEL_KINDS,
  defineKind("crash.note", 1, shape({ text: str })),
]);
let armed = false;

const store = await SqliteCausalStore.open(dbPath, {
  registry,
  beforeCommit: () => {
    if (!armed) return;
    const fd = openSync(marker, "w");
    writeSync(fd, "held");
    closeSync(fd);
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0);
  },
});
const meta = { processId: "P-crash", entityId: "E-crash" };
const stream = "process/P-crash";
const at = "2026-01-01T00:00:00.000Z";
const { fence } = await store.claim(stream, `child-${process.pid}`, at, meta);
let last = (await store.read(stream)).length;
for (let i = 0; i < committed; i++) {
  const out = await store.append({
    stream,
    meta,
    expectedSeq: last,
    fence,
    at,
    drafts: [{ kind: "crash.note", v: 1, data: { text: `committed-${i}` } }],
  });
  last = out.at(-1)?.seq ?? last;
}
armed = true;
await store.append({
  stream,
  meta,
  expectedSeq: last,
  fence,
  at,
  drafts: [
    { kind: "crash.note", v: 1, data: { text: "uncommitted-1" } },
    { kind: "crash.note", v: 1, data: { text: "uncommitted-2" } },
  ],
});
