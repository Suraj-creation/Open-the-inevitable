---
name: F03-recursive-prerequisite-intelligence
spec:
  id: F03
  title: Recursive Prerequisite Intelligence (ULI Core)
  pillar: P3
  domain: product
  status: draft
  owner: product-architecture
  last_reviewed: 2026-06-02
  upstream_dependencies:
    - product/Broader-feature-product
    - vision-application/Universal-Learning-Intelligence-Agent
    - curriculum/
    - pedagogy/
    - world-state/
    - reasoning/
  downstream_dependencies:
    - product/features/F02-dynamic-cognitive-navigation
    - product/features/F04-adaptive-multimodal-explanation
    - product/features/F08-interdisciplinary-knowledge-graph
    - product/features/F10-research-innovation-acceleration
    - product/features/F14-assessment-mastery-depth
  related_protocols: [cognition-packet-protocol, cognitive-event-protocol, reasoning-trace-protocol, memory-mutation-protocol]
  related_events: [graph.constructed, graph.descended, prerequisite.discovered, zero-knowledge.reached, graph.collapsed, graph.expanded, reasoning.trace.emitted]
  related_runtime_systems: [world-state-graph, cognitive-unit-runtime, cognitive-scheduler]
  related_governance_systems: [governance-kernel, cognitive-safety]
  related_observability_systems: [cognitive-observability, reasoning-trace, learner-outcome-telemetry]
  semantic_tags: [ULI, prerequisite-discovery, knowledge-graph, zero-knowledge-point, decomposition, learner-model]
  canonical_references:
    - vision-application/Universal-Learning-Intelligence-Agent
    - product/Broader-feature-product#5-the-cognitive-spine---uli--ualrci
---

# F03 — Recursive Prerequisite Intelligence (ULI Core)

## 1. Purpose

The cognitive engine that operationalizes ULI's foundational axiom — *"no concept exists
independently; every concept depends on smaller concepts"* — by **recursively decomposing** any
target concept into its full directed-acyclic prerequisite graph, terminating every branch at a
*Zero-Knowledge Starting Point* (a concept any human can grasp from everyday experience). This is
the engine beneath the navigation timeline (F02), the explanation system (F04), and the
interdisciplinary graph (F08).

The single product commitment: **invisible prerequisite blindness ends here**. Every concept the
learner meets has a fully traced chain of foundations beneath it, and any confusion is diagnosed
by descent into the chain — never re-explained at the same level.

## 2. Scope & Boundaries

- **In scope:** the six-step ULI pipeline (Understand → Identify → Decompose → Construct →
  Rebuild → Deliver) applied to any concept; recursive prerequisite descent; Zero-Knowledge
  termination criterion; per-learner graph specialization; difficulty gradients; mastery
  checkpoints; cross-domain bridge discovery (handed off to F08); confusion-driven re-descent.
- **Out of scope:** the *visual* surface of the graph (F02, F09); the *delivery* of concepts
  through the seven layers (F04); the *acceleration* layer on top (UALRCI is mostly F10); the
  *memory* substrate (F05); the *graph storage* (`spec/world-state/`).
- **Non-goals:** producing a generic, learner-agnostic prerequisite catalog; treating
  prerequisites as a static syllabus.

## 3. Personas & Modes

The prerequisite engine runs the same algorithm for all personas; what differs is the **stop
criterion** and **starting position** read from the learner model:

| Persona | Adjustments |
|---|---|
| Child | Earlier termination at Layer-0 (story/intuition) Zero-Knowledge points; bigger reliance on analogy |
| Adult beginner | Standard descent; aggressive transfer-learning detection from declared expertise |
| Researcher | Compressed descent (many foundations assumed mastered); aggressive cross-domain bridge surfacing |
| Educator/Institution | The engine runs against the *cohort* learner model; outputs aggregate prerequisite heat-maps |

## 4. Narrative Experience

Most of F03 is invisible. The learner experiences its outputs through F02 (timeline) and F04
(explanations). What they may *feel* directly:

- *"Wait — to make sense of this, you'll want to know X first. Want to take that one minute?"*
  surfaced by the Curriculum Agent when the descent finds a critical missing foundation.
- *"You already understand Y — that's why this comes easily; let's reuse that intuition."* when
  the engine finds a transfer-learning opportunity.
- *"Let's step back."* — when a confusion event triggers a re-descent: the system does not
  re-explain at the same level; it descends.

## 5. ULI / UALRCI Hooks

F03 **is** ULI's core. It implements:

- The six-step pipeline.
- The Zero-Knowledge termination criterion.
- The seven-layer concept layering model (Layer-0 story → Layer-6 research/generative) — the
  *layering* is owned by F04, but the *map* from prerequisite to layer is produced here.
- UALRCI's prerequisite-parallelization strategy at the graph-construction level (independent
  branches are flagged for parallel pursuit).

## 6. Agents Involved

| Agent | Role |
|---|---|
| **Curriculum / Planner** | Primary owner of decomposition; emits the graph |
| **Explanation / Teacher** | Consumer — receives concept-by-concept layer assignments |
| **Practice / Assessment** | Consumer — receives the mastery checkpoint list |
| **Innovation Agent** | Listens for cross-domain bridges to surface (handed to F08) |
| **Memory Agent** | Reads/writes the learner-specific graph projection |
| **Socratic Agent** | Activates on confusion events to drive guided-discovery descent |

## 7. Cognitive OS Primitives Used

