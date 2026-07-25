# ADR-0063 — Progressive first-frame delivery

**Status:** Accepted (2026-07-25) · Extends ADR-0030 (UCS frames + look-ahead), ADR-0031 (one-ahead
compose/voice + detached speculation), ADR-0028 (streaming reveal). Analysis:
`spec/research/time-to-first-frame-analysis-2026-07.md`.

## Context

Time-to-first-frame on the Cognitive Surface is dominated by ~6–7 *serial* model round-trips before
`surface.frame.composed` (session.ts). Several are wasted: on the composer/frame path the fibered
learning cycle's `explanation` (and its concurrent `challenger`) and `practice` model calls are
generated and awaited but never used to build the board — the Composer re-distills the concept
independently; image planning + generation are `await`ed *inside* frame prep so a slow image blocks
the board; and independent pre-frame work runs in series. The substrate already has the right
primitives (one-ahead pipeline, detached speculation, `frame.element.delta` reveal, `ask.progress`).

## Decision

Re-sequence the ask pipeline for progressive delivery, extending — not replacing — ADR-0030/0031:
(A) keep only the work Frame 1 needs on its critical path — skip the discarded explanation/challenger
on the composer path, defer image generation to *after* `surface.frame.composed` (spec order:
`image.decided` follows `composed`), and move practice/mastery + downstream (checkpoint, descent,
research-readiness, look-ahead) to detached background work quiesced by `settle()`; (B) token-stream
the Composer into `surface.frame.element.delta` so the board materializes live; (C) parallelize
independent pre-frame calls; (D) widen the depth-1 look-ahead into a small governed rolling buffer;
(E) fast-start source mode (background deep parse + durable upload, memoize canonicalization by
`content_hash`); (F) thread an `AbortSignal` so a learner *interrupt* cancels in-flight background
speculation at its next checkpoint — the composer dispatch already in flight is not recalled, but its
image and all emits are skipped, so a cancelled speculation leaves no trace in the event log. F fires
only on the explicit `interrupt` interaction; a normal follow-up ask still `settle()`s speculation so
the look-ahead can be promoted (ADR-0030 Phase 3) — cancelling every redirect would defeat that.
Rollout is incremental and per-increment test-verified.

## Invariants preserved

Replay equivalence (client fold ≡ server state for every prefix), no wall-clock in canonical state,
ordinal *surfacing* order (frames may compose in parallel but surface in order), transient-buffer
fold equality, governance/provenance/lease checks on every deferred or parallel dispatch, seeded
determinism, and "static pre-generation is a non-goal." Background work stays quiesced by `settle()`.

## Rejected alternatives

- **Concurrent asks** — violates the one-ask serialization law (SRF-005 §6.4); parallelism lives
  *inside* one ask or in detached background.
- **Fully concurrent producers within a surface** — would break HLC monotonicity (SRF-002 §6); we
  parallelize model *calls* whose results emit in ordinal order instead.
- **Raw `lookaheadBudget` bump for the rolling buffer** — buffer depth is governed; it changes via an
  Evolution Proposal, not a constant (ADR-0030 lock 6).
- **Static pre-generation of the whole lesson** — explicit non-goal; the buffer stays bounded,
  re-planned, and discardable.
