/**
 * SourceEnvironmentStore — the event-emitting runtime for Canonical Source Environments.
 *
 * Semantics (CSE-002):
 *  - state-then-emit: an event publishes only after the transition it describes succeeded;
 *  - registration is idempotent per (source, content_hash) — re-upload returns the existing
 *    version and emits nothing;
 *  - progressive availability: an environment is usable at structural layer + anchor index;
 *  - degradation is honest: a layer below the confidence floor lands as `source.layer.degraded`,
 *    visible, never silently dropped;
 *  - replay: the `source.*` log folds back to this store's projection (see projection.ts).
 */
import {
  CosError,
  CryptoIdGenerator,
  SystemClock,
  err,
  hlcInit,
  hlcTick,
  hlcToString,
  ok,
  type Clock,
  type Hlc,
  type IdGenerator,
  type Result,
} from "@inevitable/shared";
import { createEvent, type EventBus } from "@inevitable/events";
import {
  newAnchorId,
  newLayerArtifactId,
  newSourceId,
  newSourceVersionId,
  type AnchorId,
  type SourceId,
  type SourceVersionId,
} from "./ids";
import {
  CONSENT_REQUIRED_MODALITIES,
  contentHash,
  type SourceModality,
  type SourceProvenance,
  type SourceVersion,
} from "./identity";
import type {
  SemanticConcept,
  SemanticLayerContent,
  SourceLayer,
  SourceLayerArtifact,
  StructuralLayerContent,
  StructuralRegion,
} from "./layers";
import {
  createAnchor,
  migrateAnchor,
  resolveAnchor,
  type AnchorGranularity,
  type AnchorMigration,
  type AnchorSelector,
  type SourceAnchor,
} from "./anchors";
import { AnchorIndex } from "./anchor-index";
import type { ModalityAdapter, ParsedSource } from "./reference-adapters";
import { SOURCE_EVENT_TYPES } from "./events";

export interface CanonicalSourceEnvironment {
  readonly source_id: SourceId;
  readonly version_id: SourceVersionId;
  readonly modality: SourceModality;
  readonly layers_available: readonly SourceLayer[];
  readonly degraded_layers: readonly SourceLayer[];
  /** Usability threshold: structural layer + anchor index exist (CSE-002 §4 rule 1). */
  readonly usable: boolean;
  readonly anchor_count: number;
}

export interface RegisterVersionInput {
  readonly source_id?: SourceId;
  /** Explicit version id — rehydration replays a persisted registration under its original id so
   * every durable reference (attach events, commons, consent envelopes, anchors) stays resolvable
   * across restarts (ADR-0055 D2). Fresh registrations omit it (generator-minted). */
  readonly version_id?: SourceVersionId;
  readonly modality: SourceModality;
  /** Canonical content: text for text modalities, bytes for binary ones (PDF). The canonical
   * record only ever carries the hash + content_ref; bytes stay out-of-band (CSE-002 §2). */
  readonly content: string | Uint8Array;
  /** Out-of-band content reference. Defaults to a fixture ref derived from the hash. */
  readonly content_ref?: string;
  readonly provenance: SourceProvenance;
}

export interface CreateAnchorRequest {
  readonly version_id: SourceVersionId;
  readonly selectors: readonly AnchorSelector[];
  readonly granularity: AnchorGranularity;
  readonly concept_refs?: readonly string[];
  readonly created_by: string;
}

export interface SourceEnvironmentStoreDeps {
  readonly bus?: EventBus;
  readonly clock?: Clock;
  readonly idGenerator?: IdGenerator;
  readonly nodeId?: string;
  readonly producerCid?: string;
  /** Layers whose confidence falls below this floor land as degraded (default 0.5). */
  readonly confidenceFloor?: number;
}

export class SourceEnvironmentStore {
  private readonly bus: EventBus | undefined;
  private readonly clock: Clock;
  private readonly idGenerator: IdGenerator;
  private readonly producerCid: string;
  private readonly confidenceFloor: number;
  private hlc: Hlc;

