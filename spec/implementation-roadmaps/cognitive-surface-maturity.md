# Cognitive Surface Maturity Roadmap

**Status:** active · phase plan
**Owner:** product-architecture
**Governs:** the transformation of the Cognitive Surface from a deterministic playback viewer into a
living cognitive environment.
**Upstream:** `spec/cognitive_surface/` (vision corpus), SRF-001…005 (`spec/surface/`),
`spec/product/features/` F02/F03/F04/F06/F07/F09/F10/F14/F16, `spec/architecture/Cognitive-Architecture.md`.
**Decisions of record:** ADR-0024 (Surface Interaction Protocol), ADR-0025 (Cognitive Ensemble
Orchestration), ADR-0026 (Research Mode + Readiness Gating), ADR-0027 (Cognitive Evaluation Layer);
extends ADR-0006/0007/0015/0018/0021/0023.

---

## 1. Why this roadmap exists

The substrate is production-grade; the **surface is not yet alive.** Today the surface plays back a
deterministic, **single-agent-per-phase, single-cycle** reasoning trace over a **flat prerequisite
spine**, with `ask | expand | close` interactivity and client-only scrub/playback. The vision
(`spec/cognitive_surface/`) demands *"a living cognition environment … the medium through which human
and computational intelligence think together,"* where the learner *observes understanding unfolding*.

This roadmap closes that gap **as a composition over the existing substrate** — cognitive units (the
ABI), the event log, `ProposalBlackboard`, `foldSurfaceEvents`, governance, and D3 recording. It adds
**no new infrastructure and no new adapter contract**, and it preserves every invariant: governed
`surface.*` events, pure fold, byte-identical replay (D3), non-canonical layout/playback,
provider-agnostic multimodal.

The surface is the **manifestation of the cognitive layers** in `Cognitive-Architecture.md`: the
ensemble is the Capability layer made visible; the timeline graph is the Knowledge layer made visible;
later phases surface the Evaluation and Research layers.

## 2. The maturity gap (verified)

| Dimension | Now | Target |
|---|---|---|
| Orchestration | serial pipeline; challenger is a discarded probe | concurrent ensemble → arbitration → synthesis; disagreement surfaced |
| Timeline | flat prereq spine, 1 edge type, read-only, fixed | typed multi-graph, entry points, clickable jump/branch, dynamic |
| Interactivity | ask/expand/close | interrupt/jump/branch/challenge/depth/simplify/example |
| Observability | presence + provenance | + live proposals, confidence, uncertainty, disagreement, synthesis |
| Content | 4 of 14 block types | structured multimodal cognition across the type set |
| Multimodal | Null providers, text only | inline diagram/image/voice/simulation (provider-agnostic) |

## 3. Invariants (hold across every phase)

1. Every learner action and agent output is a governed `surface.*` event; nothing visible lacks an event.
2. `foldSurfaceEvents` stays a **pure function**; client fold ≡ server `SurfaceState`.
3. Record→replay is **byte-identical** (D3): every agent is a model-backed unit recorded via
   `RecordingModelRuntime`; the provider is never re-invoked on replay.
4. Layout, playback, viewport, and transport are **client projections** — never canonical state (ADR-0006/0007).
5. Multimodal is **provider-agnostic** behind the SRF-004 `ProviderRegistry`; Gemini is a reference impl.
6. Spec-first: each phase authors/updates its owning spec before code (CLAUDE.md §4).

## 4. Phases

### Phase S1 — The Living Loop + Timeline Graph (current)

The first increment that converts "static viewer" → "living environment." Sub-phases:

- **S1.0 — Spec-first (this document + ADR-0024 + ADR-0025 + SRF-002/003 updates + event taxonomy).**
- **S1.1 — Timeline as cognitive graph.** Typed edges in `KnowledgeGraphEngine`
  (`prerequisite_of`, `depends_on`, `applies_to`, `research_adjacent`, `frontier_of`); a **graph
  projection** (nodes + typed edges + per-node layer 0–6 + mastery/confidence/status) with an
  **entry-point** parameter (beginner/intermediate/advanced/research) in `SurfaceTimelineBuilder`;
  `surface.graph.*` folded in `projection.ts`. Re-projection stays pure (SRF-003).
