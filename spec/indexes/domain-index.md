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
- `orchestration`
- `memory`
- `world-state` — generic delta-sourced versioned graph (`WorldStateGraph`) + knowledge-graph engine (`KnowledgeGraphEngine`: concept seeding, prerequisite decomposition, learner-state queries, cross-domain bridges; DPS-006 / ADR-0015)
- `events`
- `protocols`
- `governance`
- `observability`
- `replay`
- `persistence` — durable event-sourced persistence + cross-process recovery + per-learner continuity + bounded retrieval (`spec/persistence/`: DPS-001 durable log/media (ADR-0008), DPS-002 continuity & rehydration (ADR-0009), DPS-003 durable learner identity (ADR-0010), DPS-004 shared per-learner cognition (ADR-0011), DPS-005 context-lease-bounded retrieval & working-memory assembly (ADR-0012))
- `evolution`

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

