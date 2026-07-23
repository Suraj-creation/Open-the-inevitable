# Changelog

All notable changes to The Inevitable are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/); the project uses Conventional Commits.

Entries are **milestone-level abstractions** — what shipped and why it matters, a short
paragraph or a few bullets per milestone. Implementation detail lives in the owning specs and
`docs/history/implementation-log.md`; current codebase state lives in `IMPLEMENTATION.md`.

## [Unreleased]

### Added — CSE: the Representation Intelligence Agent (Production Goal II; audit R4; CSE-018, ADR-0058)

Production Goal II — representation is now a governed, planned, replayable cognitive capability, not
a fixed template. The full design is spec law (CSE-018: the `RepresentationPlan`, ten representation
laws, MCCR 2.0 grammars, the deterministic-fallback rollout; ADR-0058 adopts it). Delivered:

- **Deterministic RIA (R4a):** `surface.representation.planned` (SRF-002 1.11.0) folds into a
  `representations` slice; `planRepresentation` maps each element onto a hierarchy
  (primary/supporting/residue) + an epistemic role — parity metadata, so a frame with no plan renders
  identically and the RIA can never regress a frame.
- **Roles rendered (R4b):** each element carries its epistemic role + hierarchy; the CDL renders the
  role as visual language (a separate semantic layer from element type) — the learner reads the KIND
  of knowledge without labels (Law 5).
- **Derivation grammar (R4c):** `key_formula.line_labels[]` (transformation captions) flow through to
  the board + deck — a derivation reads as constructed reasoning (Law 2).
- **Density verdict (R4d):** the plan measures element load against a budget; over-budget frames are
  flagged to split upstream, never to hide content (Law 3).
- **Model-backed RIA (R4-model):** the `agent.representation` unit assigns roles/hierarchy/exclusions
  and an adaptivity note on the governed dispatch path — grounded to the composer's real elements,
  with a degraded-empty fallback to the deterministic floor so a model failure never regresses a
  frame. Wired end-to-end (gateway on).

Remaining in R4: the misconception-dissolve grammar + the rest of the MCCR 2.0 grammar set + image
rationale (R4e). `pnpm verify` green (27 tasks) throughout.

### Changed — CSE: rendering the Cognitive Theater (audit R3; ADR-0057)

The Theater's craft — the shot grammar, the Director's pacing, Scene lighting, and derivations — was
emitted and folded into `SurfaceState` but had no client consumer: dead at render. R3 wires those
consumers and adds the one missing producer (no new architecture; every motion reduced-motion-safe):

- **Progressive derivation (R3a):** a multi-line `key_formula` stages its lines in sequence while it
  is the spoken element — the learner watches the derivation constructed, not handed over whole.
- **Director pacing (R3b):** the inter-segment playback hold now derives from the directive's
  `pacing` (tempo scales the teacher's pause; `silence` holds the surface deliberately still),
  replacing a fixed constant — the Director's pace is finally felt.
- **Cinematography shots (R3c):** the active Scene's latest shot realizes as a subtle, meaningful
  board move; the 14-shot grammar has a real consumer at last.
- **Scene lighting (R3d):** the Scene's receded actors dim gently so the focus reads first (never
  dimming the element being spoken; readability preserved).
- **Attention budget + affect (R3e):** the theater path now PRODUCES `surface.attention.budgeted`
  (a folded-but-unemitted slice), and the sensed affect + a low budget render as a learner-visible,
  opt-out chip — sensing is legible and never a hidden score (CSE-005 §3.5).

`pnpm verify` green throughout. Next: R4 (the Representation Intelligence Agent), R5 (compounding).

### Changed — CSE source-anchored teaching: the pipeline inversion (audit R2; ADR-0057, CSE-008/011)

The audit's central finding was that teaching was *source-adjacent* — even with a source attached, the
lesson never read it (curriculum from the goal string, planner/composer prompts source-blind, the
Director's region anchor hardcoded `null`, anchors bolted on post-hoc by lexical overlap with
index-positional sync). R2 inverts the pipeline so the source becomes the medium of teaching. Every
sub-phase falls back to goal-mode when no source is bound, so nothing regresses; `pnpm verify` stayed
green.

- **Source into the prompt (R2a):** the concept's anchored passages are resolved before dispatch and
  threaded into the frame-planner + composer, which teach *from* the passage under a SOURCE MODE
  directive.
- **The Director points at the region (R2b):** `focus.source_anchor_ref` is populated (CSE-011 §4).
- **The document becomes the timeline (R2c):** `SourceHub.curriculumFor` derives the curriculum from
  the document's own concepts/sections; `POST /api/surface/:id/teach-source` walks it.
- **Semantic sync + entailment gate (R2d):** each narration segment binds to the anchor it discusses,
  the highlight role is typed from the MCCR slot, and a non-entailed segment lights **nothing** —
  never a wrong pointer.
- **Source-as-stage (R2e):** teaching from a source puts the document center-stage, the MCCR board a
  companion gloss.

Proven end-to-end deterministically (register → attach → teach-source → the timeline is the document's
sections, a viewport plan exists, the Director's focus anchor is populated). Next: R3 (render the
Theater), R4 (the Representation Intelligence Agent), R5 (compounding).

### Changed — CSE production readiness: integrity + the acquisition front door (audit R0+R1; ADR-0055/0056, CSE-017)

A production-readiness audit (`spec/research/cse-production-readiness-audit-2026-07.md`) found the CSE
substrate strong but the learner experience unrealized — no way to bring a source in-product, a source
plane that forgot consent revocations on restart, a web app that never distilled a session, and
title-string pedagogy heuristics. The audit's first two roadmap phases shipped:

- **Integrity & durability (ADR-0055).** The source plane is now durable under `COS_PERSIST_DIR`
  (pure-`node:fs` catalog + content-addressed bytes); the hub rehydrates registrations under their
  original ids, so a **consent revocation survives a deploy** (content still 410 Gone, commons stays
  delisted) and a restarted surface rebinds its sources. The web **closes the session on leave**, so
  episode/delta/resume-card distillation finally runs for web learners. Contribution emits its attach
  event (fold ≡ server). Frames carry a typed `kind` (SRF-002 1.10.0), retiring the
  `title.startsWith("practice")` heuristic to a replay-only fallback.
- **The Source Dock (CSE-017, ADR-0056).** The front door: a `＋ Source` affordance opens a dock with
  file drag/drop + picker (PDF/markdown/text/code/transcript), a governed URL crawl, and paste — with
  modality inference, **honest refusal before upload** for unadaptered formats, a canonicalization
  narrative built from the pipeline's own registration summary, and auto-attach so the Living Reference
  appears. Closes the audit's severest gap (zero web callers of `/api/sources`).

`pnpm verify` stayed green (28 tasks). Later audit phases (R2 source-anchored teaching, R3 the rendered
Theater, R4 the Representation Intelligence Agent, R5 compounding) are the next frontier.

### Added — The Cognitive Source Environment, implemented end to end (M1–M10; ADR-0032, 0035–0048)

The CSE spec domain (ADR-0032/0033/0034) is now built: any knowledge artifact becomes a canonical,
anchored, agent-orchestrated cognitive environment on the Surface. Every capability that reasons is
model-backed (real Gemini, D3-recorded) and deterministic where it can be; all are gateway-on and
CLI-untouched (a website capability). `pnpm verify` stayed green (28 tasks) throughout; each milestone
was proven live.

- **The substrate (M1–M3.5).** `@inevitable/source-environment` — the Source Anchor (multi-selector,
  pure resolution, cross-version migration), content-addressed versions, the eight-layer artifact
  model, progressive canonicalization behind modality adapters, the `source.*` event family, the
  replay fold. Canonicalization became **governed cognition** (M3): the privileged `canonicalizer`
  agent extracts the semantic + citation layers, grounded at the parser (hallucinated evidence
  dropped). The **Cognitive Intelligence Persistence** plane (M3.5, ADR-0035, `@inevitable/intelligence`)
  turns evaporating reasoning into durable, re-derivable intelligence (chronicle + governed
  distillers). Supabase adapters (M2, ADR-0034) graduate persistence behind the eight-contract seam.
- **Every source modality (M4, M10).** PDF (M4, ADR-0036, client-native fidelity by hash), and —
  completing M10 — **code** (ADR-0046), **web** (ADR-0047, client-supplied HTML), and **video**
  (ADR-0048, a timed transcript → the L4 temporal layer, the first implementation of that layer).
  Each rides one `parse`/`parseBinary` seam; the whole pipeline works over all of them unchanged.
- **The learner-visible surface (M5–M6).** The **Living Reference** (M5) puts source evidence on the
  board (semantic viewports + a highlight grammar + the attention contract); the **Meaning
  Representation Layer** + episodes + resume cards + the Understanding Map (M6, ADR-0037) make what a
  passage does to a mind legible.
- **The Cognitive Theater (M7–M8, ADR-0038/0039).** The **Director** (an authored pedagogy FSM), the
  **Scene** (frames as living spaces), **Knowledge Cinematography** (a shot grammar, reduced-motion
  conformant), and the **Interaction Grammar** (the learner as an actor who reshapes the Scene).
