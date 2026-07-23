---
name: ucs-implementation-review-2026-07
spec:
  id: RES-UCS-REVIEW-2026-07
  title: UCS Comprehensive Architecture & Experience Review — does the implementation embody the vision?
  domain: research
  status: final
  owner: product-architecture
  last_reviewed: 2026-07-02
  semantic_tags: [review, ucs, adr-0030, cognitive-frames, mccr, experience-audit, vision-alignment]
  canonical_references:
    - architecture-decisions/ADR-0030-cognitive-frames-mccr-narration-split
    - surface/cognitive-surface-runtime
    - product/features/F16-cognitive-surface
---

# UCS Implementation Review — July 2026

**Method.** The vision was reconstructed first from the spec corpus (vision-application, pedagogy,
product features F01–F16, cognitive_surface, SRF-001/002/005, ADR-0007/0028/0029/0030) and treated
as the product. The implementation was then audited three ways: (1) code-vs-spec analysis of the
cognition units, the surface session, and the entire web layer; (2) **live product evaluation**
against the running gateway (real Gemini) — two full asks, path/transport/Observatory interaction,
raw SSE event-log inspection; (3) design-system and philosophy critique against the reconstructed
yardstick. Every claim in the user-supplied live review was reproduced or rejected with evidence.
Live artifacts: `tmp-events/review-shots/` (screenshots + SSE snapshots, surface `srf-d5cbb1672d0a`).

---

## 1. Executive Summary

**The architecture is faithful. The experience is not.**

The event/fold/replay law of ADR-0030 is implemented with genuinely high fidelity: the eight
`surface.frame.*` events, the MCCR/narration split, speculation slices that provably never surface
until promoted, no `active_frame_id` in the log, deterministic folds, per-segment out-of-band audio,
an honest Observatory with D2/D3 determinism badges. When the model path fires, the product moment
is real: live evaluation produced a 5-anchor MCCR board (concept, definition, formula, mental model,
table), five narration segments each with element-level focus and real per-segment audio, and a
word-synchronized caption. The bones of a new medium are there.

But the *learner's* experience diverges from the vision in five systemic ways:

1. **Silent cognitive degradation.** The frame planner and image planner fell back to their
   deterministic paths on every live ask (D2, confirmed in the event log); the composer succeeded
   on ask 1 and fell back on ask 2. The product silently oscillates between "cognitive medium" and
   "template renderer" with no health signal anywhere but a buried Observatory badge.
2. **The learning loop dead-ends after one concept.** Clicking the next concept in the Path emits
   only a `focus.changed` event — no teaching begins. The only continuation is typing a new free-text
   ask, which **regenerates the whole curriculum**, destroys the old path, mints new concept slugs,
   and (verified live) invalidates the speculative frame every time. Look-ahead promotion is
   structurally unreachable at the gateway. Understanding does not compound; it restarts —
   the exact failure the product exists to abolish.
3. **Pedagogy is theater.** The practice frame displays the *meta-prompt* ("Give one concrete
   practice problem for…") instead of the Coach's actual Gemini-generated problem (which was
   verified present in the reasoning log and never reaches the board). There is no input, no answer,
   no check anywhere in the web app. The five-test depth gate then "passes 5/5" with fabricated
   evidence strings ("solved practice problem") and auto-grants mastery at 0.9 — the learner did
   nothing. This is the deepest violation of the product's own law (F14).
4. **The production gateway is the demo fixture.** It runs on a frozen `ManualClock`
   (2026-06-11T00:00:00Z on every event), all work timings are 0 ms, the web client mints a fresh
   learner every page load and never sends the bearer token, and persistence is in-memory. Nothing
   survives; nothing compounds; observability timing is fiction.
5. **The last mile of experience is missing.** Raw LaTeX shown to learners; the highlight marker
   mispositioned under frame titles and under fit-scaling; dead ends with all controls auto-hidden;
   zero feedback after asking (verified: the ask box clears and nothing on screen acknowledges it
   for the multi-minute serialized pipeline); no error states; the goal string leaking verbatim
   into titles ("Foundations of Now teach me gradient descent").

**Verdict:** today this reads as an exceptionally well-architected *rendering of cognition events* —
closer to a beautiful observability console for a teaching pipeline than to the Universal Cognitive
Surface. The gap is not architectural rework; it is (a) making the model path reliable and honest,
(b) closing the learning loop, (c) making pedagogy real, and (d) finishing the experience layer.
All four are reachable on the existing substrate — the substrate is the strongest thing here.

---

## 2. Overall Product Alignment Score

