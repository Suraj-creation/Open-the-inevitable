# 09 — Runtime, Authority, and Cognitive Economics

> **Question.** How should UCI keep cognitive processes alive, supervised, governed and economically rational? What
> belongs in the kernel?
>
> **Answer in brief** (grounded in the archaeology and `research/R4`):
>
> - **Almost every agent-specific runtime problem has an older, general solution** that is proven in production across
>   independent systems:
>   - durable workflow engines;
>   - virtual actors;
>   - supervision trees;
>   - fencing;
>   - reconciliation;
>   - object capabilities;
>   - read-time upcasting.
> - What is genuinely new for cognition is threefold:
>   - **the coordinator is non-deterministic, so its decisions must be journaled, not recomputed**;
>   - **attackers can speak through data**;
>   - **computation has a continuous quality/cost dial**.
> - The kernel gains the OS-like pieces that pass the test *"would this still make sense if 'AI agent' disappeared?"*.
>   Everything about prompts, turns, models and memory stays out of it.

---

## 1. The execution floor, restated as proven invariants

The seven reference systems converged on E1–E7 (`01` §1.1). `R4` shows each has a decades-old, general precedent. That
is strong evidence that these are *fundamental*, not agent fashions.

| UCI invariant | Reference evidence | General precedent (`R4` §11.1) | Status |
|---|---|---|---|
| Durable-record step; state is a function of the record | OC, DSH, EVE, HER | Temporal, Azure Durable Functions, Restate, DBOS, Akka | ADOPTED |
| Effects settled exactly once; `UNKNOWN` is first-class; idempotency keys | DSH, OC, HER, PRM, EVE | Temporal activities, DBOS steps, Restate `ctx.run` | ADOPTED |
| Durable admission separate from execution | OC, DSH, EVE | Actor mailboxes; A2A task states | ADOPTED |
| Single writer, fenced at commit | DSH, HER, EVE | Leases + fencing tokens (Gray & Cheriton; Chubby); Akka sharding | ADOPTED |
| Bounded history via epochs | — (DSH keeps the whole log in memory; EVE snapshots the whole session each step) | Temporal continue-as-new (51,200 events / 50 MB hard cap) | **NEW — ADOPTED** |
| Code/policy version stamped on each run; upgrade at boundaries | EVE (behaviour rebuilt each step; only settled state moves) | Temporal worker versioning, upgrade-on-continue-as-new | **STRONG HYPOTHESIS** |
| Durable identity, residency as an evictable cache | PRM (passivation); EVE (identity ≠ ownership) | Orleans virtual actors; Cloudflare Durable Objects | **STRONG HYPOTHESIS** |
| Supervision with restart budgets and escalation | Partial: PRM recovery journals; HER owner records | Erlang/OTP; Akka | **NEW — ADOPTED** |
| Level-triggered reconciliation after crash | OC boot sweep; DSH crash closers | Kubernetes controllers | ADOPTED |
| Durable timers; waiting is free | DSH, HER, PRM schedules | Temporal, Durable Objects alarms | ADOPTED |
| Read-time upcasting; events never rewritten | DSH (versioned formats) | Akka, Axon, EventStoreDB | ADOPTED |

**The one thing the precedents do not give.** Workflow engines replay *deterministic code*. UCI must journal
*non-deterministic decisions*: every model call is a recorded effect whose output is stored, never recomputed.

- *Evidence of adoption:* OpenAI Agents SDK on Temporal, Vercel Workflow, Microsoft Agent Framework.
- *What it means:* replay of a cognitive process reproduces its decisions *from the record*. A behavioural-equivalence
  notion for "the same process after a model swap" remains **undefined in the literature** (`R4` §12.1). The
  cognitive-resume battery (`02` §4) is UCI's proposal for it.

---

## 2. The cognitive process

The process model below assembles only proven pieces. Each piece is REPLICATED; the assembly is a STRONG HYPOTHESIS.

1. **Identity.** A durable process id outlives all runs, epochs, activations, models and machines. It is scoped under an
   entity (`02` §6).
2. **Ownership.** Holding a lease plus a fencing token, which the record checks at every append. Zombie activations
   cannot commit.
