# The Inevitable - Codex Project Instructions

The Inevitable is not a normal AI app. It is a long-term, spec-driven cognitive operating system effort for education, distributed cognition, persistent memory, multi-agent orchestration, and continuously evolving intelligence infrastructure.

## Primary Architectural References

Before architecture work, implementation work, refactoring, agent design, memory design, orchestration design, runtime design, protocol design, or infrastructure work, read and synthesize these files:

1. `spec/architecture/uci-architecture.md`
2. `spec/architecture/uci-architecture.md`
3. `spec/vision-application/Vision.md`
4. `spec/vision-application/The_Inevitable_Master_Vision.md`
5. `spec/vision-application/The_Inevitable_Vision_Comprehensive.md`
6. `spec/vision-application/Universal-Learning-Intelligence-Agent.md`
7. `spec/reference-repos/multi-agent-framework-analysis.md`
8. `spec/vision-application/PLAN.md`
9. `spec/vision-application/referenceRepos.md`
10. `spec/spec-folder-ecosystem.md`

`spec/architecture/uci-architecture.md` and `spec/architecture/uci-architecture.md` are complementary foundational architecture references. Do not treat them as conflicting foundations. If one contains a concept missing from the other, treat it as additive context. If implementation or research discovers a stronger abstraction, update the relevant specs so the architecture remains coherent.

These documents are living research-grade references, not frozen implementation law. They express the intended cognitive operating system direction derived from the core outcome vision.

## Primary Product & Feature References

For any **product**, **feature**, **learning-experience**, **pedagogy**, **agent-behaviour**, **memory-policy**, **orchestration-flow**, **UX**, or **mode/persona** work — i.e. anything that touches *what the platform does for humans interacting with knowledge* — read these BEFORE writing or modifying code, in this exact order:

