/**
 * Supabase-first backend adapters (ADR-0034). Postgres is the durable seam behind the
 * EventTransport and VectorStore contracts; Supabase Storage is the out-of-band object store for
 * source/media bytes (`content_ref`). Everything follows the external-adapter discipline
 * (ADR-0005): guarded dynamic import (`pg` is provisioned at the deployment edge, never a
 * workspace dependency), a minimal local client narrowing, a `fromPool()`/injected-fetch test
 * seam, and the same conformance harness as the in-memory reference.
 *
 * Schema: `supabase/migrations/0002_sources.sql` (`transport_events`), `0001_core_substrate.sql`
 * (`vectors`). RelationalStore already exists as {@link PostgresRelationalStore} in external.ts.
 */
import { CosError, err, ok, type Result } from "@inevitable/shared";
import type { CognitiveEvent } from "@inevitable/protocols";
import { matchSubject } from "@inevitable/events";
import type { EventTransport, VectorStore } from "@inevitable/contracts";
import { requireOptional } from "./optional";

// ── Narrow pg client interfaces (no vendor type crosses the boundary) ─────────────────────────

interface PgResultLike {
  rows: unknown[];
}
export interface PgPoolLike {
  query(sql: string, params?: unknown[]): Promise<PgResultLike>;
  end?(): Promise<void>;
}
interface PgModule {
  Pool: new (config?: Record<string, unknown>) => PgPoolLike;
}

async function connectPool(connectionString: string): Promise<Result<PgPoolLike, CosError>> {
  const mod = await requireOptional<PgModule | { default: PgModule }>("pg");
  if (!mod.ok) return mod;
  const resolved = "Pool" in mod.value ? mod.value : mod.value.default;
  const pool = new resolved.Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: 4,
  });
  return ok(pool);
}

// ── Postgres EventTransport ────────────────────────────────────────────────────────────────────

interface Subscriber {
  readonly pattern: string;
  readonly handler: (event: CognitiveEvent) => Promise<void> | void;
}

/** SQL surface — exported so hermetic fakes switch on the exact statements, not regexes. */
export const TRANSPORT_SQL = {
  /** Per-subject next sequence, race-safe via unique(subject,sequence) + retry on conflict. */
  insert: (table: string): string =>
    `INSERT INTO ${table} (subject, sequence, event) ` +
    `SELECT $1, COALESCE(MAX(sequence) + 1, 0), $2::jsonb FROM ${table} WHERE subject = $1 ` +
    `ON CONFLICT (subject, sequence) DO NOTHING RETURNING sequence`,
  /** Global insertion order; subject pattern-matching happens in JS (wildcards). */
  replay: (table: string): string =>
    `SELECT subject, sequence, event FROM ${table} WHERE sequence >= $1 ORDER BY id`,
} as const;

/**
 * EventTransport over Postgres (`transport_events`). Publish assigns per-subject monotonic
 * sequences from 0 (durable, multi-process safe via the unique constraint + retry); subscribe is
 * process-local fan-out (identical semantics to FileEventTransport — cross-process LISTEN/NOTIFY
 * or Supabase Realtime is a documented later step); replay reads in global insertion order and
 * filters by subject pattern.
 */
export class PostgresEventTransport implements EventTransport {
  private readonly subscribers = new Set<Subscriber>();

  private constructor(
    private readonly pool: PgPoolLike,
    private readonly table: string,
  ) {}

  static async connect(config: {
    connectionString: string;
    table?: string;
  }): Promise<Result<PostgresEventTransport, CosError>> {
    const pool = await connectPool(config.connectionString);
    if (!pool.ok) return pool;
    return ok(new PostgresEventTransport(pool.value, config.table ?? "transport_events"));
  }

  /** Test seam: build around an injected (fake) pool — no driver, no network. */
  static fromPool(pool: PgPoolLike, table = "transport_events"): PostgresEventTransport {
    return new PostgresEventTransport(pool, table);
  }

