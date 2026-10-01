# 14 — Foundation Selection and Migration Strategy

> **What this is.** A decision document, not architecture. It answers one question: given the current UCI
> codebase and seven studied reference harnesses, where should UCI be built from, and how do we move fast
> without losing the ability to become the complete UCI architecture described in this folder? It is
> investigation and decision only — no code was changed to produce it.
>
> **Status.** Decision record, 2026-09-27. Superseded only by a later decision record that explicitly says so.
> **Evidence.** [`research/R5-current-codebase-audit.md`](research/R5-current-codebase-audit.md) (this
> repository's code, read directly) and
> [`research/R6-reference-repo-substrate-comparison.md`](research/R6-reference-repo-substrate-comparison.md)
> (the seven reference harnesses, scored against 26 criteria, spot-checked against their actual checkouts). Both
> are full, independent, code-level investigations — read them for file:line detail; this document is the
> synthesis and the decision built on top of them.
>
> **Audience.** The implementation team. This document assumes familiarity with `CLAUDE.md` and the rest of
> `archit/`, and does not re-derive UCI's laws — it applies them to a concrete choice.

> **Addendum, 2026-10-01: verified corrections that change the migration route.** The strategy holds:
> mechanism transplant, never forking. The route changes, because a premise was wrong when checked
> against code at `c52e44e`.
>
> - **Gen 1 is live, not bypassed.** `apps/api/src/host.ts:39` builds every session through
>   `apps/cli/src/wiring.ts:566-693`. That path instantiates the in-memory event bus,
>   `WorldStateGraph`, `TieredMemoryStore`, `GovernanceEngine`, kernel `CapabilityRegistry`,
>   `ContextAssembler`, `FiberedLearningLoop` (a fresh `ExecutionEngine` per ask) and `DepthScheduler`.
>   §1's "`host.ts` never imports it" and §7's in-place refactor therefore do not hold.
> - **`cognitive-loop` persists one latest-only policy row.** `reconstructChain` cannot run on live
>   data: live events carry no causation ids, and outcomes record `evidence: []`.
> - **Context authorities are three, not two:** `ContextAssembler`, per-unit prompt building, and
>   `ContextCompiler`.
> - **`@inevitable/adapters` depends on Gen 1 `@inevitable/events`.**
> - **11 of 20 tables have no production writer.** The six source tables from migration 0002 are
>   among them.
>
> **Consequences.** These supersede §6's "refactor kernel/execution/runtime" and "adopt
> `packages/contracts` as-is", and §11 phases 2–6.
>
> - **The durable core is built as a new generation in `core/*` (`@uci/*`) beside a frozen Gen 1/2.**
> - **Its first proof is one vertical slice** (the Continuity Slice), judged by the cognitive-resume
>   battery.
> - **The dual generation is bounded and mechanically checked:**
>   - zero transitive `@uci → @inevitable` imports;
>   - a shrink-only baseline on frozen packages;
>   - product migration, then deletion of Gen 1/2, starts no later than right after the Postgres slice.
>
> **Decisions:** journal `decision-20261001-a80d`, `-b260`, `-d67f`, `-d222` in `.build/journal.jsonl`.
> **Status and acceptance criteria:** `criteria-20261001-3ea6`.

---

## 0. The decision, up front

**Do not fork or vendor any of the seven reference repositories. Do not keep rebuilding the existing in-memory
"kernel/harness" packages as though they were the target either.** Build UCI on top of what this repository
already got right — its contract boundary, its durable adapters, its one working instance of the cognitive
bridge primitives — and close the specific, named gaps using **mechanism designs** ported from OpenCode
(primary) and Deepseek-Harness (secondary), reimplemented on UCI's own types from day one. No reference repo
ever becomes a dependency in `package.json`. Full reasoning in §3–§6; the twelve-point final answer is §13.

This is a **narrower, cheaper, and lower-risk claim** than the four options as originally framed (§3), because
the evidence changes the premise those four options share: that UCI is starting from either nothing or a
generic harness. It is starting from neither. `R5` finds a repository with real, durable, tested product
infrastructure (Postgres adapters, model adapter, document ingestion, a governed web crawler, a live deploy
pipeline) and one small, working, durable instance of UCI's own bridge primitives (`packages/cognitive-loop`) —
sitting next to a much larger amount of well-intentioned but disconnected, in-memory-only scaffolding from an
earlier architecture generation.

---

## 1. What the current codebase actually is

Full detail: `R5`. Headline: **three architectural generations coexist, unreconciled.**

| Generation | What | Character |
|---|---|---|
| **Gen 1** — `kernel`, `governance`, `execution`, `events`, `memory`, `world-state`, `context`, `runtime`, `scheduler`, `intelligence`, `evaluation`, `orchestration` | The original CDL-era kernel/harness attempt | Correct *shape*, faithfully tested, **100% in-memory**, barely used by the live product (`@inevitable/kernel` is imported by 7 files total; `host.ts` never imports it). |
| **Gen 2** — `cognitive-loop` (ADR-0066) | Constitution + AdaptivePolicy + AdaptationGovernor + ContextCompiler/ContextManifest + causal-chain reconstruction | The **only** part of the codebase that runs UCI's own bridge primitives (decision record, predicted-effect adaptation, derivable-and-explained manifest, causal provenance) as real, durable (Postgres, migration 0005), tested code — for exactly one dimension: per-learner explanation-strategy weight. |
| **Gen 3** — `source-environment`, `surface`, `product-cognition`, `adapters`, `apps/api`, `apps/web` | The shipping education product ("Surface Gateway") | Mature. Real Postgres/Storage durability for what one production incident required, a real model adapter, a real document-ingestion pipeline, a real governed crawler, real replay/rehydration — wired by hand in `host.ts` (1,458 lines), **bypassing both Gen 1 and most of Gen 2**. |

The honest read: this is not "an existing UCI implementation" in the sense the investigation prompt assumed
(a single coherent thing to refactor or discard). It is a **working product with an unrealized architecture
sitting beside it**, and a small, real seed of the right architecture sitting beside *that*, disconnected from
both. Part 7 below turns this into a migration map.

---

## 2. What the seven reference repos actually are, for this purpose

Full detail: `R6`. Headline: **the question "which repo is the best agent" and "which repo should UCI be
transformed from" have different, sometimes opposite, answers.**

| Repo | Best agent product? | Bootstrap substrate? | Why |
|---|---|---|---|
| **Hermes-Agent** | Yes — richest, most production-hardened of the 7 | **No** | 750K LOC, 14-mixin facade, the transcript row literally *is* the state — highest architectural gravity of the 7 (`R6` §D). Great evidence mine, poor foundation. |
| **Eve** | No | **No** | Best mechanically-enforced modularity of the 7 (23 shrink-only build-time guards) — but its entire crash-transparency guarantee rests on a proprietary SDK (`@workflow/*`) whose source is **confirmed absent** from the checkout. Building on it means building on an invisible, unswappable vendor foundation — the exact thing CLAUDE.md's "no vendor type crosses an adapter" forbids. |
| **OpenHands** | Debatable (best UI product) | **No** | The entire agent core is **confirmed absent** from the checkout (10 `.py` files, zero hits for its own core class names). The checkout is a projection layer with nothing behind it. |
| **OpenCode** | No | **Yes — leading candidate** | Cleanest verified "stateless step reloaded from durable projection" story of the 7; best model-swap-safety mechanism found in any of the 7; cleanest layering; lowest architectural gravity among repos with a real cognitive core. Its worst flaw (event persistence off by default) is a config default, not a structural defect. |
| **Prime-Agent** | No | **No** | The best instinct in the set (a typed, refinable "harness state" outside the transcript) — trapped inside a 13,891-line monolith whose correctness depends on comments, not types. |
| **Deepseek-Harness** | No | **Runner-up** | Its log/derived-"surface"-index separation (shadows, never deletes, cites what it shadows) is close to a working version of "evidence is sacred; interpretation is revisable" already. Loses the top spot because its own archaeology flags that stored sessions depend on exactly which plugins loaded them — the opposite of "records outlive their writers" (A20) — and because integration cost (300+ packages, a vendored kernel) is materially higher than OpenCode's. |
| **SWE-Agent** | No (it is a benchmark harness) | **No** | Solves almost none of persistence/recovery/delegation/background execution by design. Lowest gravity of the 7 (nothing to fight), but also the least substrate to build *from*. A source of small transferable ideas only. |

---

## 3. Which strategy is strongest (A/B/C/D)

The user's framing offered four options and explicitly asked not to default to D because it sounds attractive.
Evaluated honestly:

- **A — keep refactoring the existing implementation.** Wrong as stated: most of what exists to refactor
  (Gen 1) is exactly the part `R5` shows is disconnected from the product and structurally inferior, on its own
  evidence, to mechanisms already proven in OpenCode. Refactoring it in place, without new input, would spend
  effort perfecting an architecture generation the product has already moved past.
- **B — fork one of the seven repos and transform it.** Wrong for the leading candidate too. Forking OpenCode
  means its ontology (`session` as the largest durable object, coding-agent-shaped tool/workspace vocabulary,
  Effect-TS-specific concurrency idioms as the mechanism of correctness) becomes the initial ground truth
  everything else is built on top of — precisely the "architectural capture" risk the investigation was
  commissioned to avoid. It would also **discard** this repository's own real, live, differentiating assets
  (Postgres durability, the model adapter, document ingestion, the crawler, the deploy pipeline, `cognitive-loop`
  itself) that have nothing to do with any of the seven repos and would take real effort to rebuild inside a
  foreign codebase.
- **C — build independently, using the seven repos only as references.** Closer to right, but incomplete as
  stated: "reference only" undersells how directly portable several OpenCode mechanisms are (`R6` §C names
  exact files and preconditions). Treating them as inspiration to redesign from scratch, rather than as
  specified mechanisms to port, would rediscover solved problems (exactly-once tool settlement, write-ahead
  execution claims, provenance-gated model-swap safety) at real cost and real risk of getting the edge cases
  wrong the first time.
- **D — hybrid: one repo provides initial execution substrate, UCI-owned boundaries established immediately, the
  borrowed implementation progressively replaced.** This is disproven **as literally stated** — see §4. But a
  structurally different hybrid, where the current repository's own contract boundary is the immediate UCI-owned
  boundary and the "borrowed" material is mechanism-level design, not a forked codebase, is the actual
  recommendation. Calling this "D" would mislead a reader into picturing a fork-and-excise plan; §6 names it
  **mechanism transplant** to keep the distinction visible.

**The recommended strategy is closest to a repaired C: build independently, on this repository's own contracts,
accelerated by porting a short, named list of OpenCode- and Deepseek-Harness-evidenced mechanisms as fresh,
UCI-owned implementations.**

---

## 4. Testing the literal base-repository hypothesis (OpenCode), and why it fails

Applying the user's own template to "fork OpenCode, then progressively replace it":

```
OpenCode (forked)
        ↓
UCI BOUNDARY drawn inside a foreign codebase
        ↓
UCI-OWNED SUBSYSTEMS   — built as patches on top of OC's session/tool/event types
        ↓
BORROWED SUBSYSTEMS    — OC's server, permission engine, compaction, delegation — all of it, by construction
        ↓
EVENTUAL REPLACEMENTS  — a promise to progressively cut away the very thing everything was built on top of
```

Two things go wrong in practice, both visible in the evidence already gathered:

1. **The excision point never arrives.** `R6` §D shows this exact pattern already failed once, inside the
   reference set itself: Deepseek-Harness's own archaeology flags that its plugin/seam model, though individually
   clean, made the loop, the session store, and persistence itself all removable plugins — and its own docs treat
   this as a *hazard*, not just a strength, because a stored session becomes uninterpretable without knowing
   which plugins produced it. "Everything is swappable" does not imply "everything eventually gets swapped." Once
   a product is shipping on top of a foreign session ontology, every feature built afterward makes replacing that
   ontology more expensive, not less — the same force that made Hermes-Agent (`R6` §D) too entangled to extract
   from despite having by far the best individual mechanisms of the 7.
2. **It would sacrifice a real, working system for a rebuild.** Unlike a genuine greenfield "which repo do we
   fork" decision, this repository already has `apps/api`'s live, Postgres-durable, tested product (`R5` §§2,
   9–10, 17, 19). Forking OpenCode does not inherit any of that; it would have to be re-ported into the fork, at
   which point the fork has stopped being "OpenCode plus a UCI boundary" and has become a second, parallel
   rewrite of the current product on someone else's chassis — strictly worse than porting mechanisms into the
   product that already exists.

