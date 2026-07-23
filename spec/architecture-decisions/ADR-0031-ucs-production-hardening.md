# ADR-0031: UCS Production Hardening — Playback Law, Density Law, Pipeline, and Export

**Status:** Accepted
**Date:** 2026-07-09
**Related:** ADR-0030 (cognitive frames, MCCR, narration split), ADR-0007 (surface choreography &
timing), ADR-0028 (block-delta streaming), ADR-0029 (surface agent-observability events),
SRF-001/SRF-002/SRF-004/SRF-005, F16, F09, F04 (misconception work), F14 (honest assessment),
research/ucs-implementation-review-2026-07 (the review this ADR answers)

## Context

The July 2026 implementation review's verdict was **"the architecture is faithful; the experience
is not"**: narration repeated or silently stalled, boards arrived near-empty under giant type, raw
LaTeX reached learners, images never generated, every unit degraded silently, the learner waited
through a fully serialized ask with zero acknowledgment, and a finished session evaporated with the
tab. This ADR records the decisions of the production-hardening pass that closes those gaps **on
the existing substrate** — no event-law changes, no new canonical state beyond what is listed in
the schema section, replay preserved throughout.

## Decisions

### 1. Exactly-once narration playback (client law)

All audio lifecycle moves into a single framework-free owner (`NarrationPlayer`), with:

- **one playback session per `segment_id`** — re-entrant `play()` is idempotent (playing → no-op;
  paused → resume; completed → never self-replays). The root cause of every duplicate narration
  was a React effect keyed on the folded segments array: any SSE event re-ran it and re-invoked
  `audio.play()` on an ended element, restarting it. The playback effect is now keyed on **segment
  identity only** (segment_id + voice ref + mode); fold churn structurally cannot reach the audio
  element.
- **epoch + AbortController guards** on every async edge (`ended`, `error`, rejected `play()`,
  watchdog, rAF loop): a callback from a previous session can never advance the current one.
- **degradation to reading-time pacing** on any audio failure (404, decode error, blocked
  autoplay, silent stall): the caption keeps moving; the surface can never freeze with a dead
  speaker.
- **the audio element's own `currentTime/duration` as the progress clock**, gated on `readyState`
  (a buffering element reports no progress rather than lying).
- **word-caption progress via an external store** subscribed at the caption leaf
  (`useSyncExternalStore`, snapshot = spoken-word index): the 60 Hz progress clock re-renders one
  line, never the surface tree.

Clock and audio are injected; the whole state machine is deterministic under fake time and pinned
by tests (duplicate `ended`, watchdog + late `ended`, error fallback, autoplay rejection,
pause/resume, live rate change).

### 2. Density law (MCCR composition)

The composer's contract changes from "≤ 6 anchors, omit if unsure" to: **fill every slot that
genuinely carries cognition — a well-taught frame typically lands 5–7 anchors; total ≤ 8; never
invent filler; never drop a formula, worked example, misconception, or diagram the concept truly
has.** Definitions are complete sentences; examples are worked (inputs → steps → result); the
board alone must let the learner reconstruct the idea after the voice stops. Deterministic
fallbacks stay minimal-and-honest (visible degradation over fabricated density).

### 3. MCCR schema additions (1.4.0 → 1.5.0, additive)

- **`misconception` element type** (text): the single most common wrong belief, stated with its
  correction (F04's misconception work becomes a first-class anchor). Plannable, composable,
  foldable (fold order: after `table`), rendered with the confusion-state (ember) identity.
- **`key_formula.lines[]`**: an optional multi-line derivation (each entry one LaTeX line,
  top-to-bottom, ~10 lines max), rendered as a stacked textbook-style derivation.
- **`diagram.kind` gains `cycle`**: a closed loop laid out by walking the edge chain around a
  ring, so arrows flow instead of criss-crossing.
- **`surface.ask.progress` event** `{ surface_id, phase, detail }` with a latest-wins fold slice
  (`ask_progress`): the learner-visible phase of an in-flight ask
  (`interpreting → planning → composing → voicing → ready`). Pure progress projection; carries no
  cognition; an ask is never silent.

Folds ignore unknown members, so 1.4.0 logs replay unchanged (additive evolution per SRF-002 §12).

### 4. Mathematical rendering seam

Two renderers behind one `latexToHtml` seam: a dependency-free instant fallback (Greek, operators,
sub/superscripts, fractions — first paint, SSR, tests, load failure), upgraded in place by **KaTeX**
loaded lazily as its own chunk. KaTeX over MathJax: synchronous + deterministic rendering (replay
law), an order of magnitude faster, and covers the derivation/matrix/aligned notation the composer
emits; MathJax's advantage (exotic LaTeX) is notation the composer is instructed not to produce.
Components subscribe to the upgrade and re-render the moment it lands.

### 5. Semantic visual grammar (CDL extension)

Each cognitive role borrows its hue from the existing 8-state palette at **structural amplitude**
(role tags ~70%, edges ≤ 25%, washes ≤ 7%): formula = learning cyan, worked example = practice
green, mental model = discovery amber, misconception = confusion ember (never alarm), memory cue =
reflection, table = research. The learner's eye navigates the board by role; the narration
spotlight remains the only focal accent. Diagram node `group`s map deterministically (first
appearance) to the same palette. No new tokens; no decoration.

### 6. Ask pipeline: progress, one-ahead composition, detached speculation, one-ask law

- **`surface.ask.progress`** events at every phase boundary (see §3); the client shows the phase
  in the Voice Line and disables the ask affordance while one is in flight.
- **One-ahead compose/voice pipeline:** frame N+1's composer dispatch starts before frame N is
  voiced; frames still surface strictly in ordinal order. Wall-clock cost of a K-frame lesson
  drops from Σ(compose+voice) to ≈ compose₁ + Σ(voice) — the learner listens while the next board
  forms. The learner's interrupt is honored between frames (in-flight composition drains, then
  surfacing stops).
