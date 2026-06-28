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
    [surface.created, surface.session.closed, surface.timeline.generated, surface.timeline.updated, surface.timeline.completed, surface.block.generated, surface.block.delta, surface.block.modified, surface.agent.joined, surface.agent.contributed, surface.agent.disagreed, surface.agent.reasoning.summary, surface.agent.work.timing, surface.memory.attached, surface.visual.generated, surface.simulation.started, surface.explanation.expanded, surface.reasoning.recorded, surface.contribution.dropped, surface.narration.segment, surface.narration.script.produced, surface.focus.changed, surface.presence.updated, surface.proposal.proposed, surface.synthesis.recorded, surface.graph.expanded, surface.graph.entrypoint.changed, surface.interaction.received, surface.interaction.applied, surface.frame.planned, surface.frame.composed, surface.frame.element.delta, surface.image.decided, surface.frame.speculation.prepared, surface.frame.speculation.invalidated, surface.frame.promoted]
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
  "schema_version": "1.4.0",
  "retention": "permanent",
  "replay_behavior": "replayable",
  "classification": "internal",
  "producers": ["surface-session", "agent-contribution-runtime", "surface-timeline-builder", "surface-composer", "frame-planner"],
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
| `surface.block.delta` | a streaming content chunk for an in-flight block, before its whole-block emit (S-UCS) | `block_id`, `seq`, `text_delta` |
| `surface.block.modified` | existing block content replaced | `block_id`, `version`, `content`, `reason` |
| `surface.agent.joined` | agent's first contribution to this surface | `agent_cid`, `agent_id` |
| `surface.agent.contributed` | agent produced ≥1 block in a dispatch | `agent_cid`, `agent_id`, `block_ids[]`, `packet_id` |
| `surface.agent.disagreed` | arbitration recorded conflicting proposals (Phase 2B+ active) | `agent_cids[]`, `topic`, `resolution` |
| `surface.agent.reasoning.summary` | an agent's reasoning trace is surfaced for the Observatory (S-UCS) | `agent_cid`, `agent_id`, `packet_id`, `work_id?`, `task_interpretation`, `strategy`, `decision`, `self_critique?`, `confidence`, `determinism_level` |
| `surface.agent.work.timing` | an agent work item changed lifecycle state, carrying real latency (S-UCS) | `agent_cid`, `agent_id`, `work_id`, `packet_id?`, `work_type`, `status` ("admitted"\|"dispatched"\|"executing"\|"completed"\|"failed"), `queue_wait_ms?`, `execution_ms?` |
| `surface.memory.attached` | memory mutation committed for a block | `block_id`, `mutation_id`, `memory_layer` |
| `surface.visual.generated` | provider adapter produced a media artifact | `block_id`, `artifact_id`, `modality`, `provider_id` |
| `surface.simulation.started` | simulation block began execution | `block_id`, `simulation_id` |
| `surface.explanation.expanded` | explanation deepened a layer (F04, Phase 2B+) | `block_id`, `from_layer`, `to_layer` |
| `surface.reasoning.recorded` | supervisor/orchestration decision captured | `decision` (target_agent, reason, concept_id), `producer_cid` |
| `surface.narration.segment` | a unit of spoken/visible narration is produced (Phase 2D choreography) | `segment_id`, `block_id`, `concept_id`, `sequence`, `text`, `focus?` ({target_type, target_id, spotlight}), `reveal_ids[]?`, `voice?` ({artifact_id, content_ref, duration_ms, provider_id}) |
| `surface.focus.changed` | attention is directed to a block/concept/region ("look here now") | `sequence`, `focus` ({target_type:"block"\|"concept"\|"region", target_id, reason, spotlight}) |
| `surface.presence.updated` | an agent's visible presence/activity changes | `agent_cid`, `agent_id`, `role`, `state` ("idle"\|"thinking"\|"contributing"\|"speaking"), `block_id?` |
| `surface.proposal.proposed` | an ensemble agent published a proposal to the blackboard (S1.2, ADR-0025) | `proposal_id`, `agent_cid`, `agent_id`, `topic`, `summary`, `confidence`, `packet_id` |
| `surface.synthesis.recorded` | the arbiter synthesized proposals into surfaced cognition | `topic`, `chosen_proposal_ids[]`, `block_ids[]`, `rationale`, `producer_cid` |
| `surface.graph.expanded` | the cognitive-graph projection grew/changed edges or nodes (S1.1) | `timeline_id`, `added_node_ids[]?`, `added_edges[]?` ({from, to, edge_type}), `reason` |
| `surface.graph.entrypoint.changed` | learner re-projected the graph at a different entry layer | `timeline_id`, `entry_point` ("beginner"\|"intermediate"\|"advanced"\|"research") |
| `surface.interaction.received` | a learner interaction command was governed and accepted (S1.3, ADR-0024) | `interaction_id`, `kind` ("interrupt"\|"jump"\|"branch"\|"challenge"\|"request_depth"\|"request_simplify"\|"request_example"), `target_id?`, `args?` |
| `surface.interaction.applied` | the runtime applied/realized a prior interaction | `interaction_id`, `effect` ("cancelled"\|"refocused"\|"dispatched"\|"reprojected"), `reason` |
| `surface.contribution.dropped` | late/invalid contribution rejected | `agent_cid`, `reason` |
| `surface.session.closed` | session closed | `block_count`, `reason` |
| `surface.mode.set` | the surface mode was set or changed (S4.3) | `surface_id`, `mode` ("student"\|"educator"\|"institution"\|"researcher"\|"open") |
| `surface.evaluation.recorded` | a reasoning-cycle evaluation record was attached to this surface (S4.2, ADR-0027) | `surface_id`, `concept_id`, `scorecard_id`, `score`, `passed`, `dimension_scores[]`, `hlc` |
| `surface.scene.block.placed` | a block's spatial position was recorded in the scene-graph projection (S4.4; observational only — layout is non-canonical per D5) | `surface_id`, `block_id`, `x`, `y`, `width`, `height` |
| `surface.projection.switched` | learner toggled the active surface projection between timeline-graph and scene-graph views (S4.4) | `surface_id`, `from` ("timeline"\|"scene"), `to` ("timeline"\|"scene") |
| `surface.frame.planned` | a Cognitive Frame's MCCR layout (slots, element ids, reveal order) is reserved before its content lands (UCS, ADR-0030) | `frame_id`, `ordinal`, `concept_id`, `title`, `mccr_layout` ({slots[], element_ids[], reveal_order}), `pacing?`, `planner_packet_id?` |
| `surface.frame.composed` | a Cognitive Frame's full MCCR is composed and ready (UCS, ADR-0030) | `frame_id`, `ordinal`, `concept_id`, `title`, `mccr` (full), `confidence`, `reasoning`, `composer_packet_id` |
| `surface.narration.script.produced` | the spoken teaching script for a frame is produced, separate from the on-screen MCCR (UCS, ADR-0030) | `frame_id`, `script_id`, `segments[]` ({segment_id, anchor_ref, intent, text, reveal_ids[], pause_after}) |
| `surface.image.decided` | the composer/image agent decided whether an image helps the frame and how (UCS, ADR-0030) | `frame_id`, `helps`, `modality` ("image"\|"none"), `prompt?`, `rationale` |
| `surface.frame.element.delta` | a streaming text chunk for one MCCR element while the frame composes (UCS, ADR-0030; live only) | `frame_id`, `element_id`, `seq`, `text_delta` |
| `surface.frame.speculation.prepared` | a discardable look-ahead frame was pre-composed for a likely next concept (UCS, ADR-0030) | `frame_id`, `speculative_of`, `concept_id`, `mccr_layout`, `trigger_assumption`, `planner_packet_id?` |
| `surface.frame.speculation.invalidated` | a prepared speculative frame no longer matches the learner's trajectory and is discarded (UCS, ADR-0030) | `frame_id`, `reason` |
| `surface.frame.promoted` | a prepared speculative frame matched a real learner signal and is promoted into the canonical frame line (UCS, ADR-0030) | `frame_id`, `ordinal` (final) |

