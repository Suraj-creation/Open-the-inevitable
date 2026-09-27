# 00 — Architecture Evolution Record

> **What this is.** The explicit record of how this research pass changed the UCI architecture. For each prior claim it
> gives:
> - the decision: preserve, strengthen, generalize, weaken, relocate, split, merge, experimentally test, or reject;
> - the evidence behind the decision;
> - the resulting status.
>
> The two main documents in this folder integrate these decisions. This file records *why*.
>
> **Pass.** 2026-09, after the source-level archaeology of seven reference harnesses
> (`Reference-Architecture-Observatory/archaeology/`) and four research notes (`research/R1–R4`).

---

## 1. The central finding that drove the pass

> Current agent systems have converged, independently and in source code, on the substrate for **persistent
> execution**. None has a substrate for **persistent cognition**.

The minimum addition this pass proposes — a STRONG HYPOTHESIS; see `01` — is four record types on top of the execution
floor:

- **claims**: one epistemic object, covering assertions, expectations, resolutions, diagnoses and competence;
- **decision records**: why an action was taken;
- **attention manifests**: why the model saw what it saw;
- **adaptation records**: changes carrying a predicted effect, evaluated by controlled trial.

Alongside these come two invariants:
- consequential decisions declare expectations;
- every expectation resolves or expires.

The **working state** is redefined as a projection over these records.

Research refined the bet. The resolution loop is the atom of *calibration*, and a necessary but not sufficient input
to *learning*. Learning also requires controlled comparison (`R2` §10.3).

---

## 2. The eighteen prior claims

