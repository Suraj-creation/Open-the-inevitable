import type * as NodeSqlite from "node:sqlite";
import type { DatabaseSync as DatabaseSyncType } from "node:sqlite";
import {
  type AppendRequest,
  type CausalRecord,
  type CausalStore,
  type Draft,
  type Evidence,
  FencedError,
  type FenceToken,
  InvalidRecordError,
  type KindRegistry,
  SeqConflictError,
  sha256Hex,
  type StreamMeta,
} from "@uci/kernel";

/**
 * The SQLite causal store: one file, WAL, synchronous=FULL, single writer per stream enforced by a
 * fence token checked inside `BEGIN IMMEDIATE`. This is the only file in the core that imports
 * `node:sqlite`.
 *
 * `beforeCommit` is a test seam: it runs inside the open write transaction, so a crash test can hold
 * the process there and kill it to prove an uncommitted batch leaves no trace.
 */
// `node:sqlite` is a prefix-only builtin; bundling test runners (Vite) strip the prefix from a static
// import and then fail to resolve "sqlite". Loading it through getBuiltinModule sidesteps that.
const { DatabaseSync } = process.getBuiltinModule("node:sqlite") as typeof NodeSqlite;

export interface SqliteStoreOptions {
  readonly registry: KindRegistry;
  readonly beforeCommit?: (info: { stream: string; firstSeq: number; count: number }) => void;
}

interface RecordRow {
  stream: string;
  seq: number;
  kind: string;
  v: number;
  at: string;
  process_id: string;
  entity_id: string;
  labels: string;
  causes: string;
  data: string;
}

export class SqliteCausalStore implements CausalStore {
  private readonly db: DatabaseSyncType;

