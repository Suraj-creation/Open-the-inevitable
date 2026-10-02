import pg from "pg";
import {
  type AdmitRequest,
  type Admitted,
  type AppendRequest,
  type CausalRecord,
  type CausalStore,
  type Draft,
  type Evidence,
  type EvidenceDraft,
  evidenceHash,
  FencedError,
  type FenceToken,
  INBOX_PREFIX,
  InvalidRecordError,
  type KindRegistry,
  SeqConflictError,
  type StoreChange,
  StoreContractError,
  type StreamMeta,
} from "@uci/kernel";
import { migrate, type MigrationReport, schemaIdent } from "./postgres-migrations.js";

/**
 * The Postgres causal store. Every write takes the stream's row in `streams` FOR UPDATE inside its
 * transaction, so writers to one stream serialise and the fence and expected-seq checks commit or
 * fail with the insert. Data, labels and causes are stored as faithful text (jsonb would reorder
 * keys). `pg_notify` inside the transaction rings `watch` only on commit; `watch` also polls, so
 * correctness never depends on NOTIFY (a transaction pooler cannot LISTEN).
 *
 * `beforeCommit` is a test seam that runs inside the open transaction (it may await: a crash test
 * holds the transaction open and kills the process).
 */
export interface PostgresStoreOptions {
  readonly registry: KindRegistry;
  /** A connection string, or `pool` for an existing pool (the store then does not end it). */
  readonly connectionString?: string;
  readonly pool?: pg.Pool;
  /** Schema holding the store's tables. Default `uci`. */
  readonly schema?: string;
  /** Pool size when the store creates its pool. Default 8. */
  readonly max?: number;
  readonly beforeCommit?: (info: {
    stream: string;
    firstSeq: number;
    count: number;
  }) => void | Promise<void>;
  /** How often watch() polls as a fallback to NOTIFY. Default 100 ms. */
  readonly pollMs?: number;
  /** Apply pending migrations on open. Default true. */
  readonly migrate?: boolean;
  /** Use LISTEN/NOTIFY for watch (needs a session-mode connection). Default true. */
  readonly listen?: boolean;
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

type Client = pg.PoolClient;

/** Record columns, with seq as a JS number (bigint arrives as a string otherwise). */
const COLUMNS = "stream, seq::int as seq, kind, v, at, process_id, entity_id, labels, causes, data";

export class PostgresCausalStore implements CausalStore {
  private readonly s: string;
  private readonly channel: string;
  private readonly wakers = new Set<() => void>();
  private closed = false;

  private constructor(
    private readonly pool: pg.Pool,
    private readonly ownsPool: boolean,
    private readonly options: PostgresStoreOptions,
  ) {
    this.s = schemaIdent(options.schema ?? "uci");
    this.channel = `uci_${this.s}`;
  }

  static async open(options: PostgresStoreOptions): Promise<PostgresCausalStore> {
    const owns = !options.pool;
    const pool =
      options.pool ??
      new pg.Pool({ connectionString: options.connectionString, max: options.max ?? 8 });
    // An idle connection dying (a server restart, a network blip) is not a failure: the pool
    // reconnects on the next query. Without a listener it would crash the process.
    pool.on("error", () => undefined);
    const store = new PostgresCausalStore(pool, owns, options);
    // Text is stored faithfully only in a UTF8 database: refuse anything else up front, rather
    // than fail on the first learner who writes a non-ASCII character.
    const encoding = (
      await pool.query<{ e: string }>(
        "select pg_encoding_to_char(encoding) as e from pg_database where datname = current_database()",
      )
    ).rows[0]?.e;
    if (encoding !== "UTF8") {
      if (owns) await pool.end();
      throw new Error(
        `the causal store needs a UTF8 database (this one is ${encoding ?? "unknown"})`,
      );
    }
    if (options.migrate !== false) await migrate(pool, store.s);
    return store;
  }

