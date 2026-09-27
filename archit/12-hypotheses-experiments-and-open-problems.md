# 12 — Hypotheses, Experiments, and Open Problems

> **The register.** Every architectural hypothesis in this corpus appears here once, with:
> - the experiment that tests it;
> - the invariant it measures;
> - the criterion that would graduate it;
> - its status.
>
> **No hypothesis becomes architectural law without passing its experiment** (README, status discipline).
>
> **Status key.** OBSERVED · REPLICATED · STRONG HYPOTHESIS (SH) · OPEN HYPOTHESIS (OH) · EXPERIMENTAL · ADOPTED ·
> REJECTED · SUPERSEDED · UNKNOWN.

---

## 1. Hypothesis register

### 1.1 The execution → cognition bridge (`01`, `02`)

| ID | Hypothesis | Experiment | Measured invariant | Graduation | Status |
|---|---|---|---|---|---|
| H-EC1 | The four bridge records (claim, decision, manifest, adaptation), layered on the execution floor, suffice for cognitive resume where transcript replay and memory services fail | E-EC1: cognitive-resume comparison across 3 architectures × 2 environments | C-R1…C-R8 pass rate vs an uninterrupted control | Bridge architecture beats both alternatives on C-R1–C-R8 at acceptable cost | SH |
| H-EC2 | Consequential decisions can declare *resolvable* expectations at acceptable cost | E-EP4: expectation granularity vs outcome and cost | Net value of expectations per decision level | A granularity with positive net value exists | OH |
| H-EC3 | Expectations captured **before** execution discriminate success better than post-hoc self-assessment | Replicate `R2` §11.5 in UCI tasks | AUROC of pre- vs post-execution estimates | Pre-execution AUROC ≥ post-hoc | SH (external evidence) |
| H-PCS1 | The minimal authoritative cognitive set (intentional, deliberative, epistemic, executive) is necessary; everything else is derivable | E-PCS1: ablate each component; rerun the resume battery | C-R drop per ablated component | Ablations that hurt are confirmed; the rest are demoted | OH |
| H-PCS2 | Working state as a *projection* matches an authoritative working-state object at acceptable resume cost | E-PCS2 | Divergence rate; resume latency | Parity in correctness, bounded cost | SH |
| H-PCS3 | Staleness re-validation on resume prevents decisions on lapsed claims | E-PCS3 | Share of decisions relying on lapsed claims | Near zero, at bounded cost | SH |
| H-PCS4 | The same working state is resumed consistently by different model providers | E-PCS4 | C-R7 consistency across providers | Within tolerance of same-model resume | OH |
| H-CT1 | Staging consequential cognitive changes until verification (cognitive transactions) prevents downstream errors that post-hoc revision does not, at acceptable latency | E-CT1: mastery and skill promotion staged vs committed-then-revised, in education | Decisions taken on later-revised state; learner-facing errors; commit latency | Staging measurably reduces downstream errors at bounded latency | SH (no reference evidence) |
| H-LC1 | Beliefs about a person or project stay consistent with evidence over months: superseded beliefs stay superseded and nothing known is silently lost | E-LC1: longitudinal probe battery over a multi-month simulated and a real learner history | Stale-belief surfacing rate; lost-knowledge rate; consistency with evidence | Rates within tolerance and not rising with time | OH |

### 1.2 The epistemic substrate (`03`)

