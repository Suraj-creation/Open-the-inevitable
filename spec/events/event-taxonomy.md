```yaml
spec:
  title: Event Taxonomy
  domain: events
  status: draft
  owner: events-team
  last_reviewed: 2026-06-02
  upstream_dependencies:
    - protocols/cognitive-event-protocol
    - meta/event-governance
    - kernel/cognitive-identity
  downstream_dependencies:
    - communication/universal-cognitive-bus
    - replay/deterministic-replay
    - observability/cognitive-observability
    - world-state/temporal-cognition
  related_protocols:
    - cognitive-event-protocol
    - cognition-packet-protocol
    - memory-mutation-protocol
    - governance-decision-protocol
  related_events:
    - "this spec defines all event families"
  related_runtime_systems:
    - universal-cognitive-bus
    - event-store
  related_governance_systems:
    - governance-kernel
  related_observability_systems:
    - cognitive-observability
  semantic_tags: [events, taxonomy, families, naming, retention, replay, classification]
  canonical_references:
    - next-generation-cognitive-operating-system-blueprint#5.2
    - advanced-agent-architecture#4.3
```

# Event Taxonomy

## Purpose

Define the canonical taxonomy of cognitive event families: their naming grammar, ownership, schemas,
retention, replay behavior, governance classification, and failure handling. This is the authoritative
catalog that every producer and consumer references; it specializes the shared envelope defined by the
[Cognitive Event Protocol](../protocols/cognitive-event-protocol.md).

## Philosophy

"No important cognitive action should happen silently." The taxonomy makes the *space* of observable
cognition explicit and bounded: if an action matters, it belongs to a named family with a versioned
schema, a defined owner, and declared retention/replay/classification. A consistent hierarchical
naming grammar (`family.subdomain.action`) makes events both human-navigable and machine-routable
(topic + semantic routing).

## Architecture

Events are published to family-named topics on the
[Universal Cognitive Bus](../communication/universal-cognitive-bus.md) and partitioned in the event
store by family + tenant + time. Families map to bus planes (command/event/state/trace/governance/
evolution/realtime) so high-volume observability traffic never starves critical workflow events.

## Primitives — Event Families

Naming grammar: `family.subdomain.action` (e.g. `memory.mutation.committed`). All events use the
[Cognitive Event](../protocols/cognitive-event-protocol.md) envelope.

| Family | Examples | Owner | Default retention | Default replay |
|---|---|---|---|---|
| `intent.*` | received, interpreted, renewed, expired, revoked | kernel | 1y-archive | replayable |
| `context.*` | lease.granted, lease.expired, retrieval.started, retrieval.completed | kernel | 90d | replayable |
| `agent.*` | registered, spawned, ready, executing, completed, failed, quarantined, retired | runtime | 1y-archive | replayable |
| `reasoning.*` | started, strategy.selected, claim.produced, uncertainty.updated, completed | reasoning | 30d-hot, 1y-archive | recorded-observation |
| `memory.*` | read, mutation.proposed, mutation.committed, consolidated, redacted, quarantined | memory | permanent (committed) | replayable |
| `world.*` | node.created, edge.created, mastery.updated, branch.created, conflict.detected | world-state | permanent | replayable |
| `orchestration.*` | task.routed, topology.changed, director.decision, consensus.reached | orchestration | 90d | replayable |
| `workflow.*` | started, checkpointed, signaled, suspended, resumed, cancelled, completed | workflow | 1y-archive | replayable |
| `governance.*` | policy.evaluated, violation.detected, review.requested, override.granted | governance | permanent (audit) | replayable |
| `security.*` | identity.attested, prompt_injection.detected, trust.changed, access.denied | security | permanent (audit) | replayable |
| `observability.*` | drift.detected, loop.detected, disagreement.detected, health.changed | observability | 30d | non-replayable |
| `evolution.*` | proposal.created, experiment.started, shadow_result.recorded, rollout.completed | evolution | permanent | replayable |
| `kernel.*` | syscall.invoked, trap.raised, panic | kernel | 1y-archive (audit) | recorded-observation |
| `system.*` | resource.threshold, deadlock.detected, topology.changed | kernel | 90d | non-replayable |

Per-family schema registration — canonical JSON Schema for a family entry:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "cos:registry:event-family:1.0.0",
  "title": "EventFamilyRegistration",
  "type": "object",
  "required": ["family", "owner", "schema_version", "retention", "replay_behavior", "classification", "producers", "consumers"],
  "properties": {
    "family": { "type": "string" },
    "owner": { "type": "string" },
    "schema_version": { "type": "string" },
    "retention": { "type": "string" },
    "replay_behavior": { "type": "string", "enum": ["replayable","recorded-observation","non-replayable"] },
    "classification": { "type": "string", "enum": ["public","internal","sensitive","restricted","audit"] },
    "producers": { "type": "array", "items": { "type": "string" } },
    "consumers": { "type": "array", "items": { "type": "string" } },
    "failure_behavior": { "type": "string" }
  },
  "additionalProperties": false
}
```

## Protocols and Contracts

Every family MUST declare schema, owner, version, retention, replay behavior, governance
classification, producers, consumers, and failure behavior (per
[event governance](../meta/event-governance.md)). New families/subtypes are registered in the
[event index](../indexes/event-index.md) and validated at the bus; unregistered topics are rejected.

## Runtime Semantics

Family + `priority` + bus plane determine delivery treatment. `replay_behavior` from the table is the
default; individual events may override within governance limits. Causally-sensitive families
(`memory.*`, `world.*`, `governance.*`) require ordered processing; analytics families
(`observability.*`) tolerate out-of-order.

## Event and State Transitions

Aggregate timelines are folds over filtered families: the learner timeline draws from
`intent.* reasoning.* memory.* world.*`; the agent timeline from `agent.*`; the policy timeline from
`governance.*`. See [temporal cognition](../world-state/temporal-cognition.md).

## Observability

`observability.*` and `reasoning.*` are the primary inputs to drift/hallucination/disagreement
detection. `system.*`/`kernel.*` feed resilience dashboards. Consumer lag per family is alerted.

## Governance and Security

Classification gates retention, redaction, and cross-region replication: `audit` events are immutable
and globally replicated; `restricted`/`sensitive` (private learner data) stay regional. The bus
[governance interceptor](../kernel/governance-kernel.md) evaluates every publish/subscribe against the
family's classification.

## Failure Semantics

- **Unregistered family/topic** → publish rejected; dead-lettered.
- **Schema mismatch** → rejected; emit `governance.violation.detected`.
- **Consumer lag beyond threshold** → alert; apply backpressure to producers via the scheduler.
- **Dead-letter accumulation** → poison-quarantine; manual/automated triage workflow.

## Testing and Validation

- **Unit:** naming grammar; family registration schema; retention/replay enums.
- **Contract:** each family's payload schema fixtures; producer/consumer compatibility.
- **Replay:** family replay behavior honored; recorded-observation families reconstructed.
- **Governance:** classification-driven retention/redaction/replication enforced.

## Evolution Strategy

New families are additive (MINOR) and registered with full metadata; renaming/removing a family is
breaking (E5). Per-family payload schemas evolve under [protocol versioning](../protocols/cognitive-unit-abi.md).
The taxonomy is kept in sync with the [event index](../indexes/event-index.md) under
[event governance](../meta/event-governance.md).
