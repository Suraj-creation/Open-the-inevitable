# ADR-0035: Cognitive Intelligence Persistence — the Two-Plane Substrate and the Distillation Law

**Status:** Accepted
**Date:** 2026-07-10
**Related:** blueprint §25.4 (laws 2/7/9), ADR-0008/0009 (durable persistence/continuity), ADR-0015
(knowledge graph), ADR-0017 (observability analysis), ADR-0021 (governed evolution), ADR-0027
(evaluation), ADR-0029 (agent observability events), ADR-0032/0033 (CSE/Theater), ADR-0034
(Supabase), CSE-005 (episodes/deltas), CSE-006 §7 (aggregate learning), F05 (persistent memory)

## Context

A founder architectural review identified the missing foundation beneath everything built so far:
**runtime cognition does not compound.** The audit confirmed it in code:

1. **Reasoning evaporates at dispatch.** Every unit returns a full `ReasoningTrace`
   (interpretation, strategy, claims, decision, self-critique, uncertainty) in its `Emissions` —
   and `ProductRuntimeDispatcher` drops it, threading only `trace_id` into the OTel span. A
   summary subset reaches the surface on one path (ADR-0029). The Planner thinks; the thought is
   gone.
2. **Decisions are chronicled but never distilled.** Proposals, arbitrations, enrichment/image
   decisions, evaluation scorecards, depth gates, interventions — all evented (law #9 held) — but
   nothing folds them into "what worked, for whom, why," so nothing compounds. The event log is a
   chronicle, not comprehension.
3. **The learner-side distillates are specced but unbuilt.** Episodes and Understanding Deltas
   (CSE-005) — the units of compounding — exist as law, not code.
4. **The durable substrate is half-landed.** World-state and memory persist as file snapshots
   beside the log (ADR-0009); the multi-tenant Postgres substrate (ADR-0034) carries only the
   transport/source tables so far (deferred M2b).

The founder proposed a *Cognitive Intelligence Persistence Layer / Persistent Cognitive
Intelligence Graph*, with full authority granted to challenge it. The challenge that survives
scrutiny: **do not build a second database of intelligence that agents write to directly** — that
would fork the source of truth and violate law #9. The event-sourced chronicle already *is* the
persistence of cognition. What is missing is **distillation**: the governed, continuous folding
of the chronicle into typed, versioned, queryable, compounding cognitive structures.

## Decision

Adopt **Cognitive Intelligence Persistence (CIP)** as a first-class architectural layer, specified
in the new domain `spec/intelligence/` (CIP-001 substrate + CIP-002 audit/registry), implemented
as milestone **M3.5** before any further CSE modality work. The architecture is a **two-plane
substrate joined by governed distillation**:

- **Chronicle Plane** *(exists — strengthened, never bypassed)*: the append-only truth — event
  log, memory mutations, world-state deltas, recorded model outputs. Every runtime cognition MUST
  reach the chronicle (closing audit gap #1 is part of this decision: full reasoning traces become
  chronicled, not dropped).
- **Intelligence Plane** *(new)*: distilled cognitive structures — **IntelligenceArtifacts** —
  living as typed nodes/edges in the world-state graph and typed mutations in the memory tiers,
  durable on the Postgres substrate under RLS. No new store: the graph and the tiers *are* the
  intelligence plane; Postgres is their physical manifestation.
- **Distillers** *(new)*: governed cognitive units whose sole job is folding chronicle segments
  into IntelligenceArtifacts. Distillation is itself cognition: manifested, capability-enveloped,
  evented (`intelligence.*` family), confidence-carrying, replayable, and re-runnable (distilled
  artifacts are versioned with `supersedes`, provenance-linked to the exact chronicle segments
  they were folded from).

**Binding locks:**

1. **One chronicle, one distillation path, no third way.** No subsystem invents its own
   persistence. To persist cognition: emit to the chronicle (already law) and/or register a
   distiller. Direct writes of "intelligence" bypassing distillation are invalid implementation.
2. **The admission test.** A distiller is admitted to the registry iff its output answers *"can
   future intelligence emerge from this?"* with a named consumer (a unit, a projection, an
   evolution proposal input, or a learner-facing surface). Intelligence without a consumer is
   telemetry and belongs to observability instead.
3. **Every artifact carries epistemics.** `{ provenance_refs[] (chronicle segments), produced_by,
   confidence, method_version, supersedes, decay_policy }`. Re-distillation with a better method
   supersedes; it never silently overwrites. Replaying the chronicle re-derives the plane.
