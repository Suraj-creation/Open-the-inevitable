```yaml
spec:
  title: Shared Per-Learner Cognitive Memory
  domain: persistence
  status: draft
  owner: runtime-team
  last_reviewed: 2026-06-20
  upstream_dependencies:
    - persistence/durable-learner-identity
    - persistence/cognitive-continuity-and-rehydration
    - memory/memory-tiers
    - world-state/world-state-graph
    - agents/supervisor-agent
  downstream_dependencies:
    - product/features/F05-persistent-cognitive-memory
    - product/features/F14
    - digital-twin
  related_protocols:
    - memory-mutation-protocol
    - cognitive-event-protocol
  related_events: []
  related_runtime_systems: [tiered-memory, world-state-graph, surface-session, supervisor-agent]
  related_governance_systems: [governance-kernel]
  related_observability_systems: [cognitive-observability]
  semantic_tags: [memory, learner, continuity, mastery, cross-surface, twin, durability, seed]
  canonical_references:
    - ../architecture/uci-architecture.md#9-temporal-cognition
    - product/Broader-feature-product#9
    - architecture-decisions/ADR-0011-shared-learner-cognition
```

# Shared Per-Learner Cognitive Memory (DPS-004)

## Purpose

DPS-002 gave a *surface* continuity of **state**; DPS-003 gave a *learner* continuity of
**identity**. This spec gives a learner continuity of **cognition**: a returning learner's *new*
surface draws on what they have already mastered and learned in prior surfaces, instead of starting
cognitively blank. It is the fourth and final movement of the continuity arc (durability → state →
identity → **cognition**) and the moment "persistent cognitive memory of each learner" becomes
literally true *across* sessions, not merely within one. It is the direct substrate on-ramp to the
Personal Cognitive Companion / Digital Twin (P5), which is nothing more than a long-lived per-learner
cognition made into an agent.

## The gap it closes

After DPS-003 a learner is durable and owns surfaces, but each surface's world-state and tiered
memory are still **per-surface**: mastery checkpoints and semantic memory earned in surface A are
invisible to surface B even for the *same* learner. So a learner who mastered a concept yesterday is
re-taught it today the moment they open a new surface — the supervisor, reading an empty world-state,
routes every concept to `explanation` from scratch. That is acceptable for a single session and
untenable for a learning *intelligence* whose whole promise is cumulative mastery.

## What carries across, and what does not

The cut follows the tier semantics of [memory-tiers](../memory/memory-tiers.md): some cognition is
*session scratch*, some is the *learner's durable knowledge*. Only the durable knowledge carries.

| Cognition | Tier / shape | Cross-surface? | Why |
|---|---|---|---|
| Mastery checkpoints | world-state `mastery_checkpoint` nodes (+ their `concept` nodes and assess edges) | **yes** | The learner genuinely verified this; it must inform future routing. |
| Semantic / procedural / reflective memory | memory tiers `semantic`, `procedural`, `reflective` | **yes** | The learner's durable, consolidated knowledge. |
| Working / episodic memory | tiers `working`, `episodic` | no | Session scratch and per-session event trace. |
| Surface / timeline / block state | `surface.*` fold | no | A surface's *presentation* of cognition; per-surface by definition. |
| In-progress phase tracking for un-mastered concepts | concept-node `*_dispatched:*` props | no | Carrying these would falsely tell a new surface a concept was already explained. |

Concretely, a learner's **cognition profile** is the deduplicated union, across their surfaces, of:

```
{ worldNodes:   [mastery_checkpoint nodes (owner-scoped) + their concept nodes],
  worldEdges:   [verifies_mastery_of / rejects_mastery_of edges between carried nodes],
  memoryMutations: [validated MemoryMutations in the durable tiers] }
```

It is a **derived projection** of the learner's per-surface durable artifacts — exactly as `world.json`
/ `memory.json` are per-surface projections of the canonical `events.jsonl`. The per-surface event
logs remain the unit of durability (DPS-001); the profile is a cross-surface cache re-derivable from
them, never a second source of truth.

## Capture

