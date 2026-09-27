# R1 — Memory and Continual Cognition: what persistent cognitive state must be, beyond retrieval

Research pass for UCI architecture (2026-09-26). Complete. Status: research input, not
evidence of any UCI capability (CLAUDE.md §2). Every claim about an external system is tagged.

## 0. Question and method

**Question.** What mechanisms, invariants and empirical results tell us what persistent *cognitive*
state and memory must be, beyond retrieval?

**Method.** Primary sources (arXiv full text/HTML, official docs, source repos) fetched 2026-09-26;
foundational cognitive-science classics cited from the literature. Numbers are quoted from the
paper's own tables unless marked otherwise. Many LLM-memory numbers are *vendor self-reports on
benchmarks the vendor chose*; they are tagged accordingly.

**Status tags.**
- `OBSERVED` — demonstrated with data in at least one primary source.
- `REPLICATED` — the effect appears across multiple independent sources/labs.
- `CLAIMED` — asserted; evidence weak, self-reported, disputed, or not ablated.
- `SPECULATIVE` — hypothesis / our inference; no direct evidence.

**Evidence vs inference.** Paragraphs headed **Evidence** report what a source measured.
Paragraphs headed **Inference (UCI)** are this document's reasoning and carry no evidential weight.

**Frame from the harness study (input to this pass).** Harnesses converged on persistent
*execution* (durable records, exactly-once tool settlement, projection of the record into the
model's view) but lack persistent *cognition* (no durable object above the session, no epistemic
status, no outcome verification, no measured learning). This pass asks what the research says the
missing layer must contain.

---

## 1. Cognitive architectures and memory taxonomies

### 1.1 CoALA — Cognitive Architectures for Language Agents
- **Citation.** Sumers, Yao, Narasimhan, Griffiths. *Cognitive Architectures for Language Agents.*
  TMLR 2024. https://arxiv.org/abs/2309.02427
- **Mechanism.** Working memory ("active and readily available information as symbolic variables
  for the current decision cycle") plus three long-term memories: *episodic* (experience,
  trajectories), *semantic* (knowledge about world and self), *procedural* (implicit in LLM
  weights + explicit in agent code). Internal actions: *retrieval* (LTM→WM), *reasoning* (WM→WM),
  *learning* (WM→LTM). External *grounding* actions. A decision cycle: plan (propose → evaluate →
  select) then execute one grounding or learning action.
- **Key positions.** Learning is an *action* the agent selects, not a fixed schedule; procedural
  updates (weights or code) are "risky both for the agent's functionality and alignment"; open
  directions include compounding multiple learning types, *unlearning*/deletion, and meta-learning
  the retrieval procedure itself.
- **Empirical result.** None — conceptual framework and survey. `CLAIMED` as architecture;
  widely adopted vocabulary (`REPLICATED` as a taxonomy in later surveys).
- **Invariant for UCI.** (a) Memory writes are *typed actions* inside the decision cycle, loggable
  like any other action. (b) Separate stores by *kind of knowledge*, not by storage technology.
  (c) Procedural change is the highest-risk write and needs the strongest governance.
- **Conflicts.** CoALA's working memory is per-decision-cycle and ephemeral; it gives no account
  of *durable* working state across process death (the UCI "working state" gap). It has no
  epistemic status on semantic memory — "inferences" written by reflection are stored like facts.

### 1.2 ACT-R and Soar — declarative / procedural and activation
- **Citations.** Anderson et al., *An integrated theory of the mind*, Psych. Review 111(4), 2004,
  https://doi.org/10.1037/0033-295X.111.4.1036 ; Anderson & Schooler, *Reflections of the
  environment in memory*, Psych. Science 2(6), 1991, https://doi.org/10.1111/j.1467-9280.1991.tb00174.x ;
  Laird, *The Soar Cognitive Architecture*, MIT Press 2012; Laird, *Introduction to Soar*, 2022,
  https://arxiv.org/abs/2205.03854
- **Mechanism (ACT-R).** Declarative chunks carry a *base-level activation*
  `B_i = ln(Σ_j t_j^{-d})` (d≈0.5) summed over every past use, plus spreading activation from the
  current context; retrieval probability and latency are functions of activation; below a
  threshold a chunk is not retrievable (forgetting as *inaccessibility*, not deletion). Procedural
  knowledge is production rules with learned *utilities* updated from reward; new productions
  arise by *production compilation* from repeated declarative-guided steps.
- **Mechanism (Soar).** Working memory graph; procedural memory of rules; *semantic* and
  *episodic* memory modules added (Derbinsky & Laird); *chunking* compiles the result of
  deliberate problem solving in an impasse into a new rule; reinforcement learning tunes rule
  preferences; episodic memory stores automatic WM snapshots and supports cue-based retrieval.
- **Empirical result.** Anderson & Schooler showed that the power-law form of human forgetting
  matches the statistics of need in the environment (newspaper headlines, child-directed speech,
  email): the probability an item is needed falls as a power function of time since last use and
  rises with frequency. ACT-R models fit hundreds of lab datasets. `REPLICATED` (decades).
  Derbinsky & Laird showed efficient episodic-memory scaling in Soar to millions of episodes
  (engineering result, `OBSERVED`).
- **Invariants for UCI.** (a) **Strength is a function of use history, not a stored scalar** —
  keep the access log and *compute* strength (recomputable, law "derived names what it came from").
  (b) **Forgetting = retrieval threshold, not deletion** in the default path (deletion is a separate,
  sovereign act). (c) **Declarative vs procedural** are different objects with different update
  rules: facts are revised by evidence; procedures are revised by *outcome utility*. (d) Skill
  formation = compilation of repeatedly-successful deliberate traces (Soar chunking, ACT-R
  production compilation) — the classical ancestor of "Agent Workflow Memory" (§3.10).
- **Conflicts.** Classic architectures have hand-authored symbolic representations; LLM agents
  store natural-language records whose "activation" is unclear. Rational-analysis decay
  presupposes the environment's need statistics are stationary; personal work is bursty.

### 1.3 Working-memory models
- **Citations.** Baddeley & Hitch 1974; Baddeley, *The episodic buffer*, TiCS 4(11), 2000,
  https://doi.org/10.1016/S1364-6613(00)01538-2 ; Cowan, *The magical number 4*, BBS 24, 2001,
  https://doi.org/10.1017/S0140525X01003922 ; Ericsson & Kintsch, *Long-term working memory*,
  Psych. Review 102(2), 1995, https://doi.org/10.1037/0033-295X.102.2.211
- **Mechanism.** Capacity-limited active store (~4 chunks, Cowan) with an *episodic buffer*
  binding multimodal info into episodes; Ericsson & Kintsch: experts extend effective working
  memory via *retrieval structures* in LTM — durable, organized cues that let task state be
  suspended and resumed after interruption (chess masters, waiters, doctors).
- **Empirical result.** Capacity limits `REPLICATED`. Long-term working memory: experts resume
  interrupted tasks with little loss because task state was encoded into LTM retrieval
  structures (`REPLICATED` across expertise studies).
- **Invariant for UCI.** **Long-term working memory is the precise human analogue of the UCI
  "working state".** Resumable cognition requires that the *active task state* (goals, current
  hypotheses, open questions, pointers to relevant knowledge) be written into a durable,
  structured, cue-addressable form — not merely that raw history be retrievable. The context
  window is the capacity-limited focus; the durable working state is the retrieval structure.
- **Conflicts.** LLM "working memory" (the context) is ~10^5 tokens, not 4 chunks; the scarce
  resource is *attention quality* (lost-in-the-middle, §4) rather than slot count.

---

## 2. Complementary Learning Systems, consolidation, reconsolidation, schemas

### 2.1 Complementary Learning Systems (CLS)
- **Citations.** McClelland, McNaughton, O'Reilly, *Why there are complementary learning systems
  in the hippocampus and neocortex*, Psych. Review 102(3), 1995,
  https://doi.org/10.1037/0033-295X.102.3.419 ; Kumaran, Hassabis, McClelland, *What learning
  systems do intelligent agents need? CLS theory updated*, TiCS 20(7), 2016,
  https://doi.org/10.1016/j.tics.2016.05.004 ; McCloskey & Cohen 1989 (catastrophic interference).
- **Mechanism (functional).** Two systems with opposite learning rates: a *fast* system storing
  pattern-separated specific episodes after one exposure, and a *slow* system that extracts
  shared structure by *interleaved* training. New knowledge is first held by the fast store and
  gradually integrated into the slow store by *replay interleaved with old knowledge*; direct fast
  writes into the slow (distributed) system cause catastrophic interference. The 2016 update adds:
  replay is *prioritized* (reward, novelty), and new information *consistent with an existing
  schema* can be integrated rapidly into the slow system.
- **Empirical result.** Catastrophic interference in connectionist nets is `REPLICATED`
  (McCloskey & Cohen 1989; Ratcliff 1990; modern deep nets). Interleaved replay mitigates it
  (`REPLICATED`; experience replay in DQN, Mnih et al. 2015). Hippocampal lesion + graded
  retrograde amnesia data support the two-system account (`REPLICATED`, though disputed in detail
  by Multiple Trace / Trace Transformation theory — see Conflicts).
- **Invariants for UCI.**
  1. **Two stores, two rates.** A faithful, append-only episodic store written immediately
     (fast, specific, never revised), and a slower *consolidated* store of generalizations written
     only by a consolidation process. → maps directly onto UCI's evidence memory vs cognitive
     memory.
  2. **Consolidation is an offline, interleaved process over many episodes, not a per-turn
     summarization.** Generalization must be checked against *old* knowledge, not only the new
     episode (the interleaving law).
  3. **Schema-consistent information may be integrated fast; schema-inconsistent information must
     stay episodic until corroborated.** This is a formation policy (§7).
- **Conflicts.** Multiple Trace Theory (Nadel & Moscovitch 1997) and Trace Transformation
  (Winocur & Moscovitch 2011) argue detailed episodic memory *always* depends on the hippocampus
  and that consolidation *transforms* (gist vs detail) rather than transfers. Functional lesson
  both agree on: **the gist and the episode coexist; the generalization does not replace the
  episode.** This supports keeping raw evidence forever alongside derived beliefs.

### 2.2 Replay and sleep consolidation
- **Citations.** Wilson & McNaughton, Science 265, 1994 (hippocampal replay during sleep),
  https://doi.org/10.1126/science.8036517 ; Diekelmann & Born, *The memory function of sleep*,
  Nat Rev Neurosci 11, 2010, https://doi.org/10.1038/nrn2762 ; Mattar & Daw, *Prioritized memory
  access explains planning and hippocampal replay*, Nat Neurosci 21, 2018,
  https://doi.org/10.1038/s41593-018-0232-z ; Schaul et al., *Prioritized Experience Replay*,
  ICLR 2016, https://arxiv.org/abs/1511.05952
