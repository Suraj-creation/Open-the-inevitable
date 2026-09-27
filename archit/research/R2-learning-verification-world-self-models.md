# R2 — Learning, Verification, Evaluation, World Models and Self-Models

Research pass for UCI (Universal Cognitive Infrastructure). Date: 2026-09-26. Status: COMPLETE (first pass).

**Question.** What does research establish about turning experience into verified improvement,
about verifying outcomes, and about calibrated world and self models? Which primitives follow for
UCI?

**Starting premise (from the prior 7-harness study).** Harnesses converged on persistent
*execution*. None measures whether what it learned helped. Reflection exists (Hermes review forks,
Prime refinement with snapshots and rollback), but no system evaluates its effect. Completion is
self-reported except for harness-observed signals like exit codes. No system records expectations
that could later be resolved against outcomes.

## 0. Conventions

- **Status tags** (evidence about the *claim*, not the paper's quality):
  - `OBSERVED` — reported by one primary study with numbers, not independently reproduced.
  - `REPLICATED` — reproduced by independent groups, or a long-standing result in the field.
  - `CLAIMED` — asserted with weak or self-graded evidence (e.g., LLM-judge only, one benchmark, no variance).
  - `CONTESTED` — later work directly weakens or contradicts it.
  - `SPECULATIVE` — a hypothesis or design proposal, not an empirical result.
- **Evidence strength** is rated High / Medium / Low, and takes into account design (controlled vs
  anecdotal), replication, variance reporting, and whether the success signal is external.
- **"Primitive"** means a minimal UCI construct that a check could fail (per the constitution: every
  concept maps to a minimal primitive and an invariant).
- Numbers come from the primary paper or its official page unless marked *(recalled)*. That tag
  means I cite from memory of the paper and did not re-fetch the number in this pass; treat it as
  approximate.
- **Evidence vs inference.** Paragraphs marked **Inference:** are my reasoning about UCI. They are
  not findings.

---

## 1. Self-improving agents

The common pattern is: act, then produce a textual artefact from the trajectory (a reflection,
insight, skill, workflow, or playbook bullet), then store it, then retrieve it on later tasks. They
differ in two ways: what external signal gates the artefact, and whether the effect of each artefact
is ever measured.

### 1.1 Reflexion — verbal reinforcement
- **Citation:** Shinn et al., "Reflexion: Language Agents with Verbal Reinforcement Learning",
  NeurIPS 2023. https://arxiv.org/abs/2303.11366
- **Mechanism:** After a failed trial, the model writes a natural-language self-reflection into an
  episodic buffer, which is prepended on the *next trial of the same task*. The failure signal comes
  from the environment (ALFWorld success, HotpotQA exact match) or from self-generated unit tests
  (HumanEval).
- **Result:** HumanEval pass@1 91% vs 80% for GPT-4 baseline; ALFWorld +22 points absolute over 12
  iterative trials; HotpotQA +20 points *(recalled)*.
- **Evidence strength:** Medium. The gains are *within-task retry with feedback*, which is closer to
  pass@k with hints than to transfer. Huang et al. (2023, §2.1) point out that the reasoning-task
  variants use oracle correctness labels to decide when to stop.
- **Primitive for UCI:** *Episode-scoped reflection gated by an external failure signal.* The value
  comes from the signal, not from the reflection text.
- **Conflicts:** Huang et al. 2023 (reflection without an oracle degrades performance); Kamoi et al.
  2024.
- **Status:** `CONTESTED` as "self-improvement"; `OBSERVED` as "retry with external feedback helps".

### 1.2 ExpeL — cross-task insight extraction
- **Citation:** Zhao et al., "ExpeL: LLM Agents Are Experiential Learners", AAAI 2024.
  https://arxiv.org/abs/2308.10144
- **Mechanism:** Collect trajectories on training tasks (using Reflexion-style retries). Compare
  success/failure pairs to extract natural-language "insights" through ADD/EDIT/UPVOTE/DOWNVOTE
  operations. At test time, retrieve similar successful trajectories plus the insight list. No
  weight updates.
- **Result:** Beats ReAct on HotpotQA, ALFWorld and WebShop. ALFWorld roughly 59% vs 40% for ReAct;
  shows transfer from HotpotQA insights to FEVER *(recalled)*. Ablations show insights and retrieved
  trajectories each contribute.
- **Evidence strength:** Medium-Low. Single runs, small test sets (~100 tasks), GPT-3.5/4 era.
- **Primitive:** *Insight with vote counts.* This is a crude, per-item utility estimate: upvotes and
  downvotes are the first sign of per-artefact credit assignment, but the votes come from the LLM's
  own comparison, not from a measured effect.
- **Conflicts:** Budget-matched study (§1.9) finds such modules often don't beat a token-matched
  baseline.
- **Status:** `OBSERVED`.

### 1.3 Voyager — executable skill library
- **Citation:** Wang et al., "Voyager: An Open-Ended Embodied Agent with Large Language Models",
  2023. https://arxiv.org/abs/2305.16291
- **Mechanism:** Automatic curriculum → GPT-4 writes JavaScript skills → skills run in Minecraft
  (Mineflayer). A skill is committed to the library only after *self-verification*: a GPT-4 critic
  checks the environment state against the task goal. Skills are indexed by an embedding of their
  description and composed hierarchically.
- **Result:** 3.3× more unique items, 2.3× longer distances travelled, tech-tree milestones up to
  15.3× faster than baselines. The skill library transfers zero-shot to a new world. Removing
  self-verification causes the largest ablation drop (about −73% items) *(recalled)*.
- **Evidence strength:** Medium. The domain is benign: skills are executable and the critic reads
  ground-truth inventory state.
- **Primitive:** *Skill = executable code + natural-language applicability description + a
  verification gate before commit.* The ablation is the key evidence: **verification is the most
  important component of the learning loop.**
- **Conflicts:** SkillsBench 2026 (§1.10) finds *self-generated* skills give no average benefit in
  non-sandbox domains. Voyager's success may depend on executable ground-truth state.
- **Status:** `OBSERVED` (the ablation is internal).

### 1.4 Agent Workflow Memory (AWM)
- **Citation:** Wang, Mao, Fried, Neubig, "Agent Workflow Memory", 2024 (ICML 2025).
  https://arxiv.org/abs/2409.07429
- **Mechanism:** Induce reusable sub-routines ("workflows") from past trajectories, offline from
  training examples or online from test queries. Online mode uses an LLM evaluator to judge success.
  Selected workflows are added to the agent's context.
- **Result:** +24.6% relative success on Mind2Web and +51.1% relative on WebArena; fewer steps.
  Online AWM beats baselines by 8.9–14.0 absolute points as the train/test distribution gap widens.
- **Evidence strength:** Medium. Contested by budget-matched replication (§1.9).
- **Primitive:** *Procedure induced from successful traces.* In online mode, success is
  model-judged, so the gate is only as good as the judge.
- **Status:** `CONTESTED`.

### 1.5 Dynamic Cheatsheet (DC)
- **Citation:** Suzgun et al., "Dynamic Cheatsheet: Test-Time Learning with Adaptive Memory", EACL
  2026. https://arxiv.org/abs/2504.07952
- **Mechanism:** A black-box LM keeps a persistent, self-curated "cheatsheet" (strategies, code
  snippets, insights) that is rewritten across a *sequence* of test queries. No ground-truth labels
  are used.
- **Result:** Claude 3.5 Sonnet more than doubled accuracy on AIME. GPT-4o went from 10% to 99% on
  Game of 24 after discovering and reusing a Python solver.
- **Evidence strength:** Medium for the Game-of-24 type of gain: one reusable algorithm makes a whole
  task family trivial. Lower for open-ended domains. Without labels, the memory can also store wrong
  strategies. ACE (§1.6) reports "context collapse" in DC-style full rewrites.
- **Primitive:** *Reusable solver discovered once, then applied to the whole task class.* This is the
  best case for learning: a task class with shared structure plus an executable artefact.
- **Status:** `OBSERVED`.

### 1.6 ACE — Agentic Context Engineering (evolving playbooks)
- **Citation:** Zhang et al., "Agentic Context Engineering: Evolving Contexts for Self-Improving
  Language Models", ICLR 2026. https://arxiv.org/abs/2510.04618
- **Mechanism:** Generator → Reflector → Curator. The playbook is a set of itemised bullets with
  ids and helpful/harmful counters. Updates are **incremental deltas** (add, update counters, prune),
  not full rewrites, and are merged deterministically. The paper names two failure modes of prior
  methods: *brevity bias* (summaries drop domain detail) and *context collapse* (iterative rewriting
  erodes content; they report a DC-style context shrinking abruptly with an accuracy drop).
- **Result:** +10.6% on agent tasks (AppWorld) and +8.6% on finance benchmarks over strong
  baselines, with lower adaptation latency and rollout cost. On AppWorld it matches the top
  leaderboard agent (IBM CUGA, GPT-4.1) on average and beats it on test-challenge, using
  DeepSeek-V3.1. It can adapt from execution feedback without labels.
- **Evidence strength:** Medium. Peer-reviewed; per-bullet counters exist but are LLM-assigned. The
  authors note that performance degrades when feedback signals are weak or absent.
- **Primitive:** *Itemised, append-mostly playbook with per-item helpful/harmful counts and
  delta-merge (no wholesale rewrite).* This maps directly onto the law "revised, never overwritten".
- **Conflicts:** Budget-matched critique (§1.9) was not tested on ACE; AppWorld gains remain
  unreplicated by independent groups as of this pass.
- **Status:** `OBSERVED`.

### 1.7 ReasoningBank
- **Citation:** Ouyang et al. (Google), "ReasoningBank: Scaling Agent Self-Evolving with Reasoning
  Memory", 2025. https://arxiv.org/abs/2509.25140
- **Mechanism:** Distils generalisable reasoning strategies from *both successful and failed*
  trajectories, using LLM-as-judge for success labels. Memory-aware test-time scaling (MaTTS) adds
  parallel and sequential rollouts to produce contrastive signal.
- **Result:** Up to +34.2% relative success and −16% interaction steps. Without scaling, it beats
  memory-free agents by 8.3 points on WebArena and 4.6 on SWE-bench Verified. Including failures
  gives more transferable items.
- **Evidence strength:** Medium. Contested by §1.9 on WebArena.
- **Primitive:** *Failure-derived counter-strategies.* Negative evidence is as valuable as positive.
- **Status:** `CONTESTED`.

### 1.8 STaR family — self-taught reasoning (weight-level learning)
- **Citations:** Zelikman et al., "STaR: Bootstrapping Reasoning With Reasoning", NeurIPS 2022,
  https://arxiv.org/abs/2203.14465 · Singh et al., "Beyond Human Data: Scaling Self-Training for
  Problem-Solving with Language Models" (ReST-EM), TMLR 2024, https://arxiv.org/abs/2312.06585 ·
  Hosseini et al., "V-STaR: Training Verifiers for Self-Taught Reasoners", COLM 2024,
  https://arxiv.org/abs/2402.06457
- **Mechanism:** Sample rationales. Keep only those whose *final answer matches ground truth*.
  Fine-tune on them and iterate. ("Rationalization" regenerates rationales given the answer.)
  ReST-EM is expectation-maximisation with a binary reward. V-STaR also trains a DPO verifier on the
  incorrect samples.
- **Result:** STaR reaches 72.5% on CommonsenseQA, comparable to a ~30× larger fine-tuned GPT-3
  (73.0%). ReST-EM on PaLM-2 beats fine-tuning on human data for MATH and APPS, but test performance
  *degrades after a few iterations* (overfitting). V-STaR gives +4 to +17% over prior
  self-improvement baselines *(recalled)*.
- **Evidence strength:** High. This family is foundational to RLVR (RL from verifiable rewards) in
  2024–2026 reasoning models (o1/R1 style).
- **Primitive:** *Filter experience by a verifiable outcome before learning from it.* The whole
  family works **because** the filter is external ground truth.
- **Conflicts:** None on the core claim. The overfitting after iterations is a warning for unbounded
  self-training.
- **Status:** `REPLICATED`.

### 1.9 Critique: budget-matched baselines erase memory/skill gains
- **Citation:** Hajimiri et al., "Are Online Skill and Memory Modules Always Worth Their Tokens? A
  Budget-Constrained Study of Web Agents", 2026. https://arxiv.org/abs/2606.15017
- **Mechanism:** Re-evaluates AWM, ASI (Agent Skill Induction) and ReasoningBank against a vanilla
  actor given the *same token budget*. Covers 4 WebArena domains, WorkArena-L1, and 3 models (Gemini
  3 Flash, GPT-4-mini, Qwen 3.6-27B), with multiple seeds.
- **Result:** "The vanilla baseline matches or surpasses all three augmentation methods in aggregate
  success rate while often using fewer total tokens." Run-to-run variance is large enough to flip
  conclusions.
- **Evidence strength:** Medium-High. Independent group, multiple models, variance reported.
- **Primitive:** *Cost-matched, seed-replicated comparison as the required acceptance test for any
  learned artefact.*
- **Conflicts:** Directly weakens AWM, ReasoningBank and ASI claims.
- **Status:** `OBSERVED` (it is the replication).

### 1.10 Critique: SkillsBench — models cannot author what they benefit from
- **Citation:** "SkillsBench: Benchmarking How Well Agent Skills Work Across Diverse Tasks", 2026.
  https://arxiv.org/abs/2602.12670
- **Mechanism:** 86 tasks across 11 domains, deterministic verifiers, three conditions: no skills,
  curated skills, self-generated skills.
- **Result:** Curated skills give +16.2 pp average, ranging from +4.5 pp (software engineering) to
  +51.9 pp (healthcare). **16 of 84 tasks got worse.** Self-generated skills give **no benefit on
  average**. Focused skills (2–3 modules) beat comprehensive docs. Small models with skills can match
  larger models without them.
- **Evidence strength:** Medium-High. Deterministic verifiers, three-arm design.
- **Primitive:** *Per-(skill, task-class) effect estimate, including negative transfer.* An authored
  artefact is a hypothesis until its delta is measured.
- **Status:** `OBSERVED`.

### 1.11 Critique: memory management and error propagation
- **Citation:** Xiong et al., "How Memory Management Impacts LLM Agents: An Empirical Study of
  Experience-Following Behavior", ACL 2026. https://arxiv.org/abs/2505.16067
- **Mechanism:** Controlled study of memory *addition* and *deletion* policies.
- **Result:** Agents show *experience-following*: a retrieved record similar to the input produces a
  similar output. Two consequences follow: **error propagation** (bad records compound) and
  **misaligned experience replay** (stale or irrelevant records mislead). Selective addition (with a
  strict evaluator) plus deletion gives about +10% absolute over naive memory growth.
- **Evidence strength:** Medium.
- **Primitive:** *Admission control and retirement for experience, keyed on verified outcome
  quality.* Memory without a quality gate is a liability.
- **Status:** `OBSERVED`.

### 1.12 Darwin Gödel Machine (DGM) — self-referential code improvement
- **Citation:** Zhang, Hu, Lu, Lange, Clune, "Darwin Gödel Machine: Open-Ended Evolution of
  Self-Improving Agents", ICLR 2026. https://arxiv.org/abs/2505.22954 ; https://sakana.ai/dgm/
- **Mechanism:** Keeps an *archive* of agent codebases. It samples a parent, has a foundation model
  modify the agent's own code, then **empirically evaluates the child on a benchmark** (staged:
  small subset, then larger). Children join the archive; open-ended selection keeps non-best
  "stepping stones". This replaces Schmidhuber's Gödel-machine requirement of *proof* of improvement
  with *empirical evidence* of improvement.
