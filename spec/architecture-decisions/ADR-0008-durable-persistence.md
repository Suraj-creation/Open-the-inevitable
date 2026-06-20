# ADR-0008 — Durable Cognitive Persistence (pure-Node file backend, first cut)

- **Status:** accepted
- **Date:** 2026-06-18
- **Deciders:** runtime-team, infrastructure-team
- **Supersedes:** —
- **Related:** [ADR-0003 (tech stack)](./ADR-0003-tech-stack.md), [ADR-0005 (infrastructure adapters)](./ADR-0005-infrastructure-adapters.md), [spec/persistence/durable-cognitive-persistence](../persistence/durable-cognitive-persistence.md), [spec/replay/deterministic-replay](../replay/deterministic-replay.md), `packages/adapters`, `apps/api`

## Context

The substrate is event-sourced and deterministic, but **all state is in-memory**: the event bus,
world-state graph, memory tiers, and out-of-band media live in process memory and are lost on
restart. This makes event sourcing, replay, temporal cognition, and persistent learner memory true
only within a single process lifetime, and it contradicts the CLAUDE.md §2 law that the COS is a
*substrate independent of its manifestations* — a substrate that dies with the web process has no
independent existence. Durable persistence is the floor beneath continuity, the digital twin, and
governed self-evolution, and the precondition for any second manifestation attaching to the *same*
persisted state.

The question is **which durable backend to implement first**, given three hard constraints: (a)
`pnpm verify` must stay green fully offline with no infrastructure; (b) the primary dev platform is
Windows (native modules are friction); (c) the constitution forbids vendor leakage past adapter
boundaries (ADR-0005) and mandates contracts-first (ADR-0003).

## Decision

1. **The event log is the unit of durability.** Because `SurfaceState` is a pure fold of the
   `surface.*` log and world-state/memory are projections of typed events on the same bus, durability
   reduces to persisting (i) the append-only event log and (ii) out-of-band media (which is never in
   the log and so cannot be re-derived). Durable world-state snapshots and a durable memory backend
   are optimizations, not correctness requirements, and are deferred.

2. **First backend: a pure `node:fs` file store**, behind the existing `@inevitable/contracts`
   interfaces. Append-only JSONL event log per surface + media files. `node:fs` is a Node builtin
   (not a guarded third-party client per ADR-0005), so the file backend is *always available* — which
   is precisely why it is the right offline default: zero native deps, zero infra, Windows-safe,
   keeps the default pipeline green offline. `FileEventTransport` is validated by the existing
   `runEventTransportConformance` harness — correct iff it passes the same suite as the in-memory
   reference.

3. **In-memory stays the reference semantics and the default.** Durability is opt-in via a single
   composition-root switch (`COS_PERSIST_DIR`). Absent the switch, behavior is exactly as today and
   tests remain hermetic and deterministic.

4. **Persistence is a sink, never part of the canonical record.** Persisting an event emits no new
   event, never mutates it, never changes ordering. Replaying the durable log re-invokes no provider
   (model/tool outputs are already recorded in the log as `model.output.recorded`, D3).

5. **Production backends layer in later behind the same contracts.** Postgres (ADR-0003 default) and
   NATS JetStream become alternative `EventTransport`/store adapters with no consumer change and no
   vendor type crossing the boundary — the substrate-independence law makes them swappable. The file
   backend remains the local/single-node and offline path.

## Consequences

**Positive:** the substrate gains a persistent existence independent of any process; the determinism
ladder's "event log preserved" becomes literal and cross-process; later phases (continuity, twin,
evolution) have a durable history to build on; zero new dependencies and a green offline pipeline.

**Negative / trade-offs:** a file backend is single-node and not concurrency-hardened (fsync cadence,
compaction, retention/GC are future work); JSONL is space-inefficient versus a binary log; live
write-continuity after restart (world-state rehydration) is explicitly deferred to Phase 2.

**Neutral:** adding a production backend is a new adapter module + a conformance pass, no consumer
change; the file layout is an implementation detail behind the contracts.
