```yaml
spec:
  title: Cognitive Unit ABI
  domain: protocols
  status: draft
  owner: protocols-team
  last_reviewed: 2026-06-02
  upstream_dependencies:
    - kernel/cognitive-identity
    - kernel/capability-envelope
    - kernel/context-lease
    - protocols/cognition-packet-protocol
    - protocols/cognitive-event-protocol
    - protocols/reasoning-trace-protocol
  downstream_dependencies:
    - runtime/cognitive-unit-runtime
    - agents/agent-manifest
    - interop/capability-negotiation
    - evolution/evolution-proposals
  related_protocols:
    - cognition-packet-protocol
    - cognitive-event-protocol
    - reasoning-trace-protocol
    - memory-mutation-protocol
  related_events:
    - agent.registered
    - agent.ready
    - agent.executing
    - agent.completed
    - agent.failed
  related_runtime_systems:
    - cognitive-unit-runtime
    - protocol-registry
  related_governance_systems:
    - governance-kernel
    - capability-envelope
  related_observability_systems:
    - cognitive-observability
  semantic_tags: [abi, cognitive-unit, plug-in, lifecycle, contract, versioning, interoperability]
  canonical_references:
    - ../architecture/uci-architecture.md#21-cognitive-unit
    - ../architecture/uci-architecture.md#22-cognitive-unit-abi
    - ../architecture/uci-architecture.md
```

# Cognitive Unit ABI

## Purpose

Define the Cognitive Unit ABI (Application Binary Interface for intelligence): the contract every
cognitive unit implements so it can plug into the COS without hand-wiring. A cognitive unit is the
**smallest schedulable intelligence process** — an agent pod, a reasoning thread, a planner step, a
memory consolidation job, a retrieval reranker, a governance evaluator, a synthetic learner, etc. This
spec also defines the **protocol-versioning rules** that govern this ABI and all other protocols.

## Philosophy

"Agents are runtime containers, not prompts." If every unit implements a uniform ABI, the kernel can
schedule, observe, checkpoint, replay, govern, and evolve any unit — written in any language — without
bespoke integration. The ABI is the contract that makes intelligence **modular, composable, and
hot-swappable**, and it is the foundation for [federation](../interop/capability-negotiation.md) of
external runtimes.

## Architecture

The [runtime](../runtime/cognitive-unit-runtime.md) drives every unit through the ABI lifecycle hooks.
Units are described by an [agent manifest](../agents/agent-manifest.md), bound to a
[capability envelope](../kernel/capability-envelope.md), and registered in the protocol/capability
registry. The ABI methods map onto the kernel's [syscalls](../kernel-internals/cognition-syscalls.md):
`execute()` emits [packets](cognition-packet-protocol.md), [events](cognitive-event-protocol.md),
[reasoning traces](reasoning-trace-protocol.md), and proposes
[memory mutations](memory-mutation-protocol.md).

## Primitives — The ABI Surface

| Method | Contract |
|---|---|
| `describe()` | Returns identity, capabilities, version, ABI version, input/output packet schemas, policy needs, memory-scope needs, observability contract. |
| `prepare(context_lease)` | Receives a bounded [context lease](../kernel/context-lease.md); hydrates working context within budget. |
| `execute(packet) → emissions` | Processes an input [packet](cognition-packet-protocol.md); emits output packets, events, and a [reasoning trace](reasoning-trace-protocol.md); proposes memory mutations via syscall. |
| `reflect(trace) → critique` | Self-evaluates the execution; populates trace `self_critique`; may emit evolution signals. |
| `checkpoint() → frame` | Serializes a resumable cognition frame (`COG_CHECKPOINT`). |
| `restore(frame)` | Resumes from a prior checkpoint. |
| `shutdown(reason)` | Terminates gracefully, flushing state and emitting lifecycle events. |
| `health() → CognitiveHealth` | Reports runtime + cognitive health (drift, confidence, load). |

