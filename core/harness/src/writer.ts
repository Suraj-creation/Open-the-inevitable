import {
  type CausalRecord,
  type CausalStore,
  type Clock,
  type Draft,
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
}

export const processStream = (processId: string): string => `process/${processId}`;

export async function readProcess(
  h: Pick<ProcessHandle, "store" | "stream">,
): Promise<CausalRecord[]> {
  return h.store.read(h.stream);
}

/**
 * The single writer path. Checks ledger and substrate rules against the current stream, then
 * appends with the fence and the expected seq, so the check and the commit cannot be interleaved
 * with another writer (a superseded owner fails at the fence; a racing append fails at the seq).
 */
export async function write(h: ProcessHandle, drafts: readonly Draft[]): Promise<CausalRecord[]> {
  if (!drafts.length) return [];
  const records = await readProcess(h);
  const violations: string[] = [];
  let working: CausalRecord[] = records;
  for (const draft of drafts) {
    violations.push(...ledgerViolations(foldLedger(working), draft));
    working = [...working, pseudo(draft, (working.at(-1)?.seq ?? 0) + 1)];
  }
  violations.push(...substrateViolations(records, drafts));
  if (violations.length) throw new InvalidRecordError(violations);
  return h.store.append({
    stream: h.stream,
    meta: h.meta,
    expectedSeq: records.at(-1)?.seq ?? 0,
    fence: h.fence,
    at: h.clock.now(),
    drafts,
  });
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