  private constructor(
    path: string,
    private readonly options: SqliteStoreOptions,
  ) {
    this.db = new DatabaseSync(path);
    this.db.exec("PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS records (
        stream TEXT NOT NULL, seq INTEGER NOT NULL, kind TEXT NOT NULL, v INTEGER NOT NULL, at TEXT NOT NULL,
        process_id TEXT NOT NULL, entity_id TEXT NOT NULL, labels TEXT NOT NULL, causes TEXT NOT NULL, data TEXT NOT NULL,
        PRIMARY KEY (stream, seq)
      ) WITHOUT ROWID;
      CREATE TABLE IF NOT EXISTS leases (stream TEXT PRIMARY KEY, token INTEGER NOT NULL, owner TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS evidence (hash TEXT PRIMARY KEY, media_type TEXT NOT NULL, content TEXT NOT NULL);
    `);
  }

  static async open(path: string, options: SqliteStoreOptions): Promise<SqliteCausalStore> {
    return new SqliteCausalStore(path, options);
  }

  async claim(
    stream: string,
    owner: string,
    at: string,
    meta: StreamMeta,
  ): Promise<{ fence: FenceToken; record: CausalRecord }> {
    return this.inWrite(() => {
      const row = this.db.prepare("SELECT token FROM leases WHERE stream = ?").get(stream) as
        | { token: number }
        | undefined;
      const token = (row?.token ?? 0) + 1;
      this.db
        .prepare(
          "INSERT INTO leases (stream, token, owner) VALUES (?, ?, ?) ON CONFLICT(stream) DO UPDATE SET token = excluded.token, owner = excluded.owner",
        )
        .run(stream, token, owner);
      const [record] = this.insert(stream, meta, at, this.lastSeq(stream), [
        { kind: "lease.claimed", v: 1, data: { owner, token } },
      ]);
      return { fence: { stream, token }, record: record as CausalRecord };
    });
  }

  async append(request: AppendRequest): Promise<CausalRecord[]> {
    if (request.fence.stream !== request.stream)
      throw new FencedError(`fence is for ${request.fence.stream}, not ${request.stream}`);
    return this.inWrite(() => {
      const row = this.db
        .prepare("SELECT token FROM leases WHERE stream = ?")
        .get(request.stream) as { token: number } | undefined;
      if (!row || row.token !== request.fence.token)
        throw new FencedError(
          `stream ${request.stream}: fence ${request.fence.token} is not the current token ${row?.token ?? "none"}`,
        );
      const last = this.lastSeq(request.stream);
      if (last !== request.expectedSeq)
        throw new SeqConflictError(
          `stream ${request.stream} is at ${last}, writer expected ${request.expectedSeq}`,
        );
      return this.insert(request.stream, request.meta, request.at, last, request.drafts);
    });
  }

  async read(stream: string, fromSeq = 1): Promise<CausalRecord[]> {
    const rows = this.db
      .prepare("SELECT * FROM records WHERE stream = ? AND seq >= ? ORDER BY seq")
      .all(stream, fromSeq) as unknown as RecordRow[];
    return rows.map(toRecord);
  }

  async streams(prefix: string): Promise<string[]> {
    const rows = this.db
      .prepare("SELECT DISTINCT stream FROM records WHERE substr(stream, 1, ?) = ? ORDER BY stream")
      .all(prefix.length, prefix) as unknown as { stream: string }[];
    return rows.map((r) => r.stream);
  }

  async putEvidence(mediaType: string, content: string): Promise<string> {
    const hash = sha256Hex(`${mediaType}\n${content}`);
    this.db
      .prepare("INSERT OR IGNORE INTO evidence (hash, media_type, content) VALUES (?, ?, ?)")
      .run(hash, mediaType, content);
    return hash;
  }

  async getEvidence(hash: string): Promise<Evidence | undefined> {
    const row = this.db
      .prepare("SELECT hash, media_type, content FROM evidence WHERE hash = ?")
      .get(hash) as { hash: string; media_type: string; content: string } | undefined;
    return row ? { hash: row.hash, mediaType: row.media_type, content: row.content } : undefined;
  }

  async close(): Promise<void> {
    if (this.db.isOpen) this.db.close();
  }

  private lastSeq(stream: string): number {
    const row = this.db
      .prepare("SELECT MAX(seq) AS m FROM records WHERE stream = ?")
      .get(stream) as { m: number | null };
    return row.m ?? 0;
  }

  private insert(
    stream: string,
    meta: StreamMeta,
    at: string,
    last: number,
    drafts: readonly Draft[],
  ): CausalRecord[] {
    const violations = drafts.flatMap((d) => this.options.registry.validate(d));
    if (violations.length) throw new InvalidRecordError(violations);
    const stmt = this.db.prepare(
      "INSERT INTO records (stream, seq, kind, v, at, process_id, entity_id, labels, causes, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    );
    const out: CausalRecord[] = drafts.map((d, i) => ({
      stream,
      seq: last + i + 1,
      kind: d.kind,
      v: d.v,
      at,
      processId: meta.processId,
      entityId: meta.entityId,
      labels: [...(d.labels ?? [])].sort(),
      causes: d.causes ?? [],
      data: d.data,
    }));
    for (const r of out) {
      stmt.run(
        r.stream,
        r.seq,
        r.kind,
        r.v,
        r.at,
        r.processId,
        r.entityId,
        JSON.stringify(r.labels),
        JSON.stringify(r.causes),
        JSON.stringify(r.data),
      );
    }
    this.options.beforeCommit?.({ stream, firstSeq: last + 1, count: out.length });
    return out;
  }

  /** Runs `fn` inside BEGIN IMMEDIATE, so the fence check and the insert commit or fail together. */
  private inWrite<T>(fn: () => T): T {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const result = fn();
      this.db.exec("COMMIT");
      return result;
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }
}

function toRecord(row: RecordRow): CausalRecord {
  return {
    stream: row.stream,
    seq: row.seq,
    kind: row.kind,
    v: row.v,
    at: row.at,
    processId: row.process_id,
    entityId: row.entity_id,
    labels: JSON.parse(row.labels) as string[],
    causes: JSON.parse(row.causes) as CausalRecord["causes"],
    data: JSON.parse(row.data) as unknown,
  };
}
