```yaml
spec:
  title: Cognitive Unit Runtime
  domain: runtime
  status: draft
  owner: runtime-team
  last_reviewed: 2026-06-02
  upstream_dependencies:
    - kernel/cognitive-identity
    - kernel/capability-envelope
    - kernel/context-lease
    - kernel/intent-lease
    - kernel/cognitive-scheduler
    - kernel/governance-kernel
    - kernel-internals/cognition-syscalls
    - protocols/cognitive-unit-abi
  downstream_dependencies:
    - agents/agent-manifest
    - orchestration/orchestration-cells
    - runtime/runtime-virtualization
    - replay/deterministic-replay
  related_protocols:
    - cognitive-unit-abi
    - cognition-packet-protocol
    - cognitive-event-protocol
    - reasoning-trace-protocol
    - memory-mutation-protocol
  related_events:
    - agent.registered
    - agent.spawned
    - agent.ready
    - agent.executing
    - agent.completed
    - agent.failed
    - agent.quarantined
    - agent.retired
  related_runtime_systems:
    - cognitive-unit-runtime
    - agent-population-manager
    - cognitive-scheduler
  related_governance_systems:
    - governance-kernel
    - capability-envelope
  related_observability_systems:
    - cognitive-observability
  semantic_tags: [runtime, cognitive-unit, agent-pod, lifecycle, manifest, checkpoint, hydration, warm-pool]
  canonical_references:
    - ../architecture/uci-architecture.md#5-cognitive-runtime
```

# Cognitive Unit Runtime

## Purpose

Define the runtime that instantiates, drives, checkpoints, recovers, and retires cognitive units. The
runtime is what turns a static [agent manifest](../agents/agent-manifest.md) + a
[capability envelope](../kernel/capability-envelope.md) into a live, observable, governable process
that implements the [Cognitive Unit ABI](../protocols/cognitive-unit-abi.md). It is the COS analog of
a container runtime (Docker/K8s kubelet) for intelligence.

## Philosophy

A cognitive unit is a **portable runtime container**, not a prompt. The runtime guarantees the
architecture laws at the unit boundary: every unit has identity + manifest + capability envelope;
every context access uses a lease; every long-running workflow holds an intent lease; every lifecycle
transition emits telemetry; no production unit runs without an observability contract. The runtime
makes units suspendable, resumable, migratable, and replayable.

## Architecture

```
manifest + envelope ─► RUNTIME ──► ABI hooks ──► unit instance
   │ registry          │ lifecycle FSM         │ describe/prepare/execute/
   │ scheduler binds    │ warm pool             │ reflect/checkpoint/restore/
   │ context+intent     │ checkpoint store      │ shutdown/health
   │ leases             └─ observability hooks  └─ syscalls → kernel services
```

The [Agent Population Manager](#) maintains **warm pools** per unit type (cold start is 200–500ms,
unacceptable for interactive UX). The [scheduler](../kernel/cognitive-scheduler.md) acquires units
from pools. The runtime binds identity, envelope, and leases, then drives the unit through its
lifecycle, mediating all privileged operations via [syscalls](../kernel-internals/cognition-syscalls.md).

## Primitives

**Cognitive unit instance** = `manifest + CID + capability envelope + leases + ABI implementation +
lifecycle state + checkpoint`.

**Agent Manifest** (portable definition) — canonical JSON Schema (full spec in
[agents/agent-manifest.md](../agents/agent-manifest.md), Phase 1C):

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "cos:protocol:agent-manifest:1.0.0",
  "title": "AgentManifest",
  "type": "object",
  "required": ["id", "version", "abi_version", "capabilities", "memory_access", "policies", "resources", "observability"],
  "properties": {
    "id": { "type": "string" },
    "version": { "type": "string", "pattern": "^\\d+\\.\\d+\\.\\d+$" },
    "abi_version": { "type": "string" },
    "role": { "type": "string" },
    "capabilities": { "type": "array", "items": { "type": "string" } },
    "reasoning_engines": { "type": "object" },
    "memory_access": { "type": "object", "properties": { "read": { "type": "array", "items": {"type":"string"} }, "write": { "type": "array", "items": {"type":"string"} } } },
    "policies": { "type": "array", "items": { "type": "string" } },
    "resources": { "type": "object" },
    "observability": { "type": "object", "properties": { "required_events": { "type": "array", "items": {"type":"string"} } } }
  },
  "additionalProperties": false
}
```

**Lifecycle state** — the 13-state FSM:

```json
{
  "$id": "cos:protocol:unit-lifecycle-state:1.0.0",
  "title": "UnitLifecycleState",
  "enum": ["Registered","Admitted","Scheduled","Hydrating","Ready","Executing","Checkpointing","Reflecting","Publishing","Suspended","Recovering","Retired","Quarantined"]
}
```

Illustrative TypeScript:

```ts
type UnitLifecycleState =
  | "Registered" | "Admitted" | "Scheduled" | "Hydrating" | "Ready"
  | "Executing" | "Checkpointing" | "Reflecting" | "Publishing"
  | "Suspended" | "Recovering" | "Retired" | "Quarantined";