| Dimension | Score /10 | One-line justification |
|---|---|---|
| Substrate & event law (ADR-0030, SRF-001/002/005) | **8.5** | Fold rules, speculation isolation, replay, out-of-band media all faithful |
| Observability (ADR-0029) | **6.5** | Observatory honest and rich; no timing on the frame path, response_kind dropped by fold, speculation reasoning gap |
| Cognition quality (composer/planner/image live) | **3.5** | Planner + imageplanner 100% fallback live; composer flaky; curriculum templated |
| Learning loop & compounding | **2.0** | Dead-end after one concept; path destroyed per ask; no learner identity at the client; in-memory |
| Pedagogy integrity (practice/assessment) | **1.5** | Non-interactive; fabricated mastery evidence; meta-prompt on the board |
| Narration & choreography | **6.5** | Per-segment sync + word captions real; pause_after dead; audio-failure stall; no re-chunk guard |
| Visual cognition (MCCR rendering) | **4.5** | Anchors real; raw LaTeX; ring-only diagrams; no staged reveal; sparse-frame emptiness |
| Experience design (motion, color, states) | **5.0** | Intentional token system betrayed by stranded tokens, dead ends, zero error states |
| Accessibility | **5.5** | aria-live, reduced-motion, focus-visible present; focus traps, keyboard SVG, contrast, touch targets missing |
| **Overall product alignment** | **4.5 / 10** | A faithful cognitive OS wearing an unfinished product |

---

## 3. Architectural Alignment Matrix

| Subsystem | Spec | Implementation | Gap | Root cause | Direction |
|---|---|---|---|---|---|
| Cognitive Frames | ADR-0030, SRF-001 §4.7 | Events, fold, deck, transitions all present | Frames pop whole (no element deltas produced); reveal_order unused | Delta producer never written; FrameStage renders all at once | Emit `frame.element.delta` from composer streaming; stage reveals on narration |
| MCCR | SRF-001 §4.8 | 10 element types, fold, renderer registry | Formula raw LaTeX; diagram ignores `kind`; no density design for sparse frames | Renderer last-mile never finished | KaTeX; per-kind diagram layouts; sparse-frame composition |
| Narration split | ADR-0030 lock 3 | Real — script events, per-segment TTS, anchor focus | `pause_after` dead at both ends; one-giant-segment unguarded | Field dropped at `session.ts` narrate mapping; no re-chunk by design | Honor pause_after in choreographer; segment-length guard in parser |
| Choreography | ADR-0007 | Client projection, no wall-clock, transport works | Audio error ⇒ permanent stall; manual nav kills autoplay silently | No `error` handler / fallback timer on voiced branch | Error listener + timer fallback; resume-autoplay affordance |
| Look-ahead (P3) | ADR-0030 lock 6 | prepare/invalidate/promote + fold isolation correct | Promotion unreachable live: per-ask curriculum regenerates slugs; lookahead cost paid inside ask latency | Gateway asks are goal-scoped, not path-scoped | Path-scoped asks ("teach concept X on path Y"); prepare after response returns |
| Image agent (P4) | SRF-006 §4.1 | Unit + wiring + fold + labels correct | 100% deterministic fallback live ⇒ no image has ever generated; `image.decided helps:true` can record while board has none | 1024 maxTokens on a thinking model + 20s timeout; decided emitted from plan not outcome | Raise budgets/timeout; emit decided from generation outcome |
| Frame planner (P2) | ADR-0030 | Unit + multi-frame prompt + practice/assessment frames | 100% deterministic fallback live ⇒ single-frame plans always | 2048 maxTokens + 20s timeout (legacy units get 60s) | Unify budgets; add `finishReason=max_tokens` detection; count fallbacks |
| Composer (P1) | ADR-0030 | Full contract, JSON schema, 5/6 anchors when live | Flaky (live: D3 then D2); all-or-nothing parser discards rich partial outputs | 20s timeout; strict parse; no fallback-rate accounting | 60s timeout; salvage partial MCCR; health metric |
| Curriculum | F02/F03 | Model unit exists | Live output is the deterministic scaffold with the raw goal embedded ("Applying Teach me Neural Networks") | Same fallback class; goal string never cleaned | Fix model path; strip/interpret goal → topic |
| Assessment | F14 five-test gate | Gate evaluated, evidence recorded, frames rendered | Evidence fabricated; no learner input exists; auto-mastery | Depth gate consumes synthetic `input.mastery`, not learner responses | Gate on real learner answers; block advancement until practice answered |
| Memory/compounding | F05 | Learner registry + cognition merge exist server-side | Web client never authenticates; in-memory persistence; path replaced per ask | Demo fixture promoted to gateway; client skipped identity | Bearer token in client; `COS_PERSIST_DIR` on; path continuity |
| Observatory | ADR-0029 | Agents, composition, reasoning, ensemble, provenance panels | No work timing on frame path; speculation composer reasoning missing; image prompts not shown; frozen clock zeroes all latency | ManualClock at gateway; emissions gaps | SystemClock; timing around frame dispatches; show prompts |

---

## 4. Verified Issues (reproduced with evidence)

Each verdict cites live evidence (surface `srf-d5cbb1672d0a`) and/or code.

1. **FramePlanner always deterministic — CONFIRMED.** Both live asks: reasoning summary
   `"planned a 1-frame sequence via deterministic"`, D2. Root cause candidates: 20s timeout +
   `maxTokens: 2048` on a thinking model (`frame-planner-unit.ts:339,417`) while legacy units get
   60s (`wiring.ts:552`); truncation lands as parse failure (no `finishReason==="max_tokens"` check).
2. **ImagePlanner always fallback / no images — CONFIRMED.** All 6 image decisions across two asks:
   `helps:false`, D2, "deterministic fallback — no media planned". No image has ever been generated
   at the gateway. Same budget/timeout class (`image-planner-unit.ts:203,281` — 1024 tokens, 20s).
   Additionally the imageplanner's non-null fallback **suppresses** the composer's inline
   `image_plan` even when the composer said `helps:true` (`session.ts:1153-1160`).
