# 13 — Research Evidence Map

> Maps each piece of evidence to the primitive or hypothesis it supports, and to where it is used. Primary sources and
> URLs live in the research notes. This map points to their sections:
> - `R1` — memory and continual cognition
> - `R2` — learning, verification, world and self models
> - `R3` — ingestion, grounding, context
> - `R4` — runtimes, authority, cognitive economics
>
> Archaeology references use `A-xxx`. Statuses are those reported by the evidence itself.
>
> **Caveats.**
> - Several 2026 sources are single-group preprints.
> - Numbers marked *(recalled)* in the notes were not re-fetched.
> - Vendor leaderboards disagree: the same Zep system is reported at 65.99, 75.14 and 58.44 on LoCoMo (`R1` §4.7).
>
> Treat figures as directional unless marked REPLICATED.

---

## 1. Persistent cognitive state and the bridge

| Evidence | Source | Status | Supports | Used in |
|---|---|---|---|---|
| All 7 harnesses lack a durable object above the session, epistemic status, runtime outcome verification, and measured learning | A-SYN §0, §7 | OBSERVED (7/7) | The bridge primitives exist to fill a real gap | `01` §1.2 |
| Long-term working memory: expert resumption relies on durable retrieval structures | `R1` §1.3 (Ericsson & Kintsch) | REPLICATED | Durable working state; H-PCS1 | `02` |
| The working self gates encoding and retrieval by current goals | `R1` §9.1 (Conway) | REPLICATED | Goals as a retrieval cue; working state | `02`, `04` §9 |
| GPT-4o falls from 87.0% to 60.6% on LongMemEval with the evidence in context | `R1` §4.1 | REPLICATED | The transcript is not the state; context ≠ memory | `02` §1, `04` §1 |
| Temporal continue-as-new (51,200-event / 50 MB cap) | `R4` §1.1 | OBSERVED (production) | Epochs; epoch checkpoint as the resume unit | `09` §2 |
| No behavioural-equivalence notion for a process after a model swap | `R4` §12.1 | UNKNOWN | The cognitive-resume battery as UCI's proposal | `02` §4, `12` §3 |

## 2. Epistemic substrate

| Evidence | Source | Status | Supports | Used in |
|---|---|---|---|---|
| Prediction error as the learning signal (Rescorla–Wagner, TD, dopamine, forecasting) | `R2` §6.3 | REPLICATED | The expectation → resolution loop | `01` B3, `03` §3 |
| Pre-registration cuts positive results from 96% to 44% | `R2` §6.5 | REPLICATED | Expectations declared *before* outcomes | `03` §3, `07` §2 |
| Calibration learnable from about 1k graded outcomes; introspection detects about 20% | `R2` §5 | REPLICATED / OBSERVED | Empirical self-model (H-EP2) | `03` §5 |
| Agents predict 77% success, achieve 22%; pre-execution estimates discriminate better | `R2` §5.5 | OBSERVED | Expectation capture before acting (H-EC3) | `01`, `03` |
| RLHF worsens calibration; spurious-reward effects are model-specific | `R2` §5.1, §3.4 | OBSERVED | Recalibrate after every model swap | `03` §3.1, `07` §2.1 |
| IRT, ADeLe (beats black-box predictors out of distribution), METR horizons, knowledge tracing | `R2` §8 | REPLICATED (psychometrics) / OBSERVED (LLMs) | Competence as latent ability; one model for self and learner (H-EP4) | `03` §5.1 |
| Truth maintenance (TMS/ATMS); AGM belief revision | `R1` §6.3 | REPLICATED (theory) | Justifications with propagation | `03` §7, `04` §5 |
| Bitemporal data models (valid time, transaction time) | `R1` §6.1 | REPLICATED | Claim validity intervals | `03` §2 |

## 3. Memory

