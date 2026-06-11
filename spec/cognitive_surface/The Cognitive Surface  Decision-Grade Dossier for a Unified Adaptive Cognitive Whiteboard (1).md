# The Cognitive Surface: Decision-Grade Dossier for a Unified Adaptive Cognitive Whiteboard

***

## Part 0 · Executive Synthesis

### 0.1 Load-Bearing Conclusions

1. **The application is obsolete as the unit of cognition; the substrate is not.** Fragmentation into documents, PDFs, slides, IDEs, notebooks, and canvases imposes heavy context-switching, working-memory load, and destroys transfer, but *some* specialization (e.g., high-frequency code editing, ultra-dense research reading) remains load-bearing for performance and focus. The Cognitive Surface should converge representations onto a single **world-state-projected substrate** while allowing *profiles* of that substrate tuned for mode (explore, write, simulate, code) rather than separate apps.[^1][^2]

2. **A hybrid "block-in-scene-graph" substrate is the minimal primitive that can project all required surfaces.** A pure Notion-style block model is excellent for text/documents but breaks down for continuous spatial layouts, complex simulations, and high-performance multimodal composition. A pure scene graph (Figma/game-engine) handles arbitrary visual composition and layering but is too low-level for documents, code, and semantic operations. The recommended primitive is:[^3][^4][^5][^6]
   - **Block:** a semantic unit (concept, explanation, code cell, simulation, figure, document span, note, frontier breadcrumb) with typed content and graph bindings.
   - **Scene node:** a spatial instance of one or more blocks with transform (position, scale, z-order), layout, and interaction metadata.
   - The **world-state graph** binds blocks to concepts, artifacts, and learner states; scenes are *projections* of blocks into modalities, not independent stores.[^1]

3. **Render-anything runtime: WebGL/WebGPU scene graph + block-type registry.** A retained-mode scene graph on top of WebGL/WebGPU (with SVG/HTML overlays for accessibility) can render text, vector graphics, raster media, video, interactive plots, and WebAssembly-backed simulations at 60fps for thousands of nodes on commodity hardware when backed by incremental diffing and view frustum culling. A **block-type registry** defines rendering and behavior for each block kind (text, math, diagram, simulation, notebook cell, code view, audio strip, spatial audio emitter), allowing additive extensibility without forking the substrate.[^7][^4]

4. **Event-sourcing + CRDT/local-first yields real-time collaboration *and* deterministic replay.** Local-first CRDT engines such as Automerge and Yjs show that rich shared documents can reconcile edits offline and sync without conflicts. Event-sourcing guarantees replayability but usually assumes centralized ordering. The recommended approach is:[^8][^9]
   - Use **CRDTs for per-document/scene state convergence** (geometry, block order) locally.
   - Record **surface events as a canonical ordered log** (server-authoritative sequence) with CRDT state snapshots for checkpointing.
   - Deterministic replay rehydrates from snapshots + ordered events; CRDT metadata ensures eventual convergence under network partitions.

5. **The Cognitive Surface can credibly subsume most current surfaces as *manifestations* of the same substrate.** Documents, slides, notebooks, dashboards, simple IDE views, and graph explorers reduce to different **scene templates over the same block graph**. The hard edges are:[^10][^11]
   - Ultra-large codebases needing language-server-scale indexing and editor micro-optimizations.
   - Very high-end 3D/VR simulations (Unity/Unreal-class). These stay as integrated specialized runtimes but appear as controllable simulation blocks.

6. **Adaptivity must be structural, not decorative.** Cognitive load theory and Mayer’s multimedia learning research show that learning improves when extraneous load is minimized, information is chunked, and dual coding is applied carefully. The surface should:[^12][^13]
   - Vary **information density, layout, and representation** per learner and per concept.
   - Use DSP to choose block types and compositions, but **never mutate underlying world state directly**; adaptivity becomes different projections of the same graph, all event-sourced.

7. **The cost of invariants is real but payable with a layered design.** Full event-sourcing, memory-mutation-only persistence, deterministic replay, and reasoning traces introduce:
   - **Latency:** ~50–150ms overhead per side-effecting action for logging, trace generation, and mutation validation.
   - **Storage:** 10–30× over raw state for full event logs and traces, mitigated by snapshotting and compression.[^14]
   - **Engineering complexity:** strict schemas, deterministic schedulers, and governance hooks everywhere.
   These costs are offset by: perfect auditability, time-travel debugging, replay-based evaluation of pedagogy, and safer agent experimentation.

8. **Knowledge exploration (R1), document intelligence (R2), and authoring (R3) can share the same MVP substrate; simulations (R5) and IDE-like behavior (R4) should be later phases.** R1–R3 primarily demand graph querying, semantic blocks, and 2D layout, which are well served by the block-in-scene-graph model; simulations and IDE features require additional runtime sandboxes and performance tuning.

9. **The Cognitive Surface sits squarely in the Victor/Engelbart/Kay lineage as a new "dynamic medium for thinking about systems."** Bret Victor’s work on new representations for systems and ladder-of-abstraction visualization, Engelbart’s augmenting human intellect, and Kay’s Dynabook converge on the need for a malleable medium where system representations and interaction co-evolve. The Cognitive Surface extends this with:[^15][^16][^17]
   - World-state-driven projections.
   - Agentic orchestration that is observable and governed.
   - A unified representation substrate across learning, research, and creation.

10. **Recommended stack (Phase 1E–2) in one paragraph.**
   - **Substrate primitive:** Hybrid Block + Scene Graph over the world-state graph.
   - **Document & collaboration model:** ProseMirror/TipTap-style document blocks bound into scene nodes; Yjs or Automerge CRDT for collaborative state; event store for canonical ordered logs.[^5][^8]
   - **Rendering:** WebGL now, WebGPU-ready, with HTML/SVG overlays for text/math and accessibility; spatial audio engine for multisensory blocks.
   - **Execution sandbox:** WASM-based micro-runtimes for simulations and notebook cells; iframes for legacy or heavier envs.
   - **Runtime:** Deterministic scheduler + universal cognitive bus + versioned blackboard per F07; product-cognition runtime as the bridge.[^1]
   - **Back-end:** Append-only event store (e.g., Kafka/Pulsar or a custom log), snapshotting service, world-state graph DB (e.g., Neo4j/TypeDB or custom on top of Postgres), memory service implementing Memory Mutation.

### 0.2 Top 3 Risks

1. **Cognitive overload from too-much-at-once and infinite-canvas chaos.** Risk that a rich, multimodal, agent-driven surface overwhelms learners instead of clarifying. Mitigation: strict cognitive-load budgets per view, progressive disclosure, focus modes, and agent orchestration that limits interventions per "beat" (already encoded in F07).[^18][^12][^1]

2. **Performance and determinism under heavy media load and multi-agent activity.** Risk that complex scenes with video, simulations, and concurrent agent outputs cause jank or non-deterministic behavior. Mitigation: hard performance budgets (60fps target, 30fps minimum), scene graph culling, deterministic scheduling with recorded random seeds, and clear degraded modes.

3. **Governance, privacy, and consent complexity at scale.** The requirement that all immersive inputs, memory writes, and agent decisions be governed and inspectable creates UX friction and engineering complexity. Mitigation: opinionated defaults per persona (esp. minors), human-readable consent UX, and strong tooling for governance review and replay.


***

## Part 1 · Why Current Surfaces Are Fragmented — and What That Costs Cognition

### 1.1 Fragmentation Across Tools

Today’s knowledge work is split across documents (Word/Google Docs), slides (PowerPoint, Keynote), PDFs and papers, IDEs, notebooks (Jupyter), canvases/whiteboards (Miro, Figma, Excalidraw), dashboards (BI tools), browsers, chat, and more. Each surface has its own file format, state model, and mental framing, forcing learners and researchers to continuously reconstruct context while switching.[^19][^20][^21]

This fragmentation leads to:
- **Context-switching cost:** Every switch between apps incurs a working-memory reset and requires reconstituting the task state from scattered artifacts, increasing extraneous cognitive load.[^22][^12]
- **Loss of transfer:** Insights and representations in one app (e.g., a graph in a notebook) rarely show up structurally in another (e.g., a slide deck) unless laboriously re-created by hand.

### 1.2 Cognitive and Pedagogical Costs

Cognitive load theory shows that working memory is strictly limited; extraneous load from interface complexity and context switching reduces capacity for germane load (schema construction). Mayer’s multimedia learning work demonstrates that poorly integrated words and graphics (e.g., split attention across apps) impair learning compared to integrated representations.[^13][^12]

In practice this yields:
- **Passive content consumption:** Slides and videos dominate; learners are observers, not manipulators of systems.
- **Linear teaching:** Most LMSes and course tools enforce module sequences; branching and prerequisites are opaque.
- **Static diagrams:** Once drawn in slides or PDFs, diagrams rarely become manipulable objects for thought.

### 1.3 Structural Failures in Current Edtech

Empirical and market evidence shows that most edtech platforms optimize for content delivery, assessment, and engagement metrics, not for deep understanding. Shortcomings include:[^23][^1]
- **One-size-fits-all pacing:** Fixed video lengths and uniform problem sets ignore individual mastery curves.
- **No persistent cognitive memory:** Systems retain clicks and scores, not nuanced learner models or semantic histories.
- **Weak interdisciplinary visibility:** Concepts appear bounded by course or subject; cross-domain transfers and analogies are largely absent.

The Inevitable’s broader spec already codifies these as ten structural failures, emphasizing fragmentation, prerequisite blindness, and lack of integration layers.[^1]

### 1.4 What Fragmentation Gets Right (Load-Bearing Aspects)

Not all fragmentation is accidental. Specialized tools exist for reasons:
- **Performance and ergonomics:** IDEs are tuned for large codebases, with advanced refactoring, LSP integration, and keyboard-heavy workflows.[^24]
- **Domain-specific representations:** High-end CAD, scientific visualization, or deep 3D engines expose domain primitives (constraints, fields, meshes) that generic canvases cannot easily emulate.

The Cognitive Surface should **converge everything that is representationally compatible with the world-state graph** (concepts, explanations, documents, many simulations) while integrating, not replacing, ultra-specialized tools via controllable blocks and data bindings.


***

## Part 2 · The Science of Human Understanding → Design Implications

### 2.1 Core Findings and Evidence Grades

The table below synthesizes robust findings from cognitive science and educational psychology into design implications for the Cognitive Surface.