**Choreography & timing (Phase 2D).** `surface.narration.segment`, `surface.focus.changed`, and
`surface.presence.updated` form the *choreography sub-family* that turns the surface from a static
fold viewer into synchronized, attention-directed cognition. They carry only **logical order**
(`sequence`) and **durations** (`voice.duration_ms`) — never a wall-clock playback position. The
playback timeline (when a spotlight fires, when text reveals) is a **client-side projection** over
these ordered cues plus audio `currentTime`; it is not canonical state. Audio binaries never enter
events (the `voice.content_ref` references an out-of-band artifact). See ADR-0007.

**Ensemble & synthesis (S1.2, ADR-0025).** `surface.proposal.proposed` and
`surface.synthesis.recorded` make multi-agent cognition visible: agents publish competing proposals
(with confidence) to the blackboard, and the arbiter records the synthesis (chosen/merged result +
rationale). Divergence beyond threshold additionally emits `surface.agent.disagreed`. These carry only
structured data (no model internals); replay resolves every proposal from the recorded model outputs (D3).

**Interaction (S1.3, ADR-0024).** `surface.interaction.received` records a governed learner intent
(interrupt/jump/branch/challenge/request_*), and `surface.interaction.applied` records how the runtime
realized it. Interaction is the canonical record of *how the learner engaged*; interrupt is cooperative
(applied at the next fiber yield point), so no event/state divergence occurs. The cognitive-graph
sub-family (`surface.graph.*`) records growth/entry-point changes of the timeline projection (SRF-003).