  private readonly versions = new Map<SourceVersionId, SourceVersion>();
  private readonly versionsBySource = new Map<SourceId, SourceVersionId[]>();
  private readonly versionByHash = new Map<string, SourceVersionId>();
  private readonly layers = new Map<SourceVersionId, Map<SourceLayer, SourceLayerArtifact>>();
  private readonly anchorIndexes = new Map<SourceVersionId, AnchorIndex>();
  private readonly adapters = new Map<SourceModality, ModalityAdapter>();
  /** Canonical content retained for reference-adapter parsing (fixtures; bytes stay out-of-band in prod). */
  private readonly contentByVersion = new Map<SourceVersionId, string | Uint8Array>();
  private readonly migrationLog: Array<{
    anchor_id: string;
    from_version: string;
    to_version: string;
    status: string;
  }> = [];

  constructor(deps: SourceEnvironmentStoreDeps = {}) {
    this.bus = deps.bus;
    this.clock = deps.clock ?? new SystemClock();
    this.idGenerator = deps.idGenerator ?? new CryptoIdGenerator();
    this.producerCid = deps.producerCid ?? "cog-source-environment";
    this.confidenceFloor = deps.confidenceFloor ?? 0.5;
    this.hlc = hlcInit(deps.nodeId ?? "source-environment");
  }

  registerAdapter(adapter: ModalityAdapter): void {
    this.adapters.set(adapter.modality, adapter);
  }

  /**
   * Register an immutable content-addressed snapshot. Idempotent per (source, content_hash):
   * re-registering identical content returns the existing version and emits nothing.
   */
  async registerVersion(input: RegisterVersionInput): Promise<Result<SourceVersion, CosError>> {
    if (CONSENT_REQUIRED_MODALITIES.includes(input.modality) && !input.provenance.consent_ref) {
      return err(
        new CosError(
          "E_SOURCE_CONSENT_REQUIRED",
          `Modality '${input.modality}' requires an explicit consent envelope (CSE-002 §8)`,
          { specRef: "source-environment/CSE-002-canonical-source-representation#8" },
        ),
      );
    }
    const hash = contentHash(input.content);
    const sourceId = input.source_id ?? newSourceId(this.idGenerator);
    const dedupeKey = `${sourceId}:${hash}`;
    const existingId = this.versionByHash.get(dedupeKey);
    if (existingId) {
      const existing = this.versions.get(existingId);
      if (existing) return ok(existing);
    }
    const chain = this.versionsBySource.get(sourceId) ?? [];
    const supersedes = chain.length > 0 ? (chain[chain.length - 1] ?? null) : null;
    this.hlc = hlcTick(this.hlc, this.clock);
    const version: SourceVersion = {
      source_id: sourceId,
      version_id: input.version_id ?? newSourceVersionId(this.idGenerator),
      modality: input.modality,
      content_ref: input.content_ref ?? `fixture://${hash.slice(0, 16)}`,
      content_hash: hash,
      provenance: input.provenance,
      supersedes,
      registered_hlc: hlcToString(this.hlc),
    };
    // State first…
    this.versions.set(version.version_id, version);
    this.versionsBySource.set(sourceId, [...chain, version.version_id]);
    this.versionByHash.set(dedupeKey, version.version_id);
    this.contentByVersion.set(version.version_id, input.content);
    // …then the event (CSE-002 §9; state-then-emit).
    await this.emit(SOURCE_EVENT_TYPES.versionRegistered, {
      source_id: version.source_id,
      version_id: version.version_id,
      modality: version.modality,
      content_hash: version.content_hash,
      content_ref: version.content_ref,
      supersedes: version.supersedes,
    });
    return ok(version);
  }

