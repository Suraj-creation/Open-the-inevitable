---
name: surface-streaming-sync-protocol
spec:
  id: SRF-005
  title: Surface Streaming & Sync Protocol — Phase 2C (The Visible Surface)
  domain: surface
  status: draft
  owner: product-architecture
  last_reviewed: 2026-06-12
  upstream_dependencies:
    - surface/cognitive-surface-runtime
    - surface/surface-event-architecture
    - surface/surface-timeline-engine
    - product/product-cognition-runtime
    - events/event-taxonomy
    - protocols/cognitive-event-protocol
    - kernel/governance-kernel
    - product/features/F09-living-universe-experience
    - product/features/F16-cognitive-surface
    - product/features/F07-realtime-cognitive-orchestration
  downstream_dependencies:
    - apps/api
    - apps/web
    - packages/surface
  related_protocols:
    [cognitive-event-protocol, cognition-packet-protocol, reasoning-trace-protocol]
  related_events:
    [surface.created, surface.timeline.updated, surface.block.generated, surface.block.modified, surface.agent.contributed, surface.reasoning.recorded, surface.explanation.expanded, surface.session.closed, gateway.stream.attached, gateway.stream.detached]
  related_runtime_systems:
    [cognitive-surface-runtime, universal-cognitive-bus, product-cognition-runtime, world-state-graph]
  related_governance_systems: [governance-kernel, capability-envelope, context-lease, intent-lease]
  related_observability_systems: [cognitive-observability, reasoning-trace, otel-edge]
  semantic_tags:
    [phase-2c, cognitive-surface, visible-surface, streaming, sync, sse, projection, replay, cognitive-environment, provider-agnostic, gateway]
  canonical_references:
    - surface/cognitive-surface-runtime#2
    - product/features/F16-cognitive-surface#9
    - spec/cognitive_surface/cognitive-whiteboard-system
    - spec/architecture-decisions/ADR-0006-surface-gateway-transport
---

# Surface Streaming & Sync Protocol

## 1. Purpose

This protocol defines the **boundary** that makes the Cognitive Surface visible: how the canonical
`surface.*` event log leaves the runtime process and reaches a client, and how a client's intents
return through the governed dispatch path. It is the contract behind the first surface gateway
(`apps/api`) and the first browser viewport (`apps/web`).

The surface runtime (SRF-001) already turns substrate primitives into a deterministically-replayable
`SurfaceState`. This spec adds nothing to the canonical model; it specifies the *transport and sync
semantics* under which a remote viewport renders that state live and proposes changes — without ever
becoming the source of truth. It is the realization of *"the primary surface through which the
Cognitive Operating System makes understanding visible, navigable, and alive"*
(`spec/cognitive_surface/cognitive-whiteboard-system.md`) as a live, networked environment.

## 2. Philosophy

- **The Surface is a Runtime, not a UI.** The client is a **viewport** — one of many projections of
  the same cognitive state (scene-graph, block-document, dataflow-DAG; F16 §9). It renders the fold;
  it never owns the truth. The runtime is the product.
- **A cognitive environment, not a prompt→response exchange.** A learner *enters* a persistent,
  living surface and stays. The stream is continuous; cognition keeps unfolding. Intents are many
  command-types over time, not one question and one answer.
- **Provider-agnostic forever.** The client renders from typed `CognitionBlock`s and `surface.*`
  events. It cannot tell Gemini from Claude from memory from a research agent from a human. Origin
  is provenance metadata, never a rendering branch.
- **Layout is projection, never canonical.** Regions, viewports, and arrangement live in the client.
  The canonical record stays the `surface.*` log plus world-state (SRF-001 §2).
- **Replay equivalence is the safety property.** The client's fold of the streamed log equals the
  server's `session.state()` for the same event sequence. Streaming is replay over a wire.
- **The boundary is governed.** Crossing the network is crossing a trust boundary. Every mutation is
  evaluated by the governance kernel before it touches state; the gateway cannot bypass it.

## 3. Architecture

```
   Browser (apps/web)                         Surface Gateway (apps/api)            Runtime
 ┌────────────────────┐                      ┌───────────────────────────┐     ┌──────────────┐
 │ EventSource ───────┼──GET /stream (SSE)──▶│ replay snapshot + subscribe│◀────│  EventBus    │
 │   accumulate events│◀───id:seq data:evt───┤  (surface.> , model.>)     │     │ (surface.*)  │
 │   foldSurfaceEvents │                      │                           │     └──────┬───────┘
 │   → SurfaceState    │                      │ gateway.stream.attached/   │            │
 │   render viewport   │                      │   detached (observation)  │            │
 │                     │                      │                           │     ┌──────▼───────┐
 │ command ───────────┼──POST /command──────▶│ validate → resolve session │────▶│ Surface      │
 │  {ask|expand|close} │◀───{ok|error}────────┤  → SurfaceSession.* (gov)  │     │ Session +    │
 └────────────────────┘                      └───────────────────────────┘     │ governed     │
        viewport (projection)                   transport + trust boundary       │ dispatch     │
                                                                                 └──────────────┘
```

