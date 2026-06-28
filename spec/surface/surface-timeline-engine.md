---
name: surface-timeline-engine
spec:
  id: SRF-003
  title: Surface Timeline Generation Engine — the Living Timeline
  domain: surface
  status: draft
  owner: product-architecture
  last_reviewed: 2026-06-11
  upstream_dependencies:
    - surface/cognitive-surface-runtime
    - product/features/F02-dynamic-cognitive-navigation
    - product/features/F03-recursive-prerequisite-intelligence
    - product/product-cognition-runtime
    - world-state/world-state-graph
  downstream_dependencies:
    - packages/surface
  related_protocols: [cognitive-event-protocol]
  related_events:
    [surface.timeline.generated, surface.timeline.updated, surface.timeline.completed, surface.graph.expanded, surface.graph.entrypoint.changed]
  related_runtime_systems: [world-state-graph, universal-cognitive-bus]
  related_governance_systems: [governance-kernel]
  related_observability_systems: [cognitive-observability]
  semantic_tags:
    [phase-2a, living-timeline, prerequisite-graph, mastery, projection, timeline-mutation, replay]
  canonical_references:
    - product/features/F02-dynamic-cognitive-navigation#4
    - surface/cognitive-surface-runtime#4
---

# Surface Timeline Generation Engine

## 1. Purpose

When a learner asks "Teach me Neural Networks", the system generates a **living timeline**:
a prerequisite-ordered, milestone-bearing, mastery-gated understanding path that evolves as
the learner's world-state evolves. Not a lesson. Not a course. A dynamically evolving
projection of the learner's prerequisite landscape.

## 2. Philosophy

- **The timeline is a projection of world-state, not a stored artifact.** Concept nodes,
  prerequisite edges, mastery checkpoints, and phase-tracking props already live in the
  world-state graph; the timeline is a pure function over them.
- **Learner-specific:** two learners with the same goal see different timelines because their
  world-state differs.
- **Mutation = re-projection.** The timeline never mutates imperatively; world-state changes
  (mastery recorded, phase advanced), and the timeline is re-projected, emitting
  `surface.timeline.updated`.

## 3. Architecture

```
goal + ConceptSeed[]                      world-state change
        │                                        │
        ▼                                        ▼
SurfaceTimelineBuilder.build()       SurfaceTimelineBuilder.refresh()
        │  (LearningPathProjector:            │ (pure re-read)
        │   Kahn-validated DAG into           │
        │   world-state)                      │
        ▼                                     ▼
            TimelineProjection (pure data)
        │                                     │
        ▼                                     ▼
surface.timeline.generated         surface.timeline.updated
```

The builder composes the existing `LearningPathProjector` (`@inevitable/product-cognition`)
for DAG projection — cycle detection and unknown-prerequisite validation are inherited, and
no new graph semantics are introduced.

## 4. Primitives

```ts
interface SurfaceTimelineNode {
  readonly concept_id: string;
  readonly node_id: string;               // world-state node id ("concept:<id>")
  readonly title: string;
  readonly order: number;                  // deterministic topological order
  readonly prerequisites: readonly string[];   // concept ids (prerequisite_of edges, kept for compat)
  readonly layer: number;                  // 0–6 natural depth (KG concept layer)
  readonly status: TimelineNodeStatus;
  readonly confidence: number | null;      // mastery confidence (0..1) when a checkpoint exists
  readonly milestone: boolean;             // terminal nodes & convergence points
  readonly mastery_target: { readonly min_confidence: number };  // default 0.6 (supervisor threshold)
}

type TimelineNodeStatus =
  | "locked"        // ≥1 prerequisite not mastered
  | "available"     // prerequisites mastered (or none), no phase evidence
  | "in_progress"   // explanation/practice phase props present for the learner
  | "mastered";     // passing mastery checkpoint with confidence ≥ target

// The timeline is a cognitive multi-graph, not a single prerequisite chain (S1.1, ADR-0015).
type TimelineEdgeType =
  | "prerequisite_of"  // must learn `from` before `to` (acyclic; the spine)
  | "depends_on"       // structural dependency (acyclic)
  | "applies_to"       // concept → application/use (informational)
  | "research_adjacent"// concept → research frontier neighbour (informational)
  | "frontier_of";     // marks an open/edge-of-knowledge node (informational)

interface SurfaceTimelineEdge {
  readonly from: string;                   // concept_id
  readonly to: string;                     // concept_id
  readonly edge_type: TimelineEdgeType;
}

type TimelineEntryPoint = "beginner" | "intermediate" | "advanced" | "research";

interface TimelineProjection {
  readonly timeline_id: string;
  readonly surface_id: string;
  readonly goal: string;
  readonly path_node_id: string;          // world-state learning_path node
  readonly nodes: readonly SurfaceTimelineNode[];  // topological order
  readonly edges: readonly SurfaceTimelineEdge[];  // typed cognitive-graph edges
  readonly entry_point: TimelineEntryPoint;        // re-projection parameter (default "beginner")
  readonly completed: boolean;            // all nodes mastered
  readonly version: number;               // increments per re-projection
}
```

