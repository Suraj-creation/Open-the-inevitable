# ADR-0011 — Shared Per-Learner Cognitive Memory

- **Status:** accepted
- **Date:** 2026-06-20
- **Deciders:** runtime-team
- **Supersedes:** —
- **Related:** [ADR-0010 (durable learner identity)](./ADR-0010-durable-learner-identity.md), [ADR-0009 (continuity & rehydration)](./ADR-0009-cognitive-continuity-and-rehydration.md), [spec/persistence/shared-learner-cognition](../persistence/shared-learner-cognition.md), [spec/memory/memory-tiers](../memory/memory-tiers.md), [spec/agents/supervisor-agent](../agents/supervisor-agent.md), `apps/api`, `apps/cli`

## Context

DPS-003/ADR-0010 made a learner durable and surface-owning, but each surface's world-state and tiered
memory remain per-surface: a returning learner's *new* surface starts cognitively blank, so the
supervisor re-teaches already-mastered concepts. The mission ("persistent cognitive memory of each
learner") and the twin (P5) require a learner's mastery and durable knowledge to carry **across** their
surfaces. This was the explicit deferred next increment of ADR-0010.

## Decision

1. **A per-learner cognition profile, derived and deduplicated.** A learner's profile is the union,
   across their surfaces, of (a) their mastery subgraph — `mastery_checkpoint` nodes scoped by
   `ownerUserId`, the `concept` nodes they verify, and the assess edges between them — and (b) their
   durable-tier memory mutations (`semantic`, `procedural`, `reflective`). Working/episodic memory,
   per-surface block/timeline state, and in-progress phase-tracking do **not** carry. The profile is a
   *derived projection* of the per-surface durable artifacts (which remain the unit of durability,
   DPS-001), not a second source of truth.

2. **The profile lives in the `LearnerRegistry`, beside the learner record.** In memory always; on disk
   at `<COS_PERSIST_DIR>/learners/<learnerId>.cognition.json` when persistence is on. Merge is
   idempotent and id-keyed (nodes/edges by id, mutations by `mutation_id`), so re-capture is a no-op.
   This keeps cross-surface carry working **in memory within a process** *and* **across a restart**,
   matching the rest of the opt-in durability stack.

3. **Capture after each cognition-changing command; seed once at create.** After an `ask` the gateway
   extracts the learner-durable subset from the live surface and merges it into the profile. On surface
   **create** for a resolved learner it loads the profile and seeds the fresh world-state + memory
   *before* `start()`. Seeding is **silent state reconstruction** — applied before any wiring, it emits
   no `surface.*` event, re-triggers no subscriber, and re-invokes no model (the same discipline as
   DPS-002 `hydrate`/`restore`). The first post-seed `ask` is governed normally.

4. **Seed and `restore` are mutually exclusive.** `create` → seed (new surface); `resume` → restore
   (existing surface, which already contains the cognition seeded into it at create). A resumed surface
   is never re-seeded — that avoids double-application and keeps DPS-002 semantics intact.

5. **The extraction/seed seam lives in the composition root (`buildDemoSession`).** Co-located with the
   existing `DemoRestore` machinery that `apps/api` already reuses (`extractLearnerCognition` +
   `LearnerCognitionSeed` + a `learnerSeed` option). Promoting it into a dedicated substrate package is
   a future refinement once a second manifestation needs it (the §2 discipline already holds: apps
   depend on the substrate, never the reverse).

## Consequences

**Positive:** "persistent cognitive memory of each learner" becomes literally true across sessions; a
returning learner's new surface routes from prior mastery instead of re-teaching; the durable substrate
for the Digital Twin (P5) and for context retrieval (the next P2 increment) now exists; the cut honors
the memory-tier semantics (durable knowledge carries, session scratch does not).

**Negative / trade-offs:** the profile a surface carries is a **point-in-time** snapshot taken at create
— cognition earned in *other* surfaces *after* this one was created does not retro-seed it (continuous
convergence is deferred, naturally a twin concern); the profile is single-learner and un-consolidated
(no cross-surface consolidation/decay yet); durable knowledge is made *present*, not yet *retrieved on
demand* (context-lease-bounded retrieval is the next increment); seeding is best-effort/fail-soft, so a
corrupt profile silently degrades cognition continuity (never surface correctness — it is re-derivable).

**Neutral:** shared cognition is opt-in for durability via `COS_PERSIST_DIR` (in-memory within a process
regardless); default CLI/test behavior is unchanged (a fresh learner seeds nothing); no new public API
surface or event type is added.
