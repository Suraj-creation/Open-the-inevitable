# ADR-0060: Fused synthesis into Cognitive Frames (fusion → frames)

**Status:** Accepted
**Date:** 2026-07-24
**Related:** CSE-015 (Source Fusion — the owning spec), ADR-0042 (fused synthesis), ADR-0057 (R2
source-anchored teaching — the pattern this mirrors), ADR-0030 (Frames + composer), the CSE
production-readiness audit R5.

## Context

Source Fusion (M9) already weaves a grounded, multi-source `FusedSynthesis` per concept — prose that
cites each source and surfaces cross-source disagreement honestly — but it only ever reached a
read-only panel (`FusedView`). When a concept is covered by several attached sources, the *teaching*
still composes from a single source (R2 SOURCE MODE) or the goal, so the learner never gets the
reconciled cross-source understanding taught as frames. The composer already accepts source passages
as prompt input (R2a); fusion is the multi-source analog of exactly that seam.

## Decision

Add **FUSION MODE** to the composer, mirroring R2a's SOURCE MODE. The session resolves the concept's
fused synthesis over the existing `sourceEvidence` provider seam (a new optional
`fusedSynthesisForConcept`) and threads a browser-safe `FusedSynthesisView` (prose + per-source
emphases + `acknowledges_disagreement`) into the composer packet as `fused_synthesis`. When present,
the composer teaches the woven understanding: cite each contributing source, compose their
complementary emphases into one frame, and where they DISAGREE surface it (a misconception or
relationship anchor) rather than flatten it — the fused prose is the ground truth, nothing outside it.
Gated: **≥2 covering sources** and a **non-degraded** synthesis (a real model weave); otherwise the
seam returns null and teaching falls back to R2a/goal mode unchanged (honest absence). The host
early-returns before any `fuse()` call when fewer than two sources are bound (no added cost).

## Rejected alternatives

- **A separate "teach the fusion" timeline mode (like R2c).** Heavier; the high-value, low-risk slice
  is to make the *normal* compose path fusion-aware, reusing the R2a seam.
- **Passing raw per-source claims/contradictions instead of the woven synthesis.** The synthesis is
  already the reconciled, disagreement-honest artifact; re-deriving reconciliation in the composer
  prompt would duplicate CSE-015 and risk flattening.
- **Teaching a degraded (model-unavailable) synthesis as fusion.** Rejected — a deterministic
  alignment view isn't a woven understanding; without a real weave, fall back honestly.

## Deferred

- A dedicated multi-source frame archetype (compare/contrast layout) — FUSION MODE composes into the
  existing MCCR for now.
- Surfacing which frames were fusion-taught in the Observatory's representation/composition panels.
