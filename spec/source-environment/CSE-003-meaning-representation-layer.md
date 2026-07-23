---
name: cse-meaning-representation-layer
spec:
  id: CSE-003
  title: The Meaning Representation Layer — From Content Intelligence to an Understanding Engine
  domain: source-environment
  status: draft
  owner: product-architecture
  last_reviewed: 2026-07-09
  upstream_dependencies:
    - source-environment/CSE-001-foundations
    - source-environment/CSE-002-canonical-source-representation
    - world-state/knowledge-graph-engine
    - protocols/model-invocation-protocol
    - protocols/reasoning-trace-protocol
    - architecture/Cognitive-Architecture
  downstream_dependencies:
    - source-environment/CSE-004-transformations
    - source-environment/CSE-005-episodic-cognition
    - source-environment/CSE-007-source-agent-society
  related_protocols: [cognition-packet-protocol, model-invocation-protocol, reasoning-trace-protocol, memory-mutation-protocol]
  related_events: [source.layer.constructed, world.node.created, world.edge.created]
  related_runtime_systems: [world-state-graph, knowledge-graph-engine, cognitive-unit-runtime, cognitive-evaluation-layer]
  related_governance_systems: [governance-kernel, capability-envelope]
  related_observability_systems: [cognitive-observability, reasoning-trace]
  semantic_tags: [source-environment, meaning, mental-models, causality, analogy, abstraction, misconceptions, epistemics]
  canonical_references:
    - source-environment/CSE-002-canonical-source-representation#3-2
    - architecture/Cognitive-Architecture
    - architecture-decisions/ADR-0027-cognitive-evaluation-layer
---

# CSE-003 — The Meaning Representation Layer (MRL)

## 1. Purpose

The most important architectural addition of the CSE domain over a conventional knowledge-graph
approach. Knowledge graphs capture entities, relations, references, and dependencies — strong at
structure, weak at mental models. The MRL is layer 7 of the canonical representation (CSE-002
§3.2): it models what a passage is *trying to do to a mind*. It is the layer that lets the system
answer *"what mental model is this paragraph trying to build?"* and *"what counterexample would
expose a misunderstanding here?"* — turning CSE from a content-intelligence system into an
**understanding engine**.

## 2. Philosophy

- **Meaning is inference, and says so.** Every MRL entry is system inference over evidence, never
  evidence itself. It carries provenance class `inference`, a confidence, and the anchors it was
  inferred from. The surface renders it in the inference channel, never the evidence channel
  (CDL provenance semantics; CSE-008 §7).
- **Meaning sits between knowledge and pedagogy.** The MRL consumes the knowledge layers (L1–L6)
  and feeds the cognitive layer (L8): objectives, difficulty, and misconception prediction are
  *derived from* meaning, not guessed directly from text.
- **Candidates are shared; selection is personal.** MRL candidates (e.g., four analogies for one
  concept) are computed once per source version and shared. *Which* analogy serves *this* learner
  is a learner-conditioned selection made at teaching time (CSE-007), informed by the learner's
  world model and episode history.
