# Cognitive Design Language (CDL) v2 — The Cinematic Cognitive World

**Status:** ACTIVE (approved 2026-07-04) — the definitive design system for every interface across
the Universal Cognitive Infrastructure ecosystem. v1 remains the shipped baseline of the Cognitive
Surface; §19 is the migration path. **v2 debuted on the public landing** (2026-07-04): the World
(one persistent WebGL canvas, `apps/web/src/landing/`), the living-cognition substrate morphing
through all eight movement forms, anchor-based continuous choreography (`apps/web/src/cdl/world.ts`),
lens glass, legibility scrims, the static reduced-motion narrative, and the real-surface capture in
lens glass. Higgsfield cinematic loops pend a workspace plan upgrade (storyboard §8).
**Supersedes / builds on:** `cognitive-design-language-v1.md` (all v1 laws hold; v2 adds the
cinematic, spatial, and living-cognition dimensions).
**Motivating brief:** elevate the product from "a beautiful interface" to *the first public
experience of a new computing paradigm* — a continuous, living cognitive world the visitor travels
through and feels before they understand it intellectually.
**Downstream:** `apps/web` (surface + landing), the CDL token layers, all future manifestations.

---

## 0. The v1 → v2 turn (what changes, what holds)

v1 made the surface **calm, legible, governed, and honest** — cognition as *quiet light on a dark
board*. Those ten-plus laws are permanent and unchanged: the board is sacred, light carries
meaning, depth is honest, motion is cognition, chrome dissolves, 12px/4.5:1 accessibility floor,
reduced-motion/transparency fallbacks, replay-safe determinism.

v2 adds one thing: **the interface is not a set of screens — it is one continuous, living cognitive
world.** Everything that was *static depth* becomes *cinematic space*; everything that was *a
transition between states* becomes *a continuous transformation*; and cognition is no longer
revealed on demand — it is **always alive, everywhere, from the first frame**. Glass stops being
translucency and becomes a true optical material. Motion stops being per-element and becomes
*camera and choreography*. The page itself behaves like a cognitive system: it breathes, it forms
connections, it remembers where you are, it compounds.