- **Living knowledge (M9).** **Source Fusion** — deterministic reconciliation (T1, ADR-0040), the
  **Claim Graph** + cross-source contradiction detection (T2, ADR-0041), and a model-woven **fused
  explanation** citing every source (T3, ADR-0042). **Frontier overlays** via real governed web
  grounding (ADR-0043 — no frontier entry without a citable origin), the **Temporal Knowledge Model**
  (ADR-0044), and the **grounded proactive frontier** (ADR-0045 — the readiness gate now surfaces the
  real, cited frontier, not an ungrounded breadcrumb). CSE-006 living knowledge is complete.

### Added — The Cognitive Theater + Supabase backend graduation (ADR-0033, ADR-0034)

- **The surface gains its missing conductor.** ADR-0033 adopts the Cognitive Theater — four organs
  that turn the narrated slide deck into a directed, inhabitable space: the **Cognitive Director**
  (CSE-011) which decides *what cognitive state the learner should enter next* across every
  temporal scale from the moment to the lifetime (the CDL already named the states as hues;
  nothing drove the transitions until now); the **Cognitive Scene** (CSE-012) which elevates
  ADR-0030 frames into living spaces with actors, lighting, and in-place evolution; **Knowledge
  Cinematography** (CSE-013), a pedagogical shot grammar (semantic zoom, spotlight, dissolve,
  hold); and the **Cognitive Interaction Grammar** (CSE-014), ~25 semantic primitives where every
  act is cognitive intent, not UI manipulation. All additive over the existing frame substrate,
  all still folds, all replay-preserving, all backward-compatible.
- **Two further capabilities elevated to first class:** **Source Fusion** (CSE-015) reconciles many
  sources into one inhabitable environment (beyond side-by-side alignment); **Creative Cognition**
  (CSE-016) makes creation — writing, hypothesis, design, invention — a first-class cognitive act
  and the mission's contribution loop.
- **Deepenings:** an inspectable progressive world model + an affective/attention channel (CSE-005);
  a continuous research horizon exposing known→open in every lesson (CSE-006); deep cognitive
  transparency — every pedagogical decision carries a uniform envelope of considered/rejected
  alternatives, contributing/dissenting agents, evidence, and confidence (CSE-007). CDL v3 scopes
  the design language across twelve sensory/temporal channels (proposed).
- **The backend is chosen.** ADR-0034 graduates persistence to **Supabase-first** (Postgres +
  pgvector + Storage + Auth + Realtime) behind the existing eight-contract adapter seam — new
  Supabase adapters pass the same conformance harness, heavy clients stay out of the workspace via
  guarded dynamic import, the append-only Postgres event table is the source of truth, and
  Row-Level Security enforces learner governance at the database. NATS/Neo4j/Qdrant/Temporal remain
  the documented graduation targets.
- **A concrete, phase-by-phase build plan** lands at
  `spec/implementation-roadmaps/cse-cognitive-theater-and-backend.md` (backend foundation → anchored
  PDF → meaning/episodes → Director/Scene → cinematography/interaction/transformations → living
  knowledge/fusion → temporal modalities → universe/human-sources/creation). Spec-only this
  milestone; indexes, taxonomy, ecosystem map, and dependency graph updated.

### Added — Cognitive Source Environment: the spec domain for turning knowledge artifacts into living cognition (ADR-0032)

- **A new first-class COS subsystem, adopted spec-first.** `spec/source-environment/` (CSE-001…
  CSE-010) is the architectural law for converting every form of external knowledge — books,
  papers, videos, websites, code, datasets, and (under consent) people — into canonical, anchored,
  agent-orchestrated cognitive environments projected onto the Cognitive Surface. It supersedes
  the consolidated founding draft (preserved in `spec/research/`) and gives F15 its owning
  architectural domain, activating Layer 3 (Knowledge) of ADR-0023.
- **The load-bearing primitives:** the Source Anchor (stable, versioned addressing into any
  modality), progressive attention-driven canonicalization across eight understanding layers
  split along the Principle Zero seam, the Meaning Representation Layer, episode-centered memory
  with Understanding Deltas, the transformation algebra, the Claim Graph and frontier overlays,
  the Enrichment Decision loop with a governed interruption budget, and the source–surface
  projection seam (semantic viewports, semantic highlight grammar, the attention contract;
  proposed `surface.source.*` subfamily, schema 1.6.0).
- No code shipped; indexes, taxonomy, ecosystem map, and F15 updated for full traceability.

### Added — UCS production hardening: the surface becomes trustworthy (ADR-0031)

- **Narration plays exactly once.** The audio pipeline was rebuilt around a single-owner playback
  engine with epoch-guarded async edges: a segment can never repeat, a dead speaker can never
  freeze the caption (reading-time degradation), and the word-sync clock is the audio element's
  own time. The duplicate/silent/stalled narration bug class is closed structurally and pinned by
  deterministic tests.
- **The board became dense with real cognition.** The composer now composes complete cognitive
  representations (5–7 anchors: worked examples, derivations, misconceptions, diagrams — never
  filler), with a new first-class `misconception` anchor, multi-line formula derivations rendered
  by KaTeX (publication-grade, lazily loaded), cycle diagrams, semantic per-role color identity,
  and disclosure instead of truncation everywhere.
- **The learner never waits in silence.** Every ask narrates its pipeline phases live
  (`surface.ask.progress`), frame N+1 composes while frame N is being voiced, speculation moved
  off the ask's critical path, and a second ask can no longer silently reset the first.
- **Degradation is named truthfully.** Token-budget truncation reports as truncation; image
  generation retries transient failures and the planner's full prompt now reaches the provider;
  the Observatory gained a cognition-health panel, playback diagnostics, and a searchable raw
  event inspector.
- **A session is now a study artifact.** One click exports the journey as a formatted PowerPoint —
  one cognitive frame per slide in the surface's own visual language, native vector diagrams,
  narration as speaker notes — all derived from one canonical deck model built for future
  PDF/Markdown/LaTeX exporters.

### Added — The public ecosystem: the complete company website of Universal Cognitive Infrastructure

- **From a landing page to a public manifestation.** The site is now a coherent ecosystem on one
  design language: the continuous cinematic journey remains the Home, and eight substantive
  regions open from it — Vision, Philosophy, Cognitive Surface, Source Environment,
  Infrastructure, Research, Roadmap, and About — every one composed from CDL primitives
  (state-graded ambient cognition on every page, whisper-glass navigation with a state-light
  locator, lens-glass figures of the real product, law-lists, pipelines, the Ignorance→
  Contribution ladder) and written from the vision/product/architecture corpus itself: honest,
  calm, checkable claims only.
- **One world, navigable.** Client routing with route-level code-splitting (each page ~2–3KB
  gzip), a deterministic 2D living-substrate canvas on inner pages (the full WebGL world stays on
  Home), the journey now ends by opening the ecosystem (footer past the paradigm reveal), a
  shared/resumed surface (`?s=`) still enters cognition from any path, and the enter flow lives at
  `/enter` under the same nav.
- **Public-site hygiene.** SEO meta (description, OpenGraph, theme color), an SVG favicon (the
  mote), per-page titles/descriptions, mobile glass-disclosure navigation, and reduced-motion
  static fallbacks across every page.

### Added — CDL v2 + the public landing: the first public experience of Universal Cognitive Infrastructure

- **The design language became a world.** CDL v2 (`spec/design/cognitive-design-language-v2.md`,
  ACTIVE) evolves v1 into a cinematic cognitive world: one continuous space instead of screens,
  Liquid Glass as a real optical material (lens tier), camera-and-morph motion vocabulary
  (emerge/traverse/crystallize/dissolve-forward/rack/swell-settle), an always-on living-cognition
  substrate, atmospheric grading per cognitive state, and a hybrid WebGL + cinema + glass rendering
  architecture — with v1's accessibility, determinism, and honesty laws intact.
- **The landing is a journey, not a website.** At `/`, one deterministic WebGL particle system
  morphs continuously through eight movements — a mote of curiosity becomes a neuron, a knowledge
  graph (framing a real capture of the Cognitive Surface in lens glass), a lifelong companion, the
  mastery ascent, a civilization-scale cognitive layer, and finally the paradigm reveal:
  *Agriculture scaled food… Universal Cognitive Infrastructure scales understanding. The
  Inevitable.* Scroll is traversal; nothing hard-cuts; the world breathes.
- **Cinema that includes everyone.** Reduced-motion / no-WebGL visitors get the full story as a
  static illustrated narrative; text always sits on legibility scrims; three.js is code-split so
  first paint never waits for the world (main bundle 90KB gzip).
- Higgsfield cinematic loops are specced shot-by-shot (one visual DNA) and pend workspace credits.

### Added — Cognitive Design Language v1.1: motion, constellation, self-hosting (Phase 7, first tranche)

- **The concept travels.** A frame that continues the same concept (explanation → its practice)
  now morphs the core-concept anchor from its old position to its new one — true shared-element
  continuity — while the rest of the board crossfades. Motion explains causality: one idea in
  motion, not a whole screen sliding.
