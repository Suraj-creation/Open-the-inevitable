# ADR-0030: Cognitive Frames, MCCR, and the Narration-Script Split for the UCS

**Status:** Accepted
**Date:** 2026-06-26
**Related:** ADR-0007 (surface choreography & timing), ADR-0028 (block-delta streaming projection),
ADR-0029 (surface agent-observability events), ADR-0024 (surface interaction protocol),
ADR-0025 (cognitive ensemble orchestration), SRF-001/SRF-002/SRF-004/SRF-005/SRF-006,
F16 (cognitive surface substrate), F09 (living-universe experience),
cognitive_surface/cognitive-whiteboard-system, cognitive_surface/cognitive_surface_dossier

## Context

The Cognitive Surface today renders the explanation agent's 7-layer prose artifact
(`block.content.summary + layers`) onto the board via `ProseBody` **and** speaks the *same* text as
narration (`SurfaceSession.ask()` → `narrateBlock` → `collectNarrationTexts`). One artifact, two
destinations. The result is duplication, visual overload, and a board that reads like a markdown
document that grows indefinitely — the opposite of the vision (F16, F09, `spec/cognitive_surface/`),
in which **the board is where the learner thinks, not where the system thinks.**

The research corpus is unambiguous: Mayer's multimedia principles (dual coding, coherence d=0.86,
spatial contiguity d=1.10, signaling) show large effect sizes, and extraneous on-screen material
*reduces* learning. The surface should carry only what deserves persistent visual attention; the
teaching belongs to the voice. Three structural gaps block this:

1. **No distillation.** Nothing converts teaching content into a *minimal* visual representation
   distinct from the spoken script.
2. **No bounded cognitive unit.** The session accumulates blocks with no notion of a
   viewport-complete cognitive *state* that fits one screen and transitions to the next.
3. **No look-ahead.** Planning is reactive; nothing prepares the learner's next surface while they
   engage the current one — yet SRF-001 §2 / F16 §2 forbid *static pre-generation of all content*.

## Decision

Introduce the **Cognitive Frame** — a bounded, viewport-complete cognitive state — and the
**Minimal Complete Cognitive Representation (MCCR)** it carries, and split the spoken **narration
script** from the on-screen MCCR. Six locks:

1. **Cognitive Frame is a top-level folded slice of `SurfaceState`** (`frames[]`, upsert by
   `frame_id`, prefix `cfr-`), not a `block_type` (the block set is closed and single-producer; a
   frame is composed by multiple producers) and not a grouping over blocks (the growing prose block
   is removed). A frame owns its MCCR and references its narration segments. "Frame" avoids
   colliding with "surface" (the whole session) and "scene" (the non-canonical layout projection).

2. **MCCR is frame-level content** (`Mccr` with typed `MccrElement[]`, each carrying a stable
   `element_id`, prefix `el-`). `diagram` and `table` elements are **deterministic client-rendered
   projections** — their data lives in the folded state and their layout is a pure function (as the
   existing concept-map block already is), so they replay byte-identically with no media provider.
   `image` is the only provider-touching element, gated by `image_plan.helps` and recorded
   out-of-band via the existing `surface.visual.generated` seam (SRF-004/SRF-006).

3. **Narration is a separate pedagogical artifact.** A single `SurfaceComposerUnit` model call
   emits `{ mccr, narration_script, image_plan }` in one reasoning pass (avoids show/speak
   divergence at lowest latency/determinism cost). The choreographer speaks
   `narration_script.segments[].text` via the existing `narrate({ texts })` seam, replacing
   `narrateBlock`/`collectNarrationTexts` on the frame path (both retained for the legacy path).

4. **Narration↔region sync stays a client projection.** Each script segment's `anchor_ref` maps at
   the choreography seam to `focus = { target_type: "element", target_id: <element_id>, spotlight }`,
   reusing `SurfaceFocus`/`reveal_ids`. `FocusTargetType` gains `"element"` and `"frame"`. Which
   segment is current — and thus the active frame and spotlit element — is derived client-side over
   the cursor + audio `currentTime`. No wall-clock enters the log (ADR-0007).

5. **Active frame is a client projection, not event-driven.** The *set* of frames + their MCCR is
   canonical (folded); *which frame is on screen* is derived from the choreographer cursor.
   `surface.frame.composed` is the readiness/resume anchor. There is **no `active_frame_id` in
   `SurfaceState`** and **no `surface.frame.activated`** — a logged active pointer would break replay
   scrubbing and multi-viewport (the failures ADR-0007 / SRF-005 §6.2 forbid).

6. **Look-ahead is governed, budgeted, discardable speculation.** A `FramePlannerUnit` emits
   `{ frames[], lookahead[], pacing }`; each `lookahead[]` entry carries a `trigger_assumption`.
   Speculative frames live in a separate `speculative_frames[]` slice, are prepared via governed
   dispatch within a `lookaheadBudget` (a `LiveEvolutionConfig` field; `0` in tests, `1` at the
   gateway), are recorded but **never surfaced until promoted**, and are invalidated on any
   unexpected learner signal.

