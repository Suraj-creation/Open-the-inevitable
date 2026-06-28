# Cognitive Architecture — The Emergent Cognitive Layers

**Status:** Canonical · living architecture-direction document · forward-looking
**Companion to:** [`Tech-Stack.md`](./Tech-Stack.md) — that document maps how the COS **runs**
(infrastructure technology); this one maps how the COS **thinks, learns, evaluates, researches, and
improves** (the cognitive architecture that emerges above the substrate).
**Subordinate to:** `spec/next-generation-cognitive-operating-system-blueprint.md` and
`spec/advanced-agent-architecture.md` (the foundational architecture) and `CLAUDE.md` §2 (the laws).
**Decision of record:** [ADR-0023](../architecture-decisions/ADR-0023-emergent-cognitive-architecture.md).

---

## 0. Why this document exists

The substrate answers *how cognition runs*: events, contracts, adapters, world-state, memory,
governance, determinism, replay. That work is real and largely built. But the vision
(`spec/vision-application/`) does not describe an infrastructure — it describes an **intelligence**:
ULI (the cognitive soul), UALRCI (acceleration + research creation), the Research-Grade Knowledge
Pipeline ("GitHub for knowledge"), the Digital Twin, and AI that *formulates questions, evaluates its
own outputs, and drives original discovery*. If that vision succeeds, certain architectural layers are
**inevitable** — they are the natural consequences of the substrate doing its job.

This document names those layers **before** they are fully specified, so that:

- they have a home, a name, and a boundary the moment they are needed;
- the substrate is built in a way that *anticipates* them rather than fighting them;
- and the empty spec folders (`spec/evaluation/`, `spec/cognition/`, `spec/reasoning/`, …) are
  understood for what they are — **reserved homes for deep vision**, not evidence of absence.

This is architecture *direction*, not architecture *inventory*. Nothing here is built merely because
it is named. The burden of proof on additions (Tech-Stack §1.7) still holds: each layer crosses from
direction into implementation only on an explicit **activation trigger**, behind a contract, with
conformance/replay/governance tests, and its own ADR.

---

## 1. The one principle that makes this disciplined

> **Every cognitive layer below is a *composition over the existing substrate* — not new
> infrastructure.**

This is the load-bearing claim. None of these layers introduces a new store, broker, or vendor. Each
is assembled from primitives that already exist or are already contracted:

- **cognitive units** (the Cognitive Unit ABI, `spec/protocols/cognitive-unit-abi.md`) — the reusable
  intelligence processes;
- the **event log + world-state + memory** — the record cognition reads and writes;
- the **eight adapter contracts** — the only path to infrastructure;
- **governance, identity, capability envelopes** — the kernel that gates every action;
- **determinism + replay (D0–D3)** — the guarantee that every layer is reproducible and auditable.

So recognizing these layers does not expand the infrastructure surface. It expands the *vocabulary* we
use to compose what the infrastructure already provides. That is why this is safe to do now, and
valuable to do now.

---

## 2. The five emergent layers

Each layer states: **what it is**, **why it is inevitable** (grounded in the vision), **how it composes
over the substrate**, the **new first-class concepts** it introduces, its **activation trigger**, and
where its **deepening spec** will live.

### Layer 1 — The Cognitive Capability Layer

*The reusable cognitive functions that agents, twins, surfaces, and workflows compose from.*

- **What it is.** A **Cognitive Capability** is a single composable cognitive function — *intent
  extraction, context assembly, reflection, planning, reasoning, memory retrieval, knowledge synthesis,
  goal tracking, mastery assessment, hypothesis generation, decision support, research assistance*. It
  is not a product, not an agent, and not infrastructure. It sits *below* the agent and *above* the
  protocol: an **agent is a persona that composes capabilities**; a capability is the unit of reuse.
- **Why it is inevitable.** The vision's ULI is "the convergence of six foundational roles"
  (World-Class Teacher, Curriculum Designer, Cognitive Scientist, Educational Psychologist, Knowledge
  Graph Engineer, Personalized Mentor) — and the platform fields ~18 agents across two modes. Those
  agents are not 18 independent programs; they are recompositions of a much smaller set of cognitive
  functions. As the agent count grows, the only sustainable architecture is *capabilities composed into
  agents*, not capabilities re-implemented per agent. The "Capability Factory" is simply the observation
  that **when a cognitive function proves reusable across two or more consumers, it graduates** from
  agent-internal logic into a registered, contract-bound capability.
