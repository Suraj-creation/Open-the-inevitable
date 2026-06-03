```yaml
spec:
  title: Memory Tiers, Consolidation, Decay & Distribution
  domain: memory
  status: draft
  owner: memory-team
  last_reviewed: 2026-06-02
  upstream_dependencies:
    - protocols/memory-mutation-protocol
    - world-state/world-state-graph
    - events/event-taxonomy
  downstream_dependencies:
    - curriculum/uli-knowledge-graph
    - agents/agent-catalog
    - product/features/F05-persistent-cognitive-memory
  related_protocols: [memory-mutation-protocol, cognitive-event-protocol]
  related_events: [memory.mutation.committed, memory.consolidated, memory.decayed, memory.redacted]
  related_runtime_systems: [tiered-memory-store, memory-subscription-bus]
  related_governance_systems: [governance-kernel, capability-envelope, human-governance]
  related_observability_systems: [cognitive-observability]
  semantic_tags: [memory, tiers, consolidation, decay, distribution, subscription, compression, retrieval]
  canonical_references:
    - next-generation-cognitive-operating-system-blueprint#8
    - product/Broader-feature-product#9
```

# Memory Tiers, Consolidation, Decay & Distribution

## Purpose

Extend the Phase 1C memory foundation (every write is a validated Memory Mutation) into the
hierarchical, **distributive** cognitive memory the product requires (F05): typed tiers; store only
what matters in compressed form; continuously consolidate and decay; and **distribute** context so
every agent subscribed to a stream has it in real time.

## Tiers

Keyed by the `memory_layer` of the Memory Mutation Protocol: `working`, `episodic`, `semantic`,
`procedural`, `reflective`, `social`, `collective`, `governance`, `failure`, `evolution`. Each tier is
an append-only mutation log with a materialized current-state projection per target.

## Primitives

| Primitive | Description |
|---|---|
| `TieredMemoryStore` | per-tier validated mutation logs + projections; no direct writes |
| `MemoryProjection` | current state for a target, folded from its mutation history |
| `ConsolidationPolicy` | folds many episodic mutations into compressed semantic mutations |
| `DecayPolicy` | emits `decay_confidence` mutations over logical time (forgetting curve) |
| `MemorySubscription` | agents subscribe to tiers/targets; commits notify subscribers in order |

## Runtime Semantics

- `commit(mutation)` validates against the canonical schema, appends to the tier log, updates the
  projection, emits `memory.*`, and notifies subscribers — the distribution mechanism.
- **Consolidation**: `consolidate(targets)` reads episodic history and emits `consolidate_memory` /
  `add_fact` mutations into `semantic`, compressing while preserving evidence and provenance.
- **Decay**: `decay(now)` emits `decay_confidence` mutations for stale items; reinforcement
  (`reinforce_concept`) counteracts decay. State is always derived from mutations, never edited.
- **Reversibility**: mutations are reversible (`inverse_ref`); redaction/quarantine are mutations too.

## Governance, Observability, Failure, Testing, Evolution

- Sensitive/restricted tiers require lease + governance; redaction and consolidation are audited.
- Retrieval and subscription respect classification and tenant scope.
- Failure: malformed mutations rejected; projection is rebuildable from the log (never diverges).
- Tests: tier isolation, projection fold determinism, consolidation compression with evidence
  preserved, decay/reinforce dynamics, subscriber ordering, redaction removes from projection but not
  from audit log.
- Evolution: vector/graph-backed tiers via `@inevitable/contracts` adapters; semantic-cache layer;
  cross-tenant collective memory (anonymized).