- **The path is a constellation.** The learning graph is now a deterministic, replay-safe
  force-directed star map with hard overlap resolution (node boxes and labels can never collide),
  mastered concepts glowing as earned light.
- **Knowledge becomes memory, visibly.** When a concept is mastered, a gold mote of it crystallizes
  and drifts into the Path — the CDL `consolidate` motion, now wired.
- **Fonts are self-hosted.** Fraunces, Space Grotesk, and Space Mono ship with the app (woff2,
  preloaded) — no third-party CDN, no privacy leak, no external point of failure.

### Added — Cognitive Design Language v1: the permanent visual language (Phase 4/5 of the CDL process)

- **CDL v1 is law.** A complete design system — `spec/design/cognitive-design-language-v1.md` —
  now governs every interface of the Universal Cognitive Infrastructure: one-sentence law
  ("everything on screen is either cognition or light"), five principles, seven depth planes,
  an eight-hue cognitive-state palette at three amplitudes, typography roles
  (Canon/Gloss/Voice/Working/Instrument/Data/Whisper), breath spacing, and a motion vocabulary
  (form/continue/focus/reveal/yield/breathe). The full UX audit and approved rationale live in
  `spec/design/proposals/`.
- **The web surface migrated.** The media-player HUD became the **Voice Line + Thread of
  Understanding** (narration as ambient light at the bottom edge; instruments rise on approach;
  progress and frame navigation as a filament thread). The alarm-red DEGRADED banner and status
  cluster became the **System Gem** (one calm point of light; ember ring for honest degradation).
  Practice answers, frontier nudges, and the continue affordance moved into **stage-owned layout
  slots** — floating chrome can no longer occlude the board.
- **The board recomposes instead of shrinking or clipping.** Scale-to-fit was retired for
  **density recomposition**: overflowing anchors fold into disclosure chips (priority-ordered,
  bidirectional, oscillation-guarded) and reopen on a glass focus plane. Anchor hierarchy makes
  the core concept the visual Canon; narration focus recedes sibling anchors; frame transitions
  distinguish a continuing concept from a newly forming one; graph labels can no longer collide.

> **Closing the gap between a faithful architecture and the learner's experience.** Guided by the
> comprehensive implementation review (`spec/research/ucs-implementation-review-2026-07.md`), the first
> hardening pass fixes the deepest root causes: cognition no longer degrades silently, the production
> gateway no longer runs on a frozen demo clock, and the board renders real mathematics and structured
> diagrams instead of raw LaTeX and undifferentiated rings.

### Added / Fixed — UCS experience last mile: accessibility, navigation, a thinking surface (review R2/R3, fifth pass)

- **The board is now manipulable.** Hovering or focusing any MCCR anchor reveals Simpler / Deeper /
  Why? affordances that reshape the lesson from *that idea* (F16 causal transparency) — the learner
  acts on cognition instead of only watching it. Mastered concepts acquire a persistent gold-leaf
  identity so the path visibly accumulates earned understanding, and a "research frontier" nudge lets a
  ready learner step from learning into research (F10).
- **Navigation by concept, and surfaces that persist.** Frame-level transport with named frame ticks
  (not "Segment N") lets the learner jump between Cognitive Frames; a surface is now reflected in the
  URL (`?s=…`) so it can be linked, resumed, and shared (the gateway rehydrates it).
- **Accessibility floor.** Overlays trap and restore focus (`aria-modal`); the transport HUD keeps
  play/pause visible when idle and restores fully on keyboard focus (no more stranding); scrub ticks
  meet touch minima; the smallest informational text is ≥11px; fonts load non-blocking; and the
  overstimulating multi-rate `breathe` pulses were calmed to one cadence.
- **Feedback & instrumentation.** A long ask now narrates its pipeline phase (planning → composing →
  distilling → voicing) from folded state; reshaping verbs acknowledge on press; agent disagreement is
  reachable via an "another view" affordance; and the Observatory is split into "Understanding" (the
  craft) vs "Instrumentation" (agents, reasoning, latency) for its two audiences. `pnpm verify` green.

### Added / Fixed — UCS earned mastery, honest cognition & staged reveal (review R1/R2, fourth pass)

- **Mastery is earned, not fabricated.** A new Grader agent (`AssessmentUnit`) grades the learner's
  *actual* answer to a practice problem into evidence-bearing depth tests tied to what they wrote; the
  practice frame now carries an answer box, and submitting it emits an honest
  `surface.assessment.gate.evaluated` + an "Assessment —" frame with real feedback. Offline it degrades
  honestly ("recorded, ungraded") — it never invents a pass. This closes the product's deepest
  philosophical breach (F14).
- **Silent cognitive degradation is over.** Every deterministic fallback now emits a typed
  `surface.cognition.degraded` marker, folded into a health slice and surfaced as a "degraded: <units>"
  badge in the HUD — a session running on fallbacks is no longer indistinguishable from a healthy one.
- **Cognition unfolds before your eyes.** The active frame's MCCR anchors now reveal *as the narration
  reaches them* (staged reveal) rather than the whole board popping at once — space reserved so nothing
  reflows, reduced-motion collapses to instant.
- **The Observatory tells the whole truth.** The image agent's prompt/rationale is now shown in the
  Composition panel (was hidden), and every agent resolves to a friendly name (Challenger, Composer,
  Planner, Illustrator) instead of raw ids. Timeline concept nodes are keyboard-activatable.
  `pnpm verify` green (26/26 typecheck+test, 25/25 lint, format).

### Added / Fixed — UCS learning loop, cognitive color & correctness (review R1/R2, third pass)

- **Understanding compounds — the lesson no longer restarts.** A path-scoped `advance` command teaches
  the next (or a chosen) concept on the *existing* curriculum without regenerating the DAG, so concept
  ids stay stable and governed look-ahead can actually promote. A persistent **"Continue"** ribbon means
  the learner is never stranded at a stopping point, and clicking a concept in the Path now *teaches* it
  (it was a focus-only no-op). The web client carries a **learner identity** (bearer token in
  localStorage), so a returning learner resumes their path and prior mastery seeds the new surface (F05);
  the dev gateway persists to disk by default so this survives a restart.
- **Pedagogy stops lying.** The board shows the Coach's *real* generated practice problem, not the
  meta-prompt. The product surface no longer fabricates a 5/5 depth gate or claims the learner "solved"
  anything — it records only what is true (the concept was explained and a problem presented) and labels
  the checkpoint honestly ("Ready to practice"), reserving "Mastery verified" for a genuine graded gate.
  (A learner answer-input → model-graded mastery upgrade is the next dedicated pass.)
- **The board's light thinks with the learner.** A cognitive color language tints each frame by the kind
  of thinking it carries — learning (cyan), practice (green), assessment (violet), research (blue) — a
  pure client projection washed subtly into the stage and the highlight marker. The stranded design-token
  regressions are fixed (the Educator overlay, chip borders, and readable image callouts return).
- **The surface acknowledges the learner and never fails silently.** Asks get a "working" pulse; gateway
  and transport failures surface as real, dismissible error states instead of unhandled rejections.
- **Correctness hardening.** Narration segments fold idempotently (no duplicate speech on reconnect); the
  SSE attach subscribes-before-replay with sequence dedupe (no dropped/doubled events); commands are
  serialized per surface (two asks can't interleave and corrupt the canonical log). `pnpm verify` green
  (26/26 typecheck+test, 25/25 lint, format).

### Fixed — UCS experience alignment (review R0/R2, second pass)

- **The board stops showing the system's plumbing.** The practice frame now carries the Coach's *real*
  generated problem (extracted from the dispatch), never the meta-prompt ("Give one concrete practice
  problem for…") that instructed it. The check segment carries a composed pause so the frame holds while
  the learner works. (The full answerable-practice + learner-graded honest mastery gate — removing the
  fabricated auto-pass — is the next dedicated pass, restructuring the teach→practice→assess flow.)
- **Narration became a teacher's instrument.** `pause_after` is honored end-to-end (producer → segment
  event → fold → choreographer), so composed teaching pauses are real. The moving highlight marker no
  longer sits above its anchor: it measures within its own positioned ancestor and divides out the
  fit-to-viewport scale (it was offset by the frame title and double-scaled). And a failed audio fetch,
  a blocked autoplay, or a silent stall can **no longer freeze the surface** — an error listener, a
  play()-reject fallback timer, and a watchdog always keep playback advancing.

### Fixed — UCS experience alignment (review R0/R2, first pass)

- **The model path actually fires.** The Frame Planner and Image Agent were falling back to their
  deterministic paths on every live call because `gemini-2.5-flash` spends thinking tokens from the
  output budget and their small `maxTokens` starved the response. Added a `thinkingBudget` control to the
  model contract + Gemini adapter, raised timeouts to 60s and budgets across composer/planner/imageplanner,
  sanitized the composer's response schema (empty-object array items 400'd Gemini), and salvage a rich
  composition that omits only its heading rather than discarding it. Quota (429) now fails fast instead of
  stacking retries onto an already-serialized ask.