- **Speculation off the critical path:** `prepareLookahead` runs detached after the ask response
  returns; its events stream in behind it. A `settle()` quiescence API awaits background work
  (called automatically at the next ask and at close; tests call it before asserting).
- **One ask at a time:** a second ask mid-flight is refused with an explicit error — never a
  silent state reset under the first. Interruption remains the `interact("interrupt")` verb.

### 7. Honest degradation, named truthfully

`finishReason === "max_tokens"` now degrades as `E_MODEL_OUTPUT_TRUNCATED` (not "malformed
output") in the composer, frame planner, and image planner — the health slice must name the real
cause (budget) or the budget can never be fixed. Image generation gains one bounded retry on
transient provider failure, and the ImagePlanner's authored prompt reaches the provider whole
(truncating it to a 120-char stub was a live image-quality bug). A failed image artifact keeps its
cognition (caption + callout labels) on the board as a quiet text panel — never a blank hole. The
board never cascades to a decorative placeholder image: honest absence with a recorded reason
beats decoration (images are cognition or they are absent).

### 8. Observatory as OS inspector

The Observatory gains: a **cognition-health panel** (fallback counts + last reason per unit — a
session with zero fallbacks says so explicitly), a **playback diagnostics line** (choreographer
mode/position/rate), and a **searchable event inspector** over the raw streamed log (filter by
type or payload text, newest first, expandable JSON) — the canonical record made literal, in the
product. Table rows beyond the viewport cap and slide-overflow anchors are *disclosed* (focus
plane / speaker notes), never silently truncated.

### 9. Downloadable cognitive session (export seam)

A **pure deck model** (`buildDeckModel(SurfaceState)`) projects surfaced frames into an exportable
study artifact: one frame ⇒ one slide (core concept as title, anchors as typed role-labeled
blocks), the narration script as speaker notes, the path as the cover. The first renderer is
**.pptx** (pptxgenjs, lazily loaded client-side): CDL dark stage, state-accent per slide, native
vector diagrams reusing the board's deterministic layout function, images embedded, honest
overflow into notes. Future PDF/Markdown/LaTeX exporters consume the same model — every format
derives from the canonical frame model, never from screenshots.

## Consequences

- The five review root causes are closed: fallbacks are counted and truthfully named; the ask is
  acknowledged, pipelined, and guarded; the audio pipeline is exactly-once by construction; the
  board carries a complete cognitive representation with a navigable visual grammar; and a session
  produces a durable study artifact.
- `settle()` becomes part of the session contract; anything asserting on post-mastery speculation
  must await it.
- Event ordering within an ask changes (frame N+1's planned/dispatch events interleave with frame
  N's narration; speculation events land after the ask response). Replay equivalence is unaffected
  — the fold is order-tolerant per frame and byte-identical over any given log.
- KaTeX and pptxgenjs enter `apps/web` as lazy chunks only; the surface's first paint pays for
  neither.

## Rejected

- **MathJax** (async rendering breaks the deterministic-projection law; weight unjustified).
- **Cascading failed image generation to the null SVG card** (a decorative placeholder violates
  image-as-cognition; honest absence + recorded reason wins).
- **Incremental client-side fold** (the fold's internal mutability would break React identity
  semantics; per-animation-frame event batching + event-id watermark dedupe removes the O(n²)
  burst cost with zero semantic risk).
- **Fire-and-forget speculation without a settle law** (unawaited background work racing the next
  ask is exactly the class of bug this pass exists to kill).
