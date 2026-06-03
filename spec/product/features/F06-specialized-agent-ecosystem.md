---
name: F06-specialized-agent-ecosystem
spec:
  id: F06
  title: Specialized Agent Ecosystem
  pillar: P6
  domain: product
  status: draft
  owner: product-architecture
  last_reviewed: 2026-06-03
  upstream_dependencies:
    - product/Broader-feature-product
    - product/features/F01-cognitive-onboarding
    - product/features/F02-dynamic-cognitive-navigation
    - product/features/F03-recursive-prerequisite-intelligence
    - product/features/F04-adaptive-multimodal-explanation
    - product/features/F05-persistent-cognitive-memory
    - runtime/cognitive-unit-runtime
    - protocols/cognitive-unit-abi
    - kernel/cognitive-identity
    - kernel/capability-envelope
  downstream_dependencies:
    - product/features/F07-realtime-cognitive-orchestration
    - product/features/F10-research-innovation-acceleration
    - product/features/F11-institutional-collective-intelligence
    - product/features/F12-collective-cognitive-evolution
    - product/features/F13-identity-personas-modes
  related_protocols: [cognitive-unit-abi, cognition-packet-protocol, cognitive-event-protocol, reasoning-trace-protocol, memory-mutation-protocol]
  related_events: [agent.provisioned, agent.activated, agent.suspended, agent.disagreement.raised, agent.output.proposed, agent.subscription.updated]
  related_runtime_systems: [cognitive-unit-runtime, deterministic-execution-engine, cognitive-scheduler, world-state-graph, universal-cognitive-bus]
  related_governance_systems: [governance-kernel, capability-envelope, context-lease, intent-lease, human-governance]
  related_observability_systems: [cognitive-observability, reasoning-trace, otel-edge, learner-outcome-telemetry]
  semantic_tags: [agent-ecosystem, cognitive-units, manifests, subscriptions, digital-twin, uli, ualrci]
  canonical_references:
    - product/Broader-feature-product#8-the-agent-ecosystem-overview
    - product/Broader-feature-product#12-1-the-identical-agent--personal-digital-twin
    - runtime/cognitive-unit-runtime
---

# F06 — Specialized Agent Ecosystem

## 1. Purpose

This feature defines the platform's agent ecosystem as a set of governed **Cognitive Units**, not
as a pile of prompt personas. The ecosystem includes the Supervisor, Curriculum, Explanation,
Socratic, Practice, Assessment, Revision, Memory, Research, Innovation, Reflection, Motivation,
Debate, Simulation, Communication, World-Today, Auto Note Builder, Code Helper, Socio-Ethical, and
Identical/Digital-Twin agents. Each agent is a runtime participant with identity, manifest,
capability envelope, subscriptions, leases, reasoning traces, and deterministic execution
boundaries.

The product outcome is co-presence: the learner feels surrounded by the right intelligence at the
right time, while the architecture keeps every action typed, observable, replayable, and governed.

## 2. Scope & Boundaries

- **In scope:** the canonical agent catalog, activation predicates, manifest requirements, role
  boundaries, subscription model, agent-to-agent disagreement, Identical Agent provisioning
  lifecycle, and the minimal viable agent set for Phase 1E.
- **Out of scope:** the live orchestration rules that schedule and arbitrate agents in a session
  (F07), the memory substrate agents read/write through (F05), and institutional policy overlays
  (F11).
- **Non-goals:** direct agent-to-agent function calls, hidden prompt chains, unmanifested agents,
  or agents that mutate state without events and governance decisions.

## 3. Personas & Modes

| Persona / mode | Agent posture |
|---|---|
| Student | Supervisor, Curriculum, Explanation, Practice, Assessment, Revision, Memory, Motivation, and Socio-Ethical agents form the default set |
| Researcher | Research and Innovation agents activate earlier; prerequisite agents compress known foundations |
| Educator | Educator-signature agent joins the student's delivery loop through governed inheritance |
| Institution | Cohort-analysis and policy agents observe aggregate streams, never private learner state without consent |
| Open Mode | Minimal agent set activates around a temporary intent lease and ephemeral memory policy |
| Identical Agent opt-in | A long-lived personal Cognitive Unit is provisioned with explicit consent and portability semantics |

