/**
 * SourceCanonicalizationService — the progressive-canonicalization orchestrator (CSE M3).
 *
 * Drives deeper layer construction for a Canonical Source Environment through governed dispatch,
 * then closes the loop the specs demand:
 *  1. read L1 structural regions from the store (fail honest if the version isn't usable);
 *  2. dispatch a cognition packet to the PRIVILEGED `canonicalizer` agent (GOV-P01 trust ≥ 3;
 *     scheduler admission, D3 recording, OTel span all apply via the normal dispatch path);
 *  3. land the layer via `recordLayerArtifact` — fallback confidence sits below the degradation
 *     floor, so deterministic layers are recorded as honest `source.layer.degraded`;
 *  4. bind extracted concepts into the world-state KnowledgeGraph (shared Layer-3 activation);
 *  5. create Source Anchors for every concept's evidence (structural + text-quote redundant
 *     selectors), so L2 knowledge is anchor-addressable from birth (CSE-002 §5).
 *
 * Region input is budgeted (char cap) and the truncation is reported, never silent.
 * Spec: spec/source-environment/CSE-002 §4/§6, cse-implementation-blueprint M3.
 */
import type { CognitionPacket } from "@inevitable/protocols";
import { CosError, err, ok, type IdGenerator, type Result } from "@inevitable/shared";
import { CryptoIdGenerator, newPacketId } from "@inevitable/shared";
import type { ConceptLayer, KnowledgeGraphEngine, WorldStateGraph } from "@inevitable/world-state";
import type {
  CanonicalSourceEnvironment,
  CitationLayerContent,
  MeaningLayerContent,
  SemanticLayerContent,
  SourceEnvironmentStore,
  SourceVersionId,
  StructuralLayerContent,
} from "@inevitable/source-environment";
import type { CanonicalizableLayer, RegionInput } from "./source-canonicalizer-unit";
import type { ConceptInput } from "./meaning-representation-unit";

const SPEC_REF = "source-environment/CSE-002-canonical-source-representation";
/** Region-text budget per dispatch; overflow is dropped and REPORTED (`regions_truncated`). */
const REGION_CHAR_BUDGET = 14_000;
/** Evidence anchors created per concept (first N evidence paths). */
const ANCHORS_PER_CONCEPT = 2;
/** Text-quote selector length — long enough to be distinctive, short enough to stay stable. */
const QUOTE_LENGTH = 80;

/** Structural dispatch seam — satisfied by ProductRuntimeDispatcher-backed closures (wiring).
 * The `meaning` layer (M6, ADR-0037) routes to the `meaning` agent; wiring switches by layer. */
export type CanonicalizerDispatch = (
  input: Readonly<{
    layer: CanonicalizableLayer | "meaning";
    versionId: string;
    regions: readonly RegionInput[];
    intentLeaseId: string | null;
    /** L2 concept vocabulary threaded to the meaning unit (grounding input; ADR-0037). */
    concepts?: readonly ConceptInput[];
  }>,
) => Promise<Result<CognitionPacket, CosError>>;

export interface SourceCanonicalizationServiceDeps {
  readonly store: SourceEnvironmentStore;
  readonly dispatch: CanonicalizerDispatch;
  /** When present, semantic concepts bind into the shared knowledge graph (world-state). */
  readonly kg?: KnowledgeGraphEngine;
  /** When present, MRL units land as world-state nodes with `expresses` edges (CSE-003 §4.1). */
  readonly world?: WorldStateGraph;
  readonly idGenerator?: IdGenerator;
  /** The intent lease this canonicalization run executes under (threaded into packets/traces). */
  readonly intentLeaseId?: string;
  readonly producedByCid?: string;
}

export interface SemanticCanonicalizationResult {
  readonly environment: CanonicalSourceEnvironment;
  readonly degraded: boolean;
  readonly fallbackReason: string | null;
  readonly conceptsExtracted: number;
  readonly conceptsBoundToKg: number;
  readonly anchorsCreated: number;
  /** Evidence anchors refused (ambiguous quote / unresolvable) — reported, never silent. */
  readonly anchorsSkipped: number;
  readonly regionsTruncated: boolean;
}

export interface CitationCanonicalizationResult {
  readonly environment: CanonicalSourceEnvironment;
  readonly degraded: boolean;
  readonly fallbackReason: string | null;
  readonly referencesExtracted: number;
  readonly regionsTruncated: boolean;
}

export interface MeaningConstructionResult {
  readonly environment: CanonicalSourceEnvironment;
  readonly degraded: boolean;
  readonly fallbackReason: string | null;
  readonly unitsProduced: number;
  readonly unitsByKind: Readonly<Record<string, number>>;
  /** MRL world-state nodes created (`mrl:<version>:<unit>` + `expresses` edges). */
  readonly worldNodesCreated: number;
  readonly regionsTruncated: boolean;
}

