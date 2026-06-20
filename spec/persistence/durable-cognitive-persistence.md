```yaml
spec:
  title: Durable Cognitive Persistence
  domain: persistence
  status: draft
  owner: runtime-team
  last_reviewed: 2026-06-18
  upstream_dependencies:
    - events/event-taxonomy
    - protocols/cognitive-event-protocol
    - replay/deterministic-replay
    - interop/infrastructure-adapters
  downstream_dependencies:
    - surface/surface-streaming-sync-protocol
    - evolution/shadow-testing
    - memory/memory-tiers
  related_protocols:
    - cognitive-event-protocol
  related_events: []
  related_runtime_systems: [event-bus, world-state-graph, tiered-memory, surface-session]
  related_governance_systems: [governance-kernel]
  related_observability_systems: [cognitive-observability]
  semantic_tags: [persistence, durability, event-sourcing, replay, recovery, adapters]
  canonical_references:
    - next-generation-cognitive-operating-system-blueprint#3.2
    - architecture-decisions/ADR-0008-durable-persistence
```

# Durable Cognitive Persistence (DPS-001)

## Purpose

Give the cognitive substrate a **persistent existence independent of any single process**. Today the
event bus, world-state graph, memory tiers, and out-of-band media are all in-memory: a process
restart is total data loss. That makes the COS's own invariants — event sourcing, replay, temporal
cognition, and *persistent cognitive memory of each learner* — true only within one process lifetime.
This spec defines how the source-of-truth artifacts are durably persisted so the system can stop,
restart, and reconstruct exactly what it knew.

This is the structural realization of the constitution's §2 law *"the COS is a substrate, not a
product … the substrate never depends on a manifestation"*: a substrate that vanishes with the web
process has no independent existence. Durability is the floor beneath every later phase (continuity,
digital twin, governed self-evolution) and every future manifestation (a second surface must attach
to the *same* persisted substrate state, not its own ephemeral world).

## Principle — the event log is the source of truth; everything else is a replay projection

The substrate is already event-sourced: `SurfaceState` is a pure fold of the `surface.*` event log
(`foldSurfaceEvents`), and world-state/memory are derived from typed deltas/mutations that flow as
events on the same bus. Therefore **durability reduces to persisting two things**:

1. **The event log** — the append-only, sequence-ordered record of every published `CognitiveEvent`.
   World-state, memory, and surface state need no separate durable store for *correctness*: they are
   deterministic projections of the log and are reconstructed by replaying it. (Durable world-state
   snapshots and a durable memory backend remain available as *optimizations* and are layered later;
   they are not required for cross-process reconstruction.)
2. **Out-of-band media** — narration audio bytes that, by mandate (SRF-004/ADR-0007), never enter
   events or world-state. Because they are not in the log, they cannot be re-derived and must be
   persisted separately, keyed by `artifact_id`.

Persistence is a **sink**, never part of the canonical record: persisting an event does not emit a new
event, mutate it, or change ordering. Replaying the durable log re-invokes nothing external —
model/tool outputs are already in the log as `model.output.recorded` events (D3, the Model Invocation
Protocol), so reconstruction is deterministic and provider-free.

## Relationship to the determinism ladder (replay/deterministic-replay)

The determinism ladder (D0–D4) governs the *fidelity* of reconstruction; this spec governs its
*durability*. D0 already requires "the event log preserved" — durable persistence makes "preserved"
**literal and cross-process**, rather than an in-memory lifetime assumption. With the durable log in
place, D0–D3 hold across restarts and over time; the ladder's higher rungs (shadow-testing, evolution
replay) become buildable because a durable recorded history now exists to replay against.

## Architecture — pure-Node file backend behind the existing contracts (first cut)