  /**
   * Progressive canonicalization, M1 tier: construct the structural (L1) layer via the modality's
   * registered adapter and stand up the anchor index — the usability threshold. Deeper layers are
   * later milestones; the environment upgrades live as they land.
   */
  async canonicalize(
    versionId: SourceVersionId,
  ): Promise<Result<CanonicalSourceEnvironment, CosError>> {
    const version = this.versions.get(versionId);
    if (!version) {
      return err(
        new CosError("E_SOURCE_VERSION_UNKNOWN", `Unknown source version '${versionId}'`, {
          specRef: "source-environment/CSE-002-canonical-source-representation#3",
        }),
      );
    }
    // Idempotent canonicalization (Phase E, ADR-0063): content is immutable per version, so a version
    // whose structural layer is already built needs no re-parse. Re-registering identical content
    // dedupes to the SAME version (CSE-002 idempotency), so without this short-circuit canonicalize
    // would redo the full (potentially heavy, e.g. PDF) parse to produce a byte-identical result — and
    // re-emit a duplicate layer.constructed. The first canonicalization (no structural layer) is
    // unchanged; deeper layers (L2 semantic, …) are added by recordLayerArtifact, not here.
    const alreadyBuilt = this.layers.get(versionId);
    if (alreadyBuilt?.has("structural")) {
      return ok(this.environmentOf(version));
    }
    const adapter = this.adapters.get(version.modality);
    if (!adapter) {
      return err(
        new CosError(
          "E_SOURCE_MODALITY_UNSUPPORTED",
          `No modality adapter registered for '${version.modality}'`,
          {
            specRef: "source-environment/CSE-002-canonical-source-representation#7",
            details: { modality: version.modality },
          },
        ),
      );
    }
    const content = this.contentByVersion.get(versionId) ?? "";
    // Binary modalities (PDF) go through parseBinary (ADR-0036); text through parse. A mismatch
    // is an honest refusal, never a coercion.
    let parsed: Result<ParsedSource, CosError>;
    if (typeof content !== "string") {
      if (!adapter.parseBinary) {
        return err(
          new CosError(
            "E_SOURCE_MODALITY_UNSUPPORTED",
            `Adapter '${adapter.adapter_id}' cannot parse binary content`,
            { specRef: "source-environment/CSE-002-canonical-source-representation#7" },
          ),
        );
      }
      parsed = await adapter.parseBinary(content);
    } else {
      if (!adapter.parse) {
        return err(
          new CosError(
            "E_SOURCE_MODALITY_UNSUPPORTED",
            `Adapter '${adapter.adapter_id}' cannot parse text content`,
            { specRef: "source-environment/CSE-002-canonical-source-representation#7" },
          ),
        );
      }
      parsed = adapter.parse(content);
    }
    if (!parsed.ok) return parsed;

    const degraded = parsed.value.confidence < this.confidenceFloor;
    const artifact: SourceLayerArtifact = {
      artifact_id: newLayerArtifactId(this.idGenerator),
      source_version_id: versionId,
      layer: "structural",
      schema_version: "1.0.0",
      confidence: parsed.value.confidence,
      degraded,
      degraded_reason: degraded ? "extraction confidence below floor" : null,
      produced_by: adapter.adapter_id,
      content: parsed.value.structural,
    };
    // State first…
    const byLayer = this.layers.get(versionId) ?? new Map<SourceLayer, SourceLayerArtifact>();
    byLayer.set("structural", artifact);
    this.layers.set(versionId, byLayer);
    if (!this.anchorIndexes.has(versionId)) this.anchorIndexes.set(versionId, new AnchorIndex());
    // …then the event.
    const payload = {
      source_id: version.source_id,
      version_id: versionId,
      layer: artifact.layer,
      artifact_id: artifact.artifact_id,
      confidence: artifact.confidence,
      produced_by: artifact.produced_by,
    };
    if (degraded) {
      await this.emit(SOURCE_EVENT_TYPES.layerDegraded, {
        ...payload,
        reason: artifact.degraded_reason ?? "degraded",
      });
    } else {
      await this.emit(SOURCE_EVENT_TYPES.layerConstructed, payload);
    }
    // Paginated modalities also yield the visual (L3) layer in the same pass (ADR-0036):
    // page geometry the surface's viewports/overlays position against.
    if (parsed.value.visual) {
      const recorded = await this.recordLayerArtifact(versionId, "visual", parsed.value.visual, {
        confidence: parsed.value.confidence,
        producedBy: adapter.adapter_id,
      });
      if (!recorded.ok) return recorded;
    }
    // Time-based modalities (video) also yield the temporal (L4) layer in the same pass (ADR-0048):
    // per-region timecodes the concept scrubber + Temporal transformation navigate by.
    if (parsed.value.temporal) {
      const recorded = await this.recordLayerArtifact(
        versionId,
        "temporal",
        parsed.value.temporal,
        {
          confidence: parsed.value.confidence,
          producedBy: adapter.adapter_id,
        },
      );
      if (!recorded.ok) return recorded;
    }
    return ok(this.environmentOf(version));
  }

