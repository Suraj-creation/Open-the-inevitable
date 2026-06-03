---
name: F04-adaptive-multimodal-explanation
spec:
  id: F04
  title: Adaptive Multimodal Explanation & Dynamic System Prompting
  pillar: P4
  domain: product
  status: draft
  owner: product-architecture
  last_reviewed: 2026-06-02
  upstream_dependencies:
    - product/Broader-feature-product
    - product/features/F03-recursive-prerequisite-intelligence
    - product/features/F05-persistent-cognitive-memory
    - pedagogy/
    - reasoning/
    - vision-application/Universal-Learning-Intelligence-Agent
  downstream_dependencies:
    - product/features/F09-living-universe-experience
    - product/features/F14-assessment-mastery-depth
    - product/features/F12-collective-cognitive-evolution
  related_protocols: [cognition-packet-protocol, cognitive-event-protocol, reasoning-trace-protocol, cognitive-unit-abi]
  related_events: [concept.engaged, explanation.delivered, layer.transitioned, dsp.rewritten, dsp.version.advanced, modality.selected, modality.swapped]
  related_runtime_systems: [cognitive-unit-runtime, cognitive-scheduler, world-state-graph]
  related_governance_systems: [governance-kernel, cognitive-safety, capability-envelope]
  related_observability_systems: [cognitive-observability, reasoning-trace, learner-outcome-telemetry]
  semantic_tags: [seven-layers, DSP, dynamic-system-prompting, multimodal, explanation, infinite-explanations, pedagogy]
  canonical_references:
    - vision-application/Universal-Learning-Intelligence-Agent#ix-seven-layers
    - vision-application/Vision#xxvi-dynamic-system-prompting
---

# F04 — Adaptive Multimodal Explanation & Dynamic System Prompting

## 1. Purpose

The feature that *delivers* understanding once F02/F03 have placed the learner at a concept node:
the **seven-layer concept layering model** (Layer-0 Intuition/Story → Layer-6 Research/Generative),
the multimodal explanation engine that selects representations (text, diagram, simulation, story,
analogy, code, narrative, interactive timeline, AR/VR on the roadmap), and the **Dynamic System
Prompting (DSP)** layer that lets the agent instruction layer be continuously rewritten — in real
time, governed, versioned, replayable — from learner state and (in Educator Mode) the educator's
teaching signature.

The single product commitment: *"infinite explanations, each adapted to a learner's unique style,
pace, and cognitive preference"* — operationalized through depth-preserving, governance-respecting
DSP, not through unbounded prompt drift.

## 2. Scope & Boundaries

- **In scope:** the seven-layer model applied to any concept; modality selection and dual-coding;
  per-learner adaptation (analogy, abstraction scaling, pacing, weak-area reinforcement); DSP
  rewriting policy and versioning; explanation generation; teaching-signature application (in
  Educator Mode).
- **Out of scope:** the prerequisite graph itself (F03); the navigation surface (F02); the
  immersive substrate detail (F09); the *evaluation* of explanation quality (F14 + F12).
- **Non-goals:** generating explanations without a layer choice and modality rationale;
  open-ended self-rewriting of system prompts without governance.

## 3. Personas & Modes

| Persona | Default modality weighting |
|---|---|
| Child | Strong Layer-0/1 (story, visual, analogy); short turns |
| Older student | Balanced Layer-1–3; project tie-ins at Layer-4 |
| Researcher | Strong Layer-3 (math/logic) + Layer-5/6 (advanced + research) |
| Educator | Teaching-signature-weighted; default-or-personalized toggle |
| Open-Mode | Adaptive based on inferred curiosity depth |

## 4. Narrative Experience

The learner taps a node. An explanation appears at the *right* layer — neither babying nor
overwhelming. If the explanation lands, the system advances. If it does not, the system *changes
the angle* — a different analogy, a different modality, a step back to Layer-0 — rather than
saying the same thing louder. The learner can demand "more rigorous", "simpler", "show me
visually", "with code", "with a real-world example", and the system honors the request *and*
remembers the preference. Over weeks, the learner notices that explanations feel made-for-them;
they were.

In Educator Mode, the teacher can train the system on her style — analogies she uses, sequencing
she prefers, examples that have worked in her classroom. Her students' explanations carry her
signature within governed bounds, and every student knows whose pedagogy shaped a given
explanation.

## 5. ULI / UALRCI Hooks

- Implements ULI's **seven-layer layering** end-to-end.
- Honors ULI's *meet-the-learner-where-they-are* and *never-advance-past-a-shaky-foundation*
  invariants.
- Activates UALRCI's **dual coding**, **elaborative interrogation**, and **interleaving**
  strategies inside the delivery loop.
- Enforces UALRCI's depth-verification protocol's prerequisite signal (the five-test gate is
  evaluated in F14 — F04 emits the evidence).

## 6. Agents Involved

| Agent | Role |
|---|---|
| **Explanation / Teacher** | Primary owner of layered concept delivery |
| **Socratic** | Activates on Layer-2/3 transitions for guided discovery |
| **Simulation** | Activates when the optimal modality is interactive/3D |
| **Code Helper** | Activates for programming concepts (seven-layer programming pedagogy) |
| **Memory Agent** | Reads style preferences; writes new preference inferences |
| **Motivation Agent** | Calibrates tone on detected affective state |
| **Supervisor** | Arbitrates DSP rewrites; gates self-modification |

## 7. Cognitive OS Primitives Used

- **Cognition Packet** — every explanation turn is a typed packet with layer, modality, and
  evidence fields.
- **Cognitive Unit ABI** — DSP is the *instruction* surface of a Cognitive Unit; rewrites are
  versioned through the ABI.