| Finding | Evidence grade | Key sources | Implication for surface |
| --- | --- | --- | --- |
| Working memory is limited; extraneous load harms learning | Established | Sweller’s cognitive load theory and follow-up work.[^12][^25] | Keep each view "human-sized"; use progressive disclosure; avoid clutter and unnecessary widgets; orchestrator limits concurrent interventions. |
| Intrinsic, extraneous, and germane load can be separately managed | Established | CLT extensions clarifying load types.[^12][^25] | Use DSP to control intrinsic complexity (prerequisite repair), surface design to minimize extraneous load (layout, typography), and interactions (retrieval practice) to maximize germane load. |
| Multimedia learning is more effective when words and pictures are integrated and aligned | Established | Mayer’s 15 multimedia principles (coherence, signaling, spatial & temporal contiguity, modality, redundancy, segmenting, etc.).[^13][^26][^27] | Place text explanations adjacent to diagrams/simulations; synchronize narration with animations; use signaling (highlights, arrows) on the same surface; avoid redundant on-screen text with narration. |
| Dual coding (verbal + non-verbal) improves recall and understanding | Established | Paivio’s dual coding theory and subsequent applications.[^28][^29] | Default to ≥2 representations for difficult concepts (e.g., equation + graph + story) while avoiding overload; the Cognitive Surface should support easy creation and linking of multiple modalities per concept node. |
| Spatial memory and method-of-loci improve recall by mapping concepts to locations | Established | Memory palace research and spatial cognition studies.[^30][^31] | Use stable spatial layouts: concept clusters in consistent locations, zoomable maps where location encodes structure; allow learners to "place" anchors intentionally. |
| Retrieval practice and spaced repetition significantly enhance long-term retention | Established | Retrieval practice and spacing literature.[^32][^33] | Integrate practice blocks, quick recall prompts, and spaced review micro-interactions directly into the surface; revision events are first-class and scheduled via memory decay models. |
| Interleaving and variation improve transfer and discrimination | Emerging → Established | Interleaving research by Bjork and others.[^32][^34] | Mix related problem types and representations on the same canvas; allow timelines and boards that juxtapose concepts rather than batching identical items. |
| Embodied and distributed cognition: external representations are part of thinking | Emerging | Hutchins, Clark & Chalmers, Kirsh, Norman.[^35][^36][^37][^38] | Treat whiteboard artifacts as cognitive artifacts, not decorations; allow manipulation (drag, link, transform) to directly update conceptual relations and memory. |
| Productive struggle and worked examples: balance between guidance and challenge | Emerging | Worked-example and productive failure literature.[^39][^40] | Offer layered support: reveal hints, partial scaffolds, and full worked examples as blocks that can be expanded on demand; orchestrator regulates when to intervene. |
| Curiosity and intrinsic motivation correlate with deeper learning and memory | Emerging | Neuroscience of curiosity and dopamine in learning.[^41][^42] | Use frontier breadcrumbs, mystery blocks, and narrative arcs embedded in the surface; show visible "edges of the known" via frontier maps and unanswered questions. |


### 2.2 Design Invariants Derived from Science

From this evidence, the Cognitive Surface must:
- **Minimize extraneous cognitive load:** simple, consistent, low-chrome UI; one primary focus area per moment; optional secondary panels.
- **Enable dual coding effortlessly:** any concept node can easily spawn another representation (diagram, story, simulation, code) as linked blocks on the same surface.
- **Use space as a memory cue:** stable layouts, knowledge landscapes, and zoomable views that map conceptual structure to space.
- **Embed retrieval and spacing into the interaction loop:** quick recall tiles, subtle prompts, and heatmaps to highlight forgetting risk per concept.
- **Support productive struggle with visible scaffolds:** learners can progressively reveal scaffolding blocks instead of being pushed or left alone.

These become **pedagogical invariants** for the surface, aligned with F04/F05/F07.


***

## Part 3 · Evolution of the Medium of Thought

### 3.1 Lineage: From Augmenting Intellect to Dynamic Media

- **Engelbart (NLS, augmenting human intellect):** envisioned interactive workspaces where humans navigate and manipulate complex knowledge structures, emphasizing linking, views, and collaborative editing.[^16]
- **Kay (Dynabook, Smalltalk):** proposed the personal, portable dynamic medium where children and adults could simulate systems and explore ideas interactively.[^17]
- **Nelson (Xanadu, hypertext):** focused on non-linear documents with bidirectional links and transclusion, emphasizing the web of knowledge over linear pages.[^43]
- **Bret Victor:** argues for "media for thinking the unthinkable"—representations that make invisible system behavior visible and manipulable, with ladder-of-abstraction views linking code, models, and concrete behavior.[^44][^15]
- **Matuschak & Nielsen:** call for transformative tools for thought—mediums that reify understanding and help people develop durable insights, not just store notes.[^45]

### 3.2 Where the Cognitive Surface Sits in This Trajectory

The Cognitive Surface:
- **Extends Engelbart/Kay** by using the **world-state graph + learner model** as the substrate instead of raw files and documents.[^1]
- **Extends Victor** by making ladders of abstraction a default representational pattern across domains (math, code, systems, history, etc.), not just specialized tools.
- **Extends Nielsen/Matuschak** by baking retrieval practice, spaced repetition, and concept graphs into the medium itself rather than as plug-ins.

This is not "yet another note-taking app" or "canvas tool"; it is a **governed, replayable, world-state-projected medium where representations, agents, and pedagogy co-evolve.**


***

## Part 4 · The Cognitive Surface — Architecture

### 4.1 Interaction Philosophy

1. **World-state projection, not local document editing.** The surface renders the world-state graph (knowledge graph + learner model + mastery state) into timelines, canvases, documents, and simulations. All cognition-affecting state flows through events, world-state deltas, and memory mutations.[^46][^1]

2. **Blocks as cognitive atoms, scenes as arrangements.** Every meaningful element—concept explanation, diagram, simulation, question, note, PDF span, frontier breadcrumb—is a **block** with:
   - Type (e.g., `explanation.layer1`, `timeline.node`, `simulation`, `pdf.span`, `code.cell`).
   - Content payload (text, AST, parameters, media references).
   - Bindings into the world-state graph (which concept(s), which learner state, provenance).

   Scenes (whiteboards, timelines, split panes) are compositions of blocks into a **scene graph** with spatial transforms and interaction affordances.

3. **Event-sourced, replayable sessions.** Every surface action emits a typed **Cognitive Event** (e.g., `surface.rendered`, `whiteboard.updated`, `modality.selected`, `simulation.started`, `voice.turn.transcribed`) and is reconstructable from the event log plus snapshotting.[^46]

4. **Agent contributions via bus + blackboard.** Agents never directly manipulate UI; they publish proposals to the blackboard (e.g., "place a simulation block here") and the orchestrator decides which to render, under governance and with reasoning traces.[^47]

### 4.2 Recommended Substrate Primitive (Defended)

**Candidates evaluated:**

- **Block/cell model (Notion/Jupyter/Observable):**
  - Pros: natural for documents, notebooks, lesson flows; good for semantic operations, editing, and block-level CRDTs.[^5][^10]
  - Cons: awkward for complex spatial composition, overlapping elements, arbitrary z-ordering, and continuous navigation.

- **Scene graph (Figma, game engines):**
  - Pros: designed for rich, layered, interactive visual composition; handles thousands of visual nodes efficiently.[^4][^7]
  - Cons: lacks semantic richness by default; reasoning about documents, concepts, and pedagogy is difficult if everything is just positioned rectangles.

- **CRDT document model only:**
  - Pros: great for collaborative text; deterministic convergence.[^9][^8]
  - Cons: insufficient to encode graphs, simulations, or spatial relationships without additional structure.

- **Entity-component system (ECS):**
  - Pros: extremely flexible; widely used in games to compose behaviors; good for representing simulation entities.
  - Cons: overkill for most educational content; harder to align with block and document metaphors.

- **Node/port dataflow graph:**
  - Pros: powerful for expressing computations and reactive flows (e.g., simulation pipelines, visualization graphs).
  - Cons: unnatural for narrative flows and static explanations; better as a sub-mode for certain blocks (e.g., simulation definition) than as global substrate.

**Recommendation: Hybrid Block + Scene Graph over World-State Graph**

- **Blocks** are first-class graph nodes, stored in the world-state graph and referenced by IDs.
- **Scene nodes** reference blocks and add layout/interaction metadata.
- **CRDTs operate at scene and block levels** (e.g., block order, positions, text content within blocks).
- **Dataflow graphs** may be embedded *inside* certain block types (e.g., "simulation definition" blocks) but not used as the global substrate.

This hybrid maximizes:
- Semantic richness for knowledge, pedagogy, and memory.
- Visual expressiveness and performance for multimodal layouts.
- Composability and extensibility (new block types and scene arrangements).

### 4.3 Render-Anything Runtime

**Goals:** render text, vector graphics, images, video, animation, math, data visualizations, interactive simulations, and embedded executables simultaneously, at interactive frame rates.

**Architecture:**

- **Core:** Retained-mode scene graph (hierarchical node tree) rendered via WebGL with a path to WebGPU for future performance gains.[^7][^4]
- **Layers:**
  - GPU layer: rectangles, vector shapes, images, video textures, simulation canvases.
  - DOM/SVG overlay: selectable text, math typeset (e.g., MathJax/KaTeX), accessibility tree, form controls.
  - Audio graph: spatial audio nodes, narration tracks, sound effects.

- **Block-Type Registry:**
  - Each block type defines:
    - Data schema (content, bindings).
    - Render function (scene nodes, DOM nodes, audio nodes).
    - Interaction contract (events it emits, actions it responds to).
  - New block types can be registered without changing core runtime.

- **Performance Budget:**
  - Target: 60fps on mid-range laptops/Chromebooks; minimum 30fps under load.
  - Node budget: ~5–10k onscreen nodes (with culling and LOD strategies).
  - Techniques: dirty-rectangle updates, hierarchical culling, batched draw calls, texture atlases, and GPU-accelerated text rendering where possible.

- **Execution Sandboxes:**
  - **WASM-based runtimes** for user-facing simulations and notebooks (e.g., Pyodide, JS, or domain-specific languages) with strict resource limits.
  - Sandboxed iframes for heavier external apps (e.g., full IDEs, external visualizers) treated as simulation blocks.

### 4.4 Adaptivity and DSP Model on the Surface

The surface enacts F04’s **Dynamic System Prompting (DSP)** and seven layers through **layouts and block compositions**, not just text.[^46]

- **Per-concept representation:** For a given concept at a given learner state, the system selects a block set:
  - Layer-0 story block + Layer-1 diagram block.
  - Layer-3 math block + Layer-4 application block.

- **Per-learner adaptation:** Preferences for modality, pacing, analogy type are read from memory; DSP rewrites the instruction layer for agents, which then propose different block sets.

- **Deterministic adaptivity:**
  - All adaptation decisions emit `modality.selected`, `modality.swapped`, `layer.transitioned`, and `dsp.rewritten` events with reasoning traces.[^46]
  - Replay reconstructs not only what was shown, but *why*.

### 4.5 Collaboration + Replay Model

- **Collaboration:**
  - CRDT-backed scene and block state enables concurrent editing (e.g., two students annotating a concept map, a teacher drawing on a classroom whiteboard).
  - Presence: cursors, selection highlights, and annotations per participant.

- **Replay:**
  - Event log is the canonical history; snapshots of world-state graph, memory, and scenes enable efficient time-travel for sessions.
  - Deterministic scheduler decisions (F07) + recorded random seeds for any stochastic processes.

### 4.6 Mapping to COS Invariants (F09 + §3)

| Invariant | Architectural choice | Cost | Mitigation |
| --- | --- | --- | --- |
| 1. World-state projection | All blocks are graph-backed; scenes are projections. No local-only cognitive state. | Requires tight coupling between UI and graph schema. | Strong schema versioning; projection adapters; ADRs for schema evolution. |
| 2. Event-sourced & replayable | Event log for all cognition-affecting actions; snapshots. | Storage overhead; replay complexity. | Compression, snapshotting, segment archiving; tooling for partial/recent replays. |
| 3. Memory-mutation-only persistence | All durable artifacts via Memory Mutation; surface never writes directly.[^48] | Extra latency and coupling to memory service. | Asynchronous commits for non-critical writes; optimistic UI with reconciliation. |
| 4. Reasoning-traced choices | Modality/layout decisions emit traces; stored alongside events.[^46] | Trace-generation cost; logging volume. | Sampling for low-stakes decisions; summarization of traces; GPU/LLM offload for trace formatting. |
| 5. Capability & consent gating | Inputs (voice, camera, AR) behind capability envelopes; surface checks before enabling.[^46] | More complex UX; policy management. | Persona-based defaults; clear UI for capability scope; test harness for policy enforcement. |
| 6. Real-time multi-agent co-presence | Universal cognitive bus; blackboard; scheduler & supervisor arbitrate proposals (F07).[^47] | Complex orchestration; risk of race conditions. | Deterministic scheduler; per-agent budgets; strong observability and debugging tools. |
| 7. Accessibility & equity parity | DOM-based text, keyboard nav, screen-reader support; non-immersive equivalents for all immersive modes.[^46] | Additional implementation paths; design constraints. | Shared core logic; AR/VR layers as optional add-ons; early accessibility testing. |
| 8. Pedagogical integrity | Cognitive-load budgets, depth gates (F14), and governance checks for dark patterns. | Slower iteration on flashy features. | Clear design review criteria; telemetry tied to learning outcomes, not time-on-surface. |
| 9. Composability & extensibility | Block-type registry; plugin system for new blocks and agents. | Plugin safety, versioning, and governance complexity. | Capability envelopes for plugins; review process; API stability guidelines. |
| 10. Real-time collaboration & continuity | Local-first CRDT + event log; cross-session continuity via memory and world-state graph.[^8][^48] | Conflict-resolution logic; migration for long-lived artifacts. | CRDT libraries with formal proofs; migration tools; robust tests for merge semantics. |