- **How it composes over the substrate.** A capability *is* a cognitive unit (the ABI already exists).
  The implemented units — `IntentInferenceUnit`, `CurriculumUnit`, `ModelBackedUnit`, `ContextAssembler`,
  `MasteryCheckpointRecorder` — are the first capabilities, catalogued in `MVP_AGENT_MANIFESTS`. The new
  artifact is a **Capability Catalog**: a discoverable, versioned registry of capabilities (distinct
  from the governance `CapabilityRegistry` — see §4) that agents resolve from at composition time
  instead of wiring units by hand at composition roots.
- **New first-class concepts.** Cognitive Capability · Capability Catalog · capability versioning ·
  capability-to-agent composition.
- **Activation trigger.** The same capability is needed by ≥2 agents/manifestations, *or* the number of
  hand-wired units at composition roots becomes a maintenance burden.
- **Deepening spec home.** `spec/cognition/` (the capability model) + `spec/agents/` (agent-as-composition).

### Layer 2 — The Cognitive Evaluation Layer

*The layer that measures whether cognition is actually getting better.*

- **What it is.** A unifying architecture for measuring cognitive quality: **reasoning evaluation,
  memory evaluation, planning evaluation, retrieval evaluation, intent evaluation, research evaluation,
  agent evaluation** — plus benchmark suites, regression tracking, and continuous quality measurement.
  It is the counterpart, for *cognition*, of the adapter conformance harness for *infrastructure*.
- **Why it is inevitable.** The platform's two signature promises — **verified mastery** and **governed
  self-evolution** — both *presuppose* trustworthy measurement. UALRCI already mandates Deep
  Understanding Enforcement (the five tests: Explanation, Application, Connection, Teaching, Edge Case)
  and the vision demands AI that "evaluates its own outputs not just for coherence but for genuine
  contribution" and models "what it knows, what it doesn't know." You cannot claim cognition improved,
  trust a self-evolution rollout, or certify mastery without an evaluation layer. Today this exists only
  as three disconnected fragments — `ShadowEvaluator` (evolution-only, a deterministic placeholder),
  `CognitiveAnalysisEngine` (post-hoc drift/calibration/outcome observability), and
  `MasteryCheckpointRecorder` (per-learner verdicts) — with no unifying architecture. **This is the most
  consequential near-term cognitive-architecture gap.**
- **How it composes over the substrate.** An evaluation is itself a cognitive capability (Layer 1) that
  consumes **reasoning traces** (`spec/protocols/reasoning-trace-protocol.md`), the **event log**, and
  **synthetic learners**, and emits scored verdicts as events. Because the substrate is deterministic and
  replayable (D0–D3), **evaluation runs are themselves replayable** — a benchmark is a recorded session
  re-folded, so regression testing of cognition is exact, not flaky.
- **New first-class concepts.** Eval suite · benchmark · scorecard (per capability/agent) · regression
  baseline · synthetic-learner cohort · the distinction between *observability* (what happened) and
  *evaluation* (was it good).
- **Activation trigger.** The first time a self-evolution proposal must be trusted with real (not
  placeholder) evidence, *or* the first time two cognitive strategies must be compared objectively.
- **Deepening spec home.** `spec/evaluation/` (+ `spec/benchmarking/`, `spec/synthetic-learners/`).

### Layer 3 — The Knowledge Layer

*Knowledge as a first-class subsystem with a lifecycle — not a side effect of the stores.*

- **What it is.** Explicit ownership of **knowledge graphs, knowledge provenance, knowledge evolution,
  knowledge validation, knowledge discovery, knowledge relationships, knowledge lifecycles, and
  knowledge transformation** — distinct from the learner-mastery graph and from the raw stores.
- **Why it is inevitable.** The vision states the platform "is built upon a research-grade pipeline …
  like GitHub for knowledge" — nodes, branches, history, diffs, contribution, provenance ("verified from
  the most credible and deep sources"), continuously updated. That is a *knowledge subsystem*, not an
  emergent property. Today knowledge is scattered across world-state, memory, graph, vector, context, and
  block provenance; as the platform ingests living research and the Digital Twin accumulates a learner's
  knowledge over years, knowledge needs an explicit **lifecycle**: creation → validation → integration →
  evolution → decay/retirement, with provenance and conflict-resolution as first-class.