- **Cognitive Event** — `dsp.rewritten`, `explanation.delivered`, `modality.selected`,
  `layer.transitioned`.
- **Reasoning Trace** — every layer transition, modality choice, and DSP rewrite emits a trace.
- **Memory Mutation** — preference inferences are committed via the protocol.
- **Governance Kernel** — DSP rewrites are governed: in-policy adjustments vs.
  evolution-proposal-grade changes (see F12).

## 8. Events, Protocols & State Transitions

Emits: `concept.engaged`, `explanation.delivered`, `layer.transitioned`, `modality.selected`,
`modality.swapped`, `dsp.rewritten`, `dsp.version.advanced`, `socratic.turn.opened`,
`elaborative.question.posed`, `confusion.signal.detected`.

State transitions:

- Per-concept *exposed → engaged → competent → mastered* (the actual mastery transition is gated
  by F14).
- Per-DSP version *draft → active → superseded → retired*.
- Per-modality preference *unknown → observed → preferred → confirmed*.

## 9. Memory & World-State Effects

- Per-concept *layer position* and *modality history* persisted to the learner model.
- Style/preference inferences committed via Memory Mutation with provenance.
- DSP version history persisted; rollback is first-class.

## 10. Governance, Safety, Privacy, Ethics

- **DSP boundary**: in-policy adjustments (tone, modality choice, analogy substitution) are live
  edits to the instruction layer; **out-of-policy** changes (changing the *pedagogical stance*,
  ethical framing, or the safety envelope) require an evolution proposal (F12) and human review.
  This boundary is itself a governed setting per institution / persona.
- **Cognitive safety**: self-modification limits prevent runaway DSP drift; every DSP rewrite is
  versioned and rollback-capable.
- **Source grounding**: explanations that surface external facts must be source-linked and
  citation-traceable through F15.
- **Hallucination containment**: explanations are gated against the curriculum/pedagogy corpus
  for factual claims; unsupported claims are flagged with confidence bands.
- **Educator signature ethics**: a teaching signature may not embed bias, exclusionary framing,
  or non-evidence-based claims; the Socio-Ethical Agent reviews signatures on uptake.

## 11. Observability

- **Reasoning trace** is **mandatory** for every layer transition, modality choice, and DSP
  rewrite.
- Telemetry: layer-distribution per learner; modality-mix per learner; DSP rewrite frequency;
  rollback rate; confusion-signal recovery rate.
- Replay determinism: **explained-non-determinism** — given the same learner state, DSP version,
  and packet sequence, the explanation output is reproducible through the recorded
  model-invocation envelope.

## 12. Failure Semantics

| Failure | Behavior |
|---|---|
| Explanation fails to land repeatedly | Escalate: descend (re-engage F03); swap modality; bring Socratic Agent; if persistent, surface to educator/Identical Agent |
| DSP rewrite violates policy | Reject; emit `dsp.rewrite.rejected`; route to evolution proposal if the violation is systematic |
| Modality unavailable (e.g., simulation backend down) | Fall back to highest-fidelity available modality; emit `modality.degraded` |
| Source citation fails | Mark explanation as *unverified*; require learner acknowledgement before advancing |

## 13. Architecture Conformance Statement

- No bare-string instruction edits — DSP rewrites are versioned through the Cognitive Unit ABI.
- Every cognitive decision (layer, modality, rewrite) emits a reasoning trace.
- Memory writes through Memory Mutation only.
- Side-effecting capability grants (e.g., access to a simulation backend) pass governance.
- Self-modification limits apply (cognitive-safety).
- Full event sourcing of the explanation stream — replayable to the prompt/model-call level.

## 14. Success Metrics

- **First-explanation-lands rate** (≥ Layer-1 comprehension on the first try) — directional metric
  judged on samples.
- **Layer transition smoothness** — proportion of concept journeys that traverse layers without
  re-descent, weighted by depth retained.
- **Modality fit** — preference-confirmation rate (learner accepts a chosen modality).
- **DSP stability** — rewrite frequency within band; rollback rate < 2%.
- **Depth preservation** — concepts marked competent that *also* pass the F14 five-test depth
  gate ≥ 95%.

## 15. MVP → Advanced → Frontier Phasing

- **MVP:** layers 0–4 across a curated domain set; text + diagram + simple simulation modalities;
  rule-based DSP adjustments (tone, depth, analogy slot).
- **Advanced:** layers 5–6; live modality swap; learned DSP adjustments under governance;
  educator-signature application; cohort-level DSP variants.
- **Frontier:** AR/VR/holographic modality activation (with F09); zero-latency voice mode with
  auto-documentation; cross-learner pedagogy transfer (a brilliant explanation that worked for
  one cohort gets governed re-use elsewhere).

## 16. Open Questions

- The precise policy boundary between in-policy DSP adjustments and evolution-proposal-grade
  rewrites — needs an ADR co-owned with F12.
- Modality selection policy: rule-based vs. learned; evaluation harness owned with F14/F12.
- How "infinite explanations" interacts with provenance: every variation traceable, but at what
  granularity?

## 17. References

- `spec/vision-application/Universal-Learning-Intelligence-Agent.md` §IX–§XII (seven layers,
  adaptive strategy, cross-disciplinary, concept layering).
- `spec/vision-application/Vision.md` §XXVI (Dynamic System Prompting), §XXVII (Educator as
  Co-Architect).
- [`../Broader-feature-product.md`](../Broader-feature-product.md) §5.3 (DSP), §11 (Multimodal &
  Immersive), §11.1 (Content Substrate).
- `spec/pedagogy/`, `spec/reasoning/`, `spec/cognitive-safety/`, `spec/protocols/cognitive-unit-abi.md`.
