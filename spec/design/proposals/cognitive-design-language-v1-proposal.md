# Cognitive Design Language (CDL) v1 — Proposal (Phase 2)

**Status:** APPROVED (2026-07-03) and formalized — the living spec is
`spec/design/cognitive-design-language-v1.md`. This document is preserved as the design rationale
record (Phase 2 of the CDL process).
**Upstream:** `spec/design/proposals/ux-audit-2026-07.md` (Phase 1 findings),
`spec/cognitive_surface/` (dossier, whiteboard system), `spec/product/features/F09`, `F16`,
`spec/vision-application/` corpus.
**Studied influences (synthesized, not copied):** Apple Liquid Glass / visionOS spatial material
doctrine, Apple HIG depth & deference, calm technology (Weiser/Case), cognitive load theory,
scientific visualization practice (Tufte data-ink), motion design physics (spring-based,
interruptible), reading ergonomics (measure/rhythm), progressive disclosure.

---

## 0. The One-Sentence Law

**Everything on screen is either cognition or light — content the learner is building
understanding from, or ambient light that tells them where they are, what state the system is in,
and where to look next. Nothing else may exist.**

If an element is neither an MCCR anchor, narration, nor a whisper of orienting light, it does not
belong on the surface.

---

## 1. Design Philosophy — Five Principles

Derived from the spec corpus's three pillars (visibility & accountability; quiet complexity &
spatial memory; pedagogical integrity):

1. **The board is sacred.** MCCR anchors are the learner's visual memory. Chrome never occludes,
   overlays, or shrinks them. Chrome yields; the board never does. (Resolves audit A1, B1.)
2. **Light carries meaning.** Color, glow, and luminance are semantic channels: cognitive state
   colors the room's ambient light; focus is brightness; the periphery recedes. Decoration-color
   is banned. (Resolves E1–E3, C2.)
3. **Depth is honest.** The z-axis encodes exactly one thing: *relevance to this moment of
   thought*. Closer = more relevant now. Ephemeral things float; persistent knowledge sits on the
   board plane; the past recedes into depth. Glass is how a plane admits the planes behind it —
   depth without opacity. (Resolves D1, D2.)
4. **Motion is cognition made visible.** Every animation depicts a cognitive event — a concept
   forming, connecting, being practiced, consolidating. Shared-element continuity explains
   causality between frames. Nothing animates for delight alone; nothing changes abruptly.
   (Resolves G1, G2.)
5. **Chrome dissolves.** Controls exist in three attentional states — *ambient* (a line of light),
   *available* (glyphs on approach), *engaged* (full instrument) — and always return to ambient.
   The steady-state screen is ~98% cognition. (Resolves A2, A3, C2, C3.)

---

## 2. Depth System — Seven Planes