3. **Composer flaky (not always fallback) — PARTIALLY CONFIRMED.** Ask 1: `via gemini-2.5-flash`,
   D3, confidence 0.83, 5/6 anchors, 5 segments. Ask 2: `via deterministic`, D2 ⇒ 2 anchors, one
   segment. The parser is also all-or-nothing: a rich response missing only `core_concept` discards
   everything (`surface-composer-unit.ts:293-298`).
4. **Curriculum deterministic + goal-string leakage — CONFIRMED (new).** Both asks produced the
   template scaffold: `foundations-of-…/core-of-…/applying-…` around the *raw typed goal*, yielding
   board titles like "Foundations of Teach me Neural Networks" and "Foundations of Now teach me
   gradient descent".
5. **No formula rendering — CONFIRMED.** Board displays literal `y = \sigma(\sum_{i} w_i x_i + b)`
   (screenshot 01). `MccrElement.tsx:50-54` renders `content.latex` into a mono `<code>`; no KaTeX
   dependency exists.
6. **Practice frame shows the meta-prompt; no interaction — CONFIRMED.** Board text: "Give one
   concrete practice problem for Foundations of Teach me Neural Networks" (screenshot 05) — this is
   `input.practicePrompt`, the instruction *to* the Coach (`session.ts:711-718`), while the Coach's
   real generated problem (verified in the reasoning panel) never reaches the board. No answer
   input, submit, or check exists anywhere in `apps/web`.