function serviceError(code: string, message: string): CosError {
  return new CosError(code, message, { specRef: SPEC_REF });
}

export class SourceCanonicalizationService {
  private readonly store: SourceEnvironmentStore;
  private readonly dispatch: CanonicalizerDispatch;
  private readonly kg: KnowledgeGraphEngine | undefined;
  private readonly world: WorldStateGraph | undefined;
  private readonly idGenerator: IdGenerator;
  private readonly intentLeaseId: string | null;
  private readonly producedByCid: string;

  constructor(deps: SourceCanonicalizationServiceDeps) {
    this.store = deps.store;
    this.dispatch = deps.dispatch;
    this.kg = deps.kg;
    this.world = deps.world;
    this.idGenerator = deps.idGenerator ?? new CryptoIdGenerator();
    this.intentLeaseId = deps.intentLeaseId ?? null;
    this.producedByCid = deps.producedByCid ?? "agent.canonicalizer";
  }

  /**
   * L7 (MRL v1, CSE-003/ADR-0037): infer MeaningUnits over L1 regions + the L2 concept
   * vocabulary, land the `meaning` layer artifact (fallback confidence < floor ⇒ honest
   * degraded), and place each unit as a world-state node `mrl:<version>:<unit>` with
   * `expresses` edges to its concept nodes — one graph, richer vocabulary.
   */
  async constructMeaning(
    versionId: SourceVersionId,
  ): Promise<Result<MeaningConstructionResult, CosError>> {
    const prepared = this.prepareRegions(versionId);
    if (!prepared.ok) return prepared;
    const { regions, truncated } = prepared.value;

    // The concept vocabulary: the L2 semantic layer when constructed (grounding input).
    const semantic = this.store.layer(versionId, "semantic");
    const concepts: ConceptInput[] = semantic
      ? (semantic.content as SemanticLayerContent).concepts.map((c) => ({
          concept_id: c.concept_id,
          label: c.label,
          definition: c.definition,
        }))
      : [];

    const dispatched = await this.dispatch({
      layer: "meaning",
      versionId,
      regions,
      intentLeaseId: this.intentLeaseId,
      concepts,
    });
    if (!dispatched.ok) return dispatched;
    const content = (dispatched.value.content ?? {}) as Record<string, unknown>;
    const rawLayer = content["layer_content"] as MeaningLayerContent | undefined;
    if (!rawLayer || !Array.isArray(rawLayer.units)) {
      return err(
        serviceError("E_SOURCE_LAYER_MALFORMED", "meaning response carried no layer_content"),
      );
    }
    const confidence = typeof content["confidence"] === "number" ? content["confidence"] : 0.45;
    const fallbackReason =
      typeof content["fallback_reason"] === "string" ? content["fallback_reason"] : null;

    // Grounded concept binding (the L7→L8 hinge, CSE-003 §3): a unit anchored to region P
    // expresses whatever concept cites P in the SEMANTIC layer's evidence_paths — shared-evidence
    // inference, never invention. Backfills the model's `concept_refs` for units grounded only on
    // anchors (two independent model calls mint slightly different ids), so the MRL actually binds
    // to the knowledge graph. No-op when the semantic layer is absent.
    const anchorToConcepts = new Map<string, string[]>();
    if (semantic) {
      for (const c of (semantic.content as SemanticLayerContent).concepts) {
        for (const path of c.evidence_paths) {
          const list = anchorToConcepts.get(path) ?? [];
          list.push(c.concept_id);
          anchorToConcepts.set(path, list);
        }
      }
    }
    const layerContent: MeaningLayerContent = {
      units: rawLayer.units.map((u) => {
        if (u.concept_refs.length > 0 || u.source_anchors.length === 0) return u;
        const derived = [
          ...new Set(u.source_anchors.flatMap((p: string) => anchorToConcepts.get(p) ?? [])),
        ];
        return derived.length > 0 ? { ...u, concept_refs: derived } : u;
      }),
    };

    const recorded = await this.store.recordLayerArtifact(versionId, "meaning", layerContent, {
      confidence,
      producedBy: content["handled_by"] === "meaning" ? "agent.meaning" : this.producedByCid,
    });
    if (!recorded.ok) return recorded;

    // MRL units as world-state nodes (CSE-003 §4.1): queryable beside the knowledge graph.
    let worldNodesCreated = 0;
    if (this.world) {
      for (const unit of layerContent.units) {
        const nodeId = `mrl:${versionId}:${unit.unit_id}`;
        const node = this.world.apply({
          kind: "upsert_node",
          id: nodeId,
          type: "meaning_unit",
          props: {
            kind: unit.kind,
            source_version_id: versionId,
            confidence: unit.confidence,
            payload: unit.payload,
            source_anchors: [...unit.source_anchors],
            produced_by: unit.produced_by,
          },
        });
        if (!node.ok) continue;
        worldNodesCreated++;
        for (const conceptRef of unit.concept_refs) {
          this.world.apply({
            kind: "upsert_edge",
            id: `edge:${nodeId}:expresses:concept:${conceptRef}`,
            from: nodeId,
            to: `concept:${conceptRef}`,
            type: "expresses",
            props: {},
          });
        }
      }
    }

    const unitsByKind: Record<string, number> = {};
    for (const unit of layerContent.units) {
      unitsByKind[unit.kind] = (unitsByKind[unit.kind] ?? 0) + 1;
    }

    const environment = this.store.environment(versionId);
    if (!environment) return err(serviceError("E_SOURCE_VERSION_UNKNOWN", "environment vanished"));
    return ok({
      environment,
      degraded: recorded.value.degraded,
      fallbackReason,
      unitsProduced: layerContent.units.length,
      unitsByKind,
      worldNodesCreated,
      regionsTruncated: truncated,
    });
  }

