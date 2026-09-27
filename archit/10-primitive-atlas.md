# 10 — Primitive Atlas

> The bridge between evidence and implementation. Each entry is a candidate **primitive**: a mechanism that preserves an
> invariant, recurs across problems, and would cause a meaningful capability loss if removed.
>
> **Source classes:**
> - **§A** — reference-derived: seen in the archaeology.
> - **§B** — UCI-derived: needed for the execution→cognition bridge, with no reference implementation.
> - **§C** — research-derived: from external research, see `research/`.
> - **§D** — unresolved.
>
> **Statuses** (see `README.md`): OBSERVED · REPLICATED · STRONG HYPOTHESIS · OPEN HYPOTHESIS · EXPERIMENTAL · ADOPTED ·
> REJECTED · SUPERSEDED · UNKNOWN.
>
> **ADOPTED** means the architecture commits to the invariant. It is *not* a claim that UCI implements it; only code and
> tests can say that (CLAUDE.md §2).
>
> **Format.** Each primitive is written as a compact card. The line "*Seen in*" lists the independent implementations;
> "*Alternatives*" lists competing designs and trade-offs; "*Without*" states the failure when the primitive is absent.

---

## A. Reference-derived primitives

### PA-01 Durable-record step (stateless step)
- **Problem solved:** process death, compaction and model swap losing in-flight cognition.
- **Seen in:** OC (step re-reads projections, `llm.ts:214`); DSH (request fold, `agent.ts:553-619`); EVE (pure `StepFn`
  + journaled steps); HER (canonical replay of exact bytes).
- **Invariant:** nothing the model will see next lives only in process memory.
- **Without:** SWE; restart loses the instance (`A-SWE T9`).
- **Alternatives:**
  - projections (OC) — cheap reads; needs rebuildable projections;
  - log fold (DSH) — strongest reconstruction; whole log in memory;
  - SDK step journal (EVE) — transparent; vendor-coupled.
- **UCI interpretation:** execution-floor invariant **E1**. Implementation-neutral.
- **Minimal implementation:** step = function(durable records) → proposals.
- **Experiment:** the restart reality test.
- **Status:** **ADOPTED** (REPLICATED 4+/7).

### PA-02 Call-before-effect, settle exactly once, honest unknown
- **Problem solved:** a crash between an action and its record causing double effects, or lost evidence of effects.
- **Seen in:** DSH (`repair.ts:29-135`: TOOL_NOT_STARTED vs OUTCOME_UNKNOWN); OC (terminal-once plus a drain-start
  sweep); HER (`effect_disposition`, allow-list classification); PRM (fsynced intent journal,
  `command_result_uncertain`); EVE (receipts accepted only from the recorded run).
- **Invariant:** an effect is never both unrecorded and possibly done; every call reaches exactly one terminal.
- **Without:** HER #49201 (an infinite restart loop re-running a destructive command); OHS client tools
  (acknowledged before the effect).
- **Alternatives:**
  - disclose and never replay (DSH/OC/HER/PRM) — safe; reconciling the world is left to the model;
  - receipts (EVE) — duplicates are harmless; needs deterministic addresses everywhere;
  - reset the whole attempt (SWE) — simple; no continuity.
- **UCI interpretation:** **E2**. UCI adds an effect ledger with attempt identity, effect classes, and receipt
  acceptance where possible (`09`).
- **Experiment:** H-RT1 — disclosure vs receipts vs combined, under injected crashes.
- **Status:** **ADOPTED** (REPLICATED 5/7); the combined form is **OPEN HYPOTHESIS**.

### PA-03 Durable admission separate from execution
- **Problem solved:** concurrent input (people, children, schedules, completions) racing a running step.
- **Seen in:** OC (durable inbox; steer/queue; control items as barriers); DSH (inbox as splice events); EVE (hook
  mirror; ordered interrupts; boundary admission; cohort folding); PRM (legal-transition table; rollback only with proof
  of non-durability — but held in memory).