3. **Replay unit.** The epoch journal.
4. **State.** A decide step may call a model, and that call is recorded as an effect. It emits typed records. A pure
   apply step folds them into the authoritative cognitive set (`02` §3). Effects run only after persistence.
5. **Epochs.**
   - *When:* at a size threshold, at a code or policy upgrade, or at a natural boundary (a goal completed, a lesson
     ended).
   - *What:* the process writes an **epoch checkpoint**:
     - the authoritative cognitive set, by reference;
     - open effects, including `UNKNOWN` ones;
     - its capability set and versions.

     It then continues as new.
   - *Why it matters:* the epoch checkpoint is what a different model on a different machine resumes from.
   - *Open:* a verifiable sufficiency criterion — held-out continuation from the checkpoint equals continuation from the
     full journal (`R4` §12.2). This is E-RA2.
6. **Residency is a cache.** An activation holds in-memory working state, a warm prompt-cache prefix and open
   connections. It is created on demand and collected when idle. Deactivation hooks are never relied on.
7. **Inputs.** A durable inbox. A steering input interrupts an *anytime* computation at a safe boundary. A queued input
   waits.
8. **Children.** A child is a full process with its own identity and journal, and an **attenuated capability set minted
   from the parent's** (§3). Its result returns as a typed notification with a closed state set plus `UNKNOWN`
   (A2A-style). Artifacts are passed by reference.
9. **Supervision.** Every process has a supervisor: another process, or the person. The supervisor is a
   level-triggered reconciler over the record. It computes signals from **evidence, not self-report**:

   | Signal | Source |
   |---|---|
   | Crash | Runtime record |
   | Restart count within a window | Runtime record |
   | **Stall** — no new evidence or state change in *k* steps | MAST step repetition, 15.7% of failures |
   | **Termination ambiguity** — no acceptance predicate satisfied | MAST, 12.4% |
   | **Verification debt** — consequential claims left unverified | MAST, 8.2% |
   | Budget exhaustion | Metering |

   Restart budgets follow OTP. Escalation ends at the person.
10. **Restart semantics differ from Erlang.** "Let it crash" applies to *cognition*, not to *effects*. Before any retry,
    the supervisor consults the effect ledger and reconciles every `UNKNOWN` effect: query the external system,
    compensate, quarantine, or ask the person. **The effect boundary is part of the error kernel.**

**Evidence.** MAST (1,642 traces, κ = 0.88) finds that most multi-agent failures are *runtime and supervision* failures,
not model failures. Every one of the signals above can be computed from the record.

---

## 3. Authority

**Prior UCI.** Structural authority envelopes; delegation attenuates; fail closed.

**What the evidence adds.**
- **Today's harnesses create confused deputies.** They grant agents the person's standing permissions, checked by tool
  name. OC's child authority is not a subset of the parent's; PRM children inherit everything (`A-OC §23.5`,
  `A-PRM §23.4`).
- **The proven fix** is object capabilities:
  - an unforgeable designation of a *specific resource*, plus rights, plus **caveats** — budget, time, scope,
    third-party approval (macaroons);
  - delegation that only narrows;
  - a **derivation tree** with **cascading revocation** (seL4).
- **The same tree can carry consent.** Revoking a person's consent revokes every capability derived under it.

**Prompt injection is an authority problem.** Structural defences converge on the AgentDojo benchmark:

| Defence | Result |
|---|---|
| CaMeL | 77% of tasks solved with provable security, vs 84% undefended |
| Progent | Attack success cut from 41.2% to 2.2% |
| FIDES information-flow labels | Blocked all attacks in the suite |

Whether this holds for open-ended work, where the plan depends on untrusted content (tutoring from uploaded documents,
research, browsing), is **untested** (`R4` §12.5). UCI's "untrusted content is data" law is implemented by *labels plus
capabilities*, not by prompting.

**Durable governance.** Every governance decision — approval asked, answered, denied, expired — is a durable record.
OC's ephemeral approvals are the counter-example: enforcement with no provable audit (`A-OC §28.7`).

**Status.**

