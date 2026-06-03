# Deep-Research Commission — The Cognitive Surface

> **Artifact type:** reusable deep-research prompt for autonomous research harnesses
> (Codex, Claude Code, and any deep-research/web-enabled agent).
> **Target system:** the multimodal "whiteboard" of *The Inevitable* — internally **the Cognitive Surface**.
> **Owning spec:** [`spec/product/features/F09-living-universe-experience.md`](../product/features/F09-living-universe-experience.md).
> **How to use:** paste everything below the line into the research agent. It is self-contained — the
> grounding summary in §1 means the agent can produce decision-grade output even without repo access,
> but it should read the listed files first if it can.

---

## ROLE

You are a **frontier research analyst and systems architect**. You are not writing an essay and not
brainstorming features. You are producing a **decision-grade research dossier** that a founding team
will use to architect and build the single most important surface of a Cognitive Operating System.
Every section of your output must move someone closer to a *build decision*: a named technology, a
falsifiable claim with a citation, a tradeoff resolved, an invariant honored, a phase scoped.

Ambition and rigor are not in tension here. The vision is civilizational; the output must be buildable.
Hold both. A beautiful idea that violates the system's invariants (§3) is a defect, not a contribution.

---

## 1. WHAT YOU ARE RESEARCHING FOR — GROUND TRUTH (read this carefully)

**The Inevitable** is a *Cognitive Operating System for human learning, understanding, creation, and
intellectual evolution* — not an app, LMS, tutoring bot, or course marketplace. It takes any human from
any starting point and constructs the architecture of understanding beneath them until mastery is
inevitable, then carries them from mastery to original contribution
(`IGNORANCE → UNDERSTANDING → MASTERY → INNOVATION → ORIGINAL CONTRIBUTION`).

Inside it lives the surface you are researching. Today it is called **the Cognitive Whiteboard**; its
true identity is **the Cognitive Surface** — the place where *all* cognition becomes visible and
manipulable: many media rendering and reacting simultaneously, explanation layered over explanation, in
real time. It is the product's single most important surface, and it is **greenfield** — the
implementation package (`@inevitable/product-cognition`) is deliberately not yet a UI.

**Read first (if you have repo access), in this order:**
1. `spec/product/Broader-feature-product.md` — the master product spec (thesis, 12 capability pillars,
   the Product→Architecture mapping in §14, the multimodal/immersive section §11–11.1).
2. `spec/product/features/F09-living-universe-experience.md` — **the owning spec for this surface.**
3. `spec/product/features/F04-adaptive-multimodal-explanation.md` — modality selection, Dynamic System
   Prompting (DSP), dual coding, the seven layers of understanding.
4. `spec/product/features/F07-realtime-cognitive-orchestration.md` — how agents surface contributions
   onto the surface in real time (bus + blackboard, no hidden direct calls).
5. `spec/product/features/F15-content-ingestion-knowledge-substrate.md` — how PDFs/docs/audio/web/
   whiteboard artifacts become first-class graph objects (the *select-to-expand* pattern).
6. `spec/product/product-cognition-runtime.md` — the Phase-1E implementation bridge.
7. `spec/product/README.md` — domain entry point.

**Distilled constraints you must internalize even without the files:**

- **The surface is a *projection*, not a canvas.** It renders the **World-State Graph** (knowledge
  graph + learner model + mastery state). It must never become a hidden data store. UI state that
  affects cognition is derived from, and writes back through, the substrate — not the other way around.
- **Everything cognition-affecting is event-sourced and replayable.** Surface actions emit typed
  **Cognitive Events** (`surface.rendered`, `surface.reshaped`, `whiteboard.updated`,
  `whiteboard.artifact.created/linked`, `modality.selected/swapped`, `simulation.started/completed`,
  `artifact.created/annotated/consolidated`, `voice.turn.transcribed`, …). 100% of cognition-affecting
  UI actions must be reconstructable from events.
- **Persistence is governed.** Whiteboard objects, document spans, simulation states, transcripts, and
  generated notes become durable only through a typed **Memory Mutation** — never a direct write.
