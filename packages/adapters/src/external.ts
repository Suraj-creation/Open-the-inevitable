/**
 * Dependency-optional backend adapters. Each implements an `@inevitable/contracts` interface and loads
 * its client via {@link requireOptional}; `connect()` returns a typed error when the client/infra is
 * absent (so the workspace verifies offline). No vendor type crosses the adapter boundary — each
 * narrows the client to a minimal local interface. Live conformance is infra-gated. ADR-0005.
 */
import { type Result, type CosError, ok } from "@inevitable/shared";
import type { CognitiveEvent } from "@inevitable/protocols";
import type {
  EventTransport,
  VectorStore,
  GraphStore,
  RelationalStore,
} from "@inevitable/contracts";
import { requireOptional } from "./optional";

// --- NATS EventTransport ---------------------------------------------------

interface NatsMsg {
  data: Uint8Array;
  subject: string;
}
interface NatsSubscriptionLike {
  unsubscribe(): void;
}
interface NatsConnectionLike {
  publish(subject: string, data: Uint8Array): void;
  subscribe(
    subject: string,
    opts: { callback: (err: unknown, msg: NatsMsg) => void },
  ): NatsSubscriptionLike;
  drain(): Promise<void>;
}
interface NatsModule {
  connect(opts: { servers?: string | string[] }): Promise<NatsConnectionLike>;
}

interface StoredEvent {
  subject: string;
  event: CognitiveEvent;
  sequence: number;
}

export class NatsEventTransport implements EventTransport {
  private readonly encoder = new TextEncoder();
  private readonly decoder = new TextDecoder();
  private readonly seqBySubject = new Map<string, number>();
  /** Process-local mirror enabling replay(); durable replay is JetStream-backed (future). */
  private readonly mirror: StoredEvent[] = [];

  private constructor(private readonly connection: NatsConnectionLike) {}

  static async connect(
    config: {
      servers?: string | string[];
    } = {},
  ): Promise<Result<NatsEventTransport, CosError>> {
    const mod = await requireOptional<NatsModule>("nats");
    if (!mod.ok) return mod;
    const connection = await mod.value.connect({ servers: config.servers });
    return ok(new NatsEventTransport(connection));
  }

  async publish(subject: string, event: CognitiveEvent): Promise<Result<{ sequence: number }>> {
    this.connection.publish(subject, this.encoder.encode(JSON.stringify(event)));
    const sequence = this.seqBySubject.get(subject) ?? 0;
    this.seqBySubject.set(subject, sequence + 1);
    this.mirror.push({ subject, event, sequence });
    return ok({ sequence });
  }

  async subscribe(
    subject: string,
    handler: (event: CognitiveEvent) => Promise<void> | void,
  ): Promise<{ unsubscribe(): void }> {
    const sub = this.connection.subscribe(subject, {
      callback: (_err, msg) => {
        const event = JSON.parse(this.decoder.decode(msg.data)) as CognitiveEvent;
        void handler(event);
      },
    });
    return { unsubscribe: () => sub.unsubscribe() };
  }

  async *replay(subject: string, fromSequence: number): AsyncIterable<CognitiveEvent> {
    for (const record of this.mirror) {
      if (record.subject === subject && record.sequence >= fromSequence) yield record.event;
    }
  }

  async close(): Promise<void> {
    await this.connection.drain();
  }
}

// --- Qdrant VectorStore ----------------------------------------------------

interface QdrantPoint {
  id: string | number;
  vector: number[];
  payload?: Record<string, unknown>;
}
interface QdrantHit {
  id: string | number;
  score: number;
  payload?: Record<string, unknown>;
}
interface QdrantClientLike {
  upsert(collection: string, args: { wait?: boolean; points: QdrantPoint[] }): Promise<unknown>;
  search(collection: string, args: { vector: number[]; limit: number }): Promise<QdrantHit[]>;
  delete(collection: string, args: { points: Array<string | number> }): Promise<unknown>;
}
interface QdrantModule {
  QdrantClient: new (opts: { url: string }) => QdrantClientLike;
}

export class QdrantVectorStore implements VectorStore {
  private constructor(private readonly client: QdrantClientLike) {}

  static async connect(config: { url: string }): Promise<Result<QdrantVectorStore, CosError>> {
    const mod = await requireOptional<QdrantModule>("@qdrant/js-client-rest");
    if (!mod.ok) return mod;
    return ok(new QdrantVectorStore(new mod.value.QdrantClient({ url: config.url })));
  }

