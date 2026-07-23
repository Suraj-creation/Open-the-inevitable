# Product & Feature Index

> Retrieval index for the **product domain** of The Inevitable. The product domain owns *what the
> platform does for humans interacting with knowledge* and bridges the civilizational vision in
> `spec/vision-application/` with the executable Cognitive Operating System in `spec/kernel/`,
> `spec/protocols/`, `spec/events/`, `spec/runtime/`, and the packages that implement them.

## Read-First (canonical order)

| # | File | Purpose |
|---|---|---|
| 1 | [`spec/product/Broader-feature-product.md`](../product/Broader-feature-product.md) | **Master PRD** — product thesis, capability pillars, agent ecosystem, memory architecture, orchestration, modes/personas, Product → Architecture mapping, success metrics |
| 2 | [`spec/product/README.md`](../product/README.md) | Product domain entry point & feature index |
| 3 | [`spec/product/features/README.md`](../product/features/README.md) | Shared feature-spec template, status lifecycle, authoring conventions |
| 4 | [`spec/product/features/F01`…`F16`](../product/features/) | Individual feature specifications |

## The Twelve Capability Pillars

The product surface decomposes into twelve capability pillars; sixteen feature specs refine them
(some pillars span more than one spec). This is the authoritative pillar → feature map.

| # | Capability Pillar | Feature spec(s) | Status |
|---|---|---|---|
| P1 | Cognitive Onboarding & Context Initialization | [F01](../product/features/F01-cognitive-onboarding.md) | draft |
| P2 | Dynamic Cognitive Navigation (intent → living timeline) | [F02](../product/features/F02-dynamic-cognitive-navigation.md) | draft |
| P3 | Recursive Prerequisite Intelligence (ULI core) | [F03](../product/features/F03-recursive-prerequisite-intelligence.md) | draft |
| P4 | Adaptive Multimodal Explanation (7 layers, DSP, infinite explanations) | [F04](../product/features/F04-adaptive-multimodal-explanation.md) | draft |
| P5 | Persistent Cognitive Memory (hierarchical, compressed, distributive) | [F05](../product/features/F05-persistent-cognitive-memory.md) | draft |
| P6 | Specialized Agent Ecosystem (30+ agents on the ULI/UALRCI substrate) | [F06](../product/features/F06-specialized-agent-ecosystem.md) | draft |
| P7 | Real-Time Cognitive Orchestration | [F07](../product/features/F07-realtime-cognitive-orchestration.md) | draft |
| P8 | Interdisciplinary Intelligence & Knowledge Graph | [F08](../product/features/F08-interdisciplinary-knowledge-graph.md) | draft |
| P9 | Living-Universe Experience (UX, canvas, immersive roadmap) | [F09](../product/features/F09-living-universe-experience.md) | draft |
| P10 | Research & Innovation Acceleration (UALRCI) | [F10](../product/features/F10-research-innovation-acceleration.md) | draft |
| P11 | Institutional & Collective Intelligence + Educator Mode | [F11](../product/features/F11-institutional-collective-intelligence.md) | draft |
| P12 | Collective Cognitive Evolution (governed self-improvement) | [F12](../product/features/F12-collective-cognitive-evolution.md) | draft |
| — | Identity, Personas & Dual Modes *(cross-cutting)* | [F13](../product/features/F13-identity-personas-modes.md) | draft |
| — | Assessment, Mastery & Depth Verification *(cross-cutting)* | [F14](../product/features/F14-assessment-mastery-depth.md) | draft |
| — | Content Ingestion & Universal Knowledge Substrate *(cross-cutting)* | [F15](../product/features/F15-content-ingestion-knowledge-substrate.md) | draft |
| — | The Cognitive Surface — Universal Multimodal Substrate *(cross-cutting)* | [F16](../product/features/F16-cognitive-surface.md) | draft |

## Cross-Cuts — Where Features Touch the Stack

| Product concern | Feature(s) | Owning architecture domain(s) |
|---|---|---|
| Cognitive Identity / Persona / Mode | F01, F13 | `kernel/cognitive-identity.md` |
| Capability Envelope & Context/Intent Leases | F01, F02, F06, F13 | `kernel/capability-envelope.md`, `kernel/context-lease.md`, `kernel/intent-lease.md` |
| Cognition Packet & Event Protocol | F02, F06, F07 | `protocols/cognition-packet-protocol.md`, `protocols/cognitive-event-protocol.md`, `events/event-taxonomy.md` |
| Memory Mutation Protocol | F05, F11, F12 | `protocols/memory-mutation-protocol.md`, `memory/`, `world-state/` |
| Reasoning Trace Protocol | F04, F06, F07, F14 | `protocols/reasoning-trace-protocol.md`, `observability/` |
| Knowledge Graph (learner model, mastery state, prerequisite DAG) | F02, F03, F08, F14 | `world-state/`, `curriculum/`, `pedagogy/` |
| Real-Time Orchestration (bus, blackboard, scheduler) | F06, F07 | `orchestration/`, `communication/`, `scheduler/` |
| Governance Kernel & Human Governance | F01, F05, F11, F12 | `kernel/governance-kernel.md`, `governance/`, `human-governance/`, `cognitive-safety/` |
| Replay & Deterministic Execution | F04, F06, F07, F12, F14 | `events/`, `replay/`, `runtime/` |
| Cognitive Unit ABI | F06, F11 | `protocols/cognitive-unit-abi.md`, `runtime/` |
| Multimodal Delivery (canvas, AR/VR roadmap) | F04, F09, F16 | `runtime/`, `cognitive-developer-platform/` |
| Cognitive Surface substrate (block primitive, projections, render + replay, CRDT collab) | F16, F09, F04, F07 | `world-state/`, `events/`, `replay/`, `execution/`, `runtime/` |
| Self-Evolution Proposals | F12 | `evolution/`, `experimentation/`, `benchmarking/` |
| Synthetic Learners & Pedagogy Evaluation | F14 | `synthetic-learners/`, `simulations/`, `cognitive-benchmarks/`, `learning-science/` |
| Cognitive Source Environment (source canonicalization, anchors, viewports/highlights/sync, episodes, frontier overlays) | F15, F16, F04, F09, F10 | `source-environment/` (CSE-001…CSE-010, ADR-0032) |

## How to Add a New Feature

1. Decide which capability pillar it belongs to. If it would create a new pillar, propose an ADR
   under `spec/architecture-decisions/` first.
2. Copy the template from `spec/product/features/README.md` and write the feature spec.
3. Update:
   - The catalog table in `spec/product/Broader-feature-product.md` §15.
   - The index in `spec/product/README.md`.
   - The pillar table above.
   - The Feature Spec Catalog in `CODEX.md` (`CLAUDE.md` carries no copy — it points to this index).
4. Link the feature's upstream/downstream dependencies in its frontmatter and the cross-cut table
   above if it introduces new architecture-domain touchpoints.

## Status Lifecycle

`scaffold` → `draft` → `review` → `accepted` → `implementing` → `landed` → `superseded` / `retired`.

A spec moves to `accepted` only after architecture conformance has been validated against the ten
non-negotiable laws (blueprint §25.4) and the relevant owning architecture domains have been notified.

## Doctrine Reminder

Product law is subordinate to architecture law. Where a product requirement appears to conflict with
an architecture invariant, the invariant wins; the requirement is realised *through* events, leases,
memory mutations, and governed capabilities — never around them. See
[`spec/product/Broader-feature-product.md` §14](../product/Broader-feature-product.md#14-how-the-product-maps-onto-the-cognitive-operating-system).
