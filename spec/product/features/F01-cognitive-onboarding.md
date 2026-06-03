---
name: F01-cognitive-onboarding
spec:
  id: F01
  title: Cognitive Onboarding & Context Initialization
  pillar: P1
  domain: product
  status: draft
  owner: product-architecture
  last_reviewed: 2026-06-02
  upstream_dependencies:
    - product/Broader-feature-product
    - vision-application/The_Inevitable_Master_Vision
    - vision-application/Vision
    - kernel/cognitive-identity
    - kernel/capability-envelope
    - kernel/context-lease
    - kernel/intent-lease
  downstream_dependencies:
    - product/features/F02-dynamic-cognitive-navigation
    - product/features/F05-persistent-cognitive-memory
    - product/features/F06-specialized-agent-ecosystem
    - product/features/F13-identity-personas-modes
  related_protocols: [cognition-packet-protocol, cognitive-event-protocol, memory-mutation-protocol]
  related_events: [identity.created, intent.opened, context.lease.granted, memory.seed.committed, onboarding.completed]
  related_runtime_systems: [cognitive-unit-runtime, world-state-graph]
  related_governance_systems: [governance-kernel, capability-envelope, human-governance]
  related_observability_systems: [cognitive-observability, reasoning-trace, learner-outcome-telemetry]
  semantic_tags: [onboarding, context-initialization, learner-model, persona, identity, consent, intent-lease]
  canonical_references:
    - product/Broader-feature-product#3-who-it-is-for
    - product/Broader-feature-product#6-end-to-end-experience-walkthrough
    - vision-application/The_Inevitable_Master_Vision
---

# F01 — Cognitive Onboarding & Context Initialization

## 1. Purpose

Onboarding is **not** form-filling, account creation, or course selection. It is **cognitive context
initialization** — the moment the platform learns *who* the user is, *what* they want, and *how
much we are allowed to know about them*, just enough to begin building understanding, and never
more. Every subsequent capability — navigation, prerequisite discovery, agent activation, memory
formation — descends from the Cognitive Identity, the persona, the consent envelope, and the first
intent created here.

The single product commitment: **ask the minimum, infer the rest, evolve the model through
interaction**. Onboarding fatigue is a vision-violating failure mode.

## 2. Scope & Boundaries

- **In scope:** persona class detection (student / educator / institution / organization /
  researcher / other), the minimum-viable branch of follow-up prompts per class, creation of a
  Cognitive Identity, the seed learner model, the initial consent / capability envelope, the first
  Intent Lease, persona-default selection, and Open-Mode visibility.
- **Out of scope:** ongoing identity evolution (continuous; owned by F13), the world-state schema
  for the learner model (owned by `spec/world-state/`), the long-form Identical-Agent provisioning
  lifecycle (touched here but owned by F06).
- **Non-goals:** treating onboarding as a marketing funnel; gating product value behind a long
  intake; assuming defaults from age or grade without verification.

## 3. Personas & Modes

| Persona class | Soft branches asked | Default mode |
|---|---|---|
| Child / school student | Grade or school stage; favourite kind of thinking; one curiosity | Student-Default |
| College / undergraduate / graduate | Program, year, declared interests; goal (learn / build / research / pass) | Student-Default |
| Educator / professor / tutor | Subjects taught; institution context; teaching style hints | Educator-Default |
| Researcher / scientist | Domain, sub-area, current frontier, transferable expertise | Researcher-Default |
| Institution / organization | Type (school, college, research, hospital, company); cohorts; governance posture | Institution-Default |
| Career-changer / lifelong learner | Background; goal; available time | Individual-Default |
| Anonymous / unclassified | (skipped — Open Mode by default) | Open |

Every persona's onboarding ends with the **Open Mode** visibly accessible. No persona is locked
into a path.

## 4. Narrative Experience

