import {
  type CausalRecord,
  type CausalStore,
  type Clock,
  type Draft,
  type EvidenceDraft,
  evidenceHash,
  type FenceToken,
  foldLedger,
  InvalidRecordError,
  KERNEL_KINDS,
  KindRegistry,
  ledgerViolations,
  type StreamMeta,
} from "@uci/kernel";
import { SUBSTRATE_KINDS, substrateViolations } from "@uci/substrate";
import { HARNESS_KINDS } from "./kinds.js";

/** Every record kind a UCI process stream may contain. Stores are opened with this registry. */
export const PROCESS_KINDS = new KindRegistry([
  ...KERNEL_KINDS,
  ...SUBSTRATE_KINDS,
  ...HARNESS_KINDS,
]);

/** What a step needs to read and write one process stream. Nothing durable lives in it. */
export interface ProcessHandle {
  readonly store: CausalStore;
  readonly stream: string;
  readonly meta: StreamMeta;
  readonly fence: FenceToken;
  readonly clock: Clock;
  /**
   * Residency cache: the records this handle has already read, in order. A cache, never the truth:
   * every read catches up from the store's tail, and a write that raced anything fails at the fence
   * or the expected seq. Absent, every read is a full read.
   */
  readonly seen?: CausalRecord[];
}

export const processStream = (processId: string): string => `process/${processId}`;

/** The process's records: one tail read when the handle has a residency cache. */
export async function readProcess(
  h: Pick<ProcessHandle, "store" | "stream" | "seen">,
): Promise<CausalRecord[]> {
  if (!h.seen) return h.store.read(h.stream);
  h.seen.push(...(await h.store.read(h.stream, (h.seen.at(-1)?.seq ?? 0) + 1)));
  return [...h.seen];
}

/**
 * The single writer path. Checks ledger and substrate rules against the current stream, then
 * appends with the fence and the expected seq, so the check and the commit cannot be interleaved
 * with another writer (a superseded owner fails at the fence; a racing append fails at the seq).
 * Evidence the drafts cite commits in the same transaction.
 */
export async function write(
  h: ProcessHandle,
  drafts: readonly Draft[],
  evidence: readonly EvidenceDraft[] = [],
): Promise<CausalRecord[]> {
  if (!drafts.length) return [];
  const records = await readProcess(h);
  const violations: string[] = [];
  let working: CausalRecord[] = records;
  for (const draft of drafts) {
    violations.push(...ledgerViolations(foldLedger(working), draft));
    // Admission is exactly-once: an input id is delivered to the process at most once, ever.
    if (draft.kind === "input.delivered") {
      const id = (draft.data as { inputId: string }).inputId;
      if (
        working.some(
          (r) => r.kind === "input.delivered" && (r.data as { inputId: string }).inputId === id,
        )
      )
        violations.push(`input ${id} was already delivered`);
    }
    working = [...working, pseudo(draft, (working.at(-1)?.seq ?? 0) + 1)];
  }
  violations.push(...substrateViolations(records, drafts));
  if (violations.length) throw new InvalidRecordError(violations);
  const labelled = await propagateLabels(h, records, drafts, evidence);
  const appended = await h.store.append({
    stream: h.stream,
    meta: h.meta,
    expectedSeq: records.at(-1)?.seq ?? 0,
    fence: h.fence,
    at: h.clock.now(),
    drafts: labelled.drafts,
    evidence: labelled.evidence,
  });
  if (h.seen && (h.seen.at(-1)?.seq ?? 0) === (records.at(-1)?.seq ?? 0)) h.seen.push(...appended);
  return appended;
}

/**
 * Consent labels propagate through every derivation (CLAUDE.md §3): a record carries the union of
 * its own labels and those of every record it names as a cause (in this stream, earlier in the
 * batch, or in another stream such as the inbox), and evidence carries the labels of the record that
 * cites it. Propagation is mechanical at write, so a derived record can never shed a label.
 */
async function propagateLabels(
  h: ProcessHandle,
  records: readonly CausalRecord[],
  drafts: readonly Draft[],
  evidence: readonly EvidenceDraft[],
): Promise<{ drafts: Draft[]; evidence: EvidenceDraft[] }> {
  const local = new Map<number, readonly string[]>(records.map((r) => [r.seq, r.labels]));
  const remote = new Map<string, readonly string[]>();
  for (const c of drafts.flatMap((d) => d.causes ?? [])) {
    const key = `${c.stream}#${c.seq}`;
    if (c.stream === h.stream || remote.has(key)) continue;
    const cause = (await h.store.read(c.stream, c.seq))[0];
    remote.set(key, cause?.seq === c.seq ? cause.labels : []);
  }
  const base = records.at(-1)?.seq ?? 0;
  const out = drafts.map((d, i) => {
    const inherited = (d.causes ?? []).flatMap((c) =>
      c.stream === h.stream ? (local.get(c.seq) ?? []) : (remote.get(`${c.stream}#${c.seq}`) ?? []),
    );
    const labels = [...new Set([...(d.labels ?? []), ...inherited])].sort();
    local.set(base + i + 1, labels);
    return labels.length || d.labels ? { ...d, labels } : d;
  });
  const citing = new Map<string, readonly string[]>();
  for (const d of out)
    if (d.kind === "evidence.recorded")
      citing.set((d.data as { evidenceHash: string }).evidenceHash, d.labels ?? []);
  const labelledEvidence = evidence.map((e) => {
    const cited = citing.get(evidenceHash(e.mediaType, e.content)) ?? [];
    const labels = [...new Set([...(e.labels ?? []), ...cited])].sort();
    return labels.length ? { ...e, labels } : e;
  });
  return { drafts: out, evidence: labelledEvidence };
}

/** Validation the writer applies, for records written by a claim (which bypasses `write`). */
export function draftViolations(
  records: readonly CausalRecord[],
  drafts: readonly Draft[],
): string[] {
  const violations: string[] = [];
  let working: CausalRecord[] = [...records];
  for (const draft of drafts) {
    violations.push(...ledgerViolations(foldLedger(working), draft));
    working = [...working, pseudo(draft, (working.at(-1)?.seq ?? 0) + 1)];
  }
  return [...violations, ...substrateViolations(records, drafts)];
}

function pseudo(draft: Draft, seq: number): CausalRecord {
  return {
    stream: "",
    seq,
    kind: draft.kind,
    v: draft.v,
    at: "",
    processId: "",
    entityId: "",
    labels: [],
    causes: [],
    data: draft.data,
  };
}
