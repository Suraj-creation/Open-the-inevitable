---
name: cse-source-surface-projection
spec:
  id: CSE-008
  title: Source–Surface Projection — Viewports, Semantic Highlights, and the Attention Contract
  domain: source-environment
  status: draft
  owner: product-architecture
  last_reviewed: 2026-07-09
  upstream_dependencies:
    - source-environment/CSE-002-canonical-source-representation
    - source-environment/CSE-007-source-agent-society
    - surface/cognitive-surface-runtime
    - surface/surface-event-architecture
    - surface/surface-streaming-sync-protocol
    - surface/inline-multimodal-artifacts
    - architecture-decisions/ADR-0030-cognitive-frames-mccr-narration-split
    - architecture-decisions/ADR-0024-surface-interaction-protocol
    - architecture-decisions/ADR-0007-surface-choreography-and-timing
    - design/cognitive-design-language-v1
  downstream_dependencies:
    - source-environment/CSE-009-experience-catalog
    - indexes/event-index
    - surface/surface-event-architecture
  related_protocols: [cognitive-event-protocol, cognition-packet-protocol]
  related_events: [surface.source.attached, surface.source.viewport.planned, surface.source.viewport.changed, surface.source.highlight.applied, surface.source.highlight.cleared, surface.source.sync.bound, surface.source.alignment.composed, surface.source.overlay.applied, surface.source.media.intent, surface.frame.composed, surface.narration.script.produced, surface.interaction.received]
  related_runtime_systems: [surface-session, frame-planner, surface-composer, choreographer, universal-cognitive-bus]
  related_governance_systems: [governance-kernel, capability-envelope]
  related_observability_systems: [cognitive-observability, otel-edge]
  semantic_tags: [source-environment, surface, viewport, highlighting, synchronization, attention, frames, projection]
  canonical_references:
    - surface/surface-event-architecture#4
    - architecture-decisions/ADR-0030-cognitive-frames-mccr-narration-split
    - design/cognitive-design-language-v1
---

# CSE-008 — Source–Surface Projection

## 1. Purpose

The seam where a Canonical Source Environment becomes something a learner stands inside. This
spec defines how sources render **within the existing Cognitive Surface** — as frames, events,
and projections — and defines the three projection primitives the founding draft implied but
never named: the **Semantic Viewport**, the **Semantic Highlight**, and the **Attention
Contract**. It proposes the `surface.source.*` event subfamily (surface schema 1.5.0 → 1.6.0,
additive) whose implementation lands in SRF-002 at build time.

## 2. Philosophy

1. **The source is sacred.** The original artifact renders exactly as intended — native
   typography, pagination, equations, lossless figures, full-fidelity video, preserved syntax.
   All cognitive markup is a **non-destructive overlay layer**, toggleable off to see the raw
   source. The renderer must be able to prove fidelity (render-hash against the canonical bytes).
2. **The UI is a projection; the runtime is the product** (SRF-001). There is no "document mode,"
   no separate viewer, no canonical panel layout. Which pane sits where, docking, and window
   arrangement are client projections (SRF-005 law; D5). Canonical state is: which sources are
   bound, which viewports/highlights/bindings exist, in what logical order.
3. **Synchronization is logical, not temporal.** Canonical events carry sequence and bindings —
   never wall-clock playback positions (ADR-0007). The client choreographer realizes timing; the
   ~150ms "reads as one event" feel is a client-quality requirement (§6.3), not canonical state.
4. **Nothing appears without an event; the learner always wins.** Every viewport move, highlight,
   and overlay is evented and replayable; any learner scroll/seek instantly cancels pending
   system attention direction rather than fighting it.

## 3. Architecture — Sources in the Frame Model

### 3.1 `SourceBinding`

A surface session binds source environments: `surface.source.attached { surface_id,
source_id, version_id, modality, layers_available[] }`. Source bytes never enter events — clients
fetch renderable content out-of-band via the gateway media route by `content_ref` (SRF-006 rule),
including page renders, video streams, and web snapshots.

### 3.2 The source element in MCCR

ADR-0030 frames carry MCCR elements (text anchors, image element). This spec adds the
**`source_viewport` element**: a frame element referencing `{ source_version_id, anchor_ref |
region, render_hints }`. A frame about "attention heads" can hold the paper's actual figure
region as an element beside its distilled text anchors — evidence and cognition on one board,
each in its own provenance channel.

### 3.3 The persistent reference presence

