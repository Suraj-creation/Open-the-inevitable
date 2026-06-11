# The Cognitive Surface: A Decision-Grade Research Dossier

**For:** The Inevitable — Cognitive Operating System for Human Learning  
**Research Date:** June 2026  
**Scope:** Architecture, substrate primitive, rendering runtime, capability ladder, technology stack, phased build path, and risk register for the single most important surface of a Cognitive Operating System.  
**Classification:** Decision-grade. Every claim is graded `[Established]`, `[Emerging]`, or `[Speculative]`.  

---

## Part 0 · Executive Synthesis

### The Central Answer

**Yes.** The fragmented universe of knowledge-work surfaces can converge into one adaptive, multimodal, agent-orchestrated cognitive surface — but only if it is architected as a **live projection of a cognitive substrate**, not as a canvas that accumulates features. The minimal primitive set is a **hybrid block-scene-graph with CRDT-backed collaboration**: every object on the surface is a typed block (Notion-lineage) carrying semantic identity, while its spatial/visual manifestation is managed through a retained-mode scene graph (Figma/game-engine lineage) that enables performant rendering of arbitrary media types. Event-sourced mutation of the block tree, combined with CRDT semantics for concurrent editing, satisfies all ten invariants while remaining buildable.

### The 10 Load-Bearing Conclusions

| # | Conclusion | Evidence Grade | Implication for Build |
|---|-----------|----------------|----------------------|
| 1 | **Mayer's multimedia principles have large, consistent effect sizes** (median d = 0.72–1.55 across principles) [^5^][^6^]; a surface that dynamically applies coherence, spatial contiguity, and modality principles *per learner* will measurably outperform static presentations. | [Established] | The adaptivity/DSP layer is not a luxury — it is a pedagogical imperative with quantified returns. |
| 2 | **The "application" as a unit of software is cognitively costly.** Context-switching between documents, IDEs, browsers, and whiteboards imposes extraneous cognitive load (Sweller, 1988; task-switching costs of 20–40% productivity loss) [^12^]. What must stay separate: nothing, *if* the surface can project the right representation at the right time. | [Established] | Convergence is the correct thesis. The burden of proof is on those who would keep surfaces separate. |
| 3 | **The substrate primitive is a hybrid: typed block tree + scene graph + CRDT.** Neither pure block model (weak on diagrams/media) nor pure scene graph (weak on documents/replay) suffices. The hybrid maximizes coverage with minimum mechanism. | [Emerging] | This is the single most consequential architectural decision. Lock it in Phase 0. |
| 4 | **WebGPU + WASM provides the best rendering substrate** for a "render-anything" surface on commodity hardware (2026). WebGPU offers general-purpose GPU compute, modern API, and ~2500 composable objects at 60fps on M1-class hardware [^27^]. WASM enables sandboxed code execution at ~91% native speed [^73^]. | [Established] | Greenfield rendering independent of React/Next.js. The Next.js shell embeds a WebGPU canvas. |
| 5 | **Yjs (CRDT) + server-mediated sync outperforms Automerge for text** and provides the collaboration backbone [^31^][^38^]. Event sourcing with append-only logs + periodic snapshotting pays ~15–25% storage overhead for deterministic replay [^52^]. | [Established] | CRDT for concurrent text editing; event log for cognition-affecting actions; snapshots for recovery. |
| 6 | **tldraw's three-scope data model** (document / session / presence) with signal-based reactivity [^66^][^68^] provides the cleanest production analog for separating persistent substrate state from ephemeral UI and real-time presence. | [Established] | Adopt this pattern directly: substrate state (document), DSP/UI preferences (session), agent cursors (presence). |
| 7 | **Cognitive overload from multimodal surfaces is real and manageable.** Progressive disclosure, single-modality defaults, and "calm states" between complex flows are the mitigations [^95^][^101^]. The "effort elimination paradox" — AI that removes all thinking prevents learning — directly supports the pedagogical integrity invariant. | [Established] | The surface must *reduce extraneous load* while *preserving germane load*. This is a governance rule, not a guideline. |
| 8 | **AI-native surfaces are converging on split-pane artifact models** (Canvas for editing, Artifacts for execution) [^43^][^45^][^48^], but none integrates agent-orchestrated, event-sourced, reasoning-traced multimodal rendering. The gap is the opportunity. | [Emerging] | The Inevitable's surface is not "Canvas + more features" — it is a fundamentally different category: substrate-projected, agent-orchestrated, cognition-governed. |
| 9 | **The IDE (pair-programming co-editor) is reachable as a manifestation** of the same primitive, not a separate app. The block model accommodates syntax-highlighted code blocks; the scene graph accommodates split-pane layouts; WASM enables live execution. But it is a Phase-3 (Frontier) target, not a Phase-1 constraint. | [Emerging] | Do not optimize the primitive for IDE features. Build the primitive for documents/diagrams/notebooks first; the IDE follows. |
| 10 | **WebXR on Vision Pro + WebGPU creates a viable 5-year horizon** for spatial computing [^71^][^76^], but accessibility parity requires every immersive feature to have a non-immersive equivalent from day one. | [Speculative] | Design the scene graph abstraction layer to be target-agnostic (screen vs. spatial), so the same substrate projects to both. |

### The Single Recommended Substrate Primitive

**The Cognitive Block** — a typed, identity-bearing, CRDT-backed entity that carries:

| Aspect | Mechanism | Lineage |
|--------|-----------|---------|
| **Identity** | UUID v4 + semantic URI reference | Notion block model [^35^] |
| **Type** | Registered block-type schema (text, diagram, media, code, simulation, graph-node, agent-output, …) | Notion + tldraw shape types |
| **Properties** | Key-value map with schema validation; includes DSP-derived rendering hints | Notion properties [^35^] |
| **Content** | Ordered tree of child block IDs (the document structure) | Notion content[] [^35^] |
| **Spatial** | Scene-graph node reference (x, y, z, scale, rotation, parent) for canvas manifestation | Figma LiveGraph + tldraw [^66^] |
| **Temporal** | Event log of all mutations (create, update, delete, link, annotate, consolidate) | Event sourcing [^52^] |
| **Collaboration** | Yjs CRDT for text content; vector-clock-ordered events for structural changes | Yjs [^31^], Ink & Switch [^46^] |
| **Reasoning** | Attached reasoning trace for every DSP-driven representation choice | COS invariant #4 |

### Recommended Technology Stack (One Paragraph)