After each command that can change durable cognition (an `ask` runs the learning cycle and records
mastery), the gateway **extracts** the durable subset from the live surface's world-state + memory
(scoped to the surface's owning learner) and **merges** it into the learner's profile. Merge is
idempotent and keyed by id (nodes/edges by node/edge id; mutations by `mutation_id`), so re-capturing
an unchanged surface is a no-op and a concept is never double-counted. The profile lives in the
`LearnerRegistry` alongside the learner record: in memory always, and on disk at
`<COS_PERSIST_DIR>/learners/<learnerId>.cognition.json` when persistence is on (so it survives a
restart, like the learner record itself).

## Seed-at-create

On surface **create** for a resolved learner, the gateway loads that learner's cognition profile and
**seeds** the new surface's substrate before the session starts: each carried world node/edge is
applied to the fresh world-state graph and each durable memory mutation is committed to the fresh
tiered store. Seeding happens once, at create, before any wiring or `start()` — so it is **silent
state reconstruction, not re-emitted cognition**: no `surface.*` event fires, no subscriber is
re-triggered, no model is re-invoked (identical in spirit to DPS-002's `hydrate`/`restore`, which
also reconstruct prior state without re-running side effects). From the learner's first `ask`, the
supervisor reads the seeded mastery checkpoints (matched by `ownerUserId`) and routes a
already-mastered concept to `complete`/`revision` instead of re-explaining it — the visible payoff.

Seeding and DPS-002 `restore` are mutually exclusive by construction: **create** (a brand-new
surface) seeds; **resume** (an existing surface) restores. A resumed surface already contains the
cognition that was seeded into it when it was first created (it was persisted into that surface's own
`world.json`/`memory.json` and restored on resume), so it must not be re-seeded.

## Provenance, governance, determinism

- Seeded nodes/edges/mutations keep their **original provenance** (the assessor `cid`, the original
  mutation evidence). Re-applying them into a fresh graph assigns new local versions/HLCs (the new
  graph is its own projection) but changes no claim — the learner truly earned this mastery.
- Seeding requires no new governance decision: it reconstructs *known* state, it does not propose new
  cognition. The first post-seed `ask` is governed exactly as any other.
- Capturing/seeding are **sinks/sources around** the canonical record, never part of it — consistent
  with DPS-001 (persistence is a sink) and DPS-002 (snapshots are advisory caches).
- Replay of any surface's durable event log re-invokes no provider and is unchanged by this spec.

## Failure modes

- **No prior profile** (a freshly-minted learner): seed is empty; the surface starts blank, as before.
- **Corrupt profile file**: treated as absent → the new surface starts blank rather than failing
  create (cognition continuity degrades; surface correctness does not). The profile is re-derivable
  from the surfaces' event logs.
- **Malformed seed entry** (e.g. an edge whose endpoint is missing): that entry is skipped; the rest
  seeds. Best-effort reconstruction, fail-soft — a bad cache never blocks a new surface.
- **In-memory mode** (no `COS_PERSIST_DIR`): the profile lives only in the process, so cross-surface
  carry works within one run but not across a restart (durability is opt-in, as everywhere in the
  stack).

## Non-goals (explicitly deferred)

- **Re-seeding an existing surface on resume** with cognition earned in *other* surfaces *after* it
  was created. P2.3 seeds at create; the profile a surface carries is a point-in-time snapshot.
  Continuous cross-surface convergence is a later refinement (and naturally a twin concern).
- **Concurrent multi-surface writes for one learner** (single active surface still assumed, per
  DPS-003).
- **Collective / social tiers** (cross-*learner* memory) and consolidation/decay *across* surfaces —
  the profile is single-learner and un-consolidated; cross-surface consolidation is future work.
- **Semantic retrieval over the profile** (context-lease-bounded working-memory assembly) — that is
  the next P2 increment (context retrieval); this spec makes the durable knowledge *present*, not yet
  *retrieved on demand*.
- **The Digital Twin** itself — this is its substrate, not the twin agent (P5).

## Verification

- A learner masters a concept in surface A; a **new** surface B for the **same** learner starts with
  that mastery present in its world-state, and B's first `ask` for that concept routes to `complete`
  (no re-explanation), whereas a fresh learner's surface routes to `explanation`.
- The carry holds **in memory** within one process and **across a simulated restart** (fresh gateway,
  same `COS_PERSIST_DIR`, profile loaded from disk).
- Working/episodic memory and per-surface block state do **not** leak across surfaces.
- Seeding emits no `surface.*` events (the new surface's fold is unchanged until its first `ask`).
- `pnpm verify` stays green fully offline (shared cognition rides on the same opt-in stack).
```