**Conclusion: the base-repository hypothesis, taken literally, is disproven by this repository's own specifics —
not by a general argument against reference repos.** A codebase with nothing worth keeping might make B/D
defensible. This one is not that codebase.

---

## 5. Testing the alternative (build independently, repos as reference only)

This is close to right, and is what §3/§6 recommend with one refinement. Estimated honestly:

| Factor | Assessment |
|---|---|
| Engineering cost | Materially lower than a fork: the durable-execution mechanisms this repository is missing (effect ledger, write-ahead execution claims, provenance-gated model-swap safety) are individually small (`R6` §C lists exact files/preconditions for each in OpenCode) — days-to-low-weeks of focused work each, not a rewrite. |
| Time-to-first-working-system | Fast for the parts that already work (`apps/api` ships today); slower for the parts that don't (cognitive resume, effect ledger) — but those are new work under any strategy, since no reference repo has them either (`R6`'s own headline: none of the 7 has persistent cognition, only persistent execution). |
| Infrastructure that must be rebuilt | Small: an effect ledger, a durable kernel backing store (extending the already-proven `PostgresXStore` pattern), one unified context-compilation authority, a working-state projection object. Everything else (Postgres, model adapter, ingestion, crawler, deploy) already exists. |
| Risk | Lower than B/D: no foreign codebase enters the tree, so there is nothing to progressively excise and nothing that can quietly become permanent (§4's failure mode is structurally impossible). |
| Architectural freedom | Full: UCI's own contracts (`packages/contracts`, `packages/protocols`) are already the enforced adapter boundary in the one place that matters most (`apps/mcp`'s SDK-only import, `R5` §12) — this repository already knows how to do the thing the reference repos mostly get by convention rather than mechanism. |
| Long-term maintenance | Lower: one codebase, one set of types, no upstream to track or diverge from. |
| Research velocity | Slightly slower than "just fork the best one" in the very first weeks, faster from that point on, because nothing borrowed needs to be un-learned or excised later. |

