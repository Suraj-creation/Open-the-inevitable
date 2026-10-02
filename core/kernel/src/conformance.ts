import { defineKind, KindRegistry, shape, str } from "./kinds.js";
import { LEASE_KINDS } from "./lease.js";
import type { CausalRecord } from "./record.js";
import type { CausalStore, FenceToken, StreamMeta } from "./store.js";

/**
 * The CausalStore contract as executable checks. Every engine must pass it. Each check throws on
 * the first violated invariant, so a test simply awaits the suite.
 *
 * `open` must return a store over the same backing data each time it is called (that is how
 * durability across reopen and multi-instance races are checked); stores are closed by the suite.
 * It honours `registry` (default CONFORMANCE_KINDS) and `beforeCommit` (runs inside the open write
 * transaction; a throw there must roll the whole batch back).
 */
export const CONFORMANCE_KINDS = new KindRegistry([
  ...LEASE_KINDS,
  defineKind("conf.note", 1, shape({ text: str })),
]);
const EXTENDED_KINDS = new KindRegistry([
  ...LEASE_KINDS,
  defineKind("conf.note", 1, shape({ text: str })),
  defineKind("conf.extra", 1, shape({ text: str })),
]);

export interface ConformanceOptions {
  readonly registry?: KindRegistry;
  readonly beforeCommit?: () => void;
}
export type ConformanceOpen = (options?: ConformanceOptions) => Promise<CausalStore>;

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

const at = "2026-01-01T00:00:00.000Z";
const note = (text: string) => ({ kind: "conf.note", v: 1, data: { text } });