The first screen is a single quiet prompt: *"Tell me who you are, so I can begin."* A small set of
identity-class cards appears. The user taps one. A second prompt opens — at most one or two soft
branches. A third (rare) prompt clarifies the current curiosity or goal. That is it. There are no
forms, no progress bars longer than three steps, no terms-and-conditions wall. Consent for memory
formation and observation is presented in plain language, with a default scope appropriate to the
persona and an obvious *"adjust later"* affordance.

At the moment the user lifts their finger from the last tap, three things have happened in the
background:

1. A **Cognitive Identity** has been created with the persona class, the soft-branch context, and
   the consent envelope.
2. A **seed learner model** has been written to memory and projected into the world-state graph.
3. A first **Intent Lease** has been opened on the user's stated goal (or, if they did not state
   one, a *"discover what I want"* intent).

The user now sees the Living Universe surface (F09): a horizontal timeline placeholder, an Open
Mode input, and a soft suggestion based on persona class.

## 5. ULI / UALRCI Hooks

- ULI is **primed** at onboarding but not yet decomposed against a goal — the decomposition
  triggers on the first concrete intent (F02).
- The persona class shapes UALRCI's default depth and acceleration posture (a researcher gets
  research-transition awareness earlier; a child gets stronger Layer-0 / Layer-1 weighting).
- The Universal Accessibility Guarantee is enforced from this point forward: regardless of
  persona, the substrate must be capable of starting at a Zero-Knowledge point.

## 6. Agents Involved

| Agent | Role | Activates |
|---|---|---|
| **Supervisor / Orchestrator** | Owns onboarding flow; provisions other agents on completion | At onboarding entry |
| **Memory Agent** | Writes the seed learner model; sets retention/decay policy for onboarding-era memories | After identity creation |
| **Curriculum / Planner Agent** | Stands by for first concrete intent | At intent open |
| **Motivation / Goal Agent** | Picks initial encouragement posture per persona | At intent open |
| **Socio-Ethical Agent** | Embeds civic/ethical/communication pillars in default path weighting | At onboarding completion |
| **Identical Agent (roadmap)** | Created in *provisioned* state if user opts in; bootstrap is deferred to first sessions | Optional, post-onboarding |

## 7. Cognitive OS Primitives Used

- **Cognitive Identity (CID)** — created here; binds persona class, soft-branch context, consent
  envelope.
- **Capability Envelope** — initial envelope per persona class; minimum-privilege defaults; tighter
  defaults for minors.
- **Context Lease** — bounded grants to onboarding agents.
- **Intent Lease** — first long-running intent opened (the goal or the *"discover"* placeholder).
- **Memory Mutation** — the only path that writes the seed learner model.
- **Cognition Packet / Cognitive Event** — every prompt/response and grant emits typed events.
- **Reasoning Trace** — every decision (which branch to ask, which default to apply) emits a
  trace.

## 8. Events, Protocols & State Transitions

Emits (canonical taxonomy is `spec/events/event-taxonomy.md`):

- `identity.created`
- `consent.envelope.set`
- `capability.envelope.granted`
- `intent.opened`
- `memory.seed.committed`
- `onboarding.completed`

State transitions in the world-state graph:

1. *Empty* → *CID-bound seed learner model present*
2. *No active intents* → *first intent lease open*
3. *No agents provisioned* → *default agent set provisioned per persona*

## 9. Memory & World-State Effects

- One **seed learner-model node** written via Memory Mutation with explicit provenance: every
  field traces to a soft-branch answer.
- The seed enters **semantic** memory; chat content of the onboarding prompts is **not** retained
  beyond the audit event store.
- Decay policy: onboarding seed is durable; soft-branch *answers* are revisable at any time without
  losing the structural CID.

## 10. Governance, Safety, Privacy, Ethics

- **Minors:** persona class = child triggers strict default consent — observation is paused
  outside explicit study sessions; collective-intelligence aggregation is off by default.
- **Institutional contexts:** the institution's governance policies override personal defaults
  (e.g., classroom observation is gated by institutional consent).
- **Plain-language consent:** every consent prompt is plain-language, with a one-tap *"adjust
  later"* affordance.
