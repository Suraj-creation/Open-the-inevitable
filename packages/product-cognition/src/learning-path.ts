import { type Result, CosError, err, ok } from "@inevitable/shared";
import { type WorldStateGraph } from "@inevitable/world-state";

export interface ConceptSeed {
  readonly id: string;
  readonly title: string;
  readonly prerequisites?: readonly string[];
}

export interface LearningPathInput {
  readonly pathId: string;
  readonly ownerUserId: string;
  readonly concepts: readonly ConceptSeed[];
}

export interface LearningPathProjection {
  readonly pathNodeId: string;
  readonly conceptNodeIds: readonly string[];
}

function conceptNodeId(id: string): string {
  return `concept:${id}`;
}

function productPathError(message: string): CosError {
  return new CosError("E_PRODUCT_LEARNING_PATH", message, {
    specRef: "product/product-cognition-runtime",
  });
}

/**
 * Validate concept seeds for unknown prerequisites and cycles BEFORE touching world-state.
 * Uses Kahn's algorithm (topological sort) on the prerequisite graph so we never produce a
 * partial world-state mutation on failure. Returns a CosError on the first violation found.
 */
function validateConceptSeeds(concepts: readonly ConceptSeed[]): CosError | undefined {
  const known = new Set(concepts.map((c) => c.id));
  for (const concept of concepts) {
    for (const prereq of concept.prerequisites ?? []) {
      if (!known.has(prereq)) {
        return productPathError(`concept ${concept.id} references unknown prerequisite ${prereq}`);
      }
    }
  }

  // Kahn's algorithm: build adjacency (prerequisite → dependents) and in-degree map.
  const inDegree = new Map<string, number>();
  const dependents = new Map<string, string[]>();
  for (const c of concepts) {
    if (!inDegree.has(c.id)) inDegree.set(c.id, 0);
    if (!dependents.has(c.id)) dependents.set(c.id, []);
    for (const prereq of c.prerequisites ?? []) {
      inDegree.set(c.id, (inDegree.get(c.id) ?? 0) + 1);
      const deps = dependents.get(prereq) ?? [];
      deps.push(c.id);
      dependents.set(prereq, deps);
    }
  }
  const queue = [...inDegree.entries()].filter(([, deg]) => deg === 0).map(([id]) => id);
  let processed = 0;
  while (queue.length > 0) {
    const current = queue.shift() as string;
    processed++;
    for (const dep of dependents.get(current) ?? []) {
      const newDeg = (inDegree.get(dep) ?? 0) - 1;
      inDegree.set(dep, newDeg);
      if (newDeg === 0) queue.push(dep);
    }
  }
  if (processed < concepts.length) {
    return productPathError(
      "concepts contain a prerequisite cycle (topological sort could not complete)",
    );
  }
  return undefined;
}

export class LearningPathProjector {
  constructor(private readonly world: WorldStateGraph) {}

  project(input: LearningPathInput): Result<LearningPathProjection, CosError> {
    // Validate ALL concepts before touching world-state. This prevents partial
    // mutations leaving the graph dirty on failure (architecture law: atomicity).
    const validationError = validateConceptSeeds(input.concepts);
    if (validationError) return err(validationError);

    const pathNodeId = `path:${input.pathId}`;
    const conceptNodeIds = input.concepts.map((concept) => conceptNodeId(concept.id));
    const pathResult = this.world.apply({
      kind: "upsert_node",
      id: pathNodeId,
      type: "learning_path",
      props: { ownerUserId: input.ownerUserId, pathId: input.pathId },
    });
    if (!pathResult.ok) return pathResult;

    for (const concept of input.concepts) {
      const nodeResult = this.world.apply({
        kind: "upsert_node",
        id: conceptNodeId(concept.id),
        type: "concept",
        props: {
          conceptId: concept.id,
          title: concept.title,
          ownerUserId: input.ownerUserId,
          pathId: input.pathId,
        },
      });
      if (!nodeResult.ok) return nodeResult;

      const containsResult = this.world.apply({
        kind: "upsert_edge",
        id: `edge:${pathNodeId}:contains:${conceptNodeId(concept.id)}`,
        from: pathNodeId,
        to: conceptNodeId(concept.id),
        type: "contains_concept",
        props: { order: conceptNodeIds.indexOf(conceptNodeId(concept.id)) },
      });
      if (!containsResult.ok) return containsResult;
    }

    for (const concept of input.concepts) {
      for (const prerequisite of concept.prerequisites ?? []) {
        const edgeResult = this.world.apply({
          kind: "upsert_edge",
          id: `edge:${conceptNodeId(prerequisite)}:prerequisite_of:${conceptNodeId(concept.id)}`,
          from: conceptNodeId(prerequisite),
          to: conceptNodeId(concept.id),
          type: "prerequisite_of",
          props: { pathId: input.pathId },
        });
        if (!edgeResult.ok) return edgeResult;
      }
    }

    return ok({ pathNodeId, conceptNodeIds });
  }
}
