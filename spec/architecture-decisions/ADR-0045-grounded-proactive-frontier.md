# ADR-0045: Grounding the Proactive Frontier (M9 LKS T1)

**Status:** Accepted
**Date:** 2026-07-17
**Amends:** ADR-0026 (Research Mode & Readiness Gating — the readiness gate + `surface.research.frontier.*`
events stand; the *content* it surfaces is upgraded from an ungrounded breadcrumb to the grounded
overlay)
**Related:** ADR-0043 (Frontier T1 — the web-grounded frontier this surfaces), ADR-0044 (TKM T1),
CSE-006 §3.2/§4/§5/§6 (the frontier overlay, the grounding law, the frontier horizon), ADR-0038
(the Cognitive Director), F10, blueprint M9

## Context

Two frontier systems now exist, and they contradict each other:

1. **The S3 readiness gate (ADR-0026).** On verified mastery, `SurfaceSession` emits
   `surface.research.frontier.detected` and — when a `researchDispatcher` is wired — surfaces a
   frontier via the `ResearchUnit`. This is **proactive** (the system offers the frontier at the
   right cognitive moment) but its content is an **ungrounded model breadcrumb**: ADR-0026 explicitly
   scoped it "no external fetch, no citation grounding, no web access," with a plain `source_note`
   disclaimer.

2. **The CSE Frontier Overlay (ADR-0043).** Real web-grounded frontier entries, every one backed by
   a fetchable citation (the CSE-006 §4/§6 grounding law) — but **on-demand only** (the learner
   clicks "🔭 Frontier").

The ungrounded proactive frontier now violates the grounding law the rest of the source environment
enforces. The fix is not to add a third system — it is to **feed the grounded overlay into the
existing readiness gate**, so the frontier the system offers on verified mastery is the real, cited
one. Proactive *and* grounded.

## Decisions

### 1. A `frontierProvider` seam; grounded-or-defer, never ungrounded-when-grounding-is-available

`SurfaceSession` gains an optional `frontierProvider` dep — a browser-safe seam
`researchFrontier(conceptId, conceptTitle) → Promise<FrontierOverlayView | null>` (mirroring the M5
`sourceEvidence` seam; the surface package owns the view type, the host adapts the CSE
`FrontierOverlay`). When research-readiness fires and a `frontierProvider` is present, the session
surfaces the **grounded** frontier:

- grounded entries found → `surface.research.frontier.surfaced` (enriched with the grounded entries +
  citations) + a research block carrying them + the `frontier_of` KG edges;
- nothing citable found → `surface.research.frontier.deferred` (**honest** — a proactive frontier is
  grounded or it is not shown; the ungrounded breadcrumb is never used when a provider is wired).

### 2. Precedence preserves backward compatibility

When both a `frontierProvider` and the legacy `researchDispatcher` are present, the **grounded
provider wins**. When only the `researchDispatcher` is present (the CLI/tests, which wire no
provider), the existing ungrounded `ResearchUnit` path runs **unchanged** — so those surfaces stay
byte-identical and the ADR-0026 behavior is preserved where nothing better is wired. The gateway
wires the `frontierProvider` (over `SourceHub.researchFrontier`), so **the product is grounded**; the
CLI stays on the legacy path.

### 3. The readiness gate stays the "when"; the grounding law stays the "what"

ADR-0026's gate (verified mastery: `depthGate.passed && confidence ≥ 0.75`, or the high-confidence
fallback) is unchanged — it remains the honest "learner is ready" signal, computed from first-party
depth evidence. This ADR only changes *what content* the gate surfaces. The events, the fold
(`research_frontiers[]`), and the D3 ordering (detected-before-surfaced) all stand; the
`ResearchFrontierRecord` gains optional `grounded` + `entries[]` fields so the folded state (and the
web) can render the grounded frontier, and replay shows exactly what was surfaced.

### 4. Bounded + best-effort on the readiness path

The grounded call is a web request, but the readiness gate fires only on verified mastery (rare, not
every ask), and the path is best-effort: a timeout or error becomes an honest `deferred`, never a
blocked ask and never a fabricated frontier. Background/streamed surfacing (so the ask never waits at
all) is a named T2 refinement.

## Consequences

- The living knowledge the system offers *proactively* — at the moment a learner verifies mastery —
  is now the **real, cited** frontier, resolving the honesty inconsistency between the two systems.
- One frontier substance (ADR-0043), reached two ways: proactively via the readiness gate (this ADR)
  and on-demand via the "🔭 Frontier" affordance. The Temporal timeline (ADR-0044) stays on-demand
  for now (proactive timeline surfacing is a T2).
- The CLI/tests keep the ungrounded ResearchUnit fallback (no provider), so nothing regresses; the
  gateway is grounded.

## Deferred (named scope)

- **Background / streamed surfacing** so the readiness ask never blocks on the web call.
- **The Cognitive Director explicitly raising the horizon** (a `researching` state directive,
  CSE-006 §5 / ADR-0038) — T1 keeps the Director's existing "mastered + frontier → mastering" pacing;
  an explicit researching directive is the next tier.
- **Proactive timeline** surfacing (ADR-0044) on the readiness gate; **frontier/timeline as Scene
  actors** (CSE-012).
- **Retiring the ungrounded `ResearchUnit`** once every manifestation wires a grounded provider.

## Rejected

- **A third frontier system.** The honest fix reuses the existing readiness gate + events; it does
  not add parallel machinery.
- **Falling back to the ungrounded breadcrumb when grounding finds nothing** (with a provider wired):
  that reintroduces the exact honesty violation — a proactive frontier is grounded or deferred.
- **Removing the ungrounded path outright:** the CLI/tests still rely on it and wire no web-grounded
  provider; precedence (provider-wins) keeps both without a breaking change.
