# 07 — Research Landscape

*Part of the [Living Cognitive Agents](README.md) corpus. Deliverable B: the external frontier that
informs the architecture. Not a literature review — for each direction: **problem · mechanism · what
UCI adopts/rejects · limitation · maturity (production / research / speculative)**.*

> **Provenance.** Sourced from a five-angle deep-research run (`wf_05c83541-7a4`): parallel search →
> WebFetch of primary sources → structured extraction of falsifiable claims, with deliberate
> skeptic/critic pairing per angle. The run's *final adversarial-verification pass did not complete*
> (the session interrupted it mid-verify), so the strongest numeric claims are marked
> **[search-grounded]** (a search agent fetched and quoted the primary source, but the 3-vote
> refutation pass did not run) vs **[vendor-reported]** (the number is the system author's own
> benchmark claim — treat as directional). Citations are to the primary artifact. **Nothing here is a
> status claim about UCI.**

---

## 1. Agent memory & context engineering (Angle 1)

| Source | Mechanism | Maturity |
|---|---|---|
| **Zep / Graphiti** (arXiv 2501.13956) | Bi-temporal knowledge-graph memory: four-timestamp edges, **fact invalidation not deletion**, hybrid semantic+graph+temporal retrieval | Production runtime; 94.7% LoCoMo **[vendor-reported, small benchmark]** |
| **Letta memory blocks** | DB-persisted, typed, **tool-mutated** context units compiled into the window at inference (self-editing memory) | Production runtime |
| **Anthropic, "Effective Context Engineering"** (Sept 2025) | The context-engineering-vs-prompt framing + primitives: context editing, memory tools, structured note-taking, programmatic tool calling | Production practice |
| **"Memory in the Age of AI Agents"** survey (arXiv 2512.13564) | Field map: converged episodic/semantic/procedural taxonomy; flags **consolidation as the least-implemented frontier** | Survey |
| **"Procedural Memory Is Not All You Need"** (arXiv 2505.03434) | Critical corrective against **skill-library-only** designs | Position paper |
| **"Rethinking Memory Mechanisms"** survey (arXiv 2602.06052) | 2026 systematization of memory types + benchmark landscape | Survey |

