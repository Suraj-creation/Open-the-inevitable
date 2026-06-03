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