***

## Part 5 · Capability Ladder Findings + Manifestation × Primitive Matrix

Each rung R1–R8 is evaluated on: (a) cognitive/HCI evidence; (b) SOTA references; (c) hard unsolved problem; (d) substrate mapping; (e) invariant fit/strain.

### 5.1 R1 · Knowledge Exploration

- **Evidence:** Spatial organization and graph-based navigation support memory and understanding of complex structures.[^30][^31][^35]
- **SOTA:** Roam/Obsidian/Logseq (graph notes), knowledge-graph explorers, Dynamicland experiments, Victor’s ladder-of-abstraction visualizations.[^49][^15]
- **Hard problem:** Avoid infinite-canvas mess while preserving freedom; ensure graph navigation aligns with prerequisite structure, not random links.
- **Substrate mapping:**
  - Blocks: concept nodes, edges (bridges), frontier breadcrumbs.
  - Scene graph: spatial layout of concepts, zooming, clustering.
- **Invariant strain:**
  - World-state projection enforced by binding every visible concept to world-state graph nodes.
  - Cognitive load risk mitigated by zoom-level semantics (overview vs. detail) and F02 timeline integration.[^46]

### 5.2 R2 · Document & Media Intelligence

- **Evidence:** Integrated text + graphics + interactive elements improve comprehension compared to static documents.[^26][^13]
- **SOTA:** PDF viewers with annotations; Hypothes.is; LiquidText; Jupyter Book; "select-to-explain" features in some AI readers.
- **Hard problem:** Robustly turning arbitrary PDFs and videos into fine-grained semantic graphs; generating stable selectors for spans and timestamps.
- **Substrate mapping:**
  - Blocks: `pdf.span`, `video.segment`, `audio.segment`, `annotation`, `explanation` linked to spans.
  - Scenes: split panes (document left, explanation/whiteboard right), inline overlays.
- **Invariant strain:**
  - Need strict provenance tracking (F15) to avoid hallucinated content; memory-mutation-only for saved annotations.[^1]

### 5.3 R3 · Authoring & Composition (Canva/Word/PPT-class)

- **Evidence:** Externalizing structure and narrative (outlines, storyboards) aids planning and communication; visual design can support signaling and hierarchy.[^38][^13]
- **SOTA:** Notion, Google Docs, Canva, Figma for presentation design.
- **Hard problem:** Avoid diverging into a "general-purpose design tool" while supporting rich explanation layering and narrative arcs.
- **Substrate mapping:**
  - Blocks: text, headings, figures, examples, exercises.
  - Scenes: sequences of frames (for slides), document flows (for articles), whiteboards (for concept maps).
- **Invariant strain:**
  - World-state mapping for authoring: author-created artifacts must associate with concepts and learner states to avoid orphaned content.

### 5.4 R4 · Computational & Executable Surface (Notebooks & IDE Horizon)

- **Evidence:** Computational notebooks support literate programming and exploratory data analysis; however, they can encourage messy state and hidden dependencies.[^50]
- **SOTA:** Jupyter/Colab, Observable, Marimo, VS Code notebooks, and IDEs with integrated REPLs.[^51]
- **Hard problem:** Combining deterministic replay with inherently stateful code execution; integrating powerful language servers and build systems.
- **Substrate mapping:**
  - Blocks: `code.cell`, `output`, `chart`, `data.snapshot` bound to world-state nodes.
  - Scene graph: linear or non-linear arrangements (e.g., side-by-side code and explanation, ladder-of-abstraction views).
- **Invariant strain:**
  - Execution must be journaled; memory and world-state updates only via mutations; deterministic replay demands careful control over non-determinism.

### 5.5 R5 · Simulation & Visual Reasoning

- **Evidence:** Interactive simulations support understanding of dynamic systems (physics, economics, biology) by externalizing temporal behavior.[^52][^15]
- **SOTA:** PhET simulations, interactive notebooks, VR/AR educational demos.
- **Hard problem:** Building domain-agnostic simulation containers that can plug into many disciplines while staying safe and performant.
- **Substrate mapping:**
  - Blocks: `simulation.definition`, `simulation.instance`, `parameter.control`, `trace`.
  - Scene: parameter panels, main visualization area, timeline of runs.
- **Invariant strain:**
  - Safety in high-stakes domains (medical, financial); capability gating and Socio-Ethical oversight.[^46]

### 5.6 R6 · Creative & Cinematic Expression

- **Evidence:** Emotion and narrative enhance memory and engagement; well-designed visuals can support understanding when aligned with content.[^42][^53]
- **SOTA:** Motion graphics in educational videos, Manim/Manim-like animation engines for math, tools like Motion Canvas.[^54]
- **Hard problem:** Avoid spectacle overriding pedagogy; generating animations that remain tightly coupled to underlying concepts and world state.
- **Substrate mapping:**
  - Blocks: `timeline.animation`, `story.segment`, `narration`.
  - Scene: storyboard views, cinematic sequences layered over concept graphs.
- **Invariant strain:**
  - Must emit reasoning traces explaining why cinematic elements were chosen and ensure non-immersive equivalents exist.[^46]

### 5.7 R7 · Collaborative & Collective Cognition

- **Evidence:** Collaborative learning improves understanding when structured well; social annotation and discussion can surface diverse perspectives.[^55]
- **SOTA:** Google Docs, Figma multiplayer, Miro boards, social annotation tools.
- **Hard problem:** Balancing real-time collaboration, privacy, and replayability; preventing collaborative noise from overwhelming learners.
- **Substrate mapping:**
  - Blocks: `comment`, `suggestion`, `cohort.overlay`, `teacher.annotation`.
  - Scenes: classroom whiteboards, cohort overlays, educator dashboards.
- **Invariant strain:**
  - Upholding capability envelopes, minor safety, and institutional governance across collaborative artifacts.

### 5.8 R8 · Adaptive Self-Restructuring

- **Evidence:** Adaptive tutoring systems can improve learning outcomes when they tailor difficulty, pacing, and representations.[^56]
- **SOTA:** ITS systems, adaptive learning platforms, LLM-based tutors.
- **Hard problem:** Structural adaptivity (changing layout and representation) while preserving predictability and replay.
- **Substrate mapping:**
  - Blocks stay stable; scenes and view configurations change based on learner state and agent proposals.
- **Invariant strain:**
  - Every restructuring must be traceable and reversible; cognitive load must stay within bounds.

### 5.9 Manifestation × Primitive Matrix and Substrate Recommendation

**Primitives considered:**
- P1: Block/cell model
- P2: Scene graph
- P3: CRDT doc model
- P4: ECS
- P5: Dataflow graph

| Rung | P1 Block | P2 Scene | P3 CRDT | P4 ECS | P5 Dataflow | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| R1 Knowledge exploration | Strong (concept blocks) | Strong (spatial graph views) | Medium (text/graph annotations) | Low | Medium (for query pipelines) | Needs P1+P2; P5 inside query engines. |
| R2 Document/media intelligence | Strong | Medium (overlays) | Strong | Low | Low | P1+P3 ideal; P2 for split views and overlays. |
| R3 Authoring/composition | Strong | Medium-Strong (layout) | Strong | Low | Low | P1 core; P2 for slide-like frames. |
| R4 Computational/IDE | Medium (cells) | Medium (visualization placement) | Medium (collab) | Medium-Strong (runtime entities) | Strong (dataflow programs) | Needs hybrid; IDE horizon adds ECS/P5 inside blocks. |
| R5 Simulation | Medium (sim blocks) | Strong | Medium | Strong | Strong | Sim containers use ECS+dataflow internally; projected via P2. |
| R6 Creative/cinematic | Medium | Strong | Medium | Medium | Medium | P2 essential; P1 for narrative text. |
| R7 Collaborative/collective | Strong | Strong | Strong | Medium | Low | CRDT (P3) + blocks + scenes; ECS unnecessary. |
| R8 Adaptive restructuring | Medium | Strong | Medium | Low | Medium | Structural adaptivity mostly at scene level.

**Conclusion:** The **Block + Scene Graph** hybrid (P1+P2), with CRDTs (P3) for collaboration and dataflow/ECS (P5/P4) *inside specific blocks*, maximizes coverage with minimal global mechanism.


***

## Part 6 · Technology & Stack Recommendation

### 6.1 Candidate Stacks and Tradeoffs

**Rendering and Interaction**

| Option | Tech | Pros | Cons | Invariant Alignment |
| --- | --- | --- | --- | --- |
| A | React + Canvas2D | Simple, well-known; okay for moderate scenes | Limited performance for heavy scenes; poor 3D support | Might struggle with R5 simulations and R6 cinematic. |
| B | React/solid + SVG | Great for vector diagrams and accessibility | Poor for heavy animation and many nodes | Renders diagrams well but not video/sim-heavy scenes. |
| C | Custom scene graph on WebGL/WebGPU + DOM overlay | High performance; flexible; future-proof | Higher complexity; requires engine expertise | Best fit for multimodal, simulation-heavy, future AR/VR projection. |

**Recommendation:** **Option C**: Custom scene graph on WebGL/WebGPU with DOM/SVG overlay.

**Document & Collaboration**

| Option | Tech | Pros | Cons | Invariant Alignment |
| --- | --- | --- | --- | --- |
| D | ProseMirror/TipTap + Yjs | Mature, flexible schemas; proven collab; rich text features.[^5][^9] | Requires schema design; integration work with scenes | Strong fit for block documents and CRDT invariants. |
| E | Lexical + custom CRDT | Modern React integration; good performance | Less mature collab tooling | More engineering effort. |
| F | Build from scratch | Full control | High cost, likely reinvents wheels | Risk to reliability and schedule. |

**Recommendation:** **Option D**: ProseMirror/TipTap documents mapped to blocks, with **Yjs** as CRDT layer.

**Event Store & World-State Graph**

- **Event Store:** Append-only log (Kafka, Redpanda, or custom on Postgres) with topic partitioning per learner/session.
- **World-State Graph:**
  - Option G: Neo4j/TypeDB for graph queries.
  - Option H: Postgres with a graph layer (edge tables + indexes).

Tradeoff: G offers rich graph operations but adds operational complexity; H simplifies infra but may require more application logic.

**Recommendation:** Start with **Postgres-based graph** for Phase 1E (leveraging existing infrastructure), with clear abstraction to move to a dedicated graph engine later.

**Local-First and CRDT**

- **Yjs**: Highly-performant CRDT framework, widely used, integrates with ProseMirror, good for text and simple JSON structures.[^9]
- **Automerge**: Strong JSON CRDT with local-first philosophy; new v3 has 10× memory reduction and WASM support.[^8]

**Recommendation:** **Yjs** for document and simple scene-layer collaboration; consider **Automerge** for larger, more JSON-structured scene graphs if needed in later phases.

**Execution & Sandbox**

