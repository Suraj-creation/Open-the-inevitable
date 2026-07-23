/**
 * ClaimGraphService — the Claim Graph orchestrator (CSE M9 T2; CSE-006 §3.1, ADR-0041).
 *
 * Turns governed claim cognition into durable, queryable structure, closing the loop the spec
 * demands (mirrors SourceCanonicalizationService for the semantic/meaning layers):
 *  1. `extractClaims`: dispatch the `claim` agent in `extract` mode over a source's regions (+ its
 *     concept vocabulary); namespace each claim by source version; place it as a world-state node
 *     `claim:<version>::<local>` (type `claim`) with `about` edges to its concept nodes; emit
 *     `source.claim.recorded`. Grounding + degradation are the unit's concern; this binds the graph.
 *  2. `detectContradictions`: gather already-extracted claims, dispatch `contrast` ONCE, write
 *     `contradicts` edges into the Claim Graph, and emit `source.contradiction.detected { nature }`.
 *     Honest by construction — contrast fabricates nothing, so absent genuine conflict this is a
 *     no-op (CSE-006 §2/§6).
 *
 * Orchestration is deterministic + replay-safe; the model call inside the dispatch is the only
 * non-determinism (D3-recordable, exactly as canonicalization). Event emission is a `ClaimEmit`
 * seam so the package needs no bus dependency — the SourceHub wires it to its `source.*` bus.
 *
 * Spec: spec/source-environment/CSE-006 §3.1, spec/architecture-decisions/ADR-0041.
 */
import type { CognitionPacket } from "@inevitable/protocols";
import { CosError, err, ok, type Result } from "@inevitable/shared";
import type { WorldStateGraph } from "@inevitable/world-state";
import type { Claim, Contradiction } from "@inevitable/source-environment";
import type { ClaimForContrast, ClaimMode } from "./claim-reasoning-unit";
import type { RegionInput } from "./source-canonicalizer-unit";
import type { ConceptInput } from "./meaning-representation-unit";

const SPEC_REF = "source-environment/CSE-006-living-knowledge";

/** Structural dispatch seam — satisfied by a ClaimReasoningUnit-backed closure (wiring/hub/tests). */
export type ClaimDispatch = (
  input: Readonly<{
    mode: ClaimMode;
    versionId?: string;
    regions?: readonly RegionInput[];
    concepts?: readonly ConceptInput[];
    claims?: readonly ClaimForContrast[];
  }>,
) => Promise<Result<CognitionPacket, CosError>>;

/** Emit a `source.*` event (source.claim.recorded / source.contradiction.detected). */
export type ClaimEmit = (eventType: string, payload: Record<string, unknown>) => Promise<void>;

export const SOURCE_CLAIM_RECORDED = "source.claim.recorded";
export const SOURCE_CONTRADICTION_DETECTED = "source.contradiction.detected";

export interface ClaimGraphServiceDeps {
  readonly dispatch: ClaimDispatch;
  /** When present, claims land as world-state `claim` nodes with `about`/`contradicts` edges. */
  readonly world?: WorldStateGraph;
  /** When present, `source.claim.recorded` / `source.contradiction.detected` are emitted. */
  readonly emit?: ClaimEmit;
}

export interface ClaimExtractionResult {
  readonly claims: readonly Claim[];
  readonly degraded: boolean;
  readonly fallbackReason: string | null;
  /** World-state `claim` nodes created (0 when no `world` was provided). */
  readonly nodesCreated: number;
}

export interface ContradictionDetectionResult {
  readonly contradictions: readonly Contradiction[];
  /** `contradicts` edges written into the Claim Graph (0 when no `world`). */
  readonly edgesCreated: number;
  readonly fallbackReason: string | null;
}

function serviceError(code: string, message: string): CosError {
  return new CosError(code, message, { specRef: SPEC_REF });
}

/** The world-state node id for a claim (claim_id is already source-namespaced). */
export function claimNodeId(claimId: string): string {
  return `claim:${claimId}`;
}

export class ClaimGraphService {
  private readonly dispatch: ClaimDispatch;
  private readonly world: WorldStateGraph | undefined;
  private readonly emit: ClaimEmit | undefined;

  constructor(deps: ClaimGraphServiceDeps) {
    this.dispatch = deps.dispatch;
    this.world = deps.world;
    this.emit = deps.emit;
  }