- **How it composes over the substrate.** Knowledge is a **semantic lifecycle projection** over
  `KnowledgeGraphEngine`/`WorldStateGraph` (structure), the memory tiers (consolidation/decay already
  exist), the vector index (similarity), and surface-block **provenance** (already mandatory). It adds no
  new store — it adds *validity state* and *provenance lineage* as typed properties and a governed set of
  knowledge mutations. Knowledge *validation* draws on the reserved `epistemology` and
  `semantic-consistency` domains.
- **New first-class concepts.** Knowledge node lifecycle · provenance lineage · validity/uncertainty
  state · knowledge conflict resolution · cross-domain relationship (beyond `prerequisite_of` /
  `bridges_to`) · the Knowledge Graph as distinct from the learner graph.
- **Activation trigger.** Real external content ingestion begins, *or* knowledge conflicts/contradictions
  must be resolved, *or* the Digital Twin must carry validated knowledge across years.
- **Deepening spec home.** `spec/world-state/` (graph), `spec/memory/` (lifecycle), `spec/epistemology/`
  + `spec/semantic-consistency/` (validation) — with a `spec/knowledge/` index if it warrants one.

### Layer 4 — The Research Layer

*The layer that creates new knowledge — the engine of UALRCI Stages 5–6.*

- **What it is.** Infrastructure for **research, discovery, hypothesis formation, evidence collection,
  evidence evaluation, and knowledge creation**: an experiment registry, hypothesis tracking, an evidence
  store, a research graph, finding extraction, research provenance, and scientific workflows.
- **Why it is inevitable.** UALRCI's entire purpose is to move learners from mastery to *original
  contribution* (the Novel Contribution Engine: gap analysis, cross-domain synthesis, scale
  transformation, constraint manipulation, failure analysis). F10 (Research & Innovation Acceleration) is
  a fully-specified product feature. And the vision's next-generation AI "formulates questions,
  identifies gaps, generates hypotheses." Research is therefore both a *product surface* and the engine by
  which the platform's own knowledge (Layer 3) grows. It cannot remain implicit.
- **How it composes over the substrate.** Research is a **higher-order workflow** that *composes*
  capabilities (Layer 1: hypothesis generation, research assistance), *operates on* knowledge (Layer 3),
  is *measured by* evaluation (Layer 2: contribution quality), and is *governed* like any other cognition.
  Experiments, hypotheses, evidence, and findings are event-sourced projections — the `EvolutionEngine`'s
  `evolution.experiment.*` events are the existing proto-primitive that generalizes here. No new store.
- **New first-class concepts.** Experiment registry · hypothesis lifecycle · evidence store · research
  graph · finding extraction · research provenance · contribution scoring.
- **Activation trigger.** The F10 research mode is built, *or* the platform must track its own
  experiments (including self-improvement experiments — see Layer 5) as durable, auditable artifacts.
- **Deepening spec home.** `spec/research/` + `spec/experimentation/`, with F10 as the product-side spec.

### Layer 5 — The Autonomous Improvement Layer

*The recursive apex: the platform applying Layers 1–4 to itself.*

- **What it is.** Infrastructure by which the platform **understands, critiques, improves, and evolves
  itself** — not only its pedagogy, but its architecture and code: architecture analysis, codebase
  understanding, dependency/performance analysis, technology tracking, migration and refactoring
  proposals, security review, cost/operational optimization, and continuous architecture review.
- **Why it is inevitable.** The vision is explicit that the platform is "the laboratory for the next
  generation of intelligence," that research, technology, and education "co-evolve, continuously upgrading
  one another," and that the system builds "self-evolving products." Governed self-evolution already
  exists for *pedagogy* (the `EvolutionEngine`: `depth_adjustment`, `strategy_shift`, `curriculum_reorder`;
  advisory-only). The same governed-proposal machinery, pointed at the platform's *own structure*, is the
  natural endpoint — and `spec/meta/architecture-review-workflow.md` is already the seed of a self-audit
  process.
