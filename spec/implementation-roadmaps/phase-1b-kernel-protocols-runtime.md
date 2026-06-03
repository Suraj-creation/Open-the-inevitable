# Phase 1B - Kernel, Protocols, Events & Runtime Specs Roadmap

## Goal

Specify the foundational cognitive kernel primitives, core protocols, the event taxonomy, and the
cognitive-unit runtime — the contracts every future cognitive unit, service, and package depends on.
This phase is spec-only; it gates Phase 1C package code per the spec-first doctrine
([ADR-0001](../architecture-decisions/ADR-0001-spec-first-cos-foundation.md)).

## Scope

- Tech-stack decision: TypeScript-first kernel/runtime/control-plane, JSON Schema as the canonical
  contract form ([ADR-0003](../architecture-decisions/ADR-0003-tech-stack.md)).
- Kernel primitives, kernel-internals syscalls, core protocols, event taxonomy, runtime.
- Index, governance, and dependency-map updates.

## Completed in This Pass (2026-06-02)

**ADR**
- [ADR-0003 — Foundational Technology Stack](../architecture-decisions/ADR-0003-tech-stack.md)

**Kernel primitives** — [`spec/kernel/`](../kernel/)
- [cognitive-identity.md](../kernel/cognitive-identity.md)
- [capability-envelope.md](../kernel/capability-envelope.md)
- [context-lease.md](../kernel/context-lease.md)
- [intent-lease.md](../kernel/intent-lease.md)
- [governance-kernel.md](../kernel/governance-kernel.md)
- [cognitive-scheduler.md](../kernel/cognitive-scheduler.md)

**Kernel internals** — [`spec/kernel-internals/`](../kernel-internals/)
- [cognition-syscalls.md](../kernel-internals/cognition-syscalls.md)

**Core protocols** — [`spec/protocols/`](../protocols/)
- [cognition-packet-protocol.md](../protocols/cognition-packet-protocol.md)
- [cognitive-event-protocol.md](../protocols/cognitive-event-protocol.md)
- [memory-mutation-protocol.md](../protocols/memory-mutation-protocol.md)
- [reasoning-trace-protocol.md](../protocols/reasoning-trace-protocol.md)
- [cognitive-unit-abi.md](../protocols/cognitive-unit-abi.md) (includes protocol-versioning rules)

**Events** — [`spec/events/`](../events/)
- [event-taxonomy.md](../events/event-taxonomy.md)

**Runtime** — [`spec/runtime/`](../runtime/)
- [cognitive-unit-runtime.md](../runtime/cognitive-unit-runtime.md)

**Index / governance updates**
- protocol-index, event-index, runtime-index, capability-index, governance-index, dependency-graph.

## Architecture Laws Anchored Here

The 10 non-negotiable laws (blueprint §25.4) now have owning specs:
no agent runtime without manifest + identity + capability envelope (runtime, identity, capability);
no context access without a Context Lease (context-lease); no long-running workflow without an Intent
Lease (intent-lease); no memory write without a Memory Mutation (memory-mutation-protocol); no
side-effecting tool call without a governance decision (governance-kernel, cognition-syscalls);
events carry causality and versioning (cognitive-event-protocol, event-taxonomy); no production unit
without an observability contract (cognitive-unit-abi, reasoning-trace-protocol).

## Next Steps (Phase 1C — Package Contracts)

Begin only after the Phase 1B specs above are reviewed/approved:

1. Schema registry + codegen: author the canonical JSON Schemas in `packages/protocols`, generate TS
   types, add a conformance/contract test harness.
2. `packages/kernel`: identity, capability, lease, governance, scheduler contract interfaces.
3. `packages/events`: event envelope + family registry + bus adapter contract.
4. `packages/runtime`: cognitive-unit ABI interface + lifecycle FSM skeleton.
5. Wire observability contracts (OpenTelemetry trace envelope) before any executable unit.

## Deferred to Phase 1D–1E

World-State Delta / Tool / Model / Evolution-Proposal / Workflow-State protocols; memory taxonomy and
consolidation; unified world-state graph + temporal cognition; orchestration cells + directors;
cognitive threading/fibers; deterministic execution engine; runtime virtualization/hypervisor.
