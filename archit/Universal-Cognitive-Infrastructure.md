# Universal Cognitive Infrastructure

**The enduring vision of The Inevitable**

> **What this document is.** The permanent direction of the whole system: what we are building, why
> it must exist, the laws it obeys, its anatomy, how it runs, how it specializes, how it evolves, and
> how we will know it is real. It is written to remain true across many generations of models,
> databases, frameworks, and implementations — and to guide the architecture's evolution without
> deciding prematurely what its final form must be.
>
> **What this document is not.** It is not evidence. Nothing here asserts that any capability exists
> today — the code and its tests are the only evidence of that. It is not a roadmap with dates, a
> feature list, or a status record.
>
> **Companion.** [`Lifelong-Cognitive-Memory-and-Harness.md`](Lifelong-Cognitive-Memory-and-Harness.md)
> is the deep design of the two systems everything else rests on: the lifelong memory substrate that
> provides continuity, and the Universal Cognitive Harness that operates over it.
>
> **The corpus beneath it.** This document is the top of an evidence-linked corpus
> ([`README.md`](README.md)). The corpus holds hypotheses and experiments (`01`–`12`), evidence (`research/`, `13`, and the
> source-level archaeology of seven reference harnesses), and the record of how and why this vision last changed
> ([`00-architecture-evolution.md`](00-architecture-evolution.md)). Where a statement here is a bet rather than a
> commitment, it says so. The status vocabulary is the corpus's own.

---

## Contents

- **Part I — Purpose:** 1 The thing we are building · 2 Intelligence must persist · 3 Why this is
  inevitable · 4 Four properties, four timescales
- **Part II — First Principles:** 5 The axioms
- **Part III — The Shape of the System:** 6 Anatomy · 7 The cognitive kernel · 8 The persistent
  substrate · 9 The Universal Cognitive Harness · 10 Cognitive environments · 11 Surfaces · 12
  Adapters and replaceability
- **Part IV — Intelligences and Capabilities:** 13 A system of interacting intelligences · 14
  Capabilities: composed, measured, and known to the system
- **Part V — How Cognition Runs:** 15 The end-to-end loop · 16 Long-running work · 17 The society of
  processes · 18 Simulation · 19 Verification · 20 Traceability and replay · 21 Attention,
  scheduling, and background cognition
- **Part VI — Specialization:** 22 General and deep at once · 23 Education, the first proving ground ·
  24 The path of domains · 25 Software engineering, where UCI builds UCI
- **Part VII — Evolution:** 26 The absorption principle · 27 Pluggability is permanent · 28 The
  architectural observatory · 29 Governed self-evolution · 30 Architectural evolution
- **Part VIII — Trust:** 31 Human sovereignty · 32 Authority and safety · 33 Privacy, consent, and
  information flow
- **Part IX — Proof:** 34 The reality tests · 35 Measuring compounding · 36 Failure modes
- **Part X — Building It:** 37 From nothing to everything · 38 From concepts to primitives · 39 The
  architectural test · 40 Enduring definition

---

# Part I — Purpose

## 1. The thing we are building

The Inevitable is building **Universal Cognitive Infrastructure (UCI)**: a persistent computational
environment in which intelligence can continue across time — accumulating experience, reorganizing
state, retrieving context, executing real work, verifying outcomes, learning, specializing, and
evolving.

UCI is not a chatbot, not a coding agent, not a fixed agent harness, and not a framework of prompts.
Those are things that can be _built on_ UCI. The object of our work is the environment beneath them:
the place where cognition lives _between_ invocations, where its history accumulates, and where it
becomes more capable because of what it has done before.

The long-term objective is a **Cognitive Continuity Engine** — intelligence that does not restart
from zero at every interaction, but carries its history forward and turns experience into
increasingly capable future cognition: for a person, for a body of work, and for itself.

Two pursuits run in parallel and feed each other; neither is subordinate:

- **The product** is UCI itself — infrastructure that is real, durable, observable, governed, and in
  use by people.
- **The research** is the computational foundations of cognition — memory, reasoning, learning, world
  models, continual adaptation, autonomous research and discovery. Research graduates into UCI only
  through evidence.

The first deep proving ground is **education**. It is not the boundary. The same substrate must
eventually support research, software engineering, analysis, writing, design, planning, personal
assistance, experimentation, operations, and domains that do not yet exist.

**The furthest horizon.** Running cognition is not the end state. A mature UCI is a substrate on
which cognitive systems themselves are **constructed, run, evaluated, specialized, and evolved**: a
teaching environment for a new subject, a research program in a new field, a verifier for a new kind
of claim, a better way of organizing its own memory. Today people build these; progressively they
are built _with_ the system, and eventually they are proposed _by_ it — always under evidence and
governance. The Cognitive Continuity Engine is what a person experiences; a substrate for building
cognition is what the infrastructure becomes.

## 2. Intelligence must persist

A conventional model invocation is a pure function:

```
input → model → output            (and then everything is forgotten)
```

UCI is a loop that never ends:

```
 experience → interpretation → persistent state → context → cognition → action
     ▲                                                                     │
     │                                                                     ▼
 new experience ← evolution ← learning ← reflection ← verification ← outcome
```

**The durable object is the cognitive environment, not the chat session.** A session is a window
onto the environment; a model call is a moment of thought inside it; a process is a thread of work
that lives in it. Each element has exactly one role:

| Element            | Its role                                                                                                                             | What it is **not**                           |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------- |
| **Model**          | A reasoning faculty. Powerful, replaceable, one of many.                                                                             | The system. The memory. The identity.        |
| **Substrate**      | The durable truth: evidence, experience, memory, beliefs, skills, goals, commitments, processes.                                     | A cache of the conversation.                 |
| **Working state**  | A process's current cognitive state — objective, plan, relevant claims, open expectations and questions — a typed, model-independent **projection** over durable state. | A prompt. A second copy of the truth. |
| **Context window** | An attentional workspace: the working state rendered for one model, for one step.                                                   | The record. The source of truth.             |
| **Harness**        | What keeps cognition alive: processes, scheduling, compilation, tools, delegation, verification, recovery, budgets, policy.         | The intelligence itself.                     |
| **Environment**    | The world a process works in, with real depth: domain state, actions, observations, evaluators, skills.                             | A persona in a prompt.                       |
| **Surface**        | A projection of cognitive state for humans, and an instrument for steering it.                                                      | The substrate. A second, separate "chatbot". |

Persistent cognitive state must survive every one of these without loss: context compaction ·
process suspension · model replacement · application restart · device change · conversation
boundaries · tool failure · network failure · agent handoff · long inactivity · vendor change.

The strongest form of the thesis: **a different model, on a different day, on a different device,
must be able to continue the same work from the same working state — and do it well.** If that is
not true, the intelligence was living in the context window, and it was never persistent.

**Persistent execution is not persistent cognition.** The strongest agent systems have independently
converged, in source code, on a real substrate for persistent _execution_:
- stateless steps recomputed from durable records;
- effects recorded before they run and settled exactly once;
- admission separated from execution;
- ownership fenced at commit;
- views as projections;
- children as durable processes;
- typed failures.

After a restart they know _what was done_. None of them knows:
- _why_ it was done;
- what alternatives were rejected;
- what was expected to happen;
- whether it happened;
- what was learned;
- how reliable the system is at this kind of work.

That knowledge lives in transcript prose, or nowhere. UCI takes the execution floor as settled and builds what is
missing above it. Persistent cognitive state is defined by **cognitive equivalence under reasoner substitution**: a
fresh reasoner, given only the durable state, must reach the same decisions for the same reasons, pursue the same
commitments, hold the same uncertainties, and anticipate the same outcomes as the reasoner it replaces
(`01`, `02`).

## 3. Why this is inevitable

Reasoning capability is becoming abundant and interchangeable. Frontier models converge, costs fall,
new ones arrive every few months, and each one is — for an architecture that depends on any single
one — a migration.

What does **not** arrive with a new model: the lived history of a person and what they are trying to
become · the verified record of what worked, what failed, and why · the skills distilled from
thousands of completed tasks · the trust earned by acting correctly within authority, for years ·
calibrated knowledge of where the system itself is reliable · the state of long-running work that is
halfway done.

These accumulate only through time, and only in a system designed to keep them. The durable value of
intelligent systems is therefore migrating from the weights to the environment around them — to
**continuity**. Whoever builds the environment in which cognition persists, compounds, and remains
governable builds the thing that every future model runs inside.

**Corollary — every model improvement must be a tailwind.** If a better model makes a part of UCI
obsolete, that part was _scaffolding_. If a better model makes a part _more_ valuable, that part is
_structure_. We invest in structure and keep scaffolding thin, measured, and removable (§26).

**Not bounded by today's assumptions.** The goal is not to beat today's agents at their own game. It
is to leave behind the assumptions that bound them — each a reasonable simplification when models
were weak and context was scarce, each a ceiling as that stops being true:

| Today's systems are… | …which assumes                                  | UCI instead                                                                  |
| -------------------- | ----------------------------------------------- | ---------------------------------------------------------------------------- |
| Context-centric      | what the model knows is what fits in the window | state lives in the substrate; the window is a compiled view of it            |
| Session-centric      | work begins and ends with a conversation        | the durable object is the environment; sessions are windows onto it          |
| Model-centric        | the model is the system                         | models are replaceable faculties, routed per task                            |
| Task-centric         | cognition is a sequence of independent tasks    | goals, threads, and commitments persist for years                            |
| Prompt-centric       | behaviour is shaped by writing instructions     | behaviour is shaped by state, skills, policies, and evidence — under governance |
| Tool-centric         | capability means a longer tool list             | capability is composed, and its quality is a calibrated, measured belief (§14) |
| Execution-centric    | resuming the steps is resuming the work         | the reasons, expectations, and uncertainties resume too (§2)                 |
| Benchmark-centric    | quality is a score on a fixed test              | quality is continuous evaluation of real, verified outcomes                  |

## 4. Four properties, four timescales

**Four properties, two of them in tension.** The mature system must be, at the same time:

1. **General** — able to accept unfamiliar work, discover how to do it, and carry it for long
   periods: software, research, analysis, planning, anything.
2. **Deep** — able to operate inside a domain with its real representations, tools, evaluators, and
   knowledge at expert level: teaching a specific learner calculus for a year; refactoring a
   specific codebase with its specific history.
3. **Persistent** — able to carry work across time without loss.
4. **Adaptive** — able to learn better ways of doing the work, and to prove it.

Most systems choose between the first two. General agents are shallow everywhere; vertical products
are deep and brittle. UCI resolves this **structurally**: generality lives in the substrate and the
harness, which every domain shares; depth lives in **environments** (§10), which plug into them. The
same process runtime teaches a learner for months and refactors a codebase overnight.

**Four timescales, one infrastructure.**

