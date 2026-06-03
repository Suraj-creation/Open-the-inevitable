---
name: F07-realtime-cognitive-orchestration
spec:
  id: F07
  title: Real-Time Cognitive Orchestration
  pillar: P7
  domain: product
  status: draft
  owner: product-architecture
  last_reviewed: 2026-06-03
  upstream_dependencies:
    - product/Broader-feature-product
    - product/features/F02-dynamic-cognitive-navigation
    - product/features/F05-persistent-cognitive-memory
    - product/features/F06-specialized-agent-ecosystem
    - orchestration/
    - events/event-taxonomy
    - scheduler/cognitive-scheduling
    - execution/cognitive-execution-engine
  downstream_dependencies:
    - product/features/F08-interdisciplinary-knowledge-graph
    - product/features/F09-living-universe-experience
    - product/features/F10-research-innovation-acceleration
    - product/features/F14-assessment-mastery-depth
  related_protocols: [cognition-packet-protocol, cognitive-event-protocol, reasoning-trace-protocol, cognitive-work-item, cognitive-unit-abi]
  related_events: [orchestration.tick, blackboard.updated, agent.output.proposed, disagreement.raised, scheduler.work.accepted, scheduler.work.dropped]
  related_runtime_systems: [universal-cognitive-bus, versioned-blackboard, cognitive-scheduler, deterministic-execution-engine, cognitive-unit-runtime]
  related_governance_systems: [governance-kernel, capability-envelope, human-governance]
  related_observability_systems: [cognitive-observability, otel-edge, reasoning-trace, learner-outcome-telemetry]
  semantic_tags: [orchestration, real-time, universal-cognitive-bus, blackboard, scheduler, fanout, disagreement]
  canonical_references:
    - product/Broader-feature-product#10-real-time-cognitive-orchestration-overview
    - orchestration/
    - scheduler/cognitive-scheduling
---

# F07 — Real-Time Cognitive Orchestration

## 1. Purpose

Real-Time Cognitive Orchestration is the feature that makes the platform feel alive without
becoming chaotic. It turns learning from a request/response loop into a governed event stream where
agents observe cognition, publish proposals, compete for attention, defer when late, and coordinate
through the blackboard and scheduler. The learner sees timely help; the system sees typed events,
causal order, budgets, and replayable decisions.

The product commitment is **right intelligence, right moment, no hidden races**.

## 2. Scope & Boundaries

- **In scope:** session-level orchestration loop, blackboard projections, live agent subscriptions,
  work-item scheduling, contribution arbitration, disagreement handling, late-arrival behavior, and
  real-time memory fanout.
- **Out of scope:** the definition of each agent's domain skill (F06), memory tier semantics (F05),
  and visual placement of contributions on the living canvas (F09).
- **Non-goals:** chat-style serial turns, direct callbacks between agents, or unobservable
  background interventions.

## 3. Personas & Modes

| Persona / mode | Orchestration posture |
|---|---|
| Student | Favor clarity and low cognitive load; one primary intervention per beat |
| Researcher | Allow parallel frontier, debate, and innovation proposals with stronger compression |
| Educator | Surface cohort-level orchestration state and allow human intervention |
| Institution | Aggregate orchestration quality without exposing private learner memory |
| Open Mode | Use ephemeral leases and bounded fanout; discard if the user asks for ephemerality |

## 4. Narrative Experience

While the learner studies, the orchestration layer listens. A confusion event is published. The
Curriculum Agent proposes a prerequisite repair, the Explanation Agent proposes a new analogy, the
Socratic Agent proposes a question, and the Motivation Agent proposes a shorter path. The
Supervisor accepts one primary action and one background note, rejects two as redundant, and records
why. The learner sees a clean, human-sized response; replay shows the complete decision field.

## 5. ULI / UALRCI Hooks

- ULI decomposition and explanation loops become **continuous**: confusion, mastery, and curiosity
  events can reshape the path mid-session.
- UALRCI acceleration uses the scheduler to parallelize independent prerequisites while preserving
  depth gates.
- Research transition requires orchestration to decide when a frontier seed is helpful rather than
  distracting.

## 6. Agents Involved

| Agent | Role in orchestration |
|---|---|
| Supervisor / Orchestrator | Owns arbitration, priority, disagreement, and governance pre-checks |
| Scheduler | Converts proposals into ordered, budgeted work items |
| Memory Agent | Fans out memory deltas and commits accepted memory mutations |
| Curriculum / Explanation / Practice / Assessment / Research / Innovation | Publish proposals and subscribe to relevant event streams |
| Socio-Ethical / Human Governance | Participate when proposals touch sensitive, institutional, or high-stakes domains |

## 7. Cognitive OS Primitives Used

