# 04 — Memory: Formation, Dynamics, and the Minimum Structure

> **Question.** Memory must be a dynamic cognitive system, not "better retrieval". What is the minimum structure that
> supports the maximum cognitive behaviour? How should experience become memory, and how should memories strengthen,
> decay, merge, split, contradict, and be reinterpreted?
>
> **Answer in brief** (grounded in `research/R1` and the archaeology):
>
> - **Store all evidence; interpret selectively.** The formation question never applies to evidence, only to derived
>   memory.
> - **Retrieval is a service, not memory.** Cognitive state begins where an invariant must hold independently of any
>   query:
>   - truth-maintenance status;
>   - epistemic status;
>   - validity in time;
>   - justifications that propagate change;
>   - commitment;
>   - **policy force**;
>   - outcome linkage.
> - **The unsolved failures in 2026 benchmarks all sit on the far side of that line.** Every intervention that worked
>   moved work from read time to **write and consolidation time, into typed state**.
> - **The minimum structure** is one versioned, provenance-bearing object model with a few kinds, governed by the three
>   correctness regimes. It is not a taxonomy of stores.

---

## 1. Evidence that reshapes the prior design

| Finding | Evidence (see `R1`) | Status | What it changes |
|---|---|---|---|
| Memory frameworks score under 10% at noticing a memory is no longer valid. Checking and labelling validity at write time lifts this from 8.7% to 68.0%. | STALE / CUPMem (2026) | OBSERVED (single group, large effect) | Truth-maintenance status is set at **write time**, not inferred at read time |
| No method exceeds 28% at resolving a changed fact through its dependents. Edits do not propagate. | MemoryAgentBench; RippleEdits | OBSERVED / REPLICATED direction | **Justification-based propagation** is required: truth maintenance, not similarity-scoped invalidation |
| Accuracy falls log-linearly toward zero as superseded values accumulate in the model's view, across 35 models. | PI-LLM (2025) | OBSERVED (large sweep) | **Supersession must be resolved before compilation.** The model cannot be trusted to ignore old values. |
| Long context is not memory: −30% on LongMemEval with the evidence already present. | LongMemEval; lost-in-the-middle | REPLICATED | The context is the working focus, not the store (confirms UCI A5) |
| Raw trajectories transfer negatively (−9.5%); abstracted insights transfer positively (+6.5 to +9%). Useful items get buried by dilution. | "When Continual Learning Moves to Memory" | OBSERVED | Keep raw and abstract, **linked**. Abstraction is where transfer lives. Dilution needs merge and priority. |
| Agents follow raw experience more faithfully and often ignore summaries. | Faithfulness study (13 backbones, 9 environments) | OBSERVED | Summaries cannot replace evidence. Measure whether memory *changed behaviour*. |
| Procedural memory has the only strong evidence of improving task outcomes (+24.6 / +51.1%, up to +34%). | AWM, ReasoningBank, Memento | REPLICATED direction | **Procedural memory with outcome utility** is the highest-value memory type |
| Under 10% of preferences are followed after 10 turns; 30–50% at using the user's latest situation. | PrefEval; PersonaMem | OBSERVED | The person model must **compile into always-applied policy**, not wait to be retrieved |
| 98.2% injection through queries alone; poisoning under 0.1% of memory yields over 80% attack success; LLM moderation fails in both directions. | MINJA; AgentPoison; 2026 re-test | OBSERVED | **Trust labels propagate** through derivation; untrusted-derived memory may inform, never instruct |
| Storage strength and current recall priority are distinct quantities; use-based power-law priority is well supported. | Bjork; ACT-R; Anderson & Schooler | REPLICATED | **Two strengths.** Decay lowers recall priority, never evidence. |
| A fast episode store and a slow generalizing store coexist. | Complementary Learning Systems | REPLICATED | Evidence is kept alongside derived beliefs, confirming the three-regime split |
| Reflection is evidenced only for believability, and its outputs are stored like observations. | Generative Agents ablation | OBSERVED (weak outcome) | Reflection = hypothesis generation (`07`) |