**The refinement over "reference only":** treat `R6` §C's named, precondition-stated OpenCode mechanisms (and
Deepseek-Harness's log/surface separation) as **specifications to port**, not merely inspiration — this is what
makes the independent-build option fast rather than merely safe.

---

## 6. The recommended strategy: mechanism transplant onto owned contracts

```
THIS REPOSITORY'S OWN CONTRACTS               packages/contracts, packages/protocols
        ↓                                     (ADOPT AS-IS — already the enforced boundary in apps/mcp)
UCI-OWNED KERNEL + SUBSTRATE                   packages/kernel (made durable) + widened packages/cognitive-loop
        ↓                                     (the bridge primitives: claim, decision record, expectation,
                                                attention manifest, adaptation record — archit/01–03)
UCI-OWNED HARNESS                              packages/execution + packages/runtime + packages/scheduler,
        ↓                                     REPAIRED using mechanism designs evidenced in R6 (below) —
                                                no OpenCode/Deepseek-Harness code, ever, in this layer
UCI-OWNED ADAPTERS                             packages/adapters (Postgres/model/source already mature —
                                                extend the same pattern to the effect ledger and kernel)
        ↓
EXISTING PRODUCT SURFACES                      apps/api, apps/web, apps/cli, apps/mcp — kept, not rebuilt
```

