---
name: F11-institutional-collective-intelligence
spec:
  id: F11
  title: Institutional & Collective Intelligence + Educator Mode
  pillar: P11
  domain: product
  status: draft
  owner: product-architecture
  last_reviewed: 2026-06-03
  upstream_dependencies:
    - product/Broader-feature-product
    - product/features/F01-cognitive-onboarding
    - product/features/F05-persistent-cognitive-memory
    - product/features/F06-specialized-agent-ecosystem
    - product/features/F07-realtime-cognitive-orchestration
    - product/features/F13-identity-personas-modes
    - governance/
    - human-governance/
  downstream_dependencies:
    - product/features/F12-collective-cognitive-evolution
    - product/features/F14-assessment-mastery-depth
  related_protocols: [cognition-packet-protocol, cognitive-event-protocol, memory-mutation-protocol, reasoning-trace-protocol, cognitive-unit-abi]
  related_events: [institution.policy.applied, cohort.signal.aggregated, educator.signature.updated, class.session.started, human-governance.escalated]
  related_runtime_systems: [world-state-graph, cognitive-unit-runtime, universal-cognitive-bus, cognitive-scheduler]
  related_governance_systems: [governance-kernel, human-governance, capability-envelope, consent-policy]
  related_observability_systems: [cognitive-observability, learner-outcome-telemetry, otel-edge, reasoning-trace]
  semantic_tags: [institution, educator-mode, cohort-intelligence, collective-intelligence, teaching-signature, consent]
  canonical_references:
    - product/Broader-feature-product#12-modes--personas
    - vision-application/Vision#xxvii-educator-as-co-architect-of-intelligence
---

# F11 — Institutional & Collective Intelligence + Educator Mode

## 1. Purpose

F11 defines how The Inevitable operates for educators, schools, colleges, research labs, companies,
and organizations without collapsing learner sovereignty. Institutions gain cohort insight,
teaching-signature propagation, policy control, and collective learning intelligence. Learners keep
privacy, inspectability, and consent. Educators become co-architects of intelligence rather than
content operators.

The product outcome is a learning organism at classroom, institution, and organization scale.

## 2. Scope & Boundaries

- **In scope:** Educator Mode, teaching signatures, classroom/session intelligence, cohort
  analytics, institutional policy envelopes, collective memory boundaries, and human-governance
  workflows.
- **Out of scope:** global system self-evolution (F12), personal mode switching (F13), and raw
  assessment mechanics (F14).
- **Non-goals:** surveillance dashboards, administrator access to private cognition, or replacing
  educators with agents.

## 3. Personas & Modes

| Persona | Institutional capability |
|---|---|
| Educator | Shapes pedagogy, reviews traces, authors teaching signatures, monitors cohort gaps |
| Student | Receives governed educator influence with inspectable provenance |
| Parent / guardian | Optional minor-context visibility through policy and consent |
| Institution admin | Sets policy, retention, assessment, and aggregation boundaries |
| Organization | Applies learning intelligence to teams, onboarding, and internal knowledge |
| Research lab | Tracks frontier-learning and collaboration without private-data leakage |

## 4. Narrative Experience

A teacher starts a lesson. The system transcribes the class, builds living notes, highlights concept
gaps, and updates a cohort map. The teacher corrects an explanation style; that correction becomes
part of her teaching signature. Students later receive personalized explanations shaped by that
signature, but every learner can see: *"This was influenced by your teacher's preferred analogy."*

An institution sees aggregate heat maps: where cohorts struggle, which prerequisites are failing,
where teaching signatures help. It does not see private learner memories unless consent and policy
allow it.

## 5. ULI / UALRCI Hooks

- ULI runs on cohort graphs to expose systemic prerequisite gaps.
- UALRCI uses institutional scale to evaluate which acceleration strategies preserve depth.
- Educator signatures become governed DSP inputs for F04.
- Collective learning signals feed F12 evolution only after anonymization and consent gates.

## 6. Agents Involved

| Agent | Role |
|---|---|
| Educator Agent | Encodes teaching signature, feedback, and classroom intent |
| Supervisor | Applies institutional policy and coordinates educator/student agents |
| Memory Agent | Separates personal, cohort, institutional, and collective memory tiers |
| Assessment Agent | Produces cohort depth signals and exam artifacts |
| Note Builder / Transcription | Converts live class into Living Notebooks and Contemporary Books |
| Human Governance | Reviews escalations, policy conflicts, and sensitive decisions |
| Socio-Ethical Agent | Ensures collective intelligence does not become coercive or biased |