- **How it composes over the substrate.** This layer is the **recursive composition** of the other four:
  the platform's own code/specs/architecture become a **knowledge domain** (Layer 3); engineering and
  architecture-review functions are **capabilities** (Layer 1); proposed improvements are **research /
  hypotheses** (Layer 4); their effect is **measured** before rollout (Layer 2); and they are applied only
  through the existing **governed self-evolution** path (proposal → shadow test → governance gate →
  rollout/rollback). It introduces no new enforcement mechanism — it *reuses governance as the immune
  system*. The blueprint names **Cognitive IR** (§26.5) as the prerequisite for self-improving
  architecture; advanced-agent-architecture §11 sketches persona/workflow self-optimization.
- **New first-class concepts.** Architecture-aware / codebase-aware agents · self-improvement proposal
  (structural, not just pedagogical) · the platform-as-its-own-knowledge-domain.
- **Activation trigger.** A *trustworthy* evaluation layer (Layer 2) exists **and** Cognitive IR exists
  **and** governance is mature enough to gate structural change. This is the **last** layer to activate,
  by design — premature structural self-modification is the highest-risk capability in the entire system.
- **Deepening spec home.** `spec/evolution/` (extending DPS-010), `spec/cognitive-ir/` + `spec/compiler/`
  (the IR prerequisite), `spec/meta/` (self-audit process).

---

## 3. The emergence structure (why this is a stack, not a list)

The layers are ordered by dependency; each becomes possible only once the one(s) below it exist:

```
Substrate (Tech-Stack)         how cognition RUNS
   │
   ▼
1. Cognitive Capability        reusable cognitive functions (ULI's roles, as units)
   │
   ├──▼ 3. Knowledge           the substance capabilities operate on (the knowledge pipeline)
   └──▼ 2. Evaluation          measures whether capabilities/cognition improved
            │
            ▼ 4. Research       composes capabilities + knowledge + evaluation to CREATE new knowledge
                 │
                 ▼ 5. Autonomous Improvement   the platform applies 1–4 to ITSELF (recursive)
```

Two consequences fall out of the ordering:

- **Evaluation (Layer 2) is the gate for everything above it.** Research cannot be trusted to produce
  *good* contributions, and the platform cannot be trusted to *change itself*, without a real measurement
  layer. This is why Layer 2 is the recommended next cognitive-architecture investment.
- **Autonomous Improvement (Layer 5) is deliberately last.** It is the most powerful and most dangerous
  layer; it is gated on all the others plus Cognitive IR plus governance maturity. The architecture should
  *anticipate* it but must never *rush* it.

---

## 4. Terminology — resolving the "capability" collision

The word "capability" carries two unrelated meanings. They must never be conflated, and a glossary entry
should pin them (`spec/glossary/` is currently empty):

| Term | Meaning | Sense | Where |
|---|---|---|---|
| **Cognitive Capability** | a *function* a unit performs (`concept.explain`, `mastery.evaluate`, `intent.interpret`) | what cognition *can do* | this document; `UnitDescriptor.capabilities` |
| **Capability Envelope** | a *governance grant* — tools, memory scopes, models, cost ceilings, permitted at admission | what a unit is *permitted to do* | `spec/kernel/capability-envelope.md`; `CapabilityRegistry` |

A unit must both **have** the cognitive capability (it can perform the function) and **be granted** the
capability envelope (it is authorized to). The Capability **Catalog** of Layer 1 (a registry of cognitive
functions) is therefore a different artifact from the governance Capability **Registry** (a registry of
permissions), and the two must keep distinct names in code and specs.

---

## 5. Governance of this layer-map

- **These are layers, not mandates.** This document confers a *home and a name*, not a build order.
  Implementation of any layer follows the Tech-Stack §10 gate (contract + conformance/replay/governance
  test + offline-green + ADR) and the spec-first doctrine (`CLAUDE.md` §4): the owning spec is authored
  first, then implementation.
- **Each layer is a major decision when it activates.** Crossing a layer from direction into
  implementation requires its own ADR and a coherence check against the §25.4 invariants — exactly as a
  new adapter contract does.
- **Update triggers.** Add or revise a layer when the vision reveals a new emergent stratum, when a layer
  crosses its activation trigger, or when the dependency structure changes. Do not record *status* here
  (that lives in `IMPLEMENTATION.md`); record *direction*.
- **Relationship to Tech-Stack.** Where a cognitive layer needs infrastructure (a model for evaluation, a
  store for the knowledge graph, a vector index for retrieval), it acquires it **only through the eight
  adapter contracts** — never by introducing its own. The two documents meet at that seam.