  async publish(subject: string, event: CognitiveEvent): Promise<Result<{ sequence: number }>> {
    const sql = TRANSPORT_SQL.insert(this.table);
    for (let attempt = 0; attempt < 5; attempt++) {
      const result = await this.pool.query(sql, [subject, JSON.stringify(event)]);
      const row = result.rows[0] as { sequence: number | string } | undefined;
      if (row) {
        for (const sub of this.subscribers) {
          if (matchSubject(sub.pattern, subject)) await sub.handler(event);
        }
        return ok({ sequence: Number(row.sequence) });
      }
      // Unique-constraint conflict: another writer took the sequence — recompute and retry.
    }
    return err(
      new CosError("E_ADAPTER_PUBLISH_CONTENTION", "publish lost the sequence race 5 times", {
        specRef: "interop/infrastructure-adapters",
        details: { subject },
      }),
    );
  }

  async subscribe(
    subject: string,
    handler: (event: CognitiveEvent) => Promise<void> | void,
  ): Promise<{ unsubscribe(): void }> {
    const sub: Subscriber = { pattern: subject, handler };
    this.subscribers.add(sub);
    return { unsubscribe: () => this.subscribers.delete(sub) };
  }

  async *replay(subject: string, fromSequence: number): AsyncIterable<CognitiveEvent> {
    const result = await this.pool.query(TRANSPORT_SQL.replay(this.table), [fromSequence]);
    for (const raw of result.rows) {
      const row = raw as { subject: string; sequence: number | string; event: unknown };
      if (!matchSubject(subject, row.subject)) continue;
      const event =
        typeof row.event === "string"
          ? (JSON.parse(row.event) as CognitiveEvent)
          : (row.event as CognitiveEvent);
      yield event;
    }
  }

  async close(): Promise<void> {
    await this.pool.end?.();
  }
}

// ── pgvector VectorStore ───────────────────────────────────────────────────────────────────────

/** pgvector literal: `[0.1,0.2,…]`. */
function vectorLiteral(vector: number[]): string {
  return `[${vector.join(",")}]`;
}

export const VECTOR_SQL = {
  upsert:
    "INSERT INTO vectors (tenant_id, collection, id, embedding, payload) " +
    "VALUES ('default', $1, $2, $3::vector, $4::jsonb) " +
    "ON CONFLICT (tenant_id, collection, id) " +
    "DO UPDATE SET embedding = EXCLUDED.embedding, payload = EXCLUDED.payload",
  search:
    "SELECT id, payload, 1 - (embedding <=> $2::vector) AS score FROM vectors " +
    "WHERE tenant_id = 'default' AND collection = $1 " +
    "ORDER BY embedding <=> $2::vector LIMIT $3",
  remove: "DELETE FROM vectors WHERE tenant_id = 'default' AND collection = $1 AND id = $2",
} as const;

/** VectorStore over Postgres + pgvector (`vectors`, migration 0001). Cosine similarity scores. */
export class PgVectorStore implements VectorStore {
  private constructor(private readonly pool: PgPoolLike) {}

  static async connect(config: {
    connectionString: string;
  }): Promise<Result<PgVectorStore, CosError>> {
    const pool = await connectPool(config.connectionString);
    if (!pool.ok) return pool;
    return ok(new PgVectorStore(pool.value));
  }

  /** Test seam: injected (fake) pool. */
  static fromPool(pool: PgPoolLike): PgVectorStore {
    return new PgVectorStore(pool);
  }

  async upsert(
    collection: string,
    id: string,
    vector: number[],
    payload?: Record<string, unknown>,
  ): Promise<void> {
    await this.pool.query(VECTOR_SQL.upsert, [
      collection,
      id,
      vectorLiteral(vector),
      JSON.stringify(payload ?? {}),
    ]);
  }

  async search(
    collection: string,
    vector: number[],
    limit: number,
  ): Promise<Array<{ id: string; score: number; payload?: Record<string, unknown> }>> {
    const result = await this.pool.query(VECTOR_SQL.search, [
      collection,
      vectorLiteral(vector),
      limit,
    ]);
    return result.rows.map((raw) => {
      const row = raw as { id: string; score: number | string; payload?: unknown };
      const payload =
        typeof row.payload === "string"
          ? (JSON.parse(row.payload) as Record<string, unknown>)
          : ((row.payload as Record<string, unknown> | undefined) ?? undefined);
      return {
        id: row.id,
        score: Number(row.score),
        ...(payload && Object.keys(payload).length > 0 ? { payload } : {}),
      };
    });
  }