  async upsert(
    collection: string,
    id: string,
    vector: number[],
    payload?: Record<string, unknown>,
  ): Promise<void> {
    await this.client.upsert(collection, { wait: true, points: [{ id, vector, payload }] });
  }

  async search(
    collection: string,
    vector: number[],
    limit: number,
  ): Promise<Array<{ id: string; score: number; payload?: Record<string, unknown> }>> {
    const hits = await this.client.search(collection, { vector, limit });
    return hits.map((hit) => ({
      id: String(hit.id),
      score: hit.score,
      ...(hit.payload ? { payload: hit.payload } : {}),
    }));
  }

  async delete(collection: string, id: string): Promise<void> {
    await this.client.delete(collection, { points: [id] });
  }
}

// --- Neo4j GraphStore ------------------------------------------------------

interface Neo4jRecordLike {
  toObject(): Record<string, unknown>;
}
interface Neo4jResultLike {
  records: Neo4jRecordLike[];
}
interface Neo4jSessionLike {
  run(query: string, params?: Record<string, unknown>): Promise<Neo4jResultLike>;
  close(): Promise<void>;
}
interface Neo4jDriverLike {
  session(): Neo4jSessionLike;
  close(): Promise<void>;
}
interface Neo4jModule {
  driver(url: string, auth?: unknown): Neo4jDriverLike;
  auth: { basic(user: string, password: string): unknown };
}

export class Neo4jGraphStore implements GraphStore {
  private constructor(private readonly driver: Neo4jDriverLike) {}

  static async connect(config: {
    url: string;
    user?: string;
    password?: string;
  }): Promise<Result<Neo4jGraphStore, CosError>> {
    const mod = await requireOptional<Neo4jModule>("neo4j-driver");
    if (!mod.ok) return mod;
    const auth =
      config.user !== undefined
        ? mod.value.auth.basic(config.user, config.password ?? "")
        : undefined;
    return ok(new Neo4jGraphStore(mod.value.driver(config.url, auth)));
  }

  async query<T = unknown>(query: string, params?: Record<string, unknown>): Promise<T[]> {
    const session = this.driver.session();
    try {
      const result = await session.run(query, params);
      return result.records.map((record) => record.toObject() as T);
    } finally {
      await session.close();
    }
  }

  async mutate(query: string, params?: Record<string, unknown>): Promise<void> {
    const session = this.driver.session();
    try {
      await session.run(query, params);
    } finally {
      await session.close();
    }
  }

  async snapshot(_label: string): Promise<void> {
    // Durable graph snapshots are backend-specific (e.g. neo4j-admin dump); intentionally a no-op here.
  }

  async close(): Promise<void> {
    await this.driver.close();
  }
}

// --- Postgres RelationalStore ----------------------------------------------

interface PgResultLike {
  rows: unknown[];
}
interface PgClientLike {
  query(sql: string, params?: unknown[]): Promise<PgResultLike>;
  release(): void;
}
interface PgPoolLike {
  query(sql: string, params?: unknown[]): Promise<PgResultLike>;
  connect(): Promise<PgClientLike>;
  end(): Promise<void>;
}
interface PgModule {
  Pool: new (config?: Record<string, unknown>) => PgPoolLike;
}

class PgClientStore implements RelationalStore {
  constructor(private readonly client: PgClientLike) {}
  async query<T = unknown>(sql: string, params?: unknown[]): Promise<T[]> {
    const result = await this.client.query(sql, params);
    return result.rows as T[];
  }
  async transaction<T>(fn: (tx: RelationalStore) => Promise<T>): Promise<T> {
    // Already inside a transaction: reuse this client (savepoints are a future refinement).
    return fn(this);
  }
}

export class PostgresRelationalStore implements RelationalStore {
  private constructor(private readonly pool: PgPoolLike) {}

  static async connect(
    config: {
      connectionString?: string;
    } = {},
  ): Promise<Result<PostgresRelationalStore, CosError>> {
    const mod = await requireOptional<PgModule>("pg");
    if (!mod.ok) return mod;
    const pool = new mod.value.Pool(
      config.connectionString ? { connectionString: config.connectionString } : {},
    );
    return ok(new PostgresRelationalStore(pool));
  }

  async query<T = unknown>(sql: string, params?: unknown[]): Promise<T[]> {
    const result = await this.pool.query(sql, params);
    return result.rows as T[];
  }

  async transaction<T>(fn: (tx: RelationalStore) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const value = await fn(new PgClientStore(client));
      await client.query("COMMIT");
      return value;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