- **Universal Cognitive Bus / Event Mesh** for every meaningful interaction.
- **Versioned Blackboard** for shared, inspectable session state and agent proposals.
- **Cognitive Work Item** for scheduled tasks with requester, priority, budget, and causality.
- **DepthScheduler** for preemption, fairness, budgets, and load-shedding.
- **Reasoning Trace** for arbitration, priority changes, and rejected contributions.
- **Execution Journal** for deterministic replays of accepted orchestration effects.

## 8. Events, Protocols & State Transitions

Emits:

- `orchestration.session.started`, `orchestration.tick`, `orchestration.session.closed`
- `blackboard.updated`, `blackboard.proposal.added`, `blackboard.proposal.resolved`
- `scheduler.work.accepted`, `scheduler.work.preempted`, `scheduler.work.dropped`
- `agent.output.proposed`, `agent.output.accepted`, `agent.output.rejected`
- `disagreement.raised`, `disagreement.resolved`, `human-governance.escalated`
- `orchestration.degraded`, `orchestration.recovered`

State transitions:

1. Session open -> blackboard initialized from identity, memory, and intent leases.
2. Event observed -> subscribed agents may publish proposals.
3. Proposal accepted -> work item scheduled and effect committed.
4. Session close -> blackboard final state consolidated or discarded per memory policy.

## 9. Memory & World-State Effects

Orchestration writes no learner memory directly. It updates the blackboard and emits events. Accepted
learning effects become Memory Mutations through F05. The world-state graph records active intent,
current concept, path position, agent presence, proposal history, and disagreement resolutions.

## 10. Governance, Safety, Privacy, Ethics

- Every side-effecting proposal is checked before execution.
- The Supervisor cannot silently override user intent; it must emit a trace.
- Institutions can add policy constraints but cannot erase Open Mode except under documented
  governed contexts.
- Sensitive domains require source grounding and Socio-Ethical participation.
- Backpressure and load-shedding must prefer learner safety and comprehension over novelty.

## 11. Observability

- Telemetry: orchestration latency, proposal volume, accepted/rejected ratio, late-arrival drops,
  preemption count, fairness by agent family, disagreement frequency, and degradation duration.
- Reasoning traces: mandatory for arbitration and load-shedding.
- OTel edge: session spans link agent spans, scheduler spans, memory fanout spans, and bus spans.
- Replay determinism: **full** for accepted event order and scheduler decisions with recorded
  inputs; **trace-level** for model-generated proposal content.

## 12. Failure Semantics

| Failure | Behavior |
|---|---|
| Bus unavailable | Degrade to local append-only session journal; replay into bus on recovery |
| Blackboard conflict | Resolve by version and causality; unresolved conflicts emit disagreement |
| Agent proposal storm | Scheduler applies per-agent budgets and load-shedding |
| Late contribution | Drop, defer, or convert to note according to accepted policy |
| Governance denial | Reject effect, surface plain-language reason if learner-visible |

## 13. Architecture Conformance Statement

- All agent coordination passes through typed events and blackboard state.
- No hidden shared mutable state is allowed.
- Scheduler decisions are observable and replayable.
- Memory effects become Memory Mutations only after accepted orchestration.
- Context and intent are lease-bound.
- Governance and reasoning traces are attached before any learner-visible side effect.

## 14. Success Metrics

- p95 orchestration decision latency < 250ms for local deterministic arbitration.
- Late-arrival drop rate < 10% during normal load, with every drop observable.
- Proposal usefulness > 80% for accepted contributions in learner feedback.
- 100% of accepted proposals have trace IDs and causality links.
- No starvation for the minimal viable agent set under normal Phase 1E workloads.

## 15. MVP -> Advanced -> Frontier Phasing

- **MVP:** session blackboard, proposal lifecycle, Supervisor arbitration, scheduler work items, and
  event emission for F01-F05-F14 product slice.
- **Advanced:** multi-agent disagreement, live memory subscription fanout, educator intervention,
  fairness dashboards, and degraded-mode recovery.
- **Frontier:** multi-region orchestration, voice/whiteboard/canvas co-presence, simulation-heavy
  sessions, and federation across institutional clusters.

## 16. Open Questions

- What contribution granularity should the scheduler budget: agent activation, proposal, or
  accepted learner-visible effect?
- Which blackboard fields belong in product-level state versus architecture-level state?
- How much orchestration state should be visible to learners and educators by default?
- What is the exact late-arrival policy for research seeds during fast-paced explanation loops?

## 17. References

- `spec/product/Broader-feature-product.md` §8.1 and §10.
- `spec/orchestration/`.
- `spec/scheduler/cognitive-scheduling.md`.
- `spec/events/event-taxonomy.md`.
- `spec/execution/cognitive-execution-engine.md`.