  /** Apply pending migrations to a schema without opening a store (the `uci migrate` command). */
  static async migrateSchema(connectionString: string, schema = "uci"): Promise<MigrationReport> {
    const pool = new pg.Pool({ connectionString, max: 1 });
    pool.on("error", () => undefined);
    try {
      return await migrate(pool, schemaIdent(schema));
    } finally {
      await pool.end();
    }
  }

  /**
   * Copy every table of one schema into a fresh one: a fork of the store's state (forked-control
   * experiments; later, branchable environments). The target schema is migrated first.
   */
  static async cloneSchema(connectionString: string, from: string, to: string): Promise<void> {
    const f = schemaIdent(from);
    const t = schemaIdent(to);
    const pool = new pg.Pool({ connectionString, max: 1 });
    pool.on("error", () => undefined);
    try {
      await migrate(pool, t);
      const c = await pool.connect();
      try {
        await c.query("begin");
        for (const table of ["streams", "records", "admissions", "evidence"])
          await c.query(`insert into ${t}.${table} select * from ${f}.${table}`);
        await c.query("commit");
      } catch (e) {
        await c.query("rollback").catch(() => undefined);
        throw e;
      } finally {
        c.release();
      }
    } finally {
      await pool.end();
    }
  }

  async claim(
    stream: string,
    owner: string,
    at: string,
    meta: StreamMeta,
    drafts: readonly Draft[] = [],
    evidence: readonly EvidenceDraft[] = [],
  ): Promise<{ fence: FenceToken; record: CausalRecord; records: CausalRecord[] }> {
    if (stream.startsWith(INBOX_PREFIX))
      throw new StoreContractError(`${stream} is an admission stream: it is never claimed`);
    return this.tx(async (c) => {
      const { token: previous, head } = await this.lock(c, stream);
      const token = previous + 1;
      await c.query(`update ${this.s}.streams set token = $2, owner = $3 where stream = $1`, [
        stream,
        token,
        owner,
      ]);
      await this.writeEvidence(c, meta.entityId, evidence);
      const records = await this.insert(c, stream, meta, at, head, [
        { kind: "lease.claimed", v: 1, data: { owner, token } },
        ...drafts,
      ]);
      return { fence: { stream, token }, record: records[0] as CausalRecord, records };
    });
  }

  async append(request: AppendRequest): Promise<CausalRecord[]> {
    if (request.fence.stream !== request.stream)
      throw new FencedError(`fence is for ${request.fence.stream}, not ${request.stream}`);
    return this.tx(async (c) => {
      const { token, head } = await this.lock(c, request.stream);
      if (token === 0 || token !== request.fence.token)
        throw new FencedError(
          `stream ${request.stream}: fence ${request.fence.token} is not the current token ${token || "none"}`,
        );
      if (head !== request.expectedSeq)
        throw new SeqConflictError(
          `stream ${request.stream} is at ${head}, writer expected ${request.expectedSeq}`,
        );
      await this.writeEvidence(c, request.meta.entityId, request.evidence ?? []);
      return this.insert(c, request.stream, request.meta, request.at, head, request.drafts);
    });
  }

  async admit(request: AdmitRequest): Promise<Admitted> {
    if (!request.stream.startsWith(INBOX_PREFIX))
      throw new StoreContractError(
        `admissions go to ${INBOX_PREFIX}… streams, not ${request.stream}`,
      );
    return this.tx(async (c) => {
      const { head } = await this.lock(c, request.stream);
      const seen = await c.query<{ seq: number }>(
        `select seq::int as seq from ${this.s}.admissions where stream = $1 and key = $2`,
        [request.stream, request.key],
      );
      const prior = seen.rows[0];
      if (prior) {
        const row = await c.query<RecordRow>(
          `select ${COLUMNS} from ${this.s}.records where stream = $1 and seq = $2`,
          [request.stream, prior.seq],
        );
        return { record: this.toRecord(row.rows[0] as RecordRow), duplicate: true };
      }
      await this.writeEvidence(c, request.meta.entityId, request.evidence ?? []);
      const [record] = await this.insert(c, request.stream, request.meta, request.at, head, [
        request.draft,
      ]);
      await c.query(`insert into ${this.s}.admissions (stream, key, seq) values ($1, $2, $3)`, [
        request.stream,
        request.key,
        (record as CausalRecord).seq,
      ]);
      return { record: record as CausalRecord, duplicate: false };
    });
  }

