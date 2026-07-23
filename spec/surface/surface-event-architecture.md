---
name: surface-event-architecture
spec:
  id: SRF-002
  title: Surface Event Architecture — the surface.* Family
  domain: surface
  status: draft
  owner: product-architecture
  last_reviewed: 2026-07-10
  upstream_dependencies:
    - surface/cognitive-surface-runtime
    - events/event-taxonomy
    - protocols/cognitive-event-protocol
    - source-environment/CSE-008-source-surface-projection
    - source-environment/CSE-011-cognitive-director
    - source-environment/CSE-012-cognitive-scene
    - source-environment/CSE-013-knowledge-cinematography
    - source-environment/CSE-014-cognitive-interaction-grammar
  downstream_dependencies:
    - packages/surface
    - indexes/event-index
  related_protocols: [cognitive-event-protocol, cognition-packet-protocol, memory-mutation-protocol]
  related_events:
    [surface.created, surface.session.closed, surface.timeline.generated, surface.timeline.updated, surface.timeline.completed, surface.block.generated, surface.block.delta, surface.block.modified, surface.agent.joined, surface.agent.contributed, surface.agent.disagreed, surface.agent.reasoning.summary, surface.agent.work.timing, surface.memory.attached, surface.visual.generated, surface.simulation.started, surface.explanation.expanded, surface.reasoning.recorded, surface.contribution.dropped, surface.narration.segment, surface.narration.script.produced, surface.focus.changed, surface.presence.updated, surface.proposal.proposed, surface.synthesis.recorded, surface.graph.expanded, surface.graph.entrypoint.changed, surface.interaction.received, surface.interaction.applied, surface.frame.planned, surface.frame.composed, surface.frame.element.delta, surface.image.decided, surface.frame.speculation.prepared, surface.frame.speculation.invalidated, surface.frame.promoted, surface.source.attached, surface.source.viewport.planned, surface.source.viewport.changed, surface.source.highlight.applied, surface.source.highlight.cleared, surface.source.sync.bound, surface.resume.projected, surface.director.directive, surface.director.state.entered, surface.director.pacing.set, surface.affect.observed, surface.attention.budgeted, surface.scene.opened, surface.scene.actor.entered, surface.scene.evolved, surface.scene.lighting.changed, surface.scene.closed, surface.shot.planned, surface.shot.cut, surface.intent.expressed]
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
  "schema_version": "1.9.0",
  "retention": "permanent",
  "replay_behavior": "replayable",
  "classification": "internal",
  "producers": ["surface-session", "agent-contribution-runtime", "surface-timeline-builder", "surface-composer", "frame-planner", "source-projection", "cognitive-director", "cinematographer", "interaction-grammar"],
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
| `surface.interaction.received` | a learner interaction command was governed and accepted (S1.3, ADR-0024; grammar extended CSE-014/ADR-0039) | `interaction_id`, `kind` (ADR-0024 seven \| the CSE-014 grammar: `annotate`\|`circle`\|`highlight`\|`pin`\|`ask_why`\|`ask_simpler`\|`ask_deeper`\|`ask_example`\|`define`\|…), `target_id?`, `note?`, `args?` |
| `surface.interaction.applied` | the runtime applied/realized a prior interaction | `interaction_id`, `effect` ("cancelled"\|"refocused"\|"dispatched"\|"reprojected"\|"scene-evolved"\|"annotated"), `reason` |
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
| `surface.source.attached` | a Canonical Source Environment was bound to this session (CSE M5, CSE-008 §3.1) | `source_id`, `source_version_id`, `modality`, `title`, `layers_available[]`, `content_ref` (out-of-band; bytes served by the gateway source-content route, never on the stream) |
| `surface.source.viewport.planned` | a Viewport Plan was reserved for a frame — the expert gaze over the source (CSE-008 §4) | `plan_id`, `frame_id`, `source_version_id`, `viewports[]` ({viewport_id, anchor_ref, emphasis ("focus"\|"context"\|"orientation"), ordinal, region {path, page?, bbox?, char_start, char_end, quote}}) |
| `surface.source.viewport.changed` | a planned viewport was realized or overridden (CSE-008 §4.2) | `viewport_id`, `plan_id?`, `source_version_id`, `cause` ("plan"\|"learner"\|"citation"\|"resume") |
| `surface.source.highlight.applied` | a semantic highlight lit an anchored region (CSE-008 §5) | `highlight_id`, `frame_id`, `source_version_id`, `anchor_ref`, `role` (CSE-008 §5.1 registry), `amplitude` ("whisper"\|"active"\|"focal"), `lifetime` ("pulse"\|"held"\|"persistent-tint"), `provenance_class` ("evidence"\|"inference"\|"frontier"), `decided_by`, `region` (resolved {path, page?, bbox?, char_start, char_end, quote}) |
| `surface.source.highlight.cleared` | highlights were cleared in bulk by scope (CSE-008 §5.1) | `scope` ({frame_id?} \| {plan_id?} \| {highlight_ids[]?}) |
| `surface.source.sync.bound` | the Attention Contract instance for a frame — narration segments bound to viewports/highlights (CSE-008 §6.1) | `frame_id`, `script_id`, `bindings[]` ({segment_id, viewport_ref (viewport_id \| null), highlight_refs[]}) |
| `surface.resume.projected` | a returning learner's episode resume card was projected at session start, derived only from the intelligence plane's latest episode + understanding-delta artifacts (CSE-005 §4; ADR-0037) | `episode_ref`, `delta_ref`, `summary` (learner-readable), `last_concept_ref?`, `concepts_touched[]`, `open_confusions[]` ({description, concept_ref}), `days_since` |
| `surface.director.directive` | the Cognitive Director issued a Directive — the cognitive state to enter next and at what pace (CSE-011 §3.2; ADR-0038) | full Directive: `directive_id`, `scale` ("concept" in T1), `target_state` (CSE-011 §3.1), `pacing` ({tempo, dwell_hint_ms, silence}), `intensity`, `focus` ({concept_ref, source_anchor_ref?}), `rationale`, `considered[]` ({alternative_state, rejected_because}), `evidence_refs[]`, `confidence` |
| `surface.director.state.entered` | the learner is judged to have entered a target cognitive state (CSE-011 §6) | `directive_id`, `scale`, `state`, `evidence_refs[]` |
| `surface.director.pacing.set` | pacing/intensity changed without a state change (CSE-011 §6) | `directive_id`, `tempo`, `intensity`, `silence`, `reason` |
| `surface.affect.observed` | an affect/attention signal was recorded — behavioral-inferred or learner-declared; learner-visible, opt-out (CSE-011 §3.3, CSE-005 §7) | `affect_state` ("engaged"\|"curious"\|"frustrated"\|"overloaded"\|"bored"\|"fatigued"\|"confident"), `source` ("behavioral-inference"\|"learner-declared"), `signals[]` (evidence refs), `confidence` |
| `surface.attention.budgeted` | the attention budget was (re)computed (CSE-011 §3.3) | `remaining` ("high"\|"medium"\|"low"\|"depleted"), `session_minutes` |
| `surface.scene.opened` | a composed frame was wrapped as a living Scene with a target state (CSE-012 §5; ADR-0038) | `scene_id`, `frame_ref`, `concept_ref`, `state`, `directive_ref`, `actors[]` (§CSE-012 3.2), `lighting` ({focus_actor_ref, cdl_state, recession[]}) |
| `surface.scene.actor.entered` | a cognitive actor joined the stage (CSE-012 §5) | `scene_id`, `actor` ({actor_id, kind, content_ref, role, provenance_class, can_evolve}), `entrance_shot_ref?` |
| `surface.scene.evolved` | a scene delta mutated a live Scene in place, without a new ask (CSE-012 §3.3) | full scene delta: `delta_id`, `scene_id`, `op` ("actor.enter"\|"actor.transform"\|"actor.exit"\|"lighting.change"\|"reveal"\|"annotate"\|"branch"), `cause` ("director"\|"agent"\|"learner"\|"cinematography"), `payload`, `interaction_ref?` |
| `surface.scene.lighting.changed` | the Scene's focus/recession changed (CSE-012 §4) | `scene_id`, `focus_actor_ref`, `cdl_state`, `recession[]?` |
| `surface.scene.closed` | a Scene retired (topic move / session end) (CSE-012 §5) | `scene_id`, `reason` |
| `surface.shot.planned` | the Cinematographer selected a pedagogical camera move over a Scene (CSE-013 §3; ADR-0039) | `shot_id`, `scene_ref`, `kind` (establish\|semantic-zoom-in/-out\|pan\|spotlight\|reveal\|dissolve\|morph\|split\|merge\|macro-to-micro\|orientation\|rack-focus\|hold), `subject` (actor_id \| null), `intent`, `narration_anchor_ref?`, `reduced_motion` (the discrete realization), `cause` ("director"\|"scene"\|"cinematography"\|"learner") |
| `surface.shot.cut` | a client confirmed a shot's realization (optional; reserved — T1 reuses viewport.changed/lighting.changed) (CSE-013 §4) | `shot_id`, `scene_ref` |
| `surface.intent.expressed` | a learner interaction was interpreted into typed cognitive intent (CSE-014 §4) | `interaction_id`, `kind`, `class` (attend\|mark\|ask\|reason\|express\|navigate\|govern-flow), `cognitive_intent`, `target_anchor_ref?` |

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