**What "mechanism transplant" means precisely:** for each of the following, an engineer reads `R6` §C's
file:line citation (and, where deeper detail is needed, the original archaeology document), understands the
mechanism as a design, and writes a fresh implementation against this repository's own types in the relevant
existing package. Nothing is copied, vendored, or imported from `Reference-Architecture-Observatory/`.

| Mechanism | Evidenced in | Lands in | Replaces |
|---|---|---|---|
| Stateless step reloaded from durable projection (no in-memory agent loop) | OpenCode (`R6` §C) | `packages/execution` | The in-memory-only fiber engine's residency assumption |
| Write-ahead execution claim + bounded resume counter + boot sweep | OpenCode (`R6` §C) | `packages/runtime` | `CognitiveUnitHost`'s crash handling (currently none — `R5` §3) |
| Durable inbox, admission separate from execution | OpenCode (`R6` §C) | `packages/runtime` | `SurfaceHost`'s direct async/await request handling |
| Provenance-gated reuse of opaque provider state (model-swap safety) | OpenCode (`R6` §C) | `packages/adapters/model.ts` | Nothing — this is additive to an already-strong adapter |
| Step outcome algebra + typed delivery/operation/recovery failure taxonomy | OpenCode (`R6` §C) | `packages/execution`, `packages/contracts` | Ad hoc error handling in `host.ts` |
| Call-before-effect / settle-once / reconcile-unknown (an effect ledger) | OpenCode's write-ahead claim + Deepseek-Harness's crash taxonomy (`R6` §C, per-repo scorecard row 3) | New: `packages/execution` or a new `packages/effects` | Nothing — currently absent entirely (`R5` §7) |
| Log/derived-index separation that shadows rather than deletes | Deepseek-Harness (`R6` per-repo scorecard row 21) | `packages/adapters/durable.ts`'s compaction/revert handling | The destructive-delete pattern this repo doesn't yet have but would otherwise be tempted to write |
| Authority attenuation recorded in the child's own record | Deepseek-Harness (`R6` per-repo scorecard row 6) | Widened `cognitive-loop` / kernel identity | `CognitiveIdentity`'s currently-unenforced capability subset check |