export async function runCausalStoreConformance(open: ConformanceOpen): Promise<void> {
  const meta: StreamMeta = { processId: "P-conf", entityId: "E-conf" };
  const stream = "process/P-conf";

  const store = await open();

  // Claim with first records, atomically; a claim whose drafts are invalid leaves no trace at all.
  const claimed = await store.claim(stream, "owner-a", at, meta, [note("born")]);
  const { fence } = claimed;
  assert(
    claimed.record.seq === 1 && claimed.record.kind === "lease.claimed",
    "claim appends lease.claimed as seq 1",
  );
  assert(claimed.records.map((r) => r.seq).join() === "1,2", "claim drafts follow the lease");
  assert(fence.token >= 1, "claim returns a positive fence token");
  await rejects(
    store.claim(
      "process/P-bad",
      "o",
      at,
      meta,
      [{ kind: "conf.note", v: 1, data: {} }],
      [{ mediaType: "text/plain", content: "evidence of a failed claim" }],
    ),
    "InvalidRecordError",
    "claim with an invalid draft",
  );
  const failedClaimHash = await store.putEvidence(
    "E-elsewhere",
    "text/plain",
    "evidence of a failed claim",
  );
  assert(
    (await store.getEvidence("E-conf", failedClaimHash)) === undefined,
    "a failed claim writes no evidence",
  );
  assert((await store.read("process/P-bad")).length === 0, "a failed claim leaves no records");
  assert(
    (await store.claim("process/P-bad", "o", at, meta)).fence.token === 1,
    "a failed claim does not bump the fence token",
  );

  // Gap-free seqs, envelope stamped, labels and causes preserved; causes may point into the batch.
  const appended = await store.append({
    stream,
    meta,
    expectedSeq: 2,
    fence,
    at,
    drafts: [
      note("a"),
      { ...note("b"), labels: ["consent:learning", "pii"], causes: [{ stream, seq: 3 }] },
    ],
  });
  assert(appended.map((r) => r.seq).join() === "3,4", "seqs continue gap-free");
  assert(appended[1]?.labels.join() === "consent:learning,pii", "labels preserved");
  assert(appended[1]?.causes[0]?.seq === 3, "a cause into the same batch is preserved");
  assert(
    appended[0]?.processId === "P-conf" && appended[0]?.entityId === "E-conf",
    "envelope stamped",
  );

  await rejects(
    store.append({ stream, meta, expectedSeq: 2, fence, at, drafts: [note("x")] }),
    "SeqConflictError",
    "stale expectedSeq",
  );
  await rejects(
    store.append({
      stream,
      meta,
      expectedSeq: 4,
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
      expectedSeq: 4,
      fence,
      at,
      drafts: [{ kind: "conf.unknown", v: 1, data: {} }],
    }),
    "InvalidRecordError",
    "unknown kind fails closed at write",
  );
  await rejects(
    store.append({
      stream,
      meta,
      expectedSeq: 4,
      fence,
      at,
      drafts: [{ ...note("orphan"), causes: [{ stream, seq: 99 }] }],
    }),
    "InvalidRecordError",
    "a cause naming no record",
  );
  assert((await store.read(stream)).length === 4, "rejected batches leave no trace");

  // Ownership: no append without a claim, and a fence works only for its own stream.
  await rejects(
    store.append({
      stream: "process/P-unclaimed",
      meta,
      expectedSeq: 0,
      fence: { stream: "process/P-unclaimed", token: 1 },
      at,
      drafts: [note("x")],
    }),
    "FencedError",
    "append to an unclaimed stream",
  );
  await rejects(
    store.append({ stream: "process/P-bad", meta, expectedSeq: 1, fence, at, drafts: [note("x")] }),
    "FencedError",
    "a fence presented for another stream",
  );

  // Evidence in the batch commits with it, or not at all.
  await rejects(
    store.append({
      stream,
      meta,
      expectedSeq: 4,
      fence,
      at,
      drafts: [{ kind: "conf.note", v: 1, data: {} }],
      evidence: [{ mediaType: "text/plain", content: "never committed" }],
    }),
    "InvalidRecordError",
    "a batch with evidence and an invalid draft",
  );
  const withEvidence = await store.append({
    stream,
    meta,
    expectedSeq: 4,
    fence,
    at,
    drafts: [note("cites evidence")],
    evidence: [{ mediaType: "text/plain", content: "committed with the batch", labels: ["pii"] }],
  });
  assert(withEvidence[0]?.seq === 5, "the batch with evidence appends");
  const putHash = await store.putEvidence("E-conf", "text/plain", "committed with the batch");
  const committed = await store.getEvidence("E-conf", putHash);
  assert(
    committed?.content === "committed with the batch" && committed.labels.join() === "pii",
    "batch evidence round-trips with its labels",
  );
  const neverHash = await store.putEvidence("E-other", "text/plain", "never committed");
  assert(
    (await store.getEvidence("E-conf", neverHash)) === undefined,
    "evidence of a rejected batch was never written",
  );

  // Fencing: a new claim supersedes the old owner, whose appends must now fail inside the write.
  const { fence: fence2 } = await store.claim(stream, "owner-b", at, meta);
  assert(fence2.token > fence.token, "re-claim bumps the token");
  await rejects(
    store.append({ stream, meta, expectedSeq: 6, fence, at, drafts: [note("zombie")] }),
    "FencedError",
    "zombie append",
  );
  const own = await store.append({
    stream,
    meta,
    expectedSeq: 6,
    fence: fence2,
    at,
    drafts: [note("owner-b")],
  });
  assert(own[0]?.seq === 7, "the new owner appends after its lease record");

  // Content-addressed evidence, scoped per entity; forgetting one entity leaves the other intact.
  const h1 = await store.putEvidence("E-conf", "text/plain", "an input said hello");
  const h2 = await store.putEvidence("E-conf", "text/plain", "an input said hello");
  const h3 = await store.putEvidence("E-twin", "text/plain", "an input said hello", ["x"]);
  assert(h1 === h2 && h2 === h3, "evidence is content-addressed");
  const ev = await store.getEvidence("E-conf", h1);
  assert(
    ev?.content === "an input said hello" && ev.mediaType === "text/plain" && !ev.forgotten,
    "evidence round-trips",
  );
  assert((await store.getEvidence("E-conf", "0".repeat(64))) === undefined, "missing evidence");
  const forgotten = await store.forget("E-conf");
  assert(forgotten >= 2, `forget tombstones the entity's evidence (got ${forgotten})`);
  const gone = await store.getEvidence("E-conf", h1);
  assert(
    gone?.forgotten === true && gone.content === "",
    "forgotten content is gone, its hash kept",
  );
  const twin = await store.getEvidence("E-twin", h3);
  assert(
    twin?.content === "an input said hello" && !twin.forgotten,
    "another entity's copy survives",
  );
  assert((await store.read(stream)).length === 7, "forgetting evidence keeps the records");

  // Forgetting by label removes only content carrying it.
  const said = await store.putEvidence("E-label", "text/plain", "what the person said", [
    "consent:learning",
  ]);
  const described = await store.putEvidence("E-label", "application/json", '{"actions":[]}');
  assert((await store.forget("E-label", "consent:")) === 1, "forget by label prefix");
  assert(
    (await store.getEvidence("E-label", said))?.forgotten === true,
    "labelled content forgotten",
  );
  assert(
    (await store.getEvidence("E-label", described))?.forgotten === false,
    "unlabelled content kept",
  );

  // Admission: unfenced, idempotent by key, only on inbox/ streams; an inbox is never claimed.
  const inbox = "inbox/P-conf";
  const admit = (key: string, text: string) =>
    store.admit({ stream: inbox, meta, at, key, draft: note(text) });
  const a1 = await admit("k1", "first");
  const again = await admit("k1", "first, resubmitted");
  const a2 = await admit("k2", "second");
  assert(a1.record.seq === 1 && !a1.duplicate, "first admission is seq 1");
  assert(again.duplicate && again.record.seq === 1, "the same key is the same admission");
  assert(
    (again.record.data as { text: string }).text === "first",
    "a duplicate returns the original admission",
  );
  assert(a2.record.seq === 2 && !a2.duplicate, "a new key is a new admission");
  await rejects(
    store.admit({ stream, meta, at, key: "k", draft: note("x") }),
    "StoreContractError",
    "admission to a process stream",
  );
  await rejects(store.claim(inbox, "o", at, meta), "StoreContractError", "claiming an inbox");
  await rejects(
    store.admit({
      stream: inbox,
      meta,
      at,
      key: "k3",
      draft: { kind: "conf.note", v: 1, data: {} },
    }),
    "InvalidRecordError",
    "an invalid admission",
  );
  assert(!(await admit("k3", "valid on retry")).duplicate, "a refused admission consumes no key");

  assert((await store.streams("process/")).includes(stream), "streams lists by prefix");
  assert((await store.read(stream, 6)).map((r) => r.seq).join() === "6,7", "read from a seq");

  // Watch: a commit under the prefix rings the doorbell.
  const controller = new AbortController();
  const seen: string[] = [];
  const watching = (async () => {
    for await (const change of store.watch("process/", controller.signal)) {
      seen.push(`${change.stream}#${change.seq}`);
      controller.abort();
    }
  })();
  await new Promise((r) => setTimeout(r, 20));
  await store.append({
    stream,
    meta,
    expectedSeq: 7,
    fence: fence2,
    at,
    drafts: [note("rings")],
  });
  await Promise.race([watching, new Promise((r) => setTimeout(r, 3000))]);
  controller.abort();
  assert(
    seen.includes(`${stream}#8`),
    `watch delivers the commit (saw ${seen.join(",") || "none"})`,
  );
  await store.close();

  // A throw inside the open write transaction rolls the whole batch back.
  const failing = await open({
    beforeCommit: () => {
      throw new Error("crash inside the transaction");
    },
  });
  await rejects(
    failing.append({ stream, meta, expectedSeq: 8, fence: fence2, at, drafts: [note("lost")] }),
    "Error",
    "a failure before commit",
  );
  await failing.close();

  // Read-side validation: a record of a kind this registry does not know fails closed.
  const extended = await open({ registry: EXTENDED_KINDS });
  const { fence: fx } = await extended.claim("process/P-extra", "o", at, meta);
  await extended.append({
    stream: "process/P-extra",
    meta,
    expectedSeq: 1,
    fence: fx,
    at,
    drafts: [{ kind: "conf.extra", v: 1, data: { text: "from a newer writer" } }],
  });
  await extended.close();

  // Durability across reopen.
  const reopened = await open();
  const all = await reopened.read(stream);
  assert(
    all.length === 8,
    `records survive reopen, the rolled-back batch did not (got ${all.length})`,
  );
  assert(
    all.every((r, i) => r.seq === i + 1),
    "seqs remain gap-free after reopen",
  );
  await rejects(
    reopened.append({
      stream,
      meta,
      expectedSeq: 8,
      fence,
      at,
      drafts: [note("zombie-after-reopen")],
    }),
    "FencedError",
    "fence survives reopen",
  );
  await rejects(
    reopened.read("process/P-extra"),
    "InvalidRecordError",
    "an unknown kind fails closed at read",
  );
  await reopened.close();
}

