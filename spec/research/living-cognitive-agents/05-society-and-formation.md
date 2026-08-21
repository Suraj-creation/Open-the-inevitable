# 05 — Society, Formation & Model Routing

*Part of the [Living Cognitive Agents](README.md) corpus. The multi-agent society, evidence-based
trust, disagreement, dynamic team formation, and model routing. Design, not status.*

---

## 1. Relationships & evidence-based trust — `RESEARCH FRONTIER`

The brief (§14) asks for a persistent agent collaboration graph where trust is *earned from evidence*,
never asserted. UCI already records the raw material: the `agent.collaboration` distiller captures how
the ensemble negotiated per topic. The missing piece is projecting that into a durable
**Agent Relationship** ([`03` §1.4](03-cognitive-state-and-memory.md#14-agent-relationship--research-frontier))
and letting the router read it.

The critical discipline, stated once and applied everywhere: **reliability is recorded automatically
but routes only after calibration.** An Explainer→Research reliability of 0.86 must mean "when the
Explainer escalated to Research, the outcome improved 86% of the time, and this estimate is calibrated"
— not "the model asserted 0.86." Until the Cognitive Evaluation Layer certifies the estimate, the
relationship is *observability-only*: it appears in the Cognitive Surface's "why did this agent ask
that agent" trace, but it does not change which agent is chosen. This prevents the two failure modes
the brief flags: fake trust (§14) and agent collusion (§36, two agents whose mutual reliability
inflates without real outcome improvement — caught because reliability is grounded in *learner
outcome*, not inter-agent agreement).

How a calibrated relationship influences orchestration:
- **Routing preference.** Among agents capable of a task, prefer the one whose relationship with the
  requester has the best calibrated joint-outcome record for *this task type*.
- **Escalation targeting.** When an agent defers (self-model says "defer_when"), the relationship graph
  picks *whom* to defer to.
- **Disagreement weighting.** In a debate, a more reliable agent's position carries more weight — but
  never silences the minority (§2 below).

## 2. Disagreement as first-class, and as learning data — `ARCHITECTURALLY SUPPORTED`

UCI already treats disagreement as a surfaced signal (`disagreement.raised` event; the supervisor
arbitrates or escalates). The Living-Agent extension makes disagreement *productive*:

```
  proposal → counterproposal → evidence exchange → critique →
       resolution (arbitrated | escalated | unresolved-recorded)
       → DECISION (with rationale) → RECORD (becomes learning data)
```

Three rules:
1. **Convergence is not the goal; correctness is.** A society that always agrees is either trivial or
   collusive. Productive disagreement — grounded in evidence — is a feature. This is why the
   supervisor arbitrates *with a documented rationale* rather than averaging.
2. **Unresolved disagreement is a valid, recorded outcome.** When evidence is genuinely insufficient,
   "we disagree and here is why" is stored (with both positions) and, in Educator/Institutional mode,
   escalated to a human. Minority positions are preserved when uncertainty is meaningful.
3. **Disagreement is training signal.** Every resolved disagreement updates the calibrated reliability
   of the participants (who was right, given the eventual outcome) — feeding §1. The adversarial-verify
   pattern from UCI's own review tooling is the model: independent skeptics, majority to overturn,
   disagreement recorded either way.

**Caveat the external research forces (see [`07`](07-research-landscape.md)):** multi-agent debate does
*not* reliably beat a single strong agent on many tasks, and can be more expensive for worse results.
So disagreement machinery is invoked **selectively** — for high-risk / high-uncertainty outputs where
the calibrated expected value of a second opinion exceeds its cost — not by default. The supervisor's
job includes deciding *when a society is worth convening at all*.

## 3. The society: fixed roster now, dynamic formation later

> **Reframed by [`09`](09-cognitive-environment-runtime.md#3-the-reframe-that-answers-do-not-hardcode-a-fixed-number-of-agents):
> the roster is not hardcoded, because most of the "society" is not agents.** The Prime-Agent
> synthesis generalizes *agent → Cognitive Process*. There are two populations, and conflating them is
> the error this section originally risked:
> - **Autonomous agents** (own Constitution + Adaptive Policy + accumulation): a *small, curated,
>   persistent* set. Introducing a new *kind* of autonomous agent stays governed and `LONG-HORIZON`
>   (§3.2). Today's ~19 wired agents are the *seed* of this set, **not a ceiling**.
> - **Cognitive processes** (retrieval, verification, simulation, reflection, consolidation,
>   representation, research tasks…): an *open, large, mostly-ephemeral* set, composed dynamically per
>   problem via [Recursive Cognitive Invocation](09-cognitive-environment-runtime.md#4-new-primitive--recursive-cognitive-invocation-generalized-rlm).
>   This is where UCI's *"many small deep tasks"* live — and it is **not** the swarm-of-agents
>   anti-pattern, precisely because most of these processes are lightweight, often deterministic, and
>   never autonomous.
>
> So §3.1–§3.2 below concern the **autonomous-agent** population specifically; the open process
> population is governed by budgets and spawn-caps, not by a fixed catalog.

### 3.1 What UCI has — a fixed, supervised roster

Today: a supervisor routes among ~19 fixed agent types via static confidence weighting. This is
**correct for the current stage** and should not be prematurely replaced. A fixed roster with a good
supervisor and a blackboard (both exist) is Stage 6-capable once relationships calibrate.

### 3.2 Dynamic agent formation — `LONG-HORIZON VISION`, with a hard warning

The brief (§42–43) envisions the system *forming teams* and *spawning temporary specialist agents*
for novel tasks. This is genuinely valuable at the frontier (a research task no fixed agent covers)
but it is the **highest-risk capability in the entire corpus** and must be gated hardest:

```
  problem → decompose → capability discovery → team formation →
       role assignment → execution → evaluation → team learning
```

The failure modes are severe and specific: **runaway spawning** (agents spawning agents without
bound), **agent dependency loops**, **resource exhaustion**, **capability dilution** (spawning a
"specialist" that is just a re-prompted generalist with a fake competence claim). Therefore, if ever
built:
- **Spawn depth and fan-out are hard-capped** (UCI already has `maxSpawnDepth`/`maxChildrenPerAgent`
  patterns in the reference multi-agent analysis; adopt them).
- **A dynamically-formed agent has NO Adaptive Policy and NO durable identity** — it is ephemeral, its
  Constitution is a *narrowed projection* of an existing agent's, and it is retired at task end. It
  cannot accumulate; only *persistent* agents accumulate. This keeps the "thousands of agents" (§42)
  problem bounded: the persistent roster stays small; ephemeral agents are cattle, not pets.
- **Every formation is a governed, budgeted, observable event.** Team formation is an E3 operation.
- **A formed agent's outputs are quarantined** until verified against the persistent society's
  standards.

This corpus's position: **do not build dynamic formation until Stages 2–4 are proven.** A fixed roster
of *experienced, adaptive, self-reflective* agents will outperform a dynamic swarm of *stateless* ones
for years. Dynamic formation is a scaling answer to a problem UCI does not yet have. It is documented
here for completeness and explicitly placed beyond the [implementation
boundary](08-roadmap-and-adrs.md#4-implementation-boundaries-deliverable-n--what-to-not-build-yet).

## 4. Institutional & collective memory — the society's shared learning

When many learners' agents run, patterns emerge that no single agent-learner pair can see (a
prerequisite chain that breaks for everyone; an analogy that works across a cohort). UCI's collective
intelligence must obey one rule the brief and the PCI corpus both insist on: **collective memory is
aggregated and anonymized; raw personal cognitive state never leaves the learner's envelope.**

- A *default* (learner-null) Agent Adaptive Policy is the vehicle: cross-learner patterns, once
  calibrated and stripped of personal data, update the agent's *default* strategy — improving the
  starting point for every future learner without exposing any individual's data.
- Promotion from personalized → default policy is a **governed, anonymizing** operation (E2/E3), never
  automatic, and always aggregate.
- Individuation is preserved: the default improves, but each learner's personalized overlay still
  dominates their own experience. Homogenization is not the goal (brief §12.1 collective-intelligence
  boundary).

## 5. Model routing — the property that makes everything else durable

Model independence ([`02` §7](02-the-living-agent-thesis.md#7-why-this-is-the-right-architecture-even-if-models-get-far-more-capable-brief-51))
is not a feature of the routing layer; it is the *reason the externalized-state design wins*. The
router is simple; its importance is that agent state does not live in the model.

```
  persistent agent (Constitution + Policy)
        ↓ compiles a cognitive task with declared MODEL REQUIREMENTS
        ↓ (reasoning depth, latency budget, modality, structured-output, verification)
  MODEL ROUTER
        ├── reasoning model      (deep, slow, expensive)
        ├── fast model           (shallow, cheap, low-latency)
        ├── vision / speech / embedding models
        ├── verifier model       (checks another model's output)
        └── specialist / local / future model
```

Design points:
- The agent declares **capability requirements**, not a model name (UCI already does this behind the
  `ModelRuntime` contract). The router maps requirements → available models by cost/latency/quality
  policy. Today's `ModelRuntime` adapter is the seam; the router is a thin policy layer above it that
  does not yet exist as a distinct component (it is implicit).
- **Memory, skills, identity, Policy, and the Belief State all persist across a model swap by
  construction**, because they are substrate artifacts referenced by id, not weights or prompt state.
  A decade of accumulated learner and agent cognition survives every model upgrade — this is the
  answer to the brief's §19.
- **The recording seam makes replay model-independent too:** `RecordingModelRuntime` already records
  model outputs (D3), so a session captured under model X replays deterministically even after the
  system moves to model Y. Model independence is thus both a *durability* and a *replay* property.
- **Verification is a routing target, not an afterthought.** High-risk outputs route through a verifier
  model as a distinct step — the same adversarial-verify discipline used in the disagreement machinery.

## 6. How a learner meets "their" agent — the projection, concretely

The brief (§20) wants a learner to interact with *their* evolving Explainer, not a generic one — while
all role-views stay consistent with one world state. This is exactly the [`03` §4](03-cognitive-state-and-memory.md#4-the-learner-model-dual--one-epistemic-substrate-two-faces)
dual, made concrete:

```
                    ┌──────────────── ONE SHARED SUBSTRATE ────────────────┐
                    │  Learner Belief State  +  World-State  +  Event Log    │
                    └───────────────────────────┬──────────────────────────┘
                     projected + agent Policy    │
        ┌───────────────────┬────────────────────┼───────────────────┐
        ▼                   ▼                    ▼                   ▼
   THEIR Explainer    THEIR Challenger      THEIR Planner      THEIR Research Agent
   (Constitution_E +  (Constitution_C +     (Constitution_P +  (Constitution_R +
    Policy_E,learner)  Policy_C,learner)     Policy_P,learner)  Policy_R,learner)
        │                   │                    │                   │
        └───────────── all read the SAME Belief State ───────────────┘
                    (no agent owns a private learner model)
```

"Their Explainer" = the Explainer Constitution + the `(explanation, thisLearner)` Adaptive Policy,
compiled against the shared Belief State. It *feels* personal and evolving because the Policy is; it
stays consistent with every other agent because they all read one Belief State; and it survives model
upgrades because none of it is in the model. The personalization is real, durable, governed, and
inspectable — and it is a *projection*, not a fork.

## 7. The Epistemic Workspace — collective inquiry state

*Status: `RESEARCH FRONTIER` → `LONG-HORIZON`.* The review round identifies a real gap for
the *research* horizon: relationships and routing describe how agents *find and trust* each other, but
a research-capable society needs more — a **persistent, structured, shared inquiry state**. A future
research constellation (Research Agent, Simulation Agent, Literature Agent, Verification Agent,
Experiment Agent) should not merely "route to" or "trust" one another; it should collaborate over a
shared epistemic world containing claims, evidence, hypotheses, experiments, predictions, results,
contradictions, decisions, open questions, and their confidence, provenance, owner, and status.

**The correction — this is NOT a new store, and NOT a message queue.** The Epistemic Workspace is the
**collective projection of two things UCI already has or already proposes**, rendered onto the
existing blackboard:

- the **Claim Graph** (ADR-0040/0041) — already models Claim + Evidence + epistemic-status +
  `contradicts`, as world-state nodes/edges. It supplies claim/evidence/contradiction/confidence/
  provenance *today*.
- the **Intention / Commitment Graph** ([`03` §1.5](03-cognitive-state-and-memory.md#15-the-intention--commitment-graph--research-frontier))
  — supplies hypothesis/experiment/plan/open-question/decision/owner/status.

```
              ┌──────────────── ONE SHARED WORLD STATE ────────────────┐
              │   Claim Graph            +      Intention/Commitment      │
              │  (claims, evidence,             (hypotheses, experiments, │
              │   contradictions)                open questions, decisions)│
              └───────────────────────────┬────────────────────────────┘
                            projected onto the blackboard as
                              THE EPISTEMIC WORKSPACE
                                          │
        ┌────────────┬────────────┬───────┴───────┬────────────┬──────────┐
        ▼            ▼            ▼               ▼            ▼          ▼
    Research     Simulation   Literature     Verification  Experiment   (…)
      Agent        Agent         Agent           Agent        Agent
        └── all read/append the SAME structured inquiry state, governed, event-sourced ──┘
```

The society thereby becomes *"a persistent organization of specialized cognitive processes acting on a
shared epistemic world"* rather than a collection of chatting agents — which is exactly the
education → **research → discovery** transition that is UCI's deeper ambition. Every append is a typed,
governed, provenance-bearing mutation (a claim asserted, a hypothesis opened, an experiment recorded,
a contradiction surfaced), so the workspace is replayable and auditable like any world-state region.

**Discipline (why this is deferred hard):** the Epistemic Workspace is `RESEARCH FRONTIER` shading to
`LONG-HORIZON` and sits at the top-right of the [maturity space](02-the-living-agent-thesis.md#6-the-maturity-ladder-deliverable--agent-evolution-model)
(Society-Embedded × research-capable Horizon). It must **not** be built before the single-agent loop
(L2) and the collective-memory/relationship layer (L4) are proven — a shared inquiry state over
un-calibrated agents would amplify, not resolve, error (see the
[contamination-propagation failure mode](06-runtime-data-observability.md#6-failure-modes-deliverable--brief-36-each-with-detection--prevention--rollback)).
It is documented here so the society's primitives (Claim Graph, Intention Graph, blackboard) are
designed *compatible with* it from the start, not retrofitted.

→ Continue to [`06` — runtime, data, observability & evaluation](06-runtime-data-observability.md).
