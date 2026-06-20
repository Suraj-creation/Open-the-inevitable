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
    [surface.created, surface.session.closed, surface.timeline.generated, surface.timeline.updated, surface.timeline.completed, surface.block.generated, surface.block.modified, surface.agent.joined, surface.agent.contributed, surface.agent.disagreed, surface.memory.attached, surface.visual.generated, surface.simulation.started, surface.explanation.expanded, surface.reasoning.recorded, surface.contribution.dropped, surface.narration.segment, surface.focus.changed, surface.presence.updated]
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
  "schema_version": "1.1.0",
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
| `surface.narration.segment` | a unit of spoken/visible narration is produced (Phase 2D choreography) | `segment_id`, `block_id`, `concept_id`, `sequence`, `text`, `focus?` ({target_type, target_id, spotlight}), `reveal_ids[]?`, `voice?` ({artifact_id, content_ref, duration_ms, provider_id}) |
| `surface.focus.changed` | attention is directed to a block/concept/region ("look here now") | `sequence`, `focus` ({target_type:"block"\|"concept"\|"region", target_id, reason, spotlight}) |
| `surface.presence.updated` | an agent's visible presence/activity changes | `agent_cid`, `agent_id`, `role`, `state` ("idle"\|"thinking"\|"contributing"\|"speaking"), `block_id?` |
| `surface.contribution.dropped` | late/invalid contribution rejected | `agent_cid`, `reason` |
| `surface.session.closed` | session closed | `block_count`, `reason` |

**Choreography & timing (Phase 2D).** `surface.narration.segment`, `surface.focus.changed`, and
`surface.presence.updated` form the *choreography sub-family* that turns the surface from a static
fold viewer into synchronized, attention-directed cognition. They carry only **logical order**
(`sequence`) and **durations** (`voice.duration_ms`) — never a wall-clock playback position. The
playback timeline (when a spotlight fires, when text reveals) is a **client-side projection** over
these ordered cues plus audio `currentTime`; it is not canonical state. Audio binaries never enter
events (the `voice.content_ref` references an out-of-band artifact). See ADR-0007.

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
6. `surface.narration.segment` (or `surface.focus.changed`) referencing a `block_id` follows that
   block's `surface.block.generated`; `sequence` is monotone within a surface.
7. A `surface.presence.updated` with `state:"speaking"` accompanies the narration it voices and is
   followed by a return to `"contributing"`/`"idle"`.

HLC is monotone within a surface (single producer runtime per session in Phase 2A/2D).

## 7. Event and State Transitions

State-fold mapping is owned by `surface/cognitive-surface-runtime` §7. The choreography sub-family
is state-affecting: `surface.narration.segment` appends to `narration[]` (and sets `focus` when it
carries one), `surface.focus.changed` replaces `focus`, and `surface.presence.updated` upserts
`presence[]` by `agent_cid`. Non-state events (`surface.visual.generated`,
`surface.simulation.started`, `surface.contribution.dropped`) fold into version count only.

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
subtypes, so older projections remain valid. The choreography sub-family
(`surface.narration.segment`, `surface.focus.changed`, `surface.presence.updated`) activates in
Phase 2D (schema_version 1.1.0). `surface.agent.disagreed` and `surface.explanation.expanded`
activate when the blackboard (F07) and layered explanations (F04) land in Phase 2B+.
