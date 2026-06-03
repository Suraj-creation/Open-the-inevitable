# The Inevitable - Codex Project Instructions

The Inevitable is a spec-driven cognitive operating system architecture effort. Treat the repository as a living architecture foundation for autonomous cognitive infrastructure, not as a normal application codebase.

## Read These First

Before any architecture, implementation, refactor, agent, runtime, memory, orchestration, protocol, observability, governance, infrastructure, or testing work, read the relevant portions of:

1. `spec/advanced-agent-architecture.md`
2. `spec/next-generation-cognitive-operating-system-blueprint.md`
3. `spec/vision-application/Vision.md`
4. `spec/vision-application/The_Inevitable_Master_Vision.md`
5. `spec/vision-application/The_Inevitable_Vision_Comprehensive.md`
6. `spec/vision-application/Universal-Learning-Intelligence-Agent.md`
7. `spec/agents-orchestration-deep-dive.md`
8. `spec/vision-application/PLAN.md`
9. `spec/vision-application/referenceRepos.md`
10. `spec/spec-folder-ecosystem.md`

The two primary architecture files are complementary:

- `spec/advanced-agent-architecture.md`
- `spec/next-generation-cognitive-operating-system-blueprint.md`

Do not interpret them as conflicting. If one file contains a primitive missing from the other, synthesize them. If a better research-backed abstraction emerges, update the specs rather than blindly following an older reference. The architecture is living, not fixed.

## Product & Feature References — Read Before Product/Feature Work

For any **product**, **feature**, **learning-experience**, **pedagogy**, **agent-behaviour**, **memory-policy**, **orchestration-flow**, **UX**, or **mode/persona** work — anything touching *what the platform does for humans interacting with knowledge* — read these BEFORE writing or modifying code, in this exact order:

