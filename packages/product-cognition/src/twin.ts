/**
 * Digital Twin — consent-scoped persistent cognitive artifact for a learner (P5.1, DPS-009,
 * ADR-0020). TwinRegistry manages the full lifecycle: create → branch/export → terminate. Each
 * transition emits a `twin.*` event via the optional `publish` callback for observability and
 * future replay reconstruction.
 *
 * The twin is learner-scoped, not session-scoped. It persists independently of any surface.
 * Snapshot semantics: the caller (composition root) builds the `TwinSnapshot` from the learner's
 * cross-surface cognition (DPS-004, LearnerCognitionSeed) and passes it to `create()`.
 */
import {
  CosError,
  CryptoIdGenerator,
  SystemClock,
  type Clock,
  type IdGenerator,
} from "@inevitable/shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TwinConsent {
  /** The learner who owns this twin and granted consent. */
  readonly learnerId: string;
  /** Wall-clock ms when consent was granted. */
  readonly grantedAt: number;
  /** Surface IDs allowed to query this twin. `["*"]` = all surfaces. */
  readonly allowedSurfaces: ReadonlyArray<string>;
  /** Agent CIDs allowed to read this twin's state. `["*"]` = all agents. */
  readonly allowedAgents: ReadonlyArray<string>;
  /** Optional expiry in ms. Absent = no expiry. */
  readonly expiresAt?: number;
}

/** Point-in-time projection of the learner's cognitive state (ADR-0020 D2). */
export interface TwinSnapshot {
  /** Wall-clock ms when this snapshot was captured. */
  readonly snapshotAt: number;
  /** Mastery level + confidence for each concept the learner has encountered. */
  readonly masteryMap: Readonly<Record<string, { level: number; confidence: number }>>;
  /** Digest of durable memory per layer (semantic / procedural / reflective). */
  readonly memoryDigest: ReadonlyArray<{ layer: string; content: string; weight: number }>;
  /** Learner intent history (P5.1: always []; cross-session goals arrive in P5.2+). */
  readonly goals: ReadonlyArray<string>;
}

export type TwinStatus = "active" | "exported" | "terminated";

export interface TwinState {
  readonly twinId: string;
  readonly learnerId: string;
  readonly displayName: string;
  readonly createdAt: number;
  readonly consent: TwinConsent;
  readonly snapshot: TwinSnapshot;
  /** Present when this twin was created via `branch()`. */
  readonly branchedFrom?: string;
  readonly status: TwinStatus;
  /** Recorded when `export()` is first called. */
  readonly exportedAt?: number;
  /** Recorded when `terminate()` is called. Data is never deleted (audit trail). */
  readonly terminatedAt?: number;
}

export interface CreateTwinParams {
  readonly learnerId: string;
  readonly displayName: string;
  readonly consent: TwinConsent;
  readonly snapshot: TwinSnapshot;
}

export interface TwinRegistryOptions {
  readonly clock?: Clock;
  readonly idGenerator?: IdGenerator;
  /**
   * Optional event emission callback (ADR-0020 D1). When provided, every lifecycle transition
   * fires `publish(eventType, payload)`. The composition root wraps this with `createEvent` +
   * `bus.publish` and manages the HLC — same pattern as `CognitiveAnalysisEngine` (ADR-0017 D1).
   */
  readonly publish?: (eventType: string, payload: Record<string, unknown>) => void;
}

// ---------------------------------------------------------------------------
// Internal mutable record (never escapes the registry)
// ---------------------------------------------------------------------------

interface MutableTwinRecord {
  twinId: string;
  learnerId: string;
  displayName: string;
  createdAt: number;
  consent: TwinConsent;
  snapshot: TwinSnapshot;
  branchedFrom?: string;
  status: TwinStatus;
  exportedAt?: number;
  terminatedAt?: number;
}

// ---------------------------------------------------------------------------
// TwinRegistry
// ---------------------------------------------------------------------------

export class TwinRegistry {
  private readonly records = new Map<string, MutableTwinRecord>();
  private readonly byLearner = new Map<string, string[]>();
  private readonly clock: Clock;
  private readonly idGenerator: IdGenerator;

  constructor(private readonly options: TwinRegistryOptions = {}) {
    this.clock = options.clock ?? new SystemClock();
    this.idGenerator = options.idGenerator ?? new CryptoIdGenerator();
  }

