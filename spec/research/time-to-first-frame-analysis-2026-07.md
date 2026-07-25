# Time-to-First-Frame: Critical-Path Analysis & Progressive-Delivery Redesign

**Status:** Analysis for validation (no implementation yet). 2026-07-25.
**Problem:** When a learner submits a topic or a source, the Cognitive Surface waits for a long
serial chain of model calls before the first teachable frame appears. On a constrained (free-tier)
gateway the first `ask` exceeds 180 s. Goal: make time-to-first-frame (TTFF) feel *instant* and
keep a continuous rolling buffer of upcoming frames — without breaking the surface's replay and
synchronization guarantees.

This document maps the **current** execution critical path (grounded in code, file:line), classifies
essential vs. wasteful vs. deferrable work, inventories the low-latency machinery that **already
exists**, states the invariants a redesign must preserve, and proposes a phased, production-grade
redesign around incremental cognition / progressive delivery.

---

## 1. Method

Four parallel code/spec tracers mapped: (1) the topic-mode `ask` critical path; (2) the source-mode
register→attach→teach path; (3) the orchestration/runtime model and existing speculative machinery;
(4) the streaming/synchronization spec invariants. Findings below cite `file:line` and `SPEC §`.

---

## 2. Current critical path — TOPIC mode (`ask` → first frame)

The first teachable frame is `surface.frame.composed` (`packages/surface/src/session.ts:1862`).
Everything before it is on the critical path. Model calls marked **[LLM]**.

| # | Step | file:line | Model | Blocks F1 | Notes |
|---|------|-----------|-------|-----------|-------|
| 1 | `serialize()` per-surface command barrier | host.ts:570 | — | if prior in flight | one-ask law |
| 2 | `inferIntent(goal)` | host.ts:999 | **[LLM]** | yes | |
| 3 | `assembleContext(goal)` | host.ts:1002 | embed | yes | vector assemble |
| 4 | `generateCurriculum(goal)` | host.ts:1003 | **[LLM]** | yes | defines concepts/focus |
| 5 | `session.ask` → `settle()` prior speculation | session.ts:741 | — | yes | drains background |
| 6 | `timeline.build` (world-state graph) | session.ts:785 | — | yes | deterministic |
| 7 | **`loop.run`** — fibered learning cycle | session.ts:801 | see 7a–7d | **yes (largest)** | |
| 7a | supervisor routing | fiber-learning-loop.ts:411 | — | yes | deterministic |
| 7b | explanation **+ challenger** (concurrent pair) | fiber-learning-loop.ts:461-504 | **[LLM×2]** | yes | **discarded on frame path** |
| 7c | practice | fiber-learning-loop.ts:560 | **[LLM]** | yes | becomes a *later* frame |
| 7d | mastery record | fiber-learning-loop.ts:761 | — | yes | deterministic |
| 8 | `planAndComposeFrames` → `dispatchFramePlan` | session.ts:1244 | **[LLM]** | yes | frame decomposition |
| 9 | `prepareFrameEntry(F1)` → composer | session.ts:1433, 1527 | **[LLM]** | yes | the MCCR board |
| 10 | `dispatchImagePlanner` (+ image gen if `helps`) | session.ts:1560, 1574 | **[LLM]+gen** | **yes (awaited inline)** | blocks the board |
| 11 | **emit `surface.frame.composed`** | session.ts:1862 | — | — | **← FRAME 1** |
| 12+ | representation (RIA), source projection, theater, narration voicing | session.ts:1892-1997 | [LLM]+ | **no** | after board lands |

**Serial model round-trips before Frame 1: ~6–7** — intent → curriculum → (explanation‖challenger)
→ practice → frame-planner → composer → image-planner(+gen).

## 3. Current critical path — SOURCE mode (register → attach → teach)

Three HTTP round-trips. Registration is **model-free**; the only heavy CPU is adapter parse
(PDF via pdf.js is heaviest; text/markdown/code/web/notebook/dataset adapters are cheap string/JSON).

- **P1 `POST /api/sources`** (sources.ts:1060): read bytes (25 MiB cap) → `ensurePdfAdapter`
  (pdf only) → `contentHash` → optional `storage.put` (inline, network) → `registerVersion`
  (dedupe-by-hash) → **`canonicalize` = adapter parse** (store.ts:202-313) → cache → optional
  `persist` → 201. Blocking-but-backgroundable: `storage.put` (sources.ts:1087) and pdf-adapter
  connect sit inline before the 201.