- **Mechanism.** Offline reactivation of recent experience sequences, biased toward
  reward-relevant/novel content; sleep selectively consolidates memories tagged as relevant to the
  future (Wilhelm et al. 2011: expected future use boosts sleep consolidation); Mattar & Daw:
  replay prioritization = *gain × need* (how much a backup would change the policy × how likely the
  state is to be visited again).
- **Empirical result.** Replay phenomena `REPLICATED` across rodent labs; sleep benefits for
  declarative memory `REPLICATED` (effect sizes moderate, some replication controversy for
  targeted memory reactivation). Prioritized replay in RL: PER improved median human-normalized
  score on Atari over uniform replay (`OBSERVED`, widely reused → `REPLICATED` in RL).
- **Invariant for UCI.** **Consolidation budget should be allocated by (expected change to
  beliefs/policy) × (expected future need)** — not uniformly, not by recency alone. Letta's
  sleep-time compute (§3.2) is the first LLM-agent instance; its benefit depends on query
  predictability, which is exactly Mattar & Daw's "need" term.
- **Conflicts.** Biological replay also *generates* novel sequences (preplay); LLM "reflection"
  generates novel inferences — both need verification, which biology does not obviously provide.

### 2.3 Reconsolidation
- **Citations.** Nader, Schafe, LeDoux, *Fear memories require protein synthesis in the amygdala
  for reconsolidation after retrieval*, Nature 406, 2000, https://doi.org/10.1038/35021052 ;
  Lee, Nader, Schiller, *An update on memory reconsolidation updating*, TiCS 21(7), 2017,
  https://doi.org/10.1016/j.tics.2017.04.006 ; Sevenster, Beckers, Kindt 2013 (prediction error
  is required to destabilize a memory).
- **Mechanism.** Retrieval can return a consolidated memory to a labile state in which it can be
  updated or weakened; destabilization requires a **prediction error** at retrieval (mismatch
  between expected and actual); no mismatch → no update.
- **Empirical result.** `REPLICATED` in animal fear conditioning; human replication is mixed
  (boundary conditions: memory age, strength). Prediction-error requirement `OBSERVED`
  (Sevenster et al.), partially replicated.
- **Invariant for UCI.** **Retrieval is a potential write.** When a belief is retrieved *and used*
  and the outcome mismatches its prediction, that is the trigger for revision; confirmed use
  strengthens. Crucially, in UCI (unlike biology) the revision must be **non-destructive**: a new
  version supersedes, the old version remains addressable (biology overwrites; this is the one
  place we must deliberately *not* copy the brain — reconsolidation is also the mechanism of
  false-memory implantation, Loftus).
- **Conflicts.** Biological reconsolidation silently overwrites; UCI law forbids overwrite.

### 2.4 Schema theory
- **Citations.** Bartlett, *Remembering*, 1932; Tse et al., *Schemas and memory consolidation*,
  Science 316, 2007, https://doi.org/10.1126/science.1135935 ; van Kesteren et al., *How schema
  and novelty augment memory formation*, TiNS 35(4), 2012 (SLIMM model),
  https://doi.org/10.1016/j.tins.2012.02.001 ; Gilboa & Marlatte, TiCS 2017.
- **Mechanism.** Existing schemas (structured prior knowledge) make schema-consistent new
  information consolidate in ~1 trial/48h in rats (Tse), versus weeks without a schema. SLIMM:
  high congruency → fast medial-prefrontal integration; high novelty (prediction error) →
  hippocampal episodic encoding; intermediate → weakest memory. Bartlett: recall is
  reconstructive — schemas *distort* recall toward expectations.
- **Empirical result.** Tse 2007 `OBSERVED`, extended by the same group; SLIMM U-shape
  `CLAIMED`/partially replicated in humans. Bartlett-style schema distortion `REPLICATED`.
- **Invariant for UCI.** (a) **Encoding strength should be U-shaped in congruence**: strongly
  congruent → integrate into semantic structure quickly; strongly surprising → keep a high-priority
  episodic record and flag for review; the mushy middle is where pollution lives. (b) **Schemas
  bias recall** — any generated summary or reconstruction must be checkable against the raw
  episode, otherwise the system will confabulate schema-consistent details (the LLM analogue is
  well documented: summaries drift toward priors).
- **Conflicts.** Schema acceleration trades against schema distortion; no LLM memory system we
  found measures both.

---

## 3. LLM agent memory systems

### 3.1 MemGPT (virtual context management)
- **Citation.** Packer et al., *MemGPT: Towards LLMs as Operating Systems*, 2023,
  https://arxiv.org/abs/2310.08560
- **Mechanism.** OS analogy: *main context* (system instructions + editable *working context* +
  FIFO message queue) vs *external context* (recall storage = full message history; archival
  storage = vector store). The LLM moves data between tiers via self-issued function calls;
  "memory pressure" warnings at ~70% context trigger the model to save; queue eviction writes a
  recursive summary; "heartbeat" function chaining lets the agent act without user input.
- **Empirical result.** Deep Memory Retrieval (DMR, MSC-derived) accuracy (paper Table 2):
  GPT-4 alone 32.1% → MemGPT+GPT-4 92.5%; GPT-4 Turbo 35.3% → 93.4%; GPT-3.5 38.7% → 66.9%.
  `OBSERVED` on a benchmark the authors built; later shown to be saturated/easy (Zep 94.8%, §3.4).
- **Invariant for UCI.** (a) Context is a *managed cache* over durable tiers, with explicit
  eviction policy — the "model-visible means logged" law has its first ancestor here. (b) The
  full message history is never discarded (recall storage); summaries are *additional*.
- **Conflicts / weaknesses.** Memory management is delegated to the same model doing the task —
  the model decides what to remember, with no verification, no epistemic status, and a single
  point of failure (the model forgetting to save). Self-edited "core memory" text is overwritten in
  place (no version history in the paper's design).

### 3.2 Letta (memory blocks, sleep-time compute)
- **Citations.** Letta docs, *Memory blocks* and *Sleep-time agents*, https://docs.letta.com ;
  Lin, Packer et al., *Sleep-time Compute: Beyond Inference Scaling at Test-time*, 2025,
  https://arxiv.org/abs/2504.13171
- **Mechanism.** Agent state persisted in a DB (the durable object is the *agent*, not the
  session). *Memory blocks* = labelled, size-limited, always-in-context text sections (e.g.
  `human`, `persona`) the agent edits by tool call; blocks can be *shared* between agents.
  *Sleep-time agents*: a second agent that runs asynchronously between user turns, reads the
  primary agent's history/data sources, and rewrites its memory blocks ("learned context").
- **Empirical result (sleep-time paper).** On constructed stateful tasks, ~5× less test-time
  compute for equal accuracy on Stateful GSM-Symbolic and Stateful AIME; scaling sleep-time
  compute raised accuracy up to +13% (GSM-Symbolic) and +18% (AIME); amortization across related
  queries cut average cost/query 2.5×; benefit correlates with *predictability of the query*.
  `OBSERVED` (single lab, synthetic "stateful" reformulations of reasoning benchmarks).
- **Invariant for UCI.** **Offline consolidation is a separate process with its own budget,
  operating over the durable record, producing derived state ahead of need.** Direct engineering
  analogue of CLS replay + Mattar & Daw need-weighting.
- **Conflicts / weaknesses.** Memory blocks are free text rewritten in place — derived state
  without provenance, version history, or confidence. Sleep-time output is not verified; a wrong
  "learned context" becomes always-in-context, i.e. maximally influential pollution.

### 3.3 Generative Agents (memory stream, reflection)
- **Citation.** Park et al., *Generative Agents: Interactive Simulacra of Human Behavior*, UIST
  2023, https://arxiv.org/abs/2304.03442
- **Mechanism.** Append-only *memory stream* of natural-language observations with timestamps.
  Retrieval score = α·recency + β·importance + γ·relevance (recency = exponential decay, factor
  0.995 per game-hour since last *access*; importance = LLM-rated 1–10 at write time; relevance =
  embedding cosine). *Reflection* fires when summed importance of recent events exceeds a
  threshold (150): the model asks salient questions of recent memories and writes
  higher-level "insights" back into the stream *with citations to the memories they came from*.
  *Planning* writes day plans into memory and revises them.
- **Empirical result.** Believability ablation, TrueSkill μ: full 29.89; no reflection 26.88;
  no reflection & no planning 25.64; human crowdworker role-play 22.95; no memory/reflection/
  planning 21.21; full vs no-memory effect size d = 8.16. `OBSERVED` (single study, n=100
  evaluators, measure = *believability*, not task success or correctness). Documented failures:
  retrieval misses, embellishment (hallucinated details added to real memories), and
  over-formal behaviour.
- **Invariants for UCI.** (a) **Importance is assessed at write time and stored; recency is
  computed from access time** — a mixed scoring function over stored + computed signals. (b)
  **Derived memories cite their sources** (reflections point to evidence) — the earliest LLM
  example of provenance on inference. (c) Consolidation triggered by *accumulated salience*, not
  by clock.
- **Conflicts.** Reflection outputs are stored in the *same* stream as observations and retrieved
  the same way, so inference and observation are indistinguishable at use time — the precise
  failure UCI's "stages never collapse" law forbids. Evidence is believability only; reflection
  was never shown to improve *correctness*. See §12 ("reflection as learning").

### 3.4 Zep / Graphiti (bi-temporal knowledge graph)
- **Citation.** Rasmussen et al., *Zep: A Temporal Knowledge Graph Architecture for Agent
  Memory*, 2025, https://arxiv.org/abs/2501.13956 ; code https://github.com/getzep/graphiti
- **Mechanism.** Three subgraphs: *episodes* (raw messages, "non-lossy"), *semantic entities and
  fact edges* extracted from episodes, *communities* (label-propagation clusters with summaries).
  Every edge is bi-temporal: `t_valid, t_invalid` on the event timeline T (when the fact held in
  the world) and `t'_created, t'_expired` on the transaction timeline T' (when the system learned
  / retracted it). Contradiction: an LLM compares a new edge to semantically related existing
  edges; if they conflict with overlapping validity, the old edge's `t_invalid` is set to the new
  edge's `t_valid` — **invalidated, not deleted**. Entity resolution: embedding + BM25 candidate
  search then LLM dedup. Retrieval = search (cosine, BM25, BFS) → rerank (RRF, MMR, cross-encoder,
  episode-mention frequency) → constructor that renders facts *with validity ranges*.