  async delete(collection: string, id: string): Promise<void> {
    await this.pool.query(VECTOR_SQL.remove, [collection, id]);
  }

  async close(): Promise<void> {
    await this.pool.end?.();
  }
}

// ── Intelligence Plane store (ADR-0035; `intelligence_artifacts`, migration 0003) ─────────────

/** Structural artifact shape (mirrors @inevitable/intelligence without a workspace dep —
 * adapters stay leaf-level; the envelope is validated upstream by the registry). */
export interface IntelligenceArtifactRow {
  readonly artifact_id: string;
  readonly kind: string;
  readonly scope: {
    readonly regime: "learner" | "shared";
    readonly learner_cid: string | null;
    readonly tenant_id: string;
  };
  readonly body: Record<string, unknown>;
  readonly epistemics: {
    readonly confidence: number;
    readonly method: string;
    readonly method_version: string;
    readonly provenance_refs: readonly string[];
    readonly supersedes: string | null;
    readonly decay_policy: string;
  };
  readonly consumers: readonly string[];
  readonly distilled_hlc: string;
}

export const INTELLIGENCE_SQL = {
  upsert:
    "INSERT INTO intelligence_artifacts (artifact_id, tenant_id, kind, regime, learner_cid, body, " +
    "confidence, method, method_version, provenance_refs, supersedes, decay_policy, consumers, distilled_hlc) " +
    "VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10::jsonb, $11, $12, $13::jsonb, $14) " +
    "ON CONFLICT (artifact_id) DO NOTHING",
  byLearner:
    "SELECT artifact_id, kind, regime, learner_cid, tenant_id, body, confidence, method, " +
    "method_version, provenance_refs, supersedes, decay_policy, consumers, distilled_hlc " +
    "FROM intelligence_artifacts WHERE tenant_id = $1 AND learner_cid = $2 AND quarantined = false " +
    "ORDER BY distilled_hlc",
  redactLearner: "DELETE FROM intelligence_artifacts WHERE tenant_id = $1 AND learner_cid = $2",
} as const;

/**
 * Durable Intelligence Plane over Postgres. `redactLearner` is the G1 deletion cascade at the
 * store: a hard DELETE of every learner-scoped artifact (ADR-0035 lock 4), never a soft hide.
 */
export class PostgresIntelligenceStore {
  private constructor(private readonly pool: PgPoolLike) {}

  static async connect(config: {
    connectionString: string;
  }): Promise<Result<PostgresIntelligenceStore, CosError>> {
    const pool = await connectPool(config.connectionString);
    if (!pool.ok) return pool;
    return ok(new PostgresIntelligenceStore(pool.value));
  }

  /** Test seam: injected (fake) pool. */
  static fromPool(pool: PgPoolLike): PostgresIntelligenceStore {
    return new PostgresIntelligenceStore(pool);
  }

  async upsert(artifact: IntelligenceArtifactRow): Promise<void> {
    await this.pool.query(INTELLIGENCE_SQL.upsert, [
      artifact.artifact_id,
      artifact.scope.tenant_id,
      artifact.kind,
      artifact.scope.regime,
      artifact.scope.learner_cid,
      JSON.stringify(artifact.body),
      artifact.epistemics.confidence,
      artifact.epistemics.method,
      artifact.epistemics.method_version,
      JSON.stringify(artifact.epistemics.provenance_refs),
      artifact.epistemics.supersedes,
      artifact.epistemics.decay_policy,
      JSON.stringify(artifact.consumers),
      artifact.distilled_hlc,
    ]);
  }

