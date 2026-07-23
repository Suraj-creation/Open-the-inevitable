# Cognitive Design Language (CDL) v1

**Status:** ACTIVE — the permanent design foundation of the Universal Cognitive Infrastructure.
**Owns:** all visual/interaction design across every manifestation (Cognitive Surface, Observatory,
educator views, public web, future projections).
**Upstream:** `spec/product/features/F09` (experience), `F16` (surface substrate),
`spec/cognitive_surface/` (dossier, whiteboard system), `spec/vision-application/` (feel & mission).
**Downstream:** `apps/web/src/tokens.css` (the token layer — CDL's executable form),
`apps/web/src/styles.css`, all surface components.
**History:** proposal + full UX audit in `spec/design/proposals/` (2026-07). Approved 2026-07-03.
**Non-goals:** brand/marketing identity guidelines; print; native-platform HIG compliance details.

---

## 1. The One-Sentence Law

**Everything on screen is either cognition or light** — content the learner is building
understanding from, or ambient light that tells them where they are, what state the system is in,
and where to look next. If an element is neither an MCCR anchor, narration, nor a whisper of
orienting light, it does not belong on the surface.

## 2. The Five Principles

1. **The board is sacred.** MCCR anchors are the learner's visual memory. Chrome never occludes,
   overlays, or shrinks them; chrome yields, the board never does. Structural consequence: the
   stage *owns* its chrome — practice inputs, forward affordances, and voice controls live in
   layout-reserved slots (`.board-slots`, the Voice Line edge), never in free-floating fixed
   elements that can collide with content.
2. **Light carries meaning.** Color is a semantic channel, never decoration. The cognitive state
   colors the room; focus is brightness; the periphery recedes. One focal accent on screen at a
   time — the current state's hue.
3. **Depth is honest.** The z-axis encodes exactly one thing: relevance to this moment of thought.
   Knowledge sits on the board plane, crisp and never behind glass; ephemeral instruments float on
   glass; the past recedes. Blur admission *is* the ephemerality marker.
4. **Motion is cognition made visible.** Every animation depicts a cognitive event — forming,
   continuing, connecting, consolidating, receding. Motion explains causality (a practice frame
   *continues* laterally from its concept; a new concept *forms* from depth). Nothing animates for
   delight alone; nothing changes abruptly.
5. **Chrome dissolves.** Controls exist in three attentional states — ambient (a line of light),
   available (instruments on approach/pause/focus), engaged (full instrument) — and always return
   to ambient. Steady state is ~98% cognition.

## 3. Depth System — Seven Planes

One soft, high light source. A plane is defined by elevation shadow + 1px top edge-light +
luminance lift + blur admission. Components state their plane; they never set raw z-index, shadow,
or blur.

| Plane | Holds | Material | Tokens |
|---|---|---|---|
| P0 Void | the dark field, grain, ambient light | opaque `--void` | `--plane-void` |
| P1 Field | path constellation, receding past | opaque, +2% | `--plane-field` |
| P2 Board | the frame's MCCR anchors | opaque `--stage` tint, **no blur ever** | `--plane-board` |
| P3 Raised | interactive/raised anchors, slot panels | +luminance, `--shadow-e2/e3` | `--plane-raised` |
| P4 Focus | the narration-spotlit anchor, practice input, reopened folds | state glow, full luminance | highlight + `--shadow-e3` |
| P5 Instrument glass | Voice Line instruments, Observatory, Path overlay, educator panel | `--glass-tint(-heavy)` + `--glass-blur` + `--glass-edge` + `--shadow-e4/e5` | |
| P6 Whisper | Thread, System Gem, edge chrome | line-weight light, `--glass-blur-whisper` when bodied | |

Rules: focus recession (P4 active ⇒ P2 siblings drop to ~68% opacity, desaturate ~15%, reversible
in `--t-move`); `prefers-reduced-transparency` collapses P5/P6 to near-opaque fills;
elevation tokens `--shadow-e1…e5` are the only shadows in the system.

## 4. Color Language

**Base:** a deep field warmed off blue-black (`--void #09080b`, `--base #0d0c10`,
`--stage #121118`) so state hues read as *light*, not "more blue". Ink hierarchy: `--ink`,
`--ink-soft`, `--ink-faint`, `--ink-ghost`; informative text ≥ 4.5:1 on the void.

**Cognitive state palette** (`--state-*`) — each learning state owns a hue, applied at three
amplitudes and never as borders-on-every-card:

| State | Token | Hue | Feel |
|---|---|---|---|
| Learning / explanation | `--state-learning` | `#57c9de` teal-cyan | clarity |
| Discovery / exploration | `--state-discovery` | `#ffc46b` amber | curiosity |
| Practice | `--state-practice` | `#63dfa1` green | doing |
| Assessment / checkpoint | `--state-assessment` | `#a78bff` violet | proving |
| Research / frontier | `--state-research` | `#7fa8ff` blue | depth |
| Reflection / consolidation | `--state-reflection` | `#d8b8ad` rose-grey | calm |
| Mastery / milestone | `--state-mastery` | `#ffd98e` gold | earned light |
| Confusion / degradation | `--state-confusion` | `#ff9d6b` ember | redirection, never alarm |

Amplitudes: **ambient** — the frame stage's radial wash at ~14%/8% (`--stage-tint` set per frame
by `FrameStage.frameTint()`); **structural** — thread fills, definition edge-light, focus glow at
~40–55% mixes; **focal** — the single active accent (focus ring, play glow, current thread node)
at 100%. `--stage-tint` *is* the current focal accent; legacy `--accent` = the learning hue.