| Evidence | Source | Status | Supports | Used in |
|---|---|---|---|---|
| STALE: memory frameworks under 10%; write-time adjudication 8.7% → 68.0% | `R1` §4.5 | OBSERVED (single group, large effect) | Write-time truth-maintenance status (H-MF1) | `04` §4 |
| MemoryAgentBench multi-hop conflict ≤ 28%; RippleEdits propagation failures | `R1` §4.3, §5.2 | OBSERVED / REPLICATED direction | Justification propagation | `04` §5 |
| PI-LLM: log-linear decline toward zero as superseded values accumulate (35 models) | `R1` §7.2 | OBSERVED (large sweep) | Resolve supersession before compilation | `04` §5, `05` |
| Raw trajectories transfer −9.5%; abstractions +6.5–9%; dilution buries useful items | `R1` §5.3 | OBSERVED | Keep raw + abstract, linked; merge; priority (H-MF3) | `04` §7–8 |
| Agents follow raw experience more faithfully than summaries | `R1` §5.4 | OBSERVED | Summaries cannot replace evidence | `04` §1 |
| AWM +24.6 / +51.1%; ReasoningBank up to +34%; Memento 87.88% on GAIA | `R1` §3.10 | REPLICATED direction | Procedural memory with outcome utility | `04` §7 |
| *But:* a budget-matched vanilla agent matches or beats AWM, ASI and ReasoningBank | `R2` §1.9 | OBSERVED (2026) | Procedural gains must survive cost-matched trials | `07` §1.1, §2.1 |
| PrefEval: under 10% of preferences followed after 10 turns; PersonaMem 30–50% | `R1` §4.4, §9.2 | OBSERVED | Policy-force person model (H-MF2) | `04` §6 |
| MINJA 98.2% injection; AgentPoison: under 0.1% poisoning gives over 80% attack success; LLM moderation fails in both directions | `R1` §8.4 | OBSERVED | Trust labels propagate; untrusted-derived memory informs, never instructs (H-MF7) | `04` §1, `09` §3 |
| EvoBreak: individually benign experiences compose into a safety bypass | `R1` §8.4 | OBSERVED | Composition checks on procedural promotion | `04` §7 |
| Storage vs retrieval strength (Bjork); ACT-R power-law activation | `R1` §8.1, §1.2 | REPLICATED | Two strengths (H-MF4) | `04` §5 |
| Complementary Learning Systems: fast episodic store alongside slow generalization | `R1` §2.1 | REPLICATED | Evidence alongside claims; the three regimes | `04` §2 |
| Letta sleep-time compute: about 5× less test-time compute when demand is predictable | `R1` §3.2, `R4` §6.1 | CLAIMED (single study) | Consolidation as priced background work | `04` §8, `09` §5 |
| Generative Agents reflection ablation measures only believability | `R1` §3.3 | OBSERVED (weak outcome) | Reflection ≠ learning | `04`, `07` |
| Zep extraction regression 94.6 → 80.4 on assistant-said facts | `R1` §3.4 | OBSERVED | Keep raw evidence: whatever is not extracted is lost | `04` §4 |

## 4. Context and attention

| Evidence | Source | Status | Supports | Used in |
|---|---|---|---|---|
| Length alone degrades all 18 frontier models by 13.9–85%; NoLiMa: 11 of 13 models fall below half at 32K | `R3` §5.2 | REPLICATED | Compiled minimal view; budget scales with the model | `05` §3.1, §5 |
| Lost in the middle can fall below the no-documents baseline | `R3` §5.1 | REPLICATED | Position recorded in the manifest | `05` §3.1 |
| Formatting alone moves accuracy by up to 40% | `R3` §5.6 | OBSERVED | Rendering version recorded in the manifest | `05` §3.1 |
| Cache reads cost 0.1×; agents run about 100:1 input to output; caching cuts 41–80% | `R3` §5.5, `R4` §9.3 | OBSERVED | Stable-first, deterministic compilation | `05` §5, `09` §5 |
| Compaction keeps about 17% of constraints; 53% → 10% of safety rules over 5 rounds; pointer log 99.4% vs 88.1% | `R3` §6.3 | OBSERVED (preprints, consistent) | Deontic pinning; addressable elision; deepened compaction test (H-CA4) | `05` §5.1 |
| Observation masking matches summarization at half the cost | `R3` §5.4 | OBSERVED | Default to elision over rewriting | `05` §5.1 |
| ContextCite: attribution of outputs to context items; up to 57% of citations post hoc | `R3` §5.7, §3.8 | OBSERVED | Sampled use-attribution in the manifest | `05` §3.1 |
| Off-policy estimators need logged propensities | `R2` §4.2 | REPLICATED | Inclusion propensity in the manifest (H-CA5) | `05` §3.1, `06` §3.1 |

## 5. Replay and simulation

| Evidence | Source | Status | Supports | Used in |
|---|---|---|---|---|
| Off-policy evaluation valid only within support; replay estimator needs uniform logging | `R2` §4.2 | REPLICATED | The divergence law; exploration for overlap (H-RS1) | `06` §3 |
| LLM world simulation: 59.9% at one step, under 1% after ten | `R2` §6.2 | OBSERVED | Rollouts are priors, never evidence | `06` §3.1, §4 |
| Model-based RL works when trained on prediction error (Dreamer, MuZero) | `R2` §6.1 | REPLICATED | World models tested by resolutions | `03` §4 |
| DSH keyless recorded replay plus workspace oracle; SWE replay without observation comparison | A-DSH §17.3; A-SWE §25 | OBSERVED | Re-play as a test tier; replay must compare observations | `06` §2 |
| OC divergence check exists but is never called in production | A-OC §26.4 | OBSERVED | Divergence detection is buildable and unused | `06` §3 |

## 6. Learning and verification

