/**
 * Durable learner registry (DPS-003 / ADR-0010). A learner is a first-class, durable identity that
 * owns surfaces over time — replacing the hardcoded demo learner. Minting allocates a stable
 * `learnerId` + cognitive `cid`; the full `CognitiveIdentity` is materialized downstream in
 * `onboarding()`.
 *
 * **Storage tiers, strongest first (ADR-0034, migration 0004).**
 * 1. `store` — Postgres. The source of truth when configured. Survives redeploy and idle spin-down.
 * 2. `persistDir` — local JSON files. The offline/dev default, and a warm cache in front of (1).
 * 3. memory — hermetic tests.
 *
 * Why the tiering exists: on the deployment tier `COS_PERSIST_DIR` points at an EPHEMERAL disk, so
 * tier 2 alone erased every learner on each redeploy — returning visitors were rejected 401 because
 * the registry holding their minted `api_key` was gone. Tier 1 is what makes "understanding
 * compounds" survive a deploy.
 *
 * **Degradation is visible, never silent.** If a durable write fails, the registry keeps serving
 * from the local tier (a learner mid-session must not lose their session to a database blip) but
 * records the failure and flips {@link LearnerRegistry.degraded}, so a caller can surface it rather
 * than discovering months later that nothing was ever persisted.
 *
 * Routing minting through the kernel `IdentityService` as the single issuing authority is a future
 * refinement (ADR-0010); for now identity is minted via the shared id authority (`newCid`).
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import type { LearnerCognitionSeed } from "@inevitable/cli";
import {
  CryptoIdGenerator,
  SystemClock,
  newCid,
  type Clock,
  type IdGenerator,
} from "@inevitable/shared";

export interface LearnerSurfaceRef {
  readonly surfaceId: string;
  readonly goal: string;
  readonly createdAt: string;
}

export interface LearnerRecord {
  readonly learnerId: string;
  readonly cid: string;
  readonly trustLevel: number;
  readonly displayName: string | null;
  readonly createdAt: string;
  /** Auto-generated bearer token. Sent to the caller on mint; required for learner-scoped routes. */
  readonly apiKey: string;
  surfaces: LearnerSurfaceRef[];
}

const DEFAULT_TRUST = 5;

const EMPTY_COGNITION: LearnerCognitionSeed = {
  worldNodes: [],
  worldEdges: [],
  memoryMutations: [],
};

/**
 * The durable tier this registry writes through to. Structurally satisfied by
 * `PostgresLearnerStore` from `@inevitable/adapters` — declared here (consumer-owned) so the
 * gateway depends on a shape, never on a driver, and stays testable with a fake.
 */
export interface DurableLearnerStore {
  upsert(row: {
    learner_id: string;
    cid: string;
    trust_level: number;
    display_name: string | null;
    created_at: string;
    api_key: string;
  }): Promise<void>;
  get(learnerId: string): Promise<DurableLearnerRow | null>;
  getByApiKey(apiKey: string): Promise<DurableLearnerRow | null>;
  recordSurface(learnerId: string, surfaceId: string, goal: string): Promise<void>;
  surfaces(
    learnerId: string,
  ): Promise<ReadonlyArray<{ surface_id: string; goal: string; created_at: string }>>;
  mergeCognition(learnerId: string, learnerCid: string, seed: DurableCognition): Promise<void>;
  readCognition(learnerId: string, learnerCid: string): Promise<DurableCognition>;
}

interface DurableLearnerRow {
  readonly learner_id: string;
  readonly cid: string;
  readonly trust_level: number;
  readonly display_name: string | null;
  readonly created_at: string;
  readonly api_key: string;
}

interface DurableCognition {
  readonly nodes: ReadonlyArray<{ id: string; type: string; props: Record<string, unknown> }>;
  readonly edges: ReadonlyArray<{
    id: string;
    from: string;
    to: string;
    type: string;
    props: Record<string, unknown>;
  }>;
  readonly mutations: ReadonlyArray<Record<string, unknown>>;
}