- **Empirical result.** DMR 94.8% vs MemGPT 93.4%. LongMemEval_S: gpt-4o 60.2% → 71.2%
  (full-context vs Zep), gpt-4o-mini 55.4% → 63.8%; context 115k → 1.6k tokens; latency
  31.3s → 3.2s. Per type (gpt-4o): temporal reasoning 45.1 → 62.4; multi-session 44.3 → 57.9;
  preference 20.0 → 56.7; knowledge-update 78.2 → 83.3; **single-session-assistant regressed
  94.6 → 80.4**. `OBSERVED` (vendor-authored; per-type regressions reported honestly).
- **Invariant for UCI.** **Bitemporality is the minimum representation for revisable belief**:
  world-validity and system-knowledge time are separate axes; contradiction closes an interval,
  never erases. Episodes are retained under derived facts (provenance by construction).
- **Conflicts.** Contradiction detection is an LLM judgment over *similar* edges only — implicit
  and propagated invalidations (STALE, §4.5) are missed. Validity is binary per edge; no
  confidence. The loss on single-session-assistant shows extraction discards what the assistant
  said — the extraction schema decides what can ever be remembered.

### 3.5 Mem0 / Mem0g
- **Citation.** Chhikara et al., *Mem0: Building Production-Ready AI Agents with Scalable
  Long-Term Memory*, 2025, https://arxiv.org/abs/2504.19413
- **Mechanism.** Extraction: LLM reads the new message pair + rolling summary + last 10 messages
  and emits candidate facts. Update: for each fact, retrieve top-10 similar memories; an LLM tool
  call chooses ADD / UPDATE / DELETE / NOOP. Mem0g: entity-relation graph; conflicting
  relationships are *marked invalid* rather than deleted.