| Evidence | Source | Status | Supports | Used in |
|---|---|---|---|---|
| Every durable self-improvement success has an external checker (STaR, Voyager, DGM, AlphaEvolve, AlphaProof) | `R2` §10.1 | REPLICATED | Verification is the engine of learning | `07` §1.1 |
| LLMs cannot reliably self-correct without feedback; untrained self-correction −11.2% on MATH | `R2` §2.1–2.3 | REPLICATED | Reflection generates hypotheses, never verdicts | `07` §1 |
| SkillsBench: self-authored skills add 0 on average; curated +16.2 points, 16/84 tasks worse | `R2` §1.10 | OBSERVED (2026) | Status ladder; controlled trials | `07` §1.1 |
| About ⅓ of A/B tests positive (10–20% in mature products) | `R2` §4.1 | REPLICATED | Most changes don't help; prior for H-LV5 | `07` §1.1 |
| Random rewards: +21.4 vs +29.1 points with ground truth | `R2` §3.4 | OBSERVED | Placebo arm required | `07` §2.1 |
| DGM faked test logs; METR: 43× more hacking with a visible scorer; learned hacking generalizes to sabotage | `R2` §2.5 | REPLICATED | Evaluator outside the authority envelope, invisible to the actor | `07` §2.1 |
| Verifiers worth about 30× model scale on GSM8K; about 31% of passing SWE-bench patches pass on weak tests | `R2` §3.1, §3.5 | REPLICATED | Verifier records with measured error rates | `03` §3.1, `07` §3 |
| Poisoned benchmarks persist through later self-evolution | `R2` §1.15 | OBSERVED | Evaluation-set provenance and integrity | `07` §2.1 |
| HER reflection fork: governed adaptation, unevaluated; curator-takeover incident | A-HER §19.5, §28.5 | OBSERVED | Persistence isolation; reflection ≠ learning | `07` §1 |

## 7. Ingestion

| Evidence | Source | Status | Supports | Used in |
|---|---|---|---|---|
| OmniDocBench leader flip, 2024 → 2026 (small VLMs 94.9 vs pipelines 86.5 / 78.4) | `R3` §1.2 | OBSERVED | Operators as swappable adapters; re-derivation | `08` §1 |
| Whisper fabricates in about 1% of transcripts, 38% of them harmful | `R3` §2.2 | OBSERVED | Operator output is interpretation; keep raw media | `08` §1 |
| ColPali 0.81 vs 0.66; text wins on long text-rich documents; hybrid best end to end; region grounding F1 ≈ 0.09 | `R3` §1.4–1.5 | CONTESTED → hybrid | Multi-representation index; page-level citation honesty | `08` §1, §8 |
| BM25 71.2% vs dense 49.7% on long-tail entities; LIMIT dense recall@100 under 20% | `R3` §4.2 | REPLICATED | Exact and similarity retrieval as distinct services | `08` §1 |
| BRIGHT: 18.3 → about 46.8 nDCG@10 only with reasoning inside retrieval | `R3` §4.3 | OBSERVED | Cognition begins where the query changes | `05`, `08` |
| GraphRAG 69.01 vs plain RAG 69.33 at matched budget | `R3` §3.2 | OBSERVED | Graphs are indexes, not cognition | `08` §1 |
| W3C PROV, Web Annotation, Media Fragments | `R3` §3.7, §2.5 | REPLICATED (standards) | Universal anchor and derivation model | `08` §2 |

## 8. Runtime, authority, economics

| Evidence | Source | Status | Supports | Used in |
|---|---|---|---|---|
| Durable execution (Temporal, Restate, DBOS, Azure Durable Functions), actors (Orleans, Akka), OTP, fencing, Kubernetes reconciliation | `R4` §1–2, §11.1 | REPLICATED | The execution floor is fundamental, not agent fashion | `09` §1 |
| Model call as recorded effect (OpenAI Agents SDK + Temporal; Vercel; Microsoft Agent Framework) | `R4` §3.3, §11.1 | OBSERVED | Journal decisions; never recompute | `09` §1 |
| MAST: step repetition 15.7%, termination unawareness 12.4%, missing verification 8.2% (1,642 traces, κ = 0.88) | `R4` §5.2 | REPLICATED | Supervision signals computed from the record (H-RT3) | `09` §2 |
| Anthropic multi-agent: +90.2%; tokens explain 80% of variance; about 15× tokens. Cognition disputes generality. | `R4` §5.1 | CLAIMED / CONTESTED | Multi-agent use is a spending decision (H-RT6) | `09` §5 |
| Confused deputy; object capabilities; seL4 derivation tree; macaroons | `R4` §7.1–7.4 | REPLICATED | Capabilities with caveats; cascading revocation; consent root | `09` §3 |
| CaMeL 77% vs 84%; Progent 41.2% → 2.2%; FIDES blocks all attacks in AgentDojo | `R4` §7.5 | REPLICATED in suite / CONTESTED at the open end | Injection defence via labels + capabilities (H-RT4) | `09` §3 |
| MCP moved Tasks out of core and removed protocol sessions | `R4` §4.2 | OBSERVED | Durable state belongs in the substrate, not in transport sessions | `09` |
| Russell & Wefald; anytime algorithms; Lieder & Griffiths | `R4` §8 | REPLICATED (theory) | Value of computation as the allocation rule | `09` §5 |
| Snell: adaptive test-time compute over 4× more efficient; FrugalGPT / RouteLLM: 2×–98% cost cuts | `R4` §8.5, §9 | REPLICATED | One ablated allocator (H-RT5) | `09` §5 |
| No surveyed system logs predicted vs realized value per step | `R4` §11.4 | OBSERVED (absence) | Metering + outcome linkage in the kernel | `09` §5 |
