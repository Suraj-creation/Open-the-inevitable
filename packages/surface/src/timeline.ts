/**
 * SurfaceTimelineBuilder — the Living Timeline generation engine.
 *
 * "Teach me Neural Networks" → a prerequisite-ordered, milestone-bearing, mastery-gated
 * understanding path. The timeline is a PROJECTION of world-state, never a stored artifact:
 * concept nodes, prerequisite edges, mastery checkpoints, and phase-tracking props already
 * live in the graph; this engine derives the visible path from them. Mutation = re-projection.
 *
 * Composes the existing LearningPathProjector (Kahn-validated DAG into world-state); no new
 * graph semantics are introduced.
 *
 * Spec: spec/surface/surface-timeline-engine.md.
 */
import { createEvent, type EventBus } from "@inevitable/events";
import { LearningPathProjector, type ConceptSeed } from "@inevitable/product-cognition";
import {
  CosError,
  CryptoIdGenerator,
  SystemClock,
  err,
  hlcInit,
  ok,
  type Clock,
  type Hlc,
  type IdGenerator,
  type Result,
} from "@inevitable/shared";
import type { WorldStateGraph } from "@inevitable/world-state";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TimelineNodeStatus = "locked" | "available" | "in_progress" | "mastered";

export interface SurfaceTimelineNode {
  readonly concept_id: string;
  readonly node_id: string;
  readonly title: string;
  readonly order: number;
  readonly prerequisites: readonly string[];
  /** 0–6 natural depth (KG concept layer when seeded, else prerequisite-chain depth). */
  readonly layer: number;
  readonly status: TimelineNodeStatus;
  /** Mastery confidence (0..1) when a checkpoint exists for this learner, else null. */
  readonly confidence: number | null;
  readonly milestone: boolean;
  readonly mastery_target: { readonly min_confidence: number };
}

/** Typed cognitive-graph edge (SRF-003). Mirrors KnowledgeEdgeType in world-state. */
export type TimelineEdgeType =
  | "prerequisite_of"
  | "depends_on"
  | "applies_to"
  | "research_adjacent"
  | "bridges_to"
  | "frontier_of";

export interface SurfaceTimelineEdge {
  readonly from: string; // concept_id
  readonly to: string; // concept_id
  readonly edge_type: TimelineEdgeType;
}

export type TimelineEntryPoint = "beginner" | "intermediate" | "advanced" | "research";

export interface TimelineProjection {
  readonly timeline_id: string;
  readonly surface_id: string;
  readonly goal: string;
  readonly path_node_id: string;
  readonly nodes: readonly SurfaceTimelineNode[];
  readonly edges: readonly SurfaceTimelineEdge[];
  readonly entry_point: TimelineEntryPoint;
  readonly completed: boolean;
  readonly version: number;
}

/** Concept layer (0–6) for the entry-point heuristic. */
const ENTRY_LAYER: Record<TimelineEntryPoint, number> = {
  beginner: 0,
  intermediate: 2,
  advanced: 4,
  research: 6,
};

export interface SurfaceTimelineInput {
  readonly surface_id: string;
  readonly goal: string;
  readonly path_id: string;
  readonly owner_user_id: string;
  readonly concepts: readonly ConceptSeed[];
  /** Starting layer emphasis; learner-selectable. Defaults to "beginner". */
  readonly entry_point?: TimelineEntryPoint;
}

export interface SurfaceTimelineBuilderDeps {
  readonly world: WorldStateGraph;
  readonly bus: EventBus;
  readonly learningPaths?: LearningPathProjector;
  readonly clock?: Clock;
  readonly idGenerator?: IdGenerator;
  readonly nodeId?: string;
  /** CID stamped as producer on timeline events (the learner in a session context). */
  readonly producerCid?: string;
  /** Mirrors the supervisor's MASTERY_CONFIDENCE_THRESHOLD. */
  readonly masteryConfidenceTarget?: number;
}

function timelineError(message: string, details?: Record<string, unknown>): CosError {
  return new CosError("E_SURFACE_TIMELINE", message, {
    specRef: "spec/surface/surface-timeline-engine.md",
    details,
  });
}

// ---------------------------------------------------------------------------
// SurfaceTimelineBuilder
// ---------------------------------------------------------------------------

export class SurfaceTimelineBuilder {
  private readonly world: WorldStateGraph;
  private readonly bus: EventBus;
  private readonly projector: LearningPathProjector;
  private readonly clock: Clock;
  private readonly idGenerator: IdGenerator;
  private readonly producerCid: string;
  private readonly masteryTarget: number;
  private hlc: Hlc;

