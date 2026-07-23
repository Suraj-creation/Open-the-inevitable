# ADR-0040: Source Fusion + the Claim Primitive (M9 T1)

**Status:** Accepted
**Date:** 2026-07-12
**Related:** CSE-015 (Source Fusion), CSE-006 (Living Knowledge — Claim Graph, frontier overlays),
CSE-002 (anchor index, `source.*` family), CSE-008 (multi-source alignment §10, the base case
fusion evolves), M5 SourceHub (the multi-source substrate), ADR-0027 (evaluation), ADR-0026
(readiness gating), blueprint M9

## Context

M5 gave the gateway a **SourceHub** that holds many Canonical Source Environments, each with
concept-bound anchors (the evidence seam). CSE-008 §10 aligns sources *side by side*; CSE-015
goes further — **reconcile many sources into one cognitive environment** the learner inhabits,
where a concept is understood from all sources at once. CSE-006 underpins it with the **Claim
Graph** (typed epistemic structure) and the **Frontier Overlay** (a living edge connecting a
source to current research). M9 is large; T1 lands the reconciliation core and the Claim primitive,
deferring the parts that need governed web access or a second model pass.

## Decisions

### 1. Fusion reconciliation is a deterministic function of the anchor index (T1)

The fusion core — `reconcileConcept` in `packages/source-environment/fusion.ts` — is a **pure
function** of each source's *treatment* of a concept (which anchors cover it, at what coverage
depth), computed from the anchor index (CSE-002 §5.5) the SourceHub already maintains. It produces
a **`FusedConcept`**: per-source coverage (`full` | `partial` | `absent`), **corroboration** when
≥2 sources cover the concept (fusion strengthens agreement — CSE-015 §2), **complements** (each
source's distinct emphasis), and a confidence. This is deterministic and replay-safe; no model,
no network. The **model-backed fused *explanation* synthesis** (an inference-class prose weave that
cites every contributing anchor, CSE-015 §3.1) is deferred to T2 — T1 reconciles structure and
coverage, never fabricates a synthesis.

### 2. The Claim primitive is typed structure; contradictions are honest or absent (T1)

CSE-006 §3.1's `Claim` + Claim Graph edges (supports / contradicts / refines / supersedes / …)
land as **types + a deterministic reader/detector**. But claim *extraction* is model work (layer
5/6 canonicalization) — so T1 populates the Claim Graph only when claim data already exists, and
**`detectContradictions` returns `[]` when there is none** (CSE-006 §2: "disagreement is content,
not noise" — but a *fabricated* contradiction is worse than none, CSE-006 §6 `contested` honesty).
Cross-source contradiction detection over extracted claims is wired but yields nothing until claim
extraction lands — honest absence, exactly as M5's evidence seam declines to invent anchors.

### 3. Fusion is a governed capability over the SourceHub, emitting `source.fusion.*`

`SourceHub.fuse(versionIds, conceptRefs)` gathers each source's treatment (reusing the M5
concept-anchor path), reconciles per concept, detects **gaps** (a target concept *no* source
covers → a research/ingestion prompt, CSE-015 §3.3), and emits — on the hub's `source.*` bus —
`source.fusion.composed`, per-concept `source.fusion.concept.reconciled`, and
`source.fusion.gap.detected` (all replayable in the source domain). New `source.*` family events:
`source.claim.recorded`, `source.contradiction.detected`, `source.fusion.composed`,
`source.fusion.concept.reconciled`, `source.fusion.gap.detected`. The gateway exposes
`POST /api/surface/:id/fuse { concept_refs }` — fusion over exactly the surface's bound sources —
returning the fused concepts for the web "Fused view." Fusion **never blurs provenance**: every
treatment stays traceable to its source anchors (CSE-015 §2, Source Law: Grounded).

## Consequences

- The learner experiences *one understanding* drawn from many sources — corroboration strengthened,
  each source's emphasis composed, coverage gaps named — while every claim stays anchored to its
  source (the architectural-direction #7 unlock, deterministically and honestly).
- Fusion reuses the M5 SourceHub + anchor index — no new store; reconciliation edges (T2) will be
  world-state deltas (CSE-015 §3.2).
- Deferred with named scope: **Frontier Overlays** + the research web-fetch/refresh loop (CSE-006
  §3.2, governed corpus access — needs the F10 research path); the **model-backed fused explanation
  synthesis** (CSE-015 §3.1, D3-recorded); **claim extraction** at layers 5/6 (feeds the Claim
  Graph); the **Temporal Knowledge Model** (CSE-006 §3.3); fusion-as-Scene with `split`/`merge`
  shots (CSE-012/013 — the fused concept rendered as one Scene); the aggregate self-improving
  instructional layer (CSE-006 §7, needs the privacy-mechanism ADR).

## Rejected

- A model-backed fused synthesis in T1 (adds latency + non-determinism before the deterministic
  reconciliation has proven its shape; CSE-015 sequences structure first).
- Fabricating contradictions from coverage differences (a value/emphasis difference is not an
  empirical contradiction — CSE-006 §3.1 labels natures; T1 surfaces none rather than a false one).
- A new fusion store (CSE-015 §2: the concept graph is the fusion substrate; fusion is edges +
  reconciliation nodes over the existing graph).
- Auto-fusing the whole corpus (CSE-015 §4: progressive + attention-driven — fuse the concepts the
  learner is approaching, on request, not eagerly).
