import { closeSync, existsSync, fsyncSync, openSync, readFileSync, writeSync } from "node:fs";
import { join } from "node:path";

/**
 * The environment's own durable channel, outside the process: an outbox of everything delivered to
 * the learner and an inbox of everything the learner sent. Deliberately non-idempotent — delivering
 * the same effect twice writes two outbox lines — so a duplicate send is visible, never hidden.
 * Lines are fsync'd; a torn final line (crash mid-write) is ignored on read.
 */
export interface OutboxEntry {
  readonly effectId: string;
  readonly idempotencyKey: string;
  readonly action: string;
  readonly params: Readonly<Record<string, string>>;
  readonly probeItemId?: string;
}

export interface InboxEntry {
  readonly inputId: string;
  readonly from: "learner" | "person" | "environment";
  readonly content: string;
  readonly inReplyTo?: string;
}

export class DurableChannel {
  private readonly outboxPath: string;
  private readonly inboxPath: string;

  constructor(readonly dir: string) {
    this.outboxPath = join(dir, "outbox.jsonl");
    this.inboxPath = join(dir, "inbox.jsonl");
  }

  outbox(): OutboxEntry[] {
    return readLines<OutboxEntry>(this.outboxPath);
  }

  inbox(): InboxEntry[] {
    return readLines<InboxEntry>(this.inboxPath);
  }

  deliver(entry: OutboxEntry): void {
    appendDurably(this.outboxPath, entry);
  }

  receive(entry: Omit<InboxEntry, "inputId"> & { inputId?: string }): InboxEntry {
    const full: InboxEntry = { ...entry, inputId: entry.inputId ?? `I${this.inbox().length + 1}` };
    appendDurably(this.inboxPath, full);
    return full;
  }

  /** How many times each effect id was delivered: any count above 1 is a duplicate send. */
  deliveryCounts(): Map<string, number> {
    const counts = new Map<string, number>();
    for (const e of this.outbox()) counts.set(e.effectId, (counts.get(e.effectId) ?? 0) + 1);
    return counts;
  }

  /** Deliveries per idempotency key: a logical effect delivered more than once was resent. */
  keyCounts(): Map<string, number> {
    const counts = new Map<string, number>();
    for (const e of this.outbox())
      counts.set(e.idempotencyKey, (counts.get(e.idempotencyKey) ?? 0) + 1);
    return counts;
  }
}

function appendDurably(path: string, value: unknown): void {
  const fd = openSync(path, "a");
  try {
    writeSync(fd, `${JSON.stringify(value)}\n`);
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}

function readLines<T>(path: string): T[] {
  if (!existsSync(path)) return [];
  const out: T[] = [];
  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try {
      out.push(JSON.parse(line) as T);
    } catch {
      // torn final line from a crash mid-write: never delivered, so ignored
    }
  }
  return out;
}