| ID | Hypothesis | Experiment | Measured invariant | Graduation | Status |
|---|---|---|---|---|---|
| H-EP1 | One unified claim object beats separate stores for beliefs, predictions, verification and competence | E-EP5 | Inconsistency incidents; duplication; query complexity | Fewer inconsistencies at equal performance | SH |
| H-EP2 | An empirical self-model built from resolutions beats model-verbalized confidence for routing and abstention | E-EP2 | Self-calibration error (ECE/Brier); routed outcome | Empirical self-model better | SH (`R2`: introspection ≈20%; overconfidence 22% vs 77%) |
| H-EP3 | Revision that propagates to *decisions* (not only beliefs) prevents acting on revised premises | E-EP3 | Decisions still citing superseded claims | Near zero with propagation | SH |
| H-EP4 | IRT/BKT-style latent ability over demand dimensions serves both the self-model and the learner model, and beats LLM-judged mastery on delayed retention | E-EP6 (from `R2` §11.8) | Prediction of delayed retention; calibration | Beats LLM-judged mastery | SH |
| H-EP5 | Declaring and resolving expectations improves world-model calibration over time | E-EP1 (from `R2` §11.1): no expectations / recorded only / resolved into a self-model | Brier/ECE/AUROC per task class over 4–8 weeks | The resolved arm ≫ the others | SH |

### 1.3 Memory (`04`)

| ID | Hypothesis | Experiment | Measured invariant | Graduation | Status |
|---|---|---|---|---|---|
| H-MF1 | Write-time adjudication with justification propagation fixes dependent-update failures (the MemoryAgentBench ceiling is ≤28%) | E-MF1 | Accuracy on dependent updates; cost per write | ≫ 28% at bounded cost | SH (STALE: 8.7% → 68%) |
| H-MF2 | A person model compiled into always-applied policy beats retrieved preferences | E-MF9 | Preference application after many turns | ≫ 10% (PrefEval baseline) | SH |
| H-MF3 | Procedural memory at workflow/insight level transfers positively; the raw level transfers negatively | E-MF4 | Forward, backward and negative transfer | Positive transfer, with no hard-case harm | SH (`R1`: −9.5% raw vs +6.5–9% abstract) |
| H-MF4 | Confidence and retrieval priority must be separate quantities | E-MF3 + E-MF5 | Retrieval precision; decision quality with one vs two strengths | Two strengths better | SH (Bjork; ACT-R) |
| H-MF5 | Store-all-evidence, derive-selectively dominates extract-at-write on later-need recall | E-MF6 | Recall of later needs over months; storage cost | Dominates at acceptable cost | SH |
| H-MF6 | Memory value is measurable: memories cited by decisions improve resolutions against matched controls | E-MF3 (memory-value test) | Resolution delta for citing vs matched non-citing decisions | Measurable, positive for retained memories | OH |
| H-MF7 | Trust-label propagation + outcome-gated procedural promotion resists memory poisoning | E-MF7 | Attack success rate | Well below published baselines | OH |

### 1.4 Context and attention (`05`)

| ID | Hypothesis | Experiment | Measured invariant | Graduation | Status |
|---|---|---|---|---|---|
| H-CA1 | Manifests make every consequential decision's context reconstructable, and recorded reasons are causally predictive | E-CA1 (context-causality test) | Reconstruction completeness; perturbation effect by reason rank | 100% reconstruction; reasons predictive | SH |
| H-CA2 | A manifest variant exists with acceptable cost that still localizes selection faults | E-CA2 | Storage and latency vs fault localization | Such a variant exists | OH |
| H-CA3 | Stable-first compiled context stays within an acceptable cost band vs an append-only transcript | E-CA3 | Cache-read ratio; cost; task outcome | Within band at equal or better quality | SH |
| H-CA4 | Pinning deontic content (constraints, authority, commitments) outside the compactable tail eliminates the constraint loss seen under summarization (17%; 53% → 10% over 5 rounds) | E-CA6 (compaction test with typed probes) | Constraint recall after ≥5 rounds | ~100% constraint recall | SH |
| H-CA5 | Attention policy can be learned from manifests + propensities + resolutions | E-CA5 | Attributed improvement under held-out evaluation | Improvement survives a placebo arm | EXPERIMENTAL |

### 1.5 Replay and simulation (`06`)