Per ADR-0008, the first durable backend is a **pure `node:fs` file store** — zero native or
third-party dependencies, fully offline, Windows-safe — sitting behind the existing
`@inevitable/contracts` interfaces. The in-memory adapters remain the **reference semantics** and the
default; durability is opt-in via a single composition-root switch. Production backends
(Postgres/NATS JetStream per ADR-0003) are layered later behind the *same* contracts, with no
vendor type crossing the adapter boundary (ADR-0005) — the substrate-independence law makes them
swappable.

- **`FileEventTransport implements EventTransport`** (`@inevitable/adapters`): append-only JSONL,
  per-subject monotonic sequence, ordered subject-matched `replay(subject, fromSequence)`. Validated
  by the existing `runEventTransportConformance` harness — the file backend is correct iff it passes
  the same suite the in-memory reference passes.
- **Durable surface log**: the gateway mirrors every event published on a surface's bus to a
  per-surface JSONL file (`<dir>/surfaces/<surface_id>/events.jsonl`) via a `>` subscription. The
  bus stays the live in-process truth; the file is the cross-process truth.
- **`FileMediaStore`**: narration bytes written to `<dir>/media/<artifact_id>` (+ a sidecar mime
  type); served by the gateway media route after a restart.

Layout:

```
<COS_PERSIST_DIR>/
  surfaces/<surface_id>/events.jsonl   # append-only, sequence-ordered CognitiveEvents
  surfaces/<surface_id>/meta.json      # goal + seed (enough to identify/resume the surface)
  media/<artifact_id>                  # out-of-band audio bytes (+ .mime sidecar)
```

## Recovery / resume semantics

On restart, a surface is reconstructed **read-side** by loading its durable log and folding it:
`foldSurfaceEvents(replay(durable log).filter(surface.*), surface_id)` reproduces the pre-restart
`SurfaceState` byte-for-byte; the SSE stream is served by replaying the same persisted events
(frame `id` = the event's original bus `sequence`, so `Last-Event-ID` resume still holds); media
resolves from disk. **Live write-continuity after restart** — rehydrating the full world-state graph
and dispatchers so a restarted surface can accept *new* `ask`/`expand` commands — is **out of scope
here and owned by Phase 2 (Identity, Continuity & Context)**; a restored surface serves its history
and returns a typed signal for live commands until then.

## Failure modes

- **Torn final line** (crash mid-append): the reader skips a trailing unparseable line; the durable
  log is valid up to the last complete record. Append is line-atomic (one `write` per event).
- **Missing directory**: created on first write; absent on read ⇒ empty reconstruction (treated as
  "unknown surface").
- **Media miss**: the media route returns 404 (unchanged behavior); narration degrades to text.
- **Corruption beyond a torn tail**: reconstruction fails closed (refuses rather than fabricates),
  mirroring the replay spec's stance.

## Governance, observability, determinism

- Governance is already applied at publish (the bus interceptor); the durable log is an exact mirror
  of governed, validated events. No new governance surface.
- Secrets never enter events (existing rule), so the durable log carries none; media bytes are
  content, not credentials.
- Persistence is invisible to the canonical record: the fold of the durable log equals the fold of
  the live bus. Replay re-invokes no provider.

## Non-goals

- Live write-continuity / world-state rehydration after restart (Phase 2).
- Durable world-state snapshot and durable memory backends as *correctness* requirements (projections
  of the log; snapshots are a later optimization).
- Postgres/NATS production backends (layered later behind the same contracts).
- Multi-writer/collaboration durability, compaction, retention/GC policy (later).

## Verification

- `runEventTransportConformance(() => new FileEventTransport(...))` passes.
- **Cross-process replay equivalence:** drive a session; persist its log; in a *fresh* set of objects
  pointed at the same file, replay → fold → deep-equals the original `session.state()`.
- **Media durability:** bytes written by one store instance resolve from a new instance (same dir).
- **Gateway resume:** after a simulated restart (new `SurfaceHost`, same dir), `/state` and `/stream`
  serve the reconstructed surface.
- `pnpm verify` stays green fully offline (the file backend needs no infra; durability is opt-in).
```
