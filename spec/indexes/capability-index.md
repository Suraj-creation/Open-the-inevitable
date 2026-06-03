# Capability Index

Capability categories:

- Agent capabilities.
- Tool capabilities.
- Model capabilities.
- Memory capabilities.
- Reasoning capabilities.
- Workflow capabilities.
- Governance capabilities.
- Observability capabilities.

Capability specs must define ownership, required protocols, security classification, resource cost, observability requirements, and failure behavior.

## Canonical Specs

- Capability Envelope (policy-granted bounds) → [kernel/capability-envelope.md](../kernel/capability-envelope.md)
- Context Lease (bounded memory/state access) → [kernel/context-lease.md](../kernel/context-lease.md)
- Intent Lease (bounded goal commitment) → [kernel/intent-lease.md](../kernel/intent-lease.md)
- Capability declaration via the Unit ABI `describe()` → [protocols/cognitive-unit-abi.md](../protocols/cognitive-unit-abi.md)
- Enforcement at the syscall boundary → [kernel-internals/cognition-syscalls.md](../kernel-internals/cognition-syscalls.md)

