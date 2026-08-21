```yaml
spec:
  title: Memory Mutation Protocol
  domain: protocols
  status: draft
  owner: memory-team
  last_reviewed: 2026-06-02
  upstream_dependencies:
    - kernel/cognitive-identity
    - kernel/context-lease
    - kernel/governance-kernel
    - protocols/cognitive-event-protocol
  downstream_dependencies:
    - memory/memory-taxonomy
    - memory/consolidation
    - world-state/unified-world-state-graph
    - transactions/cognitive-transactions
  related_protocols:
    - cognitive-event-protocol
    - world-state-delta-protocol
    - reasoning-trace-protocol
  related_events:
    - memory.mutation.proposed
    - memory.mutation.committed
    - memory.consolidated
    - memory.redacted
    - memory.quarantined
  related_runtime_systems:
    - memory-mutation-service
    - world-state-graph-service
  related_governance_systems:
    - governance-kernel
  related_observability_systems:
    - cognitive-observability
    - memory-influence-graph
  semantic_tags: [memory, mutation, evidence, reversible, provenance, redaction, consolidation]
  canonical_references:
    - ../architecture/uci-architecture.md#27-memory-mutation
    - ../architecture/uci-architecture.md#123-operations
```

# Memory Mutation Protocol

## Purpose

Define the Memory Mutation: the *only* sanctioned way to write memory. Every change to episodic,
semantic, procedural, reflective, or collective memory — and every world-state graph write — is a
typed, evidence-backed, reversible, governed mutation, not a direct database update. This enforces
the architecture law: *no memory write without a Memory Mutation* and *no hidden state mutation
outside event sourcing*.

## Philosophy

Memory is institutional and long-lived; an unaudited write can silently poison a learner's model or
the collective curriculum for years. Treating every write as a typed mutation with evidence,
confidence, source identity, and reversibility metadata turns memory into a governed, traceable,
repairable substrate. Mutations are **proposed then committed**, allowing governance, hallucination
screening, and conflict detection before durable change.

## Architecture

A unit proposes a mutation via the `COG_MEMORY_MUTATE`
[syscall](../kernel-internals/cognition-syscalls.md). The Memory Mutation Service validates it against
the proposer's [context lease](../kernel/context-lease.md) (write scope) and
[governance policy](../kernel/governance-kernel.md), screens hallucination risk, detects conflicts,
then commits — emitting `memory.mutation.proposed` then `memory.mutation.committed`. Graph-targeted
mutations are realized as [world-state deltas](../world-state/unified-world-state-graph.md).

## Primitives

