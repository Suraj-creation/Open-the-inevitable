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
- `intelligence` — Cognitive Intelligence Persistence (ADR-0035): the two-plane substrate beneath every subsystem — the append-only Chronicle Plane (strengthened: full reasoning traces chronicled, never dropped) folded by governed Distillers into the Intelligence Plane (IntelligenceArtifacts as world-state nodes + memory mutations, Postgres/RLS, versioned, provenance-linked, re-derivable). One persistence law: emit to the chronicle and/or register a distiller — no third way. (`spec/intelligence/`: CIP-001 substrate/taxonomy/contracts, CIP-002 subsystem audit + distiller registry v1 + M3.5 plan)
- `source-environment` — the Cognitive Source Environment (ADR-0032) + the Cognitive Theater (ADR-0033): converts external knowledge artifacts (PDF, video, web, code, datasets, consented human sessions) into canonical, anchored, multi-layer cognitive environments projected onto the surface, and elevates the surface from narrated frames into a directed, inhabitable theater of cognition (`spec/source-environment/`: CSE-001 foundations/Principle Zero, CSE-002 canonical representation + Source Anchors + progressive canonicalization, CSE-003 meaning representation, CSE-004 transformations, CSE-005 episodes/development state + inspectable world model + affect, CSE-006 living knowledge/claims + continuous research horizon, CSE-007 agent society/interruption law + deep cognitive transparency, CSE-008 source–surface projection + `surface.source.*`, CSE-009 experience catalog, CSE-010 delivery; **Theater:** CSE-011 Cognitive Director, CSE-012 Cognitive Scene, CSE-013 Knowledge Cinematography, CSE-014 Interaction Grammar, CSE-015 Source Fusion, CSE-016 Creative Cognition); architectural depth behind F15; backend graduation in ADR-0034 (Supabase-first); roadmap in `spec/implementation-roadmaps/cse-cognitive-theater-and-backend.md`

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