| Mode         | Horizon                | What happens                                                                          |
| ------------ | ---------------------- | ------------------------------------------------------------------------------------- |
| Immediate    | milliseconds – seconds | perceive, route, retrieve, respond                                                    |
| Interactive  | seconds – minutes      | teach, code, research, create, analyze, collaborate                                   |
| Long-running | minutes – days         | execute projects, research, build software, wait on the world, monitor outcomes       |
| Lifelong     | months – years         | learn the person, preserve experience, evolve skills, maintain world models, compound |

The timescales feed each other: immediate interactions become episodes; episodes become threads,
beliefs, and skills; skills and beliefs change how the next immediate interaction goes.

---

# Part II — First Principles

## 5. The axioms

These are the permanent laws. Each is stated so that a violation is detectable. Code that violates
them is invalid even if it works.

| #   | Axiom                                                                                                                                                                                                                                   | A violation looks like                                                                                    |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| A1  | **Continuity.** State outlives every process, session, model, device, and surface.                                                                                                                                                      | Anything of cognitive value lost on restart, compaction, model swap, or closing the UI.                   |
| A2  | **Evidence is sacred; interpretation is revisable.** What was observed is preserved with provenance. Everything derived is a versioned interpretation that points back to its evidence and can be recomputed.                          | A summary that replaced its source. A belief with no path back to evidence.                               |
| A3  | **Stages never collapse.** Evidence → interpretation → claim → belief → world state → decision → action → outcome are distinct, and every transition is an explicit, recorded act by a named operator. A decision records what it relied on and what it rejected.                                    | A model's output stored as a belief. An action with no recorded decision. An outcome known only from the actor's own report. |
| A4  | **Causal provenance is unconditional; state is a projection.** Every cognitively consequential transition leaves a durable, causally linked record, and every view can be rebuilt from records. The event log is one realization of this law, not the law itself; what may never happen is a record that is optional. | A state change nothing explains. A table that cannot be regenerated. A causal record that can be switched off. |
| A5  | **Two compilations, one boundary.** A process's working state is derived from durable state — never an independent store of it; the context a model sees is compiled from that working state — fresh, budgeted, per step, with a manifest of what was included, what was excluded, and why. | A transcript growing until truncation decides what the model knows. A process whose state exists only as a prompt. |
| A6  | **Model-visible means derivable, with reasons.** Anything that reaches a model can be reconstructed exactly from durable records, and the reasons it was selected and what was left out are recorded. That those reasons are causally faithful and carry selection probabilities — _explained_ in the full sense — is a strong hypothesis, tested by context causality (§34). | A model call you cannot reproduce afterward. A model call with no record of why its context was chosen. |
| A7  | **Authority is structural.** Every process acts under an explicit authority envelope. Delegation can only attenuate authority, never amplify it. Privilege is held, never ambient.                                                    | A child that can do what its parent could not. A tool callable merely because it is in scope.             |
| A8  | **Governance precedes effect; effects settle exactly once.** Policy is evaluated _before_ a side effect, and an absent answer is a denial. Every external effect is recorded as called before it runs and settled exactly once; an outcome that cannot be known is recorded as _unknown_ and reconciled, never guessed (§15). | Logging or moderation as the only control. A retried payment. A crash that silently becomes "failed" or "succeeded". |
| A9  | **Verification is separate from generation, and verifiers are measured.** Model confidence — and a process's claim about itself — is never evidence. Every verifier has a known error profile and is kept outside what the actor can see or edit. | "The model said the tests pass." "The learner understood because the explanation was good." An agent that can read or rewrite its own grader. |
| A10 | **Similarity is not identity, causation, or truth.**                                                                                                                                                                                   | An embedding match that creates a relation, merges two people, or asserts a fact.                         |
| A11 | **Everything is replaceable behind a contract.** Models, stores, embedders, rerankers, sensors, sandboxes, tool providers, transports, surfaces. The contract is the only thing that must be stable.                                   | A vendor type visible outside its adapter. A rewrite required to try a new model.                         |
| A12 | **Learning is governed change to durable state.** The system improves only by typed, evaluated, recorded, reversible changes — to memories, beliefs, skills, policies, environments, and architecture.                                | Silent self-modification. Improvement that cannot be attributed or rolled back.                           |
| A13 | **Silence is an action.** Not acting, not interrupting, not remembering, not inferring are first-class decisions with their own policy.                                                                                               | A system that surfaces every thought, stores every sentence, or interrupts whenever it notices something. |
| A14 | **The person is sovereign over their cognitive state.** It is theirs: inspectable, correctable, exportable, and completely forgettable.                                                                                                 | A memory the person cannot see, cannot correct, or cannot fully delete.                                   |
| A15 | **Structure over scaffolding.** Invest in what model progress makes more valuable; keep what model progress makes obsolete thin and removable.                                                                                        | A hand-built pipeline that encodes today's model's weakness as permanent architecture.                    |
| A16 | **Close loops before widening.** A capability is real only when its loop closes end to end and survives restart: interface → runtime → cognition → persistence → retrieval → response → outcome → learning.                           | Ten half-built subsystems, none of which changes behaviour next week.                                     |
| A17 | **No fake cognition.** Fluent language is not understanding. A capability must be grounded in state, evidence, structure, verification, or measurable behaviour.                                                                      | A "reflection" that is prose no process ever reads. A "memory" that is never retrieved.                   |
| A18 | **One concept, one authority.** Every stable concept has exactly one semantic authority. Projections, indexes, caches, and replicas may be many, and may live in any store; none may redefine it. | Two stores that each claim to be the learner's current state.                                             |
| A19 | **Every concept is executable and measurable.** An architectural concept is real only when it corresponds to a minimal executable primitive and a measurable invariant (§38).                                                         | A named subsystem with no code path. A principle no check can fail.                                       |
| A20 | **Records outlive the code that wrote them.** Every durable record is self-describing — interpretable without the component, plugin, or model that produced it — and carries the versions under which it was made. | A session unreadable once a plugin is removed. A belief whose producing model version is unknown. |

The axioms are one idea seen from many sides — _intelligence as a persistent, accountable process over
durable state_. A1–A6 make cognition continuous, grounded, and reconstructable. A7–A10 make it
trustworthy. A11–A12 and A15 let it improve without breaking. A13–A14 keep it on the person's side.
A16–A20 keep the engineering honest.

**What changed, and why.** Four axioms were generalized in the last evolution pass (`00` §2):
- **A4** no longer mandates one physical event log. The references show continuity achieved through logs, projections
  with commit hooks, step journals, and row sidecars. They also show the one real failure: a causal record that could
  be switched off.
- **A6** splits _derivable_ (replicated in the references) from _explained_ (absent in all of them, and needed for
  learning from what the model saw).
- **A8** keeps only what decades of durable-execution practice prove. Committing a cognitive change only after its
  outcome is verified remains a strong hypothesis, stated in §15, not an axiom.
- **A20** is new. Durable records that only their writer's code can read were a recurring failure in the references.

---

# Part III — The Shape of the System

## 6. Anatomy

**Six kinds of thing, never confused.** Before asking where a component lives, ask what kind of
thing it is:

| Concept          | What it is                                                                                                                  | For example                                               | Not to be confused with                                   |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | --------------------------------------------------------- |
| **State**        | What is known and what is pending — the durable substrate, and each process's working state projected from it               | evidence, beliefs, skills, goals, a process's current plan | the context window                                        |
| **Process**      | What runs — a persistent computational entity doing cognitive work under an identity, objective, and authority            | a teaching process, a consolidator, a verifier            | a prompt; an agent — a persistent identity whose work runs as processes (§17) |
| **Capability**   | What can be done, and how well — a composition of faculties, knowledge, skills, actions, and evaluators, with measured quality (§14) | "explain this concept to this learner"; "fix a failing test" | authority (what a process is _permitted_ to do); a tool |
| **Environment**  | Where, and in what domain — a pack giving a domain its objects, actions, observations, evaluators, and policies (§10)     | education; a repository; a research corpus                | a persona                                                 |
| **Architecture** | How it is all composed — contracts, seams (§27), providers, projections, environments, process templates — held as versioned, inspectable data | a composition manifest; a contract version | the code that implements it                         |
| **Evolution**    | How any of the above changes — one governed ratchet, from a memory update to a structural change (§29–§30)                | a skill promotion; a new projection; a contract migration | unrecorded drift                                          |

State is what is; a process is what runs; a capability is what can be done; an environment is where;
the architecture is how it is composed; evolution is how it changes. Much design confusion is a
confusion between two of these.

**Where they live.**

```
 ┌───────────────────────────────── SURFACES ──────────────────────────────────┐
 │  cognitive surface · voice · workspace · CLI · API · messaging · devices     │  projection
 └──────────────────────────────────────▲──────────────────────────────────────┘
 ┌──────────────────────────── COGNITIVE ENVIRONMENTS ─────────────────────────┐
 │  education · research · software · analytics · writing · design · …         │  depth
 └──────────────────────────────────────▲──────────────────────────────────────┘
 ┌───────────────────────── UNIVERSAL COGNITIVE HARNESS ───────────────────────┐
 │  processes · steps & transactions · state & context compilation · tools     │  execution
 │  delegation · scheduler · simulation · verification · evaluation · evolution │
 └──────────────────────────────────────▲──────────────────────────────────────┘
 ┌──────────────────────────── PERSISTENT SUBSTRATE ───────────────────────────┐
 │  evidence memory · cognitive memory · operational memory                    │  continuity
 └──────────────────────────────────────▲──────────────────────────────────────┘
 ┌────────────────────────────── COGNITIVE KERNEL ─────────────────────────────┐
 │  identity · causal record · effect ledger · authority · leases · time       │  law
 │  supervision · metering & budgets · governance · contracts                  │
 └──────────────────────────────────────▲──────────────────────────────────────┘
                                        │ implemented by (injected, never imported upward)
 ┌────────────────────────────────── ADAPTERS ─────────────────────────────────┐
 │  models · stores · embedders · rerankers · sandboxes · sensors · transports │  replaceable
 └─────────────────────────────────────────────────────────────────────────────┘
```

**The dependency law.** Dependencies point inward, toward law. Surfaces depend on environments and
the harness; environments depend on the harness and the substrate; the harness depends on the
substrate; the substrate depends on the kernel's contracts; **contracts depend on nothing.** Adapters
_implement_ contracts and are injected at composition time; nothing above an adapter ever sees its
vendor. Environments never depend on each other directly — they meet only through shared substrate
objects. Reversing any of these arrows is an architectural violation, however convenient.

The anatomy also encodes **rates of change**. The kernel should change on the scale of years; the
substrate's shape on the scale of quarters; the harness monthly; environments weekly; policies,
skills, and template parameters daily — many of those changes made by the system itself, under
governance.
Things that change fast must never be load-bearing for things that change slowly.

## 7. The cognitive kernel

The kernel is the small, stable heart that everything else trusts. It should be small enough to be
right for a decade. It contains only what every conceivable domain needs:

- **Identity** — every person, process, agent, tool, device, source, and artifact has a stable
  identity that survives restarts and migrations. Identity, execution ownership, and residency are
  three different facts.