| ID | Hypothesis | Experiment | Measured invariant | Graduation | Status |
|---|---|---|---|---|---|
| H-RS1 | Divergence-bounded re-think agrees with live evaluation up to the divergence point | E-RS2 | Pre-divergence agreement | Within tolerance | SH (off-policy theory) |
| H-RS2 | Retroactive re-derivation with better operators improves memory with no evidence loss | E-RS1 | Claim quality vs ground truth; supersession integrity | Improvement, with zero loss | SH |
| H-RS3 | A divergence catalog cheaply triages which changes need live evaluation | E-RS3 | Triage precision | High precision on rejection | OH |
| H-RS4 | Rehearsal fidelity can be calibrated per environment | E-RS4 | Calibration of fidelity claims | Calibrated | OH |

### 1.6 Learning, verification, capability (`07`)

| ID | Hypothesis | Experiment | Measured invariant | Graduation | Status |
|---|---|---|---|---|---|
| H-LV1 | Controlled-trial-gated adaptation (placebo, cost-matched, held-out) beats reflection-only adaptation longitudinally, with less pollution | E-LV1, E-LV2 | Outcome slope; pollution; share of predictions that hold | Gated adaptation wins | SH (`R2`: budget-matched baselines erase ungated gains) |
| H-LV2 | Every environment, including education, can declare harness-observed outcome signals resistant to gaming | E-LV3 | Agreement with expert judgment; hack red-team | High agreement; resists gaming | OH (the crux for education) |
| H-LV3 | Competence-gated autonomy improves outcome/cost with fewer unnecessary interruptions | E-LV4 | Outcome; cost; interruptions | Better on all three | SH |
| H-LV4 | A first-class capability graph adds value over composition manifests | E-LV5 | Routing success; impact-analysis accuracy | Keep only if it measurably helps | OH (PD-01) |
| H-LV5 | Base rate: a minority of reflection-generated changes reach `verified` (industry prior ≤⅓); a much higher rate signals evaluation leakage | Change-level pre-registration audit (`R2` §11.6) | Share of changes reaching `verified` | Rate within plausible band | SH |
| H-LV6 | Verified artefacts retain their effect after a model swap only in a measurable fraction of cases | Model-transfer study (`R2` §11.3) | Retained effect share | Measured and acted on | OPEN |

### 1.7 Ingestion (`08`)

| ID | Hypothesis | Experiment | Measured invariant | Graduation | Status |
|---|---|---|---|---|---|
| H-IG1 | Operator-quality-weighted extraction confidence improves calibration of source-reported claims | E-IG2 | Calibration | Better than constant | SH |
| H-IG2 | Hybrid text + page-image retrieval with learned routing beats either alone on education corpora | E-IG3 | nDCG and downstream teaching quality | Hybrid wins | SH (`R3` ViDoRe V3) |
| H-IG3 | Anchor-resolvable citations can be made faithful well beyond the ~74.5% baseline | E-IG6 | Faithful-citation rate | Well above baseline | OH |
| H-IG4 | Reversible entity resolution keeps merge errors bounded over months | E-IG5 | Error rate; repair cost | Bounded; fully reversible | OH |

### 1.8 Runtime, authority, economics (`09`)

| ID | Hypothesis | Experiment | Measured invariant | Graduation | Status |
|---|---|---|---|---|---|
| H-RT1 | Combined effect disclosure + receipts, classified by effect type, beats either strategy alone | E-RA1 | Wrong final states; repeated effects; reconciliation cost | Fewest errors at bounded cost | OH |
| H-RT2 | Epoch checkpoints are sufficient for continuation | E-RA2 | Held-out continuation quality | Equivalent to the full journal | OH |
| H-RT3 | Supervision signals computed from the record beat self-report | E-RA3 | Failure detection precision/recall; false escalations | Better at acceptable escalation | SH (MAST) |
| H-RT4 | Capability attenuation + cascading revocation contain delegated authority, including in open-ended tutoring from uploaded documents | E-RA4 | Containment under red-team; utility cost | Containment holds; cost measured | OH (open-end untested) |
| H-RT5 | Difficulty-adaptive allocation with a verifier-gated cascade lowers cost per verified outcome | E-RA5 | Cost per verified outcome | Lower at non-inferior success | SH (`R4`: ≥4×; 2×–98%) |
| H-RT6 | Whether multi-agent helps is task-class dependent at equal budget | E-RA6 | Verified outcome at equal token budget | Per-class decision rule | OH (CONTESTED) |