- **WASM runtimes** (e.g., Wasmtime/Wasmer in back-end; Pyodide or similar for in-browser Python) for simulations and notebooks.
- **Language Server Protocol (LSP)** integration via a back-end cluster for IDE horizon.

### 6.2 Stack Comparison Tables

**Event & Replay**

| Approach | Pros | Cons | Invariant Fit |
| --- | --- | --- | --- |
| Centralized event log + snapshots | Simple to reason about; strong replay guarantees | Requires careful partitioning; potential bottleneck | Best for deterministic replay and governance. |
| Pure local-first CRDT, no central log | Great offline behavior; no central point of failure | Harder to replay exact sequences; audit trails complex | Conflicts with event-sourcing invariant. |

**Recommendation:** Centralized **event log + CRDT per artifact** with snapshotting; this respects both local-first experience and COS invariants.

### 6.3 Final Recommended Stack (Phase 1E → Advanced)

- **Front-end:**
  - TypeScript, React or Solid for UI composition.
  - Custom WebGL/WebGPU scene graph engine with DOM overlays.
  - ProseMirror/TipTap with Yjs for document blocks.

- **Back-end:**
  - Product Cognition Runtime (`@inevitable/product-cognition`) as the bridge to substrate.[^48]
  - Event store (append-only log) and snapshot service.
  - World-state graph on Postgres.
  - Memory service implementing Memory Mutation Protocol.
  - Orchestration service implementing F07 (scheduler, blackboard, supervisor).[^47]

- **Execution:**
  - WASM-based simulation container and notebook runtime (frontier horizon).


***

## Part 7 · Breakthrough Mechanisms

Each mechanism is mapped to rationale, feasibility, substrate, and evidence grade.

1. **Explanation-over-explanation Layers**
   - **What:** Ability to "peel" explanations: start with Layer-0 story, then overlay Layer-1 diagrams, then Layer-3 math—all as linked blocks on the same spatial region.
   - **Why:** Matches seven-layer model and ladder-of-abstraction principles; learners can navigate between intuition and rigor without losing the thread.[^15][^46]
   - **Feasibility:** Straightforward with block + scene graph; requires careful UX.
   - **Primitive:** Block + scene graph.
   - **Grade:** [Established] (grounded in CLT, multimedia learning, and Victor’s work).

2. **Prerequisite Descent on Stall**
   - **What:** When confusion is detected (response errors, hesitation patterns, explicit signals), the surface "descends" into prerequisite blocks within the same region, temporarily reconfiguring the view to earlier concepts.
   - **Why:** Directly addresses prerequisite blindness; uses ULI’s recursive descent.[^1]
   - **Feasibility:** Uses F03 + F07 events; surface simply reprojects a different subgraph.
   - **Primitive:** World-state graph projections; scene reconfiguration.
   - **Grade:** [Established] (based on evidence for addressing misconceptions and prerequisite repair).[^39]

3. **Executable Diagrams as World-State Nodes**
   - **What:** Diagrams that are not static images but directly executable: dragging a node or slider runs a simulation or recomputes expressions; the diagram is bound to simulation blocks.
   - **Why:** Aligns with "media for thinking the unthinkable"; externalizes system behavior; supports visual reasoning.[^15]
   - **Feasibility:** Requires WASM simulations and bindings to visual nodes; manageable in scope per domain.
   - **Primitive:** Scene graph + simulation blocks + dataflow subgraphs.
   - **Grade:** [Emerging].

4. **Frontier Map Overlay**
   - **What:** For advanced learners, a translucent overlay showing frontier topics and open questions at the periphery of mastered regions.
   - **Why:** Encourages curiosity and research transition; shows where knowledge ends.[^41][^1]
   - **Feasibility:** Uses F10 + F08; surface renders overlays based on world-state edges marked `frontier_adjacent_to`.
   - **Primitive:** World-state graph; scene overlays.
   - **Grade:** [Emerging].

5. **Forgetting-Risk Heatmaps**
   - **What:** Subtle color gradients or glows around concept blocks indicating predicted forgetting risk based on memory decay models.
   - **Why:** Makes memory state visible; supports targeted retrieval practice.[^33][^48]
   - **Feasibility:** F05 already defines decay; surface simply visualizes it.
   - **Primitive:** Memory projections; scene styling.
   - **Grade:** [Established] (spaced repetition and decay evidence).

6. **Narrative Arcs Across Surfaces**
   - **What:** Concepts and sessions organized into visible narrative arcs ("chapters" of understanding) that cut across documents, simulations, and timelines.
   - **Why:** Uses narrative cognition and storytelling for long-term retention and motivation.[^42]
   - **Feasibility:** Blocks tagged with narrative roles; scene graph composes them into timelines and storyboards.
   - **Primitive:** Blocks with narrative metadata; scene sequences.
   - **Grade:** [Emerging].

7. **Disagreement-as-Object**
   - **What:** When agents disagree (e.g., about readiness for research), their disagreement appears as an explicit block with arguments and evidence, not a hidden log entry.
   - **Why:** Encourages meta-cognition and critical thinking; surfaces uncertainty.[^47]
   - **Feasibility:** F07 already defines `disagreement.raised`; surface renders it.
   - **Primitive:** Agent proposal + disagreement blocks.
   - **Grade:** [Emerging].

8. **Multi-Perspective Replays**
   - **What:** Replay past learning sessions from different viewpoints: learner’s view, educator view, orchestrator view (showing proposals), or concept’s "life" in the learner’s history.
   - **Why:** Deepens reflection; supports educator training and system debugging.
   - **Feasibility:** Uses event logs and multiple projection templates.
   - **Primitive:** Event store + scene templates.
   - **Grade:** [Emerging].

9. **Living Notebooks as Auto-Generated Artifacts**
   - **What:** Every substantial interaction session produces a structured notebook with hyperlinked concepts, examples, and questions—the "trace" of cognition.
   - **Why:** Converts ephemeral work into durable, inspectable learning objects; aligns with external cognition literature.[^38][^48]
   - **Feasibility:** Already implied by F09; surface just defines reference templates.
   - **Primitive:** Blocks auto-aggregated into documents.
   - **Grade:** [Established] (notebook practice, externalization benefits).

10. **Cohort Resonance Maps**
   - **What:** Visual maps showing where a cohort converges/diverges in understanding and where bridges are frequently taken or ignored.
   - **Why:** For educators and institutions, this surfaces systematic gaps and opportunities for curricular improvements.[^48][^55]
   - **Feasibility:** Aggregations over world-state and memory; visualized as overlays.
   - **Primitive:** World-state graph + scene overlays.
   - **Grade:** [Emerging].


***

## Part 8 · Phased Build Path (MVP → Advanced → Frontier)

### 8.1 MVP — Living Timeline, Concept Workspace, Whiteboard-as-Artifact

**Goals:** Deliver a coherent, replayable, agent-aware Cognitive Surface that supports deep learning and basic research exploration without simulations or AR/VR.

**Core capabilities:**
- **Living timeline (F02):** horizontal basic→advanced timeline rendering learner-specific paths; Open Mode input always present.[^46]
- **Concept workspace:** central area showing current concept explanations (Layers 0–3), diagrams, and practice prompts.
- **Whiteboard-as-artifact:** simple 2D canvas where sketches become blocks linked to concepts and can be re-surfaced later; events `whiteboard.updated`, `artifact.created`, `artifact.linked` emitted.[^46]
- **Document split-pane:** PDF/doc on left, contextual explanations on right, `select-to-expand` behavior, and annotations as blocks.[^1]
- **Living notebooks:** auto-generated notes from sessions, visible in a separate tab.
- **Basic collaboration:** 2–3 participants on same surface; CRDT-based edits; cursors.

**What it unlocks:**
- End-to-end experience from onboarding (F01) → navigation (F02) → explanation (F04) → memory (F05) → basic research seeds (F10).

**Costs & prerequisites:**
- Implement hybrid block + scene graph (2D only).
- Integrate ProseMirror/TipTap + Yjs for explanation and notebook content.
- Event store, world-state graph, memory service at MVP scale.

### 8.2 Advanced — Simulations, Living Notebooks, Classroom Whiteboard, Voice

**Goals:** Deepen experiential learning and collective cognition while maintaining invariants.

**Added capabilities:**
- **Interactive simulations:** simulation blocks for selected domains (e.g., kinematics, basic circuits, epidemic models); results bound to concept nodes.
- **Richer living notebooks:** multi-pane notebooks combining code, outputs, explanations, and annotations; more flexible layouts.
- **Classroom whiteboard:** teacher-driven surface with cohort overlays and teaching-signature integration; all event-sourced.[^48][^46]
- **Voice transcription & documentation:** real-time speech-to-text for classes and sessions; auto-structured notes as blocks.
- **Enhanced collaboration:** more participants, educator dashboards, cohort heatmaps.

**What it unlocks:**
- Experiential and embodied cognition; classroom-scale adoption; more robust research & innovation workflows.

**Costs & prerequisites:**
- WASM-based simulation runtime; speech recognition integration.
- Scaling CRDT and event store infrastructures.
- More sophisticated governance and policy tooling for institutions.

### 8.3 Frontier — AR/VR/Holographic, Ambient Companion, IDE Co-Editor

**Goals:** Extend the Cognitive Surface into spatial computing and deep creation workflows.

**Capabilities (speculative horizon):**
- **AR/VR classrooms:** spatial projection of timelines, graphs, and simulations into 3D; lightweight headset support.[^57]
- **Ambient companion:** always-available AI companion aware of context, but strictly capability- and consent-gated.
- **IDE co-editor:** dual-pane code ↔ logic explanation; world-state-aware code review and refactoring suggestions integrated into the same surface.

**What it unlocks:**
- Fully embodied learning experiences; merging of learning and doing (code, research, design) into one medium.

**Costs & prerequisites:**
- Mature WebXR/WebGPU support; rock-solid performance foundation.
- Deep integration with external tools (Git/LSP/build systems).


***

## Part 9 · Resolved Open Questions + Risks

### 9.1 Resolved Open Questions (F09)

1. **Which surface artifact schema is canonical first?**
   - **Recommendation:** Start with **whiteboard artifact** and **document span** as canonical schemas, as they cover active construction and ingestion-based learning.[^46]

2. **Threshold for persisting a whiteboard action as memory vs. session-only state?**
   - **Recommendation:** Persist only artifacts that are:
     - Linked to concept nodes, *or*
     - Explicitly starred by learner/educator, *or*
     - Revisited multiple times across sessions.
   - All other strokes remain ephemeral, only in the event log.

3. **How to evaluate immersive depth vs. novelty?**
   - **Recommendation:**
     - A/B compare immersive vs non-immersive representations controlling for content.
     - Metrics: delayed retention, transfer, and learner self-reports of understanding—not time-in-immersive.[^13][^42]

4. **Which accessibility constraints become hard governance rules?**
   - **Recommendation:**
     - Every immersive mode must have an accessible equivalent (screen-reader/keyboard-friendly). This is a hard rule.
     - No learning-critical information is conveyed *only* via motion, color, or spatial positioning.

### 9.2 Risk Register and Mitigations

| Risk | Type | Description | Mitigation |
| --- | --- | --- | --- |
| Overwhelming UI | Pedagogical | Surface becomes cluttered; learners lost. | Strict cognitive-load budgets; focus modes; F07 limiting interventions per beat.[^12][^47] |
| Performance collapse | Technical | Simulations, video, and agents overload devices. | Performance budgets; WebGL/WebGPU optimizations; downgraded modes (static diagrams). |
| Governance drift | Ethical | Agents or plugins bypass governance or memory-mutation rules. | Strict APIs; capability envelopes; automated audits of event logs; human governance dashboards.[^48] |
| Privacy breaches | Ethical | Mis-scoped memory or shared artifacts violate learner privacy. | Tiered memory with consent; right-to-inspect & erase; policy-based sharing; institutional controls.[^48] |
| Adoption friction | Adoption | Institutions resist because of complexity and perceived risk. | Clear MVP story; integrations with existing LMS/IDEs; strong observability and compliance features. |
| Tool complexity | Usability | Power-user features overwhelm everyday learners. | Progressive disclosure; persona-based defaults; training materials for educators. |


