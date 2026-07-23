# Cognitive Surface — Complete UX/UI Audit (Phase 1)

**Status:** Audit — input to the Cognitive Design Language (CDL) proposal
**Date:** 2026-07-03
**Method:** Static analysis of `apps/web` (all components, `tokens.css`, `styles.css`), plus live capture
of a real session ("Teach me Neural Networks") at 1440×900, 1280×650, 834×1112, and 390×844.
**Evidence:** `outputs/ui-audit/01…10.png` (referenced below as [01]–[10]).

Severity: **P0** actively blocks or damages the learning act · **P1** materially raises cognitive
friction · **P2** erodes quality/coherence · **P3** polish.

---

## A. Floating chrome vs. the learning content

### A1 — P0 · Four independent fixed-bottom elements collide with content and each other
`TransportHud` (`.track`, fixed, z-30, `styles.css:688-706`), `.answer-panel` (fixed, z-24,
`styles.css:2368`), `.frontier-chip` and `.next-step` (fixed, z-24, `styles.css:2430-2510`) are all
bottom-anchored with **independent hardcoded offsets** (`calc(var(--s-8) + 3.5rem)`,
`calc(var(--s-8) + 7rem)`). Nothing reserves space in the frame layout for them.

Evidence: [04] the active HUD covers the frame's data table; [05] the practice frame is an illegible
pile — answer panel + expanded transport interactions + practice card all overlap; [08] at 650px
viewport height the continue ribbon sits directly on the content; measured live: HUD idle height =
74px = **11% of viewport height while doing nothing**, continue ribbon top edge 24px below content.

**Why it harms cognition:** the board is supposed to be the learner's visual memory (MCCR). Chrome
that occludes anchors literally erases the memory the system just built. Split attention between
overlapping layers is pure extraneous load.

### A2 — P0 · The transport HUD is a media player, not a cognitive instrument
Active state = 3 stacked rows: narration line + waveform + play/pause/prev/next/speed + frame ticks +
segment scrubber + 5 interaction buttons + "Ask the surface" field (`TransportHud.tsx:98-162`, [04],
snapshot uid=2_43…2_106). ~15 interactive targets in one floating slab. It communicates "you are
watching a video," which contradicts the product's core claim (learning ≠ consuming).

**Why it harms cognition:** every visible control is an invitation to leave the current thought.
The learner needs at most: what is being said, where am I, and a way to pause/steer. Everything
else is progressive-disclosure material.

### A3 — P1 · Auto-hide is binary and geometric, not attentional
`useAutoHide` collapses the HUD after 3.2s by shrinking width and hiding rows — the element visibly
"jumps" between two sizes ([03] vs [04]). There is no intermediate ambient state, and the hide is
time-based, not narration/attention-aware (e.g., it stays big while narration is actively pointing
at a board anchor behind it).

---

## B. Viewport integrity (clipping, scaling, reflow)

### B1 — P0 · Frames clip or shrink instead of recomposing
`.frame-stage { overflow: hidden }` (`styles.css:2110-2130`) plus `useFitToViewport` uniform
`transform: scale()` means overflow is handled by **shrinking the entire board text** below its
designed reading size, and anything past `max-height: 100%` is silently cut. Evidence: [05] practice
prompt truncated mid-sentence ("Identify inputs, outputs, and … input-outp…").

**Why it harms cognition:** a frame is defined by the spec as a *viewport-complete cognitive state*
(F09 §4.1). Clipped anchors break the MCCR contract; scaled-down text breaks reading ergonomics. The
correct degree of freedom is **density recomposition** (fewer anchors, progressive disclosure), never
optical shrinking.

### B2 — P1 · The concept map and path graph render overlapping labels
Initial concept view [02] and the PATH overlay [07]: node titles overlap each other and edges are
drawn straight through label text ("Functions: Input to Outp̶Linear Algebra Basi…"). No collision
detection, no label placement strategy (`TimelineGraph`/`SceneCanvas`).