## 7. Cognitive OS Primitives Used

- **Cognitive Identity** for institutions, classes, educators, learners, and agents.
- **Capability Envelope** for role-based access and policy constraints.
- **Context / Intent Leases** for classroom sessions and institutional workflows.
- **Memory Mutation** for cohort and institutional memory writes.
- **World-State Graph** for class/cohort concept maps and teaching signatures.
- **Cognitive Event** for policy, class, and aggregation events.
- **Reasoning Trace** for educator influence, policy application, and analytics decisions.

## 8. Events, Protocols & State Transitions

Emits:

- `institution.policy.applied`, `institution.policy.updated`
- `class.session.started`, `class.session.closed`
- `educator.signature.created`, `educator.signature.updated`, `educator.signature.applied`
- `cohort.signal.aggregated`, `cohort.prerequisite-gap.detected`
- `collective-memory.write.proposed`, `collective-memory.write.approved`
- `human-governance.escalated`, `human-governance.resolved`

State transitions:

1. Institution onboarded -> policy envelope created.
2. Class session opened -> temporary leases and cohort blackboard initialized.
3. Educator feedback -> teaching signature update proposal.
4. Cohort signal -> anonymized aggregate or rejected by governance.

## 9. Memory & World-State Effects

F11 distinguishes personal learner memory, educator signature memory, class session memory, cohort
aggregates, institutional memory, and collective learning signals. Cross-boundary movement requires
explicit governance. The world-state graph stores institutional structure, class/cohort membership,
policy inheritance, teaching-signature lineage, and aggregate prerequisite maps.

## 10. Governance, Safety, Privacy, Ethics

- Least-privilege access by role; institutions do not own private cognition by default.
- Minors require stricter consent and guardian/institution policy reconciliation.
- Teaching signatures are inspectable and overrideable by learners where policy permits.
- Aggregation must be anonymized, differentially protected when feasible, and source-bounded.
- Human educators retain review authority; agents do not unilaterally discipline, rank, or label
  learners.

## 11. Observability

- Telemetry: cohort gap resolution, teaching-signature effectiveness, policy denials, aggregation
  quality, class-note usefulness, and governance escalation rate.
- Reasoning traces: required for teaching-signature application, policy enforcement, and cohort
  inference.
- Replay determinism: **full** for class session events, policy application, and aggregate lineage.

## 12. Failure Semantics

| Failure | Behavior |
|---|---|
| Policy conflict | Escalate to human governance and pause side effect |
| Aggregation privacy risk | Reject aggregate or degrade to coarser signal |
| Educator signature causes harm | Roll back signature version and notify governance |
| Classroom transcription uncertain | Mark confidence and avoid durable memory without review |
| Institutional backend unavailable | Continue personal learning mode; defer cohort aggregation |

## 13. Architecture Conformance Statement

- Institutions, educators, classes, and cohorts are Cognitive Identities.
- All institutional access is envelope- and lease-bound.
- Memory tier boundaries are explicit and governed.
- Cohort signals are event-sourced and replayable.
- Educator influence emits trace and provenance.
- Human governance is first-class for policy conflicts.

## 14. Success Metrics

- Cohort prerequisite-gap detection precision > 80%.
- 100% of educator-signature applications have provenance.
- Zero private learner memory exposure without consent and policy authority.
- Class-note usefulness > 80% in educator review.
- Governance escalation resolution latency tracked and improving.

## 15. MVP -> Advanced -> Frontier Phasing

- **MVP:** Educator identity, class session events, teaching-signature metadata, cohort gap
  aggregation, and policy envelope enforcement.
- **Advanced:** Living classroom notes, Contemporary Books, question banks, institutional dashboards,
  and human-governance workflows.
- **Frontier:** multi-institution collective intelligence, federated learning signals, research lab
  collaboration, and global pedagogy evolution through F12.

## 16. Open Questions

- Which aggregation privacy technique is required before multi-class deployment?
- How should learner override of educator signature work in regulated classroom contexts?
- What policy inheritance model best handles school -> class -> learner conflicts?
- Which institutional events need canonical schema additions first?

## 17. References

- `spec/product/Broader-feature-product.md` §12 and §17.
- `spec/vision-application/Vision.md` §XXVII and §XXV.
- `spec/governance/` and `spec/human-governance/`.
- `spec/product/features/F05-persistent-cognitive-memory.md`.
