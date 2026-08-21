```yaml
spec:
  title: Cognition Syscalls
  domain: kernel-internals
  status: draft
  owner: kernel-team
  last_reviewed: 2026-06-02
  upstream_dependencies:
    - kernel/cognitive-identity
    - kernel/capability-envelope
    - kernel/context-lease
    - kernel/intent-lease
    - kernel/governance-kernel
    - kernel/cognitive-scheduler
  downstream_dependencies:
    - runtime/cognitive-unit-runtime
    - protocols/cognitive-unit-abi
    - protocols/cognition-packet-protocol
    - protocols/cognitive-event-protocol
    - protocols/memory-mutation-protocol
    - replay/deterministic-replay
  related_protocols:
    - cognitive-unit-abi
    - cognition-packet-protocol
    - cognitive-event-protocol
    - memory-mutation-protocol
    - governance-decision-protocol
  related_events:
    - kernel.syscall.invoked
    - kernel.trap.raised
    - kernel.panic
    - security.access.denied
  related_runtime_systems:
    - cognitive-unit-runtime
    - cognitive-scheduler
  related_governance_systems:
    - governance-kernel
    - capability-envelope
  related_observability_systems:
    - cognitive-observability
  semantic_tags: [syscall, kernel-mode, user-mode, privilege-ring, trap, panic, admission, interrupt]
  canonical_references:
    - ../architecture/uci-architecture.md#19-kernel-internals
    - ../architecture/uci-architecture.md#112-cognitive-threading
    - ../architecture/uci-architecture.md#19-kernel-internals
```

# Cognition Syscalls

## Purpose

Define the cognitive syscall surface: the **only** sanctioned interface through which user-mode
cognition requests privileged kernel operations. Syscalls are where governance, observability,
replayability, and capability control become enforceable. No user-mode cognitive unit may directly
mutate kernel state, publish unvalidated events, write memory, or invoke tools — it must trap into
the kernel through a typed syscall.

## Philosophy

A cognitive operating system needs the same kernel/user boundary that protects classical operating
systems. The boundary turns "an agent did something" into "an identified unit, holding a valid
capability envelope, requested a privileged operation, which the kernel evaluated, logged, and either
honored or denied." This single chokepoint is what makes the entire substrate observable, governable,
and replayable. Syscalls are the concrete realization of *protocol-first* and *governance-as-kernel*.

## Architecture

```
┌────────────────────────── USER-MODE COGNITION ──────────────────────────┐
│  agent pods · reasoning engines · workflows · tools · simulations        │
└───────────────────────────────┬──────────────────────────────────────────┘
                                 │  typed syscall (trap)
┌────────────────────────────────▼──────────────────────────────────────────┐
│ KERNEL-MODE COGNITION                                                       │
│  admission ▸ identity check ▸ capability check ▸ governance eval ▸ execute  │
│  identity · capability · leases · scheduler · governance · resource control │
│  emits kernel.syscall.invoked + domain event; records for replay            │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Privilege rings:** Ring 0 = kernel services (identity, scheduling, governance, resource accounting,
context leases, event validation, recovery). Ring 1 = orchestration/directors. Ring 2 = agent pods /
reasoning engines / workflows. Ring 3 = untrusted/external/federated units and tools. Higher rings
have stricter default envelopes and pass through more checks.

## Primitives — The Syscall Table

| Syscall | Purpose | Mediated kernel service |
|---|---|---|
| `COG_SPAWN` | Spawn a cognitive unit under a capability envelope | [identity](../kernel/cognitive-identity.md) + [capability](../kernel/capability-envelope.md) |
| `COG_SCHEDULE` | Request scheduling for a unit or workflow | [scheduler](../kernel/cognitive-scheduler.md) |
| `COG_CONTEXT_LEASE` | Request bounded context access | [context lease](../kernel/context-lease.md) |
| `COG_MEMORY_MUTATE` | Propose a memory mutation | [memory mutation](../protocols/memory-mutation-protocol.md) |
| `COG_EVENT_PUBLISH` | Publish a validated cognitive event | [cognitive event](../protocols/cognitive-event-protocol.md) |
| `COG_TOOL_INVOKE` | Request read-only or side-effecting tool execution | [governance](../kernel/governance-kernel.md) + capability |
| `COG_REASON` | Invoke a reasoning engine under a trace contract | [reasoning trace](../protocols/reasoning-trace-protocol.md) |
| `COG_CHECKPOINT` | Persist a resumable cognition frame | runtime + [replay](../replay/deterministic-replay.md) |
| `COG_REPLAY` | Replay a timeline or workflow segment | replay engine |
| `COG_FORK` | Create a simulation or alternate cognitive branch | temporal cognition |
| `COG_GOVERN` | Request a policy evaluation | governance kernel |
| `COG_EVOLVE` | Submit an evolution proposal | [evolution controller](../evolution/evolution-proposals.md) |

**Syscall request/result** — canonical JSON Schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "cos:protocol:cognition-syscall:1.0.0",
  "title": "CognitionSyscall",
  "type": "object",
  "required": ["syscall_id", "name", "caller_cid", "args"],
  "properties": {
    "syscall_id": { "type": "string" },
    "name": { "type": "string", "enum": ["COG_SPAWN","COG_SCHEDULE","COG_CONTEXT_LEASE","COG_MEMORY_MUTATE","COG_EVENT_PUBLISH","COG_TOOL_INVOKE","COG_REASON","COG_CHECKPOINT","COG_REPLAY","COG_FORK","COG_GOVERN","COG_EVOLVE"] },
    "caller_cid": { "type": "string" },
    "args": { "type": "object" },
    "trace_id": { "type": "string" },
    "deterministic": { "type": "boolean", "description": "false marks nondeterministic ops for replay" }
  },
  "additionalProperties": false
}
```

