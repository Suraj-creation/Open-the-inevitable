# 11 — Architectural Gap Map

> Three columns per capability:
> 1. **References** — what the seven systems actually implement (archaeology);
> 2. **UCI (prior)** — what the UCI documents stated before this pass;
> 3. **Required** — what persistent cognition needs.
>
> The last column names the **smallest missing primitive** that closes the gap. The goal is not the most components but
> the fewest primitives that unlock the most future cognition.

---

## 1. The gap table

| # | Capability | References (implemented) | UCI (prior) | Required | Smallest missing primitive | Status |
|---|---|---|---|---|---|---|
| G1 | Persistent execution | Converged: E1–E7 (`01` §1.1) | Stated (harness §30–32), partly as mechanisms | Implementation-neutral invariants | None new. Restate E1–E7 as invariants. | ADOPTED |
| G2 | Persistent cognitive state | Absent. Transcript is the state; PRM namespace is untyped. | "Working state" as a durable object | Authoritative intentional + deliberative + epistemic set; working state as a projection | **Decision record** + **open questions** + **expectations** as authorities (PB-03, PB-02) | STRONG HYP. |
| G3 | Experience representation | Trajectories of what happened (all); exact bytes (HER); exact stream (DSH) | Events → episodes → threads → experiences | Causally linked experience (situation → manifests → decisions → actions → observations → resolutions) | **Decision record** + **manifest** links in episodes | STRONG HYP. |
| G4 | Memory formation | Counter-triggered reflection (HER); none measure value | Promotion as value of information; meta-memory learns | Formation governed by measured value; pollution control | **Formation-outcome resolutions** (was this memory used, and did it help?) (`04`) | OPEN HYP. |
| G5 | Memory consolidation | Soft archive + search (HER); curator by recency | Consolidation as curation | Consolidation evaluated by recall and by decision quality | Recall eval (HER, OBSERVED) + **memory-value test** | STRONG HYP. |
| G6 | Retrieval | Lexical FTS (HER, DSH opt-in); none ranked | Multi-route, decomposed scores, meta-memory | Retrieval with reasons, recorded | Reasons in the **manifest** (PB-04) | STRONG HYP. |
| G7 | Context compilation | Derivable (DSH fold, HER bytes); select/load split (OC) | Two compilations + manifest | Derivable **and explained** | **Attention manifest** with reasons and exclusions | STRONG HYP. |
| G8 | Epistemic state | Absent | Claims, lattice, confidence vector, bitemporal | Unified claim object across belief, prediction, verification, diagnosis, competence | **Claim unification** (PB-01) | STRONG HYP. |
| G9 | Causal provenance | Durable causality within a session (DSH log; OC projections with the log off by default) | "Events are the spine; one log" | Implementation-neutral causal provenance for every cognitively consequential transition; one semantic authority per concept | **Generalize the law** (not a new primitive) | ADOPTED (revised) |
| G10 | Outcome verification | Narrow: exit codes (HER), shell gates (PRM), judges (OHS) | Verifier hierarchy + claims ledger | Resolutions by independent methods; harness-observed signals in every environment | **Environment outcome-signal requirement** + resolutions as claims | STRONG HYP. |
| G11 | Capability evaluation | Absent | Capability graph + evaluation fabric | Competence claims from resolutions under conditions | **Competence claim** (PB-07) | STRONG HYP. |
| G12 | Learning attribution | Absent (adaptation governed, never evaluated) | Governed ratchet, attribution by ablation, shadow, re-think | Adaptation record with predicted effect, resolved | **Predicted-effect expectation** on every adaptation (PB-05) | STRONG HYP. |
| G13 | Replay | Re-fold (all); keyless re-play oracle (DSH); unverified re-play (SWE) | Re-fold / re-play / re-think | Divergence-bounded re-think; post-divergence results are expectations | **Divergence detection** + labelling (PB-08) | STRONG HYP. |
| G14 | Simulation | Sandbox forks (OC snapshots, SWE reset) | Predictive / sandboxed / historical | Simulation outputs are expectations; fidelity calibrated | **Rehearsal-fidelity claim** | OPEN HYP. |
| G15 | World model | Absent | Projection with predictions | Projection over world claims, tested by resolutions | Follows from PB-01 + PB-02 | STRONG HYP. |
| G16 | Self-model | Absent | The capability graph *is* the self-model | Projection over competence claims; two calibration targets | Follows from PB-07 | STRONG HYP. |
| G17 | Long-horizon cognition | Goal rounds (DSH, PRM) with self-reported completion; restart requires human re-arm (DSH) | Durable goals, acceptance predicates, dormant processes | Entity-scope state + staleness re-validation + expectation expiry | **Entity scope** (PB-09) + **staleness** on claims | STRONG HYP. |
| G18 | Multimodal ingestion | Shallow in all (tool-output spill; image offload in DSH) | Ingestion cascade + perception + alignment | A universal evidence envelope; modality-specific perception packs converging into claims | See `08` | from `R3` |
| G19 | Background cognition | Reflection fork (HER); schedules (DSH, HER, PRM); background jobs mostly non-durable | Tiers, consolidation, daydreaming | Persistence-isolated background processes producing proposals; durable outcome records | Isolation (PA-13) + durable outcome records (HER) | ADOPTED / STRONG |
| G20 | Resource economics | Typed budgets (OC); usage attribution (OHS, PRM); wake budgets (DSH); cache discipline (all) | Expected value of computation; tiers; routing | Spend attributed to cognitive acts; realized value measured post hoc | **Spend attribution per cognitive act** + value resolution (`09`) | OPEN HYP. |
| G21 | Cross-domain transfer | Absent | Skills transfer by applicability | Transfer as evaluation; competence earned per context | Follows from PB-07 | STRONG HYP. |
| G22 | Governed evolution | Governed adaptation without evaluation (HER, PRM); self-recomposition (DSH, unlogged); draft PRs (EVE) | Ratchet L0–L4, architecture as data, diagnosis | Same ratchet; every change carries a predicted effect; structural diagnosis from failure clusters | PB-05 + diagnosis claims | STRONG HYP. |
| G23 | Authority | Attenuation strong (DSH), weak or absent (OC, PRM); approvals ephemeral (OC) | Structural envelopes; attenuation; fail-closed | Attenuation recorded in the child; governance decisions durable | PA-07 + durable governance events | ADOPTED |
| G24 | Human inspection and control | Surfaces project logs (OHS); steer/redirect/yield (HER) | Cognitive surface as observability and intervention plane | Inspection of *why* (decisions, claims, manifests), not only what | Follows from PB-01/03/04 | STRONG HYP. |
| G25 | Persistence of self-describing records | Class-bound events (OHS); plugin-dependent sessions (DSH) | Contracts versioned; upcasting | Records interpretable without the code that wrote them | **Schema-level contracts + upcasters** (law, not primitive) | ADOPTED |