  async listByLearner(tenantId: string, learnerCid: string): Promise<IntelligenceArtifactRow[]> {
    const result = await this.pool.query(INTELLIGENCE_SQL.byLearner, [tenantId, learnerCid]);
    return result.rows.map((raw) => {
      const row = raw as Record<string, unknown>;
      const json = <T>(v: unknown, fallback: T): T =>
        typeof v === "string" ? (JSON.parse(v) as T) : ((v as T) ?? fallback);
      return {
        artifact_id: String(row["artifact_id"]),
        kind: String(row["kind"]),
        scope: {
          regime: row["regime"] as "learner" | "shared",
          learner_cid: (row["learner_cid"] as string | null) ?? null,
          tenant_id: String(row["tenant_id"]),
        },
        body: json<Record<string, unknown>>(row["body"], {}),
        epistemics: {
          confidence: Number(row["confidence"]),
          method: String(row["method"]),
          method_version: String(row["method_version"]),
          provenance_refs: json<string[]>(row["provenance_refs"], []),
          supersedes: (row["supersedes"] as string | null) ?? null,
          decay_policy: String(row["decay_policy"]),
        },
        consumers: json<string[]>(row["consumers"], []),
        distilled_hlc: String(row["distilled_hlc"]),
      };
    });
  }

  /** G1 deletion cascade: hard-deletes every learner-scoped artifact for this learner. */
  async redactLearner(tenantId: string, learnerCid: string): Promise<void> {
    await this.pool.query(INTELLIGENCE_SQL.redactLearner, [tenantId, learnerCid]);
  }

  async close(): Promise<void> {
    await this.pool.end?.();
  }
}

// ── Durable learner store (DPS-003/DPS-004; `learners`, `learner_*`, migration 0004) ──────────

/** A learner's durable identity record (mirrors the gateway's `LearnerRecord`, no workspace dep). */
export interface LearnerRow {
  readonly learner_id: string;
  readonly cid: string;
  readonly trust_level: number;
  readonly display_name: string | null;
  readonly created_at: string;
  readonly api_key: string;
}

/** One surface a learner owns (resume-by-learner). */
export interface LearnerSurfaceRow {
  readonly surface_id: string;
  readonly goal: string;
  readonly created_at: string;
}

/** The learner's carried cognition — their durable subgraph + durable-tier memory (DPS-004). */
export interface LearnerCognitionRow {
  readonly nodes: ReadonlyArray<{
    id: string;
    type: string;
    props: Record<string, unknown>;
  }>;
  readonly edges: ReadonlyArray<{
    id: string;
    from: string;
    to: string;
    type: string;
    props: Record<string, unknown>;
  }>;
  readonly mutations: ReadonlyArray<Record<string, unknown>>;
}

export const LEARNER_SQL = {
  upsert:
    "INSERT INTO learners (cid, learner_id, tenant_id, trust_level, api_key, display_name, created_at, last_seen_at) " +
    "VALUES ($1, $2, $3, $4, $5, $6, $7, now()) " +
    "ON CONFLICT (cid) DO UPDATE SET last_seen_at = now(), display_name = EXCLUDED.display_name",
  byId:
    "SELECT learner_id, cid, trust_level, display_name, created_at, api_key FROM learners " +
    "WHERE tenant_id = $1 AND learner_id = $2",
  byApiKey:
    "SELECT learner_id, cid, trust_level, display_name, created_at, api_key FROM learners " +
    "WHERE tenant_id = $1 AND api_key = $2",
  touch: "UPDATE learners SET last_seen_at = now() WHERE tenant_id = $1 AND learner_id = $2",
  addSurface:
    "INSERT INTO learner_surfaces (tenant_id, learner_id, surface_id, goal) VALUES ($1, $2, $3, $4) " +
    "ON CONFLICT (tenant_id, learner_id, surface_id) DO NOTHING",
  surfaces:
    "SELECT surface_id, goal, created_at FROM learner_surfaces " +
    "WHERE tenant_id = $1 AND learner_id = $2 ORDER BY created_at DESC",
  upsertNode:
    "INSERT INTO learner_world_nodes (tenant_id, learner_id, node_id, node_type, props, updated_at) " +
    "VALUES ($1, $2, $3, $4, $5::jsonb, now()) " +
    "ON CONFLICT (tenant_id, learner_id, node_id) " +
    "DO UPDATE SET node_type = EXCLUDED.node_type, props = EXCLUDED.props, updated_at = now()",
  upsertEdge:
    "INSERT INTO learner_world_edges (tenant_id, learner_id, edge_id, from_node, to_node, edge_type, props, updated_at) " +
    "VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, now()) " +
    "ON CONFLICT (tenant_id, learner_id, edge_id) " +
    "DO UPDATE SET props = EXCLUDED.props, updated_at = now()",
  upsertMutation:
    "INSERT INTO memory_mutations (mutation_id, tenant_id, learner_cid, tier, mutation, hlc) " +
    "VALUES ($1, $2, $3, $4, $5::jsonb, $6) ON CONFLICT (mutation_id) DO NOTHING",
  nodes:
    "SELECT node_id, node_type, props FROM learner_world_nodes WHERE tenant_id = $1 AND learner_id = $2",
  edges:
    "SELECT edge_id, from_node, to_node, edge_type, props FROM learner_world_edges " +
    "WHERE tenant_id = $1 AND learner_id = $2",
  mutations:
    "SELECT mutation FROM memory_mutations WHERE tenant_id = $1 AND learner_cid = $2 ORDER BY seq",
  // Right-to-erasure cascade (ADR-0034/0064): every learner-scoped table, hard delete, never a soft
  // hide. memory_mutations is keyed by the cognitive id, the rest by learner_id.
  redactNodes: "DELETE FROM learner_world_nodes WHERE tenant_id = $1 AND learner_id = $2",
  redactEdges: "DELETE FROM learner_world_edges WHERE tenant_id = $1 AND learner_id = $2",
  redactSurfaces: "DELETE FROM learner_surfaces WHERE tenant_id = $1 AND learner_id = $2",
  redactMutations: "DELETE FROM memory_mutations WHERE tenant_id = $1 AND learner_cid = $2",
  redact: "DELETE FROM learners WHERE tenant_id = $1 AND learner_id = $2",
} as const;