- **The causal record** — the durable, causally linked record of every consequential transition
  (A4). It includes epochs, so that long-lived histories can be compacted without loss of meaning,
  read-time upcasting, so that old records stay interpretable as contracts evolve, and version stamping —
  every record carries the versions of the contracts, components, and models under which it was made (A20).
- **The effect ledger** — every external effect is recorded as called before it runs, settled exactly
  once, and reconciled when its outcome is unknown (A8).
- **Authority** — authority envelopes as unforgeable capabilities with caveats. Delegation only
  attenuates; revocation cascades to everything derived. Consent and sensitivity labels travel with
  data and with authority, and the person's consent is a root of authority, not an annotation on it.
- **Leases and fencing** — ownership of a process or resource is leased; every commit is fenced
  against stale owners.
- **Durable time** — timers, deadlines, and waits that survive restarts; logical ordering for
  causality.
- **The supervision contract** — every running process reports liveness and progress in a form a
  supervisor can act on (restart, reassign, escalate). _Policies_ for supervision live in the harness.
- **Metering and budgets** — every model call, tool call, and process consumes metered resources
  against hard budgets, and consumption is linked to the outcome it bought.
- **Governance** — the hook through which policy is evaluated before effects; every decision is
  itself a recorded act with a reason; an absent or broken answer is a denial.
- **Contracts** — versioned schemas for every exchange: packets, events, memory mutations, tool calls,
  context manifests, process descriptors. A semantic exchange is never a bare string.

Units hold no durable state of their own; it lives in the substrate, which is what makes recovery
by reconstruction possible (§16). The uniform unit lifecycle and scheduling _policy_ are harness
concerns, not kernel concerns.

What never enters the kernel: any domain concept, any model-specific behaviour, any memory taxonomy,
any prompt, turn, or routing notion, any UI notion. Two tests guard it:

- **The domain test:** _could this kernel serve a domain that does not exist yet?_ If a proposed
  change only makes sense for education, it belongs in the education environment.
- **The agent test:** _would this still make sense if AI agents disappeared?_ Everything in the kernel
  is an operating-system concept with decades of evidence behind it: identity, durable records,
  exactly-once effects, capabilities, leases, time, supervision, metering. Anything that only makes
  sense because a language model is in the loop belongs above the kernel.

## 8. The persistent substrate

The substrate is where continuity lives; the companion document designs it in depth (companion §3).
Its essential
shape is **three memories under one causal-provenance contract**, each with its own correctness
requirement:

| Memory                 | Answers                          | Holds                                                                                                      | Must be                                                    |
| ---------------------- | -------------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| **Evidence memory**    | What happened?                   | What was observed, captured, stated, or sourced — including the system's own trajectories, the decisions it recorded, and the manifests of what its models saw — with provenance and consent | **Faithful** — exact, immutable, complete     |
| **Cognitive memory**   | What was learned?                | Claims — beliefs, expectations, resolutions, diagnoses, competence — the world, person, and self models they compose, and procedures (skills) | **Calibrated** — revisable, versioned, honest about uncertainty |
| **Operational memory** | What must be kept to continue?   | Execution state (processes, journals, open effects, schedules) and **intentional state** — goals, commitments, intentions, plans, open questions, open expectations | **Consistent** — exact and transactional, never approximate |

Underneath the three regimes are only **four kinds of object**:
- evidence;
- intentional and executive state;
- claims;
- procedures.

Episodes, threads, facets, graphs, and indexes are projections over these four kinds, not further stores
(`04`). Intentional state belongs with operational memory. A commitment remembered approximately is a broken
commitment.

Each memory has its own retrieval semantics: evidence is addressed exactly; cognitive memory is
retrieved by ranked relevance; operational memory is read by key. Serving one with the semantics of
another is a classic failure — a summary quoted as what was said; a process that only approximately
remembers where it was.

Five laws govern the substrate:

1. **One semantic authority, many projections.** Each concept has exactly one authority (A18). The
   dozens of useful memory dimensions — temporal, relational, procedural, affective, spatial — are
   _lenses_ over shared experience, never separate stores that compete to be true. Physical
   placement is free; semantic authority is not.
2. **Everything is a cognitive object.** Documents, hypotheses, decisions, tasks, plans, questions,
   evidence, experiments, skills, processes, and world-state snapshots are typed, addressable,
   versioned, linked, provenance-bearing, and policy-labelled. The workspace supports _create,
   inspect, search, compare, transform, branch, merge, delegate, verify, remember, forget, revise,
   link, simulate, schedule_ — a general algebra that every domain composes.
3. **Agent experience and human experience flow through the same substrate.** The harness's own
   trajectories — what it tried, what worked, what failed — are experience, stored and consolidated
   by the same machinery as a person's life. There is no separate "agent memory" silo; there are
   subjects and scopes.
4. **Memory is something the system does.** Capture, interpretation, formation, organization,
   retrieval, reconstruction, revision, consolidation, forgetting, and learning are performed by
   governed, budgeted, evaluated processes. **The substrate owns memory state and its authorities;
   the harness runs memory operators as ordinary processes over them.** There is one architecture,
   not a memory system beside a harness.
   - The operators are judged by what they make possible later: formation by whether what it stores changes
     future behaviour, and retrieval by whether what it brings back improves outcomes.
   - Truth is maintained at write time. A new claim is adjudicated against what it contradicts, supersedes,
     or depends on when it arrives, not left for retrieval to sort out.
5. **The substrate is not the database.** Storage engines are adapters chosen by benchmark. The
   architecture is defined by the objects, the causal record, and the laws — never by a vendor's feature list.

## 9. The Universal Cognitive Harness

The harness is the execution and control fabric that keeps cognition alive — an **operating system
for cognitive processes**. It manages process lifecycle, steps and transactions, state and context
compilation, model and tool routing, environment selection, delegation, scheduling, simulation,
continuation, interruption, escalation, recovery, verification, evaluation, budgets, permissions,
trajectories, observability, background cognition, and learning from outcomes.

A **process** is not a prompt. It is a persistent computational entity with an identity, an
objective, a constitution, an authority envelope, a memory scope, a budget, a working state, and a
journal of settled steps. It can be suspended for a month and resumed by a different model on a
different machine.

**The execution floor is settled engineering.** Independent systems converged on it, and durable-execution
runtimes have proven it for decades (`01`, `09`):
- each step is a stateless function over durable records;
- the model call is itself a recorded effect;
- effects are settled exactly once, with an honest _unknown_;
- admission is separate from execution;
- ownership is fenced at commit;
- views are projections;
- children are durable processes that report back by notification;
- failures are typed;
- long histories roll into new epochs without losing their meaning.

A process's residency in memory is a cache. Its supervision is driven by signals derived from its records — loops,
stalls, repeated failures — not by its own report. **"Let it crash" applies to cognition, never to effects.** A
reasoning step may be abandoned and recomputed freely. An effect may never be silently repeated or silently lost.

UCI adopts this floor rather than reinventing it. The harness's distinctive work begins above it: keeping decisions,
expectations, context reasons, and working state as durable as the steps themselves.

Two properties define the harness:

- **The harness is thin over the substrate.** It holds almost no state of its own; it reads and
  writes the substrate through typed contracts. Restarting the harness loses nothing.
- **Objective, harness, runtime, and environment are separate and composable.** The _objective_ is
  what must be achieved; the _harness_ is how cognition is organized to achieve it; the _runtime_ is
  where it executes (local, cloud, sandbox, device); the _environment_ is the world it acts in. The
  same objective can run in different environments; the same harness in different runtimes.

The harness is designed in depth in the companion document.

## 10. Cognitive environments

The deepest lesson of the best software agents is that **the interface between a model and its world
matters as much as the model** — how actions are shaped, how observations are formatted, how errors
are fed back. UCI generalizes this beyond software into the **environment**: the unit of domain
depth.

An environment is a pack that plugs into the harness and substrate:

| Component             | Meaning                                                                            | Education example                                          | Software example                            |
| --------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------- |
| **Ontology**          | The typed objects of the domain                                                    | learner, concept, misconception, source, lesson            | repository, module, test, issue, change     |
| **State**             | How domain state lives in the substrate                                            | learner belief state, curriculum position                  | working tree, build state, decision history |
| **Action space**      | Governed tools with schemas, side-effect classes, reversibility                    | explain, represent, ask, assess, render source, highlight | read, edit, run, test, commit, open PR      |
| **Observation space** | What comes back, shaped for a model to reason about                                | learner responses, timing, errors, confidence              | outputs, diffs, test results, logs          |
| **Outcome signals**   | At least one signal of success the harness observes itself, never the actor's report | a later answer to a transfer item                          | the exit code of the test run               |
| **State readout**     | A cheap, direct probe of current domain state, rather than inference from history  | the learner's current answer to a diagnostic probe         | `git status`; a build status                |
| **Evaluators**        | How success is measured — independent of the generator, with measured validity     | transfer tasks, delayed retrieval, misconception probes    | tests, types, benchmarks, review            |
| **Simulation**        | How its state can be forked, sandboxed, or predicted before acting (§18)           | a learner-model rollout of two explanations                | a branch; a dry-run migration               |
| **Skills**            | Procedural knowledge, seeded and learned                                           | worked-example-then-fade, analogy-bridge                   | bisect-a-regression, safe-migration         |
| **Policies**          | Domain constraints and ethics                                                      | pedagogical safety, age-appropriate content                | never force-push shared branches            |
| **Task distribution** | Typical objectives and benchmarks, so the environment can be evaluated and learned | "take this learner from fractions to algebra"              | "fix this failing test"                     |
| **Projections**       | Domain views on the surfaces                                                       | the teaching board, the learner's map                      | the diff view, the run timeline             |

An environment is also **self-describing**: it declares its actions, observations, evaluators, and
how faithfully it can be simulated. The harness, a planner, or a child process can learn what the
environment offers from the environment itself, not from a prompt.

**Depth is the richness of the pack; generality is everything the packs share.** An objective may
route across several environments at once — "build this feature for the education platform" is
simultaneously software, education, design, and product memory.

**Environments are evaluated too.** An environment is only as good as its evaluators. Before its
outcomes may train anything — skills, policies, beliefs about capability — its evaluators must be
shown to measure what they claim: a mastery check that predicts later transfer; a test suite that
catches real regressions. Environments are composable, and eventually constructed by the system
itself (§24) — which makes evaluator validity the central question of domain depth.

## 11. Surfaces

Interfaces are **projections** of cognitive state. They never define the substrate. The Cognitive
Surface, voice, workspace, CLI, API, messaging, and future devices are many windows onto **one
mind**: a person can start an idea by voice while walking, continue it on the surface, inspect it from
a terminal, and be reminded on a phone — with no restatement.

The Cognitive Surface is the primary environment of interaction, and it is an **observability and
intervention plane**, not a chat window. It makes visible what a process's working state holds —
current attention, active threads, relevant memories and _why they were retrieved_, evidence, beliefs
and uncertainty, goals and commitments, running and background processes, verification results, and
what the system is waiting for. And it lets the person act on cognition directly: _pause, resume,
redirect, challenge, approve, reject, branch, merge, promote, correct, forget, reprioritize,
delegate._

