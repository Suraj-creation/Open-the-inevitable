# ADR-0064 — Deep continuous frame coverage + topic-grounded source rendering

**Status:** Accepted (2026-08-16) · Implementation status: implemented
Extends ADR-0030 (UCS frames + look-ahead), ADR-0063 (progressive first-frame; realizes its
**Phase D** — "widen the depth-1 look-ahead into a small governed rolling buffer"), ADR-0057
(source-anchored teaching), ADR-0062 (source-first surface).

## Context

Three learner-visible failures on the Cognitive Surface, all traced to real code (see the
2026-08-16 pipeline maps):

1. **Thin coverage.** The frame planner capped a concept at `DEFAULT_MAX_FRAMES = 5` with ≤7
   anchors/frame, so a whole chapter surfaced as a few sparse boards.
2. **No continuous background build.** Look-ahead was depth-1: `lookaheadBudget = 1`, the planner
   emitted ≤1 look-ahead bet, and `prepareLookahead` pre-composed exactly one next concept. The
   learner waited at every step. ADR-0063 named the rolling buffer (Phase D) but left it unbuilt.
3. **Topic mode never rendered a bound document.** A plain `ask(goal)` resolves evidence by
   *lexical token overlap* between the goal-derived concept title and the document's regions
   (`anchorsFromAttention`). When the topic's wording didn't overlap the document's headings, the
   score was 0, no anchor was created, no `source_viewport` element was injected, and the document
   simply did not appear — even though the learner had attached it. `teachSource` worked only
   because its concept titles *are* the document's headings (exact match).

## Decision

**Coverage.** Raise per-concept frame coverage (`DEFAULT_MAX_FRAMES` 5 → 8; per-frame anchor
guidance 7 → 8) so a chapter is genuinely covered. "Fewer is better — never pad" stays in the
prompt; the model still decides, but the ceiling no longer forces fragmentation.

**Rolling look-ahead buffer (ADR-0063 Phase D).** `prepareLookahead` composes the next *N* concepts
(N = the look-ahead budget), not one, skipping any concept that already has a live speculative or
composed frame (idempotent top-up). `reconcileSpeculations` promotes the frame matching the new
focus and **keeps** every speculative frame whose concept is still ahead on the path — only frames
now behind or off-path are invalidated. So each advance promotes instantly and re-tops the buffer;
the buffer survives advances instead of being discarded. Budget 0 remains the deterministic
no-speculation default; the gateway runs budget 3. Speculation still runs **detached** (never on the
ask's critical path) and stays cancellable on interrupt (ADR-0063 Phase F). It now also fires after a
prerequisite-descent recovery, not only on first-try mastery — a learner who struggled still gets the
next steps pre-warmed.

**Topic-grounded rendering.** When a source is bound, evidence resolution for a concept falls back,
in order: (1) exact/stemmed lexical overlap (unchanged); (2) a softer relevance match; (3) the
document's structural **lead region** for the concept's position, so a bound document **always**
renders in topic mode. The fallback is marked lower-confidence in provenance so a genuine lexical
anchor is never conflated with a positional one. This makes the three intended modes real:
*document-only* (`teachSource`), *topic + document* (`ask` grounds each concept in the doc), and
*topic-only* (no binding → pure generated graph, unchanged).

## Rejected alternatives

- **Embedding-similarity evidence resolution** — the correct long-term answer, but it needs the
  durable VectorStore wired into the ask path (not yet done) and recorded embeddings for replay
  (`RecordingModelRuntime.embed` still throws). The lexical→soft→lead-region fallback is deterministic,
  replay-safe, and ships now; embedding retrieval supersedes step (2) later without changing the seam.
- **Client-side frame prefetch** — the client stays a pure projection (interfaces-are-projections
  law); buffering belongs in the governed, event-sourced substrate.
- **Unbounded look-ahead** — the buffer is bounded by budget and quiesced by `settle()`; cost is
  never paid inside learner latency and never grows without limit.

Determinism, replay, governance, and the one-ahead compose/voice pipeline are unchanged. Budget-0
behavior is byte-identical to before.