  /**
   * Land a deeper layer artifact (L2 semantic, L6 citation, …) produced by governed cognition
   * (M3+). Enforces the canonicalization DAG: deeper layers require the structural layer first
   * (CSE-002 §4). State-then-emit; below-floor confidence lands as `source.layer.degraded` —
   * visible, never silent. Immutable: landing the same layer again produces a successor artifact
   * (re-enrichment), replacing the projection's current artifact for that layer.
   */
  async recordLayerArtifact(
    versionId: SourceVersionId,
    layer: SourceLayer,
    content: unknown,
    opts: { confidence: number; producedBy: string; modelInvocationRefs?: readonly string[] },
  ): Promise<Result<SourceLayerArtifact, CosError>> {
    const version = this.versions.get(versionId);
    if (!version) {
      return err(
        new CosError("E_SOURCE_VERSION_UNKNOWN", `Unknown source version '${versionId}'`, {
          specRef: "source-environment/CSE-002-canonical-source-representation#3",
        }),
      );
    }
    if (layer !== "structural" && !this.layers.get(versionId)?.has("structural")) {
      return err(
        new CosError(
          "E_SOURCE_NOT_CANONICALIZED",
          `Layer '${layer}' requires the structural layer first (canonicalization DAG, CSE-002 §4)`,
          { specRef: "source-environment/CSE-002-canonical-source-representation#4" },
        ),
      );
    }
    const degraded = opts.confidence < this.confidenceFloor;
    const artifact: SourceLayerArtifact = {
      artifact_id: newLayerArtifactId(this.idGenerator),
      source_version_id: versionId,
      layer,
      schema_version: "1.0.0",
      confidence: opts.confidence,
      degraded,
      degraded_reason: degraded ? "extraction confidence below floor" : null,
      produced_by: opts.producedBy,
      content,
    };
    const byLayer = this.layers.get(versionId) ?? new Map<SourceLayer, SourceLayerArtifact>();
    byLayer.set(layer, artifact);
    this.layers.set(versionId, byLayer);
    const payload = {
      source_id: version.source_id,
      version_id: versionId,
      layer,
      artifact_id: artifact.artifact_id,
      confidence: artifact.confidence,
      produced_by: artifact.produced_by,
      ...(opts.modelInvocationRefs?.length
        ? { model_invocation_refs: [...opts.modelInvocationRefs] }
        : {}),
    };
    if (degraded) {
      await this.emit(SOURCE_EVENT_TYPES.layerDegraded, {
        ...payload,
        reason: artifact.degraded_reason ?? "degraded",
      });
    } else {
      await this.emit(SOURCE_EVENT_TYPES.layerConstructed, payload);
    }
    return ok(artifact);
  }

  /**
   * Attention-driven prioritization signal (CSE-002 §4 rule 2): the scheduler/learner trajectory
   * asks for deeper canonicalization of a region. Evented (replayable) scheduling hint; the
   * cognitive scheduler consumes it when deep-canonicalization queueing lands.
   */
  async prioritize(
    versionId: SourceVersionId,
    regionPath: string | null,
    reason: string,
  ): Promise<Result<void, CosError>> {
    const version = this.versions.get(versionId);
    if (!version) {
      return err(
        new CosError("E_SOURCE_VERSION_UNKNOWN", `Unknown source version '${versionId}'`, {
          specRef: "source-environment/CSE-002-canonical-source-representation#3",
        }),
      );
    }
    await this.emit(SOURCE_EVENT_TYPES.canonicalizationPrioritized, {
      source_id: version.source_id,
      version_id: versionId,
      region_anchor: regionPath,
      reason,
    });
    return ok(undefined);
  }