**UnitDescriptor** — canonical JSON Schema (returned by `describe()`):

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "cos:protocol:unit-descriptor:1.0.0",
  "title": "UnitDescriptor",
  "type": "object",
  "required": ["unit_id", "unit_type", "version", "abi_version", "capabilities", "input_schemas", "output_schemas"],
  "properties": {
    "unit_id": { "type": "string" },
    "unit_type": { "type": "string" },
    "version": { "type": "string", "pattern": "^\\d+\\.\\d+\\.\\d+$" },
    "abi_version": { "type": "string", "pattern": "^\\d+\\.\\d+\\.\\d+$" },
    "capabilities": { "type": "array", "items": { "type": "string" } },
    "input_schemas": { "type": "array", "items": { "type": "string" }, "description": "registry schema ids" },
    "output_schemas": { "type": "array", "items": { "type": "string" } },
    "policy_needs": { "type": "array", "items": { "type": "string" } },
    "memory_scope_needs": { "type": "array", "items": { "type": "string" } },
    "observability_contract": { "type": "array", "items": { "type": "string" }, "description": "required events/metrics" },
    "resource_budget": { "type": "object" },
    "evolution_policy": { "type": "string", "enum": ["frozen","tunable","replaceable","self-mutable"] }
  },
  "additionalProperties": false
}
```

Illustrative TypeScript:

```ts
interface CognitiveHealth { runtime: "ok"|"degraded"|"failing"; drift: number; confidence: number; loadFactor: number; }
interface CognitiveUnit {
  describe(): UnitDescriptor;
  prepare(lease: ContextLease): Promise<void>;
  execute(packet: CognitionPacket): Promise<Emissions>;   // packets + events + trace + mutation proposals
  reflect(trace: ReasoningTrace): Promise<string | null>;
  checkpoint(): Promise<CognitionFrame>;
  restore(frame: CognitionFrame): Promise<void>;
  shutdown(reason: string): Promise<void>;
  health(): CognitiveHealth;
}
```

## Protocols and Contracts

- Units MUST declare `abi_version`; the registry rejects incompatible units at registration.
- `execute()` MUST only act within its [capability envelope](../kernel/capability-envelope.md) and
  through [syscalls](../kernel-internals/cognition-syscalls.md) — no ambient side effects.
- Every production unit MUST satisfy its `observability_contract` (emit declared events/traces).
- External/federated units implement the same ABI and negotiate via
  [capability negotiation](../interop/capability-negotiation.md).

### Protocol Versioning Rules (govern this ABI and all protocols)

Per [protocol governance](../meta/protocol-governance.md) and
[ADR-0003](../architecture-decisions/ADR-0003-tech-stack.md):

- **Canonical form:** JSON Schema in the registry; language bindings are generated/validated, never
  authoritative.
- **Semantic versioning:** PATCH = clarification; MINOR = additive optional fields; MAJOR = breaking.
- **Compatibility:** consumers tolerate unknown additive fields; producers never remove/retype fields
  without a MAJOR bump.
- **Breaking changes:** require an ADR, a migration path, deprecation window, and contract tests.
  Kernel-protocol breaks (ABI, packet, event envelope) are risk class **E5** (blueprint §12.4).
- **Registry entry per protocol:** schema, version, owner, compatibility matrix, validators, example
  fixtures, known producers/consumers, deprecation date.

## Runtime Semantics

The runtime invokes ABI hooks across the [13-state lifecycle](../runtime/cognitive-unit-runtime.md):
`prepare` during Hydrating, `execute` during Executing, `reflect` during Reflecting, `checkpoint`
during Checkpointing, `restore` during Recovering, `shutdown` during Retiring. Hooks are idempotent
where the lifecycle may retry them.

## Event and State Transitions

ABI calls drive `agent.registered → agent.ready → agent.executing → agent.completed | agent.failed`
and checkpoint/recover transitions. Each hook emits lifecycle events referencing the unit's CID.

When `execute()` returns a non-null `emissions.trace`, the runtime publishes it to the bus as a
`reasoning.completed` event (`reasoning.*` family, recorded-observation) — this realizes the `outcome`
trace of the `observability_contract` and feeds the observability engine (DPS-007). Product surfaces may
additionally project a structured summary of the trace into their own family (e.g.
`surface.agent.reasoning.summary`, SRF-002) for the Agent Observatory; the bus `reasoning.completed`
event remains the canonical, replayable record of the unit's reasoning outcome.

## Observability

`health()` feeds population management and autoscaling; `describe().observability_contract` is
enforced — a unit that fails to emit its declared telemetry is quarantined. ABI-version distribution
across the fleet is tracked for migration planning.

## Governance and Security

The ABI is the trust boundary for plug-ins: `describe()` declares policy and memory needs that
governance approves before admission; `evolution_policy` bounds self-modification (`self-mutable`
requires E2+ Evolution Proposals). External units run in stricter rings/sandboxes.

## Failure Semantics

- **ABI-incompatible unit** → registration rejected.
- **`execute()` exception** → `agent.failed`; runtime restarts from last checkpoint; repeated failure
  → quarantine.
- **Missing required telemetry** → quarantine (observability-contract breach).
- **`checkpoint`/`restore` mismatch** → fall back to event-replay reconstruction.

## Testing and Validation

- **Unit:** descriptor schema; hook idempotency; envelope-bounded execution.
- **Contract:** conformance test suite every unit must pass to register; cross-version compatibility.
- **Replay:** checkpoint/restore equivalence to event-replay reconstruction.
- **Governance:** declared-vs-actual capability/telemetry enforcement; evolution-policy gating.

## Evolution Strategy

The ABI is the system's most stable contract; changes are rare, versioned, and E5-governed. New
optional hooks (e.g. `negotiate()` for federation, `simulate()` for synthetic labs) are additive.
A conformance test suite + schema registry + codegen are required Phase 1C deliverables so units in
any language can implement the ABI safely.