**Source–surface projection (CSE M5, CSE-008).** The `surface.source.*` subfamily projects a
Canonical Source Environment into the session — the seam where the source becomes something the
learner stands inside. `surface.source.attached` binds a source version (bytes stay out-of-band:
clients fetch canonical bytes from the gateway source-content route and may prove fidelity by
hashing them against the version's `content_hash` — ADR-0036). `surface.source.viewport.planned`
records the **Semantic Viewport** plan for a frame: an ordered gaze over anchored regions, planned
as a composer role at frame-composition time (one compose→record→render path; blueprint decision).
Each viewport carries its **resolved region** (structural path + page/bbox geometry + the exact
quote), so clients never re-resolve anchors; an anchor that fails to resolve is *skipped, never
mis-highlighted* (CSE-008 §12). `surface.source.highlight.applied` is the typed highlight grammar —
role/amplitude/lifetime/provenance-class over an anchor; CDL owns the optics, the event carries only
semantics. `surface.source.sync.bound` is the **Attention Contract**: narration segments bound to
viewports and highlights, realized by the client choreographer in segment order (timing is a client
projection, ADR-0007; learner scroll cancels pending realization and never fights). Like all
choreography, these carry logical order only — never wall-clock positions.

**The Cognitive Theater — Director + Scene (CSE M7 T1, ADR-0033/0038).** The `surface.director.*`
subfamily makes the missing conductor visible: `surface.director.directive` carries the typed
**Cognitive Directive** — the target cognitive state, pacing, and intensity, with rationale,
rejected alternatives, evidence refs, and confidence (CSE-011 §3.2). The Director *conducts, it
never renders* (ADR-0033 L1): a directive contains no presentation; the client realizes it by
tinting the board to the target state's CDL hue and offering a "why this pace" affordance over the
rationale (a client projection, ADR-0007). In T1 the Director is an **authored pedagogy FSM**, a
pure function of folded signals (mastery, depth-gates, prerequisite descents, affect) — every
directive is deterministic and replay re-derives it identically (CSE-011 §5/§10). The **affect
channel** (`surface.affect.observed` / `surface.attention.budgeted`) is behavioral-inferred in T1,
learner-visible and opt-out (CSE-005 §7); learner-declared check-ins outrank inference when the
interaction grammar lands (M8). The `surface.scene.*` subfamily elevates a composed frame into a
living **Scene** (CSE-012): `surface.scene.opened` wraps `surface.frame.composed` with the frame's
MCCR elements as **actors** and initial **lighting** (one focal actor, siblings recede — CDL);
`surface.scene.evolved` mutates the Scene *in place* via typed scene deltas without a new ask.
Frames are not discarded (ADR-0033 L2): a 1.7.0 log with no scene/director events folds to the
identical frame view. All directives, scenes, actors, deltas, and affect signals are folds — no
wall-clock, no `active_scene_id` in canonical state (ADR-0007/L3).

**The Cognitive Theater — Cinematography + Interaction (CSE M8 T2, ADR-0033/0039).** The
`surface.shot.*` subfamily makes motion a *grammar of understanding*: the Cinematographer (a
composer role, CSE-013 §8) plans pedagogical camera moves over a Scene — `establish` on open
(orient before detail), `spotlight` per narration segment (the camera follows the voice), `hold`
under a `demanding`/silent directive (stillness, ADR-0033 L6). `planShots` is a pure function of
the Scene, directive, and recorded segments — deterministic, replay-safe; selection is pedagogy,
rendering is design (CDL). **Every shot carries its reduced-motion realization** (CSE-013 §6): a
discrete, non-animated form is mandatory and test-enforced — motion is an enhancement over it,
never a requirement. Timing is a client projection over ordered shots + audio (ADR-0007); canonical
state carries the shot *list*, never a pixel timeline. The `surface.intent.expressed` event closes
the **Interaction Grammar** (CSE-014): every learner act is interpreted deterministically into typed
`cognitive_intent` and routed — Mark-class acts (annotate/circle/highlight/pin) evolve the Scene in
place via a learner-caused `surface.scene.evolved` (the evolution channel M7 built, now driven by
the learner — the "audience is also an actor" organ), Ask-class re-frames cognition, Navigate/
Govern-flow re-plan the Director. The learner always wins (ADR-0033 L5): an interaction pre-empts
pending directives and shots.

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
12. `surface.source.attached` for a `source_version_id` precedes any other `surface.source.*`
    event referencing it. `surface.source.viewport.planned` and `surface.source.sync.bound` for a
    `frame_id` follow that frame's `surface.frame.composed` (bindings reference recorded script
    segment ids, so the script precedes the contract). A `surface.source.viewport.changed` with
    `cause:"plan"` follows its plan's `surface.source.viewport.planned`.