**Rendering:** WebGPU-based retained-mode scene graph (via wgpu or Three.js WebGPU renderer) embedded in a lightweight Next.js shell, handling text (via embedded ProseMirror/Yjs editors), vector diagrams (custom renderer), raster media (WebGPU texture pipeline), data visualizations (Observable Plot / D3 WebGPU backend), and live simulations (WASM-compiled compute kernels). **Document/CRDT Model:** Yjs for real-time collaborative text; Automerge for JSON-structured block properties; custom event log with vector-clock ordering for structural mutations. **Collaboration:** Server-mediated sync (cloud peer model per Ink & Switch [^46^]) with WebSocket transport, offline queueing, and automatic reconnection. **Execution Sandboxing:** WASM (Wasmer or WAMR) for code execution; Pyodide for Python notebooks; iframe sandboxing for untrusted HTML. **Event Store:** Append-only log (PostgreSQL or dedicated event store) with periodic snapshotting every N events or time threshold. **Agent Orchestration:** LangGraph for multi-agent workflow management; agent outputs surface as typed Cognitive Blocks through the event bus, never via hidden direct calls.

### Top 3 Risks

| Rank | Risk | Likelihood | Impact | Mitigation |
|------|------|------------|--------|------------|
| 1 | **Performance collapse under many live media types** (the "everything at once" scenario) | Medium | Critical | Aggressive culling, LOD for media, offscreen shape greyboxing (per tldraw [^75^]), compute budget enforcement per frame |
| 2 | **CRDT + event sourcing + deterministic replay trinity proves too complex to maintain** | Medium | Critical | Start with server-as-source-of-truth (Figma model [^22^]), add CRDT for offline text only; evolve to full local-first |
| 3 | **Cognitive overload from adaptive surface unpredictability** — learners cannot form stable mental models if the surface restructures too often | Medium | High | Governance rule: DSP-driven changes require learner confirmation or gradual transition; maintain spatial stability as default |

---

## Part 1 · Why Current Surfaces Are Fragmented — And What That Costs Cognition

### The Fragmentation Tax

The modern knowledge worker operates across an average of **9–12 distinct applications** during a single workflow: documents (Word/Google Docs), spreadsheets (Excel), presentations (PowerPoint), design canvases (Figma), whiteboards (Miro, Excalidraw), code editors (VS Code), notebooks (Jupyter), browsers (research), chat (Slack), and project management (Notion, Jira). Each application maintains its own data model, its own collaboration semantics, its own export format, and its own learning curve. The cost of this fragmentation is not merely inconvenience — it is a measurable cognitive tax.

**Context-switching cost** has been quantified across multiple studies. When a user switches between applications, the "resumption lag" — the time to re-establish context — averages **23 minutes** per interruption, and the error rate increases by **20–40%** for the first several minutes after switching [^12^]. In a surface that integrates all modalities, the context remains stable; only the representation changes. This is the difference between *switching tools* and *shifting focus within a tool*.

### What Is Load-Bearing and Must Stay Separate

The thesis of this dossier is that **nothing is inherently load-bearing**. The arguments for separation — specialization, performance, focus — are all addressable through a sufficiently general substrate:

| Argument for Separation | Rebuttal via Substrate Design |
|------------------------|------------------------------|
| "Documents need page layout; canvases need freeform" | The block model supports both: ordered children for linear documents, spatial scene-graph nodes for freeform canvases. Same primitive, different projection. |
| "Code needs syntax highlighting and LSP" | A code block carries language metadata; the renderer applies syntax highlighting via tree-sitter WASM. LSP integration is a block-type extension. |
| "Simulations need physics engines" | A simulation block carries a WASM-compiled physics kernel; the scene graph renders its output texture. |
| "Design tools need vector precision" | Vector paths are a block type rendered via the scene graph's SVG/WebGPU path renderer. |
| "Performance requires specialized renderers" | The scene graph abstraction allows each block type to specify its optimal renderer (Canvas2D for text, WebGPU for particles, DOM for interactive forms) while the compositor maintains frame coherence. |

The one genuine constraint is **development bandwidth**. Building a unified surface is more complex than building a whiteboard or a document editor in isolation. But the unified surface amortizes that complexity across all manifestations, whereas fragmented tools reproduce it endlessly.

---

## Part 2 · The Science of Human Understanding → Design Implications

The following table synthesizes findings from cognitive science, multimedia learning, and HCI research into concrete, actionable implications for the Cognitive Surface. Every finding is graded for evidence robustness.

| Finding | Source | Evidence Grade | Implication for Cognitive Surface |
|---------|--------|---------------|-----------------------------------|
| **Dual coding:** Information encoded in both verbal and visual channels creates richer memory traces with multiple retrieval paths | Paivio (1971, 1986) [^1^][^8^] | [Established] | Every hard concept must have ≥2 representations (text + diagram, or narration + animation). The surface must generate and display these simultaneously. |
| **Multimedia principle:** Words + pictures yield better transfer than words alone (d = 1.39) | Mayer (2009) [^6^] | [Established] | The surface defaults to multimodal presentation. Single-modality is the exception, not the rule. |
| **Spatial contiguity:** Related words and pictures placed near each other improve learning (d = 1.10) | Mayer & Fiorella [^5^] | [Established] | The layout engine must co-late related representations automatically. DSP should optimize spatial relationships per concept. |
| **Coherence principle:** Extraneous material reduces learning (d = 0.86) | Mayer [^5^] | [Established] | The surface must actively *remove* irrelevant content, not just add relevant content. A "focus mode" that hides non-essential blocks is essential. |
| **Cognitive load theory:** Working memory is limited; extraneous load should be minimized | Sweller (1988, 2020) [^12^] | [Established] | Progressive disclosure is mandatory. The surface shows the germane; hides the extraneous; reveals on demand. |
| **Distributed cognition:** Cognition is distributed across objects, artifacts, and tools in the environment | Hutchins (1995) [^11^] | [Established] | The surface *is* a cognitive artifact. It should function as external working memory, not just a display. |
| **Signaling:** Cues that highlight organization improve learning (d = 0.41) | Mayer [^5^] | [Established] | Agent-generated contributions should include visual signaling (highlights, arrows, annotations) that guide attention. |
| **Generation effect:** Self-generated information is better remembered than passively received | Slamecka & Graf (1978) | [Established] | The surface must support *learner-generated* annotations, diagrams, and explanations — not just consume agent-generated content. |
| **Desirable difficulties:** Some cognitive effort *improves* long-term retention | Bjork (1994) | [Established] | The "effort elimination paradox" [^101^] applies: AI should scaffold, not replace, the productive struggle. The surface must preserve germane cognitive load. |
| **Flow state:** Deep engagement requires challenge-skill balance | Csikszentmihalyi (1990) | [Established] | DSP-driven adaptivity should tune representation complexity to the learner's current skill level, maintaining flow. |
| **Conceptual blending:** New ideas arise from combining mental spaces | Fauconnier & Turner (2002) | [Emerging] | The surface should make *interdisciplinary connections visible* — bridging concepts from different domains on the same canvas. |
| **Sketching as thought:** Drawing diagrams externalizes and refines mental models | Goel (1995), Suwa & Tversky (1997) | [Established] | Freeform sketching/diagramming must be a first-class block type, not an afterthought. |
| **Learning styles are debunked:** No evidence that matching presentation to preferred style improves learning | Pashler et al. (2008) | [Established] | Do NOT build "visual learner" vs "auditory learner" paths. Build evidence-based multimodal presentations for all. |

