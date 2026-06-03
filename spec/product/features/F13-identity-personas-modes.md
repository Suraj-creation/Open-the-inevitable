---
name: F13-identity-personas-modes
spec:
  id: F13
  title: Identity, Personas & Dual Modes
  pillar: cross-cutting
  domain: product
  status: draft
  owner: product-architecture
  last_reviewed: 2026-06-03
  upstream_dependencies:
    - product/Broader-feature-product
    - product/features/F01-cognitive-onboarding
    - product/features/F05-persistent-cognitive-memory
    - kernel/cognitive-identity
    - kernel/capability-envelope
    - kernel/context-lease
    - kernel/intent-lease
  downstream_dependencies:
    - product/features/F02-dynamic-cognitive-navigation
    - product/features/F06-specialized-agent-ecosystem
    - product/features/F09-living-universe-experience
    - product/features/F11-institutional-collective-intelligence
  related_protocols: [cognition-packet-protocol, cognitive-event-protocol, memory-mutation-protocol, reasoning-trace-protocol]
  related_events: [persona.selected, mode.changed, identity.updated, consent.envelope.updated, digital-twin.provisioned]
  related_runtime_systems: [cognitive-unit-runtime, world-state-graph, cognitive-scheduler]
  related_governance_systems: [governance-kernel, capability-envelope, human-governance, consent-policy]
  related_observability_systems: [cognitive-observability, learner-outcome-telemetry, reasoning-trace]
  semantic_tags: [identity, persona, modes, open-mode, digital-twin, consent, learner-model]
  canonical_references:
    - product/Broader-feature-product#3-who-it-is-for--identity--cognition--and-goal-aware
    - product/Broader-feature-product#12-modes--personas
---

# F13 — Identity, Personas & Dual Modes

## 1. Purpose

F13 defines how the platform understands who a user is without trapping them in a category. It owns
persona classes, mode switching, Open Mode, Default versus Personalized Default behavior, and the
continuity between a human's Cognitive Identity and long-horizon personal agents.

The platform must be personal but not presumptive: identity evolves through consented evidence,
inspectable memory, and governed mode changes.

## 2. Scope & Boundaries

- **In scope:** persona model, mode taxonomy, Open Mode semantics, Default/Personalized Default,
  identity updates, learner model inspectability, multi-persona support, and identity continuity.
- **Out of scope:** initial onboarding flow (F01), Identical Agent implementation details (F06),
  institutional policy inheritance (F11), and memory tier mechanics (F05).
- **Non-goals:** rigid labeling, silent persona inference, demographic profiling, or mode changes
  that bypass consent.

## 3. Personas & Modes

| Mode | Meaning |
|---|---|
| Student Mode | Learning journey, prerequisites, explanation, practice, assessment |
| Educator Mode | Teaching signature, class/cohort intelligence, student support |
| Institution / Organization Mode | Policy, cohort maps, internal knowledge, collective intelligence |
| Researcher Mode | Frontier maps, literature, hypotheses, contribution workflows |
| Open Mode | Ask anything, from any discipline, unconstrained by current path |
| Personalized Default | The system uses consented memory and preferences |
| Default | Minimal personalization, privacy-preserving baseline |

Users can hold multiple personas. A professor can also be a learner; a student can be a researcher;
an institution actor can enter Open Mode.

## 4. Narrative Experience

The user can always ask: *"What mode am I in?"* and *"What do you believe about me?"* The system
answers plainly and lets the user edit. Mode switching is visible and reversible. Open Mode is not a
hidden escape hatch; it is a first-class right to curiosity. Personalized Default feels like memory
and continuity. Default feels useful without surveillance.

## 5. ULI / UALRCI Hooks

- Persona informs ULI's starting assumptions but never overrides observed mastery.
- Open Mode creates a temporary curiosity intent that can fold into the main path.
- Researcher Mode activates UALRCI earlier while preserving depth gates.
- Personalized Default gives ULI access to consented learner memory; Default uses minimal state.

## 6. Agents Involved

| Agent | Role |
|---|---|
| Supervisor | Applies mode, persona, and consent to every orchestration decision |
| Memory Agent | Maintains inspectable identity and preference memory |
| Curriculum / Explanation | Adjust path and delivery based on persona and mode |
| Governance Agent / Kernel | Enforces consent, minors, institutional policy, and mode boundaries |
| Identical Agent | Long-horizon personal continuity, only after explicit opt-in |
| Socio-Ethical Agent | Checks fairness, identity assumptions, and sensitive-mode transitions |

