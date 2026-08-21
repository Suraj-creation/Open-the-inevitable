# Dependency Graph

Initial dependency graph:

```text
vision-application
  -> philosophy
  -> architecture
  -> kernel
  -> protocols
  -> events
  -> runtime
  -> memory
  -> world-state
  -> orchestration
  -> observability
  -> governance
  -> implementation-roadmaps
```

Compiler-grade dependencies:

```text
cognitive-ir -> cognitive-isa -> execution -> runtime -> scheduler
```

Epistemic dependencies:

```text
epistemology -> semantic-consistency -> memory -> world-state -> observability
```

Safety dependencies:

```text
cognitive-safety -> governance -> runtime -> events -> replay
```

## Phase 1B Foundational Spec Dependencies

Authored in Phase 1B (see [implementation-roadmaps/phase-1b-kernel-protocols-runtime.md](../implementation-roadmaps/phase-1b-kernel-protocols-runtime.md)).
Acyclic; arrows point from dependent to dependency.

```text
ADR-0003-tech-stack            (governs schema representation in all specs below)

kernel/cognitive-identity      -> philosophy, constitutions
kernel/capability-envelope     -> kernel/cognitive-identity, kernel/governance-kernel
kernel/context-lease           -> kernel/cognitive-identity, kernel/capability-envelope, kernel/governance-kernel
kernel/intent-lease            -> kernel/cognitive-identity, kernel/governance-kernel
kernel/governance-kernel       -> kernel/cognitive-identity, kernel/capability-envelope
kernel/cognitive-scheduler     -> kernel/cognitive-identity, kernel/capability-envelope, kernel/governance-kernel

kernel-internals/cognition-syscalls -> all kernel/* primitives

protocols/cognition-packet-protocol -> kernel/cognitive-identity, kernel/context-lease
protocols/cognitive-event-protocol  -> protocols/cognition-packet-protocol, meta/event-governance
protocols/memory-mutation-protocol  -> protocols/cognitive-event-protocol, kernel/context-lease, kernel/governance-kernel
protocols/reasoning-trace-protocol  -> protocols/cognition-packet-protocol, protocols/cognitive-event-protocol
protocols/cognitive-unit-abi        -> packet, event, reasoning-trace, kernel primitives (defines protocol-versioning)

events/event-taxonomy          -> protocols/cognitive-event-protocol, meta/event-governance
runtime/cognitive-unit-runtime -> all kernel/* + kernel-internals/cognition-syscalls + protocols/cognitive-unit-abi
```

## Phase 2A Surface Spec Dependencies

Authored in Phase 2A (Cognitive Surface Runtime). Acyclic; arrows point from dependent to dependency.

```text
surface/cognitive-surface-runtime      -> product/features/F16, product/features/F09, product/features/F02,
                                          product/product-cognition-runtime, agents/supervisor-agent,
                                          world-state/world-state-graph, events/event-taxonomy,
                                          execution/cognitive-execution-engine, memory/memory-tiers,
                                          kernel/governance-kernel
surface/surface-event-architecture     -> surface/cognitive-surface-runtime, events/event-taxonomy,
                                          protocols/cognitive-event-protocol
surface/surface-timeline-engine        -> surface/cognitive-surface-runtime, product/features/F02,
                                          product/features/F03, product/product-cognition-runtime,
                                          world-state/world-state-graph
surface/multimodal-provider-abstraction -> surface/cognitive-surface-runtime, product/features/F04,
                                          product/features/F16
```

## Phase 2B Model Invocation Dependencies

Authored in Phase 2B (Real Cognition on the Surface). Acyclic; arrows point from dependent to dependency.

```text
protocols/model-invocation-protocol    -> replay/deterministic-replay, protocols/cognitive-event-protocol,
                                          kernel/capability-envelope, kernel/governance-kernel,
                                          events/event-taxonomy
product/product-cognition-runtime §11  -> protocols/model-invocation-protocol, protocols/cognitive-unit-abi
surface/cognitive-surface-runtime §6.1 (expand) -> protocols/model-invocation-protocol,
                                          surface/surface-event-architecture, product/features/F04
surface/multimodal-provider-abstraction §6 (D3) -> protocols/model-invocation-protocol
```

## Phase 2C Visible Surface Dependencies

Authored in Phase 2C (The Visible Surface). Acyclic; arrows point from dependent to dependency.