export class LearnerRegistry {
  private readonly mem = new Map<string, LearnerRecord>();
  /** API key → learnerId index (rebuilt from disk on boot). */
  private readonly byApiKey = new Map<string, string>();
  /** Per-learner cross-surface cognition profile (DPS-004); in memory always, on disk when persisting. */
  private readonly cognition = new Map<string, LearnerCognitionSeed>();
  private readonly idGenerator: IdGenerator;
  private readonly clock: Clock;
  private readonly persistDir: string | undefined;
  private store: DurableLearnerStore | undefined;
  /** Set when a durable write failed — the registry is serving from the ephemeral tier only. */
  private degradedReason: string | null = null;

  constructor(
    deps: {
      persistDir?: string;
      idGenerator?: IdGenerator;
      clock?: Clock;
      store?: DurableLearnerStore;
    } = {},
  ) {
    this.persistDir = deps.persistDir;
    this.store = deps.store;
    this.idGenerator = deps.idGenerator ?? new CryptoIdGenerator();
    this.clock = deps.clock ?? new SystemClock();
    if (this.persistDir) this.rebuildApiKeyIndex();
  }

  /**
   * Attach the durable tier after construction. The gateway connects to Postgres asynchronously so
   * boot never blocks on the database; until this lands the registry serves the local tier.
   */
  attach(store: DurableLearnerStore): void {
    this.store = store;
    this.degradedReason = null;
  }

  /** True when the durable tier is configured. */
  get durable(): boolean {
    return this.store !== undefined;
  }

  /** Non-null when a durable write has failed — learner memory is NOT surviving a redeploy. */
  get degraded(): string | null {
    return this.degradedReason;
  }

  /**
   * Run a durable operation, never letting its failure break the request. The failure is recorded
   * and logged loudly — silent fallback to the ephemeral tier is what produced the 401 lockout.
   */
  private async durably<T>(what: string, op: () => Promise<T>): Promise<T | undefined> {
    if (!this.store) return undefined;
    try {
      return await op();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      this.degradedReason = `${what}: ${message}`;
      console.error(
        `[learners] DURABLE ${what} FAILED — learner state is not surviving a redeploy: ${message}`,
      );
      return undefined;
    }
  }

  private fromRow(row: DurableLearnerRow, surfaces: LearnerSurfaceRef[]): LearnerRecord {
    return {
      learnerId: row.learner_id,
      cid: row.cid,
      trustLevel: row.trust_level,
      displayName: row.display_name,
      createdAt: row.created_at,
      apiKey: row.api_key,
      surfaces,
    };
  }

  /** Adopt a durable record into the local caches so later reads are hot. */
  private adopt(record: LearnerRecord): LearnerRecord {
    this.mem.set(record.learnerId, record);
    if (record.apiKey) this.byApiKey.set(record.apiKey, record.learnerId);
    this.persist(record);
    return record;
  }

  private rebuildApiKeyIndex(): void {
    const dir = this.dir();
    if (!existsSync(dir)) return;
    try {
      for (const file of readdirSync(dir)) {
        if (!file.endsWith(".json") || file.endsWith(".cognition.json")) continue;
        try {
          const r = JSON.parse(readFileSync(join(dir, file), "utf8")) as LearnerRecord;
          if (r.apiKey) this.byApiKey.set(r.apiKey, r.learnerId);
        } catch {
          // skip corrupt
        }
      }
    } catch {
      // unreadable dir
    }
  }

  private dir(): string {
    return join(this.persistDir!, "learners");
  }
  private file(learnerId: string): string {
    return join(this.dir(), `${learnerId}.json`);
  }
  private cognitionFile(learnerId: string): string {
    return join(this.dir(), `${learnerId}.cognition.json`);
  }
  private now(): string {
    return new Date(this.clock.nowMs()).toISOString();
  }

