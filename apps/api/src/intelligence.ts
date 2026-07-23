/**
 * Gateway seam for the Intelligence Plane (ADR-0035, CIP-002 §4 D1/W1).
 *
 * On session close the host folds the surface's full chronicle through the distiller registry and
 * lands the artifacts: always into an in-memory plane (inspection/tests), and into the durable
 * Postgres plane (`intelligence_artifacts`, migration 0003) when `COS_BACKEND=supabase` +
 * `SUPABASE_DB_URL` are configured. Lifecycle events emit AFTER storage (state-then-emit).
 * Best-effort throughout: a distillation failure never fails a close that succeeded.
 *
 * The sink also mirrors the per-surface chronicle into `transport_events` when configured — the
 * first slice of the W1 gateway cutover (a durable Postgres copy of the chronicle; file logs stay
 * authoritative for rehydration until the full cutover increment).
 */
import type { CognitiveEvent } from "@inevitable/protocols";
import type { EventBus } from "@inevitable/events";
import {
  PostgresEventTransport,
  PostgresIntelligenceStore,
  type IntelligenceArtifactRow,
} from "@inevitable/adapters";
import {
  distillSession,
  emitDistilled,
  type DistillContext,
  type IntelligenceArtifact,
} from "@inevitable/intelligence";

export interface DistillOutcome {
  readonly stored: number;
  readonly skipped: number;
  readonly durable: boolean;
}

export class IntelligenceSink {
  /** In-memory plane — always populated; the inspection/testing surface. */
  private readonly plane: IntelligenceArtifact[] = [];
  private readonly dbUrl: string | undefined;
  private store: PostgresIntelligenceStore | null = null;
  private mirrorTransport: PostgresEventTransport | null = null;
  private connecting: Promise<void> | null = null;

  constructor(deps: { dbUrl?: string } = {}) {
    this.dbUrl = deps.dbUrl;
  }

  private async ensureConnected(): Promise<void> {
    if (!this.dbUrl || this.store) return;
    this.connecting ??= (async () => {
      const store = await PostgresIntelligenceStore.connect({ connectionString: this.dbUrl! });
      if (store.ok) this.store = store.value;
      const transport = await PostgresEventTransport.connect({ connectionString: this.dbUrl! });
      if (transport.ok) this.mirrorTransport = transport.value;
    })();
    await this.connecting;
  }

  /** W1 slice: fire-and-forget chronicle mirror into Postgres `transport_events`. */
  mirror(event: CognitiveEvent): void {
    if (!this.dbUrl) return;
    void this.ensureConnected()
      .then(() => this.mirrorTransport?.publish(event.event_type, event))
      .catch(() => undefined /* mirror is best-effort; the file log stays authoritative */);
  }

  /** Fold a closed session's chronicle into the plane; store first, then emit lifecycle. */
  async distillAndStore(
    events: readonly CognitiveEvent[],
    ctx: DistillContext,
    bus: EventBus,
  ): Promise<DistillOutcome> {
    try {
      const result = distillSession({ events, ctx });
      this.plane.push(...result.artifacts);
      let durable = false;
      if (this.dbUrl) {
        await this.ensureConnected();
        if (this.store) {
          for (const artifact of result.artifacts) {
            await this.store.upsert(artifact as unknown as IntelligenceArtifactRow);
          }
          durable = true;
        }
      }
      await emitDistilled(bus, result.artifacts, { nodeId: "gateway-intelligence" });
      return { stored: result.artifacts.length, skipped: result.skipped.length, durable };
    } catch {
      // Best-effort by design: the close outcome stands even if distillation hiccups.
      return { stored: 0, skipped: 0, durable: false };
    }
  }

  /** Inspection surface (tests, future Observatory panel). */
  artifactsFor(learnerCid: string): IntelligenceArtifact[] {
    return this.plane.filter((a) => a.scope.learner_cid === learnerCid);
  }

  /**
   * All of a learner's artifacts, durable plane included (CSE M6 — the resume-card and
   * Understanding-Map read path, ADR-0037). Merges the in-memory plane with Postgres when
   * configured (a restarted gateway still remembers), deduped by artifact_id, ordered by
   * distilled_hlc ascending. Best-effort on the durable read — the in-memory plane always serves.
   */
  async learnerArtifacts(
    learnerCid: string,
    tenantId = "default",
  ): Promise<IntelligenceArtifact[]> {
    const byId = new Map<string, IntelligenceArtifact>();
    if (this.dbUrl) {
      try {
        await this.ensureConnected();
        const rows = (await this.store?.listByLearner(tenantId, learnerCid)) ?? [];
        for (const row of rows) byId.set(String(row.artifact_id), row as IntelligenceArtifact);
      } catch {
        /* durable read is best-effort; the in-memory plane still serves */
      }
    }
    for (const artifact of this.plane) {
      if (artifact.scope.learner_cid === learnerCid) byId.set(artifact.artifact_id, artifact);
    }
    return [...byId.values()].sort((a, b) => a.distilled_hlc.localeCompare(b.distilled_hlc));
  }

  /** The learner's LATEST artifact of a kind, or null. */
  async latestFor(learnerCid: string, kind: string): Promise<IntelligenceArtifact | null> {
    const artifacts = await this.learnerArtifacts(learnerCid);
    for (let i = artifacts.length - 1; i >= 0; i--) {
      if (artifacts[i]!.kind === kind) return artifacts[i]!;
    }
    return null;
  }

  async close(): Promise<void> {
    await this.store?.close();
    await this.mirrorTransport?.close();
  }
}
