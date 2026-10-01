import { defineKind, KindRegistry, shape, str } from "./kinds.js";
import { LEASE_KINDS } from "./lease.js";
import type { CausalStore, StreamMeta } from "./store.js";

/**
 * The CausalStore contract as executable checks. Every engine must pass it. Each check throws on
 * the first violated invariant, so a test simply awaits the suite.
 *
 * `open` must return a store over the same backing data each time it is called (that is how
 * durability across reopen is checked); stores are closed by the suite.
 */
export const CONFORMANCE_KINDS = new KindRegistry([
  ...LEASE_KINDS,
  defineKind("conf.note", 1, shape({ text: str })),
]);

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`causal-store conformance: ${message}`);
}

async function rejects(p: Promise<unknown>, name: string, message: string): Promise<void> {
  try {
    await p;
  } catch (e) {
    assert(e instanceof Error && e.name === name, `${message}: expected ${name}, got ${String(e)}`);
    return;
  }
  throw new Error(`causal-store conformance: ${message}: expected ${name}, but it resolved`);
}

export async function runCausalStoreConformance(open: () => Promise<CausalStore>): Promise<void> {
  const meta: StreamMeta = { processId: "P-conf", entityId: "E-conf" };
  const at = "2026-01-01T00:00:00.000Z";
  const stream = "process/P-conf";
  const note = (text: string) => ({ kind: "conf.note", v: 1, data: { text } });

  const store = await open();
  const { fence, record: lease } = await store.claim(stream, "owner-a", at, meta);
  assert(lease.seq === 1 && lease.kind === "lease.claimed", "claim appends lease.claimed as seq 1");
  assert(fence.token >= 1, "claim returns a positive fence token");

  // Gap-free seqs, envelope stamped, labels and causes preserved.
  const appended = await store.append({
    stream,
    meta,
    expectedSeq: 1,
    fence,
    at,
    drafts: [
      note("a"),
      { ...note("b"), labels: ["consent:learning", "pii"], causes: [{ stream, seq: 1 }] },
    ],
  });
  assert(appended.map((r) => r.seq).join() === "2,3", "seqs continue gap-free");
  assert(appended[1]?.labels.join() === "consent:learning,pii", "labels preserved");
  assert(appended[1]?.causes[0]?.seq === 1, "causes preserved");
  assert(
    appended[0]?.processId === "P-conf" && appended[0]?.entityId === "E-conf",
    "envelope stamped",
  );

  // Expected-seq guard.
  await rejects(
    store.append({ stream, meta, expectedSeq: 1, fence, at, drafts: [note("x")] }),
    "SeqConflictError",
    "stale expectedSeq",
  );

  // Validation at write, atomic batches: one invalid draft means nothing in the batch commits.
  await rejects(
    store.append({
      stream,
      meta,
      expectedSeq: 3,
      fence,
      at,
      drafts: [note("ok"), { kind: "conf.note", v: 1, data: { text: 1 } }],
    }),
    "InvalidRecordError",
    "invalid draft",
  );
  await rejects(
    store.append({
      stream,
      meta,
      expectedSeq: 3,
      fence,
      at,
      drafts: [{ kind: "conf.unknown", v: 1, data: {} }],
    }),
    "InvalidRecordError",
    "unknown kind fails closed",
  );
  assert((await store.read(stream)).length === 3, "rejected batches leave no trace");

  // Fencing: a new claim supersedes the old owner, whose appends must now fail inside the write.
  const { fence: fence2 } = await store.claim(stream, "owner-b", at, meta);
  assert(fence2.token > fence.token, "re-claim bumps the token");
  await rejects(
    store.append({ stream, meta, expectedSeq: 4, fence, at, drafts: [note("zombie")] }),
    "FencedError",
    "zombie append",
  );
  const own = await store.append({
    stream,
    meta,
    expectedSeq: 4,
    fence: fence2,
    at,
    drafts: [note("owner-b")],
  });
  assert(own[0]?.seq === 5, "the new owner appends after its lease record");

  // Content-addressed evidence.
  const h1 = await store.putEvidence("text/plain", "the learner said hello");
  const h2 = await store.putEvidence("text/plain", "the learner said hello");
  assert(h1 === h2, "evidence is content-addressed");
  const ev = await store.getEvidence(h1);
  assert(
    ev?.content === "the learner said hello" && ev.mediaType === "text/plain",
    "evidence round-trips",
  );

  assert((await store.streams("process/")).includes(stream), "streams lists by prefix");
  assert((await store.read(stream, 4)).map((r) => r.seq).join() === "4,5", "read from a seq");
  await store.close();

  // Durability across reopen.
  const reopened = await open();
  const all = await reopened.read(stream);
  assert(all.length === 5, `records survive reopen (got ${all.length})`);
  assert(
    all.every((r, i) => r.seq === i + 1),
    "seqs remain gap-free after reopen",
  );
  await rejects(
    reopened.append({
      stream,
      meta,
      expectedSeq: 5,
      fence,
      at,
      drafts: [note("zombie-after-reopen")],
    }),
    "FencedError",
    "fence survives reopen",
  );
  await reopened.close();
}