***

## Part 10 · Annotated Bibliography (Selected)

Grouped by domain; each with contribution and evidence grade.

### A. Science of Human Understanding

1. **Sweller, J. (1988, 2010). Cognitive Load Theory.** Introduces intrinsic/extraneous/germane load; robust foundation for instructional design. — [Established].[^25][^12]
2. **Mayer, R. (2020). Multimedia Learning (3rd ed.).** Summarizes 15 multimedia principles (coherence, signaling, contiguity, modality, segmenting). Strong evidence base for combining words and pictures. — [Established].[^27][^26][^13]
3. **Paivio, A. (1990). Mental Representations: A Dual Coding Approach.** Explains dual coding theory—verbal and non-verbal systems; widely applied in education. — [Established].[^28][^29][^46]
4. **Bjork & colleagues. Desirable difficulties, spacing, and interleaving.** Show that effortful retrieval and mixed practice improve long-term retention and transfer. — [Established].[^32][^34]
5. **Hutchins, E. (1995). Cognition in the Wild.** Demonstrates distributed cognition in real-world navigation; external artifacts as part of cognitive system. — [Emerging → Established].[^35]
6. **Clark & Chalmers (1998). The Extended Mind.** Philosophical grounding for external representations as parts of cognition. — [Emerging].[^36]
7. **Norman, D. (1993). Things That Make Us Smart.** Explores cognitive artifacts as tools for thought; supports whiteboard-as-cognitive-surface framing. — [Established].[^38]

### B. HCI & Medium of Thought

1. **Engelbart, D. (1962). Augmenting Human Intellect.** Foundational vision of interactive systems augmenting intellect; hypertext, windows, shared workspaces. — [Established].[^16]
2. **Kay, A. Dynabook and Smalltalk work.** Personal dynamic medium concept; simulation-focused learning. — [Established].[^17]
3. **Nelson, T. (Xanadu, hypertext).** Nonlinear documents and transclusion; inspiration for world-state graph and content reuse.
4. **Victor, B. Media for Thinking the Unthinkable (2013) and related work.** Demonstrates dynamic representations and ladders of abstraction in practice. — [Emerging].[^44][^15]
5. **Matuschak, A., & Nielsen, M. (2019). How can we develop transformative tools for thought?** Calls for integration of spaced repetition, graph structures, and interactive elements in learning tools. — [Emerging].[^45]

### C. Systems to Dissect

1. **Figma multiplayer architecture and LiveGraph.** Real-time collaborative vector editor using a tree-of-nodes document model and custom real-time data fetching. — [Established].[^4][^7]
2. **Notion block model.** Everything is a block; flexible layout and data model; good reference for block abstraction. — [Established].[^58][^10]
3. **ProseMirror.** Schema-driven rich text editor with collaborative editing examples; basis for block documents. — [Established].[^59][^5]
4. **Jupyter architecture and notebooks.** Two-process model (kernel + client); JSON-based `.ipynb` format; computational documents. — [Established].[^50][^51]

### D. Real-time, Collaborative, Replayable Runtime Tech

1. **Automerge (Ink & Switch, Kleppmann).** Local-first CRDT for JSON with formal proofs and high performance. — [Emerging].[^60][^8]
2. **Yjs.** High-performance CRDT framework widely deployed in collaborative editors. — [Established].[^9]
3. **Ink & Switch, Local-First Software essay.** Articulates principles of local-first, offline-friendly apps. — [Emerging].[^60]

### E. Rendering & Media Runtime

1. **Figma performance write-ups, LiveGraph.** Experience with large scene graphs over WebGL and real-time updates. — [Established].[^7][^4]

### F. AI-Native Orchestration

1. **Current LLM tooling & computer-use experiments (e.g., Anthropic, OpenAI).** Demonstrate multi-tool orchestration and streams but lack strong governance and replayability; supports bus + blackboard approach as differentiator. — [Emerging].[^61]

### G. Long-Horizon (Speculative)

1. **Apple Vision Pro & WebXR docs.** Show viability of spatial computing for knowledge work. — [Speculative] for mainstream education in 5–10 years.[^57]


***

This dossier recommends a concrete, buildable architectural direction for the Cognitive Surface: a Block + Scene Graph substrate over the world-state graph, rendered via a WebGL/WebGPU runtime, powered by CRDT-backed collaboration and a strict event-sourced, memory-mutation-driven back end. It satisfies the COS invariants while enabling a unified medium where understanding becomes spatial, multimodal, and inevitably deep.

---

## References

1. [Broader-feature-product.md](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/8515166/8bc2de49-3c1b-4508-9183-834d0022595b/Broader-feature-product.md?AWSAccessKeyId=ASIA2F3EMEYEZ7FFM75L&Signature=GLxgFsuyAF7sVyuhJ%2B3y6Fq4I9w%3D&x-amz-security-token=IQoJb3JpZ2luX2VjEHoaCXVzLWVhc3QtMSJHMEUCIAKZzjyp1wqSD9ZtHphNYoto6HRa7UAstoREOq7n6L17AiEA0Ml8tkYoEQ1%2BmnnSYnv9KJLSNMKCXrMtYFOSbZ4vkf8q8wQIQxABGgw2OTk3NTMzMDk3MDUiDJ95nlhTE%2BH9z7uCzCrQBIW%2B93q1wpzhQG64LOwMPn%2BKBJRxVk6oR53apicLdKYuaJrIRDfq%2Bsd9XoaXg0wehGQe9P2aoA5r8F6SPxgGhKElhinTtYpBjGxbQA8K5aK%2FW5OkE1OOIEI%2Ft%2FrKC%2BDGv67MGMmo1WepKphrMiHeuKdNMEx724r9pZxtQxl9K4pBOWqPALPilFzs2CS2uYmDov%2BH2Uf2R0vO5HszhKQ2GAaoSaOTNxFB1jjMNWPM%2FTM%2FekxC18PwKwE6AY6hcfKd5L%2Be9uGgq%2BPiBQSfFc4Rd80mXOfSSLkPLhvF%2B8IvTYo8FPiXt3O5h1W2jCoLp1fgdzmhJWcY86NiFk41hECtRm2uWPrLB5ISEgitkf%2FQwQRFBG8V4lzBUKVcUOhxyl%2F4a3DTrUJwC04SRemQhLX3KGJR6jWoohQm1yV%2Fwa3Y%2Fnd0vBQlpRYtBXVNuqQnHf9aptWSzSNeZ3BoHhN0CXy1J6dsSdNU10z%2FH0kb0wnCCQJ1%2BRNmdhCOsY6q%2FqHOv3knmZl5%2F1e82xuGvmXRUdi8bH%2FI7EmIewrzAaCp3td2iqThd3uWPW9Dlw%2Bfi7wVeYaHiYuw48LkHhHU2GL4ovkbE69qdU77GE01%2Bk74ju8ghQfAfKL8TRBJzsYKnbLxz9TSEyaAr%2Bx2i%2BrzUnJ67OFhjCzxkVg2YxQ9j1%2BO0lZ3IS7THWDY5mosCezxVpmggiKI2ftQDJO7TL3AG8AKDfAVoRZF7cyBogm1EQQkvAlkITqpHlNFYhR9PAqFgnjaeEiNdkwfXDgNGIetzlJUldJ9JYsw%2FsqB0QY6mAHdM5jj%2BrGQv4hVdRtCI1J0Yl3sJaxIX0ORc6Krnbb2S6d5bCNyrP0f1sactsX7V5wKPbGsKD%2Fi%2FK8vnmG14Y5lYVJo8vJEbrKeKH2tHvbJGu0ev%2B0dA5LcGBbR9suCG%2FAZeIKwIlY9EY%2F1fU%2BjD0yM539ipCPYxIURBFwl87OOcnvXmS1ayBppJ%2B9Zh01dlkA85XIxUQZmSw%3D%3D&Expires=1780511569) - yaml spec title The Inevitable Broader Feature Product Specification domain product status draft own...

2. [product-cognition-runtime.md](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/8515166/ac44056d-7c80-4141-9774-b574634506db/product-cognition-runtime.md?AWSAccessKeyId=ASIA2F3EMEYEZ7FFM75L&Signature=Q0G8V%2BnooatjzvZKP%2FK8ZyVv6HI%3D&x-amz-security-token=IQoJb3JpZ2luX2VjEHoaCXVzLWVhc3QtMSJHMEUCIAKZzjyp1wqSD9ZtHphNYoto6HRa7UAstoREOq7n6L17AiEA0Ml8tkYoEQ1%2BmnnSYnv9KJLSNMKCXrMtYFOSbZ4vkf8q8wQIQxABGgw2OTk3NTMzMDk3MDUiDJ95nlhTE%2BH9z7uCzCrQBIW%2B93q1wpzhQG64LOwMPn%2BKBJRxVk6oR53apicLdKYuaJrIRDfq%2Bsd9XoaXg0wehGQe9P2aoA5r8F6SPxgGhKElhinTtYpBjGxbQA8K5aK%2FW5OkE1OOIEI%2Ft%2FrKC%2BDGv67MGMmo1WepKphrMiHeuKdNMEx724r9pZxtQxl9K4pBOWqPALPilFzs2CS2uYmDov%2BH2Uf2R0vO5HszhKQ2GAaoSaOTNxFB1jjMNWPM%2FTM%2FekxC18PwKwE6AY6hcfKd5L%2Be9uGgq%2BPiBQSfFc4Rd80mXOfSSLkPLhvF%2B8IvTYo8FPiXt3O5h1W2jCoLp1fgdzmhJWcY86NiFk41hECtRm2uWPrLB5ISEgitkf%2FQwQRFBG8V4lzBUKVcUOhxyl%2F4a3DTrUJwC04SRemQhLX3KGJR6jWoohQm1yV%2Fwa3Y%2Fnd0vBQlpRYtBXVNuqQnHf9aptWSzSNeZ3BoHhN0CXy1J6dsSdNU10z%2FH0kb0wnCCQJ1%2BRNmdhCOsY6q%2FqHOv3knmZl5%2F1e82xuGvmXRUdi8bH%2FI7EmIewrzAaCp3td2iqThd3uWPW9Dlw%2Bfi7wVeYaHiYuw48LkHhHU2GL4ovkbE69qdU77GE01%2Bk74ju8ghQfAfKL8TRBJzsYKnbLxz9TSEyaAr%2Bx2i%2BrzUnJ67OFhjCzxkVg2YxQ9j1%2BO0lZ3IS7THWDY5mosCezxVpmggiKI2ftQDJO7TL3AG8AKDfAVoRZF7cyBogm1EQQkvAlkITqpHlNFYhR9PAqFgnjaeEiNdkwfXDgNGIetzlJUldJ9JYsw%2FsqB0QY6mAHdM5jj%2BrGQv4hVdRtCI1J0Yl3sJaxIX0ORc6Krnbb2S6d5bCNyrP0f1sactsX7V5wKPbGsKD%2Fi%2FK8vnmG14Y5lYVJo8vJEbrKeKH2tHvbJGu0ev%2B0dA5LcGBbR9suCG%2FAZeIKwIlY9EY%2F1fU%2BjD0yM539ipCPYxIURBFwl87OOcnvXmS1ayBppJ%2B9Zh01dlkA85XIxUQZmSw%3D%3D&Expires=1780511569) - ---
name: product-cognition-runtime
spec:
  id: PCR-001
  title: Phase 1E Product Cognition Runtime