export interface ConcurrencyReport {
  readonly operations: number;
  readonly acknowledgedAppends: number;
  readonly fencedRejections: number;
  readonly seqConflicts: number;
  readonly admissions: number;
  readonly duplicateAdmissions: number;
}

/** Deterministic PRNG (mulberry32): the same seed replays the same interleaving request. */
function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Two store instances over the same backing race claims, appends and admissions in seeded random
 * batches. Afterwards, for every stream: seqs are gap-free; every acknowledged append is present
 * with its data; no note was committed under a token other than the one current at its position
 * (a fenced owner never commits); every admission key maps to exactly one record.
 */
export async function runConcurrencyConformance(
  open: ConformanceOpen,
  options: { readonly operations: number; readonly seed: number; readonly parallel?: number },
): Promise<ConcurrencyReport> {
  const rand = prng(options.seed);
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)] as T;
  const stores = [await open(), await open()];
  const streams = ["process/R1", "process/R2", "process/R3"];
  const meta: StreamMeta = { processId: "P-race", entityId: "E-race" };
  const owned = new Map<string, { fence: FenceToken; who: number }>();
  const acked: CausalRecord[] = [];
  const admissions = new Map<string, number>();
  let fenced = 0;
  let conflicts = 0;
  let admitted = 0;
  let duplicates = 0;

  const operation = async (): Promise<void> => {
    const who = Math.floor(rand() * 2);
    const store = stores[who] as CausalStore;
    const stream = pick(streams);
    const roll = rand();
    if (roll < 0.15 || !owned.has(stream)) {
      const { fence } = await store.claim(stream, `owner-${who}`, at, meta);
      owned.set(stream, { fence, who });
    } else if (roll < 0.75) {
      const mine = owned.get(stream);
      // Sometimes present a fence this instance does not hold (a zombie that missed a re-claim).
      const fence = mine && (mine.who === who || rand() < 0.3) ? mine.fence : { stream, token: 1 };
      const last = (await store.read(stream)).at(-1)?.seq ?? 0;
      try {
        const records = await store.append({
          stream,
          meta,
          expectedSeq: last,
          fence,
          at,
          drafts: [note(`token:${fence.token}`)],
        });
        acked.push(...records);
      } catch (e) {
        const name = (e as Error).name;
        if (name === "FencedError") fenced++;
        else if (name === "SeqConflictError") conflicts++;
        else throw e;
      }
    } else {
      const key = `k${Math.floor(rand() * 40)}`;
      const r = await store.admit({ stream: "inbox/P-race", meta, at, key, draft: note(key) });
      if (r.duplicate) {
        duplicates++;
        assert(
          admissions.get(key) === r.record.seq,
          `duplicate admission ${key} returned another record`,
        );
      } else {
        admitted++;
        assert(!admissions.has(key), `key ${key} admitted twice`);
        admissions.set(key, r.record.seq);
      }
    }
  };

  const parallel = options.parallel ?? 4;
  for (let done = 0; done < options.operations; done += parallel)
    await Promise.all(
      Array.from({ length: Math.min(parallel, options.operations - done) }, () => operation()),
    );

  const reader = stores[0] as CausalStore;
  for (const stream of streams) {
    const records = await reader.read(stream);
    assert(
      records.every((r, i) => r.seq === i + 1),
      `${stream}: seqs are gap-free`,
    );
    let token = 0;
    for (const r of records) {
      if (r.kind === "lease.claimed") token = (r.data as { token: number }).token;
      else
        assert(
          (r.data as { text: string }).text === `token:${token}`,
          `${stream}#${r.seq}: committed under a token that was not current`,
        );
    }
  }
  for (const a of acked) {
    const found = (await reader.read(a.stream, a.seq))[0];
    assert(
      found && JSON.stringify(found.data) === JSON.stringify(a.data),
      `acknowledged append ${a.stream}#${a.seq} is missing`,
    );
  }
  const inbox = await reader.read("inbox/P-race");
  assert(
    inbox.length === admitted,
    `every admission is one record (${inbox.length} vs ${admitted})`,
  );
  assert(
    new Set(inbox.map((r) => (r.data as { text: string }).text)).size === inbox.length,
    "no admission key appears twice",
  );
  for (const s of stores) await s.close();
  return {
    operations: options.operations,
    acknowledgedAppends: acked.length,
    fencedRejections: fenced,
    seqConflicts: conflicts,
    admissions: admitted,
    duplicateAdmissions: duplicates,
  };
}