- **The system stops lying about time.** The gateway now runs on a real `SystemClock` (the CLI demo/tests
  keep the deterministic `ManualClock`); onboarding leases are computed from the clock so a real-time
  gateway never starts with expired leases; composer/planner/imageplanner dispatches emit real
  `surface.agent.work.timing`. An image decision is recorded as `helps:true` only when an image actually
  reached the board (never claims media the learner cannot see).
- **The board renders cognition, not markup.** Key-formula anchors render as real mathematics (a
  dependency-free, XSS-safe LaTeX→HTML renderer with the spoken `plain` form as fallback — no learner ever
  sees `\sigma`); diagrams lay out by their `kind` (flow as a directed row, tree layered, axes as a plane,
  node-graph as a ring) with arrowheads on directed edges; tables show a "+N more" cue instead of silently
  truncating; sparse 2–3 anchor frames center and enlarge; the frame title no longer duplicates the
  core-concept anchor. `pnpm verify` green (25/25).

> **The board became the learner's visual memory, not the system's notepad.** The Universal Cognitive
> Surface now holds only the **Minimal Complete Cognitive Representation (MCCR)** — distilled anchors —
> while a **separate narration script** carries the teaching, and learning unfolds as viewport-complete
> **Cognitive Frames** instead of a scrolling document.

### Added — UCS: Cognitive Frames, MCCR & the narration-script split (ADR-0030)

- **The duplication is gone.** Previously the explanation agent's prose was both shown on the board and
  spoken verbatim; now a single Surface Composer distills the *shown* (MCCR: concept, definition, formula,
  diagram, relationship, mental model, table, example, memory cue, image) from the *spoken* (a paced
  narration script), in one coherent reasoning pass. The board preserves understanding; the voice
  constructs it; as narration plays, the exact MCCR element being discussed lights up.
- **Cognitive Frames** are a new top-level, folded, replay-equivalent primitive (`SurfaceState.frames`),
  with diagram/table rendered as deterministic client projections (no provider) and the active frame chosen
  by the choreographer cursor (a client projection — never logged). Eight additive `surface.frame.*` events
  (schema 1.4.0) carry planning, composition, the narration script, the image decision, element streaming,
  and governed look-ahead (speculative frames recorded but never surfaced until promoted).
- **One concept now unfolds as a sequence of frames, not one slide.** A **Frame Planner** decomposes each
  concept into a progressive series of viewport-complete frames (intuition → definition → worked example →
  connection); the composer distills each one's MCCR + narration, steered by the frame's teaching angle.
  Practice and the mastery checkpoint become their own anchored frames, so the whole lesson is frame-based.
  On screen, frames **cross-dissolve** as the narration crosses each boundary, and the next frame is buffered
  off-stage (its illustration pre-warmed) so the transition is instant. The Agent Observatory gained a
  **Composition panel** exposing the frame queue, each frame's anchors, its density against the one-screen
  budget, and the image decision behind it.
- **Scope shipped:** Phase 0 (spec law: ADR-0030 + SRF-001/002/004/005 + F16/F09), Phase 1 (vertical slice:
  substrate + `SurfaceComposerUnit` + session frame path with element-targeted narration + frontend
  `FrameStage`/`MccrElement`/`HighlightLayer`, no-scroll, deterministic replay, graceful legacy fallback),
  the **gateway cutover** (the live product renders the frame path), **Phase 2** (`FramePlannerUnit` +
  multi-frame decomposition + practice/assessment frames + `FrameDeck` transitions/N+1 buffering + Observatory
  Composition panel), **Phase 3** (governed look-ahead: the planner's discardable `lookahead[]` bet, budgeted
  speculative pre-composition of the next concept's opening frame under a live-governed `lookaheadBudget`,
  `surface.frame.speculation.prepared`/`.invalidated`/`.promoted` — never surfaced until promoted, provably
  absent from `frames[]` when invalidated, replay-equivalent), and **Phase 4** (`ImagePlannerUnit` — a governed
  Image Agent owning image-as-cognition: decide/prompt/refine → prompt + caption + callout labels folded into
  the MCCR `image` element, rendered by the web `MccrElement`). `pnpm verify` green (25/25).

> **The Universal Cognitive Surface (S-UCS) became an immersive, observable, agent-driven environment** —
> the whiteboard is now the product; everything else is overlay, HUD, and launcher.

### Added — S-UCS: immersive Cognitive Surface redesign (presentation + observability plumbing)

- **The interface stopped being a dashboard and became one living cognitive environment.** The 3‑pane
  grid (timeline rail · stage · agents rail · footer) gave way to a **fullscreen Cognitive Stage** with
  everything else floating over it (F09 §4.1): a slim top bar with an **Agents** control + live status
  pills, a floating **Path launcher → center overlay** (concept graph + timeline/scene toggle), the
  **Agent Observatory** as an on-demand right-docked inspector, and a floating **transport HUD** that
  auto-hides on idle. Every prior capability is preserved — re-homed, not removed.
- **Agent reasoning and work became observable** (ADR-0029): model-backed units' `ReasoningTrace` is now
  published (`reasoning.completed`) and surfaced as `surface.agent.reasoning.summary` (task
  interpretation, strategy, decision, self-critique, confidence, determinism) + `surface.agent.work.timing`
  (real latency, upserted by `work_id`), folded into `SurfaceState` and rendered in the Observatory.
- **Narration became synchronized** (ADR-0007 client projection): the spoken sentence streams as living
  text with **word-level highlighting** driven by audio `currentTime`, in a teleprompter HUD.
- **Cognition now streams** (ADR-0028): the explanation reveals progressively via `surface.block.delta`
  events folded into a **transient buffer cleared by the whole block** — so `fold([delta…, generated]) ≡
  fold([generated])` and replay equivalence (SRF-005 §6.2) holds; deterministic/replay runs emit the whole
  block unchanged. Illustrations now render **inline beside the concept** (shared `concept_ids`), and the
  workflow chips became a compact, clickable **cognitive-pipeline** activity timeline.
- Spec-first throughout: **ADR-0028**, **ADR-0029**, **SRF-001/002/004/005 → schema 1.3.0**,
  cognitive-unit-ABI, **F09 §4.1**, event taxonomy. `pnpm verify` green across all packages + apps;
  the gateway replay-equivalence test passes with live streaming enabled.

> **Phase S1 (Cognitive Surface maturity) is complete** — the surface became a living cognitive environment.

### Added — Phase S1: Cognitive Surface maturity — static viewer → living environment

- **The Cognitive Surface now shows understanding *unfolding*, not a pre-determined playback.** A
  forward-looking review found the surface was a deterministic, single-agent-per-phase playback over a flat
  prerequisite spine. Phase S1 (roadmap `spec/implementation-roadmaps/cognitive-surface-maturity.md`) closed
  the gap in four increments, each a **composition over the existing substrate** — no new infrastructure, the
  `foldSurfaceEvents` fold stays pure, record→replay stays byte-identical (D3), governance preserved.
  - **The concept timeline became an interactive cognitive graph** (S1.1, **SRF-003**): `KnowledgeGraphEngine`
    gained typed edges (`depends_on`/`applies_to`/`research_adjacent`/`frontier_of`/`bridges_to`); the timeline
    projection now carries typed `edges[]`, per-node depth `layer` + mastery `confidence`, and a learner-
    selectable `entry_point` — still a pure projection of world-state.
  - **The learning loop became a visible multi-agent ensemble** (S1.2, **ADR-0025**): explanation + a genuine
    challenger/Socratic peer run concurrently, each publishing a proposal to the live `ProposalBlackboard`; an
    arbiter records a synthesis and surfaces disagreement; parallel agent presence is shown. The primary
    explanation stays authoritative, so determinism is unchanged. New `surface.proposal.*`/`synthesis.recorded`.
  - **The learner can now act on cognition** (S1.3, **ADR-0024**): a Surface Interaction Protocol adds
    `interrupt | jump | branch | challenge | request_depth | request_simplify | request_example` as governed,
    recorded, replayable `surface.interaction.*` events; interrupt is cooperative cancellation at fiber yield
    points; reshaping intents re-frame the active cognition through the same governed path.
  - **The experience layer makes it all visible** (S1.4, `apps/web`): an interactive `TimelineGraph`
    (depth-layered, typed edges, clickable jump/branch, entry-point selector, confidence rings + focus glow)
    replaced the flat spine; an `EnsemblePanel` surfaces live proposals + confidence + disagreement + synthesis;
    in-stream controls (interrupt / go-deeper / simpler / example / challenge) wire to the gateway.
  - Spec-first throughout: **ADR-0024**, **ADR-0025**, **SRF-002 → schema 1.2.0**, **SRF-003**, event taxonomy.
    `pnpm verify` green across all 24 packages + apps at every sub-phase boundary (codegen + typecheck + test +
    lint + format).

> **Phase S3 (Research mode + ensemble expansion) is complete** — research-readiness gating, ResearchUnit, motivation block, research/motivation renderers.

