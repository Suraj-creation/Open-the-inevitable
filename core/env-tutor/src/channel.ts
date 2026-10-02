import { closeSync, existsSync, fsyncSync, openSync, readFileSync, writeSync } from "node:fs";
import { join } from "node:path";

/**
 * The environment's own durable channel, outside the process: an outbox of everything delivered to
 * learners. Deliberately non-idempotent — delivering the same effect twice writes two outbox lines —
 * so a duplicate send is visible, never hidden. Lines are fsync'd; a torn final line (crash
 * mid-write) is ignored on read. What learners send back is admitted to each process's durable
 * inbox (the store), not kept here.
 */
export interface OutboxEntry {
  /** Effect ids are unique within a process only. */
  readonly processId: string;
  readonly effectId: string;
  readonly idempotencyKey: string;
  readonly action: string;
  readonly params: Readonly<Record<string, string>>;
  readonly probeItemId?: string;
}

export class DurableChannel {
  private readonly outboxPath: string;

  constructor(readonly dir: string) {
    this.outboxPath = join(dir, "outbox.jsonl");
  }

  /** Everything delivered, optionally for one process. */
  outbox(processId?: string): OutboxEntry[] {
    const all = readLines<OutboxEntry>(this.outboxPath);
    return processId === undefined ? all : all.filter((e) => e.processId === processId);
  }

  deliver(entry: OutboxEntry): void {
    appendDurably(this.outboxPath, entry);
  }

  /** How many times each effect id was delivered: any count above 1 is a duplicate send. */
  deliveryCounts(): Map<string, number> {
    const counts = new Map<string, number>();
    for (const e of this.outbox()) {
      const id = `${e.processId}/${e.effectId}`;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    return counts;
  }

  /** Deliveries per idempotency key: a logical effect delivered more than once was resent. */
  keyCounts(): Map<string, number> {
    const counts = new Map<string, number>();
    for (const e of this.outbox()) {
      const key = `${e.processId}/${e.idempotencyKey}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
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
