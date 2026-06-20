/**
 * KnowledgeGraphEngine — domain query layer over WorldStateGraph for the ULI core (DPS-006).
 *
 * Seeds concept nodes + prerequisite edges into the world-state graph, decomposes a goal into
 * a topologically-ordered learning path to a zero-knowledge start, tracks the learner's
 * per-concept state, and adds cross-domain bridges. All durable state lives in WorldStateGraph;
 * the engine's internal registry is a non-authoritative fast path.
 *
 * Spec: spec/world-state/knowledge-graph-engine.md, ADR-0015.
 */
import type { WorldStateGraph } from "./graph";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Natural explanation depth for a concept.
 * 0=intuition, 1=visual, 2=conceptual, 3=mathematical, 4=applied, 5=advanced, 6=research.
 * Used by the adaptive prompt assembler (P3.2) to choose the right depth for a learner.
 */
export type ConceptLayer = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** The KG engine's unit of domain knowledge: a concept with its depth and prerequisites. */
export interface ConceptSpec {
  readonly id: string;
  readonly label: string;
  readonly domain: string;
  /** Natural depth layer for this concept. Adaptive prompting starts here and deepens over time. */
  readonly layer: ConceptLayer;
  /** IDs of concepts that must be learned before this one. Forms the DAG. */
  readonly prerequisites?: readonly string[];
}

/** Per-concept learning state for one learner, derived from world-state mastery + phase props. */
export interface LearnerConceptState {
  readonly conceptId: string;
  readonly label: string;
  readonly mastered: boolean;
  readonly confidence: number;
  /** 'pending' → explained → practiced → assessed → 'complete' */
  readonly phase: "pending" | "explaining" | "practicing" | "assessing" | "complete";
}

// ---------------------------------------------------------------------------
// KnowledgeGraphEngine
// ---------------------------------------------------------------------------

export class KnowledgeGraphEngine {
  /** Non-authoritative in-memory fast path — see ADR-0015 §4. */
  private readonly conceptRegistry = new Map<string, ConceptSpec>();

  constructor(private readonly world: WorldStateGraph) {}

  // -------------------------------------------------------------------------
  // Seeding
  // -------------------------------------------------------------------------

  /**
   * Upsert concept nodes + prerequisite edges into the WorldStateGraph and register them in the
   * engine's local registry. Idempotent: re-seeding the same spec merges props (world-state
   * upsert semantics). All nodes are written before edges so forward-references resolve.
   */
  seedConcepts(specs: readonly ConceptSpec[]): void {
    for (const spec of specs) {
      this.conceptRegistry.set(spec.id, spec);
      this.world.apply({
        kind: "upsert_node",
        id: `concept:${spec.id}`,
        type: "concept",
        props: {
          conceptId: spec.id,
          label: spec.label,
          domain: spec.domain,
          layer: spec.layer,
        },
      });
    }
    for (const spec of specs) {
      for (const prereqId of spec.prerequisites ?? []) {
        if (!this.conceptRegistry.has(prereqId)) continue;
        this.world.apply({
          kind: "upsert_edge",
          id: `edge:prereq:${prereqId}:${spec.id}`,
          from: `concept:${prereqId}`,
          to: `concept:${spec.id}`,
          type: "prerequisite_of",
          props: {},
        });
      }
    }
  }

  // -------------------------------------------------------------------------
  // KG queries
  // -------------------------------------------------------------------------

  /**
   * Topological sort from `goalConceptId` back to zero-knowledge start. Returns concept ids in
   * learning order: leaf prerequisites first, goal last. Uses the engine's registry (fast path).
   * Graceful: an unknown goalConceptId returns `[goalConceptId]` rather than throwing.
   */
  decompose(goalConceptId: string): string[] {
    const visited = new Set<string>();
    const order: string[] = [];

    const visit = (id: string): void => {
      if (visited.has(id)) return;
      visited.add(id);
      const spec = this.conceptRegistry.get(id);
      if (spec) {
        for (const prereqId of spec.prerequisites ?? []) {
          visit(prereqId);
        }
      }
      order.push(id);
    };

    visit(goalConceptId);
    return order;
  }

  /**
   * Derive the learner's per-concept state from world-state. Reads mastery_checkpoint nodes and
   * concept node phase-tracking props to produce a complete picture of where the learner stands
   * in the knowledge graph.
   */
  learnerState(ownerUserId: string): LearnerConceptState[] {
    const masteryNodes = this.world
      .nodesByType("mastery_checkpoint")
      .filter((n) => n.props["ownerUserId"] === ownerUserId);

    const bestMastery = new Map<string, { passed: boolean; confidence: number }>();
    for (const node of masteryNodes) {
      const cid = String(node.props["conceptId"] ?? "");
      if (!cid) continue;
      const passed = Boolean(node.props["passed"]);
      const confidence = (node.props["confidence"] as number | undefined) ?? 0;
      const existing = bestMastery.get(cid);
      if (
        !existing ||
        (passed && !existing.passed) ||
        (passed === existing.passed && confidence > existing.confidence)
      ) {
        bestMastery.set(cid, { passed, confidence });
      }
    }

    return [...this.conceptRegistry.values()].map((spec): LearnerConceptState => {
      const mastery = bestMastery.get(spec.id);
      if (mastery) {
        return {
          conceptId: spec.id,
          label: spec.label,
          mastered: mastery.passed,
          confidence: mastery.confidence,
          phase: mastery.passed ? "complete" : "assessing",
        };
      }
      const node = this.world.getNode(`concept:${spec.id}`);
      const practiceKey = `practice_dispatched:${ownerUserId}`;
      const explanationKey = `explanation_dispatched:${ownerUserId}`;
      let phase: LearnerConceptState["phase"] = "pending";
      if (node?.props[practiceKey] === true) phase = "assessing";
      else if (node?.props[explanationKey] === true) phase = "practicing";
      return { conceptId: spec.id, label: spec.label, mastered: false, confidence: 0, phase };
    });
  }

  /**
   * First concept the learner has not yet mastered, in topological (learning) order.
   * Returns `undefined` when all registered concepts are complete.
   * `goalConceptId` defaults to the last concept registered (the overall learning goal).
   */
  nextConcept(ownerUserId: string, goalConceptId?: string): ConceptSpec | undefined {
    const goal = goalConceptId ?? [...this.conceptRegistry.keys()].at(-1);
    if (!goal) return undefined;
    const order = this.decompose(goal);
    const stateMap = new Map(this.learnerState(ownerUserId).map((s) => [s.conceptId, s]));
    for (const conceptId of order) {
      const s = stateMap.get(conceptId);
      if (!s || s.phase !== "complete") return this.conceptRegistry.get(conceptId);
    }
    return undefined;
  }

  // -------------------------------------------------------------------------
  // Cross-domain bridges
  // -------------------------------------------------------------------------

  /** Add a cross-domain bridge edge between two concepts (informational; no acyclicity check). */
  addBridge(fromId: string, toId: string, label?: string): void {
    this.world.apply({
      kind: "upsert_edge",
      id: `edge:bridge:${fromId}:${toId}`,
      from: `concept:${fromId}`,
      to: `concept:${toId}`,
      type: "bridges_to",
      props: label ? { label } : {},
    });
  }

  // -------------------------------------------------------------------------
  // Inspection helpers
  // -------------------------------------------------------------------------

  /** All registered ConceptSpecs. */
  concepts(): readonly ConceptSpec[] {
    return [...this.conceptRegistry.values()];
  }

  /** Number of registered concepts. */
  size(): number {
    return this.conceptRegistry.size;
  }
}