```text
surface/surface-streaming-sync-protocol -> surface/cognitive-surface-runtime,
                                          surface/surface-event-architecture,
                                          surface/surface-timeline-engine,
                                          product/product-cognition-runtime, events/event-taxonomy,
                                          protocols/cognitive-event-protocol, kernel/governance-kernel,
                                          product/features/F09, product/features/F16, product/features/F07
architecture-decisions/ADR-0006        -> architecture-decisions/ADR-0003, architecture-decisions/ADR-0005,
                                          surface/cognitive-surface-runtime,
                                          surface/surface-streaming-sync-protocol
apps/api (surface gateway)             -> surface/surface-streaming-sync-protocol, packages/surface,
                                          packages/product-cognition, packages/events, packages/governance
apps/web (visible surface)             -> surface/surface-streaming-sync-protocol, packages/surface (./client)
events/event-taxonomy (gateway.*)      -> (new boundary-observability family; not folded into SurfaceState)
```

## Phase 2E Durable Persistence Dependencies

Authored in Phase 2E (Durable Substrate). Acyclic; arrows point from dependent to dependency.

```text
persistence/durable-cognitive-persistence -> events/event-taxonomy, protocols/cognitive-event-protocol,
                                          replay/deterministic-replay, interop/infrastructure-adapters
architecture-decisions/ADR-0008          -> architecture-decisions/ADR-0003, architecture-decisions/ADR-0005,
                                          persistence/durable-cognitive-persistence
packages/adapters (FileEventTransport,   -> @inevitable/contracts (EventTransport), packages/events (matchSubject),
  FileMediaStore)                           persistence/durable-cognitive-persistence
apps/api (durable surface log + resume)  -> packages/adapters (file backend), surface/cognitive-surface-runtime,
                                          persistence/durable-cognitive-persistence
persistence/cognitive-continuity-and-rehydration -> persistence/durable-cognitive-persistence,
                                          world-state/world-state-graph, memory/memory-tiers,
                                          events/event-taxonomy, surface/cognitive-surface-runtime
architecture-decisions/ADR-0009          -> architecture-decisions/ADR-0008,
                                          persistence/cognitive-continuity-and-rehydration
apps/api (live rehydration)              -> persistence/cognitive-continuity-and-rehydration,
                                          packages/events (hydrate), packages/surface (resume), packages/cli (restore)
persistence/durable-learner-identity     -> persistence/cognitive-continuity-and-rehydration,
                                          kernel/cognitive-identity, product/features/F01, product/features/F13
architecture-decisions/ADR-0010          -> architecture-decisions/ADR-0009,
                                          persistence/durable-learner-identity
apps/api (LearnerRegistry + resume-by-learner) -> persistence/durable-learner-identity,
                                          packages/cli (learner-parameterized onboarding), packages/shared (newCid)
```

## Cognitive Source Environment Dependencies (ADR-0032)

Authored 2026-07 (spec-first; implementation begins CSE-P1). Acyclic; arrows point from
dependent to dependency.

```text
architecture-decisions/ADR-0032          -> architecture/uci-architecture (§25.4),
                                          product/features/F15, surface/surface-event-architecture,
                                          architecture-decisions/ADR-0030
source-environment/CSE-001-foundations   -> architecture/uci-architecture,
                                          product/features/F15, product/features/F16,
                                          architecture/Cognitive-Architecture
source-environment/CSE-002-canonical-source-representation -> source-environment/CSE-001,
                                          product/features/F15, world-state/world-state-graph,
                                          memory/memory-tiers, events/event-taxonomy,
                                          protocols/model-invocation-protocol, kernel/* (leases, envelopes),
                                          architecture/Tech-Stack
source-environment/CSE-003-meaning-representation-layer -> source-environment/CSE-002,
                                          world-state/knowledge-graph-engine,
                                          architecture-decisions/ADR-0027
source-environment/CSE-004-transformations -> source-environment/CSE-003, product/features/F04,
                                          surface/multimodal-provider-abstraction
source-environment/CSE-005-episodic-cognition -> source-environment/CSE-002, memory/memory-tiers,
                                          protocols/memory-mutation-protocol, product/features/F05,
                                          product/features/F14, persistence/durable-learner-identity
source-environment/CSE-006-living-knowledge -> source-environment/CSE-002, source-environment/CSE-003,
                                          product/features/F10, architecture-decisions/ADR-0026,
                                          architecture-decisions/ADR-0021
source-environment/CSE-007-source-agent-society -> source-environment/CSE-002, source-environment/CSE-003,
                                          source-environment/CSE-005, product/features/F06,
                                          product/features/F07, architecture-decisions/ADR-0018,
                                          architecture-decisions/ADR-0025
source-environment/CSE-008-source-surface-projection -> source-environment/CSE-002,
                                          source-environment/CSE-007, surface/cognitive-surface-runtime,
                                          surface/surface-event-architecture, surface/inline-multimodal-artifacts,
                                          architecture-decisions/ADR-0030, architecture-decisions/ADR-0024,
                                          architecture-decisions/ADR-0007, design/cognitive-design-language-v1
source-environment/CSE-009-experience-catalog -> source-environment/CSE-004..CSE-008,
                                          product/features/F09, design/cognitive-design-language-v1
source-environment/CSE-010-delivery      -> source-environment/CSE-001..CSE-009, implementation-roadmaps
```

