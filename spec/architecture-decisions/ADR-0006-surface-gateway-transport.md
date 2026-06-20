# ADR-0006 — Surface Gateway Transport & the Visible Surface

- **Status:** accepted
- **Date:** 2026-06-12
- **Deciders:** product-architecture, runtime-team
- **Supersedes:** —
- **Related:** [ADR-0003 (tech stack)](./ADR-0003-tech-stack.md), [ADR-0005 (infrastructure adapters)](./ADR-0005-infrastructure-adapters.md), [SRF-001 (cognitive-surface-runtime)](../surface/cognitive-surface-runtime.md), [SRF-005 (surface-streaming-sync-protocol)](../surface/surface-streaming-sync-protocol.md), `apps/api`, `apps/web`, `packages/surface`

## Context

Phases 1A–2B produced a complete, governed, replayable cognitive runtime whose only manifestation
is a one-shot terminal script (`pnpm demo`). The Cognitive Surface — *"the primary surface through
which the Cognitive Operating System makes understanding visible, navigable, and alive"*
(`spec/cognitive_surface/cognitive-whiteboard-system.md`) — is still invisible. Phase 2C makes it
visible and live in a browser without violating the architectural laws.

The runtime is already prepared for this: `foldSurfaceEvents` is a pure, browser-safe function;
every `surface.*` event payload is plain-JSON-serializable; the `EventBus` exposes both live
`subscribe` (push) and `replay` (snapshot). The only missing thing is a **boundary** — a way for
`surface.*` events to leave the runtime process and reach a client, and for client intents to
return through the governed dispatch path. ADR-0003 already committed to an "HTTP + WebSocket/SSE
edge" and an "API gateway adapter"; this ADR resolves the open choices for the first surface
gateway and records the principles that keep the client a *projection* forever.

## Decision

1. **Transport: Server-Sent Events (down) + HTTP POST (up), over `node:http` — zero new runtime
   dependencies.** The server streams the canonical `surface.*` (and `model.*`) event log to the
   client as SSE frames; the client sends typed intents back as HTTP POST. SSE is chosen over
   WebSocket because it (a) requires no dependency (`ws` would be one), (b) gives a clean,
   one-directional **events-down / governed-intents-up** separation that mirrors the runtime's own
   shape, and (c) is natively replay-friendly: each SSE frame's `id:` is the event `sequence`, and
   browser `EventSource` resumes with `Last-Event-ID`, which the gateway honors by replaying from
   that sequence. Bidirectional duplex (WebSocket/WebTransport) is deferred until live multi-writer
   collaboration genuinely needs it.

2. **The gateway lives in `apps/api`; the client in `apps/web` (Vite + React).** The gateway is an
   API surface (per the code-ownership map), not a substrate package. `apps/web` uses Vite + React.
   Apps are **leaves** — nothing in the substrate depends on them — so React/Vite tooling never
   touches the dependency-light doctrine that governs `packages/`. Heavy UI tooling is contained to
   the leaf, exactly as ADR-0005 contains heavy infrastructure clients to adapters.

3. **The Surface is a Runtime, not a UI — and rendering is provider-agnostic, forever.** The browser
   renders *only* from `CognitionBlock`s and `surface.*` events folded into `SurfaceState`. It MUST
   NOT know, and MUST NOT be able to tell, whether an artifact originated from Gemini, Claude,
   memory, a research agent, the supervisor, a simulation engine, a human, or a future provider.
   This is operationalized by a **block-renderer registry keyed by `block_type`** (never by
   provider or model): adding a modality or a new producer is a registry entry, never a rewrite. An
   unrecognized `block_type` renders a typed placeholder (forward-compatible, mirroring the fold).

4. **Layout and composition are a projection concern, never canonical state.** Per SRF-001 the
   canonical record is the `surface.*` event log plus the world-state graph; *"rendering state
   (layout, viewport, fold/expand) never enters the canonical record."* The client arranges blocks
   into **regions** (a timeline rail, a cognition stream, an inspector) as one **viewport** — the
   first *block-document/stream* projection of the three documented manifestations (scene-graph,
   block-document, dataflow-DAG, all *"different viewports into the same cognitive state"*, F16 §9).
   No `SurfaceNode`/`SurfaceRegion`/`SurfaceLayout` primitives enter the canonical model in this
   phase; doing so would contradict the law and add speculative complexity. Spatial scene-graph
   layout, semantic zoom, and multi-pane docking are deferred to the whiteboard phase and carry
   **zero retrofit risk** precisely because layout is non-canonical.

5. **A cognitive environment, not a prompt→response exchange.** The gateway hosts **persistent,
   long-lived** sessions; the SSE stream stays open and the surface keeps evolving. Client intents
   travel as a **typed command envelope** (`POST /api/surface/:id/command` with a discriminated
   union — `ask | expand | close`, extensible) rather than fixed verb endpoints, so the environment
   "receives many command types over time" and future commands (contribute, annotate, branch,
   collaborate) extend the union without reshaping the transport. The transport bakes in no
   single-prompt, single-response, or single-screen assumption.

6. **The boundary is a governed trust boundary; the client is never the source of truth.** Every
   mutating command routes through `ProductRuntimeDispatcher`, which already evaluates the
   `GovernanceEngine` (GOV-P01 trust, GOV-P02 classification) before any state change. The gateway
   adds only command-shape validation and session resolution; it cannot bypass the governed path.
   The client holds a *replica* folded from the stream and proposes intents — it never writes
   canonical state. **Replay equivalence is a contract:** the client's fold of the streamed log is
   byte-identical to the server's `session.state()` for the same event sequence (SRF-005 §6).

7. **Boundary observability via a separate `gateway.*` event family.** Connection lifecycle
   (`gateway.stream.attached`, `gateway.stream.detached`) is emitted as **recorded-observation**
   (ephemeral, non-replayable), owned by `gateway`. It is a *separate family* so the canonical
   `surface.*` fold never sees ephemeral connection events — determinism of `SurfaceState` is
   preserved.

## Consequences

**Positive:** the runtime becomes witnessable end-to-end across a real network boundary with zero
new runtime dependencies in the gateway; the *UI-is-a-projection* law is proven, not just asserted;
the same pure fold runs in Node and the browser; the command envelope and renderer registry make
multimodal, multi-agent, and collaborative futures additive rather than rewrites; the substrate
stays dependency-light because heavy UI tooling is confined to a leaf app.

**Negative / trade-offs:** SSE is one-directional (server→client), so true low-latency duplex
(live cursors, co-editing) will require a later transport (WebSocket/WebTransport) behind the same
SRF-005 contract; `apps/web` adds React/Vite/happy-dom to the workspace devtool surface (contained
to the leaf, covered by the existing `verify` gates); a single-process in-memory gateway is not yet
horizontally scalable (durable/distributed session hosting is a later phase, behind the same API).

**Neutral:** the gateway is the first `EventTransport`-shaped surface boundary; swapping SSE for
another transport is a new server module that must satisfy the SRF-005 contract and its conformance
expectations, with no change to `apps/web`'s fold-and-render client beyond the connection adapter.