Canonical JSON Schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "cos:protocol:memory-mutation:1.0.0",
  "title": "MemoryMutation",
  "type": "object",
  "required": ["mutation_id", "proposer_cid", "memory_layer", "mutation_type", "target", "evidence", "confidence"],
  "properties": {
    "mutation_id": { "type": "string" },
    "proposer_cid": { "type": "string" },
    "tenant_id": { "type": ["string", "null"] },
    "memory_layer": { "type": "string", "enum": ["working","episodic","semantic","procedural","reflective","social","collective","governance","failure","evolution"] },
    "mutation_type": { "type": "string", "enum": ["add_fact","revise_fact","decay_confidence","reinforce_concept","link_concepts","split_concept","merge_concepts","add_episode","add_procedural_pattern","redact_memory","quarantine_memory","consolidate_memory"] },
    "target": { "type": "object", "description": "addressed node/edge/record" },
    "payload": { "type": "object" },
    "evidence": { "type": "array", "items": { "type": "object" }, "minItems": 0 },
    "confidence": { "type": "number", "minimum": 0, "maximum": 1 },
    "source_trace_id": { "type": ["string", "null"] },
    "reversible": { "type": "boolean" },
    "inverse_ref": { "type": ["string", "null"], "description": "mutation that undoes this one" },
    "context_lease_ref": { "type": ["string", "null"] },
    "classification": { "type": "string", "enum": ["public","internal","sensitive","restricted"] }
  },
  "additionalProperties": false
}
```

Illustrative TypeScript:

```ts
type MutationType = "add_fact"|"revise_fact"|"decay_confidence"|"reinforce_concept"|"link_concepts"|"split_concept"|"merge_concepts"|"add_episode"|"add_procedural_pattern"|"redact_memory"|"quarantine_memory"|"consolidate_memory";
interface MemoryMutation {
  mutationId: string; proposerCid: string; tenantId: string | null;
  memoryLayer: "working"|"episodic"|"semantic"|"procedural"|"reflective"|"social"|"collective"|"governance"|"failure"|"evolution";
  mutationType: MutationType; target: Record<string, unknown>; payload: Record<string, unknown>;
  evidence: Array<Record<string, unknown>>; confidence: number;
  sourceTraceId: string | null; reversible: boolean; inverseRef: string | null;
  contextLeaseRef: string | null; classification: "public"|"internal"|"sensitive"|"restricted";
}
```

## Protocols and Contracts

- `propose(mutation) → MutationHandle` — validate scope + governance + hallucination screen.
- `commit(handle) → committed_event_id` — durable apply; emits `memory.mutation.committed`.
- `revert(mutation_id, reason)` — apply the `inverse_ref` (semantic rollback).
- `consolidate(scope) → MemoryMutation[]` — durable workflow distilling episodes into stable memory.

Strong-consistency layers (semantic mastery edges, governance memory) commit transactionally; others
(collective memory) are eventually consistent with privacy aggregation (see
[memory taxonomy](../memory/memory-taxonomy.md) consistency table).

## Runtime Semantics

Writes require a write-scoped [context lease](../kernel/context-lease.md). High-hallucination-risk
proposals are blocked and flagged for review. Multi-store operations (e.g. mastery edge + episodic
event + revision reschedule) run as a [cognitive transaction](../transactions/cognitive-transactions.md)
with compensating actions.

## Event and State Transitions

`memory.mutation.proposed → (governance) → memory.mutation.committed | blocked`. Special types emit
`memory.consolidated`, `memory.redacted`, `memory.quarantined`. Every committed mutation is an event;
memory state is the fold of committed mutations.

## Observability

Mutation rate by type/layer, revert rate, memory-contradiction rate, and quarantine count are
[cognitive health metrics](../observability/cognitive-observability.md). `source_trace_id` links each
mutation to the reasoning that produced it (provenance / memory-influence graph).

## Governance and Security

- Hallucination screening on writes to durable semantic/collective layers (block on risk > threshold).
- Classification + consent enforced; redaction and forgetting are first-class mutation types.
- Collective memory mutations must be privacy-preserving (anonymized/aggregated), never raw user data.
- Memory suspected of contamination is quarantined (reversible isolation, audit preserved).

## Failure Semantics

- **Scope/governance denial** → proposal rejected; emit violation.
- **Conflict detected** → semantic [conflict resolution](../world-state/unified-world-state-graph.md);
  minority view preserved when meaningful.
- **Partial transaction failure** → mechanical rollback or compensating events.
- **Store outage** → buffer working-memory writes in-process; durable writes fail closed; re-sync on
  recovery. Corruption triggers [graph repair](../resilience/) from the mutation log.

## Testing and Validation

- **Unit:** mutation schema; reversibility/inverse correctness; type-specific invariants.
- **Governance:** write-scope enforcement; hallucination block; collective-memory anonymization.
- **Failure:** conflict resolution; transaction rollback; quarantine + revert.
- **Replay:** memory state deterministically reconstructable from committed-mutation events.

## Evolution Strategy

New mutation types and memory layers are additive under [protocol versioning](cognitive-unit-abi.md).
Changes to consolidation or redaction semantics are governance-critical (risk class E3/E4) and require
offline replay + staged rollout. The [world-state delta protocol](../world-state/unified-world-state-graph.md)
specializes this protocol for graph writes (Phase 1E).