**What is explicitly never inherited**, per `R6` §C's own "should never become a permanent dependency" list:
session as the largest durable object; Effect-TS-specific concurrency idioms as *the* correctness mechanism;
"the model decides when work is done"; coding-agent-shaped tool/workspace vocabulary as a universal ontology;
dependency direction enforced by convention rather than a build-time check (this is exactly how OpenCode's own
DRIFT-1 happened — the schema and replay machinery existed, and the default still shipped wrong).

---

## 7. Migration map for the existing codebase

Builds on `R5`'s classification, adding destination, priority, and the reality test each item's completion is
judged against (`archit/Universal-Cognitive-Infrastructure.md` §34).

| Component | UCI destination | Action | Priority | Reality test |
|---|---|---|---|---|
| `packages/contracts`, `packages/protocols` | Kernel contracts | **Keep**, add a build-time import-graph check | P0 | — (structural) |
| `packages/adapters/supabase.ts`, `model.ts` | Substrate/kernel adapters | **Keep** | P0 | Restart |
| `apps/mcp` | Surface | **Keep** as the proof pattern for the P1 boundary check | P0 | — |
| `packages/kernel` (identity/capability/lease) | Kernel | **Refactor**: durable backing, actually gate `SurfaceHost` | P1 | Containment |
| Effect ledger (new) | Kernel | **Build** | P1 | Settle |
| `packages/cognitive-loop` | Substrate (claims/decisions/manifests) | **Keep, widen** beyond one dimension | P1 | Cognitive resume, context causality |
| `packages/context` + `cognitive-loop`'s `ContextCompiler` | Harness (context compilation) | **Merge** into one authority | P1 | Context causality |
| `packages/execution`, `packages/runtime` | Harness (step loop, process) | **Refactor** with the transplanted mechanisms (§6) | P1 | Restart, model swap |
| `WorldStateGraph` + migration `world_state_*` | Substrate (world model) | **Refactor**: wire the durable adapter that already exists as a migration | P2 | Compaction |
| Migration `events` table | — | **Retire** (dead schema) unless a real writer is committed to in the same phase | P2 | — |
| `KnowledgeGraphEngine` | Education environment | **Extract** out of `world-state` | P2 | — (one concept, one authority) |
| `packages/governance` | Kernel (governance hook) | **Keep**, add a durable decision log | P2 | Commit |
| `packages/scheduler` (`DepthScheduler`) | Harness | **Keep**, wire into the live gateway path | P2 | Cognitive economy |
| `packages/source-environment`, `apps/api/src/sources.ts`, `pdf.ts` | Environment (ingestion) | **Keep**, extract into a pluggable package boundary | P3 | — |
| `apps/api/src/crawler.ts` | Environment (ingestion) | **Keep unchanged** | — | — |
| `apps/web`, `packages/surface` | Surface | **Keep**, widen projections (§8) | P3 | Surface swap |
| `apps/cli/src/wiring.ts` | Composition root | **Refactor** into a declared environment manifest once one exists | P3 | — |
| `packages/evaluation` | Harness (verification) | **Keep, widen**: measured verifier validity per environment | P3 | Learning |
| `services/{control-plane,event-bus,workflow-worker}` | — | **Retire** (empty) or implement against real contracts | P4 | — |
| `packages/testing` | — | **Retire** | P4 | — |
| Auth (learner API key) | Kernel (authority) | **Refactor**: rotation/expiry, real RLS policies | P4 | Containment |