**Streaming content (S-UCS).** `surface.block.delta` carries an ordered chunk (`seq`, `text_delta`) of an
explanation block *while it is being generated*, so the viewport can show cognition unfolding live. It is
a **streaming projection cue**, not canonical content: like the choreography family it carries only
logical order (`seq`), never a wall-clock position. The fold accumulates deltas into a **transient**
`streaming_blocks` buffer keyed by `block_id`; the block's whole-block `surface.block.generated` is the
canonical content and **clears** the buffer for that `block_id`. Therefore for the final state
`fold([delta…, generated]) ≡ fold([generated])` — replay equivalence is preserved (ADR-0028); a prefix
that ends mid-stream exposes the partial buffer. Deterministic/replay mode may emit the whole block with
no deltas; the final state is identical either way.

**Agent observability (S-UCS).** `surface.agent.reasoning.summary` surfaces a structured summary of an
agent's `ReasoningTrace` (task interpretation, strategy, decision, self-critique, confidence,
determinism level — never raw private memory), and `surface.agent.work.timing` records a work item's
lifecycle (`admitted→dispatched→executing→completed|failed`) with real latency. Reasoning summaries
append to `agent_reasoning[]`; work-timing events **upsert** `agent_work_timings[]` by `work_id`. Latency
values come from the real clock, so they are deterministic *per event log* (re-folding the same log is
byte-identical) but legitimately differ across live runs; they never enter canonical block content, so
content-determinism (SRF-001 §6.4) is unaffected. These power the Agent Observatory (F09, ADR-0029).

**Cognitive Frames & MCCR (UCS, ADR-0030).** The `surface.frame.*` sub-family models the **Cognitive
Frame** — a bounded, viewport-complete cognitive *state* (SRF-001 §4.7) carrying only the **Minimal
Complete Cognitive Representation** (MCCR, §4.8): distilled visual anchors that deserve persistent
attention. The spoken teaching is a *separate* artifact: `surface.narration.script.produced` records
the narration script, whose segments target MCCR elements via `anchor_ref`; the existing
`surface.narration.segment` choreography stream voices it, with each segment's `focus.target_type:"element"`
spotlighting the discussed `element_id` (the highlight schedule is a client projection, ADR-0007).
`surface.frame.planned` reserves a frame's layout; `surface.frame.composed` lands its full MCCR and is
the readiness/resume anchor — **which frame is on screen is a client projection** over the choreographer
cursor, never a logged pointer (no `active_frame_id`, no `surface.frame.activated`). `surface.frame.element.delta`
streams element text into a **transient** buffer cleared by `surface.frame.composed` (mirrors ADR-0028,
so `fold([delta…, composed]) ≡ fold([composed])`). MCCR `diagram`/`table` elements are deterministic
client-rendered projections (no media provider); only the `image` element touches a provider, gated by
`image_plan.helps` and recorded via `surface.image.decided` + the existing `surface.visual.generated` seam.
**Look-ahead** (`surface.frame.speculation.prepared`/`.invalidated`/`.promoted`) is governed, budgeted,
and discardable: speculative frames are recorded for the Observatory but never surfaced until a real
learner signal promotes them, and any unexpected signal invalidates them — generated live and
continuously re-planned, never statically pre-generated (SRF-001 §2; ADR-0030).

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
3. `surface.block.generated` for a `block_id` precedes any `surface.block.modified` for it. Any
   `surface.block.delta` for a `block_id` precedes that block's `surface.block.generated` (the deltas
   stream, then the whole block lands and clears the buffer); `seq` is monotone within a block.
4. `surface.timeline.generated` precedes `surface.timeline.updated` for the same timeline.
5. `surface.session.closed` is terminal; only `surface.contribution.dropped` may follow.
6. `surface.narration.segment` (or `surface.focus.changed`) referencing a `block_id` follows that
   block's `surface.block.generated`; `sequence` is monotone within a surface.
7. A `surface.presence.updated` with `state:"speaking"` accompanies the narration it voices and is
   followed by a return to `"contributing"`/`"idle"`.