- **Invariant:** input is durable before any execution decision and is applied only at safe boundaries; never lost,
  never mid-exchange.
- **Without:** duplicated or lost input across compaction, retry and restart (`A-PRM C4`).
- **UCI interpretation:** **E3**; the process inbox with typed items.
- **Status:** **ADOPTED**.

### PA-04 Ownership fenced at commit
- **Problem solved:** split brain; interleaved writers.
- **Seen in:** DSH (kernel lock, no expiry); HER (lease checked *inside* every write transaction); EVE (hook-token
  uniqueness); OC (claim + registration lock, no fencing); PRM (lease; pid + start id).
- **Invariant:** one writer per process and scope; the fence is checked where the write commits.
- **Without:** HER incident history — advisory pre-write checks failed repeatedly (`A-HER §28.3`).
- **Status:** **ADOPTED**.

### PA-05 View as provenance-bearing projection
- **Problem solved:** bounded context without destroying evidence.
- **Seen in:** DSH (replace-cites-sources; bracketed compaction); OHS (`forgotten_event_ids`); HER (soft archive + FTS +
  recall eval); OC (read boundary).
- **Invariant:** a context replacement names what it shadows; the shadowed evidence persists.
- **Without:** EVE (compaction overwrites history, `A-EVE §23.1`).
- **UCI interpretation:** **E5**; generalized into the attention manifest (PB-04).
- **Status:** **ADOPTED**.

### PA-06 Child as durable process; notification return; quiescence
- **Problem solved:** delegation that survives restarts and does not flood the parent's context.
- **Seen in:** DSH, OC, PRM (full `AgentSession` children, a spawn ledger, continuation held until descendants settle),
  EVE (cohort folding), HER (durable outcome records).
- **Invariant:** spawn returns a handle; results arrive as typed notifications; a parent's continuation waits for
  descendant quiescence.
- **Without:** re-prompting a parent that has delegated; lost results.
- **Status:** **ADOPTED** (E6). Quiescence holding is **OBSERVED** in PRM only → **STRONG HYPOTHESIS**.

### PA-07 Authority attenuation recorded in the child
- **Problem solved:** children escalating, or rebuilding under a different policy after a restart.
- **Seen in:** DSH (captured synchronously; approval pinned; written into the child's log). EVE (budget split by
  fan-out; `rootOnly`) and HER (toolset subset) are weaker. **Absent:** OC (not a subset), PRM (full inheritance).
- **Invariant:** a child's authority is a subset of its parent's, reconstructable from the child's own record.
- **Status:** **ADOPTED** (UCI A7 + evidence); the recorded-in-child form is **OBSERVED** (DSH).

### PA-08 Identity ≠ ownership ≠ replay unit; code rebuilt, state restored
- **Problem solved:** surviving deploys and model swaps without migrating live work.
- **Seen in:** EVE only (`A-EVE §19.2-19.3`). PRM's durable identity + optional residency is related (`A-PRM §28.4`).
- **Invariant:** state persists and behaviour is recompiled from current code each step; only settled state moves
  between owners; unknown eligibility means skip.
- **Without:** deploys stranding or corrupting live sessions; checkpoints coupled to code (OHS legacy classes).
- **Status:** **OBSERVED** → adopted as **STRONG HYPOTHESIS** (single source, but a deep primitive).

### PA-09 Typed failure → recovery class
- **Problem solved:** retry storms and blind retries.
- **Seen in:** OC (delivery / operation / recovery); EVE (error catalog); HER (30 FailoverReasons); SWE (parser
  exceptions with repair prompts).
- **Invariant:** every failure is classified before any recovery is chosen; budgets are typed and separate.
- **Status:** **ADOPTED**.