## Cognitive Theater + Backend Dependencies (ADR-0033, ADR-0034)

Authored 2026-07 (spec-first). Acyclic; arrows point from dependent to dependency.

```text
architecture-decisions/ADR-0033          -> architecture-decisions/ADR-0030, ADR-0024, ADR-0007,
                                          ADR-0025, ADR-0021, ADR-0027, source-environment/CSE-005/007/008,
                                          design/cognitive-design-language-v1
source-environment/CSE-011-cognitive-director -> source-environment/CSE-005, CSE-007, CSE-008,
                                          architecture-decisions/ADR-0033, ADR-0025, ADR-0026, ADR-0027,
                                          ADR-0021, kernel/intent-lease, product/features/F07, F14
source-environment/CSE-012-cognitive-scene -> source-environment/CSE-008, CSE-011,
                                          surface/cognitive-surface-runtime, surface/surface-event-architecture,
                                          surface/inline-multimodal-artifacts, architecture-decisions/ADR-0030,
                                          ADR-0033, ADR-0007, design/cognitive-design-language-v1
source-environment/CSE-013-knowledge-cinematography -> source-environment/CSE-008, CSE-011, CSE-012,
                                          architecture-decisions/ADR-0007, ADR-0033,
                                          design/cognitive-design-language-v1, -v2, -v3
source-environment/CSE-014-cognitive-interaction-grammar -> source-environment/CSE-008, CSE-011, CSE-012,
                                          architecture-decisions/ADR-0024, ADR-0033,
                                          surface/surface-streaming-sync-protocol, kernel/governance-kernel
source-environment/CSE-015-source-fusion -> source-environment/CSE-002, CSE-003, CSE-006, CSE-008,
                                          world-state/knowledge-graph-engine, product/features/F08,
                                          architecture-decisions/ADR-0027
source-environment/CSE-016-creative-cognition -> source-environment/CSE-005, CSE-006, CSE-009, CSE-012,
                                          CSE-014, product/features/F10, F14, architecture-decisions/ADR-0026
design/cognitive-design-language-v3      -> design/cognitive-design-language-v1, -v2,
                                          architecture-decisions/ADR-0033, source-environment/CSE-011..CSE-014
architecture-decisions/ADR-0034          -> architecture-decisions/ADR-0003, ADR-0005, ADR-0008, ADR-0009,
                                          ADR-0010, source-environment/CSE-002, architecture/Tech-Stack,
                                          packages/contracts
packages/adapters (supabase.ts)          -> @inevitable/contracts, packages/adapters (conformance),
                                          architecture-decisions/ADR-0034 (guarded dynamic import; not a workspace dep)
implementation-roadmaps/cse-cognitive-theater-and-backend -> source-environment/CSE-001..CSE-016,
                                          architecture-decisions/ADR-0032, ADR-0033, ADR-0034
```

## Cognitive Intelligence Persistence Dependencies (ADR-0035)

Authored 2026-07 (spec-first; implemented as M3.5, between M3 and M4). Acyclic.

```text
architecture-decisions/ADR-0035          -> architecture-decisions/ADR-0008, ADR-0009, ADR-0015,
                                          ADR-0017, ADR-0021, ADR-0027, ADR-0029, ADR-0034,
                                          source-environment/CSE-005, memory/memory-tiers,
                                          world-state/world-state-graph
intelligence/CIP-001-cognitive-intelligence-substrate -> architecture-decisions/ADR-0035,
                                          events/event-taxonomy, protocols/memory-mutation-protocol,
                                          protocols/reasoning-trace-protocol, world-state/world-state-graph,
                                          memory/memory-tiers, source-environment/CSE-005
intelligence/CIP-002-audit-and-distiller-registry -> intelligence/CIP-001,
                                          architecture-decisions/ADR-0034,
                                          implementation-roadmaps/cse-implementation-blueprint
```