The dual experience (source alongside living cognition) is achieved without canonical panel
state: consecutive frames carry `source_viewport` elements whose **Viewport Plan** (§4) enforces
continuity, and the client realizes a stable reference pane from the current frame's viewport
binding. Continuity is a property of the *plan*, not of a canonical "pane object."

## 4. The Semantic Viewport

Instead of showing an entire page, the surface shows the **cognitively meaningful region** — not
an arbitrary crop, an expert teacher's gaze.

### 4.1 Primitive

```json
{
  "viewport_id": "vp_...",
  "source_version_id": "srcv_...",
  "anchor_ref": "anc_...  (what this viewport is 'about')",
  "region": "resolved region (derived from anchor + granularity padding)",
  "emphasis": "focus | context | orientation",
  "plan_ref": "vpp_...", "ordinal": 3
}
```

### 4.2 Viewport Plans

A **ViewportPlan** is a planner-produced sequence of viewports for a teaching passage, bound
1:1-or-1:N to narration segments (§6), produced alongside frame planning (the ViewportPlanner
capability, CSE-007 §3). Emits `surface.source.viewport.planned { plan_id, viewport_ids[],
frame_id }`; each realized step emits `surface.source.viewport.changed { viewport_id, cause:
"plan | learner | citation | resume" }`.

### 4.3 Stability laws

- **Spatial continuity:** consecutive planned viewports must overlap or be adjacent unless a
  topic boundary is declared; long jumps require an orientation viewport (zoom-out beat) in
  between. The learner should feel guided attention, never teleportation.
- **Minimum dwell:** a planned viewport persists for its bound narration segment(s); plans never
  move the view mid-sentence.
- **Learner priority:** manual scroll/zoom cancels the remaining plan steps for that frame
  (evented `cause: "learner"`); the plan resumes only on explicit re-sync (tapping a citation
  marker or "resume guide").
- **Semantic zoom:** zoom level derives from anchor granularity (symbol ↔ equation ↔ paragraph ↔
  page), not fixed percentages.

## 5. The Semantic Highlight

Rectangular highlight boxes are too primitive. Highlighting is a typed, agent-controlled grammar
over anchors.

### 5.1 Grammar

```json
{
  "highlight_id": "hl_...",
  "anchor_ref": "anc_...  (paragraph | sentence | phrase | equation | symbol | figure | caption | table | cell | region | utterance)",
  "role": "concept | prerequisite | definition | misconception | mathematical-focus | evidence | citation | contrast | frontier | historical | curiosity",
  "amplitude": "whisper | active | focal",
  "lifetime": "pulse | held | persistent-tint",
  "provenance_class": "evidence | inference | frontier",
  "decided_by": "enrichment decision / narration binding / learner"
}
```

Events: `surface.source.highlight.applied` / `surface.source.highlight.cleared` (bulk-clear by
frame or plan). Learner-created highlights use the same grammar (`decided_by: learner`) and
commit to memory as annotations via mutations.

### 5.2 Laws

- **Roles are semantic; CDL owns the optics.** The role registry maps to CDL state hues and
  amplitude treatments (`spec/design/cognitive-design-language-v1.md` §4); components never pick
  colors. Color is never the sole carrier — role pairs with icon/shape (a11y, §9).
- **One focal highlight at a time** per source view (CDL "one focal accent"); any number of
  whispers.
- Different semantic elements get different treatments *by role*, not by ad-hoc styling: a
  misconception highlight and a definition highlight are different classes of light.
- Highlights are anchored, so they survive re-render, zoom, reflow, and version migration
  (CSE-002 §5.4).

## 6. The Attention Contract — Dynamic Cognitive Synchronization

### 6.1 Canonical binding

ADR-0030's narration script segments already carry `anchor_ref` into MCCR elements. This spec
**generalizes the anchor target space**: a segment binding may reference MCCR elements *and/or*
source anchors, viewports, and highlights:

```json
surface.source.sync.bound {
  "frame_id": "...", "script_id": "...",
  "bindings": [{
    "segment_id": "...",
    "viewport_ref": "vp_... | null",
    "highlight_refs": ["hl_..."],
    "media_ref": { "source_version_id": "...", "temporal": {"start_ms":0,"end_ms":0} } 
  }]
}
```

When narration discusses a sentence, that sentence highlights; a figure, the figure illuminates;
an equation, individual symbols can carry `mathematical-focus`; a table, the relevant cells; a
video moment, the transcript span and player region. All of it is *this one primitive* at
different anchor granularities.

### 6.2 Realization (client, non-canonical)

