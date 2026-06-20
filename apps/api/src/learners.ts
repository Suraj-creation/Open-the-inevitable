/**
 * Durable learner registry (DPS-003 / ADR-0010). A learner is a first-class, durable identity that
 * owns surfaces over time — replacing the hardcoded demo learner. File-backed when persistence is on
 * (`<dir>/learners/<learnerId>.json`), in-memory otherwise. Minting allocates a stable `learnerId` +
 * cognitive `cid`; the full `CognitiveIdentity` is materialized downstream in `onboarding()`.
 *
 * Routing minting through the kernel `IdentityService` as the single issuing authority is a future
 * refinement (ADR-0010); for now identity is minted via the shared id authority (`newCid`).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
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
  surfaces: LearnerSurfaceRef[];
}

const DEFAULT_TRUST = 5;

const EMPTY_COGNITION: LearnerCognitionSeed = {
  worldNodes: [],
  worldEdges: [],
  memoryMutations: [],
};

export class LearnerRegistry {
  private readonly mem = new Map<string, LearnerRecord>();
  /** Per-learner cross-surface cognition profile (DPS-004); in memory always, on disk when persisting. */
  private readonly cognition = new Map<string, LearnerCognitionSeed>();
  private readonly idGenerator: IdGenerator;
  private readonly clock: Clock;
  private readonly persistDir: string | undefined;

  constructor(deps: { persistDir?: string; idGenerator?: IdGenerator; clock?: Clock } = {}) {
    this.persistDir = deps.persistDir;
    this.idGenerator = deps.idGenerator ?? new CryptoIdGenerator();
    this.clock = deps.clock ?? new SystemClock();
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
  resolveOrCreate(input: {
    learnerId?: string;
    trustLevel?: number;
    displayName?: string;
  }): LearnerRecord {
    if (input.learnerId) {
      const existing = this.get(input.learnerId);
      if (existing) return existing;
    }
    const record: LearnerRecord = {
      learnerId: `lnr-${this.idGenerator.hex(12)}`,
      cid: newCid(this.idGenerator),
      trustLevel: input.trustLevel ?? DEFAULT_TRUST,
      displayName: input.displayName ?? null,
      createdAt: this.now(),
      surfaces: [],
    };
    this.mem.set(record.learnerId, record);
    this.persist(record);
    return record;
  }

  get(learnerId: string): LearnerRecord | undefined {
    const cached = this.mem.get(learnerId);
    if (cached) return cached;
    if (this.persistDir && existsSync(this.file(learnerId))) {
      try {
        const record = JSON.parse(readFileSync(this.file(learnerId), "utf8")) as LearnerRecord;
        this.mem.set(learnerId, record);
        return record;
      } catch {
        return undefined; // corrupt record
      }
    }
    return undefined;
  }

  /** Associate a surface with its owning learner (idempotent). */
  recordSurface(learnerId: string, surface: { surfaceId: string; goal: string }): void {
    const record = this.get(learnerId);
    if (!record) return;
    if (record.surfaces.some((s) => s.surfaceId === surface.surfaceId)) return;
    record.surfaces.push({
      surfaceId: surface.surfaceId,
      goal: surface.goal,
      createdAt: this.now(),
    });
    this.persist(record);
  }

  /**
   * The learner's cross-surface cognition profile (DPS-004): their mastery subgraph + durable-tier
   * memory, accumulated across surfaces. Used to seed a returning learner's NEW surface. Returns
   * undefined when the learner has no prior cognition (a freshly-minted learner seeds nothing).
   */
  readCognition(learnerId: string): LearnerCognitionSeed | undefined {
    const cached = this.cognition.get(learnerId);
    if (cached) return cached;
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
  mergeCognition(learnerId: string, incoming: LearnerCognitionSeed): void {
    const current = this.readCognition(learnerId) ?? EMPTY_COGNITION;
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
  }

  private persist(record: LearnerRecord): void {
    if (!this.persistDir) return;
    mkdirSync(this.dir(), { recursive: true });
    writeFileSync(this.file(record.learnerId), JSON.stringify(record), "utf8");
  }
}