System states: degraded = ember ring on the System Gem + visually-hidden `role="status"` text —
never a red banner; red is reserved for transient hard errors. Agent identity hues (`--agent-*`)
mark contribution light and sigils only.

## 5. Typography

Three families, three meanings: **Fraunces** (serif) = knowledge; **Space Grotesk** = instrument;
**Space Mono** = provenance/data. Loaded non-blocking (see `apps/web/index.html`).

| Role | Face | Size | Use |
|---|---|---|---|
| Canon | Fraunces 480 | clamp(1.7–2.5rem), lh 1.08, ≤28ch | the core concept — no card chrome, the concept IS the board |
| Gloss | Fraunces | clamp(1.05–1.3rem), lh 1.5, ≤62ch | definitions — prose under a 2px state edge-light |
| Voice | Fraunces | `--t-md`, lh 1.45 | the narration line — never clamped/truncated; ambient fades at the edge, approach reveals all |
| Working | Space Grotesk | `--t-base` | examples, practice bodies, tables |
| Instrument | Space Grotesk 500 | `--t-sm` | buttons, controls |
| Data | Space Mono | `--t-xs` | provenance, traces, formula-adjacent |
| Whisper | Space Grotesk +tracking | `--t-2xs` = **12px floor** | the ONLY micro-label style; ≤2 per region |

Scale: `--t-2xs 0.75 · xs 0.8 · sm 0.88 · base 0.98 · md 1.18 · lg 1.45 · xl 2.0 · 2xl 2.8rem`.
Prose measure: `--measure-prose: 62ch`, enforced on all prose roles.

## 6. Space & Layout

4px base grid (`--s-1…8`); semantic breath: `--breath-inner` (within an anchor),
`--breath-between` (between anchors), `--breath-margin` (board margins). The Canon element always
owns disproportionate whitespace.

**Stage-owned chrome:** `.stage-wrap` is a column — board plane (flex 1) above an in-flow
`.board-slots` column (practice answer, frontier nudge, continue). Bottom padding reserves the
Voice Line's ambient height. Fixed-position collisions are structurally impossible.

**Anchor hierarchy in the grid:** `core_concept` and `definition` span full width with their role
treatments; supporting anchors sit as quiet P2/P3 cards; `memory_cue` takes the reflection tint.
Sparse frames (≤3 anchors) center in a single column.

**Density recomposition (the no-scroll, no-shrink, no-clip law).** A frame is one
viewport-complete thought. If anchors overflow the viewport at full type size, the board
recomposes: lowest-priority anchors fold into disclosure chips, in order `memory_cue → table →
key_example → relationship → diagram → mental_model → key_formula`; `core_concept`, `definition`,
`image`, and the narration-spotlit anchor never fold. Chips reopen the anchor on the focus plane
(P5 glass card). Folding is bidirectional (anchors return when room appears) with an
anti-oscillation ledger (an anchor that bounces twice stays folded until the frame changes).
A uniform downscale (floor 0.85) survives only as the last resort when nothing remains to fold.
Implementation: `apps/web/src/useDensityRecomposition.ts`. Text never renders below its role size;
anchors are never clipped.

## 7. Motion Language — Cognitive Physics

Timing tokens: `--t-instant 120 · --t-quick 240 · --t-move 400 · --t-form 600 · --t-scene 800ms`.
Easings: `--ease-expo` (system-initiated), `--ease-spring` (learner-touched), `--ease-soft`
(fades). One primary motion at a time; ambient motion (gem breathing, thread glow) ≤2% of screen.

Vocabulary — every animation is one of these:

- `form` — a new concept materializes from depth (blur 6px→0, rise, `--t-form`). Frame-enter
  default.
- `continue` — the same concept moves laterally forward (explanation → its practice): exit slides
  left, enter from right. Chosen by `FrameDeck` when `concept_id` persists across frames.
- `focus` — the highlight marker travels (`--t-form` expo); siblings recede (`--t-move`).
- `reveal` — staged anchor entrance synced to narration (opacity + rise, space pre-reserved).
- `yield` — chrome retreating to ambient (`--t-move` collapse of the Voice Line instruments).
- `breathe` — liveness only (gem, thinking pulse), 2.4s soft infinite.

`prefers-reduced-motion` collapses everything to instant swaps via the global rule — the surface
stays calm, never inert.

## 8. Navigation & Chrome Patterns

- **Voice Line** (`components/VoiceLine.tsx`): the bottom edge is the voice. Ambient = one
  narration line (word-synced highlight in the state hue) + play glyph + Thread; ≤2.5rem.
  Available (pointer approach, keyboard focus-within, or paused mid-journey) = instruments rise on
  P5 glass: prev/next/speed, steering verbs (Interrupt · Go deeper · Simpler · Example ·
  Challenge), ask field. Off-approach it yields back to ambient. Narration text is never clamped.