Voice is not a second chatbot; it is the lowest-friction surface into the same state. Every surface
interaction is itself experience that flows back into the substrate.

## 12. Adapters and replaceability

Everything below will change, probably many times: models, embedding systems, rerankers, speech and
vision models, databases, vector and graph engines, sandboxes, tool providers, transports, devices,
and the external services we depend on.

Therefore:

- Every such dependency sits behind a **contract** and is reached only through an **adapter**.
- Every adapter ships with **conformance tests** against its contract.
- Several adapters for the same contract can run at once, and **routing** between them is a runtime
  decision (by task, cost, latency, privacy, availability).
- **New technology is absorbed by writing an adapter and running the evaluation suite** — never by
  re-architecting. If adopting a better model requires touching the substrate or the harness core,
  the abstraction was wrong and must be fixed.

The goal is an architecture that becomes _better_ as technology changes, rather than one trapped by
the technology of the year it was written.

---

# Part IV — Intelligences and Capabilities

## 13. A system of interacting intelligences

UCI is not one monolithic "intelligence". It is a set of interacting families of capability that
share state but can be independently implemented, evaluated, routed, optimized, and replaced. None of
them is "the AI"; the intelligence is in their composition over persistent state.

**This table is vocabulary, not architecture.** No executable primitive corresponds to "an
intelligence", so none is built as one (A19). Each row names a family of capabilities (§14) — a
region of the system's competence — and says what it draws on and how it is judged. The
architecture is the substrate, harness, and environments. The intelligences are a way of talking
about what they do together.

| Intelligence      | What it does                                                                                                              | What it needs from the substrate                                            | How it is verified                                      |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------- |
| **Perceptual**    | Speech, vision, documents, screens, video, spatial and device context; segmentation; speaker identity; grounding.        | Evidence memory with modality-specific uncertainty.                        | Alignment against ground truth; calibrated uncertainty. |
| **Memory**        | Exact, episodic, semantic, temporal, relational, causal, procedural, autobiographical recall; reconstruction; forgetting. | The whole memory fabric and its indexes.                                    | Retrieval metrics; temporal and provenance accuracy.    |
| **Contextual**    | Why this matters _now_: current observation × goals × threads × people × world state × open questions.                  | Operational memory, threads, world model.                                   | Relevance of working state to outcomes.                 |
| **Reasoning**     | Analysis, inference, decomposition, planning, constraint, causal and counterfactual reasoning, synthesis.               | Beliefs with evidence; workspace for intermediate objects.                  | External verification of conclusions.                   |
| **Learning**      | Error detection, correction, pattern extraction, skill acquisition, strategy learning, adaptation.                      | Trajectories, outcomes, skills, policies.                                   | Compounding and transfer tests (§34).                   |
| **Metacognitive** | Knowing what is known, unknown, stale, ambiguous, unverified; deciding when to verify, ask, or decline.                 | Epistemic status everywhere; competence claims (§14).                       | Calibration: stated confidence vs. realized accuracy.   |
| **Strategic**     | Long-horizon goals, dependencies, resources, tradeoffs, risks, sequencing, opportunity.                                 | Goal and commitment graph; world model; expectations.                       | Goal progress; expectation calibration.                 |
| **Creative**      | Alternatives, distant associations, hypotheses, simulation, transformation, artifact creation.                          | Broad associative access; hypothesis objects.                               | Hypotheses survive verification; artifacts are used.    |
| **Social**        | People, relationships, roles, interaction history, communication preferences, shared commitments.                      | Person and relationship models, strictly separating observed from inferred. | Correct attribution; low false-link rate.               |
| **Agency**        | Deciding what cognitive work should happen, when, by whom; whether to continue, delegate, ask, act, or stay silent.    | Operational memory, budgets, competence claims, policy.                     | Task outcomes; intervention precision; cost.            |
| **Anticipatory**  | Detecting future relevance, risks, reminders, and opportunities — without turning prediction into interruption.         | Commitments, schedules, world-model expectations.                           | Usefulness of prepared context; silence precision.      |

## 14. Capabilities: composed, measured, and known to the system

A **capability** is something the system can do, together with how well it does it and under what
conditions. It is never "an agent with tools". It is a composition:

```
capability  =  faculties (models, deterministic units)
            +  knowledge (memory scopes, world-model regions, sources)
            +  skills (procedures)
            +  actions (an environment's tools)
            +  evaluators and verifiers (how success is known)
            +  a process template (how the work is organized)
               — under an authority envelope, inside one or more environments
```

**Composition is how specialization happens.** Capabilities are built by composing smaller ones,
specialized by narrowing them to a domain or a person, and delegated by handing a child a subset. A
few regular operations — _compose, specialize, restrict, delegate_ — are enough to begin with.
Whether they eventually form a genuine algebra, with laws the system can reason over, is a question
for evidence (§38).

**The self-model is made of competence claims.** What the system knows about its own ability is a set of **competence
claims**. They are calibrated beliefs about how well it performs a class of work under given conditions: per task
class, environment, model, and demand. They are fitted from resolved outcomes — what was expected and what actually
happened — and not from the system's own assessment of itself.
- Agents' self-assessments are badly overconfident. Predictions made before execution are more accurate than
  judgments made afterwards (`R2`).
- A competence claim carries its evidence, confidence, and validity in time like any other claim. It is revised
  when evidence changes, and re-validated when the model beneath it changes.
- **The mathematics is shared with the learner model.** Ability over latent demand dimensions, estimated from
  observed success and failure, is the same object whether the subject is a learner mastering algebra or the system
  learning to migrate schemas (`03`, `07`). Education and self-knowledge are one machine.

**The evaluation fabric feeds it.** Every verified outcome in real use is an evaluation datum recorded against the
capability that produced it. Offline suites and adversarial probes add controlled measurements. Together they yield,
for each capability:
- its quality;
- the conditions under which that quality holds;
- its failure modes;
- how far it generalizes;
- whether it is regressing.

**A capability graph is an index, not the self-model.** A graph of what depends on what — capabilities, skills,
tools, evaluators, environments, models — can answer impact questions: _what breaks if this tool changes? what must
this child be given?_ It is useful as a dependency index over competence claims. Whether it earns a place as a
first-class structure is an **open hypothesis**: no studied system has one, and nothing yet shows it predicts
anything that the claims themselves do not.

**Verification and evaluation are different acts.** Verification asks whether _this_ output, claim,
or action is right, and gates it (§19). Evaluation asks how good a capability _is_, and accumulates
verified instances into knowledge. Verification without evaluation cannot learn; evaluation without
verification measures noise.

**Graduated autonomy.** Competence claims are the basis of **graduated autonomy**: the system earns the right to act
without asking _per capability_, by evaluation evidence, never by global permission. Autonomy grows exactly as fast
as calibrated reliability, and contracts when reliability falls or when a model swap resets what is known.

---

# Part V — How Cognition Runs

## 15. The end-to-end loop

Every act of cognition — a two-second answer or a two-week project — is an instance of one loop, and
the loop is the epistemic chain (A3) set in motion:

1. **Perceive** the interaction and the environment.
2. **Register** evidence durably, with provenance and consent.
3. **Interpret** — intent, situation, and the people, projects, goals, and commitments involved.
4. **Route** — to environments, capabilities, memory routes, skills, and models.
5. **Retrieve and reconstruct** the evidence and memory the situation needs.
6. **Compile** the working state, and render it into a bounded context with a manifest of what was
   included, excluded, and why.
7. **Decide and plan** — a decision record that cites the claims it relies on, names the
   alternatives it rejected, and **declares what it expects to happen**; a plan that declares the
   state transitions it intends.
8. **Simulate** where the consequences warrant it (§18).
9. **Act** — through governed tools, with every effect recorded before it runs and settled once.
10. **Observe** the outcome — as new evidence, not as the actor's report.
11. **Verify** independently of generation, and **resolve** the expectations the decision declared.
12. **Commit** the verified state change — or compensate, abort, or escalate.
13. **Reflect and consolidate** — what happened, what mattered, what changed.
14. **Propose** updates to memory, beliefs, skills, and policies as typed, governed changes.
15. **Evaluate** — record the verified outcome against the capability that produced it.
16. **Schedule** future work and background cognition.
17. **Begin the next interaction from an improved state.**

At any point the process may **ask the person** — whenever ambiguity or authority requires it — and
continue afterward. Steps 13–17 are what session-oriented agents omit, and they are the whole point.

**The bridge from execution to cognition.** Steps 7 and 11 are the architecture's central bet — a
**strong hypothesis**, stated here because everything above the execution floor depends on it (`01`, `03`):

- **Four records.** A _claim_ is one epistemic object whose kinds are assertion, expectation, resolution, diagnosis,
  and competence. A _decision record_ says why. An _attention manifest_ says what the model saw and why. An
  _adaptation record_ is a change that carries its predicted effect.
- **Two invariants.** Every consequential decision declares expectations. Every expectation eventually resolves or
  expires, and is never silently dropped.
- **One consequence.** Working state becomes a projection of these records. A different reasoner can then resume
  not only the steps but the reasons.

Resolved expectations are the atom of **calibration**. They are how the world model, the person model, and the
self-model learn how far to trust themselves. They are necessary for learning, but not sufficient (§29).

**Two kinds of consequence, two standards.** The step is the unit of execution.
- **External effects** — a message sent, a payment made, a change merged — follow the settled discipline of A8,
  which is not in doubt.
- **Consequential cognitive changes** — a learner's mastery, a promoted skill, a belief the person relies on —
  follow _intent → planned transition → governance → execution → observation → verification → commit_. They stay
  staged until verification resolves (companion §32).

This second discipline, the **cognitive transaction**, is a strong hypothesis. It is well motivated, and no studied
system has it. It graduates when a staged change is shown to prevent errors that post-hoc correction does not.

## 16. Long-running work is first-class

The system must be able to **start** work, **continue** without the person present, **wait** for
dependencies, **resume** later, **recover** after failure, **expose** its progress, and **produce a
verified outcome**. It must survive the UI closing, the context being compacted, the model changing,
partial completion, external dependencies, and days of waiting for a human.

- **Work is a journal of settled steps.** Every tool call reaches a terminal state and is recorded;
  resumption never repeats a side effect and never loses a completed one.
- **Done is defined by verification, not exhaustion.** Reaching a token, step, or wall-clock limit is
  not success. Success is a verified outcome against the objective.
- **Progress is measured.** A process that stops making progress — repeating actions, oscillating,
  re-reading the same state — is detected, and the harness changes strategy, escalates, or asks.
- **Recovery is reconstruction, not restoration.** A recovered process is rebuilt from durable state
  and reconciled with a world that may have moved — it knows what it was doing, what is uncertain,
  and what it did not finish (companion §31).
- **Resuming cognition is more than resuming execution.** A resumed process must recover:
  - its commitments, and the reasons behind its last decisions;
  - the alternatives it had ruled out;
  - the expectations it is still waiting on;
  - its open questions.

  Before acting, it re-validates any claim that time may have made stale. The measure is the cognitive-resume test
  (§34), not merely the restart test.