| # | Prior claim | Decision | New formulation | Evidence | Status |
|---|---|---|---|---|---|
| 1 | "Events are the spine; state is a projection." | **Generalize** | *Durable, unconditional causal provenance for every cognitively consequential transition; every view rebuildable.* The event log is one realization, not the law. | Continuity arises from a log (DSH), projections with commit hooks (OC), step journals (EVE) and row sidecars (HER). OC's optional log shows the failure mode when the record becomes a flag (`A-OC §28.4`). Durable-execution practice mixes journals, snapshots, epochs and upcasting (`R4` §10). | ADOPTED |
| 2 | "Three memories over one log." | **Preserve regimes; sharpen contents; generalize "one log"** | Three correctness regimes: faithful, consistent, calibrated. Four object kinds: evidence, intentional/executive, claims, procedures. *Intentional state* (goals, commitments, open expectations, open questions) joins operational memory. "One log" becomes one causal-provenance contract. | CLS (fast episodic + slow generalizing); faithfulness to raw experience (`R1` §2.1, §5.4); intentional state needs exactness (`02` §3.2) | STRONG HYPOTHESIS |
| 3 | "One canonical substrate." | **Generalize** | *One semantic authority per concept.* Physical projections, indexes, caches, replicas and specialized stores may coexist. | Graph, vector and full-text stores are useful projections (`R3` §3–4). Duplicated authorities drift. | ADOPTED |
| 4 | "Working state" as a durable operational object | **Relocate / redefine** | A per-process **projection** over the authoritative cognitive set. Only plan position and attention focus are process-local authorities. | One concept, one authority; recovery is reconstruction; E1 (projection over durable records) replicated | Derived, never a second authority (A5, A18): ADOPTED · Minimal authoritative set: STRONG HYPOTHESIS |
| 5 | "Two compilations." | **Strengthen** | A five-step transformation: situation → relevance → working state (model-independent) → attention → rendering (model-specific), recorded in a manifest. | Independently rediscovered: OC `select` / `load` (`A-OC §28.6`). Selection, order and format change outcomes by 10–85% (`R3` §5). | Two compilations with a manifest: ADOPTED (preserved) · Five-step decomposition: STRONG HYPOTHESIS |
| 6 | "Model-visible means logged." | **Split** | **Derivable** (reconstructable exactly) + **explained** (reasons, exclusions, propensities, transformations, trust). | Derivability REPLICATED (DSH fold, HER bytes). Explanation absent everywhere. Off-policy learning needs propensities (`R2` §4.2). | Derivable + recorded reasons and exclusions: ADOPTED · Full explanation (transformations, propensities, causally faithful reasons): STRONG HYPOTHESIS |
| 7 | "Cognitive transactions" / "consequence is transactional" | **Split** | (a) **External effects:** settled exactly once, `UNKNOWN` disclosed, reconciled before retry, receipts where possible. (b) **Cognitive state changes** that depend on outcomes (mastery, verified beliefs, promoted skills): staged until verification resolves. | (a) REPLICATED 5/7 plus decades of durable-execution practice (`R4` §11.1). (b) No reference evidence — a UCI bet. | (a) ADOPTED · (b) STRONG HYPOTHESIS |
| 8 | "Simulation" (predictive, sandboxed, historical) | **Strengthen + constrain** | A re-execution taxonomy (re-fold, re-play, re-think, rehearsal, prediction). **The divergence law:** replay is evidence only until the first divergent action. Simulation outputs are *expectations*, never evidence. Rehearsal fidelity is calibrated. | Off-policy theory; LLM simulators fall below 1% after 10 steps (`R2` §4.2, §6.2) | STRONG HYPOTHESIS |
| 9 | "Capability graph = the self-model" | **Weaken / relocate** | The self-model is the projection of **competence claims** fitted from resolutions, as latent ability over demand dimensions — the same machinery as the learner model. A capability *graph* survives only as an optional dependency index. | No reference implementation (C8). IRT, ADeLe, knowledge tracing (`R2` §8). | Competence claims: STRONG HYPOTHESIS · Graph: OPEN |
| 10 | "A system of interacting intelligences" | **Weaken** | A descriptive vocabulary, not an architectural primitive. Each intelligence is a family of capabilities, i.e. regions of competence claims. | No executable primitive corresponds to "an intelligence" (A19) | SUPERSEDED as architecture; retained as vocabulary |
| 11 | "Society of processes" | **Strengthen** | Children as durable processes with attenuated capabilities recorded in the child. Quiescence holding. Cohort-folded results. A supervision contract. Identity ≠ ownership ≠ residency. Multi-agent use as a per-task-class spending decision. | E6 replicated; DSH attenuation; PRM quiescence; EVE cohorts; MAST; Anthropic vs Cognition (`R4` §5) | ADOPTED core; multi-agent use OPEN |
| 12 | "Background cognition" | **Strengthen + constrain** | Background processes are **persistence-isolated** and write only proposals. They are priced as investments: run only when expected reuse × savings > cost, with realized reuse logged. Outcomes are durable even when the computation is not. | HER curator-takeover incident (`A-HER §28.5`); sleep-time compute (`R4` §6.1); HER durable outcome records | ADOPTED (isolation); STRONG HYPOTHESIS (pricing) |
| 13 | "Governed self-evolution" (ratchet L0–L4) | **Strengthen** | An artefact status ladder: proposed → active → effective → verified. Controlled trials with a placebo arm, cost-matched and held-out. Evaluator outside the authority envelope and invisible to the actor. Retirement. Revalidation after a model swap. | External-checker finding; SkillsBench; the ⅓ A/B base rate; spurious rewards; DGM log faking; METR 43× (`R2`) | ADOPTED |
| 14 | "Architecture as data" | **Preserve + constrain** | Durable records must be **self-describing**, interpretable without the code or plugins that wrote them: schema-level contracts and read-time upcasters. Compositions are versioned data. | DSH plugin-dependent sessions (`A-DSH §28.10`); OHS class-bound events (`A-OHS §28.8`); upcasting practice (`R4` §10.2) | ADOPTED |
| 15 | "Architectural observatory" | **Preserve** | Now concrete: the archaeology plus the research notes are its first product, maintained as a standing process with an evidence map (`13`). | This pass | ADOPTED |
| 16 | "Kernel boundary" | **Revise** | Kernel = identity; the causal-record contract with epochs and version stamping; the effect ledger; authority (capabilities with caveats, attenuation, cascading revocation, labels); leases and fencing; durable time; a supervision contract; metering and budgets; the governance hook; contracts. The unit lifecycle and scheduling *policy* move to the harness. | The test "would this make sense without AI agents?" (`R4` §11.3); every element is an OS concept with decades of evidence | ADOPTED |
| 17 | "Environment boundary" | **Strengthen** | Every environment declares:<br>• ontology, action space and observation shaping;<br>• **at least one harness-observed outcome signal**;<br>• a state readout and self-description;<br>• simulability, with fidelity;<br>• **validated evaluators**;<br>• domain ingestion rules and materialized views. | SWE interface and state probes; OHS self-description; HER / PRM / OHS observed signals; evaluator validity (`R2` §3) | ADOPTED |
| 18 | "Memory / harness boundary" | **Reconcile** | The **substrate** owns authorities and provenance: evidence, intentional/executive state, claims, procedures. The **harness** owns processes, including the formation, consolidation, verification, compilation and supervision processes, plus working-state projections. Memory operators are harness workloads; memory state is substrate. One architecture. | Consistent across `02`–`09` | ADOPTED |