- **Thread of Understanding**: the bottom hairline is the journey — one filament per narration
  segment, grouped by frame with concept nodes; filled with the state hue as understanding
  completes; filaments scrub, nodes jump by concept. The learner always knows where they are and
  what remains, at zero attention cost.
- **System Gem** (`components/SystemGem.tsx`): one living point of light, top-right. Breathing =
  thinking/generating; hue = the contributing agent's; ember ring = degraded (honest, calm);
  click opens the Agent Observatory. The top bar is whisper-thin: wordmark · goal (one line,
  ellipsized) · disagreement chip when live · gem.
- **Graph views**: SVG labels never collide — deterministic truncation to node width with full
  titles in `<title>`/aria; node width ≥ label budget (TimelineGraph, ConceptMap).
- **Overlays** (Observatory, Path, educator): P5 glass, right-dock or center; scrim blurs the
  field; `data-open` toggles (SSR-stable).

## 9. States

- **Empty/entry**: a poised invitation ("Watch understanding unfold."), never a dashboard.
- **Thinking/composing**: breathing pulse + "Composing…"; streaming text carries a soft caret.
- **Loading media**: reserved space + shimmer — layout never jumps.
- **Degraded**: gem ember ring + tooltip + Observatory detail + `role="status"` text. Never a
  banner, never red.
- **Error**: the only red-adjacent chrome, transient, top-center, dismissible.
- **Practice/assessment**: the frame's state light shifts (green/violet); the answer field is on
  the board plane in the response slot.
- **Stopping point**: the forward slot materializes the continue affordance in the state hue.

## 10. Accessibility Floor

12px minimum informative text · 4.5:1 contrast for informative text · 24×24px minimum hit areas
(padding-expanded, e.g. thread filaments) · visible `:focus-visible` ring in the state hue ·
keyboard summons the Voice Line instruments (focus-within) · touch devices see anchor actions
persistently (`@media (hover: none)`) · `aria-live` narration · `prefers-reduced-motion` and
`prefers-reduced-transparency` honored globally · safe-area insets on the Voice Line.

## 11. Component Library (executable form)

The token layer `apps/web/src/tokens.css` is CDL's single executable source; legacy token names
alias into it. Primitives in `apps/web/src`: `VoiceLine`, `SystemGem`, `FrameStage` (board +
hierarchy + recomposition + focus plane), `FrameDeck` (form/continue transitions), `MccrElementView`
(anchor roles), `HighlightLayer` (focus travel), `useDensityRecomposition`, overlay shells
(`Observatory`, `PathLauncher`), `.board-slots` (stage-owned chrome). New components MUST: state
their plane, use state tokens (never raw hues), use motion vocabulary tokens, respect the
accessibility floor, and add no new fixed-position bottom chrome.

## 12. Extensibility

New cognitive states get a `--state-*` hue + a `frameTint()` mapping — nothing else changes. New
manifestations (landing page, educator console, mobile) inherit tokens + planes + motion verbatim;
the landing page is the same universe (P0 field, glass, state light, Fraunces knowledge voice).
New anchor kinds declare: role typography, fold priority (or protected), and plane. When research
reveals a stronger primitive, follow §4 of the constitution: update this spec first, then implement.

## 13. Frontier

**Resolved in v1.1 (2026-07-04):**

- **Shared-element continuity** — a concept continuing into its own next frame now morphs its
  core-concept anchor from old position to new (manual FLIP via the Web Animations API, since both
  frames are briefly co-mounted; `FrameDeck`), while the rest of the stage crossfades. The idea
  travels; the board doesn't slide.
- **Force-directed constellation path** — the Path graph is a deterministic, replay-safe
  force-directed star map (seeded phyllotaxis init, fixed iteration budget, hard overlap
  resolution so node boxes and labels can never collide; `TimelineGraph`).
- **`consolidate` motion** — a newly-mastered concept crystallizes into a gold mote that drifts and
  shrinks into the Path (knowledge → memory); `ConsolidationLayer`, driven by timeline mastery
  transitions.
- **Self-hosted fonts** — Fraunces / Space Grotesk / Space Mono are served locally (woff2, latin
  subset, `apps/web/public/fonts/`, preloaded); no third-party CDN, no privacy leak.
- **Spatial `descend`/`ascend`** — diving into a prerequisite now zooms in (incoming from deep,
  outgoing flying up through the frame) with a breadcrumb light trail ("↓ Prerequisite of X");
  returning ascends. Keyed on `state.prerequisite_descents` in `FrameDeck`.
- **Responsive unfold** — density recomposition invites folded anchors back with viewport-relative
  headroom, so a growing viewport recovers content proportionally.

**Remaining:**

- Live image generation quality/latency is a runtime concern tracked outside the CDL.
- CDL Phase 6 (public landing experience) — storyboard approved in
  `spec/design/proposals/landing-experience-storyboard.md`; build pending.