  /**
   * Extract the claims one source makes, bind them into the Claim Graph, and record them. Claim
   * ids are namespaced by source version (`<version>::clm-n`) so cross-source edges are unambiguous.
   */
  async extractClaims(
    input: Readonly<{
      versionId: string;
      regions: readonly RegionInput[];
      concepts?: readonly ConceptInput[];
    }>,
  ): Promise<Result<ClaimExtractionResult, CosError>> {
    const dispatched = await this.dispatch({
      mode: "extract",
      versionId: input.versionId,
      regions: input.regions,
      ...(input.concepts ? { concepts: input.concepts } : {}),
    });
    if (!dispatched.ok) return dispatched;

    const content = (dispatched.value.content ?? {}) as Record<string, unknown>;
    const rawClaims = content["claims"];
    if (!Array.isArray(rawClaims)) {
      return err(
        serviceError("E_SOURCE_LAYER_MALFORMED", "claim response carried no claims array"),
      );
    }
    const fallbackReason =
      typeof content["fallback_reason"] === "string" ? content["fallback_reason"] : null;

    // Namespace claim ids by source version so the Claim Graph's cross-source edges are unambiguous.
    const claims: Claim[] = (rawClaims as Claim[]).map((c) => ({
      ...c,
      claim_id: `${input.versionId}::${c.claim_id}`,
      source_version_id: input.versionId,
    }));

    let nodesCreated = 0;
    if (this.world) {
      for (const claim of claims) {
        const nodeId = claimNodeId(claim.claim_id);
        const node = this.world.apply({
          kind: "upsert_node",
          id: nodeId,
          type: "claim",
          props: {
            statement: claim.statement,
            source_version_id: claim.source_version_id,
            epistemic_status: claim.epistemic_status,
            anchors: [...claim.anchors],
            about_concepts: [...claim.about_concepts],
          },
        });
        if (!node.ok) continue;
        nodesCreated++;
        for (const conceptRef of claim.about_concepts) {
          // Ensure the concept endpoint exists (idempotent, prop-merging) before the `about` edge —
          // the gateway may not have seeded a semantic layer; a real concept node is never clobbered.
          this.world.apply({
            kind: "upsert_node",
            id: `concept:${conceptRef}`,
            type: "concept",
            props: {},
          });
          this.world.apply({
            kind: "upsert_edge",
            id: `edge:${nodeId}:about:concept:${conceptRef}`,
            from: nodeId,
            to: `concept:${conceptRef}`,
            type: "about",
            props: {},
          });
        }
      }
    }

    if (this.emit) {
      for (const claim of claims) {
        await this.emit(SOURCE_CLAIM_RECORDED, {
          claim_id: claim.claim_id,
          source_version_id: claim.source_version_id,
          statement: claim.statement,
          epistemic_status: claim.epistemic_status,
          about_concepts: [...claim.about_concepts],
          anchors: [...claim.anchors],
        });
      }
    }

    return ok({
      claims,
      degraded: fallbackReason !== null,
      fallbackReason,
      nodesCreated,
    });
  }

  /**
   * Detect genuine cross-source contradictions among already-extracted claims. Requires ≥2 sources;
   * the `contrast` unit returns [] absent genuine conflict (honest). Writes `contradicts` edges and
   * emits `source.contradiction.detected { nature }` per contradiction.
   */
  async detectContradictions(
    input: Readonly<{ claims: readonly Claim[] }>,
  ): Promise<Result<ContradictionDetectionResult, CosError>> {
    const forContrast: ClaimForContrast[] = input.claims.map((c) => ({
      claim_id: c.claim_id,
      statement: c.statement,
      source_version_id: c.source_version_id,
      about_concepts: c.about_concepts,
    }));

    const dispatched = await this.dispatch({ mode: "contrast", claims: forContrast });
    if (!dispatched.ok) return dispatched;

    const content = (dispatched.value.content ?? {}) as Record<string, unknown>;
    const rawContradictions = content["contradictions"];
    if (!Array.isArray(rawContradictions)) {
      return err(
        serviceError(
          "E_SOURCE_LAYER_MALFORMED",
          "contrast response carried no contradictions array",
        ),
      );
    }
    const fallbackReason =
      typeof content["fallback_reason"] === "string" ? content["fallback_reason"] : null;
    const contradictions = rawContradictions as Contradiction[];

    let edgesCreated = 0;
    if (this.world) {
      for (const c of contradictions) {
        const [a, b] = c.claim_ids;
        if (!a || !b) continue;
        const edge = this.world.apply({
          kind: "upsert_edge",
          id: `edge:${claimNodeId(a)}:contradicts:${claimNodeId(b)}`,
          from: claimNodeId(a),
          to: claimNodeId(b),
          type: "contradicts",
          props: { nature: c.nature, ...(c.rationale ? { rationale: c.rationale } : {}) },
        });
        if (edge.ok) edgesCreated++;
      }
    }

    if (this.emit) {
      for (const c of contradictions) {
        await this.emit(SOURCE_CONTRADICTION_DETECTED, {
          claim_ids: [...c.claim_ids],
          source_version_ids: [...c.source_version_ids],
          nature: c.nature,
        });
      }
    }

    return ok({ contradictions, edgesCreated, fallbackReason });
  }
}
