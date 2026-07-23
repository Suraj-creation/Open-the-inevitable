---
name: cse-source-agent-society
spec:
  id: CSE-007
  title: The Source Agent Society — Activation, Enrichment Decisions, and the Interruption Law
  domain: source-environment
  status: draft
  owner: product-architecture
  last_reviewed: 2026-07-09
  upstream_dependencies:
    - source-environment/CSE-002-canonical-source-representation
    - source-environment/CSE-003-meaning-representation-layer
    - source-environment/CSE-005-episodic-cognition
    - product/features/F06-specialized-agent-ecosystem
    - product/features/F07-realtime-cognitive-orchestration
    - architecture-decisions/ADR-0018-proposal-blackboard-arbitration
    - architecture-decisions/ADR-0025-cognitive-ensemble-orchestration
    - kernel/cognitive-scheduler
  downstream_dependencies:
    - source-environment/CSE-008-source-surface-projection
    - source-environment/CSE-009-experience-catalog
  related_protocols: [cognition-packet-protocol, cognitive-event-protocol, reasoning-trace-protocol]
  related_events: [surface.proposal.proposed, surface.synthesis.recorded, surface.agent.reasoning.summary, surface.agent.disagreed, surface.presence.updated, source.enrichment.decided]
  related_runtime_systems: [cognitive-unit-runtime, cognitive-scheduler, universal-cognitive-bus, proposal-blackboard]
  related_governance_systems: [governance-kernel, capability-envelope, human-governance]
  related_observability_systems: [cognitive-observability, reasoning-trace, otel-edge]
  semantic_tags: [source-environment, agents, ensemble, enrichment, interruption, mixed-initiative, cognitive-apprenticeship]
  canonical_references:
    - product/features/F06-specialized-agent-ecosystem
    - architecture-decisions/ADR-0025-cognitive-ensemble-orchestration
    - source-environment/CSE-001-foundations#5
---

# CSE-007 — The Source Agent Society

## 1. Purpose

Every ingested source activates a coordinated ecosystem of specialized cognitive agents — and over
time, agents surround the *learner*, not only the document. This spec defines per-source agent
activation, the **Enrichment Decision** loop through which the society speaks with one voice, the
interruption law that keeps that voice quiet by default, and the pedagogy policies (desirable
difficulty, cognitive apprenticeship) the society enforces. The agent roster itself is owned by
F06; coordination mechanics by F07/ADR-0018/ADR-0025. This spec binds them to sources.

## 2. Philosophy

- **One coherent teacher, not dozens of outputs.** The learner experiences a governed cognitive
  ensemble doing specific things well — never a feed of disconnected AI messages. Coherence is
  produced by arbitration, not by a monolithic prompt.
- **Cognitive apprenticeship, operationalized.** Expert thinking is made visible through modeling,
  coaching, scaffolding, articulation, reflection, and exploration — distributed across
  specialized agents whose negotiation is itself observable (the Agent Theater, CSE-009 §7).
- **Enrichment is a decision, not a reflex.** The surface never merely summarizes; it continuously
  decides — observably — whether this moment needs visual intuition, a simulation, an analogy, a
  prerequisite, a misconception probe, a counterexample, historical context, modern research, an
  experiment, reflection, retrieval practice, or **silence**. Not every frame needs every element;
  silence is a first-class outcome.

## 3. Activation Model

When a Canonical Source Environment reaches usability (CSE-002 §4), an **activation predicate**
evaluates per registered agent role: modality match (Video agents for video), layer availability
(Math Reasoning requires layer 5), learner development stage (Research agents at `Research`+,
per ADR-0026), and learner governance toggles (an agent the learner disabled never activates).
Activation binds the agent to `{ source_version, learner_cid }` with context leases scoped to the
relevant layers — never blanket source access. Presence is visible (`surface.presence.updated`).

Roster mapping — the founding draft's roster is realized by F06's ecosystem; this domain adds only
source-scoped roles:

| Draft role family | Realization |
|---|---|
| Teaching / Socratic / Worked Example / Historical | F06 teaching agents, bound to source context |
| Research / Cross-Disciplinary / Innovation | F10 research agents + F08 bridges, feeding frontier overlays (CSE-006) |
| Math / Code / Experiment / Critical Thinking / Debate | F06 reasoning agents over layer-5 artifacts and the Claim Graph |
| Misconception / Assessment / Learning-State Detection | F14 + MRL misconception-hypotheses (CSE-003) |
| Memory / Revision | F05 + episodic cognition (CSE-005); spaced retrieval scheduling |
| Reflection / Curiosity | Reflection journal + Curiosity engine (CSE-009), under §6 budget |
| Visualization / Project / Career | Transformation executors (CSE-004) + creation panel |
| Observatory / Ethics / Planning / Communication / Health | Existing observability, governance, orchestration, and wellbeing norms |
| **New — source-scoped units** | Canonicalization units per layer (CSE-002); **ViewportPlanner** and **HighlightPlanner** extensions to the frame planner/composer seam (CSE-008 §4–5) |

## 4. The Enrichment Decision Loop

The society's single mouth. Extends the proven decide→record→render pattern of
`surface.image.decided` (ADR-0030) to all enrichment kinds:

1. **Propose.** Activated agents publish enrichment proposals to the blackboard
   (`surface.proposal.proposed`): each `{ enrichment kind, target anchor/concept, rationale,
   confidence, cost estimate }`.
2. **Arbitrate.** The arbiter weighs proposals against: learner development stage and world model
   (CSE-005), MRL selection fit (CSE-003 §5), cognitive-load posture (one focal enrichment at a
   time — CDL "one focal accent"), interruption budget (§6), and cost. Disagreement is recorded
   (`surface.agent.disagreed`), surfaced when material, never silently flattened.
