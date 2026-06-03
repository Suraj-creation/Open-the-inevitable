---
title: "The Cognitive Surface — Frontier Research Dossier"
domain: research
status: synthesized
owner: product-architecture
last_reviewed: 2026-06-04
commission: spec/research/cognitive-surface-deep-research-prompt.md
feeds:
  - product/features/F16-cognitive-surface
  - product/features/F09-living-universe-experience
  - product/Broader-feature-product
semantic_tags:
  [research, cognitive-surface, whiteboard, substrate-primitive, crdt, event-sourcing, replay,
   webgpu, multimodal, tools-for-thought, cognitive-load, dual-coding, generative-ui, immersive]
method: "deep-research harness (fan-out web search → fetch → verify) + analyst synthesis"
---

# The Cognitive Surface — Frontier Research Dossier

> **What this is.** The decision-grade research output of the commission in
> [`cognitive-surface-deep-research-prompt.md`](./cognitive-surface-deep-research-prompt.md). It is
> the evidentiary spine of feature spec **[F16 — The Cognitive Surface](../product/features/F16-cognitive-surface.md)**
> and updates to [F09](../product/features/F09-living-universe-experience.md) and the
> [master PRD](../product/Broader-feature-product.md).

## Method & integrity note (read first)

This dossier was produced by the `deep-research` harness (6 search angles → 31 sources → 87
extracted claims) **plus** analyst synthesis. **The harness's automated adversarial-verification
stage failed as a tooling artifact** — every verifier subagent abstained (recorded as `0-0
(3 abstain)`), so the pipeline defaulted all 25 verified claims to "killed." Those claims are *not*
refuted; they come from primary sources (Pashler et al., Mayer, Bjork & Bjork, Figma, Notion,
Marimo, Ink & Switch, Akka). **Evidence grades below are the analyst's, applied directly to the
primary sources**, not the harness's (broken) verdict. Grades: `[Established]` (replicated /
widely deployed), `[Emerging]` (promising, limited evidence), `[Speculative]` (extrapolation).
Where a claim rests on canonical work the harness failed to fetch (Engelbart, Victor, Hutchins),
it is cited from the established literature and graded conservatively.

---

## PART 0 — EXECUTIVE SYNTHESIS

**The ten load-bearing conclusions.**

1. **Convergence is justified at the *substrate* layer, not the *application* layer.** The evidence
   does not support "one app that is also an IDE and a Canva." It strongly supports **one
   representational substrate from which many task-specialized *manifestations* are projected** —
   exactly how Notion projects text, media, databases, and pages from a single `block` primitive.
   `[Established]` for the substrate claim; `[Speculative]` for full UX convergence.

2. **The recommended substrate primitive is a hybrid: a *typed polymorphic block/entity* whose
   instances are flat property maps, projected three ways** — as a **scene graph** (spatial/freeform
   manifestations), as a **block-document** (linear/rich-text manifestations), and as a **dataflow
   DAG** (computational/executable manifestations). One atom, three projections. This is the single
   most important decision in the dossier (§5 matrix).

3. **The central systems tension — real-time collaboration *and* event-sourcing *and* deterministic
   replay — is resolvable, but only by separating three concerns:** (a) low-latency convergence via
   **CRDT/last-writer-wins at per-property granularity**; (b) a **server-assigned canonical event
   order** as the causal record; (c) **deterministic replay by replaying the ordered log into
   *commutative* reducers, with periodic snapshots to bound history growth.** Pure event-sourcing
   alone does *not* yield byte-identical replay under concurrency. `[Established]`

4. **The Inevitable already owns most of the hard substrate.** Phase 1D shipped
   `@inevitable/events` (replay-safe bus), `@inevitable/execution` (deterministic engine + journal,
   byte-identical replay), and `@inevitable/world-state` (typed deltas, materialized graph,
   snapshots). **The Cognitive Surface is a *projection client* of these, not a new data store** —
   which is exactly what the COS invariants demand.

5. **Adaptivity must key off the *concept*, *cognitive state*, and *evidence-based principles* —
   never a learner's sensory "style."** The learning-styles "meshing hypothesis" has no credible
   experimental support. Modality choice reduces to Mayer's finite, tested principle set, which is
   why "why a diagram + narration here, not text" can and must emit a checkable reasoning trace.
   `[Established]`