## 4. Narrative Experience

A learner is studying a concept. They do not select agents from a menu. The Supervisor notices a
confusion event, the Curriculum Agent re-checks prerequisites, the Explanation Agent shifts
modality, the Socratic Agent asks one guided question, and the Motivation Agent quietly proposes a
shorter path when engagement drops. A research breadcrumb appears only when the Research Agent's
activation predicate is satisfied and the Supervisor approves the contribution.

The learner experiences the system as one coherent intelligence, but replay shows many bounded
agents publishing events, reading memory streams, and proposing actions under governance.

## 5. ULI / UALRCI Hooks

- Every teaching-facing agent inherits ULI's recursive-prerequisite and zero-knowledge guarantees.
- Research and Innovation agents inherit UALRCI's Stage 4.5 -> Stage 6 transition machinery.
- Motivation, Reflection, and Socio-Ethical agents guard the wider aim: intellectual evolution, not
  only concept completion.
- The Identical Agent is the long-horizon continuity surface for ULI/UALRCI across years.

## 6. Agents Involved

| Agent family | Role | Activation predicate |
|---|---|---|
| Supervisor / Orchestrator | Owns arbitration, routing, consent checks, and late-arrival decisions | Any active intent lease |
| Curriculum / Planner | Builds and reshapes learner-specific paths | Intent opened, confusion, mastery update, material ingestion |
| Explanation / Socratic / Simulation / Code Helper | Delivers concepts through suitable layers and modalities | Node entry or modality request |
| Practice / Assessment / Revision | Produces exercises, depth gates, and spaced repair | Practice request, mastery checkpoint, decay risk |
| Memory | Sole committer of memory mutations and fanout | Any proposed memory write or subscription update |
| Research / Innovation / World-Today | Connects learning to frontiers, current context, and creation | Stage threshold, concept-frontier match, curiosity fork |
| Communication / Auto Note Builder | Turns cognition into expression, notes, talks, and artifacts | User asks to explain, present, write, or preserve |
| Socio-Ethical / Debate / Reflection | Expands perspective, values, dialectic, and metacognition | Sensitive concept, disagreement, reflection trigger |
| Identical / Digital-Twin | Long-lived personal companion and continuity agent | Explicit opt-in and sufficient consent envelope |

## 7. Cognitive OS Primitives Used

- **Cognitive Unit ABI** defines every agent's lifecycle, callable surface, and effect boundary.
- **Cognitive Identity** assigns each agent a durable CID with role, provenance, and ownership.
- **Capability Envelope** limits tools, memory scopes, models, budgets, and outflows.
- **Context Lease / Intent Lease** grants temporary access to learner context and goals.
- **Cognition Packet** is the only semantic exchange format.
- **Cognitive Event** records activation, proposal, disagreement, suspension, and output.
- **Reasoning Trace** explains why an agent surfaced, stayed quiet, or disagreed.
- **Memory Mutation** is the only path by which an agent proposal becomes stored memory.

## 8. Events, Protocols & State Transitions

Emits:

- `agent.provisioned`, `agent.manifest.loaded`, `agent.identity.bound`
- `agent.activated`, `agent.deferred`, `agent.suspended`, `agent.retired`
- `agent.subscription.opened`, `agent.subscription.updated`, `agent.subscription.closed`
- `agent.output.proposed`, `agent.output.accepted`, `agent.output.rejected`
- `agent.disagreement.raised`, `agent.disagreement.resolved`
- `digital-twin.provisioned`, `digital-twin.snapshot.created`, `digital-twin.terminated`

State transitions:

1. Persona/onboarding completion -> default agent set provisioned.
2. Intent opened -> agent activation predicates evaluated.
3. Agent proposal accepted -> downstream event/memory/action emitted through the bus.
4. Consent narrowed -> agent envelope and subscriptions contract immediately.

## 9. Memory & World-State Effects

