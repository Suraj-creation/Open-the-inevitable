---
name: surface-event-architecture
spec:
  id: SRF-002
  title: Surface Event Architecture — the surface.* Family
  domain: surface
  status: draft
  owner: product-architecture
  last_reviewed: 2026-06-11
  upstream_dependencies:
    - surface/cognitive-surface-runtime
    - events/event-taxonomy
    - protocols/cognitive-event-protocol
  downstream_dependencies:
    - packages/surface
    - indexes/event-index
  related_protocols: [cognitive-event-protocol, cognition-packet-protocol, memory-mutation-protocol]
  related_events:
    [surface.created, surface.session.closed, surface.timeline.generated, surface.timeline.updated, surface.timeline.completed, surface.block.generated, surface.block.modified, surface.agent.joined, surface.agent.contributed, surface.agent.disagreed, surface.memory.attached, surface.visual.generated, surface.simulation.started, surface.explanation.expanded, surface.reasoning.recorded, surface.contribution.dropped]
  related_runtime_systems: [universal-cognitive-bus, world-state-graph]
  related_governance_systems: [governance-kernel]
  related_observability_systems: [cognitive-observability, otel-edge]
  semantic_tags: [phase-2a, surface-events, event-family, replay, observability]
  canonical_references:
    - events/event-taxonomy
    - surface/cognitive-surface-runtime#7
---

# Surface Event Architecture

## 1. Purpose

Defines the `surface.*` cognitive event family: the canonical, observable, replayable record
of everything that becomes visible on a Cognitive Surface. The event log **is** the surface's
source of truth; `SurfaceState` is a fold over it.

## 2. Philosophy

- Events follow state: an event is emitted only after the transition it describes succeeded.
- Every event is replayable; replaying the family reconstructs the surface exactly.
- Nothing appears on a surface without an event; nothing in an event lacks provenance.

## 3. Architecture

All events are schema-valid `CognitiveEvent`s (protocols `cognitiveEvent` schema) published on
the Universal Cognitive Bus under topic `cos.<event_type>`. Family registration:

```json
{
  "family": "surface",
  "owner": "surface",
  "schema_version": "1.0.0",
  "retention": "permanent",
  "replay_behavior": "replayable",
  "classification": "internal",
  "producers": ["surface-session", "agent-contribution-runtime", "surface-timeline-builder"],
  "consumers": ["surface-projection", "observability", "memory", "future-ui-clients"],
  "failure_behavior": "publish failure fails the surface transition (state-then-event ordering)"
}
```

Common payload envelope: every `surface.*` payload includes `surface_id`. Events carry
`causation_id` (the triggering packet/event id) and `correlation_id` (the surface_id) for
causal tracing.

## 4. Primitives — Event Catalog

| Event type | Emitted when | Payload (beyond surface_id) |
|---|---|---|
| `surface.created` | session start succeeded | `learner_cid`, `session_id`, `goal` |
| `surface.timeline.generated` | first timeline build for a goal | `timeline_id`, `goal`, `node_count`, `concept_ids[]` |
| `surface.timeline.updated` | timeline re-projected after world-state change | `timeline_id`, `nodes[]` (projected nodes), `reason` |
| `surface.timeline.completed` | every node mastered | `timeline_id`, `mastered_count` |
| `surface.block.generated` | new block accepted into surface | full `CognitionBlock` (v1) |
| `surface.block.modified` | existing block content replaced | `block_id`, `version`, `content`, `reason` |
| `surface.agent.joined` | agent's first contribution to this surface | `agent_cid`, `agent_id` |
| `surface.agent.contributed` | agent produced ≥1 block in a dispatch | `agent_cid`, `agent_id`, `block_ids[]`, `packet_id` |
| `surface.agent.disagreed` | arbitration recorded conflicting proposals (Phase 2B+ active) | `agent_cids[]`, `topic`, `resolution` |
| `surface.memory.attached` | memory mutation committed for a block | `block_id`, `mutation_id`, `memory_layer` |
| `surface.visual.generated` | provider adapter produced a media artifact | `block_id`, `artifact_id`, `modality`, `provider_id` |
| `surface.simulation.started` | simulation block began execution | `block_id`, `simulation_id` |
| `surface.explanation.expanded` | explanation deepened a layer (F04, Phase 2B+) | `block_id`, `from_layer`, `to_layer` |
| `surface.reasoning.recorded` | supervisor/orchestration decision captured | `decision` (target_agent, reason, concept_id), `producer_cid` |
| `surface.contribution.dropped` | late/invalid contribution rejected | `agent_cid`, `reason` |
| `surface.session.closed` | session closed | `block_count`, `reason` |

## 5. Protocols and Contracts

- `producer_cid`: the CID of the acting identity (learner CID for session lifecycle events,
  agent CID for contribution events).
- `producer_type`: `"product.surface"` for runtime-emitted events.
- `classification`: inherited from the session's capability envelope ceiling; never widened.
- Payloads are structured objects — never serialized blobs of UI markup.

## 6. Runtime Semantics

Ordering laws:

1. `surface.created` precedes all other events for a `surface_id`.
2. `surface.agent.joined` precedes the first `surface.agent.contributed` for that CID.
3. `surface.block.generated` for a `block_id` precedes any `surface.block.modified` for it.
4. `surface.timeline.generated` precedes `surface.timeline.updated` for the same timeline.
5. `surface.session.closed` is terminal; only `surface.contribution.dropped` may follow.

HLC is monotone within a surface (single producer runtime per session in Phase 2A).

## 7. Event and State Transitions

State-fold mapping is owned by `surface/cognitive-surface-runtime` §7. Non-state events
(`surface.visual.generated`, `surface.simulation.started`, `surface.contribution.dropped`)
fold into version count only.

## 8. Observability

Every event carries `trace_id`/`span_id` when produced from a dispatch context, linking the
surface record to OTel traces. The family is fully replayable: subject filter `surface.>`.

## 9. Governance and Security

Events are emitted only for governed work: a governance-blocked dispatch emits nothing in
this family. Classification ceilings propagate from the capability envelope. Audit consumers
may subscribe read-only.

## 10. Failure Semantics

Publish failure aborts the surface transition (caller receives the error; no state/event
divergence). Consumers must tolerate unknown future subtypes (forward-compatible fold).

## 11. Testing and Validation

- Schema validation: every emitted event validates against the `cognitiveEvent` schema.
- Ordering: lifecycle tests assert laws 1–5 over the bus log.
- Replay: fold(replay(`surface.>`)) deep-equals live state.
- Negative: blocked dispatch produces zero `surface.*` events.

## 12. Evolution Strategy

New subtypes are added per spec revision with `schema_version` bumps; folds ignore unknown
subtypes, so older projections remain valid. `surface.agent.disagreed` and
`surface.explanation.expanded` activate when the blackboard (F07) and layered explanations
(F04) land in Phase 2B+.
