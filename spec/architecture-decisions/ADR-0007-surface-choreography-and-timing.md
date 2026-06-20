# ADR-0007 — Surface Choreography & Timing in an Event-Sourced Surface

- **Status:** accepted
- **Date:** 2026-06-14
- **Deciders:** product-architecture, runtime-team
- **Supersedes:** —
- **Related:** [ADR-0006 (surface gateway transport)](./ADR-0006-surface-gateway-transport.md), [SRF-001 (cognitive-surface-runtime)](../surface/cognitive-surface-runtime.md), [SRF-002 (surface-event-architecture)](../surface/surface-event-architecture.md), [SRF-004 (multimodal-provider-abstraction)](../surface/multimodal-provider-abstraction.md), [SRF-005 (surface-streaming-sync-protocol)](../surface/surface-streaming-sync-protocol.md), [F09](../product/features/F09-living-universe-experience.md), [F16](../product/features/F16-cognitive-surface.md), `packages/surface`, `apps/web`

## Context

The visible surface (ADR-0006) renders `SurfaceState` correctly but **statically**: blocks arrive as
a list, nothing is synchronized, and attention is not directed. A deep product-experience review
(including a live study of OpenMAIC) found that "watching cognition unfold" requires a
**choreography layer** — timed narration, attention-directing spotlights, staged reveal, and visible
agent presence — synchronized so that voice, text, highlights, and agent activity move together.

OpenMAIC achieves this with a deterministic **action script** (speech / spotlight / reveal /
advance) replayed by a client playback engine — but it bakes the lesson at generation time, with no
world-state, provenance, governance, or adaptivity. Our surface must gain the same *grammar of
synchronized attention* **without** abandoning the architectural laws: the `surface.*` event log
remains the single source of truth, `foldSurfaceEvents` remains the replay primitive, and the client
remains a projection that owns no truth (replay equivalence, SRF-005 §6).

The central tension this ADR resolves: **how does time/pacing live in an event-sourced, replayable
model without breaking replay equivalence?** A naive design would bake wall-clock playback positions
into events, making `fold(events)` depend on *when* it ran — destroying determinism.

## Decision

1. **Choreography is expressed as governed `surface.*` events, not a separate frozen script.** Three
   additive subtypes form the choreography sub-family (SRF-002, schema_version 1.1.0):
   `surface.narration.segment` (a unit of spoken/visible narration, optionally carrying a focus
   directive and an out-of-band `voice` artifact reference), `surface.focus.changed` (directed
   attention — "look here now"), and `surface.presence.updated` (an agent's visible activity state).
   They are produced only on the governed dispatch path; a governance-blocked dispatch emits none.

2. **Events record logical order and durations — never a playback clock.** A narration segment
   carries `sequence` (monotone logical order) and, when voiced, `voice.duration_ms`. It does **not**
   carry "play at t=4200ms" or any wall-clock position. `foldSurfaceEvents` therefore stays a pure
   function of the event sequence: the folded `narration`/`focus`/`presence` slice is byte-identical
   regardless of when or how it was played.

3. **The animation schedule is a client-side projection, not canonical state.** A client
   **Choreographer** (in `apps/web`, mirroring OpenMAIC's PlaybackEngine but reading *our* folded
   state + ordered cues) derives the playback timeline from segment order plus **audio `currentTime`
   as ground truth** (exactly as OpenMAIC uses speech duration to pace progression). It owns a
   transport (play / pause / scrub / speed / auto-play) and a live-vs-replay mode. None of this
   enters the event log — consistent with SRF-001 ("rendering state never enters the canonical
   record") and ADR-0006 (layout/viewport are projection concerns).

4. **Audio (and future media) binaries never enter events or world-state.** A narration segment's
   `voice` field carries `{artifact_id, content_ref, duration_ms, provider_id}` — a reference, never
   bytes (SRF-004 already mandates this). Bytes are delivered **out-of-band** via a gateway media
   route (`GET /api/surface/:id/media/:artifactId`); the SSE stream keeps carrying JSON events only.

5. **Non-deterministic media is recorded for replay, mirroring the D3 model seam.** A `VoiceProvider`
   that is `deterministic:false` (e.g. Gemini) has its artifact reference recorded in the event log
   (via `surface.visual.generated` + the segment's `voice` ref). On replay the Choreographer resolves
   audio by `content_ref` from the media store and **never re-calls the provider** — the same
   record-before-use discipline `RecordingModelRuntime` applies to model outputs (D3). The
   deterministic `NullMultimodalProvider` needs no recording.

6. **Agents become first-class visible entities via presence, not via a blackboard (yet).**
   `surface.presence.updated` is the minimal pub/sub seam: any cognitive unit can announce its
   activity (idle/thinking/contributing/speaking) and contribute blocks, and the surface renders it.
   Full F07 blackboard arbitration and `surface.agent.disagreed` remain deferred; the presence seam
   does not block them.

7. **Dynamic generation, deterministic replay — they are not in tension.** Narration is voiced from
   content **generated live, on demand** by model-backed cognitive units (Gemini in production;
   `DeterministicMvpUnit` is only an offline/no-key fallback), and from interactive deepening
   (`expand`) — never from a script frozen at generation time. The learner can interject at any
   moment and the surface re-generates and re-narrates. Replay stays exact because every model
   output is recorded (D3); the choreography events that result are then folded like any other.
   "Not deterministic" describes *generation* (live, adaptive); replay remains byte-exact. **Static
   pre-generation of all content (the OpenMAIC deck model) is an explicit non-goal.**

## Consequences

**Positive:** the surface gains synchronized, attention-directed, multi-agent cognition while
remaining fully replayable and governed; replay equivalence is preserved by construction (no clock in
truth); the choreography events are additive, so older folds keep working (forward-compatible fold);
the client Choreographer is swappable and testable as a pure function of `(state, cursor, audio-time)`;
voice/media stay out-of-band, so the canonical record and determinism are untouched; the design is a
clean projection of the **same** state the spatial Living-Canvas and Living-Document manifestations
will later consume.

**Negative / trade-offs:** the client must reconcile live-arrival pacing with audio durations (a
Choreographer state machine, not free); non-deterministic voice requires a media store + recording
discipline to keep replay exact; perfectly tight word-level voice↔text sync is not guaranteed —
pacing is per-segment (segment audio duration is ground truth), matching OpenMAIC's approach and
avoiding a dependency on provider word-timestamps.

**Neutral:** timing precision is a client concern behind the SRF-005 contract; a future transport or
a richer per-word sync can be added without changing the event model or the fold.
