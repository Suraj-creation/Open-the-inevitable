```yaml
spec:
  title: World-State Graph & World-State Delta Protocol
  domain: world-state
  status: draft
  owner: world-state-team
  last_reviewed: 2026-06-02
  upstream_dependencies:
    - memory/memory-tiers
    - events/event-taxonomy
    - protocols/cognitive-event-protocol
    - protocols/memory-mutation-protocol
  downstream_dependencies:
    - orchestration/orchestration-fabric
    - curriculum/uli-knowledge-graph
    - query-engine/temporal-queries
  related_protocols:
    - memory-mutation-protocol
    - cognitive-event-protocol
  related_events: [world.node.upserted, world.edge.upserted, world.delta.applied, world.snapshot.taken]
  related_runtime_systems: [world-state-graph, materialized-views]
  related_governance_systems: [governance-kernel, capability-envelope]
  related_observability_systems: [cognitive-observability, causal-graph]
  semantic_tags: [world-state, graph, deltas, knowledge-graph, learner-model, materialized-view, temporal]
  canonical_references:
    - ../architecture/uci-architecture.md#8-orchestration
    - ../architecture/uci-architecture.md#6-event-driven-cognition
```

# World-State Graph & World-State Delta Protocol

## Purpose

Define the unified, versioned graph that is the single projection of cognition: agents, memory,
orchestration state, and — for the product — the **learner-specific knowledge graph and learner
model** (concept nodes, prerequisite edges, mastery/confidence per node). Memory, workflows, and
runtime state are *views* of this world-state ([blueprint §7](../architecture/uci-architecture.md)).

## Philosophy

State changes are **typed deltas**, never in-place mutation. The graph is materialized by folding an
append-only delta log; this makes world-state event-sourced, temporal, replayable, and causally
traceable — identical in spirit to the event/memory-mutation discipline.

## Primitives

| Primitive | Description |
|---|---|
| `WorldNode` | `{ id, type, props, version, hlc }` — e.g. a concept, learner, agent, artifact |
| `WorldEdge` | `{ id, from, to, type, props, version, hlc }` — e.g. `prerequisite_of`, `mastered_by`, `bridges_to` |
| `WorldStateDelta` | typed change: `upsert_node`, `remove_node`, `upsert_edge`, `remove_edge`, `set_node_prop`, `set_edge_prop` |
| `WorldStateGraph` | materialized view folded from the delta log; monotonic `version` |
| `WorldStateSnapshot` | serializable point-in-time graph for restore/fork |

## Runtime Semantics

- `apply(delta)` validates, stamps `version`/HLC, appends to the delta log, updates the materialized
  view, and emits a `world.*` event. Replaying the delta log reproduces the graph exactly.
- Queries: `getNode`, `neighbors(id, edgeType?)`, `nodesByType`, `hasPath(from,to)` and acyclicity
  checks (the prerequisite knowledge graph is a DAG — see [curriculum/uli-knowledge-graph]).
- `snapshot()` / `restore(snapshot)` for fast start and forking; deltas after a snapshot replay on top.

## Events, Observability, Governance, Failure, Testing

- Events: `world.node.upserted`, `world.edge.upserted`, `world.delta.applied`, `world.snapshot.taken`.
- Every delta carries proposer identity + HLC; restricted nodes/edges require lease + governance.
- Acyclicity is enforced for DAG-typed edge classes; a cycle-introducing delta is rejected.
- Failure: invalid/conflicting deltas are rejected (fail closed); the materialized view never diverges
  from the log (rebuildable on demand).
- Testing: fold determinism (same log → same graph), snapshot/restore round-trip, prerequisite-DAG
  acyclicity, neighbor/path queries, learner-model projection from memory mutations.

## Evolution

CRDT-based multi-writer convergence and semantic-conflict resolution (semantic-consistency) extend the
single-writer Phase 1D model. The delta vocabulary is additive and versioned.