### Added — Phase S3: Research mode + ensemble expansion

- **The surface now detects when a learner has earned the right to explore the research frontier.** A
  confidence-gated readiness check (ADR-0026, S3.0–S3.1) fires post-mastery: depth gate passed + ≥ 0.75
  confidence triggers `surface.research.frontier.detected` (D3, before any agent dispatch); below threshold
  but mastery passed emits `surface.research.frontier.deferred`. The fold (`ResearchFrontierRecord`,
  `motivation_surfaced`) is a pure extension of `foldSurfaceEvents`; every event is replayable and the
  fold is unchanged.
- **`ResearchUnit`** (S3.2, F10): a model-backed `CognitiveUnit` (same ABI as `CurriculumUnit`) that maps
  the active research frontier, an open gap, a seed hypothesis, and a source note for a mastered concept.
  Deterministic offline fallback (D2); model path recorded for replay (D3). Wired as `researchDispatcher`
  in `apps/cli/src/wiring.ts`; emits `surface.research.frontier.surfaced` and contributes a `research` block
  with a `frontier_of` KG edge seeded into world-state.
- **Motivation pass** (S3.3): a motivation check fires when mastery passed but confidence is in `[0.6, 0.75)`.
  Emits `surface.motivation.surfaced` (D3 before any dispatch); optional `motivationDispatcher` contributes
  a `motivation` block to sustain learner momentum.
- **UI** (S3.4): `research` and `motivation` block renderers added to `apps/web/src/blocks.tsx` (frontier/
  gap/hypothesis/source-note structured rows; motivation message with confidence display). `frontier_of` and
  `research_adjacent` edges now render in the research accent colour (`--agent-research`) distinct from the
  generic dashed group. `"research"/"motivation"/"reflection"/"debate"` added to `ProductRuntimeAgentId` and
  the MVP agent catalog. `pnpm verify` green across all packages after every sub-phase.

> **Phase 7.1 (Platform SDK + MCP Manifestation) is complete** — §2 substrate-independence law proven.

### Added — Phase 7 (P7.1): Platform SDK + MCP manifestation — §2 law proven

- **The §2 substrate-independence law is now mechanically verified by a real second manifestation.**
  `@inevitable/sdk` (`packages/sdk`, SDK-001, ADR-0022) is a typed HTTP client for the COS Surface Gateway
  with **zero `@inevitable/*` workspace dependencies** — not even `@inevitable/protocols`. All SDK types
  (`CosSurface`, `CosLearner`, `CosCommand`, `CosStreamFrame`, `CosClientError`) are defined inline; `grep
  "@inevitable" packages/sdk/src` returns empty. `CosClient` covers the full gateway surface: `createSurface`,
  `ask`, `expand`, `close`, `getState`, `getLearner`; injectable `fetch` for hermetic unit tests (11 tests);
  trailing-slash stripping; `CosClientError` carries the HTTP status code. `apps/mcp` is a pure stdio MCP
  server whose only COS import is `@inevitable/sdk`: a minimal JSON-RPC 2.0 router (~70 lines, no
  `@modelcontextprotocol/sdk` external dep, ADR-0022 D3) handles `initialize`, `tools/list`, `tools/call`,
  and MCP notifications (no response for null/absent id); 4 MCP tools (`cos_create_surface`, `cos_ask`,
  `cos_expand`, `cos_get_state`) cover the cognitive surface API; configured via `COS_API_URL` env var
  (ADR-0022 D4). The §2 law verification is explicit in test-file comment headers in both packages (ADR-0022
  D5 — makes drift visible in code review). 8 new RPC router tests. `pnpm verify` green across all 24
  packages + apps (codegen + typecheck + test + lint + format).

> **Phase 6 (Governed Self-Evolution) is complete** — P6.1.

### Added — Phase 6 (P6.1): Governed Self-Evolution — proposal FSM + shadow tests + governance gate

- **The COS can now propose, test, and govern changes to its own pedagogy.** `EvolutionEngine`
  (`@inevitable/orchestration`, DPS-010, ADR-0021) implements the full governed evolution lifecycle:
  `propose()` mints an `EvolutionProposal` (status: `"proposed"`) and emits `evolution.proposal.created`;
  `evaluate()` runs a deterministic `ShadowEvaluator` against each injected `SyntheticLearnerSeed`
  projecting `simulatedPassRate`/`confidenceDelta`/`driftDetected` from the proposal configuration (no
  model calls — replay-safe per ADR-0021 D2), emitting `evolution.experiment.started` + one
  `evolution.shadow_result.recorded` per learner; `approve()` gates on the evaluation `recommendation`
  ("approve" if `overallPassRate ≥ 0.6`) AND an injected `guard` callback (the real governance engine
  at the composition root — keeping the engine free of a hard dep, consistent with the ADR-0017/ADR-0020
  injection pattern); `rollout()` emits `evolution.rollout.completed`; `rollback()` is a reversible,
  idempotent terminal operation from `"approved"` or `"rolled_out"` — data preserved for audit, emits
  `evolution.rollback.completed`. `evolution.rollback.completed` is now registered in the event taxonomy
  (additive, permanent, replayable; ADR-0021 D5). `DemoFixture` exposes `evolution: EvolutionEngine` plus
  five lifecycle helpers (`proposeEvolution`, `evaluateEvolution`, `approveEvolution`, `rolloutEvolution`,
  `rollbackEvolution`) with three default synthetic learner profiles (beginner/intermediate/advanced) and the
  real governance guard wired. 26 new tests cover the full FSM, shadow evaluation accuracy, governance block,
  and idempotency.

> **Phase 5 (Digital Twin) is complete** — P5.1.

### Added — Phase 5 (P5.1): Digital Twin lifecycle — consent-scoped cognitive artifact

- **Learners now have a named, governed cognitive twin.** `TwinRegistry` (`@inevitable/product-cognition`,
  DPS-009, ADR-0020) implements the full digital twin lifecycle: `create()` mints a `TwinState` from the
  caller-supplied `TwinSnapshot` (extracted via `buildTwinSnapshot` from the learner's cross-surface
  cognition profile, DPS-004); `branch(twinId, displayName)` forks an independent cognitive lineage
  inheriting the parent's consent and current snapshot; `export(twinId)` marks a portable artifact was
  created (idempotent); `terminate(twinId)` irrevocably deactivates the twin with data preserved for audit
  (idempotent). Every lifecycle transition emits a `twin.*` event (`twin.created`, `twin.branched`,
  `twin.exported`, `twin.terminated`) via an injected `publish` callback — the established injection
  pattern from P3.3 (ADR-0017), keeping the registry free of a direct `@inevitable/events` dependency.
  The **`twin.*` event family** is now registered in the event taxonomy (1y-archive, replayable).
  `DemoFixture` exposes `twins: TwinRegistry` plus four lifecycle helpers. The twin consent model records
  `allowedSurfaces`/`allowedAgents`/`expiresAt` at creation; enforcement at query time follows in P5.2.

> **Phase 4 (Multi-Agent Cognition) is complete** — P4.1 through P4.2.

### Added — Phase 4 (P4.2): Governed Tool Runtime — `tool.*` events, capability-gated invocation

- **Agents can now invoke governed tools.** `InMemoryToolRuntime` (`@inevitable/adapters`, ADR-0019)
  implements the `ToolRuntime` contract: tools registered at composition time; `discover()` lists them;
  `invoke(name, params)` checks `tool.<name>` capability via an injected `checkCapability` callback (no hard
  dep on `@inevitable/kernel`, consistent with the injection pattern from P3.3). When an `EventBus` is
  provided, `tool.invoked` and `tool.completed` events are emitted for full observability. The **`tool.*`
  event family** is now registered in the event taxonomy (90d retention, replayable). `apps/cli` registers a
  `search-concepts` demo tool (keyword search over world-state concept nodes), pre-grants `tool.search-concepts`
  to the learner, and exposes `DemoFixture.tools`.

### Added — Phase 4 (P4.1): Proposal Blackboard + `surface.agent.disagreed` — multi-agent cognition

- **Multiple agents now visibly contend.** `ProposalBlackboard` (`@inevitable/orchestration`, DPS-008,
  ADR-0018) wraps `InMemoryBlackboard` with a typed proposal lifecycle: `propose/proposals/arbitrate/arbitrations`
  — append-only and audit-friendly. `FiberedLearningLoop.handleDispatch` runs the explanation and a challenger
  (`agent.revision`) concurrently via `Promise.all` when `challengerDispatcher` is present; both proposals land
  on the blackboard. **Disagreement detection** uses Jaccard similarity on `layer_0` text: word overlap < 30%
  emits `surface.agent.disagreed` (ADR-0018). The **surface fold** now accumulates `disagreements:
  DisagreementRecord[]` — every multi-agent conflict is permanently visible in the surface state and participates
  in replay. `surfaceId` is threaded through `FiberedLearningLoopInput` from `SurfaceSession.ask()` so
  disagreement events carry `surface_id` for fold routing. `DemoFixture.proposals` exposes the board.

> **Phase 3 (the ULI core) is complete** — P3.1 through P3.3.