### The eight `surface.frame.*` events (SRF-002, schema_version 1.4.0)

`surface.frame.planned` (upsert `frames[]`, status `planned`), `surface.frame.composed` (upsert,
status `composed`, full MCCR), `surface.narration.script.produced` (upsert `narration_scripts[]`),
`surface.image.decided` (append `image_decisions[]`), `surface.frame.element.delta` (transient
`streaming_frame_elements`, cleared by compose), `surface.frame.speculation.prepared` (upsert
`speculative_frames[]`), `surface.frame.speculation.invalidated` (mark speculative entry; never
copied to `frames[]`), `surface.frame.promoted` (copy speculative entry into `frames[]`).

## Reconciliation with the "no static pre-generation" non-goal

Look-ahead is compatible because frames are generated **live per ask**, and speculation is a
bounded, continuously-re-planned, **discardable** buffer — not a frozen deck:

- Every learner signal (ask, interaction, mastery checkpoint, depth-gate, prerequisite descent)
  re-plans; stale speculation is invalidated. The live path always wins.
- Speculation is observability-first: prepared/invalidated/promoted are recorded events (the
  Observatory shows "future frames under construction") but nothing reaches the learner until a real
  signal promotes it.
- The `lookaheadBudget` governs greed (default 1 — only N+1) and is raised only via an Evolution
  Proposal (law #7). Each speculative compose is a governed dispatch that may be denied.

Determinism lives in **replay** (D3 recorded model output), not in generation.

## Alternatives Considered

- **MCCR as a new `block_type`.** Rejected: the block set is closed and single-producer with one
  `BlockProvenance`; a frame is multi-producer (planner + composer + media), and an MCCR is a
  multi-element layout, not one atom. Would pollute block ordering laws and make `traceBlock` lie.
- **MCCR as content on the explanation block.** Rejected: re-imports the duplication and
  document-growth the redesign removes.
- **Frame as a manifest/grouping over existing blocks.** Rejected: the growing prose block is being
  removed; there is no pre-existing block set to group (this is only the fallback heuristic).
- **`surface.frame.activated` as a canonical active pointer.** Rejected: couples a wall-clock-ish
  pointer to the log, breaking replay scrubbing and divergent multi-viewport playback (ADR-0007).
- **Two-call pipeline (explanation → distill MCCR → write script).** Rejected as the default:
  distilling already-distilled prose re-introduces show/speak divergence one layer up, at higher
  latency/cost; retained as a fallback for deep frames if single-call quality proves insufficient.
- **Pre-generate the whole lesson.** Rejected: the explicit non-goal (SRF-001 §2, F16 §2).

## Conformance to the ten invariants (blueprint §25.4)

1. All frame transitions are protocol-governed `surface.*` events. 2. Frames write events, not
memory; durability only via Memory Mutation on keep/consolidation (F16 §9). 3/4. Composer/planner
dispatch carries the session intent/context leases. 5. Image generation runs only when
`image_plan.helps` through the governed media seam. 6. Composer/planner are manifest-bearing,
capability-enveloped units. 7. `lookaheadBudget` changes only via Evolution Proposal. 8. MCCR
content is derived from recorded model output (evidence) and replays under D3. 9. No hidden state:
no `active_frame_id` or layout in the log; all canonical state is folded from events. 10.
Composer/planner emit `surface.agent.reasoning.summary` + `surface.agent.work.timing` (ADR-0029).

## Consequences

- **Experience:** the board becomes distilled visual memory (MCCR); the voice constructs
  understanding (narration script); the highlight tracks the discussed element; frames fit one
  viewport and transition without scrolling.
- **Observability:** plans, MCCR drafts, narration scripts, image prompts, reasoning, and
  speculative frames-under-construction are all in the Agent Observatory — removed from the learner's
  surface, never hidden from observability.
- **Replay/determinism:** preserved. `fold([planned, composed]) ≡ fold([composed])`;
  `fold([…element.delta, composed]) ≡ fold([composed])`; an invalidated speculative frame is provably
  absent from `frames[]` for every prefix; a promoted frame re-folds byte-identically.
- **Backward compatibility:** when the composer is unavailable (no model / deterministic offline),
  the session takes the legacy explanation-block + `collectNarrationTexts` path; new slices stay
  empty and legacy logs fold deep-equal under the new fold (F16 §12).
- **Negative:** more events per ask cycle and two new model-backed units; a larger combined composer
  contract risks truncation (mitigated by a strict parser that fails to the deterministic fallback).

## Open Questions

- **Ordinal scheme on promotion** — sparse integers (step 1000) so promotion inserts between
  canonical frames without renumbering; the promoted event carries the final value.
- **Recompose vs version** — learner-driven re-composition mints a new `frame_id` (append-friendly,
  clean scrubbing); `version` bumps are reserved for planned→composed / delta-settle.
- **`traceFrame`** — a frame-level provenance trace analogous to `traceBlock`, deferred to
  implementation.