```json
{
  "$id": "cos:protocol:cognition-syscall-result:1.0.0",
  "title": "CognitionSyscallResult",
  "type": "object",
  "required": ["syscall_id", "status"],
  "properties": {
    "syscall_id": { "type": "string" },
    "status": { "type": "string", "enum": ["ok", "denied", "trapped", "error"] },
    "result": {},
    "decision_ref": { "type": ["string","null"], "description": "GovernanceDecision id" },
    "error": { "type": ["string","null"] }
  },
  "additionalProperties": false
}
```

Illustrative TypeScript:

```ts
type SyscallName = "COG_SPAWN"|"COG_SCHEDULE"|"COG_CONTEXT_LEASE"|"COG_MEMORY_MUTATE"|"COG_EVENT_PUBLISH"|"COG_TOOL_INVOKE"|"COG_REASON"|"COG_CHECKPOINT"|"COG_REPLAY"|"COG_FORK"|"COG_GOVERN"|"COG_EVOLVE";
interface CognitionSyscall { syscallId: string; name: SyscallName; callerCid: string; args: Record<string, unknown>; traceId: string; deterministic: boolean; }
interface CognitionSyscallResult { syscallId: string; status: "ok"|"denied"|"trapped"|"error"; result?: unknown; decisionRef: string | null; error: string | null; }
```

## Protocols and Contracts

Every syscall follows the same kernel pipeline: **admit → authenticate identity → check capability
envelope → evaluate governance → execute via the owning kernel service → emit events → record for
replay**. A syscall that fails any gate returns `denied`/`trapped` and emits the corresponding event.
Side-effecting syscalls (`COG_TOOL_INVOKE`, `COG_MEMORY_MUTATE`, `COG_EVOLVE`) always require a
[governance decision](../kernel/governance-kernel.md).

## Runtime Semantics

- **Admission control** gates `COG_SPAWN`/`COG_SCHEDULE` against resource and policy availability.
- **Interrupts:** safety/governance signals can interrupt running cognition (cooperative checkpoint,
  then preemption) — see [scheduler](../kernel/cognitive-scheduler.md).
- **Determinism:** nondeterministic syscalls (`COG_TOOL_INVOKE`, `COG_REASON` with live models) set
  `deterministic:false` and have their outputs recorded so replay uses recorded observations
  (determinism levels D2–D3, blueprint §26.8).

## Event and State Transitions

- `kernel.syscall.invoked` — every syscall (sampled for high-volume read-only ones).
- `kernel.trap.raised` — a syscall violated a precondition or capability check.
- `kernel.panic` — unrecoverable kernel-state inconsistency (see Failure Semantics).
- `security.access.denied` — capability/governance denial.

## Observability

Syscall rate, denial rate, trap rate, and per-syscall latency are exported. Because all privileged
operations funnel through syscalls, the syscall log is the backbone of the
[causal graph](../world-state/causal-graph.md) and deterministic replay.

## Governance and Security

The syscall boundary is the primary enforcement point for capability and governance. User-mode units
hold no ambient authority. Capability escalation (`COG_EVOLVE` widening an envelope, ring promotion)
is privileged, evented, and risk-classed (E2–E5). External/Ring-3 units pass through stricter checks
and prompt-injection screening before `COG_TOOL_INVOKE`.

## Failure Semantics

- **Precondition violation** → `trapped`; emit `kernel.trap.raised`; unit handles or suspends.
- **Capability/governance denial** → `denied`; emit `security.access.denied`.
- **Kernel-state inconsistency** → `kernel.panic`: freeze affected partition, snapshot state, attempt
  recovery from the event log; never silently continue. Panic recovery preserves audit history.
- **Service dependency down** → syscall returns `error` with degraded-mode guidance (fail closed for
  side-effects, allow low-risk read-only).

## Testing and Validation

- **Unit:** syscall schema; pipeline gating order; deterministic flag handling.
- **Governance:** denied side-effects without a decision; escalation requires approval.
- **Replay:** nondeterministic syscall outputs recorded and reused; deterministic syscalls stable.
- **Failure:** trap, panic-recovery, and degraded-mode paths.

## Evolution Strategy

The syscall table is a **kernel ABI**; additions are additive and versioned, removals/signature
changes are risk class **E5** (architecture-board approval + migration plan, blueprint §12.4). New
syscalls (e.g. `COG_CONSOLIDATE`, `COG_NEGOTIATE` for federation) follow the
[ABI versioning](../protocols/cognitive-unit-abi.md) rules.