### PA-10 Exact-input derivability
- **Problem solved:** "what did the model see?" after the fact.
- **Seen in:** DSH (fold + equality check); HER (exact bytes).
- **Invariant:** the request is reconstructable exactly from durable records.
- **UCI interpretation:** "model-visible means derivable" (`05` §4).
- **Status:** **ADOPTED**.

### PA-11 Provenance-gated producer state
- **Problem solved:** opaque, model-specific artifacts (reasoning signatures, native compaction) breaking model swap.
- **Seen in:** OC only (`A-OC §19.5`).
- **Invariant:** producer-specific artifacts are replayed only to their producer and degrade to neutral text otherwise.
- **Status:** **OBSERVED** → **STRONG HYPOTHESIS** (it directly serves the model-swap test).

### PA-12 Content-addressed instruction history
- **Problem solved:** silent prompt drift; cache loss on instruction edits.
- **Seen in:** OC (instruction blobs + epochs + frozen deltas); PRM (fingerprinted digest); DSH (system prompt as a
  surface node).
- **Invariant:** instruction changes are versioned history, not rewrites.
- **Status:** **REPLICATED** in form → **ADOPTED** as part of context compilation.

### PA-13 Reflection persistence isolation
- **Problem solved:** reflective processes corrupting the record they reflect on.
- **Seen in:** HER (review fork: same cache, no persistence writes, dispatch whitelist; the curator-takeover incident is
  the proof of need).
- **Invariant:** background reflection writes only proposals, never the live record.
- **Status:** **ADOPTED** (the incident evidence is decisive).

### PA-14 Harness-observed verification signal with staleness
- **Problem solved:** self-reported success.
- **Seen in:** HER (exit-code ledger, edit-relative staleness, stop gate); PRM (worktree-fingerprinted gates); OHS
  (post-condition check); DSH (workspace oracle, test tier).
- **Invariant:** completion requires an observed signal fresher than the last relevant change.
- **UCI interpretation:** every environment declares at least one harness-observed outcome signal.
- **Status:** **REPLICATED** in narrow form → **ADOPTED** as a requirement; the generalization to non-code domains is
  **OPEN**.

### PA-15 Continuity notices to the model
- **Problem solved:** a model resuming with false assumptions about what survived.
- **Seen in:** PRM (`[python-state-restored]`, worker-interrupted notice); DSH (crash-closer text); HER (unknown-effect
  rows).
- **Invariant:** after any discontinuity, the model is told what survived, what was lost, and what is uncertain.
- **Status:** **REPLICATED** → **ADOPTED** (becomes part of working-state projection metadata).

### PA-16 Requery on a temporary history (clean/complete split)
- **Problem solved:** repair noise polluting the working context.
- **Seen in:** SWE (`agents.py:818-821`); HER failed-turn closure; DSH repair.
- **Invariant:** repair attempts are recorded in evidence, excluded from the working view.
- **Status:** **REPLICATED** in form → **ADOPTED**.

### PA-17 Durable identity + optional residency
- **Problem solved:** long-lived processes without long-lived memory cost.
- **Seen in:** PRM (passivation, lazy hydration); related to EVE ownership. Actor-systems research (`R4`).
- **Status:** **OBSERVED** → **STRONG HYPOTHESIS**.

### PA-18 Validation at write, not read
- **Problem solved:** corruption discovered late.
- **Seen in:** DSH (append validation I2–I9); OC (projectors die on inconsistent transitions).
- **Status:** **ADOPTED**.

### PA-19 Shrink-only mechanical invariant guards
- **Problem solved:** architectural drift.
- **Seen in:** EVE (23 guards); DSH (verify scripts). Counter-evidence: stale baselines (EVE DRIFT 3) and invariants
  switched off (DSH D1).
- **Status:** **ADOPTED** (UCI §37), with the caution that guards must run where users run.

---

## B. UCI-derived primitives (the bridge; no reference implementation)

### PB-01 Claim (unified epistemic object)
- **Problem solved:** no epistemic status on anything (C2); predictions, verification, diagnoses and competence scattered
  across four mechanisms.
