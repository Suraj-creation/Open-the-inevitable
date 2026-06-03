# Governance Index

Governance domains:

- `governance/`
- `human-governance/`
- `security/`
- `cognitive-safety/`
- `meta/`

Governance enforcement points:

- Event publication.
- Context access.
- Memory mutation.
- Tool invocation.
- Agent spawning.
- Workflow execution.
- Evolution proposal.
- Cross-region replication.

## Canonical Specs

- Governance Kernel (policy types, decision record, adaptive trust, bus interceptor) → [kernel/governance-kernel.md](../kernel/governance-kernel.md)
- Enforcement points realized as syscalls → [kernel-internals/cognition-syscalls.md](../kernel-internals/cognition-syscalls.md)
- Capability authorization → [kernel/capability-envelope.md](../kernel/capability-envelope.md)
- Memory write governance → [protocols/memory-mutation-protocol.md](../protocols/memory-mutation-protocol.md)
- Event classification + retention → [events/event-taxonomy.md](../events/event-taxonomy.md)

Each enforcement point produces an auditable Governance Decision (see governance-kernel spec).