- **Experts disagree, and the MRL records that** rather than averaging it away (Constitution #7).

## 3. Primitives — the MeaningUnit Catalog

The MRL is a set of typed **MeaningUnits**, each `{ unit_id, kind, source_anchors[], concept_refs[],
payload, confidence, produced_by, model_invocation_refs[] }`. The `kind` catalog:

| Kind | Models | Payload sketch | Example |
|---|---|---|---|
| `intent` | What the passage wants the reader to believe or be able to do | claim/skill target + register (persuade, define, derive, warn) | "make the reader able to predict when gradient descent oscillates" |
| `causal-model` | What causes what, under which conditions it breaks | cause→effect edges + boundary conditions | "learning rate ↑ → divergence, *when* curvature is high" |
| `analogy-map` | A structurally similar, more familiar system | source↔target correspondence map + where the analogy breaks | "eigenvectors ↔ axes of a stretching fabric; breaks for complex eigenvalues" |
| `abstraction-ladder` | The levels of detail above/below the current expression | ordered rungs, each with an anchor or generated form | phenomenon → rule → formalism → proof |
| `counterfactual` | What would have to differ for the claim to be false | perturbation + predicted consequence | "if the loss were non-convex here, this guarantee fails" |
| `explanatory-frame` | How the passage teaches: bottom-up, top-down, historical, by-contrast | frame tag + structural evidence | "taught historically: 1943 → 1986 → 2012" |
| `reasoning-pattern` | Deduction, induction, analogy, simulation, proof-by-contradiction… | pattern tag + step anchors | "proof by contradiction, pivot at eq. 4.7" |
| `conceptual-compression` | The shortest faithful restatement | text + fidelity notes (what the compression drops) | "backprop = chain rule + bookkeeping" |
| `interpretation-set` | Where domain experts themselves disagree on meaning | competing readings, each with citation anchors | "probability: frequentist vs. Bayesian reading of this passage" |
| `transfer-map` | How the idea maps onto other domains | target domain + correspondence + F08 bridge refs | "annealing ↔ stochastic optimization" |
| `misconception-hypothesis` | The predictable wrong model a learner may form here | wrong-model statement + diagnostic probe + repair route | "learners read 'gradient' as 'slope of the data'" |

`misconception-hypothesis` is the MRL→L8 hinge: predictions here become assessment probes (F14)
and misconception-first teaching moves (CSE-007). Their later confirmation/refutation against real
learner outcomes is the MRL's ground-truth loop (§6).

## 4. Architecture & Computation Model

1. **Placement.** MRL units are world-state graph nodes linked to concept nodes and source
   anchors (edges: `expresses`, `evidences`, `breaks-at`). They are queryable alongside the
   knowledge graph (knowledge-graph-engine) — one graph, richer node vocabulary; not a parallel
   store.
2. **Progressive & attention-driven.** MRL construction follows CSE-002 §4: computed for regions
   the learner is approaching, at candidate depth proportional to concept importance (timeline
   centrality, prerequisite fan-out). Never eagerly for a whole book.
3. **Determinism.** MRL synthesis is model work: every invocation recorded before use (D3).
   Replay folds recorded units; it never re-infers.
4. **Versioning.** Units are immutable; re-enrichment produces successor units linked by
   `supersedes`. A learner's episode that cited an old analogy stays replayable forever.

## 5. Learner-Conditioned Selection (the L7→L8 seam)

At teaching time, the ensemble (CSE-007) selects among shared candidates using the learner's
development state (CSE-005): known-domain overlap for analogies, ladder-rung choice by current
abstraction comfort, frame choice by demonstrated learning style, misconception probes by episode
history. Selection is an **Enrichment Decision** — proposed on the blackboard, arbitrated,
recorded, and observable ("why this analogy?" resolves to the selection trace). Selection writes
nothing to shared layers; it writes learner-side world-state deltas and episode entries only.

## 6. Quality & Evaluation

MRL quality is measured, not assumed — through the Cognitive Evaluation Layer (ADR-0027):

- **Grounding checks:** every unit's payload must be entailed by its anchors (spot-audited by
  judge evaluation; failures quarantine the unit).
- **Outcome validation:** misconception-hypotheses are scored by hit-rate against F14 assessment
  outcomes; analogies by downstream explanation success; compressions by explain-back fidelity
  (CSE-009 self-explanation console).
- **Disagreement honesty:** interpretation-sets are checked against citation balance — a unit
  that flattens a live debate into one reading is a defect.
- Telemetry: units per concept, confidence calibration, supersession rate, quarantine rate.

## 7. Governance & Failure Semantics

- MRL units are inference: they may never be presented as source claims; rendering them in the
  evidence channel is a conformance violation (Source Law: **Grounded**).
- Cold start: with no learner history, selection falls back to population-agnostic defaults
  (frame from the source's own explanatory-frame, most-familiar-domain analogy). The
  self-improving instructional layer (CSE-006 §7) improves priors only through governed evolution.
- A concept with no MRL coverage teaches from L1–L6 alone — visibly ("meaning analysis pending"),
  never by silently fabricating unanchored meaning.
- Low-confidence units are surfaced amber-flagged or withheld per governance policy, not
  laundered into confident prose.

## 8. Open Questions

- ~~Minimum viable `kind` set for CSE-P2 delivery~~ — **resolved (ADR-0037, M6):** v1 ships
  intent, analogy-map, misconception-hypothesis, conceptual-compression; the remaining kinds land
  with the capabilities that consume them (causal-model/counterfactual with simulations,
  interpretation-set with the Claim Graph M9, transfer-map with F08 bridges).
- Whether abstraction-ladders should be first-class graph paths (shared with knowledge-graph
  engine's layer concept) or MRL-local payloads — needs a joint decision with `world-state/`.
- Confidence calibration source: judge-only vs. judge + outcome-weighted blending.