| Element | Status |
|---|---|
| Capabilities with caveats and cascading revocation | ADOPTED |
| Consent as a capability-tree root | STRONG HYPOTHESIS |
| Structural injection defence for open-ended work | OPEN |

---

## 4. What the kernel contains

**The test.** *Would this still make sense if the concept of "AI agent" disappeared entirely?*

| Element | Passes? | Why | Prior UCI kernel? |
|---|---|---|---|
| Identity of principals, processes, entities and artifacts | Yes | Any multi-principal system | Yes |
| **The causal record**: typed, versioned, append-only per scope; epoch + sequence fencing; read-time upcasters | Yes | Any durable system | Yes, as "event log", generalized (§6) |
| **Effect ledger**: called-before-run, settled once, `UNKNOWN`, idempotency keys | Yes | Any payment system | Implicit; now explicit |
| **Authority**: capabilities with caveats, attenuation-only delegation, derivation tree, cascading revocation, label propagation (consent, trust, confidentiality) | Yes | Any multi-tenant operating system | Yes (envelopes); strengthened |
| Leases and fencing | Yes | Any distributed system | Yes |
| **Durable time**: timers, alarms, due queues | Yes | Any scheduler | Partially ("scheduling primitives") |
| **Supervision contract**: every process has a supervisor; failure, stall and budget signals are records; restart policy and escalation | Yes | OTP is not about AI | **New** |
| **Epoch contract + code/policy version stamping** | Yes | Any long-running workflow | **New** |
| **Metering and budgets**: every effect records its cost against a budget attached to a capability | Yes | Cloud billing | **New** |
| Governance hook: deterministic policy evaluation before every effect; an absent answer is a denial | Yes | Any reference monitor | Yes |
| Contracts: versioned schemas for every exchange | Yes | Any interface | Yes |

**What is out of the kernel** (harness or environment):
- context compilation and prompt caching;
- model routing;
- value-of-computation policies — the *recording mechanism* is kernel, the *policy* is harness;
- injection-defence execution patterns — these sit on top of kernel labels and capabilities;
- stall heuristics specific to LLM behaviour;
- consolidation;
- multi-agent topology;
- any notion of "prompt", "turn", "subagent" or "tool call" — a tool call is just an effect.

**The unit lifecycle** — describe / prepare / execute / health / shutdown — moves to the harness. It is a component
convention, not a kernel law.

**Is the kernel still small?** It is larger in *kinds* than before and smaller in *concepts*. Every element is an
operating-system concept that has survived decades. None changes when models improve. This is the absorption
principle's definition of structure.

---

## 5. Cognitive economics

**Prior UCI.** Expected value of computation; cheap-to-expensive tiers; model choice as routing.

**What the evidence establishes** (`R4` §8–9, REPLICATED unless noted):

| Finding | Figure |
|---|---|
| Rational metareasoning | Buy a computation only if its expected value exceeds its cost (Russell & Wefald); anytime algorithms; resource-rational design (Lieder & Griffiths) |
| Difficulty-adaptive test-time compute | Over 4× more efficient than uniform (Snell) |
| Routers and cascades | Cost cut by 2× to 98% at equal quality, dataset-dependent (FrugalGPT, RouteLLM) |
| Prompt caching | 41–80% savings; a cache-hostile layout wastes it |
| Sleep-time precomputation | About 5× less test-time compute when demand is predictable (single study, CLAIMED) |
| Multi-agent as spending | Token usage explains 80% of performance variance; multi-agent uses ~15× chat tokens. CONTESTED by task class. |
| **Gap** | **No surveyed system logs predicted vs realized value per step, so none can learn to allocate** |

**Revision (STRONG HYPOTHESIS).**
- UCI needs an **attention/resource substrate** in exactly one sense: **metering + budgets + outcome linkage in the
  kernel, and allocation policies as swappable harness modules evaluated on replay.**
- The measurement is *structure*. The allocators are *scaffolding* (UCI §26).

**Minimal version with measurable value:**

1. **Metering (kernel).** Every effect records tokens (input, cached, output), money, latency, model and effort, and the
   capability and budget it was charged to.
   - *Check:* the cost of any process or goal is a query on the record.