  /**
   * Resolve a known learner (identity + trust authoritative) or mint a fresh one. A requested-but-
   * unknown id is never claimed (no spoofing): an unknown learner gets a brand-new id.
   */
  async resolveOrCreate(input: {
    learnerId?: string;
    trustLevel?: number;
    displayName?: string;
  }): Promise<LearnerRecord> {
    if (input.learnerId) {
      const existing = await this.get(input.learnerId);
      if (existing) return existing;
    }
    const apiKey = randomBytes(24).toString("hex");
    const record: LearnerRecord = {
      learnerId: `lnr-${this.idGenerator.hex(12)}`,
      cid: newCid(this.idGenerator),
      trustLevel: input.trustLevel ?? DEFAULT_TRUST,
      displayName: input.displayName ?? null,
      createdAt: this.now(),
      apiKey,
      surfaces: [],
    };
    this.mem.set(record.learnerId, record);
    this.byApiKey.set(apiKey, record.learnerId);
    this.persist(record);
    await this.durably("mint", () =>
      this.store!.upsert({
        learner_id: record.learnerId,
        cid: record.cid,
        trust_level: record.trustLevel,
        display_name: record.displayName,
        created_at: record.createdAt,
        api_key: record.apiKey,
      }),
    );
    return record;
  }

  async get(learnerId: string): Promise<LearnerRecord | undefined> {
    const cached = this.mem.get(learnerId);
    if (cached) return cached;
    // Durable tier first: after a redeploy the local tier is empty but the learner still exists.
    const row = await this.durably("get", () => this.store!.get(learnerId));
    if (row) {
      const surfaces =
        (await this.durably("surfaces", () => this.store!.surfaces(learnerId))) ?? [];
      return this.adopt(
        this.fromRow(
          row,
          surfaces.map((s) => ({
            surfaceId: s.surface_id,
            goal: s.goal,
            createdAt: s.created_at,
          })),
        ),
      );
    }
    if (this.persistDir && existsSync(this.file(learnerId))) {
      try {
        const record = JSON.parse(readFileSync(this.file(learnerId), "utf8")) as LearnerRecord;
        this.mem.set(learnerId, record);
        if (record.apiKey) this.byApiKey.set(record.apiKey, record.learnerId);
        return record;
      } catch {
        return undefined; // corrupt record
      }
    }
    return undefined;
  }

  /**
   * Resolve a learner by API key (the bearer credential). Returns undefined for unknown keys.
   *
   * The durable lookup is what heals a returning learner after a redeploy: the in-process key index
   * is empty on a cold boot, so a key-only match must reach the database or the learner is a
   * stranger to their own account.
   */
  async getByApiKey(apiKey: string): Promise<LearnerRecord | undefined> {
    const learnerId = this.byApiKey.get(apiKey);
    if (learnerId) return this.get(learnerId);
    const row = await this.durably("getByApiKey", () => this.store!.getByApiKey(apiKey));
    if (!row) return undefined;
    const surfaces =
      (await this.durably("surfaces", () => this.store!.surfaces(row.learner_id))) ?? [];
    return this.adopt(
      this.fromRow(
        row,
        surfaces.map((s) => ({ surfaceId: s.surface_id, goal: s.goal, createdAt: s.created_at })),
      ),
    );
  }

  /** Associate a surface with its owning learner (idempotent). */
  async recordSurface(
    learnerId: string,
    surface: { surfaceId: string; goal: string },
  ): Promise<void> {
    const record = await this.get(learnerId);
    if (!record) return;
    if (record.surfaces.some((s) => s.surfaceId === surface.surfaceId)) return;
    record.surfaces.push({
      surfaceId: surface.surfaceId,
      goal: surface.goal,
      createdAt: this.now(),
    });
    this.persist(record);
    await this.durably("recordSurface", () =>
      this.store!.recordSurface(learnerId, surface.surfaceId, surface.goal),
    );
  }