Agents do not own memory. They propose Memory Mutations. The Memory Agent commits, rejects, or
redacts. Agent manifests, subscriptions, activation history, and disagreement resolutions are
world-state graph entities so future sessions can reconstruct why a learner's experience felt the
way it did.

The Identical Agent maintains a twin-state projection derived from consented memory and events; it
does not hoard raw surveillance. Snapshot, branch, export, and termination are first-class state
transitions.

## 10. Governance, Safety, Privacy, Ethics

- All side-effecting agent proposals pass the Governance Kernel.
- Agents cannot expand their own envelopes; evolution requires F12 proposal flow.
- Sensitive domains require Socio-Ethical participation and source-grounding.
- Minors and institutions use stricter defaults and human-governance escalation.
- The Identical Agent requires explicit, granular, revocable consent, plus portability and erasure
  semantics.
- Agent disagreement is surfaced through events; hidden override is an integrity violation.

## 11. Observability

- Reasoning traces are mandatory for activation, silence, disagreement, envelope changes, and
  proposal acceptance/rejection.
- Telemetry: activation precision, late-arrival drop rate, disagreement frequency, contribution
  usefulness, envelope-denial rate, per-agent cost, and learner-outcome lift.
- Replay determinism: **full** for lifecycle, activation decisions that use recorded inputs, and
  accepted proposals; **trace-level** for model generations whose outputs are recorded but not
  regenerated during replay.

## 12. Failure Semantics

| Failure | Behavior |
|---|---|
| Agent manifest invalid | Agent cannot provision; emit `agent.provisioning.failed` |
| Agent exceeds envelope | Reject proposal, emit governance decision, and suspend if repeated |
| Agent output conflicts with another | Emit disagreement, route to Supervisor arbitration or human governance |
| Agent subscription lags | Scheduler drops/degrades according to F07 late-arrival policy |
| Identical Agent consent revoked | Snapshot audit fact, terminate active leases, redact content according to F05 |

## 13. Architecture Conformance Statement

- No agent exists without manifest, Cognitive Identity, and Capability Envelope.
- No direct agent-to-agent calls bypass the bus.
- No memory writes bypass Memory Mutation.
- Every activation and cognitive contribution emits a reasoning trace.
- All context access is lease-bound and revocable.
- Events carry causality, versioning, and producer identity.
- Replay can reconstruct which agents were present and why.

## 14. Success Metrics

- Useful agent contribution rate > 80% for surfaced contributions in MVP learning sessions.
- Agent false-surfacing rate < 5% after Supervisor filtering.
- 100% of side-effecting agent proposals have governance decisions and trace IDs.
- Disagreement resolution latency p95 < 2 seconds for in-session disputes.
- Identical Agent consent comprehension > 99% in sampled user tests before opt-in.

## 15. MVP -> Advanced -> Frontier Phasing

- **MVP:** Supervisor, Curriculum, Explanation, Practice, Assessment, Revision, and Memory agents
  implemented as manifests with activation predicates and governed event emission.
- **Advanced:** Research, Innovation, Motivation, Reflection, Debate, Simulation, Communication,
  Auto Note Builder, World-Today, Code Helper, and Socio-Ethical agents with subscription rules.
- **Frontier:** Identical Agent lifecycle, agent portability, persona-specific agent collectives,
  and governed self-evolving manifests through F12.

## 16. Open Questions

- Which agent capabilities should be encoded in static manifests versus runtime policy overlays?
- What threshold makes a contribution "useful" for activation-precision telemetry?
- Which Identical Agent portability semantics require a dedicated ADR before implementation?
- How should human educators inspect inherited teaching-signature effects without exposing private
  learner memory?

## 17. References

- `spec/product/Broader-feature-product.md` §8 and §12.1.
- `spec/runtime/cognitive-unit-runtime.md`.
- `spec/protocols/cognitive-unit-abi.md`.
- `spec/kernel/cognitive-identity.md`, `spec/kernel/capability-envelope.md`,
  `spec/kernel/context-lease.md`, and `spec/kernel/intent-lease.md`.
- `spec/execution/cognitive-execution-engine.md`.
