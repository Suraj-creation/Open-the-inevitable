# 05 — Context and Attention

> **Question.** How should persistent state become what a model sees? How can the system later answer *"why did you
> show the model this?"*
>
> **Answer in brief.**
> - Context is the end of a **five-step transformation**, not a retrieval result: situation → relevance →
>   working-state construction → attention allocation → rendering.
> - **Derivability** of what the model saw is REPLICATED in the reference systems: DSH folds it from the log; HER stores
>   the exact bytes.
> - **Explainability** — *why* each item was included or excluded — is ABSENT everywhere. UCI adds it through the
>   **attention manifest** (STRONG HYPOTHESIS).
> - The "two compilations" hypothesis — state compilation separate from context compilation — is **independently
>   corroborated**: OpenCode's `select` / `load` split rediscovers it.

---

## 1. Evidence from the archaeology

| Mechanism | System | What it establishes | Evidence |
|---|---|---|---|
| Request = pure fold of validated log, frozen; runtime equality check | DSH | The model's input can be *derived* exactly, so model-visible ⟺ logged holds by construction | `A-DSH §19.1`, I16 |
| Surface ops: `append` / `replace` citing shadowed events; system prompt as surface node 0 | DSH | View changes are logged operations with provenance; compaction shadows, never deletes | `A-DSH §19.2`, I5–I8 |
| Exact wire bytes per row (`api_content`), content-addressed system prompts, frozen per-turn clock | HER | Byte-exact replay across restarts, surfaces and models, forced by cache economics | `A-HER §19.1` |
| `select` (which sources and tools) separate from `load` (which model and window) | OC | **Selection is independent of rendering**. This corroborates UCI's two compilations. | `A-OC §28.6`, `context.ts:45-50` |
| Content-addressed instruction values; epochs; changes as frozen chronological system messages | OC | Instruction changes become history, not silent prompt rewrites; reproducible and cache-stable | `A-OC §19.6` |
| Provider-state replay gated by exact provenance (model, route, endpoint hash) | OC | Opaque, model-specific context artifacts must be scoped to their producer | `A-OC §19.5` |
| `SystemPromptEvent.dynamic_context` logged; environment self-description block | OHS | Dynamic context must be logged; the environment should describe itself from the agent's viewpoint | `A-OHS §19.6` |
| State probes after every action, projected into template variables | SWE | The cheapest channel from world state to compiled context | `A-SWE §19 C2` |
| Fingerprinted digest re-sent only when state changes; byte-identical base prompt | PRM | Knowledge injection without cache invalidation | `A-PRM §19 C6` |
| Condensation event lists forgotten ids plus a summary | OHS | Compaction as a logged view transform | `A-OHS §19.2` |
| **Missing everywhere:** why each item was included, why others were excluded, epistemic status and staleness of included items | — | Nobody can attribute a bad decision to bad selection vs bad inference | `A-EVE §23.3`; `A-HER §23`; `A-OC §28.6` |

**Established.**
1. Deriving model input deterministically from durable records is feasible and cheap once paid for.
2. Selection and rendering separate cleanly.
3. Cache economics can be respected with stable prefixes and appended deltas.

**Not established.**
1. Whether recording *reasons* is affordable at every model call.
2. Whether attention policies can be learned from recorded reasons and outcomes.
3. How much context rot costs, compared with a compiled minimal view (`R3`).

---

## 2. The transformation

```
persistent substrate (authorities + evidence + knowledge)
   │
   ▼ 1. SITUATION       what is happening now: active goals, decisions in force, open expectations,
   │                    open questions, recent observations, environment readout
   ▼ 2. RELEVANCE       which knowledge bears on this situation: retrieval routes, epistemic filters,
   │                    staleness flags, counter-evidence, clearance
   ▼ 3. WORKING STATE   typed, model-independent projection (02 §3.1)          ← state compilation
   │
   ▼ 4. ATTENTION       budgeted allocation across working-state sections and the recent tail:
   │                    precedence, compression choices, exact vs compressed vs inferred
   ▼ 5. RENDERING       model-specific representation: format, cache-stable layout,  ← context compilation
                        provider-scoped artifacts, tool schemas
   │
   └──► ATTENTION MANIFEST (durable, before the model call)
```

**Step boundaries (STRONG HYPOTHESIS).**
- Steps 1–3 are **model-independent**. A model swap does not change them.
- Steps 4–5 are **model- and budget-dependent**. A swap re-runs them only.

This gives the model-swap reality test a precise meaning: a swap may change the rendering, but must not change the
working state (`02`).

---

## 3. The attention manifest