function asJson<T>(value: unknown, fallback: T): T {
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return (value as T) ?? fallback;
}

/**
 * Durable learner identity + carried cognition over Postgres (migration 0004).
 *
 * This is the store that makes "understanding compounds" literally true across a redeploy: identity,
 * the learner's surfaces, and their durable subgraph survive the process. Cognition is written
 * id-keyed and idempotently, so re-capturing an unchanged surface is a no-op — the same merge
 * semantics the file-backed profile had, now enforced by the primary key rather than by a read-
 * modify-write of a JSON blob (which lost concurrent writes).
 */
export class PostgresLearnerStore {
  private constructor(
    private readonly pool: PgPoolLike,
    private readonly tenantId: string,
  ) {}

  static async connect(config: {
    connectionString: string;
    tenantId?: string;
  }): Promise<Result<PostgresLearnerStore, CosError>> {
    const pool = await connectPool(config.connectionString);
    if (!pool.ok) return pool;
    return ok(new PostgresLearnerStore(pool.value, config.tenantId ?? "default"));
  }

  /** Test seam: injected (fake) pool — no driver, no network. */
  static fromPool(pool: PgPoolLike, tenantId = "default"): PostgresLearnerStore {
    return new PostgresLearnerStore(pool, tenantId);
  }

  async upsert(learner: LearnerRow): Promise<void> {
    await this.pool.query(LEARNER_SQL.upsert, [
      learner.cid,
      learner.learner_id,
      this.tenantId,
      learner.trust_level,
      learner.api_key,
      learner.display_name,
      learner.created_at,
    ]);
  }

  private rowToLearner(raw: unknown): LearnerRow {
    const row = raw as Record<string, unknown>;
    const created = row["created_at"];
    return {
      learner_id: String(row["learner_id"]),
      cid: String(row["cid"]),
      trust_level: Number(row["trust_level"]),
      display_name: (row["display_name"] as string | null) ?? null,
      created_at: created instanceof Date ? created.toISOString() : String(created),
      api_key: String(row["api_key"]),
    };
  }

  async get(learnerId: string): Promise<LearnerRow | null> {
    const res = await this.pool.query(LEARNER_SQL.byId, [this.tenantId, learnerId]);
    const row = res.rows[0];
    return row ? this.rowToLearner(row) : null;
  }

  /** Resolve by bearer credential. Returning learners are recognised across a redeploy. */
  async getByApiKey(apiKey: string): Promise<LearnerRow | null> {
    const res = await this.pool.query(LEARNER_SQL.byApiKey, [this.tenantId, apiKey]);
    const row = res.rows[0];
    return row ? this.rowToLearner(row) : null;
  }

