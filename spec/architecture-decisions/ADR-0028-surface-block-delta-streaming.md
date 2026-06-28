# ADR-0028: Surface Block-Delta Streaming Projection

**Status:** Accepted
**Date:** 2026-06-26
**Related:** ADR-0006 (surface gateway transport), ADR-0007 (surface choreography & timing),
SRF-001 (cognitive-surface-runtime), SRF-002 (surface-event-architecture),
SRF-005 (surface-streaming-sync-protocol), model-invocation-protocol

## Context

The Universal Cognitive Surface should let a learner *watch understanding form* — content appearing
progressively as a model generates it — instead of a finished block snapping into place. Today a block
is produced whole: the model adapter exposes only a whole-response `generate()`, and the surface emits a
single `surface.block.generated` carrying the complete `CognitionBlock`.

The hard constraint is **replay equivalence** (SRF-005 §6.2, a tested invariant): the client's
`foldSurfaceEvents(log)` must deep-equal the server's `session.state()` for the same log, and a re-fold
of the same log must be byte-identical (SRF-001 §6.2). Any streaming mechanism must not make the settled
state depend on *whether* or *how* streaming occurred, nor bake a wall-clock into the fold (ADR-0007).

## Decision

Introduce `surface.block.delta` `{ block_id, seq, text_delta }` as an additive `surface.*` event, and
fold it into a **transient** `streaming_blocks` buffer:

1. **Transient buffer, canonical whole-block.** The fold accumulates each delta's `text_delta` (in `seq`
   order) into `streaming_blocks[block_id]`. The block's `surface.block.generated` remains the **single
   canonical content** and, when folded, **clears** that buffer entry. Therefore for the settled state
   `fold([delta…, generated]) ≡ fold([generated])` — deltas change *nothing* in the final state.
2. **Logical order only.** Deltas carry `seq` (monotone within a block), never a playback clock —
   identical to the choreography law (ADR-0007). The viewport renders the partial buffer for a prefix
   that ends mid-stream; the completed prefix renders the canonical block.
3. **Streaming is a surface-layer progressive reveal, optional and gated.** The surface session emits
   the ordered `surface.block.delta` chunks of the produced explanation text (pre-allocating the
   block_id so deltas and the whole block share it), then the whole block. It is gated: deterministic /
   replay mode (`ManualClock` + `SeededIdGenerator`, the D3 recorded-output seam) emits the whole block
   with **no deltas**; live mode streams. The final state is identical either way, so existing
   content-determinism tests are unaffected. Model-adapter token streaming (e.g. Gemini
   `generateContentStream`) can later feed these same `surface.block.delta` events without any change to
   the event model, the fold, or the client.
4. **Same transport, same family.** Deltas flow as ordinary `surface.*` SSE frames (SRF-005) — no new
   transport, no special-casing; the client uses the same `foldSurfaceEvents`.

## Alternatives Considered

- **Deltas mutate the block in place (no whole-block event).** Rejected: the settled content would
  depend on delta count/segmentation, and a dropped/duplicated delta would corrupt canonical state —
  fragile against replay equivalence and the provider's non-deterministic chunking.
- **Version-only observational deltas, client reads raw events for preview.** Workable, but splits the
  live preview out of the pure fold (the client would project from a side channel), losing the "fold is
  the single truth function" property. The transient-buffer approach keeps everything in the fold.
- **Stream over a separate channel (WebSocket/second SSE).** Rejected for now: unnecessary transport
  complexity; the existing SSE channel already orders frames by bus sequence.

## Consequences

- **Replay/determinism:** preserved by construction — the buffer is cleared by the whole-block event, so
  settled state is delta-independent; re-folding any log is byte-identical. New tests assert
  `fold([delta…, generated]) ≡ fold([generated])` and that prefixes expose the buffer.
- **Observability:** generation becomes visible without new provenance; deltas carry no model internals.
- **Governance:** unchanged — deltas are emitted only within an already-governed dispatch; a blocked
  dispatch emits none.
- **Evolution:** additive (`schema_version` 1.3.0); older folds ignore the unknown subtype and still
  converge on the whole-block content. Other block types can adopt deltas later through the same buffer.
- **Negative:** a mid-stream prefix shows partial text (by design); clients must visually distinguish
  streaming-in-progress from settled content (a streaming caret), and must tolerate a block that lands
  with no preceding deltas (deterministic mode).

## Open Questions

- Structured (non-text) streaming (e.g. progressive concept-map nodes) is deferred; this ADR covers text
  deltas only.
- Whether to cap buffered delta length / coalesce very fine-grained chunks for very long generations.