  /**
   * Mint a new digital twin from the caller-supplied cognitive snapshot. Emits `twin.created`.
   */
  create(params: CreateTwinParams): TwinState {
    const twinId = `twin-${this.idGenerator.hex(12)}`;
    const now = this.clock.nowMs();
    const record: MutableTwinRecord = {
      twinId,
      learnerId: params.learnerId,
      displayName: params.displayName,
      createdAt: now,
      consent: params.consent,
      snapshot: params.snapshot,
      status: "active",
    };
    this.records.set(twinId, record);
    const ids = this.byLearner.get(params.learnerId) ?? [];
    ids.push(twinId);
    this.byLearner.set(params.learnerId, ids);
    this.emit("twin.created", {
      twin_id: twinId,
      learner_id: params.learnerId,
      display_name: params.displayName,
      status: "active",
      created_at: now,
    });
    return this.freeze(record);
  }

  get(twinId: string): TwinState | undefined {
    const r = this.records.get(twinId);
    return r ? this.freeze(r) : undefined;
  }

  /** All twins owned by a learner, in creation order. */
  list(learnerId: string): readonly TwinState[] {
    return (this.byLearner.get(learnerId) ?? [])
      .map((id) => this.records.get(id))
      .filter((r): r is MutableTwinRecord => r !== undefined)
      .map((r) => this.freeze(r));
  }

  /**
   * Fork a twin into a new independent cognitive branch (ADR-0020 D3). The branch inherits the
   * parent's consent and captures the current snapshot as its starting state. The parent is
   * unchanged. Emits `twin.branched`.
   */
  branch(twinId: string, displayName: string): TwinState {
    const parent = this.records.get(twinId);
    if (!parent) {
      throw new CosError("E_TWIN_NOT_FOUND", `twin "${twinId}" not found`, {
        specRef: "spec/persistence/DPS-009-digital-twin.md",
        details: { twinId },
      });
    }
    if (parent.status === "terminated") {
      throw new CosError("E_TWIN_TERMINATED", `cannot branch terminated twin "${twinId}"`, {
        specRef: "spec/persistence/DPS-009-digital-twin.md",
        details: { twinId },
      });
    }
    const newId = `twin-${this.idGenerator.hex(12)}`;
    const now = this.clock.nowMs();
    const branched: MutableTwinRecord = {
      twinId: newId,
      learnerId: parent.learnerId,
      displayName,
      createdAt: now,
      consent: parent.consent,
      snapshot: { ...parent.snapshot, snapshotAt: now },
      branchedFrom: twinId,
      status: "active",
    };
    this.records.set(newId, branched);
    const ids = this.byLearner.get(parent.learnerId) ?? [];
    ids.push(newId);
    this.byLearner.set(parent.learnerId, ids);
    this.emit("twin.branched", {
      twin_id: newId,
      branched_from: twinId,
      learner_id: parent.learnerId,
      display_name: displayName,
      created_at: now,
    });
    return this.freeze(branched);
  }

  /**
   * Mark a twin as exported (a portable artifact was created). Idempotent — repeated calls
   * return the current state without re-emitting. Emits `twin.exported` on first call.
   */
  export(twinId: string): TwinState {
    const r = this.records.get(twinId);
    if (!r) {
      throw new CosError("E_TWIN_NOT_FOUND", `twin "${twinId}" not found`, {
        specRef: "spec/persistence/DPS-009-digital-twin.md",
        details: { twinId },
      });
    }
    if (r.status === "terminated") {
      throw new CosError("E_TWIN_TERMINATED", `cannot export terminated twin "${twinId}"`, {
        specRef: "spec/persistence/DPS-009-digital-twin.md",
        details: { twinId },
      });
    }
    if (r.status === "exported") return this.freeze(r); // idempotent
    const now = this.clock.nowMs();
    r.status = "exported";
    r.exportedAt = now;
    this.emit("twin.exported", { twin_id: twinId, exported_at: now });
    return this.freeze(r);
  }

  /**
   * Terminate a twin (consent revoked). Idempotent — repeated calls are no-ops. Data is never
   * deleted; the snapshot and consent are preserved for audit. Emits `twin.terminated` on first call.
   */
  terminate(twinId: string): TwinState {
    const r = this.records.get(twinId);
    if (!r) {
      throw new CosError("E_TWIN_NOT_FOUND", `twin "${twinId}" not found`, {
        specRef: "spec/persistence/DPS-009-digital-twin.md",
        details: { twinId },
      });
    }
    if (r.status === "terminated") return this.freeze(r); // idempotent
    const now = this.clock.nowMs();
    r.status = "terminated";
    r.terminatedAt = now;
    this.emit("twin.terminated", { twin_id: twinId, terminated_at: now });
    return this.freeze(r);
  }

  private emit(eventType: string, payload: Record<string, unknown>): void {
    this.options.publish?.(eventType, payload);
  }

  private freeze(r: MutableTwinRecord): TwinState {
    return { ...r };
  }
}
