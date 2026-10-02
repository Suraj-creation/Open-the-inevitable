import type { CausalRecord, Draft } from "./record.js";

/** Proof of ownership of one stream. Every append must present the current token. */
export interface FenceToken {
  readonly stream: string;
  readonly token: number;
}

export interface StreamMeta {
  readonly processId: string;
  readonly entityId: string;
}

/** Evidence written in the same transaction as the records that cite it, scoped to the stream's entity. */
export interface EvidenceDraft {
  readonly mediaType: string;
  readonly content: string;
  /** Consent and provenance labels carried by the content (e.g. `consent:learning`). */
  readonly labels?: readonly string[];
}

export interface AppendRequest {
  readonly stream: string;
  readonly meta: StreamMeta;
  /** The seq of the last record the writer has seen; the append fails if the stream moved. */
  readonly expectedSeq: number;
  readonly fence: FenceToken;
  /** World-clock instant stamped on every record in the batch. */
  readonly at: string;
  readonly drafts: readonly Draft[];
  /** Evidence committed atomically with the batch, under `meta.entityId`. */
  readonly evidence?: readonly EvidenceDraft[];
}

/**
 * Admission: an input enters an unfenced `inbox/<processId>` stream, idempotent by `key` (a resubmitted
 * or retried input is admitted once). Written by the channel, never by the process; delivered by the
 * process at its next step boundary.
 */
export interface AdmitRequest {
  readonly stream: string;
  readonly meta: StreamMeta;
  readonly at: string;
  /** Client idempotency key: the same key on the same stream is the same admission. */
  readonly key: string;
  readonly draft: Draft;
  readonly evidence?: readonly EvidenceDraft[];
}

export interface Admitted {
  readonly record: CausalRecord;
  /** True when the key had already been admitted: `record` is the original admission. */
  readonly duplicate: boolean;
}

export interface Evidence {
  readonly hash: string;
  readonly mediaType: string;
  /** Empty once forgotten. */
  readonly content: string;
  readonly labels: readonly string[];
  /** The entity asked for this content to be forgotten: the hash remains, the content is gone. */
  readonly forgotten: boolean;
}

/** A record committed somewhere under a watched prefix. */
export interface StoreChange {
  readonly stream: string;
  readonly seq: number;
}

/** Admission streams: unfenced, idempotent by key, never claimed. */
export const INBOX_PREFIX = "inbox/";

/**
 * The durable causal record store. One implementation per engine (SQLite, Postgres); all must pass
 * `runCausalStoreConformance`. Guarantees:
 * - a batch is atomic: records, their evidence and a claim's first records commit or none do;
 * - the fence is checked inside the write transaction, so a superseded owner can never commit;
 * - seqs are gap-free per stream; every draft is validated at write and every record at read
 *   (an unknown kind fails closed); every cause must name an existing record;
 * - admission is idempotent by key and needs no fence;
 * - evidence is content-addressed per entity; forgetting removes one entity's content only.
 */
export interface CausalStore {
  /**
   * Take ownership of a stream: bumps the fence token and appends `lease.claimed` plus `drafts`
   * atomically (so a process is started in one commit, never half-created).
   */
  claim(
    stream: string,
    owner: string,
    at: string,
    meta: StreamMeta,
    drafts?: readonly Draft[],
  ): Promise<{ fence: FenceToken; record: CausalRecord; records: CausalRecord[] }>;
  append(request: AppendRequest): Promise<CausalRecord[]>;
  admit(request: AdmitRequest): Promise<Admitted>;
  read(stream: string, fromSeq?: number): Promise<CausalRecord[]>;
  streams(prefix: string): Promise<string[]>;
  /** Evidence written outside a batch (for content that no record cites yet). */
  putEvidence(
    entityId: string,
    mediaType: string,
    content: string,
    labels?: readonly string[],
  ): Promise<string>;
  getEvidence(entityId: string, hash: string): Promise<Evidence | undefined>;
  /** Tombstone every piece of this entity's evidence content; returns how many were forgotten. */
  forget(entityId: string): Promise<number>;
  /** Changes under `prefix` until `signal` aborts. A doorbell, not a log: re-read the stream to act. */
  watch(prefix: string, signal: AbortSignal): AsyncIterable<StoreChange>;
  close(): Promise<void>;
}

export class FencedError extends Error {
  override readonly name = "FencedError";
}

export class SeqConflictError extends Error {
  override readonly name = "SeqConflictError";
}

export class InvalidRecordError extends Error {
  override readonly name = "InvalidRecordError";
  constructor(readonly violations: readonly string[]) {
    super(`invalid record(s): ${violations.join("; ")}`);
  }
}

/** A request the store refuses by contract (an admission outside inbox/, a claim on an inbox). */
export class StoreContractError extends Error {
  override readonly name = "StoreContractError";
}