---

## 3. What was added (new to UCI)

| Addition | Status | Home |
|---|---|---|
| Decision records, with alternatives and their probabilities | STRONG HYPOTHESIS | `01`, `03` |
| Expectation → resolution loop, at object level and change level | STRONG HYPOTHESIS | `01`, `03` |
| Verifier records with measured error rates and actor visibility | ADOPTED | `03`, `07` |
| Truth-maintenance status with justification propagation, including to decisions | STRONG HYPOTHESIS | `03`, `04` |
| Policy-force items (standing defaults) | STRONG HYPOTHESIS | `04` |
| Two strengths: confidence ≠ retrieval priority | STRONG HYPOTHESIS | `04` |
| Deontic pinning (constraints never compacted) | STRONG HYPOTHESIS | `05` |
| Entity-scope cognitive state; staleness re-validation on resume | STRONG HYPOTHESIS | `02` |
| The divergence law for replay | STRONG HYPOTHESIS | `06` |
| Latent-ability competence model shared by self and learner | STRONG HYPOTHESIS | `03`, `07` |
| Universal evidence envelope + anchor algebra; operators as measured interpretations | ADOPTED | `08` |
| Epochs, supervision contract, metering in the kernel | ADOPTED | `09` |
| Capabilities with caveats and cascading revocation; consent as a root | ADOPTED / STRONG HYPOTHESIS | `09` |
| New reality tests: cognitive resume, context causality, memory value, learning (with cost-matched baseline), capability formation, world- and self-model calibration, replay validity, longitudinal coherence, cognitive economy; compaction deepened | ADOPTED as tests | UCI §34 |

---

## 4. What was removed or moved down

These are low-level decisions removed from the vision documents. They are implementation mechanisms; they belong in
code or in this corpus, not in the constitution.

| Removed from the vision documents | Why | Now |
|---|---|---|
| Hybrid logical clocks; `cog://…@version` address syntax | Mechanisms, not invariants | Implementation choice (ordering is logical, identity is stable; §1 of the Lifelong document) |
| The ranking formula's weight list | Scaffolding; weights are learned per task | Retrieval reasons recorded in the manifest (`05`) |
| The fixed confidence-vector dimension list | Premature schema | Confidence is a vector; dimensions are a versioned vocabulary |
| The thirteen-family facet table | Indexes, not architecture | Facets are an open, versioned index vocabulary (`04` §2) |
| Canonical object shapes (former Lifelong Appendix B) | Schemas belong in code | Conceptual record contents live in `02`–`09` |
| The per-primitive harness table (former Lifelong Appendix C; Appendix B now summarizes the references) | Superseded | `10-primitive-atlas.md` |
| The eleven-row intelligences table as architecture | No executable primitive | A compact vocabulary |

---

## 5. What was rejected

Evidence: `R1` §12, `R2` §9, `R3` §3.2, and the archaeology.

| Rejected | Why |
|---|---|
| Transcript as cognitive state | It carries reasons only as prose; long context degrades |
| Retrieval memory as sufficient for cognition | Recall ≠ calibrated, maintained belief |
| Reflection as learning | Believability-only evidence; self-correction fails without feedback |
| LLM-judged gains as proof of improvement | They fail cost-matched replication |
| Latest-wins contradiction handling | Recency ≠ reliability |
| Knowledge graphs as cognition | At matched budget they are indexes |
| Hand-tuned decay deleting memories | It destroys evidence; unvalidated |
| Long context as memory | −30% even with the evidence present |
| Simulation as evidence | Multi-step LLM simulation collapses |
| Optional causal record | OC's failure mode |
| Compaction that overwrites evidence | EVE's failure mode |
| Children inheriting full authority | PRM and OC's failure mode |
| Ephemeral governance decisions | OC's failure mode |

---

## 6. What remains a hypothesis

Everything marked STRONG HYPOTHESIS or OPEN above. The consolidated register, with experiments and graduation criteria,
is `12`. The first experimental program runs:

1. cognitive resume;
2. calibration of learner and self models in education;
3. manifests;
4. write-time adjudication;
5. the controlled learning loop;
6. economics.
