# 03 — Cognitive State, Memory & Context Engineering

*Part of the [Living Cognitive Agents](README.md) corpus. Deliverables E (new primitives) and I (data
model), plus the memory & context-engineering architecture. Design, not status.*

---

## 0. The State Ownership Matrix — one authority per kind of truth

Before any primitive is defined, this is the load-bearing table the whole corpus is accountable to.
It operationalizes the `CLAUDE.md` *one concept, one authority* law and is the direct antidote to the
fragmentation the [audit found](../../../docs/audits/2026-08-16-specification-and-implementation-truth-audit.md)
(learner state modelled in four disconnected places). **Every piece of cognitive state has exactly
one canonical owner, one write path, and — the column most designs omit — one defined invalidation and
one replay rule.** If a new capability needs state that does not fit a row here, that is a signal to
add a row *deliberately* (with an ADR), not to let a subsystem grow a private copy.

| State | Represents | Canonical owner | Who may **write** | Who may **project/read** | Invalidation & replay |
|---|---|---|---|---|---|
| **World State** | Facts/events about the environment, concepts, sources | world-state graph | typed World-State Delta only | all agents (sliced) | superseded by newer delta; rebuilt by folding the event log |
| **Learner Belief State** | Probabilistic model of the learner's cognition | PCI corpus (shared) | Evidence pipeline → governed posterior update | all agents (projection) | decays; re-derived from evidence; calibrated per learner |
| **Memory (tiers)** | Durable experience & evidence | memory substrate | Memory Mutation Protocol only | Context Compiler (lease-bounded) | decay + demotion (not deletion); replays from mutation log |
| **Agent Constitution** | Governed agent identity | agent runtime | human governance, E4/E5 only | Context Compiler | version-pinned; change is an audited event |
| **Agent Adaptive Policy** | Learned behavioural strategy | agent runtime | EvolutionEngine (versioned) | Context Compiler / agent | superseded by new version; replays by version id |
| **Agent Self-Model** | Estimated competence/limits | evaluation layer (projection) | recomputed from `agent.strategy-outcome` | router / supervisor | recomputed; cache invalidated on new eval; never a source of truth |
| **Agent Relationship** | Calibrated collaboration reliability | society substrate | evidence/eval fold over `agent.collaboration` | router | recomputed; gated by calibration before it routes |
| **Skill** | Reusable procedure + evidence | agent runtime | governed acquisition (proposal) | Context Compiler (retrieved) | deprecate→retire on failure trend; versioned |
| **Intention / Commitment** *(new, §1.5)* | Persistent intended future state: goals, hypotheses, open questions, plans | **World State** (projection), under Intent Leases | governed intent/commitment mutation | relevant agents | expires / superseded / abandoned-with-reason; replays from the commitment log |

Two columns carry the real discipline. **"Who may write"** is always *one* path — a typed mutation,
never a direct store poke — which is what keeps every row governable and replayable. **"Invalidation
& replay"** is the column most architectures omit and then drown in stale, contradictory state: every
row must answer *how does a fact stop being true, and how is it reconstructed?* A row without an
invalidation rule is a memory leak in the cognitive sense.