13. `surface.scene.opened` with `frame_ref` follows that frame's `surface.frame.composed` (the MCCR
    is the Scene's skeleton, CSE-012 §2); its `directive_ref` follows the referenced
    `surface.director.directive`. `surface.scene.actor.entered`, `surface.scene.evolved`,
    `surface.scene.lighting.changed`, and `surface.scene.closed` for a `scene_id` follow that
    scene's `surface.scene.opened`. `surface.director.state.entered` and
    `surface.director.pacing.set` reference an existing `directive_id`.
14. `surface.shot.planned` with `scene_ref` follows that scene's `surface.scene.opened`; a
    `spotlight` shot's `narration_anchor_ref` references a segment of the frame's recorded script.
    `surface.intent.expressed` for an `interaction_id` follows that interaction's
    `surface.interaction.received`; a learner-caused `surface.scene.evolved`
    (`cause:"learner"`) carries the `interaction_ref` of the interaction that produced it.

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
copies the speculative entry into `frames[]` (status `promoted`, final ordinal). The **episodic
projection** (CSE M6, ADR-0037) is state-affecting: `surface.resume.projected` folds latest-wins
into `resume_card`. The **Theater** subfamily (CSE M7 T1, ADR-0038) is state-affecting:
`surface.director.directive` appends to `director_directives[]` and replaces `latest_directive`;
`surface.director.state.entered`/`surface.director.pacing.set` annotate the referenced directive
record; `surface.affect.observed` appends to `affect_signals[]` and replaces `latest_affect`;
`surface.attention.budgeted` replaces `attention_budget`; `surface.scene.opened` upserts
`scenes[]` by `scene_id`; `surface.scene.actor.entered`/`surface.scene.evolved`/`.lighting.changed`
mutate the matching scene (actors upsert by actor_id, deltas append to its `evolution_log`,
lighting replaces); `surface.scene.closed` marks the scene closed. The **cinematography +
interaction** subfamily (CSE M8 T2, ADR-0039) is state-affecting: `surface.shot.planned` appends
to the matching scene's `shots[]` (a shot list per scene); `surface.intent.expressed` appends to
`expressed_intents[]`; the extended `surface.interaction.received` kinds fold into `interactions[]`
exactly as the ADR-0024 kinds do, and a learner-caused `surface.scene.evolved` appends to the
scene's `evolution_log` (as in T1). The **source
projection** subfamily (CSE M5) is state-affecting: `surface.source.attached` upserts `sources[]`
by `source_version_id`; `surface.source.viewport.planned` upserts `viewport_plans[]` by `plan_id`;
`surface.source.viewport.changed` appends to `viewport_changes[]` (the client derives the current
view from the latest change per source — canonical state records the history, never a "current
pane"); `surface.source.highlight.applied` upserts `source_highlights[]` by `highlight_id`;
`surface.source.highlight.cleared` marks matching highlights `cleared` (they are never removed —
replay-preserving); `surface.source.sync.bound` upserts `sync_bindings[]` by `frame_id`. Non-state
events (`surface.visual.generated`, `surface.simulation.started`, `surface.contribution.dropped`)
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
The **production-hardening** additions (schema_version 1.5.0; ADR-0031) are:
`surface.ask.progress` `{ surface_id, phase, detail }` (latest-wins `ask_progress` fold slice — the
learner-visible phase of an in-flight ask; pure progress projection, no cognition);
the `misconception` MCCR element type (text; the common wrong belief + correction as a first-class
anchor); `key_formula.lines[]` (an optional multi-line LaTeX derivation); and `diagram.kind: "cycle"`.
All additive, forward-compatible, and replay-preserving (1.4.0 logs fold unchanged).
The **source-projection** subfamily (schema_version 1.6.0; CSE-008, ADR-0032/0036) activates in
CSE M5: `surface.source.attached`, `surface.source.viewport.planned`, `surface.source.viewport.changed`,
`surface.source.highlight.applied`/`.cleared`, `surface.source.sync.bound`, plus the
`source_viewport` MCCR element type (a frame element carrying an anchored evidence region —
`{source_version_id, anchor_ref, region, quote}` — beside the distilled anchors; CSE-008 §3.2).
The remaining CSE-008 §8 events (`surface.source.overlay.applied`,
`surface.source.alignment.composed`, `surface.source.media.intent`,
`surface.source.annotation.recorded`) stay declared in CSE-008 and activate with their owning
milestones (living knowledge M9; video/web M10; learner annotations with the CSE-014 interaction
grammar). All additive, forward-compatible, and replay-preserving (1.5.0 logs fold unchanged).
The **episodic-projection** addition (schema_version 1.7.0; CSE-005 §4, ADR-0037) activates in
CSE M6: `surface.resume.projected` — a returning learner's resume card at session start, derived
only from the intelligence plane's latest episode + understanding-delta artifacts (never raw
logs; no artifacts ⇒ no event). Folds latest-wins into `resume_card`. Additive,
forward-compatible, replay-preserving (1.6.0 logs fold unchanged).
The **Cognitive Theater T1** addition (schema_version 1.8.0; CSE-011/012, ADR-0033/0038) activates
in CSE M7: the `surface.director.*` subfamily (`directive`, `state.entered`, `pacing.set`,
`affect.observed`, `attention.budgeted`) and the `surface.scene.*` subfamily (`opened`,
`actor.entered`, `evolved`, `lighting.changed`, `closed`). The Director is an authored FSM (a pure
function of folded signals — deterministic, replay-safe); Scenes wrap frames additively so a 1.7.0
log with no scene/director events folds to the identical frame view (ADR-0033 L2). All additive,
forward-compatible, and replay-preserving (1.7.0 logs fold unchanged).
The **Cognitive Theater T2** addition (schema_version 1.9.0; CSE-013/014, ADR-0033/0039) activates
in CSE M8: the `surface.shot.*` subfamily (`planned`, `cut`) and `surface.intent.expressed`, plus
the extended `surface.interaction.received` grammar (the ~25 CSE-014 kinds) and the two new
`surface.interaction.applied` effects (`scene-evolved`, `annotated`). The Cinematographer is a
composer role (pure `planShots`, every shot carrying a mandatory reduced-motion realization); the
interaction grammar interprets each act into typed `cognitive_intent` and routes Mark-class acts to
learner-caused `surface.scene.evolved` deltas — the Scene evolution channel M7 built, now driven by
the learner. A 1.8.0 log with no shot/intent events folds identically. All additive,
forward-compatible, and replay-preserving.
The **typed frame kind** addition (schema_version 1.10.0; ADR-0055 D6) adds an optional
`kind: "teach" | "practice" | "assessment" | "checkpoint"` to `surface.frame.planned` /
`surface.frame.composed` / `surface.frame.speculation.prepared`, folded onto `CognitiveFrame.kind`.
It replaces the fragile `title.startsWith("practice")` heuristic that carried the practice answer
affordance and grading join. Producers set it at every frame-creation site; the fold and all
clients read `kind` first and fall back to the retired title heuristic **only** for pre-1.10.0 logs
(no `kind`), so old sessions classify identically on replay. Additive, forward-compatible,
replay-preserving (1.9.0 logs fold unchanged).
The **Representation Intelligence** addition (schema_version 1.11.0; CSE-018, ADR-0058) adds
`surface.representation.planned` `{ frame_id, composition: [{element_id, hierarchy, epistemic_role}],
exclusions, plan_kind }`, folded (upsert by frame_id) into the `representations` slice — the RIA's
plan of each element's representational hierarchy + epistemic role over the closed MCCR vocabulary.
R4a emits the **deterministic** plan (parity metadata over the same elements; a frame with no plan
renders identically), so it is purely additive and cannot regress a frame; the model-backed plan
(exclusion reasoning, density verdict, adaptivity) is `plan_kind: "model"` in R4d. Additive,
forward-compatible, replay-preserving (1.10.0 logs fold unchanged).