- **Invariant:** I-C1…I-C6 (`03` §2).
- **Without:** transcript-as-belief; inference laundered into fact.
- **Alternatives:**
  - separate stores per kind (rejected for duplication, `03` E-EP5);
  - graph-only knowledge (rejected — edges without provenance).
- **Minimal implementation:** a versioned claim record with origin, standing, confidence, validity and evidence links.
- **Experiment:** E-EP5.
- **Status:** **STRONG HYPOTHESIS** (research support in `R1`, `R2`).

### PB-02 Expectation → resolution loop
- **Problem solved:** unmeasurable adaptation; no calibration; no surprise signal (C6).
- **Invariant:** every consequential decision declares expectations; every expectation resolves or expires explicitly.
- **Minimal implementation:** expectation claims bound to decisions; the verification fabric emits resolutions.
- **Experiments:** E-EP1, E-EP4, H-EC2/3.
- **Status:** **STRONG HYPOTHESIS** — the central bet of this pass.

### PB-03 Decision record
- **Problem solved:** no *why* (C5/C6); no credit assignment.
- **Invariant:** an action cites a decision; a decision cites claims and declares expectations.
- **Experiment:** E-EP3 (revision propagation).
- **Status:** **STRONG HYPOTHESIS**.

### PB-04 Attention manifest
- **Problem solved:** no record of why the model saw what it saw.
- **Invariant:** I-A1…I-A4 (`05` §3).
- **Experiments:** E-CA1, E-CA2.
- **Status:** derivability plus recorded reasons and exclusions **ADOPTED** (UCI A6); transformations, propensities,
  and causally faithful reasons **STRONG HYPOTHESIS**.

### PB-05 Adaptation record with predicted effect
- **Problem solved:** reflection mistaken for learning.
- **Invariant:** I-L1…I-L4 (`07` §2).
- **Experiments:** E-LV1, E-LV2.
- **Status:** **STRONG HYPOTHESIS**.

### PB-06 Working-state projection
- **Problem solved:** resuming execution without resuming cognition.
- **Invariant:** the working state equals a recomputation from authorities; model-independent.
- **Experiments:** E-PCS1, E-PCS2.
- **Status:** derived, never a second authority — **ADOPTED** (UCI A5, A18); the minimal authoritative set (only plan
  position and focus process-local) — **STRONG HYPOTHESIS** (revision of the prior "durable object" formulation).

### PB-07 Competence claim / empirical self-model
- **Problem solved:** no self-knowledge (C8); autonomy granted globally.
- **Invariant:** autonomy in condition C requires supported competence in C.
- **Experiments:** E-EP2, E-LV4.
- **Status:** **STRONG HYPOTHESIS**.

### PB-08 Divergence-bounded re-think
- **Problem solved:** evaluating adaptations without live risk, and without mistaking replay for reality.
- **Invariant:** post-divergence results are expectations, never observations (`06` §3).
- **Experiments:** E-RS2, E-RS3.
- **Status:** **STRONG HYPOTHESIS**.

### PB-09 Entity-scope cognitive state
- **Problem solved:** no durable object above the session (C1).
- **Invariant:** long-lived goals, commitments and claims belong to an entity (person environment, project, agent
  identity) that outlives processes.
- **Status:** **STRONG HYPOTHESIS**.

### PB-10 Cognitive transaction (staged cognitive commit)
- **Problem solved:** consequential cognitive changes — mastery, promoted skills, beliefs the person relies on —
  adopted before their outcome is known, then corrected only after others have acted on them.
- **Invariant:** a consequential cognitive change is staged — visible inside its transaction, invisible to the rest of
  the substrate — until a resolution verifies it; a transaction that fails verification leaves no committed trace.
- **Evidence:** none in the references (no studied system stages cognitive state); motivated by database transactions
  and by the external-effect discipline, which is ADOPTED separately (PA effect ledger).
