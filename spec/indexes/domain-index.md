# Domain Index

This is the high-level map of spec domains.

## Product Domain

- `product` — canonical product specification (`spec/product/Broader-feature-product.md`) + feature catalog (`spec/product/features/F01`…`F16`). Product law is subordinate to architecture law; see `Broader-feature-product.md` §14 for the Product → Architecture mapping.

## Foundational Domains

- `philosophy`
- `architecture`
- `kernel`
- `kernel-internals`
- `cognition`
- `runtime`
- `orchestration` — proposal blackboard with typed proposal/arbitrate lifecycle for multi-agent arbitration (DPS-008 / ADR-0018); governed tool runtime (ADR-0019)
- `memory`
- `world-state` — generic delta-sourced versioned graph (`WorldStateGraph`) + knowledge-graph engine (`KnowledgeGraphEngine`: concept seeding, prerequisite decomposition, learner-state queries, cross-domain bridges; DPS-006 / ADR-0015)
- `f04-adaptive-explanation` — seven-layer F04 explanation depth (layers 0–6) with adaptive prompt assembly consuming concept-natural layer (KG, P3.1), assembled context (P2.4), and interpreted intent (P2.5); ADR-0016
- `events`
- `protocols`
- `governance`
- `observability` — cognitive analysis engine (drift detection, confidence calibration, learning-outcome signals; DPS-007 / ADR-0017)
- `replay`
- `persistence` — durable event-sourced persistence + cross-process recovery + per-learner continuity + bounded retrieval + digital twin lifecycle (`spec/persistence/`: DPS-001 durable log/media (ADR-0008), DPS-002 continuity & rehydration (ADR-0009), DPS-003 durable learner identity (ADR-0010), DPS-004 shared per-learner cognition (ADR-0011), DPS-005 context-lease-bounded retrieval & working-memory assembly (ADR-0012), DPS-009 digital twin lifecycle — consent-scoped `TwinRegistry` with create/branch/export/terminate + `twin.*` events (ADR-0020))
- `evolution` — governed self-evolution lifecycle (`spec/evolution/DPS-010-governed-self-evolution.md`, ADR-0021): `EvolutionEngine` in `@inevitable/orchestration` — proposal FSM (proposed → evaluated → approved → rolled_out | rolled_back), deterministic shadow testing against synthetic learners, governance gate at approve, `evolution.*` event family

## Advanced COS Domains

- `cognitive-ir`
- `cognitive-surface`
- `cognitive-isa`
- `consensus`
- `transactions`
- `epistemology`
- `semantic-consistency`
- `cognitive-networking`
- `cognitive-filesystem`
- `query-engine`
- `cognitive-garbage-collection`
- `cognitive-safety`
- `human-governance`
- `synthetic-learners`
- `cognitive-benchmarks`
- `cognitive-developer-platform`

## Implementation Domains

- `control-plane`
- `data-plane`
- `infrastructure`
- `deployment`
- `resilience`
- `testing`
- `evaluation`
- `tooling`
- `implementation-roadmaps`