2. **Budgets (kernel).** Capabilities carry budget caveats. Children get sub-budgets. Exhaustion is a supervision event.
   - *Check:* the containment test.
3. **Outcome linkage (harness).** Each consequential step records a predicted value; this is an expectation claim
   (`03`). A verifier later settles its outcome.
   - *Check:* the calibration curve of predicted vs realized value, per policy.
4. **One allocator, ablated.** Per-step effort and model selection by estimated difficulty, with a verifier-gated
   cascade.
   - *Metric:* cost per verified outcome, and verified-success rate, against a fixed-model baseline on a replayed
     workload.
5. **Cache-aware compilation (harness).** Deterministic, ordered by volatility (`05` §5).
   - *Metric:* cache-read ratio and cost per step.
6. **Background work as priced investment (later).** A sleep-time job runs only when P(reuse) × savings > cost, and
   realized reuse is logged.
   - *Metric:* realized amortization. The job class stops if amortization falls below 1.

**Tensions.**
- A learned allocator risks Goodharting the verifier it is judged by. The verifier is held outside the allocator's
  optimization loop (UCI §29).
- Non-myopic value of computation is intractable, so allocation policies stay heuristic and are measured.

**Cognitive economy reality test.** Over a replayed workload:
- cost per verified outcome falls, or quality per unit cost rises, relative to a fixed baseline;
- spend concentrates where realized value was high.

---

## 6. "Events are the spine", generalized

**Prior law.** Events are the spine; state is a projection; one log.

**Revision (STRONG HYPOTHESIS → ADOPTED as a law):**
- **Durable causal provenance for every cognitively consequential transition.**
- **One semantic authority per concept.**
- Physical form is free, subject to rebuildability.

**Evidence.**
- *For the invariant:* every system with continuity has causal provenance (E1–E7). Durable-execution practice
  (`R4` §10) shows journals, snapshots, epochs, archival and upcasting coexisting.
- *Against hard-coding a mechanism:*
  - OC's "event-sourced" design keeps projections as the only durable truth, with the event log off by default. It still
    achieves crash continuity but loses audit, and its destructive revert cannot be undone (`A-OC §28.4`).
  - EVE achieves crash transparency through an SDK step journal, not a domain event log (`A-EVE §19.1`).
  - HER achieves continuity through row-level sidecars (`A-HER §19.1`).
- *What the variety shows:* the *invariant* (reconstructable, attributable transitions) matters. The *mechanism* varies.
- *Failure that constrains the mechanism:* OC shows that making the record **optional** breaks the invariant quietly.
  The law therefore says **unconditional** causal provenance, never a flag.

**Consequences.**
- The kernel's causal record is the *contract*: typed, versioned, attributable, reconstructable.
- A system may realize it as an event log, projections with commit hooks plus retained events, or journals with epochs —
  as long as every consequential transition is reconstructable and every projection is rebuildable.

---

## 7. Experiments

| ID | Experiment | Graduation | Status |
|---|---|---|---|
| E-RA1 | Disclosure vs receipts vs a classified combination under injected crashes across effect classes | Fewest wrong final states and repeated effects; reconciliation cost bounded | OPEN (H-RT1) |
| E-RA2 | Epoch-checkpoint sufficiency: held-out continuation from the checkpoint vs from the full journal | Equivalent continuation quality | OPEN |
| E-RA3 | Supervision signals from the record alone (stall, termination ambiguity, verification debt) vs model self-report | Better precision and recall for real failures; acceptable false escalations | OPEN |
| E-RA4 | Capability attenuation + cascading revocation under containment and injection red-teams, including open-ended tutoring from uploaded documents | Containment holds; utility cost measured | OPEN |
| E-RA5 | Difficulty-adaptive effort/model allocation with a verifier-gated cascade vs a fixed model on a replayed UCI workload | Lower cost per verified outcome at non-inferior success | OPEN |
| E-RA6 | Single process vs parallel children at equal token budget, per task class | Decide multi-agent use per task class by evidence | OPEN |
| E-RA7 | Upgrade at epoch boundaries: behavioural drift across code/policy upgrades for long-lived processes | Drift bounded and detected | OPEN |