**Why it harms cognition:** the path is the learner's map of their own mind. An illegible map
destroys the orientation function it exists for, and signals system unreliability.

### B3 — P1 · Fixed-width side panels ignore small viewports
Educator overlay is a fixed 320px right sidebar (`styles.css:1358-1376`); Observatory min-width
narrows only at 1080px. No safe-area insets anywhere. On tablet [09] chrome fragments crowd the top
bar into three wrapped lines.

---

## C. Visual hierarchy

### C1 — P0 · Every card has the same visual weight
All MCCR elements share `border: 1px solid var(--hairline)` + ~2% white fill + same radius/padding
(`styles.css:2250-2296`, [03]). Core concept vs supporting example differ only by a tiny uppercase
mono tag. The eye has no entry point, no reading order, no primary/supporting distinction.

**Why it harms cognition:** hierarchy *is* the pedagogy made visible. If the core concept doesn't
visually dominate, the learner spends working memory deciding where to look — load the system was
supposed to remove.

### C2 — P1 · Chrome competes with content for attention
Top bar simultaneously shows: brand, goal, agents pill, "another view" chip, **permanent red
DEGRADED banner**, LIVE dot ([03], `SurfaceView.tsx:182-219`). The degraded status is developer
telemetry rendered as a constant alarm in the learner's periphery for the entire session.

**Why it harms cognition:** red is an interrupt color; a permanent interrupt trains the learner to
either panic or ignore alarms. System state belongs in a calm, glanceable, expandable indicator.