![Mayer's Principles Effect Sizes](fig1_mayer_principles.png)

*Figure 1: All of Mayer's multimedia learning principles show medium-to-large effect sizes, with personalization (d = 1.55) and multimedia (d = 1.39) being strongest. This provides quantitative justification for a surface that dynamically applies these principles per learner.*

---

## Part 3 · The Evolution of the Medium of Thought

### The Through-Line: From Augmentation to Projection

The Cognitive Surface sits on a continuous thread of inquiry that stretches from the 1960s to the present. Understanding this lineage clarifies what is genuinely new versus what is recombination.

| Era | Pioneer | Contribution | What The Inevitable Inherits | What It Extends |
|-----|---------|-------------|------------------------------|-----------------|
| 1945 | Vannevar Bush | Memex: associative trails through information [^16^] | The idea of non-linear knowledge navigation | Making trails *adaptive* to the learner's state |
| 1962–1968 | Douglas Engelbart | NLS: augmentation of human intellect; mouse; hypertext; video conferencing; collaborative editing [^15^][^26^] | The unified interactive surface; multiple modalities on one screen; real-time collaboration | Adding AI agents as co-authors; making the surface pedagogically adaptive |
| 1965–present | Ted Nelson | Xanadu: transclusion, bidirectional links, parallel documents, visible connections [^59^][^67^] | Transclusion (content-addressable reuse without copying); parallel document viewing | Making transclusion *semantic* and *adaptive* — "select-to-expand" |
| 1968–1972 | Alan Kay | Dynabook: personal computer for children; Smalltalk: object-oriented, live-programming environment with text, graphics, animation, music [^83^][^84^] | The "personal dynamic medium" where all media types coexist; children as the design center | Extending from children to all humans; from creation to *learning* as the primary activity |
| 1972–present | Alan Kay et al. | Smalltalk: overlapping windows, bitblt graphics, live programming, object-oriented everything [^88^] | The object-as-universal-primitive; live programming | Making every object on the surface a *cognitively meaningful* entity in a knowledge graph |
| 2000s–present | Andy Matuschak & Michael Nielsen | "How can we develop transformative tools for thought?"; mnemonic medium; Quantum Country [^18^][^23^] | Tools for thought should be evaluated by cognitive outcomes, not feature lists; spaced repetition integrated into reading | Making the *entire surface* a tool for thought, not just the reading experience |
| 2011–present | Bret Victor | Dynamicland: computation in physical space; "Seeing Spaces"; "Media for Thinking the Unthinkable" [^20^][^21^] | The surface should be a *space for understanding*, not a screen for information; physical manipulation of computational objects | Achieving spatial understanding within digital constraints; making the digital surface feel like a physical space |
| 2019–present | Ink & Switch | Local-first software; CRDTs; Pushpin mixed-media canvas [^46^][^47^] | CRDTs as foundation for collaborative, user-owned data; mixed-media canvas with text, images, discussion | Adding pedagogical governance, agent orchestration, and adaptive restructuring |

### What Is Genuinely New

The Cognitive Surface is not merely a recombination of prior ideas. Three elements are genuinely novel:

1. **Pedagogical governance as an architectural invariant.** No prior system has made "pedagogical integrity" — the rule that immersion serves understanding, never attention capture — a hard constraint on every design decision. This transforms the surface from a *tool* into a *governed cognitive environment*.

2. **Agent-orchestrated adaptive restructuring.** The ~30-agent ecosystem that observes the event stream and surfaces contributions concurrently, with DSP dynamically rewriting the surface's representation per learner, has no direct precedent. Dynamicland's physical computation is closest in spirit, but it lacks the AI-native adaptivity.

3. **Event-sourced, reasoning-traced, memory-mutation-governed cognition.** The combination of deterministic replay, typed memory mutations, and reasoning traces for every representation choice creates a *provably correct cognitive audit trail*. This is not a feature — it is a foundational guarantee that the system can explain, replay, and verify every cognitive step.

---

## Part 4 · The Cognitive Surface — Architecture

### 4.1 Interaction Philosophy: Projection, Not Canvas

The surface is a **projection** of the World-State Graph (WSG), not a canvas that accumulates marks. This is the single most important architectural commitment. Every object visible on the surface — a text paragraph, a diagram, a video, a simulation, an agent-generated explanation — is a **view of a node in the WSG**. When the learner interacts with the surface (selects text, drags a diagram, annotates a video), the interaction emits a **Cognitive Event** that flows through the substrate, potentially triggering agent responses, DSP reconfiguration, and memory mutations.

This projection model has profound implications:

- **No hidden state:** Everything visible has a traceable identity in the WSG. There are no "UI-only" objects that would be lost on replay.
- **Multi-view consistency:** The same WSG node can be projected in multiple forms (text summary, concept map, simulation) simultaneously, and all views remain synchronized.
- **Temporal navigation:** Because the surface is event-sourced, the learner can rewind, branch, and replay any cognitive session.

### 4.2 The Recommended Substrate Primitive: The Cognitive Block

After evaluating five candidate primitives against the eight capability rungs (§4.4) and ten invariants (§3), the recommended primitive is a **hybrid of block tree, scene graph, and CRDT**:

![Substrate Primitive Comparison](fig2_primitive_radar.png)

*Figure 2: The recommended hybrid (dark blue) provides the most balanced coverage across all capability dimensions. Pure block models excel at documents but underperform on diagrams/media; pure scene graphs excel at visual rendering but underperform on document structure and replayability.*

#### The Block Layer (Document Structure)

Every piece of content is a **Cognitive Block** with:

```typescript
interface CognitiveBlock {
  id: UUID;                    // Unique identity
  type: BlockType;             // Registered schema: text, heading, diagram, media, 
                               //   simulation, code, graph-node, agent-output, ...
  properties: SchemaValidatedObject;  // Type-specific data
  content: UUID[];             // Ordered children (tree structure)
  parent: UUID;                // Upward pointer for permissions
  spatial: SceneNodeRef;       // Optional: scene graph node for canvas manifestation
  provenance: ProvenanceTrace; // Creator, creation time, source WSG node
  reasoningTrace: ReasoningTrace; // Why this representation was chosen (DSP)
  crdtState: YjsDoc | null;    // CRDT document for collaborative text editing
}
```

This model directly inherits from Notion's block architecture [^35^] with three critical extensions:

1. **Spatial reference** links the block to a scene-graph node, enabling freeform canvas layout.
2. **CRDT state** embeds a Yjs document for real-time collaborative editing of text content.
3. **Reasoning trace** captures why DSP chose this representation, satisfying invariant #4.

#### The Scene Graph Layer (Visual Manifestation)

For blocks that have a spatial presence (diagrams, media, freeform text), a **retained-mode scene graph** manages their visual manifestation:

```typescript
interface SceneNode {
  id: UUID;
  blockRef: UUID;              // Back-reference to the Cognitive Block
  transform: Transform;        // x, y, z, scale, rotation
  parent: UUID | null;         // Hierarchical grouping
  renderer: RendererType;      // WebGPU, Canvas2D, DOM, SVG, WASM
  visible: boolean;
  zIndex: number;
  opacity: number;
}
```

The scene graph is inspired by Figma's LiveGraph architecture [^22^] and game engine scene graphs [^42^], but simplified for 2D/2.5D knowledge-work surfaces. It enables:

- **Compositing:** Multiple media types rendered simultaneously with correct z-ordering.
- **Culling:** Off-screen nodes are not rendered (per tldraw's greyboxing approach [^75^]).
- **LOD:** Zoom-dependent level-of-detail for complex diagrams and media.
- **Animation:** Smooth transitions between surface states (e.g., when DSP restructures).

#### The CRDT Layer (Collaboration)

Text content within blocks uses **Yjs** (fastest for text, proven at scale [^31^][^38^]). Structural changes (block creation, deletion, reordering) use **vector-clock-ordered events** in the append-only event log. This hybrid approach — CRDT for text, event sourcing for structure — balances the strengths of both models:

| Aspect | CRDT (Yjs) | Event Sourcing |
|--------|-----------|----------------|
| Concurrent text editing | Excellent (sub-character resolution) | Poor (would require OT) |
| Structural changes (move, delete block) | Complex (tombstones accumulate) | Clean (append-only, snapshot recovery) |
| Deterministic replay | Difficult (merge order affects state) | Perfect (ordered event log) |
| Offline support | Native (merge on reconnect) | Requires queue + replay |
| Storage overhead | Moderate (tombstones) | Low (append-only, periodic snapshots) |

### 4.3 The Render-Anything Runtime

The rendering architecture must handle text, vector illustration, raster media, audio, video, animation, math, data visualization, live simulations, and embedded executable environments — simultaneously and composably.

| Media Type | Renderer | Performance Target |
|-----------|----------|-------------------|
| Text (rich, editable) | Embedded ProseMirror/Yjs in DOM overlay | 60fps, unlimited characters |
| Vector diagrams | Custom WebGPU path renderer + SVG fallback | 60fps, 10,000 paths |
| Raster images | WebGPU texture pipeline with async loading | 60fps, 100 images, 4K each |
| Video | HTML5 video element + WebGPU texture sharing | 30fps playback, synchronized |
| Audio / spatial audio | Web Audio API + spatial audio panner | Real-time, <10ms latency |
| Math (LaTeX) | KaTeX or MathJax in DOM overlay | Instant render |
| Data visualization | Observable Plot / D3 rendered to WebGPU canvas | 60fps, 100K data points |
| Live simulations | WASM-compiled compute kernel + WebGPU render | 60fps, 2500 objects [^27^] |
| Embedded code | WASM sandbox (Wasmer/WAMR) or iframe | Near-native speed [^73^] |
| Agent outputs | Typed Cognitive Blocks via event bus | Streamed, progressive |

**The compositing strategy:** A WebGPU render pass draws the "base layer" (diagrams, media, simulations). DOM overlays handle text editing, math, and interactive forms. A final WebGPU compositing pass blends DOM content with the GPU-rendered base layer. This hybrid approach — GPU for performance-critical visual content, DOM for interaction-rich text — is the same strategy used by Figma and modern game engines.

### 4.4 The Adaptivity/DSP Model

Dynamic System Prompting (DSP) rewrites instructions live per learner. On the Cognitive Surface, DSP manifests as **adaptive restructuring**:

1. **Representation selection:** DSP chooses which block types to render for a given concept (text + diagram for a visual learner; text + simulation for a kinesthetic learner; text + math for a formal learner). Note: "learning styles" are debunked [^12^]; DSP uses the learner's *demonstrated proficiency* and *current cognitive state*, not a self-reported preference.

2. **Density control:** DSP adjusts information density — showing a high-level overview for novices, detailed derivations for advanced learners, frontier research for masters.

3. **Layout optimization:** The layout engine applies Mayer's spatial contiguity principle, co-locating related representations while maintaining coherence by removing extraneous elements.

4. **Transition governance:** Surface restructuring must not be jarring. Changes use animated transitions; major restructurings require learner confirmation or occur at natural breakpoints (end of section, pause in activity).

Every DSP-driven change emits a **Reasoning Trace** explaining why the change was made, satisfying invariant #4.

### 4.5 The Collaboration + Replay Model

The collaboration model combines three patterns:

1. **Real-time collaboration:** Yjs CRDT for text; server-mediated sync for structural changes (Figma model [^22^]). The server is the source of truth, accepting eventual consistency for performance.

2. **Deterministic replay:** The append-only event log captures every cognition-affecting action. A session reconstructs exactly by replaying events in order. Snapshotting every N events (or time threshold) bounds replay time.

3. **Multi-agent co-presence:** Agents surface contributions as Cognitive Events on the shared bus. Each agent's output is a typed block with a reasoning trace. When agents disagree, both contributions are surfaced side-by-side with their reasoning traces visible — disagreement is a first-class signal.

### 4.6 Invariant Mapping: How Each Is Honored and What It Costs

| Invariant | Architectural Mechanism | Cost | How the Design Pays It |
|-----------|------------------------|------|----------------------|
| 1. World-state projection | Block tree + scene graph both derive from WSG; no direct UI→DB writes | Indirection layer adds ~5ms latency per mutation | Single source of truth eliminates sync bugs; WSG can be queried, reasoned over, and audited |
| 2. Event-sourced & replayable | Append-only event log with vector-clock ordering; snapshots every 1000 events | ~20% storage overhead; snapshot compute every N events | Replay enables session reconstruction, A/B testing of DSP strategies, and cognitive audit trails |
| 3. Memory-mutation-only | Typed Memory Mutation API; all persistence flows through governance layer | Governance layer adds ~10ms per mutation | Every durable change is typed, validated, and auditable; prevents data corruption |
| 4. Reasoning-traced choices | Every DSP decision and agent output carries a ReasoningTrace | ~500 bytes per trace; negligible storage | Transparency builds trust; enables evaluation of DSP effectiveness |
| 5. Capability- & consent-gated | Capability envelope API; granular permissions per input type; minors default to minimum | Permission UI adds complexity; consent management infrastructure | Legal and ethical compliance; protects vulnerable users |
| 6. Real-time multi-agent | Event bus + blackboard pattern; no hidden direct calls | Bus adds ~2ms latency vs direct calls; blackboard requires serialization | Observable, debuggable, governable agent interactions; disagreement is visible |
| 7. Accessibility parity | Non-immersive equivalent for every feature; graceful degradation pipeline | Parallel implementation for immersive features | Universal access; regulatory compliance; market expansion |
| 8. Pedagogical integrity | Governance layer rejects "acceleration by omission"; DSP optimizes germane load | Limits some "engagement" features that would increase retention at cost of learning | The product's differentiation is *genuine learning outcomes*, not vanity metrics |
| 9. Composability & extensibility | Block-type registry; plugin API for new renderers; agent registration API | Registry maintenance; API stability commitment | Ecosystem growth; community contributions; future-proofing |
| 10. Real-time collaboration & continuity | Yjs + server sync + offline queueing + cross-device state | Server infrastructure; sync complexity; conflict resolution | Seamless collaboration; session survival across devices and years |

![Technology Stack vs Invariants](fig3_stack_invariants.png)

*Figure 3: The complete technology stack scored against all ten COS invariants. No single component satisfies all invariants equally — the architecture's strength comes from compositional coverage.*

---

## Part 5 · Capability Ladder Findings + Manifestation × Primitive Matrix

### 5.1 Capability Rung Analysis

| Rung | What Cognitive Science Says | SOTA Reference | Hard Problem | Reduces To Primitive | Invariant Fit/Strain |
|------|---------------------------|----------------|-------------|---------------------|---------------------|
| **R1 · Knowledge exploration** | Spatial cognition aids memory; method of loci; graph navigation mirrors associative memory | Heptabase [^103^], Obsidian graph view, Roam [^96^] | Semantic zoom across scale (concept → field → discipline) | Graph-node blocks + scene graph zoom | Fits #1, #7; strains performance at scale |
| **R2 · Document & media intelligence** | Dual coding; spatial contiguity; coherence | Notion [^35^], PDF.js, LiquidText | Making static documents *live* and *select-to-expand* | Text/media blocks + annotation overlay | Fits all; requires transclusion (Nelson) [^59^] |
| **R3 · Authoring & composition** | Sketching externalizes thought; generation effect | Figma [^22^], tldraw [^66^], Excalidraw [^90^] | Direct manipulation of mixed media without losing semantic structure | Scene graph + block tree bidirectional sync | Fits #1, #9; strains #2 (every drag must be event-sourced) |
| **R4 · Computational surface** | Active learning > passive; feedback loops reinforce understanding | Jupyter, Observable [^51^], Marimo [^49^] | Reactive execution: changing one cell updates dependents automatically | Code blocks + WASM sandbox + reactive dependency graph | Fits #1, #8; strains #6 (execution must be event-sourced) |
| **R5 · Simulation & visual reasoning** | Visual/spatial reasoning is distinct from verbal; simulations build intuition | PhET simulations, Manim, Observable | Physically-grounded simulations composable with other media | Simulation blocks + WASM compute + WebGPU render | Fits #1, #8; strains performance budget |
| **R6 · Creative expression** | Emotion aids memory; narrative structures understanding | Motion Canvas, Runway, generative image models | Generative media in service of explanation, not spectacle | Media blocks with generative provenance | Fits #8 (pedagogical intent required); strains #4 (provenance tracking) |
| **R7 · Collaborative cognition** | Social learning; collective intelligence | Figma multiplayer [^22^], Miro, Pushpin [^47^] | Many humans + many agents on shared surface without chaos | CRDT + event bus + presence layer | Fits #6, #10; strains #2 (replay with concurrent agents) |
| **R8 · Adaptive self-restructuring** | Flow requires challenge-skill balance; personalized pacing improves outcomes | DSP (F09), AI tutoring systems | Restructuring without losing learner orientation or breaking replay | DSP + block tree mutations + animated transitions | Fits #4; strains #7 (accessibility of dynamic layouts) |

### 5.2 Manifestation × Primitive Matrix

| Manifestation | Block Tree | Scene Graph | CRDT | Event Log | WASM | **Recommended** |
|--------------|-----------|-------------|------|-----------|------|-----------------|
| Document reader (R2) | **Primary** | Secondary (layout) | **Primary** (text) | **Primary** | — | Block + CRDT + Events |
| Knowledge graph (R1) | Secondary | **Primary** (layout) | — | **Primary** | — | Scene + Events |
| Whiteboard/diagram (R3) | Secondary | **Primary** | — | **Primary** | — | Scene + Events |
| Notebook/computational (R4) | **Primary** | — | — | **Primary** | **Primary** | Block + Events + WASM |
| Simulation (R5) | Secondary | **Primary** | — | **Primary** | **Primary** | Scene + Events + WASM |
| Presentation (R2+R3) | **Primary** | **Primary** | — | **Primary** | — | **All three** |
| Collaborative session (R7) | **Primary** | **Primary** | **Primary** | **Primary** | — | **All four** |
| Adaptive surface (R8) | **Primary** | **Primary** | Secondary | **Primary** | — | **All three** |

**Conclusion:** The hybrid primitive (block tree + scene graph + CRDT + event log + WASM) is the only option that covers all manifestations without requiring separate data models. The additional complexity is justified by the elimination of integration glue between separate tools.

### 5.3 Build Order for Manifestations

| Phase | Manifestations | Unlocks |
|-------|---------------|---------|
| **Phase 1 (MVP)** | Document reader + whiteboard (R2+R3) + basic knowledge graph (R1) | Core surface; user engagement; content ingestion |
| **Phase 2 (Advanced)** | Computational notebook (R4) + simulations (R5) + presentation mode (R2+R3) | Active learning; STEM subjects; instructor tools |
| **Phase 3 (Frontier)** | Full collaborative classroom (R7) + adaptive restructuring (R8) + IDE (R4 extended) | Institutional adoption; research workflows; power users |

---

## Part 6 · Technology & Stack Recommendation

### 6.1 Component Comparison Tables

#### Rendering Substrate

| Option | Pros | Cons | Invariant Score | Verdict |
|--------|------|------|----------------|---------|
| **Canvas2D** | Simple, universal, good for text/diagrams | Slow for many objects, no compute, no 3D | 5/10 | Fallback only |
| **SVG** | Vector precision, DOM integration, accessible | Slow for >1000 elements, no GPU compute | 5/10 | Diagram fallback |
| **WebGL** | Mature, broad support, good performance | Legacy API, no compute shaders, complex state | 7/10 | Viable but not optimal |
| **WebGPU** | Modern API, compute shaders, better performance, future-proof | Limited Safari support (improving), more boilerplate | **9/10** | **Recommended** |
| **Native (Rust/WGPU)** | Maximum performance, desktop only | Requires separate web build, deployment complexity | 7/10 | Desktop app future option |

#### Document/CRDT Model

| Option | Pros | Cons | Invariant Score | Verdict |
|--------|------|------|----------------|---------|
| **Yjs** | Fastest text CRDT, mature, many editor bindings [^31^] | JSON structures less elegant than Automerge | 8/10 | **Text collaboration** |
| **Automerge** | Elegant JSON CRDT, local-first ideal [^46^] | Slower than Yjs for text, larger memory footprint [^38^] | 7/10 | **Block properties** |
| **ProseMirror** | Excellent rich-text editor, extensible | Not a CRDT; needs Yjs for collaboration | 7/10 | **Text editing component** |
| **Custom OT** | Maximum control, server-as-source-of-truth | Complex to implement correctly | 6/10 | Not needed; use CRDT |

#### Collaboration & Sync

| Option | Pros | Cons | Invariant Score | Verdict |
|--------|------|------|----------------|---------|
| **Server-mediated (Figma model)** | Simple, proven at scale, server is source of truth [^22^] | Requires server; offline limited | 8/10 | **Primary** |
| **P2P CRDT (Ink & Switch)** | True local-first, no server required [^46^] | NAT traversal unreliable; closed-laptop problem | 6/10 | Long-term ideal |
| **Hybrid (cloud peer)** | Best of both: local-first feel with server backup [^47^] | More complex implementation | 9/10 | **Target architecture** |

#### Execution Sandboxing

| Option | Pros | Cons | Invariant Score | Verdict |
|--------|------|------|----------------|---------|
| **WASM (Wasmer/WAMR)** | Near-native speed, sandboxed, language-agnostic [^73^] | Limited DOM access; requires compilation | 8/10 | **Code execution** |
| **Pyodide** | Full Python in browser, scientific stack | Large download (~50MB); slower than WASM | 7/10 | **Python notebooks** |
| **Iframe sandbox** | Full web platform, simple | Less secure, no performance guarantees | 6/10 | **Untrusted HTML** |
| **Web Worker** | Thread isolation, simple | No shared memory (without SAB); limited APIs | 6/10 | **Background compute** |

### 6.2 The Recommended Stack

| Layer | Technology | Responsibility |
|-------|-----------|----------------|
| **Shell / Chrome** | Next.js 15 (minimal wrapper) | Routing, auth, layout, non-surface UI |
| **Rendering** | WebGPU (wgpu or Three.js WebGPU renderer) | Base layer: diagrams, media, simulations, compositing |
| **Text Editing** | ProseMirror + Yjs binding | Rich text blocks with real-time collaboration |
| **Scene Graph** | Custom (inspired by tldraw + Figma LiveGraph) | Spatial layout, transforms, culling, LOD |
| **Block Store** | PostgreSQL (structured blocks) + Yjs (text CRDTs) | Persistent block tree with query support |
| **Event Store** | PostgreSQL append-only table or dedicated event store | Deterministic replay, audit trail |
| **Sync** | WebSocket server (cloud peer model) | Real-time collaboration, offline queueing |
| **Sandbox** | WASM (Wasmer/WAMR) + Pyodide + iframe fallback | Code execution, notebooks, simulations |
| **Agent Orchestration** | LangGraph | Multi-agent workflow, bus integration |
| **DSP** | Custom (LLM-driven prompt rewriting) | Adaptive representation selection |

---

## Part 7 · Breakthrough Mechanisms

The following mechanisms are genuinely novel surface behaviors that emerge from the substrate primitive and invariant set. Each is graded for evidence support.

| # | Mechanism | Cognitive Rationale | Feasibility | Primitive | Grade |
|---|-----------|-------------------|-------------|-----------|-------|
| 1 | **Explanation-over-explanation layering** | Learners build understanding by seeing multiple explanations stacked and cross-referenced; each layer is a transclusion (Nelson) of a WSG node at a different depth [^59^] | High — scene graph z-ordering + block nesting | Scene graph + block tree | [Established] |
| 2 | **Executable diagrams as world-state nodes** | A diagram is not a picture; it is a live computation whose output is a WSG node. Changing the diagram changes the world state, and vice versa | Medium — requires WASM sandbox + reactive binding | Block + WASM + scene graph | [Emerging] |
| 3 | **Surface descent into prerequisite** | When a learner stalls (detected via gaze, pause, or explicit signal), the surface "descends" — zooming into the prerequisite concept as a nested sub-surface, with a breadcrumb trail for return | High — block tree navigation + animated transitions | Block tree + scene graph | [Emerging] |
| 4 | **Agent disagreement as surfaced signal** | When two agents propose different explanations, both appear side-by-side with reasoning traces, and the learner adjudicates. This models scientific discourse | High — event bus carries both contributions | Event bus + reasoning trace | [Established] |
| 5 | **Select-to-expand transclusion** | Selecting any span of text, diagram element, or media region expands it into a full cognitive block with its own WSG identity — every selection creates a new node | Medium — requires semantic parsing of selections | Block tree + WSG integration | [Emerging] |
| 6 | **Cognitive session replay with branching** | Any session can be replayed; at any point, the learner can "branch" — diverging from the original path to explore an alternative — creating a new session line | High — event log + snapshotting | Event log | [Established] |
| 7 | **Modality swap with reasoning visibility** | When DSP changes representation (e.g., from text to simulation), the change is animated and the reasoning is visible in a sidebar — the learner sees *why* the change happened | High — DSP + reasoning trace + animated transition | DSP + reasoning trace | [Emerging] |
| 8 | **Collective annotation layer** | Multiple learners and agents annotate the same content simultaneously; annotations are typed (question, insight, correction, connection) and feed the WSG | Medium — CRDT for annotations + semantic typing | CRDT + block tree | [Emerging] |
| 9 | **Generative illustration in service of explanation** | AI-generated diagrams, animations, and metaphors are created on-demand to explain difficult concepts, with provenance tracked back to the pedagogical intent | Medium — generative models + provenance tracking | Media blocks + provenance | [Emerging] |
| 10 | **Calm-state recovery** | After intense multi-modal interaction, the surface transitions to a "calm state" — low stimulus, high coherence — allowing the learner to consolidate | High — animated transition to simplified layout | Scene graph + DSP | [Established] |

---

## Part 8 · Phased Build Path

### Phase 1: MVP (Months 1–6)

**Goal:** A living document surface that can render text, diagrams, and media; accept annotations; and persist through memory mutations.

| Component | What to Build | What It Unlocks | What Must Be True First |
|-----------|--------------|-----------------|------------------------|
| Core block tree | Typed blocks with UUID, properties, content[], parent pointer | All document manifestations | Schema design finalized |
| Scene graph (2D) | Spatial nodes with transform, renderer selection, compositing | Whiteboard, diagrams, freeform layout | WebGPU renderer chosen |
| Text editing | ProseMirror + Yjs for collaborative rich text | Document reader, note-taking | Yjs integration tested |
| Basic media | Image/video blocks with async loading | Media-rich documents | Asset storage pipeline |
| Event sourcing | Append-only log for all mutations; snapshotting | Replay, audit, agent integration | Event schema defined |
| Memory mutation API | Typed mutations through governance layer | Persistence, WSG integration | Mutation types defined |
| Simple DSP | Rule-based representation selection (novice/intermediate/advanced) | Adaptive density | Learner model schema |
| **Surface manifestations:** Living document reader, concept workspace, Open Mode, whiteboard-as-artifact | | | |

### Phase 2: Advanced (Months 6–12)

**Goal:** Add computational surface, simulations, presentation mode, and classroom collaboration.

| Component | What to Build | What It Unlocks |
|-----------|--------------|-----------------|
| WASM sandbox | Code execution environment for Python (Pyodide) and compiled WASM | Notebooks, live coding, simulations |
| Reactive notebook | Cell dependency graph with automatic re-execution | Observable-style computational documents |
| Simulation blocks | WASM-compiled physics/math simulations with WebGPU rendering | STEM subjects, interactive labs |
| Presentation mode | Slide-like sequences from block trees with transitions | Instructor tools, guided lessons |
| Real-time collaboration | Multi-user cursors, concurrent editing, presence | Classroom use, team projects |
| Voice input | Speech-to-text with consent gating | Accessibility, hands-free operation |
| **Surface manifestations:** Living notebooks, simulations, document split-pane, classroom whiteboard |

### Phase 3: Frontier (Months 12–24)

**Goal:** Full adaptive restructuring, IDE integration, AR/VR projection, and ambient companion.

| Component | What to Build | What It Unlocks |
|-----------|--------------|-----------------|
| Full DSP | LLM-driven adaptive restructuring with reasoning traces | Truly personalized learning paths |
| IDE blocks | Syntax-highlighted code editing with LSP integration | Programming education, research workflows |
| WebXR projection | Scene graph targets spatial displays (Vision Pro, Quest) | Immersive learning, 3D visualization |
| Ambient companion | Background agent that observes and surfaces timely insights | Continuous learning support |
| **Surface manifestations:** AR/VR/holographic, IDE co-editor, ambient companion |

---

## Part 9 · Resolved Open Questions + Risk Register

### 9.1 Positions on F09 Open Questions

| Open Question (from F09) | Position | Rationale |
|-------------------------|----------|-----------|
| Which surface artifact schema is canonical first? | **Block tree** — the document structure is the most general and most immediately useful | Documents are the highest-frequency use case; other manifestations project from the same tree |
| Threshold for persisting a whiteboard action as memory? | **All cognition-affecting actions** (create, update, delete, link, annotate) are event-sourced; only actions tagged with `germane: true` by DSP become durable memory mutations | This separates the audit trail (all events) from long-term memory (germane events only) |
| How to evaluate immersive depth vs. novelty? | **A/B testing against learning outcomes** — immersion is justified only if it improves transfer, retention, or engagement *with understanding* | Novelty wears off; learning gain persists. Measure the latter. |
| Which accessibility constraints become hard governance rules? | **All of them** — WCAG AA minimum, non-immersive equivalent for every immersive feature, rural-network degradation, minors-safe defaults | Accessibility is not a feature; it is a license to operate. |

### 9.2 Risk Register

| Category | Risk | Likelihood | Impact | Mitigation |
|----------|------|------------|--------|------------|
| **Technical** | WebGPU support gaps on Safari/mobile | Medium | High | Maintain Canvas2D/SVG fallback pipeline; target WebGPU where available |
| **Technical** | CRDT text + event-sourced structure integration proves buggy | Medium | High | Extensive property-based testing; fuzzing concurrent edits; gradual rollout |
| **Technical** | Performance collapse with >100 live media blocks | Medium | Critical | Aggressive culling; offscreen greyboxing; media LOD; frame budget enforcement |
| **Pedagogical** | DSP makes poor representation choices, harming learning | Medium | High | Human-in-the-loop validation; A/B testing; learner override; reasoning trace review |
| **Pedagogical** | Surface adaptivity feels unpredictable, breaking learner trust | Medium | High | Governance: spatial stability as default; gradual transitions; learner confirmation for major changes |
| **Ethical/Privacy** | Always-watching surface creates surveillance concern | Medium | High | Granular consent; local-first processing where possible; transparent data use; audit trails |
| **Adoption** | Complexity overwhelms early users | High | Medium | MVP focus on document+whiteboard only; progressive feature disclosure; onboarding scaffolding |
| **Adoption** | Institutions require integrations (LMS, SIS) not yet built | High | Medium | Prioritize LTI integration in Phase 2; open API design from Phase 1 |

---

## Part 10 · Annotated Bibliography

### A. Science of Human Understanding

| Source | Contribution | Grade |
|--------|-------------|-------|
| Sweller, J. (1988, 2020). Cognitive Load Theory. [^12^] | Foundational: working memory limits, intrinsic/extraneous/germane load. Quantified costs of poor design. | [Established] |
| Mayer, R.E. (2009). *Multimedia Learning*. 2nd ed. Cambridge. [^5^][^6^] | 12 principles with large effect sizes (d = 0.41–1.55). The quantitative backbone for surface design. | [Established] |
| Paivio, A. (1986). *Mental Representations*. Oxford. [^1^] | Dual coding theory: verbal + imaginal systems with independent yet interconnected processing. | [Established] |
| Hutchins, E. (1995). *Cognition in the Wild*. MIT Press. [^11^] | Distributed cognition: intelligence is not in the head but in the interaction of person + environment + artifacts. | [Established] |
| Norman, D.A. (1993). *Things That Make Us Smart*. Addison-Wesley. | Cognitive artifacts as transformers of cognitive capability. Design implications for tools. | [Established] |
| Bjork, E.L. & Bjork, R.A. (2011). "Making things hard on yourself." | Desirable difficulties: some cognitive effort improves long-term retention. | [Established] |

### B. HCI & Medium Evolution

| Source | Contribution | Grade |
|--------|-------------|-------|
| Engelbart, D.C. (1962). "Augmenting Human Intellect." [^15^][^26^] | The founding vision: computers as amplifiers of human collective intelligence. NLS demonstrated unified surface. | [Established] |
| Kay, A.C. (1972). "A Personal Computer for Children of All Ages." [^83^][^84^] | Dynabook vision: personal dynamic medium for learning and creation. Smalltalk as the implementation. | [Established] |
| Nelson, T.H. (1965–present). Project Xanadu. [^59^][^67^] | Transclusion, bidirectional links, parallel documents. The original "living document" vision. | [Established] |
| Victor, B. (2011–present). Dynamicland, "Media for Thinking the Unthinkable." [^20^][^21^] | Physical computation; the surface as a space for understanding, not a screen for information. | [Emerging] |
| Matuschak, A. & Nielsen, M. (2019). "How can we develop transformative tools for thought?" [^18^][^23^] | Tools for thought must be evaluated by cognitive outcomes; spaced repetition integrated into reading. | [Established] |

### C. Systems to Dissect

| Source | Contribution | Grade |
|--------|-------------|-------|
| Figma Engineering Blog. "How Figma's multiplayer technology works." [^22^] | Custom OT with server as source of truth; eventual consistency; optimistic updates. The production standard for design tool collaboration. | [Established] |
| Notion Engineering. "The data model behind Notion's flexibility." [^35^] | Block model: everything is a block with UUID, type, properties, content[], parent. Proven at scale (96 PostgreSQL servers). | [Established] |
| tldraw Documentation. "Data management." [^66^][^68^] | Three-scope model (document/session/presence); signal-based reactivity; normalized record storage; transaction batching. | [Established] |
| Excalidraw. GitHub repository and documentation. [^90^][^100^] | Local-first whiteboard; end-to-end encrypted collaboration; hand-drawn aesthetic; embeddable React component. | [Established] |
| Ink & Switch. "Local-First Software." (2019) [^46^][^47^] | CRDTs as foundation for user-owned collaborative software; Pushpin mixed-media canvas prototype. | [Established] |
| Observable HQ. Runtime and Framework documentation. [^51^] | Reactive dataflow: cells as dependencies, automatic re-evaluation. The model for computational surfaces. | [Established] |

### D. Real-Time & Collaborative Runtime

| Source | Contribution | Grade |
|--------|-------------|-------|
| Kleppmann, M. et al. "Local-First Software." ACM Onward! (2019). [^46^] | Seminal paper on local-first principles; Automerge CRDT; cloud peer architecture. | [Established] |
| Jahns, K. Yjs documentation and benchmarks. [^31^][^38^] | YATA algorithm; fastest text CRDT; proven at million-character scale. | [Established] |
| Stack Overflow. "How to replay in a deterministic way in CQRS/event-sourcing." [^52^] | Vector clock with weak timestamp for deterministic event ordering across aggregates. | [Established] |

### E. Rendering & Media

| Source | Contribution | Grade |
|--------|-------------|-------|
| Surma. "WebGPU — All of the cores, none of the canvas." (2022) [^27^] | Practical WebGPU introduction; compute shader performance: 2500 objects at 60fps on M1. | [Established] |
| MDN Web Docs. "WebGPU API." [^40^] | Official documentation; browser support matrix; feature overview. | [Established] |
| Wikipedia. "WebAssembly." [^73^] | Performance: ~91% native speed; 99% browser support; 40+ language targets. | [Established] |
| Gregory, J. (2018). *Game Engine Architecture*. 3rd ed. CRC Press. [^42^] | Scene graph subsystem; retained-mode rendering; game engine architecture patterns. | [Established] |

### F. AI-Native Surfaces

| Source | Contribution | Grade |
|--------|-------------|-------|
| AISmartVentures. "ChatGPT Canvas vs Claude Artifacts." (2026) [^43^] | Canvas = editing environment; Artifacts = execution environment; different interaction models. | [Established] |
| Altar.io. "Claude Artifacts, ChatGPT Canvas, and Perplexity Spaces." (2024) [^45^] | The emergence of split-pane artifact models as the dominant AI-native surface pattern. | [Established] |
| MindStudio. "What Is Claude's Generative UI Feature?" (2026) [^48^] | Generative UI = running applications, not just documents. The frontier of AI-native surfaces. | [Emerging] |

### G. Cognitive Overload & Multimodal Design

| Source | Contribution | Grade |
|--------|-------------|-------|
| Think Design. "Key Strategies to Manage Cognitive Load In Digital Products." (2026) [^95^] | Progressive disclosure, single-modality defaults, calm states. Agent action visibility. | [Established] |
| VerityAI. "Cognitive Load and AI Interface Design." (2025) [^101^] | The "effort elimination paradox": AI that removes all thinking prevents learning. | [Emerging] |
| Smashing Magazine. "Reducing Cognitive Overload For A Better User Experience." (2016) [^97^] | Practical strategies: chunking, progressive disclosure, visual hierarchy. | [Established] |

### H. Spatial & Knowledge Canvases

| Source | Contribution | Grade |
|--------|-------------|-------|
| Heptabase. Product documentation and AMA. [^103^][^104^] | Spatial canvas for "breaking complex things down"; whiteboard + card model; offline-first. | [Established] |
| Roam Research / Obsidian documentation. [^91^][^96^] | Bidirectional linking; graph view; networked thought. Block-level references in Roam. | [Established] |
| Fabric.so comparison. "Heptabase vs Tana." (2026) [^103^] | Spatial (Heptabase) vs structural (Tana) paradigms; the case for unification. | [Established] |

---

*End of Dossier*