  /**
   * Create an anchor into a canonicalized version. Enforces the ≥2-distinct-selector law and
   * refuses anchors that do not resolve — a reference that points nowhere is an error at creation
   * time, never a silent orphan.
   */
  createAnchorAt(request: CreateAnchorRequest): Result<SourceAnchor, CosError> {
    const structural = this.structuralOf(request.version_id);
    if (!structural) {
      return err(
        new CosError(
          "E_SOURCE_NOT_CANONICALIZED",
          "Cannot anchor into a version with no structural layer",
          { specRef: "source-environment/CSE-002-canonical-source-representation#4" },
        ),
      );
    }
    const created = createAnchor({
      anchor_id: newAnchorId(this.idGenerator),
      source_version_id: request.version_id,
      selectors: request.selectors,
      granularity: request.granularity,
      concept_refs: request.concept_refs ?? [],
      created_by: request.created_by,
    });
    if (!created.ok) return created;
    const resolution = resolveAnchor(created.value, structural);
    if (resolution.status === "miss") {
      return err(
        new CosError("E_SOURCE_ANCHOR_MISS", `Anchor does not resolve: ${resolution.reason}`, {
          specRef: "source-environment/CSE-002-canonical-source-representation#5",
        }),
      );
    }
    const index = this.anchorIndexes.get(request.version_id);
    index?.add(created.value, resolution);
    return ok(created.value);
  }

  /**
   * Migrate every anchor of `fromVersionId` against `toVersionId`'s structural layer.
   * resolved/moved anchors join the new version's index; orphaned anchors are retained on the old
   * version (preserved-quote rendering). Every migration is evented (CSE-002 §5.4).
   */
  async migrateAnchors(
    fromVersionId: SourceVersionId,
    toVersionId: SourceVersionId,
  ): Promise<Result<readonly AnchorMigration[], CosError>> {
    const fromIndex = this.anchorIndexes.get(fromVersionId);
    const toStructural = this.structuralOf(toVersionId);
    if (!fromIndex || !toStructural) {
      return err(
        new CosError(
          "E_SOURCE_NOT_CANONICALIZED",
          "Both versions must be canonicalized before anchor migration",
          { specRef: "source-environment/CSE-002-canonical-source-representation#5" },
        ),
      );
    }
    const toIndex = this.anchorIndexes.get(toVersionId) ?? new AnchorIndex();
    this.anchorIndexes.set(toVersionId, toIndex);
    const migrations: AnchorMigration[] = [];
    for (const anchor of fromIndex.list()) {
      const migration = migrateAnchor(anchor, toVersionId, toStructural);
      migrations.push(migration);
      if (migration.migrated) {
        toIndex.add(migration.migrated, resolveAnchor(migration.migrated, toStructural));
      }
      await this.emit(SOURCE_EVENT_TYPES.anchorMigrated, {
        anchor_id: migration.anchor_id,
        from_version: migration.from_version,
        to_version: migration.to_version,
        status: migration.status,
      });
    }
    return ok(migrations);
  }

  // ── Queries ─────────────────────────────────────────────────────────────────────────────────

  version(versionId: SourceVersionId): SourceVersion | undefined {
    return this.versions.get(versionId);
  }

  latestVersion(sourceId: SourceId): SourceVersion | undefined {
    const chain = this.versionsBySource.get(sourceId);
    const last = chain?.[chain.length - 1];
    return last ? this.versions.get(last) : undefined;
  }

  versionChain(sourceId: SourceId): readonly SourceVersion[] {
    return (this.versionsBySource.get(sourceId) ?? [])
      .map((id) => this.versions.get(id))
      .filter((v): v is SourceVersion => v !== undefined);
  }

  layer(versionId: SourceVersionId, layer: SourceLayer): SourceLayerArtifact | undefined {
    return this.layers.get(versionId)?.get(layer);
  }

  anchorIndex(versionId: SourceVersionId): AnchorIndex | undefined {
    return this.anchorIndexes.get(versionId);
  }

  anchor(versionId: SourceVersionId, anchorId: AnchorId): SourceAnchor | undefined {
    return this.anchorIndexes.get(versionId)?.get(anchorId);
  }