### C3 — P2 · Micro-labels are everywhere and identically styled
Uppercase Space Mono 0.7rem labels (~11px) in `--ink-faint` (#6d7789) appear on every card, panel,
section ([03], [06]). At this size/contrast they are decoration-noise: not readable enough to inform,
not quiet enough to disappear.

---

## D. Glass, depth, and light

### D1 — P1 · "Glass" is currently flat transparency
Only four `backdrop-filter` uses in the whole app (`styles.css:705, 1678, 1855, 2691`), no elevation
scale, no blur hierarchy, no lighting model, near-zero shadows. Surfaces are dark rectangles with 1px
hairlines — the app has exactly two perceptual planes (background, everything else).

**Why it harms cognition:** depth is the cheapest non-verbal channel for priority ("closer = more
relevant now"). Without a depth system, focus/priority/ephemerality must all be communicated with
color and borders, which is why the UI feels simultaneously flat and busy.

### D2 — P2 · No focus plane
When narration spotlights an element, the highlight is a border glow (`HighlightLayer`). The rest of
the board stays at full intensity — there is no recession of non-focused content, no depth-of-field.

---

## E. Color

### E1 — P1 · One accent carries every meaning
`--accent: #5fd3e8` cyan marks: interactivity, focus, liveness, brand, progress, availability
([01]–[04]). The cognitive state tints exist in tokens (`tokens.css:103-112` — learning/discovery/
practice/assessment/research) but are applied as an 8–10% radial wash that is barely perceptible
([05] practice-green vs [06] assessment-violet are nearly indistinguishable).

**Why it harms cognition:** color is the intended channel for *mental mode*. If practice doesn't
feel different from explanation, the learner's posture (receptive vs active recall) doesn't shift —
a real pedagogical loss, not just an aesthetic one.

### E2 — P2 · Agent identity colors are invisible in practice
Six agent hues exist (`tokens.css:36-41`) but appear only as ~6px dots. Multi-agent cognition — a
core differentiator — has no felt visual presence.

### E3 — P2 · The palette is cold everywhere
Void/base/stage are all blue-black. There is no warmth anywhere in the system, at odds with the
vision's "emotional warmth" and with reflection/consolidation states (dossier Part 7 mechanism #10:
calm state after intensity).

---

## F. Typography

### F1 — P2 · Good families, underdeveloped system
Fraunces (content serif) + Space Grotesk (UI) + Space Mono (data) is a strong trio. But: the scale
is compressed (`--t-base` 0.95rem → `--t-md` 1.08rem is not a perceptible step), definitions/
examples/mental-models share identical treatment (C1), line lengths are unmanaged (cards stretch to
grid width regardless of measure), and the 0.7rem floor is below comfortable legibility.

### F2 — P2 · Narration text is clamped to 2 lines
`-webkit-line-clamp: 2` (`styles.css:722`) silently truncates longer spoken segments — the one piece
of text that must never be cut.

---

## G. Motion

### G1 — P1 · One entrance animation for everything; no continuity between frames
`rise` (opacity+translateY+blur) is the sole entrance for entry card, stage, frame title, cards,
media, buttons (`styles.css:936-947`). Frame transitions are a plain cross-dissolve of the entire
stage (`FrameDeck.tsx:47-56`); no element persists across frames even when the same core concept
carries over (e.g., concept → its practice frame). Nothing communicates *why* the change happened.

**Why it harms cognition:** the spec demands "animated and the reasoning visible" for restructuring
(dossier Part 7 #7). Shared-element continuity is how motion explains causality ("this concept is
now being practiced"); a dissolve says only "everything changed."

### G2 — P2 · State changes without transitions
Connection status, degraded badge, HUD row show/hide, answer panel mount — all appear abruptly.
Caret blink uses 2-step keyframes (instant jumps). Positive: full `prefers-reduced-motion` collapse
exists (`styles.css:2093-2103`).

---

## H. Navigation & orientation

### H1 — P1 · The learner never knows where they are or how much remains
Position is expressed only as tiny frame-tick chips inside the HUD ([04]) and the PATH overlay is
hidden behind a bottom-left button and broken when opened (B2). There is no persistent, ambient
sense of place, progress, or remaining journey.

### H2 — P2 · Interaction affordances are hover-only
Per-element actions (simplify/deeper/challenge) reveal on hover/focus (`MccrElement.tsx:57-72`) —
no touch path at all, and no hint they exist. Screen-reader users get 3 buttons repeated per card
(snapshot: 5× identical button triplets — also an a11y noise problem).

---

## I. What is genuinely good (keep and amplify)

1. **MCCR/narration split** — prose in the voice, anchors on the board. Architecturally correct
   and rare. The redesign must protect it.
2. **Serif content voice** (Fraunces) — distinctive, humane, anti-generic-AI.
3. **Cognitive state tints exist in the token layer** — right idea, wrong amplitude.
4. **Word-level narration highlight** with aria-live, audio-clock ground truth.
5. **Staged reveal** of anchors synced to narration (`data-revealed`).
6. **Honest degradation** — visible fallback state is philosophically right (visibility invariant);
   only its *expression* (permanent red alarm) is wrong.
7. **Reduced-motion discipline** and event-sourced read-only projection architecture — the UI is
   a pure function of state, which makes a full visual migration low-risk.

---

## J. Priority map

| # | Finding | Severity | CDL layer that resolves it |
|---|---|---|---|
| A1 | Fixed-bottom collisions | P0 | Layout: stage-owned chrome slots |
| A2 | Media-player HUD | P0 | Voice Line concept |
| B1 | Clip/scale instead of recompose | P0 | Density recomposition doctrine |
| C1 | Uniform card weight | P0 | Anchor hierarchy + depth planes |
| B2 | Broken graph labels | P1 | Constellation path redesign |
| D1 | Flat glass | P1 | Elevation & light system |
| E1 | Cyan monoculture | P1 | Cognitive color language |
| G1 | No motion continuity | P1 | Motion language |
| H1 | No sense of place | P1 | Thread of understanding |
| C2 | Alarm chrome | P1 | System gem |
| B3/H2/F1/F2/E2/E3/G2/C3/D2 | — | P2 | respective layers |