---

## 2. The smallest set that unlocks the most

Remove everything in the table that follows from something else. What remains is the minimal new substrate:

1. **Claim unification** (PB-01). This unlocks G8, G15, G16, G11 (with PB-07), G10 (resolutions), and G21.
2. **Expectation → resolution** (PB-02). This unlocks G12, G10, calibration, surprise-driven formation (G4), and G22.
3. **Decision record** (PB-03). This unlocks G2, G3, credit assignment, and revision propagation.
4. **Attention manifest** (PB-04). This unlocks G6, G7, G24, and attention learning.
5. **Adaptation record with predicted effect** (PB-05). This unlocks G12 and G22.
6. **Entity scope + staleness** (PB-09 + claim validity). This unlocks G17 and G2 above the process.

Everything else is either:
- an **invariant restated** (G1, G9, G23, G25);
- a **projection** (working state, world model, self-model, capability);
- an **evaluation** (transfer, memory value);
- **domain work** in environments (G18 perception packs; outcome signals).

---

## 3. Where the prior UCI architecture was…

| Verdict | Items |
|---|---|
| **Correct and now evidence-backed** | Durable provenance (generalized); log/view separation; two compilations (OC corroboration); authority attenuation; persistence isolation of reflection; verification separate from generation; harness-observed signals; continuity notices; absorption principle |
| **Underspecified** | *Why* (decision records); expectations; the attention manifest's reasons; staleness on resume; outcome signals for non-code domains; spend attribution |
| **Over-specified** (implementation detail in vision documents) | Hybrid logical clocks; `cog://` address syntax; the ranking formula's weight list; the confidence-vector dimension list as fixed; specific object shapes (former Lifelong Appendix B — removed); facet-family table as quasi-schema |
| **Misplaced** | Working state as an authority (→ projection); self-model in the capability graph (→ competence claims); scheduling primitives in the kernel (→ harness; see `09`); the claims ledger as a separate store (→ resolution claims) |
| **Conceptually conflated** | "Model-visible means logged" (derivable vs explained); "consequence is transactional" (external effect settlement vs cognitive commit-after-verification); "events are the spine" (causal provenance vs one physical log); reflection vs learning (already distinguished, now operationalized) |
| **Missing** | Decision record; expectation/resolution; entity scope; staleness re-validation; divergence-bounded replay; rehearsal fidelity; spend attribution per cognitive act |