---

## 8. Frontend / Cognitive Surface

`apps/web` already does the right thing: it sends governed commands and renders folded `SurfaceState` from a
server-sent event stream, with no independent business state client-side (`R5` §10). **Keep this discipline as
a standing law for every future surface, not just this one.** What needs to change is *what* it projects, not
*how* it projects:

- `packages/surface`'s `foldSurfaceEvents` pattern generalizes cleanly once the underlying record includes
  claims, decisions, attention manifests, and competence — it is currently folding only `surface.*` events, which
  are themselves downstream of the education-specific `product-cognition` layer.
- The Cognitive Surface (`archit/Universal-Cognitive-Infrastructure.md` §11) needs new projections this repo does
  not yet have: current attention and *why* (from the widened manifest), open expectations, verification results,
  competence — none of these exist as `SurfaceState` slices today.
- `apps/web` itself should not be rebuilt. Its retrieval/rendering pipeline (SSE fold, no client-side state
  duplication) is exactly the target shape; only the vocabulary of what it folds needs to widen.

---

## 9. Multi-platform future

`apps/mcp`'s SDK-only import boundary (`packages/sdk`, zero direct dependency on protocols/kernel/events,
`R5` §12) is the one place in this repository that already proves cognition can be projected onto a new surface
without dragging the substrate along. **Generalize this, don't invent a new pattern:**

| Layer | Owns | Current instance |
|---|---|---|
| **Core** | Kernel + substrate + harness | `packages/kernel`, `cognitive-loop`, `execution`, `runtime`, `events` |
| **Surface** | Projection only, via SDK | `apps/web` (partially — see §8), `apps/mcp` (fully proven) |
| **Adapter** | Vendor isolation | `packages/adapters` |
| **Runtime** | Where it executes | Node process today; no reason this can't be a sandbox or edge runtime later, behind the same adapter contracts |
| **Platform bridge** | Deployment specifics | `vercel.json`, `render.yaml` — correctly kept out of cognition |

The one addition this repository needs and does not have: a **mechanical** enforcement that every new surface
imports only `packages/sdk`, the way `apps/mcp` already does by discipline. `R6` names this exact gap
("dependency direction by convention, not mechanism") as the root cause of OpenCode's own DRIFT-1. Build the
lint/import-graph check once (§6, §7 P0) and every future surface — voice, desktop, a second web client —
inherits the guarantee for free.

---

## 10. Document and multimodal foundation

`packages/source-environment` plus `apps/api/src/sources.ts` plus `packages/adapters/src/pdf.ts` are, on the
evidence, **the strongest existing instance of an archit-shaped environment in this repository** (`R5` §9, §17).
It already has anchors (`anchors.ts`, `anchor-index.ts`), progressive canonicalization, honest degradation
instead of fabrication, and seven working modality adapters. This is very close to `archit/08-ingestion-and-
grounding.md`'s universal evidence envelope in practice, just not yet named that way or extracted from `apps/api`
into a pluggable package boundary (already flagged in §7, P3). **Do not rewrite this. Extract and rename it to
make the alignment with archit/08 explicit, then add modality adapters (audio, video, spreadsheets, presentation
formats) the same way the existing seven were added** — each is a bounded, independently testable unit in this
codebase already, which is exactly the shape archit/08 asks for.

---

## 11. Rapid development plan

Fifteen phases, in dependency order. Each closes a loop before the next widens it (CLAUDE.md §5). Full detail
per phase (files, exact acceptance predicate) belongs in implementation tickets, not this document; this is the
sequencing and the reality test each phase is judged against.