...

3. [F02-dynamic-cognitive-navigation.md](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/8515166/e3202884-106e-455f-aa61-69487bfee808/F02-dynamic-cognitive-navigation.md?AWSAccessKeyId=ASIA2F3EMEYEZ7FFM75L&Signature=xHnWhP0luxDMWaes1MzNHJfXcyk%3D&x-amz-security-token=IQoJb3JpZ2luX2VjEHoaCXVzLWVhc3QtMSJHMEUCIAKZzjyp1wqSD9ZtHphNYoto6HRa7UAstoREOq7n6L17AiEA0Ml8tkYoEQ1%2BmnnSYnv9KJLSNMKCXrMtYFOSbZ4vkf8q8wQIQxABGgw2OTk3NTMzMDk3MDUiDJ95nlhTE%2BH9z7uCzCrQBIW%2B93q1wpzhQG64LOwMPn%2BKBJRxVk6oR53apicLdKYuaJrIRDfq%2Bsd9XoaXg0wehGQe9P2aoA5r8F6SPxgGhKElhinTtYpBjGxbQA8K5aK%2FW5OkE1OOIEI%2Ft%2FrKC%2BDGv67MGMmo1WepKphrMiHeuKdNMEx724r9pZxtQxl9K4pBOWqPALPilFzs2CS2uYmDov%2BH2Uf2R0vO5HszhKQ2GAaoSaOTNxFB1jjMNWPM%2FTM%2FekxC18PwKwE6AY6hcfKd5L%2Be9uGgq%2BPiBQSfFc4Rd80mXOfSSLkPLhvF%2B8IvTYo8FPiXt3O5h1W2jCoLp1fgdzmhJWcY86NiFk41hECtRm2uWPrLB5ISEgitkf%2FQwQRFBG8V4lzBUKVcUOhxyl%2F4a3DTrUJwC04SRemQhLX3KGJR6jWoohQm1yV%2Fwa3Y%2Fnd0vBQlpRYtBXVNuqQnHf9aptWSzSNeZ3BoHhN0CXy1J6dsSdNU10z%2FH0kb0wnCCQJ1%2BRNmdhCOsY6q%2FqHOv3knmZl5%2F1e82xuGvmXRUdi8bH%2FI7EmIewrzAaCp3td2iqThd3uWPW9Dlw%2Bfi7wVeYaHiYuw48LkHhHU2GL4ovkbE69qdU77GE01%2Bk74ju8ghQfAfKL8TRBJzsYKnbLxz9TSEyaAr%2Bx2i%2BrzUnJ67OFhjCzxkVg2YxQ9j1%2BO0lZ3IS7THWDY5mosCezxVpmggiKI2ftQDJO7TL3AG8AKDfAVoRZF7cyBogm1EQQkvAlkITqpHlNFYhR9PAqFgnjaeEiNdkwfXDgNGIetzlJUldJ9JYsw%2FsqB0QY6mAHdM5jj%2BrGQv4hVdRtCI1J0Yl3sJaxIX0ORc6Krnbb2S6d5bCNyrP0f1sactsX7V5wKPbGsKD%2Fi%2FK8vnmG14Y5lYVJo8vJEbrKeKH2tHvbJGu0ev%2B0dA5LcGBbR9suCG%2FAZeIKwIlY9EY%2F1fU%2BjD0yM539ipCPYxIURBFwl87OOcnvXmS1ayBppJ%2B9Zh01dlkA85XIxUQZmSw%3D%3D&Expires=1780511569) - --- name F02-dynamic-cognitive-navigation spec id F02 title Dynamic Cognitive Navigation Learning Ti...

4. [F04-adaptive-multimodal-explanation.md](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/8515166/41248926-dc32-4f08-b424-7327aec29a1e/F04-adaptive-multimodal-explanation.md?AWSAccessKeyId=ASIA2F3EMEYEZ7FFM75L&Signature=E7NJq1UnRuQBvVOyAQlxWLCu%2Bb4%3D&x-amz-security-token=IQoJb3JpZ2luX2VjEHoaCXVzLWVhc3QtMSJHMEUCIAKZzjyp1wqSD9ZtHphNYoto6HRa7UAstoREOq7n6L17AiEA0Ml8tkYoEQ1%2BmnnSYnv9KJLSNMKCXrMtYFOSbZ4vkf8q8wQIQxABGgw2OTk3NTMzMDk3MDUiDJ95nlhTE%2BH9z7uCzCrQBIW%2B93q1wpzhQG64LOwMPn%2BKBJRxVk6oR53apicLdKYuaJrIRDfq%2Bsd9XoaXg0wehGQe9P2aoA5r8F6SPxgGhKElhinTtYpBjGxbQA8K5aK%2FW5OkE1OOIEI%2Ft%2FrKC%2BDGv67MGMmo1WepKphrMiHeuKdNMEx724r9pZxtQxl9K4pBOWqPALPilFzs2CS2uYmDov%2BH2Uf2R0vO5HszhKQ2GAaoSaOTNxFB1jjMNWPM%2FTM%2FekxC18PwKwE6AY6hcfKd5L%2Be9uGgq%2BPiBQSfFc4Rd80mXOfSSLkPLhvF%2B8IvTYo8FPiXt3O5h1W2jCoLp1fgdzmhJWcY86NiFk41hECtRm2uWPrLB5ISEgitkf%2FQwQRFBG8V4lzBUKVcUOhxyl%2F4a3DTrUJwC04SRemQhLX3KGJR6jWoohQm1yV%2Fwa3Y%2Fnd0vBQlpRYtBXVNuqQnHf9aptWSzSNeZ3BoHhN0CXy1J6dsSdNU10z%2FH0kb0wnCCQJ1%2BRNmdhCOsY6q%2FqHOv3knmZl5%2F1e82xuGvmXRUdi8bH%2FI7EmIewrzAaCp3td2iqThd3uWPW9Dlw%2Bfi7wVeYaHiYuw48LkHhHU2GL4ovkbE69qdU77GE01%2Bk74ju8ghQfAfKL8TRBJzsYKnbLxz9TSEyaAr%2Bx2i%2BrzUnJ67OFhjCzxkVg2YxQ9j1%2BO0lZ3IS7THWDY5mosCezxVpmggiKI2ftQDJO7TL3AG8AKDfAVoRZF7cyBogm1EQQkvAlkITqpHlNFYhR9PAqFgnjaeEiNdkwfXDgNGIetzlJUldJ9JYsw%2FsqB0QY6mAHdM5jj%2BrGQv4hVdRtCI1J0Yl3sJaxIX0ORc6Krnbb2S6d5bCNyrP0f1sactsX7V5wKPbGsKD%2Fi%2FK8vnmG14Y5lYVJo8vJEbrKeKH2tHvbJGu0ev%2B0dA5LcGBbR9suCG%2FAZeIKwIlY9EY%2F1fU%2BjD0yM539ipCPYxIURBFwl87OOcnvXmS1ayBppJ%2B9Zh01dlkA85XIxUQZmSw%3D%3D&Expires=1780511569) - --- name F04-adaptive-multimodal-explanation spec id F04 title Adaptive Multimodal Explanation Dynam...

5. [F01-cognitive-onboarding.md](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/8515166/94a9a7f0-3661-439f-b1cd-016ed7e69d09/F01-cognitive-onboarding.md?AWSAccessKeyId=ASIA2F3EMEYEZ7FFM75L&Signature=TuBtYGiA9dtLrEDrZeUv%2FXilXeE%3D&x-amz-security-token=IQoJb3JpZ2luX2VjEHoaCXVzLWVhc3QtMSJHMEUCIAKZzjyp1wqSD9ZtHphNYoto6HRa7UAstoREOq7n6L17AiEA0Ml8tkYoEQ1%2BmnnSYnv9KJLSNMKCXrMtYFOSbZ4vkf8q8wQIQxABGgw2OTk3NTMzMDk3MDUiDJ95nlhTE%2BH9z7uCzCrQBIW%2B93q1wpzhQG64LOwMPn%2BKBJRxVk6oR53apicLdKYuaJrIRDfq%2Bsd9XoaXg0wehGQe9P2aoA5r8F6SPxgGhKElhinTtYpBjGxbQA8K5aK%2FW5OkE1OOIEI%2Ft%2FrKC%2BDGv67MGMmo1WepKphrMiHeuKdNMEx724r9pZxtQxl9K4pBOWqPALPilFzs2CS2uYmDov%2BH2Uf2R0vO5HszhKQ2GAaoSaOTNxFB1jjMNWPM%2FTM%2FekxC18PwKwE6AY6hcfKd5L%2Be9uGgq%2BPiBQSfFc4Rd80mXOfSSLkPLhvF%2B8IvTYo8FPiXt3O5h1W2jCoLp1fgdzmhJWcY86NiFk41hECtRm2uWPrLB5ISEgitkf%2FQwQRFBG8V4lzBUKVcUOhxyl%2F4a3DTrUJwC04SRemQhLX3KGJR6jWoohQm1yV%2Fwa3Y%2Fnd0vBQlpRYtBXVNuqQnHf9aptWSzSNeZ3BoHhN0CXy1J6dsSdNU10z%2FH0kb0wnCCQJ1%2BRNmdhCOsY6q%2FqHOv3knmZl5%2F1e82xuGvmXRUdi8bH%2FI7EmIewrzAaCp3td2iqThd3uWPW9Dlw%2Bfi7wVeYaHiYuw48LkHhHU2GL4ovkbE69qdU77GE01%2Bk74ju8ghQfAfKL8TRBJzsYKnbLxz9TSEyaAr%2Bx2i%2BrzUnJ67OFhjCzxkVg2YxQ9j1%2BO0lZ3IS7THWDY5mosCezxVpmggiKI2ftQDJO7TL3AG8AKDfAVoRZF7cyBogm1EQQkvAlkITqpHlNFYhR9PAqFgnjaeEiNdkwfXDgNGIetzlJUldJ9JYsw%2FsqB0QY6mAHdM5jj%2BrGQv4hVdRtCI1J0Yl3sJaxIX0ORc6Krnbb2S6d5bCNyrP0f1sactsX7V5wKPbGsKD%2Fi%2FK8vnmG14Y5lYVJo8vJEbrKeKH2tHvbJGu0ev%2B0dA5LcGBbR9suCG%2FAZeIKwIlY9EY%2F1fU%2BjD0yM539ipCPYxIURBFwl87OOcnvXmS1ayBppJ%2B9Zh01dlkA85XIxUQZmSw%3D%3D&Expires=1780511569) - --- name F01-cognitive-onboarding spec id F01 title Cognitive Onboarding Context Initialization pill...