  private input: SurfaceTimelineInput | null = null;
  private last: TimelineProjection | null = null;
  private completedEmitted = false;
  private entryPoint: TimelineEntryPoint = "beginner";

  constructor(deps: SurfaceTimelineBuilderDeps) {
    this.world = deps.world;
    this.bus = deps.bus;
    this.projector = deps.learningPaths ?? new LearningPathProjector(deps.world);
    this.clock = deps.clock ?? new SystemClock();
    this.idGenerator = deps.idGenerator ?? new CryptoIdGenerator();
    this.producerCid = deps.producerCid ?? "surface-timeline-builder";
    this.masteryTarget = deps.masteryConfidenceTarget ?? 0.6;
    this.hlc = hlcInit(deps.nodeId ?? "surface-timeline");
  }

  /** The most recent projection, if any. */
  current(): TimelineProjection | null {
    return this.last;
  }

  /**
   * First-time generation for a goal: projects the concept DAG into world-state (Kahn-validated
   * by the LearningPathProjector), derives the initial projection, and emits
   * `surface.timeline.generated` + `surface.timeline.updated`.
   */
  async build(input: SurfaceTimelineInput): Promise<Result<TimelineProjection, CosError>> {
    const pathResult = this.projector.project({
      pathId: input.path_id,
      ownerUserId: input.owner_user_id,
      concepts: input.concepts,
    });
    if (!pathResult.ok) return pathResult;

    const order = topologicalOrder(input.concepts);
    if (!order.ok) return order;

    this.input = input;
    this.entryPoint = input.entry_point ?? "beginner";
    const nodes = this.projectNodes(input, order.value);
    const projection: TimelineProjection = {
      timeline_id: `tl-${this.idGenerator.hex(8)}`,
      surface_id: input.surface_id,
      goal: input.goal,
      path_node_id: pathResult.value.pathNodeId,
      nodes,
      edges: this.projectEdges(input, nodes),
      entry_point: this.entryPoint,
      completed: false,
      version: 1,
    };
    const completed = projection.nodes.every((n) => n.status === "mastered");
    const finalProjection = { ...projection, completed };
    this.last = finalProjection;

    await this.emit("surface.timeline.generated", {
      surface_id: input.surface_id,
      timeline_id: finalProjection.timeline_id,
      goal: input.goal,
      node_count: finalProjection.nodes.length,
      concept_ids: input.concepts.map((c) => c.id),
    });
    await this.emit("surface.timeline.updated", {
      surface_id: input.surface_id,
      projection: finalProjection,
      reason: "initial-projection",
    });
    await this.emitCompletedIfTransitioned(finalProjection);

    return ok(finalProjection);
  }

  /**
   * Re-projection after a world-state change. Pure read — no world-state writes.
   * Emits `surface.timeline.updated` only when the projection actually changed
   * (idempotent reads are silent), and `surface.timeline.completed` exactly once.
   */
  async refresh(reason = "world-state-changed"): Promise<Result<TimelineProjection, CosError>> {
    if (!this.input || !this.last) {
      return err(timelineError("refresh() called before build()"));
    }
    const order = topologicalOrder(this.input.concepts);
    if (!order.ok) return order;

    const nodes = this.projectNodes(this.input, order.value);
    const edges = this.projectEdges(this.input, nodes);
    const unchanged =
      JSON.stringify(nodes) === JSON.stringify(this.last.nodes) &&
      JSON.stringify(edges) === JSON.stringify(this.last.edges);
    if (unchanged) return ok(this.last);

    const completed = nodes.every((n) => n.status === "mastered");
    const projection: TimelineProjection = {
      ...this.last,
      nodes,
      edges,
      completed,
      version: this.last.version + 1,
    };
    this.last = projection;

    await this.emit("surface.timeline.updated", {
      surface_id: this.input.surface_id,
      projection,
      reason,
    });
    await this.emitCompletedIfTransitioned(projection);

    return ok(projection);
  }

  /**
   * Re-project the same graph at a different entry-point emphasis (learner-selectable, SRF-003).
   * Entry point is a projection parameter, never canonical state — it only changes which available
   * nodes are highlighted as suggested starting points; mastery truth and statuses are unchanged.
   * Emits `surface.graph.entrypoint.changed` and a `surface.timeline.updated`.
   */
  async reproject(entryPoint: TimelineEntryPoint): Promise<Result<TimelineProjection, CosError>> {
    if (!this.input || !this.last) {
      return err(timelineError("reproject() called before build()"));
    }
    if (entryPoint === this.entryPoint) return ok(this.last);
    this.entryPoint = entryPoint;
    const projection: TimelineProjection = {
      ...this.last,
      entry_point: entryPoint,
      version: this.last.version + 1,
    };
    this.last = projection;
    await this.emit("surface.graph.entrypoint.changed", {
      surface_id: this.input.surface_id,
      timeline_id: projection.timeline_id,
      entry_point: entryPoint,
    });
    await this.emit("surface.timeline.updated", {
      surface_id: this.input.surface_id,
      projection,
      reason: `entry-point:${entryPoint}`,
    });
    return ok(projection);
  }

