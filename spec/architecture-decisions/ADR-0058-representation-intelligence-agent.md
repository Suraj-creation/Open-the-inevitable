# ADR-0058: The Representation Intelligence Agent (Production Goal II)

**Status:** Accepted
**Date:** 2026-07-18
**Related:** CSE-018 (the owning spec, authored with this ADR), the CSE production-readiness audit
Part II (`spec/research/cse-production-readiness-audit-2026-07.md`), ADR-0030 (Frames + MCCR +
narration — the architecture deepened), ADR-0057 (source-anchored teaching — the pipeline extended),
CSE-011/012/013 (Director/Scene/Cinematography), the CDL (`spec/design/`).

## Context

The audit's Production Goal II: the learner-facing representation has not evolved to match the depth
of the architecture beneath it. The MCCR board is a closed 10-slot vocabulary rendered by a fixed
(excellent) design system; representation does not vary by concept type, learner expertise, or
modality, and can hide essential content behind disclosure. The external evidence is unambiguous
that the *architecture* is right — freeform generated UI fails ~20%+ of the time; plans over closed
vocabularies win. So the answer is not to let the model draw, but to add a governed agent that
**plans representation** over a much richer deterministic vocabulary, with the plan a replayable,
inspectable artifact.

## Decisions

### 1. A new privileged cognition unit: `agent.representation` (the RIA)

The RIA sits in the pipeline **after** the Composer and **before** the Cinematographer (CSE-018 §5).
It converts a composed frame + context (concept type, learner state, source evidence, Director
directive, viewport constraints) into a `RepresentationPlan` — composition + hierarchy + exclusion
list, a reveal schedule (incl. sub-element steps), an emphasis timeline, epistemic role tags, a
density verdict, and an adaptivity record (CSE-018 §4). Its responsibility is cognitive
representation, not UI design.

### 2. A plan over a closed vocabulary — never freeform UI

The RIA emits a plan the client executes deterministically over proven primitives (the MCCR 2.0
grammars, CSE-018 §6). It never generates layout or coordinates at runtime (the ADR-0030/0057
rejection, upheld). This keeps replay exact and rendering reliable.

### 3. Deterministic fallback = current rendering (safe rollout)

The first RIA is a **pure function that reproduces today's behavior** — a frame with no plan renders
exactly as pre-RIA, and the deterministic plan is byte-parity with the current MCCR render. Every
subsequent increment (role tags, grammars, model-backed planning) layers over this floor, so the RIA
can never regress a frame. The model-backed path is D3-recorded; a model failure falls back to the
deterministic plan, surfaced in cognition-health.

### 4. The RIA assigns CDL language; it never invents it

Epistemic roles, hues, and motion come from the CDL; the RIA *assigns* them per element (Law 5). The
design system stays the single owner of the visual language — the RIA decides *which* role a piece
of knowledge is, the CDL decides how that role looks.

### 5. The plan is recorded, replayable, and inspectable

`surface.representation.planned` folds into a `representation` slice; "why this representation?"
resolves from the plan's rationale/exclusion/adaptivity like a directive's rationale. Representation
decisions become as observable as reasoning decisions.

## Consequences

- Representation becomes an intelligent, governed capability rather than a fixed template — the frame
  can vary by concept type, expertise, and modality while staying replay-safe.
- The ten Representation Laws (CSE-018 §3) become enforceable at the plan layer (No Hidden Knowledge,
  Progressive Construction, Persistent Residue, Expertise Reversal, …).
- The move is incremental and non-regressing: the deterministic-parity floor means the RIA ships in
  slices (R4a→R4e) each behind the fallback.

## Rejected alternatives

- **Freeform model-generated UI / layout.** <80% compile reliability, no replay, no fidelity proof;
  the whole reason MCCR exists. Plans over a closed vocabulary only.
- **Folding representation into the Composer.** The plan must be a separately-recorded, separately-
  inspectable artifact (a distinct unit), so "why this representation?" is answerable independently
  of "what content?".
- **A hard cutover (RIA replaces the current render).** Rejected for the deterministic-parity floor:
  a new representation engine must never regress a working frame; it layers over today's rendering.
- **Letting the RIA own the CDL visual language.** Rejected — the CDL is the single design-language
  owner; the RIA assigns roles, the CDL renders them.

## Deferred (named scope)

- The model-backed planner (R4d) — the first shipping RIA is deterministic parity (R4a).
- The full MCCR 2.0 grammar set (algorithm/process/graph/structure/code) — R4e+.
- Expertise-reversal adaptation from the development ladder (Law 8) — needs CSE-005 coordination.
- The density-budget cognitive-load model — starts as a bounded element count.