- **Right to inspect & erase:** the user can inspect and edit the seed learner model from day one;
  erasure propagates through memory and the event store per the redaction policy.
- **No persona inference without confirmation:** the system never *silently* re-categorizes a user
  across persona classes; that requires a confirmed re-onboarding.

## 11. Observability

- `learner-outcome-telemetry`: persona class distribution, onboarding completion time,
  drop-off points, soft-branch skip rate.
- `cognitive-observability`: reasoning traces for every default selection (why this consent scope,
  why this initial intent placeholder).
- Replay determinism: **full** — onboarding is deterministically reconstructible from the event
  log alone.

## 12. Failure Semantics

| Failure | Behavior |
|---|---|
| User abandons mid-flow | Onboarding state is checkpointed; resuming the URL/app returns to the same step |
| Consent denied for memory formation | Open Mode remains available; persistent personalization is disabled; the limitation is shown plainly |
| Identity ambiguous (user picks multiple personas) | The system creates a multi-persona CID; mode-switch is one tap |
| Governance violation (e.g., minor without institutional consent in institutional context) | Onboarding cannot complete; the educator/institutional admin is routed to provide consent |

## 13. Architecture Conformance Statement

This feature honors the ten non-negotiable laws as follows:

- **No bare-string exchanges** — all onboarding prompts/responses traverse the Cognition Packet
  protocol.
- **No memory write outside Memory Mutation** — the seed learner model is committed only via the
  protocol.
- **Context/Intent only via leases** — onboarding agents receive context only through bounded
  leases; the first intent is a real Intent Lease.
- **Side-effecting capabilities pass governance** — consent-envelope assignment is a governance
  action.
- **Runtime requires manifest + identity + envelope** — every onboarding agent has all three.
- **Events carry causality + versioning** — full event sourcing.
- **Cognitive decisions emit reasoning traces** — including default selections.
- **Nothing important bypasses event sourcing** — onboarding is fully reconstructible.

## 14. Success Metrics

- **Onboarding completion rate** > 95% across all personas (the bar is *time-to-first-meaningful-
  intent*, not form completion).
- **Time-to-first-meaningful-intent**: median < 60s; p95 < 3 minutes.
- **Consent quality**: > 99% of users can correctly state, at 24h, what they consented to (sampled
  qualitative).
- **Persona-classification correction rate**: < 2% (users re-categorize themselves).
- **Re-engagement at day 1**: > 60% return from first onboarding (proxy for *first session
  delivered real value*).

## 15. MVP → Advanced → Frontier Phasing

- **MVP:** persona class + one soft branch + plain consent + first intent open + Open-Mode visibility.
- **Advanced:** persona-specific branch trees; institutional consent inheritance; multi-persona
  CIDs; learner-model inspection UI.
- **Frontier:** Identical-Agent provisioning; voice-only onboarding; biometric/multimodal sign-in
  paths under federated identity; minor-protected onboarding compliant with regional regulations.

## 16. Open Questions

- Exact persona-class soft-branch trees: minimum viable per class vs. richer initial models.
- Anonymous / Open-Mode-only journeys: do they create a *transient* CID, and what is its
  retention policy?
- Onboarding flow for users transferring from external platforms (cohort import, transcript
  import, prior-knowledge transfer) — likely its own ADR.
- Multi-CID linking: same human across persona contexts (e.g., student during the week, educator
  on weekends) — privacy semantics for cross-CID inference.

## 17. References

- [`../Broader-feature-product.md`](../Broader-feature-product.md) §3 (Who It Is For), §3.1
  (Persona Journeys), §6 (Experience Walkthrough), §6.1 (Worked Example), §12 (Modes).
- `spec/kernel/cognitive-identity.md`, `spec/kernel/capability-envelope.md`,
  `spec/kernel/context-lease.md`, `spec/kernel/intent-lease.md`.
- `spec/protocols/memory-mutation-protocol.md`, `spec/events/event-taxonomy.md`.
- `spec/vision-application/The_Inevitable_Master_Vision.md` §V (Platform Entry Philosophy).
