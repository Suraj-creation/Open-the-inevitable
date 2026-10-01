/**
 * The causal record. Every cognitively consequential transition is one of these: durable, causally
 * linked, self-describing (`kind` + `v`), carrying the whole post-change value, and interpretable
 * without the code that wrote it. Records are never edited; a revision is a new record that cites
 * what it supersedes.
 */

/** Address of one record: a stream and its gap-free, 1-based sequence number. */
export interface RecordRef {
  readonly stream: string;
  readonly seq: number;
}

/**
 * Consent, sensitivity and trust labels. A derived record carries the join (union) of the labels of
 * everything it was derived from, so a label applied at capture follows every derivation.
 */
export type Labels = readonly string[];

export interface CausalRecord<D = unknown> {
  readonly stream: string;
  readonly seq: number;
  readonly kind: string;
  readonly v: number;
  /** ISO-8601 UTC instant from the world clock at append time. */
  readonly at: string;
  readonly processId: string;
  /** The entity (person, project, agent identity) that owns long-lived state the process cites. */
  readonly entityId: string;
  readonly labels: Labels;
  readonly causes: readonly RecordRef[];
  readonly data: D;
}

/** What a writer supplies; the store assigns stream position and envelope fields. */
export interface Draft<D = unknown> {
  readonly kind: string;
  readonly v: number;
  readonly data: D;
  readonly causes?: readonly RecordRef[];
  readonly labels?: Labels;
}

export function refOf(record: Pick<CausalRecord, "stream" | "seq">): RecordRef {
  return { stream: record.stream, seq: record.seq };
}

export function refKey(ref: RecordRef): string {
  return `${ref.stream}#${ref.seq}`;
}

/** Sorted, de-duplicated union. Pure: the same inputs always yield the same labels. */
export function joinLabels(...sets: readonly Labels[]): Labels {
  return [...new Set(sets.flat())].sort();
}