  async read(stream: string, fromSeq = 1): Promise<CausalRecord[]> {
    const rows = await this.pool.query<RecordRow>(
      `select ${COLUMNS} from ${this.s}.records where stream = $1 and seq >= $2 order by seq`,
      [stream, fromSeq],
    );
    return rows.rows.map((r) => this.toRecord(r));
  }

  async streams(prefix: string): Promise<string[]> {
    const rows = await this.pool.query<{ stream: string }>(
      `select distinct stream from ${this.s}.records where left(stream, length($1)) = $1 order by stream`,
      [prefix],
    );
    return rows.rows.map((r) => r.stream);
  }

  async putEvidence(
    entityId: string,
    mediaType: string,
    content: string,
    labels: readonly string[] = [],
  ): Promise<string> {
    return this.tx(
      async (c) =>
        (await this.writeEvidence(c, entityId, [{ mediaType, content, labels }]))[0] as string,
    );
  }

  async getEvidence(entityId: string, hash: string): Promise<Evidence | undefined> {
    const rows = await this.pool.query<{
      hash: string;
      media_type: string;
      content: string | null;
      labels: string;
      forgotten: boolean;
    }>(
      `select hash, media_type, content, labels, forgotten from ${this.s}.evidence where entity_id = $1 and hash = $2`,
      [entityId, hash],
    );
    const row = rows.rows[0];
    return row
      ? {
          hash: row.hash,
          mediaType: row.media_type,
          content: row.content ?? "",
          labels: JSON.parse(row.labels) as string[],
          forgotten: row.forgotten,
        }
      : undefined;
  }

  async forget(entityId: string, labelPrefix?: string): Promise<number> {
    return this.tx(async (c) => {
      const rows = await c.query<{ hash: string; labels: string }>(
        `select hash, labels from ${this.s}.evidence where entity_id = $1 and not forgotten for update`,
        [entityId],
      );
      const chosen = rows.rows.filter(
        (r) =>
          labelPrefix === undefined ||
          (JSON.parse(r.labels) as string[]).some((l) => l.startsWith(labelPrefix)),
      );
      for (const r of chosen)
        await c.query(
          `update ${this.s}.evidence set content = null, forgotten = true where entity_id = $1 and hash = $2`,
          [entityId, r.hash],
        );
      return chosen.length;
    });
  }

  async *watch(prefix: string, signal: AbortSignal): AsyncIterable<StoreChange> {
    const heads = new Map(await this.heads(prefix));
    let listener: Client | undefined;
    if (this.options.listen !== false) {
      listener = await this.pool.connect();
      listener.on("error", () => undefined);
      listener.on("notification", () => {
        for (const wake of [...this.wakers]) wake();
      });
      await listener.query(`listen ${this.channel}`);
    }
    try {
      while (!signal.aborted && !this.closed) {
        await new Promise<void>((resolve) => {
          const wake = () => {
            clearTimeout(timer);
            this.wakers.delete(wake);
            signal.removeEventListener("abort", wake);
            resolve();
          };
          const timer = setTimeout(wake, this.options.pollMs ?? 100);
          this.wakers.add(wake);
          signal.addEventListener("abort", wake, { once: true });
        });
        if (signal.aborted || this.closed) return;
        for (const [stream, head] of await this.heads(prefix)) {
          for (let seq = (heads.get(stream) ?? 0) + 1; seq <= head; seq++) yield { stream, seq };
          heads.set(stream, head);
        }
      }
    } finally {
      if (listener) {
        await listener.query(`unlisten ${this.channel}`).catch(() => undefined);
        listener.release();
      }
    }
  }

  async close(): Promise<void> {
    this.closed = true;
    for (const wake of [...this.wakers]) wake();
    if (this.ownsPool) await this.pool.end();
  }