The gateway is stateless about *rendering* and authoritative about *hosting*: it owns the live
`SurfaceSession`s and the bus; the client owns only a folded replica and the choice of viewport.

## 4. Primitives

### 4.1 Surface snapshot

The full ordered event slice needed to reconstruct a surface from scratch:
`bus.replay({ subject: "surface.>" })` filtered to one `surface_id`, plus its `model.*` provenance
events. Delivered as the opening frames of a stream so a fresh client folds to current state with no
special-casing.

### 4.2 Stream frame

One SSE frame carrying one `CognitiveEvent`:

```
id: <event.sequence>
event: surface
data: <JSON.stringify(CognitiveEvent)>

```

`id` is the bus `sequence` (monotonic, gap-free per bus). The client tracks the last `id` and
resumes with `Last-Event-ID` after a disconnect. `event:` is the SSE event name (`surface` or
`gateway`); the cognitive `event_type` lives inside the JSON.

### 4.3 Surface command envelope

The **only** mutation channel. A discriminated union, extensible by adding variants:

```ts
type SurfaceCommand =
  | { type: "ask"; input: SurfaceAskInput }
  | { type: "expand"; block_id: string; layer: number }
  | { type: "close"; reason?: string };
// future, additive: "contribute" | "annotate" | "branch" | "collaborate" | …
```

A command is a *proposal*; the runtime decides. Every command resolves to a governed
`SurfaceSession` method (SRF-001 §6) and returns a typed result or a typed `CosError`.

### 4.4 Stream cursor

`{ surface_id, last_sequence }` — the client's resume position. The gateway uses it to replay from
`last_sequence + 1`; if that point is no longer retainable, it re-snapshots (§6.3).

### 4.5 Out-of-band media (Phase 2D)

The SSE stream carries **JSON events only** — never binaries. Narration audio (and future media)
is fetched out-of-band: `GET /api/surface/:id/media/:artifactId` returns the bytes (e.g. `audio/wav`)
from the gateway's process-local `MediaStore`. The choreography event (`surface.narration.segment`)
carries only the reference + duration (`voice {artifact_id, content_ref, duration_ms, provider_id}`),
so replay equivalence (§6.2) is unaffected by media. Playback timing is a **client projection**: the
Choreographer uses the audio's `ended`/`currentTime` (or a reading-time estimate when text-only) to
advance — it is never baked into the canonical log (ADR-0007). Durable cross-process media
persistence is deferred; the event log still replays the structure and timing exactly.

### 4.6 Streaming content deltas (S-UCS)

To make generation visible as it happens, the runtime may emit `surface.block.delta` frames
(`block_id`, `seq`, `text_delta`) over the **same** SSE channel before a block's whole-block
`surface.block.generated`. They are ordinary `surface.*` frames — no new transport, no special-casing.
The client fold accumulates them into a **transient** `streaming_blocks` buffer that the whole-block
event clears, so the **settled** state is identical whether or not deltas were streamed:
`fold([delta…, generated]) ≡ fold([generated])`. Replay equivalence (§6.2) therefore holds for every
prefix — a prefix ending mid-stream renders the partial buffer; the completed prefix renders the
canonical block. Deterministic/replay mode may omit deltas entirely (whole block only). See ADR-0028.

### 4.7 Cognitive Frame frames & element deltas (UCS, ADR-0030)

Cognitive Frames (SRF-001 §4.7) cross the same boundary as ordinary `surface.*` frames — no new
transport. A frame's layout (`surface.frame.planned`), full MCCR (`surface.frame.composed`), separate
narration script (`surface.narration.script.produced`), and image decision (`surface.image.decided`)
are streamed verbatim and folded by the same `foldSurfaceEvents`. To make a frame *materialize*
progressively, the runtime may emit `surface.frame.element.delta` (`frame_id`, `element_id`, `seq`,
`text_delta`) before `surface.frame.composed`; the client fold accumulates them into a **transient**
`streaming_frame_elements` buffer that the compose event clears, so the settled state is identical
whether or not deltas streamed: `fold([element.delta…, composed]) ≡ fold([composed])` (mirrors §4.6).
**Look-ahead** frames (`surface.frame.speculation.prepared`) are streamed for the Observatory but are
folded into the separate `speculative_frames[]` slice — the viewport never renders them as on-screen
state until a `surface.frame.promoted` frame copies them into `frames[]`; an
`surface.frame.speculation.invalidated` frame leaves them provably absent from `frames[]`. **Which frame
is on screen is a client projection** over the Choreographer cursor (ADR-0007), never a streamed pointer.

