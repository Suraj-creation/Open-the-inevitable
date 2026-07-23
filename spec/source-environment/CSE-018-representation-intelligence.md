---
name: cse-representation-intelligence
spec:
  id: CSE-018
  title: Representation Intelligence — the Cognitive Representation Engine
  domain: source-environment
  status: draft
  owner: product-architecture
  last_reviewed: 2026-07-18
---

# CSE-018 — Representation Intelligence: the Cognitive Representation Engine

> One-sentence purpose: **this spec owns how cognitive intent becomes the clearest possible
> multimodal representation** — a governed agent that decides what the learner sees, when, how much,
> in what visual language, and how it unfolds, so nothing reaches the surface until it is presented
> in the most cognitively effective form.

**Adopted by:** ADR-0058. **Upstream law:** ADR-0030 (Cognitive Frames + MCCR + narration — the
architecture this deepens), ADR-0057 (source-anchored teaching — the pipeline this extends),
CSE-011 (the Director — pace/state, which the RIA serves), CSE-012/013 (Scene/Cinematography — which
the RIA's emphasis timeline drives), CSE-003 (the meaning layer — concept type), the CDL
(`spec/design/` — the visual language the RIA assigns, never invents), blueprint §25.4.

## 1. Why this spec exists

The production audit (`spec/research/cse-production-readiness-audit-2026-07.md` Part II) found the
learner-facing representation had not evolved to match the architecture beneath it: a closed 10-slot
MCCR vocabulary rendered by a (excellent but) fixed design system. The model chooses *which* slots
and their text; every visual decision — hierarchy, typography role, color, layout, reveal order,
animation — is hardcoded. That bought consistency, replay-safety, and honest degradation (the right
architecture — the external evidence is unambiguous that freeform generated UI fails). But the
vocabulary is too small and the plan too shallow for representation to be *cognitive*: every frame
is the same anatomy with different words; representation does not vary by concept type, learner
expertise, or modality; relationships are stated in prose, not reinforced visually; and density
recomposition can hide essential content behind disclosure chips.

The fix is **not** to let the model draw. It is to let a governed agent *plan representation* over a
much richer deterministic vocabulary, and to make that plan a replayable, inspectable artifact.

## 2. Principle & non-negotiables

**Representation is a cognitive capability, not decoration.** Everything the learner sees maximizes
understanding — not information density, not aesthetics. The Representation Intelligence Agent (RIA,
`agent.representation`) is the guardian of representation quality across the surface. Its
responsibility is cognitive representation, **not UI design**: it decides *what to show, when, how
much, how to represent it, how to synchronize it, how to progressively reveal it, and how to
transform it as understanding evolves*.

**Non-negotiables (invalidate an implementation even if it works):**

- The RIA emits a **plan over a closed vocabulary of deterministic primitives** — never freeform UI,
  never runtime-generated layout or coordinates (ADR-0030/0057 rejection, upheld).
- The plan is **recorded, replayable, and inspectable** ("why this representation?" resolves like a
  directive's rationale).
- The RIA has a **deterministic fallback equal to today's rendering** — so its rollout can never
  regress a frame; a frame with no plan renders exactly as pre-RIA.
- The RIA **assigns** CDL roles/hues/motion; it never invents visual language (the CDL owns that).
- The RIA **serves** the Director (CSE-011) and drives the Cinematographer's emphasis (CSE-013); it
  does not override the Director's state/pace or the learner's agency.

## 3. The Representation Laws

Ten laws the RIA's plan must satisfy (audit Part II §12):

1. **No Hidden Knowledge.** Content essential to the current explanation is visible without
   interaction. Interaction deepens understanding; it never reveals what should already be shown.
   (Density recomposition may fold *supporting* material only — the plan's hierarchy tags decide.)
2. **Progressive Construction.** Anything with internal structure (derivation, proof, algorithm,
   diagram, flowchart, reaction, argument, code walkthrough) unfolds step-by-step on narration
   beats. The learner watches understanding built, never receives the finished artifact first.
3. **Intelligent Density.** Each beat carries exactly the elements required for the current
   understanding step, within a working-memory budget. Not minimal, not maximal — bounded.
4. **Persistent Residue.** Narrated cognition leaves durable marks (constructed lines stay,
   highlights decay to tint, key insights crystallize). Nothing important lives only in the
   transient audio channel (the transient-information effect).
5. **Semantic Typography & Color.** The learner recognizes the *kind* of knowledge — canonical
   principle vs. hypothesis vs. misconception vs. memory cue — from visual language alone, never
   labels (the CDL role/hue system, driven per-element by the RIA).
6. **No Redundancy.** Narration is never subtitled verbatim onto the stage; the caption channel is
   the only verbatim text. On-stage text signals structure, never repeats speech.
7. **Spatial & Temporal Contiguity.** Explanation renders at the thing explained, within the same
   narration beat (gloss at the anchored region, annotation on the equation, label on the diagram
   part).
8. **Expertise Reversal.** Choreography degrades as mastery rises: fewer highlights, faster pacing,
   terser scaffolds, worked examples fading to completion problems. The RIA reads the development
   ladder and adapts — and discloses the adaptation.
9. **Pedagogical Images Only.** Every image carries its recorded rationale (what misunderstanding it
   resolves); decoration is a defect. Images participate in the reveal/emphasis schedule.
10. **A move with no cognitive reason is a defect** (inherited from CSE-013, extended to all
    representation: every animation, color, and layout choice traces to a law or a plan entry).

## 4. The RepresentationPlan

The RIA converts a composed frame + context into a `RepresentationPlan`, emitted as
`surface.representation.planned` and folded into a `representation` slice (replayable; inspectable):

- **Composition** — the elements to show, their representational hierarchy (`primary` / `supporting`
  / `residue`), and the explicit **exclusion list** (what was considered and left out — Law 1/3,
  recorded).
- **Reveal schedule** — per element, the narration beat that reveals it, including **sub-element**
  schedules (derivation lines, diagram construction steps, graph traces, table rows) — Law 2.
- **Emphasis timeline** — the typed highlight/spotlight sequence handed to the Cinematographer
  (CSE-013) — Law 5/7.
- **Epistemic roles** — each element tagged with its knowledge kind (canonical / definition /
  reasoning / example / warning / misconception / insight / memory-cue / question / hypothesis /
  proof-step / observation) — the CDL renders the tag; the RIA assigns it — Law 5.
- **Density verdict** — bounded element-interactivity per beat; if the frame exceeds budget the RIA
  requests a frame split *upstream* rather than folding essentials into chips — Law 1/3.
- **Adaptivity record** — what was changed for this learner and why ("full choreography — novice";
  "terse signaling — expertise reversal"), disclosed like every adaptation — Law 8.

## 5. Position in the pipeline

```
Learning goal / source region
  → Director            (state, pace, WHICH source region — CSE-011, R2b)
  → Frame Planner       (what frames, sub-focus — ADR-0030)
  → Composer            (content: MCCR slots + narration script — ADR-0030/0057)
  → RIA                 (HOW: the RepresentationPlan — §4)
  → Cinematography      (camera realization of the plan's emphasis timeline — CSE-013)
  → Delivery            (fold → render; the plan is deterministic to execute)
```

The RIA runs on the governed dispatch path (model-backed, D3-recorded, deterministic fallback). It
**collaborates** with: the Director (receives state/pace), the Frame Planner (may request splits),
the Composer (may request a missing element: "this proof needs a geometric interpretation"), the
Image Agent (every image request carries its pedagogical rationale), the Cinematographer (consumes
the emphasis timeline), Assessment/Memory (feedback + memory-cue placement).

## 6. MCCR 2.0 — the widened representation vocabulary

Per concept type, a deterministic grammar the RIA plans over (each an extension of the existing
element/fold/render pattern — schema → fold → renderer → deck export), all replay-safe:

- **Derivation** (theorem/proof/calculation): step sequence + per-step annotation, transformation
  labels ("substitute", "factor", "by induction"), changed-sub-expression highlight between steps,
  optional geometric-interpretation panel. (R3a is the seed of this.)
- **Algorithm**: state + invariant panel, stepped trace over an example input, loop/branch structure.
- **Process** (biological/chemical/physical): stage diagram constructed stage-by-stage, causal
  arrows drawn as narration names the causation.
- **Comparison**: aligned columns, per-row emphasis beats, explicit differences trace.
- **Graph/plot**: axes first, then the curve *drawn* as a trace, annotations landing on features.
- **Structure** (taxonomies/architectures): semantic-zoom tree (the existing diagram kinds gain
  construction schedules + zoom levels).
- **Misconception**: wrong-model shown, *dissolved* (CSE-013 shot), right-model built in its place;
  the contrast preserved as residue.
- **Code**: line-anchored narration beats, value-flow annotations, executed-example residue.

## 7. Rollout & failure

- **Deterministic fallback = current rendering.** The first RIA is a pure function reproducing
  today's behavior (parity); model-backed planning layers over it. A frame with no plan renders as
  pre-RIA. This makes every increment safe (no regression possible).
- **Recorded + replayable.** The plan is a `surface.representation.planned` event (D3 for the
  model-backed path); replay reproduces the exact representation.
- **Honest degradation.** A model failure falls back to the deterministic plan, surfaced in the
  cognition-health slice like every other unit.

## 8. Delivery (phases)

- **R4a** — the `RepresentationPlan` contract + `surface.representation.planned` event + fold slice +
  a **deterministic** `agent.representation` planner (parity with today) + "why this representation?"
  inspectability. The safe foundation.
- **R4b** — epistemic role tags per element end-to-end (Law 5): the RIA assigns knowledge-kind roles;
  the CDL renders them; the deck export carries them.
- **R4c** — the derivation + misconception grammars formalized as MCCR 2.0 (Law 2), generalizing R3a.
- **R4d** — model-backed planning (the exclusion list, density verdict → upstream frame split,
  adaptivity record) on the governed path.
- **R4e+** — the remaining grammars (algorithm/process/graph/structure/code); expertise-reversal
  adaptation (Law 8); per-element image rationale (Law 9).

## 9. Non-goals

- Not UI design, not layout freedom, not aesthetics-for-their-own-sake (§2).
- Not runtime-generated UI/coordinates (closed vocabulary only).
- Not a replacement for the Director or the learner's agency.
- Not the Cinematographer (it drives the emphasis timeline; CSE-013 realizes it).

## 10. Open questions

- Whether the RIA is a distinct unit or a composer super-role (leaning: distinct unit, so the plan is
  a separately-recorded, separately-inspectable artifact).
- The density budget model (element-interactivity count vs. a cognitive-load estimate) — start with a
  bounded count, evolve under ADR-0021.
- How expertise-reversal reads mastery (development ladder stage vs. per-concept confidence) —
  coordinate with CSE-005.
