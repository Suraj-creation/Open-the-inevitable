# The Inevitable — Repository Constitution

This file is the **constitution** of this repository: identity, mission, architectural law,
working doctrine, and retrieval entry points. It is auto-loaded into every agent session, so
every line here costs context in every conversation. It is governed by §7 — read §7 before
editing this file. It is **not** a status document, changelog, or implementation inventory.

## 1. Identity and Mission

The Inevitable is not a normal AI app. It is a long-term, spec-driven effort to build a
**Cognitive Operating System (COS)** for education and human understanding — distributed
cognition, persistent memory, multi-agent orchestration, governed self-evolution, and
continuously improving intelligence infrastructure.

What it is ultimately becoming:

- A **Universal Learning Intelligence**: an intelligence that can take any human, from any
  starting point, to genuine verified mastery of anything — by recursively resolving
  prerequisites, adapting explanation to the learner's cognitive state, and verifying depth.
  Not a chatbot that answers questions; an intelligence that grows minds.
- A **Cognitive Surface**: the central product manifestation — a living, adaptive, multimodal
  medium (the cognitive whiteboard first; living document, simulation stage, knowledge-graph
  explorer, authoring canvas as projections of the same substrate) where cognition itself
  becomes visible: agents work, knowledge appears, explanations evolve, memory forms, and
  understanding grows in real time. **The UI is a projection; the runtime is the product.**
- An **education and intelligence-transformation mission**: persistent cognitive memory of each
  learner, a living universe of interconnected knowledge, collective and institutional
  intelligence, and a system that improves its own pedagogy through governed evolution.

Evaluate every decision against one question: does it move the system toward a governed,
replayable, evolving cognitive operating system that transforms how humans learn — or does it
merely ship a feature?

## 2. Architectural Laws

These principles are sacred. The ten non-negotiable invariants live in
`spec/architecture/uci-architecture.md` §25.4; this is their working form:

- Intelligence is modular, composable, observable, governable, persistent, replayable, and evolvable.
- Agents are cognitive runtime containers, not prompts.
- Every major interaction flows through protocol-governed events or contracts.
- Memory, orchestration, workflows, agents, and runtime state are projections of a unified
  world-state architecture.
- Cognition unfolds across time: event sourcing, replay, causal tracing, and temporal state are
  core primitives.
- Governance is a kernel primitive, not an external moderation layer.
- Observability tracks reasoning quality, memory influence, drift, disagreement, confidence,
  and learning outcomes.
- Self-evolution happens only through governed proposals, evaluation, replay, shadow tests,
  and rollback.
- The COS is a substrate, not a product. Every surface, app, agent runtime, API, and integration
  is a manifestation of it; dependencies point inward — manifestations depend on the substrate, the
  substrate on its contracts, contracts on nothing — and no vendor, model, transport, or store leaks
  past its adapter.

**Never:** bypass protocols, event sourcing, governance, or observability for convenience;
mutate memory without a typed memory mutation; create undocumented state transitions; hardcode
fragile orchestration; treat prompts as the agent architecture; treat a planning document as
final code law; let the two foundational architecture documents drift into contradiction; reverse
the dependency direction so the substrate depends on a manifestation, a vendor, or an adapter's
internals.

Code that violates these laws is invalid implementation even if it works locally.

## 3. Canonical Reference Map

CLAUDE.md holds pointers, never copies. When a domain below changes, update the owning files —
not this map (unless a path moves).

**Vision and purpose** — upstream source of truth whenever intent or philosophy is ambiguous:

- `spec/vision-application/` — the core vision corpus: `Vision.md`,
  `The_Inevitable_Master_Vision.md`, `The_Inevitable_Vision_Comprehensive.md`,
  `Universal-Learning-Intelligence-Agent.md`, `PLAN.md`, `referenceRepos.md`.

**Architecture law** — read before architecture, runtime, protocol, memory, orchestration,
agent, or infrastructure work:

- `spec/architecture/uci-architecture.md` and
  `spec/architecture/uci-architecture.md` — complementary foundations,
  never conflicting; treat differences as additive context.
- `spec/reference-repos/multi-agent-framework-analysis.md` — orchestration depth.
- `spec/spec-folder-ecosystem.md` — the spec domain map.
- Owning domain specs: `spec/kernel/`, `spec/protocols/`, `spec/events/`, `spec/runtime/`,
  `spec/memory/`, `spec/world-state/`, `spec/execution/`, `spec/orchestration/`, `spec/scheduler/`.
- `spec/architecture/` — two companion docs: `Tech-Stack.md` (how the COS *runs* — technology doctrine,
  the eight-contract adapter seam, per-domain *why/where*) and `Cognitive-Architecture.md` (how it
  *thinks/learns/researches/improves* — the five emergent cognitive layers; ADR-0023).

**Product law** (subordinate to architecture law) — read before any product, feature, pedagogy,
agent-behaviour, memory-policy, UX, or mode/persona work, in this order:

1. `spec/product/Broader-feature-product.md` — the master PRD: product thesis, twelve capability
   pillars, agent ecosystem, modes/personas, North Star, and the authoritative Product →
   Architecture mapping (§14).
2. `spec/product/README.md` — product domain entry point and feature index.
3. The affected feature spec(s) under `spec/product/features/F01`–`F16`, plus their declared
   upstream/downstream features. Catalog: `spec/indexes/product-feature-index.md`.
