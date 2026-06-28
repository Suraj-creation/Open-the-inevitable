# ADR-0026: Research Mode and Readiness Gating

**Status:** Accepted
**Date:** 2026-06-25
**Supersedes:** none
**Related:** [ADR-0025](ADR-0025-cognitive-ensemble-orchestration.md) (ensemble; research agent
readiness-gated there), [ADR-0021](ADR-0021-governed-self-evolution.md) (evolution experiments as
proto-primitive for research events), SRF-002, SRF-003,
`spec/product/features/F10-research-innovation-acceleration.md`,
`spec/architecture/Cognitive-Architecture.md` (Layer 4 — The Research Layer),
`spec/implementation-roadmaps/cognitive-surface-maturity.md` (Phase S3)

## Context

S2 delivered five-test depth verification (F14) and prerequisite-descent on confusion (F03). The
surface now knows **when a learner has verified mastery in depth** — the `DepthGateOutcome` with all
five tests passed at high confidence is the strongest evidence the substrate produces. F10 (Research
& Innovation Acceleration) mandates that this verified mastery is the **readiness gate** for
surfacing research frontiers: the platform must know when the learner is ready, not merely
interested.

Today: no research mode, no research agent, no research blocks emitted, no frontier graph edges
surfaced, and the ensemble has no research-tier members. The cognitive graph can represent
`frontier_of` and `research_adjacent` edges (added in S1.1) but nothing populates them.

The decision: how does **research readiness** get detected, how does a **research agent** enter the
governed path, what **events** anchor the research path in the replay record, and how do
**frontier edges** enter the cognitive graph — while preserving every S1/S2 invariant?

## Decision

### 1. Research readiness is a threshold over the depth gate, not a separate gate

The depth gate (`DepthGateOutcome`, F14/S2.2) already produces the strongest mastery signal. Research
readiness requires:
- `depthGate.passed === true` **and** `depthGate.confidence >= RESEARCH_READINESS_THRESHOLD`

`RESEARCH_READINESS_THRESHOLD = 0.75` (above the mastery threshold of 0.6; below 1.0 to avoid
requiring perfection). When depth tests are absent, the fallback is `mastery.passed && confidence
>= 0.85` — high-confidence assertion from the caller. This keeps research gating in the same
session's context as depth verification; no cross-session aggregate is needed at MVP.

### 2. Research readiness detection lives in SurfaceSession, mirroring S2.3

`SurfaceSession.ask()` already has a post-cycle hook (S2.3 prerequisite descent). Research
readiness check is a **parallel post-cycle hook** — if the depth gate passed at high confidence
and no descent was triggered, the session calls `resolveResearchReadiness()`. This keeps the
learning loop (`FiberedLearningLoop`) unaware of research mode — it remains focused on the core
cycle. Research is surfaced **only when** the primary cycle succeeds cleanly.

### 3. D3 ordering: `surface.research.frontier.detected` emitted before the research block

Per the D3 determinism model (spec/protocols/model-invocation-protocol.md): non-deterministic
artifacts are **recorded before use**. The research agent's output is non-deterministic (model-
generated). Therefore:

1. `surface.research.frontier.detected` — emitted BEFORE the research agent is dispatched
   (records readiness intent and concept context; replayable even if agent fails).
2. Research agent dispatch → `surface.research.frontier.surfaced` → research block contributed
   (D3: block recorded before presentation).
3. On below-threshold confidence: `surface.research.frontier.deferred` (records the readiness
   check result; tells replay why no frontier appeared).

### 4. ResearchUnit: a governed cognitive unit with the same ABI as CurriculumUnit

`ResearchUnit` is a new `CognitiveUnit` (`packages/product-cognition/src/research-unit.ts`):
- Input packet `content.concept_id` / `content.concept_title` / `content.domain` / `content.context`
- Model-backed (Gemini), deterministic fallback scaffold
- Output contract: `{ frontier: string, gap: string, hypothesis_seed: string, source_note: string }`
- Privileged agent (`agent.research`, trust_level ≥ 3) — same GOV-P01 tier as curriculum
- Dispatch via `ProductRuntimeDispatcher` (governance-gated, OTel-spanned, D3-recorded)

The `agent.research` manifest is added to `MVP_AGENT_MANIFESTS`. `ResearchUnit` exports from
`@inevitable/product-cognition`.

### 5. Frontier edges enter the KG from the research block

After `surface.research.frontier.surfaced`, `runResearchFrontier()` calls:
```
kg.addEdge(focusConceptId, frontierSlug, "frontier_of")
```
where `frontierSlug` is a deterministic slug of the `frontier` text. This seeds the KG with the
`frontier_of` edge so `SurfaceTimelineBuilder.projectEdges()` — which already reads world-state
neighbors for `frontier_of` — includes it in the next timeline projection. The frontier concept
node is created as an ephemeral KG node (label = first 60 chars of `frontier`; layer = 6 research).