The choreographer (ADR-0007) realizes bindings in segment order: scroll-if-offscreen → highlight
fade-in → outline glow → citation marker placement — perceptually simultaneous (≤150ms spread as
a quality bar). Citation markers in surface text are re-trigger affordances: click → re-fire the
binding (evented as `surface.source.viewport.changed { cause: "citation" }`).

### 6.3 Interruption

Learner scroll during realization cancels pending auto-scroll (never fights); the binding stays
available for re-trigger. Observatory logs which agent's decision produced each binding.

## 7. Provenance Channels & CDL Conformance

Three visual channels, everywhere, at a glance (Constitution #2/#4; CDL provenance semantics):

| Channel | Content | Treatment |
|---|---|---|
| **Evidence** | The source itself; anchored quotes | Source's own typography; reading tone |
| **Inference** | Agent-authored explanation, MRL-derived enrichment | Surface typeface + inference accent + provenance affordance |
| **Frontier** | Living-knowledge overlays (CSE-006) | Reserved research accent (`--state-research`), never mixed into evidence |

Every projected panel/element carries the provenance affordance ("why this?") opening the
decision trace anchored in place — observability is ambient, not a separate mode. Amber is
reserved strictly for low-confidence flags (degraded OCR regions, unstable anchors).

## 8. Event Subfamily — `surface.source.*` (schema 1.6.0; core six implemented at CSE M5 — payload shapes owned by SRF-002 §4)

| Event | Emitted when | Payload core |
|---|---|---|
| `surface.source.attached` | source env bound to session | source_id, version_id, modality, layers_available[] |
| `surface.source.viewport.planned` | viewport plan reserved for a frame | plan_id, frame_id, viewport_ids[] |
| `surface.source.viewport.changed` | a viewport realized/overridden | viewport_id, cause ("plan"\|"learner"\|"citation"\|"resume") |
| `surface.source.highlight.applied` / `.cleared` | highlight lifecycle | highlight grammar (§5.1) / clear scope |
| `surface.source.sync.bound` | attention contract instance for a frame | bindings[] (§6.1) |
| `surface.source.overlay.applied` | frontier overlay projected onto anchors | overlay_ref, anchor_refs[], entry kinds |
| `surface.source.alignment.composed` | multi-source alignment map for a concept | concept_ref, alignments[{source_version_id, anchor_refs[]}], gaps[{source_version_id, reason:"not-covered"}] |
| `surface.source.media.intent` | governed playback intent accepted | source_version_id, intent ("play"\|"pause"\|"seek"\|"rate"\|"jump_to_concept"), target (temporal anchor \| concept_ref) |
| `surface.source.annotation.recorded` | learner annotation committed (mirrors memory mutation) | highlight_ref \| note, anchor_ref, mutation_id |

Interaction kinds (extends ADR-0024 `surface.interaction.received`): `open_source`,
`jump_to_anchor`, `toggle_overlay`, `toggle_markup` (raw-source view), `seek_concept`,
`align_sources`, `pin_enrichment`, `resume_guide`.

## 9. Modality Specifics

- **PDF/EPUB/Book:** page-region viewports; typography sacred; scanned/OCR regions carry
  confidence badges; dense passages (proofs) support split-lens popovers (CSE-009 §2).
- **Video:** the player is a first-class surface citizen. Canonical: temporal anchors, concept
  segmentation (layer 4) → a **concept scrubber** beneath the time scrubber; transcript
  concept-highlighted in sync; playback state is client-side, but every governed intent
  (`surface.source.media.intent`) is evented — "jump to concept," pause, slow, repeat, frame
  extraction (extracted frames/diagrams/equations become anchored artifacts). Auto-pause on
  detected confusion is a §CSE-007 enrichment proposal ("want a recap?"), never forced. The
  learner is not watching a video; they are exploring a knowledge environment with a temporal
  axis.
- **Web:** DOM-range anchors; live-content re-anchoring on re-crawl (CSE-002 §5.4); citation
  preservation; changed-content diff badges.
- **Code:** symbol/line anchors bound to commits; execution ties into simulation blocks
  (SRF-006); explanation↔code sync uses the same attention contract.
- **Dataset:** cell/region anchors; table highlights follow the same grammar; aggregate views are
  transformations (CSE-004), not mutations.
- **Human sessions:** utterance anchors with consent scopes (CSE-002 §8); non-consented spans
  never render.

## 10. Multi-Source Alignment (and its evolution into Fusion)

Alignment maps (concept ↔ anchors across N sources) are shared-layer structures computed from the
anchor index; `surface.source.alignment.composed` projects them. Concept-locked scrolling
(scrolling one source to "gradient descent" aligns the others), merge views (one unified
explanation citing all sources), and emphasis-diff badges are client realizations over the map.
Sources not covering a concept show an explicit "not covered here" gap — never a blank column.
Contradictions between aligned sources link into the Claim Graph (CSE-006 §3.1).

Alignment is the *side-by-side* base case; **Source Fusion (CSE-015)** is its evolution into *one
reconciled environment*. A fused concept renders as a single Scene (CSE-012) whose actors are the
contributing source viewports plus the fused synthesis, brought together with `split`/`merge`
shots (CSE-013). Alignment shows sources next to each other; fusion lets the learner inhabit their
reconciliation.

## 9a. The Theater Seam (Director, Scene, Cinematography, Interaction)

Under the Cognitive Theater (ADR-0033), source projection is no longer a static dual-pane render;
it is the substrate the Theater organs act on:

- **Scenes (CSE-012)** wrap the frames that hold `source_viewport` elements: a source region is a
  Scene *actor*; the reference pane is the persistent-source actor across a Scene sequence.
- **Cinematography (CSE-013)** realizes viewport plans (§4) and highlights (§5) as pedagogical
  shots — a `pan` *is* a viewport plan step; a `spotlight` *is* a focal highlight; `semantic-zoom`
  *is* granularity-driven viewport change. This spec owns the primitives; CSE-013 owns their
  grammar.
- **Interaction (CSE-014)** turns learner acts on the source (circle, annotate, ask-here) into
  cognitive intent that evolves the Scene in place; §8's interaction kinds are the source-scoped
  subset of the full grammar.
- **The Director (CSE-011)** decides when to move the source view, spotlight, or fall still —
  source navigation is paced by directives, not hardcoded.

The primitives in §§4–6 (viewports, highlights, attention contract) are unchanged; the Theater is
*who decides to use them and why*.

## 11. Accessibility & Responsiveness

Full keyboard navigation across all projections; screen-reader descriptions generated for every
viewport, highlight (role spoken, not colored), and visualization; captions/transcripts mandatory
for all a/v sources; reduced-motion collapses choreography to discrete non-animated steps;
color never sole carrier. Small viewports collapse to single-projection-at-a-time with
synchronization still firing into inactive projections (ready on switch). These are conformance
requirements, not enhancements.

## 12. Failure Semantics & Replay

| Failure | Behavior |
|---|---|
| Layer missing for a requested projection | Honest degraded render ("figure 4 could not be parsed reliably — shown as image only"); never a silent guess |
| Anchor unstable/orphaned | Preserved-quote rendering + amber flag; sync binding skips rather than mis-highlights |
| Media route unavailable | Frame renders text anchors + placeholder with retry; evented |
| Client can't keep ≤150ms realization | Choreography degrades to sequential-but-ordered; canonical state unaffected |

Replay: the `surface.source.*` subfamily folds into `SurfaceState` deterministically; client fold
of the streamed log equals the server's session state (SRF-005 safety property). Replaying a
session reproduces every viewport, highlight, and binding exactly — including learner overrides.

## 13. Non-Goals

- No canonical layout/panel/docking state (D5). No separate document-viewer application. No
  pixel-coordinate references outside anchor selectors. No modification of source bytes, ever.

## 14. Open Questions

- Page-render pipeline: pre-rendered region tiles vs. client-side native rendering per modality —
  implementation ADR at CSE-P1 (fidelity proof requirement in §2.1 constrains options).
- Whether `surface.source.*` warrants its own family vs. subfamily under `surface.*` — proposed
  as subfamily (owner: surface, co-authored with source-environment) to keep one fold.
- Concept scrubber segmentation quality floor for video before learner-facing default-on.

## 15. Implementation status (R2, ADR-0057)

The `surface.source.*` fold, native rendering, bbox highlights, auto-scroll, and the ≤150ms
realization (§4/§5/§6) are built and replay-safe. **R2 — source-anchored teaching** makes them
*mean* something by inverting the pipeline (ADR-0057): the semantic viewport (§4) is chosen by the
Director / an expert-gaze ranking rather than lexical token-overlap; the highlight role (§5) derives
from the segment's meaning rather than the hardcoded `evidence`; and the attention contract (§6)
binds each narration segment to the source anchor it *discusses* — gated by an entailment check that
degrades a mismatched binding to **no** highlight (§12's "mis-highlight" failure made a first-class
gate). **Deferred within §8:** frontier-overlay-on-source, multi-source alignment UX, video/audio
media intents, and learner annotations activate with their owning milestones (R5).