  /** The layer (0–6) of the configured entry point — UI highlights available nodes at/below it. */
  entryLayer(): number {
    return ENTRY_LAYER[this.entryPoint];
  }

  // -------------------------------------------------------------------------
  // Status derivation (spec §5 — deterministic precedence)
  // -------------------------------------------------------------------------

  private projectNodes(
    input: SurfaceTimelineInput,
    order: readonly string[],
  ): readonly SurfaceTimelineNode[] {
    const byId = new Map(input.concepts.map((c) => [c.id, c]));
    const mastery = this.masteryMap(input);
    const mastered = new Set(
      [...mastery]
        .filter(([, m]) => m.passed && m.confidence >= this.masteryTarget)
        .map(([id]) => id),
    );
    const depth = this.depthMap(input.concepts);
    const dependents = new Set<string>();
    for (const concept of input.concepts) {
      for (const prereq of concept.prerequisites ?? []) dependents.add(prereq);
    }

    return order.map((conceptId, index) => {
      const seed = byId.get(conceptId);
      const prerequisites = [...(seed?.prerequisites ?? [])];
      const m = mastery.get(conceptId);
      return {
        concept_id: conceptId,
        node_id: `concept:${conceptId}`,
        title: seed?.title ?? conceptId,
        order: index,
        prerequisites,
        layer: this.layerOf(conceptId, depth),
        status: this.deriveStatus(conceptId, prerequisites, mastered, input.owner_user_id),
        confidence: m ? m.confidence : null,
        milestone: !dependents.has(conceptId),
        mastery_target: { min_confidence: this.masteryTarget },
      };
    });
  }

  /** Best mastery checkpoint per concept for this learner (passed wins, then higher confidence). */
  private masteryMap(
    input: SurfaceTimelineInput,
  ): Map<string, { passed: boolean; confidence: number }> {
    const best = new Map<string, { passed: boolean; confidence: number }>();
    for (const checkpoint of this.world.nodesByType("mastery_checkpoint")) {
      const props = checkpoint.props;
      if (props["ownerUserId"] !== input.owner_user_id) continue;
      if (typeof props["conceptId"] !== "string") continue;
      const cid = props["conceptId"] as string;
      const passed = props["passed"] === true;
      const confidence = (props["confidence"] as number | undefined) ?? (passed ? 1 : 0);
      const existing = best.get(cid);
      if (
        !existing ||
        (passed && !existing.passed) ||
        (passed === existing.passed && confidence > existing.confidence)
      ) {
        best.set(cid, { passed, confidence });
      }
    }
    return best;
  }

  /** Longest prerequisite-chain depth per concept (0-based, capped at 6) — layer fallback. */
  private depthMap(concepts: readonly ConceptSeed[]): Map<string, number> {
    const byId = new Map(concepts.map((c) => [c.id, c]));
    const memo = new Map<string, number>();
    const depthOf = (id: string, stack: Set<string>): number => {
      const cached = memo.get(id);
      if (cached !== undefined) return cached;
      if (stack.has(id)) return 0; // cycle guard (projector already rejects cycles)
      const prereqs = byId.get(id)?.prerequisites ?? [];
      if (prereqs.length === 0) {
        memo.set(id, 0);
        return 0;
      }
      stack.add(id);
      let max = 0;
      for (const p of prereqs) max = Math.max(max, depthOf(p, stack) + 1);
      stack.delete(id);
      const capped = Math.min(max, 6);
      memo.set(id, capped);
      return capped;
    };
    for (const c of concepts) depthOf(c.id, new Set());
    return memo;
  }

  /** Prefer the KG-seeded `layer` prop on the world concept node; else the prerequisite depth. */
  private layerOf(conceptId: string, depth: ReadonlyMap<string, number>): number {
    const seeded = this.world.getNode(`concept:${conceptId}`)?.props["layer"];
    if (typeof seeded === "number") return seeded;
    return depth.get(conceptId) ?? 0;
  }

