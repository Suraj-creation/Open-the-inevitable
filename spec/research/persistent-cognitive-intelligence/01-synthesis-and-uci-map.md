# 01 — Repository Synthesis · UCI Intellectual Model · Existing-Architecture Mapping

> Part of the **Persistent Cognitive Intelligence** research program. See [`README`](README.md).
> Status: research proposal (not adopted law).

---

## Section 01 — Repository / Specification Synthesis

The Inevitable is not an education app with an architecture bolted on; it is a **Cognitive Operating
System (COS)** whose product surfaces are *manifestations* of a substrate. This is stated as law, not
aspiration: "The COS is a substrate, not a product. Every surface, app, agent runtime, API, and
integration is a manifestation of it; dependencies point inward" (`CLAUDE.md` §2). The investigation
confirmed the codebase is unusually faithful to this: 25+ packages, 63 ADRs, an event-sourced core,
deterministic replay (D0–D3), a governance kernel, and two proven manifestations (web + MCP) driving
the same substrate with zero core changes (P7.1, ADR-0022).

Five bodies of thought matter for this program.

**1. The pedagogical thesis is a graph-reconstruction thesis.** The vision's core claim is that the
deepest failure of learning is "invisible prerequisite blindness" (`The_Inevitable_Master_Vision.md`),
and its axiom is "No concept exists independently. Every concept depends on smaller concepts"
(`Universal-Learning-Intelligence-Agent.md`). Learning is modeled as recursive decomposition of a
target concept down to **Zero-Knowledge Starting Points**, then ascent through **Seven Layers of
Understanding** (0 Intuition → 6 Research). Mastery is gated by a **five-test depth protocol**
(Explanation, Application, Connection, Teaching, Edge-Case; F14). This is already, implicitly, a
theory of *cognitive state*: a learner is somewhere in a per-learner concept DAG, at some layer, with
some verified depth.

**2. The learner is already conceived as a persistent, tiered, event-sourced object.** F05
(Persistent Cognitive Memory) specifies hierarchical memory tiers (working → episodic → semantic →
procedural → reflective → collective), semantic compression (~50×), real-time fan-out to agents via
`memory.*` events, and — critically — that *no agent writes directly*; all writes flow through the
**Memory Mutation Protocol**. The vision's own vocabulary already contains "cognitive state,"
"confidence scores," "confusion event," "mastery checkpoint," "transfer detection," and "reflective
meta-awareness." **The conceptual object this research program targets is not absent from the vision —
it is named but under-formalized.**

**3. The architecture treats time, causation, and world-state as first-class.** Everything is a pure
fold of an append-only event log; world-state is a materialized, HLC-ordered graph; replay is
byte-exact; and a learner's understanding is explicitly framed as a *trajectory* reconstructable at
any past time (`materialize_state(session_id, at_time)`, `../../architecture/uci-architecture.md` §7). This is
the single most important enabling fact for the program: **UCI already has the temporal substrate that
a persistent, provenance-preserving cognitive-state model requires.** Most learner-modeling research
has to invent persistence; here it is load-bearing infrastructure.

**4. The architecture explicitly anticipates — and defers — belief and uncertainty.** The blueprint
names a "research-grade missing layer" (§26.14) whose to-define list is almost exactly this program's
subject: "Belief objects, Claim lifecycle, Evidence lifecycle, Confidence algebra, Trust propagation,
Source reliability, Contradiction handling, Uncertainty representation, Citation lineage, Knowledge
decay, Research frontier status." The five-layer emergent architecture (ADR-0023) makes the
**Cognitive Evaluation Layer (Layer 2)** the *gate* for the Research (Layer 4) and Autonomous
Improvement (Layer 5) layers — "you cannot claim cognition improved without this layer." **The program
proposed here is the concrete, tractable first instantiation of that deferred layer, and its adoption
is correctly gated on Layer 2.**

**5. Governance, provenance, and scrutability are kernel primitives, not features.** Ten non-negotiable
invariants (§25.4) enforce: no memory write without a typed mutation; no context access without a
lease; no high-risk output without evidence; no hidden state outside event sourcing; no production
unit without an observability contract. The consent/revocation/redaction cascade (ADR-0054) is real
and evented. This matters because the program's differentiating claim over the literature is precisely
*persistence and action **without losing provenance, interpretability, or control***, and UCI already
enforces those properties at the substrate.

**Honest caveat on the vision corpus.** The vision documents are visionary and occasionally
aspirational-to-the-point-of-unfalsifiable ("post-binary computation," "AI consciousness as a goal").
This program deliberately anchors to the *architecturally realized* subset — event sourcing, the
Claim Graph, the intelligence distillers, the depth gate, memory mutations — not the rhetoric.

---

## Section 02 — The UCI Intellectual Model

A map of UCI as a coherent body of thought, and where a persistent-cognitive-state faculty naturally
belongs. This is **not** forced into the architecture; it is located where the architecture already
leans toward it.

