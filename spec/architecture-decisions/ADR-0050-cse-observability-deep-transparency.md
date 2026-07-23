# ADR-0050: CSE Observability & Deep-Transparency (M12)

**Status:** Accepted
**Date:** 2026-07-17
**Related:** CSE-002 §9 (source event family), CSE-006/015/016 (the cognition being surfaced), the
Constitution (§2 observability invariant — "observability tracks reasoning quality, memory
influence, drift, disagreement, confidence, and learning outcomes"; §1 — "cognition itself becomes
visible"), ADR-0017 (CognitiveAnalysisEngine — the learning-loop analog this mirrors for the source
plane), ADR-0035/CIP-002 (the Intelligence Plane), ADR-0031 (UCS production hardening — the surface
analog), blueprint M12

## Context

M1–M11 built the Cognitive Source Environment: canonicalization (M3), the intelligence plane
(M3.5), modalities (M4/M10), source–surface projection (M5), the Cognitive Theater (M7/M8), living
knowledge — claims, contradictions, fusion, frontier, temporal (M9) — and creative cognition (M11).
Each of these is a *governed cognitive act* that emits a `source.*` event (CSE-002 §9) plus, for the
model-backed units, a D3 `model.output.recorded` event — all on the `SourceHub`'s own bus so the
source plane stays replayable.

**But nothing observes that bus.** The source environment reasons — extracts claims, detects
contradictions, weaves syntheses, grounds a frontier, offers assists, degrades a layer honestly —
and all of it is invisible. That is a direct gap against the observability invariant (reasoning
quality, confidence, disagreement, honest degradation are exactly what the source plane produces and
exactly what must be observable) and against the product's own thesis ("the runtime is the product;
cognition becomes visible"). M12 is the milestone that closes it, alongside performance hardening and
a formalized test matrix.

M12 is broad ("continuous but formalized"). This ADR scopes it into three tranches and decides T1.

## Decisions

### 1. M12 is delivered in three tranches; T1 is deep-transparency surfacing

- **T1 — Deep-transparency surfacing (this increment).** Make the source plane's cognition
  observable: a pure projection over the `source.*`/`model.*` log, a host-level read route, and a
  web transparency panel. No new events (it surfaces existing ones); additive; gateway-on.
- **T2 — Performance & resilience (landed — memoization + cache telemetry).** Fusion results are
  memoized by the immutable source-version set + concept set (frontier/timeline/claims were already
  cached); a cache hit returns the identical result with no re-emission and no model call, so
  **memoization never changes replay output** (proven by a determinism test: re-fusing leaves the
  source log unchanged). Shared-cache hit/miss telemetry (the CSE-002 §11 "cache hit rate" metric) is
  a live counter surfaced in the transparency read (`SourceCacheStats` on `SourceCognitionState`) and
  the web Runtime panel. **Streaming of long-running cognition + lease-governed budget/backpressure
  remain deferred** (a larger, separately-scoped increment).
- **T3 — Full test matrix** (deferred, named): E2E across the CSE surface (register → attach →
  teach → fuse → frontier → timeline → create), plus the replay/failure/governance matrix from
  CSE-002 §10 formalized per tier.

### 2. Transparency is a pure fold over the source log, not a new state machine

`foldSourceCognition(events) → SourceCognitionState` (in `@inevitable/source-environment`, zero Node
imports) is the single read model. It is an **observability projection**, deliberately separate from
`foldSourceEvents` (which reconstructs *store state* — versions/layers/migrations — for replay). It
reports:

- **activity** — a count per cognition family (layers constructed/degraded; claims recorded;
  contradictions detected; fusions composed/synthesized; frontier updates; timeline updates;
  creations started/evolved/critiqued/completed).
- **layers** — per (version, layer): confidence + degraded flag (reasoning quality + honest
  degradation, surfaced not hidden).
- **model_invocations** — the count of D3 `model.output.recorded` events (real cognition ran) and,
  where the payload marks it, a `fallback`/degraded count (honest "the model wasn't available").
- **recent** — the last N cognition entries, each carrying `{event_type, at, producer_cid, summary,
  confidence?, degraded?}` — provenance-bearing, so every surfaced line traces to its producer.

Because it is a pure fold over the same log the runtime records, the client can re-derive it (replay
equivalence, the same law the surface fold obeys). Folding twice over the same log is byte-deep-equal.

### 3. It is surfaced host-level, read-only, and gateway-on

The source substrate is shared cross-surface (one `SourceHub` per host), so the transparency read is
a **host route** — `GET /api/sources/cognition` — not a per-surface one. It is strictly read-only
(observation never mutates cognition), best-effort, and additive: no existing route or event changes.
The web renders it as an on-demand **Source Cognition** panel (cognition made visible), never as a
covert score. CLI untouched (website capability), matching every CSE milestone.

## Consequences

- The source plane's reasoning — what it extracted, what it doubted, what it grounded, what it
  degraded — becomes inspectable, satisfying the observability invariant for the CSE domain and
  making the runtime legible (the product thesis).
- One pure projection + one read route + one panel; no new events, no new store, no replay change.
  Removing it reverts cleanly.
- T2 (perf) and T3 (test matrix) build on the same log and projection: caching keys off the same
  content-hash/concept-set identity; the E2E matrix asserts against the same transparency read.

## Deferred (named scope)

- **T2 remainder — streaming/backpressure:** streamed cognition for long operations; lease-governed
  budgets/backpressure. (Memoization + cache telemetry landed in T2; see the tranche note above.)
- **T3 — full test matrix:** the CSE E2E happy path + the CSE-002 §10 failure/replay/governance
  matrix formalized per tier; live-smoke consolidation.
- Wiring the source transparency into the **Intelligence Plane** distillers (source-cognition
  quality as a distilled artifact) and into `CognitiveAnalysisEngine` drift/calibration over source
  confidence — the source-plane analog of ADR-0017.
- A durable transparency read (Postgres `transport_events` already mirrors the chronicle; a durable
  cross-restart source-cognition view is a later increment).

## Rejected

- **Extending `foldSourceEvents` to carry cognition counts:** conflates the replay state fold with the
  observability projection; they have different consumers and different stability requirements. Kept
  separate.
- **Putting transparency on the per-surface SSE stream:** the source substrate is cross-surface and
  the cognition bus is host-level; a per-surface stream would misattribute shared cognition. A
  host-level read route is the honest shape.
- **A learner-facing "confidence score" rollup:** the panel shows the reasoning and its confidence
  with provenance, never a reductive covert score (same principle as the Understanding Map, ADR-0037).