### Added — Phase 3 (P3.3): Cognitive Observability Analysis — the reasoning-quality invariant met

- **The system now measures its own reasoning quality.** `CognitiveAnalysisEngine`
  (`@inevitable/observability`, DPS-007, ADR-0017) subscribes to `mastery.checkpoint.created` and
  `learning.loop.completed` events and produces three analysis signals: **drift detection** (sliding-window
  confidence drop > 0.15 from baseline emits `observability.drift.detected`), **confidence calibration**
  (five equal-width bins track whether model-reported confidence matches actual pass rates; divergence > 0.25
  emits `observability.confidence.calibration_warning`), and **learning-outcome aggregation** (per-concept
  attempts/pass-rate/mean-confidence emitted as `observability.learning_outcome.summary`). Three new metrics:
  `cos.drift.estimate`, `cos.confidence.calibration_error`, `cos.learning.outcome_rate`. The `publish`
  callback is injected at the composition root — the engine has no bus dependency (testable in isolation,
  safe in metrics-only mode). Satisfies the §25.4 architectural invariant (*observability tracks reasoning
  quality, drift, confidence, and learning outcomes*) and provides P6 (self-evolution) with its signal inputs.

### Added — Phase 3 (P3.2): F04 Layers 2–6 + Adaptive Prompt Assembly

- **Explanation depth is now universal — layers 0 through 6.** `ModelBackedUnit` output schema extended to
  the full seven-layer F04 model (0: Intuition, 1: Visual, 2: Conceptual, 3: Mathematical, 4: Applied,
  5: Advanced, 6: Research). **Depth is adaptive:** target layer = `max(requestedLayer, concept.naturalLayer)`
  — the KG's concept layer annotation (P3.1) drives how deep an explanation goes automatically. **Assembled
  context is now consumed in prompts** (closing the deferred P2.4 boundary): items from `assembleContext()`
  thread via `SurfaceAskInput.assembledContextItems` → `FiberedLearningLoopInput` → `dispatch.content` →
  `buildRequest` as "Prior learner knowledge" in the system prompt. Token budget scales with depth:
  `max(1024, 512 × (targetLayer + 1))`. Practice and assessment remain at layer 0 (ADR-0016).

### Added — Phase 3 (P3.1): Knowledge-Graph Engine — world-state shaped for the ULI

- **World-state is now a queryable knowledge graph.** `KnowledgeGraphEngine` (`@inevitable/world-state`,
  DPS-006, ADR-0015) wraps `WorldStateGraph` as a domain query layer — no separate store. Concept nodes
  carry a `layer` (0–6: ConceptLayer) and a `domain`. Prerequisite edges (`prerequisite_of`) are DAG-enforced
  by the existing graph acyclicity; bridge edges (`bridges_to`) are informational. Core API: `seedConcepts`
  (idempotent upsert), `decompose(goalConceptId)` (topological sort to a zero-knowledge start),
  `learnerState(userId)` (mastery + phase tracking from world-state), `nextConcept(userId, goal?)` (first
  unmastered in topo order), `addBridge(from, to)` (cross-domain bridges). `DemoFixture.kg` pre-seeded with
  a 4-concept ML graph that drives adaptive depth in the explanation unit.

> **Phase 2 (Identity, Continuity & Context) is complete** — P2.1 through P2.6.

### Added — Phase 2 (P2.6): Capability Registry — the governance immune system

- **Capabilities can now be granted and revoked dynamically at runtime.** A fine-grained
  `CapabilityRegistry` (`@inevitable/kernel`) tracks individual named capabilities per subject
  (grant/revoke/has/granted/list, revoked grants retained for audit) — complementing the coarse,
  all-or-nothing capability *envelope*. Authored **spec/kernel/capability-registry.md** + **ADR-0014**.
- **Governance consults it on every dispatch (GOV-P03), opt-in by presence.** A new policy blocks a
  dispatch whose required capability (`dispatch.<agentId>`) is revoked/absent — but only when the request
  carries a `capabilities` context, so paths with no registry wired are unaffected. `buildDemoSession`
  grants the learner the dispatch capabilities and threads the registry through every dispatcher; revoking
  one immediately blocks that agent's next dispatch (the cycle degrades gracefully). In-memory for now
  (durable grants deferred).

### Added — Phase 2 (P2.5): Intent Inference — goal → a real intent lease

- **The intent lease now reflects the learner's actual goal.** A governed, model-backed
  `IntentInferenceUnit` (`agent.intent`, deterministic fallback) interprets the goal into
  `{interpreted_goal, scope, constraints, confidence}` and re-interprets the session intent lease **in
  place** (stable `intent_id` = surface `session_id`), emitting `intent.received` → `intent.interpreted`.
  This replaces the hardcoded, goal-independent placeholder, satisfying the architecture law in substance.
  Authored **spec/kernel/intent-inference.md** + **ADR-0013**. The gateway calls `inferIntent` best-effort
  (never altering the untrusted-degradation path). Boundary: interprets + binds the lease; driving
  curriculum/retrieval from the interpreted goal/scope is a follow-up.

### Added — Phase 2 (P2.4): Context-Lease-Bounded Retrieval — durable knowledge made retrievable

- **A learner's durable knowledge is now retrieved on demand, bounded by their context lease.** New
  package `@inevitable/context`: a `ContextAssembler` does VectorStore-backed semantic retrieval over the
  learner's durable memory and assembles a bounded `WorkingMemoryContext` under the session `ContextLease`
  — fail-closed bounds (tier, user, token budget, expiry; exclusions counted). A deterministic local
  embedding keeps retrieval offline and replay-safe. Authored **DPS-005** (`spec/persistence/`) +
  **ADR-0012**. `buildDemoSession.assembleContext(query)` indexes the durable tiers, assembles, and writes
  admitted items into the `working` tier (distributed; session scratch); the gateway calls it each ask.
  Boundary: retrieves/bounds/assembles — *consuming* it in agent prompts is P3 (adaptive prompting).

### Added — Phase 2 (P2.3): Shared Per-Learner Cognitive Memory — continuity of *cognition*

- **A returning learner's new surface now draws on prior mastery.** Until now each surface was
  cognitively blank even for a known learner — the supervisor re-taught already-mastered concepts. A
  per-learner **cognition profile** (the learner's mastery subgraph + durable-tier memory) is now
  captured across surfaces and **seeded** into a new surface at create, so the supervisor routes an
  already-mastered concept to `complete` on the very first ask. Authored **DPS-004 — Shared Per-Learner
  Cognitive Memory** (`spec/persistence/`) and **ADR-0011**. This is the moment "persistent cognitive
  memory of each learner" becomes literally true *across* sessions, and the substrate on-ramp to the
  Digital Twin (P5).
- **The cut follows the tier semantics.** Only durable knowledge carries — mastery checkpoints (scoped
  by `ownerUserId`), the concepts they verify, and `semantic`/`procedural`/`reflective` memory. Session
  scratch (`working`/`episodic`) and per-surface block/timeline state never leak across surfaces.
- **Capture-then-seed, around the canonical record, never in it.** After each `ask` the learner-durable
  subset is extracted and merged (idempotent, id-keyed) into the profile held in the `LearnerRegistry`
  (in memory always; on disk at `<dir>/learners/<id>.cognition.json`). Seeding runs before `start()` and
  emits no `surface.*` event — silent state reconstruction, the same discipline as DPS-002
  `hydrate`/`restore`; seed and `restore` are mutually exclusive (create seeds, resume restores).
- **Proven in memory and across a restart.** Cross-surface carry works within one process and across a
  simulated restart (profile loaded from disk); a brand-new learner still starts blank. `pnpm verify`
  stays green fully offline; shared cognition rides on the opt-in `COS_PERSIST_DIR` for durability.

### Added — Phase 2 (P2.2): Durable Learner Identity — continuity of *who*

- **Learners are now first-class and durable.** The hardcoded single demo learner (every user shared
  one identity, surfaces belonged to no one) is replaced by a durable `LearnerRegistry`: a learner is
  `{ learnerId, cid, trustLevel, surfaces[] }`, minted once and resolved on return. A known `learnerId`
  reuses the **same** identity (cid + trust) across a process restart; an unknown id is never claimed
  (no spoofing). Authored **DPS-003 — Durable Learner Identity & Resume-by-Learner** + **ADR-0010**.
- **The real learner is threaded through the governed substrate.** `onboarding()` is now
  learner-parameterized (ids derived from the learner, not hardcoded); the surface's world-state learner
  node and the dispatch governance gate use the learner's own `cid`/`trust_level`. The demo learner
  remains the default for the CLI and tests.
- **Resume-by-learner.** New `GET /api/learner/:learnerId` returns the learner profile + the surfaces
  they own; `POST /api/surface` accepts a `learnerId` and returns the owning `learner_id`. Rehydration
  loads the learner so a resumed surface keeps the correct identity and trust.
- **Fixed a latent id-collision bug.** Gateway-hosted surfaces now use a `CryptoIdGenerator` — the
  seeded generator is seed-independent, so the previous "unique seed per surface" intent actually minted
  identical surface ids; concurrently-hosted surfaces would have collided.

### Added — Phase 2 (P2.1): Cognitive Continuity — a restored surface comes back alive

- **A surface now survives a restart *and keeps going*.** DPS-001 could reconstruct a surface read-side;
  this closes the deferred gap so a restored surface is **live** — a new `ask`/`expand` is accepted and
  appends fresh cognition exactly where the learner left off. Authored **DPS-002 — Cognitive Continuity
  & Rehydration** (`spec/persistence/`) and **ADR-0009**.
- **Three substrates restored from their own durable artifacts.** Added `EventBus.hydrate()` (load a
  durable event log into a fresh bus *without* re-delivery, validation, or governance — they were
  applied at first publish), `SurfaceSession.resume(surfaceId)` (adopt the persisted id without
  re-emitting `surface.created`), and a `buildDemoSession` restore path that injects a restored
  world-state snapshot + replayed memory mutations + the hydrated event log. World-state and memory are
  each event-sourced on their own logs (not the bus), so their snapshots are persisted alongside it.
- **Resumed sessions use a `CryptoIdGenerator`.** Replay determinism is already guaranteed by the
  recorded events; the resumed session only needs globally-unique ids for *new* cognition, so random
  UUIDs are used — no fragile id-counter state to persist, no collisions with recorded ids.
- **The gateway upgrades a restored surface to live.** With `COS_PERSIST_DIR` set it persists
  `world.json` + `memory.json` after each command and, on a cold-miss, rehydrates a live session
  (restore + hydrate + `resume`), falling back to DPS-001 read-side reconstruction only when the
  snapshots are absent or corrupt. Proven: a new ask after a simulated restart appends fresh cognition
  with prior state intact and no id collisions.

### Added — Phase 2E: Durable Substrate — the floor under event sourcing

- **The substrate now has a persistent existence independent of any process.** Following a
  Chief-Architect gap analysis, the highest-leverage gap was that all state — event log, world-state,
  memory, media — was in-memory, so a restart was total data loss and the COS's own invariants (event
  sourcing, replay, persistent learner memory) held only within one process lifetime. Authored
  **DPS-001 — Durable Cognitive Persistence** (`spec/persistence/`) and **ADR-0008**: the event log is
  the unit of durability (world-state/memory are replay projections of it); out-of-band media is
  persisted separately; durability is a sink, never part of the canonical record.