  /**
   * The learner's cross-surface cognition profile (DPS-004): their mastery subgraph + durable-tier
   * memory, accumulated across surfaces. Used to seed a returning learner's NEW surface. Returns
   * undefined when the learner has no prior cognition (a freshly-minted learner seeds nothing).
   */
  async readCognition(learnerId: string): Promise<LearnerCognitionSeed | undefined> {
    const cached = this.cognition.get(learnerId);
    if (cached) return cached;
    // Durable tier first — this is the read that makes a returning learner resume where they were.
    const record = this.mem.get(learnerId);
    if (record) {
      const durable = await this.durably("readCognition", () =>
        this.store!.readCognition(learnerId, record.cid),
      );
      if (durable && (durable.nodes.length > 0 || durable.mutations.length > 0)) {
        const profile: LearnerCognitionSeed = {
          worldNodes: durable.nodes.map((n) => ({ id: n.id, type: n.type, props: n.props })),
          worldEdges: durable.edges.map((e) => ({
            id: e.id,
            from: e.from,
            to: e.to,
            type: e.type,
            props: e.props,
          })),
          memoryMutations: durable.mutations as unknown as LearnerCognitionSeed["memoryMutations"],
        };
        this.cognition.set(learnerId, profile);
        return profile;
      }
    }
    if (this.persistDir && existsSync(this.cognitionFile(learnerId))) {
      try {
        const profile = JSON.parse(
          readFileSync(this.cognitionFile(learnerId), "utf8"),
        ) as LearnerCognitionSeed;
        this.cognition.set(learnerId, profile);
        return profile;
      } catch {
        return undefined; // corrupt profile → treat as absent (re-derivable cache)
      }
    }
    return undefined;
  }

  /**
   * Merge a surface's freshly-extracted durable cognition into the learner's profile (DPS-004).
   * Idempotent and id-keyed: nodes/edges by id, mutations by `mutation_id`, so re-capturing an
   * unchanged surface is a no-op and a concept is never double-counted.
   */
  async mergeCognition(learnerId: string, incoming: LearnerCognitionSeed): Promise<void> {
    const current = (await this.readCognition(learnerId)) ?? EMPTY_COGNITION;
    const nodes = new Map(current.worldNodes.map((n) => [n.id, n]));
    for (const n of incoming.worldNodes) nodes.set(n.id, n);
    const edges = new Map(current.worldEdges.map((e) => [e.id, e]));
    for (const e of incoming.worldEdges) edges.set(e.id, e);
    const mutations = new Map(current.memoryMutations.map((m) => [m.mutation_id, m]));
    for (const m of incoming.memoryMutations) mutations.set(m.mutation_id, m);
    const merged: LearnerCognitionSeed = {
      worldNodes: [...nodes.values()],
      worldEdges: [...edges.values()],
      memoryMutations: [...mutations.values()],
    };
    this.cognition.set(learnerId, merged);
    if (this.persistDir) {
      mkdirSync(this.dir(), { recursive: true });
      writeFileSync(this.cognitionFile(learnerId), JSON.stringify(merged), "utf8");
    }
    // Only the INCOMING slice goes durable: the store merges id-keyed, so re-writing the whole
    // profile every capture would be O(profile) per command for no gain.
    const cid = this.mem.get(learnerId)?.cid;
    if (cid) {
      await this.durably("mergeCognition", () =>
        this.store!.mergeCognition(learnerId, cid, {
          nodes: incoming.worldNodes.map((n) => ({ id: n.id, type: n.type, props: n.props })),
          edges: incoming.worldEdges.map((e) => ({
            id: e.id,
            from: e.from,
            to: e.to,
            type: e.type,
            props: e.props,
          })),
          mutations: incoming.memoryMutations as unknown as ReadonlyArray<Record<string, unknown>>,
        }),
      );
    }
  }

  private persist(record: LearnerRecord): void {
    if (!this.persistDir) return;
    mkdirSync(this.dir(), { recursive: true });
    writeFileSync(this.file(record.learnerId), JSON.stringify(record), "utf8");
  }
}
