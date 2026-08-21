# The Inevitable Spec System

This folder is the canonical architecture and implementation source of truth for The Inevitable.

The project is transitioning from completed Phase 1D substrate deepening into Phase 1E product
cognition implementation. Phases 1A-1D are complete, and the product feature topology F01-F16 is now
authored under `spec/product/features/`. Implementation must remain subordinate to the spec system.
If a code change alters architecture, protocols, runtime semantics, memory, governance,
observability, events, or execution behavior, update the relevant spec first.

## Primary Reading Order

1. `architecture/uci-architecture.md`
2. `architecture/uci-architecture.md`
3. `spec/product/Broader-feature-product.md` — **canonical product specification** (read before any product/feature/agent/pedagogy/memory/orchestration work; see also `spec/product/README.md`)
4. `spec/spec-folder-ecosystem.md`
5. `spec/meta/spec-governance.md`
6. `spec/meta/spec-writing-standard.md`
7. `spec/indexes/domain-index.md`
8. `spec/vision-application/PLAN.md`
9. `spec/vision-application/referenceRepos.md`

## Current Phase

Phase 1A established:

- Spec folder ecosystem.
- Meta-spec governance.
- Retrieval-oriented indexes.
- Reference-repo learning layer.
- ADR process.
- Implementation traceability doctrine.
- Initial implementation skeleton and ownership boundaries.

Phase 1B authored the foundational kernel primitives, core protocols, event taxonomy, and
cognitive-unit runtime specs (see
[implementation-roadmaps/phase-1b-kernel-protocols-runtime.md](implementation-roadmaps/phase-1b-kernel-protocols-runtime.md)).

Phase 1C implemented the foundational packages under `packages/` (monorepo: pnpm + Turborepo +
strict TypeScript; ADR-0004), each derived from its governing spec with JSON Schema as the canonical
contract form (ADR-0003). See
[implementation-roadmaps/phase-1c-package-contracts.md](implementation-roadmaps/phase-1c-package-contracts.md).
Code that diverges from a spec is invalid implementation; update the spec first, then implement.

Phase 1D delivered the executable substrate: deterministic execution/fibers, world-state graph,
tiered memory, scheduler depth, infrastructure adapters, and the OTel edge. See
[implementation-roadmaps/phase-1d-substrate.md](implementation-roadmaps/phase-1d-substrate.md).

Phase 1E now begins from the completed product feature-spec suite: F01 onboarding, F02 navigation,
F03 prerequisite intelligence, F04 adaptive explanation, F05 memory, F06 agents, F07 orchestration,
F08 interdisciplinary graph, F09 living-universe experience, F10 research/innovation, F11
institutional intelligence, F12 evolution, F13 identity/modes, F14 mastery, and F15 ingestion.