| Phase | Goal | Primary modules | Must NOT be built yet | Reality test |
|---|---|---|---|---|
| 0 | Ratify this document; freeze Gen 1 packages (no new features) | — | Any new Gen-1-style in-memory subsystem | — |
| 1 | Contract hardening: build-time import-graph check | `packages/contracts`, `packages/protocols`, CI | New surfaces | — |
| 2 | Effect ledger + durable kernel | `packages/kernel`, new effect ledger | Multi-node fencing | Settle, containment |
| 3 | Unify context compilation | `packages/context`, `cognitive-loop` | New context sources | Context causality |
| 4 | Widen `cognitive-loop` into the general bridge substrate | `cognitive-loop` | A capability graph (archit §14 — OPEN) | — |
| 5 | Working-state projection | `runtime`, `execution` | Multi-process working state | — |
| 6 | Cognitive resume, one process type | `runtime`, `cognitive-loop`, `SurfaceHost` | Cross-surface resume | **Cognitive resume** |
| 7 | Verification widened | `evaluation` | A capability-wide evaluator suite | Learning |
| 8 | Effect-ledger-backed tool/action model | `adapters/tools.ts`, `contracts` | New tool kinds | Settle |
| 9 | Real background cognition | `scheduler`, `runtime` | Autonomous long-horizon work | Cognitive economy |
| 10 | Society of processes: durable children, recorded attenuation | `runtime`, `kernel` | Cross-machine delegation | Containment |
| 11 | Source-environment as a first-class environment pack | `source-environment`, `sources.ts` | New modalities beyond the existing 7 | — |
| 12 | Surface generalization (§8) | `surface`, `apps/web` | New surfaces | Surface swap |
| 13 | Multi-platform expansion (§9) | `sdk`, new surface apps | — | Surface swap |
| 14 | Retire dead weight | `services/*`, `packages/testing`, migration `0001` | — | — |

---

## 12. Architectural exit criteria

The user's template asks for the conditions under which UCI is "no longer dependent on the original base
repository." Under the recommended strategy, **this question does not apply in its literal form** — no
reference repository is ever a dependency, so there is nothing to exit from. Two analogous, real exit criteria
do apply:

1. **Exit from Gen 1.** Once Phase 5 (§11) lands, `packages/kernel`'s in-memory services, the standalone fiber
   engine, and the standalone `ContextAssembler` should be retired or fully absorbed — not maintained
   indefinitely alongside their replacements. Track this explicitly; "kept for now" is how this repository ended
   up with three unreconciled generations the first time (`R5` §0).
2. **Exit from attribution risk.** Confirm, at each phase boundary, that nothing under
   `Reference-Architecture-Observatory/` has become an import, a vendored file, or a copied block of code
   anywhere in `apps/`, `packages/`, or `services/`. This should be zero at every point, by construction — a
   simple grep, not a migration.

If either check ever fails, that is the signal this strategy has quietly drifted into Option B/D as originally
(and rejected) framed, and needs to be corrected before it compounds.

---

## 13. Final decision

1. **RECOMMENDED STRATEGY.** A repaired Option C: build UCI independently, on this repository's own existing
   contract boundary, accelerated by porting a short, named list of mechanisms evidenced in the reference
   harnesses as fresh, UCI-owned code. Not A (most of what exists to refactor is the wrong generation). Not B or
   D as literally stated (§4 disproves forking any single repo, including the leading candidate).

2. **RECOMMENDED BASE REPOSITORY.** None, as a dependency. **OpenCode** is the primary mechanism-design
   reference; **Deepseek-Harness** is the secondary reference for the log/derived-index and authority-attenuation
   patterns. Neither is vendored, imported, or forked.

3. **WHY THESE REFERENCES.** OpenCode has the cleanest, most independently-evidenced "stateless step reloaded
   from durable projection" story of the seven, the best model-swap-safety mechanism found in any of them, and
   the lowest architectural gravity among repos with a real cognitive core (`R6` §B). Its flaws are named,
   narrow, and structurally separable from its strengths. Deepseek-Harness's evidence/derived-index separation is
   close to a working version of UCI's own "evidence is sacred; interpretation is revisable" law and its
   attenuation-recorded-in-the-child pattern is unique among the seven.

4. **WHAT WE SHOULD REUSE.** Everything in `R5`'s "mature, working infrastructure" list: the Postgres/Storage
   adapter layer, the model adapter, the source/document ingestion pipeline, the governed web crawler, the live
   deploy pipeline, and `cognitive-loop`'s governed-adaptation and causal-chain reconstruction. From the
   reference repos: the mechanism designs named in §6's table — never their code.