- **Handoff is native.** Any process can be picked up by another process, another model, or a human,
  with its working state and journal as the only context needed.
- **Compaction is not termination.** Clearing the context window is context management; the process
  continues from its working state as if nothing happened.

## 17. The society of processes

Complex work decomposes into **child processes**. Each child is created with an explicit contract:
**purpose · authority · context scope · memory scope · tools · budget · deadline · expected output
schema · verification requirements.** Children return **structured, provenance-bearing results** —
not raw trajectories that flood the parent's context.

- **The child's attenuated authority is recorded in the child**, not merely enforced at spawn time. The child cannot
  later be resumed with more than it was given.
- **Children are durable.** A parent waiting on children is quiescent, not running. Their results fold back in as
  they settle, and a parent that crashes resumes to find them.
- **Supervision is structural.** Every child has a supervisor that acts on record-derived signals — no progress,
  loops, repeated failure, budget exhaustion. It does not trust the child's report of how it is doing.
- **Multi-agent decomposition is a spending decision, not an architecture.** Parallel children buy breadth at a
  multiple of the cost, and they lose shared context. Whether they pay is a per-task-class question answered by
  measured outcomes.

Processes communicate with **typed messages**: requests, questions, critiques, claims, evidence,
artifacts, handoffs, interruptions, goal updates, verification results, warnings, conflicts. Shared
work lives in the workspace as cognitive objects, not in anyone's context window. **People take part
through the same channels** — asking, approving, correcting, claiming, delegating — as principals with
their own authority, never as processes to be scheduled.

**Agents and processes.** A **persistent agent** is an identity — a governed constitution, a durable
adaptive policy (companion §38), and memory — that outlives any single process; its work runs _as_
processes. UCI keeps a small, curated set of agents and an open, large, mostly ephemeral population of
**processes** formed on demand from archetypes, skills, and environment context, and retired when
their work is done. Evaluators, simulators, monitors, planners, and world-maintenance routines are
processes too. Most cognition is processes; the number of agents is never hardcoded.

**Three ways to manage cognitive load** — distinct, and each used deliberately:

1. **Branch and fold** — explore within a process in a temporary branch, then fold a concise result
   back.
2. **Delegate** — spawn a child with its own bounded context and attenuated authority.
3. **Persist** — write to the substrate so any process, now or later, can retrieve it.

Parallel exploration is cheap to start and expensive to trust; its results are **selected by
verification**, never by eloquence.

## 18. Simulation: cognition before commitment

Direct execution is not the only way to think about an action. For consequential decisions, the
system can **evaluate possible trajectories before committing to one**, using machinery the
architecture already requires:

| Mode           | How                                                                   | Example                                                                                  |
| -------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| **Predictive** | Roll the world model or the person model forward                     | "Given this learner's beliefs, which of these two explanations resolves the misconception?" |
| **Sandboxed**  | Execute on a fork of environment state that can reach nothing real   | Rehearse a migration on a branch; dry-run a message against policy                       |
| **Historical** | Re-think recorded history with a different model, policy, or skill (§20) | "Would the new retrieval policy have avoided last month's failures?"                  |

Four rules keep simulation honest:

- **A simulation can never cause an external effect.** The sandbox boundary is structural.
- **Simulated outcomes are expectations, never evidence.** They enter the chain as claims with a
  resolution condition; the real outcome resolves them, which is how the world model's calibration
  is measured. Nothing simulated may ever be promoted to a belief, a skill, or a competence claim.
- **Fidelity is measured, not assumed.** Every simulator has a record of how well its predictions
  matched reality, and that record bounds how much its output may weigh. Model-driven simulations
  of multi-step interaction degrade quickly. A simulator whose fidelity is unknown is a
  brainstorming tool, not a rehearsal.
- **Simulation is spent where consequence justifies it**, by the same expected-value reasoning as all
  other cognition (§21).

This is why environments declare how their state can be forked or predicted (§10), and why a plan
declares its intended transitions before acting (§15): a plan that says what it will change can be
rehearsed, compared, and later verified. Daydreaming (§21) is simulation without a pending decision.

## 19. Verification

Verification is a first-class fabric, separate from generation. The generator never grades itself
where stakes are meaningful: verification uses a different model, a deterministic check, an
environment's evaluator, or a human.

| Domain     | Verification looks like                                                                                  |
| ---------- | -------------------------------------------------------------------------------------------------------- |
| Software   | tests, type checks, runtime checks, benchmarks, review, reproduction of the bug before the fix           |
| Research   | source checking, citation grounding, reproduction, contradiction search, evidence reconciliation         |
| Education  | transfer tasks, delayed retrieval, application, prediction of the learner's errors, misconception probes |
| Data       | invariants, independent recomputation, reconciliation against sources                                    |
| Real world | outcome confirmation from the world, not from the system's own report                                   |

Every verification is recorded as a **resolution** in the claims ledger: the claim, the evidence, the
method, the result, the time, the verifier, the provenance.

**Verifiers are claims too.** Each verifier has a record of its own measured error — how often it passes what is
wrong and fails what is right — and its verdicts carry that uncertainty.
- Verifiers the actor can see can be gamed. Agents have been observed faking the evidence their checker reads, and
  exploiting a visible scorer far more often than a hidden one (`R2`).
- So a verifier that judges a change is kept outside the authority envelope of the process that made it, and where
  possible outside its view.

Verification is the **gate** that everything durable
passes through: a cognitive transaction commits _(strong hypothesis, §15)_, a belief is promoted to _verified_, a skill to _trusted_, an
adaptation to _effective_ and _verified_ — only through it. Verification gates instances; evaluation (§14)
accumulates them into knowledge of what the system can do. Its cost is budgeted by consequence:
cheap checks everywhere, expensive checks where being wrong is expensive.

## 20. Traceability and replay

The architecture must make it possible to reconstruct, for any moment: what happened · which process
acted · under which authority · which model was used · which tools were called · what evidence was
available · what memory was retrieved and **why** · what the working state held and what the model
actually saw · what was decided, on which beliefs · what state changed · what was verified · what
failed · what was learned · what later changed because of it.

**Observability is not logging; it is the ability to understand and replay cognition.** Three replay
modes, each with a purpose:

| Mode         | What it does                                                        | Used for                                          |
| ------------ | ------------------------------------------------------------------- | ------------------------------------------------- |
| **Re-fold**  | Rebuild any projection from records.                                | Recovery, migration, new projections, audits.     |
| **Re-play**  | Re-run orchestration deterministically with recorded model outputs. | Debugging, regression tests, proofs of behaviour. |
| **Re-think** | Re-run the same inputs with a different model, policy, or skill.    | Counterfactual evaluation; safe evolution (§29).  |

**The divergence law.** A re-think is evidence only up to the first action where the new policy would have acted
differently from the recorded one. After that point the recorded world no longer answers the question: what
followed was caused by an action the new policy did not take.
- Beyond the divergence point, re-thinking becomes simulation (§18), and its results are expectations, not evidence.
- Estimating a new policy's value from old history requires knowing how likely the old policy was to choose what it
  chose. This is why manifests and decision records keep alternatives and their probabilities.

**Replay is how the system investigates itself.** When an outcome is bad, the system walks the
epistemic chain backward — outcome, action, decision, beliefs, claims, evidence — to find the link
that failed: a misheard observation, a wrong interpretation, an unreliable source, an overconfident
belief, stale world state, a poorly reasoned decision, a badly executed action. Each kind of failure
points to a different thing to learn. Failures that keep pointing to the same gap are evidence of a
structural limit (§30).

## 21. Attention, scheduling, and background cognition

**Attention is the scarcest resource; it is scheduled, not merely triggered by prompts.** Cognition
can be triggered by new evidence, memory conflicts, stalled goals, verification failures, child
failures, external changes, completed dependencies, approaching deadlines, scheduled times, and the
person's return.

Work is allocated by **expected value of computation**: what is this cognition likely to be worth,
against what it costs in money, latency, and interruption? Cheap, fast models do normalization,
routing, extraction, and candidate generation; large models are reserved for deep reasoning,
synthesis, ambiguity, strategy, and high-value reflection. Model choice is a routing decision.

**Cognitive economics has a structural floor and an adaptive ceiling.**
- **The floor belongs to the kernel:** every unit of cognition is metered, every process spends against a hard
  budget, and every expenditure is linked to the outcome it bought.
- **The ceiling belongs to the harness:** the allocators that decide how much to think, whether to verify, which
  model to route to, and when to delegate. They are policies, scaffolding by §26, learned and ablated rather than
  fixed.

Without the floor, the system cannot know what anything cost. Without outcome linkage, it cannot know what anything
was worth. With both, _is this kind of thinking paying for itself?_ becomes a question the system can answer with
evidence.

**Background cognition** uses idle time so that interactive time is fast: consolidation, reflection,
unresolved-question analysis, research preparation, skill extraction, world-model maintenance, goal
review, contradiction detection, preparation of likely future context, and self-evaluation. It
includes a governed **daydreaming** mode — open question → distant associations → simulation (§18) →
hypothesis → verification → keep as hypothesis, skill, or abstraction, or discard.

Two disciplines bound background cognition:
- **Persistence isolation.** A background process writes only _proposals_, never directly into the state that
  foreground cognition relies on. In one studied system, a background curator silently rewrote the memory a live
  session was using. Isolation is the structural answer.
- **It is priced as an investment** _(strong hypothesis)_**.** Precomputing context in idle time can cut interactive cost substantially, but
  only when the precomputed work is actually reused. So background work runs where expected reuse × saving exceeds
  its cost, and its realized reuse is recorded, so the policy that schedules it can learn.

**The intervention governor** stands between noticing and interrupting. For every candidate
intervention it weighs confidence, relevance, urgency, permission, privacy, and the cost of
interruption, and chooses: **intervene · defer · prepare silently · stay silent.** Preparing context
is cheap and safe; interrupting a person requires a much higher bar. Silence is a valid outcome, and
usually the right one.

---

# Part VI — Specialization

## 22. General and deep at once

Specialization is **capability composition (§14) inside an environment (§10)**: the general substrate
and harness, plus a domain's environment, skills, knowledge sources, and evaluators, plus persistent
memory of this person and this work, plus verification. Generality and depth stop competing when
depth is **added as environments and composed capabilities** rather than **built as separate
products**.

Because all environments share one substrate, learning **transfers**: a skill learned in one
environment is available in another, gated by its applicability conditions and re-earned there by
evaluation. The teaching skill "worked example, then fade the scaffolding" is also how good
documentation is written; the research skill "find the strongest counter-evidence first" is also how
good debugging works. Transfer across environments is one of the strongest signals that the system is
becoming genuinely general.

## 23. Education — the first proving ground

Education is first not by accident. **Teaching is modeling another mind over time, with measurable
outcomes** — and that demands nearly every capability at once:

