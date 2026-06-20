# ADR-0015 — Knowledge-Graph Engine: Domain Query Layer over WorldStateGraph

**Date:** 2026-06-20
**Status:** Accepted
**Spec:** spec/world-state/knowledge-graph-engine.md (DPS-006)
**Phase:** P3.1

## Context

The `WorldStateGraph` is a generic, delta-sourced versioned graph. The COS product runtime already
writes concept nodes and mastery checkpoints into it (via `CurriculumUnit` → response and
`MasteryCheckpointRecorder`), but:

1. **Prerequisite edges are never materialized.** `CurriculumUnit` returns prerequisites in its
   response packet, but they're never written as `prerequisite_of` edges to the graph. The
   supervisor and surface have no way to query "what must be learned before X?"
2. **No topological decomposition.** The ULI core requires recursive prerequisite resolution to a
   zero-knowledge start — this is structurally impossible without a prerequisite DAG in world-state.
3. **Layer indexing is absent.** Every concept has a natural explanation depth (intuition through
   research); the graph has no layer metadata, so adaptive prompt assembly (P3.2) has nothing to
   consume.
4. **Cross-domain bridges have no representation.** Analogical explanation across domains requires
   explicit `bridges_to` edges.

The question is how to add KG semantics without fracturing world-state into two separate data stores
or adding KG-specific logic to the generic graph.

## Decision

### 1. The KG engine is a domain query layer over `WorldStateGraph`, not a separate store.

`KnowledgeGraphEngine` (in `packages/world-state/`) wraps `WorldStateGraph`. It translates domain
concepts into typed world-state deltas (`concept` nodes, `prerequisite_of`/`bridges_to` edges) and
exposes domain queries (`decompose`, `learnerState`, `nextConcept`). All durable state lives in the
graph; the engine holds a non-authoritative in-memory registry only for fast query path.

**Rejected alternative:** A separate KG store (e.g. dedicated graph DB or KG package). This would
create a second source of truth for concept state, violating the single world-state invariant from
§2. Cross-store consistency would be an unsolved problem and replay would require two stores.

### 2. Concept nodes use the existing `concept:<id>` convention.

`MasteryCheckpointRecorder` already upserts `concept:<conceptId>` nodes. The KG engine follows the
same convention and merges with it (upsert is idempotent). The engine extends the node's props
(`label`, `domain`, `layer`) without conflicting with the mastery recorder's props (`conceptId`).

**Rejected alternative:** A separate node type (e.g. `kg_concept`). This would duplicate concept
identity and require a translation layer everywhere the supervisor reads concept nodes.

### 3. Prerequisite direction: `from: concept:A, to: concept:B, type: prerequisite_of` = "learn A before B".

This direction naturally supports the WorldStateGraph's acyclicity enforcement: the graph rejects an
edge that would create a cycle in `prerequisite_of` edges, protecting the DAG invariant for all
time. `decompose` traverses incoming edges (prerequisites of a goal) recursively.

**Rejected alternative:** `from: concept:B, to: concept:A` ("B depends on A"). Both work; the
chosen direction reads more naturally in queries ("A prerequisite_of B" = "A is a prerequisite of
B" = "learn A before B").

### 4. The engine's internal registry is a non-authoritative fast path.

The `KnowledgeGraphEngine` keeps a `Map<string, ConceptSpec>` populated by `seedConcepts`. This
lets `decompose` run without re-reading world-state edges on every call (O(1) registry lookup vs.
O(n) edge scan). The registry is always a subset of what's in world-state (every seeded spec is
written to the graph). If the process restarts, the registry is rebuilt by re-calling `seedConcepts`
from the restored world-state (or from the curriculum on the next ask).

**Consistency invariant:** every concept in the registry also exists as a world-state node. The
converse is not required — concept nodes from `MasteryCheckpointRecorder` are not in the registry.

### 5. `bridges_to` edges are informational; no acyclicity constraint.

Cross-domain bridges are analogical, not prerequisite. They should not trigger the DAG check. The
`WorldStateGraph` is already constructed with `acyclicEdgeTypes: ["prerequisite_of"]` in the
composition root; `bridges_to` edges do not appear in that set.

### 6. `seedConcepts` is the composition-time hook; re-seeding on each ask is idempotent.

The demo fixture seeds concepts from `demoAsk()` at build time. On each governed ask, the curriculum
response may introduce new concepts; the caller seeds them into the KG engine after the ask (or the
engine is re-seeded from the curriculum). Upsert semantics on the underlying world-state deltas
make this idempotent.

## Consequences

- **Positive:** single source of truth (world-state); zero new packages; replay-safe (delta-sourced);
  no new infra; layers 2-6 now have a foundation (layer metadata on concept nodes).
- **Positive:** the existing supervisor `getNode("concept:${conceptId}")` and `nodesByType("mastery_checkpoint")`
  queries are unchanged — the KG engine extends props, never replaces them.
- **Tradeoff:** the engine's in-memory registry is not durable across restarts. After a restart,
  `seedConcepts` must be called again (from the restored world-state or from the next curriculum
  response). This is acceptable in P3.1; durable registry is a P5/P6 concern.
- **Tradeoff:** `learnerState` reads from the world-state graph on every call. For large concept
  graphs (1000+ nodes) this would be O(n); an indexed projection is a future optimization.