  async recordSurface(learnerId: string, surfaceId: string, goal: string): Promise<void> {
    await this.pool.query(LEARNER_SQL.addSurface, [this.tenantId, learnerId, surfaceId, goal]);
  }

  async surfaces(learnerId: string): Promise<LearnerSurfaceRow[]> {
    const res = await this.pool.query(LEARNER_SQL.surfaces, [this.tenantId, learnerId]);
    return res.rows.map((raw) => {
      const row = raw as Record<string, unknown>;
      const created = row["created_at"];
      return {
        surface_id: String(row["surface_id"]),
        goal: String(row["goal"]),
        created_at: created instanceof Date ? created.toISOString() : String(created),
      };
    });
  }

  /** Merge a surface's freshly-extracted cognition into the learner's durable profile. */
  async mergeCognition(
    learnerId: string,
    learnerCid: string,
    seed: LearnerCognitionRow,
  ): Promise<void> {
    for (const node of seed.nodes) {
      await this.pool.query(LEARNER_SQL.upsertNode, [
        this.tenantId,
        learnerId,
        node.id,
        node.type,
        JSON.stringify(node.props ?? {}),
      ]);
    }
    for (const edge of seed.edges) {
      await this.pool.query(LEARNER_SQL.upsertEdge, [
        this.tenantId,
        learnerId,
        edge.id,
        edge.from,
        edge.to,
        edge.type,
        JSON.stringify(edge.props ?? {}),
      ]);
    }
    for (const mutation of seed.mutations) {
      const m = mutation as Record<string, unknown>;
      await this.pool.query(LEARNER_SQL.upsertMutation, [
        String(m["mutation_id"]),
        this.tenantId,
        learnerCid,
        String(m["memory_layer"] ?? "semantic"),
        JSON.stringify(mutation),
        String(m["hlc"] ?? ""),
      ]);
    }
  }

  /** The learner's carried cognition, for seeding a NEW surface (DPS-004). */
  async readCognition(learnerId: string, learnerCid: string): Promise<LearnerCognitionRow> {
    const [nodesRes, edgesRes, mutsRes] = await Promise.all([
      this.pool.query(LEARNER_SQL.nodes, [this.tenantId, learnerId]),
      this.pool.query(LEARNER_SQL.edges, [this.tenantId, learnerId]),
      this.pool.query(LEARNER_SQL.mutations, [this.tenantId, learnerCid]),
    ]);
    return {
      nodes: nodesRes.rows.map((raw) => {
        const r = raw as Record<string, unknown>;
        return {
          id: String(r["node_id"]),
          type: String(r["node_type"]),
          props: asJson<Record<string, unknown>>(r["props"], {}),
        };
      }),
      edges: edgesRes.rows.map((raw) => {
        const r = raw as Record<string, unknown>;
        return {
          id: String(r["edge_id"]),
          from: String(r["from_node"]),
          to: String(r["to_node"]),
          type: String(r["edge_type"]),
          props: asJson<Record<string, unknown>>(r["props"], {}),
        };
      }),
      mutations: mutsRes.rows.map((raw) =>
        asJson<Record<string, unknown>>((raw as Record<string, unknown>)["mutation"], {}),
      ),
    };
  }

  /**
   * Right-to-erasure (ADR-0034/0064): hard-delete every trace of a learner — carried subgraph,
   * surfaces, durable memory (by cognitive id), and finally the identity row. Ordered so the
   * identity row (which holds the cid we key memory by) is removed last. A hard delete, never a soft
   * hide. `cid` is looked up when not supplied so callers holding only the learner id still cascade.
   */
  async redact(learnerId: string, cid?: string): Promise<void> {
    const learnerCid = cid ?? (await this.get(learnerId))?.cid ?? null;
    await this.pool.query(LEARNER_SQL.redactNodes, [this.tenantId, learnerId]);
    await this.pool.query(LEARNER_SQL.redactEdges, [this.tenantId, learnerId]);
    await this.pool.query(LEARNER_SQL.redactSurfaces, [this.tenantId, learnerId]);
    if (learnerCid) {
      await this.pool.query(LEARNER_SQL.redactMutations, [this.tenantId, learnerCid]);
    }
    await this.pool.query(LEARNER_SQL.redact, [this.tenantId, learnerId]);
  }