## 7. Cognitive OS Primitives Used

- **Cognitive Identity** is the canonical identity object for users, educators, institutions, and
  agents.
- **Capability Envelope** encodes mode-specific permission and privacy scope.
- **Context Lease / Intent Lease** grants temporary access to mode-relevant context and goals.
- **Memory Mutation** updates persona, preference, and identity evidence.
- **World-State Graph** projects identity, active mode, goals, and relationships.
- **Reasoning Trace** explains persona/mode inference and update proposals.

## 8. Events, Protocols & State Transitions

Emits:

- `persona.selected`, `persona.inferred`, `persona.confirmed`, `persona.corrected`
- `mode.changed`, `mode.open-mode.entered`, `mode.open-mode.exited`
- `identity.updated`, `identity.snapshot.created`
- `consent.envelope.updated`, `personalization.enabled`, `personalization.disabled`
- `digital-twin.provisioned`, `digital-twin.paused`, `digital-twin.terminated`

State transitions:

1. Onboarding -> initial persona and mode.
2. User correction -> persona update through memory mutation.
3. Open Mode invoked -> temporary intent lease.
4. Personalized Default toggled -> capability envelope changes.

## 9. Memory & World-State Effects

Persona and mode are graph state and memory-backed evidence, not hardcoded flags. Every identity
claim has provenance. The user can inspect, edit, redact, or erase identity memory. Open Mode can be
ephemeral, consolidatable, or connected to an active path depending on the user's choice and memory
policy.

## 10. Governance, Safety, Privacy, Ethics

- Silent persona recategorization is forbidden.
- Sensitive identity attributes require explicit consent and narrow usage.
- Minors use stricter defaults and guardian/institution policy where applicable.
- Personalized Default must be easy to disable.
- Institutions cannot use persona/mode data for hidden ranking, discipline, or exclusion.
- Identity data cannot flow to collective intelligence without anonymization and consent.

## 11. Observability

- Telemetry: mode switches, Open Mode foldbacks, persona corrections, personalization opt-in/out,
  identity-inspection usage, and consent updates.
- Reasoning traces: required for persona inference and mode-change recommendations.
- Replay determinism: **full** for mode transitions and identity mutations.

## 12. Failure Semantics

| Failure | Behavior |
|---|---|
| Persona inference uncertain | Ask confirmation or keep prior/default persona |
| Mode change conflicts with policy | Decline with traceable reason and possible human-governance path |
| User disables personalization | Close related leases and stop reading personalized memory |
| Identity memory conflict | Mark conflict and route to user correction or semantic-consistency flow |
| Open Mode unsafe in context | Apply documented policy limits and emit governance event |

## 13. Architecture Conformance Statement

- Identity is a kernel primitive, not UI profile state.
- Mode changes are event-sourced.
- Personalization access is envelope- and lease-bound.
- Memory writes use Memory Mutation.
- Persona/mode decisions emit reasoning traces.
- Open Mode remains first-class unless policy explicitly and observably constrains it.

## 14. Success Metrics

- Persona correction rate < 2% after onboarding and early use.
- 100% of personalization access has consent and active leases.
- Open Mode visible and usable in every mode except documented governed constraints.
- Identity inspection comprehension > 95% in user studies.
- No silent persona recategorization events.

## 15. MVP -> Advanced -> Frontier Phasing

- **MVP:** persona classes, mode state, Open Mode, Default/Personalized Default toggle, identity
  memory inspection stub, and consent-envelope updates.
- **Advanced:** multi-persona CIDs, institution-aware mode policy, learner-editable identity graph,
  and personalized explanation/style inheritance.
- **Frontier:** portable identity/twin snapshots, life-agent continuity, federated identity, and
  long-horizon cognitive growth modeling.

## 16. Open Questions

- Which identity fields are allowed as inferred versus user-confirmed?
- How should multi-persona conflicts be represented in the world-state graph?
- What is the default retention policy for Open Mode interactions?
- Which Digital Twin portability semantics require an ADR?

## 17. References

- `spec/product/Broader-feature-product.md` §3, §12, and §12.1.
- `spec/kernel/cognitive-identity.md`.
- `spec/kernel/capability-envelope.md`.
- `spec/kernel/context-lease.md` and `spec/kernel/intent-lease.md`.