**Purpose.** To answer, at any later time:
- *what did the model see?*
- *why was each item there?*
- *what was left out, and why?*
- *what was stale, compressed, or inferred?*
- *what authority permitted it?*

**Contents (conceptual; the exact schema belongs in code).**

| Field | Answers |
|---|---|
| request identity, process, step, model route, rendering version, epoch | *which call, which renderer* |
| included items: address@version, **reason class** (goal-relevant / decision-cited / counter-evidence / recent / pinned / retrieved-by-route), score components | *why this* |
| per item: epistemic status, staleness flag, exact / compressed / summarized / inferred marker, compression lineage | *how trustworthy, how transformed* |
| excluded candidates: address, **reason** (budget / policy / clearance / stale / redundant) | *why not that* |
| assumptions: working-state fields taken as given without re-validation | *what was assumed* |
| clearance used | *what authority permitted access* |
| prefix hash, token counts, derivation check result | *reproducibility, cost* |

**Invariants.**

| ID | Invariant |
|---|---|
| I-A1 | A manifest is durable before its model call. It extends "model-visible means logged" to "model-visible is logged **and explained**". |
| I-A2 | The rendered request equals what the manifest plus the renderer version derives (the DSH equality check, generalized). |
| I-A3 | No included item exceeds the process's clearance (UCI §33). |
| I-A4 | Every compressed or summarized item names its source items (the DSH citation rule, generalized). |

**Cost and granularity (OPEN).**
- A manifest per model call may be large.
- Options:
  - delta manifests relative to the previous step;
  - reason classes rather than free-text reasons;
  - sampling full manifests while always keeping derivability.
- Experiment E-CA2 measures cost against explanatory value.

---

### 3.1 Manifest contents refined by research (`R3` §7.3, `R2` §10.2)

**Per item, the manifest records:**

| Field | Contents |
|---|---|
| Source | The anchor or durable id it renders: evidence id + selector, event-id range, or state field |
| Kind | Instruction, constitution, working-state field, evidence span, claim, tool result, summary |
| Inclusion reason | Pinned rule / working state / retrieved / recent event / tool output / person-provided / delegated summary |
| Retrieval detail (if retrieved) | The query and its reformulations; each retriever that returned the item, with rank and score; the fusion method; the reranker score; the cutoff |
| Transformation | Verbatim / elided with a pointer / summarized by operator@version citing the shadowed ids / compressed (method, ratio) |
| Position | Section and ordinal, and whether it sits inside the cache prefix |
| Trust and consent | Provenance class; consent label; and **data vs instruction** |
| Temporal validity | The as-of time or validity interval of the rendered fact |
| Inclusion propensity | The probability that the item would be included (see below) |

**Inclusion propensity is required to learn attention policy.** Where an artefact's inclusion is randomized for
evaluation, the manifest records the probability of inclusion. Off-policy estimates of alternative exposure policies
are only valid with logged propensities (`R2` §4.2).

**Post-hoc use attribution (sampled).** Counterfactual scores in the style of ContextCite separate what was *seen* from
what was *used*. Up to 57% of citations are post-hoc rationalizations.

**Output linkage.** Response claims link to the item ids they cite, and those resolve to source bytes, not to generated
text.

**Checkable invariant.** *Every token span in the rendered context maps to exactly one manifest item, and every manifest
item maps to a durable id.* Re-rendering from the manifest reproduces the context byte for byte. That also secures
cache stability.

**Evidence that selection, order and format are decisions, not plumbing (`R3` §5):**

| Effect | Size |
|---|---|
| Degradation from input length alone, even with perfect retrieval (18 frontier models) | 13.9–85% |
| Models falling below half their short-context score at 32K (NoLiMa) | 11 of 13 |
| Formatting alone moves accuracy | up to 40% |
| Lost-in-the-middle | can fall *below* the no-documents baseline |

The context compiler is therefore a cognitive operator, and its decisions are logged like any other act.

## 4. Derivability and explainability: two different laws

The prior UCI law "model-visible means logged" conflated two properties.

1. **Derivability.** The exact request can be reconstructed. REPLICATED in DSH (by fold) and HER (by exact bytes).
   Implementation-neutral: either mechanism satisfies it.
2. **Explainability.** The *selection* can be justified. ABSENT everywhere.

**Revision.** The law becomes: *"model-visible means derivable and explained"*.

- **Status.** Derivability: ADOPTED (replicated). Explainability: STRONG HYPOTHESIS; graduates after E-CA1/E-CA2.
- **Why keep both.** Derivability without explanation lets you replay a failure but not diagnose it. Explanation without
  derivability lets you tell a story about a request you cannot reproduce.

