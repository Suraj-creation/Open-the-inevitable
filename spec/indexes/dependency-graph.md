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