8. `surface.frame.planned`/`surface.frame.composed` for a `frame_id` precede any
   `surface.narration.segment` carrying that `frame_id` and any `surface.frame.element.delta` for it;
   `ordinal` is monotone within the canonical frame line.
9. Any `surface.frame.element.delta` for a `frame_id:element_id` precedes that frame's
   `surface.frame.composed` (deltas stream, then the frame composes and clears the buffer); `seq` is
   monotone within an element (mirrors law 3).
10. `surface.narration.script.produced` and `surface.image.decided` for a `frame_id` follow that
    frame's `surface.frame.composed` (the MCCR lands first, so every `anchor_ref` resolves to an
    existing `element_id`).
11. `surface.frame.speculation.invalidated` and `surface.frame.promoted` follow that frame's
    `surface.frame.speculation.prepared`; a promoted frame thereafter obeys laws 8–10.

HLC is monotone within a surface (single producer runtime per session in Phase 2A/2D).

## 7. Event and State Transitions

State-fold mapping is owned by `surface/cognitive-surface-runtime` §7. The choreography sub-family
is state-affecting: `surface.narration.segment` appends to `narration[]` (and sets `focus` when it
carries one), `surface.focus.changed` replaces `focus`, and `surface.presence.updated` upserts
`presence[]` by `agent_cid`. The ensemble sub-family is state-affecting: `surface.proposal.proposed`
appends to `proposals[]` and `surface.synthesis.recorded` appends to `syntheses[]`. The interaction
sub-family is state-affecting: `surface.interaction.received` appends to `interactions[]` (and may set
`focus`); `surface.interaction.applied` annotates the matching interaction. `surface.graph.*` re-folds
the graph slice of the timeline projection. The streaming/observability sub-family (S-UCS) is
state-affecting: `surface.block.delta` upserts the transient `streaming_blocks` buffer by `block_id`
(appending `text_delta` in `seq` order) and `surface.block.generated` clears that buffer entry;
`surface.agent.reasoning.summary` appends to `agent_reasoning[]`; `surface.agent.work.timing` upserts
`agent_work_timings[]` by `work_id`. The **Cognitive Frame** sub-family (UCS, ADR-0030) is
state-affecting: `surface.frame.planned` and `surface.frame.composed` **upsert** `frames[]` by
`frame_id` (planned reserves an empty-content entry; composed fills the full MCCR, enriches
`provenance.source_event_id`, and clears any transient element buffers — composed never downgrades to
planned); `surface.narration.script.produced` upserts `narration_scripts[]` by `script_id`;
`surface.image.decided` appends to `image_decisions[]`; `surface.frame.element.delta` upserts the
**transient** `streaming_frame_elements` buffer by `frame_id:element_id` (cleared by
`surface.frame.composed`, so it never affects settled state); `surface.frame.speculation.prepared`
upserts `speculative_frames[]` by `frame_id`, `surface.frame.speculation.invalidated` marks the
matching speculative entry (and is **never** copied into `frames[]`), and `surface.frame.promoted`
copies the speculative entry into `frames[]` (status `promoted`, final ordinal). Non-state events
(`surface.visual.generated`, `surface.simulation.started`, `surface.contribution.dropped`) fold into
version count only.

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
activate when the blackboard (F07) and layered explanations (F04) land in Phase 2B+. The **ensemble**
(`surface.proposal.proposed`, `surface.synthesis.recorded`), **interaction**
(`surface.interaction.received`/`applied`), and **cognitive-graph** (`surface.graph.expanded`,
`surface.graph.entrypoint.changed`) sub-families activate in Phase S1 (schema_version 1.2.0; ADR-0024,
ADR-0025, and the Cognitive Surface Maturity roadmap). The **streaming** (`surface.block.delta`) and
**agent-observability** (`surface.agent.reasoning.summary`, `surface.agent.work.timing`) sub-families
activate in the Universal Cognitive Surface milestone (S-UCS, schema_version 1.3.0; ADR-0028, ADR-0029)
— additive, forward-compatible, and replay-preserving (older folds ignore them). The **Cognitive Frame**
sub-family (`surface.frame.planned`, `surface.frame.composed`, `surface.narration.script.produced`,
`surface.image.decided`, `surface.frame.element.delta`, `surface.frame.speculation.prepared`,
`surface.frame.speculation.invalidated`, `surface.frame.promoted`) activates in the UCS Cognitive-Frames
milestone (schema_version 1.4.0; ADR-0030) — additive, forward-compatible, and replay-preserving.