- a theory of the learner: beliefs about their beliefs, knowledge, misconceptions, and goals;
- longitudinal memory of what was taught, how, and how the learner responded;
- prerequisite reasoning and curriculum planning;
- representation selection and explanation adapted to cognitive state;
- **prediction** — a teacher who understands a learner can predict their next error;
- assessment, feedback, and intervention timing;
- verification through transfer and delayed retrieval, not recognition;
- careful governance around a real person, often a young one.

And education gives the rarest thing in AI: **ground truth about whether cognition helped.** Did the
learner actually learn? Can they transfer it? Do they still know it in a month? **Verified learning
gain is the training signal for the whole system's evolution.**

Every education concept is an instance of a universal primitive — which is exactly why education
builds UCI rather than a vertical app:

| Education concept   | Universal primitive                                                         |
| ------------------- | --------------------------------------------------------------------------- |
| Learner model       | A personal model instance                                                   |
| Mastery             | A competence claim about the learner, fitted from resolved outcomes — the same machinery as the system's self-model |
| Misconception       | A belief about someone's belief, with evidence and a testable prediction   |
| Curriculum          | A plan with dependencies                                                    |
| Lesson              | An episode                                                                  |
| Learning trajectory | A thread                                                                    |
| Teaching strategy   | A skill, with applicability conditions and an evaluation record            |
| A learner's books   | Knowledge sources with provenance and exact spans                           |
| Assessment          | A verifier                                                                  |
| Updating mastery    | A cognitive transaction, committed only after verification _(strong hypothesis)_ |
| Predicting an error | An expectation, resolved by the learner's next answer                       |
| The teaching board  | A projection of the teaching process                                        |

**The education horizon:** take any learner, from any starting point, to _verified_ mastery of
anything — recursively resolving prerequisites, adapting representation to their cognitive state,
grounding every explanation in the sources they bring, verifying depth, and continuing across months
without losing the thread.

**The discipline:** education concepts never leak into the kernel or substrate. When education needs
a primitive that is general — belief, plan, skill, verifier, thread — it is built general and
_instantiated_ for education.

## 24. The path of domains

Each new domain should cost less than the last, because it reuses more. **The marginal cost of a new
environment is the truest measure of generality.**

1. **Education** — the first deep environment; the proving ground for memory, personal models,
   verification, and learning loops.
2. **Research** — source acquisition and canonicalization, claim graphs, evidence and contradiction,
   synthesis, hypothesis generation, reproduction, frontier monitoring. Research serves learners,
   serves people's decisions, and serves UCI itself — including its architectural observatory (§28).
3. **Software engineering** — repository cognition, long-running coding processes, tests as
   verifiers, persistent project memory — where the system builds itself (§25).
4. **Analysis, writing, design, planning, operations** — each an environment over the same substrate.
5. **Constructed environments** — environments the system proposes for domains it has not yet been
   given.

**Environment construction** is how UCI eventually builds depth by itself. From a domain's sources,
tools, workflows, expert feedback, and its own experience, the system proposes an environment:
ontology, action space, observation shaping, evaluators, seed skills, policies, task distribution.
The hard part is not generating these; it is **validating the evaluators** — an environment whose
measures of success are wrong trains every capability built on it to be wrong. So construction is a
governed process with human review of ontology and evaluators, staged by evidence: first environments
built by hand, then environments assembled mostly from existing parts, then environments proposed by
the system and proven before they are trusted.

## 25. Software engineering, where UCI builds UCI

Today's best coding agents are excellent session-scoped harnesses. UCI's software environment is not
meant to be a better one of those; it is meant to be the software environment of a system that
remembers — one that has shed the assumptions of §3. It keeps project cognition across months:
decisions, rationale, failed approaches, people, and goals. It accumulates verified skills with
lineage. It knows its own failure modes per task class and verifies or asks where it is weak. It runs
durable processes for days, waiting on CI and on people, and resumes without loss. It lets
engineering be informed by the product's domain and the person's goals. It improves its own policies
and skills only through evaluation. It routes among models. It can reconstruct every change back to
the evidence and context that caused it.

The decisive consequence: **UCI will be the harness in which UCI is built.** When the system's own
engineering runs on it — with its memory of the codebase, its verified skills, its long-running
processes — dogfooding becomes the strongest evidence we have.

---

# Part VII — Evolution

## 26. The absorption principle

This is the principle that lets the architecture **upgrade itself as research advances**, instead of
fossilizing around today's models.

Every component is one of two kinds:

| **Structure** — value _rises_ as models improve                           | **Scaffolding** — value _falls_ as models improve          |
| ------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Durable identity and state; the causal record; provenance                 | Fixed prompt chains and hand-written reasoning recipes     |
| Authority and governance                                                  | Hand-coded task decompositions                             |
| Verification, evaluators, the evaluation fabric                           | Rigid routing rules and brittle classifiers                |
| Contracts, adapters, conformance tests                                    | Output-format coercion hacks                               |
| Memory substrate, retrieval quality, temporal and epistemic integrity     | Over-specified step-by-step workflows                      |
| Environments' action spaces, observation shaping, simulation, evaluators  | Heuristics that compensate for a specific model's weakness |

The rules:

1. **Scaffolding lives in the adaptive layer** — templates, policies, skills, configuration — never in
   the structural code paths.
2. **Every scaffold has an ablation test** proving what it is worth today.
3. **Every new model runs the evaluation suite with scaffolds on and off.**
4. **Scaffolds that no longer earn their keep are retired.**

Structure compounds, so it is where engineering effort goes. Scaffolding depreciates, so it gets as
little as possible. The harness grows simpler as models improve, the substrate grows richer as time
passes, and the system improves on both curves at once.

## 27. Pluggability is permanent

**Everything is pluggable, and everything is traceable.**

- **There is no privileged core beyond the kernel.** Even the step loop, the compilers, and the model
  runtime are ordinary registered providers that can be replaced. Every seam has three roles — a
  _definition_ (the contract), one or more _providers_, and _consumers_ — and every registration is a
  reversible effect that unwinds cleanly when its provider is removed.
- **A typed registry of seams** holds every provider — model runtime, stores, retrievers, tools,
  verifiers, evaluators, schedulers, policy engines, surfaces. Nothing reaches a provider except
  through it.
- **Composition is transactional.** A harness is composed from registered providers; if a protected
  seam (governance, the causal record, the effect ledger) is missing, composition fails — it never runs half-built.
- **Every composition is describable.** A composition manifest answers, for any process: _what
  environment, which providers, which versions was this given?_ Compositions are part of the
  architecture held as data (§6).
- **Hooks intercept without hiding.** Interceptors may observe or transform model requests, tool
  calls, memory mutations, and compilation — and every transform is recorded in the manifest, so the record still
  reconstructs what the model saw.
- **Configurations compose.** Profiles, bundles, and patches build a harness for a task from reusable
  parts, rather than forking code.
- **Contracts are versioned** with an explicit compatibility policy and migration path.

## 28. The architectural observatory

UCI studies the strongest harnesses, memory systems, runtimes, reasoning methods, evaluation
approaches, models, and protocols in the world — **continuously, not once.** The observatory is a
standing process: new work is studied for mechanisms; each promising mechanism becomes an
**architectural hypothesis**; the hypothesis is tested against UCI's own history and evaluation
suites (re-think, ablation, shadow); and it is adopted only through governed evolution (§29–§30).
People run the observatory first; over time the research environment runs it with them.

We **extract primitives, not implementations; mechanisms, not ontologies.** Most studied systems are
built around a coding session and a chat transcript — exactly the ontology UCI must not couple to.

**The observatory's first product.** A source-level archaeology of seven reference harnesses (DeepSeek Harness,
Eve, Hermes, OpenHands, OpenCode, Prime, SWE-agent) was read against the question _what actually persists, and what
does it make possible?_ It has been joined with research across:
- memory and continual learning;
- verification and world and self models;
- ingestion and context;
- runtimes and cognitive economics.

The findings live in this folder, with an atlas of candidate primitives (`10`), a gap map (`11`), and an evidence
map (`13`). The local checkouts and the archaeology live in `Reference-Architecture-Observatory/`.

What the evidence established:

- **Convergence on persistent execution.** Independently, and without shared ontology, the systems arrived at the
  same execution floor (§9). That convergence is the strongest evidence available that the floor is right. UCI
  adopts it.
- **The same blind spot everywhere.** None has an object above the session, epistemic status on what it stores,
  verification of outcomes rather than of reports, or learning measured against a baseline. None records why its
  model saw what it saw, what it expected to happen, what its working state was apart from a transcript, or how
  competent it is. Memory, when present, is a file or a search index beside the session. Learning, when present, is
  self-assessed. The person, when modeled, is a short profile.
- **Failures that are structural lessons.** Each of these reshaped an axiom:
  - an optional causal record;
  - compaction that overwrote evidence;
  - children that inherited full authority;
  - governance decisions that vanished;
  - records only their writer's plugins could read;
  - a background process that rewrote live memory.

**Blind spots in the research itself.** The same pass found strong evidence that several popular ideas do not
deliver what they promise:
- reflection alone as learning;
- model-judged improvement;
- long context as memory;
- knowledge graphs as cognition at matched cost;
- simulation as evidence.

The observatory keeps a record of what it rejected, and why, with the same care as what it adopted
(`00` §5).

## 29. Governed self-evolution

The system gets better through a single governed ratchet, applied at every level:

```
observe → evaluate → diagnose → propose → test → verify → shadow → promote → monitor → (rollback)
```

**Levels of learning**, each with a higher gate than the last:

| Level | What changes                                                                       | Gate                                                            |
| ----- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| L0    | In-context reasoning within a step                                                 | The step's own verification                                     |
| L1    | Memory — new evidence, episodes, beliefs                                           | Epistemic status; provenance; contradiction handling            |
| L2    | Policy and skill — how to act                                                      | Evaluation against held-out cases; attribution; shadow          |
| L3    | Architecture — projections, new kinds of process template, environments, contract versions (§30) | Replay against history (re-think); human review; staged rollout |
| L4    | Models — training or fine-tuning from the substrate's own trajectories             | Full evaluation suite; safety review; reversible deployment     |

**What may evolve:** memory policies, retrieval weights, routing, decomposition strategies, tool and
model selection, state and context compilation, scheduling, skills, domain strategies, the parameters
of existing process templates — and, at L3, new templates, environments, and architecture.

**What may never evolve by itself:** the constitution — the system's, and each agent's; authority
boundaries; privacy and consent rules; safety policy; human-sovereignty guarantees; and **the
evaluation suites that judge evolution.** The system must not be able to improve its grade by
changing the rubric.

**Reflection, adaptation, learning, and verified improvement are four different things.**
- _Reflection_ produces a proposal.
- _Adaptation_ changes durable state.
- _Learning_ is an adaptation shown to cause better outcomes.
- _Verified improvement_ is learning that has survived held-out, delayed, and adversarial checks.

Most of what current systems call "self-improvement" stops at the first two. The evidence is sobering: a large share
of apparently positive A/B results fail to replicate, placebo signals produce apparent gains, and self-authored
skills average no benefit without an external checker (`R2`). So every artefact of learning climbs a status ladder:
**proposed → active → effective → verified**. It climbs only by controlled comparison:
- a baseline arm, and a placebo arm where one is possible;
- cost-matched, so that "better" is never just "spent more";
- measured on held-out work, and re-checked after delay for retention;
- judged by a verifier the proposer cannot see or edit.

