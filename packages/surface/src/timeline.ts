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
  readonly status: TimelineNodeStatus;
  readonly milestone: boolean;
  readonly mastery_target: { readonly min_confidence: number };
}

export interface TimelineProjection {
  readonly timeline_id: string;
  readonly surface_id: string;
  readonly goal: string;
  readonly path_node_id: string;
  readonly nodes: readonly SurfaceTimelineNode[];
  readonly completed: boolean;
  readonly version: number;
}

export interface SurfaceTimelineInput {
  readonly surface_id: string;
  readonly goal: string;
  readonly path_id: string;
  readonly owner_user_id: string;
  readonly concepts: readonly ConceptSeed[];
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
    const projection: TimelineProjection = {
      timeline_id: `tl-${this.idGenerator.hex(8)}`,
      surface_id: input.surface_id,
      goal: input.goal,
      path_node_id: pathResult.value.pathNodeId,
      nodes: this.projectNodes(input, order.value),
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
    const unchanged = JSON.stringify(nodes) === JSON.stringify(this.last.nodes);
    if (unchanged) return ok(this.last);

    const completed = nodes.every((n) => n.status === "mastered");
    const projection: TimelineProjection = {
      ...this.last,
      nodes,
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

  // -------------------------------------------------------------------------
  // Status derivation (spec §5 — deterministic precedence)
  // -------------------------------------------------------------------------

  private projectNodes(
    input: SurfaceTimelineInput,
    order: readonly string[],
  ): readonly SurfaceTimelineNode[] {
    const byId = new Map(input.concepts.map((c) => [c.id, c]));
    const mastered = this.masteredSet(input);
    const dependents = new Set<string>();
    for (const concept of input.concepts) {
      for (const prereq of concept.prerequisites ?? []) dependents.add(prereq);
    }

    return order.map((conceptId, index) => {
      const seed = byId.get(conceptId);
      const prerequisites = [...(seed?.prerequisites ?? [])];
      return {
        concept_id: conceptId,
        node_id: `concept:${conceptId}`,
        title: seed?.title ?? conceptId,
        order: index,
        prerequisites,
        status: this.deriveStatus(conceptId, prerequisites, mastered, input.owner_user_id),
        milestone: !dependents.has(conceptId),
        mastery_target: { min_confidence: this.masteryTarget },
      };
    });
  }

  private masteredSet(input: SurfaceTimelineInput): ReadonlySet<string> {
    const mastered = new Set<string>();
    for (const checkpoint of this.world.nodesByType("mastery_checkpoint")) {
      const props = checkpoint.props;
      if (
        props["ownerUserId"] === input.owner_user_id &&
        props["passed"] === true &&
        ((props["confidence"] as number | undefined) ?? 1) >= this.masteryTarget &&
        typeof props["conceptId"] === "string"
      ) {
        mastered.add(props["conceptId"] as string);
      }
    }
    return mastered;
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