The `edges[]` are derived from the world-state graph's typed edges (`KnowledgeGraphEngine`); only
`prerequisite_of`/`depends_on` participate in topological ordering and locking. `applies_to`,
`research_adjacent`, and `frontier_of` are **informational** (no acyclicity constraint) and surface as
distinct links — they let the learner branch into applications and the research frontier (F02/F03/F10).
The graph remains a **pure projection of world-state**; adding edges is a world-state mutation re-read
on `refresh()`, emitting `surface.graph.expanded`.

**TimelineMutation** is not a type — it is the act of re-projection after a world-state
change, observable as `surface.timeline.updated` (with `reason`).
**TimelineReplay** = re-folding `surface.timeline.*` events (each carries the full projected
nodes), or equivalently re-projecting from a restored world-state snapshot; both must agree.
**TimelinePersistence** = world-state graph (canonical topology) + the event log (projection
history). No separate store.

## 5. Protocols and Contracts

`build(input)` contract:

```ts
interface SurfaceTimelineInput {
  readonly surface_id: string;
  readonly goal: string;
  readonly path_id: string;
  readonly owner_user_id: string;
  readonly concepts: readonly ConceptSeed[];   // from product-cognition
}
build(input): Result<TimelineProjection, CosError>
refresh(): Result<TimelineProjection, CosError>  // re-project from current world-state
reproject(entry_point): Result<TimelineProjection, CosError>  // re-project at a different entry layer
```

**Entry points (S1.1).** A learner may begin from any node: `reproject(entry_point)` re-projects the
same graph emphasizing a starting layer — `beginner`→layer 0, `intermediate`→layer 2, `advanced`→layer 4,
`research`→layer 6 — by adjusting which nodes are surfaced as `available` entry candidates (nodes at or
below the entry layer whose prerequisites are met). Entry point is a **projection parameter**, never new
canonical state; a change emits `surface.graph.entrypoint.changed`. Status derivation is unchanged —
entry point only affects which available nodes are highlighted as suggested starting points, never
mastery truth.

Status derivation rules (deterministic, in precedence order per node):

1. `mastered` — a `mastery_checkpoint` node exists for (concept, user) with `passed=true`
   and `confidence ≥ mastery_target.min_confidence` (mirrors supervisor confidence weighting).
2. `in_progress` — concept node carries `explanation_dispatched:<user>` or
   `practice_dispatched:<user>` props.
3. `available` — all prerequisite concepts are `mastered`, or the node has no prerequisites.
4. `locked` — otherwise.

Ordering: Kahn topological order with deterministic tie-break (input declaration order).
Milestones: nodes with no dependents (terminal targets) are milestones.

## 6. Runtime Semantics

- `build()` is idempotent for identical inputs (LearningPathProjector upserts).
- `refresh()` performs no world-state writes — it is a pure read + event emission.
- `completed=true` triggers `surface.timeline.completed` exactly once per timeline (the
  builder tracks the transition edge, not the level).

## 7. Event and State Transitions

| Trigger | Event |
|---|---|
| first `build()` for a surface | `surface.timeline.generated` then `surface.timeline.updated` (initial projection) |
| `refresh()` with changed projection | `surface.timeline.updated` |
| `refresh()` with unchanged projection | no event (idempotent reads are silent) |
| all nodes mastered (transition) | `surface.timeline.completed` |

## 8. Observability

`surface.timeline.updated` carries the full node list and `reason`, making every reshaping
auditable ("why did this node unlock?"). Projection version + world-state `version()` are
both recorded for drift detection.

## 9. Governance and Security

Timeline projection is read-only over the learner's own world-state, bound by the session's
context lease. Reshaping reasons are surfaced (no dark-pattern progression, F02 §10): every
update carries a human-readable `reason`.

## 10. Failure Semantics

| Failure | Behavior |
|---|---|
| prerequisite cycle / unknown prerequisite | `CosError` from LearningPathProjector; no world-state mutation, no events |
| world-state apply fails mid-projection | substrate error returned (projector aborts on first failure) |
| event publish fails | error returned; projection still valid in world-state (event retried on next refresh) |

## 11. Testing and Validation

- "Teach me Neural Networks" with a seeded concept DAG produces a topologically ordered
  timeline with correct initial statuses (roots `available`, dependents `locked`).
- Recording a passing mastery checkpoint then `refresh()` flips the node to `mastered` and
  unlocks dependents (`locked → available`) with `surface.timeline.updated` emitted.
- Low-confidence pass (< target) does NOT mark `mastered` (consistency with supervisor).
- Cycle input returns `CosError` and emits nothing.
- Determinism: identical inputs + seeded ids ⇒ identical `TimelineProjection` deep-equal.
- Completion: mastering all nodes emits `surface.timeline.completed` exactly once.

## 12. Evolution Strategy

- **Cognitive multi-graph (S1.1, ADR-0015/0025):** typed edges (`depends_on`, `applies_to`,
  `research_adjacent`, `frontier_of`) and entry points (`reproject`) ship in Phase S1; the projection
  stays pure and the linear `nodes[]` order is retained for backward compatibility.
- **Open Mode foldback (F02):** side-quest decompositions merge into or fork from the active
  timeline.
- **Parallel rails:** independent prerequisite branches rendered as parallel tracks.
- **Cross-domain bridges (F08):** interdisciplinary edges surfaced as distinct node links.
- **Curriculum-agent reshaping (F07):** agent-proposed reorderings arbitrated by the
  supervisor before re-projection.
