---
name: F02-dynamic-cognitive-navigation
spec:
  id: F02
  title: Dynamic Cognitive Navigation & Learning Timeline
  pillar: P2
  domain: product
  status: draft
  owner: product-architecture
  last_reviewed: 2026-06-02
  upstream_dependencies:
    - product/Broader-feature-product
    - product/features/F01-cognitive-onboarding
    - product/features/F03-recursive-prerequisite-intelligence
    - product/features/F08-interdisciplinary-knowledge-graph
    - product/features/F15-content-ingestion-knowledge-substrate
    - curriculum/
    - pedagogy/
    - world-state/
  downstream_dependencies:
    - product/features/F04-adaptive-multimodal-explanation
    - product/features/F06-specialized-agent-ecosystem
    - product/features/F09-living-universe-experience
    - product/features/F14-assessment-mastery-depth
  related_protocols: [cognition-packet-protocol, cognitive-event-protocol, reasoning-trace-protocol]
  related_events: [intent.opened, navigation.timeline.rendered, path.node.entered, path.fork.proposed, open-mode.invoked, world-state.delta]
  related_runtime_systems: [world-state-graph, cognitive-scheduler, cognitive-unit-runtime]
  related_governance_systems: [governance-kernel, human-governance]
  related_observability_systems: [cognitive-observability, reasoning-trace, learner-outcome-telemetry]
  semantic_tags: [navigation, learning-timeline, intent, open-mode, knowledge-graph, exploration]
  canonical_references:
    - product/Broader-feature-product#6-end-to-end-experience-walkthrough
    - product/Broader-feature-product#7-the-twelve-capability-pillars
    - vision-application/Universal-Learning-Intelligence-Agent
---

# F02 — Dynamic Cognitive Navigation & Learning Timeline

## 1. Purpose

The surface through which a learner *navigates* their own evolving knowledge — a horizontal,
basic-to-advanced **learning timeline** that resolves the learner's stated or implied intent into
a navigable path, surfaces prerequisites and downstream branches, exposes interdisciplinary
bridges, and never traps the learner inside a single rail. Wherever the learner is, **Open Mode**
is one tap away.

This is the feature that operationalizes the vision's promise of *"a robust timeline from basic to
advanced, covering all prerequisites and anything which can relate in terms of multi-based media."*

## 2. Scope & Boundaries

- **In scope:** intent capture (typed prompt, uploaded material, topic selection, curiosity seed),
  timeline rendering, node entry/exit, branch points, interdisciplinary bridges, Open Mode, and
  the navigation event stream.
- **Out of scope:** the actual *construction* of the prerequisite graph (owned by F03); the
  *delivery* of each concept (owned by F04); the *long-term* memory model (F05); the *immersive
  surface* (F09).
- **Non-goals:** turning the timeline into a Gantt chart or a course catalog; locking the learner
  into a linear rail; gamifying progression in a way that distorts depth.

## 3. Personas & Modes

| Persona | Surface emphasis |
|---|---|
| Child / school student | Strongly visual horizontal timeline; tap-to-expand nodes; one bridge surfaced at a time |
| Older student / undergraduate | Dense timeline with subject-aligned and Open paths side-by-side |
| Researcher | Compressed prerequisite view; expanded frontier and adjacent-discipline bridges |
| Educator | Two surfaces side-by-side: their cohort's aggregate timeline + per-student navigation views |
| Institution | Cohort heat-maps over the same timeline substrate |

All personas have **Open Mode** as a peer surface — never a hidden menu.

## 4. Narrative Experience

The learner types a topic, uploads a PDF, or simply asks a question. Within a beat, a horizontal
timeline appears on the left → right axis: the leftmost nodes are Zero-Knowledge starting points
(or *"you already know this"* if the learner model says so), the rightmost is the target the
learner aimed at, and the middle is the ascent. Nodes are tappable; tapping enters the concept
(handing off to F04). Branches show downward as *"to understand this, you'll want…"* and upward as
*"this opens onto…"*. Diagonal bridges show cross-domain links lit only when relevant.

At all times an **Open Mode** input floats at the bottom: *"Ask anything, from any discipline."*
Open-Mode interactions either fold back into the active timeline (if related), spawn a side
timeline (if a parallel curiosity), or stay ephemeral (if the learner explicitly says so).

The timeline is *live*. As the learner masters or stumbles on concepts, it re-shapes — new
prerequisites surface, mastered nodes collapse, bridges light up. It is the visual representation
of the world-state learner model.

## 5. ULI / UALRCI Hooks

- **Intent → goal resolution** invokes ULI Step 1 (Understand) and Step 2 (Identify); F03 then
  takes over for Steps 3–5.
- **Open Mode** routes through ULI without the goal-resolution scaffolding — a single curiosity
  becomes a tiny ad-hoc decomposition.
- **UALRCI** activates the *prerequisite-parallelization* strategy when rendering the timeline so
  independent foundations are visible as parallel rails, not as a single serial chain.

## 6. Agents Involved

| Agent | Role | Activates |
|---|---|---|
| **Curriculum / Planner** | Generates the timeline structure from the learner-specific graph | On every intent open or material upload |
| **Supervisor / Orchestrator** | Routes node entry to the right agent (Explanation, Practice, Socratic, Simulation) | On node entry |
| **Memory Agent** | Reads the learner model to determine collapsed nodes; writes navigation events | Continuous |
| **World-Today Agent** | Surfaces frontier breadcrumbs on relevant nodes | On node hover / extended dwell |
| **Open-Mode Agent** | Handles ad-hoc curiosities; folds back or branches as appropriate | On Open-Mode input |

## 7. Cognitive OS Primitives Used