  /**
   * Typed cognitive-graph edges (SRF-003): the prerequisite spine derived from the concept seeds
   * (always present), plus structural/informational edges seeded in world-state
   * (`KnowledgeGraphEngine.addEdge`). Deterministic order for replay stability.
   */
  private projectEdges(
    input: SurfaceTimelineInput,
    nodes: readonly SurfaceTimelineNode[],
  ): readonly SurfaceTimelineEdge[] {
    const known = new Set(input.concepts.map((c) => c.id));
    const edges: SurfaceTimelineEdge[] = [];
    const seen = new Set<string>();
    const push = (from: string, to: string, edge_type: TimelineEdgeType): void => {
      if (!known.has(from) || !known.has(to)) return;
      const key = `${edge_type}:${from}:${to}`;
      if (seen.has(key)) return;
      seen.add(key);
      edges.push({ from, to, edge_type });
    };
    for (const node of nodes) {
      for (const prereq of node.prerequisites) push(prereq, node.concept_id, "prerequisite_of");
    }
    const worldTypes: readonly TimelineEdgeType[] = [
      "depends_on",
      "applies_to",
      "research_adjacent",
      "bridges_to",
      "frontier_of",
    ];
    for (const node of nodes) {
      for (const type of worldTypes) {
        for (const target of this.world.neighbors(node.node_id, type)) {
          const to = target.startsWith("concept:") ? target.slice("concept:".length) : target;
          push(node.concept_id, to, type);
        }
      }
    }
    return edges;
  }

  private deriveStatus(
    conceptId: string,
    prerequisites: readonly string[],
    mastered: ReadonlySet<string>,
    userId: string,
  ): TimelineNodeStatus {
    if (mastered.has(conceptId)) return "mastered";

    const node = this.world.getNode(`concept:${conceptId}`);
    if (
      node?.props[`explanation_dispatched:${userId}`] === true ||
      node?.props[`practice_dispatched:${userId}`] === true
    ) {
      return "in_progress";
    }

    if (prerequisites.every((p) => mastered.has(p))) return "available";
    return "locked";
  }

  // -------------------------------------------------------------------------
  // Events
  // -------------------------------------------------------------------------

  private async emitCompletedIfTransitioned(projection: TimelineProjection): Promise<void> {
    if (!projection.completed || this.completedEmitted) return;
    this.completedEmitted = true;
    await this.emit("surface.timeline.completed", {
      surface_id: projection.surface_id,
      timeline_id: projection.timeline_id,
      mastered_count: projection.nodes.length,
    });
  }

  private async emit(eventType: string, payload: Record<string, unknown>): Promise<void> {
    const created = createEvent(
      {
        eventType,
        producerCid: this.producerCid,
        producerType: "product.surface",
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

// ---------------------------------------------------------------------------
// Deterministic topological order (Kahn, declaration-order tie-break)
// ---------------------------------------------------------------------------

function topologicalOrder(concepts: readonly ConceptSeed[]): Result<readonly string[], CosError> {
  const declarationIndex = new Map(concepts.map((c, i) => [c.id, i]));
  const inDegree = new Map<string, number>();
  const dependents = new Map<string, string[]>();
  for (const concept of concepts) {
    if (!inDegree.has(concept.id)) inDegree.set(concept.id, 0);
    for (const prereq of concept.prerequisites ?? []) {
      if (!declarationIndex.has(prereq)) {
        return err(
          timelineError(`concept ${concept.id} references unknown prerequisite ${prereq}`),
        );
      }
      inDegree.set(concept.id, (inDegree.get(concept.id) ?? 0) + 1);
      const deps = dependents.get(prereq) ?? [];
      deps.push(concept.id);
      dependents.set(prereq, deps);
    }
  }

  const byDeclaration = (a: string, b: string): number =>
    (declarationIndex.get(a) ?? 0) - (declarationIndex.get(b) ?? 0);

  const ready = [...inDegree.entries()]
    .filter(([, deg]) => deg === 0)
    .map(([id]) => id)
    .sort(byDeclaration);
  const order: string[] = [];

  while (ready.length > 0) {
    const current = ready.shift() as string;
    order.push(current);
    const unlocked: string[] = [];
    for (const dependent of dependents.get(current) ?? []) {
      const remaining = (inDegree.get(dependent) ?? 0) - 1;
      inDegree.set(dependent, remaining);
      if (remaining === 0) unlocked.push(dependent);
    }
    for (const id of unlocked.sort(byDeclaration)) {
      // Insert preserving global declaration order among currently-ready nodes.
      const at = ready.findIndex((r) => byDeclaration(id, r) < 0);
      if (at === -1) ready.push(id);
      else ready.splice(at, 0, id);
    }
  }

  if (order.length < concepts.length) {
    return err(timelineError("concepts contain a prerequisite cycle"));
  }
  return ok(order);
}