- **Experiment:** E-CT1 (`12`).
- **Status:** **STRONG HYPOTHESIS** (UCI §15, companion §32).

---

## C. Research-derived primitives

Each is grounded in `research/R1–R4`; evidence rows are in `13-research-evidence-map.md`.

### PC-01 Truth-maintenance status with justification propagation
- **Problem:** memories go stale unnoticed (memory frameworks <10% on STALE); edits don't propagate (≤28% multi-hop).
- **Mechanism:** status (active / superseded / stale / unresolved / retracted) set at *write time*; change propagates along recorded justifications (TMS/ATMS lineage).
- **Evidence:** `R1` §4.5, §4.3, §6.3 — STALE 8.7% → 68.0%. · **Invariant:** no superseded item reaches the model undistinguished (PI-LLM).
- **UCI interpretation:** claim status + justifications (PB-01); propagation extends to decisions (PB-03). · **Experiment:** E-MF1. · **Status:** STRONG HYPOTHESIS.

### PC-02 Two strengths (confidence ≠ retrieval priority)
- **Evidence:** Bjork storage/retrieval strength; ACT-R power-law activation (`R1` §8.1, §1.2) — REPLICATED. · **Invariant:** retrieval never raises confidence; decay never destroys evidence. · **Status:** STRONG HYPOTHESIS (E-MF3/E-MF5).

### PC-03 Policy-force items (standing defaults)
- **Evidence:** PrefEval <10% after 10 turns; PersonaMem 30–50% (`R1` §4.4, §9.2). · **Invariant:** standing preferences/accommodations apply by default in scope, visible as pinned policy in the manifest. · **Status:** STRONG HYPOTHESIS (E-MF9).

### PC-04 Procedural memory with outcome utility, gated by controlled trial
- **Evidence:** AWM/ReasoningBank/Memento gains (`R1` §3.10) *versus* budget-matched erasure of gains and SkillsBench zero-mean self-authored skills (`R2` §1.9–1.10). · **Invariant:** a procedure becomes default-on only at `verified`. · **Status:** STRONG HYPOTHESIS (E-MF4, E-LV1).

### PC-05 Verifier record
- **Evidence:** verifier quality caps learning; SWE-bench+ weak tests; DGM faked logs; METR 43× (`R2` §3, §2.5). · **Invariant:** every resolution names verifier identity, version, type, measured FPR/FNR, visibility to actor; the actor cannot write to its verifier. · **Status:** ADOPTED (as part of the resolution claim).

### PC-06 Controlled trial with placebo arm
- **Evidence:** ⅓ A/B base rate; spurious-reward gains; budget-matched baselines (`R2` §4.1, §3.4, §1.9). · **Invariant:** no adaptation reaches `verified` without cost-matched, placebo-controlled, held-out, retention-checked evaluation. · **Status:** ADOPTED (as the evaluation regime of PB-05).

### PC-07 Exposure log with inclusion propensities
- **Evidence:** off-policy estimators need propensities (`R2` §4.2); ContextCite attribution (`R3` §5.7). · **Invariant:** every model-visible artefact is logged with its inclusion probability when inclusion is randomized. · **Status:** STRONG HYPOTHESIS (part of PB-04; E-CA5).

### PC-08 Latent-ability competence model (shared by self-model and learner model)
- **Evidence:** IRT, ADeLe, METR horizons, knowledge tracing (`R2` §8). · **Invariant:** competence estimates update only from resolutions and carry uncertainty; recalibrated after model swap. · **Status:** STRONG HYPOTHESIS (E-EP6).

### PC-09 Universal evidence envelope + anchor algebra + derivation record
- **Evidence:** W3C PROV / Web Annotation / Media Fragments; operator churn and fallibility (`R3` §1–3, §7.1). · **Invariant:** every interpretation, claim and context item resolves to anchors into immutable evidence; operators are versioned and measured. · **Status:** ADOPTED.