---

## 5. Tensions the evidence exposes

**1. Freshness vs prefix caching.**
- Compiling the working state fresh at each step breaks prefix caches, which all seven fight to preserve (`A-SYN P7`).
- The evidence-backed resolution is a **stable-first layout**: constitution and tool schemas are byte-stable; stable
  state changes only at epochs, via appended notices; volatile state comes last (HER, OC, PRM).
- Cost of the residual cache loss: OPEN (E-CA3).

**2. Minimal view vs long context.**
- Long-context models reduce the pressure to compile.
- Evidence of degradation with length ("lost in the middle", context rot; see `R3`) keeps a compiled minimal view
  valuable.
- The comparison is empirical and model-dependent, so the architecture must allow **the budget to scale with the
  model**. The absorption principle: compression heuristics are scaffolding; *explainable selection* is structure.

**3. Pre-fed context vs model-directed retrieval.**
- PRM shows code-directed retrieval: the model queries its namespace.
- SWE shows interfaces that summarize before detail.
- Both argue that attention is partly a *process action*, not only a pre-fed view. Retrieval the model asks for is
  still recorded in the manifest of the step that used it.

**4. Exact vs compressed.**
- HER's recall eval is the only measurement of what compaction loses (`A-HER §19.4`).
- Every compressed item must be marked as compressed and must cite its sources, so later decisions can see they relied
  on a summary.

---

### 5.1 What compaction loses, and the compaction test (`R3` §6.3, §7.4)

**Measured losses:**
- LLM-rewritten summaries kept only about **17% of injected session constraints**.
- A production compaction prompt kept **53% of safety rules after one round, and 10% after five**.
- Pointer-based elision with a retrievable log reached **99.4% vs 88.1%** on needle recall.
- Simple observation masking matched LLM summarization on SWE-bench at half the cost. Task metrics hide recall loss
  (a 97–99% judge score vs 58% probe recall).

*Caveat:* the 2026 compaction papers are preprints. They agree in direction.

**Consequences (STRONG HYPOTHESIS):**
1. **Deontic content — constraints, authority, commitments — is never summarized away.** It is pinned from the working
   state. It does not live in the transcript tail.
2. The **default is addressable elision**: pointer + retrievable evidence. Summaries are secondary and cite what they
   shadow.
3. The **compaction reality test is deepened**. It keeps the Hermes recall eval and generalizes it:
   - Seed typed probes before compaction: facts, exact ids, constraints, decisions with rationale, open questions,
     preferences, temporal updates, and ruled-out options.
   - Probe after at least 5 rounds.
   - Score, per type: recall, fabrication, correct abstention, and restorability through citations.
   - Report task success separately.

## 6. Reality test: context causality

**Protocol.**
1. Sample N consequential decisions from a long run.
2. For each, reconstruct from durable records alone:
   - (a) the exact model input;
   - (b) the reason each item was present;
   - (c) the candidates excluded, and why;
   - (d) which items were stale, compressed, or inferred.
3. Then perturb the selection: remove the top-reason item, and separately add a top excluded item. Re-run the decision
   with replay-rethink (`06`) to test whether the recorded reasons were *causally* relevant.

**Passes when.**
- (a)–(d) are reconstructable for 100% of sampled decisions.
- Perturbation shows that recorded high-reason items matter more than low-reason items. This is the evidence that the
  recorded reasons are not decorative.

**Status.** New test; to be added to the UCI reality tests.

---

## 7. Experiments

| ID | Experiment | Invariant | Graduation | Status |
|---|---|---|---|---|
| E-CA1 | Context-causality test (§6) in education and engineering environments | Reconstruction completeness; perturbation effect | 100% reconstruction; reasons causally predictive | OPEN |
| E-CA2 | Manifest cost: full vs delta vs reason-class manifests | Storage and latency cost vs diagnostic success on injected selection faults | A manifest variant with acceptable cost that still localizes selection faults | OPEN |
| E-CA3 | Stable-first compiled context vs append-only transcript context: cost (cache hit rate) and quality | Cost and task outcome | Compiled context within an acceptable cost band at equal or better quality | OPEN |
| E-CA4 | Compiled minimal working-state view vs full long context, across model generations | Task outcome vs context size | Identify where compilation stops paying, per model class (absorption principle) | OPEN |
| E-CA5 | Learning attention policy from manifests + resolutions (which reason classes predicted good decisions) | Improvement in decision outcomes from learned selection | Attributed improvement under held-out evaluation | EXPERIMENTAL |
