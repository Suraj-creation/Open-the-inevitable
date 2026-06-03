# `spec/product/` — Product & Feature Domain

This domain owns **what The Inevitable is as a product and why** — the bridge between the
civilizational vision in [`spec/vision-application/`](../vision-application/) and the executable
Cognitive Operating System in `spec/kernel/`, `spec/protocols/`, `spec/events/`, `spec/runtime/`,
and the `packages/` that implement them.

## Read first

For any **product, feature, learning-experience, pedagogy, agent-behaviour, memory, or
orchestration** work, read in this order:

1. **[`Broader-feature-product.md`](./Broader-feature-product.md)** — the canonical product
   specification: product thesis, the twelve capability pillars, the agent ecosystem, the memory
   architecture, and the authoritative **Product → Architecture mapping**.
2. The relevant **feature spec(s)** in [`features/`](./features/) — see the index below.
3. The owning **architecture specs** for the cognitive primitives the feature touches
   (`spec/kernel/`, `spec/protocols/`, `spec/events/`, `spec/runtime/`, `spec/memory/`,
   `spec/world-state/`, `spec/orchestration/`, `spec/curriculum/`, `spec/pedagogy/`).
4. The **vision source** in `spec/vision-application/` when intent or philosophy is ambiguous.

## Doctrine

- Product law is **subordinate to architecture law**. Where a product requirement and an architecture
  invariant (the ten non-negotiable laws, blueprint §25.4) conflict, the invariant wins, and the
  requirement is expressed *through* it (events, leases, memory mutations, governed capabilities),
  never around it.
- Every feature traces to: a product pillar, the COS primitives it uses, the agents/events/protocols
  it relies on, observability signals, governance requirements, and validation evidence.
- Spec-first: if a product decision changes architecture, runtime, memory, protocol, orchestration,
  governance, observability, or event semantics, update the owning spec first.

## Contents

| File | Purpose |
|---|---|
| [`Broader-feature-product.md`](./Broader-feature-product.md) | Canonical product specification (master PRD) |
| [`product-cognition-runtime.md`](./product-cognition-runtime.md) | Phase 1E implementation bridge from product features to COS substrate |
| [`features/README.md`](./features/README.md) | Feature index + shared feature-spec template |
| [`features/F01`…`F16`](./features/) | Individual production-grade feature specifications |

## Implementation bridge

`@inevitable/product-cognition` implements the first Phase 1E bridge from this product topology to
the Cognitive OS substrate. It currently covers onboarding/session initialization, learning-path
projection, MVP agent manifests, scheduler-admitted runtime dispatch, deterministic MVP unit
execution, a no-LLM explanation/practice loop, and mastery checkpoint recording. It is intentionally
not a UI, LLM, or storage-backend package.

## Feature index

| ID | Title |
|---|---|
| [F01](./features/F01-cognitive-onboarding.md) | Cognitive Onboarding & Context Initialization |
| [F02](./features/F02-dynamic-cognitive-navigation.md) | Dynamic Cognitive Navigation & Learning Timeline |
| [F03](./features/F03-recursive-prerequisite-intelligence.md) | Recursive Prerequisite Intelligence (ULI Core) |
| [F04](./features/F04-adaptive-multimodal-explanation.md) | Adaptive Multimodal Explanation & Dynamic System Prompting |
| [F05](./features/F05-persistent-cognitive-memory.md) | Persistent Cognitive Memory System |
| [F06](./features/F06-specialized-agent-ecosystem.md) | Specialized Agent Ecosystem |
| [F07](./features/F07-realtime-cognitive-orchestration.md) | Real-Time Cognitive Orchestration |
| [F08](./features/F08-interdisciplinary-knowledge-graph.md) | Interdisciplinary Intelligence & Knowledge Graph |
| [F09](./features/F09-living-universe-experience.md) | Living-Universe Experience & Immersive Roadmap |
| [F10](./features/F10-research-innovation-acceleration.md) | Research & Innovation Acceleration (UALRCI) |
| [F11](./features/F11-institutional-collective-intelligence.md) | Institutional & Collective Intelligence + Educator Mode |
| [F12](./features/F12-collective-cognitive-evolution.md) | Collective Cognitive Evolution (Governed Self-Improvement) |
| [F13](./features/F13-identity-personas-modes.md) | Identity, Personas & Dual Modes |
| [F14](./features/F14-assessment-mastery-depth.md) | Assessment, Mastery & Depth Verification |
| [F15](./features/F15-content-ingestion-knowledge-substrate.md) | Content Ingestion & Universal Knowledge Substrate |
| [F16](./features/F16-cognitive-surface.md) | The Cognitive Surface — Universal Multimodal Substrate |

Retrieval index: [`spec/indexes/product-feature-index.md`](../indexes/product-feature-index.md).