### PC-10 Deontic pinning
- **Evidence:** compaction keeps ≈17% of constraints; 53%→10% of safety rules over 5 rounds (`R3` §6.3). · **Invariant:** constraints, authority and commitments live in the working state, never in the compactable tail. · **Status:** STRONG HYPOTHESIS (E-CA6).

### PC-11 Recorded decisions for a non-deterministic coordinator
- **Evidence:** OpenAI Agents SDK on Temporal, Vercel Workflow, MAF (`R4` §11.1). · **Invariant:** model outputs are recorded effects; replay reproduces decisions from the record. · **Status:** ADOPTED.

### PC-12 Epochs (bounded history, continue-as-new, upgrade at boundary)
- **Evidence:** Temporal limits and worker versioning (`R4` §1.1, §10.3). · **Invariant:** journals are bounded; epoch checkpoints carry authorities by reference and open UNKNOWN effects; code/policy version stamped. · **Status:** ADOPTED (sufficiency criterion OPEN: E-RA2).

### PC-13 Supervision contract with record-derived signals
- **Evidence:** OTP; Kubernetes reconciliation; MAST failure modes (`R4` §2.3, §2.6, §5.2). · **Invariant:** every process has a supervisor; stall / termination ambiguity / verification debt / budget signals are computed from the record; UNKNOWN effects reconciled before restart. · **Status:** ADOPTED.

### PC-14 Capabilities with caveats, attenuation, cascading revocation (consent as root)
- **Evidence:** confused deputy; seL4; macaroons; CaMeL / FIDES / Progent (`R4` §7). · **Invariant:** authority designates specific resources; delegation only narrows; revocation cascades. · **Status:** ADOPTED (consent-as-root STRONG HYPOTHESIS).

### PC-15 Metering + budgets + outcome linkage (the economic substrate)
- **Evidence:** VOC theory; adaptive compute ≥4×; routers/cascades; cache economics; *absence* of predicted-vs-realized logging everywhere (`R4` §8–9, §11.4). · **Invariant:** every effect records cost against a budget on a capability; consequential steps record predicted and realized value. · **Status:** ADOPTED (kernel measurement); allocation policies EXPERIMENTAL.

---

## D. Unresolved primitives

| ID | Question | Why unresolved |
|---|---|---|
| PD-01 | Is a *capability graph* a primitive, or just composition manifests? | No reference implementation; no evidence of value (E-LV5) |
| PD-02 | Is a *typed working state* better than a persistent untyped namespace (PRM) for open-ended work? | PRM shows the namespace's power for data-heavy work; typing may lose generality |
| PD-03 | Is an explicit *resource/attention ledger* a primitive, or a projection of budgets + usage attribution? | See `09` |
| PD-04 | Should *simulation fidelity* be a first-class claim per environment? | Depends on world-model maturity |
| PD-05 | Is *memory formation value* learnable from meta-memory outcomes in practice? | No system measures it (`04`) |
| PD-06 | What is the harness-observed outcome signal for domains where the outcome is a change in a person? | Education depends on it; `07` E-LV3 |

---

## E. Summary: what the atlas says

- **ADOPTED (architectural commitments, pending implementation evidence):** PA-01…PA-05, PA-09, PA-10, PA-12, PA-13, PA-15, PA-16, PA-18, PA-19, PC-05, PC-06, PC-09, PC-11–PC-15.
- **STRONG HYPOTHESES (the bet of this pass):** PB-01…PB-09 (the bridge), PA-06 quiescence, PA-08, PA-11, PA-17, PC-01…PC-04, PC-07, PC-08, PC-10.
- **OPEN / UNRESOLVED:** PD-01…PD-06.
- **REJECTED as primitives:** "reflection" as a memory kind; summaries as a separate kind; graphs as cognition; hand-tuned decay constants; latest-wins contradiction handling; LLM-judged importance as the formation signal; long context as memory (evidence: `R1` §12, `R3` §3.2).