  environment(versionId: SourceVersionId): CanonicalSourceEnvironment | undefined {
    const version = this.versions.get(versionId);
    return version ? this.environmentOf(version) : undefined;
  }

  /**
   * The structural (L1) regions of a version, in document order (R2c, ADR-0057 D3) — the atoms a
   * "teach this source" curriculum walks. Empty when the version isn't canonicalized.
   */
  structuralRegions(versionId: SourceVersionId): readonly StructuralRegion[] {
    return this.structuralOf(versionId)?.regions ?? [];
  }

  /**
   * The semantic (L2) concepts of a version, if the semantic layer was built (R2c, ADR-0057 D3) —
   * a ready-made prerequisite-ordered curriculum. Empty when only L1 exists (deterministic gateway).
   */
  semanticConcepts(versionId: SourceVersionId): readonly SemanticConcept[] {
    const artifact = this.layers.get(versionId)?.get("semantic");
    const content = artifact?.content as SemanticLayerContent | undefined;
    return content?.concepts ?? [];
  }

  /** Compact projection of store state — must equal `foldSourceEvents` over the bus log. */
  project(): SourceEnvironmentProjection {
    const versions = [...this.versions.values()].map((v) => ({
      source_id: v.source_id as string,
      version_id: v.version_id as string,
      modality: v.modality as string,
      content_hash: v.content_hash,
      supersedes: (v.supersedes as string | null) ?? null,
    }));
    const layers = [...this.layers.entries()].flatMap(([versionId, byLayer]) =>
      [...byLayer.values()].map((a) => ({
        version_id: versionId as string,
        layer: a.layer as string,
        artifact_id: a.artifact_id as string,
        degraded: a.degraded,
      })),
    );
    return { versions, layers, migrations: this.migrationLog.slice() };
  }

  // ── Internals ───────────────────────────────────────────────────────────────────────────────

  private environmentOf(version: SourceVersion): CanonicalSourceEnvironment {
    const byLayer = this.layers.get(version.version_id);
    const available = byLayer ? [...byLayer.keys()] : [];
    const degraded = byLayer
      ? [...byLayer.values()].filter((a) => a.degraded).map((a) => a.layer)
      : [];
    const index = this.anchorIndexes.get(version.version_id);
    return {
      source_id: version.source_id,
      version_id: version.version_id,
      modality: version.modality,
      layers_available: available,
      degraded_layers: degraded,
      usable: available.includes("structural") && index !== undefined,
      anchor_count: index?.size ?? 0,
    };
  }

  private structuralOf(versionId: SourceVersionId): StructuralLayerContent | undefined {
    const artifact = this.layers.get(versionId)?.get("structural");
    return artifact ? (artifact.content as StructuralLayerContent) : undefined;
  }

  private async emit(eventType: string, payload: Record<string, unknown>): Promise<void> {
    if (eventType === SOURCE_EVENT_TYPES.anchorMigrated) {
      this.migrationLog.push({
        anchor_id: String(payload["anchor_id"]),
        from_version: String(payload["from_version"]),
        to_version: String(payload["to_version"]),
        status: String(payload["status"]),
      });
    }
    if (!this.bus) return;
    const created = createEvent(
      {
        eventType,
        producerCid: this.producerCid,
        producerType: "product.source-environment",
        payload,
        topic: `cos.${eventType}`,
        classification: "internal",
      },
      { clock: this.clock, hlc: this.hlc, idGenerator: this.idGenerator },
    );
    this.hlc = created.hlc;
    await this.bus.publish(created.event);
  }
}

/** The replay-comparable projection shape shared with foldSourceEvents (projection.ts). */
export interface SourceEnvironmentProjection {
  readonly versions: ReadonlyArray<{
    source_id: string;
    version_id: string;
    modality: string;
    content_hash: string;
    supersedes: string | null;
  }>;
  readonly layers: ReadonlyArray<{
    version_id: string;
    layer: string;
    artifact_id: string;
    degraded: boolean;
  }>;
  readonly migrations: ReadonlyArray<{
    anchor_id: string;
    from_version: string;
    to_version: string;
    status: string;
  }>;
}