7. **Checkpoint theater + auto-mastery — CONFIRMED (inverts the "checkpoint freezes" claim).** The
   gate emitted `passed 5/5` with canned evidence ("articulated core concept", "solved practice
   problem") and confidence 0.9; the learner never interacted. The practice segment lasts 3.7s of
   narration, then the checkpoint auto-passes. The *actual* freeze is **after** the checkpoint:
   an almost-empty frame, all controls auto-hidden, no continue affordance (screenshot 03).
8. **Navigation to the next concept does nothing — CONFIRMED.** Clicking "Core of … — available"
   in the Path emitted `interaction.received → focus.changed(concept) → interaction.applied` and
   nothing else; the board did not change. `jump`/`branch` never compose frames
   (`session.ts:1766-1810`).
9. **Progression/compounding broken — CONFIRMED.** The second ask regenerated the timeline
   (`timeline.generated` with brand-new slugs), destroying the mastered path. Speculation was
   invalidated with reason "learner advanced to foundations-of-now-teach-me-gradient-descent, not
   the predicted…" — promotion is structurally unreachable (per-ask curriculum ⇒ slug mismatch).
10. **No feedback while thinking — CONFIRMED.** After submitting ask 2, the screen showed zero
    change (screenshot 06) for a multi-minute, fully serialized pipeline (intent → curriculum →
    explanation → challenger → practice → planner → composer → TTS-per-segment → speculation, all
    awaited inline; the command POST stays open throughout). Only a header micro-dot changes.
11. **Highlight layer mispositioned — CONFIRMED (in code).** The marker is measured relative to
    `.frame-grid` but positioned in `.frame-fit`'s containing block: offset by the title height on
    every titled frame, and wrong by the scale factor whenever `useFitToViewport` downscales
    (`HighlightLayer.tsx:41-50`, `FrameStage.tsx:55-75`).
12. **Audio failure stalls the surface forever — CONFIRMED (in code).** Voiced branch registers
    only `ended`; no `error` handler, no fallback timer; a 404/autoplay rejection freezes the
    cursor with the waveform still animating (`useChoreographer.ts:66-115`).
13. **Frozen clock / zero timings at the gateway — CONFIRMED (new).** Every event timestamp is
    `2026-06-11T00:00:00.000Z`; all `work.timing` values 0 ms. `apps/cli/src/wiring.ts:496`:
    `new ManualClock(Date.UTC(2026, 5, 11))` — the gateway hosts the demo fixture.
14. **Weak empty/sparse states — CONFIRMED.** The checkpoint frame renders a duplicated title
    (h1 + identical `core_concept` text) plus one line in an otherwise empty viewport
    (screenshots 03/05); no sparse-frame composition exists (`styles.css:2147`).
15. **Dead controls — CONFIRMED (specific list).** Entry-point picker chips can never change state
    (`TimelineGraph.tsx:89`); `onExpand` is wired but unused (`SurfaceView.tsx:28-32`) so the whole
    progressive-deepening capability is unreachable from the UI; CompositionPanel frames aren't
    clickable; Scene drag closes the entire overlay (click-after-drag, `SceneCanvas.tsx:214`);
    Interrupt doesn't stop client audio.
16. **`pause_after` dead — CONFIRMED.** Produced, spec'd, recorded, folded — and honored nowhere
    (`narration.ts:147-154`, `useChoreographer.ts`); deterministic frames even hardcode it false.
17. **Stranded design tokens — CONFIRMED.** `--border`, `--bg-panel`, `--bg-stage`, `--surface`,
    `--ink-dim`, `--warn` referenced but never defined ⇒ Educator overlay renders unstyled and
    transparent over the stage; mode/projection chips lose borders; image callout labels are
    near-white text on a white pill (`styles.css:1321`, `:1293`, `MccrElement` labels).
18. **Observatory blind spots — CONFIRMED.** `response_kind` emitted on `frame.composed` but
    dropped by the fold; no `work.timing` for composer/planner/imageplanner (the dominant live
    latency); speculative composer runs emit no reasoning summary; image prompts folded but not
    rendered (`projection.ts:681-716`, `CompositionPanel.tsx:84-86`).
19. **Client performance hazards — CONFIRMED.** O(n²) full-log refold per SSE event
    (`useSurfaceStream.ts:43`); ~60 Hz whole-tree re-render during narration via rAF `setProgress`
    (`useChoreographer.ts:135-147`).
20. **Ask concurrency unguarded — CONFIRMED (in code).** A second ask mid-flight resets session
    state under the first (`session.ts:469-483`); the UI never disables the ask box; `interrupted`
    is never checked by the frame-composition loop.

---

## 5. Rejected Issues (did not reproduce as claimed)

1. **"Composer always using deterministic fallback" — REJECTED.** Ask 1 was genuinely
   model-composed (D3, gemini-2.5-flash, 0.83). The truth is *flakiness* (issue 3), which is worse
   to diagnose and still unacceptable — but the claim as stated is false.
2. **"Only 2 MCCR anchors" — REJECTED as a general claim.** The model-composed frame carried 5/6
   anchors (Observatory confirms). Two anchors is the *fallback* signature and the *by-construction*
   shape of practice/checkpoint frames. The claim is a correct description of degraded and
   pedagogical-frame moments misread as the norm.
3. **"No diagrams" — PARTIALLY REJECTED.** The diagram element type, fold, and an SVG renderer all
   exist; the live speculative frame's script anchored a diagram. But the renderer lays every kind
   out as a ring (ignores `node-graph|flow|axes|tree`), and the first composed frame happened to
   include none — diagrams are under-delivered, not absent.
4. **"Highlight layer absent" — REJECTED.** It exists and the chain (anchor_ref → element focus →
   marker) is fully wired; the defects are positioning bugs (issue 11), not absence.
5. **"Narration not synchronized / single narration segment" — REJECTED for the model path.**
   Five segments with element-level focus, real per-segment audio durations (8.2s/16.9s/29.8s/…),
   and word-level caption tracking were observed. Single-segment collapse is real only on the
   fallback path and pedagogical frames.
6. **"Frame transitions incomplete" — MOSTLY REJECTED.** A real 560 ms cross-dissolve with vertical
   drift exists (`FrameDeck` exit-hold + CSS); N+1 image pre-warm exists (thin: image-only). Minor:
   a 640 vs 560 ms constant mismatch.
7. **"Timeline broken / scene navigation broken" — PARTIALLY REJECTED.** The timeline renders,
   states update (mastered/available/locked verified live), and the Scene canvas drags/zooms. What
   *is* broken is the consequence of clicking (issue 8) and drag-closes-overlay (issue 15).
8. **"Checkpoint freezes" — REJECTED as stated, replaced by issue 7** (checkpoint is
   non-interactive theater; the freeze is the post-checkpoint dead end).
9. **"Color palette monochromatic" — PARTIALLY REJECTED.** The token system defines a deliberate
   near-black blue-slate observatory with cyan voice and four agent accent hues. The *felt*
   monochrome comes from (a) almost every surface sharing the same four dark values, (b) the accent
   hues appearing only in chrome (Observatory, HUD), never in the learning content itself, and
   (c) the stranded-token regressions. The diagnosis is "underused palette + broken tokens," not
   "no palette."
10. **"No replay" — PARTIALLY REJECTED.** Segment-level scrub/prev/next/speed exist and worked live
    (scrubbing back re-presented the practice frame correctly). What's missing is frame/concept-level
    replay affordance and any way to reopen a finished surface from the UI (no URL routing).
11. **"Buttons non-functional" — REJECTED as a blanket claim.** Transport, scrub ticks, Observatory,
    Path open/close, ask box all function. The genuinely dead ones are enumerated in issue 15.

---

## 6. Newly Discovered Issues (beyond the supplied review)

Highest-signal items not in the original list:

- **N1. The gateway is the demo fixture** — frozen ManualClock, fixture leases dated 2026-06-11,
  zero timings (issue 13). Everything downstream (ActivityTimeline, latency observability, memory
  decay semantics) is fiction.
- **N2. Fabricated mastery evidence** (issue 7) — arguably the most vision-hostile single line in
  the codebase: `evidence: "solved practice problem"` for a problem never shown as answerable.
- **N3. Practice meta-prompt leak** (issue 6) — generated pedagogy exists and is discarded.
- **N4. Per-ask curriculum regeneration destroys continuity** (issue 9) — no compounding, ever.
- **N5. Speculation promotion structurally unreachable + its cost is paid inside the learner's ask
  latency** (`session.ts:876-878`) — P3 currently *adds* latency and never pays out.
- **N6. Learner identity unused by the client** — bearer auth and cognition merging exist
  server-side; `apps/web/src/api.ts` never sends a token; every reload is a stranger.
- **N7. Asks are never echoed** — no acknowledgment of learner input anywhere (with no chat list,
  feedback was removed along with chat form).
- **N8. Zero error states + no React error boundary**; `enterSurface` failure is an unhandled
  rejection; SSE error shows "reconnecting" forever.
- **N9. Voice synthesis has no retry and no timeout** and is awaited serially inside `ask()` — one
  hung TTS call hangs the whole ask (`voice.ts:175-214`, `narration.ts:296-318`).
- **N10. `surface.image.decided` can record `helps:true` when generation failed** — the canonical
  record diverges from the board (`media.ts:104-109`, `session.ts:1480-1487`).
- **N11. SSE subscribe race** — events published between snapshot replay and live subscribe are
  silently lost on a healthy connection (`server.ts:97-108`).
- **N12. Narration segments are not deduped by the fold** — SSE redelivery duplicates spoken
  segments (`projection.ts:561`).
- **N13. `streaming_frame_elements` has no producer and no renderer** — ADR-0028's "cognition forms
  before your eyes" is invisible on the exact path the gateway runs.
- **N14. Title duplication** — every pedagogical frame renders its title twice (h1 + core_concept).
- **N15. Google Fonts via render-blocking @import with no self-hosted fallback** (aborted during
  the live run).
- **N16. Agent naming inconsistency in the Observatory** ("Explainer, revision, Assessor, composer,
  Coach") — half friendly names, half raw ids.
- **N17. `.mccr-formula` has `overflow-x:auto`** — a scrollbar inside the no-scroll law; and
  `useFitToViewport`'s 0.7 floor + `overflow:hidden` silently amputates oversized frames.
- **N18. The revision/challenger + full 7-layer explanation still run on every frame-path ask**
  purely to feed evaluation — roughly doubling model cost and latency for content the learner
  never sees.

---

## 7. Root Cause Analysis

Five systemic roots explain ~90% of the findings:

1. **Fallback-as-safety-net without health accounting.** Every unit degrades silently and
   "visibly" only in a panel nobody is required to open. No metric counts fallbacks; a 100%
   degraded session is indistinguishable from health. Combined with inconsistent budgets
   (20s/2048/1024 for the new units vs 60s/4096 for legacy ones) and no `max_tokens` finish-reason
   handling, the *newest, most vision-critical* units are the *most likely* to silently degrade.
2. **The demo fixture was promoted to production.** `buildDemoSession` (ManualClock, fixture
   leases, ask-scoped curriculum, in-memory stores) is the gateway's engine. Decisions that were
   correct for a deterministic demo — frozen clock, per-ask world — are experience-breaking in a
   product that promises time-aware, compounding cognition.
3. **The frame path was grafted onto the legacy loop rather than replacing it.** The loop still
   produces explanation/practice/assessment *blocks*; the frame path re-renders them as frames from
   the loop's *inputs* (hence the meta-prompt leak) and its synthetic mastery object (hence the
   fabricated gate). The two pipelines share one ask and double the cost.
4. **The UI renders events; it does not conduct learning.** Every projection is faithful, but no
   component owns "what should the learner do next": path clicks are focus-only, expand is
   unreachable, checkpoints don't wait, dead ends have no affordance, asks get no echo. The UI
   treats the learner as an audience member, not a participant.
5. **The design system forked mid-flight.** The ADR-0030 CSS layer was written against a token
   vocabulary (`--border`, `--surface`, `--bg-panel`…) that no longer exists, abandoning the type
   and spacing scales — producing the unstyled Educator overlay, white-on-white labels, and two
   visual dialects in one product.

---

## 8. Product Philosophy Drift

Against the reconstructed vision yardstick:

- **"The board is where the learner thinks, not where the system thinks."** *Half-achieved.* The
  MCCR/narration split genuinely works when composed. But the board still shows system artifacts
  (meta-prompts, duplicated titles, template goal strings) — the system's plumbing leaks onto the
  learner's thinking surface.
- **"Understanding compounds."** *Violated end-to-end.* In-memory persistence, anonymous client,
  per-ask curriculum replacement, unreachable promotion. Every interaction restarts — the precise
  pathology in the problem statement of every vision document.
- **"The learner never feels lost, never alone."** *Violated at every seam.* Dead-end checkpoint
  with hidden controls; unacknowledged asks; minutes of silent generation; no error states; manual
  navigation silently kills autoplay.
- **"A cognitive partner, not an assistant."** *Not yet either — it's a performer.* The system
  performs teaching *at* the learner: no moment exists where the learner's answer, confusion, or
  curiosity changes what happens next (interact verbs re-run the same ask; practice can't be
  answered; confusion descent is driven by synthetic evaluation, not learner evidence).
- **"Agents collaborate invisibly."** *Inverted, interestingly.* Agents are highly visible
  (Observatory — good, spec'd) while their *work products* are invisible (planner reasoning about
  pacing, image prompts, speculative content). The learner sees the workers but not the craft.
- **"Never slides, never chat, never scrolling."** *Mostly honored in structure.* No scroll
  (modulo the formula scrollbar), no message list, real frames. But auto-advancing one-liner
  fallback frames with a bottom caption *feel* like narrated slides; and the bottom-docked ask box
  without any conversational feedback is chat's form without chat's virtue.
- **Assessment philosophy ("tests of reflection, not memory; no shame; genuine transfer").**
  *The fabricated gate is the single largest philosophical breach* — it converts the product's
  central promise (verified mastery) into decoration.

---

## 9. UX Evaluation

- **First-run:** strong. The landing ("Watch understanding unfold.") is confident and on-voice;
  entering produces visible cognition quickly (planned frame skeleton, presence, then the board).
- **During generation:** poor. After the first frame, everything is serialized behind one POST;
  the learner gets no phase feedback ("Choosing what to teach… composing the board… giving it a
  voice…"). Perceived latency is the full pipeline.
- **Interaction rhythm:** the four reshaping verbs (Go deeper / Simpler / Example / Challenge) are
  the right idea and genuinely spec-aligned; but they re-run the entire ask (another full pipeline)
  and give no immediate acknowledgment, so the rhythm is: press → silence → whole new frame set.
- **Discoverability:** the auto-hiding HUD hides *everything* actionable at exactly the moments a
  learner needs guidance (dead ends). Keyboard: no shortcuts at all for a transport-centric UI.
- **Trust:** the Observatory is a real differentiator (honest determinism badges, provenance
  chains) — but trust is undermined where the board lies (mastery theater, image.decided mismatch).

## 10. UI Evaluation

- **Layout:** the frame grid with archetype hints is sound; full-width strips for concept/definition
  + card grid reads clean at 5-6 anchors. At 2 anchors it collapses into emptiness (no sparse
  composition, no vertical centering).
- **Typography:** the Fraunces/Space Grotesk/Space Mono trio is distinctive and hierarchical at the
  top; it disintegrates at the bottom — 10.5px uppercase micro-labels everywhere, ad-hoc rem values
  in the frames layer, render-blocking external fonts.
- **Component quality:** Observatory panels are the most finished surfaces in the product. The
  EducatorOverlay is the least (unstyled via dead tokens, always-on, non-dismissible, colliding
  with the HUD).
- **States:** loading states good (shimmer, "Composing…", listening aura); error states absent;
  empty states present for panels but absent for the learning dead-end (the most important one).

## 11. Cognitive Surface Evaluation

The surface is a faithful projection but a passive one. What separates it from a "thinking
surface": elements never appear *as they are discussed* (reveal machinery unused); nothing on the
board is manipulable (no drag-to-connect, no hover-to-ask, no "why?" on an anchor — F16's causal
transparency); visual memory does not accumulate (each frame replaces the last; no persistent
concept-map growth across frames or asks; mastered concepts don't acquire a visual identity). The
board renders cognition; it does not yet *host* it.

## 12. Teaching Quality Evaluation

When the composer fires, the content quality is genuinely good (the factory analogy, correct
formula, sensible table). Structural teaching failures: one concept per ask with no continuation;
depth ladder (7 layers) generated but unreachable (expand dead); practice unanswerable; no
misconception work (challenger runs but its disagreement never surfaces as teaching); no
persona-differentiated pacing observable; the fallback one-liner ("Let's build an understanding of
X.") is a non-lesson presented with full confidence. Teaching quality is therefore *bimodal*:
good-or-nothing, with no signal distinguishing the two.

## 13. Narration Evaluation

The strongest experiential subsystem. Per-segment TTS with real durations, element-anchored focus,
word-level caption tracking, intent labels (introduce/build/illustrate/reinforce) that shape the
prose arc. Gaps: `pause_after` (composed silence — the teacher's pause) is dead; no guard against
one giant segment; voice persona is a single fixed voice (no persona/mode influence); silence is
never used deliberately; audio failure = permanent stall; and nothing distinguishes "the voice is
thinking" from "the voice is broken."

## 14. Visual Cognition Evaluation

Currently visuals decorate less than they should teach: formula unrendered (the single highest
leverage-per-line fix in the product); diagrams collapse all four kinds to a ring — the *data* is
pedagogically structured, the *layout* discards that structure; tables truncate silently at 6 rows;
images never generate (planner fallback), so image-as-cognition (caption + callout labels — the
best-designed piece of the visual system) has never been experienced by any learner. No progressive
reveal means visuals never *arrive* in sync with thought.

## 15. Motion & Animation Review

Motion vocabulary is small and mostly honest. Teaches: frame cross-dissolve (state continuity),
highlight marker slide (attention), word-color tracking (voice position). Honest liveness: caret,
shimmer, waveform. Decorates: `rise` on every card. Harms: seven simultaneous `breathe` instances
(presence dots, spine marks, pills, empty-pulse) — a room of blinking LEDs that dilutes the one
signal that matters; and the auto-hide of the entire HUD is motion *removing* affordance. Reduced
motion: comprehensively handled (duplicated rule, but coverage is total).

## 16. Color Language Review

The palette is intentional but spent almost entirely on chrome. A cognitive color language should
make *cognitive state* visible. Proposal (build on existing tokens; hue-shift the stage, not the
text):

| Cognitive state | Hue direction | Application |
|---|---|---|
| Learning (build) | current cyan `#5fd3e8` | narration accent, highlight marker (as today) |
| Discovery/curiosity | warm amber `#ffce6b` (exists as agent hue) | frontier breadcrumbs, "did you know" anchors |
| Practice | green `#6ee7a8` (exists) | practice frames, answer affordances |
| Assessment | violet `#b39dff` (exists) | checkpoint frames, gate results |
| Confusion/descent | desaturated slate-rose | remedial frames, "let's rebuild" moments |
| Mastery | gold-leaf on the concept's timeline node + a permanent warm tint on its anchors when revisited |
| Research | deep indigo | research-mode stage lighting |

Mechanism: a per-frame `--stage-tint` custom property set from frame intent (already carried by
narration intents and frame provenance), mixed at 4-8% into surface backgrounds and the highlight
marker — "narration subtly influences lighting" with zero new canonical state (a pure projection,
consistent with ADR-0007). Fix the stranded tokens first; nothing else lands until then.

## 17. Accessibility Review

Present and real: `aria-live` narration and stage, `aria-pressed/expanded`, labeled regions,
`:focus-visible`, Escape-to-close, total reduced-motion coverage. Gaps ranked: (a) overlay dialogs
have no focus trap or restore; (b) SVG path/timeline nodes lack keyboard activation
(role=button without onKeyDown); (c) the HUD auto-hides to `display:none` — keyboard users must
guess; (d) contrast: `--ink-ghost` ≈ 2.2:1 used for readable text; 10.5px uppercase at 4.4:1;
(e) 14×4px scrub ticks far below touch minima; (f) no text alternative when audio stalls.

## 18. Information Architecture Review

Three-plane IA (stage / overlays / HUD) is right and spec-aligned. Breaks: the Path overlay is the
only map of the journey but its primary action (click a concept) is a no-op — the IA promises
navigation it cannot perform; the Observatory mixes learner-relevant provenance ("why this") with
operator telemetry (D2/D3, packet ids) in one pane — two audiences, one panel; `interactions`,
image prompts, and narration scripts are folded state with no home in any view; and no URL routing
exists (a surface cannot be linked, resumed, or shared — the session dies with the tab).

## 19. Learning Experience Review

The intended journey (curiosity → orientation → concept → practice → mastery → next concept →
research) currently executes as: goal → one concept auto-taught → theater practice (3.7s) →
theater checkpoint → dead end. Re-asking restarts the universe. The research frontier event
(`research.frontier.detected`) fires but surfaces nowhere. Verdict: the product currently delivers
a *demo of one teaching moment*, not a journey; the journey machinery (path, mastery, descent,
research mode) all exists server-side and is stranded one wiring layer away from the learner.

---

## 20. Implementation Priorities

**P0 — integrity (the product must stop lying):**
1. Real learner-evidence gating or explicit "simulated checkpoint" labeling; never fabricate
   evidence strings (F14 conformance).
2. Fix the practice frame to carry the Coach's generated problem + an answer input; block
   auto-advance on practice/checkpoint frames (honor `pause_after`; it's already in the contract).
3. Fallback health: count and surface fallback rate (per-unit) at the gateway and in the HUD
   ("degraded cognition" indicator); emit `image.decided` from generation outcome.
4. SystemClock at the gateway (kill the fixture ManualClock); real timings.

**P1 — the loop (the product must continue):**
5. Path-node click ⇒ ask for that concept *on the existing path* (path-scoped asks; no curriculum
   regeneration when a timeline exists). This single change also makes speculation promotable.
6. Post-checkpoint continue affordance (auto-suggest next concept; one keypress).
7. Unify model budgets: 60s timeouts, planner ≥4096 tokens, imageplanner ≥2048, handle
   `finishReason==="max_tokens"`, salvage partial composer output.
8. Client identity: store and send the bearer token; enable `COS_PERSIST_DIR` by default in dev.

**P2 — the experience:**
9. KaTeX for formulas; per-kind diagram layouts; sparse-frame composition; kill title duplication.
10. Fix HighlightLayer containing-block + scale math; audio `error` fallback to text timer.
11. Ask acknowledgment (echo + phase progress events over SSE); error states + boundary.
12. Fix stranded CSS tokens; restore Educator overlay; image label contrast.
13. Parallelize the ask pipeline (compose next frame while voicing current; move speculation after
    response; drop the redundant legacy explanation/challenger on the frame path or reuse it as the
    composer's source material).

---

## 21. Proposed UX Improvements

- A **"next step" ribbon** owned by the runtime: after any frame set completes, the surface itself
  proposes 2-3 governed continuations (next concept, practice again, go deeper, ask) — the learner
  is never left with a silent board.
- **Learner input as a first-class frame element**: an `answer` MCCR slot rendered as an input on
  practice/assessment frames; responses become `interaction` events feeding the real gate.
- **Progress narration**: during generation, the voice (or caption) says what's happening —
  the agents' presence states already exist; give them one narrated sentence each.
- **Frame-level transport**: named frame ticks (not "Segment N"), a frame back/forward, and a
  per-frame replay.
- Persistent **HUD minimal state** (never fully hidden): one slim line with play state + next-step
  affordance.
- **Echoed asks** with an inline "thinking" state anchored to the ask, not to a chat log.

## 22. Proposed Architectural Improvements

- **Path-scoped ask contract** (`ask({concept_id, path_id})`) alongside goal asks — the missing
  primitive behind dead-end navigation, curriculum destruction, and unreachable promotion.
- **Fallback observability law**: every deterministic fallback emits a typed
  `cognition.degraded` event (unit, reason, budget) folded into a health slice; gateways expose a
  health endpoint. (Extends ADR-0029; closes the "silence looks like success" hole.)
- **Move speculation off the ask critical path** (fire-and-forget after response; scheduler
  priority already exists) and gate it on path-scoped continuity.
- **Unify the two pipelines**: the legacy loop's explanation should become composer input (source
  material), not a parallel product; practice/assessment frames should be composed from unit
  *outputs*, not unit *inputs*.
- **Segment fold dedupe + SSE subscribe-before-replay** to close the redelivery/race gaps.
- **Client fold incrementalization** (fold-step per event instead of full refold) and a
  narration-progress store outside React render.

## 23. Proposed Design System Improvements

- Reconcile the token vocabulary: define or migrate the seven stranded tokens; one spacing/type
  scale for all layers; self-host fonts.
- Add the cognitive color language (§16) as tokens (`--tint-learning`, `--tint-practice`, …).
- A **state-machine for frame presence**: reserve → scaffold → reveal-on-narration → settle
  (the machinery exists in the contract; the CSS/JS never implemented staged reveal).
- Motion budget rule: at most one ambient animation visible per region; `breathe` becomes a shared,
  synchronized pulse rather than seven independent ones.
- Minimum text size 11px; contrast floor 4.5:1 for any text that conveys information.

## 24. Missing Capabilities (spec'd, absent)

- Progressive element reveal (`reveal_order`/`reveal_ids`, `frame.element.delta`) — contract
  complete, zero producers/renderers.
- Expand/7-layer deepening from the UI (`onExpand` dead).
- Research mode surfacing (`research.frontier.detected` folds nowhere visible).
- Persona-differentiated experience (composer receives no persona; one voice, one pacing).
- Cross-session return ("the path knows where you stopped" — F05 narrative) at the product surface.
- Image-as-cognition in practice (never generated live).
- Confusion-driven descent triggered by *learner* signals (only synthetic evaluation drives it).
- Surface URLs / resume / share.

## 25. Technical Debt

- Demo fixture as production engine (clock, leases, in-memory, per-ask world).
- Double cognition pipeline per ask (§7.3, N18).
- O(n²) client fold; 60 Hz re-render; no fold dedupe.
- Zero interaction tests in `apps/web` (three test files, all static/pure — every P0/P1 bug above
  lives outside the tested surface); no gateway integration test with a failing model.
- Stranded CSS tokens; two styling dialects; hardcoded Tailwind palette in SceneCanvas.
- No abort wiring: unit timeout doesn't cancel the HTTP call; interrupt doesn't reach the
  frame loop or the client audio.
- `E_MODEL` retry treats quota as transient ⇒ multi-minute degraded asks under exhaustion.

## 26. Suggested Refactors

1. Extract a **`ConductorService`** in `packages/surface` owning "what happens next" (continuation,
   waiting-for-answer, next-concept proposal) — the missing counterpart to the choreographer.
2. Collapse `narrateBlock`/`narrateScript`/`recordFrameArtifacts` around one
   **narration-plan object** that carries `pause_after`, per-segment focus, and voice policy.
3. Replace per-unit inline dispatch in `session.ask()` with a small **pipeline executor**
   (declared stages, per-stage timeout/parallelism/health emission) — one place to fix budgets,
   ordering, interrupts, and progress events.
4. `useSurfaceStream`: incremental fold + event-id watermark dedupe.
5. `MccrElement`: per-kind diagram layout functions (data is already shaped for it) + KaTeX behind
   a lazy boundary with the existing `plain` fallback.
6. Token migration pass with a stylelint rule banning undefined custom properties.

## 27. Product Roadmap (prioritized)

- **R0 (days) — Stop the bleeding:** P0 items 1-4 + highlight/audio fixes + stranded tokens.
  Exit: a learner can trust what the board says; degradation is visible; timings are real.
- **R1 (1-2 weeks) — Close the loop:** path-scoped asks; continue affordance; real practice
  answer → real gate; budget unification (planner/imageplanner live for the first time); client
  identity + persistence on. Exit: a learner goes goal → concept 1 → verified practice → concept 2
  → … with one click each, and returns tomorrow to the same path.
- **R2 (2-4 weeks) — Become the medium:** staged reveal on narration; KaTeX + diagram kinds +
  first live images; ask echo + progress narration; frame-level transport + URLs; parallelized
  pipeline (halve perceived latency); cognitive color language v1. Exit: the "watch understanding
  unfold" promise is literally true.
- **R3 (1-2 months) — Compound:** cross-session return with memory-seeded openings; persona
  differentiation through the composer; confusion descent from learner signals; research-frontier
  surfacing; speculation that actually promotes (path-scoped); Observatory learner/operator split.
  Exit: the second session is measurably different because of the first — the product's founding
  claim, demonstrated.

---

*Review conducted 2026-07-02 against master @ `3ff2c18`. Live evidence: gateway :8787 (Gemini),
web :5173, surface `srf-d5cbb1672d0a`; screenshots and SSE snapshots under
`tmp-events/review-shots/` (gitignored). All findings carry file:line or event-log citations;
nothing in this document modifies code, specs, or status files.*