5. **WHAT WE SHOULD REPLACE.** The in-memory Gen-1 kernel/execution/context/world-state packages, once their
   durable, widened replacements land (§7, §11 Phases 1–5); the two competing context-compilation authorities,
   merged into one; `SurfaceHost`'s ad hoc async/await execution, once a real step loop exists to replace it
   with.

6. **WHAT WE SHOULD NOT INHERIT.** From any reference repo: session as the largest durable object, framework-
   specific concurrency idioms as the mechanism of correctness, "the model decides when work is done," a
   coding-agent-shaped tool vocabulary treated as universal, and dependency direction enforced by convention
   rather than a build-time check (§6's list, in full).

7. **HOW THE CURRENT UCI CODEBASE FITS IN.** It is the foundation, not a competing option. `apps/api`'s live
   product, its Postgres durability, and `cognitive-loop`'s working (if narrow) bridge primitives are kept and
   widened. Gen 1's kernel/execution/context packages are the part that gets refactored using transplanted
   mechanisms, not the part that gets discarded for a fork.

8. **HOW THE SEVEN REPOSITORIES CONTINUE TO BE USED.** As a standing reference collection
   (`Reference-Architecture-Observatory/`, already gitignored, already "extract mechanisms, never ontologies"
   per CLAUDE.md §4). `R6` and the original archaeology are the citable evidence for every mechanism transplanted
   under §6 and every future one considered later.

9. **TARGET UCI ARCHITECTURE AFTER MIGRATION.** Exactly the anatomy in
   `archit/Universal-Cognitive-Infrastructure.md` §6 — kernel, substrate, harness, environments, surfaces,
   adapters — realized inside this repository's existing package boundaries rather than a new one:
   `packages/kernel` + a new effect ledger as the kernel; widened `cognitive-loop` as the cognitive half of the
   substrate; `execution`/`runtime`/`scheduler` as the harness; `source-environment` (extracted) plus future packs
   as environments; `apps/web`/`apps/mcp`/future surfaces as surfaces; `packages/adapters` unchanged in role.

10. **FIRST 10 IMPLEMENTATION STEPS.** (1) Ratify this document. (2) Freeze new Gen-1-style subsystems. (3) Add
    the build-time import-graph check. (4) Design the effect ledger against OpenCode's write-ahead-claim
    evidence. (5) Back `packages/kernel`'s identity/capability/lease services with Postgres, extending the
    existing `PostgresXStore` pattern. (6) Merge the two context-compilation authorities. (7) Design the widened
    claim/decision/expectation/competence objects as an extension of `cognitive-loop`'s existing shapes. (8) Wire
    the effect ledger into `packages/adapters/tools.ts`. (9) Build the working-state projection object over the
    now-durable kernel + widened `cognitive-loop`. (10) Run the cognitive-resume reality test end to end for one
    process type and treat its result as the go/no-go gate for Phase 7 onward.

11. **BIGGEST ARCHITECTURAL RISKS.** (a) Widening `cognitive-loop` from one dimension to a general substrate is
    unproven at scale — treat it as a STRONG HYPOTHESIS (`archit/README.md` vocabulary) until Phase 6's
    cognitive-resume test passes, not as settled fact. (b) The three-generations problem could recur if Phase 0's
    freeze is not actually enforced — this has already happened once in this repository. (c) Effect-ledger and
    durable-kernel work (Phases 2, 8) touches the same code path as the live product; sequence it behind a real
    conformance-test discipline (already proven for adapters, `R5` §20) so `apps/api` never regresses.

12. **CONDITIONS THAT WOULD INVALIDATE THIS RECOMMENDATION.** If `cognitive-loop`'s bridge-primitive shape turns
    out not to generalize past one dimension without a rewrite (Phase 4 fails), the "widen, don't replace"
    premise of this document weakens and a narrower rebuild of just the substrate half becomes more attractive.
    If a future audit finds `apps/api`'s durability story is shallower than `R5` found (e.g., the Postgres
    adapters are conformance-tested but not actually load-bearing in production), the "keep the product, refactor
    the architecture around it" premise weakens correspondingly. If OpenCode's own codebase changes such that the
    mechanisms cited in `R6` §C no longer match its current source, re-verify against the live repository before
    porting rather than trusting this document's citations indefinitely.
