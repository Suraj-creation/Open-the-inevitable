# ADR-0009 — Cognitive Continuity & Rehydration

- **Status:** accepted
- **Date:** 2026-06-19
- **Deciders:** runtime-team
- **Supersedes:** —
- **Related:** [ADR-0008 (durable persistence)](./ADR-0008-durable-persistence.md), [spec/persistence/cognitive-continuity-and-rehydration](../persistence/cognitive-continuity-and-rehydration.md), [spec/persistence/durable-cognitive-persistence](../persistence/durable-cognitive-persistence.md), `packages/events`, `packages/surface`, `apps/api`

## Context

ADR-0008 made the event log durable and reconstructs a surface **read-side** after a restart, but
explicitly deferred **live write-continuity**: a restored surface could be viewed, not driven. Closing
that gap requires restoring not just the event log but the world-state graph and tiered memory — which
are each event-sourced on their *own* logs, not on the event bus — and rebuilding a session that
accepts new commands without re-running side effects or colliding ids.

## Decision

1. **Restore three artifacts, each from its own source of truth.** Event log via a new
   `EventBus.hydrate(events)` (load without re-delivery/validation/governance — they were applied at
   first publish); world-state via `WorldStateGraph.snapshot()`/`restore()`; tiered memory by replaying
   the persisted `TieredMemoryStore.history()` through `commit()`. World/memory snapshots are persisted
   next to `events.jsonl`. Unifying all three onto one durable bus is a future refinement, not required
   for continuity.

2. **Resumed sessions use a `CryptoIdGenerator`.** Replay determinism is already guaranteed by the
   recorded events (ids in the durable log); the resumed session only needs globally-unique ids for
   *new* cognition. Random UUIDs cannot collide with recorded ids and require no id-counter persistence.
   (The seeded generator's counter is not serialized — a deliberate avoidance of fragile state.)

3. **A `resume(surfaceId)` path distinct from `start()`.** `resume` adopts the existing id and emits/
   writes nothing (world-state nodes are restored; `surface.created` is in the hydrated log). The session
   is then fully live on the same governed path.

4. **The gateway upgrades a restored surface to live.** With `COS_PERSIST_DIR` set, the gateway persists
   `world.json` + `memory.json` after each command and, on a cold-miss lookup, rehydrates a live session
   (restore + hydrate + crypto ids + `resume`), re-attaches the durable sink, and serves it as a normal
   hosted surface (`ServedSurface.live === true`). Missing/corrupt snapshots fall back to ADR-0008
   read-side reconstruction (serve history; reject live commands) — never rehydrate onto empty state.

## Consequences

**Positive:** a learner's cognition survives a restart *and continues* — the precondition for session
resume and the digital twin; no fragile id-counter state; the substrate stays event-sourced (three logs)
without a disruptive unification refactor.

**Negative / trade-offs:** two extra durable artifacts (world/memory snapshots) re-written per command
(small; snapshots are whole-graph for now — compaction/incremental snapshots are later); resumed sessions
are non-deterministic in their *new* ids (acceptable — replay uses recorded ids).

**Neutral:** continuity is opt-in via `COS_PERSIST_DIR`; default in-memory behavior and hermetic tests
are unchanged.