  // ---------------------------------------------------------------- internals

  private async heads(prefix: string): Promise<[string, number][]> {
    const rows = await this.pool.query<{ stream: string; head: number }>(
      `select stream, head::int as head from ${this.s}.streams where left(stream, length($1)) = $1 and head > 0`,
      [prefix],
    );
    return rows.rows.map((r) => [r.stream, r.head]);
  }

  /** Take the stream's row for this transaction (creating it at token 0, head 0 if new). */
  private async lock(c: Client, stream: string): Promise<{ token: number; head: number }> {
    await c.query(
      `insert into ${this.s}.streams (stream) values ($1) on conflict (stream) do nothing`,
      [stream],
    );
    const row = await c.query<{ token: number; head: number }>(
      `select token::int as token, head::int as head from ${this.s}.streams where stream = $1 for update`,
      [stream],
    );
    return row.rows[0] as { token: number; head: number };
  }

  private async writeEvidence(
    c: Client,
    entityId: string,
    evidence: readonly EvidenceDraft[],
  ): Promise<string[]> {
    const hashes: string[] = [];
    for (const e of evidence) {
      const hash = evidenceHash(e.mediaType, e.content);
      await c.query(
        `insert into ${this.s}.evidence (entity_id, hash, media_type, content, labels)
         values ($1, $2, $3, $4, $5) on conflict (entity_id, hash) do nothing`,
        [entityId, hash, e.mediaType, e.content, JSON.stringify([...(e.labels ?? [])].sort())],
      );
      hashes.push(hash);
    }
    return hashes;
  }

  private async insert(
    c: Client,
    stream: string,
    meta: StreamMeta,
    at: string,
    head: number,
    drafts: readonly Draft[],
  ): Promise<CausalRecord[]> {
    const violations = drafts.flatMap((d) => this.options.registry.validate(d));
    // Every cause names a record that exists: earlier in this batch, or already committed.
    for (const [i, d] of drafts.entries())
      for (const cause of d.causes ?? []) {
        const inBatch = cause.stream === stream && cause.seq > head && cause.seq < head + i + 1;
        if (inBatch) continue;
        const found = await c.query(
          `select 1 from ${this.s}.records where stream = $1 and seq = $2`,
          [cause.stream, cause.seq],
        );
        if (!found.rowCount)
          violations.push(`${d.kind}: cause ${cause.stream}#${cause.seq} does not exist`);
      }
    if (violations.length) throw new InvalidRecordError(violations);
    const out: CausalRecord[] = drafts.map((d, i) => ({
      stream,
      seq: head + i + 1,
      kind: d.kind,
      v: d.v,
      at,
      processId: meta.processId,
      entityId: meta.entityId,
      labels: [...(d.labels ?? [])].sort(),
      causes: d.causes ?? [],
      data: d.data,
    }));
    for (const r of out)
      await c.query(
        `insert into ${this.s}.records (stream, seq, kind, v, at, process_id, entity_id, labels, causes, data)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
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
        ],
      );
    const last = head + out.length;
    await c.query(`update ${this.s}.streams set head = $2 where stream = $1`, [stream, last]);
    await c.query("select pg_notify($1, $2)", [this.channel, `${stream}#${last}`]);
    await this.options.beforeCommit?.({ stream, firstSeq: head + 1, count: out.length });
    return out;
  }

  private async tx<T>(fn: (c: Client) => Promise<T>): Promise<T> {
    const c = await this.pool.connect();
    let result: T;
    try {
      await c.query("begin");
      result = await fn(c);
      await c.query("commit");
    } catch (e) {
      await c.query("rollback").catch(() => undefined);
      throw e;
    } finally {
      c.release();
    }
    for (const wake of [...this.wakers]) wake();
    return result;
  }

  /** Read-side validation: a record whose kind@v this registry does not know fails closed. */
  private toRecord(row: RecordRow): CausalRecord {
    const record: CausalRecord = {
      stream: row.stream,
      seq: Number(row.seq),
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
