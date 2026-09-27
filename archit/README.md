# archit/ — The UCI Architecture Corpus

This folder holds UCI's architecture at every level of certainty. The levels must never be collapsed:

```
constitution / enduring principles     Universal-Cognitive-Infrastructure.md
        ↓
architecture                           Lifelong-Cognitive-Memory-and-Harness.md
        ↓
architectural hypotheses               01–09 (focused treatments)
        ↓
experiments                            12 (register + first program)
        ↓
evidence                               research/R1–R4 · 13 (evidence map) ·
                                       ../Reference-Architecture-Observatory/archaeology/ (source-level archaeology)
        ↓
implementation                         the code and its tests — the only evidence that anything exists
```

**Truth model.** No document in this folder is evidence that a capability exists (CLAUDE.md §2). "ADOPTED" means the
architecture commits to an invariant. It does not mean UCI implements it.

---

## Index

| File | What it holds |
|---|---|
| [`Universal-Cognitive-Infrastructure.md`](Universal-Cognitive-Infrastructure.md) | The enduring vision and constitutional direction: purpose, axioms, anatomy, specialization, evolution, trust, the reality tests |
| [`Lifelong-Cognitive-Memory-and-Harness.md`](Lifelong-Cognitive-Memory-and-Harness.md) | The deep architecture of the continuity substrate and the execution machinery |
| [`00-architecture-evolution.md`](00-architecture-evolution.md) | What this research pass changed, and why: all 18 prior claims decided with evidence |
| [`01-execution-to-cognition.md`](01-execution-to-cognition.md) | The central problem: converged persistent execution vs absent persistent cognition, and the bridge primitives |
| [`02-persistent-cognitive-state.md`](02-persistent-cognitive-state.md) | What must persist to resume cognition, not just execution; the cognitive-resume battery |
| [`03-epistemic-substrate.md`](03-epistemic-substrate.md) | Claims, expectations, resolutions, verifier records; world, self and person models; calibration |
| [`04-memory-formation-and-dynamics.md`](04-memory-formation-and-dynamics.md) | Minimum memory structure; formation; truth maintenance; policy force; procedural memory; consolidation |
| [`05-context-and-attention.md`](05-context-and-attention.md) | The five-step transformation; the attention manifest; derivable vs explained; compaction loss |
| [`06-experience-replay-and-simulation.md`](06-experience-replay-and-simulation.md) | Experience as causally linked records; the replay taxonomy; the divergence law |
| [`07-learning-verification-and-capability.md`](07-learning-verification-and-capability.md) | Reflection ≠ adaptation ≠ learning ≠ verified improvement; controlled trials; verification; competence |
| [`08-ingestion-and-grounding.md`](08-ingestion-and-grounding.md) | Modality-specific operators converging on a universal evidence model |
| [`09-runtime-authority-and-economics.md`](09-runtime-authority-and-economics.md) | Proven runtime primitives; the cognitive process; capabilities; the kernel test; cognitive economics |
| [`10-primitive-atlas.md`](10-primitive-atlas.md) | Every candidate primitive, with evidence, invariant, experiment and status |
| [`11-gap-map.md`](11-gap-map.md) | References vs prior UCI vs required; the smallest missing primitives |
| [`12-hypotheses-experiments-and-open-problems.md`](12-hypotheses-experiments-and-open-problems.md) | The hypothesis register, the first experimental program, open problems |
| [`13-research-evidence-map.md`](13-research-evidence-map.md) | Evidence → primitive → where it is used |
| [`14-foundation-selection-and-migration-strategy.md`](14-foundation-selection-and-migration-strategy.md) | Decision record: where to build UCI from, given the current codebase and the seven reference harnesses |
| [`research/`](research/) | R1 memory and continual cognition · R2 learning, verification, world/self models · R3 ingestion, grounding, context · R4 runtimes, authority, economics · R5 current-codebase audit · R6 reference-repo substrate comparison |

---

## Status vocabulary

| Status | Meaning |
|---|---|
| **OBSERVED** | Demonstrated in one system's source code or in one study |
| **REPLICATED** | Independently demonstrated in at least two systems or studies |
| **STRONG HYPOTHESIS** | Well grounded in evidence and first principles; awaiting UCI's own experiment |
| **OPEN HYPOTHESIS** | Plausible; evidence insufficient or conflicting |
| **EXPERIMENTAL** | Being tested |
| **ADOPTED** | The architecture commits to it (still requires implementation evidence) |
| **REJECTED** | Evidence against it |
| **SUPERSEDED** | Replaced by a better formulation, kept for history |
| **UNKNOWN** | No evidence either way |

**Evidence keys used throughout:**
- `A-SYN`, `A-DSH`, `A-EVE`, `A-HER`, `A-OHS`, `A-OC`, `A-PRM`, `A-SWE` — archaeology documents;
- `R1`–`R4` — research notes.

---

## How this folder evolves

1. **Change enters at the right level.**
   - New evidence goes into `research/` or the archaeology.
   - Hypotheses go into `01`–`09` and are registered in `12`.
   - Only graduated invariants reach the two main documents.
2. **Every architectural change records:**
   - the prior assumption;
   - the new evidence, and what it actually establishes;
   - what remains uncertain, and competing interpretations;
   - the implication and the proposed mechanism;
   - the minimal experiment, the measurable invariant, and the graduation criterion;
   - the status.

   See `00`.
3. **Never let a speculative mechanism silently become law.** Promotion to ADOPTED cites evidence. Demotion is recorded
   as SUPERSEDED or REJECTED, never deleted.
4. **Improve documents in place.** Merge rather than duplicate. Split a document only when a concept has become large
   enough to deserve its own treatment.
5. **The archaeology folder is gitignored.** `../Reference-Architecture-Observatory/archaeology/` is local only.
   Consider tracking it if this corpus is shared.
