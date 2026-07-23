# ADR-0037: MRL v1 Kind Set + Episodic Projections (Resume Cards, Understanding Map)

**Status:** Accepted
**Date:** 2026-07-11
**Related:** CSE-003 (the MRL; closes §8 Q1), CSE-005 §3–§5 (episodes, deltas, development
state, resume), CIP-001/CIP-002 (the intelligence plane these projections consume; ADR-0035),
SRF-002 (schema 1.7.0 addition), blueprint M6 (CSE-P2)

## Context

M3.5 landed the two-plane intelligence substrate: at session close, the `episode-assembler` and
`understanding-delta` distillers fold the chronicle into `learner.episode` and
`learner.understanding-delta` artifacts, each admitted under the named-consumer law with
`consumers: ["resume-card", "understanding-map", …]`. Those consumers did not exist yet — M6
builds them, plus MRL v1 (the meaning layer that turns CSE from content intelligence into an
understanding engine). Three decisions must be fixed before implementation.

## Decisions

### 1. MRL v1 kind set (closes CSE-003 §8 Q1)

V1 ships the four-kind minimum: **`intent`**, **`analogy-map`**, **`misconception-hypothesis`**,
**`conceptual-compression`**. Rationale: `intent` orients every downstream pedagogy decision;
`analogy-map` is the highest-leverage learner-conditioned selection; `misconception-hypothesis`
is the MRL→L8 hinge (feeds F14 probes and misconception-first teaching); `conceptual-compression`
is cheap, judgeable, and immediately useful to composers. The remaining seven kinds land with the
capabilities that consume them (causal-model/counterfactual with simulations, interpretation-set
with the Claim Graph M9, transfer-map with F08 bridges).

### 2. MRL units land as the L7 `meaning` layer + world-state nodes

- One **`MeaningLayerContent { units: MeaningUnit[] }`** artifact per source version via the
  existing `recordLayerArtifact(versionId, "meaning", …)` path — shared candidates computed once
  per version (CSE-003 §2), DAG-enforced (structural first), degradation honest (< floor lands
  `source.layer.degraded`).
- Each unit is additionally a **world-state node** `mrl:<unit_id>` with `expresses` edges to its
  concept nodes — one graph, richer vocabulary, exactly as CSE-003 §4.1 demands; queryable
  alongside the knowledge graph.
- Production is a **governed model-backed cognitive unit** (`meaning` agent, privileged), same
  discipline as the M3 canonicalizer: D3-recorded invocations, `thinkingBudget: 0` on structured
  calls, **grounding law at the parser** — a unit that cites no known anchor/concept from its
  input is dropped at parse time, never laundered into the layer; a blocked/failed dispatch falls
  back to a deterministic path (compressions derived from structural regions) landing at
  fallback confidence **0.45 < floor ⇒ visibly degraded**.
- Gateway wiring note: the gateway's SourceHub performs adapter-level canonicalization only;
  MRL construction (like L2 semantic) runs through the governed service. Host-level dispatch of
  shared-layer cognition at upload time is a named later increment (with the durable source
  store); M6 proves the unit + service standalone and live (mirrors how M3 landed).

### 3. Episodic projections: one canonical event + one read-side view

- **Resume card = `surface.resume.projected`** (SRF-002 schema **1.7.0**, additive): emitted at
  session start for a returning learner, folded latest-wins into `SurfaceState.resume_card`.
  CSE-005 §3.2 law honored strictly: the card is derived **only** from the learner's latest
  `learner.episode` + `learner.understanding-delta` artifacts (the intelligence plane), never
  from raw logs; an absent/empty plane ⇒ no event (honest absence — a fresh learner gets no
  fabricated welcome-back). Payload: episode/delta artifact refs, learner-readable summary, last
  concept, open confusions, concepts touched, days since. Replayable like every surface event.
- **Understanding Map v1 = a read-side projection, no new canonical events.** The gateway serves
  `GET /api/learner/:id/understanding` (bearer-authed; a learner reads only their own — CSE-005
  §3.3 governance: disclosed, learner-visible), assembling the already-canonical artifacts
  (episodes + deltas, in-memory plane + Postgres when configured). The web overlay renders:
  concepts touched over sessions, mastery movements, confusions opened/resolved, and blind spots
  (path concepts never engaged). It renders **evidence, never a score** (CSE-005 §3.4); the
  eleven-stage development ladder visualization deepens in later milestones as stage-transition
  evidence accrues.

## Consequences

- The distillers' named consumers become real — the admission law's promise is fulfilled, and
  future `intelligence.consumed` telemetry has genuine consumers to record.
- Schema 1.7.0 is additive and replay-preserving (1.6.0 logs fold unchanged).
- MRL v1 gives CSE-007 (M8) real meaning candidates to select among; selection (learner-
  conditioned, blackboard-arbitrated) is explicitly out of M6 scope.
- The Understanding Map's data plane is the intelligence plane — strengthening it (richer
  distillers) automatically deepens the map without new surface plumbing.

## Rejected

- Resume cards as CognitionBlocks (blocks are in-session cognition; resumption is session-boundary
  state — a typed event slice is cleaner and latest-wins).
- A separate MRL store or MRL-as-memory-mutations (would fork truth; the layer artifact + world
  nodes are the CSE-002/003-lawful homes).
- Understanding Map as canonical surface events (it is a *projection over* canonical artifacts;
  evented copies would drift — CLAUDE.md §2, projections of unified world state).