### 6. Ensemble expansion: motivation, reflection, debate manifests

S3.3 adds three new manifests to `MVP_AGENT_MANIFESTS`:
- `agent.motivation` — surfaces a motivating message when mastery barely passed (0.6 ≤ confidence < 0.75)
- `agent.reflection` — reserved (manifest only at MVP; activation deferred to S4)
- `agent.debate` — maps to the existing `agent.revision` challenger role (reuses it; this just
  names the debate mode for ensemble purposes)

`MotivationUnit` is a lightweight model-backed unit (or a simple `DeterministicMvpUnit` variant)
wired as an optional post-assessment pass in `SurfaceSession.ask()`.

### 7. New surface event subfamilies registered

`surface.research.*` and `surface.motivation.*` sub-families added to the `surface.*` family in the
event taxonomy (permanent/replayable, same as the parent family):

| Event | Description |
|---|---|
| `surface.research.frontier.detected` | Readiness gate passed; research agent will be dispatched |
| `surface.research.frontier.surfaced` | Research agent dispatched; frontier block emitted (D3) |
| `surface.research.frontier.deferred` | Below readiness threshold; frontier not surfaced this cycle |
| `surface.motivation.surfaced` | Motivation block emitted after marginal mastery |

### 8. SurfaceState gains research_frontiers[] and motivation_blocks[]

New foldable fields added to `SurfaceState` / `MutableSurfaceState`:
- `research_frontiers: readonly ResearchFrontierRecord[]` — folded from `surface.research.*`
- `motivation_surfaced: boolean` — folded from `surface.motivation.surfaced` (simple flag at MVP)

`foldSurfaceEvents` remains a pure function; new cases added to the switch.

## Alternatives Considered

- **Research mode as a separate command (not post-cycle).** Rejected: a separate command
  decouples research from verified mastery. The gate must be the cycle's own depth evidence — a
  caller who already knows they passed can fake it, but a session that internally verified it
  cannot. Post-cycle detection uses first-party evidence.
- **Research agent as part of the ensemble fan-out (S1.2 concurrent).** Deferred: readiness gating
  is a *sequential* check (you cannot know readiness until mastery resolves), so research is a
  post-cycle pass, not a concurrent fan-out member. Later, with F10 Advanced tier, a dedicated
  research surface mode could run the ensemble differently.
- **Frontier edges from the curriculum agent (S2.4).** Rejected: curriculum output knows the
  dependency DAG, not the research frontier. Frontier edges must come from domain knowledge + model
  synthesis (the research agent), not from learning-path decomposition.
- **Full F10 scope (gap maps, contribution lineage, paper survey, web search).** Deferred to S3
  Advanced / S4. MVP is frontier breadcrumb + seed hypothesis + source note (no external fetch,
  no citation grounding, no web access). Web/corpus access requires its own capability envelope
  extension and adapter.

## Consequences

- The surface now knows when a learner is ready to see the frontier of what they just mastered —
  the first realization of Cognitive-Architecture Layer 4 on the surface.
- Every research frontier surfaced is tied to a specific `DepthGateOutcome` in the event log — full
  causal lineage from verified mastery to frontier surfacing.
- The ensemble expands with `agent.motivation` + `agent.reflection` + `agent.debate` manifests;
  the roster grows toward the full F06 set without re-architecture.
- `ResearchUnit` is the template for future research-tier units (innovation, socio-ethical,
  contribution-draft). It re-uses the exact same CognitiveUnit ABI + governed dispatch path +
  RecordingModelRuntime D3 seam.
- `pnpm verify` must stay green after each sub-phase; replay-equivalence test extends to the new
  events.

## Open Questions

- What exactly constitutes "source grounding" at MVP — a disclaimer, a note, a citation format?
  For MVP: a plain `source_note` string in the research block content (e.g. "Based on recent
  literature in [domain]"); full citation grounding is F10 Advanced.
- Should the frontier concept node appear as a real timeline node (status = "frontier") or as an
  edge annotation only? For MVP: edge annotation only (the `frontier_of` edge points to a node
  that is not in `input.concepts`, so `projectEdges` won't render it as a timeline node — only the
  edge will appear if the frontier concept ID matches a known concept). A dedicated `frontier` node
  status is deferred.
- Motivation message quality: model-backed or deterministic? Start deterministic (`DeterministicMvpUnit`
  variant); upgrade to model-backed when the quality bar is defined.