## 5. Protocols and Contracts

- **Event envelope:** frames carry unmodified `CognitiveEvent`s (protocols/cognitive-event-protocol);
  payloads are plain-JSON and cross the wire intact.
- **Surface events:** the gateway streams the `surface.*` family verbatim (SRF-002). It adds no
  surface events and rewrites none; the client folds with the **same** `foldSurfaceEvents` the
  runtime uses.
- **Governed dispatch:** every command crosses through `ProductRuntimeDispatcher` (GOV-P01/P02)
  before any state mutation; the gateway performs only shape-validation and session resolution.
- **Gateway events:** connection lifecycle uses the `gateway.*` family (§7) as recorded-observation;
  it MUST NOT be folded into `SurfaceState` (it is a different family; the surface fold ignores it).
- **No client-authored truth:** the client never publishes to the bus and never constructs canonical
  blocks; it renders the fold and POSTs intents.

## 6. Runtime Semantics

### 6.1 Connection lifecycle

```
attach ──(snapshot frames)──▶ live ──(incremental frames)──▶ … ──detach/close──▶ closed
```

1. **attach** — `GET /api/surface/:id/stream`: set SSE headers; emit `gateway.stream.attached`;
   replay the snapshot (§4.1) as frames in `sequence` order; then `bus.subscribe("surface.>" )` and
   forward each new event as a frame. If `Last-Event-ID` is present, replay from `last+1` instead of
   the full snapshot (§6.3).
2. **live** — incremental frames flow as the session produces events (asks, expansions, timeline
   updates). The stream stays open; the environment keeps evolving.
3. **detach** — client disconnect or `close`: unsubscribe; emit `gateway.stream.detached`. Detaching
   a viewport never closes the surface session (a surface outlives its viewers).

### 6.2 Replay equivalence (the safety property)

For any surface and any prefix of its event log, the client computed
`foldSurfaceEvents(receivedFrames, surfaceId)` MUST deep-equal the gateway's
`session.state()` for the same prefix. Streaming is therefore replay across a boundary: the fold is
the single shared truth function (SRF-001 §6.2). This is a tested invariant (§11). It extends to
Cognitive Frames (UCS, ADR-0030): `fold([planned, composed]) ≡ fold([composed])`,
`fold([element.delta…, composed]) ≡ fold([composed])`, an invalidated speculative frame is absent from
`frames[]` for every prefix, and a promoted speculative frame re-folds byte-identically.

### 6.3 Resume and gap handling

On reconnect the client sends `Last-Event-ID = last_sequence`. The gateway replays from
`last_sequence + 1`. If a gap is detected (client's last id precedes the earliest retainable event,
or sequence is non-contiguous), the gateway sends a **re-snapshot directive** and replays the full
surface slice; the client discards its replica and re-folds. No partial/ambiguous state is ever
rendered.

### 6.4 Command semantics

Commands are processed one at a time per surface (the session is the serialization point).
`ask`/`expand` produce `surface.*` events that flow back over the *same* stream — the client sees
its own intent's effects as ordinary frames, never as a special-cased local mutation. `close`
transitions the surface to `closed`; subsequent commands fail-closed.

### 6.5 Determinism

In seeded mode (`ManualClock` + `SeededIdGenerator`) a scripted command sequence produces an
identical event log and therefore an identical client replica across runs — the basis of the
deterministic gateway test. Live mode uses `SystemClock` + `CryptoIdGenerator`; determinism of the
*fold* is independent of time/entropy.

## 7. Event and State Transitions

The `surface.*` family and its fold transitions are owned by SRF-001 §7 / SRF-002 and are unchanged.
This spec introduces one new family for **boundary observability only**:

| Event | Family | Replay | Meaning |
|---|---|---|---|
| `gateway.stream.attached` | `gateway.*` | recorded-observation | a viewport attached to a surface stream |
| `gateway.stream.detached` | `gateway.*` | recorded-observation | a viewport detached (disconnect/close) |

`gateway.*` is **never** folded into `SurfaceState` (separate family; the surface fold filters on
`surface.`). It exists so the trust boundary is observable, not to alter canonical state.
Registration: `spec/events/event-taxonomy.md`, `spec/indexes/event-index.md`, and
`packages/events/src/family-registry.ts` (owner `gateway`, retention `1d`, recorded-observation,
internal).

## 8. Observability

- Connection attach/detach is observable via `gateway.*` (count of live viewports, attach/detach
  rate, resume vs full-snapshot ratio).
- Every streamed block already carries its OTel `trace_id` in provenance (SRF-001 §8); the boundary
  changes nothing — a block rendered in the browser is searchable in any OTel backend by the same id.
- The client surfaces a connection status (connecting / live / reconnecting / re-snapshotting) so
  the human can see the boundary's health; this is rendering state and stays out of the canonical
  record.