- **P2 `POST /surface/:id/sources`** (host.ts:625): in-mem lookup + emit `surface.source.attached`. Cheap.
- **P3 `POST /surface/:id/teach-source`** (host.ts:652): `curriculumFor` (deterministic L2 concepts
  else L1 headings, topo-ordered; sources.ts:1169) → `session.ask` that **correctly skips
  intent/context/curriculum** (host.ts:695) → **but still runs `loop.run`** (supervisor + explanation
  + practice model calls, explanation discarded) → frame-planner → composer → image-planner →
  `surface.frame.composed`.

**Serial model round-trips before Frame 1 (source): ~5–6** — supervisor(det)+explanation+practice
→ frame-planner → composer → image-planner. Only the **entry** concept is taught in F1; the rest of
the document timeline is already deferred to `advance`.

## 4. Bottleneck classification

**Essential to Frame 1 (must stay on the path):**
- Topic: curriculum (concepts/focus) → frame-planner (decomposition) → composer (the MCCR board).
- Source: `curriculumFor` (deterministic) → frame-planner → composer.

**Wasteful — on the path, contributes nothing to Frame 1:**
- **The learning cycle's `explanation` + `challenger` + `practice` model calls** (7b/7c). On the
  composer/frame path the board is produced by the composer (session.ts:897-901); the loop's
  explanation output is **generated, awaited, and discarded** (its block path at session.ts:902 is
  only entered when *no* composer is wired). `practice`/`mastery` only feed a *later* practice frame
  and checkpoint frame — they need not precede Frame 1. **This is ~2–3 discarded serial LLM calls.**

**Deferrable — currently blocks the board, spec says it should follow it:**
- **Image planning + generation** (10) is `await`ed *inside* `prepareFrameEntry` before
  `surface.frame.composed`. The spec ordering law has `surface.image.decided` **follow**
  `composed` (ADR-0030 locks; SRF-002 §6 laws 8-10). So a slow image blocking the board is both
  a latency bug and a spec drift.
- **Representation (RIA)** (12) already emits after `composed` — it delays *voicing*, not the board.

**Reducible:**
- `inferIntent` (2) and `generateCurriculum` (4) are two serial LLM calls that could parallelize or
  merge (curriculum is the one that defines Frame-1 focus).
- `sourceExcerptsFor` then `fusedSynthesisFor` (session.ts:1523,1526) are independent, run back-to-back.

## 5. What already exists (extend, don't reinvent)

The substrate already contains most of the progressive-delivery primitives (UCS ADR-0030 / ADR-0031):

- **One-ahead compose/voice pipeline** — frame N+1's composer starts before frame N is voiced;
  frames surface strictly in ordinal order (session.ts:1248-1268; ADR-0031 §6). K-frame cost drops
  from Σ(compose+voice) to ≈ compose₁ + Σ(voice).
- **Detached speculation** — `prepareLookahead` runs off the ask's critical path, stored in
  `backgroundWork`, awaited by `settle()` at the next ask/close (session.ts:1195-1199, 2401-2458).
  Budget-gated (`lookaheadBudget`, gateway = 1).
- **Speculative pre-composition + promote/invalidate** — `speculative_frames[]`, recorded but never
  surfaced until `promoteSpeculation` skip-recomputes on the predicted concept, else invalidated
  (session.ts:1278-1300, 2356-2392).
- **Image pre-warming** for speculative frames (session.ts:1570-1619).
- **Progressive streaming reveal** — `surface.block.delta` / `surface.frame.element.delta` into
  transient buffers cleared by the whole event (SRF-005 §4.6-4.7; ADR-0028). Model-adapter token
  streaming (`generateContentStream`) can feed these with **no fold/event change**.
- **`surface.ask.progress`** phases (interpreting→planning→composing→voicing→ready) — never-silent ask.
- **Caching:** content-addressed dedupe on registration (store.ts:159-166); intelligence-plane
  memoization for fusion/claims/frontier/timeline (sources.ts:242-299). **Gap:** canonicalization
  output is **not** memoized — identical re-upload re-parses (store.ts:251-269).