**What UCI adopts:** (a) **bi-temporal, invalidation-not-deletion memory** — direct external support
for UCI's [Gap 7 causal/temporal world-model program (R2)](01-current-architecture-and-gap.md#gap-7--the-world-model-is-temporal-but-not-causal)
and for [`03` §2.2](03-cognitive-state-and-memory.md#22-contradiction-handling) (demote, don't
delete). (b) The **context-engineering framing** validates the [Context Compiler](02-the-living-agent-thesis.md#4-the-cognitive-context-compiler);
UCI adds precedence + provenance + Constitution-dominance the general framing lacks.
**What UCI rejects:** Letta-style **self-editing memory via tool calls** — no governance, no
calibration gate, no replay guarantee; UCI's memory is typed mutations through the substrate. This
rejection is *reinforced by the research itself* (see §3, "memories become faulty when continuously
updated").
**Load-bearing corrective:** *"Procedural Memory Is Not All You Need"* is direct external support for
UCI's decision **not** to make skills the center and to **defer** them behind the Policy loop
([`04` §3](04-learning-reflection-evolution.md#3-skills--the-highest-value-highest-risk-primitive)).
The most product-relevant *unsolved* problem the field agrees on — **episodic→semantic consolidation**
— is exactly where UCI's intelligence-plane distillers already operate, making it a contribution
opportunity, not a gap to import.
**Benchmark caveat the run surfaced:** the headline Zep/LoCoMo number is vendor-reported on a small
set; the field has already moved to **LongMemEval, LoCoMo-Plus, MemoryArena, BEAM** — so UCI's
memory-quality metric should target the newer suites, not LoCoMo alone.

## 2. Self-improving & skill-learning agents (Angle 2)

| Source | Finding | Maturity |
|---|---|---|
| **Self-Evolving Agents survey** (arXiv 2507.21046, Princeton/CMU/Tsinghua/UIUC, Jul 2025) | *what/when/how* three-axis framework; four evolvable components (**Models, Context, Tools, Architecture**); **intra- vs inter-test-time** adaptation; the **"curse of abundance"** — skill libraries don't scale without indexed retrieval + governance | Survey (research-grade; cited systems not deployment-validated) |
| **Voyager** | Executable-**code** skill library + auto-curriculum + self-verification; lifelong transfer | Research (verifiable environment) |
| **Reflexion** | Verbal reinforcement — reflect on failure, condition future attempts | Research |
| **Letta sleep-time compute** | Background consolidation/precompute between turns | **The rare production-validated self-improvement item** |
| **"Safety in Self-Evolving LLM Agent Systems"** (arXiv 2606.23075, Lin et al., Jun 2026, 60pp) | Module-Lifecycle Attack-Surface taxonomy; self-modifying **durable state inherits weight-like, lineage-persistent corruption**; red-team case studies: **100% persistence, 2.5% block rate, 3.5× attack surface** on two OSS frameworks | Preprint; case-study numbers are **red-team [search-grounded, not production telemetry]** |
| **Reward-hacking / RLVR-verifier-gaming** benchmarks | RL post-training **raises exploit rates with chain length/difficulty**; verifiers themselves get gamed | Research benchmarks |

**What UCI adopts:** the survey's **four evolvable components** map directly onto UCI's E-ladder
targets, and **intra- vs inter-test-time** is precisely UCI's separation of *in-session adaptation*
from *durable cross-session Policy* — independent external convergence on the
[`02`](02-the-living-agent-thesis.md) design. Voyager's **executable, not prose, skills** is adopted
as the [core skill constraint](04-learning-reflection-evolution.md#3-skills--the-highest-value-highest-risk-primitive).
Reflexion is adopted as the [Reflection Record](04-learning-reflection-evolution.md#11-the-reflection-record--specified),
*made governed* (its ungoverned form is the failure the safety paper documents).
**The decisive corrective this angle provides:** the safety paper and the reward-hacking benchmarks
are strong external evidence for UCI's hardest disciplines — **(1) durable self-modifying state
inherits corruption that *persists across lineage*** (→ UCI's provenance + demote-not-delete +
calibration-gate are not optional niceties but the documented mitigation), and **(2) verifiers get
gamed** (→ UCI must not rely on a single automated adoption gate; the multi-dimensional eval +
human review for E3+ is the response). The survey's **"curse of abundance"** independently validates
deferring skills until indexed retrieval + governance exist. **Maturity reality the run insisted on:**
of all self-improvement work, **only sleep-time compute is production-validated**; everything else,
including Voyager and Reflexion, is benchmark-stage. UCI's calibration-gate-before-routing discipline
is the correct posture toward a frontier this immature.

### 2a. The Prime Agent family — persistent programmable environments (added 2026-08-20)

*Deep treatment and the accept/reject/generalize/invent judgment are in [`09`](09-cognitive-environment-runtime.md);
this records the sources with maturity flags.*

| Source | Mechanism | Maturity |
|---|---|---|
| **Prime Agent** (Prime Intellect) | Self-improving RLM agent: persistent IPython environment + Continual Harness (CRUD-able prompt notes/memory/skills/subagents, immutable base prompt, rollback) + async `rlm()` children + goals/heartbeats/compaction-≠-termination | **Architectural reference only — reported results are self-evaluations; no model trained for the harness** |
| **RLM (Recursive Language Models)** | Context as a programmatic variable; parallel sub-model scans over chunks; computation over context beats serial ingestion at lower token cost | Research |
| **Prime general-agent** | Synthesizer→solver→difficulty-gate→evolving calibrated task corpus, with **external verifiers** not model self-judgment | Research |
| **ACE** (arXiv 2510.04618) | Context as an evolving playbook; **generation → reflection → curation**; incremental typed updates avoid context-collapse from rewriting a giant summary | Research |
| **Generative Agents** (arXiv 2304.03442) | Observation → planning → reflection for believable persistent behaviour | Research (simulation) |
| **MemGPT** (arXiv 2310.08560) | LLM-as-OS; context as managed virtual memory, paged in/out | Research → productized (Letta) |
| **Context-Folding** (arXiv 2510.11967) | Branch into a local sub-trajectory, solve, **fold back a concise result** — a third context mechanism (→ [`09` §5.1](09-cognitive-environment-runtime.md#51-the-cognitive-branch--a-third-context-mechanism-context-folding)) | Research |
| **CoALA** (arXiv 2309.02427) | Language agents as *cognitive architectures*: modular memory + structured action + decision loop — the 40-yr-cognitive-science bridge | Framework paper |
| **Prime verifiers v1** | Composable **Taskset / Harness / Runtime** separation; branching + subagents + training-ready traces (→ [`09` §8.1](09-cognitive-environment-runtime.md#81-task--harness--runtime-separation--and-the-trainable-cognitive-process)) | Research |
| **True Agents Model the World** (Prime Intellect) | Learn predictive models of tool/environment response during RL, not only assistant-side behaviour | Research |

**Empirical basis for context-as-view:** *Lost in the Middle* (arXiv 2307.03172) shows large nominal
windows still suffer positional retrieval degradation (esp. mid-context) — so a big window is not a
substitute for externalized state; and *τ-bench* (arXiv 2406.12045) shows strong tool-agents have poor
*repeated-trial reliability* on realistic tasks — the basis for UCI's [Longitudinal Cognitive Task
benchmark](06-runtime-data-observability.md#54-the-flagship-benchmark--the-longitudinal-cognitive-task)
and its "single-shot success is insufficient" stance. Memory surveys (arXiv 2603.07670, 2605.06716)
frame agent memory as write/manage/consolidate/forget/retrieve loops, not chat storage.

**What UCI adopts** ([`09`](09-cognitive-environment-runtime.md)): the *inversion* — persistent
programmable environment, context-as-view — as the concretization of the externalized-state thesis;
**computation over context** (RLM) for CSE long-document handling; **external verifiers** (general-agent)
elevated to a principle; ACE's **curation ≠ compression** as the memory-update discipline;
Generative-Agents/Voyager **computational primitives** (observe/plan/reflect; skill library).
**What UCI rejects:** Prime's **model-side self-editing harness** (UCI allows only governed, typed
mutation proposals — self-edit is the documented corruption vector, [§2 safety paper](#2-self-improving--skill-learning-agents-angle-2)); **RLM literally** (abstracted as Recursive
Cognitive Invocation); Prime's **benchmarks as evidence** (self-reported); and the
**simulated-human framing** of Generative Agents (extract primitives, not the imitation).
**Maturity read:** the entire family is architectural/research-grade. Prime is the strongest *design*
reference in the landscape and the weakest *evidence* base — exactly the posture [`09`](09-cognitive-environment-runtime.md#10-what-uci-must-not-take-from-prime-agent)
takes.

## 3. Continual / lifelong learning & model-independent state (Angle 3)

| Source | Finding | Maturity |
|---|---|---|
| **Continual-learning survey** (CSUR 2025) | Parameter-updating vs **parameter-free** axis; catastrophic forgetting is the central obstacle | Survey |
| **JitRL** | **Gradient-free competence accumulation** via non-parametric trajectory memory — a qualified "yes" to external-state-as-substitute | Research |
| **"When Continual Learning Moves to Memory"** | **The stability–plasticity dilemma is *relocated, not eliminated*** — old vs. new experiences now compete at *retrieval* | Research |
| **"Useful Memories Become Faulty When Continuously Updated"** | Self-editing memory **degrades over time** — a memory-layer forgetting analogue | Research |
| **Portable Agent Memory** protocol | Merkle-DAG provenance, capability-scoped tokens, 5-component (episodic/semantic/procedural/working/identity) model, **injection-resistant re-hydration** | Spec-grade, not production-validated |
| **"Forget to Improve"** | Budget-curated memory with **deliberate forgetting** is viable under constraints | Research |

**The strategic finding — and an honest correction to this corpus.** The research **confirms** the
central bet: durable external state is the pragmatic substitute for weight-level continual learning
today (JitRL demonstrates gradient-free accumulation; the whole parameter-free axis exists for this
reason). **But it corrects an overclaim.** An earlier draft of this corpus said external state
*"sidesteps"* catastrophic forgetting. That is too strong. *"When Continual Learning Moves to Memory"*
shows the stability–plasticity dilemma is **relocated to retrieval-time competition, not eliminated**;
*"Useful Memories Become Faulty…"* shows externalized memory has its own degradation. **Corrected
claim (now propagated to [`02` §1](02-the-living-agent-thesis.md#1-the-thesis-stated-as-a-design-law)
and [`03`](03-cognitive-state-and-memory.md)):** externalizing state *moves the hard problem from
weights (opaque, un-governable, catastrophic) to retrieval and memory-hygiene (inspectable,
governable, gradual)* — which is a **better place to fight it**, not a place where it disappears. This
is why UCI's [Context Compiler](02-the-living-agent-thesis.md#4-the-cognitive-context-compiler)
(retrieval competition = the compiler's budgeted precedence problem) and its
[forgetting/demotion policy](03-cognitive-state-and-memory.md#21-memory-lifecycle--capture--promote--forget)
are not peripheral — they are *where the relocated forgetting problem now lives* and must be engineered
explicitly.
**What UCI adopts directly:** the **Portable Agent Memory** protocol's Merkle-DAG provenance +
capability-scoped tokens + injection-resistant re-hydration is the most adoptable spec-grade artifact
for [model-independent state](05-society-and-formation.md#5-model-routing--the-property-that-makes-everything-else-durable)
— it is essentially UCI's requirement written as a portability standard. **"Forget to Improve"**
validates first-class, budgeted, deliberate forgetting.
**Maturity:** all research/spec-grade; none production-validated. The load-bearing engineering
consequence: **retrieval competition, memory staleness/corruption, provenance, and cross-model
re-hydration must be engineered explicitly, not assumed away** — which this corpus now does.

## 4. Multi-agent societies, coordination & disagreement (Angle 4)

| Source | Finding | Maturity |
|---|---|---|
| **MAST failure taxonomy** (Berkeley, NeurIPS 2025) | Empirical "why multi-agent fails": **coordination and verification — not model capability — dominate failures** | Peer-reviewed |
| **Cognition, "Don't Build Multi-Agents"** | Practitioner skeptic: context-sharing fragility, conflicting decisions | Primary (practitioner) |
| **Anthropic multi-agent research system** | Orchestrator-worker; **~90% gain but ~15× tokens**; "architecture follows task structure" | **Production-validated** |
| **ICLR 2025 multi-agent-debate critique** | Debate **rarely beats CoT / Self-Consistency at equal compute** | Peer-reviewed critique |
| **LLM Blackboard System** (arXiv 2510.01285) | Shared-state (blackboard) coordination with measured gains — **maps directly onto UCI's world-state/event-sourced design** | Research |
| **CrewAI / LangGraph / AutoGen** | Graph vs conversation vs role+flow control | Production frameworks (perf claims directional) |

**What UCI adopts:** the **blackboard** result is direct external validation of UCI's existing
world-state + event-sourced coordination — UCI is already on the pattern the research endorses over
free-form agent chat. **MAST's finding that coordination+verification dominate failures** validates
UCI's investment in typed packets, governance, and reasoning traces over raw agent count.
**The decisive corrective — the strongest single external result in this whole landscape for UCI's
design:** the Anthropic number (**~90% gain at ~15× token cost**) plus the ICLR debate critique plus
Cognition's skeptic case together prove **multi-agent is expensive and frequently *not* worth it**.
This is precisely why UCI [invokes disagreement/society machinery *selectively*, cost-gated, for
high-uncertainty outputs only](05-society-and-formation.md#2-disagreement-as-first-class-and-as-learning-data--architecturally-supported),
and keeps a **fixed roster with a good supervisor** rather than a swarm — the conservative,
evidence-backed read, now with a concrete cost figure attached.
**What UCI rejects:** framework "agents" that are configured prompts with no durable identity, state,
or governance. UCI's agents are substrate citizens; the frameworks contribute *control-flow
principles*, not the agent model.

## 5. Cognitive architectures, metacognition & longitudinal evaluation (Angle 5)

| Source | Finding | Maturity |
|---|---|---|
| **LoCoMo** (ACL 2024) | The canonical peer-reviewed long-horizon conversational-memory benchmark | Peer-reviewed |
| **LongMemEval-V2** | Sharpest articulation of the **competence-accumulation-vs-regeneration** problem; the case for **closed-loop longitudinal evaluation** | Benchmark |
| **Intrinsic Metacognitive Learning** (arXiv 2506.05109) | Metacognition framework; **critique of *extrinsic* self-improvement loops** (the agent should own its improvement signal, carefully) | Research |
| **Cognitive Design Patterns for LLM Agents** (arXiv 2505.07087) | The **Soar / ACT-R / CoALA → LLM** bridge; reusable memory/metacognition patterns | Research |
| **State of AI Agent Memory 2026** (Mem0) | Production-vs-benchmark reality check across LoCoMo / LongMemEval / BEAM | Industry report |

**The single most important convergence in the entire landscape:** **LongMemEval-V2 independently
frames the exact thesis this corpus built its evaluation section around** — that the real question is
*competence accumulation vs. regeneration*, and that answering it requires *closed-loop longitudinal
evaluation*, not single-turn answer quality. UCI's
[longitudinal evaluation framework](06-runtime-data-observability.md#5-evaluation-deliverable-k--proving-intelligence-accumulates-not-regenerates)
— "an agent is *living* iff, model held fixed, performance on held-out tasks improves as accumulated
substrate state grows, and survives a model swap" — is the same claim the frontier has converged on,
which is strong evidence it is the right target (and that **no established benchmark yet measures it** —
a genuine UCI contribution opportunity via synthetic learners + replay).
**What UCI adopts:** the **CoALA/Soar/ACT-R design-patterns bridge** validates UCI's tiered memory +
Skill (procedural memory) + Self-Model (metacognition) structure — 40 years of cognitive science says
separate memory by function and make procedural memory first-class. The **intrinsic-metacognition
critique of extrinsic self-improvement** is a caution for UCI's reflect loop: the improvement signal
must be well-grounded, not an external metric the agent games (→ ties to the reward-hacking findings
in §2).
**What UCI takes as a target, not an adoption:** the field has *no* accepted "does this agent get
better over months" benchmark. UCI's synthetic-learner + replay longitudinal testbed is a credible way
to build one.

## 6. Synthesis — six load-bearing conclusions

Each feeds a design decision, and two of them *changed* this corpus:

1. **Externalized durable state is the pragmatic substitute for weight-level continual learning —
   but it *relocates*, not eliminates, the stability–plasticity problem** (§3). → *Corrected the
   thesis*; the compiler and forgetting policy are where that relocated problem now lives.
2. **Memory must be bi-temporal, graph-native, invalidation-not-deletion** (§1, Zep/Graphiti). →
   validates world-state-as-memory + motivates R2 causal/temporal edges.
3. **Skills must be executable/structured, and skill-library-only is a documented mistake ("curse of
   abundance", "procedural memory is not all you need")** (§1–2, Voyager). → validates *deferring*
   skills and never centering them.
4. **Self-modifying durable state inherits lineage-persistent corruption, and verifiers get gamed**
   (§2, safety paper + reward-hacking). → validates provenance + demote-not-delete + calibration gate
   + human review at E3+; a single automated adoption gate is insufficient.
5. **Multi-agent is expensive (~15× tokens for ~90% gain) and often loses to a single strong agent;
   blackboard/shared-state coordination is the endorsed pattern** (§4). → validates selective,
   cost-gated society invocation over a fixed supervised roster with world-state coordination.
6. **The field has converged on "competence accumulation vs. regeneration" as the real question and
   has no benchmark for it yet** (§5, LongMemEval). → validates UCI's longitudinal-evaluation thesis
   and marks it a contribution.

**The strategic through-line, confirmed by the run:** the frontier has good *mechanisms* (memory
blocks, temporal graphs, skill libraries, reflection, debate) and **weak *discipline*** — governance
of self-improvement, calibration before routing, provenance against corruption, and longitudinal
evaluation of accumulation are all named as *open problems* across these sources. UCI's substrate is
strong on exactly that discipline. **UCI's largest opportunities are precisely where the frontier is
weakest.** That complementarity is the strategic case for the whole program.

> **Verification status.** The run's 3-vote adversarial pass did not complete; numbers marked
> **[vendor-reported]** / **[search-grounded]** should be confirmed before external citation. The
> *qualitative* conclusions are cross-source-corroborated (each angle deliberately paired advocates
> with skeptics) and are robust to any single number moving.

→ Return to the [canonical architecture](02-the-living-agent-thesis.md) or the
[roadmap](08-roadmap-and-adrs.md).