  async close(): Promise<void> {
    await this.pool.end?.();
  }
}

// ── Supabase Storage object store ──────────────────────────────────────────────────────────────

export interface StoredObject {
  readonly bytes: Uint8Array;
  readonly mimeType: string;
}

type FetchLike = (
  url: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: Uint8Array | string;
  },
) => Promise<{
  ok: boolean;
  status: number;
  arrayBuffer(): Promise<ArrayBuffer>;
  headers: { get(name: string): string | null };
  text(): Promise<string>;
}>;

/**
 * Async object store over Supabase Storage (S3-compatible; bytes referenced by `content_ref`,
 * never inline — CSE-002 §2, SRF-006). Deliberately async: the gateway's synchronous MediaStore
 * interface adapts to this at gateway-cutover rather than forcing sync-over-HTTP here.
 */
export class SupabaseStorageObjectStore {
  private constructor(
    private readonly baseUrl: string,
    private readonly serviceKey: string,
    private readonly bucket: string,
    private readonly fetchImpl: FetchLike,
  ) {}

  static create(config: {
    url: string;
    serviceRoleKey: string;
    bucket?: string;
    fetchImpl?: FetchLike;
  }): Result<SupabaseStorageObjectStore, CosError> {
    if (!config.url || !config.serviceRoleKey) {
      return err(
        new CosError("E_ADAPTER_UNAVAILABLE", "Supabase Storage requires url + service role key", {
          specRef: "interop/infrastructure-adapters",
        }),
      );
    }
    return ok(
      new SupabaseStorageObjectStore(
        config.url.replace(/\/$/, ""),
        config.serviceRoleKey,
        config.bucket ?? "cos-media",
        config.fetchImpl ?? (globalThis.fetch as unknown as FetchLike),
      ),
    );
  }

  private headers(extra?: Record<string, string>): Record<string, string> {
    return { Authorization: `Bearer ${this.serviceKey}`, ...extra };
  }

  /** Idempotently ensure the bucket exists (409 = already there). */
  async ensureBucket(): Promise<Result<void, CosError>> {
    const res = await this.fetchImpl(`${this.baseUrl}/storage/v1/bucket`, {
      method: "POST",
      headers: this.headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ id: this.bucket, name: this.bucket, public: false }),
    });
    if (res.ok || res.status === 409) return ok(undefined);
    return err(
      new CosError("E_ADAPTER_STORAGE", `bucket create failed (${res.status})`, {
        specRef: "interop/infrastructure-adapters",
        details: { status: res.status, body: (await res.text()).slice(0, 200) },
      }),
    );
  }

  async put(path: string, object: StoredObject): Promise<Result<{ content_ref: string }>> {
    const res = await this.fetchImpl(`${this.baseUrl}/storage/v1/object/${this.bucket}/${path}`, {
      method: "POST",
      headers: this.headers({ "Content-Type": object.mimeType, "x-upsert": "true" }),
      body: object.bytes,
    });
    if (!res.ok) {
      return err(
        new CosError("E_ADAPTER_STORAGE", `upload failed (${res.status})`, {
          specRef: "interop/infrastructure-adapters",
          details: { path, status: res.status },
        }),
      );
    }
    return ok({ content_ref: `storage://${this.bucket}/${path}` });
  }

  async get(path: string): Promise<Result<StoredObject>> {
    const res = await this.fetchImpl(`${this.baseUrl}/storage/v1/object/${this.bucket}/${path}`, {
      method: "GET",
      headers: this.headers(),
    });
    if (!res.ok) {
      return err(
        new CosError("E_ADAPTER_STORAGE", `download failed (${res.status})`, {
          specRef: "interop/infrastructure-adapters",
          details: { path, status: res.status },
        }),
      );
    }
    const bytes = new Uint8Array(await res.arrayBuffer());
    const mimeType = res.headers.get("content-type") ?? "application/octet-stream";
    return ok({ bytes, mimeType });
  }
}