- **No global rate-limit / semaphore in the model adapter** (packages/adapters/src/model.ts) — only
  retry-with-backoff. Concurrent `generate()` calls are allowed; parallelism is *available*.

## 6. Invariants the redesign MUST preserve

1. **Replay equivalence** — client `fold(events)` deep-equals server `state()` for *every prefix*
   (SRF-005 §2/§6.2). Reordering emission must keep per-prefix fold equality.
2. **No wall-clock in canonical state** — pacing/highlight-schedule/active-frame are client
   projections; events carry logical `sequence` + durations only (ADR-0007; SRF-001 §4.6-4.7).
   → Parallelizing composition does **not** break narration↔highlight sync, which is a per-frame
   client projection from `narration.segment` `reveal_ids`/`anchor_ref`.
3. **Ordinal surfacing order** — frames may compose in parallel/out of order but MUST *surface* in
   `ordinal` order (ADR-0031 §6; SRF-002 §6).
4. **Transient-buffer equality** — `fold([delta…, composed]) ≡ fold([composed])`; invalidated
   speculation provably absent for every prefix (ADR-0028; ADR-0030).
5. **Governance per dispatch** — every (parallel/deferred/speculative) dispatch still crosses the
   `ProductRuntimeDispatcher` gate before any mutation; provenance + leases + typed memory mutations
   intact (blueprint §25.4 #1/#5/#9).
6. **Detached background needs a quiescence contract** (`settle()`); no unawaited work racing the
   next ask (ADR-0031 §Rejected).
7. **Determinism** — seeded mode produces an identical event log; only real-clock latency differs and
   never enters block/frame content (SRF-005 §6.5).
8. **Static pre-generation is a non-goal** — look-ahead is bounded, continuously re-planned, and
   discardable; mis-highlight worse than no highlight; the learner always pre-empts (ADR-0030; ADR-0033).
9. **HLC monotone per surface** assumes a single producer runtime — fully concurrent *producers*
   within one surface would require HLC rework, so intra-ask parallelism stays at the level of
   concurrent model **calls** whose results emit in ordinal order (SRF-002 §6).

---

## 7. The redesign (phased, invariant-preserving)

**T0 — Client made non-blocking + cold-start-resilient (DONE, deploying).** EnterCard navigates into
the surface immediately and streams frames; `wakingFetch` retries a cold gateway. This is the
client half; the phases below are the server-side pipeline.

**Phase A — Trim the critical path to Frame 1 (highest impact; mostly reorder/skip).**
- **A1. Do not run the learning cycle's discarded model work before Frame 1.** On the composer/frame
  path, skip the `explanation`/`challenger` model dispatch (the composer replaces it) and move
  `practice`/`mastery` to **after** `surface.frame.composed` as background work feeding the later
  practice + checkpoint frames. Removes ~2–3 serial LLM calls. *Invariant:* practice/mastery still
  emit the same governed events + memory mutation, just later in the log; ordinal/ordering laws and
  replay equivalence preserved (the fold is order-tolerant per frame).
- **A2. Defer image off the board path.** Emit `surface.frame.composed` right after the composer;
  run image-planner + generation in the background and emit `surface.image.decided`/media when ready
  (the board already reserves the slot). This is faster *and* restores the spec ordering
  (composed → image.decided). Removes 1 LLM + image-gen latency from F1.
- **A3.** Keep representation (RIA) after `composed` (already is); optionally overlap it with the next
  frame's prepare so it stops delaying voicing.
- *Result:* topic F1 path ≈ intent → curriculum → frame-planner → composer (~3–4 serial LLM);
  source F1 path ≈ curriculumFor(det) → frame-planner → composer (~2 serial LLM).

**Phase B — Stream the first board (perceived-instant).**
- Wire model token streaming (`generateContentStream`) in the composer to emit
  `surface.frame.element.delta` as MCCR elements materialize, cleared by `surface.frame.composed`.
  The board visibly forms in ~1–2 s instead of waiting for the whole composer call. *Invariant:*
  transient-buffer equality is already a defined contract (ADR-0028); deltas carry logical `seq` only.

**Phase C — Parallelize independent pre-frame work.**
- Run `inferIntent` ‖ `generateCurriculum` where independent (or merge into one call); run
  `sourceExcerptsFor` ‖ `fusedSynthesisFor` via `Promise.all`. Concurrent model *calls* are safe
  (no adapter rate-limit); results emit in ordinal order to keep HLC monotone.

**Phase D — Rolling frame buffer (continuous throughput, no playback stalls).**
- Extend the existing depth-1 look-ahead into a small **rolling buffer** (keep 2–3 frames
  pre-composed ahead of the learner) so voicing never waits on compute. Reuses `prepareLookahead` /
  `speculative_frames` / promote-invalidate; the background loop keeps the buffer full while the
  learner consumes. *Invariant:* stays detached + `settle()`-quiesced; speculative frames unsurfaced
  until promoted; **`lookaheadBudget` increase goes through a governed Evolution Proposal** (ADR-0030
  lock 6), not a raw constant bump.

**Phase E — Source-mode fast start.**
- **E1. Background the durable upload + deep parse.** Return 201 after `contentHash` + a *minimal*
  structural pass sufficient for `curriculumFor` (L1 headings); do `storage.put`, full layer
  construction, and (for PDF) deep/late-page parsing in the background. Teach the entry concept
  immediately; canonicalize the rest as the learner reads.
- **E2. Memoize canonicalization by `content_hash`** (the identified gap) so re-uploads skip re-parse.
- **E3.** Begin lightweight analysis the instant bytes arrive (the EnterCard analyze phase becomes
  truly incremental).

**Phase F — Cancellation / reprioritization on redirect.**
- Thread an `AbortSignal` into model dispatches so a new ask / `interact("interrupt")` / jump cancels
  in-flight background compose + speculation and frees CPU immediately (critical on a weak instance).
  Extends the existing one-ask law + `reconcileSpeculations` invalidation. Requires adding cancellation
  to the model adapter (`generate(…, signal)`).

**Infra (out of code):**
- **Keep-warm ping** removes cold-start entirely (client `wakingFetch` already survives it).
- **CPU** remains the raw multiplier: even at ~3 serial calls, a 0.1-CPU instance is slow; a Starter
  instance makes it seconds. Streaming reveal (Phase B) is what makes it *feel* instant regardless.

## 8. Expected impact

| | Serial LLM calls to F1 (now) | After Phase A | + Phase B (perceived) |
|---|---|---|---|
| Topic | ~6–7 | ~3–4 | board forms token-by-token in ~1–2 s |
| Source | ~5–6 | ~2 | same |

Phases D–E give continuous throughput (no mid-lesson stalls) and near-instant source starts; Phase F
keeps it responsive when the learner changes direction.

## 9. Sequencing, ADRs, risk

- **Sequence:** A (trim) → B (stream first board) → C (parallelize) → E (source fast-start) →
  D (rolling buffer) → F (cancellation). A + B deliver the bulk of the felt improvement.
- **Ceremony (CLAUDE.md §4):** the execution-strategy change (A/D/F) is architectural → one **terse
  ADR** ("progressive first-frame delivery: trim the critical path, defer image/practice, widen the
  rolling buffer, add cancellation") extending ADR-0030/0031. B/C/E are additive within that ADR.
- **Risks & guards:** every phase is gated by the existing replay-equivalence, determinism, and
  transient-buffer fold tests — they must stay green; reordering emission (A1/A2) is the main risk
  and is exactly what those tests protect. Governance/provenance/lease checks remain on every deferred
  or parallel dispatch. No new wall-clock, no static pre-generation, ordinal surfacing preserved.

## 10. Open decisions (for validation)

1. **Scope of first cut:** ship **Phase A + B** first (the ~2× TTFF win + token-streamed board), then
   C–F as follow-ups? (Recommended.)
2. **A1 boldness:** fully skip the learning-cycle explanation/practice on the frame path, or keep a
   cheaper deterministic supervisor pass and only defer the model calls?
3. **Rolling-buffer depth (Phase D):** target buffer size (2 vs 3) and whether to route the
   `lookaheadBudget` change through an Evolution Proposal now or defer D.
4. **Infra:** set up a keep-warm pinger now (free), and do you want the Starter CPU upgrade later for
   raw speed?