---

## 2. First experimental program

The experiments are ordered by dependency and by leverage. Each experiment needs the substrate pieces of the ones
before it.

1. **Floor + records.**
   - *Needs:* the execution floor (E1–E7) plus the four bridge records, in the education environment.
   - *Runs:* the **cognitive-resume battery** (E-EC1 / E-PCS1).
   - *Tests:* H-EC1, H-PCS1, H-PCS2. This is the central bet.
2. **Expectations and calibration in education.**
   - *Runs:* E-EP1 / E-EP6.
   - *Tests:* H-EP5, H-EP4, H-EC2, H-EC3.
   - *Why second:* the learner model as a calibrated IRT/BKT belief is the most direct payoff, and education supplies the
     ground truth.
3. **Manifests.**
   - *Runs:* E-CA1, E-CA2, E-CA6.
   - *Tests:* H-CA1, H-CA2, H-CA4.
4. **Write-time adjudication.**
   - *Runs:* E-MF1, E-MF9.
   - *Tests:* H-MF1, H-MF2, including policy-force learner accommodations.
5. **Close the learning loop with controlled trials.**
   - *Runs:* E-LV1 / E-LV2, with E-RS2 as the pre-live gate.
   - *Tests:* H-LV1, H-RS1, H-LV5.
6. **Economics.**
   - *Runs:* E-RA5, once metering and outcome linkage exist from steps 1–2.

**The program's reality tests:**
- cognitive resume;
- context causality;
- compaction (deepened);
- memory value;
- learning;
- capability formation;
- self-model calibration;
- world-model calibration;
- replay validity;
- longitudinal coherence (H-LC1);
- cognitive economy;
- commit, as a strong hypothesis (H-CT1).

These are defined in `02`, `05`, `06` and `07`, and are listed in UCI §34.

---

## 3. Open research problems

These problems are not yet reducible to a single experiment. They are drawn from the archaeology and from R1–R4.

1. **A behavioural-equivalence notion for "the same process" after a model swap.** Identical records are trivial.
   Equivalent *future behaviour* is undefined (`R4` §12.1). The resume battery is a proposal, not a theory.
2. **Harness-observed outcomes where the outcome is a change in a person** (learning, understanding) without surveillance
   or gaming (`07` E-LV3; PD-06).
3. **Credit assignment across long horizons and delayed outcomes**, such as retention after weeks. This needs
   multi-level expectations (step, task, change, lineage) (`R2` §10.3).
4. **Split operations** for claims that conflate entities or contexts. No system implements them (`R1` §14).
5. **Unknown-effect reconciliation against external systems with no idempotency or query API** (`R4` §12.4).
6. **Structural injection defence when the plan depends on untrusted content**: research, browsing, tutoring from
   uploaded material (`R4` §12.5).
7. **Region-level grounding for visual evidence.** F1 is ≈ 0.09 against a human 0.60 (`R3` §7.5).
8. **Cache stability vs relevance-optimal ordering.** The trade-off is unquantified (`R3` §7.5.4).
9. **Non-myopic value of computation for long horizons**, without Goodharting the verifier (`R4` §12.7).
10. **Value-weighted fairness across a person's many processes** (`R4` §12.11).
11. **Complete forgetting across provider caches, archives, merged derivations and embeddings.** Crypto-shredding's legal
    sufficiency is contested (`R4` §12.9; `R1` §8.5).
12. **Narrative drift under repeated consolidation**, the Bartlett effect (`R1` §13.11).
13. **Capability UX.** How a person reviews and revokes a large delegation tree (`R4` §12.6).
14. **Benchmarks.** No public benchmark tests restart, model swap, forgetting, calibration or outcomes over weeks
    (`R1`). UCI must build its own evaluators, and must guard them against leakage and hacking.