  /** L2: extract concepts, land the layer, bind the KG, anchor the evidence. */
  async canonicalizeSemantic(
    versionId: SourceVersionId,
  ): Promise<Result<SemanticCanonicalizationResult, CosError>> {
    const prepared = this.prepareRegions(versionId);
    if (!prepared.ok) return prepared;
    const { regions, truncated } = prepared.value;

    const dispatched = await this.dispatch({
      layer: "semantic",
      versionId,
      regions,
      intentLeaseId: this.intentLeaseId,
    });
    if (!dispatched.ok) return dispatched;
    const content = (dispatched.value.content ?? {}) as Record<string, unknown>;
    const layerContent = content["layer_content"] as SemanticLayerContent | undefined;
    if (!layerContent || !Array.isArray(layerContent.concepts)) {
      return err(
        serviceError("E_SOURCE_LAYER_MALFORMED", "canonicalizer response carried no layer_content"),
      );
    }
    const confidence = typeof content["confidence"] === "number" ? content["confidence"] : 0.45;
    const fallbackReason =
      typeof content["fallback_reason"] === "string" ? content["fallback_reason"] : null;

    const recorded = await this.store.recordLayerArtifact(versionId, "semantic", layerContent, {
      confidence,
      producedBy: this.producedByCid,
    });
    if (!recorded.ok) return recorded;

    // Bind concepts into the shared knowledge graph (Layer-3 activation, ADR-0023/ADR-0032).
    // ConceptSpec requires domain + layer: default domain "source" and layer 2 (conceptual) when
    // the extraction didn't infer them — same defaults the curriculum wiring uses (S2.4).
    let bound = 0;
    if (this.kg) {
      this.kg.seedConcepts(
        layerContent.concepts.map((c) => ({
          id: c.concept_id,
          label: c.label,
          prerequisites: [...c.prerequisites],
          domain: c.domain ?? "source",
          layer: Math.min(6, Math.max(0, c.layer ?? 2)) as ConceptLayer,
        })),
      );
      bound = layerContent.concepts.length;
    }

    // Anchor the evidence: every concept becomes anchor-addressable (CSE-002 §5). Ambiguous or
    // unresolvable evidence is skipped and counted — never guessed.
    const structural = this.structuralOf(versionId);
    let anchorsCreated = 0;
    let anchorsSkipped = 0;
    if (structural) {
      const regionByPath = new Map(structural.regions.map((r) => [r.path, r]));
      for (const concept of layerContent.concepts) {
        for (const path of concept.evidence_paths.slice(0, ANCHORS_PER_CONCEPT)) {
          const region = regionByPath.get(path);
          if (!region) {
            anchorsSkipped++;
            continue;
          }
          const created = this.store.createAnchorAt({
            version_id: versionId,
            selectors: [
              { type: "structural", path },
              { type: "text-quote", exact: region.text.slice(0, QUOTE_LENGTH) },
            ],
            granularity: region.kind === "heading" ? "section" : "paragraph",
            concept_refs: [concept.concept_id],
            created_by: this.producedByCid,
          });
          if (created.ok) anchorsCreated++;
          else anchorsSkipped++;
        }
      }
    }

    const environment = this.store.environment(versionId);
    if (!environment) return err(serviceError("E_SOURCE_VERSION_UNKNOWN", "environment vanished"));
    return ok({
      environment,
      degraded: recorded.value.degraded,
      fallbackReason,
      conceptsExtracted: layerContent.concepts.length,
      conceptsBoundToKg: bound,
      anchorsCreated,
      anchorsSkipped,
      regionsTruncated: truncated,
    });
  }