- **A pure-`node:fs` durable backend behind the existing contracts.** Added `FileEventTransport`
  (append-only JSONL, per-subject sequence, ordered replay) to `@inevitable/adapters` — zero native or
  third-party dependencies, fully offline and Windows-safe, validated by the *same* `EventTransport`
  conformance harness as the in-memory reference. Added a `FileMediaStore` for out-of-band audio.
  In-memory stays the reference semantics and the default; Postgres/NATS remain swappable later behind
  the same contracts.
- **Cross-process surface recovery.** When `COS_PERSIST_DIR` is set, the Surface Gateway mirrors every
  surface event to a per-surface durable log and narration audio to disk, and reconstructs a surface
  **read-side** after a restart (the server now talks to a `ServedSurface` seam, so live and restored
  surfaces are interchangeable). Proven: a fresh gateway over the same directory folds the durable log
  to a **byte-identical** `SurfaceState`, and out-of-band audio still resolves. Live write-continuity
  after restart (world-state rehydration) is deferred to the next phase (Identity, Continuity & Context).

### Added — Phase 2D: The Cognitive Stage — synchronized, narrated, visible cognition

- **The surface became a theater of thought, not a dashboard.** Following a deep product-experience
  review (a live study of OpenMAIC + the Cognitive Surface research corpus), `apps/web` was rebuilt
  as the **Cognitive Stage**: one central stage spotlights the concept being understood; a
  living-timeline spine lights up in sync; an agent-presence ensemble shows each cognitive unit as a
  character (geometric sigils, not cartoons); provenance ("why this appeared") is one tap away; and a
  narration track with transport sits below. A premium, restrained "cognitive instrument" design
  language (deep observatory palette, editorial serif, light-models-attention, motion only to direct
  attention) replaces the generic 3-column layout.
- **Cognition is now synchronized and attention-directed.** Added a choreography sub-family to
  `surface.*` (schema 1.1.0): `surface.narration.segment`, `surface.focus.changed`,
  `surface.presence.updated`, folded into a new choreography slice (`narration`/`focus`/`presence`).
  A runtime `SurfaceChoreographer` narrates the generated explanation segment-by-segment with focus
  + presence, and **re-narrates on interactive `expand()`**. A client `useChoreographer` paces the
  unfolding (a pure projection that owns no truth).
- **The classroom is live and interactive, never a frozen lesson.** Codified as a core principle
  (SRF-001 §2; F16 non-goal): explanations are **generated dynamically on demand** (model-backed,
  Gemini), the learner can interject at any moment, and the surface re-explains. *Generation* is
  live and adaptive; *replay* stays byte-exact (recorded outputs) — the explicit contrast with
  OpenMAIC's pre-generated deck.
- **The surface speaks.** Added Gemini voice (`GeminiVoiceRuntime` + deterministic `NullVoiceRuntime`
  in `@inevitable/adapters`): narration audio is served **out-of-band** via a new gateway media route
  (`GET /api/surface/:id/media/:artifactId`); events carry only a reference + duration, bytes never
  touch the stream. Authored **ADR-0007 — Surface Choreography & Timing** (logical cues + client
  playback clock; audio duration as ground truth; binaries out-of-band; recorded for replay) and
  updated SRF-001/002/004/005, F09/F16.

### Added — Phase 2D (in progress): Curriculum Generation & Live Gemini

- **Any goal now yields its own living timeline.** Added `CurriculumUnit`
  (`@inevitable/product-cognition`) — the F02/F03 curriculum agent that turns a learner goal into a
  prerequisite-ordered concept DAG, dispatched through the **same governed path** as every unit
  (privileged agent, GOV-P01 trust ≥ 3; governance gate, scheduler, OTel span, D3 recording all
  apply). Model-backed with an inline deterministic scaffold fallback, so offline/seeded runs still
  produce a real, deterministic timeline. The Surface Gateway generates a curriculum per goal
  instead of the seeded Neural-Networks DAG. Spec: PCR §12.
- **Real Gemini cognition wired end-to-end.** `.env` loading (a zero-dependency loader in
  `apps/api` and `apps/cli`; `GEMINI_API_KEY`), `@google/genai` provisioned at the workspace root
  (edge-provisioned per ADR-0005, guarded dynamic import — never a substrate dependency). With a key
  present, explanations/practice and generated curricula are real `gemini-2.5-flash` cognition
  recorded as `model.*` events (D3); without it, the deterministic NullModelRuntime runs the
  identical governed path.

### Added — Phase 2C: The Visible Surface

- The Cognitive Surface is now **visible and live in a browser** — the first moment a human can
  open The Inevitable and watch it think. The runtime stays the product; the UI is a projection.
- Authored **SRF-005 — Surface Streaming & Sync Protocol** (`spec/surface/surface-streaming-sync-protocol.md`)
  and **ADR-0006 — Surface Gateway Transport**: events stream down via SSE (frame `id` = bus
  sequence, `Last-Event-ID` resume), typed commands flow up via HTTP POST through the governed
  dispatch path; the client folds the stream with the *same* `foldSurfaceEvents` the runtime uses,
  so replay equivalence (client fold ≡ server state) is a contract, never client-owned truth.
  Codified three principles: the surface is a runtime not a UI, rendering is provider-agnostic,
  and a cognitive environment is entered (not a prompt→response exchange). Registered a `gateway.*`
  boundary-observability event family (recorded-observation, never folded into canonical state).
- Added `@inevitable/api` — a zero-dependency `node:http` **Surface Gateway** that hosts persistent
  surface sessions, streams `surface.*` over SSE, and routes a typed command envelope
  (`ask | expand | close`, extensible) through governance. In-process tests prove fold≡state,
  sequence ordering, resume, the governed boundary, and command extensibility.
- Added `@inevitable/web` — a **Vite + React** viewport that folds the live stream
  (`@inevitable/surface/client`, a new browser-safe export) and renders it as regions (living
  timeline · cognition stream · provenance inspector) via a **block-renderer registry keyed by
  `block_type`** — provider-agnostic, with multimodal types rendering typed placeholders so future
  media is additive, not a rewrite. `pnpm dev:gateway` + `pnpm dev:web`.

### Added — Phase 2B: Real Cognition on the Surface

- Authored the **Model Invocation Protocol** (`spec/protocols/model-invocation-protocol.md`):
  the only sanctioned way a cognitive unit invokes a generative model — record-before-use,
  replay-never-invokes, fail-closed on a replay miss. Registered the `model.*` event family
  (permanent, replayable) and realized determinism level **D3** from the replay spec.
- Added model runtime adapters in `@inevitable/adapters`: deterministic `NullModelRuntime`,
  `GeminiModelRuntime` (first real provider, guarded dynamic import of the Gemini SDK — never a
  workspace dependency), and `RecordingModelRuntime` (the D3 recording seam with record/replay
  modes).
