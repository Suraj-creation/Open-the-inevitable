/**
 * Reference in-memory adapters. These define the canonical semantics every backend adapter must
 * preserve (the conformance harness runs against them in the default offline pipeline). The event
 * transport mirrors the Universal Cognitive Bus (`@inevitable/events`) — the reference per ADR-0005.
 */
import { type Result, ok } from "@inevitable/shared";
import type { CognitiveEvent } from "@inevitable/protocols";
import type { EventTransport, VectorStore } from "@inevitable/contracts";
import { matchSubject } from "@inevitable/events";

interface StoredEvent {
  readonly subject: string;
  readonly event: CognitiveEvent;
  readonly sequence: number;
}

/** In-memory EventTransport: per-subject monotonic sequence, pattern-matched delivery, ordered replay. */
export class InMemoryEventTransport implements EventTransport {
  private readonly stored: StoredEvent[] = [];
  private readonly subscribers: Array<{
    pattern: string;
    handler: (event: CognitiveEvent) => Promise<void> | void;
  }> = [];
  private readonly seqBySubject = new Map<string, number>();

  async publish(subject: string, event: CognitiveEvent): Promise<Result<{ sequence: number }>> {
    const sequence = this.seqBySubject.get(subject) ?? 0;
    this.seqBySubject.set(subject, sequence + 1);
    this.stored.push({ subject, event, sequence });
    for (const sub of this.subscribers) {
      if (matchSubject(sub.pattern, subject)) await sub.handler(event);
    }
    return ok({ sequence });
  }

  async subscribe(
    subject: string,
    handler: (event: CognitiveEvent) => Promise<void> | void,
  ): Promise<{ unsubscribe(): void }> {
    const entry = { pattern: subject, handler };
    this.subscribers.push(entry);
    return {
      unsubscribe: () => {
        const idx = this.subscribers.indexOf(entry);
        if (idx >= 0) this.subscribers.splice(idx, 1);
      },
    };
  }

  async *replay(subject: string, fromSequence: number): AsyncIterable<CognitiveEvent> {
    for (const record of this.stored) {
      if (matchSubject(subject, record.subject) && record.sequence >= fromSequence) {
        yield record.event;
      }
    }
  }
}

interface VectorRecord {
  readonly vector: number[];
  readonly payload: Record<string, unknown> | undefined;
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    dot += av * bv;
    na += av * av;
    nb += bv * bv;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/** In-memory VectorStore: cosine-similarity search; defines canonical upsert/search/delete semantics. */
export class InMemoryVectorStore implements VectorStore {
  private readonly collections = new Map<string, Map<string, VectorRecord>>();

  async upsert(
    collection: string,
    id: string,
    vector: number[],
    payload?: Record<string, unknown>,
  ): Promise<void> {
    let coll = this.collections.get(collection);
    if (!coll) {
      coll = new Map<string, VectorRecord>();
      this.collections.set(collection, coll);
    }
    coll.set(id, { vector, payload });
  }

  async search(
    collection: string,
    vector: number[],
    limit: number,
  ): Promise<Array<{ id: string; score: number; payload?: Record<string, unknown> }>> {
    const coll = this.collections.get(collection);
    if (!coll) return [];
    return [...coll.entries()]
      .map(([id, record]) => ({
        id,
        score: cosineSimilarity(vector, record.vector),
        ...(record.payload ? { payload: record.payload } : {}),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.max(0, limit));
  }

  async delete(collection: string, id: string): Promise<void> {
    this.collections.get(collection)?.delete(id);
  }
}