6. **The surface must surface *depth* signals from the substrate, not *fluency* signals from the
   rendering.** Performance during a session is an unreliable index of learning; subjective fluency
   systematically misleads. Any design that optimizes for smooth in-session feel is optimizing the
   wrong variable — this is the empirical backbone of the pedagogical-integrity invariant.
   `[Established]`

7. **Render-anything is a *block-type registry* problem, not a rendering problem.** One block, a
   `type` field governing interpretation + rendering, an extensible registry → new media types are
   additive, not forks. Proven by Notion. `[Established]`

8. **The rendering tier is WebGPU-first with graceful fallback.** A retained-mode scene graph on
   **WebGPU** (Canvas2D/WebGL2 fallback) for spatial blocks; **DOM/HTML** for text/document blocks;
   **sandboxed iframe + WASM** for executable/IDE blocks. Figma has moved its renderer to WebGPU;
   draw-call overhead is materially lower than WebGL. `[Established]`

9. **Agent-driven rendering must be *typed mutations*, not free HTML.** Today's generative-UI
   systems (Claude's generative UI) stream raw HTML into a sandboxed iframe. That is unreplayable,
   ungoverned, and opaque — **it violates the COS invariants.** The Cognitive Surface instead has
   agents emit **typed block mutations through the cognition-packet/event protocol**; sandboxed
   execution is reserved for *executable* blocks, whose effects are journaled. This is a deliberate,
   principled divergence from the current market. `[Emerging]`

10. **Immersion (AR/VR/holographic) is a frontier, not a foundation.** VR shows a positive *moderate*
    learning effect, but high immersion raises *extraneous* cognitive load and gains concentrate in
    short (<2h) sessions (novelty effect). Therefore: every immersive affordance must have a
    non-immersive equivalent (accessibility-parity invariant), and immersion is justified only when
    it lowers intrinsic load for a *specific* concept. `[Emerging]`

**Recommended technology stack (one paragraph).** Atom: a typed **Cognition Block** (`id, type,
properties, children[], parent`, à la Notion) registered in an extensible **block-type registry**.
Sync: **CRDT** (Yjs/Automerge-class) at per-property granularity for convergence + presence, with a
**server-assigned canonical order** feeding the existing `@inevitable/events` log; replay through
commutative reducers + `@inevitable/execution` snapshots. State of record: the **world-state graph**
(`@inevitable/world-state`) — the surface renders its projection and writes back only via typed
deltas + Memory Mutations. Render: **WebGPU** retained scene-graph (fallback WebGL2/Canvas2D) for
spatial blocks; DOM for text; **sandboxed iframe/WASM** for executable blocks. Agent rendering:
**typed surface mutations**, never opaque HTML.

**Top 3 risks.** (1) **Replay-vs-collaboration determinism** — getting commutative reducers + canonical
ordering wrong silently breaks replay (the system's core promise). (2) **Cognitive overload** — a
render-anything surface trivially becomes an infinite-canvas mess; density must be governed by
cognitive-load evidence, not left to the user. (3) **History/storage blow-up** — CRDT + full event
history grows unboundedly without disciplined snapshotting/GC.

---

## PART 1 — WHY CURRENT SURFACES ARE FRAGMENTED, AND WHAT IT COSTS COGNITION

**The fragmentation is real and load-bearing in *some* dimensions, accidental in others.**

| Fragmentation | Load-bearing? | Cognitive cost (evidence) |
|---|---|---|
| Separate **apps** per task (doc / slide / IDE / canvas) | Mostly accidental — they share 80% of a data model (typed objects + layout + media) but duplicate it incompatibly | Context-switching imposes measurable reconfiguration cost on attention/working memory `[Established]`; lost shared context forces re-grounding each switch |
| Separate **data models** (a PDF ≠ a slide ≠ a code file) | Accidental | Knowledge can't transfer across tools; the "interconnections where breakthroughs live" (PRD §2.1) are severed |
| Separate **collaboration models** | Accidental | Each tool reinvents presence/merge; no unified replay or memory |
| **Focus / single-tasking** within a manifestation | **Load-bearing** | Working memory is severely capacity-limited (Mayer CTML assumption 2) `[Established]`; convergence must NOT mean "everything on screen at once" |
| **Specialized interaction grammars** (vector pen vs. code editor) | **Partly load-bearing** | Expert tools encode domain affordances; convergence must preserve them as *manifestations*, not flatten them |

**Conclusion.** Unify the **substrate** (one object model, one event log, one memory, one collaboration
+ replay layer). Preserve **task-specialized manifestations and focus** on top. The error to avoid is
"one undifferentiated canvas with everything visible," which the cognitive-load and infinite-canvas
evidence (§Part 9) predicts will *harm* understanding.

---

## PART 2 — THE SCIENCE OF HUMAN UNDERSTANDING → DESIGN IMPLICATIONS

| # | Finding | Grade | Implication for the Cognitive Surface |
|---|---|---|---|
| S1 | **Learning-styles "meshing hypothesis" has no credible experimental support** (no crossover interaction in adequately designed studies). (Pashler et al. 2009) | `[Established]` | **Never** select modality from a learner's declared sensory "style." Adapt to *concept + cognitive state + evidence-based principles.* |
| S2 | **CTML core: dual channels, limited capacity, active processing**; ~15 tested multimedia principles (coherence, signaling, redundancy, contiguity, segmenting, modality…). (Mayer 2023) | `[Established]` | Modality choice is a **finite, checkable principle set** → every modality decision emits a reasoning trace citing the principle. Dual coding (≥2 representations) is justified *for hard concepts*, not universally. |
| S3 | **Performance ≠ learning**: conditions that speed in-session performance often hurt retention/transfer, and vice-versa. (Bjork & Bjork 2011) | `[Established]` | The surface must **not** optimize visible fluency/progress. R8 self-restructuring must target durable understanding, surfaced from the substrate (mastery state), not smoothness. |
| S4 | **Subjective fluency/familiarity systematically misleads** (rereading feels like understanding; it's often perceptual priming). (Bjork & Bjork 2011) | `[Established]` | Pedagogical-integrity invariant operationalized: depth/mastery signals come from the **substrate**, not the rendered experience. No fluency-maximizing dark patterns. |
| S5 | **Retrieval practice / generation beats restudy** for durable learning, even without feedback. (Bjork & Bjork 2011) | `[Established]` | Bias toward **learner-generated** construction/retrieval (select-to-expand, predict-then-reveal, "teach it back") over passive re-presentation; testing is a *learning event*. |
| S6 | **Desirable difficulties are moderated by element interactivity (working-memory load)**: helpful for low-load material, harmful for high-load material; and load is **relative to expertise**. (Chen, Kalyuga, Sweller — PMC6099118) | `[Established]` | Adaptive difficulty (R8) must track **simultaneous-element load separately from subjective difficulty**, and the desirable/undesirable boundary **shifts as mastery grows** — the same representation is right for an expert and harmful for a novice (the expertise-reversal effect). |
| S7 | **Distributed & embodied cognition**: cognition is offloaded onto external artifacts and the environment; "cognitive artifacts" reshape the task. (Hutchins 1995; Norman 1993; Clark & Chalmers) | `[Established]` (theory) | The surface is a **cognitive artifact**, not a display: spatial arrangement, manipulable external representations, and "thinking *with* the surface" are first-class — grounds R1/R5/R8. |
| S8 | **Dual-coding has a skeptical counter-literature**: benefits are real but narrower and more conditional than popular accounts claim. (Didau, summarizing critiques) | `[Emerging]`/contested | Treat dual coding as **conditional** (apply per CTML principles + element interactivity), not a blanket "always show a picture." Avoids the redundancy-principle trap (duplicated info can *hurt*). |

---

## PART 3 — THE EVOLUTION OF THE MEDIUM OF THOUGHT

The Cognitive Surface sits at the convergence of a 60-year lineage. The through-line: **computation
should be a medium you think *with*, not an application you operate.**

| Era | Figure / system | Idea this surface inherits | Grade |
|---|---|---|---|
| 1962–68 | **Engelbart**, *Augmenting Human Intellect*; the "Mother of All Demos" | Computers as intellect *amplifiers*; shared live workspaces; structured, linked knowledge | `[Established]` (historical) |
| 1963 | **Sutherland**, *Sketchpad* | Direct manipulation of constraint-bound graphical objects — the scene-graph ancestor | `[Established]` |
| 1965–80 | **Nelson**, hypertext/Xanadu; **Kay**, Dynabook/Smalltalk | Transclusion & deep linking; a dynamic, malleable personal medium for all media | `[Established]` |
| 2011– | **Bret Victor**, Explorable Explanations, *Media for Thinking the Unthinkable*, Dynamicland | **Reactive documents**; representations you can *manipulate to reason*; "the unthinkable becomes thinkable when given the right representation" | `[Emerging]` (demonstrated, not mass-deployed) |
| 2019 | **Matuschak & Nielsen**, *How can we develop transformative tools for thought?*; Nielsen, *Thought as a Technology*; Quantum Country | Computers are **not yet** as transformative as language/writing; the **mnemonic medium** weaves spaced retrieval *into* the reading surface | `[Emerging]` |
| 2023–26 | **Generative UI** (Claude generative UI; Google A2UI) | Interfaces *generated* by AI as structured artifacts, streamed live | `[Emerging]` |

**Where this surface extends the lineage (what's genuinely new vs. recombination):** the *new* part is
not any single capability — Victor showed reactive documents, Notion showed the universal block,
Figma showed multiplayer scene graphs. The new part is **binding all of them to a governed,
event-sourced, deterministically-replayable cognitive substrate with a memory and an agent
ecosystem** — i.e., making the medium *accountable* (every representation choice traceable, every
artifact replayable, every mutation governed). That accountability layer is absent from every system
in the table.

---

## PART 4 — THE COGNITIVE SURFACE ARCHITECTURE (mapped to the COS invariants)

**Interaction philosophy.** The surface is a **projection of the world-state graph**. The learner and
the agents manipulate *projected blocks*; manipulations become *typed deltas + events*; the projection
re-renders. The surface never holds canonical truth (invariant 1).

**The substrate primitive (the core decision).** A **Cognition Block**:

```
CognitionBlock {
  id:         BlockId            // UUID; stable identity
  type:       BlockType          // governs interpretation + rendering (registry key)
  properties: Map<Prop, Value>   // flat, per-property CRDT-syncable (Figma-style)
  children:   BlockId[]          // ordered; enables document & tree projections
  parent:     BlockId | null
  provenance: { source, agent?, reasoningTraceRef?, leaseRef? }   // COS accountability
}
```

One atom; three **projections** chosen by the manifestation, not by a fork:

- **Scene-graph projection** (spatial/freeform: canvas, diagrams, simulations, slides-as-layout) —
  blocks as a tree of property maps `Map<BlockId, Map<Prop,Value>>` (Figma's exact model).
- **Block-document projection** (linear/rich text: docs, notes, books, PDF-as-living-doc) —
  ordered `children` give the document spine (Notion's model; ProseMirror/Lexical-class rich text
  inside text blocks).
- **Dataflow-DAG projection** (computational: notebooks, executable diagrams, IDE) — edges =
  variable read/write dependencies; deterministic execution order, no hidden state (Marimo's model).

**Collaboration + replay model (resolving the central tension).** Three separated concerns:

1. **Convergence:** per-property **CRDT/LWW** for instant local-first edits + presence (Figma proves
   LWW-at-property-granularity suffices for a scene graph; Ink & Switch shows CRDT default-merge is
   usually conflict-free in practice).
2. **Canonical causal order:** a **server-assigned order** over events feeds `@inevitable/events`
   (Figma: "the central server defines the canonical order; no timestamps needed").
3. **Deterministic replay:** replay the ordered event log into **commutative reducers**; bound
   history with **snapshots** (`@inevitable/execution` journal + `@inevitable/world-state`
   snapshots). Akka's Replicated Event Sourcing confirms convergence under multi-writer requires
   commutative event application, *not* a single global clock; Ink & Switch confirms full history
   has a real GC/storage cost that snapshotting must pay.

**COS-invariant conformance map (each invariant: how the design pays for it, and the cost):**

| # | Invariant (from the brief §3) | How the architecture honors it | Cost |
|---|---|---|---|
| 1 | **World-state projection** | Surface renders the world-state graph; edits are typed deltas, never local canonical state | Extra projection/diff layer; render latency budget |
| 2 | **Event-sourced & deterministically replayable** | Server-ordered event log + commutative reducers + snapshots | Commutativity discipline; snapshot storage |
| 3 | **Memory-mutation-only persistence** | Durable artifacts (notebooks, kept sketches, doc spans) persist *only* via Memory Mutation Protocol (F05) | Two-step (ephemeral → consolidate) write path |
| 4 | **Reasoning-traced choices** | Every modality/representation/layout choice emits a trace citing a CTML principle or learner-state signal | Trace volume; storage |
| 5 | **Capability/consent-gated inputs** | Voice/camera/sensor/immersive blocks require capability envelope + granular consent; minors default-minimum | Consent UX friction (intentional) |
| 6 | **Real-time multi-agent co-presence** | Agents publish proposals to the blackboard (F07); surface *places* accepted proposals; disagreement is surfaced | Arbitration latency (F07 budget) |
| 7 | **Accessibility & equity parity** | Every block type has a non-immersive, low-bandwidth fallback render; degrade to DOM/text offline | Dual render paths per block type |
| 8 | **Pedagogical integrity** | Depth/mastery signals from substrate (not fluency); no engagement dark patterns | Forgoes "addictive" metrics |
| 9 | **Composability & extensibility** | Block-type registry → new media/agents are additive | Registry/versioning governance |
| 10 | **Real-time collab & continuity** | CRDT presence + world-state continuity across sessions/devices/years | Sync infra; history GC |

---

## PART 5 — CAPABILITY-LADDER FINDINGS + MANIFESTATION × PRIMITIVE MATRIX

**Per-rung findings (a: cog-sci/HCI rationale · b: SOTA reference · c: hard problem · d: primitive · e: invariant strain).**

- **R1 Knowledge exploration** — a: spatial/external cognition (S7); b: Roam/Obsidian graph, infinite canvases; c: avoiding the infinite-canvas mess (Part 9); d: **scene-graph**; e: density must be load-governed (S2/S6).
- **R2 Document & media intelligence** — a: retrieval/generation (S5), select-to-expand; b: Notion blocks, PDF readers; c: turning a static doc into a navigable graph without losing the source; d: **block-document**; e: provenance + memory-mutation persistence.
- **R3 Authoring (Canva/Word/PPT-class)** — a: external representation as thought (S7); b: Figma/Canva (scene graph), ProseMirror (rich text), Reveal.js (slides); c: one model spanning freeform layout *and* linear text; d: **scene-graph + block-document hybrid**; e: extensibility registry.
- **R4 Computational / IDE co-editor** — a: executable thought (Victor); b: Marimo/Observable (DAG), VS Code/LSP, Cursor; c: deterministic execution + safe sandboxing + replay of code effects; d: **dataflow-DAG**; e: sandbox effects must be journaled (invariant 2).
- **R5 Simulation & visual reasoning** — a: manipulable models lower intrinsic load for dynamic concepts; b: game engines, Manim/Motion Canvas; c: physically-grounded sim that is *also* replayable; d: **scene-graph + DAG**; e: determinism of sim state.
- **R6 Creative & cinematic** — a: narrative/segmenting principles (S2); b: Motion Canvas, generative media; c: expression that serves explanation not spectacle; d: **scene-graph**; e: pedagogical-integrity gate.
- **R7 Collaborative & collective** — a: distributed cognition (S7); b: Figma multiplayer, CRDTs; c: collab + replay coexistence (Part 4); d: **CRDT over any projection**; e: the central tension.
- **R8 Adaptive self-restructuring** — a: expertise-reversal + element interactivity (S6); b: generative UI, DSP (F04); c: adapting without breaking replay or becoming unpredictable; d: **all three projections, driven by world-state**; e: must target depth (S3), trace every reshape (invariant 4).

**Manifestation × primitive fit matrix** (✓✓ native · ✓ workable · ⚠ strained):

| Rung | Block/cell | Scene graph | CRDT-doc | Entity-component | Dataflow DAG | **Hybrid (recommended)** |
|---|---|---|---|---|---|---|
| R1 Knowledge explore | ✓ | ✓✓ | ⚠ | ✓ | ⚠ | **✓✓** |
| R2 Document/media | ✓✓ | ⚠ | ✓✓ | ⚠ | ⚠ | **✓✓** |
| R3 Authoring | ✓ | ✓✓ | ✓ | ✓ | ⚠ | **✓✓** |
| R4 Computational/IDE | ⚠ | ⚠ | ⚠ | ✓ | ✓✓ | **✓✓** |
| R5 Simulation | ⚠ | ✓✓ | ⚠ | ✓✓ | ✓ | **✓✓** |
| R6 Creative/cinematic | ⚠ | ✓✓ | ⚠ | ✓ | ✓ | **✓** |
| R7 Collaborative | ✓ | ✓ | ✓✓ | ✓ | ✓ | **✓✓** |
| R8 Adaptive | ✓ | ✓ | ⚠ | ✓ | ✓ | **✓✓** |

**Verdict:** no *single* primitive covers all eight rungs (every column has a ⚠). The **typed block
atom + three projections (scene-graph / block-document / dataflow-DAG), synced as a per-property
CRDT and journaled as events** is the minimum-mechanism design that reaches ✓/✓✓ everywhere.
**Build order of manifestations:** R2 → R1 → R3 → R5 → R7 → R8 → R4 → R6 (deepest pedagogical
payoff first; IDE/creative last).

---

## PART 6 — TECHNOLOGY & STACK RECOMMENDATION (comparison tables)

**(a) Substrate primitive** (scored against the §3 invariants + coverage):

| Option | Coverage | Replay-friendly | Collab-friendly | Render-anything | Verdict |
|---|---|---|---|---|---|
| Pure block/cell (Notion) | High for R1–R3 | ✓ | ✓ | ✓✓ (registry) | Strong but weak on R4/R5 |
| Pure scene graph (Figma) | High for R3/R5/R6 | ✓ (LWW+order) | ✓✓ | ✓ | Weak on R2/R4 |
| Pure CRDT-doc (Automerge) | High for R7 | ⚠ (history GC) | ✓✓ | ⚠ | Weak render-anything |
| Pure dataflow DAG (Marimo) | High for R4 | ✓✓ | ⚠ | ⚠ | Narrow |
| **Hybrid block-atom + 3 projections** | **All** | **✓✓** | **✓✓** | **✓✓** | **Recommended** |

**(b) Collaboration / sync** :

| Option | Convergence | Replay | Offline | Note |
|---|---|---|---|---|
| OT (server) | ✓ | ✓ (server order) | ⚠ | Figma rejected as too complex for trees |
| **CRDT (Yjs/Automerge), per-property + server order** | ✓✓ | ✓ (commutative reducers + snapshots) | ✓✓ | **Recommended**; pay history GC via snapshots |
| Pure CRDT, no server order | ✓✓ | ⚠ concurrent order undefined | ✓✓ | Insufficient for byte-identical replay alone |

**(c) Rendering tier** :

| Block class | Tech | Fallback | Why |
|---|---|---|---|
| Spatial (canvas/sim/slides) | **WebGPU** retained scene graph | WebGL2 → Canvas2D | Figma on WebGPU; lower draw-call overhead than WebGL (toji.dev) |
| Text/document | **DOM/HTML** (ProseMirror/Lexical) | — | Accessibility, text selection, a11y tree |
| Executable/IDE | **Sandboxed iframe + WASM** | server-side exec | Isolation; effects journaled |

**(d) State of record / replay:** reuse **`@inevitable/events` + `@inevitable/execution` +
`@inevitable/world-state`** (already shipped). The surface is a projection client; **no new store.**

**(e) Agent-driven rendering:** **typed surface mutations via cognition packets** (NOT free HTML).
Diverges from Claude generative UI deliberately to satisfy invariants 2/3/4.

---

## PART 7 — BREAKTHROUGH MECHANISMS

1. **Explanation-over-explanation layering** — a block can carry stacked ULI Layer-0…6 renders;
   the learner peels layers; each peel is an event + retrieval opportunity (S5). `[Emerging]`
2. **Executable diagrams as world-state nodes** — a diagram *is* a dataflow-DAG projection of graph
   nodes; editing the diagram mutates the model and replays deterministically (Victor + Marimo).
   `[Emerging]`
3. **Prerequisite-descent on stall** — when mastery/confusion signals fire (F04/F14), the surface
   *descends* the block into its prerequisite sub-graph in place, then re-ascends — never "louder,"
   always "deeper-then-back." Driven by element-interactivity load (S6). `[Emerging]`
4. **Select-to-expand everywhere** — any span/object spawns a child explanation block with
   provenance; passive reading becomes active construction (S5). `[Established]` mechanism, novel scope.
5. **Living document = block-document projection of an ingested source** — a PDF/book becomes a
   navigable block graph; the source stays immutable, the understanding accretes around it (F15).
   `[Emerging]`
6. **Reasoning-trace overlay** — a learner/educator can toggle "why is this here?" and see the modality
   choice's cited principle + the agent + the lease — accountability as a feature. `[Emerging]`
7. **Replay scrubber** — scrub any session to reconstruct the surface byte-identically (enabled by
   the event log); teachers replay *why* a suggestion appeared. `[Established]` (substrate exists).
8. **Multi-agent contention as visible layout** — accepted proposals (F07) get governed screen
   real-estate; disagreement renders as a surfaced fork, never a hidden race. `[Emerging]`
9. **Load-governed density** — the surface caps simultaneous live elements per the working-memory /
   element-interactivity evidence, auto-collapsing to summaries beyond budget (anti-infinite-canvas).
   `[Emerging]`
10. **Mnemonic weave** — spaced-retrieval prompts (Quantum Country mechanism) are woven into the
    reading surface itself, scheduled by the Revision agent. `[Emerging]`

---

## PART 8 — PHASED BUILD PATH (mapped to F09 MVP → Advanced → Frontier)

| Phase | Build | Unlocks | Cost | Must be true first |
|---|---|---|---|---|
| **MVP** | Cognition Block + block-document & scene-graph projections; block-type registry; DOM + Canvas2D render; surface as projection client of world-state; whiteboard-as-artifact; select-to-expand; reasoning-trace + replay wired to existing event log | R2, R1, R3 (basic); living timeline + concept workspace + Open Mode (F09 MVP) | Medium | `@inevitable/world-state` + `@inevitable/events` (done); F04 modality events; F02 timeline |
| **Advanced** | CRDT collaboration + presence; WebGPU spatial render; dataflow-DAG projection (notebooks); living notebooks; document split-pane; classroom whiteboard; load-governed density; multi-agent placement (F07) | R5, R7, R8; F09 Advanced (simulations, notebooks, classroom) | High | MVP stable; F07 orchestration; F05 memory fanout |
| **Frontier** | Sandboxed IDE/co-editor blocks; physically-grounded simulation; voice blocks w/ auto-doc; AR/VR/holographic projection (accessibility-parity enforced) | R4, R6; F09 Frontier (immersive, ambient, IDE) | Very high | Advanced stable; immersive justified by load evidence per concept |

---

## PART 9 — RESOLVED OPEN QUESTIONS + RISK REGISTER

**Positions on F09's open questions:**

- *Which surface artifact schema is canonical first?* → **The Cognition Block** (one atom; document
  span, sketch, simulation state, and transcript are all block subtypes). Resolves F09 OQ#1.
- *Threshold for persisting a whiteboard action as memory?* → **Two-tier:** all actions are
  ephemeral session events (replayable); they become durable Memory Mutations only when (a) the
  learner explicitly keeps them, or (b) an agent's consolidation predicate fires with a reasoning
  trace (e.g., the artifact is referenced ≥N times or tied to a mastered concept). Resolves F09 OQ#2.
- *How to evaluate immersive depth, not novelty?* → Measure **transfer/retention deltas vs. a
  non-immersive equivalent** on the same concept (controls for novelty); require intrinsic-load
  reduction. Resolves F09 OQ#3.
- *Which accessibility constraints are hard governance rules?* → **Non-immersive equivalent for every
  block type; offline/low-bandwidth degrade path; text/a11y-tree for every visual block.** Hard rules.
  Resolves F09 OQ#4.

**Risk register:**

| Risk | Severity | Mitigation |
|---|---|---|
| Replay breaks under concurrent edits | Critical | Commutative reducers + server-assigned order; replay determinism tests (D-level) as CI gates |
| Cognitive overload / infinite-canvas mess | High | Load-governed density (mechanism 9); CTML coherence/signaling principles enforced |
| History/storage blow-up | High | Snapshotting + history GC budget; event compaction |
| Agent-generated content unsafe/ungoverned | High | Typed mutations only; governance pre-check (F07); sandbox for executable blocks |
| Surveillance perception of an "always-watching" surface | High | Capability/consent gating; learner can inspect & redact; observation paused by default for minors/exams |
| WebGPU availability gaps | Medium | WebGL2/Canvas2D fallback path; feature detection |
| Scope explosion (becoming "everything") | Medium | Manifestation build order (§5); each rung gated on prior stability |

---

## PART 10 — ANNOTATED BIBLIOGRAPHY (grouped; with evidence grades)

**A. Science of human understanding**
- Pashler, McDaniel, Rohrer, Bjork (2009), *Learning Styles: Concepts and Evidence* — the canonical
  debunking of the meshing hypothesis. `[Established]`
  https://journals.sagepub.com/doi/full/10.1111/j.1539-6053.2009.01038.x
- Mayer (2023), CTML review — three core assumptions + 15 multimedia principles. `[Established]`
  https://link.springer.com/article/10.1007/s10648-023-09842-1
- Bjork & Bjork (2011), *Making things hard on yourself, but in a good way* — performance≠learning,
  fluency illusion, retrieval practice, desirable difficulties. `[Established]`
  https://bjorklab.psych.ucla.edu/wp-content/uploads/sites/13/2016/04/EBjork_RBjork_2011.pdf
- Chen, Kalyuga, Sweller — element interactivity moderates desirable difficulties; expertise-reversal.
  `[Established]` https://pmc.ncbi.nlm.nih.gov/articles/PMC6099118/
- Distributed cognition (Hutchins 1995, *Cognition in the Wild*; Norman 1993; Clark & Chalmers 1998).
  `[Established]` (theory) https://en.wikipedia.org/wiki/Distributed_cognition
- Didau, *The Dual Coding Delusion* — skeptical counterpoint; treat dual coding as conditional.
  `[Emerging]`/contested (blog) https://daviddidau.substack.com/p/the-dual-coding-delusion

**B. Tools-for-thought lineage**
- Matuschak & Nielsen (2019), *How can we develop transformative tools for thought?* `[Emerging]`
  https://numinous.productions/ttft/
- Nielsen, *Thought as a Technology* `[Emerging]` https://cognitivemedium.com/tat/
- Matuschak, *Tools for thought: science, design, art, craftsmanship?* https://andymatuschak.org/sdac/
- Bret Victor, *Explorable Explanations* / *Media for Thinking the Unthinkable* / Dynamicland
  `[Emerging]` https://worrydream.com/
- Engelbart (1962), *Augmenting Human Intellect* `[Established]` (historical)

**C. Substrate teardowns**
- Wallace, *How Figma's multiplayer technology works* — scene graph of property maps; LWW; rejected
  OT & full CRDT; server-assigned canonical order. `[Established]`
  https://madebyevan.com/figma/how-figmas-multiplayer-technology-works/
- *The data model behind Notion* — one polymorphic `block` (id/type/properties/content/parent).
  `[Established]` https://www.notion.com/blog/data-model-behind-notion
- *Marimo dataflow* — notebook as DAG; deterministic order; Jupyter repro crisis (24% re-run, 4%
  reproduce). `[Established]` https://marimo.io/blog/dataflow
- tldraw architecture & performance. `[Established]` https://deepwiki.com/tldraw/tldraw ·
  https://tldraw.dev/sdk-features/performance

**D. Collaboration + replay**
- Ink & Switch, *Local-first software* — CRDT default-merge usually conflict-free; full-history GC
  cost is real. `[Established]` https://www.inkandswitch.com/essay/local-first/
- Akka, *Replicated Event Sourcing* — multi-writer needs commutative event application; concurrent
  order undefined; version vectors for causal delivery. `[Established]`
  https://doc.akka.io/docs/akka/current/typed/replicated-eventsourcing.html
- Yjs vs Automerge vs Loro (2026 comparison). `[Emerging]` (secondary)
  https://www.pkgpulse.com/guides/yjs-vs-automerge-vs-loro-crdt-libraries-2026

**E. Rendering / media runtime**
- *Figma rendering powered by WebGPU.* `[Established]` https://www.figma.com/blog/figma-rendering-powered-by-webgpu/
- toji.dev, *WebGPU vs WebGL performance.* `[Established]` https://toji.dev/webgpu-best-practices/webgl-performance-comparison.html

**F. AI-native generative UI**
- Claude generative UI — UI as a structured tool call (separate channel), sandboxed iframe, streamed.
  `[Emerging]` https://www.mindstudio.ai/blog/what-is-claude-generative-ui-vs-canvas-artifacts
- *Dive into Claude Code* (arXiv 2604.14228) — design space of agent systems. `[Emerging]`
  https://arxiv.org/html/2604.14228v1
- Google A2UI — open project for agent-driven interfaces. `[Emerging]`

**G. Immersive / spatial frontier**
- VR-for-learning meta-analyses — positive *moderate* effect (e.g., Hedges g≈0.52 teacher ed;
  immersive > non-immersive) **but** high immersion ↑ extraneous load; gains concentrate in <2h
  (novelty effect). `[Emerging]`
  https://www.frontiersin.org/journals/virtual-reality/articles/10.3389/frvir.2025.1620905/full ·
  https://www.researchgate.net/publication/359441888

**H. Failure modes** — synthesized across A (cognitive load), C/D (history/GC, replay), G (novelty
effect), and the infinite-canvas/overload critique. `[Established]`/`[Emerging]` as noted inline.
