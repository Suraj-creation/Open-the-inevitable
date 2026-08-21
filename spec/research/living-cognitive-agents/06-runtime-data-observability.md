# 06 — Runtime, Data, Observability, Evaluation & Safety

*Part of the [Living Cognitive Agents](README.md) corpus. Deliverables I (data model), K (evaluation
framework), the runtime/event/protocol architecture, and the failure-mode / safety / privacy /
security treatment. Design, not status.*

---

## 1. Runtime architecture

The Living-Agent runtime is the existing UCI runtime with **three inserted components** (the compiler,
the reflect step, the Policy store) and one component **made reachable** (the EvolutionEngine). It
does not replace the runtime.

```
                        ┌──────────────────────────────────────────┐
                        │  GATEWAY (SurfaceHost)  — session registry │
                        └────────────────────┬─────────────────────┘
                                             │ dispatch(packet)
                                             ▼
   ┌──────────────────── COGNITIVE CONTEXT COMPILER (NEW) ──────────────────────┐
   │ reads: Constitution · Policy(agent,learner) · Belief State · Memory(lease)  │
   │        · Skills · Relationships · World slice · Governance · Temporal        │
   │ emits: DynamicAgentContext (budgeted, provenance-tagged)                     │
   └────────────────────────────────┬───────────────────────────────────────────┘
                                    ▼
   ┌──────────── GOVERNANCE GATE (exists) ─── evaluated BEFORE any mutation ──────┐
   └────────────────────────────────┬───────────────────────────────────────────┘
                                    ▼
   ┌──────────── SCHEDULER (exists) ── depth/cost/priority admission ────────────┐
   └────────────────────────────────┬───────────────────────────────────────────┘
                                    ▼
   ┌──────────── MODEL ROUTER (thin, mostly implicit today) ─────────────────────┐
   └────────────────────────────────┬───────────────────────────────────────────┘
                                    ▼
   ┌──────────── AGENT EXECUTION (stateless CognitiveUnit) ──────────────────────┐
   │ execute(packet) → model + tools → Reasoning Trace + Emissions               │
   └────────────────────────────────┬───────────────────────────────────────────┘
                                    ▼
   ┌──────────── EVALUATION (Cognitive Eval Layer, exists) ──────────────────────┐
   └────────────────────────────────┬───────────────────────────────────────────┘
                                    ▼
   ┌──────────── reflect(trace) → ReflectionRecord (NEW: plug the ABI hook) ──────┐
   └────────────────────────────────┬───────────────────────────────────────────┘
                                    ▼
   ┌──────────── INTELLIGENCE PLANE / distillation (exists, durable) ────────────┐
   └────────────────────────────────┬───────────────────────────────────────────┘
                            (offline / at close)
                                    ▼
   ┌──────────── EVOLUTION ENGINE (exists; MAKE REACHABLE) ──────────────────────┐
   │ propose → shadow → eval-gate → governance → rollout(new Policy version)      │
   └────────────────────────────────┬───────────────────────────────────────────┘
                                    ▼
             AGENT POLICY STORE (NEW, durable, versioned)  →  back to compiler
```