1. `spec/product/Broader-feature-product.md` — **the canonical product specification (master PRD)**. Defines the product thesis, the twelve capability pillars, the agent ecosystem, the memory architecture, the real-time orchestration model, modes/personas, the success North Star, and the authoritative **Product → Architecture mapping** onto the Cognitive Operating System primitives.
2. `spec/product/README.md` — the product domain entry point, read-first guidance, and feature index.
3. The relevant **feature spec(s)** under `spec/product/features/F01`…`F16` (see [Feature Spec Catalog](#feature-spec-catalog) below). Read at minimum the feature(s) directly affected by the change and any feature(s) listed as upstream/downstream in its frontmatter.
4. `spec/product/features/README.md` — shared feature-spec template, status lifecycle, and authoring conventions, when adding or modifying a feature spec.
5. The owning **architecture specs** for the COS primitives the feature touches (`spec/kernel/`, `spec/protocols/`, `spec/events/`, `spec/runtime/`, `spec/memory/`, `spec/world-state/`, `spec/orchestration/`, `spec/curriculum/`, `spec/pedagogy/`).
6. `spec/vision-application/` files when intent or philosophy is ambiguous — these are the upstream source of truth for product purpose.

The product specification is **product law subordinate to architecture law**. Where a product requirement and an architecture invariant (the ten non-negotiable laws, blueprint §25.4) appear to conflict, the architecture invariant wins and the requirement must be expressed *through* the invariant (events, leases, memory mutations, governed capabilities), never around it. See `spec/product/Broader-feature-product.md` §14 — *How the Product Maps onto the Cognitive Operating System*.

### Feature Spec Catalog

| ID | Title | Capability Pillar |
|---|---|---|
| F01 | Cognitive Onboarding & Context Initialization | P1 |
| F02 | Dynamic Cognitive Navigation & Learning Timeline | P2 |
| F03 | Recursive Prerequisite Intelligence (ULI Core) | P3 |
| F04 | Adaptive Multimodal Explanation & Dynamic System Prompting | P4 |
| F05 | Persistent Cognitive Memory System | P5 |
| F06 | Specialized Agent Ecosystem | P6 |
| F07 | Real-Time Cognitive Orchestration | P7 |
| F08 | Interdisciplinary Intelligence & Knowledge Graph | P8 |
| F09 | Living-Universe Experience & Immersive Roadmap | P9 |
| F10 | Research & Innovation Acceleration (UALRCI) | P10 |
| F11 | Institutional & Collective Intelligence + Educator Mode | P11 |
| F12 | Collective Cognitive Evolution (Governed Self-Improvement) | P12 |
| F13 | Identity, Personas & Dual Modes | cross-cutting |
| F14 | Assessment, Mastery & Depth Verification | cross-cutting |
| F15 | Content Ingestion & Universal Knowledge Substrate | cross-cutting |
| F16 | The Cognitive Surface — Universal Multimodal Substrate | cross-cutting |

**When a new feature spec is added** (or an existing one renamed/split/retired), update this table, the table in `CODEX.md`, the catalog in `spec/product/Broader-feature-product.md` §15, the index in `spec/product/README.md`, and the retrieval index `spec/indexes/product-feature-index.md`. The product spec system must not drift.

## Reference Repository Learning Doctrine

This workspace contains local reference repositories that future agents must mine for implementation patterns before inventing new ones:

- `MiroFish/` for simulation-first, staged graph/profile/simulation/report pipelines.
- `hermes-agent/` for persistent agent loop, memory, tools, skills, gateway, scheduling, and multi-surface runtime practices.
- `OpenMAIC/` for classroom generation, scene runtime, LangGraph-like orchestration, streaming, and multimodal education flows.
- `paperclip/` for AI-native company control plane, governance, issues, heartbeats, budgets, and execution semantics.
- `pi/` for modular coding-agent harness, events, extensions, skills, provider abstraction, and session persistence.
- This repository's own `spec/vision-application/` corpus as the sixth internal reference source for outcome vision and implementation constraints.

If a sixth external reference repository is restored or added later, update `spec/vision-application/referenceRepos.md`, `spec/reference-repos/README.md`, and this instruction file. Do not guess missing reference-repo details.

## Architectural Philosophy

Preserve these principles:

- Intelligence is modular, composable, observable, governable, persistent, replayable, and evolvable.
- Agents are cognitive runtime containers, not prompts.
- Every major interaction flows through protocol-governed events or contracts.
- Memory, orchestration, workflows, agents, and runtime state are projections of a unified world-state architecture.
- Cognition unfolds across time, so event sourcing, replay, causal tracing, and temporal state are core primitives.
- Governance is a kernel primitive, not an external moderation layer.
- Observability must track reasoning quality, memory influence, drift, disagreement, confidence, and learning outcomes.
- Self-evolution must happen through governed proposals, evaluation, replay, shadow tests, and rollback.

## Mandatory Workflow Rules

Before implementation:

1. Read the relevant architecture specs.
2. Read the related protocol, runtime, memory, governance, observability, and orchestration docs.
3. Identify which cognitive primitives are involved.
4. Check whether the change affects events, memory mutations, world-state graph, policies, workflows, agent manifests, or protocols.
5. Preserve modularity, observability, governance, replayability, and protocol boundaries.
6. Avoid tightly coupled direct calls where event or protocol mediation is required.
7. Update specs before or alongside implementation when architecture changes.
8. Verify the change with focused tests or documentation checks.

## Spec-First Execution Doctrine

Implementation is subordinate to the spec system. Specs are not passive documentation; they are executable architectural law.

When implementation changes architecture, runtime semantics, memory behavior, protocol behavior, orchestration flow, governance semantics, observability semantics, event contracts, or execution semantics:

1. Update or create the relevant spec first.
2. Validate coherence with upstream and downstream specs.
3. Update indexes and dependency maps.
4. Implement only after the spec relationship is clear.
5. Validate implementation against the spec.
6. Feed implementation lessons back into the spec.

## Retrieval-Oriented Spec Doctrine

Every spec should be written for humans and AI retrieval systems. A valid spec should declare:

- Domain ownership.
- Upstream and downstream dependencies.
- Related protocols.
- Related events.
- Related runtime systems.
- Related governance systems.
- Related observability systems.
- Semantic tags.
- Canonical references.
- Boundary and non-goal notes.

Use `spec/indexes/` to keep retrieval efficient as the number of specs grows.

## Spec Governance Rules

When a new system, agent, runtime, workflow, protocol, memory layer, event type, orchestration pattern, governance rule, or infrastructure abstraction is added or changed:

- Update the relevant spec document.
- Update any affected protocol contracts.
- Update event and state transition descriptions.
- Update dependency and lifecycle notes.
- Update observability and failure semantics.
- Update governance and security implications.
- Update `spec/spec-folder-ecosystem.md` if the folder/domain map changes.

The spec system must not become stale.

## Architecture Review Protocol

Before introducing new primitives, modifying runtime semantics, changing protocols, altering orchestration, or altering memory systems, check:

- Architectural conflict risk.
- Protocol implications.
- Event and replay implications.
- Governance implications.
- Observability implications.
- Security implications.
- Scalability implications.
- Reference-repo lessons.
- Research implications.

Major decisions require an ADR under `spec/architecture-decisions/`.

## Implementation Traceability

Every implementation artifact should trace back to:

- A spec domain.
- A protocol or contract when applicable.
- Runtime semantics.
- Governance requirements.
- Observability requirements.
- Tests or validation evidence.

Code that violates architecture contracts or spec governance is invalid implementation, even if it works locally.

## Research Rules

This project is allowed to evolve beyond the current documents. If state-of-the-art research or implementation evidence suggests a better architecture:

- Propose the improvement clearly.
- Explain why it is stronger.
- Check coherence with the outcome vision.
- Update the relevant architecture docs.
- Avoid blindly following an older sample plan when a better research-backed primitive is available.

Research integration workflow:

1. Research discovery.
2. Research evaluation.
3. Architecture impact analysis.
4. Spec proposal.
5. Spec review.
6. Spec integration.
7. Implementation.
8. Benchmarking.
9. Observability validation.
10. Governance validation.

Preserve important research and rejected designs in `spec/research/`.

## Test, Observability, and Failure Doctrine

Every foundational implementation should include:

- Unit tests for schemas, protocols, lifecycle, and validation.
- Integration tests for orchestration, events, replay, memory, and workflows.
- Governance tests for policy, capability, lease, and access enforcement.
- Replay tests for deterministic reconstruction.
- Failure tests for retries, dead letters, degradation, rollback, and corruption handling.

No orchestration, memory mutation, reasoning flow, workflow transition, governance decision, or runtime decision should exist without observability hooks.

Every implementation must define failure modes, retry semantics, degradation behavior, recovery paths, rollback semantics, and observability behavior during failure.

## Architectural Integrity Rules

Never:

- Hardcode fragile orchestration.
- Bypass protocols for convenience.
- Bypass event sourcing for important state changes.
- Bypass governance for side-effecting actions.
- Bypass observability for cognitive decisions.
- Mutate memory without a typed memory mutation concept.
- Create undocumented state transitions.
- Treat prompts as the whole agent architecture.
- Treat a planning document as final code law.
- Let `spec/architecture/uci-architecture.md` and `spec/architecture/uci-architecture.md` drift into contradictory foundations.

## Implementation Posture

The repository is entering Phase 1A implementation: spec infrastructure, meta-governance, indexes, reference-repo learning, ADRs, and implementation traceability. Do not jump into broad product code, UI, agents, or kernel runtime before the relevant Phase 1B/1C specs exist. Every implementation decision must be derivable from the spec system or must update the spec system with a clear rationale.