From the archaeology:
- HER keeps evidence through compaction and measures recall (`A-HER §19.4`).
- EVE's memory records are attributed and superseding, and recall is replay-checked (`A-EVE §13.4`).
- DSH has lexical retrieval with provenance walking (`A-DSH §13`).
- **No reference system governs formation or measures memory value.**

---

## 2. The minimum structure

**Prior UCI.**
- Six substrates grouped into three memories.
- A hundred-dimension facet vocabulary in 13 families.
- A lifecycle of typed mutations.

**Revision (STRONG HYPOTHESIS).** One object model, four kinds, three correctness regimes.

```
                        ONE OBJECT MODEL
   versioned · addressed · provenance-bearing (derivation + justifications) · labelled (consent, trust, audience)
   · bitemporal where temporal · governed by typed operations recorded with operator and authority
      │
      ├── EVIDENCE        observations, sources, sent bytes, tool outputs, trajectories,     ── faithful
      │                   decision records, attention manifests
      ├── INTENTIONAL /   goals, commitments, intentions, plans, open expectations,         ── consistent
      │   EXECUTIVE       open questions, processes, journals, inbox, budgets, authority
      ├── CLAIMS          assertions, expectations, resolutions, diagnoses, competence        ── calibrated
      │                   (with truth-maintenance status + justifications)
      └── PROCEDURES      skills / workflows / strategies with applicability and outcome     ── calibrated,
                          utility; policy-force items (standing defaults)                        gated strongest
```

**Why these four kinds, and no more.**
- *Evidence* and *claims* are separated by the CLS finding and the faithfulness finding.
- *Intentional/executive* state is separated by its correctness regime: commitments must never be approximately
  recalled (`02` §3.2).
- *Procedures* are separated because they change behaviour directly. They carry the strongest outcome evidence and
  the highest poisoning risk, so they need a lifecycle judged by outcomes rather than truth.

**What is deliberately not a kind** (following `R1` §11):
- summaries — they are derivations, i.e. claims or episodes with justifications;
- reflections — they are claims of standing *conjectured*;
- the hundred facets — they are **projections and indexes**, tags plus typed payload views, built when retrieval needs
  them;
- experiences — they are derived episodes linking evidence, decisions and resolutions (`06` §1).

**The facet vocabulary moves down a level.** It stays useful as an open, versioned vocabulary of lenses, and belongs in
implementation documentation, not in the vision. Facets are indexes, never stores.

---

## 3. Cognitive state begins where invariants begin

Stated precisely (`R1` §10, adopted as STRONG HYPOTHESIS). An item is **cognitive state**, rather than a record to be
retrieved, when it carries at least one of:

1. **Truth-maintenance status** — active / superseded / stale / unresolved / retracted — updated when *other* items
   change;
2. **Epistemic status and calibrated confidence**;
3. **Validity in time** (valid time and knowledge time);
4. **Justifications** along which change propagates;
5. **Commitment** — goals, plans, open questions, hypotheses under test;
6. **Policy force** — applies by default in a scope, without being retrieved (preferences, accommodations, standing
   constraints, adopted skills);
7. **Outcome linkage** — which actions or strategies led to which verified results.

A system of records plus a retriever is *a search engine over its own past*, not a continuing mind.

---

## 4. Formation: when experience becomes memory

**Level 1 — always, as evidence.** Everything is recorded faithfully with provenance and labels at the moment it
occurs. The only exceptions are sovereign: the person's "don't store", a consent scope, or a silence policy.

- Pre-filtering evidence is a mistake. Whatever the extractor does not extract is unrecoverable (the Zep regression
  from 94.6 to 80.4).

**Level 2 — selectively, as interpretation.** A logged formation operator promotes evidence into claims, procedures or
policy when at least one trigger holds:

| Trigger | Produces | Evidence |
|---|---|---|
| **Prediction error** — a resolution falsifies a confident expectation, or an observation is unpredicted | candidate claim / supersession / unresolved conflict | event segmentation; reconsolidation; EM-LLM |
| **Verified outcome** — an action's outcome was checked independently of the actor | procedure utility update; strategy induction | AWM, ReasoningBank (with real verification) |
| **Authority** — the person or an authorized source asserts it, or says "remember" | high-trust claim; policy-force item if it is a standing preference | — |
| **Corroboration** — the same pattern recurs across independent episodes | consolidation into semantic or procedural memory | CLS interleaving |
| **Expected need** — it bears on an active goal or a predictable future query | prioritized consolidation | working self; sleep-time compute |

**Write-time adjudication** (the STALE lesson). Each new derived item is checked against the claims it could affect,
*through justifications, not only similarity*. The outcome is one of:
- corroborates;
- supersedes;
- conflicts (unresolved);
- independent.

**Congruence rule.**
- Schema-congruent items strengthen existing claims.
- Highly surprising items become *candidates* awaiting corroboration or verification.
- Ambiguous items stay episodic only.

**Formation is itself evaluated.** A memory's value is resolved later: *was it retrieved, and did decisions citing it
resolve better than matched decisions without it?* That makes the formation policy learnable (Memory-R1 shows learned
write policies can help), under the governed ratchet (`07`).

This is the **memory-value reality test**.

---

## 5. Dynamics: the operations and their semantics

| Operation | Semantics | Invariant |
|---|---|---|
| **Strengthen** | Two separate quantities. *Confidence* rises with independent corroboration and verified successful use. *Retrieval priority* rises with **causal use**. Retrieval alone never raises confidence. | Retrieval is not evidence |
| **Decay** | Retrieval priority decays with disuse (power law, a domain-typed prior). Confidence decays only where the world plausibly changes; for example, learner mastery decays toward uncertainty. | Evidence never decays; decay is a belief about change, not a clock |
| **Merge** | Near-duplicate derived items become one, with the *union* of justifications and a corroboration count. The merged-from items remain addressable. | Never merge on similarity alone; identity is adjudicated |
| **Split** | One claim that conflates entities or contexts ("two people named Alex"; "a preference at work, not at home") becomes scoped claims, with justifications partitioned. | No reference system implements this; an open gap |
| **Contradict** | A typed event: **supersession** (the world changed; close valid time), **correction** (the system was wrong; close knowledge time, keep the error visible), or **unresolved** (keep both, lower confidence, surface for verification or ask). Resolution weighs trust, support, entrenchment and recency — **never recency alone**. | Change propagates along justifications to dependent claims **and to decisions that cited them** (`03` §7) |
| **Obsolete** | Standing moves to superseded or obsolete; excluded from compilation by default | Superseded items never reach the model undistinguished (PI-LLM) |
| **Reinterpret** | A better operator re-derives from kept evidence; new versions supersede, with the operator change as the reason | Valid by the replay law (`06` §3) |
| **Promote / demote** | Procedures: candidate → trial → trusted → deprecated → archived, by outcome resolutions. Claims: standing moves by evidence. | Promotion requires resolutions, not self-judgment |
| **Privatize** | Labels tighten; they propagate to derivations | Most-restrictive join |
| **Forget** | Delete evidence and cascade through justifications (re-derive without it, or delete), leaving a tombstone that records that a forget happened | Complete across derivations; impossible for knowledge absorbed into weights, which is an argument for keeping personal learning in the substrate |
| **Reconstruct** | Assemble an account from evidence and interpretations, marking gaps as gaps | No confabulation (Lifelong §19) |

---

## 6. The person model as policy, not retrieval

**The finding.** Personalization fails at *application*, not recall. PrefEval: under 10% of preferences followed after
10 turns. PersonaMem: 30–50% at using the latest situation.