```

## Protocols and Contracts

- The runtime drives the [ABI](../protocols/cognitive-unit-abi.md) hooks and enforces that `execute()`
  acts only within the bound envelope and only via syscalls.
- Spawning is mediated by `COG_SPAWN`; scheduling by `COG_SCHEDULE`; context by `COG_CONTEXT_LEASE`.
- The runtime enforces the unit's `observability_contract` — failing to emit declared telemetry →
  Quarantined.

## Runtime Semantics — Lifecycle

| State | Trigger / Action | ABI hook | Emits |
|---|---|---|---|
| Registered | manifest known to registry | — | `agent.registered` |
| Admitted | identity + envelope granted; policy admits | — | — |
| Scheduled | scheduler assigns zone + resource lease | — | `orchestration.task.routed` |
| Hydrating | bind context/intent leases; load prompt + memory handles + tools | `prepare` | `context.lease.granted` |
| Ready | can receive packets | `describe` | `agent.ready` |
| Executing | active cognition | `execute` | `agent.executing`, `reasoning.*` |
| Checkpointing | durable snapshot | `checkpoint` | `workflow.checkpointed` |
| Reflecting | self-evaluation | `reflect` | `reasoning.completed` |
| Publishing | emit final packets + memory mutations | — | `agent.completed`, `memory.mutation.committed` |
| Suspended | paused by workflow/policy/resource | `checkpoint` | `workflow.suspended` |
| Recovering | resume from crash/timeout | `restore` | `workflow.resumed` |
| Retired | version no longer takes new work | `shutdown` | `agent.retired` |
| Quarantined | unsafe behavior / drift / corruption / telemetry breach | `shutdown` | `agent.quarantined` |

Warm-pooled units cycle `Ready → Executing → Publishing → (released) → Ready`. Suspended units
checkpoint working context for later resume (supports pod migration and partition tolerance).

## Event and State Transitions

Every transition emits an `agent.*`/`workflow.*` event referencing the unit's CID, building the agent
timeline. Transitions are validated (no undocumented transitions, per
[runtime governance](../meta/runtime-governance.md)).

## Observability

The runtime exports per-unit `health()` (drift, confidence, load), lifecycle latencies, warm-pool
hit rate, checkpoint frequency, and failure/quarantine counts. These feed autoscaling, the
[cognitive observability engine](../observability/cognitive-observability.md), and population management.

## Governance and Security

- A unit cannot reach `Admitted` without identity + capability envelope (architecture law).
- The runtime fails closed if envelope/lease checks fail mid-execution (Suspended pending re-lease).
- Untrusted/external units run under [runtime virtualization](../runtime/runtime-virtualization.md)
  isolation (container now, WASM/hypervisor later per [ADR-0003](../architecture-decisions/ADR-0003-tech-stack.md)).
- Drift/contamination triggers Quarantine, preserving the audit trail.

## Failure Semantics

- **Hydration failure** (lease/tool unavailable) → retry with backoff; else Suspended; emit event.
- **`execute()` crash** → `agent.failed`; Recovering from last checkpoint; repeated failure →
  Quarantined.
- **Checkpoint/restore mismatch** → fall back to [event-replay](../replay/deterministic-replay.md)
  reconstruction of working context (Redis-checkpoint-equivalent path, blueprint §19.1).
- **Pool exhaustion** → cold start or scheduler backpressure.
- **Observability-contract breach** → Quarantined (cannot run unobserved).

## Testing and Validation

- **Unit:** lifecycle FSM transitions; manifest schema; envelope-bounded execution.
- **Integration:** spawn → schedule → hydrate → execute → publish end-to-end; warm-pool acquire/release.
- **Failure:** crash-recovery from checkpoint; hydration failure; quarantine paths.
- **Replay:** checkpoint/restore equivalent to event replay; frozen leases during replay.
- **Governance:** admission requires identity+envelope; mid-execution fail-closed.

## Evolution Strategy

The lifecycle FSM and manifest schema evolve under [protocol versioning](../protocols/cognitive-unit-abi.md)
(lifecycle changes E2+, kernel-ABI changes E5). The threading model
([cognitive fibers](../kernel-internals/cognition-syscalls.md)), hot-state migration, and the
[cognitive hypervisor](../runtime/runtime-virtualization.md) deepen this runtime in Phase 1D+.
Reference patterns: persistent agent loops (`hermes-agent/`), modular evented harness (`pi/`),
control-plane population management (`paperclip/`) per [ADR-0002](../architecture-decisions/ADR-0002-reference-repo-learning-substrate.md).
