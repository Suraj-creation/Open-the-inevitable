```yaml
spec:
  title: Cognitive Continuity & Rehydration
  domain: persistence
  status: draft
  owner: runtime-team
  last_reviewed: 2026-06-19
  upstream_dependencies:
    - persistence/durable-cognitive-persistence
    - world-state/world-state-graph
    - memory/memory-tiers
    - events/event-taxonomy
    - surface/cognitive-surface-runtime
  downstream_dependencies:
    - product/features/F13
    - surface/surface-streaming-sync-protocol
  related_protocols:
    - cognitive-event-protocol
    - memory-mutation-protocol
  related_events: []
  related_runtime_systems: [event-bus, world-state-graph, tiered-memory, surface-session]
  related_governance_systems: [governance-kernel]
  related_observability_systems: [cognitive-observability]
  semantic_tags: [persistence, continuity, rehydration, resume, event-sourcing, replay]
  canonical_references:
    - next-generation-cognitive-operating-system-blueprint#3.2
    - architecture-decisions/ADR-0009-cognitive-continuity-and-rehydration
```

# Cognitive Continuity & Rehydration (DPS-002)

## Purpose

[Durable Cognitive Persistence](./durable-cognitive-persistence.md) (DPS-001/ADR-0008) made the event
log durable and proved a surface can be reconstructed **read-side** after a restart. It explicitly
deferred **live write-continuity**: a restored surface could be *viewed* but not *driven* — a new
`ask`/`expand` was rejected. This spec closes that gap. After a restart the substrate **rehydrates a
restored surface into a live session** that accepts new commands and continues exactly where it left
off, with the learner's prior progress intact.

This is the first increment of Phase 2 (Identity, Continuity & Context). It is the precondition for
session resume and for the digital twin: continuity of a learner's cognition across process
boundaries is what makes "persistent cognitive memory of each learner" real.

## What must be restored, and from where

A live session is `{ event log, world-state graph, tiered memory, dispatchers/loop }`. The dispatchers
and the learning loop are stateless logic over world-state, so rehydration restores **three pieces of
state**, each from its own durable artifact:

| State | Source of truth | Durable artifact | Restore |
|---|---|---|---|
| Event log (the surface's history) | `@inevitable/events` bus | `events.jsonl` (DPS-001) | `bus.hydrate(events)` — load without re-delivery |
| World-state graph | `WorldStateGraph` (its own delta log) | `world.json` (`graph.snapshot()`) | `graph.restore(snapshot)` |
| Tiered memory | `TieredMemoryStore` (its mutation logs) | `memory.json` (`memory.history()`) | replay mutations via `commit()` |

World-state and memory are **not** on the event bus — each is independently event-sourced on its own
log — so the durable event log alone cannot reconstruct them; their snapshots are persisted alongside
it. (Unifying all three onto one bus is a future purity refinement, not required for continuity.)

## Why `hydrate`, not replay-through-publish

Reconstructing the bus must **not** re-run side effects. Re-`publish()`ing historical events would
re-trigger subscribers, re-emit, and re-invoke recorded model outputs. `EventBus.hydrate(events)`
loads the events into the log (advancing the sequence past their max) **without** validation,
governance, or delivery — they were already governed and validated when first published. `state()`
then folds the hydrated log exactly as before; the SSE stream replays it with identical frame ids.

## Identity of new ids after resume

Replay determinism is already guaranteed by the recorded events (their ids live in the durable log).
The resumed session only needs **globally unique ids for new cognition**. It therefore uses a
`CryptoIdGenerator` (random UUIDs) rather than the original seeded generator — new ids cannot collide
with the recorded ones, and no fragile id-counter state must be persisted or restored. Determinism of
*generation* is a test/replay concern that the recorded log already satisfies; live continuation does
not require it.

## The resume path (vs. start)

`SurfaceSession.start(goal)` mints a new `surfaceId`, writes the surface's world-state nodes, and emits
`surface.created`. `SurfaceSession.resume(surfaceId)` instead **adopts** the existing id and emits
nothing and writes nothing: the world-state nodes are already present (restored from the snapshot) and
`surface.created` is already in the hydrated log. From that point the session is fully live —
`ask`/`expand` dispatch through the same governed path, append to the same durable log, and re-persist
the world/memory snapshots on completion.

## Gateway behavior

When `COS_PERSIST_DIR` is set, after each command the gateway persists `world.json` + `memory.json`
next to the surface's `events.jsonl`. On a cold lookup miss for a persisted surface, the gateway
**rehydrates a live session** (restore world + memory + hydrate bus + crypto ids + `resume`), re-attaches
the durable sink, and registers it as a normal hosted surface — so `ServedSurface.live` is `true` and
new commands are accepted. DPS-001's read-only restored surface is thus upgraded to a live one.

## Failure modes

- **Missing world/memory snapshot** (e.g. a surface persisted under DPS-001 before this spec): fall
  back to DPS-001 read-side reconstruction (serve history; reject live commands) rather than rehydrate
  a session with empty world-state.
- **Snapshot newer than log or vice versa**: the event log is authoritative for `state()`; world/memory
  snapshots are advisory caches for routing/mastery. A mismatch degrades routing quality, never
  correctness of the surface view.
- **Corrupt snapshot**: fail closed to read-side reconstruction.

## Governance, observability, determinism

- Rehydration emits no new canonical events; it restores prior state. Subsequent live commands are
  governed exactly as in a fresh session.
- Persisting snapshots is a sink (like the event log) — never part of the canonical record.
- Replay of the durable event log re-invokes no provider (D3 recordings are in the log).

## Non-goals

- Cross-surface learner identity resolution and session resume *by learner* (next P2 increment).
- Durable world-state/memory as a *unified* event stream on the bus (future refinement).
- Snapshot compaction, retention/GC, multi-writer continuity (later).

## Verification

- After a simulated restart (fresh gateway, same dir), a **new `ask` on the same surface** produces
  fresh agent cognition appended to the durable log; the surface's prior blocks/timeline remain.
- New event ids do not collide with the restored ones.
- `expand` on a restored surface re-dispatches and emits `surface.explanation.expanded` live.
- `pnpm verify` stays green fully offline (continuity rides on the opt-in `COS_PERSIST_DIR`).
```