```
UNIVERSAL COGNITIVE INFRASTRUCTURE
│
├── Philosophy .............. reconstruct understanding from foundations; ignorance→mastery→contribution
│                            (Vision corpus; six pillars; five-test depth)
│
├── Substrate (dependency points inward; §2 law)
│    ├── Event log ......... append-only chronicle; pure-fold state; D0–D3 replay
│    ├── World-State Graph . materialized, HLC-ordered nodes/edges; the single source of truth
│    ├── Memory tiers ...... typed MemoryMutation (confidence, evidence[], reversible)
│    ├── Kernel ............ identity, capability envelope, intent/context leases, governance
│    └── Eight adapter contracts (Transport/Workflow/Graph/Vector/Relational/Model/Tool/Observability)
│
├── Cognition (agents as runtime containers, not prompts)
│    ├── Cognitive Units (ABI) ... schedulable; manifest + identity + capability envelope
│    ├── Orchestration ........... blackboard, ensemble, arbitration, supervisor routing
│    └── Governed self-evolution . proposal → shadow test → gate → rollout/rollback
│
├── Knowledge / Belief (partially realized; the program's home)
│    ├── Knowledge Graph engine ... concept DAG, prerequisites, learner-state queries
│    ├── Claim Graph .............. claims w/ EPISTEMIC STATUS + cross-source contradiction ⟵ a belief layer already!
│    ├── Temporal Knowledge ....... concept timelines, epistemic states over time
│    └── Cognitive Intelligence ... 7 distillers fold the chronicle into durable artifacts
│
├── Cognitive Surface (the primary manifestation)
│    ├── MCCR + Cognitive Frames .. minimal complete representation; narration/highlight sync
│    ├── Representation Intelligence  epistemic roles + hierarchy + expertise-reversal
│    ├── Cognitive Theater ........ Director FSM (authored pedagogy), Scene, Cinematography
│    └── Interaction grammar ...... ~25 first-class learner actions (7 classes)
│
├── Human interaction ........ sensing (depth gates, affect, attention, expertise); intervention (Director)
├── Learning ................. the fibered learning loop; mastery checkpoints; prerequisite descent
├── Research ................. research-readiness gating; frontier overlays; ResearchUnit (Layer 4 seed)
├── Creation ................. contribution loop; knowledge commons
├── Personalization .......... per-learner cognition profile; Digital Twin; shared cognition
├── World modeling ........... world-state graph; source fusion; frontier research
├── Evaluation ............... Cognitive Evaluation Layer (UALRCI scorecard) — THE GATE
└── Long-horizon evolution ... governed self-evolution; collective cognitive evolution
```

**Where the learner-state research belongs.** Not as a new top-level subsystem. It belongs at the
**Knowledge / Belief** tier as the *unifying projection* the tier currently lacks, sensed through
**Human interaction**, measured by **Evaluation**, and — this is the elevation — recognized as the
*same construct* as the **Claim Graph** (belief over domain truth) and the future **research
hypothesis state** (belief over hypotheses). UCI has, without naming it, begun building a **belief
substrate** in two disconnected places: the Claim Graph gives *domain* claims an epistemic status
(`established | supported | contested | speculative | superseded`); the mastery/intelligence planes
give *learner* competence a confidence. The program's core structural insight is that **these are one
primitive seen from two angles**, and the missing third angle is the research hypothesis.

---

## Section 03 — Existing-Architecture Mapping (ground truth)

This is the "do not duplicate" audit, from actual code and specs. For each research concept: **what
already exists**, **how good it actually is** (not how it is described), and **the gap**. The honest
verdict throughout: UCI has strong *provenance* and strong *structure* but only *point-estimate*
belief, *fragmented* representation, and *passive* (never active) maintenance.

