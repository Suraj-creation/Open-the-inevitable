import type * as NodeSqlite from "node:sqlite";
import type { DatabaseSync as DatabaseSyncType } from "node:sqlite";
import {
  type AdmitRequest,
  type Admitted,
  type AppendRequest,
  type CausalRecord,
  type CausalStore,
  type Draft,
  type Evidence,
  type EvidenceDraft,
  FencedError,
  type FenceToken,
  INBOX_PREFIX,
  InvalidRecordError,
  type KindRegistry,
  SeqConflictError,
  sha256Hex,
  type StoreChange,
  StoreContractError,
  type StreamMeta,
} from "@uci/kernel";

/**
 * The SQLite causal store: one file, WAL, synchronous=FULL, single writer per stream enforced by a
 * fence token checked inside `BEGIN IMMEDIATE`. This is the only file in the core that imports
 * `node:sqlite`.
 *
 * `beforeCommit` is a test seam: it runs inside the open write transaction, so a crash test can hold
 * the process there and kill it, and a conformance check can throw there, to prove an uncommitted
 * batch leaves no trace.
 */
// `node:sqlite` is a prefix-only builtin; bundling test runners (Vite) strip the prefix from a static
// import and then fail to resolve "sqlite". Loading it through getBuiltinModule sidesteps that.
const { DatabaseSync } = process.getBuiltinModule("node:sqlite") as typeof NodeSqlite;

/** Schema version, kept in PRAGMA user_version. 0 = the S1 layout (unscoped evidence). */
const SCHEMA_VERSION = 2;
/** Evidence written before entity scoping (schema 0) lives under this scope; lookups fall back to it. */
const LEGACY_SCOPE = "*";

export interface SqliteStoreOptions {
  readonly registry: KindRegistry;
  readonly beforeCommit?: (info: { stream: string; firstSeq: number; count: number }) => void;
  /** How often watch() polls for commits made by other connections. Default 50 ms. */
  readonly pollMs?: number;
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
  private readonly wakers = new Set<() => void>();

  private constructor(
    path: string,
    private readonly options: SqliteStoreOptions,
  ) {
    this.db = new DatabaseSync(path);
    this.db.exec("PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;");
    this.migrate();
  }

  static async open(path: string, options: SqliteStoreOptions): Promise<SqliteCausalStore> {
    return new SqliteCausalStore(path, options);
  }

