/**
 * Durable file-backed adapters — the first cut of durable cognitive persistence (ADR-0008,
 * spec/persistence/durable-cognitive-persistence.md). Pure `node:fs`, zero native/third-party
 * dependencies, fully offline and Windows-safe: `node:fs` is a builtin (not a guarded client per
 * ADR-0005), so the file backend is ALWAYS available — which is exactly why it is the offline
 * default. The in-memory adapters remain the reference semantics; this honors the SAME EventTransport
 * contract and must pass the SAME conformance harness.
 *
 * Durability is a sink, never part of the canonical record: persisting an event emits no new event,
 * never mutates it, never changes ordering. The persisted event retains its original bus `sequence`,
 * so a reconstructed surface streams with identical `Last-Event-ID` frames.
 */
import { appendFile } from "node:fs/promises";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import type { Result } from "@inevitable/shared";
import { ok } from "@inevitable/shared";
import type { CognitiveEvent } from "@inevitable/protocols";
import type { EventTransport } from "@inevitable/contracts";
import { matchSubject } from "@inevitable/events";

interface StoredRecord {
  readonly subject: string;
  readonly event: CognitiveEvent;
  readonly sequence: number;
}

/**
 * Append-only, file-backed {@link EventTransport}. One JSONL line per published event; per-subject
 * monotonic sequence from 0; ordered, subject-matched replay. A torn final line (crash mid-append) is
 * skipped on read, so the log is valid up to its last complete record.
 */
export class FileEventTransport implements EventTransport {
  private readonly seqBySubject = new Map<string, number>();
  private readonly subscribers: Array<{
    pattern: string;
    handler: (event: CognitiveEvent) => Promise<void> | void;
  }> = [];
  /** Serializes appends so file order == publish order regardless of concurrency. */
  private writeChain: Promise<void> = Promise.resolve();

  constructor(private readonly filePath: string) {
    mkdirSync(dirname(filePath), { recursive: true });
    // Reopen-safe: continue per-subject sequences past anything already on disk.
    for (const record of this.readRecords()) {
      const next = record.sequence + 1;
      if (next > (this.seqBySubject.get(record.subject) ?? 0)) {
        this.seqBySubject.set(record.subject, next);
      }
    }
  }

  async publish(subject: string, event: CognitiveEvent): Promise<Result<{ sequence: number }>> {
    const sequence = this.seqBySubject.get(subject) ?? 0;
    this.seqBySubject.set(subject, sequence + 1);
    await this.append({ subject, event, sequence });
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
    for (const record of this.readRecords()) {
      if (matchSubject(subject, record.subject) && record.sequence >= fromSequence) {
        yield record.event;
      }
    }
  }

  /** Read every persisted event in append order (across all subjects). Used to reconstruct state. */
  readAll(): CognitiveEvent[] {
    return this.readRecords().map((record) => record.event);
  }

  private append(record: StoredRecord): Promise<void> {
    const line = `${JSON.stringify(record)}\n`;
    this.writeChain = this.writeChain.then(() => appendFile(this.filePath, line, "utf8"));
    return this.writeChain;
  }

  private readRecords(): StoredRecord[] {
    if (!existsSync(this.filePath)) return [];
    const text = readFileSync(this.filePath, "utf8");
    const records: StoredRecord[] = [];
    for (const line of text.split("\n")) {
      if (!line.trim()) continue;
      try {
        records.push(JSON.parse(line) as StoredRecord);
      } catch {
        // Torn final line from a crash mid-append: the log is valid up to here. Stop.
        break;
      }
    }
    return records;
  }
}