- **S1.2 — Cognitive Ensemble.** Generalize the challenger `Promise.all` into a concurrent **N-agent
  fan-out** in `FiberedLearningLoop`; proposals land on the existing `ProposalBlackboard` (promoted
  from audit to live arbitration); an **arbiter/synthesis** step produces the surfaced cognition and
  emits `surface.proposal.*` + `surface.synthesis.recorded`; divergence emits `surface.agent.disagreed`.
  Ensemble (focused set): supervisor/arbiter, explanation, genuine challenger/Socratic,
  curriculum/graph-cartographer, assessment, memory (+ research, readiness-gated). Presence reflects
  genuine parallelism.
- **S1.3 — Surface Interaction protocol (ADR-0024).** Extend the gateway command envelope with
  `interrupt | jump | branch | challenge | request_depth | request_simplify | request_example`; each
  becomes a governed `surface.interaction.*` event; **interrupt** is cooperative cancellation checked
  at fiber yield points; intents thread into the loop and reshape it live.
- **S1.4 — Timeline-graph UI + ensemble observability.** Replace the flat spine with an interactive
  `TimelineGraph` (depth layout, typed edges, clickable jump/branch, entry-point selector, living
  status); add a proposals/disagreement/confidence observability panel; add in-stream
  ask/interrupt/deeper/simpler/example controls. UI is pure projection.

### Phase S2 — Deeper cognition + inline multimodal (current)

Cognition becomes *seen, heard, run, and verified in depth.* Sub-phases:

- **S2.0 — Spec-first.** **SRF-006** (inline multimodal artifacts: image/voice/video/simulation as
  cognition blocks via the SRF-004 provider seam, recorded for replay, served out-of-band) — authored.
  Sub-phases below expand here.
- **S2.1a — Structured visuals (done).** The deterministic, client-rendered path of SRF-006 §4: the
  surface emits a `concept`-map block projected from the learning graph (focus + neighbours + typed
  edges); the block-renderer registry renders it as an inline SVG mini-map. No provider, no media
  event, replay-safe — cognition made *visible* immediately.
- **S2.1b — Generated-media pipeline (next).** Wire the dormant `image`/`voice`/`video`/`simulation`
  block types through the `ProviderRegistry`; non-deterministic artifacts recorded (D3) before use;
  bytes served out-of-band via the media route; the renderer resolves real refs (placeholder only when
  no provider). Gemini is a reference impl behind the contract.
- **S2.2 — Five-test depth verification (F14).** Replace single-confidence mastery with the five-test
  gate (explanation, application, connection, teaching, edge-case); surface the gate outcomes.
- **S2.3 — Prerequisite-descent on confusion (F03).** On confusion/low-mastery, the supervisor/loop
  descends into the prerequisite sub-graph in place, then re-ascends; surfaced on the timeline graph.
- **S2.4 — Live curriculum-generated graph.** Feed `CurriculumUnit` output into the cognitive graph
  with typed edges (not just prerequisites) so the timeline graph is generated live and richer.

### Phase S3 — Research mode + ensemble expansion (ADR-0026)

Readiness-gated research/innovation agents (F10); research/frontier graphs; hypothesis/evidence
surfacing (Cognitive-Architecture Layer 4); expand the ensemble toward the full F06 roster.

- **S3.0 — Spec-first.** ADR-0026 (Research Mode + Readiness Gating); `surface.research.*` +
  `surface.motivation.*` subfamilies registered in the event taxonomy; this document expanded to
  include S3 sub-phases.
- **S3.1 — Research-readiness gate: events + SurfaceState fold.** Add `ResearchFrontierRecord` type
  to `packages/surface/src/projection.ts`; add `research_frontiers: readonly ResearchFrontierRecord[]`
  and `motivation_surfaced: boolean` to `SurfaceState` / `MutableSurfaceState`; fold
  `surface.research.frontier.detected`, `surface.research.frontier.surfaced`,
  `surface.research.frontier.deferred` in `foldSurfaceEvents`; add readiness check
  (`depthGate.passed && confidence >= 0.75`) as a post-cycle hook in `SurfaceSession.ask()`;
  emit `surface.research.frontier.detected` (D3) before agent dispatch.
- **S3.2 — ResearchUnit: model-backed research cognitive unit.** Implement `ResearchUnit` in
  `packages/product-cognition/src/research-unit.ts` (input: concept context; output:
  `{ frontier, gap, hypothesis_seed, source_note }`; deterministic fallback for offline/null runtime);
  add `agent.research` manifest to `MVP_AGENT_MANIFESTS` (trust_level 3); wire into
  `SurfaceSession.ask()` — emit `surface.research.frontier.surfaced` (D3), contribute research block,
  add `frontier_of` KG edge; wire `researchDispatcher` in `apps/cli/src/wiring.ts`.