3. **Decide.** Emits `source.enrichment.decided { decision_id, chosen[], rejected[{proposal,
   reason}], anchor_refs, rationale }` — including the explicit *"decided: nothing"* case.
4. **Render.** Chosen enrichments execute (transformations, probes, overlays) and surface through
   normal frame composition (ADR-0030). `surface.synthesis.recorded` ties output to proposals.
5. **Learn.** Intervention outcomes land in the episode (`interventions[].outcome`, CSE-005),
   closing the loop for this learner immediately — and for the population only via CSE-006 §7.

Every step is evented and replayable; "why this analogy?" resolves to a decision trace in two
clicks (Observatory), per Constitution #4.

## 5. Pedagogy Policies

- **Desirable-Difficulty Governor.** A society-wide policy unit that deliberately withholds or
  delays aid inside the learner's zone of proximal development: worked-example fading
  (worked → partially-worked → self-solved, CSE-009 §4), hint laddering before answers, retrieval
  before re-reading. Overrides are always learner-available ("just tell me" is one click —
  Constitution #3), and every withholding is disclosed on inspection, never covert.
- **Generation-first defaults.** Where the learner can plausibly produce (a prediction, a sketch,
  an explanation), the society asks before revealing (self-explanation console, explain-back).
- **Misconception-first moves.** When an MRL misconception-hypothesis matches learner evidence,
  probing/repair outranks new content in arbitration.

## 6. The Interruption Law (Mixed-Initiative Budget)

Unsolicited system initiative is a scarce, governed resource (Constitution #9):

1. **One shared budget** governs all unsolicited pushes — curiosity prompts, companion
   suggestions, mode-switch proposals: max one per learner-configurable window; default
   conservative.
2. **Expected-utility gate.** An interruption fires only when estimated benefit (relevance ×
   readiness × timeliness) exceeds the estimated attention cost — the arbiter computes and
   records this justification in the decision trace.
3. **Absolute suppression states:** active assessment, worked-example step, detected confusion or
   overload. Timing rules take precedence over any frequency target.
4. **Nothing is discarded.** Suppressed or dismissed suggestions log to the Curiosity Trail /
   Journal (CSE-009), so learner pull always remains possible.
5. **Every adaptation is disclosed** — a visible "adjusted because…" affordance, never a silent
   pace/modality change (learning-state detection per F06 is an input, not an excuse).

Under the Cognitive Theater (ADR-0033), this same budget governs unsolicited *motion* — camera
shots (CSE-013) and actor entrances (CSE-012) — not only unsolicited content. The budget is the
runtime instrument of the Director's attention economy (CSE-011 §3.3): the Director sets the
attention budget; the arbiter spends it on content and motion alike; when it is depleted, the
surface falls still (`hold` shots, no new actors, no pushes).

## 6a. Deep Cognitive Transparency

Every pedagogical decision — not only agent execution — is inspectable (your architectural
direction #8; ADR-0033 L4). This is *cognitive transparency*, not system logging: the learner (or
educator) can ask of anything on the surface —

*why this paragraph · why this image · why this analogy · why this simulation · why this pace ·
why this shot · why now · why not the alternative · which agents proposed it · which disagreed ·
what evidence supported it · how confident was the system.*

Enforcement:

1. **Every decision record carries a transparency envelope:** `{ chosen, considered[{alternative,
   rejected_because}], contributing_agent_cids[], dissenting_agent_cids[], evidence_refs[],
   confidence }`. This applies uniformly to enrichment decisions (§4), Director directives
   (CSE-011), shot selections (CSE-013), and interaction routing (CSE-014) — one shape everywhere.
2. **Ambient, not a mode.** The "why?" affordance is reachable from any element in place (CSE-008
   §7); it opens the envelope as an anchored popover with a "full trace in Observatory" link — it
   never navigates the learner away from their thought.
3. **Rejected alternatives are retained,** not discarded — transparency includes what the system
   chose *not* to do and why (Constitution #4).
4. Low-confidence and disagreement are surfaced automatically (amber flag / Agent Theater
   conflict), never only on request.

Transparency is a first-class output of cognition, not a debugging feature — it is how the system
keeps human agency and trust (Constitution #3/#4).

## 7. Failure Semantics & Observability

| Failure | Behavior |
|---|---|
| An agent dies / times out mid-ensemble | Arbitration proceeds with remaining proposals; absence is evented; no blocking on stragglers |
| Conflicting proposals with no clear winner | Conflict surfaced explicitly (Agent Theater state `conflict-flagged`); default = least-interruptive option |
| All proposals rejected | "Decided: nothing" is recorded; surface stays calm |
| Learner disables an agent mid-session | Capability toggle takes effect immediately; in-flight proposals dropped and evented |

Telemetry: proposal volume/diversity per source, arbitration latency, enrichment acceptance and
outcome rates, interruption budget utilization vs. dismissal rate, silence rate (healthy systems
say nothing often).

## 8. Open Questions

- Enrichment-kind taxonomy governance: closed enum vs. registry with governance review (leaning
  registry, mirroring CSE-004 transformation extensions).
- Expected-utility model for §6.2: hand-tuned heuristic first vs. learned model under evolution
  governance — start heuristic, evolve via ADR-0021 proposals only.
- Whether ViewportPlanner/HighlightPlanner are separate units or capabilities folded into the
  existing FramePlanner/SurfaceComposer units — implementation-phase decision (CSE-008 §4 note).