A single global light source, soft and high (as if the surface sits under a skylight). Every plane
is defined by four properties: **elevation shadow** (below), **edge light** (1px top-inside
highlight), **blur admission** (backdrop-filter of what's behind), and **luminance lift**.

| Plane | Token | Content | Material |
|---|---|---|---|
| P0 Void | `--plane-void` | The dark field; grain; ambient state gradient | opaque, near-black warmed ~2% |
| P1 Field | `--plane-field` | Path constellation, past frames receding, prewarm | opaque, +2% luminance |
| P2 Board | `--plane-board` | The frame: MCCR anchors live here | opaque stage tint; NO blur (content must be perfectly crisp) |
| P3 Raised anchor | `--plane-raised` | The focused/core anchor; interactive elements | +4% luminance, soft 24px shadow, edge light |
| P4 Focus | `--plane-focus` | Narration spotlight; active practice input | full luminance, state-colored glow, slight scale (1.01) |
| P5 Instrument glass | `--plane-glass` | Voice Line expanded, panels, path overlay, observatory | true glass: `blur(24px) saturate(1.4) brightness(1.08)`, 8% white tint, edge light, 32px shadow |
| P6 Whisper | `--plane-whisper` | Ambient chrome: thread of progress, system gem, edge rails | translucent line-weight light; `blur(12px)` when it has a body |

Rules:
- **Blur encodes ephemerality**: only planes that can vanish without cognitive loss (P5, P6) get
  backdrop blur. Knowledge (P2–P4) is never behind glass.
- **Focus recession**: when P4 is active, P2 siblings drop to 78% opacity and desaturate 20% —
  depth-of-field for attention, reversible in 300ms.
- **Elevation tokens**: `--e1` … `--e5` pair shadow + edge-light + luminance so components can't
  mix-and-match planes incorrectly.
- `prefers-reduced-transparency`: P5/P6 fall back to near-opaque fills.

---

## 3. Color Language

### 3.1 Base — "deep field, slightly warm"
Keep the near-black void identity, warm it from pure blue-black toward a graphite with ~2% warmth
(`#0a0b10` family) so state colors read against neutral, not against blue. Ink scale unchanged in
role (4 steps) but re-tuned: floor contrast ≥ 4.5:1 for any text that informs.

### 3.2 Cognitive state palette (the room's light)
Each learning state owns a hue. It is applied at **three amplitudes** and never as borders-on-cards:

| State | Hue | Feel |
|---|---|---|
| Learning / explanation | `--state-learning` cyan → softened teal `#5fd3e8`→`#57c4d4` | clarity |
| Discovery / open exploration | amber `#ffc46b` | curiosity |
| Practice | green `#63dfa1` | doing |
| Assessment | violet `#a78bff` | proving |
| Research / frontier | blue `#7fa8ff` | depth |
| Reflection / consolidation | warm rose-grey `#d8b8ad` | calm |
| Mastery / milestone | gold `#ffd98e` | earned light |
| Confusion / descent | ember `#ff9d6b` | redirection, never alarm |

Amplitudes: **ambient** (state tints P0/P1 gradient at ~12%, up from today's imperceptible 8%),
**structural** (frame title underline-light, thread segment, focus glow at ~40%), **focal** (the
single active accent at 100%). **One focal accent on screen at a time** — the current state's hue
replaces cyan-everywhere; cyan becomes the *learning* state, not the brand crutch.

Agent identity hues remain (6 sigils) but gain a felt presence: when an agent contributes, its hue
briefly colors the contribution's entrance light.

System states: degraded = quiet ember tint on the system gem (never red banner); error = the only
permitted red, transient.

### 3.3 Data visualization
Sequential/divergent ramps derived from state hues for graphs, mastery heat, timelines — defined
once in tokens so Observatory/educator views stop inventing colors.

---

## 4. Typography System

Families stay (they are distinctive and correct): **Fraunces** = knowledge, **Space Grotesk** =
instrument, **Space Mono** = provenance/data. What changes is the role grammar:

| Role | Face | Size (clamp) | Use |
|---|---|---|---|
| Canon | Fraunces 560 | 2.1–3.2rem | core concept — the one thing this frame is about |
| Gloss | Fraunces 420 | 1.15–1.35rem, measure ≤ 62ch | definitions, explanations |
| Voice | Fraunces italic 400 | 1.05–1.2rem | narration line (never clamped — marquee/expand instead) |
| Working | Space Grotesk 400 | 0.95–1.05rem | examples, practice bodies, tables |
| Instrument | Space Grotesk 500 | 0.85rem | buttons, controls |
| Data | Space Mono | 0.8rem | formulas kept mono-adjacent, provenance, traces |
| Whisper | Space Grotesk 500, +0.08em tracking | 0.75rem floor (12px), sparse | the ONLY micro-label style; ≤ 2 per region |

Scale is a true modular ratio (1.22) so adjacent roles are perceptibly distinct. Reading measure is
enforced (`max-width: 62ch` on prose roles), line-height 1.6 for prose, 1.1 for Canon.

---

## 5. Spacing & Layout

- 4px base unit; semantic tokens: `--breath-inner` (within an anchor), `--breath-between`
  (between anchors), `--breath-margin` (board margins ≥ 6% viewport), `--breath-hero` (around the
  Canon element — the core concept always owns disproportionate whitespace).
- **Anchor hierarchy in the grid**: core concept spans and leads at P3; supporting anchors sit
  smaller at P2; the frame archetype (from FramePlanner density metadata) maps to named
  compositions (`hero`, `dialogue`, `constellation`, `worksheet`) instead of a uniform 2-col grid.
- **Density recomposition doctrine (replaces scale-to-fit):** if a frame cannot fit at 100% type
  size, the layout *recomposes* — supporting anchors collapse to disclosure chips (title + tap to
  expand on the focus plane) in priority order (memory_cue → table → example → …). Text never
  renders below its role size; content is never clipped. `useFitToViewport` is retired.
- **Stage-owned chrome slots:** the frame layout reserves explicit slots — `voice` (bottom),
  `response` (practice/answer, inside the board), `forward` (continue affordance). Fixed-position
  overlap becomes structurally impossible.

---

## 6. Motion Language — "cognitive physics"

- **Vocabulary** (every animation is one of these, tokenized):
  `materialize` (form from depth: blur 8px→0, rise 12px, 480ms) · `connect` (luminous stroke draws
  a relation, 600ms) · `focus` (spotlight travels; siblings recede, 300ms) · `consolidate` (element
  shrinks + drifts toward the thread/path node — knowledge becoming memory, 700ms) · `descend`
  (prerequisite zoom-in; breadcrumb light trail) · `yield` (chrome retreating, 240ms).
- **Shared-element continuity:** frame transitions morph persistent elements (the core concept
  travels from explanation frame into its practice frame; a mastered anchor consolidates into its
  path node) via FLIP. Full-stage cross-dissolve only when nothing persists.
- **Timing tokens:** `--t-instant 120ms · --t-quick 240ms · --t-move 400ms · --t-form 600ms ·
  --t-scene 800ms`; springs (CSS `linear()` approximations) for anything the user "touches",
  expo-out for system-initiated motion. One primary motion at a time; ambient motion (breathing
  gem, thread shimmer) ≤ 2% screen area.
- Reduced-motion: current collapse discipline retained; `consolidate`/`descend` degrade to fades.

---

## 7. Navigation & Chrome — the four signature redesigns

1. **The Voice Line** (replaces TransportHud). Ambient: a single full-width hairline of light at
   the bottom edge (P6) — the current narration sentence in Voice type, one subtle play/pause
   glyph, word-highlight preserved. Available (pointer approach / tap): rises into a slim glass
   bar with prev/next, speed, and the steering verbs (Simpler · Deeper · Example · Challenge) as
   quiet text buttons. Engaged (ask/steer): expands into the full instrument with input field.
   Idle steady-state height: ≤ 28px (vs today's 74px+).
2. **The Thread of Understanding** (replaces frame ticks + hidden path). The bottom hairline *is*
   the progress thread: segments = frames, filled with the state color as narration completes;
   nodes = concepts. Hovering lifts a glass mini-map; clicking a node opens the full Constellation
   view (rebuilt path graph with proper force layout + label collision, replacing the broken
   overlay). Ambient answer to "where am I, what remains" at all times.
3. **The System Gem** (replaces top-bar status cluster + red DEGRADED banner). One small living
   point of light, top-right: breathing = thinking; steady = live; ember = degraded; its hue =
   active agents' blend. Click → glass panel (P5) with agent presence, degradation detail,
   connection state. The top bar reduces to: wordmark whisper · goal (Gloss) · gem.
4. **Practice as part of the board** (replaces floating answer panel). Practice/assessment frames
   render the response field *inside* the frame's `response` slot on the focus plane — the workbook
   is on the desk, not hovering over it. Frontier/continue affordances live in the `forward` slot,
   appearing via `materialize` when a stopping point is reached.

---

## 8. Component & Token Architecture

- `apps/web/src/cdl/tokens.css` — the single token source (planes, elevations, state palette,
  type roles, breath units, motion). Old `tokens.css` values become aliases during migration, then
  removed.
- Primitives (CSS-first, thin React wrappers): `Plane`, `Glass`, `Anchor` (MCCR card with
  hierarchy variants), `VoiceLine`, `Thread`, `Gem`, `StateLight` (ambient gradient controller),
  `Disclosure` (density recomposition chip).
- Every component states its plane; no component sets raw z-index, shadow, or blur.
- Accessibility floor: 12px minimum text, 44px touch targets, 4.5:1 informative-text contrast,
  reduced-motion + reduced-transparency fallbacks, focus-visible rings in state hue.

---

## 9. Migration Plan (Phase 4, on approval)

1. **Foundation:** CDL tokens + planes + state-light ambient system; re-point existing components
   (no behavior change, immediate depth/color improvement).
2. **Chrome:** Voice Line + Thread + Gem; delete fixed-position collisions (audit A1/A2/C2).
3. **Board:** Anchor hierarchy, frame archetypes, density recomposition (retire scale-to-fit),
   practice-in-board (A1/B1/C1).
4. **Motion:** shared-element continuity, vocabulary rollout (G1/G2).
5. **Views:** Constellation path rebuild, Observatory/educator restyle on primitives (B2/B3).
6. **Verify:** `pnpm verify` green + visual pass at 4 viewports + a11y audit; then Phase 5
   (formalize as `spec/design/cognitive-design-language-v1.md`).

Open questions for review are tracked in the Phase 3 feedback request.