**State placement** (the brief's §31 "where agent state lives"):

| State | Store | Durability | Exists? |
|---|---|---|---|
| Constitution | relational (`agent_constitution`) | durable, version-pinned | NEW (promotes manifest) |
| Adaptive Policy | relational (`agent_policy`, versioned) | durable | NEW |
| Self-Model | cache/materialized view over artifacts | rebuildable | NEW (projection) |
| Skill | relational (`agent_skill`, versioned) | durable | NEW (deferred) |
| Relationship | relational (`agent_relationship`) | durable | NEW |
| Experience (episodic) | event log + intelligence artifacts | durable | **EXISTS** |
| Memory (semantic/…) | `TieredMemoryStore` → durable memory_mutations | durable (migration 0004) | **EXISTS** |
| World-state | world-state graph → `learner_world_*` | durable | **EXISTS** |
| Belief State | PCI projection | durable (when adopted) | RESEARCH |

Everything new is relational-durable behind the eight-contract adapter seam — **no new store type**,
same Postgres backend the durable-learner slice already proved.

## 2. Data model (Deliverable I) — what is genuinely persisted

The brief lists ~24 `Agent*` entities. Applying the persistence test from
[`02` §5](02-the-living-agent-thesis.md#5-what-is-genuinely-agent-owned-vs-projected-the-anti-noun-table-discipline):

**Persisted as new first-class artifacts (6):**
`AgentConstitution` · `AgentPolicy` (+ `AgentPolicyVersion` via `supersedes`) · `AgentSkill` (+
version) · `AgentRelationship` · plus the two that are *events not tables*: `ReflectionRecord` and
`AgentAdaptationProposal` (which is the EvolutionEngine's existing proposal record).

**Projections / caches (not sources of truth):**
`AgentSelfModel` · `AgentCapability` (derived from Constitution) · `AgentContextSnapshot` (the compiled
context, kept only for replay/observability, TTL'd).

**Already exist — do NOT create:**
`AgentExperience`/`AgentTrajectory`/`AgentInteraction` (= event log + artifacts) ·
`AgentEvaluation` (= eval layer output) · `AgentModelAssignment` (= router decision, an event) ·
`AgentGoal` (= intent lease) · `AgentBelief`/`AgentHypothesis`/`AgentUncertainty` *about the learner*
(= Belief State) · `AgentEvolutionRun` (= EvolutionEngine run, exists) · `AgentSleepCycle` (= a
scheduled job record, an event).

Net: **~6 new persisted entities**, not 24. This is the brief's own §32 discipline ("persist what
creates future cognitive value") applied ruthlessly.

## 3. Events & protocols

New event families (extending `uci-architecture.md` §6.2), all following the existing envelope
(id, type, producer identity, causation, correlation, HLC, classification, provenance):

```
  agent.reflection.*     recorded, hypothesis.formed
  agent.policy.*         proposed, evaluated, approved, rolled_out, rolled_back, version.created
  agent.skill.*          proposed, activated, composed, deprecated, retired
  agent.relationship.*   interaction.recorded, reliability.updated, escalation.raised
  agent.selfmodel.*      recomputed, deferral.triggered
  agent.context.*        compiled  (carries the provenance of what entered context)
```

No new *protocols* are needed — Cognition Packet, Cognitive Event, Memory Mutation, Reasoning Trace,
and the Model Invocation Protocol already carry everything. The one protocol *extension*: the
Reasoning Trace should carry a `reflection_ref` so the reflect step is linkable back to the trace it
reflected on. That is an additive field, not a new contract.

## 4. Observability — the Cognitive Surface as a cognitive layer

The brief (§26, §33) wants the surface to answer *why* — why this source, why this strategy, why ask
that agent, which memory influenced this. This is **already the direction UCI is building** (the
surface exposes reasoning traces, provenance chains, agent presence). The Living-Agent additions make
the *adaptation* observable, answering the brief's hardest questions:

| Question (brief §33) | Answerable because… |
|---|---|
| Why did this agent behave differently today? | the compiled `AgentContextSnapshot` records which Policy version was active + what changed |
| Which memory influenced this decision? | the compiler tags every context element with provenance |
| Why was this memory retrieved? | the retrieval signals (semantic/graph/temporal/…) are recorded per item |
| Why did it choose this model? | the router decision is an event with its requirement→model mapping |
| Why did it ask another agent? | the relationship record + self-model deferral trigger are events |
| Why did it change strategy? | the ReflectionRecord → proposal → rollout chain is fully event-sourced |
| What evidence caused the change? | `evidence_refs` on the Policy version point to the artifacts |
| **Did the adaptation actually improve outcomes?** | the longitudinal metric (§5) compared pre/post rollout |

The last row is the one that matters most and is hardest: it requires the evaluation framework below.
**Observability is not a dashboard; it is the substrate's ability to reconstruct the causal chain of
any decision** — which UCI's event-sourcing already makes possible in principle, and which the
provenance-tagging discipline makes possible in practice.

### 4.1 Predictive observability — Cognitive Health Monitoring

Reconstructive observability answers *"why did this happen?"* The review round correctly notes it is
insufficient for a long-horizon, many-agent system: you also need *leading indicators* —
*"what is likely to fail next?"* This reconnects the **Cognitive Health Monitor** the merged
architecture already names (`uci-architecture.md` §13.3) to the agent layer. The discipline: **every
failure mode in [§6](#6-failure-modes-deliverable--brief-36-each-with-detection--prevention--rollback)
should have a leading indicator, not only a detector** — a metric that trends *before* the failure
lands, so governance can intervene while an adaptation is still cheap to reverse.

| Health metric | Trends before… (failure it foreshadows) |
|---|---|
| **policy volatility / adaptation churn** | runaway self-improvement; the Policy is thrashing, not converging |
| **calibration drift** (confidence rising while accuracy flat/falling) | over-confidence → mis-routing on uncalibrated belief |
| **retrieval-diversity collapse / context-composition entropy ↓** | confirmation lock-in — the compiler is starving counter-evidence ([`03` §3.1](03-cognitive-state-and-memory.md#31-the-compiler-is-an-attention-mechanism-not-a-prompt-assembler)) |
| **stale-state influence** (old memories dominating retrievals) | the relocated stability–plasticity failure; the past out-shouting the present |
| **deferral-rate creep** | a self-model degrading, or a capability quietly rotting |
| **agent-dependency concentration** | a single point of failure / collusion forming in the society |
| **intervention-effectiveness decay** | a Policy that worked on familiar concepts failing to transfer (distribution shift) |
| **rollback frequency** | the adoption gate is admitting bad adaptations — the gate itself needs tightening |
| **disagreement entropy** (too low) | collusion / correlated error; the society has stopped genuinely disagreeing |

These are cheap to compute from the event log and the intelligence artifacts (they are folds, not new
instrumentation), and they are what make governing *hundreds* of agents tractable: you watch the
derivatives, not every dispatch. Crucially, several of them (retrieval-diversity, stale-state,
disagreement entropy) are the *only* way to catch the failures that produce plausible-looking output —
where per-dispatch quality metrics stay green while the system quietly rots.

## 5. Evaluation (Deliverable K) — proving intelligence accumulates, not regenerates

This is the deepest and most-neglected requirement (brief §34–35). Answer-quality is necessary but
catastrophically insufficient: a system can score well on every task and *never improve*. The
evaluation framework must measure **the derivative, not just the value.**

### 5.1 Multi-dimensional per-dispatch metrics (necessary floor)
task success · grounding/evidence-coverage · reasoning quality · **calibration** (predicted confidence
vs. actual outcome — the single most important quality metric, and the Layer-2 gate) · memory quality ·
context quality · cost · latency · safety · privacy · robustness.

### 5.2 Longitudinal metrics (the actual test — does it get better?)
These are the metrics no answer-quality benchmark captures, and they are the reason this whole program
is worth doing:

| Longitudinal metric | What it proves | How measured |
|---|---|---|
| **Experience accumulation** | prior experience improves future performance | same task-type, held-out, pre/post experience — improvement attributable to Policy, not model |
| **Strategy learning** | it discovers better strategies | Policy dimension changes correlate with outcome gains on shadow + real |
| **Adaptation quality** | behaviour improves *for this learner* | per-learner outcome trend after personalized Policy vs. default (A/B) |
| **Calibration improvement** | its confidence gets more trustworthy | calibration error over time, per agent |
| **Transfer** | learned skill/strategy generalizes | performance on *related, unseen* concepts after acquisition |
| **Long-horizon consistency** | it stays coherent across a long relationship | no identity/goal drift; Constitution invariants hold across N sessions |
| **Collaboration improvement** | the society gets better | joint-outcome reliability trend per relationship |
| **Model-transfer survival** | capability survives a model upgrade | pre/post model-swap performance with same substrate state |
| **Recovery** | bad adaptations are caught and reversed | rollback precision/recall on injected bad Policies |

### 5.3 The benchmark harness — synthetic learners + replay
The eval must not wait for months of real learners. UCI's **synthetic learners** (world models of
prior knowledge, misconceptions, forgetting curves) + **replay against historical sessions** give a
*controlled longitudinal testbed*: run an agent with and without an accumulated Policy over the same
synthetic learner trajectory; the Policy either measurably improves the outcome or it does not deploy.
This is the shadow-test the EvolutionEngine already runs — the eval framework *is* that mechanism,
formalized and multi-dimensional. External memory benchmarks (LoCoMo-style long-conversation memory
tests; see [`07`](07-research-landscape.md)) inform the memory-quality dimension.

**The one-line evaluation thesis:** *an agent is "living" iff, holding the model fixed, its
performance on held-out tasks improves as its accumulated substrate state grows — and that improvement
survives a model swap.* If it does not, the Policy/Skill machinery is regenerating cost, not
accumulating intelligence, and must roll back. This is the falsifiable claim the entire corpus stands
or falls on.

### 5.4 The flagship benchmark — the Longitudinal Cognitive Task

The metrics above need a *scenario* that exercises them together. The field has none for this
(§5's convergence with LongMemEval, [`07` §5](07-research-landscape.md#5-cognitive-architectures-metacognition--longitudinal-evaluation-angle-5)),
and τ-bench shows even strong tool-agents have poor *repeated-trial reliability* on realistic tasks —
so single-shot success is doubly insufficient. UCI should define its own flagship:

```
  Day 1   goal + environment + partial information → the process works, then DISCONNECTS
  Day 4   RESUME — context was reset; the environment moved on
  Day 10  new evidence CONTRADICTS an earlier belief
  Day 21  a new sub-problem emerges that depends on Day-1 work
  Pass requires: memory fidelity · reasoning · adaptation · reflection · world-model accuracy ·
                 process continuity · recovery-after-interruption · contradiction handling.
```

The single question it answers is the one that actually matters for UCI, and that no answer-quality
benchmark captures:

> **Can the agent continue a complicated project weeks later — surviving disconnect, a changed world,
> a contradicted belief, and a new sub-problem — without reconstructing everything from scratch?**

Built on synthetic learners/environments + replay (§5.3) so it runs in a controlled testbed, not only
in the wild. This is the concrete instrument for the longitudinal metrics of §5.2, and it is itself a
research contribution (there is no established equivalent).

## 6. Failure modes (Deliverable — brief §36), each with detection / prevention / rollback

Every failure mode below is either *structurally prevented* by the architecture or *detected and
reversed* by the governed loop. The ones marked ★ are prevented by design (the strongest guarantee).

| Failure mode | Detection | Prevention / Mitigation | Rollback |
|---|---|---|---|
| ★ Identity drift | Constitution invariant checks | online path *cannot* write Layer A ([`04` §6](04-learning-reflection-evolution.md#6-why-the-agent-changes-itself-is-never-allowed--and-how-identity-is-protected)) | E4 governance revert |
| ★ Goal drift | intent-lease scope checks | goals are leased, not agent-owned | lease revoke |
| ★ Runaway self-improvement | proposal-rate monitor | adaptation is a bounded, closed-enum proposal through a separate engine | disable proposals |
| ★ Agent self-modification | — | agent object is stateless; nothing to modify | n/a |
| Memory poisoning / false memory | provenance + verification on promotion; contradiction detection | nothing reaches `asserted`/`believed` without evidence + calibration | quarantine + demote |
| Hallucinated learning | epistemic-level typing; a reflection is never auto-applied | proposal must pass shadow + eval gate | discard proposal |
| Over-personalization | held-out generalization test; default-vs-personalized A/B | Constitution constraints (e.g. no acceleration-by-omission) dominate Policy | revert to default policy |
| Stale memory | confidence decay + TTL on offline products | decay runs; stale offline proposals invalidated | demote out of retrieval |
| Contradictory beliefs | Claim-Graph contradiction detection | semantic conflict resolution keeps winner, demotes loser | resolution event |
| Reward hacking / metric gaming | multi-dimensional eval (can't game all axes) + human spot-checks | no single scalar reward; longitudinal + calibration | roll back the gamed Policy |
| Prompt injection / context contamination | untrusted-content classification; provenance on every context item | least-privilege leases; instructions separated from data | quarantine source |
| Agent collusion | reliability grounded in *learner outcome*, not inter-agent agreement | trust cannot inflate without real outcome gain | reset relationship |
| Model regression | model-transfer eval on every swap | recorded outputs (D3) + shadow before cutover | pin previous model |
| Privacy leakage / unauthorized inference | consent-scope checks; sensitive-inference restrictions | data minimization; inference boundaries (§7) | redact + revoke |
| Excessive context accumulation | budget monitor; the compiler is budgeted | compiler drops by precedence and reports it | — (bounded by design) |
| Runaway compute | budget ceilings on offline + formation | metered; consent-gated | kill job |
| Agent dependency loops | spawn-depth + call-graph cycle detection | hard caps ([`05` §3.2](05-society-and-formation.md#32-dynamic-agent-formation--long-horizon-vision-with-a-hard-warning)) | break cycle |
| **★ Cross-agent epistemic contamination** | provenance-lineage tracking; a quarantine flag propagates along the same edges the belief did | see §6.1 — the shadow side of the shared substrate, and the one failure the shared-state thesis makes *worse*, so it gets the strongest treatment | lineage-scoped rollback: revert every mutation descended from the poisoned source |

**The pattern:** the most dangerous failures (drift, self-modification, runaway improvement) are
prevented *structurally* by the externalized-state + separated-powers architecture, not merely
monitored. The rest are caught by the same governed loop that deploys adaptations — you cannot deploy
an adaptation without also, by the same machinery, being able to detect and reverse it. Detection and
rollback are not add-ons; they are the deploy path run backwards.

### 6.1 Cross-agent epistemic contamination — the shadow side of the shared substrate

Intellectual honesty requires naming the one failure mode the corpus's own central thesis makes
*worse*. Externalizing state to a shared substrate buys model-independence, replay, and consistency
([`02` §1](02-the-living-agent-thesis.md#1-the-thesis-stated-as-a-design-law)) — but it also means a
**single wrong inference by one agent can propagate to every other**, along exactly the pathways that
make the substrate powerful:

```
  Agent A makes a wrong inference about the learner
        ↓ writes evidence to
  Learner Belief State  ──→  every agent's compiled context
        ↓ folds into                    ↓ shapes
  Memory / world-state   ──→  other agents' outputs
        ↓ distils into                  ↓ update
  intelligence artifacts ──→  Adaptive Policies  ──→  Relationship reliability
```

A private-per-agent design would contain such an error to one agent; the shared substrate spreads it.
This is the price of the thesis, and it must be paid explicitly, with three mechanisms:

1. **Provenance lineage is mandatory and traversable.** Every belief, memory, artifact, and Policy
   dimension already carries `provenance`/`evidence_refs`. The requirement here is that lineage is a
   *traversable graph*: given a source that turns out to be poisoned, the system can enumerate
   *everything downstream that descended from it*. (This is the same Merkle-DAG provenance the
   external Portable-Agent-Memory work proposes, [`07` §3](07-research-landscape.md#3-continual--lifelong-learning--model-independent-state-angle-3).)
2. **Quarantine propagates along the contamination edges.** When a source/inference is quarantined,
   the quarantine flag flows to every descendant, which is *demoted out of retrievability* (not
   deleted) pending re-verification — the belief stops *routing* instantly even before the slow
   cleanup runs.
3. **Rollback is lineage-scoped, not global.** Because the loop is event-sourced and provenance is a
   graph, recovery reverts *exactly the mutations descended from the poisoned source* and replays the
   rest — surgical, not a full reset. This is only possible because nothing is a hidden in-agent
   mutation; every propagation step is a typed, traceable substrate event.

The calibration gate is the *prevention* half: an uncalibrated inference can be *recorded* (so it is
traceable) but cannot *route* or *promote to a Policy*, which stops most contamination before it
spreads. Detection is the [health metrics](#41-predictive-observability--cognitive-health-monitoring)
(a belief's sudden fan-out, a contradiction spike). This failure is marked ★ because the *containment*
is structural — but it is the ★ that required the most deliberate design, and it is
[open problem #11](08-roadmap-and-adrs.md#5-open-problems-deliverable-l--the-deepest-unresolved-questions):
contamination-propagation semantics at scale are genuinely unsolved.

## 7. Safety, privacy, security, human boundary (brief §22, §37–38)

Because UCI may become deeply integrated with a person's life, these are architecture, not policy
appendices. The governing rule, from the brief and adopted verbatim: **deeper useful understanding
with human agency preserved** — deeper personalization is *not* automatically better.

- **The epistemic ladder is a privacy primitive, not just an accuracy one.** The required distinction
  *told / observed / inferred / hypothesized / system-believes* ([`04` §1.2](04-learning-reflection-evolution.md#12-distinguishing-observation-from-belief--a-required-type-not-a-convention))
  means the system can always show a person *what it knows vs. what it merely guessed*, and can be
  forbidden from acting on low-provenance inference about sensitive matters.
- **Consent is granular, scoped, revocable — and gates offline cognition.** Nothing runs offline about
  a person, and no sensitive inference is drawn, without explicit consent; minors and institutional
  contexts default to minimum. (This reuses the live consent-envelope + revoke→redaction cascade,
  ADR-0054, already proven.)
- **Right to inspect / correct / delete cognitive state is first-class.** A learner can see their
  Belief State and every memory mutation that produced it, correct it, and erase it — the cascade
  delete is already live (migration 0004). This extends to agent-held state *about* them.
- **Sensitive-inference restrictions and emotional-inference boundaries** are governance policies
  evaluated at the compile boundary: some inferences are simply not permitted to enter an agent's
  context, regardless of confidence.
- **Data minimization at the perception boundary.** For the multimodal future (brief §22, §28), the
  architecture is *not* "collect everything." It is: raw experience → perception → event extraction →
  **importance/relevance filter → memory policy → durable model**. The research question is *what
  deserves to become durable knowledge about a person's cognitive world* — and the default answer is
  "far less than could be captured." Local-vs-cloud processing and inference boundaries are decided
  per modality, per consent scope. This is `LONG-HORIZON VISION` and must not be built ahead of the
  consent and inference-transparency machinery that makes it safe.
- **Security:** zero-trust between agents (each authenticates, declares capabilities, receives leases,
  emits auditable events — a UCI law); Policy/Skill artifacts are signed and their provenance is
  verifiable; a compromised agent is quarantined, not trusted because it is "one of ours."
- **User override and agent shutdown are absolute.** A learner can pause observation, override any
  adaptation, reset an agent to its default policy, or shut it down entirely. Autonomy is preserved by
  making the human the top of the governance hierarchy, always.

→ Continue to [`08` — roadmap, ADRs & open problems](08-roadmap-and-adrs.md). ([`07` — research
landscape](07-research-landscape.md) is populated from the external sweep.)
