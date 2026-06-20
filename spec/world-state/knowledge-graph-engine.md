```yaml
spec:
  title: Knowledge-Graph Engine (DPS-006)
  id: DPS-006
  domain: world-state
  status: active
  owner: uli-team
  last_reviewed: 2026-06-20
  upstream_dependencies:
    - world-state/world-state-graph
    - kernel/intent-lease
    - persistence/shared-learner-cognition
  downstream_dependencies:
    - product/product-cognition-runtime
    - surface/cognitive-surface-runtime
    - observability/cognitive-observability-analysis
  related_protocols:
    - cognitive-event-protocol
    - memory-mutation-protocol
  related_events:
    - kg.concepts.seeded
    - kg.prerequisites.decomposed
    - kg.bridge.added
    - mastery.verified
    - mastery.rejected
  related_runtime_systems: [world-state-graph, kg-engine, supervisor-unit, curriculum-unit]
  related_governance_systems: [governance-kernel]
  related_observability_systems: [cognitive-observability, causal-graph]
  semantic_tags:
    [knowledge-graph, prerequisite-dag, concept-layer, cross-domain, uli-core, adaptive-learning]
  canonical_references:
    - next-generation-cognitive-operating-system-blueprint#7
    - advanced-agent-architecture#4
    - spec/product/Broader-feature-product.md#F04
```

# Knowledge-Graph Engine (DPS-006)

## Purpose

Shape the `WorldStateGraph` into a domain-specific knowledge graph: seed concept nodes with
prerequisite edges, decompose a goal into a topologically-ordered learning path to a zero-knowledge
start, track the learner's per-concept state, and bridge concepts across domains. This is the
structural foundation of the Universal Learning Intelligence (ULI) — it answers the questions
*"What must a learner know before this concept?"* and *"Where is this learner in that graph right now?"*

## Architecture Position

The KG engine is a **read-biased domain query layer** over `WorldStateGraph`. It does not replace
or duplicate the graph — it translates domain knowledge (concept specs, prerequisite relationships,
learner mastery) into typed world-state deltas and exposes higher-level queries on top.

```
WorldStateGraph  (generic delta-sourced graph)
       ↑
KnowledgeGraphEngine  (concept domain layer: seed / decompose / learnerState / nextConcept / bridge)
       ↑
CurriculumUnit (generates ConceptSpec from goal) → KG.seedConcepts → world-state deltas
SupervisorUnit (routing reads concept nodes) ←  world-state nodes written by KG engine
```

## Primitives

| Primitive | Description |
|---|---|
| `ConceptLayer` | `0..6` — natural depth: 0=intuition, 1=visual, 2=conceptual, 3=mathematical, 4=applied, 5=advanced, 6=research |
| `ConceptSpec` | `{id, label, domain, layer, prerequisites?}` — the KG engine's currency |
| `LearnerConceptState` | `{conceptId, label, mastered, confidence, phase}` — derived from world-state mastery + concept props |
| `KnowledgeGraphEngine` | wraps `WorldStateGraph`; seeds and queries concept domain nodes/edges |

## Node/Edge Conventions in WorldStateGraph

| World-state artifact | ID pattern | Type |
|---|---|---|
| Concept node | `concept:<conceptId>` | `concept` |
| Prerequisite edge | `edge:prereq:<prereqId>:<conceptId>` | `prerequisite_of` |
| Cross-domain bridge | `edge:bridge:<fromId>:<toId>` | `bridges_to` |

- `prerequisite_of` edges are acyclic-enforced by `WorldStateGraph` (DAG invariant from §2 law).
- `bridges_to` edges are informational and carry no acyclicity constraint.
- Concept node props: `conceptId`, `label`, `domain`, `layer` (the natural depth).

## Runtime Semantics

### seedConcepts(specs)
- Upserts a `concept` world-state node for each spec (idempotent).
- Adds a `prerequisite_of` edge from each prerequisite concept to its dependent (all nodes first,
  then edges — so forward-references resolve).
- Stores specs in the engine's internal registry for decompose/query use.
- Emits no events (seeding is silent infrastructure construction).

### decompose(goalConceptId)
- Returns concept ids in topological learning order: leaf prerequisites first, goal last.
- DFS from goal through prerequisites recorded in the engine's registry.
- Only includes concepts seeded via `seedConcepts`.

### learnerState(ownerUserId)
- Reads `mastery_checkpoint` nodes from `WorldStateGraph` filtered by `ownerUserId`.
- Reads concept node props (`explanation_dispatched`, `practice_dispatched`) for phase.
- Returns `LearnerConceptState[]` for all registered concepts — complete picture of progress.

### nextConcept(ownerUserId, goalConceptId?)
- Decomposes the goal (defaults to last registered concept), then returns the first concept
  whose phase is not `complete` — the next thing to teach.
- Returns `undefined` when all concepts are mastered.

### addBridge(fromId, toId, label?)
- Adds a `bridges_to` edge between two concept nodes — a cross-domain connection that enables
  analogy-based explanation and multi-domain prerequisite reasoning (future P5/P6).

## Events and Observability

- `kg.concepts.seeded` — fired after `seedConcepts` completes (count, domain).
- `kg.prerequisites.decomposed` — fired when decompose runs (goalConceptId, depth).
- `kg.bridge.added` — fired when `addBridge` is called.
- All mastery state derives from existing `mastery.*` events (KG engine reads; does not own mastery).

## Governance

The KG engine writes world-state deltas via the `WorldStateGraph` API, which already enforces
acyclicity for `prerequisite_of` edges (a cycle-introducing delta is rejected, fail-closed).
No additional governance policies are needed at the KG layer for P3.1; capability-restricted
concept mutations (e.g. evolution proposals) are future P6 work.

## Failure Modes

- **Missing prerequisite nodes**: seeding edges before their nodes would fail the world-state
  acyclic check (from/to must exist). `seedConcepts` always upserts all nodes before edges.
- **Cycle in prerequisite graph**: detected and rejected by `WorldStateGraph.apply()` for the
  `prerequisite_of` edge type. The KG engine surfaces the error and skips the offending edge.
- **Unknown goalConceptId in decompose**: returns `[goalConceptId]` (only itself, no registered
  prerequisites) — graceful degradation, never a crash.

## Testing

- `seedConcepts` writes concept nodes + prerequisite edges to world-state (inspectable via `nodesByType`).
- `decompose` returns correct topological order: leaf prerequisites before goal.
- `learnerState` returns `pending` initially, `complete` after a passing mastery checkpoint.
- `nextConcept` returns the first unmastered concept in topological order; `undefined` when all done.
- `addBridge` writes a `bridges_to` edge inspectable via `world.getEdge`.
- Integration: after a demo session ask, the KG reflects concept phase-tracking from world-state.

## Non-Goals (P3.1)

- KG engine does not own mastery recording — `MasteryCheckpointRecorder` remains the authority.
- Layer-adaptive prompt assembly lives in P3.2 (F04 depth extension).
- Multi-writer CRDT convergence for concurrent concept updates is a future P6 concern.
- The engine has no persistence of its own — all durable state lives in `WorldStateGraph`.