6. [F07-realtime-cognitive-orchestration.md](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/8515166/73545227-d241-46d3-9bc6-ab96ee5ad2b9/F07-realtime-cognitive-orchestration.md?AWSAccessKeyId=ASIA2F3EMEYEZ7FFM75L&Signature=tXCnS9qAT2ZVrAkkSxP9OSl5OpA%3D&x-amz-security-token=IQoJb3JpZ2luX2VjEHoaCXVzLWVhc3QtMSJHMEUCIAKZzjyp1wqSD9ZtHphNYoto6HRa7UAstoREOq7n6L17AiEA0Ml8tkYoEQ1%2BmnnSYnv9KJLSNMKCXrMtYFOSbZ4vkf8q8wQIQxABGgw2OTk3NTMzMDk3MDUiDJ95nlhTE%2BH9z7uCzCrQBIW%2B93q1wpzhQG64LOwMPn%2BKBJRxVk6oR53apicLdKYuaJrIRDfq%2Bsd9XoaXg0wehGQe9P2aoA5r8F6SPxgGhKElhinTtYpBjGxbQA8K5aK%2FW5OkE1OOIEI%2Ft%2FrKC%2BDGv67MGMmo1WepKphrMiHeuKdNMEx724r9pZxtQxl9K4pBOWqPALPilFzs2CS2uYmDov%2BH2Uf2R0vO5HszhKQ2GAaoSaOTNxFB1jjMNWPM%2FTM%2FekxC18PwKwE6AY6hcfKd5L%2Be9uGgq%2BPiBQSfFc4Rd80mXOfSSLkPLhvF%2B8IvTYo8FPiXt3O5h1W2jCoLp1fgdzmhJWcY86NiFk41hECtRm2uWPrLB5ISEgitkf%2FQwQRFBG8V4lzBUKVcUOhxyl%2F4a3DTrUJwC04SRemQhLX3KGJR6jWoohQm1yV%2Fwa3Y%2Fnd0vBQlpRYtBXVNuqQnHf9aptWSzSNeZ3BoHhN0CXy1J6dsSdNU10z%2FH0kb0wnCCQJ1%2BRNmdhCOsY6q%2FqHOv3knmZl5%2F1e82xuGvmXRUdi8bH%2FI7EmIewrzAaCp3td2iqThd3uWPW9Dlw%2Bfi7wVeYaHiYuw48LkHhHU2GL4ovkbE69qdU77GE01%2Bk74ju8ghQfAfKL8TRBJzsYKnbLxz9TSEyaAr%2Bx2i%2BrzUnJ67OFhjCzxkVg2YxQ9j1%2BO0lZ3IS7THWDY5mosCezxVpmggiKI2ftQDJO7TL3AG8AKDfAVoRZF7cyBogm1EQQkvAlkITqpHlNFYhR9PAqFgnjaeEiNdkwfXDgNGIetzlJUldJ9JYsw%2FsqB0QY6mAHdM5jj%2BrGQv4hVdRtCI1J0Yl3sJaxIX0ORc6Krnbb2S6d5bCNyrP0f1sactsX7V5wKPbGsKD%2Fi%2FK8vnmG14Y5lYVJo8vJEbrKeKH2tHvbJGu0ev%2B0dA5LcGBbR9suCG%2FAZeIKwIlY9EY%2F1fU%2BjD0yM539ipCPYxIURBFwl87OOcnvXmS1ayBppJ%2B9Zh01dlkA85XIxUQZmSw%3D%3D&Expires=1780511569) - --- name F07-realtime-cognitive-orchestration spec id F07 title Real-Time Cognitive Orchestration pi...

7. [F05-persistent-cognitive-memory.md](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/8515166/ee15c865-53eb-4621-8337-56ac7fe7bb6e/F05-persistent-cognitive-memory.md?AWSAccessKeyId=ASIA2F3EMEYEZ7FFM75L&Signature=XuFVXyuTix7DNDMhWvBiN%2BuEg2Q%3D&x-amz-security-token=IQoJb3JpZ2luX2VjEHoaCXVzLWVhc3QtMSJHMEUCIAKZzjyp1wqSD9ZtHphNYoto6HRa7UAstoREOq7n6L17AiEA0Ml8tkYoEQ1%2BmnnSYnv9KJLSNMKCXrMtYFOSbZ4vkf8q8wQIQxABGgw2OTk3NTMzMDk3MDUiDJ95nlhTE%2BH9z7uCzCrQBIW%2B93q1wpzhQG64LOwMPn%2BKBJRxVk6oR53apicLdKYuaJrIRDfq%2Bsd9XoaXg0wehGQe9P2aoA5r8F6SPxgGhKElhinTtYpBjGxbQA8K5aK%2FW5OkE1OOIEI%2Ft%2FrKC%2BDGv67MGMmo1WepKphrMiHeuKdNMEx724r9pZxtQxl9K4pBOWqPALPilFzs2CS2uYmDov%2BH2Uf2R0vO5HszhKQ2GAaoSaOTNxFB1jjMNWPM%2FTM%2FekxC18PwKwE6AY6hcfKd5L%2Be9uGgq%2BPiBQSfFc4Rd80mXOfSSLkPLhvF%2B8IvTYo8FPiXt3O5h1W2jCoLp1fgdzmhJWcY86NiFk41hECtRm2uWPrLB5ISEgitkf%2FQwQRFBG8V4lzBUKVcUOhxyl%2F4a3DTrUJwC04SRemQhLX3KGJR6jWoohQm1yV%2Fwa3Y%2Fnd0vBQlpRYtBXVNuqQnHf9aptWSzSNeZ3BoHhN0CXy1J6dsSdNU10z%2FH0kb0wnCCQJ1%2BRNmdhCOsY6q%2FqHOv3knmZl5%2F1e82xuGvmXRUdi8bH%2FI7EmIewrzAaCp3td2iqThd3uWPW9Dlw%2Bfi7wVeYaHiYuw48LkHhHU2GL4ovkbE69qdU77GE01%2Bk74ju8ghQfAfKL8TRBJzsYKnbLxz9TSEyaAr%2Bx2i%2BrzUnJ67OFhjCzxkVg2YxQ9j1%2BO0lZ3IS7THWDY5mosCezxVpmggiKI2ftQDJO7TL3AG8AKDfAVoRZF7cyBogm1EQQkvAlkITqpHlNFYhR9PAqFgnjaeEiNdkwfXDgNGIetzlJUldJ9JYsw%2FsqB0QY6mAHdM5jj%2BrGQv4hVdRtCI1J0Yl3sJaxIX0ORc6Krnbb2S6d5bCNyrP0f1sactsX7V5wKPbGsKD%2Fi%2FK8vnmG14Y5lYVJo8vJEbrKeKH2tHvbJGu0ev%2B0dA5LcGBbR9suCG%2FAZeIKwIlY9EY%2F1fU%2BjD0yM539ipCPYxIURBFwl87OOcnvXmS1ayBppJ%2B9Zh01dlkA85XIxUQZmSw%3D%3D&Expires=1780511569) - ---
name: F05-persistent-cognitive-memory
spec:
  id: F05
  title: Persistent Cognitive Memory Syste...

8. [F08-interdisciplinary-knowledge-graph.md](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/8515166/700dc7e8-30d8-409c-9e10-c05706da235b/F08-interdisciplinary-knowledge-graph.md?AWSAccessKeyId=ASIA2F3EMEYEZ7FFM75L&Signature=xv3gVXpzQkIqT5TowLBhhUMgrUo%3D&x-amz-security-token=IQoJb3JpZ2luX2VjEHoaCXVzLWVhc3QtMSJHMEUCIAKZzjyp1wqSD9ZtHphNYoto6HRa7UAstoREOq7n6L17AiEA0Ml8tkYoEQ1%2BmnnSYnv9KJLSNMKCXrMtYFOSbZ4vkf8q8wQIQxABGgw2OTk3NTMzMDk3MDUiDJ95nlhTE%2BH9z7uCzCrQBIW%2B93q1wpzhQG64LOwMPn%2BKBJRxVk6oR53apicLdKYuaJrIRDfq%2Bsd9XoaXg0wehGQe9P2aoA5r8F6SPxgGhKElhinTtYpBjGxbQA8K5aK%2FW5OkE1OOIEI%2Ft%2FrKC%2BDGv67MGMmo1WepKphrMiHeuKdNMEx724r9pZxtQxl9K4pBOWqPALPilFzs2CS2uYmDov%2BH2Uf2R0vO5HszhKQ2GAaoSaOTNxFB1jjMNWPM%2FTM%2FekxC18PwKwE6AY6hcfKd5L%2Be9uGgq%2BPiBQSfFc4Rd80mXOfSSLkPLhvF%2B8IvTYo8FPiXt3O5h1W2jCoLp1fgdzmhJWcY86NiFk41hECtRm2uWPrLB5ISEgitkf%2FQwQRFBG8V4lzBUKVcUOhxyl%2F4a3DTrUJwC04SRemQhLX3KGJR6jWoohQm1yV%2Fwa3Y%2Fnd0vBQlpRYtBXVNuqQnHf9aptWSzSNeZ3BoHhN0CXy1J6dsSdNU10z%2FH0kb0wnCCQJ1%2BRNmdhCOsY6q%2FqHOv3knmZl5%2F1e82xuGvmXRUdi8bH%2FI7EmIewrzAaCp3td2iqThd3uWPW9Dlw%2Bfi7wVeYaHiYuw48LkHhHU2GL4ovkbE69qdU77GE01%2Bk74ju8ghQfAfKL8TRBJzsYKnbLxz9TSEyaAr%2Bx2i%2BrzUnJ67OFhjCzxkVg2YxQ9j1%2BO0lZ3IS7THWDY5mosCezxVpmggiKI2ftQDJO7TL3AG8AKDfAVoRZF7cyBogm1EQQkvAlkITqpHlNFYhR9PAqFgnjaeEiNdkwfXDgNGIetzlJUldJ9JYsw%2FsqB0QY6mAHdM5jj%2BrGQv4hVdRtCI1J0Yl3sJaxIX0ORc6Krnbb2S6d5bCNyrP0f1sactsX7V5wKPbGsKD%2Fi%2FK8vnmG14Y5lYVJo8vJEbrKeKH2tHvbJGu0ev%2B0dA5LcGBbR9suCG%2FAZeIKwIlY9EY%2F1fU%2BjD0yM539ipCPYxIURBFwl87OOcnvXmS1ayBppJ%2B9Zh01dlkA85XIxUQZmSw%3D%3D&Expires=1780511569) - ---
name: F08-interdisciplinary-knowledge-graph
spec:
  id: F08
  title: Interdisciplinary Intellige...

9. [F09-living-universe-experience.md](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/8515166/4e65e08e-35ec-4f9d-bb17-aeb0e81e0c54/F09-living-universe-experience.md?AWSAccessKeyId=ASIA2F3EMEYEZ7FFM75L&Signature=cGngX4q78CFTf%2FqqqcD3hh6KZmQ%3D&x-amz-security-token=IQoJb3JpZ2luX2VjEHoaCXVzLWVhc3QtMSJHMEUCIAKZzjyp1wqSD9ZtHphNYoto6HRa7UAstoREOq7n6L17AiEA0Ml8tkYoEQ1%2BmnnSYnv9KJLSNMKCXrMtYFOSbZ4vkf8q8wQIQxABGgw2OTk3NTMzMDk3MDUiDJ95nlhTE%2BH9z7uCzCrQBIW%2B93q1wpzhQG64LOwMPn%2BKBJRxVk6oR53apicLdKYuaJrIRDfq%2Bsd9XoaXg0wehGQe9P2aoA5r8F6SPxgGhKElhinTtYpBjGxbQA8K5aK%2FW5OkE1OOIEI%2Ft%2FrKC%2BDGv67MGMmo1WepKphrMiHeuKdNMEx724r9pZxtQxl9K4pBOWqPALPilFzs2CS2uYmDov%2BH2Uf2R0vO5HszhKQ2GAaoSaOTNxFB1jjMNWPM%2FTM%2FekxC18PwKwE6AY6hcfKd5L%2Be9uGgq%2BPiBQSfFc4Rd80mXOfSSLkPLhvF%2B8IvTYo8FPiXt3O5h1W2jCoLp1fgdzmhJWcY86NiFk41hECtRm2uWPrLB5ISEgitkf%2FQwQRFBG8V4lzBUKVcUOhxyl%2F4a3DTrUJwC04SRemQhLX3KGJR6jWoohQm1yV%2Fwa3Y%2Fnd0vBQlpRYtBXVNuqQnHf9aptWSzSNeZ3BoHhN0CXy1J6dsSdNU10z%2FH0kb0wnCCQJ1%2BRNmdhCOsY6q%2FqHOv3knmZl5%2F1e82xuGvmXRUdi8bH%2FI7EmIewrzAaCp3td2iqThd3uWPW9Dlw%2Bfi7wVeYaHiYuw48LkHhHU2GL4ovkbE69qdU77GE01%2Bk74ju8ghQfAfKL8TRBJzsYKnbLxz9TSEyaAr%2Bx2i%2BrzUnJ67OFhjCzxkVg2YxQ9j1%2BO0lZ3IS7THWDY5mosCezxVpmggiKI2ftQDJO7TL3AG8AKDfAVoRZF7cyBogm1EQQkvAlkITqpHlNFYhR9PAqFgnjaeEiNdkwfXDgNGIetzlJUldJ9JYsw%2FsqB0QY6mAHdM5jj%2BrGQv4hVdRtCI1J0Yl3sJaxIX0ORc6Krnbb2S6d5bCNyrP0f1sactsX7V5wKPbGsKD%2Fi%2FK8vnmG14Y5lYVJo8vJEbrKeKH2tHvbJGu0ev%2B0dA5LcGBbR9suCG%2FAZeIKwIlY9EY%2F1fU%2BjD0yM539ipCPYxIURBFwl87OOcnvXmS1ayBppJ%2B9Zh01dlkA85XIxUQZmSw%3D%3D&Expires=1780511569) - --- name F09-living-universe-experience spec id F09 title Living-Universe Experience Immersive Roadm...