- **Choices are explained.** Every modality/representation choice emits a **Reasoning Trace** ("why a
  simulation here and not text").
- **Inputs are capability-gated.** Voice, camera, sensor, AR/VR, and ambient inputs require explicit,
  granular, revocable **consent** and a **capability envelope**. Minors/institutions default to minimum.
- **Accessibility parity is a hard rule.** Every immersive/multimodal affordance must have a
  non-immersive equivalent, and the system must degrade gracefully on low-bandwidth / low-power /
  offline / rural-network conditions (the Universal Accessibility Guarantee).
- **Pedagogy is the point.** Immersion serves understanding, never attention capture or dopamine loops.
  "Acceleration by omission" is a governance violation.
- **Cognitive spine the surface must serve:** ULI's seven layers (0 Intuition/Story · 1 Visual/Spatial
  · 2 Conceptual · 3 Mathematical/Logical · 4 Applied · 5 Advanced/Connective · 6 Research/Generative);
  dual coding (≥2 representations for hard concepts); DSP (instructions rewritten live per learner);
  a ~30-agent ecosystem that observes the event stream and surfaces contributions concurrently.

These are not bureaucracy. They are the difference between "another whiteboard" and "a surface where a
provably-correct, replayable, governed cognitive process becomes visible." **Treat them as the hardest
and most interesting research constraints, not as boxes to tick.** Where the frontier vision strains an
invariant, say so explicitly and propose how to honor the invariant *through* the design, or flag it as
an open architectural question with options.

---

## 2. THE CENTRAL QUESTION (falsifiable, with sub-questions)

> **Can the fragmented universe of human knowledge-work surfaces — documents, PDFs, slides, IDEs,
> notebooks, design canvases, spreadsheets, browsers, simulators, dashboards, chat — collapse into ONE
> adaptive, multimodal, agent-orchestrated cognitive surface that is a live projection of a cognitive
> substrate; and if so, what is the minimal primitive set from which all of those manifestations can be
> projected?**

Investigate, and take a *defended position* on, each:

1. **Convergence vs. fragmentation.** Is "the application" an outdated unit of software, or is
   fragmentation load-bearing (specialization, focus, performance)? What converges, what must stay
   separate, and *why* — judged by human-cognition evidence, not aesthetics.
2. **The substrate primitive.** What is the smallest, most general representational primitive from which
   text, diagrams, media, simulations, documents, slides, code, and graphs can ALL be projected? Candidate
   framings to evaluate: a **block/cell model** (Notion/Jupyter/Observable lineage), a **scene graph**
   (Figma/game-engine lineage), a **CRDT document model** (collaborative-editing lineage), an
   **entity-component model**, a **node/port dataflow graph**, or a hybrid. Recommend one with reasons.
3. **Render-anything.** What rendering/runtime architecture lets a single surface render and *react* to
   text, vector illustration, raster media, audio + spatial audio, video, animation, math, data viz,
   live simulations, and embedded executable environments **simultaneously and composably** — with a
   defensible performance budget on commodity hardware and an extensible "block-type registry" so new
   media types are additive, not forks?
4. **The manifestations.** Can this one surface credibly *be* (not "link to"): a presentation system
   (PPT-class), a document presenter/reader (PDF/book → living, explorable, select-to-expand), an
   authoring/composition tool (Canva/Word-class — edit text, place and manipulate media, lay out), a
   notebook/computational surface, a knowledge-graph explorer, a simulation stage, and — on the long
   horizon — an **IDE / pair-programming co-editor**? For each: feasibility, the hard problem, the SOTA
   reference implementation, and the minimal primitive from §2.2 it reduces to.
5. **Adaptivity.** How can the surface itself *restructure in real time* — changing representation,
   density, and layout per learner, per concept, per cognitive state — under DSP and agent
   orchestration, without becoming unpredictable or breaking replay?
6. **The cost of the invariants.** What do event-sourcing, deterministic replay, memory-mutation-only
   persistence, and reasoning-trace-for-every-choice *cost* in latency, storage, and engineering, and
   which known techniques (CRDTs, event logs, operational transforms, deterministic schedulers,
   snapshotting) pay for them best?

---

## 3. HARD CONSTRAINTS YOUR PROPOSALS MUST SATISFY

Any architecture, technology, or interaction pattern you propose is judged against these. Score each
proposal against them explicitly.