- Added `ModelBackedUnit` to `@inevitable/product-cognition`: real model-generated
  explanation/practice/assessment cognition through the **same** governed dispatch path
  (governance gate, scheduler admission, OTel span), with layered output (F04 layers 0–1),
  populated reasoning traces, and visible deterministic fallback on model failure.
- Added progressive deepening to `@inevitable/surface`: `SurfaceSession.expand(blockId, layer)`
  re-dispatches through the governed explanation dispatcher and emits
  `surface.explanation.expanded` — the typed modification the fold merges into the block.
- Added `apps/cli` + `pnpm demo` — the first runnable manifestation: a living Cognitive Surface
  in the terminal (timeline, blocks, supervisor decisions, expansion, trace) over Gemini when
  `GEMINI_API_KEY` is set, or the deterministic null model otherwise.
- D3 acceptance proven in tests: a seeded record run replayed from its `model.output.recorded`
  events reproduces a byte-identical surface frame without ever re-invoking the provider.

### Added — Phase 2A: Cognitive Surface Runtime

- Authored the Phase 2A surface spec suite under `spec/surface/`:
  `cognitive-surface-runtime.md` (SRF-001 — cognition blocks, surface state as a deterministic
  fold over the `surface.*` event log, session/projection/renderer separation),
  `surface-event-architecture.md` (SRF-002 — the 16-subtype `surface.*` event family, permanent
  retention, replayable), `surface-timeline-engine.md` (SRF-003 — timeline as a pure projection of
  world-state concept DAG + mastery checkpoints), and `multimodal-provider-abstraction.md`
  (SRF-004 — image/video/voice/live/multimodal provider adapters with a deterministic
  NullProvider; no vendor SDKs).
- Added `@inevitable/surface`, the first product manifestation package: typed `CognitionBlock`
  creation with mandatory provenance, `SurfaceTimelineBuilder` (wraps `LearningPathProjector`;
  Kahn-ordered, mastery-aware status derivation), `foldSurfaceEvents` pure event-fold projection,
  `AgentContributionRuntime` (agent.joined / block.generated / agent.contributed),
  `traceBlock` provenance resolver (block → events → packet → agent → world-state → memory),
  `TextSurfaceRenderer`, `ProviderRegistry` + `NullMultimodalProvider`, and `SurfaceSession`
  composing `FiberedLearningLoop` end-to-end ("Teach me Neural Networks" acceptance flow).
- Registered the `surface.*` family in `spec/events/event-taxonomy.md` and the retrieval indexes
  (`spec/indexes/event-index.md`, `spec/indexes/dependency-graph.md`).

### Added — Phase 1E: Governance Dispatch Gate & Confidence Routing

- Wired `@inevitable/governance` into `ProductRuntimeDispatcher`: GOV-P01 trust gate and GOV-P02
  classification gate evaluate every product dispatch before scheduler admission; denials emit
  governed decision records instead of executing.
- Added confidence-weighted supervisor routing: a passing mastery checkpoint below the
  `MASTERY_CONFIDENCE_THRESHOLD` (0.6) routes to revision instead of complete.

### Added — Cognitive Surface: Deep Research & F16 Feature Spec

- Authored **F16 — The Cognitive Surface — Universal Multimodal Substrate**
  (`spec/product/features/F16-cognitive-surface.md`), a cross-cutting feature spec defining the
  convergent multimodal substrate from which the whiteboard, living document, presentation,
  Canva/Word-class authoring canvas, notebook, knowledge-graph explorer, simulation stage, and
  (long-horizon) IDE co-editor are all *projected*. Core decision: a single typed **Cognition Block**
  primitive rendered three ways (scene-graph / block-document / dataflow-DAG), synced as a
  per-property CRDT, and journaled as events so the surface is a deterministically-replayable,
  governed projection of the world-state graph. Agents render via *typed mutations*, never opaque HTML.
- Added the deep-research dossier `spec/research/cognitive-surface-frontier-research.md` (31 sources;
  primary-source-graded findings across cognitive science, tools-for-thought lineage, substrate
  teardowns, the collaboration-vs-replay tension, rendering, AI-native UI, and immersive horizons)
  and its reusable commission `spec/research/cognitive-surface-deep-research-prompt.md`.
- Propagated F16 across the spec system: master PRD §7/§11/§15/§20 and frontmatter, `CLAUDE.md` and
  `CODEX.md` feature catalogs, `spec/product/README.md`, `spec/product/features/README.md`, and the
  retrieval index `spec/indexes/product-feature-index.md`; cross-linked F09 ↔ F16 (experience ↔ substrate).

### Added — Product Topology Setup

- Completed the product feature-spec suite under `spec/product/features/` (F01-F15), covering the
  first product-cognition slice, agent ecosystem, orchestration, interdisciplinary graph, immersive
  surface, research/innovation, institutional intelligence, governed evolution, identity/modes,
  mastery/depth verification, and content ingestion.
- Normalized the canonical master-vision reference to
  `spec/vision-application/The_Inevitable_Master_Vision.md`; retained
  `Ambition-deep-committments.md` as a compatibility pointer for older links.
- Updated Phase 1D/Phase 1E continuity docs so future work starts from product-cognition
  implementation rather than re-authoring the feature catalog.

### Added — Phase 1E: Product Cognition Runtime

- Added `@inevitable/product-cognition`, the first bridge package from product features to the
  completed Cognitive OS substrate.
- Added F01/F13 onboarding/session initialization over kernel identity, capability envelopes,
  context leases, intent leases, world-state, semantic memory, and onboarding events.
- Added F02/F03 deterministic learning-path projection into `@inevitable/world-state`, preserving
  prerequisite DAG acyclicity through the graph package.
- Added F06 minimal agent manifest catalog validated by the existing runtime manifest loader.
- Added runtime-hosted product dispatch: product intents now become `CognitionPacket` +
  `CognitiveWorkItem` pairs, pass through `DepthScheduler`, and execute a deterministic MVP unit via
  `CognitiveUnitHost`.
- Added `DeterministicLearningLoop`, composing graph-backed path projection, explanation dispatch,
  practice dispatch, and mastery checkpoint recording into the first no-LLM learning loop.
- Added F14 mastery checkpoint recorder that emits graph state, semantic memory mutations, and
  `mastery.*` events.

### Added — Phase 1D: Substrate Deepening

- `@inevitable/execution`: deterministic execution engine, cooperative cognitive fibers, closed
  effect set, append-only execution journal, and replay-oriented lineage safety.
- `@inevitable/world-state`: typed world-state deltas, materialized graph view, path/neighbor/type
  queries, DAG edge enforcement, snapshots, and subscriptions.
- `@inevitable/memory`: expanded tiered memory store with per-tier mutation logs, projections,
  reinforcement/decay mutations, redaction, and subscription fanout.
- `@inevitable/scheduler`: depth scheduler with preemption, weighted fairness, budgets, and
  observable backpressure/load-shedding.
- `@inevitable/adapters`: in-memory reference adapters, backend-agnostic conformance harness, and
  dependency-optional NATS/Qdrant/Neo4j/Postgres adapter boundaries.
- `@inevitable/data-plane`: dependency-optional OTel bootstrap and bus-to-observability sink bridge.

### Added — Phase 1C: Foundational Infrastructure

- Monorepo foundation: pnpm workspaces + Turborepo, strict TypeScript (ESM), Vitest, ESLint 9,
  Prettier, Husky + commitlint, GitHub Actions CI (ADR-0004).
- `@inevitable/shared`: branded identifiers, `Result`, hybrid logical clock, injectable `Clock`,
  typed error hierarchy, spec-traceability helpers.
- `@inevitable/protocols`: canonical JSON Schemas (Draft 2020-12) extracted from the Phase 1B specs,
  schema registry, ajv validators, generated TypeScript types, and a conformance/contract test harness.
- `@inevitable/observability`: OpenTelemetry-aligned cognitive trace envelope, correlation/cognition
  trace IDs, structured logger.
- `@inevitable/events`: event envelope + family registry, replay-safe in-memory bus with dead-letter
  handling, governance interceptor hook.
- `@inevitable/kernel`: identity, capability envelope, context/intent lease services with in-memory
  registries and governance hooks.
- `@inevitable/governance`: policy interface, decision records, priority-ordered evaluation engine,
  enforcement middleware, default policies.
- `@inevitable/runtime`: cognitive-unit ABI interface, 13-state lifecycle FSM, manifest loader.
- Interface scaffolds: `@inevitable/scheduler`, `@inevitable/memory`, `@inevitable/orchestration`,
  `@inevitable/contracts`, `@inevitable/tooling`.

### Added — Phase 1B: Kernel, Protocols, Events & Runtime Specs

- Foundational specs for kernel primitives, kernel-internals syscalls, core protocols, event
  taxonomy, and the cognitive-unit runtime; ADR-0003 (tech stack). See
  `spec/implementation-roadmaps/phase-1b-kernel-protocols-runtime.md`.