- **S3.3 — Ensemble expansion: motivation + reflection + debate manifests.** Add `agent.motivation`,
  `agent.reflection`, `agent.debate` manifests to `MVP_AGENT_MANIFESTS`; wire `agent.motivation` as
  a post-assessment pass when `0.6 <= confidence < 0.75` (barely-passed mastery); fold
  `surface.motivation.surfaced` into `SurfaceState`.
- **S3.4 — UI: research block renderer + frontier edges.** Add `research` block renderer to
  `apps/web/src/blocks.tsx` (renders `frontier`/`gap`/`hypothesis_seed`/`source_note`); render
  `frontier_of` and `research_adjacent` edges distinctly in `TimelineGraph` (dotted stroke,
  distinct colour); add frontier indicator on mastered timeline nodes.

### Phase S4 — Modes, twin, collaboration, evaluation (ADR-0027)

Digital-twin & educator modes; Cognitive Evaluation Layer (Layer 2, ADR-0027) activated; spatial
scene-graph projection (F16 second manifestation); collaborative multi-writer foundation.

- **S4.0 — Spec-first.** ADR-0027 (Cognitive Evaluation Architecture); `spec/evaluation/cognitive-
  evaluation-architecture.md`; `evaluation.*` family registered in the event taxonomy; this document
  expanded with S4.0–S4.4 sub-phases.
- **S4.1 — `@inevitable/evaluation` package: CognitiveEvaluationEngine + reasoning scorecards.**
  New package with: `ReasoningScorecard` interface (D1 pure function); `ExplanationScorecard`
  (UALRCI five-test rubric, reads `DepthGateOutcome`); `ResearchScorecard` (frontier specificity /
  gap clarity / hypothesis seed / source quality); `ScorecardVerdict` + `EvaluationRecord` types;
  `CognitiveEvaluationEngine` (consumes traces, emits `evaluation.reasoning.completed`);
  `BenchmarkRunner` (D0 replay of a recorded session). Full test suite.
- **S4.2 — Wire evaluation: `EvolutionEngine` guard + `EvaluationRecord` in `SurfaceState` fold.**
  Add `evaluation_records: readonly EvaluationRecord[]` to `SurfaceState`; fold
  `evaluation.reasoning.completed` in `foldSurfaceEvents`; add step 10 in `SurfaceSession.ask()`
  that evaluates the cycle's reasoning trace (post-S3.3) and emits the evaluation event; wire a
  `CognitiveEvaluationEngine`-backed guard into `EvolutionEngine.approve()` at the CLI composition
  root replacing the placeholder heuristic.
- **S4.3 — Educator mode: `ProductMode` surface pipeline + analytics overlay in web.** Thread
  `mode: ProductMode` from `OnboardingInput` through `SurfaceSession` deps; emit
  `surface.mode.set` event; educator-specific agent posture (broader depth gate view, visible
  evaluation scores); educator analytics overlay in `apps/web` showing `evaluation_records` per
  cycle + mastery confidence history + depth gate breakdown + agent provenance.
- **S4.4 — Scene-graph projection: spatial block canvas (F16 second manifestation).** New
  `SurfaceSceneGraph` projection: blocks carry `{ x, y, width, height }` positioning in world-state
  props; `surface.scene.block.placed` event; `SceneCanvas` React component — freeform drag-
  positioned blocks, typed edge overlays, focus glow, zoom/pan. Toggle between timeline-graph and
  scene-graph via `surface.projection.switched`; layout non-canonical (D5: never in event log).

## 5. Verification (per phase)

- `pnpm verify` green (codegen/typecheck/test/lint/format) after each sub-phase.
- Replay-equivalence test extended for new events; record→replay byte-identical with the ensemble live.
- Governance tests for every new interaction/dispatch boundary.
- Live manual: `pnpm dev:gateway` + `pnpm dev:web` with `GEMINI_API_KEY` — observe parallel agents,
  surfaced disagreement→synthesis, an interactive timeline graph with entry points + jump/branch,
  mid-narration interrupt that redirects the loop, and deterministic replay.

## 6. Status

S1–S2 complete. S3 complete (S3.0–S3.4): ADR-0026, event taxonomy, ResearchFrontierRecord fold,
ResearchUnit model-backed agent, motivation block + surface.motivation.surfaced, research/motivation
block renderers, research-accented frontier/research_adjacent edges in TimelineGraph. S4 is the
active frontier. Detailed current state, traceability, and active frontier live in `IMPLEMENTATION.md`;
dated narratives in `docs/history/implementation-log.md`.