- **Intent Lease** — every concrete navigation goal becomes (or is bound to) an intent lease.
- **World-State Graph** — the timeline is a projection of the learner-specific knowledge graph.
- **Cognition Packet** — node entries, expansions, and Open-Mode prompts are typed packets.
- **Cognitive Event** — every navigation action emits an event in the `navigation.*` and
  `path.*` taxonomies.
- **Cognitive Scheduler** — prioritizes which agents render contributions on which nodes.
- **Reasoning Trace** — emitted for path-fork proposals and Open-Mode foldback decisions.

## 8. Events, Protocols & State Transitions

Emits:

- `intent.opened`, `intent.refined`, `intent.closed`
- `navigation.timeline.rendered`, `navigation.timeline.reshaped`
- `path.node.entered`, `path.node.exited`, `path.node.mastered`
- `path.fork.proposed`, `path.fork.accepted`, `path.fork.declined`
- `open-mode.invoked`, `open-mode.folded-back`, `open-mode.spawned-side-path`
- `world-state.delta` (cascading projection updates)

## 9. Memory & World-State Effects

- Navigation events update the learner model's *current position* and *recent trajectory* in the
  world-state graph.
- Mastered/collapsed nodes update confidence scores per concept (read by F03, F05, F14).
- Open-Mode side paths create *ephemeral* branches that consolidate (or evaporate) per memory
  policy.

## 10. Governance, Safety, Privacy, Ethics

- **Navigation suggestions are governed** — any path-fork proposal must trace its rationale; the
  learner can demand "why this?" and receive a plain-language answer derived from the reasoning
  trace.
- **No dark-pattern progression** — gamified streaks, drip-feeds, or artificial unlocks are
  considered governance violations; depth is the only currency.
- **Open Mode is a right, not a feature** — institutions may not disable Open Mode for individual
  learners except under explicit, documented academic-policy contexts (e.g., timed exams).
- **Cross-domain bridges** that surface sensitive subject-matter (medical, legal, financial,
  ethical) require the Socio-Ethical Agent to be in the loop.

## 11. Observability

- `navigation.timeline.rendered` carries the graph structure id + diff-from-previous so replay
  can reconstruct the exact view.
- `path.fork.proposed` carries the reasoning trace id of the proposing agent.
- Telemetry: time-on-node, abandonment-on-node, fork-acceptance rate, Open-Mode invocation rate
  per session, foldback-vs-side-spawn ratios.
- Replay determinism: **full** for the deterministic surface; **explained-non-determinism** for
  agent-suggested contributions (the suggestions are recorded; their *generation* may be
  non-deterministic and is replayable only at the trace level).

## 12. Failure Semantics

| Failure | Behavior |
|---|---|
| Curriculum Agent cannot resolve intent | Fall back to a clarifying prompt; emit `intent.resolution.failed` with the reasoning trace; never silently dead-end |
| World-state graph stale / inconsistent | Render timeline from last consistent snapshot; emit `navigation.degraded` |
| Open-Mode prompt out of policy | Decline with plain-language reason; offer adjacent allowed paths |
| Agent contribution arrives after node exit | Drop or defer per the scheduler's late-arrival policy |

## 13. Architecture Conformance Statement

- No bare-string exchanges; every prompt traverses Cognition Packets.
- Navigation never writes memory directly — only the Memory Mutation Protocol does, and only via
  the Memory Agent.
- Intent and context flow only through leases.
- Path-fork proposals that change governed scope require capability checks.
- Every navigation decision (fork proposal, foldback, side-spawn) emits a reasoning trace.
- Full event sourcing — the navigation surface is reconstructible from events alone.

## 14. Success Metrics

- **Prerequisite-resolution rate**: > 90% of intents resolve to a coherent learner-specific
  timeline within one round of clarification.
- **Open-Mode share of sessions**: target 20–40% of sessions touch Open Mode (signal that curiosity
  is breathing).
- **Foldback quality**: > 70% of Open-Mode invocations that *should* fold back into the active
  timeline are correctly folded (rated against held-out human judgement on a sample).
- **Timeline reshaping latency**: median < 250ms; p95 < 1.5s.
- **Navigation abandonment**: declining over time (a function of timeline quality + agent
  contributions).

## 15. MVP → Advanced → Frontier Phasing

- **MVP:** typed-intent → linear timeline with prerequisite branch-down; Open Mode as a free
  prompt; node-entry hand-off to F04.
- **Advanced:** live reshaping based on mastery signals; cross-domain bridges; parallel
  prerequisite rails; foldback intelligence; cohort-overlay surfaces for educators/institutions.
- **Frontier:** spatial / canvas / 3D navigation; voice-driven navigation; collaborative
  navigation (multiple learners on a shared timeline); federated navigation across institutions.

## 16. Open Questions

- How aggressive should the timeline be about **surfacing** alternate paths vs. **respecting** the
  learner's current focus? Likely needs a per-learner setting and an evaluation harness.
- The Open-Mode foldback/side-spawn policy is heuristic for MVP; should it become a learned policy
  with replay-based evaluation? See F12 (Collective Cognitive Evolution).
- Persistent navigation across devices and offline → online merging — owned with F05 but surfaces
  here.

## 17. References

- [`../Broader-feature-product.md`](../Broader-feature-product.md) §6, §6.1, §7, §11.1, §12.
- `spec/curriculum/`, `spec/pedagogy/`, `spec/world-state/`, `spec/orchestration/`.
- `spec/vision-application/Universal-Learning-Intelligence-Agent.md` §III–§VIII (the six-step
  pipeline and the progression model).
- `spec/vision-application/The_Inevitable_Vision_Comprehensive.md` §II-A (Unified Educational
  Journey, Wall-Less Education).
