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

export interface AppendRequest {
  readonly stream: string;
  readonly meta: StreamMeta;
  /** The seq of the last record the writer has seen; the append fails if the stream moved. */
  readonly expectedSeq: number;
  readonly fence: FenceToken;
  /** World-clock instant stamped on every record in the batch. */
  readonly at: string;
  readonly drafts: readonly Draft[];
}

export interface Evidence {
  readonly hash: string;
  readonly mediaType: string;
  readonly content: string;
}

/**
 * The durable causal record store. One implementation per engine (SQLite now, Postgres next); all
 * must pass `runCausalStoreConformance`. Guarantees:
 * - an append batch is atomic: all records commit or none do;
 * - the fence is checked inside the write transaction, so a superseded owner can never commit;
 * - seqs are gap-free per stream; every draft is validated against the kind registry at write;
 * - evidence is content-addressed and never mutated.
 */
export interface CausalStore {
  /** Take ownership of a stream: bumps the fence token and appends `lease.claimed` atomically. */
  claim(
    stream: string,
    owner: string,
    at: string,
    meta: StreamMeta,
  ): Promise<{ fence: FenceToken; record: CausalRecord }>;
  append(request: AppendRequest): Promise<CausalRecord[]>;
  read(stream: string, fromSeq?: number): Promise<CausalRecord[]>;
  streams(prefix: string): Promise<string[]>;
  putEvidence(mediaType: string, content: string): Promise<string>;
  getEvidence(hash: string): Promise<Evidence | undefined>;
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