- **Empirical result (vendor, LoCoMo, LLM-judge J).** Mem0 66.88, Mem0g 68.44, full-context
  72.90 (best), Zep 65.99, LangMem 58.10, best RAG 60.53, OpenAI memory 52.90, A-Mem 48.38.
  p95 latency: Mem0 1.44s vs full-context 17.1s; tokens ~7k vs ~26k. Graph variant gave no gain on
  multi-hop. **Disputed**: Zep re-ran its own system and reported 75.14 ± 0.17
  (https://blog.getzep.com/lies-damn-lies-statistics-is-mem0-really-sota-in-agent-memory/); a
  counter-analysis re-scored Zep at 58.44 after excluding the adversarial category
  (https://github.com/getzep/zep-papers/issues/5). `CLAIMED` — cross-vendor LoCoMo numbers are
  not trustworthy as rankings.
- **Invariant for UCI.** The *operation set* {add, update, delete, noop} is the de facto industry
  write API. UCI inference: this is too coarse — "update" and "delete" in the base Mem0 path
  destroy history; UCI needs {observe, derive, corroborate, supersede, retract, forget(sovereign)}
  with the old version preserved.
- **Conflicts.** Full context beat every memory system on accuracy in Mem0's own paper — memory
  systems were winning on cost/latency, not on cognition, in 2025 conversational benchmarks.

### 3.6 A-MEM (Zettelkasten)
- **Citation.** Xu et al., *A-MEM: Agentic Memory for LLM Agents*, NeurIPS 2025,
  https://arxiv.org/abs/2502.12110
- **Mechanism.** Each note: content, timestamp, LLM keywords, tags, context description,
  embedding, links. On write, find neighbours and create links; **memory evolution**: the new note
  triggers LLM rewriting of neighbours' context/tags.
- **Empirical result.** Self-reported ≥2× multi-hop over LoCoMo/ReadAgent/MemoryBank/MemGPT
  baselines with 85–93% fewer tokens. In Mem0's independent run, A-Mem scored lowest (48.38 J).
  `CLAIMED` (non-replicated ranking).
- **Invariant for UCI.** Links between memories as first-class objects; new evidence can change
  the *interpretation* of old memories.
- **Conflicts.** "Evolution" overwrites neighbours' descriptions with no provenance: an
  embedding-proximity link triggers a rewrite — the exact pattern UCI forbids ("let an embedding
  match create a fact or a link"). Interpretation changes must be new versions with a named
  operator, not in-place edits.

### 3.7 HippoRAG 1 and 2
- **Citations.** Gutiérrez et al., *HippoRAG: Neurobiologically Inspired Long-Term Memory for
  LLMs*, NeurIPS 2024, https://arxiv.org/abs/2405.14831 ; Gutiérrez et al., *From RAG to Memory:
  Non-Parametric Continual Learning for LLMs* (HippoRAG 2), ICML 2025,
  https://arxiv.org/abs/2502.14802
- **Mechanism.** Offline indexing: LLM OpenIE → schemaless KG as "hippocampal index" +
  synonym edges; online: query entities seed Personalized PageRank over the graph (pattern
  completion), node specificity weighting. v2 adds passage nodes, query-to-triple matching, and a
  *recognition* step where an LLM filters retrieved triples.
- **Empirical result.** v1: up to ~20% multi-hop retrieval gains on MuSiQue/2Wiki; single-step
  retrieval comparable to iterative IRCoT at 10–30× lower cost, 6–13× faster. v2: ~+7 F1 over
  NV-Embed-v2 on associative (multi-hop) tasks while matching it on factual tasks; notes that
  GraphRAG/LightRAG/RAPTOR *underperform plain dense retrieval* on simple factual QA.
  MemoryAgentBench: HippoRAG-v2 best on accurate retrieval (65.1%). `REPLICATED` (independent
  benchmark confirms retrieval strength).
- **Invariant for UCI.** Associative (graph) retrieval is a *retrieval* improvement — valuable for
  multi-hop — but it is still retrieval over a static corpus: no validity time, no revision, no
  confidence. Their "continual learning" is continual *indexing*.
- **Conflicts.** Frames retrieval as memory; UCI's position (and STALE's evidence) is that
  retrieval quality does not produce state tracking.

### 3.8 MemoryBank (forgetting curve)
- **Citation.** Zhong et al., *MemoryBank: Enhancing LLMs with Long-Term Memory*, AAAI 2024,
  https://arxiv.org/abs/2305.10250
- **Mechanism.** Ebbinghaus-style retention R = e^(−t/S); strength S incremented and t reset when
  a memory is recalled; daily event summaries and a global *user portrait* synthesized over time.
- **Empirical result.** Qualitative + simulated-dialogue evaluation of the SiliconFriend
  companion. No ablation of the forgetting curve against no-decay. `CLAIMED`.
- **Invariant for UCI.** Use-dependent strength (compatible with ACT-R §1.2). The decay rule
  itself is *unvalidated for agents*; biological curves were fitted to nonsense syllables.
- **Conflicts.** Decay that deletes contradicts evidence-memory faithfulness; MemoryBank does not
  distinguish decaying *accessibility* from destroying evidence.

### 3.9 MemoryOS
- **Citation.** Kang et al., *Memory OS of AI Agent*, EMNLP 2025, https://arxiv.org/abs/2506.06326
- **Mechanism.** Short-term queue (7 pages) → mid-term topic segments (similarity > 0.6) → long-term
  personal memory (profile, 90 trait dimensions, user KB, agent persona). Promotion by a *heat*
  score (visit count, interaction length, recency decay e^(−Δt/μ)); heat > 5 promotes.
- **Empirical result.** LoCoMo with GPT-4o-mini: +49.11% F1, +46.18% BLEU-1 average over
  baselines (weak baselines; lexical metrics). `CLAIMED`.
- **Invariant for UCI.** Promotion between tiers driven by *use statistics* — a formation policy
  expressed as a threshold. Hand-set thresholds (7, 0.6, 5) are scaffolding, not structure.

### 3.10 Agent Workflow Memory, ReasoningBank, Memento — procedural/experiential memory
- **Citations.** Wang et al., *Agent Workflow Memory*, ICML 2025, https://arxiv.org/abs/2409.07429 ;
  Ouyang et al., *ReasoningBank: Scaling Agent Self-Evolving with Reasoning Memory*, 2025,
  https://arxiv.org/abs/2509.25140 ; Zhou et al., *Memento: Fine-tuning LLM Agents without
  Fine-tuning LLMs*, 2025, https://arxiv.org/abs/2508.16153
- **Mechanism.** AWM induces reusable *workflows* (abstracted action sub-routines) from
  successful trajectories, offline (train set) or online (from its own test-time successes judged
  by an evaluator), and adds them to the agent's memory. ReasoningBank distils *strategies*
  (title/description/content) from both self-judged successes and failures; MaTTS spends extra
  test-time rollouts to create contrastive signal. Memento stores cases in a case bank and learns
  a *case-selection policy* (soft Q-learning over retrieval) — memory-based online RL.
- **Empirical result.** AWM: +24.6% relative success on Mind2Web, +51.1% on WebArena, fewer
  steps; online AWM beats baselines by 8.9–14.0 absolute points as train–test gap widens.
  ReasoningBank: up to +34.2% relative success with MaTTS, 16% fewer steps (WebArena, Mind2Web,
  SWE-Bench-Verified). Memento: GAIA val 87.88% Pass@3, test 79.40%; +4.7–9.6 points OOD.
  `REPLICATED` as a *direction* (three independent groups show procedural/experiential memory
  improves agent success); individual magnitudes `OBSERVED`.
- **Invariants for UCI.** (a) **Procedural memory is the memory type with the strongest
  evidence of improving task outcomes** — stronger than fact memory. (b) The unit of reuse should be
  *abstracted* (workflow/strategy), not raw trajectory (§5.3 confirms). (c) The retrieval
  *policy itself* can be learned from outcomes (Memento) — "meta-learning retrieval" from CoALA.
- **Conflicts.** Online variants use *self-judged* success (LLM-as-judge without ground truth) —
  violating "verification separate from generation" and opening a poisoning channel (§8.4).
  Faithfulness study (§5.4) finds agents often ignore condensed experience.

### 3.11 LangMem, Cognee, and other frameworks
- **LangMem** (LangChain), https://langchain-ai.github.io/langmem/ — distinguishes *semantic*
  (collections vs single *profile* documents), *episodic* (few-shot past experiences), and
  *procedural* memory (the agent's *system prompt* optimized from feedback by a prompt-optimizer);
  memory formation "in the hot path" (agent tool) vs "background" (reflection after the
  conversation). LoCoMo J 58.10 in Mem0's run with p95 latency 60s. `CLAIMED`. Contribution:
  the explicit *hot-path vs background* formation split, and procedural memory = prompt policy
  (UCI analogue: adaptive policy compiled per dispatch; must be versioned and evaluated).
- **Cognee**, https://github.com/topoteretes/cognee — "ECL" pipeline (extract, cognify, load)
  building a KG + vector index from documents/conversations, with ontology grounding and a
  "memify" enrichment/pruning pass. No peer-reviewed evaluation found; vendor-run HotpotQA
  comparisons only. `CLAIMED`. Contribution: optional ontology grounding of extracted entities.
- **Hindsight** (Latimer et al., *Hindsight is 20/20: Building Agent Memory that Retains,
  Recalls, and Reflects*, 2025, https://arxiv.org/abs/2512.12818). **Epistemic separation**: world
  facts, agent experiences (first person), entity observations (synthesized), and *opinions* with
  confidence c∈[0,1] updated by reinforce (+α), weaken (−α), contradict (−2α); facts carry
  occurrence interval (τs, τe) *and* mention time τm. LongMemEval_S 89.0% (OSS-120B), 91.4%
  (Gemini-3 Pro); 20B backbone 39% full-context → 83.6%; LoCoMo up to 89.61%. `OBSERVED`
  (vendor-authored, open source). Contribution: first strong system to make **fact vs belief a
  structural distinction** and to carry confidence trajectories.
- **Eywa** (*Provenance-Grounded Long-Term Memory for AI Agents*, 2026,
  https://arxiv.org/abs/2605.30771). "Evidence before belief": immutable source storage → fact
  derivation validated against source support → deterministic retrieval with zero LLM calls in
  the read path → context delivered separately from instructions. LoCoMo 90.19% (Claude
  Sonnet 4.6), LongMemEval-S 88.2% retrieval sufficiency, BEAM 81.45%. `OBSERVED` (single group).
  Contribution: **failure attribution** — separation lets one tell missing evidence vs bad
  extraction vs stale data vs retrieval loss vs model behaviour.
- **Memory-R1** (Yan et al., ACL 2026, https://arxiv.org/abs/2508.19828): RL-trained memory
  manager over {ADD, UPDATE, DELETE, NOOP} + answer agent with memory distillation; +48% F1,
  +37% LLM-judge over prior best on LoCoMo with only 152 training triplets. `OBSERVED`.
  Contribution: memory operations are a learnable *policy* whose reward is downstream
  correctness — formation policies need not be hand-coded.
- **EM-LLM** (Fountas et al., ICLR 2025, https://arxiv.org/abs/2407.09450): segments the token
  stream into episodes at **Bayesian-surprise** boundaries, refines with graph modularity,
  retrieves by similarity *plus temporal contiguity*; beats InfLLM, competitive with RAG,
  retrieval over 10M tokens; boundaries correlate with human event segmentation. `OBSERVED`.
  Contribution: surprise is a usable, cheap *segmentation and encoding* signal.

## 4. Benchmarks and what they reveal about failure

### 4.1 LongMemEval
- **Citation.** Wu et al., *LongMemEval: Benchmarking Chat Assistants on Long-Term Interactive
  Memory*, ICLR 2025, https://arxiv.org/abs/2410.10813
- **Design.** 500 questions over scalable chat histories (S ≈ 115k tokens, M ≈ 1.5M); five
  abilities: information extraction, multi-session reasoning, temporal reasoning, knowledge
  updates, abstention.
- **Results.** GPT-4o 87.0% (oracle sessions) → 60.6% on S (−30%); Llama-3.1-70B 74.4 → 33.4;
  commercial ChatGPT memory 57.7% and Coze 33.0% vs offline GPT-4o reading 91.8%. Design
  levers: round-level (not session-level) value granularity; *fact-augmented keys* (+9.4% recall@5,
  +5.4% QA); *time-aware query expansion* (+6.8–11.3% recall on temporal); Chain-of-Note
  structured reading (up to +10 points). Framework: indexing → retrieval → reading, four control
  points (value, key, query, reading strategy). `REPLICATED` (widely re-run).
- **What it reveals.** (1) Long context is not memory: having the evidence in the window loses a
  third of accuracy. (2) The *index* matters as much as the retriever: what is extracted at write
  time bounds what can be found. (3) Time must be explicit in keys and queries. (4) By 2026 the
  benchmark is close to saturated (Hindsight 91.4%, Eywa 88.2% sufficiency), so it no longer
  discriminates cognitive state quality.

### 4.2 LoCoMo
- **Citation.** Maharana et al., *Evaluating Very Long-Term Conversational Memory of LLM Agents*,
  ACL 2024, https://arxiv.org/abs/2402.17753
- **Design.** ~300 turns, ~9k tokens, up to 35 sessions per conversation; QA (single-hop,
  multi-hop, temporal, open-domain, adversarial), event summarization, multimodal generation.
- **Results.** Long-context and RAG both well below humans, worst on temporal and causal
  dynamics. `OBSERVED`. Short enough (9k tokens) that full-context beat all memory systems in
  2025 (Mem0 paper). Vendor numbers contradict each other (§3.5); categories are inconsistently
  included. **Treat LoCoMo rankings as `CLAIMED`.**
- **What it reveals.** Benchmarks whose total history fits in a context window test retrieval
  compression, not persistent cognition.

### 4.3 MemoryAgentBench
- **Citation.** Hu, Wang, McAuley, *Evaluating Memory in LLM Agents via Incremental Multi-Turn
  Interactions*, 2025, https://arxiv.org/abs/2507.05257
- **Design.** Four competencies: accurate retrieval (AR), test-time learning (TTL), long-range
  understanding (LRU), selective forgetting / conflict resolution (SF); long-context, RAG
  (simple, embedding, structure-augmented) and agentic memory agents.
- **Results.** Best AR: HippoRAG-v2 65.1%; best TTL 53.9% (Claude-3.7-Sonnet long context);
  best LRU 66.2% (GPT-5-mini); SF single-hop best ~60%; **multi-hop conflict resolution ≤ 28%
  for every method**. RAG helps AR but hurts LRU. No method masters all four. `OBSERVED`.
- **What it reveals.** Retrieval-optimized memory and understanding-optimized memory trade
  against each other; **revision under conflict is the unsolved competency**, especially when the
  conflict is reached by inference, not string match.

### 4.4 PrefEval (lifelong personalization)
- **Citation.** Zhao et al., *Do LLMs Recognize Your Preferences? Evaluating Personalized
  Preference Following in LLMs*, ICLR 2025 (oral), https://arxiv.org/abs/2502.09597
- **Design.** 3,000 preference–query pairs, 20 topics, explicit and implicit preferences, up to
  100k tokens.
- **Results.** Zero-shot preference-following accuracy < 10% after 10 turns (~3k tokens) in
  nearly all models (o1-preview ~50%); at 300 turns even reminder prompting yields 2–23%.
  `OBSERVED`.
- **What it reveals.** Stated preferences in history are not *applied* — a preference must be
  promoted from episode to an always-applicable, typed constraint (a durable policy object), not
  left for similarity retrieval to surface.

### 4.5 STALE (implicit invalidation)
- **Citation.** *STALE: Can LLM Agents Know When Their Memories Are No Longer Valid?*, 2026,
  https://arxiv.org/abs/2605.06527
- **Design.** 400 scenarios / 1,200 queries, contexts to 150k tokens; Type I co-referential
  updates (moved city without saying "I moved") and Type II *propagated* invalidation (leg injury
  invalidates cycling-commute belief); probes: state resolution, premise resistance, implicit
  policy adaptation.
- **Results.** Best LLM (Gemini-3.1-pro) 55.2% overall; **most memory frameworks < 10%**;
  recognition ≠ application (Qwen3.5-27B 76% state resolution vs 39% policy adaptation);
  premise compliance (Gemini 92% state resolution vs 30% premise resistance); Type II harder
  (92 → 69). **CUPMem — write-side adjudication marking memories active / stale / unresolved
  before query time — lifts GPT-4o-mini from 8.7% to 68.0%.** `OBSERVED` (single group, but a
  large, clean effect).
- **What it reveals.** The strongest single piece of evidence in this pass for the thesis
  *"beyond retrieval"*: **staleness must be adjudicated at write time and stored as state**;
  read-time retrieval cannot discover that a memory is invalid when nothing in the query or the
  new evidence lexically matches it. Invalidation must *propagate through dependencies*.

### 4.6 Long-context degradation
- **Citations.** Liu et al., *Lost in the Middle*, TACL 2024, https://arxiv.org/abs/2307.03172 ;
  Hsieh et al., *RULER: What's the Real Context Size of Your Long-Context LMs?*, COLM 2024,
  https://arxiv.org/abs/2404.06654
- **Results.** U-shaped accuracy by position of relevant evidence (middle worst); effective
  context length on RULER is well below advertised length for most models. `REPLICATED`.
- **What it reveals.** The context window is a lossy, position-biased working memory; it
  cannot be the record (CLAUDE.md anti-pattern confirmed empirically).

### 4.7 What the benchmark landscape as a whole shows
**Evidence.** (a) Conversational-recall benchmarks (DMR, LoCoMo, LongMemEval) went from
discriminating to saturated in ~2 years. (b) The benchmarks that still separate systems test
*state change*: conflict resolution (MemoryAgentBench SF ≤28% multi-hop), implicit invalidation
(STALE <10% for memory frameworks), preference application (PrefEval), and test-time learning
(TTL ~54%). (c) No mainstream benchmark tests restart, model swap, forgetting-on-request,
calibration of stored beliefs, or whether memory *improved future outcomes* over weeks.
**Inference (UCI).** UCI's reality tests (restart, compaction, model swap, contradiction,
forget, compounding, long horizon) are exactly the untested dimensions — UCI will need to build
its own evaluators; public leaderboards will not certify cognitive continuity.

---

## 5. Continual learning and the move to memory

### 5.1 Catastrophic forgetting in weights
- **Citations.** McCloskey & Cohen 1989, https://doi.org/10.1016/S0079-7421(08)60536-8 ;
  Kirkpatrick et al., *Overcoming catastrophic forgetting* (EWC), PNAS 2017,
  https://doi.org/10.1073/pnas.1611835114 ; Luo et al., *An Empirical Study of Catastrophic
  Forgetting in LLMs During Continual Fine-tuning*, 2023, https://arxiv.org/abs/2308.08747 ;
  Biderman et al., *LoRA Learns Less and Forgets Less*, TMLR 2024, https://arxiv.org/abs/2405.09673
- **Results.** Forgetting is general in continual instruction tuning of 1–7B LLMs and
  *intensified with scale* in that range (Luo). LoRA forgets less than full fine-tuning but learns
  substantially less; full fine-tuning learns perturbations of 10–100× higher rank (Biderman).
  EWC/regularization partially mitigates. `REPLICATED`.
- **Invariant.** Parameter updates are a *non-inspectable, non-reversible (without snapshots),
  non-attributable* write with guaranteed interference. For a system whose laws require
  inspectable, reversible, attributable learning, weights are the wrong primary store for
  per-person/per-task learning. Weights remain the store for broad, slow, distilled competence
  (the CLS "neocortex" role) — updated rarely, by governed offline training, if ever by UCI.

### 5.2 Knowledge editing does not give coherent revision
- **Citation.** Cohen et al., *Evaluating the Ripple Effects of Knowledge Editing in LMs*
  (RippleEdits), TACL 2024, https://arxiv.org/abs/2307.12976
- **Result.** 5k edits; parameter-editing methods (ROME, MEMIT, etc.) fail to propagate edits to
  logically implied facts; **a simple in-context editing baseline scores best.** `OBSERVED`,
  consistent with later editing surveys → `REPLICATED` in direction.
- **Invariant.** Revision must be explicit and *propagated through a dependency structure*; it
  is a state operation (non-parametric), and it is the same problem STALE measures (§4.5).

### 5.3 Continual learning in memory still has a stability–plasticity dilemma
- **Citation.** *When Continual Learning Moves to Memory: A Study of Experience Reuse in LLM
  Agents*, 2026, https://arxiv.org/abs/2604.27003
- **Setup.** Frozen LLM, BM25 retrieval, sequential tasks in ALFWorld and BabyAI, 200 instances
  per phase; raw trajectories vs abstracted insights; three organization schemes.
- **Results.** Forward transfer A→B: raw −9.5% (ALFWorld), −7.5% (BabyAI); insight +6.5%, +9.0%.
  Backward transfer (BabyAI B→A): insight +3.5% vs raw −4.0%. Finer-grained insight storage gave
  best forward transfer (+15.0%) *with* severe forgetting (−10.0% BWT). Hard cases hit hardest
  (raw ALFWorld hard subset −26.1%). Interference channels: **retrieval pollution** (locally
  plausible, globally wrong procedures), **context competition**, **memory dilution** (homogeneous
  new entries bury diverse old ones — "not deleted, but buried"). `OBSERVED`.
- **Invariant.** Append-only memory *does not* escape forgetting: forgetting reappears as
  retrieval inaccessibility. So UCI must (a) consolidate near-duplicates into one strengthened
  unit (merge), (b) maintain diversity in retrieval, (c) prefer abstracted units for cross-task
  reuse while keeping raw episodes as evidence, and (d) measure backward transfer, not just
  within-task gains.

### 5.4 Agents do not faithfully use condensed experience
- **Citation.** *Large Language Model Agents Are Not Always Faithful Self-Evolvers*, 2026,
  https://arxiv.org/abs/2601.22436
- **Result.** Causal interventions across 4 self-evolving frameworks, 13 backbones, 9
  environments: agents depend on *raw* experience but "often disregard or misinterpret condensed
  experience, even when it is the only experience provided." Causes: semantic limitations of
  summaries, internal biases, tasks where pretrained knowledge suffices. `OBSERVED`.
- **Conflict.** §5.3 and Memory Transfer Learning (*Memory Transfer Learning: How Memories are
  Transferred Across Domains in Coding Agents*, 2026, https://arxiv.org/abs/2604.14004 —
  cross-domain memory +3.7% avg over 6 coding benchmarks; high-level insights transfer, low-level
  traces cause negative transfer) find abstractions *help* across tasks. Reconciliation
  (`SPECULATIVE`): raw experience is used more *faithfully* (it is concrete) but transfers worse;
  abstractions transfer better but are often *ignored*. Implication: **store both, link the
  abstraction to its supporting episodes, and measure use** (did the retrieved memory causally
  change behaviour?) rather than assuming influence.

### 5.5 Experience replay and non-destructive historical revision
- **Citations.** Rolnick et al., *Experience Replay for Continual Learning* (CLEAR), NeurIPS
  2019, https://arxiv.org/abs/1811.11682 ; Schaul et al. 2016 (PER); Kumaran et al. 2016.
- **Results.** Mixing replayed old experience with new learning sharply reduces forgetting in RL
  continual learning (`REPLICATED`).
- **Invariant.** Keep the raw experience so that *any* derived state (beliefs, skills,
  summaries) can be recomputed by a better operator later — "replay" in UCI means re-running
  interpretation over retained evidence. Non-destructive revision = new derivation version +
  supersession edge, old version queryable (event-sourcing). This is the one thing weights cannot
  do and a log can.

### 5.6 Non-parametric continual learning as the dominant 2025–26 direction
**Evidence.** HippoRAG 2's framing ("RAG to memory"), Memento ("fine-tuning agents without
fine-tuning LLMs"), AWM/ReasoningBank, Memory-R1, and the 2026 surveys (*A Survey of Agent
Memory in the Second Half*, https://arxiv.org/abs/2602.06052 ; *Memory in the Age of AI Agents*,
paper list https://github.com/Shichun-Liu/Agent-Memory-Paper-List) converge: agent-level
learning is done in external memory, with weights frozen. `REPLICATED` as a trend.
**Inference (UCI).** "Continual learning moves to memory" is correct *and* incomplete: the
problems of continual learning (interference, forgetting, negative transfer, unverified updates)
move with it. The memory layer therefore needs the machinery continual-learning research built —
replay, consolidation, backward-transfer measurement, regularized/gated updates — re-expressed as
governed state operations.

## 6. Temporal knowledge representation

### 6.1 Bitemporal data models
- **Citations.** Snodgrass & Ahn, *A Taxonomy of Time in Databases*, SIGMOD 1985,
  https://doi.org/10.1145/318898.318921 ; Jensen & Snodgrass, *Temporal Data Management*, IEEE
  TKDE 11(1), 1999 ; ISO SQL:2011 temporal tables (application-time + system-versioned periods);
  production bitemporal stores: XTDB (https://docs.xtdb.com), Datomic (accumulate-only, as-of
  queries).
- **Mechanism.** *Valid time* (when a fact is true in the modelled world) and *transaction
  time* (when the database believed it) are orthogonal. Corrections append; nothing is updated
  in place; "as-of" queries reconstruct what was believed at any past transaction time.
- **Evidence.** Decades of production use (finance, insurance, healthcare audit). `REPLICATED`
  as engineering practice. Zep (§3.4) and Hindsight (§3.11: occurrence vs mention time) import it
  into agent memory; LongMemEval's time-aware query expansion gains (+6.8–11.3% recall) are
  indirect evidence that explicit time helps retrieval.
- **Invariant for UCI.** Every belief/fact carries **valid-time interval + transaction-time
  interval**. This single primitive gives: non-destructive revision, "what did the system believe
  when it made decision D?" (replay/audit), and correct handling of retroactive corrections ("I
  actually moved in March").
- **Conflicts.** Bitemporality alone says *when* something was believed, not *how strongly* or
  *why*; it must be combined with confidence and provenance (§6.4).

### 6.2 Interval algebra and event calculus
- **Citations.** Allen, *Maintaining Knowledge about Temporal Intervals*, CACM 26(11), 1983,
  https://doi.org/10.1145/182.358434 ; Kowalski & Sergot, *A Logic-based Calculus of Events*, New
  Generation Computing 4, 1986, https://doi.org/10.1007/BF03037383 ; Shanahan, *The Event
  Calculus Explained*, 1999; McCarthy & Hayes 1969 (frame problem).
- **Mechanism.** Allen's 13 interval relations for qualitative temporal reasoning. Event
  calculus: *fluents* (time-varying properties) hold from when an event *initiates* them until
  an event *terminates* them; the *commonsense law of inertia* — a fluent persists unless
  something terminates it.
- **Evidence.** Formal; used in planning, narrative understanding, runtime monitoring.
  `REPLICATED` as formalism; no large-scale agent-memory evaluation found.
- **Invariant for UCI.** State (world state, learner state) should be modelled as **fluents
  derived from events**, not as stored mutable attributes: "Alice lives in Seattle" is
  initiated by an evidence event and terminated by a later one. This is exactly "events are the
  spine; state is a projection". STALE Type I failures are inertia failures (the system never
  registered the terminating event); Type II failures are missing *ramification* rules
  (terminating one fluent should terminate dependent fluents).

### 6.3 Belief revision and truth maintenance
- **Citations.** Alchourrón, Gärdenfors, Makinson, *On the Logic of Theory Change* (AGM),
  J. Symbolic Logic 50(2), 1985, https://doi.org/10.2307/2274239 ; Doyle, *A Truth Maintenance
  System*, AI 12(3), 1979, https://doi.org/10.1016/0004-3702(79)90008-0 ; de Kleer, *An
  Assumption-based TMS*, AI 28(2), 1986, https://doi.org/10.1016/0004-3702(86)90080-9
- **Mechanism.** AGM: expansion, contraction, revision under *minimal change* and entrenchment
  orderings (less entrenched beliefs give way first). TMS/ATMS: every derived belief records its
  *justifications* (the beliefs/evidence it depends on); retracting a support automatically
  relabels everything that depended on it (dependency-directed retraction).
- **Evidence.** Formal + classic AI systems; `REPLICATED` as theory. No LLM-memory system in this
  pass implements full justification tracking; CUPMem's active/stale/unresolved states (STALE,
  §4.5) are a partial rediscovery with a large measured effect (8.7% → 68.0%).
- **Invariant for UCI.** **Every derived belief stores its justification set** (evidence ids +
  operator + version). Invalidation of a support *propagates* to dependents, marking them
  `stale/unresolved` for re-derivation, not deleting them. Entrenchment ≈ confidence × evidential
  support × age of corroboration decides which belief yields in a conflict. This is the direct
  mechanical answer to MemoryAgentBench's multi-hop conflict failure (≤28%) and STALE Type II.

### 6.4 Temporal knowledge graphs
- **Citations.** Wikidata qualifiers (start/end time, point in time, "deprecated rank",
  references) https://www.wikidata.org/wiki/Help:Qualifiers ; Zep/Graphiti (§3.4); temporal KG
  completion literature (e.g., Leblay & Chekol, *Deriving Validity Time in Knowledge Graph*, WWW
  2018 Companion).
- **Mechanism.** Statements carry validity qualifiers, provenance references, and *rank*
  (preferred / normal / deprecated) instead of being deleted when superseded.
- **Evidence.** Wikidata: the largest collaboratively-revised knowledge base keeps deprecated
  statements with references rather than deleting them — a working example at 10^8 scale of
  "revise, never overwrite." `OBSERVED` (engineering).
- **Invariant for UCI.** Statement-level provenance + rank + validity; superseded statements
  remain queryable with an explicit *reason for deprecation*.

---

## 7. Memory formation policies — when should experience become memory?

### 7.1 Evidence on formation signals
| Signal | Source | Evidence | Tag |
| --- | --- | --- | --- |
| LLM-rated importance at write time | Generative Agents | ablation on believability only | `OBSERVED` (weak outcome) |
| Accumulated salience triggers consolidation | Generative Agents (threshold 150) | not ablated separately | `CLAIMED` |
| Bayesian surprise / prediction error segments episodes | EM-LLM; event segmentation theory (Zacks et al., Psych. Bull. 133, 2007, https://doi.org/10.1037/0033-2909.133.2.273) | beats InfLLM; matches human boundaries | `OBSERVED` / `REPLICATED` (human EST) |
| Surprise (gradient magnitude) gates neural-memory writes, with learned forgetting | Titans (Behrouz et al., 2025, https://arxiv.org/abs/2501.00663) | >2M-token needle retrieval above baselines | `OBSERVED` (parametric, in-model) |
| Prediction error required to destabilize/update | Reconsolidation (Sevenster 2013); SLIMM | animal + partial human | `REPLICATED`/`CLAIMED` |
| Schema congruence → fast integration | Tse 2007; CLS-2016 | rodent | `OBSERVED` |
| Expected future relevance boosts consolidation | Wilhelm et al., J Neurosci 2011 | human sleep studies | `OBSERVED` |
| Use frequency/recency ("heat") promotes tiers | MemoryOS; ACT-R | ACT-R strong; MemoryOS weak | mixed |
| Learned write policy rewarded by downstream QA | Memory-R1 | +48% F1 LoCoMo w/ 152 examples | `OBSERVED` |
| Outcome (success/failure) of an attempt | AWM, ReasoningBank, Memento | success-rate gains on web/SWE | `REPLICATED` (direction) |
| Write-side staleness adjudication | STALE / CUPMem | 8.7% → 68.0% | `OBSERVED` |

### 7.2 Pollution and interference — the cost side
- **Proactive interference.** Wang & Sun, *Unable to Forget: Proactive Interference Reveals
  Working Memory Limits in LLMs Beyond Context Length*, 2025, https://arxiv.org/abs/2506.08184 :
  streaming semantically related key–value updates and asking for the latest value, accuracy
  declines **log-linearly toward zero** as superseded values accumulate — same pattern across 35
  models, 0.6B–600B+; errors are retrievals of overwritten values. `OBSERVED` (large model
  sweep). **Implication: never leave superseded values in the model-visible context
  undistinguished; supersession must be resolved *before* compilation, not by the model.**
- **Retrieval pollution / dilution** (§5.3): raw procedures transfer wrong steps; homogeneous
  new memories bury old diverse ones. `OBSERVED`.
- **Over- vs under-extraction** (LangMem docs): over-extraction lowers precision, under-extraction
  lowers recall — an explicit precision/recall trade at write time. `CLAIMED` (design guidance).
- **Adversarial pollution** (§8.4): MINJA 98.2% injection via queries alone.
- **Extraction-schema loss**: Zep's regression on assistant-said facts (94.6 → 80.4) shows that
  whatever the extractor does not extract is unrecoverable *unless raw episodes are kept*.

### 7.3 Inference (UCI): a formation policy consistent with the evidence
1. **Evidence is always recorded** (cheap, faithful, append-only, with consent labels) — the
   formation question never applies to evidence, only to *derived* memory. This dissolves most of
   the "what to store" dilemma: store everything raw; be selective about *interpretation*.
   (Exception: silence/consent — the person may decline storage; that is a sovereign act.)
2. **Derived memory is formed by a separate, logged operator**, triggered by: (a) prediction
   error against current beliefs (surprise), (b) verified outcome of an action (success/failure
   with a verifier, not self-judgment), (c) explicit statement by an authority (the person says
   "remember"), (d) repeated occurrence (frequency → consolidation), (e) expected future need.
3. **Write-time adjudication**: each new derived item is checked against existing beliefs it
   could affect — including via dependencies, not only similarity — producing
   `corroborates / supersedes / conflicts(unresolved) / independent`.
4. **Congruence U-shape**: congruent items strengthen existing beliefs (merge); highly
   surprising items become *candidate* beliefs flagged for corroboration; ambiguous middle
   items stay episodic only.
5. **Formation policy is itself learnable and evaluated** (Memory-R1), but under governance,
   with ablation against a fixed baseline.

---

## 8. Forgetting, contradiction, aging, access control, privacy

### 8.1 Forgetting as adaptive function
- **Citations.** Anderson & Schooler 1991 (§1.2); Anderson, Bjork & Bjork, *Remembering can
  cause forgetting* (retrieval-induced forgetting), JEP:LMC 20(5), 1994,
  https://doi.org/10.1037/0278-7393.20.5.1063 ; Richards & Frankland, *The Persistence and
  Transience of Memory*, Neuron 94(6), 2017, https://doi.org/10.1016/j.neuron.2017.04.037 ;
  Bjork & Bjork 1992 (storage strength vs retrieval strength, "new theory of disuse").
- **Mechanism.** Richards & Frankland: the goal of memory is decision-making, not fidelity;
  transience (forgetting) improves generalization by removing outdated and overly specific
  detail. Bjork: *storage strength* (durable, only grows) vs *retrieval strength* (current
  accessibility, decays) are separate quantities.
- **Evidence.** RIF `REPLICATED` (with some failed replications for specific paradigms);
  storage/retrieval distinction widely supported. §5.3 shows the agent analogue: dilution buries
  useful memories; PI-LLM shows un-forgotten superseded values actively harm.
- **Invariant for UCI.** **Two strengths, not one**: evidence retention (storage — never decays
  unless sovereignly forgotten) and *retrieval priority* (decays with disuse, rises with
  confirmed use, suppressed by supersession). Forgetting in the default path = lowering retrieval
  priority and excluding superseded items from compilation — *never* destroying evidence.

### 8.2 Contradiction resolution
**Evidence summary.** Zep invalidates overlapping edges (LLM-judged, similarity-scoped);
Mem0 DELETEs (base) or marks invalid (graph); Hindsight lowers opinion confidence by 2α on
contradiction; CUPMem adjudicates active/stale/unresolved at write time (+59 points on STALE);
MemoryAgentBench multi-hop conflict ≤28%; PI-LLM shows the model cannot resolve accumulated
supersession itself. **Conflict across sources:** "latest wins" (Zep, Mem0) vs "confidence
arithmetic" (Hindsight) vs "unresolved is a state" (CUPMem). Latest-wins is wrong when the newer
statement is less reliable (a joke, a hypothetical, a third party, an injection).
**Inference (UCI).** Contradiction is a *typed event* producing one of: supersession (world
changed — close valid-time interval), correction (system was wrong — close transaction-time
interval, keep the error visible), or *unresolved conflict* (both retained, flagged, lowered
confidence, surfaced for verification or asked). The resolver weighs source reliability,
recency, evidential support and entrenchment (AGM) — never recency alone.

### 8.3 Aging and decay
**Evidence.** Power-law need statistics (Anderson & Schooler) `REPLICATED`; Ebbinghaus-style
exponential decay in MemoryBank/MemoryOS *unvalidated for agents* (`CLAIMED`); Generative
Agents' 0.995/hour recency decay tuned for a simulation. No agent study compares decay
functions on long-horizon outcomes. **Inference.** Use the ACT-R form (sum of power-law decayed
uses) as a *retrieval prior* computed from the access log; make validity-time expiry domain-typed
(a phone number and a mastery estimate age differently: learner-mastery beliefs should decay
toward uncertainty — forgetting curves are real for learners — while biographical facts do not).

### 8.4 Security: memory as an attack surface
- **MINJA** (Dong et al., *Memory Injection Attacks on LLM Agents via Query-Only Interaction*,
  2025, https://arxiv.org/abs/2503.03704): 98.2% injection success, 76.8% attack success with
  queries only. `OBSERVED`.
- **AgentPoison** (Chen et al., NeurIPS 2024, https://arxiv.org/abs/2407.12784): poisoning <0.1%
  of an agent's memory/RAG store with optimized triggers yields ≥80% average attack success with
  ≤1% benign-performance impact. `OBSERVED`.
- **Realistic-condition re-test** (*Memory Poisoning Attack and Defense on Memory-Based
  LLM-Agents*, 2026, https://arxiv.org/abs/2601.05504): with pre-existing legitimate memories,
  GPT-4o-mini ASR fell from 62% to 6.67%; LLM-based moderation either rejected everything (GPT-4o-
  mini) or accepted 54 malicious of 82 with perfect trust scores (Gemini-2.0-Flash). `OBSERVED`.
  Conflict with MINJA's headline numbers: attack success is highly condition-dependent.
- **EvoBreak** (*Benign Alone, Harmful Together*, 2026, https://arxiv.org/abs/2608.01759):
  individually benign distilled experiences compose into safety bypass in self-evolving agents.
  `OBSERVED` (numbers not extracted here).
- **Invariant for UCI.** (a) **Untrusted content is data**: memories derived from untrusted
  sources carry a trust label that propagates through derivation and caps their authority (they
  may inform, never instruct). (b) LLM self-moderation is not a sufficient gate — it fails both
  ways. (c) Procedural/strategy memory (which *does* change behaviour) needs the strongest gate:
  verified outcome + provenance + ablation, and composition checks (EvoBreak).

### 8.5 Access control and privacy
- **Collaborative Memory** (Rezazadeh et al., ICML 2025,
  https://arxiv.org/abs/2505.18279): private vs shared tiers; every fragment carries **immutable
  provenance** (contributing agents, resources accessed, timestamps); bipartite user–agent–
  resource permission graphs that change over time; read policies project fragments into
  *filtered views* under current permissions; retrospective permission checks. `CLAIMED`
  (formal properties, limited empirical data).
- **Unlearning.** Bourtoule et al., *Machine Unlearning* (SISA), IEEE S&P 2021,
  https://arxiv.org/abs/1912.03817 : exact unlearning requires retraining derived models from
  data minus the forgotten item; SISA shards to make that cheap. GDPR Art. 17 right to erasure.
- **Invariant for UCI.** Forgetting must be *complete across derivations*: because every derived
  item records its justification set (§6.3), `forget(evidence)` = delete evidence + cascade to
  every derivation that used it (re-derive without it or delete) + tombstone event recording that
  a forget happened (not what). This is only possible if derivations are recomputable and
  provenance is total; it is impossible for knowledge absorbed into weights (an argument for
  keeping personal learning out of weights, §5.1). Consent labels = access policy attached at
  evidence level and inherited (most-restrictive) by derivations.

---

## 9. Autobiographical memory and lifelong personalization

### 9.1 Theory
- **Citations.** Tulving, *Episodic and semantic memory*, 1972; Tulving, *Memory and
  consciousness*, Can. Psych. 26, 1985 (autonoetic awareness) ; Conway & Pleydell-Pearce, *The
  construction of autobiographical memories in the self-memory system*, Psych. Review 107(2),
  2000, https://doi.org/10.1037/0033-295X.107.2.261 ; Conway, *Memory and the self*, J. Mem.
  Lang. 53, 2005.
- **Mechanism.** Self-Memory System: an autobiographical knowledge base organized
  hierarchically (lifetime periods → general events → event-specific knowledge) and a *working
  self* — the current goal hierarchy — which gates both encoding and retrieval; memories are
  constructed, and *coherence* with the self competes with *correspondence* to what happened.
- **Evidence.** `REPLICATED` in autobiographical-memory research (reminiscence bump,
  goal-congruent recall biases).
- **Invariants for UCI.** (a) **Goals gate memory**: active goals should be part of the retrieval
  cue and the formation policy (what matters is relative to what the process/person is trying to
  do). (b) **Hierarchical episodic organization** (period → episode → detail) — the agent-side
  analogue is project/goal → process → step. (c) The coherence–correspondence tension is exactly
  "interpretation vs evidence"; UCI resolves it by keeping correspondence (evidence) immutable and
  letting coherence (the narrative/summary) be a revisable derivation.

### 9.2 Agent-side evidence
- **PersonaMem** (Jiang et al., COLM 2025, https://arxiv.org/abs/2504.14225): 180+ simulated users,
  up to 60 sessions; frontier models ~50% overall; 60–70% on recalling facts and tracking
  preference changes, **30–50% on applying the user's latest situation** to new responses.
  `OBSERVED`.
- **PrefEval** (§4.4): <10% preference following after 10 turns zero-shot. `OBSERVED`.
- **Hindsight** experience network (first-person agent biography) and opinion network with
  confidence (§3.11). `OBSERVED` (vendor).
- **Generative Agents**: relationships and plans emerged from memory + reflection; believability
  only. `OBSERVED` (weak outcome measure).
- **What it shows.** Personalization failures are *application* failures (knowing ≠ acting),
  echoing STALE's recognition-vs-adaptation gap. **Inference (UCI):** a person model must compile
  into *always-applied policy/constraints* for the relevant scope (preferences, accommodations,
  learner goals) — part of the working state — not be left to be retrieved when similar.

---

## 10. The boundary where retrieval ends and cognitive state begins

**Evidence-grounded argument.**
1. Retrieval answers "which stored items are similar/relevant to this cue?" It cannot, by
   itself, answer "is this still true?", "what follows from it?", "how sure are we?", "what are we
   in the middle of doing?", or "should this change what I do by default?".
2. Every benchmark dimension that remains unsolved in 2026 is on the far side of that line:
   implicit invalidation (STALE: memory frameworks <10%; write-side adjudication 68%), multi-hop
   conflict resolution (≤28%), applying preferences/latest situation (PrefEval <10%, PersonaMem
   30–50%), test-time learning (~54%), and proactive interference (log-linear decline to zero).
3. The interventions that fixed things moved work from read time to **write/consolidation time
   into typed state**: CUPMem's status labels, Zep's validity intervals, Hindsight's epistemic
   networks and confidence, AWM/ReasoningBank's induced procedures, Memento's learned case
   policy, sleep-time pre-computation.
4. Retrieval quality improvements (HippoRAG, fact-augmented keys, rerankers) raise recall
   ceilings but leave the above failures intact (HippoRAG-v2 leads AR at 65.1% yet no method passes
   conflict resolution).

**The boundary, stated precisely (inference, UCI).** Retrieval ends and cognitive state begins
at the point where the system must **maintain an invariant over stored items that holds
independently of any query**. Concretely, cognitive state is whatever carries one or more of:
- a **truth-maintenance status** (active / superseded / stale / unresolved / retracted) that is
  updated when *other* items change;
- an **epistemic status and confidence** (observed / inferred / assumed / told-by-X; calibrated
  probability) that changes with evidence, not with query;
- **validity in time** (valid-time and transaction-time intervals);
- **justifications / dependencies** such that change propagates;
- **commitment**: goals, plans, open questions, hypotheses under test — things the system has
  undertaken and must resume;
- **policy force**: items that apply *by default* in a scope without being retrieved (preferences,
  constraints, accommodations, skills/procedures, adaptive policy);
- **outcome linkage**: which actions/strategies led to which verified results (utility).
Anything without these is a *record* to be retrieved. Records are necessary (they are the
evidence), but a system consisting only of records plus a retriever is a search engine over its
own past, not a mind that continues.

## 11. Synthesis — the minimum set of memory / cognitive-state primitives the research supports

Each primitive lists its strongest supporting evidence. "Minimum" = removing it re-opens a
failure measured in §4–§8. All are *inference* for UCI, grounded in the cited evidence.

| # | Primitive | What it is | Strongest support |
| --- | --- | --- | --- |
| P1 | **Evidence record** | Append-only, faithful, time-stamped, provenance- and consent-labelled raw experience; never revised; the only thing forgetting may destroy, and only sovereignly | CLS fast store; MTT/TT (gist coexists with episode); Zep episodes; Eywa immutable source; Zep assistant-fact regression; agents use raw experience more faithfully (§5.4) |
| P2 | **Derivation with justification** | Every interpreted item (fact, belief, summary, skill) names its supporting evidence ids, operator, version; recomputable | Generative Agents citations; TMS/ATMS; Eywa failure attribution; unlearning cascade (§8.5) |
| P3 | **Bitemporal validity** | Valid-time and transaction-time intervals on every fact/belief; revision closes intervals, never deletes | Snodgrass; Zep; Hindsight τs/τe/τm; LongMemEval time-aware gains; Wikidata deprecation |
| P4 | **Epistemic status + confidence** | observed / reported-by-X / inferred / assumed / hypothesis; calibrated confidence updated by evidence (and by use outcomes) | Hindsight opinion network; STALE premise-compliance failures; CoALA's gap; UCI law "similarity is not truth" |
| P5 | **Truth-maintenance status with propagation** | active / superseded / stale / unresolved / retracted, set at *write time*, propagated along justifications | STALE CUPMem 8.7→68.0; MemoryAgentBench multi-hop conflict ≤28%; RippleEdits; PI-LLM (superseded values must be resolved before the model sees them) |
| P6 | **Consolidation operator (offline)** | Budgeted background process that merges duplicates, abstracts episodes into semantic/procedural items, re-derives stale items, prioritized by expected belief/policy change × future need | CLS; replay/PER; Mattar & Daw; Letta sleep-time (5×, +13/18%); dilution in §5.3 requires merge |
| P7 | **Procedural memory with outcome utility** | Workflows/strategies/skills linked to the verified outcomes of their uses; utility updated from outcomes; versioned; gated promotion | ACT-R utilities / Soar chunking; AWM (+24.6/+51.1%); ReasoningBank; Memento; memory-transfer (abstract transfers, raw negative) |
| P8 | **Durable working state (long-term working memory)** | Goals, commitments, current hypotheses, open questions, plan position, pointers into memory — the resumable task state above any session | Ericsson & Kintsch LT-WM; Conway working self; CoALA WM gap; harness study (no durable object above session) |
| P9 | **Policy-force items (defaults)** | Person model and preferences/constraints compiled into always-applied, scoped policy rather than retrieved by similarity | PrefEval (<10%); PersonaMem (30–50% applying latest situation); STALE recognition≠application; Letta always-in-context blocks |
| P10 | **Use / access log → computed retrieval priority** | Every retrieval and every *causal use* logged; strength computed (ACT-R power law), suppressed by supersession; storage strength ≠ retrieval strength | Anderson & Schooler; Bjork; ACT-R; faithfulness study (log whether memory changed behaviour) |
| P11 | **Trust / authority labels that propagate** | Source trust and consent inherited by derivations (most-restrictive); untrusted-derived memory may inform, never instruct | MINJA 98.2%; AgentPoison <0.1% → >80%; EvoBreak; Collaborative Memory provenance |
| P12 | **Typed memory operations as logged events** | observe, derive, corroborate, supersede, correct, mark-unresolved, consolidate, promote, demote, retract, forget(sovereign) — each an event with operator + authority | CoALA learning-as-action; Mem0/Memory-R1 op sets (too coarse, destructive); event calculus (initiate/terminate) |

**Retrieval** (hybrid lexical + dense + graph + temporal filters, reranking, learned selection)
is a *service over* P1–P12, not a primitive of cognitive state. It is necessary and
well-engineered in the literature; UCI should adopt it, not reinvent it.

**What is deliberately *not* a primitive.** A separate "summary" type (summaries are derivations,
P2); a "reflection" type (reflections are candidate beliefs, P4 with status `inferred`); a
hand-tuned decay constant (priority is computed from P10 with a fitted, domain-typed prior).

---

## 12. Overrated mechanisms

1. **Vector RAG as memory.** Similarity retrieval over chunks gives recall, not state: no
   validity, no supersession, no confidence, no propagation. Evidence: memory frameworks <10% on
   STALE; RAG hurts long-range understanding (MemoryAgentBench); retrieval dilution and pollution
   (§5.3); PI-LLM — placing superseded values in context degrades accuracy toward zero. Plain
   dense retrieval is nonetheless a *strong* retrieval baseline (HippoRAG 2 shows structure-heavy
   GraphRAG/RAPTOR underperform it on factual QA) — the error is calling it memory, not using it.
2. **Reflection as learning.** Generative-Agents-style reflection is evidenced only for
   *believability*; it stores unverified inferences indistinguishably from observations; condensed
   experience is often ignored by agents (§5.4); self-judged success is a poisoning and
   drift channel. Reflection is a *hypothesis generator*; learning is only what is verified
   against outcomes and shown to improve future performance (backward/forward transfer measured).
3. **Long context as memory.** −30% on LongMemEval with evidence present; lost-in-the-middle;
   RULER; PI-LLM. Long context is the working-memory focus, not the store.
4. **"Latest wins" contradiction handling.** Recency is not reliability; hypotheticals, jokes,
   third-party claims, and injections are recent too. Needs typed conflict resolution (§8.2).
5. **Knowledge graphs per se.** Graph structure helps multi-hop retrieval (HippoRAG) but Mem0g
   gained nothing on multi-hop; A-MEM's graph evolution is unprovenanced rewriting; a KG without
   validity, confidence and justification is just a differently shaped index.
6. **Biologically-styled forgetting curves.** Ebbinghaus decay constants in MemoryBank/MemoryOS are
   unablated; deleting by decay destroys evidence. What is supported is use-dependent retrieval
   priority (ACT-R) and supersession-based suppression.
7. **LLM-judged importance at write time.** Only believability evidence; LLM importance ratings are
   uncalibrated and task-agnostic. Surprise, outcome, explicit authority, and future need have
   better support.
8. **Conversational-recall leaderboards (LoCoMo, DMR, LongMemEval) as proof of memory quality.**
   Saturated, vendor-disputed (Mem0 vs Zep: 65.99 vs 75.14 vs 58.44 for the same system), and blind
   to restart, revision, forgetting, calibration, and outcome improvement.
9. **Self-editing memory by the task model alone (MemGPT pattern).** The model that does the task
   decides what to remember, with no verification; forgetting to save is silent loss. Keep the
   agent's memory tools, but add an independent consolidation/adjudication operator.

---

## 13. Unresolved — experiments UCI needs

Each is a falsifiable experiment; none is answered by the literature.
1. **Resume-after-kill fidelity.** Kill a process mid-task, clear context, swap model; measure
   time-to-productive-step and error rate vs uninterrupted run, with (a) raw history only,
   (b) history + summaries, (c) durable working state (P8). Hypothesis: (c) ≫ (b) > (a).
2. **Write-time vs read-time adjudication at scale.** Replicate STALE/CUPMem inside UCI with
   justification-graph propagation (P5) vs similarity-scoped invalidation (Zep-style). Measure Type
   II (propagated) accuracy and cost per write.
3. **Calibration of stored beliefs.** Do confidence values on beliefs (e.g., learner mastery)
   predict outcome frequencies (Brier / ECE) over weeks? No memory system reports calibration.
4. **Does memory causally change behaviour?** Counterfactual ablation of retrieved items (§5.4
   method) on UCI's own tasks; log "causal use" into P10.
5. **Abstraction level of procedural memory.** Raw vs insight vs workflow units; measure forward
   *and* backward transfer and negative transfer on hard cases (§5.3 protocol).
6. **Consolidation scheduling.** Uniform vs recency vs (expected-change × need) prioritization of
   offline consolidation budget; measure downstream accuracy per unit compute (sleep-time analogue).
7. **Decay/priority function.** ACT-R power-law prior vs exponential vs none, fitted per memory
   type, on long-horizon retrieval precision.
8. **Formation threshold.** Store-all-derive-selectively vs extract-at-write; precision/recall of
   later needs over months; storage cost.
9. **Poisoning resistance.** MINJA/AgentPoison/EvoBreak-style attacks against trust-label
   propagation (P11) and outcome-gated procedural promotion (P7).
10. **Complete forgetting.** After `forget(e)`, verify no derivation, summary, embedding, cache,
    skill, or compiled context still reflects e (the "forget" reality test), including across
    consolidations that merged e with other evidence.
11. **Coherence vs correspondence.** Do consolidated narratives/summaries drift toward schema
    (Bartlett effect) over repeated re-consolidation? Measure factual drift vs raw evidence.
12. **Learner-specific**: does modelling mastery as a decaying, calibrated belief (P3+P4+P10)
    predict retention and improve teaching decisions vs point estimates? (Education ground truth.)

---

## 14. Answers to the three questions

### Q1. What must persist for *cognition* (not just execution) to resume after process kill, context clear and model swap?

Execution resumption needs the event log, tool-call settlement, and the message record — the
harness study shows these exist. Cognition additionally needs the following, all **model-
independent and typed** (so a different model can read them), all **outside the context window**:

1. **Durable working state (P8)** — goals and their status; commitments made to the person;
   current plan and position in it; *hypotheses currently held and under test*; open questions;
   what was just learned but not yet consolidated; pointers to the relevant beliefs/skills. This
   is Ericsson & Kintsch's long-term working memory: the retrieval structure that makes
   interruption cheap. Without it a new model re-derives intent from transcript — lossy and
   model-dependent (LongMemEval: −30% with the evidence present).
2. **Beliefs with status (P3, P4, P5)** — what is currently believed true, with valid-time,
   confidence, epistemic origin, and truth-maintenance status, so the resuming model does not
   re-believe superseded facts (PI-LLM) or treat inferences as observations.
3. **Justifications (P2)** — so the resuming model can check *why* a belief is held and re-derive
   it if its operator improved or its evidence changed.
4. **Procedural memory with utilities (P7) and policy-force items (P9)** — how this kind of work
   is done well *here*, and the person's standing preferences/constraints — applied by default,
   not rediscovered.
5. **Evidence (P1)** with provenance — so everything above can be recomputed if the derived state
   is corrupt or the new model interprets differently (replay).
6. **The compilation manifest** — what the previous model was shown, so behaviour differences
   after a swap can be attributed to the model rather than the context ("model-visible means
   logged").
Test: the restart/compaction/model-swap reality tests pass when a fresh model, given only a
compiled context from (1)–(6), takes the same next step class (or a justified better one) at no
worse error rate than the uninterrupted process (experiment 13.1).

### Q2. When should experience become memory?

Separate the question into two levels (the CLS answer):
- **Always, as evidence.** Every experience is recorded faithfully with provenance and consent
  labels at the moment it occurs (cheap, append-only). Exceptions are sovereign: the person's
  "don't store", consent scope, or a policy of silence. Evidence: extraction-schema loss (Zep
  regression) and faithful use of raw experience (§5.4) make pre-filtering evidence a mistake.
- **Selectively, as interpretation (belief, skill, profile, policy).** Promote from evidence to
  derived memory when at least one of these holds, via a logged operator:
  1. **Prediction error** — it contradicts or is not predicted by current beliefs (surprise:
     EM-LLM, reconsolidation, SLIMM). → candidate belief / supersession / unresolved conflict.
  2. **Verified outcome** — an action's outcome was checked by a verifier independent of the
     actor (not self-judgment). → procedural utility update, strategy induction (AWM/ReasoningBank
     with real verification).
  3. **Authority** — the person (or an authorized source) asserts it or says "remember this".
     → high-trust fact/preference; policy-force if it is a standing preference.
  4. **Repetition / corroboration** — the same pattern recurs across independent episodes
     (frequency; CLS interleaving). → consolidation into semantic/procedural memory.
  5. **Expected future need** — it bears on an active goal or predictable future query (working
     self; Wilhelm 2011; sleep-time predictability). → prioritized consolidation.
  Schema-congruent items are merged into existing beliefs as corroboration (strengthen);
  surprising items become *candidates* until corroborated or verified; ambiguous items stay
  episodic only. Formation happens at write time for adjudication (status, conflicts) and in
  background consolidation for abstraction (LangMem hot-path vs background split).

### Q3. How should memories strengthen, decay, merge, split, contradict and be reinterpreted?

- **Strengthen.** Two separate quantities: *confidence* (epistemic — rises with independent
  corroborating evidence and verified successful use; Hindsight-style reinforcement but with
  calibration) and *retrieval priority* (accessibility — rises with causal use, ACT-R power law).
  Retrieval alone should not raise confidence (retrieval is not evidence; reconsolidation needs
  prediction match to confirm).
- **Decay.** Retrieval priority decays with disuse (power law, domain-typed prior); confidence
  decays only where the world plausibly changes (e.g., learner mastery decays toward
  uncertainty; birthplace does not) — decay of confidence is a modelled belief about change, not a
  clock. Evidence never decays; it is only sovereignly forgotten.
- **Merge.** Consolidation merges near-duplicate derived items into one unit with the *union* of
  justifications and a corroboration count (counters dilution, §5.3; mirrors CLS
  abstraction). Merge is an event; the merged-from items remain addressable. Never merge on
  embedding similarity alone — require entity/claim identity adjudication.
- **Split.** When evidence shows one belief conflates distinct entities/contexts (two people named
  Alex; a preference that holds at work but not at home), split into scoped beliefs, partitioning
  justifications; record the split event. (No system in this pass implements split — an open gap;
  `SPECULATIVE` necessity inferred from entity-resolution errors in Zep-style graphs.)
- **Contradict.** A typed event resolved as (a) *supersession* — world changed; close valid-time;
  (b) *correction* — system was wrong; close transaction-time, keep the error visible; or
  (c) *unresolved* — keep both, lower confidence, surface for verification or ask. Propagate to
  dependents via justifications (stale → re-derive). Resolution weighs source trust, evidential
  support, entrenchment and recency — never recency alone.
- **Reinterpret.** Because evidence is kept and derivations are versioned, a better operator
  (new model, new schema, new ontology) can re-run interpretation over old evidence, producing new
  derivation versions that supersede old ones with the operator change as the recorded reason.
  This is replay (CLS/CLEAR) made exact — the capability weights cannot offer, and the core
  reason the substrate, not the model, is the durable object.

---

## 15. Source index (status roll-up)

| Status | Sources |
| --- | --- |
| `REPLICATED` | ACT-R activation / Anderson & Schooler; working-memory capacity & LT-WM; CLS + catastrophic interference; replay & sleep consolidation; schema distortion (Bartlett); lost-in-the-middle / RULER; catastrophic forgetting in LLM fine-tuning; knowledge-editing ripple failure (direction); experience replay in CL; bitemporal DB practice; procedural/experiential memory improves agent success (AWM, ReasoningBank, Memento — direction); HippoRAG retrieval strength; non-parametric CL trend; LongMemEval long-context drop |
| `OBSERVED` | MemGPT DMR; Letta sleep-time compute; Generative Agents ablation (believability); Zep LongMemEval incl. regressions; MemoryAgentBench; STALE + CUPMem; PrefEval; PersonaMem; PI-LLM proactive interference; When-CL-Moves-to-Memory; faithfulness study; memory transfer learning; Hindsight; Eywa; Memory-R1; EM-LLM; Titans; MINJA; AgentPoison; realistic poisoning re-test; EvoBreak; Tse 2007 schemas; reconsolidation prediction-error requirement |
| `CLAIMED` | CoALA (framework); Mem0 LoCoMo ranking and the Zep/Mem0 counter-claims; A-MEM ranking; MemoryBank forgetting curve; MemoryOS gains; LangMem and Cognee design claims; Collaborative Memory (formal, little empirical); SLIMM U-shape in humans |
| `SPECULATIVE` | Reconciliation of raw-vs-abstract faithfulness conflict (§5.4); necessity of *split* operations; all UCI primitive mappings and answers in §10–§14 (inference from the above, awaiting UCI's own experiments) |