**Revision (STRONG HYPOTHESIS).**
- Standing preferences, accommodations and constraints compile into **policy-force items** in the working state for
  their scope. They are applied by default and are visible in the attention manifest as *pinned policy*, not as
  retrieved items.
- The rest of the person model stays claims, retrieved on relevance.
- In education, a learner's accommodations and preferred representations are policy force. Their mastery estimates are
  claims.

---

## 7. Procedural memory: the highest-value, highest-risk kind

- **Best outcome evidence** (`R1` §3.10). Abstraction level matters: raw procedures transfer wrong steps; workflows and
  insights transfer.
- **Highest risk.** Composed benign experiences can bypass safety (EvoBreak). Poisoning targets whatever changes
  behaviour.
- **Gate.** Promotion requires verified outcomes plus provenance plus ablation, and composition checks against known
  unsafe combinations.

The HER guard doctrine ("know what not to learn") becomes a formation filter (`07` §5).

---

## 8. Consolidation

A budgeted, persistence-isolated background process (PA-13). It:
- merges duplicates;
- abstracts episodes into claims and procedures;
- re-derives stale items;
- resolves pending adjudications.

It is **prioritized by expected belief or policy change × future need**, an agent analogue of prioritized replay
(Mattar & Daw), and evaluated by recall *and* decision quality. Sleep-time compute (Letta) is the production
precedent: roughly 5× less test-time compute with accuracy gains when queries are predictable.

**Drift hazard** (`R1` §13.11). Repeated re-consolidation may drift narratives toward schema, the Bartlett effect.
Summaries are derivations and can be checked against evidence, so drift is measurable.

---

## 9. Retrieval as a service

Retrieval is required and well engineered in the literature: hybrid lexical + dense + graph + temporal filters, plus
reranking. UCI adopts it and does not reinvent it. Four UCI requirements sit on top:

1. **Epistemic filters before ranking**: superseded and stale items are excluded or marked.
2. **Reasons recorded** in the manifest (`05`).
3. **Causal-use logging** feeds retrieval priority.
4. **Goals as part of the cue**: active goals gate retrieval (Conway's working self).

**Plain dense retrieval is a strong baseline.** Structure-heavy GraphRAG and RAPTOR underperform it on factual QA
(HippoRAG 2). The error is calling retrieval memory, not using it.

---

## 10. Experiments

These are drawn from `R1` §13 and merged with the corpus:

| ID | Experiment | Graduation | Status |
|---|---|---|---|
| E-MF1 | Write-time adjudication with justification propagation vs similarity-scoped invalidation (a replication of STALE, extended to dependents) | Accuracy on dependent updates ≫ 28%; bounded cost per write | OPEN |
| E-MF2 | Calibration of stored beliefs (learner mastery) over weeks: Brier / ECE | Confidence predicts outcome frequency | OPEN |
| E-MF3 | Causal-use ablation: does a retrieved memory change behaviour, and for the better? | Memory-value test passes | OPEN |
| E-MF4 | Procedural memory abstraction level: raw vs insight vs workflow, measuring forward, backward and negative transfer | Identify the level with positive transfer and no hard-case harm | OPEN |
| E-MF5 | Consolidation scheduling: uniform vs recency vs (expected change × need) | Best downstream accuracy per unit compute | OPEN |
| E-MF6 | Store-all/derive-selectively vs extract-at-write: later-need recall over months, plus cost | Evidence-first dominates on recall at acceptable cost | OPEN |
| E-MF7 | Poisoning resistance of trust-label propagation + outcome-gated procedural promotion | Attack success well below published baselines | OPEN |
| E-MF8 | Complete forgetting across merged derivations, embeddings and caches | Forget test passes, including after consolidation | OPEN |
| E-MF9 | Policy-force person model vs retrieved preferences (PrefEval-style, inside UCI) | Preference application ≫ 10% after many turns | OPEN |
| E-MF10 | Narrative drift under repeated consolidation | Drift measurable and bounded by evidence checks | OPEN |
