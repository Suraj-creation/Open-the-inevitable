# Protocol Index

Protocol families:

- Cognitive Unit ABI.
- Cognition Packet Protocol.
- Cognitive Event Protocol.
- Memory Mutation Protocol.
- World-State Delta Protocol.
- Context Lease Protocol.
- Intent Lease Protocol.
- Capability Envelope Protocol.
- Reasoning Trace Protocol.
- Tool Invocation Protocol.
- Model Invocation Protocol.
- Governance Decision Protocol.
- Evolution Proposal Protocol.
- Workflow State Protocol.
- Source Canonicalization Contract (layer artifacts, source versions).
- Source Anchor Resolution (pure-function anchor → region resolution and cross-version migration).

Every protocol must be versioned and contract-tested.

## Canonical Specs

Phase 1B authored the core protocol specs (canonical form = JSON Schema, per
[ADR-0003](../architecture-decisions/ADR-0003-tech-stack.md)):

- Cognition Packet Protocol → [protocols/cognition-packet-protocol.md](../protocols/cognition-packet-protocol.md)
- Cognitive Event Protocol → [protocols/cognitive-event-protocol.md](../protocols/cognitive-event-protocol.md)
- Memory Mutation Protocol → [protocols/memory-mutation-protocol.md](../protocols/memory-mutation-protocol.md)
- Reasoning Trace Protocol → [protocols/reasoning-trace-protocol.md](../protocols/reasoning-trace-protocol.md)
- Cognitive Unit ABI (+ protocol-versioning rules) → [protocols/cognitive-unit-abi.md](../protocols/cognitive-unit-abi.md)
- Capability Envelope → [kernel/capability-envelope.md](../kernel/capability-envelope.md)
- Context Lease → [kernel/context-lease.md](../kernel/context-lease.md)
- Intent Lease → [kernel/intent-lease.md](../kernel/intent-lease.md)
- Governance Decision → [kernel/governance-kernel.md](../kernel/governance-kernel.md)
- Model Invocation Protocol (Phase 2B — D3 recording) → [protocols/model-invocation-protocol.md](../protocols/model-invocation-protocol.md)

Pending: World-State Delta, Tool Invocation, Evolution Proposal, Workflow State.

Source-environment contracts (semantics authored in
[source-environment/CSE-002](../source-environment/CSE-002-canonical-source-representation.md);
JSON Schemas are an implementation-phase artifact per ADR-0032): Source Canonicalization
Contract, Source Anchor Resolution.