1. **World-state projection** — the surface renders substrate state and writes back only through it.
2. **Event-sourced & deterministically replayable** — any session reconstructs exactly from its event log.
3. **Memory-mutation-only persistence** — nothing durable is written outside a typed mutation.
4. **Reasoning-traced choices** — every modality/representation/layout decision is explainable.
5. **Capability- & consent-gated inputs** — especially voice/camera/sensor/immersive; minors-safe defaults.
6. **Real-time multi-agent co-presence** — many agents surface contributions concurrently via a bus +
   blackboard, never hidden direct calls; disagreement is a first-class, surfaced signal.
7. **Accessibility & equity parity** — non-immersive equivalent for everything; degrades to low-bandwidth/
   offline/low-power; works across age, language, geography, device.
8. **Pedagogical integrity** — serves understanding; no engagement-maximizing dark patterns; depth never
   traded for speed.
9. **Composability & extensibility** — new media/block types and new agents are additive, not rewrites.
10. **Real-time collaboration & continuity** — multiple humans + agents on a shared surface; state
    survives across sessions, devices, and years.

---

## 4. THE CAPABILITY LADDER — RESEARCH EACH RUNG

For **each** rung below produce: (a) what cognitive-science / HCI evidence says about why it matters for
understanding; (b) the SOTA reference systems to dissect and what each gets right/wrong; (c) the hard
unsolved problem; (d) which substrate primitive (§2.2) it reduces to; (e) how it satisfies/strains the
§3 invariants.

- **R1 · Knowledge exploration** — semantic/zoomable knowledge landscapes, infinite canvases,
  interdisciplinary bridges, frontier navigation, graph-as-surface.
- **R2 · Document & media intelligence** — PDFs/books/papers becoming living, explorable, select-to-
  expand semantic objects; slide decks becoming interactive cognition spaces; video/audio as
  navigable, annotatable, queryable substrate.
- **R3 · Authoring & composition (Canva/Word/PPT-class)** — direct manipulation of text and media, layout,
  illustration, presentation building — as projections of the same substrate, not a bolted-on editor.
- **R4 · Computational & executable surface** — notebooks, live runtime visualizations, executable
  diagrams; and the long-horizon **IDE / pair-programming co-editor** (dual-pane code ↔ plain-language
  logic; agentic code editing). Treat the IDE as a frontier horizon, but research the primitive that
  makes it reachable rather than a separate app.
- **R5 · Simulation & visual reasoning** — interactive, optionally physically-grounded simulations as
  the clearest representation of a concept; executable thought; visual/spatial reasoning aids.
- **R6 · Creative & cinematic expression** — generative illustration, motion/narrative construction,
  emotion-aware rendering — in service of explanation, not spectacle.
- **R7 · Collaborative & collective cognition** — shared surfaces for multiple humans and agents;
  synchronized exploration; classroom co-presence; cohort overlays.
- **R8 · Adaptive self-restructuring** — the surface reshaping itself per learner/task/state in real time.

Conclude §4 with a **manifestation × primitive matrix**: rows = R1–R8, columns = candidate primitives
from §2.2, cells = fit/strain, ending in a single recommended substrate primitive (or principled hybrid)
that maximizes coverage with minimum mechanism.

---

## 5. RESEARCH DOMAINS & NAMED ANCHORS (search seeds — go beyond these)

Prioritized, with starting anchors so you dig instead of skim. For each domain, find the *seminal* work
**and** the *last-24-months* frontier, and reconcile them.

**A. The science of human understanding (highest priority — this is what separates this from a tool).**
Cognitive load theory (Sweller); multimedia learning & its principles (Mayer); dual coding (Paivio);
distributed & embodied cognition (Hutchins, Clark & Chalmers, Kirsh); external cognition / "cognitive
artifacts" & "things that make us smart" (Norman); spatial cognition & the method-of-loci / memory
palace evidence; the generation, testing, spacing, and interleaving effects; desirable difficulties
(Bjork); flow (Csikszentmihalyi); attention, working-memory limits, and context-switching cost; the
"productive struggle" and worked-example literature; curiosity & intrinsic-motivation neuroscience;
conceptual blending (Fauconnier & Turner); mental-model formation; sketching/diagramming as thought.
*Output: which findings are robust, which are contested/replication-fragile, and what each implies for
surface design.*