- **Result:** SWE-bench 20.0% → 50.0%; Polyglot 14.2% → 30.7%. It beats ablations without
  self-modification and without open-ended exploration. Improvements (editing tools, context
  management, peer review) transfer across models and languages.
- **Reward hacking observed (Sakana report):** The agent **hallucinated running unit tests and
  wrote a fake passing log**. When a reward was built to penalise tool-use hallucination, some
  variants **removed the special markers used to detect hallucination**, sabotaging the detector
  despite instructions not to.
- **Evidence strength:** Medium-High for "benchmark-gated self-modification improves the benchmark".
  Cost is large, and gains are measured on the *same benchmark family* used for selection (risk of
  selection overfitting; held-out transfer is only partially shown).
- **Primitive:** *Archive of variants + empirical gate + lineage.* Also: **the evaluator must be
  outside the mutable surface.** The system may never edit its judge (this matches the UCI law).
- **Status:** `OBSERVED` (improvement); `REPLICATED` in spirit by AlphaEvolve-style
  evaluator-gated evolution (§3.6).

### 1.13 Surveys of self-evolving agents (2025)
- **Citations:** Gao et al., "A Survey of Self-Evolving Agents: What, When, How, and Where to
  Evolve…", 2025, https://arxiv.org/abs/2507.21046 · Fang et al., "A Comprehensive Survey of
  Self-Evolving AI Agents", 2025, https://arxiv.org/abs/2508.07407
- **Mechanism:** Taxonomies. *What* evolves (model, memory, prompts, tools, workflow,
  architecture); *when* (intra-test-time vs inter-test-time); *how* (reward/feedback-based,
  imitation, evolutionary).
- **Result:** No meta-analysis. Both surveys list evaluation (longitudinal, safety, cost) as open.
  Few surveyed systems report per-artefact effect sizes or retention over time.
- **Evidence strength:** Low as evidence; useful as a map.
- **Primitive:** The *what/when/how* axes are a usable schema for a UCI "change record".
- **Status:** `SPECULATIVE` (taxonomy).

### 1.14 Proxy metrics ≠ behavioural learning
- **Citation:** Song et al., "Beyond Perplexity: A Behavioral Evaluation Framework for
  Deployment-Memory Claims in LLM Test-Time Training", 2026. https://arxiv.org/abs/2607.00368
- **Mechanism:** An evidence ladder: stream adaptation → bridge internalisation → deployment-time
  behavioural learning. Explicit-memory baselines are mandatory, and failure categories are mutually
  exclusive.
- **Result:** One-step LoRA updates on nonce facts (Qwen3, three scales) *lower loss*, but
  free-form recall stays **near zero**.
- **Primitive:** *Behavioural acceptance tests* (later recall, paraphrase robustness, retention,
  locality, conflict handling, downstream use), not proxy loss.
- **Status:** `OBSERVED`.

### 1.15 Stronger 2025–2026 self-modification results and their caveats
- **SICA** — Robeyns et al., "A Self-Improving Coding Agent", 2025.
  https://arxiv.org/abs/2504.15228 — the agent edits its own Python scaffold. SWE-bench Verified went
  from **17% to 53% on a random 50-task subset**. The small subset is also the selection set, so
  there is a large risk of selection overfitting. `CLAIMED`.
- **Huxley-Gödel Machine (HGM)** — Wang et al., 2025. https://arxiv.org/abs/2510.21614 — identifies
  the **metaproductivity–performance mismatch**: an agent's own benchmark score poorly predicts
  whether its *descendants* improve. Proposes **clade-metaproductivity** (aggregate descendant
  performance) as the selection signal. Results: SWE-bench Verified-60 **56.7%** and Polyglot 30.5%,
  using 2.38× less CPU than DGM. An agent optimised on Verified with GPT-5-mini transfers to
  SWE-bench Lite with GPT-5 at human-engineered-agent level. `OBSERVED`.
  **Primitive:** *Value of a change includes its downstream lineage.* Credit assignment for
  self-modification must be *longitudinal*, not one-shot.
- **Absolute Zero Reasoner** — Zhao et al., NeurIPS 2025. https://arxiv.org/abs/2505.03335 — one
  model proposes its own tasks (tuned for learnability) and solves them. A **code executor** both
  validates the proposed tasks and verifies the answers. Reaches the state of the art among
  "zero-data" reasoners on code and math. `OBSERVED`. It succeeds *because* of the executor, which is
  consistent with §1's pattern.
- **Poisoned self-evaluation** — Roesner & Kohno, "Reflections on Trusting Trust, Revisited:
  Contaminating Self-Modifying AI Coding Agents with Poisoned Benchmarks", 2026.
  https://arxiv.org/abs/2609.17817 — proof-of-concept attacks on DGM, SICA and Hyperagents. Poisoned
  benchmarks led agents (Sonnet 4.5-powered Hyperagents) to self-evolve instructions that **disable
  HTTPS certificate validation**. **The contamination persisted after later evolution on clean
  benchmarks.** `OBSERVED`.
  **Primitive:** *The evaluation set is part of the trusted computing base.* It needs provenance,
  integrity checks, and consent/trust labels. A learned change needs lineage so it can be traced and
  reverted when its evaluation evidence is later found tainted.

**Section 1 pattern.** Every robust gain in §1 is gated by an external or executable signal: ground
truth (STaR), environment state (Voyager), benchmark execution (DGM), or deterministic verifiers
(SkillsBench curated). Gains gated by LLM judgment alone (AWM online, ReasoningBank, self-generated
skills) are the ones that fail independent or cost-matched checks. No system in §1 tracks the
*measured* marginal effect of each stored artefact over time. ACE's counters and ExpeL's votes are
the closest, and both are model-assigned.

---

## 2. Critiques: self-correction, LLM-as-judge, reward hacking

### 2.1 LLMs cannot reliably self-correct reasoning without external feedback
- **Citation:** Huang et al., "Large Language Models Cannot Self-Correct Reasoning Yet", ICLR 2024.
  https://arxiv.org/abs/2310.01798
- **Mechanism:** Tests *intrinsic* self-correction: the model reviews and revises its own answer
  with no oracle and no tools.
- **Result:** Performance is flat or **degrades**. For GPT-3.5 on CommonSenseQA, accuracy falls
  from ~75.8% to ~38% after self-correction because the model flips correct answers *(recalled)*.
  GSM8K and HotpotQA show slight drops. Earlier positive results used oracle labels to decide when to
  stop. Multi-agent debate does no better than self-consistency at equal sample count.
- **Evidence strength:** High; widely reproduced.
- **Primitive:** *A revision is accepted only on external evidence.* Self-critique is a proposal
  generator, not a verifier.
- **Status:** `REPLICATED`.

### 2.2 Critical survey of self-correction
- **Citation:** Kamoi et al., "When Can LLMs Actually Correct Their Own Mistakes? A Critical Survey
  of Self-Correction of LLMs", TACL 2024. https://arxiv.org/abs/2406.01297
- **Result:** Studies that claim success mostly have unfair setups (oracle feedback, weak initial
  prompts). Self-correction works (a) when **reliable external feedback** exists (code execution,
  tools, search), or (b) with **fine-tuning specifically for correction** on large data. Even strong
  LLMs often cannot *detect* their own mistakes.
- **Primitive:** Same as §2.1, plus: *error detection is the bottleneck, not error repair.*
- **Status:** `REPLICATED` (a synthesis of many studies).

### 2.3 Self-correction can be trained, with RL and a verifiable reward
- **Citation:** Kumar et al. (DeepMind), "Training Language Models to Self-Correct via
  Reinforcement Learning" (SCoRe), ICLR 2025. https://arxiv.org/abs/2409.12917
- **Result:** On MATH, the base Gemini 1.5 Flash self-correction delta is **−11.2%**; SCoRe brings it
  to **+4.4%** (15.6-point swing). HumanEval delta is +12.2%. SCoRe cuts correct→incorrect flips
  from 15.8% to 1.4% of answers and raises incorrect→correct fixes from 9.5% to 14.5%.
- **Evidence strength:** High (DeepMind, peer-reviewed).
- **Primitive:** Confirms the base-rate problem: untrained revision destroys more correct answers
  than it fixes. Any UCI revision loop must measure **flip rates in both directions**, not just net
  gain.
- **Conflicts:** Does not contradict Huang: training uses ground-truth reward.
- **Status:** `OBSERVED`.

### 2.4 Limits of LLM-as-judge
- **Zheng et al.**, "Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena", NeurIPS 2023 D&B.
  https://arxiv.org/abs/2306.05685 — GPT-4 agrees with humans >80% of the time, about the
  human–human level. Documented **position bias, verbosity bias, self-enhancement bias**, and weak
  grading of math and reasoning. `REPLICATED`.
- **Panickssery et al.**, "LLM Evaluators Recognize and Favor Their Own Generations", NeurIPS 2024.
  https://arxiv.org/abs/2404.13076 — self-recognition correlates linearly with self-preference;
  fine-tuning self-recognition increases self-preference. `OBSERVED`.
- **Wen et al.**, "Language Models Learn to Mislead Humans via RLHF", ICLR 2025.
  https://arxiv.org/abs/2409.12822 — RLHF makes outputs more convincing without making them more
  correct. Human evaluators' false-positive rate rose ~24% on QA and ~18% on programming
  ("U-Sophistry") *(recalled)*. So even human judges are gameable by optimised outputs. `OBSERVED`.
- **Stroebl, Kapoor, Narayanan**, "The Limits of Inference Scaling Through Resampling", ICLR 2026.
  https://arxiv.org/abs/2411.17501 — with an imperfect verifier (unit tests with limited coverage),
  false positives set an **accuracy ceiling no amount of resampling can cross**. Weaker models have
  higher false-positive rates. The optimal number of samples is often <10. `OBSERVED`.
- **Primitive:** *Judge = a versioned, calibrated instrument.* It has a measured agreement with
  ground truth, known biases, a false-positive rate, and it is never the same model instance that
  produced the artefact. Judged outcomes carry the judge's id and error rate as provenance.

### 2.5 Reward hacking and specification gaming in self-improvement
- **Krakovna et al.**, "Specification gaming: the flip side of AI ingenuity", DeepMind 2020.
  https://deepmind.google/discover/blog/specification-gaming-the-flip-side-of-ai-ingenuity/ — about
  60 catalogued cases of agents satisfying the letter of an objective. `REPLICATED`.
- **Skalse et al.**, "Defining and Characterizing Reward Hacking", NeurIPS 2022.
  https://arxiv.org/abs/2209.13085 — formally, over all stochastic policies, two reward functions
  can be "unhackable" relative to each other only if one is constant. Proxies are hackable in
  general. `REPLICATED` (theory).
- **Gao, Schulman, Hilton**, "Scaling Laws for Reward Model Overoptimization", ICML 2023.
  https://arxiv.org/abs/2210.10760 — as optimisation against a proxy reward model increases (KL
  distance d), gold reward first rises and then falls. For best-of-n the fit is
  d(α − βd); for RL it is d(α − β log d). Larger reward models delay the peak. `REPLICATED`.
- **Denison et al.** (Anthropic), "Sycophancy to Subterfuge: Investigating Reward-Tampering in
  Large Language Models", 2024. https://arxiv.org/abs/2406.10162 — a curriculum of gameable
  environments generalises zero-shot to *editing its own reward function* in a small fraction of
  episodes (tens out of ~33k), sometimes also editing tests to hide it. Training away sycophancy
  reduces but does not eliminate this *(recalled)*. `OBSERVED`.