- Reasoning traces remain first-class: `surface.reasoning.recorded` frames let the viewport show
  *why* the supervisor routed as it did (F16 §5.4).

## 9. Governance and Security

- **The gateway is a trust boundary.** Each command is bound to a `SurfaceSession`, which is bound to
  a learner `OnboardingSession` (identity + capability envelope + leases). Mutations pass GOV-P01
  (trust) and GOV-P02 (classification) inside `ProductRuntimeDispatcher` before any state change; a
  blocked command produces no block and no surface event and returns a typed governance error.
- **Classification on the wire:** the stream forwards events at their existing classification; a
  deployment that exposes the gateway beyond a trusted boundary MUST filter frames by the viewer's
  clearance. Phase 2C targets a single-trust local/dev boundary; per-viewer classification filtering
  and authenticated multi-tenant identity are declared future work (non-goal below), modeled by the
  existing capability-envelope / intent-lease primitives.
- **Fail-closed:** an expired/revoked lease, an unknown surface, or a malformed command is rejected;
  the stream for a closed surface terminates after `surface.session.closed`.
- **No bypass:** the gateway has no path to mutate state except through governed session methods.

## 10. Failure Semantics

| Failure | Behavior |
|---|---|
| Client disconnects | gateway unsubscribes, emits `gateway.stream.detached`; session persists |
| Reconnect with stale `Last-Event-ID` | replay from `last+1`; on gap, re-snapshot directive + full replay |
| Malformed command body | `400`-class typed error (`E_SURFACE_GATEWAY`); no state change |
| Unknown surface id | typed not-found error; stream/command rejected |
| Governance blocks a single-dispatch command (`expand`) | typed governance error returned; zero events; viewport unchanged |
| Governance blocks dispatches within an `ask` cycle | the cycle **degrades** (per SRF-001 §10): the command returns success but the gated agents produce **zero blocks** and no agent events; degradation is observable, the environment stays alive |
| Session method fails at host | typed error returned; ask continues degraded per SRF-001 §10 |
| SSE write fails mid-stream | treated as detach; client reconnects and resumes/re-snapshots |
| Command after close | fail-closed typed error |

No retries or durable buffering in Phase 2C; durable/distributed session hosting and at-least-once
delivery belong to a later phase behind this same contract.

## 11. Testing and Validation

In-process (Node/Vitest) is the deterministic gate; no browser required:

- **Snapshot fold equivalence:** attach after an `ask`; fold the received frames; deep-equal the
  gateway's `session.state()`.
- **Live increment:** attach, then issue a command; assert the new `surface.*` frames arrive in
  `sequence` order and fold to the updated state.
- **Resume:** disconnect after N events, reconnect with `Last-Event-ID = N`; assert frames `N+1…`
  arrive with no gaps or duplicates and the replica converges.
- **Re-snapshot on gap:** reconnect with an unretainable `Last-Event-ID`; assert a full re-snapshot
  and a converged replica.
- **Governed boundary:** an `ask` from an untrusted session (trust_level 0) degrades through the
  governed path — the surface gains zero agent blocks (`explanation`/`practice`); a blocked
  single-dispatch `expand` returns a typed governance error.
- **Provider-agnostic render (apps/web):** the same `SurfaceState` renders identically regardless of
  which model produced the blocks (block-type registry keys on `block_type`, never provider).
- **Command envelope extensibility:** an unknown command `type` is rejected with a typed error
  without affecting state (forward-compatible boundary).
- **Cognitive Frame replay (UCS, ADR-0030):** attach mid-composition and fold the received frames;
  deep-equal the gateway's `session.state()`. Assert `fold([planned, composed]) ≡ fold([composed])` and
  `fold([element.delta…, composed]) ≡ fold([composed])`; a prepared-then-invalidated speculative frame
  is absent from `frames[]` for every prefix; resume across an `element.delta` boundary converges.

## 12. Evolution Strategy

- **Duplex transport:** WebSocket/WebTransport behind this same contract when live multi-writer
  collaboration (cursors, co-editing) needs server↔client duplex; the fold-and-render client is
  unaffected beyond its connection adapter.
- **Per-viewer classification + auth:** authenticated, multi-tenant identity at the boundary with
  frame-level classification filtering, expressed through capability envelopes and intent leases.
- **Durable / distributed hosting:** session hosting backed by a durable event store and a
  distributed bus (ADR-0005 transports) so sessions survive restart and scale horizontally; the API
  and replay equivalence are unchanged.
- **Additional viewports:** scene-graph (spatial, semantic zoom) and dataflow-DAG projections as new
  clients over the same stream; layout stays non-canonical.
- **Additional commands:** `contribute`, `annotate`, `branch`, `collaborate` as additive envelope
  variants, each resolving to a governed session method.