What no longer earns its keep is retired. What was verified under one model is re-validated when the model changes.

Three disciplines make evolution trustworthy:

- **Attribution** — an improvement is accepted on counterfactual evidence (controlled trial, ablation, shadow,
  re-think within the divergence law), not on correlation.
- **Scope** — changes are scoped (per person, per environment, global) and promoted outward only as
  evidence accumulates.
- **Lineage** — every change records what it was derived from, so a bad change can be quarantined and
  rolled back together with everything that descended from it.

## 30. Architectural evolution

The deepest form of self-improvement is not a better prompt or a better policy. It is recognizing that
**a recurring failure is structural** — and changing the structure.

**Architecture is data.** Because the composition of the system — contracts, seams, providers,
projections, environments, process templates — is held as versioned, inspectable objects (§6), the
system can reason about its own architecture as it reasons about anything else.

**Diagnosis comes first.** Replay (§20) localizes failures along the epistemic chain; competence
claims (§14) say which capabilities they belong to. When failures cluster and resist every fix at
lower levels — something the system has no way to represent, a retrieval route that never surfaces a
class of evidence, an environment action that does not exist, an evaluator blind to a kind of
failure — that is evidence of a structural limit. Naming the limit is itself a claim, held to the
same standard as any other.

**Experiment, then adopt.** A structural hypothesis becomes a proposal — a new facet and its
projector, a new environment action, a new process template, a new contract version — tested by
re-thinking real history, shadowing live traffic, and measuring against the evaluation suites.
Changes to code land as reviewable proposals in the engineering pipeline; changes to the kernel and
the constitution are always human decisions.

**Structural change without rewrites:**

- **Contracts evolve by version**, with migrations, compatibility windows, and read-time upcasting of
  old records (A20).
- **Projections are re-derivable.** A new memory projection, index, or world-model view is built by
  re-folding the causal record — the world does not need to be re-lived.
- **Retroactive re-interpretation.** Because evidence is preserved and interpretations are versioned
  derivations, a better model can **re-derive better memory from old evidence.** The system's
  understanding of its past improves over time.
- **New environments arrive as packs**, not as forks of the core.
- **The kernel changes rarely and deliberately** — it is the one place where slowness is a virtue.
- **Research graduates by evidence** — demonstrated capability, engineering viability, product
  relevance — never by quietly becoming architecture.
- **History is labelled, never disguised.** Superseded designs are preserved and marked as
  superseded; they never masquerade as current architecture.

---

# Part VIII — Trust

## 31. Human sovereignty

A system that remembers a life holds extraordinary power. It must be structurally on the person's
side:

- **Ownership.** A person's cognitive state is theirs. The system is its steward.
- **Inspection.** For any belief, memory, recommendation, or intervention: _why do you think that,
  from what evidence, since when?_ — always answerable.
- **Correction.** "That is wrong" is a first-class operation, and one of the most valuable learning
  signals the system receives.
- **Forgetting.** Deletion is complete and provable — it cascades through every projection, index,
  derived memory, and future context.
- **Portability.** A person can export their cognitive state in open formats and take it elsewhere.
- **Consent.** Capture, inference, and retention follow the person's explicit choices, and those
  choices propagate to everything derived.
- **No hidden manipulation.** Personalization serves the person's _reflective_ interests — what they
  would endorse on reflection — never engagement for its own sake. The system can always explain why
  it showed, suggested, or reminded something.
- **Assistance is not decision.** The system recommends, prepares, challenges, and reminds; it decides
  only where authority has been explicitly delegated, and that delegation is inspectable and
  revocable.

## 32. Authority and safety

- **Authority boundaries are structural**, not advisory. Every process and tool has identity,
  authority, data scope, side-effect class, budget, approval requirements, and auditability.
- **Children never silently gain privileges.** Authority only narrows as it flows downward.
- **Fail closed.** When policy cannot be evaluated, the answer is no.
- **Side effects are classified** — read, reversible write, irreversible write, external
  communication, financial — and approval requirements scale with the class.
- **Untrusted content is data, never instructions.** Web pages, documents, tool outputs, and messages
  from other agents cannot command the system, however they are phrased.
  - This is enforced by information flow, not by asking a model to be careful. Trust labels travel with content
    into everything derived from it — including memory, where poisoned entries otherwise persist across sessions.
  - What a process may do is decided by the authority it holds and the labels on the data driving the decision,
    not by what that data says.
- **Revocation cascades.** Withdrawing consent or authority withdraws it from everything that was
  granted or derived from it.
- **Self-improvement cannot touch the constitution**, authority, privacy, or safety boundaries (§29).
- **Budgets are hard limits**, not suggestions: money, tokens, time, and interruptions.

## 33. Privacy, consent, and information flow

Privacy is an architectural property, enforced by the substrate — not a filter bolted on at the end.

- **Labels at capture.** Consent, sensitivity, ownership, and audience labels are attached when
  evidence enters.
- **Labels flow.** Every derived object carries the combination of its inputs' labels. A summary of
  private evidence is private; a belief inferred from sensitive memory is sensitive.
- **Enforcement at compilation.** Nothing enters a process's working state or context that the
  process is not cleared to see.
- **Third parties are protected.** Information about other people is handled with its own, stricter
  policy.
- **Sensitive memory escalates.** Highly sensitive experiences require stronger justification to
  retrieve and conservative inference.
- **Every read and write of personal state is auditable.** Encryption in transit and at rest is the
  floor, not the ceiling.

---

# Part IX — Proof

## 34. The reality tests

These tests are the **operational meaning of the axioms**. A capability claim is valid only when it
passes the tests that apply to it. They are how we stop mistaking a specification, a demo, or fluent
output for a working system.

| Test              | The capability is real only if…                                                                                                     |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **Restart**       | Every process can be killed mid-task; on restart nothing of cognitive value is lost and no side effect is repeated.                |
| **Cognitive resume** | After restart or handoff, a fresh reasoner given only durable state recovers the commitments, the reasons for recent decisions, the rejected alternatives, the open expectations, and the open questions — scored against the original, not merely "continues". |
| **Compaction**    | The context can be cleared mid-task and the process continues correctly from its working state — and after repeated compactions, every standing constraint and commitment is still in force. |
| **Model swap**    | The model can be replaced mid-task and work continues from the same working state; competence claims earned under the old model are re-validated, not inherited. |
| **Surface swap**  | Work begun on one surface or device continues on another with no restatement.                                                       |
| **Replay**        | For any model call, exactly what it saw can be reconstructed, together with why each item was included and what was excluded; any projection can be rebuilt from records. |
| **Context causality** | Removing or changing an item the manifest says was decisive changes the decision, and removing an item it says was irrelevant does not — the manifest's reasons predict the model's behaviour. |
| **Forget**        | A forgotten item disappears from every projection, index, derivation, and future context — provably.                               |
| **Containment**   | A child cannot exceed its parent's authority or read outside its lease, even when instructed to by content it reads.               |
| **Contradiction** | A changed fact is superseded with validity intervals, never overwritten; "what did we believe then?" is answerable.                 |
| **Settle**        | Every external effect settles exactly once across crashes and retries; an effect whose outcome is unknown is reconciled before any retry, never repeated or guessed. |
| **Commit** _(strong hypothesis)_ | No consequential cognitive change is adopted before its verification; a cognitive transaction that fails verification leaves no committed trace. |
| **Memory value**  | What memory formation stores changes later behaviour for the better: removing a formed memory measurably harms a task that needed it, and irrelevant memories do not accumulate. |
| **Compounding**   | Performance on a task class after N experiences beats cold start _with the same model and a cost-matched baseline_, and the gain is attributable by ablation. |
| **Learning**      | A promoted adaptation's predicted effect is confirmed by controlled comparison on held-out work, survives a retention check after delay, and beats a placebo arm. |
| **Transfer**      | Something learned in one context measurably improves a novel context.                                                               |
| **Capability formation** | A capability the system could not perform reliably becomes reliable through its own experience, and its competence claim tracked that change before and after. |
| **Calibration**   | World-, person-, and self-model expectations match realized frequencies: of the things the system is 80% sure of, about 80% turn out true, per domain and over time. |
| **Replay validity** | Counterfactual estimates from recorded history agree with fresh trials up to the divergence point, and are never reported beyond it as evidence. |
| **Silence**       | The intervention governor declines most candidate interruptions, and the precision of those it allows is measured and high.       |
| **Long horizon**  | A multi-day objective with disconnections, human delays, and a mid-course contradiction completes with a verified outcome.          |
| **Longitudinal coherence** | Over months, the system's beliefs about a person or project stay consistent with evidence, superseded beliefs stay superseded, and nothing it once knew is silently lost. |
| **Cognitive economy** | For each class of work, the cost of the cognition spent is known, linked to the outcome it bought, and the allocation policy improves outcome per unit cost over time. |

The tests fall into two groups:
- **Execution tests:** restart, settle, containment, long horizon. The studied systems already pass much of this
  group.
- **Cognition tests:** every other test in the table. The newest of them — cognitive resume, context causality,
  memory value, learning, capability formation, calibration, replay validity, longitudinal coherence, cognitive
  economy — are passed by no studied system.

A system passing only the first group has persistent execution. UCI's claim is persistent cognition, and it is
measured by the second group. The experiments that operationalize each test are registered in `12`.

## 35. Measuring compounding

Language-model quality is not the measure of UCI; the evaluation fabric (§14) is. Its measurements
fall into families: **memory** (exact recall, ranked recall, temporal and provenance accuracy,
contradiction and false-link rates, pollution) · **harness** (verified-outcome rate, recovery
correctness, settlement integrity, loop incidents, cost, latency per operation) · **learning**
(compounding slope against a cost-matched baseline, transfer, skill reuse, attribution, retention of
gains) · **calibration** (of world, person, and self models, and of verifiers themselves) ·
**resumption** (cognitive-resume fidelity) · **context** (manifest causality; constraint survival
under compaction) · **agency** (intervention and silence precision) · **economy** (outcome per unit
cost, by class of work) · **education** (learning gain, retention at delay, transfer, time to
verified mastery) · **generality** (the marginal cost of a new environment).

The companion document (§39) defines the memory and harness measures and the **longitudinal
benchmarks** —
years of simulated life and work, adversarial by design, requiring reconstruction rather than
similarity. **The evaluation suite is itself structure**: versioned, independent of what it
evaluates, and the ratchet every evolution must pass.

## 36. Failure modes

The architecture exists to make these structurally difficult:

- Similarity mistaken for identity, causation, or fact.
- Stages collapsing — a model's output treated as belief; an actor's report treated as outcome.
- Every sentence becoming durable memory; memory pollution drowning signal.
- Summarization destroying raw evidence; historical truth overwritten when state changes.
- Operational state recalled approximately — a process resuming from a half-remembered plan.
- One vector search pretending to be retrieval; many isolated stores competing to be true.
- The context window becoming the system of record.
- The largest model run on every event; proactive interruption becoming the default.
- Child processes escalating privilege; untrusted content steering the system.
- Persistent processes vanishing at restart; tool actions without durable settlement; consequential
  changes committed before verification.
- Long-running loops continuing without progress.
- Self-improvement without evidence, attribution, or rollback; the system editing its own rubric.
- Reflection mistaken for learning; improvement judged by the improver; gains that are only extra
  spend.
- Execution resumed while cognition is lost — the steps continue, the reasons are gone.
- Expectations never recorded, or recorded and never resolved; confidence that is never checked.
- Standing constraints silently dropped by compaction; background processes rewriting live state.
- Simulated outcomes promoted to evidence; replay trusted past its divergence point.
- A causal record that is optional, or readable only by the code that wrote it.
- Private information crossing authority boundaries.
- Domain-specific concepts leaking into the universal kernel.
- Scaffolding hardening into structure.
- Concepts that correspond to no primitive and no invariant — architecture as prose.
- Specification sophistication substituting for implementation sophistication.

---

# Part X — Building It

## 37. From nothing to everything

The vision is vast; the discipline for reaching it is narrow.

**Build the loop, not the cathedral.** The first responsibility is one loop that closes end to end —
in education, surviving restart, measurably improving with experience. Everything else widens from a
loop that already works. A capability that does not change behaviour next week is not yet a
capability.

**Vertical slices before abstractions.** Prove a path end to end, observe the pattern at least twice,
_then_ extract the primitive. Abstractions extracted from working code are right far more often than
abstractions drawn in advance.

**Specification serves implementation.** Write down what makes the next build clearer, safer, and
more coherent — and nothing more. When a specification grows more elaborate than the evidence behind
it, stop writing and build.

**Every capability ships with its reality tests** (§34). Tests are the record of what exists.

**Architecture is enforced by code, not by prose.** The laws that matter most — dependencies point
inward, no vendor type crosses an adapter, model-visible means derivable, stages never collapse, every
effect passes governance — are checked mechanically as part of verification, with baselines that may
only shrink. A law that no check enforces is a wish.

**The build ladder** — dependency order, not dates. Each rung must pass its reality tests before the
next becomes load-bearing:

1. **Kernel floor** — identity, authority, contracts, a _durable_ causal record, the effect ledger,
   metering.
2. **Durable evidence and operational memory** — nothing cognitively valuable in process memory or
   ad-hoc snapshots; intentional state (goals, commitments, open questions) exact and durable.
3. **The harness step loop** — the execution floor (§9), adopted rather than reinvented; working
   state as a projection; context rendered with manifests; recovery by reconstruction.
4. **The epistemic records** — claims with status, decision records with alternatives and
   expectations, resolutions. This is the rung that turns persistent execution into persistent
   cognition, and the cognitive-resume test is its proof.
5. **Cognitive memory core** — write-time truth maintenance; exact, lexical, vector, and temporal
   retrieval; provenance and epistemic status; remember, forget, correct.
6. **Verification and evaluation** — independent, measured verifiers; resolutions in the claims
   ledger; the first competence claims fitted from them.
7. **The education environment, deep** — learner model as competence claims, mastery through
   verification, predicted errors as expectations, teaching skills, grounding in the learner's
   sources.
8. **The learning loop, closed** — reflection → proposals → controlled trial → governed promotion →
   measured, retained compounding.
9. **Background cognition** — scheduler, persistence-isolated consolidation, priced precomputation,
   intervention governor.
10. **The society of processes** — durable children, recorded attenuation, supervision, typed
    messaging, formation on demand.
11. **Research and software environments** — and UCI begins building UCI.
12. **Simulation and architectural evolution** — branchable environments with measured fidelity,
    structural proposals.
13. **Multimodal lifelong ingestion, devices, and proactive cognition.**

## 38. From concepts to primitives

Every concept this vision depends on must correspond to a **minimal executable primitive** and a
**measurable invariant** (A19). This table is the bridge between the vision and the code, and the
standing defence against architecture becoming prose:

| Concept                 | Minimal executable primitive                                                   | Measurable invariant                                                                                     |
| ----------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| Causal record           | Durable records with causal links, epochs, and version stamps (one realization: an append-only log) | Every consequential change has a recorded cause; every projection rebuilds identically; the record cannot be disabled |
| Effect ledger           | A called-before-run, settle-once record per external effect                    | No effect repeats on retry; every unknown outcome is reconciled before any retry                         |
| Evidence memory         | Content-addressed evidence with spans and labels                               | Evidence is never mutated; every derived object reaches evidence through the provenance graph            |
| Epistemic chain         | A stage on every object; typed transition events naming their operator         | No belief without a claim and evidence; no action without a decision citing beliefs; outcomes observed   |
| Claim _(SH)_            | A versioned epistemic object (assertion, expectation, resolution, diagnosis, competence) with status, confidence, justifications, and valid and knowledge time | Never overwritten; the contradiction test passes; retracting a support re-evaluates what depended on it |
| Decision record _(SH)_  | A record citing the claims relied on, the alternatives and their probabilities, and declared expectations | Every consequential action has one; the cognitive-resume test passes                                   |
| Expectation lifecycle _(SH)_ | Expectations with a resolution condition and an expiry                          | Every expectation resolves or expires; calibration is computed from resolutions                          |
| Retrieval               | A multi-route ranked pipeline that records its reasons                         | Every included item's reasons appear in the manifest; exact recall is measured                           |
| Labels                  | Consent, sensitivity, and trust labels attached at capture, propagated on derivation | No compiled working state or context contains an item above the process's clearance                 |
| Working state           | A typed per-process projection over the authoritative cognitive set            | The model-swap, compaction, and cognitive-resume tests pass                                              |
| Attention manifest      | A record per model call: items, reasons, exclusions, transformations, staleness, propensities | The request equals the view derived from records (derivable); the context-causality test passes (explained — strong hypothesis) |
| Authority envelope      | Attenuable tokens and leases checked by the kernel                             | The containment test passes; no call succeeds outside its envelope                                       |
| Process                 | A durable descriptor, journal, fenced execution lease, and supervisor          | The restart test passes; supervision acts on record-derived signals                                      |
| Verification            | An independent verifier with a measured error profile, writing resolutions     | No durable promotion without a resolution; the actor cannot read or edit its verifier                    |
| Competence claim _(SH)_ | A claim of ability per task class and condition, fitted from resolutions       | Every capability statement has current evidence; it is calibrated; regressions and model swaps trigger re-validation |
| Metering                | Per-call resource accounting against budgets, linked to outcomes               | Every unit of cost traces to a process and an outcome; budgets are never exceeded                        |
| Environment             | A pack implementing the environment contract                                   | Conformance tests pass; evaluators are validated before their outcomes train anything                    |
| Skill                   | A versioned skill object with lineage and trials                               | Trusted only after verified trials in the contexts it claims                                             |
| Adaptation (§29)        | A versioned edit carrying a predicted effect and its status on the ladder      | Nothing reaches _effective_ without a cost-matched controlled comparison; regressions roll back          |
| Forgetting              | A cascade over the provenance graph, leaving a tombstone                       | The forget test passes                                                                                   |
| Simulation              | Branched environment state or a model rollout, with no path to real effects, and a fidelity record | No simulation ever causes an external effect; no simulated outcome is ever promoted to evidence |
| Intervention governor   | A recorded decision per candidate intervention                                 | Intervention and silence precision are measured                                                          |

Some directions are deliberately **not yet primitives**. They stay in the vision until evidence
graduates them:

| Direction                         | What would graduate it                                                                            |
| --------------------------------- | ------------------------------------------------------------------------------------------------- |
| A capability algebra              | Composition operations used often enough that laws over them predict real behaviour               |
| A first-class capability graph    | A dependency structure that predicts impact or routing better than competence claims alone        |
| Cognitive transactions            | Staged cognitive commits shown to prevent errors that post-hoc revision does not                   |
| Learned allocators                | A learned policy for how much to think or verify that beats a fixed policy at matched cost         |
| Environment construction          | A constructed environment whose evaluators are validated and whose capabilities match a hand-built one |
| Learned world-model simulation    | Predictive rollouts calibrated well enough to replace sandboxed rehearsal at lower cost           |
| An autonomous observatory         | System-proposed adoptions that survive the same gates as human-proposed ones                      |
| Structural self-diagnosis         | Diagnosed structural limits confirmed by the experiments they propose                             |
| Model–harness co-training (L4)    | Models trained on UCI trajectories that measurably outperform general models inside UCI           |

**A concept with no row in the first table is a hypothesis.** It may be written about; it may not be
depended on. A new concept earns its place by adding a row — with a primitive someone can build and an
invariant something can check. The full atlas of candidate primitives — with the evidence for each, the experiment
that would settle it, and its status — is `10-primitive-atlas.md`. A row in the table above is a concept the architecture depends on. Rows marked _(SH)_ are **strong
hypotheses**: the architecture builds on them provisionally, and they graduate or fall by the experiments registered
in `12`. The other rows are adopted commitments. Neither kind is a claim that the primitive exists in code; only
the code and its tests can say that.

## 39. The architectural test

Before accepting any significant design, ask:

> **Does this make the system more persistent, more composable, more observable, more verifiable,
> more general, more deeply specialized where needed, more capable of learning from experience, and
> more capable of evolving without losing control?**

If it only makes the current feature easier, it is probably not the right abstraction.

Then ask it across kinds and across time:

- Which of the six is it — state, process, capability, environment, architecture, or evolution — and
  which primitive and invariant make it real? _(If none, it is a hypothesis.)_
- Will this still be right when models are ten times better? _(If not, it is scaffolding — keep it
  thin.)_
- Will this still be right with a hundred environments? _(If not, it is domain logic in the wrong
  layer.)_
- Will this still be right for a person who has used the system for ten years? _(If not, it does not
  respect continuity.)_
- If it is proposed for the kernel: would it still make sense if AI agents disappeared? _(If not, it
  belongs above the kernel.)_
- Does it make _cognition_ persist, or only _execution_? _(If only execution, it is necessary but
  not what UCI adds.)_
- Can we prove it works? _(If not, it does not exist yet.)_

## 40. Enduring definition

**Universal Cognitive Infrastructure** is a persistent, multimodal, provenance-aware computational
environment for intelligence that can remember, reason, act, verify, learn, specialize, and evolve
across time — and, in the end, a substrate on which cognitive systems themselves are constructed,
run, evaluated, specialized, and evolved.

**Education** is the first deep environment. **Lifelong memory** is the continuity substrate. **The
Universal Cognitive Harness** is the execution and control system. **The Cognitive Surface** is the
human window into that state.

The long-term objective is a **Cognitive Continuity Engine**: intelligence that does not restart from
zero at every interaction, but accumulates experience and turns it into increasingly capable future
cognition — for a person, for the work, and for itself.

**The vision is permanent. Implementations are replaceable.**