  /** L6: extract references + citation sites and land the citation layer. */
  async canonicalizeCitations(
    versionId: SourceVersionId,
  ): Promise<Result<CitationCanonicalizationResult, CosError>> {
    const prepared = this.prepareRegions(versionId);
    if (!prepared.ok) return prepared;
    const { regions, truncated } = prepared.value;

    const dispatched = await this.dispatch({
      layer: "citation",
      versionId,
      regions,
      intentLeaseId: this.intentLeaseId,
    });
    if (!dispatched.ok) return dispatched;
    const content = (dispatched.value.content ?? {}) as Record<string, unknown>;
    const layerContent = content["layer_content"] as CitationLayerContent | undefined;
    if (!layerContent || !Array.isArray(layerContent.references)) {
      return err(
        serviceError("E_SOURCE_LAYER_MALFORMED", "canonicalizer response carried no layer_content"),
      );
    }
    const confidence = typeof content["confidence"] === "number" ? content["confidence"] : 0.45;
    const fallbackReason =
      typeof content["fallback_reason"] === "string" ? content["fallback_reason"] : null;

    const recorded = await this.store.recordLayerArtifact(versionId, "citation", layerContent, {
      confidence,
      producedBy: this.producedByCid,
    });
    if (!recorded.ok) return recorded;

    const environment = this.store.environment(versionId);
    if (!environment) return err(serviceError("E_SOURCE_VERSION_UNKNOWN", "environment vanished"));
    return ok({
      environment,
      degraded: recorded.value.degraded,
      fallbackReason,
      referencesExtracted: layerContent.references.length,
      regionsTruncated: truncated,
    });
  }

  /** Build a fresh request packet for the canonicalizer/meaning units (wiring-level dispatchers). */
  buildRequestPacket(
    base: Readonly<{
      schemaVersion: string;
      sourceCid: string;
      targetCid: string;
      hlc: string;
      timestamp: string;
    }>,
    layer: CanonicalizableLayer | "meaning",
    versionId: string,
    regions: readonly RegionInput[],
    concepts?: readonly ConceptInput[],
  ): CognitionPacket {
    return {
      packet_id: newPacketId(this.idGenerator),
      schema_version: base.schemaVersion,
      source_cid: base.sourceCid,
      target_cid: base.targetCid,
      tenant_id: null,
      session_id: null,
      causation_id: null,
      correlation_id: null,
      timestamp: base.timestamp,
      hlc: base.hlc,
      sequence_number: 0,
      packet_type: "request",
      intent: `canonicalize-${layer}`,
      concept_ids: [],
      domain_ids: [],
      content: {
        layer,
        version_id: versionId,
        regions: regions.map((r) => ({ path: r.path, kind: r.kind, text: r.text })),
        ...(concepts
          ? {
              concepts: concepts.map((c) => ({
                concept_id: c.concept_id,
                label: c.label,
                ...(c.definition ? { definition: c.definition } : {}),
              })),
            }
          : {}),
        intent_lease_id: this.intentLeaseId,
      },
      evidence: [],
      confidence: 1,
      uncertainty_estimate: 0,
      reasoning_depth: 0,
      classification: "internal",
      policy_tags: [],
      requires_human_review: false,
      priority: 4,
      expiry: null,
    } as unknown as CognitionPacket;
  }

  // ── Internals ─────────────────────────────────────────────────────────────────────────────

  private prepareRegions(
    versionId: SourceVersionId,
  ): Result<{ regions: RegionInput[]; truncated: boolean }, CosError> {
    const environment = this.store.environment(versionId);
    if (!environment) {
      return err(serviceError("E_SOURCE_VERSION_UNKNOWN", `unknown version '${versionId}'`));
    }
    if (!environment.usable) {
      return err(
        serviceError(
          "E_SOURCE_NOT_CANONICALIZED",
          "deeper layers require the structural layer + anchor index first (CSE-002 §4)",
        ),
      );
    }
    const structural = this.structuralOf(versionId);
    if (!structural) {
      return err(serviceError("E_SOURCE_NOT_CANONICALIZED", "structural layer content missing"));
    }
    const regions: RegionInput[] = [];
    let used = 0;
    let truncated = false;
    for (const region of structural.regions) {
      const cost = region.text.length + region.path.length + 16;
      if (used + cost > REGION_CHAR_BUDGET) {
        truncated = true;
        break;
      }
      used += cost;
      regions.push({ path: region.path, kind: region.kind, text: region.text });
    }
    if (regions.length === 0) {
      return err(serviceError("E_SOURCE_NOT_CANONICALIZED", "no structural regions available"));
    }
    return ok({ regions, truncated });
  }

  private structuralOf(versionId: SourceVersionId): StructuralLayerContent | undefined {
    const artifact = this.store.layer(versionId, "structural");
    return artifact ? (artifact.content as StructuralLayerContent) : undefined;
  }
}