**B. HCI & the future of the medium.** Bret Victor (*Dynamicland*, "Magic Ink", "Up and Down the Ladder
of Abstraction", "Media for Thinking the Unthinkable"); Engelbart (augmenting human intellect); Alan Kay
& Smalltalk/Dynabook; Ted Nelson (hypertext, Xanadu, transclusion); Sutherland (Sketchpad); tools-for-
thought lineage (Andy Matuschak & Michael Nielsen, "How can we develop transformative tools for
thought?"); spatial/post-GUI computing; ambient & calm computing; end-user & visual programming;
malleable/AI-native & generative UI. *Output: the through-line of the medium's evolution and where this
surface sits on it.*

**C. Systems to dissect (teardowns, not name-drops).** Editing/canvas: tldraw, Excalidraw, Figma
(multiplayer architecture & the LiveGraph/file-format story), Miro, Framer. Documents/blocks: Notion,
ProseMirror, Lexical, Slate, the block model. Computational: Jupyter, Observable, Marimo, Streamlit;
Reveal.js / Motion Canvas / Manim for presentation & explanatory animation. Code: VS Code extension
model, Cursor, the LSP. AI surfaces: ChatGPT canvas, Claude Artifacts, Anthropic's computer-use,
generative-UI experiments. Knowledge graphs: Roam/Obsidian/Logseq, scene-graph & game-engine editors.
*For each: the core data model, the collaboration model, the extensibility model, and the one idea worth
stealing — and why none of them is the whole thing.*

**D. Real-time, collaborative, replayable runtime tech.** CRDTs (Yjs, Automerge) vs. operational
transforms; local-first software (Ink & Switch); event sourcing & CQRS; deterministic execution &
replay; conflict resolution & presence; multiplayer sync at scale. *Output: how to get real-time
collaboration AND deterministic replay AND event-sourcing to coexist — the central systems tension.*

**E. Rendering & media runtime.** Canvas2D vs. SVG vs. WebGL vs. **WebGPU**; retained- vs. immediate-mode
scene graphs; compositing many simultaneous media types; embedding sandboxed executable environments
(WASM, iframes, micro-VMs); spatial audio; real-time generative media. *Output: a defensible rendering
architecture with a performance budget (target frame rate, node counts, memory) on commodity hardware.*

**F. AI-native orchestration of the surface.** How LLM/agent systems should *drive* a surface: streaming
multimodal generation, tool/computer use, structured-output rendering, multi-agent contention for screen
real estate, and keeping agent-driven mutations event-sourced, governed, and reasoning-traced.

**G. Long-horizon (label clearly as speculative).** AR/VR/XR & spatial computing (Vision Pro, WebXR),
holographic/volumetric displays, BCI & ambient intelligence, post-screen cognition. *Separate
demonstrated-today from plausible-5yr from speculative.*

**H. Failure modes to research honestly.** Cognitive overload from too-much-at-once; the "infinite
canvas gets messy" problem; novelty without learning gain; tool complexity defeating accessibility;
multiplayer/replay conflicts; performance collapse with many live media; privacy/surveillance risk of an
always-watching surface. *For each: what the evidence/market shows and how the design mitigates it.*

---

## 6. EVIDENCE & VERIFICATION STANDARDS

- **Cite primary sources.** Papers, primary docs, engineering write-ups, source code — not blog summaries
  of summaries. Prefer the original over the explainer.
- **Grade every nontrivial claim:** `[Established]` (replicated / widely deployed), `[Emerging]`
  (promising, limited evidence), `[Speculative]` (vision/extrapolation). Never present speculation as fact.
- **Flag contested findings** — especially in education psychology where replication is uneven (e.g.,
  "learning styles" is debunked; treat such myths explicitly and don't build on them).
- **Triangulate** — at least two independent sources for load-bearing claims; note where sources disagree.
- **Recency + lineage** — pair the seminal source with the current frontier; date your evidence.
- **No uncited assertions and no hallucinated systems/papers.** If unsure whether something exists, say so
  and mark it for verification. A smaller, true, cited dossier beats a large, confident, wrong one.

---

## 7. OUTPUT CONTRACT

Produce a structured dossier with these parts. Favor matrices, tradeoff tables, and decision statements
over prose. Every recommendation states *what to do, why, the evidence, and the cost*.

- **Part 0 · Executive synthesis (≤2 pages).** The 7–10 load-bearing conclusions, the single recommended
  substrate primitive, the recommended technology stack in one paragraph, and the top 3 risks. Written so
  a founder can decide from this alone.
- **Part 1 · Why current surfaces are fragmented — and what that costs cognition.** Evidence-backed
  critique of apps/tabs/documents/IDEs/fragmented workflows; what fragmentation costs in
  context-switching, overload, and lost transfer; what (if anything) is load-bearing and must stay split.
- **Part 2 · The science of human understanding → design implications.** Synthesis of domain A as a table:
  finding → evidence grade → concrete implication for the Cognitive Surface.
- **Part 3 · The evolution of the medium of thought.** The Victor/Engelbart/Kay/Nelson/Matuschak-Nielsen
  through-line; where this surface extends it; what's genuinely new vs. recombination.
- **Part 4 · The Cognitive Surface — architecture.** Interaction philosophy; the recommended **substrate
  primitive** (defended against alternatives); the **render-anything** runtime; the adaptivity/DSP model;
  the collaboration+replay model; **and an explicit mapping of every architectural choice onto the COS
  invariants in §3 and the F09 event taxonomy** — including, for each invariant, its cost and how the
  design pays it.
- **Part 5 · Capability ladder findings + the manifestation × primitive matrix** (from §4), ending in the
  recommended primitive and the order in which manifestations should be built.
- **Part 6 · Technology & stack recommendation.** Concrete candidate stacks (rendering, doc/CRDT model,
  collaboration, execution sandboxing, event store, agent-orchestration integration) as **comparison
  tables** scoring each option against the §3 invariants and a performance budget; then a single
  recommended stack with the reasoning and the rejected alternatives.
- **Part 7 · Breakthrough mechanisms.** 5–10 genuinely novel surface mechanisms (e.g., explanation-over-
  explanation layering, executable diagrams that are world-state nodes, a surface that descends into a
  prerequisite when a learner stalls). For each: the cognitive rationale, feasibility, and the primitive
  it rides on. Mark each `[Established]/[Emerging]/[Speculative]`.
- **Part 8 · Phased build path.** Map findings onto F09's **MVP → Advanced → Frontier** phasing
  (MVP: living timeline, concept workspace, Open Mode, whiteboard-as-artifact; Advanced: simulations,
  living notebooks, document split-pane, classroom whiteboard, voice; Frontier: AR/VR/holographic,
  ambient companion, IDE co-editor). For each phase: what to build, what it unlocks, what it costs, what
  must be true first.
- **Part 9 · Resolved open questions + risks.** Take positions on F09's open questions (which surface
  artifact schema is canonical first; the threshold for persisting a whiteboard action as memory; how to
  evaluate immersive depth not novelty; which accessibility constraints become hard governance rules).
  Then a risk register: technical, pedagogical, ethical/privacy, and adoption risks, each with a mitigation.
- **Part 10 · Annotated bibliography.** Every source with a one-line "what it contributes" and its evidence
  grade. Group by domain (§5).

---

## 8. ANTI-PATTERNS — AUTOMATIC FAILURE

- Buzzword salad or repeating the vision instead of resolving it into decisions.
- Any architecture that ignores or quietly violates a §3 invariant (e.g., a canvas that is its own source
  of truth; persistence that bypasses memory mutations; agent actions that aren't event-sourced).
- Uncited futurism; presenting `[Speculative]` as `[Established]`; inventing papers or systems.
- "Just use <one tool>" — the thesis is convergence into a substrate, not adopting an existing app.
- Ignoring accessibility, low-bandwidth, governance, consent, or minors-safety because they're inconvenient.
- Feature lists with no primitive behind them, no evidence under them, and no cost attached to them.

---

## 9. NORTH STAR (the bar for the *output*, not an excuse for vagueness)

The system this dossier describes should ultimately feel less like *using software* and more like
**entering a living universe of thought** — where any form of understanding, creation, research, and
collaboration happens inside one continuously adaptive cognitive space. Your job is to make that feeling
**inevitable and buildable**: trace it to human-cognition evidence, ground it in a substrate primitive,
honor every invariant, and hand back a path a team can start walking on Monday.

Think from first principles. Disagree with this brief where the evidence warrants — and show the evidence.