4. **Two scopes, two regimes.** *Learner-scoped* intelligence (episodes, deltas, misconception
   history, reasoning-style observations) is RLS-isolated, learner-visible, opt-out-able, and
   really-deletable with cascade (CSE-005 §7 generalized to the whole plane). *Shared* intelligence
   (pedagogy effectiveness, source intelligence, agent-strategy outcomes) forms only above cohort
   minimums and changes system behavior **only through Evolution Proposals** (ADR-0021) — never by
   silent statistical drift (law #7).
5. **Learning-model, never psycho-profile.** The plane models how a learner *learns* (concepts,
   misconceptions, strategies that worked, reasoning patterns — all disclosed and inspectable);
   inferring sensitive personal traits is out of scope by law, not by policy preference.
6. **M3.5 absorbs M2b.** The intelligence plane requires durable world-state and memory; the
   Postgres cutover of world-state deltas/nodes/edges, memory mutations, and learner identity
   (schema 0001 tables, currently unused) lands inside M3.5, ending the file-snapshot era.
7. **Resequencing.** CSE-005's episode/delta infrastructure (previously M6) pulls forward into
   M3.5 as the first learner-side distillers; M6 narrows to MRL + Understanding Map experience on
   top of an already-running episodic plane.

## Alternatives Considered

- **A dedicated "intelligence database" written by agents at runtime** (the literal reading of
  the proposal). Rejected: forks the source of truth, violates law #9, and makes replay unable to
  reconstruct intelligence. Distillation-over-chronicle preserves one truth and makes the plane
  re-derivable.
- **"It's just memory consolidation — extend F05."** Rejected as too narrow: memory tiers hold
  learner-scoped mutations; the plane also spans shared pedagogy/source/agent intelligence and
  graph-shaped structures with cross-learner governance. Consolidation becomes *one distiller*.
- **"It's just observability analysis — extend ADR-0017."** Rejected: observability watches the
  system (drift, calibration alerts); intelligence feeds cognition back into itself with named
  consumers. The planes exchange signals but have different admission tests (lock 2).
- **Defer until after M4/M5 (more visible progress first).** Rejected: every milestone built
  before the plane exists adds more evaporating cognition and more backfill debt; M4/M5 will
  *produce* exactly the artifacts (viewport attention, highlight behavior, source intelligence)
  this plane must catch.

## Conformance to the ten invariants (blueprint §25.4)

(2) IntelligenceArtifacts land via Memory Mutations and World-State Deltas only; (3/4) distillers
run under intent/context leases; (5) any tool-touching distiller is governance-gated; (6)
distillers are manifested units; (7) shared intelligence alters behavior only via Evolution
Proposals; (8) artifacts carry provenance to chronicle evidence; (9) distillation lifecycle is
evented (`intelligence.*`), the plane is a fold, replay re-derives it; (10) every distiller ships
an observability contract. Law #1 unaffected (distillers coordinate via normal dispatch).

## Consequences

**Positive.** The system stops forgetting its own thinking: reasoning traces chronicle fully;
episodes/deltas make learning compound per learner; strategy/pedagogy/source intelligence
accumulates under governance; personalization emerges from cognition rather than memory fragments;
every future subsystem (M4 PDF, M5 projection, Theater) inherits one persistence philosophy
instead of inventing storage. The plane is re-derivable from the chronicle — no new
source-of-truth risk.

**Costs.** Distillation compute (mitigated: attention/eviction-driven scheduling, budgets, and
distillers are mostly deterministic folds — model-backed only where semantics demand); schema
0003 + backfill of ~weeks of chronicle (bounded: chronicle formats are versioned and replayable);
two blocking sub-decisions inherited from CSE-006 §8 (aggregation privacy mechanism) apply to any
shared-intelligence distiller — cohort-minimum-only until that ADR lands.

## Open Questions

- Distillation cadence: on-event streaming vs. episodic batch (proposed: batch at episode close +
  session end, streaming only for cheap deterministic folds; revisit with load data).
- Whether `intelligence.*` warrants full family status vs. subfamily under `memory.*`/`world.*`
  (proposed: own family — the lifecycle events are neither mutations nor deltas).
- Retention/decay of superseded artifacts (proposed: keep — they are the learner's intellectual
  history — subject to the same deletion rights).
