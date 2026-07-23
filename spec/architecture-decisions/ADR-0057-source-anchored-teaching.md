# ADR-0057: Source-Anchored Teaching — the Pipeline Inversion

**Status:** Accepted
**Date:** 2026-07-18
**Related:** the CSE production-readiness audit R2
(`spec/research/cse-production-readiness-audit-2026-07.md` §8–9 — "teaching is source-adjacent, not
source-anchored"), ADR-0030 (Cognitive Frames + MCCR + narration — the pipeline this inverts),
ADR-0055/0056 (R0 integrity + R1 the Source Dock — the front door this now teaches through),
CSE-002 §5 (Source Anchors), CSE-008 §4/§5/§6 (semantic viewport, highlight grammar, attention
contract), CSE-011 §4 (the Director), CSE-003 (the meaning layer), ADR-0036 (PDF fidelity).

## Context

The audit established that the CSE teaches *beside* the source, not *from* it. The evidence, at the
seam level:

- The curriculum is generated from the **goal string alone** (`GatewayHost.runAsk` →
  `generateCurriculum(goal)`); attached sources never shape what is taught.
- The **frame planner and composer prompts contain no source text** — they teach the concept title
  and goal; the planner is even instructed "never a scrolling document."
- The Director's `focus.source_anchor_ref` is **structurally always `null`** — the organ meant to
  choose the pedagogically-meaningful region never points at one.
- Source anchors are attached **after** composition, by **lexical token-overlap** of the concept
  title against structural regions (top 2), then bound to narration by **index arithmetic**
  (`segment i → viewport min(i, n−1)`), with the highlight role hardcoded `"evidence"`.

The result: the "attention contract" and "semantic viewport" exist mechanically but carry no
meaning, and "the document becomes the timeline" (CSE-001's promise) is unrealized. The rendering
plumbing (native bytes, bbox highlights, auto-scroll, the `surface.source.*` fold) is real and
good; what is missing is the **intelligence upstream of it** — pedagogical region selection,
source-fed composition, and source-aware narration.

R2 inverts the pipeline so the source is the medium of teaching. It ships in six fallback-safe
sub-phases; this ADR records the decisions common to them.

## Decisions

### 1. Source evidence flows INTO planning and composition, not after

The focus concept's resolved anchor views (quote + region + path — the existing
`sourceEvidence.anchorsForConcept` seam already returns them) are resolved **before** dispatch and
threaded into the planner and composer request packets as a `source_excerpts` field. Both cognition
units read it and are instructed to **teach from the passage** — quote it, name its figures and
equations, select the pedagogically-meaningful slice — never to invent beyond it. The post-hoc
`source_viewport` board element stays (it is still correct), but now agrees with the narration
because the same excerpts produced both.

Recorded in the packet, so D3 replay is byte-identical.

### 2. The Director selects the source region

`decideDirective` sets `focus.source_anchor_ref` to the concept's resolved focus anchor (passed via
`DirectorSignals`), fulfilling CSE-011 §4. The *ranking* that picks the MOST pedagogically
meaningful region — the "expert gaze" of CSE-008 §4 — is a bounded, model-backed upgrade to the
anchor resolver, with the deterministic lexical result as its fallback. The Director stays a pure
function of folded signals (replay-safe); the ranking is recorded like any model call.

### 3. "Teach this source" mode: the document becomes the timeline

A surface entered on a source (rather than a goal) derives its curriculum from the source's
canonical **structural + semantic** layers — sections become concepts, prerequisite order comes
from the L2 concept graph the canonicalizer already extracts — reusing the KG engine. Frames then
traverse the document's regions in reading order; the path view is the document's own map. The
goal-driven path is unchanged and remains the default; source-mode is additive.

### 4. Narration↔anchor sync is semantic, gated by entailment

Each narration segment names the MCCR `anchor_ref` it discusses; when that element is
source-derived, the segment binds to the **source anchor it is about**, replacing the positional
`min(i, n−1)`. The highlight `role` derives from the segment's intent / element type (definition,
misconception, mathematical-focus, citation, …) instead of the hardcoded `"evidence"`. A cheap
**entailment gate** guards every binding: a segment whose text is not supported by its bound anchor
degrades to **no highlight** — never a wrong one. This directly answers the audit's "visual
authority amplifies grounding errors" risk (a confident voice highlighting the wrong passage
asserts false evidence, worse than a wrong chat answer).

### 5. Source-as-stage projection archetype

In source mode the document renders **center-stage** (the full Living Reference) and the MCCR
anchors become overlays / side-glosses **at** their anchored regions — inverting today's
board-center / source-aside layout, per the spatial-contiguity principle (explanation renders at
the thing explained). This is a client layout mode (D5: layout is never canonical); the goal-mode
board-stage remains the default and the fallback.

## Consequences

- Teaching becomes source-grounded: the narration quotes the document, the highlight lands on the
  exact discussed span, and a lesson traverses the actual source region by region — the audit's
  acceptance bar.
- Hallucination surface shrinks structurally: every taught claim points at its evidence, and the
  entailment gate refuses to point at the wrong one.
- The state of the art surveyed in the audit (NotebookLM, Paper2Video, AutoLectures) all discard
  the source for generated slides/video; keeping the original document as the stage while teaching
  from it is the unoccupied white space this realizes.

## Rejected alternatives

- **RAG-style free retrieval into the prompt** (embed the whole source, retrieve top-k chunks):
  loses the anchor → cannot bind narration to a stable, re-renderable region, cannot prove fidelity,
  and reintroduces "which paragraph?" ambiguity. Anchored excerpts keep the CSE-002 §5 invariant.
- **Model-authored highlight coordinates**: pixel/offset highlights the model invents drift and
  can't survive re-render. Highlights resolve through Source Anchors only (CSE-002 §5).
- **Replacing the goal-driven path**: source-mode is additive. "Teach me X" (no source) is a
  first-class flow and the default; forcing every lesson through a document would break it.
- **Trusting narration→region alignment without a gate**: the audit's risk #4. The entailment gate
  (degrade to no-highlight) is non-negotiable — a wrong pointer is worse than none.
- **Freeform generated document UI**: rejected for the same reason as the MCCR architecture — plans
  over a closed vocabulary of deterministic primitives, never runtime-generated layout.

## Deferred (named scope, → R3/R4/R5)

- The rendered Theater (cinematography shots, pacing, lighting, progressive derivation) — R3.
- The Representation Intelligence Agent + MCCR 2.0 grammars — R4.
- Multi-source fusion-as-curriculum (a fused environment taught as one timeline) — R5.
- Video/audio region sync (the concept scrubber) and the missing modality adapters — R5.