- **World-State Graph** — the canonical store of the learner-specific prerequisite DAG.
- **Cognition Packet** — concept descents, mastery validations, transfer-learning detections.
- **Memory Mutation** — confidence-per-concept updates; collapsed/expanded subtree state.
- **Reasoning Trace** — every prerequisite-discovery decision and every Zero-Knowledge termination
  carries a trace.
- **Cognitive Scheduler** — parallelizable descents are scheduled accordingly.

## 8. Events, Protocols & State Transitions

Emits:

- `graph.constructed`, `graph.descended`, `graph.expanded`, `graph.collapsed`
- `prerequisite.discovered`, `prerequisite.assumed-mastered`, `prerequisite.repair-required`
- `zero-knowledge.reached`
- `bridge.candidate.detected` (consumed by F08)
- `transfer-learning.opportunity.detected`
- `mastery.checkpoint.declared`

State transitions:

- Per-concept *unknown → exposed → engaged → competent → mastered → connected*.
- Per-edge *latent → active → traversed → satisfied*.
- Per-subtree *expanded ↔ collapsed* based on demonstrated mastery.

## 9. Memory & World-State Effects

- The learner-specific graph projection is **persisted** in the world-state graph and **summarized**
  into the semantic memory tier as a learner-model artifact.
- Confidence scores per concept are updated on every interaction (read in F14 for depth gating).
- Mastered subtrees are *collapsed* — not deleted — so they can re-expand if a confusion event
  questions the mastery.

## 10. Governance, Safety, Privacy, Ethics

- **Cognitive safety**: recursive-cognition stabilization applies — the descent algorithm has a
  bounded depth and bounded branching factor per call, with safeguards against pathological
  expansion. See `spec/cognitive-safety/`.
- **Source grounding**: prerequisite assertions ("X requires Y") are evidence-backed by the
  pedagogy and curriculum specs; novel assertions (e.g., generated by an LLM-backed planner) must
  be flagged as inferred until validated.
- **Bias surfacing**: the engine surfaces — for educators/institutions — any systematic
  prerequisite gaps it observes across cohorts (potential curriculum failures *or* potential
  systemic bias in the prior education the cohort received).

## 11. Observability

- `reasoning.trace` is mandatory on every `prerequisite.discovered` and every
  `zero-knowledge.reached` — *why* this branch terminated where it did, *what* evidence supports
  the prerequisite link.
- Telemetry: average descent depth per domain; Zero-Knowledge hit-rate; transfer-learning
  opportunity rate; cross-cohort prerequisite heat-maps.
- Replay determinism: **full** for the graph structure; **explained-non-determinism** for the
  ordering of independent branches (deterministic given seed + learner state).

## 12. Failure Semantics

| Failure | Behavior |
|---|---|
| Recursion bound exceeded | Halt descent; emit `graph.descent.bound-exceeded`; deliver a *"need-clarification"* path with the partial graph |
| Prerequisite assertion unverifiable | Mark inferred; surface to learner / educator with confidence band |
| Cycle detected (broken DAG invariant) | Reject; emit `graph.invariant.violation`; route to spec/architecture-decisions for the meta-question |
| World-state graph unavailable | Fall back to a *transient* in-session graph; mark non-persistent; surface degraded mode |

## 13. Architecture Conformance Statement

- Graph mutations occur only through Memory Mutation Protocol / world-state delta protocol.
- The descent algorithm is **pure-function** at each step given the learner state — preserving
  replay determinism.
- Every cognitive decision (prerequisite link, termination, collapse, repair-required) emits a
  reasoning trace.
- Recursive cognition is bounded — depth, branching, time budgets are enforced by the scheduler.

## 14. Success Metrics

- **Confusion-to-true-foundation rate**: > 80% of confusion events trace, via descent, to the
  *actual* missing prerequisite (rather than re-explaining at the same level) — measured against
  human-judged samples.
- **Zero-Knowledge reachability**: 100% of construction calls successfully terminate at
  Zero-Knowledge points for the requested target — non-termination is a defect.
- **Transfer-learning opportunity recall**: > 70% of *true* cross-domain transfer opportunities
  for the learner are detected (judged on benchmark cases).
- **Graph reshaping latency**: median < 500ms; p95 < 3s for typical domains.

## 15. MVP → Advanced → Frontier Phasing

- **MVP:** decomposition for a small set of high-priority domains (math, programming, ML, physics,
  selected school subjects) with a curated pedagogy/curriculum corpus.
- **Advanced:** open-domain decomposition; cross-domain bridge discovery; cohort prerequisite
  heat-maps; transfer-learning detection from declared/inferred expertise.
- **Frontier:** automated curriculum *generation* from research literature (closed-loop with F12);
  decomposition that incorporates emerging research as it lands (live frontier integration).

## 16. Open Questions

- The exact representation of *Zero-Knowledge*: is it a binary criterion, or a confidence band
  parameterized by persona class? Likely the latter; ADR needed.
- Provenance for prerequisite assertions sourced from LLM-backed planning vs.
  pedagogy-corpus-verified — the boundary needs a clear policy.
- How aggressively to collapse mastered subtrees: too aggressive risks losing recall capacity;
  too conservative risks visual noise.

## 17. References

- `spec/vision-application/Universal-Learning-Intelligence-Agent.md` §I (Founding Insight), §III
  (Core Objective), §IV (Recursive Prerequisite Discovery), §V (Learner Phase), §VI–§VIII (graph
  construction and ascent).
- [`../Broader-feature-product.md`](../Broader-feature-product.md) §5 (Cognitive Spine), §6.1
  (Worked Example).
- `spec/curriculum/`, `spec/pedagogy/`, `spec/world-state/`, `spec/reasoning/`,
  `spec/cognitive-safety/`.