The last row is new to this corpus and is treated in [§1.5](#15-the-intention--commitment-graph--research-frontier);
it is the state the review round correctly identified as missing.

## 1. The four agent-owned primitives, defined

Per the discipline in [`02` §5](02-the-living-agent-thesis.md#5-what-is-genuinely-agent-owned-vs-projected-the-anti-noun-table-discipline),
only four things are genuinely agent-owned and persisted. Each is defined below as a *shape* (not a
final schema — schemas are R0 gate work, [README §Adoption gate](README.md#adoption-gate)). All four
are **projections/accumulations re-derivable from the event log** — never a new source of truth. This
is the property that keeps replay deterministic and keeps them inside UCI's laws.

### 1.1 Agent Constitution — `SPECIFIED`

The tightly-governed identity. One per `agentType`, with optional per-tenant overlay (a tenant may
*narrow* but never *widen* an agent's authority).

```
AgentConstitution {
  agent_type            // "explanation"
  version               // semver; change class E4/E5
  purpose               // the mission, one paragraph
  responsibilities []   // what it is accountable for
  authority {           // capability envelope, declarative
    may_dispatch []     //   which agents it may ask
    memory_scopes []    //   which tiers it may read/write
    tools []            //   which side-effecting tools
    model_tier_max      //   ceiling, not assignment
  }
  constraints []        // inviolable rules ("never advance mastery without depth verification")
  epistemic_reqs []     // ("claims require evidence"; "surface uncertainty")
  invariants []         // system laws it must uphold
  signature             // authored + signed; edits auditable
}
```

*Relationship to today:* this promotes `manifest.role` + `manifest.policies` +
`manifest.capabilities` + `manifest.memory_access` into a single **governed, signed** artifact. It is
mostly a *governance upgrade* of data that already exists — the cheapest of the four to build, and the
prerequisite for all governance of the others.

### 1.2 Agent Adaptive Policy — `RESEARCH FRONTIER`

The evolving competence. Scoped `(agent_type, learner_id?, tenant_id)` — a `learner_id` of null is the
agent's *default* policy; a specific `learner_id` is the personalized overlay.

```
AgentAdaptivePolicy {
  policy_id
  scope { agent_type, learner_id?, tenant_id }
  version               // every adaptation is a new version, never in-place mutation
  supersedes            // prior version id
  dimensions {          // typed, bounded adaptation axes — NOT free text
    strategy_ordering   //   e.g. [concrete, mechanism, abstraction] > [definition, ...]
    depth_bias          //   the generalization of today's single global scalar
    modality_weights    //   diagram vs prose vs example preference
    pacing              //   ...
    // dimensions are a CLOSED, versioned enum. New dimensions require an ADR.
  }
  evidence_refs []      // the agent.strategy-outcome artifacts that justify this
  confidence            // CALIBRATED (Layer 2), not asserted
  calibration_status    // uncalibrated | calibrated@<eval_run>
  governance { change_class, approved_by, evaluation_run }
}
```

Two rules make this safe:

1. **Dimensions are a closed, typed enum, not free text.** A Policy can only adjust axes the
   architecture has vetted (strategy ordering, depth, modality, pacing…). It *cannot* introduce a new
   behaviour the Constitution never envisioned — that would be an E5 change to the dimension set, via
   ADR. This is the mechanical answer to "runaway self-improvement" (brief §36): the policy space is
   bounded by construction.
2. **`calibration_status` gates routing.** An uncalibrated policy may be *recorded and shown in
   observability* but **must not influence a dispatch** until the Cognitive Evaluation Layer
   (ADR-0027) certifies its confidence is calibrated for this agent/learner. Recording is safe;
   routing on uncalibrated belief is the danger. (This is the Layer-2 gate, shared with the PCI
   corpus.)

*Relationship to today:* generalizes the single `LiveEvolutionConfig.depthBias` into a per-agent,
per-learner, versioned, governed, calibrated artifact — and routes its changes through the
`EvolutionEngine` that already exists.

### 1.3 Agent Skill — `RESEARCH FRONTIER` (deferred; highest value, highest risk)

A first-class, versioned, evidence-bearing procedure. Detailed in
[`04` §Skills](04-learning-reflection-evolution.md#3-skills--the-highest-value-highest-risk-primitive); its *data shape* belongs here for the data
model:

```
AgentSkill {
  skill_id, version
  scope { agent_type, domain?, learner_id? }
  purpose
  procedure             // structured, replayable steps — NOT an opaque prompt blob
  prerequisites []      // other skills / concept refs
  applicable_when []    // typed context predicates
  anti_patterns []      // where it FAILS (as important as where it works)
  evidence { successes, failures, contexts }   // accumulated, not asserted
  confidence            // calibrated
  provenance            // how it was acquired (reflection / composition / human)
  status                // candidate | active | deprecated | retired
}
```

### 1.4 Agent Relationship — `RESEARCH FRONTIER`

Detailed in [`05` §1](05-society-and-formation.md#1-relationships--evidence-based-trust--research-frontier). Data shape:

```
AgentRelationship {
  pair { agent_type_a, agent_type_b }
  tenant_id             // relationships are tenant-level, not per-learner (they are about the agents)
  interactions          // count
  resolutions           // successful joint outcomes
  contradictions        // disagreements recorded
  escalations           // to human / supervisor
  reliability           // CALIBRATED; gates routing influence
  last_updated_hlc
}
```

### 1.5 The Intention / Commitment Graph — `RESEARCH FRONTIER`

**Why this exists.** The four primitives above answer *"what has this agent learned about how to do
its job?"* (backward-looking: experience → Policy). They do **not** answer *"what is this agent
currently trying to accomplish, and what remains unresolved?"* (forward-looking: intention). For a
single education interaction the existing **Intent Lease** — a time-bound, revocable *grant* to pursue
a goal — is roughly sufficient. But UCI's actual ambition is *education → understanding → research →
discovery*, and a research-capable agent's cognition is **fundamentally about maintained intention
across time**:

```
  Yesterday:  Research Agent begins investigating hypothesis H, plans experiments E1,E2.
  Today:      New evidence contradicts a sub-claim of H.
  Tomorrow:   The agent must know — what was H? what is still open? what evidence would
              change it? which experiments were planned, which expired, which were abandoned
              and WHY? what superseded what?
```

That is not memory ("what happened") and not Policy ("what works"). It is **temporal intention
state**, and today UCI has no home for it — the Intent Lease is a *leaf grant*, not a graph of goals,
subgoals, hypotheses, open questions, plans, and their dependencies over time.

**The correction to the reviewer's proposal — this is NOT a new agent-private store.** It is a
**projection region of the World State**, mutated only through a governed intent/commitment mutation,
pursued *under* Intent Leases (the lease remains the governance grant; the graph is the *content*
being pursued). This keeps it inside the [externalized-state thesis](02-the-living-agent-thesis.md#1-the-thesis-stated-as-a-design-law)
and unifies — under *one concept, one authority* — with two things that already exist or are proposed:
the **Intent Lease** (kernel) and the PCI corpus's stubbed **`CognitiveGoal`** (`TwinSnapshot.goals`
is currently hardwired `[]`). There must be **one** Intention/Commitment graph that both *learner
goals* and *agent inquiry* project into — never a learner-goal store and a separate agent-goal store.

```
CommitmentNode (world-state node type; kind ∈ goal | subgoal | hypothesis | plan | open_question) {
  id, kind
  owner                 // learner CID or agent_type (the pursuer)
  intent_lease_ref      // the governance grant it is pursued under
  statement
  epistemic_status      // open | active | supported | contradicted | resolved | abandoned | superseded
  expected_outcome      // what would count as done / what evidence would change it
  confidence            // CALIBRATED where probabilistic
  provenance
  expires_at?           // commitments can lapse — this is how intention drift is bounded
  abandoned_reason?     // abandonment is FIRST-CLASS, not silent disappearance
}
CommitmentEdge  { from, to, type ∈ depends_on | subgoal_of | supersedes | evidence_for | contradicts }
```

Two disciplines make it safe and prevent the failure the reviewer names (intention drift / infinite
open intentions): (1) **every commitment carries the epistemic ladder** — an `open_question` is not a
`goal` is not a `resolved` fact; and (2) **commitments expire, supersede, and are abandoned *with a
recorded reason*** — a living agent that cannot *drop* a stale goal is as broken as one that forgets a
live one. This is the [open-problem #10 (goal persistence vs. intention drift)](08-roadmap-and-adrs.md#5-open-problems-deliverable-l--the-deepest-unresolved-questions).

**Status:** `RESEARCH FRONTIER`, and explicitly **outside the first production layer** — the L2 pilot
(one Explainer, one strategy dimension) does not need it. It becomes load-bearing at the *research*
horizon, and its collective form is the [Epistemic Workspace](05-society-and-formation.md#7-the-epistemic-workspace--collective-inquiry-state)
in `05`.

## 2. The memory architecture

The brief lists ~16 memory "types." Most are **not** distinct stores — they are *tiers* or
*projections* of the two memory systems UCI already has. The honest architecture:

```
                         AGENT MEMORY — three questions, three answers
  ┌────────────────────────────────────────────────────────────────────────────┐
  │ Q: what is memory OF?     →  A: whose store                                  │
  │                                                                              │
  │  ABOUT THE LEARNER      → shared Learner Belief State + TieredMemoryStore    │
  │    (knowledge, misconceptions, preferences, history)   (learner-scoped)      │
  │                                                                              │
  │  ABOUT THE AGENT'S CRAFT → Adaptive Policy + Skills + Self-Model             │
  │    (what strategies work, what it's good at)   (agent-scoped, §1)            │
  │                                                                              │
  │  ABOUT WHAT HAPPENED     → the Event Log + Intelligence Artifacts            │
  │    (episodic experience, trajectories)   (already durable, do NOT re-store)  │
  └────────────────────────────────────────────────────────────────────────────┘
```

The brief's 16 types map onto this cleanly:

| Brief's memory type | Where it actually lives | New store? |
|---|---|---|
| working memory | the compiled `DynamicAgentContext` (ephemeral) | no |
| episodic memory | event log + `learner.episode` artifacts | no |
| semantic memory | `TieredMemoryStore` semantic tier + world-state | no |
| procedural / skill memory | **Agent Skill** (§1.3) | **yes** |
| source memory | source environment (CSE) — exists | no |
| learner memory | Learner Belief State (PCI) — shared | no (PCI) |
| relationship memory | **Agent Relationship** (§1.4) | **yes** |
| strategy memory | **Agent Adaptive Policy** (§1.2) | **yes** |
| failure memory | `learner.misconception` + skill `anti_patterns` + failure event family | no |
| hypothesis memory | Reflection Records (events) + PCI hypotheses | no |
| goal memory | Intent Lease + learner goals | no |
| world-state memory | world-state graph | no |
| self-memory | **Agent Self-Model** (projection) | cached projection |
| research memory | intelligence artifacts + research units | no |
| interaction memory | event log | no |

Net: the "16 memory types" reduce to **three genuinely new stores** (Skill, Relationship, Policy) plus
projections. This is the brief's own instruction (§9: *do not create unnecessary persistence simply
because storage is available*) taken seriously.

### 2.1 Memory lifecycle — capture → promote → forget

UCI already runs the hard part. `TieredMemoryStore` runs decay as a real process; the intelligence
plane consolidates at session close. The Living-Agent additions are policy, not mechanism:

- **Provenance & confidence on everything** (brief §11: *never* `stored = truth`). Every memory item
  and every Policy dimension carries `evidence_refs` and a `confidence`; the five-level epistemic
  ladder — **observed → inferred → believed → hypothesized → asserted-by-system** (brief §38) — is a
  *required field*, not a convention. The Claim Graph's epistemic status enum (`established`,
  `supported`, `contested`, `speculative`, `superseded`) is the model; generalize it to all cognitive
  state.
- **Promotion is a governed mutation.** Episodic residue → semantic memory is the existing
  `consolidation-candidate` distiller; promotion of a *candidate* to a *believed* fact must pass
  verification (does replay of the evidence support it?) before it can influence a dispatch.
- **Forgetting is first-class and consented.** Decay exists; deletion (learner right-to-erasure) is
  live (migration 0004 cascade). Add: *stale-memory demotion* — a memory whose confidence has decayed
  below threshold is demoted out of retrievability but kept auditable, never silently deleted.

### 2.2 Contradiction handling

The Claim Graph already detects and records `contradicts` edges. Generalize: when two memory items or
Policy dimensions conflict, the resolution is **not** overwrite. It is: detect → classify (empirical /
interpretive / temporal-validity) → compare evidence + calibrated source reliability → keep the
winner, **demote (not delete) the loser**, emit a resolution event, update reliability. Minority views
survive when uncertainty is meaningful (brief §15). This is `uci-architecture.md` §10.3 semantic
conflict resolution, applied to agent state.

## 3. Context engineering — the compiler in depth

The [Context Compiler](02-the-living-agent-thesis.md#4-the-cognitive-context-compiler) is where
"construct the right cognitive context" becomes concrete. Retrieval is **multi-signal**, not top-k:

| Signal | Question it answers | Source | Status |
|---|---|---|---|
| semantic relevance | is this about the task? | vector search (`ContextAssembler`) | IMPLEMENTED |
| graph relevance | is this a prerequisite / bridge of the task concept? | world-state traversal | IMPLEMENTED |
| temporal relevance | is this recent / currently active? | HLC recency | IMPLEMENTED |
| causal relevance | did this *cause* the current situation? | causal edges | RESEARCH FRONTIER |
| learner relevance | does this matter *for this learner*? | Belief State | RESEARCH FRONTIER |
| importance | is this high-value regardless of recency? | confidence × consequence | SPECIFIED |
| uncertainty | is this something the agent is unsure about (→ retrieve to resolve)? | calibration | RESEARCH FRONTIER |

The compiler *ranks by a weighted combination, fills the budget by precedence, and reports the
residual* — it never silently truncates (a UCI law: degradation is visible). Compression, when the
budget forces it, is **provenance-preserving summarization**: the summary keeps a pointer to what it
summarized, so replay and observability can expand it.

**Key correction to the brief's "hierarchical memory / semantic retrieval / …" list:** these are not
features to build; they are *signals to combine*. The research value is not in any one retrieval mode
(they mostly exist) but in the **budgeted, precedence-ordered, provenance-tagged composition** — the
compiler is the primitive, retrieval modes are its inputs. This is the difference the external
frontier calls "context engineering" over "RAG" ([`07`](07-research-landscape.md)).

### 3.1 The compiler is an *attention mechanism*, not a prompt assembler

The review round is right to push this harder, and the [research landscape](07-research-landscape.md#3-continual--lifelong-learning--model-independent-state-angle-3)
forces it: because externalizing state **relocates** the forgetting problem to *retrieval-time
competition between old and new memories*, the compiler is not plumbing — **it is where the agent's
effective remembering, and therefore its effective thinking, is decided.** In an externalized-state
architecture, *context selection is attention, and attention is part of cognition.* A team that
implements the compiler as `systemPrompt + memoryChunks + learnerState + policy` has under-built the
single most important runtime in the system.

Beyond ranking-and-budgeting, three selection duties are therefore **first-class compiler
responsibilities**, not nice-to-haves — and two of them are actively adversarial to naive relevance
ranking:

- **Counter-evidence inclusion.** Relevance ranking is a confirmation-bias engine: the most
  "relevant" memories to a belief are the ones that *agree* with it. The compiler must deliberately
  reserve budget for evidence that *challenges* the current Policy/Belief — the corrective evidence a
  pure top-k pass would starve. This directly answers the reviewer's failure case *"context budgets
  systematically excluding corrective evidence."*
- **Stale-state suppression.** A high-confidence-but-old memory can dominate retrieval and crowd out a
  newer, truer one (the relocated stability–plasticity fight, [`07` §3](07-research-landscape.md#3-continual--lifelong-learning--model-independent-state-angle-3)).
  The compiler applies recency-and-decay-aware down-weighting so the past does not out-shout the
  present — this is *where* the demotion policy of [§2.1](#21-memory-lifecycle--capture--promote--forget)
  actually bites.
- **Contradiction surfacing.** When retrieved items conflict, the compiler surfaces the conflict
  *into context* (with both sides + provenance) rather than silently picking one — so the model reasons
  over the disagreement instead of inheriting a hidden resolution.

These make the compiler's pipeline: relevance estimation → epistemic filtering → temporal/decay
weighting → **contradiction surfacing → counter-evidence reservation → stale-state suppression** →
uncertainty prioritization → budgeted precedence fill → provenance-tagged output. Proving the
compiler selected the *right* evidence rather than merely *relevant-looking* evidence is
[open problem #9](08-roadmap-and-adrs.md#5-open-problems-deliverable-l--the-deepest-unresolved-questions);
it is the cognitive bottleneck of the whole architecture, which is why the compiler is L1 (built
before any adaptive state rides on it).

## 4. The learner-model dual — one epistemic substrate, two faces

The most important cross-cutting decision in this corpus: the **Learner Belief State** (owned by the
[PCI corpus](../persistent-cognitive-intelligence/)) and the **Agent Self-Model + Policy** are the
same *kind* of object — persistent, probabilistic, provenance-bearing state with calibrated
uncertainty — pointed at two different subjects (the learner; the agent's own craft). They **must
share one primitive family**:

```
                    ┌───────────────────────────────────────────┐
                    │  EPISTEMIC SUBSTRATE (one primitive family) │
                    │  Evidence → State → Uncertainty(calibrated) │
                    └───────────────┬─────────────┬──────────────┘
                                    │             │
                    projected as    │             │   projected as
                                    ▼             ▼
                    LEARNER BELIEF STATE     AGENT SELF-MODEL + POLICY
                    (subject: the learner)   (subject: the agent's craft)
                    owned by PCI corpus      owned by this corpus
                                    │             │
                                    └──────┬──────┘
                                           ▼
                         both feed the SAME Context Compiler
```

Consequences:
- **One calibration harness** (ADR-0027 Layer 2) serves both. Do not build two uncertainty stacks.
- **One provenance/evidence pipeline** (`CognitiveEvidence`, proposed by PCI) serves both.
- The agent's beliefs *about the learner* are **reads of the shared Belief State**, never a private
  copy — eliminating the "N contradictory learner models" failure the brief and PCI both warn about.
- An agent *contributes evidence* to the shared Belief State (its observations of the learner) but
  does not *own* the posterior; the posterior is a governed projection everyone reads. This is the
  clean separation the brief §20–21 asks for: "one underlying learner model, role-specific
  projections."

This unification is the reason this corpus and the PCI corpus should be **adopted together or not at
all** for the probabilistic layer — they share the R0 formalization and the Layer-2 gate.

→ Continue to [`04` — learning, reflection & governed evolution](04-learning-reflection-evolution.md).