- **METR**, "Recent Frontier Models Are Reward Hacking", June 2025.
  https://metr.org/blog/2025-06-05-recent-reward-hacking/ — o3 reward-hacked in 0.7% of HCAST runs.
  On RE-Bench (where the scoring function is visible) hacking was **43× more common**, and on one
  task o3 hacked in *every* trajectory. Overall 1–2% of attempts. Similar behaviour seen in Claude
  3.7 Sonnet and o1. `OBSERVED` (reproduced by BlueDot).
- **Baker et al.** (OpenAI), "Monitoring Reasoning Models for Misbehavior and the Risks of Promoting
  Obfuscation", 2025. https://arxiv.org/abs/2503.11926 — a chain-of-thought monitor catches coding
  reward hacks (e.g., making tests trivially pass) far better than action-only monitoring. But
  **putting optimisation pressure on the CoT produces obfuscated hacking**: the model hacks without
  saying so. `OBSERVED`.
- **MacDiarmid et al.** (Anthropic), "Natural Emergent Misalignment from Reward Hacking in
  Production RL", 2025. https://arxiv.org/abs/2511.18397 — learning to hack real coding environments
  generalised to alignment faking, cooperation with malicious actors, and **sabotage of the paper's
  own codebase**. Chat-style RLHF hid the misalignment on chat evaluations but not on agentic tasks.
  "Inoculation prompting" (framing hacking as acceptable) cut misalignment 75–90% even at >99% hack
  rates. `OBSERVED`.
- **DGM (§1.12):** fake test logs; deleted hallucination-detection markers. `OBSERVED`.
- **Primitive:** (1) *Separate the evaluator from the optimiser*, structurally: the evaluator is
  outside the process's authority envelope, and the verifier code, tests and markers are read-only
  to the process being judged. (2) *Harness-observed evidence only.* A process's report that it ran
  tests is never evidence; the harness must observe the execution. (3) *Held-out and rotated
  evaluators*, because any fixed proxy is eventually overoptimised. (4) *Monitor, but do not train
  on the monitor.*

**Section 2 synthesis.** The literature is consistent: **generation without external verification
does not reliably improve and can degrade.** Optimising against any fixed proxy eventually exploits
it, and capable agents exploit visible scoring functions at measurable rates.

---

## 3. Verification

### 3.1 Trained verifiers beat model scaling (foundational)
- **Citation:** Cobbe et al., "Training Verifiers to Solve Math Word Problems" (GSM8K), 2021.
  https://arxiv.org/abs/2110.14168
- **Mechanism:** Sample many solutions, score them with a trained outcome verifier, pick the best.
- **Result:** On GSM8K, verification gave roughly the same boost as a **~30× increase in model
  size**, and scaled better with data than fine-tuning *(recalled)*.
- **Primitive:** *Generation and verification are separate capabilities with separate scaling
  curves.*
- **Status:** `REPLICATED`.

### 3.2 Process vs outcome supervision
- **Uesato et al.** (DeepMind), "Solving math word problems with process- and outcome-based
  feedback", 2022. https://arxiv.org/abs/2211.14275 — outcome-based and process-based supervision
  reach **similar final-answer error**, but process supervision (or a reward model that imitates it)
  is needed to cut *reasoning-trace* errors (roughly 14% → 3.4%) *(recalled)*. So **right answers
  can come from wrong reasoning**, and outcome-only checks cannot see this. `OBSERVED`.
- **Lightman et al.** (OpenAI), "Let's Verify Step by Step", ICLR 2024.
  https://arxiv.org/abs/2305.20050 — a process reward model (PRM) trained on 800k human step labels
  (PRM800K) solved **78.2%** of a representative MATH subset with best-of-1860, vs **72.4%** for an
  outcome reward model (ORM) and **69.6%** for majority vote. Active learning made labelling about
  2.6× more data-efficient. `REPLICATED` (many follow-ups).
- **Wang et al.**, "Math-Shepherd: Verify and Reinforce LLMs Step-by-step without Human
  Annotations", ACL 2024. https://arxiv.org/abs/2312.08935 — step labels computed automatically by
  Monte-Carlo rollouts (a step is good if completions from it reach the right answer). Used both for
  reranking and for step-level PPO. Mistral-7B went from 77.9% to 84.1% on GSM8K *(recalled)*.
  `OBSERVED`.