4. `spec/product/features/README.md` — feature-spec template and lifecycle, when authoring specs.

Where a product requirement and an architecture invariant conflict, the invariant wins; express
the requirement *through* the invariant (events, leases, memory mutations, governed
capabilities), never around it.

**The Cognitive Surface** — the central product idea; read before any surface, whiteboard,
timeline, multimodal, or rendering work:

- `spec/cognitive_surface/` — the research corpus behind the cognitive whiteboard: what the
  surface *is*, why it is the product's heart, and the decision-grade research it rests on.
  Start with `cognitive-whiteboard-system.md` and `cognitive_surface_dossier.md`.
- `spec/surface/` — the implemented runtime specs (SRF-001…SRF-005: surface runtime, event
  architecture, timeline engine, multimodal provider abstraction, streaming/sync protocol).
- `spec/product/features/F16-cognitive-surface.md` (substrate) and `F09` (experience);
  `spec/research/cognitive-surface-frontier-research.md` (frontier dossier).

**Design law** — read before any UI, visual, motion, or interface work on any manifestation:

- `spec/design/cognitive-design-language-v1.md` — the Cognitive Design Language (CDL), the
  permanent design system; audit + rationale in `spec/design/proposals/`.

**Implementation status** — never duplicated in this file:

- `IMPLEMENTATION.md` — current state, traceability map, active frontier, verification.
- `CHANGELOG.md` — abstract milestone history.
- `docs/history/implementation-log.md` — detailed dated build narratives.
- `spec/implementation-roadmaps/` — phase plans.

**Retrieval** — `spec/indexes/` is the entry point for finding specs, events, protocols,
capabilities, dependencies, and features as the spec system grows.

**Reference repositories** — mine before inventing: `MiroFish/`, `hermes-agent/`, `OpenMAIC/`,
`paperclip/`, `pi/`, plus this repo's own `spec/vision-application/` corpus. Per-repo guidance
lives in `spec/vision-application/referenceRepos.md` and `spec/reference-repos/`.

## 4. Working Doctrine

**Spec-first.** Implementation is subordinate to the spec system; specs are executable
architectural law, not passive documentation. When a change touches architecture, runtime
semantics, memory behavior, protocols, orchestration, governance, observability, events, or
execution semantics: update or create the owning spec first, validate coherence
upstream/downstream, update `spec/indexes/` and dependency maps, then implement, then validate
the implementation against the spec and feed lessons back into it. Specs declare ownership,
dependencies, related protocols/events/runtime/governance/observability systems, semantic tags,
and non-goals.

**Before implementing,** read the owning specs, identify the cognitive primitives involved,
check whether the change affects events, memory mutations, world-state, policies, workflows,
manifests, or protocols, and preserve modularity, observability, governance, replayability, and
protocol boundaries. Major decisions require an ADR under `spec/architecture-decisions/`.

**Traceability.** Every implementation artifact traces to a spec domain, a protocol or contract
where applicable, runtime semantics, governance requirements, observability requirements, and
tests or validation evidence.

**Testing and failure.** Foundational work ships with unit, integration, governance, replay,
and failure tests. Nothing cognitive exists without observability hooks. Every implementation
defines failure modes, retries, degradation, recovery, rollback, and observability under failure.

**Research evolution.** The project may evolve beyond current documents. When research or
implementation evidence reveals a stronger primitive: propose it, check coherence with the
outcome vision, update the specs, then implement. Preserve important research and rejected
designs in `spec/research/`.

## 5. Orientation

CLAUDE.md is timeless and carries no status. Current state, active frontier, traceability, and run
commands live in `IMPLEMENTATION.md`; abstract milestone history in `CHANGELOG.md`; dated build
narratives in `docs/history/implementation-log.md`.

## 6. Build and Verify

```bash
pnpm install && pnpm verify   # codegen + typecheck + test + lint + format:check — must stay green
```

Monorepo: pnpm + Turborepo, strict TypeScript ESM, Vitest. Details: `IMPLEMENTATION.md`
(Developer Quickstart) and ADR-0004. If turbo cannot find pnpm on Windows: `npm i -g pnpm@9.15.0`.

## 7. Constitution Governance

This section exists to make drift difficult. Future agents must obey it when editing this file.

**May be added to CLAUDE.md:** changes to identity/mission framing, architectural laws, working
doctrine, governance rules, and retrieval *pointers* (a new spec domain's entry point, a moved
path). That is the complete list.

**Must never be added:** changelog entries, milestone summaries, phase completion details,
implementation inventories, package catalogs, component or class descriptions, code
identifiers, test counts, feature completion lists, roadmap history, dated narratives. If it
describes *what was built* rather than *how to think and where to look*, it does not belong here.

**Where updates go instead:**

| Information | Home |
|---|---|
| What shipped (abstract, milestone-level) | `CHANGELOG.md` |
| Current codebase state, traceability, active frontier | `IMPLEMENTATION.md` (replace, don't append) |
| Detailed dated build narratives | `docs/history/implementation-log.md` (append) |
| Phase plans and roadmaps | `spec/implementation-roadmaps/` |
| Architecture/runtime/product semantics | The owning spec under `spec/` |
| Feature catalog | `spec/indexes/product-feature-index.md` |

**Size law:** this file stays under ~200 lines. If an edit would push past the cap, compress or
relocate — never append. When a milestone lands, CLAUDE.md is **not** touched — update
`IMPLEMENTATION.md` and the other homes in the table above.