> **The v2 law (added to v1's):** *The interface is a place, not a page. The visitor travels
> through cognition; they never scroll between sections. Nothing hard-cuts; everything transforms.
> Cognition is visible in every frame.*

---

## 1. Philosophy — the living cognitive world

Five v2 principles, layered on v1's five:

1. **One continuous world.** There are no sections, pages, or scenes with edges — one uninterrupted
   spatial continuum the visitor moves through. "Navigation" is *traversal*; "a new section" is
   *arriving somewhere new in the same world*. Structure is felt as depth and distance, not as
   stacked blocks.
2. **Cognition is always alive.** A living substrate of motes, filaments, and forming structures is
   present in every frame at ambient intensity — the visitor subconsciously feels thinking
   happening everywhere, before any explicit "feature" is shown. The world is never inert.
3. **Everything transforms, nothing cuts.** State changes are morphs: particles *become* neurons
   *become* a knowledge graph *becomes* a classroom. Continuity of matter across change is the
   core motion law — the same light that was a question becomes the concept that answers it.
4. **The world breathes.** Ambient life (drift, glass reflection, depth parallax, slow camera,
   luminance tides) is continuous but sub-perceptual — alive without demanding attention. Calm
   technology at cinematic fidelity: peaks are rare and earned; the resting state is serene.
5. **Glass is an optical instrument.** Liquid Glass is a real material with refraction, depth,
   specular highlights, caustic light, and adaptive tint — the surface through which the cognitive
   world is seen and touched. The visitor should not be able to tell where cinema ends and
   interface begins.

Everything below serves these. Where v2 and v1 ever appear to conflict, v1's **accessibility,
determinism, and pedagogical-integrity** laws win — cinema never costs legibility, replay-safety,
or honesty.

---

## 2. The Cognitive World model (spatial composition)

The world is a single deep **z-space** the visitor travels along a **spine** (the scroll/traversal
axis). Composition is spatial, not stacked:

- **The spine** — one continuous path through the world; scroll is *motion along it*, not page
  advance. Progress is a position in space (mirrors the surface's Thread of Understanding).
- **Depth strata** — content lives at different z-depths; parallax and focus (depth-of-field)
  express what is *here now* vs *ahead/behind*. Foreground = present thought; midground = the
  world; background = the field of all cognition.
- **Anchors of stillness** — within continuous motion, the world periodically settles into a
  *still point* where a single idea is legible (a Canon line on calm glass). These are the v2
  equivalent of frames: viewport-complete moments of rest inside the flow. The rhythm is
  **motion → stillness → motion**, never constant motion, never dead stops.
- **Persistent matter** — key light-forms persist across the whole journey (the first mote from the
  opening is still present, transformed, at the end). The world has object permanence; the visitor
  feels one continuous thing, not a slideshow.

## 3. Liquid Glass system (evolved)

Glass v2 is a layered optical material, not a `backdrop-filter` panel:

- **Refraction & depth** — glass bends the world behind it (edge refraction, subtle chromatic
  dispersion at borders), with a sense of real thickness. Implemented as: `backdrop-filter`
  (blur+saturate+brightness) as the base, plus an SVG/WebGL displacement layer for edge refraction
  on hero glass, plus an inner shadow + edge-light for thickness.
- **Specular & caustics** — a soft moving specular highlight tracks an implied light source; hero
  glass casts faint caustic light onto the plane beneath. Ambient, slow, sub-perceptual.
- **Adaptive tint** — glass takes the *current cognitive-state hue* at low saturation (learning
  cyan, research blue, mastery gold…), so the material itself carries mental state.
- **Tiers** (evolving v1's planes P5/P6):
  - *Instrument glass* — panels, Voice Line, overlays: full refraction, `blur(24px) saturate(1.4)
    brightness(1.08)`, edge-light, thickness shadow.
  - *Whisper glass* — ambient chrome (gem, thread): line-weight, `blur(12px)`, minimal.
  - *Lens glass* (new) — hero moments where glass frames a cinematic asset: strong refraction,
    caustic cast, the boundary between video and UI deliberately dissolved.
- **Fallbacks** — `prefers-reduced-transparency` collapses all glass to near-opaque tinted fills;
  refraction/caustic layers are progressive enhancements that never block legibility.

## 4. Depth & lighting (cinematic model)

- **One warm high key light** (from v1) becomes a *cinematic lighting model*: key + soft fill +
  rim light on raised forms; volumetric haze in deep space for atmosphere; luminance falloff with
  depth (distant cognition is dimmer, cooler).
- **Depth-of-field** is a first-class attention tool: the present idea is in focus; the world ahead
  and behind is softly defocused. Focus racks (the plane of focus travels) are a motion primitive.
- **Parallax planes** — background field, cognition substrate, midground structures, foreground
  glass — move at different rates along the spine, creating real spatial depth.
- **Luminance tides** — the whole world's brightness swells and settles with the narrative (dim at
  ignorance, radiant at mastery/contribution), a slow breathing of light.

## 5. Cinematic motion language

Motion v2 operates at three levels — **element**, **camera**, and **world** — governed by one law:
*continuity of matter*.

- **Camera language** — the visitor's viewpoint moves: push-in (diving into an idea), pull-back
  (revealing scale), lateral drift (traversing), rack-focus (shifting attention), orbit (examining
  a structure). Camera moves are slow, weighted (`ease-expo`/spring), and motivated by cognition —
  never decorative flythroughs.
- **Continuous transformation (morph)** — the signature v2 transition: matter persists and
  *becomes*. Particles → neurons → graph → classroom → civilization is one unbroken morph chain.
  Techniques: shared-element FLIP (from v1), WebGL particle systems whose targets retarget between
  forms, SVG path morphing, and cross-shader dissolves. **No opacity hard-cuts between movements.**
- **Choreography** — scroll drives a timeline (GSAP ScrollTrigger / scroll-linked WebGL): each
  scroll position is a deterministic point in the world's transformation. Scrubbing back reverses
  the cognition (memory is navigable).
- **Breathing** — the ambient resting motion (§1.4): drift, reflection, depth sway, luminance tide.
  ≤ a few % of visual energy; continuous; never distracting.

## 6. Motion vocabulary v2

v1's verbs (`materialize`, `connect`, `focus`, `consolidate`, `descend`, `yield`, `reveal`,
`continue`, `breathe`) all carry forward. v2 adds the world-scale verbs:

- **emerge** — matter rises from the deep field into form (particles coalescing).
- **traverse** — camera moves the visitor through space to a new region of the world.
- **crystallize** — diffuse cognition (a cloud of motes) snaps into precise structure (a graph, a
  concept, a formula).
- **dissolve-forward** — a form loosens back into particles that *re-form* as the next form (the
  morph primitive; never a fade-to-nothing).
- **rack** — the plane of focus travels; attention shifts by depth, not by moving elements.
- **swell / settle** — luminance/scale tide up to a peak, then decelerate to a still point (the
  motion→stillness rhythm).

Each has tokenized timing (extends v1: `--t-instant 120 · quick 240 · move 400 · form 600 · scene
800 · cinematic 1200–2400ms` for camera/morph moves) and easings (`ease-expo`, `ease-spring`,
`ease-soft`, plus a new `ease-cine` for long weighted camera moves).

## 7. The living-cognition substrate (always-on)

A persistent, ambient visual language present in **every frame** (principle 2), rendered in WebGL
for performance:

- **Motes** — points of light = units of attention/knowledge. Drift gently; brighten near focus.
- **Filaments** — thin luminous connections = relationships forming between ideas. Draw and fade
  continuously at low density.
- **Traces** — faint fading paths = memory forming (something was here, it's being remembered).
- **Forming structures** — at ambient intensity, small graphs/lattices perpetually assemble and
  dissolve in the deep background — cognition happening everywhere.
- **Density is narrative** — sparse and calm at rest; dense and bright at cognitive peaks. The
  substrate is the same system that becomes the hero knowledge-graph at full intensity (one
  vocabulary, scaled), so the world is coherent.

## 8. Color & cognitive-state visualization

v1's 8-state palette holds (learning cyan, discovery amber, practice green, assessment violet,
research blue, reflection rose-grey, mastery gold, confusion ember). v2 adds:

- **Atmospheric grading** — each region of the journey has a *cinematic grade* (a coherent
  color-temperature + contrast profile) built from its state hue, applied to Higgsfield assets,
  WebGL, and glass alike so everything looks like one film (§ storyboard "visual DNA").
- **State as luminance journey** — the ladder from ignorance→contribution is a warmth+brightness
  climb (ember → cyan → green → violet → gold), used both in the surface and the landing.
- **One focal accent at a time** (v1 law) — the current region's state hue is the single focal
  color; everything else is neutral or ambient. No rainbow.

## 9. Typography — cinematic & kinetic

v1 roles hold (Canon/Gloss/Voice/Working/Instrument/Data/Whisper; Fraunces/Space Grotesk/Space
Mono; 12px floor; 62ch measure). v2 adds:

- **Kinetic type** — Canon lines `materialize` with weight (blur-in, slight scale, letter-spacing
  settle); key words can brighten in sequence (the surface's word-sync narration, applied to hero
  copy). Type is part of the choreography, not a static overlay.
- **Type on glass** — headlines sit on a legibility scrim (P0 gradient) over cinema; never on
  full-brightness motion. Contrast floor enforced regardless of the asset behind.
- **Cinematic scale** — hero Canon may exceed v1's 2xl for landing moments (`clamp` up to ~4.5rem),
  while the surface keeps v1's calmer scale. The scale is one system, two amplitudes.

## 10. Animation hierarchy (the peak law)

Four intensity tiers; at most one of the top tier active at once:

1. **Ambient** (always) — breathing, drift, glass reflection, substrate at rest. ≤ ~3% energy.
2. **Structural** (on traversal) — parallax, focus racks, type materialize, thread fill.
3. **Focal** (on arrival) — a concept crystallizes; one anchor lights; one interaction responds.
4. **Cinematic peak** (rare, earned) — a full morph/camera move (particles→graph, the pull-back to
   civilization). **One at a time**, separated by still points. Overuse of peaks is the primary
   v2 anti-pattern.

## 11. Interaction philosophy

- **Touchable glass** — interactive glass responds with light (specular bloom, tint shift, subtle
  refraction) under pointer/focus; it feels like a physical optical object, not a button.
- **The page as a cognitive system** — it remembers scroll position and state, forms connections as
  you move, and compounds (later movements reference earlier matter). Interactions *shape* the
  world, they don't just navigate it.
- **Spatial, not modal** — going deeper is diving into depth (the surface's `descend`), not opening
  a modal on top. Overlays are lens-glass that the world is seen *through*.
- **Calm control** — the visitor can always slow/stop motion (a global "reduce motion" affordance
  beyond the OS setting), skip to the app, and read everything statically.

## 12. Rendering architecture (hybrid)

The v2 world composes four layers into one seamless image (the visitor can't tell them apart):

1. **WebGL layer** (React Three Fiber / Three.js) — the living-cognition substrate, particle
   morphs, hero knowledge-graph, depth field, volumetric haze. One persistent canvas behind the
   DOM; scroll-linked.
2. **Cinematic asset layer** — Higgsfield loops (video/stills), color-graded to the visual DNA,
   composited on WebGL planes or as CSS backgrounds behind the legibility scrim.
3. **CDL glass/DOM layer** — all text, Liquid Glass panels, interactive chrome (the v1 token
   system), on top, legible.
4. **Choreography driver** — GSAP ScrollTrigger (or scroll-timeline API) as the single clock that
   drives all three layers deterministically from scroll position.

Composition rules: WebGL and video never carry text; the DOM/glass layer never animates heavy
filters during scroll (transform/opacity only); one canvas, one scroll driver, layers share the
state-hue and grade so they read as one material.

## 13. Performance

- **Budget** — one WebGL canvas, capped DPR (≤2), instanced particles (GPU), frustum/again LOD by
  depth; target 60fps on mid hardware, graceful degrade to 30fps then to the CSS/still fallback.
- **Assets** — Higgsfield loops poster-first, `preload="none"`, lazy on approach, AV1/H.265 + WebM,
  ≤2–4s seamless loops, resolution capped per breakpoint. Hero still is the LCP target.
- **Scroll** — choreography reads scroll once per frame (rAF), no layout thrash; only the active
  region's WebGL work runs; off-spine regions sleep.
- **Progressive enhancement** — the page is fully readable and navigable with **zero** WebGL/video
  (server-rendered DOM + CSS glass). Cinema is additive. No-WebGL devices get CSS/SVG motion.
- **Lighthouse** — perf/a11y/best-practices kept high via the above; cinema is gated on capability
  and preference.

## 14. Responsive & spatial adaptation

- Desktop: full spatial depth, camera moves, full parallax. Tablet: reduced parallax depth,
  1:1/4:3 asset crops, same journey. Mobile: the journey is preserved as a vertical traversal with
  reduced WebGL density, 9:16 crops, shorter camera moves, taller still points. The arc never
  truncates; only fidelity scales.
- Safe-area insets; touch targets ≥44px; the spine works with touch, wheel, keyboard, and
  screen-reader linear order.

## 15. Accessibility (cinema that includes everyone)

- `prefers-reduced-motion`: the entire journey degrades to a **static illustrated narrative** — each
  movement's still point with its copy, revealed on scroll, no camera/morph/particles. The story
  fully reads.
- `prefers-reduced-transparency`: glass → opaque tinted fills.
- Contrast floor 4.5:1 for all informative text regardless of the asset behind (enforced by the
  scrim). 12px min text.
- Full keyboard traversal; visible focus in state hue; captions/alt on every cinematic asset;
  a persistent skip-to-app link; a manual motion-pause control.
- WebGL is decorative/`aria-hidden`; all meaning is in the DOM/text layer (screen readers get the
  narrative, never the canvas).

## 16. Component & primitive library v2

Extends v1's primitives (VoiceLine, SystemGem, FrameStage, Anchor, Glass, Thread, Plane,
StateLight, Disclosure) with the world primitives:

- `World` — the persistent WebGL canvas + scroll-driver context.
- `Substrate` — the living-cognition particle system (motes/filaments/traces), density-driven.
- `Movement` — a region of the journey (a still point + its transformation to the next); the v2
  unit of composition.
- `Morph` — a continuous transformation between two forms (particle retarget / path morph / shader
  dissolve).
- `LensGlass` — hero glass that frames cinema with refraction + caustic.
- `CameraRig` — the scroll-linked viewpoint controller.
- `Grade` — the atmospheric color-grade applied per region across all layers.

Every component declares its layer (§12), its plane/depth, its state hue, and its reduced-motion
fallback. No component sets raw z-index/shadow/blur/filter — it composes from tokens.

## 17. Token architecture

`apps/web/src/tokens.css` (v1) gains a v2 layer: cinematic timing (`--t-cinematic`), `--ease-cine`,
lens-glass material tokens, depth/parallax rate tokens, atmospheric-grade variables per state, and
substrate density tokens. v1 names remain aliases so the shipped surface is untouched until
migrated (§19). Non-CSS parameters (WebGL/particle/camera config) live in a typed
`apps/web/src/cdl/world.ts` config module, tokenized the same way.

## 18. Governance & extensibility

- v2 is spec-first like v1: new movements, morphs, grades, or state hues update this spec before
  implementation. Every cinematic asset traces to a movement + shot spec; every motion to a
  vocabulary verb.
- The **honesty law holds under cinema**: no dark-pattern spectacle, no fabricated capability, no
  motion that misrepresents what the system does. Cinema dramatizes *real* cognition (event-sourced,
  governed, replayable) — never invents it.
- Future manifestations (mobile app, educator console, docs) inherit v2 tokens + layers; they may
  use the ambient tier without the full WebGL world.

## 19. Migration (v1 shipped → v2)

1. **Additive tokens** — add the v2 token layer + `world.ts` config; v1 tokens keep working. No
   visual change to the shipped surface yet.
2. **Landing first** — build the continuous-journey landing on v2 (WebGL world + Higgsfield +
   glass) at the `/` route. This is where v2 debuts, at full fidelity, with no risk to the app.
3. **Surface uplift (staged)** — bring v2's evolved Liquid Glass (refraction/caustic), the
   living-cognition substrate at ambient intensity behind the board, camera-weighted transitions,
   and luminance tides into the Cognitive Surface — preserving every v1 law (board sacred,
   legibility, determinism, reduced-motion). The surface becomes a *quiet* instance of the same
   world the landing introduces cinematically.
4. **Verify** — `pnpm verify` green; a11y + reduced-motion + no-WebGL passes at every stage; the
   landing and surface proven to share one visual DNA.

## 20. The measure of success

A first-time visitor, before reading a word, feels they have entered a living intelligence — calm,
serious, vast, warm. They cannot tell where video ends and interface begins. They experience
cognition forming, connecting, and compounding as they move. And when they arrive at the surface,
it feels like the same world, gone quiet and put to work. Not an impressive website — the first
place a person can *see* the operating system for human understanding.