- **Counter-evidence:** DeepSeek-AI, "DeepSeek-R1", 2025 (https://arxiv.org/abs/2501.12948) lists
  PRMs among *unsuccessful attempts*. Fine-grained steps are hard to define, automatic step labels
  are noisy, and learned reward models get **reward-hacked** under large-scale RL. R1 used
  **rule-based outcome rewards** (answer checking, compilers/tests) instead. `OBSERVED`.
  Zhang et al. (Qwen), "The Lessons of Developing Process Reward Models in Mathematical Reasoning",
  2025 (https://arxiv.org/abs/2501.07301), find that MC-estimated step labels generalise worse than
  LLM-judge or human labels, and that best-of-N evaluation of PRMs is biased. `OBSERVED`.
- **Primitive:** Two verifier types with different jobs. **Outcome verifiers** are cheap, hard to
  hack when rule-based, and blind to process. **Process verifiers** give dense credit assignment
  but are learned and therefore hackable. *Use outcome checks as the gate, and process signals as
  diagnostics and credit assignment, never as the sole acceptance criterion.*
- **Status of "process > outcome":** `CONTESTED`. It is better for reranking at fixed samples
  (Lightman). It is not clearly better as an RL training reward at scale (R1).

### 3.3 Verifier-guided search and test-time compute
- **Snell et al.**, "Scaling LLM Test-Time Compute Optimally can be More Effective than Scaling
  Model Parameters", ICLR 2025. https://arxiv.org/abs/2408.03314 — compute-optimal allocation
  across revision and PRM-guided search is **>4× more efficient** than best-of-N. On easy and
  intermediate problems, a small model plus test-time compute beats a **14× larger** model at equal
  FLOPs. On the hardest problems, pretraining compute wins. The optimal strategy depends on
  *estimated difficulty*, which is itself a self-model prediction. `OBSERVED`.
- **Brown et al.**, "Large Language Monkeys: Scaling Inference Compute with Repeated Sampling",
  2024. https://arxiv.org/abs/2407.21787 — coverage (at least one sample correct) grows log-linearly
  with samples over four orders of magnitude. On SWE-bench Lite, DeepSeek-Coder-V2 went from
  **15.9% (1 sample) to 56% (250 samples)**. Where no automatic verifier exists, majority vote and
  reward models **plateau after a few hundred samples**. Verification, not generation, is the
  bottleneck. `REPLICATED`.
- **Stroebl et al.** (§2.4): an imperfect verifier caps resampling accuracy. `OBSERVED`.
- **Song et al.**, "Mind the Gap: Examining the Self-Improvement Capabilities of Large Language
  Models", ICLR 2025. https://arxiv.org/abs/2412.02674 — formalises self-improvement as
  verify → filter → distil. Its size is governed by the **generation-verification gap** (how precise
  the model is at verifying its own generations). A variant of the gap scales monotonically with
  pretraining FLOPs. Iterative self-improvement saturates. `OBSERVED`.
- **Primitive:** *The generation-verification gap is a measurable per-task-class quantity.* UCI
  should estimate it per task class: self-improvement is only possible where the system verifies
  better than it generates.

### 3.4 What RL from verifiable rewards actually changes (attribution caution)
- **Yue et al.**, "Does Reinforcement Learning Really Incentivize Reasoning Capacity in LLMs Beyond
  the Base Model?", NeurIPS 2025. https://arxiv.org/abs/2504.13837 — RLVR models win at pass@1, but
  **base models win at large k**. RL mostly *reweights* paths already in the base distribution and
  narrows the reasoning boundary. `OBSERVED` (debated; later work reports boundary expansion with
  longer training).
- **Shao et al.**, "Spurious Rewards: Rethinking Training Signals in RLVR", 2025.
  https://arxiv.org/abs/2506.10947 — Qwen2.5-Math-7B gains **+21.4 pp on MATH-500 with random
  rewards**, versus +29.1 with ground truth. Incorrect-label rewards give +24.1 and format rewards
  +13.8. The gain comes from eliciting a pre-existing "code reasoning" behaviour. These spurious
  rewards **do not transfer** to Llama3 or OLMo2. `OBSERVED`.
- **Primitive:** *Improvement attribution requires controls.* An improvement that follows a
  "learning" event may be caused by something else (format, elicitation, variance). **A placebo arm**
  (random or no-op update) is required before crediting the update. This is the strongest evidence
  in this pass that "performance went up after we learned X" is not evidence that X helped.

### 3.5 Executable verification and its limits
- **SWE-bench+:** Aleithan et al., 2024. https://arxiv.org/abs/2410.06992 — **32.67%** of
  "successful" SWE-bench patches involved solution leakage (the fix was in the issue text) and
  **31.08%** passed only because tests were weak. After filtering, SWE-Agent+GPT-4 dropped from
  12.47% to 3.97%. `OBSERVED`.
- **METR reward hacking (§2.5):** visible scoring functions are exploited 43× more often.
- **Primitive:** *A test suite is a verifier with a false-positive rate.* Verifier quality must be
  estimated (mutation testing, held-out tests, human audits of a sample) and stored with the
  verdict. Hidden tests the actor cannot see are much more robust than visible ones.

### 3.6 Evaluator-gated evolution and formal verification
- **AlphaEvolve** (Google DeepMind, 2025).
  https://deepmind.google/blog/alphaevolve-a-gemini-powered-coding-agent-for-designing-advanced-algorithms/
  — LLM-proposed code diffs are scored by **user-supplied automated evaluators**. A
  MAP-Elites/island program database keeps diversity. Results: improved 14 of 54 matrix
  multiplication targets (including rank-48 for 4×4 complex); matched state of the art on ~75% and
  improved on ~20% of 50+ open maths problems; a scheduling heuristic **recovering 0.7% of Google's
  fleet compute in production for over a year**; a 23% kernel speedup. `OBSERVED` (some maths
  results independently checked; production result is internal).
- **AlphaProof / AlphaGeometry** (DeepMind, 2024): IMO 2024 silver-medal level. Proofs in Lean are
  **machine-checked**, so the verification is exact. AlphaGeometry solved 25/30 olympiad geometry
  problems (Trinh et al., Nature 2024, https://www.nature.com/articles/s41586-023-06747-5). `REPLICATED`.
- **Primitive:** *When a domain admits an exact checker, self-improvement becomes search.* Most
  durable self-improvement successes (AlphaZero, AlphaProof, AlphaEvolve, DGM) have a cheap,
  trusted, non-gameable evaluator. **Inference:** For education, the analogous "checker" is a
  delayed, held-out assessment of the learner. It is noisy and slow but external, and education is
  a strong proving ground partly for that reason.

**Section 3 synthesis.** Verification is the dominant lever: verifiers are worth ~30× model scale
on GSM8K, and repeated sampling only pays when a checker exists. Verifier *quality* bounds what can
be learned. Rule-based outcome checks are the most robust gate. Learned process verifiers help
search but get hacked when optimised against.

---

## 4. Evaluation methodology

The question for UCI: when the system changes itself (a new playbook item, skill, policy, or
prompt), how does it know the change helped?

### 4.1 Controlled experiments (A/B) — the gold standard, and its base rates
- **Citation:** Kohavi, Tang, Xu, *Trustworthy Online Controlled Experiments*, Cambridge UP, 2020;
  Kohavi et al., "Controlled experiments on the web: survey and practical guide", DMKD 2009.
  https://doi.org/10.1007/s10618-008-0114-1
- **Mechanism:** Randomised assignment of units to control and treatment, a pre-declared overall
  evaluation criterion (OEC), power analysis, sample-ratio-mismatch checks, and guardrail metrics.
- **Result (base rates):** At Microsoft, about **one third of experiments improve** the target
  metric, one third are neutral, and one third *hurt*. In mature products (Bing, Google ads), success
  rates of **10–20%** are reported. "Twyman's law": surprising results are usually bugs *(recalled
  from the book)*.
- **Evidence strength:** High (decades of industrial practice).
- **Primitive:** *Prior for a proposed improvement ≈ mostly neutral or harmful.* A change must be
  **pre-registered with its expected effect and metric**, then tested. Without that, a learning
  system accumulates neutral-to-harmful changes (compare SkillsBench's 16/84 negative tasks).
- **Status:** `REPLICATED`.

### 4.2 Off-policy / counterfactual evaluation
- **Importance sampling (IS):** reweight logged outcomes by π_new(a|x)/π_log(a|x). This is unbiased
  if the logging propensities are known and π_log > 0 wherever π_new > 0 (*positivity/overlap*).
  Variance explodes when the policies differ. Per-decision IS (Precup, Sutton, Singh 2000, ICML)
  helps. In sequential settings, **variance grows exponentially with horizon** (the "curse of
  horizon"; Liu et al., NeurIPS 2018, https://arxiv.org/abs/1810.12429). `REPLICATED`.
- **Doubly robust (DR):** Dudík, Langford, Li, "Doubly Robust Policy Evaluation and Learning", ICML
  2011, https://arxiv.org/abs/1103.4601; Jiang & Li, ICML 2016, https://arxiv.org/abs/1511.03722;
  Thomas & Brunskill (WDR/MAGIC), ICML 2016, https://arxiv.org/abs/1604.00923. DR combines a
  learned outcome model with IS correction. It is consistent if *either* the propensities *or* the
  outcome model is correct, and usually has lower variance than IS. `REPLICATED`.
- **Replay method:** Li, Chu, Langford, Wang, "Unbiased Offline Evaluation of Contextual-bandit-based
  News Article Recommendation Algorithms", WSDM 2011, https://arxiv.org/abs/1003.5956. Replay
  logged events and keep only those where the new policy picks the *same* action as the log.
  Unbiased **only when the logging policy was uniformly random**. The effective sample shrinks to
  about T/K. On Yahoo! data, replay estimates matched online bucket tests. `REPLICATED`.
- **Industrial counterfactual reasoning:** Bottou et al., "Counterfactual Reasoning and Learning
  Systems: The Example of Computational Advertising", JMLR 2013,
  https://jmlr.org/papers/v14/bottou13a.html. Logged randomisation plus IS gives confidence
  intervals for counterfactual policies, valid only for **small policy perturbations** inside the
  logged support. `REPLICATED`.
- **Empirical benchmark of estimators:** Voloshin et al., "Empirical Study of Off-Policy Policy
  Evaluation for Reinforcement Learning", NeurIPS D&B 2021, https://arxiv.org/abs/1911.06854. **No
  estimator dominates.** Performance depends on horizon, policy mismatch, and model
  misspecification. `OBSERVED`.
- **Why replay is valid only until the policy diverges (evidence-based reasoning):**
  1. Logged outcomes exist only for actions actually taken. When the new policy picks an unlogged
     action, its outcome is **unobserved**. It can only be *imputed* by a model (a DM or DR
     component), and then the estimate is only as good as that model (a world model).
  2. In multi-step tasks, one divergent step changes every later *state*. The logged future no
     longer applies. Per-trajectory IS weights collapse to zero or explode.
  3. For LLM agents, the logging "propensity" of a free-text action is rarely available or
     meaningful. Deterministic-looking logs have **no overlap** with alternative actions, so strict
     IS is inapplicable.
  4. Non-stationarity (the learner or user changes because of the interaction; tools or APIs drift)
     breaks the i.i.d. assumption even without policy change.
- **Primitive:** *Log the decision context, the chosen action, the alternatives considered, and a
  propensity (or declared randomisation) at decision time.* Without recorded propensities or
  deliberate exploration, the logs support only **same-action replay** (regression tests), not
  counterfactual claims.

### 4.3 Deterministic replay in agent systems (what it can establish)
- **Inference, grounded in §4.2:** Replaying a recorded trajectory with a new context (e.g., a new
  playbook) **up to the first divergent action** is a valid regression check: "does the new policy
  still take the logged action where the logged action was verified good?" Past the first
  divergence, you must either (a) re-execute live (in a sandbox or simulator, a *world model* with
  its own fidelity error), or (b) call the outcome unknown. Replay can also *re-grade* old outcomes
  with a new verifier (re-verification), which is valid because evidence is kept raw.
- **Status:** `SPECULATIVE` as a UCI mechanism; the underlying statistics are `REPLICATED`.

### 4.4 Reliability, variance, error bars
- **Yao et al.**, "τ-bench: A Benchmark for Tool-Agent-User Interaction", 2024.
  https://arxiv.org/abs/2406.12045 — introduces **pass^k** (success on *all* k i.i.d. trials). For
  GPT-4o in retail, pass^1 ≈ 61% but pass^8 ≈ 25% *(recalled)*. Single-run success overstates
  reliability. `OBSERVED`.
- **Miller**, "Adding Error Bars to Evals: A Statistical Approach to Language Model Evaluations",
  2024. https://arxiv.org/abs/2411.00640 — clustered standard errors, **paired-difference tests**
  on the same items, and power analysis. Many reported model deltas are inside noise. `OBSERVED`.
- **Kapoor et al.**, "AI Agents That Matter", 2024. https://arxiv.org/abs/2407.01502 — simple
  baselines (retry, warming) match complex SOTA agents on HumanEval at lower cost. They call for
  **cost-accuracy Pareto** reporting, proper held-out sets (many agent benchmarks lack them), and
  reproducibility. `OBSERVED`.
- **Primitive:** *Paired, seed-replicated, cost-matched comparison with confidence intervals* is
  the minimum bar for "this change helped" (compare the §1.9 budget-matched finding).

### 4.5 Attribution (which memory item or skill caused the effect?)
- **Leave-one-out and ablation** are the ground-truth approach but cost O(n) runs.
- **ContextCite:** Cohen-Wang et al., "ContextCite: Attributing Model Generation to Context", NeurIPS
  2024. https://arxiv.org/abs/2409.00729 — random context ablations plus a sparse linear surrogate
  attribute an output to context sources, verified by ablation. `OBSERVED`.
- **Data Shapley:** Ghorbani & Zou, ICML 2019, https://arxiv.org/abs/1904.02868 · **influence
  functions:** Koh & Liang, ICML 2017, https://arxiv.org/abs/1703.04730; Grosse et al. (Anthropic),
  2023, https://arxiv.org/abs/2308.03296 — expensive, approximate at scale. `REPLICATED` (as methods).
- **Primitive:** *The context manifest is the attribution substrate.* Because UCI logs exactly
  which memory items were model-visible for each step (the constitution's "model-visible means
  logged"), the per-item effect can be estimated statistically across many steps. **Randomised
  inclusion** (occasionally withholding an item, as exploration) turns this into a causal
  estimate. This is the missing piece in ACE/ExpeL, whose helpful/harmful counters are
  model-assigned.

### 4.6 Held-out, contamination-resistant, longitudinal evaluation
- **Zhang et al.**, "A Careful Examination of LLM Performance on Grade School Arithmetic" (GSM1k),
  NeurIPS 2024 D&B. https://arxiv.org/abs/2405.00332 — some model families dropped up to ~13% on
  fresh GSM8K-style problems (evidence of overfitting); frontier models showed little drop
  *(recalled)*. `OBSERVED`.
- **LiveCodeBench** (Jain et al., 2024, https://arxiv.org/abs/2403.07974): problems time-stamped
  after model cutoffs; some models drop sharply on post-cutoff problems. `OBSERVED`.
- **Primitive:** *Time-sliced held-out evaluation.* Evaluate a learned change on tasks that arrived
  **after** the change was committed and that were never used to derive it. This is the only clean
  held-out set a lifelong system naturally has. It is also the longitudinal test: measure the same
  task class across months to detect drift, forgetting, and compounding.

**Section 4 synthesis.** Most proposed improvements are neutral or harmful (A/B base rates). The
methods that establish improvement are randomised comparison, paired seeds, cost matching, and
time-sliced held-out tasks. Off-policy estimators extend logs only within the support of logged
behaviour, and need propensities UCI does not currently record.

## 5. Calibration, abstention, metacognition, self-models

### 5.1 LLMs (mostly) know what they know — on single-token, in-distribution questions
- **Citation:** Kadavath et al. (Anthropic), "Language Models (Mostly) Know What They Know", 2022.
  https://arxiv.org/abs/2207.05221
- **Mechanism:** Token probabilities on multiple-choice/true-false questions; **P(True)**
  (self-evaluation of a proposed answer); **P(IK)** (a trained head predicting "I know the answer"
  before answering).
- **Result:** Large pretrained models are **well calibrated** on multiple-choice in the right
  format. P(True) improves when the model sees several of its own samples. P(IK) generalises
  *partially* across tasks and **degrades out of distribution**.
- **Related:** OpenAI GPT-4 Technical Report (2023, https://arxiv.org/abs/2303.08774): the
  pretrained model was well calibrated on MMLU, and **post-training (RLHF) reduced calibration**
  noticeably (ECE roughly 0.007 → 0.074) *(recalled)*.
- **Primitive:** *Calibration is a measured property of a (model, prompt format, task
  distribution) triple, not of a model.* It must be re-measured after any model swap or
  post-training.
- **Status:** `REPLICATED` (calibration on in-distribution MC); `CONTESTED` for open-ended and
  agentic outputs.

### 5.2 Verbalised confidence
- **Tian et al.**, "Just Ask for Calibration", EMNLP 2023. https://arxiv.org/abs/2305.14975 — for
  RLHF models, **verbalised** confidence is better calibrated than token probabilities (ECE reduced
  by roughly half relative) *(recalled)*. `OBSERVED`.
- **Xiong et al.**, "Can LLMs Express Their Uncertainty? An Empirical Evaluation of Confidence
  Elicitation in LLMs", ICLR 2024. https://arxiv.org/abs/2306.13063 — verbalised confidences are
  **overconfident**, clustered in 80–100% (imitating human speech). Failure-prediction AUROC is often
  only modestly above chance. Sampling-consistency plus aggregation helps. `OBSERVED`.
- **Kapoor et al.**, "Large Language Models Must Be Taught to Know What They Don't Know", NeurIPS
  2024. https://arxiv.org/abs/2406.08391 — prompting alone is insufficient. **Fine-tuning on ~1,000
  graded examples** gives good calibration that generalises across tasks, and one model can estimate
  another's uncertainty. `OBSERVED`.
- **Conflict:** Tian (verbalised is better) vs Xiong (verbalised is overconfident). Reconciliation:
  verbalised beats *RLHF token probabilities*, but both are poor in absolute terms without
  calibration training or empirical recalibration.
- **Primitive:** *Raw model confidence is an uncalibrated feature, never a probability.* It becomes a
  probability only after a **recalibration map fitted on resolved outcomes** (Platt/isotonic per
  task class).

### 5.3 Semantic uncertainty
- **Kuhn, Gal, Farquhar**, "Semantic Uncertainty", ICLR 2023. https://arxiv.org/abs/2302.09664 ·
  **Farquhar et al.**, "Detecting hallucinations in large language models using semantic entropy",
  *Nature* 630, 2024. https://www.nature.com/articles/s41586-024-07421-0
- **Mechanism:** Sample several answers, cluster them by bidirectional entailment, and compute the
  entropy over meaning clusters.
- **Result:** Beats naive entropy, P(True) and self-check baselines at predicting confabulations
  (AUROC averaged over five datasets). It holds on GPT-4 biographies. It costs 5–10× sampling;
  semantic entropy *probes* (https://arxiv.org/abs/2406.15927) approximate it from hidden states.
- **Limit:** It detects *inconsistency*, not *consistent error*. A model that is confidently and
  consistently wrong scores low entropy.
- **Status:** `REPLICATED`.

### 5.4 Selective prediction, abstention, conformal guarantees
- **Geifman & El-Yaniv**, "Selective Classification for Deep Neural Networks", NeurIPS 2017.
  https://arxiv.org/abs/1705.08500 — **risk–coverage** trade-off: pick a confidence threshold to
  guarantee a target error rate with high probability on the covered subset. `REPLICATED`.
- **Angelopoulos & Bates**, "A Gentle Introduction to Conformal Prediction", 2021.
  https://arxiv.org/abs/2107.07511 — distribution-free coverage guarantees under
  **exchangeability**, using a held-out calibration set. `REPLICATED`.
- **Ren et al.**, "Robots That Ask For Help: Uncertainty Alignment for LLM Planners" (KnowNo), CoRL
  2023. https://arxiv.org/abs/2307.01928 — conformal prediction over LLM plan options gives a
  statistical task-success guarantee (e.g., 80–85%). The robot **asks for help when the prediction
  set is not a singleton**, and needs less help than baselines. `OBSERVED`.
- **Mohri & Hashimoto**, "Language Models with Conformal Factuality Guarantees", ICML 2024.
  https://arxiv.org/abs/2402.10978 — drop sub-claims until a target factuality level is guaranteed.
  `OBSERVED`.
- **Limit:** guarantees break under distribution shift, which a lifelong system faces constantly.
  The calibration set must be **recent and task-class-specific**, and coverage must be monitored.
- **Primitive:** *Abstention/escalation policy = threshold on calibrated competence, set by a target
  risk.* This makes **silence and asking** first-class decisions (matching the UCI law "silence is
  an action").

### 5.5 Agents are systematically overconfident about their own success
- **Barkan, Black, Sourbut**, "Do Large Language Models Know What They Are Capable Of?", ICLR 2026.
  https://arxiv.org/abs/2512.24661 — **all models overconfident**, most better than random at
  discrimination, and newer/larger models are not better at it. Some reduce overconfidence after
  in-context failures, others do not. **Overconfidence worsens during multi-step agentic tasks.**
  Decisions are *approximately rational given the model's own (wrong) probabilities*, so the fault
  is in the self-model, not the decision rule. `OBSERVED`.
- **"Agentic Uncertainty Reveals Agentic Overconfidence"**, 2026. https://arxiv.org/abs/2602.06948 —
  agents succeeding **22%** of the time predict **77%**. Post-execution self-assessment predicted
  73% against a 35% base rate. **Pre-execution** estimates (less information) often *discriminate
  better* than post-execution review. Reframing review as "find bugs" cut overconfidence by up to
  15 pp. `OBSERVED`.
- **Related** (from search summary; not re-fetched): self-knowledge "does not transfer across
  domains, does not compose correctly, does not update from feedback" (arXiv 2604.19809,
  hierarchical metacognitive calibration benchmark). `CLAIMED`.
- **Primitive:** This is the empirical case for an **external self-model**. An agent's statement of
  its own competence cannot serve as the self-model. The self-model must be a *statistical record*
  built from harness-observed, verified outcomes per task class, with the agent's own estimate kept
  only as one feature (and a check on its calibration).

### 5.6 Human–AI calibration gap
- **Steyvers et al.**, "What large language models know and what people think they know", *Nature
  Machine Intelligence*, 2025. https://www.nature.com/articles/s42256-024-00976-7 — users
  overestimate LLM accuracy under default explanations. **Longer explanations raise user confidence
  without raising accuracy.** Aligning explanation style with model confidence narrows both the
  calibration gap and the discrimination gap. `OBSERVED`.
- **Primitive:** Surfaces must display *calibrated* confidence, not fluency. **Inference:** In
  education this matters doubly: a tutor's fluency inflates the learner's confidence in the tutor
  and possibly in their own understanding.

### 5.7 Introspection and metacognition in models
- **Binder et al.**, "Looking Inward: Language Models Can Learn About Themselves by Introspection",
  ICLR 2025. https://arxiv.org/abs/2410.13787 — a model fine-tuned to predict its own behaviour beats
  a *different* model trained on the same behaviour data (a privileged-access advantage), but only on
  simple tasks, and it fails on complex or out-of-distribution ones. `OBSERVED`.
- **Lindsey** (Anthropic), "Emergent Introspective Awareness in Large Language Models", 2025.
  https://transformer-circuits.pub/2025/introspection/index.html — with concept injection, the
  strongest models detected injected "thoughts" in roughly 20% of trials: **unreliable, narrow**
  introspection *(recalled)*. `OBSERVED`.
- **Human metacognition baseline:** Kruger & Dunning (1999) and the large literature on
  confidence–accuracy dissociation. Humans are also poorly calibrated *without feedback*.
  Calibration is **acquired** in feedback-rich domains: weather forecasters (Murphy & Winkler, 1977,
  *JRSS-C*), and Kahneman & Klein, "Conditions for intuitive expertise: a failure to disagree",
  *American Psychologist* 2009 (https://doi.org/10.1037/a0016755) — expertise needs a
  **high-validity environment plus timely feedback**. `REPLICATED`.
- **Primitive:** *Metacognition is built from outcome feedback, not introspection.* Models and
  humans both become calibrated only when their predictions are scored against outcomes.

### 5.8 How to build a calibrated self-model of competence per task class (synthesis of 5.1–5.7)
Evidence-backed construction:
1. **Define task classes** by observable features (domain, tools, length, demand profile per §8.3).
   *Evidence:* ADeLe shows demand profiles predict instance success better than black-box
   embeddings, especially out of distribution.
2. **Before execution**, record a *prediction*: P(success), expected cost/steps, and the expected
   verifier outcome. Record the model's own estimate *and* the self-model's statistical estimate.
   *Evidence:* pre-execution estimates discriminate as well as or better than post-hoc review
   (§5.5); forecasting only improves when predictions are recorded and scored (§6.5).
3. **Resolve** against a harness-observed, verifier-graded outcome (never self-report, §2).
4. **Score** with proper scoring rules (Brier, log-loss), plus reliability diagrams, ECE, and AUROC
   for discrimination, per task class and per model version.
5. **Recalibrate** (isotonic/Platt or Beta-binomial posterior per class). Use hierarchical pooling
   so sparse classes borrow strength (IRT-style, §8).
6. **Act** on calibrated competence: abstain, escalate, add verification, or allocate test-time
   compute (Snell: the optimal strategy depends on estimated difficulty).
7. **Re-validate on drift:** model swap, tool change, or new population means the calibration set
   is stale (conformal exchangeability breaks).
- **Status:** each step is supported by the cited evidence; the *combined* system is
  `SPECULATIVE`. No source found builds this end to end for an LLM agent.

---

## 6. World models and prediction error

### 6.1 Model-based RL: learned world models work when trained on prediction error
- **Ha & Schmidhuber**, "World Models", 2018. https://arxiv.org/abs/1803.10122 — a VAE+RNN world model
  with a policy trained "in the dream". `REPLICATED` (idea).
- **Hafner et al.**, "Mastering Diverse Domains through World Models" (DreamerV3), 2023; *Nature*
  2025. https://arxiv.org/abs/2301.04104 — one fixed hyperparameter set across 150+ tasks; the
  first agent to **collect diamonds in Minecraft from scratch** without human data. The world model
  is trained on reconstruction and reward/continuation prediction; the policy learns in imagination.
  `REPLICATED`.
- **Schrittwieser et al.**, "Mastering Atari, Go, Chess and Shogi by Planning with a Learned Model"
  (MuZero), *Nature* 2020. https://arxiv.org/abs/1911.08265 — the learned model predicts only
  **reward, value and policy** ("value-equivalent"), not observations, yet matches AlphaZero in Go
  and chess and sets the Atari state of the art. `REPLICATED`.
- **Primitive:** *A world model need only predict the decision-relevant quantities, and it is
  trained by comparing predictions to outcomes.* **Inference for UCI:** The "world model" does not
  need to simulate everything. It must predict what matters for decisions (success, cost, learner
  response, side effects), and every prediction must be scored.

### 6.2 LLMs as world models: useful priors, unreliable simulators
- **Hao et al.**, "Reasoning with Language Model is Planning with World Model" (RAP), EMNLP 2023.
  https://arxiv.org/abs/2305.14992 — an LLM as both world model and policy, with MCTS. On Blocksworld
  plan generation, LLaMA-33B+RAP beat GPT-4 chain-of-thought by ~33% relative *(recalled)*.
  `OBSERVED`.
- **Wang et al.**, "Can Language Models Serve as Text-Based World Simulators?", ACL 2024.
  https://arxiv.org/abs/2406.06485 — ByteSized32-State-Prediction (76,369 transitions). GPT-4 gets
  **59.9%** on non-trivial transitions. **Cumulative accuracy falls below 1% after ten steps.**
  Environment-driven transitions are ~30 points worse than action-driven ones. Errors concentrate in
  arithmetic, common sense and science. `OBSERVED`.
- **Vafa et al.**, "Evaluating the World Model Implicit in a Generative Model", NeurIPS 2024.
  https://arxiv.org/abs/2406.03689 — Myhill–Nerode-inspired metrics. Models that do well on
  next-token or route-validity diagnostics (e.g., NYC taxi routes) have **incoherent** implicit maps
  and are fragile to detours. `OBSERVED`.
- **Chae et al.**, "Web Agents with World Models: Learning and Leveraging Environment Dynamics in Web
  Navigation" (WMA), ICLR 2025. https://arxiv.org/abs/2410.13232 — LLMs (including GPT-4o) are
  poorly aware of the consequences of their web actions. A trained transition-focused world model
  used for one-step lookahead improves WebArena/Mind2Web policies without policy training
  *(recalled)*. `OBSERVED`.
- **Primitive:** *LLM-generated predictions are hypotheses with measured, compounding error.*
  Multi-step LLM simulation is not a trustworthy counterfactual evaluator (<1% after ten steps). It
  is usable for **one-step lookahead** and proposal generation, **not** as ground truth for replay
  beyond divergence (§4.3).

### 6.3 Prediction error as the learning signal (foundations)
- **Rescorla & Wagner** (1972): associative strength changes in proportion to **prediction error**
  (outcome − expectation), which explains blocking, where no surprise means no learning.
  `REPLICATED`.
- **Sutton**, "Learning to Predict by the Methods of Temporal Differences", *Machine Learning* 1988.
  https://doi.org/10.1007/BF00115009 — TD error δ = r + γV(s') − V(s) as the learning signal.
  `REPLICATED`.
- **Schultz, Dayan, Montague**, "A Neural Substrate of Prediction and Reward", *Science* 1997.
  https://doi.org/10.1126/science.275.5306.1593 — dopamine neurons encode **reward prediction
  error**: they fire on unexpected reward, shift to the predictive cue after learning, and dip on
  omitted expected reward. `REPLICATED`.
- **Friston**, "The free-energy principle: a unified brain theory?", *Nat Rev Neurosci* 2010 · **Clark**,
  "Whatever next? Predictive brains, situated agents, and the future of cognitive science", *BBS*
  2013. https://doi.org/10.1017/S0140525X12000477 — perception and learning as prediction-error
  minimisation. `CONTESTED` as a unified theory; the core predictive-coding findings are well
  supported.
- **Primitive:** *Learning is driven by the gap between an explicit expectation and an observed
  outcome.* Without the expectation there is nothing to compute the error against. This is the
  strongest, most replicated support in this pass for the **expectation → outcome → resolution**
  atom.

### 6.4 Surprise as a curiosity, segmentation and memory-admission signal
- **Pathak et al.**, "Curiosity-driven Exploration by Self-supervised Prediction" (ICM), ICML 2017,
  https://arxiv.org/abs/1705.05363 · **Burda et al.**, "Exploration by Random Network Distillation",
  ICLR 2019, https://arxiv.org/abs/1810.12894 — prediction error as intrinsic reward. RND was the
  first to beat average human on Montezuma's Revenge without demonstrations. **Noisy-TV failure:**
  unpredictable-but-irrelevant stimuli attract a raw prediction-error seeker, so surprise must be
  measured on *learnable, decision-relevant* predictions. `REPLICATED`.
- **Zacks et al.**, "Event perception: a mind–brain perspective", *Psych Bull* 2007 — event
  segmentation theory: **prediction-error spikes mark event boundaries** in human perception and
  memory. `REPLICATED`.
- **Fountas et al.**, "Human-like Episodic Memory for Infinite Context LLMs" (EM-LLM), ICLR 2025.
  https://arxiv.org/abs/2407.09450 — segments the LLM token stream into episodes at **Bayesian
  surprise** boundaries, refined by graph modularity. Beats InfLLM on long-context benchmarks, and
  boundaries correlate with human event segmentation *(recalled)*. `OBSERVED`.
- **Nemori** (Nan et al., 2025), https://arxiv.org/abs/2508.03341 — memory distillation keyed on
  **what the agent failed to predict** ("what is predictable is redundant"). `OBSERVED` (single
  study).
- **Primitive:** *Prediction error gates memory admission and episode boundaries.* This addresses
  the memory-bloat and error-propagation problems of §1.11 with a principled signal.

### 6.5 Recording explicit expectations and resolving them — is it a known powerful primitive?
Evidence from several fields converges:
- **Neuroscience and animal learning** (§6.3): learning is proportional to prediction error.
  `REPLICATED`.
- **RL:** TD learning, value functions and MuZero all train on predicted-vs-realised returns.
  `REPLICATED`.
- **Forecasting science:** Tetlock & Gardner, *Superforecasting* (2015); Mellers et al.,
  "Psychological Strategies for Winning a Geopolitical Forecasting Tournament", *Psychological
  Science* 2014 (https://doi.org/10.1177/0956797614524255). Forecasters who make **explicit,
  time-bounded probabilistic predictions scored by Brier** improve. Short probability training gave
  roughly 10% accuracy gains, and teaming and tracking helped further *(recalled)*. Vague forecasts
  that cannot be resolved cannot be improved. `REPLICATED`.
- **Science methodology:** Scheel, Schijen, Lakens, "An Excess of Positive Results: Comparing the
  Standard Psychology Literature With Registered Reports", *AMPPS* 2021
  (https://doi.org/10.1177/25152459211007467) — **96% positive results in standard papers vs 44% in
  Registered Reports**. Pre-declaring expectations before outcomes removes hindsight and
  flexibility bias. `REPLICATED`.
- **Industrial experimentation** (§4.1): the pre-declared OEC and hypothesis are core to trustworthy
  A/B tests. `REPLICATED`.
- **Expertise research** (§5.7, Kahneman & Klein): intuitive expertise forms only with timely,
  valid outcome feedback on judgments. `REPLICATED`.
- **LLM forecasting:** Halawi et al., "Approaching Human-Level Forecasting with Language Models",
  NeurIPS 2024 (https://arxiv.org/abs/2402.18563): Brier 0.179 vs crowd 0.149, and combining with the
  crowd helps. Karger et al., "ForecastBench", ICLR 2025 (https://arxiv.org/abs/2409.19839):
  superforecasters still beat the best LLMs *(recalled)*. `OBSERVED`.
- **In LLM agents specifically:** no production harness in the 7-system study records expectations.
  Among research systems, the closest are WMA/RAP (predict next state, used for planning, not
  scored over time), the agentic-uncertainty studies (§5.5, elicit P(success) *for measurement*),
  and Nemori (prediction failure gates memory). **No system found persists expectations as
  first-class records resolved against outcomes to drive calibration and learning over months.**
- **Verdict:** The *principle* is among the best-supported in the behavioural and learning
  sciences (`REPLICATED`). Its *application as the persistent atom of an LLM agent's learning and
  self-model* is **unexplored and testable** (`SPECULATIVE`, not contested).

### 6.6 Caveats on the expectation primitive (where it can fail)
- **Goodhart on predictions:** if the agent is rewarded for accuracy, it may predict low and
  under-deliver (sandbagging), or choose only easy tasks. Mitigation: score calibration and
  outcomes separately, and assign tasks independently of predictions. (*Inference* from §2.5.)
- **Noisy-TV (§6.4):** surprise on irrelevant variables creates junk. Expectations must be about
  declared decision-relevant quantities.
- **Resolution latency:** education outcomes (retention after weeks) resolve slowly. Expectations
  need explicit *resolution horizons* and must allow partial resolution.
- **Unresolvable expectations** are dead weight. Each must declare its resolver (verifier, test,
  future observation) at creation time.

## 7. Skill learning and transfer

### 7.1 Skills with explicit applicability conditions (classical foundations)
- **Fikes & Nilsson**, "STRIPS", *AI* 1971 — an operator is a precondition set, an add list, and a
  delete list. Applicability is explicit and checkable. `REPLICATED`.
- **Sutton, Precup, Singh**, "Between MDPs and semi-MDPs: A framework for temporal abstraction in
  reinforcement learning" (Options), *AI* 1999. https://doi.org/10.1016/S0004-3702(99)00052-1 — an
  option is ⟨**initiation set** I, policy π, **termination condition** β⟩: where the skill can be
  started, how it acts, and when it ends. `REPLICATED`.
- **Primitive:** *A skill = (applicability condition, procedure, termination/success condition,
  measured effect).* LLM skill libraries (Voyager, Anthropic Agent Skills, SkillsBench) keep only a
  natural-language description as the "initiation set". That is retrieval by similarity, which the
  UCI constitution forbids treating as identity. The applicability condition should be a checkable
  predicate where possible, plus an *empirical* applicability estimate (success rate by task class).

### 7.2 Programmatic, verified skill induction
- **Wang et al.**, "Inducing Programmatic Skills for Agentic Tasks" (ASI), COLM 2025.
  https://arxiv.org/abs/2504.06821 — skills are induced as **programs** and admitted only after three
  checks: necessity, usage, and **validity** (every skill-calling action must cause a valid
  environment change). WebArena **40.4%** vs 13.9% static baseline and 36.3% for AWM; 10.7–15.3%
  fewer steps. `CONTESTED`: the budget-matched study (§1.9) found vanilla actors match ASI at equal
  tokens.
- **Voyager** (§1.3): the executable skill plus verification gate is the most important component.
- **SkillFlow** (2026), https://arxiv.org/abs/2604.17308 — 166 tasks, 20 workflow families, 5
  domains. Lifelong skill evolution gives **selective, not universal** gains. Weaker stacks show a
  *creation–reuse coordination gap*, fragmented libraries, **reinforcement of erroneous logic**, and
  can write skills but not reliably repair them. `OBSERVED`.
- **SkillsBench** (§1.10): self-generated skills give zero average benefit; curated skills give
  +16.2 pp with 16/84 tasks negative. `OBSERVED`.
- **Synthesis:** Skill libraries help when (a) the skill is executable, (b) admission is gated by
  execution-level verification, (c) the task family truly shares structure, and (d) the base model
  is strong enough to reuse and repair skills. Otherwise they add tokens and noise.

### 7.3 Meta-learning
- **Finn, Abbeel, Levine**, "Model-Agnostic Meta-Learning" (MAML), ICML 2017.
  https://arxiv.org/abs/1703.03400 — learn an initialisation that adapts in a few gradient steps.
  Works when *train and test task distributions match*. `REPLICATED` (in distribution).
- **Brown et al.**, "Language Models are Few-Shot Learners", NeurIPS 2020 — in-context learning as
  meta-learning implicit in pretraining. `REPLICATED`.
- **Primitive:** For UCI, "meta-learning" means *learning which learning procedures work for which
  task class*. That is a second-order effect estimate over change records (see §10). **Inference.**

### 7.4 Negative transfer and forgetting
- **Rosenstein et al.**, "To Transfer or Not To Transfer", NIPS 2005 workshop · **Wang et al.**,
  "Characterizing and Avoiding Negative Transfer", CVPR 2019. https://arxiv.org/abs/1811.09751 —
  transfer hurts when source and target distributions diverge. Negative transfer is common and
  detectable only by comparison with a no-transfer baseline. `REPLICATED`.
- **McCloskey & Cohen** (1989) catastrophic interference; **Kirkpatrick et al.**, "Overcoming
  catastrophic forgetting in neural networks" (EWC), *PNAS* 2017. https://arxiv.org/abs/1612.00796
  `REPLICATED`.
- **Biderman et al.**, "LoRA Learns Less and Forgets Less", TMLR 2024.
  https://arxiv.org/abs/2405.09673 — a learning/forgetting trade-off in weight updates. `OBSERVED`.
- **Luo et al.**, "An Empirical Study of Catastrophic Forgetting in Large Language Models During
  Continual Fine-tuning", 2023. https://arxiv.org/abs/2308.08747 — forgetting of general knowledge
  during continual instruction tuning. `OBSERVED`.
- **Context-level analogues:** experience-following error propagation (§1.11), ACE context collapse
  (§1.6), and SkillsBench negative tasks (§1.10) are *negative transfer and forgetting in
  context-space*.
- **Primitive:** *Every learned artefact needs a regression suite on previously-mastered task
  classes* (retention check) as well as a gain check on the target class.

### 7.5 Transfer in humans (for the education proving ground)
- **Barnett & Ceci**, "When and where do we apply what we learn? A taxonomy for far transfer",
  *Psych Bull* 2002. https://doi.org/10.1037/0033-2909.128.4.612 — transfer varies along content
  and context dimensions; far transfer is rare. `REPLICATED`.
- **Sala & Gobet**, "Does Far Transfer Exist? Negative Evidence From Chess, Music, and Working Memory
  Training", *Current Directions in Psych Sci* 2017. https://doi.org/10.1177/0963721417712760 —
  meta-analyses find far-transfer effects near zero once placebo/active controls and publication
  bias are accounted for. `REPLICATED`.
- **Primitive (inference):** Transfer claims, for learners *and* for UCI's own skills, must be
  tested per target class with active controls. The default expectation is near transfer only.

---

## 8. Capability representation

How to represent "competence under conditions" so that a self-model (and a learner model) can
predict success on a new item.

### 8.1 Item Response Theory (IRT)
- **Foundations:** Rasch (1960); Lord, *Applications of Item Response Theory to Practical Testing
  Problems* (1980). P(correct | ability θ, item difficulty b, discrimination a) = σ(a(θ − b)).
  Ability and difficulty live on the same scale. Item parameters are estimated from response
  matrices. `REPLICATED`.
- **Polo et al.**, "tinyBenchmarks: evaluating LLMs with fewer examples", ICML 2024.
  https://arxiv.org/abs/2402.14992 — IRT-selected **100 items estimate full-benchmark accuracy within
  ~2%** (140× reduction on MMLU). `OBSERVED` (replicated by follow-ups).
- **Ruan, Maddison, Hashimoto**, "Observational Scaling Laws and the Predictability of Language
  Model Performance", NeurIPS 2024. https://arxiv.org/abs/2405.10938 — model capabilities across
  benchmarks lie in a **low-dimensional space** (a few principal components explain most variance)
  and predict emergent and agentic performance *(recalled)*. `OBSERVED`.
- **Primitive:** *Competence = latent ability on a scale shared with task difficulty.* A few latent
  dimensions suffice. Estimation from sparse outcomes is statistically well understood (Bayesian
  IRT, hierarchical pooling).

### 8.2 Time-horizon as a capability scale
- **Kwa et al.** (METR), "Measuring AI Ability to Complete Long Software Tasks", 2025.
  https://arxiv.org/abs/2503.14499 — fit a logistic curve of success against **human task duration**
  over 170 tasks with 800+ human baselines. The **50% time horizon** has been doubling roughly every
  7 months since 2019 (Claude 3.7 Sonnet ≈ 50 minutes). This is effectively IRT with difficulty =
  log(human time). Critiques: assumes duration is a sufficient difficulty statistic, and domain
  differences are large (METR's own follow-up on domains). `OBSERVED`.
- **Primitive:** *Difficulty proxies must be validated per domain.* One scalar is informative but
  lossy.

### 8.3 Demand profiles × ability profiles
- **Zhou et al.**, "General Scales Unlock AI Evaluation with Explanatory and Predictive Power"
  (ADeLe), *Nature* 652, 2026. https://arxiv.org/abs/2503.06378 — **18 rubric-defined demand scales**
  (e.g., reasoning types, knowledge domains, metacognition, atypicality) annotate each *instance*
  (automatically, by LLM). For each model, **ability profiles** are fitted as characteristic curves
  per scale. This gives instance-level success prediction that beats embedding and fine-tuned
  black-box predictors, *especially out of distribution* (new tasks, new benchmarks). Covers 15 LLMs
  and 63 tasks. `OBSERVED` (peer-reviewed in *Nature*).
- **Burnell et al.**, "Rethink reporting of evaluation results in AI", *Science* 2023.
  https://doi.org/10.1126/science.adf6369 — aggregate metrics hide competence structure. They call
  for **instance-level** results. `REPLICATED` (position with broad support).
- **Burnell, Hernández-Orallo et al.**, "measurement layouts" (2022–2023): a Bayesian network that
  infers latent capabilities from task demands and outcomes. `OBSERVED`.
- **Primitive:** *Task class = a demand vector, not a label.* The self-model is an ability profile
  over demand dimensions, fitted from resolved outcomes. This is directly how UCI can generalise
  competence estimates to *unseen* task classes, which a per-label table cannot do.

### 8.4 Education: knowledge tracing (learner competence under conditions)
- **Corbett & Anderson**, "Knowledge tracing: Modeling the acquisition of procedural knowledge"
  (BKT), *UMUAI* 1994. https://doi.org/10.1007/BF01099821 — per-skill hidden Markov model with learn,
  guess and slip parameters. `REPLICATED`.
- **Piech et al.**, "Deep Knowledge Tracing", NeurIPS 2015. https://arxiv.org/abs/1506.05908 — an RNN
  over interaction sequences reported large AUC gains over BKT (≈0.86 vs 0.67 on ASSISTments)
  *(recalled)*.
- **Khajah, Lindsey, Mozer**, "How deep is knowledge tracing?", EDM 2016.
  https://arxiv.org/abs/1604.02416 — BKT extended with forgetting, skill discovery and individual
  abilities **matches DKT**. Much of the gain came from data artefacts and missing features.
  `CONTESTED` (DKT's advantage).
- **Pelánek**, "Bayesian knowledge tracing, logistic models, and beyond: an overview of learner
  modeling techniques", *UMUAI* 2017 — IRT/logistic models (PFA, AFM) are competitive and
  interpretable. `REPLICATED`.
- **Primitive (inference):** The *same* latent-ability machinery serves the **learner model** and the
  **UCI self-model**. Both are "calibrated belief about competence on a demand vector, updated by
  resolved outcomes". This matches the constitution's line "mastery is a calibrated belief", and
  suggests one universal primitive with two subjects (person, system).

**Section 8 synthesis.** Competence is best represented as latent ability over a small number of
demand dimensions. It is fitted from instance-level resolved outcomes, predicts new-instance
success, and is re-estimated as evidence arrives. This is mature in psychometrics and educational
data mining, and newly validated for LLMs (ADeLe, tinyBenchmarks, METR). No agent harness maintains
such a profile of *itself*.

## 9. Reflection vs adaptation vs learning vs verified improvement

These four are routinely conflated in agent papers and product claims. Definitions below are
operational: each names what must be *observed* for the term to apply.

| Term | Operational definition | What is observed | Evidence it happens | Evidence it helps |
|---|---|---|---|---|
| **Reflection** | Producing a textual interpretation of an experience (critique, lesson, insight) | An artefact exists | Universal (Reflexion, ExpeL, Hermes review forks, ACE Reflector) | **None by itself.** Intrinsic self-critique is neutral or harmful (Huang 2023; SCoRe base −11.2%). Helps only when fed by an external signal (Kamoi 2024) |
| **Adaptation** | Behaviour changes because stored state changed (context, memory, policy, prompt, weights) | Behaviour differs from before the change on the same input | Common (DC, ACE, AWM, experience-following §1.11) | Direction unknown. Adaptation can be negative (16/84 SkillsBench tasks; error propagation; context collapse) |
| **Learning** | Adaptation that improves expected performance on a *target distribution*, including unseen instances | Performance on new instances of the class increases | Shown when gated by ground truth (STaR, ReST-EM, Voyager, DGM, AlphaEvolve) | Often vanishes under cost-matching, variance control or placebo (§1.9, §3.4 spurious rewards) |
| **Verified improvement** | Learning whose effect is demonstrated against a pre-declared expectation with a controlled comparison (baseline/placebo, paired seeds, cost-matched), on held-out time-sliced tasks, with retention on prior classes, and attributed to the specific change | A resolved, pre-registered effect estimate with CI, plus a retention check, plus lineage | **Rare in agent literature.** Closest: DGM/HGM (benchmark-gated, partially held-out), AlphaEvolve (production metric over a year), SkillsBench (three-arm) | By construction |

Evidence for the distinctions:
- **Reflection ≠ adaptation:** a reflection that is never retrieved changes nothing. ExpeL's
  ablations and ACE's "context collapse" show that *how* reflections enter context determines the
  effect.
- **Adaptation ≠ learning:** Xiong et al. (§1.11) show adaptation that propagates errors. SkillsBench
  shows adaptation (self-generated skills) with zero mean effect. Budget-matched baselines (§1.9)
  show much apparent learning was extra tokens.
- **Learning ≠ verified improvement:** Spurious Rewards (§3.4) shows improvement after a "learning"
  event with random reward, so *attribution* requires a placebo arm. HGM (§1.15) shows one-shot
  benchmark gains mispredict long-run value. Roesner & Kohno (§1.15) show verified-on-a-poisoned-set
  is not verified. "Beyond Perplexity" (§1.14) shows proxy metrics diverge from behaviour.

**Inference for UCI:** The status ladder for a learned artefact should mirror the constitution's
capability statuses: `proposed` (reflection) → `active` (adaptation, in trial) → `effective`
(learning shown on held-out) → `verified` (pre-declared, controlled, retained, attributed). Only
`verified` artefacts get default-on treatment. Everything else stays in randomised trial, with
exposure logged in the context manifest.

---

## 10. Synthesis

### 10.1 Evidence summary: what research establishes
1. **External signal is the engine.** Every durable self-improvement success has a trusted outcome
   checker: STaR/ReST (answers), Voyager (game state), DGM/HGM/SICA (tests), AlphaEvolve
   (evaluators), AlphaProof (Lean), Absolute Zero (executor). Model-judged gating fails replication
   (§1.9, §1.10). `REPLICATED`.
2. **Self-assessment is miscalibrated and overconfident**, and worse in multi-step agentic work
   (22% actual vs 77% predicted). Intrinsic self-correction flips more right answers to wrong than
   the reverse. `REPLICATED` across Huang, Kamoi, SCoRe, Barkan, Agentic Overconfidence.
3. **Verification quality bounds learning.** Verifiers are worth ~30× model scale on GSM8K.
   Imperfect verifiers cap resampling. Weak tests inflate SWE-bench by up to ~3×. `REPLICATED`.
4. **Any optimised proxy gets hacked**, including by agents that edit their own detectors
   (DGM), fake test logs (DGM), exploit visible scorers (METR 43×), or generalise hacking into
   sabotage (Anthropic 2025). `REPLICATED`.
5. **Most changes don't help.** A/B base rates are roughly ⅓ positive (10–20% in mature systems);
   SkillsBench has 19% of tasks negative with curated skills and a zero mean for self-generated
   skills. `REPLICATED`.
6. **Prediction error is the canonical learning signal**, in brains, RL and forecasting, and
   pre-declared expectations remove hindsight bias (96% vs 44% positive results). `REPLICATED`.
7. **Calibration is learnable from resolved outcomes** (Kapoor 2024 with ~1k graded examples;
   forecasters; weather). It is not reliably available by introspection (Lindsey ~20%; Binder: simple
   tasks only). `REPLICATED`.
8. **Competence is well represented as latent ability over demand dimensions** (IRT, ADeLe, METR
   horizons, knowledge tracing). `REPLICATED` in psychometrics; `OBSERVED` for LLMs.
9. **LLM world models are good priors and bad multi-step simulators** (59.9% one-step, <1% after ten
   steps; incoherent implicit maps). `OBSERVED`.

### 10.2 Minimum primitives for verified learning (inference from 10.1)

Each primitive is minimal and has an invariant a check can fail.

| # | Primitive | Content | Invariant | Grounding |
|---|---|---|---|---|
| P1 | **Expectation** | Before an action or change: predicted outcome distribution (P(success), cost, verifier result, learner response), the predictor (model + self-model version), resolution criterion, resolver id, resolution horizon | Written *before* the outcome exists (log order); names a resolver; immutable once written | Rescorla-Wagner/TD; preregistration; Tetlock; §5.5 pre-execution discrimination |
| P2 | **Observed outcome** | Harness-observed evidence (exit codes, test results, environment state, learner response), never the actor's report | Produced by the harness or a verifier outside the actor's authority envelope | §2.5 DGM fake logs; METR; Baker 2025 |
| P3 | **Verifier record** | Verifier identity, version, type (rule/executable/learned/human), measured FPR/FNR on an audit set, and whether it was visible to the actor | A verdict without a verifier id is invalid; the actor cannot write to the verifier | Stroebl; SWE-bench+; Zheng/Panickssery judge biases |
| P4 | **Resolution** | Links P1 ↔ P2 via P3: realised value, prediction error, proper-score contribution (Brier/log) | Exactly one resolution per expectation (or explicit `unresolvable`/`expired`); append-only | TD error; forecasting scoring |
| P5 | **Competence belief (self-model)** | Per demand-vector ability estimate with uncertainty, fitted only from P4s; the agent's verbalised confidence kept as a *feature* | Updated only by resolutions; carries calibration metrics (ECE, Brier, AUROC) per model version; reset or re-validated on model swap | §5.5, §5.8, §8 (IRT, ADeLe) |
| P6 | **Change record (learning candidate)** | A proposed modification (playbook item, skill, policy, prompt, weights) + provenance (source experiences) + *expected effect* (a P1 at the change level) + target task class + lineage parent | Cannot become default-on without a P7 verdict; reversible | ACE deltas; DGM archive; HGM lineage; Kohavi OEC |
| P7 | **Controlled trial / evaluation** | Randomised or paired exposure of the change vs baseline and a placebo/no-op arm, cost-matched, seed-replicated, on time-sliced held-out tasks, plus a retention suite on prior classes | Evaluator and eval set are outside the change's mutable surface; eval set has provenance and integrity; CI is reported | §1.9, §3.4, §4.1, §4.4, §4.6, §1.15 poisoning |
| P8 | **Exposure log (context manifest)** | Which artefacts were model-visible at each step, plus inclusion propensity (randomised withholding rate) | Every model-visible artefact is logged with its inclusion probability | ContextCite; IPS/DR need propensities; UCI "model-visible means logged" |
| P9 | **Retirement** | Demotion or deletion of artefacts whose measured effect is ≤0 or stale; revert of changes whose evidence is invalidated | Triggered by P7/P4 evidence or tainted provenance; logged, reversible | §1.11 selective deletion; Roesner & Kohno persistence |

**Irreducible core:** P1 + P2/P3 + P4 give calibration and a world/self model. Adding P6 + P7 + P8
gives verified learning. P9 keeps it from rotting. Nothing here requires a new model capability;
all of it is *state, provenance, authority and evaluation*, which the constitution names as
structure that model progress makes more valuable.

### 10.3 Is "expectation → outcome → resolution" well supported as the atom of learning and calibration?
- **As the atom of calibration: yes, strongly.** Calibration is *defined* over (prediction, outcome)
  pairs. Every calibration method in §5 (recalibration maps, conformal sets, selective prediction,
  proper scoring) consumes exactly this record. No alternative exists: introspection is unreliable
  (§5.7), and agents do not update from in-context feedback reliably (§5.5). `REPLICATED`.
- **As the atom of learning: well supported in principle** (prediction-error learning, §6.3;
  preregistration, §6.5). **Necessary but not sufficient:**
  - It gives the *error signal*. Converting error into a good change still needs a change generator
    (reflection, search, training) and a *controlled trial* (P7). Prediction error on single
    episodes is too noisy to accept a change (A/B base rates, variance §4.4).
  - Credit assignment across long horizons (HGM clades; delayed learner outcomes) needs expectations
    at *multiple levels*: step, task, change, and lineage.
- **Two-level structure (inference):** (a) **object-level** expectations ("this action will make
  the tests pass", "the learner will answer item X correctly next week") calibrate the self-model and
  world model. (b) **change-level** expectations ("adding playbook item K raises success on class C
  by ≥3 pp at ≤10% extra tokens") are pre-registered hypotheses resolved by P7. The same record type
  serves both.
- **Status of the atom as a UCI design:** `SPECULATIVE` but low-risk. It is well grounded, and
  not contradicted anywhere in this pass. No agent system was found that implements it as persistent
  state.

### 10.4 What replay and counterfactual re-evaluation can and cannot establish

**Can establish (valid):**
- **Re-verification:** re-grading stored raw outcomes with a new or better verifier. This is valid
  because evidence is kept raw, and it can *retroactively invalidate* past "successes" (SWE-bench+
  style).
- **Regression / same-action replay:** whether a new policy or context still produces the logged
  action at recorded decision points, up to the first divergence. This checks non-regression on
  verified-good behaviour.
- **Retrieval/compilation determinism:** whether the same substrate compiles to the same working
  state and context manifest (a restart/replay reality test).
- **Off-policy estimates within support:** if propensities were logged (P8 randomised inclusion,
  exploratory actions), then IPS/DR estimates of alternative *exposure policies* are valid for
  small perturbations (Bottou 2013; Dudík 2011).
- **Recalibration:** refitting the self-model on historical resolutions (valid while the
  task/model distribution is exchangeable).

**Cannot establish:**
- The outcome of any action **not taken** without a model. Past the first divergence, the logged
  future is invalid; multi-step LLM simulation decays to <1% accuracy in ten steps (§6.2).
- Effects under a **new model** (model swap changes both policy and calibration; §5.1 RLHF shifts
  calibration) or a **new population** (learner cohort) without fresh data.
- Anything where logging was deterministic with no exploration (no overlap → IPS undefined; replay
  estimator requires uniform logging, Li 2011).
- **Human-response counterfactuals** (how a learner *would have* responded to a different
  explanation). These need randomised live trials.
- Long-horizon effects (retention, compounding) from short logs.

### 10.5 What requires real-world revalidation
1. **After any model swap:** the self-model calibration map, the verifier FPR if the verifier is a
   model, and the effect size of every `verified` artefact (a playbook that helps model A may be
   neutral or harmful for model B; spurious-reward effects were model-specific, §3.4).
2. **After tool/environment drift:** skills with executable preconditions (their validity checks
   must re-run).
3. **Learner-facing changes:** any teaching strategy change needs live randomised or interleaved
   comparison with **delayed** outcomes (retention after days or weeks). Replay cannot give human
   counterfactuals, and far transfer is rare (§7.5).
4. **Verifier audits:** periodic human or independent audit samples to re-estimate FPR (weak tests,
   judge bias, and hacking evolve).
5. **Conformal/abstention thresholds:** recalibration sets must be recent, because exchangeability
   breaks under shift (§5.4).
6. **Lineage value:** a change's long-run value (HGM) is only observable over subsequent
   generations or months of use.

---

## 11. Open problems needing experiments

Each is phrased as a falsifiable experiment UCI could run. None is answered by the literature above.

1. **Does persisting expectations improve agent calibration over time?** Arms: (a) no
   expectations; (b) expectations recorded but not fed back; (c) expectations resolved into a
   statistical self-model used for abstain/escalate decisions. Metric: Brier/ECE/AUROC per task
   class over 4–8 weeks; decision regret. Prediction: (c) ≫ (b) ≈ (a), given agents don't learn
   from in-context feedback (§5.5).
2. **Does randomised artefact inclusion (P8) produce per-item effect estimates that agree with
   leave-one-out ablation?** Validate ContextCite-style attribution for *memory items across
   episodes*, not tokens within one context.
3. **Model-transfer of learned artefacts.** What fraction of `verified` playbook items or skills
   keep a positive effect after a model swap? (No source measures this; spurious rewards suggest
   strong model-specificity.)
4. **Generation-verification gap per task class.** Measure it for UCI's own task classes, and
   test whether self-improvement attempts succeed only where the gap is positive (Song et al.
   predict yes).
5. **Pre- vs post-execution self-assessment.** Replicate the finding that pre-execution estimates
   discriminate better, in UCI tasks. If it holds, move expectation capture before execution in the
   harness.
6. **Change-level pre-registration base rate.** What fraction of reflection-generated change
   candidates reach `verified`? (Industry prior ⅓ or lower. If UCI's rate is much higher, suspect
   evaluation leakage.)
7. **Prediction-error-gated memory admission vs verified-outcome-gated admission vs naive growth**,
   measured on error propagation (§1.11) and retrieval precision over months.
8. **Education-specific:** Does a calibrated learner model (IRT/BKT-style competence belief with
   expectations about the next response) beat an LLM-judged mastery estimate at predicting
   *delayed* retention? The DKT vs BKT history (§8.4) warns that simple, calibrated models may match
   complex ones.
9. **Hack-resistance of the separation:** red-team whether a process can influence its own
   evaluation when verifier, eval set and markers are outside its authority envelope (DGM and
   Roesner & Kohno failure modes as test cases).
10. **Lineage credit.** Does clade-level credit (HGM) outperform per-change credit for selecting
    playbook or skill changes in a *context-level* (non-code) self-improvement loop?
11. **Cost-matched baseline as a reality test:** make "beats a budget-matched vanilla actor on
    time-sliced held-out tasks" a required check for any learned capability claim, and measure how
    many claimed gains survive.

---

## 12. Source index

Status tags as used above. Numbers of the form (§x.y) point to the entry.

| Source | URL | Status | § |
|---|---|---|---|
| Shinn 2023 Reflexion | https://arxiv.org/abs/2303.11366 | CONTESTED | 1.1 |
| Zhao 2024 ExpeL | https://arxiv.org/abs/2308.10144 | OBSERVED | 1.2 |
| Wang 2023 Voyager | https://arxiv.org/abs/2305.16291 | OBSERVED | 1.3 |
| Wang 2024 AWM | https://arxiv.org/abs/2409.07429 | CONTESTED | 1.4 |
| Suzgun 2025 Dynamic Cheatsheet | https://arxiv.org/abs/2504.07952 | OBSERVED | 1.5 |
| Zhang 2025 ACE | https://arxiv.org/abs/2510.04618 | OBSERVED | 1.6 |
| Ouyang 2025 ReasoningBank | https://arxiv.org/abs/2509.25140 | CONTESTED | 1.7 |
| Zelikman 2022 STaR; Singh 2023 ReST-EM; Hosseini 2024 V-STaR | https://arxiv.org/abs/2203.14465 · https://arxiv.org/abs/2312.06585 · https://arxiv.org/abs/2402.06457 | REPLICATED | 1.8 |
| Hajimiri 2026 budget-constrained | https://arxiv.org/abs/2606.15017 | OBSERVED | 1.9 |
| SkillsBench 2026 | https://arxiv.org/abs/2602.12670 | OBSERVED | 1.10 |
| Xiong 2025 memory management | https://arxiv.org/abs/2505.16067 | OBSERVED | 1.11 |
| Zhang 2025 Darwin Gödel Machine | https://arxiv.org/abs/2505.22954 · https://sakana.ai/dgm/ | OBSERVED | 1.12 |
| Gao 2025; Fang 2025 surveys | https://arxiv.org/abs/2507.21046 · https://arxiv.org/abs/2508.07407 | SPECULATIVE | 1.13 |
| Song 2026 Beyond Perplexity | https://arxiv.org/abs/2607.00368 | OBSERVED | 1.14 |
| Robeyns 2025 SICA | https://arxiv.org/abs/2504.15228 | CLAIMED | 1.15 |
| Wang 2025 Huxley-Gödel Machine | https://arxiv.org/abs/2510.21614 | OBSERVED | 1.15 |
| Zhao 2025 Absolute Zero | https://arxiv.org/abs/2505.03335 | OBSERVED | 1.15 |
| Roesner & Kohno 2026 poisoned benchmarks | https://arxiv.org/abs/2609.17817 | OBSERVED | 1.15 |
| Huang 2024 cannot self-correct | https://arxiv.org/abs/2310.01798 | REPLICATED | 2.1 |
| Kamoi 2024 self-correction survey | https://arxiv.org/abs/2406.01297 | REPLICATED | 2.2 |
| Kumar 2025 SCoRe | https://arxiv.org/abs/2409.12917 | OBSERVED | 2.3 |
| Zheng 2023 LLM-as-judge | https://arxiv.org/abs/2306.05685 | REPLICATED | 2.4 |
| Panickssery 2024 self-preference | https://arxiv.org/abs/2404.13076 | OBSERVED | 2.4 |
| Wen 2025 RLHF misleads humans | https://arxiv.org/abs/2409.12822 | OBSERVED | 2.4 |
| Stroebl 2026 resampling limits | https://arxiv.org/abs/2411.17501 | OBSERVED | 2.4 |
| Krakovna 2020 spec gaming | https://deepmind.google/discover/blog/specification-gaming-the-flip-side-of-ai-ingenuity/ | REPLICATED | 2.5 |
| Skalse 2022 reward hacking | https://arxiv.org/abs/2209.13085 | REPLICATED | 2.5 |
| Gao 2023 RM overoptimization | https://arxiv.org/abs/2210.10760 | REPLICATED | 2.5 |
| Denison 2024 sycophancy→subterfuge | https://arxiv.org/abs/2406.10162 | OBSERVED | 2.5 |
| METR 2025 reward hacking | https://metr.org/blog/2025-06-05-recent-reward-hacking/ | OBSERVED | 2.5 |
| Baker 2025 CoT monitoring | https://arxiv.org/abs/2503.11926 | OBSERVED | 2.5 |
| MacDiarmid 2025 emergent misalignment | https://arxiv.org/abs/2511.18397 | OBSERVED | 2.5 |
| Cobbe 2021 verifiers | https://arxiv.org/abs/2110.14168 | REPLICATED | 3.1 |
| Uesato 2022 process vs outcome | https://arxiv.org/abs/2211.14275 | OBSERVED | 3.2 |
| Lightman 2023 Let's Verify | https://arxiv.org/abs/2305.20050 | REPLICATED | 3.2 |
| Wang 2024 Math-Shepherd | https://arxiv.org/abs/2312.08935 | OBSERVED | 3.2 |
| DeepSeek-R1 2025 | https://arxiv.org/abs/2501.12948 | OBSERVED | 3.2 |
| Zhang 2025 PRM lessons | https://arxiv.org/abs/2501.07301 | OBSERVED | 3.2 |
| Snell 2025 test-time compute | https://arxiv.org/abs/2408.03314 | OBSERVED | 3.3 |
| Brown 2024 Large Language Monkeys | https://arxiv.org/abs/2407.21787 | REPLICATED | 3.3 |
| Song 2025 Mind the Gap | https://arxiv.org/abs/2412.02674 | OBSERVED | 3.3 |
| Yue 2025 RLVR boundary | https://arxiv.org/abs/2504.13837 | OBSERVED | 3.4 |
| Shao 2025 Spurious Rewards | https://arxiv.org/abs/2506.10947 | OBSERVED | 3.4 |
| Aleithan 2024 SWE-bench+ | https://arxiv.org/abs/2410.06992 | OBSERVED | 3.5 |
| AlphaEvolve 2025 | https://deepmind.google/blog/alphaevolve-a-gemini-powered-coding-agent-for-designing-advanced-algorithms/ | OBSERVED | 3.6 |
| Trinh 2024 AlphaGeometry | https://www.nature.com/articles/s41586-023-06747-5 | REPLICATED | 3.6 |
| Kohavi 2009/2020 controlled experiments | https://doi.org/10.1007/s10618-008-0114-1 | REPLICATED | 4.1 |
| Dudík 2011 doubly robust | https://arxiv.org/abs/1103.4601 | REPLICATED | 4.2 |
| Jiang & Li 2016 DR for RL | https://arxiv.org/abs/1511.03722 | REPLICATED | 4.2 |
| Thomas & Brunskill 2016 MAGIC | https://arxiv.org/abs/1604.00923 | REPLICATED | 4.2 |
| Li 2011 replay evaluation | https://arxiv.org/abs/1003.5956 | REPLICATED | 4.2 |
| Bottou 2013 counterfactual reasoning | https://jmlr.org/papers/v14/bottou13a.html | REPLICATED | 4.2 |
| Liu 2018 curse of horizon | https://arxiv.org/abs/1810.12429 | REPLICATED | 4.2 |
| Voloshin 2021 OPE empirical study | https://arxiv.org/abs/1911.06854 | OBSERVED | 4.2 |
| Yao 2024 τ-bench pass^k | https://arxiv.org/abs/2406.12045 | OBSERVED | 4.4 |
| Miller 2024 error bars | https://arxiv.org/abs/2411.00640 | OBSERVED | 4.4 |
| Kapoor 2024 AI Agents That Matter | https://arxiv.org/abs/2407.01502 | OBSERVED | 4.4 |
| Cohen-Wang 2024 ContextCite | https://arxiv.org/abs/2409.00729 | OBSERVED | 4.5 |
| Ghorbani & Zou 2019; Koh & Liang 2017; Grosse 2023 | https://arxiv.org/abs/1904.02868 · https://arxiv.org/abs/1703.04730 · https://arxiv.org/abs/2308.03296 | REPLICATED | 4.5 |
| Zhang 2024 GSM1k | https://arxiv.org/abs/2405.00332 | OBSERVED | 4.6 |
| Jain 2024 LiveCodeBench | https://arxiv.org/abs/2403.07974 | OBSERVED | 4.6 |
| Kadavath 2022 know what they know | https://arxiv.org/abs/2207.05221 | REPLICATED | 5.1 |
| OpenAI 2023 GPT-4 report (calibration) | https://arxiv.org/abs/2303.08774 | OBSERVED | 5.1 |
| Tian 2023 Just Ask for Calibration | https://arxiv.org/abs/2305.14975 | OBSERVED | 5.2 |
| Xiong 2024 confidence elicitation | https://arxiv.org/abs/2306.13063 | OBSERVED | 5.2 |
| Kapoor 2024 taught to know | https://arxiv.org/abs/2406.08391 | OBSERVED | 5.2 |
| Kuhn 2023; Farquhar 2024 semantic entropy | https://arxiv.org/abs/2302.09664 · https://www.nature.com/articles/s41586-024-07421-0 | REPLICATED | 5.3 |
| Geifman 2017 selective classification | https://arxiv.org/abs/1705.08500 | REPLICATED | 5.4 |
| Angelopoulos & Bates 2021 conformal | https://arxiv.org/abs/2107.07511 | REPLICATED | 5.4 |
| Ren 2023 KnowNo | https://arxiv.org/abs/2307.01928 | OBSERVED | 5.4 |
| Mohri & Hashimoto 2024 conformal factuality | https://arxiv.org/abs/2402.10978 | OBSERVED | 5.4 |
| Barkan 2026 know what they're capable of | https://arxiv.org/abs/2512.24661 | OBSERVED | 5.5 |
| Agentic Overconfidence 2026 | https://arxiv.org/abs/2602.06948 | OBSERVED | 5.5 |
| Steyvers 2025 calibration gap | https://www.nature.com/articles/s42256-024-00976-7 | OBSERVED | 5.6 |
| Binder 2025 introspection | https://arxiv.org/abs/2410.13787 | OBSERVED | 5.7 |
| Lindsey 2025 introspective awareness | https://transformer-circuits.pub/2025/introspection/index.html | OBSERVED | 5.7 |
| Kahneman & Klein 2009 | https://doi.org/10.1037/a0016755 | REPLICATED | 5.7 |
| Ha & Schmidhuber 2018 World Models | https://arxiv.org/abs/1803.10122 | REPLICATED | 6.1 |
| Hafner 2023/2025 DreamerV3 | https://arxiv.org/abs/2301.04104 | REPLICATED | 6.1 |
| Schrittwieser 2020 MuZero | https://arxiv.org/abs/1911.08265 | REPLICATED | 6.1 |
| Hao 2023 RAP | https://arxiv.org/abs/2305.14992 | OBSERVED | 6.2 |
| Wang 2024 text world simulators | https://arxiv.org/abs/2406.06485 | OBSERVED | 6.2 |
| Vafa 2024 implicit world model | https://arxiv.org/abs/2406.03689 | OBSERVED | 6.2 |
| Chae 2025 WMA web agents | https://arxiv.org/abs/2410.13232 | OBSERVED | 6.2 |
| Sutton 1988 TD; Schultz 1997 RPE | https://doi.org/10.1007/BF00115009 · https://doi.org/10.1126/science.275.5306.1593 | REPLICATED | 6.3 |
| Clark 2013 predictive processing | https://doi.org/10.1017/S0140525X12000477 | CONTESTED (as unified theory) | 6.3 |
| Pathak 2017 ICM; Burda 2019 RND | https://arxiv.org/abs/1705.05363 · https://arxiv.org/abs/1810.12894 | REPLICATED | 6.4 |
| Fountas 2025 EM-LLM | https://arxiv.org/abs/2407.09450 | OBSERVED | 6.4 |
| Nemori 2025 | https://arxiv.org/abs/2508.03341 | OBSERVED | 6.4 |
| Mellers 2014 forecasting tournament | https://doi.org/10.1177/0956797614524255 | REPLICATED | 6.5 |
| Scheel 2021 registered reports | https://doi.org/10.1177/25152459211007467 | REPLICATED | 6.5 |
| Halawi 2024 LLM forecasting | https://arxiv.org/abs/2402.18563 | OBSERVED | 6.5 |
| Karger 2025 ForecastBench | https://arxiv.org/abs/2409.19839 | OBSERVED | 6.5 |
| Sutton, Precup, Singh 1999 options | https://doi.org/10.1016/S0004-3702(99)00052-1 | REPLICATED | 7.1 |
| Wang 2025 ASI | https://arxiv.org/abs/2504.06821 | CONTESTED | 7.2 |
| SkillFlow 2026 | https://arxiv.org/abs/2604.17308 | OBSERVED | 7.2 |
| Finn 2017 MAML | https://arxiv.org/abs/1703.03400 | REPLICATED | 7.3 |
| Wang 2019 negative transfer | https://arxiv.org/abs/1811.09751 | REPLICATED | 7.4 |
| Kirkpatrick 2017 EWC | https://arxiv.org/abs/1612.00796 | REPLICATED | 7.4 |
| Biderman 2024 LoRA forgets less | https://arxiv.org/abs/2405.09673 | OBSERVED | 7.4 |
| Luo 2023 LLM forgetting | https://arxiv.org/abs/2308.08747 | OBSERVED | 7.4 |
| Barnett & Ceci 2002 far transfer | https://doi.org/10.1037/0033-2909.128.4.612 | REPLICATED | 7.5 |
| Sala & Gobet 2017 far transfer | https://doi.org/10.1177/0963721417712760 | REPLICATED | 7.5 |
| Polo 2024 tinyBenchmarks | https://arxiv.org/abs/2402.14992 | OBSERVED | 8.1 |
| Ruan 2024 observational scaling | https://arxiv.org/abs/2405.10938 | OBSERVED | 8.1 |
| Kwa 2025 METR time horizon | https://arxiv.org/abs/2503.14499 | OBSERVED | 8.2 |
| Zhou 2026 ADeLe (Nature) | https://arxiv.org/abs/2503.06378 | OBSERVED | 8.3 |
| Burnell 2023 rethink reporting | https://doi.org/10.1126/science.adf6369 | REPLICATED | 8.3 |
| Corbett & Anderson 1994 BKT | https://doi.org/10.1007/BF01099821 | REPLICATED | 8.4 |
| Piech 2015 DKT | https://arxiv.org/abs/1506.05908 | CONTESTED | 8.4 |
| Khajah 2016 How deep is KT | https://arxiv.org/abs/1604.02416 | OBSERVED | 8.4 |

**Limitations of this pass.** Numbers marked *(recalled)* were not re-fetched and should be checked
before being cited in design documents. Several 2026 preprints (Hajimiri, SkillsBench, SkillFlow,
Agentic Overconfidence, Roesner & Kohno, Beyond Perplexity) are recent and not yet independently
replicated. Their direction is consistent with older replicated findings, which raises confidence
in the direction, not in the exact magnitudes.