10. [Spatial contexts with reliable neural representations support ... - PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC12846921/) - What are the neural properties that make spatial contexts effective scaffolds for storing and access...

11. [Cognitive Load Theory](https://www.sciencedirect.com/topics/psychology/cognitive-load-theory) - Much of this research looks into how people process information effectively, and is based on cogniti...

12. [The links between experiential learning and 4E cognition - PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC11580775/) - In this article, we explore the connections between two distinct approaches: experiential learning (...

13. [Neuroscience of Memory Palaces: A Randomized Controlled Trial Among Remote Artists and Writers](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=5292190) - The memory palace, a spatial mnemonic technique anchored in visuospatial episodic encoding, is well-...

14. [Cognitive Load Theory](https://www.mcw.edu/-/media/MCW/Education/Academic-Affairs/OEI/Faculty-Quick-Guides/Cognitive-Load-Theory.pdf)

15. [The foundations of cognition in perception and action](https://www.sciencedirect.com/science/article/abs/pii/S221194931200004X)

16. [Frontiers | A Virtual Navigation Training Promotes the Remapping of Space in Allocentric Coordinates: Evidence From Behavioral and Neuroimaging Data](https://www.frontiersin.org/journals/human-neuroscience/articles/10.3389/fnhum.2022.693968/full) - Allocentric space representations demonstrated to be crucial to improve visuo-spatial skills, pivota...

17. [An introduction to cognitive load theory - The Education Hub](https://theeducationhub.org.nz/an-introduction-to-cognitive-load-theory/) - The implications of cognitive load theory for learning, and how to design instruction to minimise co...

18. [Embodied Knowing: An Experiential, Contextual, and Reflective Process](https://newprairiepress.org/cgi/viewcontent.cgi?article=2943&context=aerc)

19. [Fig. 5. Hippocampal...](https://pmc.ncbi.nlm.nih.gov/articles/PMC7929507/) - Mnemonic training boosts long-lasting memories, supported by optimized brain processing and consolid...

20. [Working Memory Underpins Cognitive Development, Learning, and ... - PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC4207727/) - Working memory is the retention of a small amount of information in a readily accessible form. It fa...

21. [Learning and Embodied Cognition: A Review and Proposal - Jaclynn V. Sullivan, 2018](https://journals.sagepub.com/doi/full/10.1177/1475725717752550) - The objective of this review is to investigate research in instructional methods and embodied cognit...

22. [Virtual memory palaces: immersion aids recall](https://dl.acm.org/doi/10.1007/s10055-018-0346-3) - ## Abstract

Virtual reality displays, such as head-mounted displays (HMD), afford us a superior spa...

23. [Cognitive Load Theory and its Applications for Learning](https://www.scotthyoung.com/blog/2022/01/04/cognitive-load-theory/) - What makes learning hard? How can we make it easier? Cognitive load theory explains how we learn and...

24. [Frontiers | Translating Embodied Cognition for Embodied Learning in the Classroom](https://www.frontiersin.org/journals/education/articles/10.3389/feduc.2021.712626/full) - In this perspective piece, we briefly review embodied cognition and embodied learning. We then prese...

25. [New insights into how multisensory integration happens in the brain](https://www.news-medical.net/news/20250817/New-insights-into-how-multisensory-integration-happens-in-the-brain.aspx) - It has long been understood that experiencing two senses simultaneously, like seeing and hearing, ca...

26. [Intelligent Tutoring System (ITS): It's applications and ...](https://ijcesen.com/index.php/ijcesen/article/view/4380) - Intelligent Tutoring Systems represent a transformative approach to personalized learning in higher ...

27. [How curiosity drives actions and learning: Dopamine, reward, and information seeking](https://academiccommons.columbia.edu/doi/10.7916/D8V40TX6) - Curiosity drives many of our daily pursuits and interactions; yet, we know surprisingly little about...

28. [Multisensory learning - Wikipedia](https://en.wikipedia.org/wiki/Multisensory_learning) - Multisensory learning is the assumption that individuals learn better if they are taught using more ...

29. [Intelligent Tutoring System](https://www.sciencedirect.com/topics/psychology/intelligent-tutoring-system) - In adaptive learning environments, connecting the source of adaptive instruction, i.e., the learner ...

30. [Intrinsic motivation, curiosity, and learning: Theory and ...](https://www.sciencedirect.com/science/article/abs/pii/S0079612316300589)

31. [Multisensory Learning: Definition & Theories - Video - Study.com](https://study.com/academy/lesson/video/multisensory-learning-definition-theories.html) - Multisensory learning engages multiple senses simultaneously during the educational process. This ap...

32. [A Comprehensive Review of AI-based Intelligent Tutoring ...](https://arxiv.org/html/2507.18882v1)

33. [The psychology and neuroscience of curiosity - PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC4635443/) - Curiosity is a basic element of our cognition, yet its biological function, mechanisms, and neural u...

34. [Unravelling the multisensory learning advantage: Different patterns ...](https://www.sciencedirect.com/science/article/pii/S1053811924000776) - Multisensory learning benefits from an automatic top-down transfer of training, while uni-sensory tr...

35. [Adaptive intelligent tutoring systems for e-learning systems](https://www.sciencedirect.com/science/article/pii/S1877042810006816)

36. [The Emerging Neuroscience of Intrinsic Motivation - PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC5364176/) - Intrinsic motivation refers to people’s spontaneous tendencies to be curious and interested, to seek...

37. [TIMING OF AUDIOVISUAL INPUTS TO THE PREFRONTAL ...](https://pmc.ncbi.nlm.nih.gov/articles/PMC3618972/) - A number of studies have demonstrated that the relative timing of audiovisual stimuli is especially ...

38. [A systematic review of AI-driven intelligent tutoring systems (ITS) in ...](https://pmc.ncbi.nlm.nih.gov/articles/PMC12078640/) - The use of artificial intelligence in education (AIEd) has grown exponentially in the last decade, p...

39. [Intrinsic motivation, curiosity and learning: theory and applications in educational technologies](https://inria.hal.science/hal-01404278/document)

40. [oPhysics](https://ophysics.com) - The oPhysics website is a collection of interactive physics simulations. It is a work in progress, a...

41. [Spaced repetition: how to remember what you have learned](https://www.hastingsschool.com/blog/spaced-repetition-how-to-use-it/) - Learn how to use spaced repetition to reinforce study material and overcome the forgetting curve. Di...

42. [Zooming user interface - Wikipedia](https://en.wikipedia.org/wiki/Semantic_zooming)

43. [Impact of Online Interactive Simulations Integration into Classroom ...](https://dl.acm.org/doi/10.1145/3702163.3702176) - Simulations can enhance physics learning by allowing interactive manipulation of variables and graph...

44. [Spaced Repetition: Conquer the Curve of Forgetting](https://bubblyprofessor.com/2020/02/19/spaced-repetition-conquer-the-curve-of-forgetting/) - If you are studying for a wine or spirits certification you already know that studying takes time. A...

45. [Semantic zoomable Interface](https://www.reddit.com/r/UI_Design/comments/1pnzatf/semantic_zoomable_interface/) - Semantic zoomable Interface

46. [Need help in school? Try these interactive simulations you can use ...](https://www.facebook.com/SetupSpawn/posts/need-help-in-schooltry-these-interactive-simulations-you-can-use-to-learn-chemis/1512495593272857/?locale=he_IL) - 💡Teaching with simulations like PhET labs makes learning more interactive and fun! Students can expe...

47. [Spaced repetition and the 2357 method](https://www.bcu.ac.uk/exams-and-revision/best-ways-to-revise/spaced-repetition) - Seen the phrases spaced repetition and 2357 method but don't know what they mean? We'll cover what t...

48. [Zoomable User Interfaces](https://www.cs.ubc.ca/~tmm/courses/cs533c-02/0310.chrisgray.pdf)

49. [[PDF] Physics education technology (PhET) as a game-based learning tool](https://files.eric.ed.gov/fulltext/EJ1447015.pdf) - Constructively, PhET simulations can serve as tools for students to explore phenomena and understand...

50. [Forgetting curve - Wikipedia](https://en.wikipedia.org/wiki/Forgetting_curve)

51. [Effects of online whiteboard-based collaborative argumentation ...](https://www.sciencedirect.com/science/article/abs/pii/S0360131523001975) - This study has implications for effectively using online whiteboards to support productive argumenta...

52. [1](https://www.cg.tuwien.ac.at/courses/InfoVis/HallOfFame/2004/03_zTimeView/1_03_jazz.pdf)

53. [Learning Science Through Computer Games and Simulations (2011)](https://www.nationalacademies.org/read/13078/chapter/5) - Simulations and Games in the Classroom. This chapter considers the use of simulations and games for ...

54. [How to Remember More of What You Learned With Spaced Repetition - Jack Westin](https://jackwestin.com/resources/blog/how-to-remember-more-of-what-you-learned-with-spaced-repetition) - How to Remember More of What You Learned With Spaced Repetition Learning new information is…

55. [ZOOMABLE USER INTERFACES FOR THE SEMANTIC WEB](https://www.aoml.noaa.gov/ftp/od/library/GorniakADA427274.pdf)

56. [Interactive Graph Visualization and TeamingRecommendation in an ...](https://arxiv.org/abs/2508.19489) - Abstract:Interactive visualization of large scholarly knowledge graphs combined with LLM reasoning s...

57. [Beyond Screens: How Spatial Computing Supports Active Learning ...](https://bodyscratch.academy/btc-blog/beyond-screens-spatial-computing-supports-active-learning)

58. [Interactive Graph Visualization and Teaming Recommendation in an ...](https://dl.acm.org/doi/10.1002/pra2.1359) - Interactive visualization of large scholarly knowledge graphs combined with LLM reasoning shows prom...

59. [Collaborative digital whiteboard solutions – systems and software](https://speechi.com/digital-collaborative-whiteboard-solution-system-software/) - With a digital collaborative whiteboard, teams can sketch, draw diagrams, annotate, and integrate a ...

60. [Knowledge Graph Visualization - Cambridge Intelligence](https://cambridge-intelligence.com/learn/knowledge-graph/) - Knowledge graph visualization gives fraud investigators an intuitive interface to understand complex...

61. [Shared Understanding - Dynamic Graphics Project](https://www.dgp.toronto.edu/public_user/WilliamHunt/qualifier.html) - Distributed cognition focusses on the interaction of people and artifacts, socially shared cognition...