| Research concept | Existing UCI subsystem (files) | Reality check | Gap |
|---|---|---|---|
| **Cognitive Evidence** | `MemoryMutation.evidence[]` + `source_trace_id` + `provenance_refs` (`packages/memory`, `packages/intelligence/src/artifact.ts`); distiller inputs | Provenance is genuinely strong and replay-re-derivable — the best property in the codebase. But "evidence" is scattered across field names, never a first-class record with an *interpretation* step between observation and belief. | No typed `Observation → Evidence → Interpretation` chain; evidence is a string array, not a structured, weighted, channel-tagged record. |
| **Learner / Cognitive State** | 4 parallel representations: world-state `mastery_checkpoint` nodes; `LearnerCognitionSeed`/`TwinSnapshot.masteryMap{level,confidence}` (`apps/api/src/learners.ts`, `apps/cli/src/wiring.ts`); `intelligence.*` artifacts; tiered `MemoryMutation`s | **Fragmented and un-reconciled.** "What this learner knows" is independently derived in ≥4 places that can drift. Each is a point estimate (`{level, confidence}` scalar or boolean pass). | No single probabilistic state object the others *project from*; no calibrated uncertainty; no cross-plane reconciliation. |
| **Mental Model** | MRL `misconception-hypothesis {wrong_model, diagnostic_probe, repair_route}` (`packages/product-cognition/src/meaning-representation-unit.ts`); `misconceptionTracker` distiller | The ONE place a wrong belief is structurally modeled — but it is a hypothesis about the **source text**, not a tracked state of the **learner**; the distiller version is a mere counter (`{occurrences, corrected}`, conf 0.8 constant). | No learner-bound, time-tracked mental-model hypothesis with posterior mass; misconception ≠ first-class learner state. |
| **Cognitive Trajectory** | `learner.episode` + `learner.understanding-delta` artifacts; `materialize_state(at_time)` temporal replay; resume cards (ADR-0037) | The *ingredients* exist (deltas, episodes, exact time-travel). But the trajectory is never a **queryable object**; it is reconstructed ad hoc for a resume card. | No first-class trajectory type; no trajectory-level analytics (velocity, regression, transfer). |
| **Active Diagnosis** | `KnowledgeGraphEngine.nextConcept()` (topological) | **Genuinely missing.** `nextConcept` chooses by prerequisite DAG order, *not* to reduce uncertainty. Nothing anywhere selects a question/probe by expected information gain. The learner is the diagnostician; the system routes. | The single largest capability gap. No information-gain action selection. |
| **Intervention Policy** | Director FSM (`packages/surface/src/theater.ts` `decideDirective`, 8 priority-ordered branches); `pedagogy.intervention-outcome` distiller (conf 0.6, code comment: "honestly weak") | Intervention selection is an **authored heuristic FSM**, pedagogically sound but not a learned or information-theoretic policy. Outcome attribution is temporal-correlation only. | No policy learning; no causal attribution of intervention → state change; outcome signal too weak to train on. |
| **Uncertainty** | bare scalar `confidence` on every artifact/mutation/checkpoint; `CognitiveAnalysisEngine` calibration (`packages/observability`, ADR-0017) | Confidence is everywhere but is a **point value with no uncertainty on it**; in the distillers it is a **hardcoded per-distiller constant** (0.6–0.9) independent of evidence. Calibration is measured but **aggregate, not per-learner**, and feeds nothing back. | No distribution/variance; no per-learner calibration; confidence is asserted, not earned. |
| **Belief update over time** | `MemoryMutation` projection math: `reinforce_concept → c+(1−c)·conf`; `decay_confidence → c·factor` (`packages/memory/src/tiered-store.ts`) | A **fixed, non-Bayesian reinforcement rule**. Monotone toward 1 on reinforcement, geometric decay otherwise. No evidence-weighted posterior update; no forgetting model fit to the learner. | No principled (Bayesian/state-space) belief revision; update rule ignores evidence strength and prior uncertainty. |
| **Memory** | 10 typed tiers; Memory Mutation Protocol; decay/consolidation as mutations | Strong, unified, governed, reversible. **This is the model to emulate** — it is what a good `CognitiveState` substrate should look like. | It is a *third* store of learner state, not the projection source; needs to be *the* belief substrate, not a sibling. |
| **Knowledge / Claim Graph** | `Claim` with `ClaimEpistemicStatus`; contradiction detection by nature (`empirical/interpretive/value`); grounding law (`packages/product-cognition/src/claim-reasoning-unit.ts`, ADR-0040/0041) | **A belief layer already exists for domain truth** — with epistemic status and provenance-grounding. It is the strongest existing evidence that "belief-with-provenance" is native to UCI. | It is siloed from learner state; the two belief layers share no primitive. Unifying them is the program's structural thesis. |
| **World State** | materialized graph; delta protocol; snapshots; acyclicity (`packages/world-state`) | The single source of truth; everything projects from it. Correct place for a belief projection to live. | No probabilistic node/edge properties; mastery edges carry scalars, not distributions. |
| **Cognitive Surface** | MCCR, Frames, Representation Intelligence (epistemic roles/hierarchy), Theater, interaction grammar | The richest *projection* of cognition into a medium — and the natural place to *render* a belief state (uncertainty made visible, scrutable, correctable — an Open Learner Model done right). | Sensing is shallow/heuristic (4 channels); the surface *reacts*, it does not *diagnose*. |

**The three findings that survive the audit:**

1. **Provenance is a solved strength.** Do not rebuild it. Build the belief layer *on* the chronicle-fold pattern so every belief is replay-re-derivable and every assertion traces to its evidence.
2. **Belief is point-estimate, fragmented, and passive.** These are the three real gaps: (a) no calibrated uncertainty; (b) no single state object; (c) no active, information-seeking maintenance.
3. **A belief primitive already exists — twice, disconnected** (Claim Graph for domain truth; mastery/intelligence for learner competence). The contribution is unification plus the missing active-inference and calibration machinery, not invention from zero.

These findings drive the critique and refinement in [`02`](02-problem-critique-and-refinement.md).