  private migrate(): void {
    const version = (this.db.prepare("PRAGMA user_version").get() as { user_version: number })
      .user_version;
    if (version >= SCHEMA_VERSION) return;
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS records (
          stream TEXT NOT NULL, seq INTEGER NOT NULL, kind TEXT NOT NULL, v INTEGER NOT NULL, at TEXT NOT NULL,
          process_id TEXT NOT NULL, entity_id TEXT NOT NULL, labels TEXT NOT NULL, causes TEXT NOT NULL, data TEXT NOT NULL,
          PRIMARY KEY (stream, seq)
        ) WITHOUT ROWID;
        CREATE TABLE IF NOT EXISTS leases (stream TEXT PRIMARY KEY, token INTEGER NOT NULL, owner TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS admissions (
          stream TEXT NOT NULL, key TEXT NOT NULL, seq INTEGER NOT NULL, PRIMARY KEY (stream, key)
        ) WITHOUT ROWID;
      `);
      const legacy = this.db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'evidence'")
        .get() as { name: string } | undefined;
      const scoped =
        legacy &&
        (this.db.prepare("PRAGMA table_info(evidence)").all() as { name: string }[]).some(
          (c) => c.name === "entity_id",
        );
      if (legacy && !scoped) this.db.exec("ALTER TABLE evidence RENAME TO evidence_v0");
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS evidence (
          entity_id TEXT NOT NULL, hash TEXT NOT NULL, media_type TEXT NOT NULL, content TEXT,
          labels TEXT NOT NULL, forgotten INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (entity_id, hash)
        ) WITHOUT ROWID;
      `);
      if (legacy && !scoped) {
        this.db
          .prepare(
            "INSERT OR IGNORE INTO evidence (entity_id, hash, media_type, content, labels) SELECT ?, hash, media_type, content, '[]' FROM evidence_v0",
          )
          .run(LEGACY_SCOPE);
        this.db.exec("DROP TABLE evidence_v0");
      }
      this.db.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`);
      this.db.exec("COMMIT");
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }

  async claim(
    stream: string,
    owner: string,
    at: string,
    meta: StreamMeta,
    drafts: readonly Draft[] = [],
  ): Promise<{ fence: FenceToken; record: CausalRecord; records: CausalRecord[] }> {
    if (stream.startsWith(INBOX_PREFIX))
      throw new StoreContractError(`${stream} is an admission stream: it is never claimed`);
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
      const records = this.insert(stream, meta, at, this.lastSeq(stream), [
        { kind: "lease.claimed", v: 1, data: { owner, token } },
        ...drafts,
      ]);
      return { fence: { stream, token }, record: records[0] as CausalRecord, records };
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
      this.writeEvidence(request.meta.entityId, request.evidence ?? []);
      return this.insert(request.stream, request.meta, request.at, last, request.drafts);
    });
  }

  async admit(request: AdmitRequest): Promise<Admitted> {
    if (!request.stream.startsWith(INBOX_PREFIX))
      throw new StoreContractError(
        `admissions go to ${INBOX_PREFIX}… streams, not ${request.stream}`,
      );
    return this.inWrite(() => {
      const seen = this.db
        .prepare("SELECT seq FROM admissions WHERE stream = ? AND key = ?")
        .get(request.stream, request.key) as { seq: number } | undefined;
      if (seen) {
        const row = this.db
          .prepare("SELECT * FROM records WHERE stream = ? AND seq = ?")
          .get(request.stream, seen.seq) as unknown as RecordRow;
        return { record: this.toRecord(row), duplicate: true };
      }
      this.writeEvidence(request.meta.entityId, request.evidence ?? []);
      const [record] = this.insert(
        request.stream,
        request.meta,
        request.at,
        this.lastSeq(request.stream),
        [request.draft],
      );
      this.db
        .prepare("INSERT INTO admissions (stream, key, seq) VALUES (?, ?, ?)")
        .run(request.stream, request.key, (record as CausalRecord).seq);
      return { record: record as CausalRecord, duplicate: false };
    });
  }

  async read(stream: string, fromSeq = 1): Promise<CausalRecord[]> {
    const rows = this.db
      .prepare("SELECT * FROM records WHERE stream = ? AND seq >= ? ORDER BY seq")
      .all(stream, fromSeq) as unknown as RecordRow[];
    return rows.map((r) => this.toRecord(r));
  }

  async streams(prefix: string): Promise<string[]> {
    const rows = this.db
      .prepare("SELECT DISTINCT stream FROM records WHERE substr(stream, 1, ?) = ? ORDER BY stream")
      .all(prefix.length, prefix) as unknown as { stream: string }[];
    return rows.map((r) => r.stream);
  }

  async putEvidence(
    entityId: string,
    mediaType: string,
    content: string,
    labels: readonly string[] = [],
  ): Promise<string> {
    return this.inWrite(
      () => this.writeEvidence(entityId, [{ mediaType, content, labels }])[0] as string,
    );
  }

  async getEvidence(entityId: string, hash: string): Promise<Evidence | undefined> {
    const select = this.db.prepare(
      "SELECT hash, media_type, content, labels, forgotten FROM evidence WHERE entity_id = ? AND hash = ?",
    );
    const row = (select.get(entityId, hash) ?? select.get(LEGACY_SCOPE, hash)) as
      | {
          hash: string;
          media_type: string;
          content: string | null;
          labels: string;
          forgotten: number;
        }
      | undefined;
    return row
      ? {
          hash: row.hash,
          mediaType: row.media_type,
          content: row.content ?? "",
          labels: JSON.parse(row.labels) as string[],
          forgotten: row.forgotten === 1,
        }
      : undefined;
  }

  async forget(entityId: string): Promise<number> {
    return this.inWrite(() =>
      Number(
        this.db
          .prepare(
            "UPDATE evidence SET content = NULL, forgotten = 1 WHERE entity_id = ? AND forgotten = 0",
          )
          .run(entityId).changes,
      ),
    );
  }

  async *watch(prefix: string, signal: AbortSignal): AsyncIterable<StoreChange> {
    const heads = new Map(this.heads(prefix).map((h) => [h.stream, h.m]));
    while (!signal.aborted) {
      await new Promise<void>((resolve) => {
        const wake = () => {
          clearTimeout(timer);
          this.wakers.delete(wake);
          signal.removeEventListener("abort", wake);
          resolve();
        };
        const timer = setTimeout(wake, this.options.pollMs ?? 50);
        this.wakers.add(wake);
        signal.addEventListener("abort", wake, { once: true });
      });
      if (signal.aborted || !this.db.isOpen) return;
      for (const { stream, m } of this.heads(prefix)) {
        for (let seq = (heads.get(stream) ?? 0) + 1; seq <= m; seq++) yield { stream, seq };
        heads.set(stream, m);
      }
    }
  }

  async close(): Promise<void> {
    for (const wake of [...this.wakers]) wake();
    if (this.db.isOpen) this.db.close();
  }

  private heads(prefix: string): { stream: string; m: number }[] {
    return this.db
      .prepare(
        "SELECT stream, MAX(seq) AS m FROM records WHERE substr(stream, 1, ?) = ? GROUP BY stream",
      )
      .all(prefix.length, prefix) as unknown as { stream: string; m: number }[];
  }

  private lastSeq(stream: string): number {
    const row = this.db
      .prepare("SELECT MAX(seq) AS m FROM records WHERE stream = ?")
      .get(stream) as { m: number | null };
    return row.m ?? 0;
  }

  private writeEvidence(entityId: string, evidence: readonly EvidenceDraft[]): string[] {
    const stmt = this.db.prepare(
      "INSERT INTO evidence (entity_id, hash, media_type, content, labels) VALUES (?, ?, ?, ?, ?) ON CONFLICT(entity_id, hash) DO NOTHING",
    );
    return evidence.map((e) => {
      const hash = sha256Hex(`${e.mediaType}\n${e.content}`);
      stmt.run(
        entityId,
        hash,
        e.mediaType,
        e.content,
        JSON.stringify([...(e.labels ?? [])].sort()),
      );
      return hash;
    });
  }

  private insert(
    stream: string,
    meta: StreamMeta,
    at: string,
    last: number,
    drafts: readonly Draft[],
  ): CausalRecord[] {
    const violations = drafts.flatMap((d) => this.options.registry.validate(d));
    // Every cause names a record that exists: earlier in this batch, or already committed.
    const exists = this.db.prepare("SELECT 1 AS x FROM records WHERE stream = ? AND seq = ?");
    drafts.forEach((d, i) => {
      for (const c of d.causes ?? []) {
        const inBatch = c.stream === stream && c.seq > last && c.seq < last + i + 1;
        if (!inBatch && !exists.get(c.stream, c.seq))
          violations.push(`${d.kind}: cause ${c.stream}#${c.seq} does not exist`);
      }
    });
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

  /** Runs `fn` inside BEGIN IMMEDIATE, so checks and writes commit or fail together. */
  private inWrite<T>(fn: () => T): T {
    this.db.exec("BEGIN IMMEDIATE");
    let result: T;
    try {
      result = fn();
      this.db.exec("COMMIT");
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
    for (const wake of [...this.wakers]) wake();
    return result;
  }

  /** Read-side validation: a record whose kind@v this registry does not know fails closed. */
  private toRecord(row: RecordRow): CausalRecord {
    const record: CausalRecord = {
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
    const violations = this.options.registry.validate(record);
    if (violations.length)
      throw new InvalidRecordError(violations.map((v) => `${row.stream}#${row.seq}: ${v}`));
    return record;
  }
}