1. `spec/product/Broader-feature-product.md` — **the canonical product specification (master PRD)**. Product thesis, twelve capability pillars, agent ecosystem, memory architecture, real-time orchestration, modes/personas, success metrics, and the authoritative **Product → Architecture mapping** onto the Cognitive Operating System.
2. `spec/product/README.md` — product domain entry point, read-first guidance, feature index.
3. The relevant **feature spec(s)** under `spec/product/features/F01`…`F16` (see [Feature Spec Catalog](#feature-spec-catalog) below). At minimum the feature(s) directly affected by the change and any feature(s) listed as upstream/downstream in their frontmatter.
4. `spec/product/features/README.md` — shared feature-spec template, status lifecycle, and authoring conventions, when adding or modifying a feature spec.
5. The owning **architecture specs** for COS primitives the feature touches (`spec/kernel/`, `spec/protocols/`, `spec/events/`, `spec/runtime/`, `spec/memory/`, `spec/world-state/`, `spec/orchestration/`, `spec/curriculum/`, `spec/pedagogy/`).
6. `spec/vision-application/` when intent or philosophy is ambiguous — the upstream source of truth.

Product law is **subordinate to architecture law**. Where a product requirement and an architecture invariant (the ten non-negotiable laws, blueprint §25.4) appear to conflict, the architecture invariant wins, and the requirement must be expressed *through* the invariant — events, leases, memory mutations, governed capabilities — never around it. See `spec/product/Broader-feature-product.md` §14.

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

**When a new feature spec is added** (or an existing one renamed/split/retired), update this table, the table in `CLAUDE.md`, the catalog in `spec/product/Broader-feature-product.md` §15, the index in `spec/product/README.md`, and the retrieval index `spec/indexes/product-feature-index.md`. Do not let the product spec system drift.

## Reference Repository Learning Doctrine

Before inventing implementation patterns, inspect the local reference repositories when relevant:

- `MiroFish/` for staged graph, profile, simulation, and report pipelines.
- `hermes-agent/` for persistent agent loops, memory, tools, gateways, scheduling, and multi-surface runtime.
- `OpenMAIC/` for classroom generation, live orchestration, scene runtime, streaming, and multimodal education flows.
- `paperclip/` for AI-native control plane, governance, issues, heartbeats, budgets, and execution semantics.
- `pi/` for modular coding-agent runtime primitives, providers, skills, extensions, events, and session persistence.
- `spec/vision-application/` as the internal reference corpus for outcome vision, philosophy, and constraints.

If a sixth external reference repo is restored or added, update `spec/vision-application/referenceRepos.md`, `spec/reference-repos/README.md`, and this file. Do not fabricate missing reference-repo details.

## Core Design Philosophy

The target is a Cognitive Operating System:

- Protocol-first.
- Event-driven.
- Memory-persistent.
- Temporal and replayable.
- Observable at the reasoning level.
- Governed at the kernel level.
- Modular and hot-swappable.
- Multi-agent and distributed.
- Self-improving through controlled evolution.

Agents are cognitive runtime containers. Prompts are only one artifact inside an agent.

## Mandatory Engineering Rules

Before changing implementation or docs:

1. Determine which spec domains are affected.
2. Identify required protocols, events, state transitions, and memory mutations.
3. Preserve capability boundaries and context leases.
4. Preserve governance and auditability.
5. Preserve observability and replayability.
6. Prefer protocol-mediated communication over direct coupling.
7. Update specs when architecture changes.
8. Verify the changed artifact before claiming completion.

## Spec-First Execution Doctrine

Implementation is subordinate to the spec system. Specs are not passive documentation; they are executable architectural law.

If implementation changes architecture, runtime semantics, memory behavior, protocol behavior, orchestration flow, governance semantics, observability semantics, event contracts, or execution semantics:

1. Update or create the relevant spec first.
2. Validate coherence with related specs.
3. Update indexes and dependency maps.
4. Implement only after the spec relationship is clear.
5. Validate implementation against the spec.
6. Feed implementation lessons back into the spec.

## Retrieval-Oriented Spec Doctrine

Every spec must be retrievable by humans and AI agents. A mature spec declares:

- Domain ownership.
- Upstream and downstream dependencies.
- Related protocols.
- Related events.
- Related runtime systems.
- Related governance systems.
- Related observability systems.
- Semantic tags.
- Canonical references.
- Boundaries and non-goals.

Use `spec/indexes/` as the retrieval and navigation layer.

## Spec Governance

Whenever new architecture is added or modified, update the relevant specs:

- Philosophy and intent.
- Runtime flow.
- Protocol contracts.
- Event flow.
- Memory and world-state mutations.
- Orchestration behavior.
- Observability.
- Governance.
- Security.
- Failure semantics.
- Scalability.
- Future evolution.

The spec folder is the single source of truth for future implementation. Do not let it drift.

## Architecture Review and Traceability

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

Every implementation artifact should trace to a spec domain, protocol or contract when applicable, runtime semantics, governance requirements, observability requirements, and validation evidence.

Major architectural decisions require ADRs under `spec/architecture-decisions/`.

## Architectural Integrity Rules

Never:

- Create direct agent-to-agent calls without protocol and event visibility.
- Create hidden state mutation.
- Write memory without a documented memory mutation model.
- Skip governance for side-effecting operations.
- Skip observability for cognitive decisions.
- Treat model calls as the architecture.
- Treat a temporary sample plan as final implementation law.
- Let architecture files disagree silently.

## Research and Evolution

The repository is transitioning from completed Phase 1D substrate implementation into Phase 1E
product-cognition implementation. The current docs are deep references based on the outcome vision,
and the F01-F16 feature-spec suite is now the product topology for implementation (F16 — The
Cognitive Surface — adds the convergent multimodal-substrate spec, backed by the deep-research
dossier in `spec/research/cognitive-surface-frontier-research.md`).
`@inevitable/product-cognition` has the first deterministic bridge for onboarding, learning paths,
MVP agent manifests, scheduler-admitted runtime dispatch, deterministic MVP unit execution, and
the no-LLM explanation/practice loop with mastery checkpoints. If deeper research or implementation
evidence suggests a stronger design, improve the design and update the relevant architecture
documents coherently.

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

Every foundational implementation should include unit, integration, governance, replay, and failure tests.

No orchestration, memory mutation, reasoning flow, workflow transition, governance decision, or runtime decision should exist without observability hooks.

Every implementation must define failure modes, retry semantics, degradation behavior, recovery paths, rollback semantics, and observability behavior during failure.
