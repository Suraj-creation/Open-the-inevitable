# Lifelong Cognitive Memory and the Universal Cognitive Harness

**The continuity substrate and the execution system that lives on it**

> **What this document is.** The deep, permanent design direction for the two systems everything else
> in UCI rests on: **lifelong cognitive memory** — how experience becomes durable, revisable,
> retrievable cognitive state over years — and **the Universal Cognitive Harness** — the persistent
> execution and control system that operates over that state, for both long-running general work
> and deep domain work.
>
> **What it is not.** Evidence. Nothing here claims that a capability exists; the code and its tests
> are the only evidence of that. Mechanisms named here are directions, to be proven by the reality
> tests in [`Universal-Cognitive-Infrastructure.md`](Universal-Cognitive-Infrastructure.md) §34, and
> every concept here is held to that document's rule that a concept must map to an executable
> primitive and a measurable invariant (§38 there).
>
> **Relationship.** The UCI document is the whole-system vision and its axioms. This document goes
> one level deeper into the two subsystems that make continuity real. Where they overlap, the UCI
> document owns the _why_; this document owns the _how_.
>
> **Level.** This is architecture, not specification. It fixes invariants and the shape of the
> records that carry them; field lists, address syntaxes, clock algorithms, and scoring weights
> belong in code. Focused treatments, the evidence, and the experiments that would change this
> document live beside it in this folder (`01`–`13`, `research/`); the record of the last revision
> is `00-architecture-evolution.md`. Statements that are bets rather than commitments are marked
> _strong hypothesis_ or _open hypothesis_.

---

## Contents

- **Part I — Foundations:** 1 The thesis · 2 The ontology and the epistemic chain · 3 Three
  memories, four kinds of object · 4 The causal record · 5 Identity and provenance · 6 Cognitive
  time
- **Part II — Formation:** 7 The ingestion cascade · 8 Perception and multimodal alignment · 9
  Segmentation, events, episodes · 10 Threads — the continuity engine · 11 Experience formation · 12
  The memory compiler and the facet vocabulary · 13 Memory formation: value, triggers, and adjudication
- **Part III — Epistemics:** 14 Claims, beliefs, and the epistemic lattice · 15 Confidence is a
  vector, and it is calibrated · 16 Contradiction, revision, and truth maintenance · 17 The world, person, and self models · 18 The link
  discipline
- **Part IV — Retrieval and Attention:** 19 Retrieval is half of memory · 20 The retrieval pipeline ·
  21 Ranking with decomposed reasons · 22 Hierarchy and granularity · 23 From state to attention ·
  24 Meta-memory
- **Part V — Lifecycle, Control, and Trust:** 25 The lifecycle as typed mutations · 26 Consolidation
  and sleep-time cognition · 27 Forgetting · 28 The person's controls · 29 Privacy as information
  flow
- **Part VI — The Universal Cognitive Harness:** 30 What the harness is · 31 The process · 32 Steps
  and transactions · 33 Tools, actions, and the environment interface · 34 Delegation and the society of processes ·
  35 Scheduling, triggers, and the intervention governor · 36 Verification and the claims ledger · 37
  Skills · 38 The continual harness · 39 Observability, replay, and evaluation · 40 Final definition
- **Appendices:** A The machine in motion · B What the references taught

---

# Part I — Foundations

## 1. The thesis

> **Do not build an agent that tries to remember everything inside a context window. Build a
> persistent cognitive environment in which experience is captured, interpreted, linked, verified,
> consolidated, retrieved, revised, and acted upon over years — while the context window remains only
> a temporary attentional view.**

The central engineering problem is not "how do we store a hundred kinds of memory?" It is:

> **How do we maintain one coherent, longitudinal cognitive state from which many memory projections
> can be generated — without losing provenance, temporal continuity, identity, uncertainty, or
> retrieval precision — and operate a harness over it that can work for minutes or for months?**

Memory and harness are two halves of one machine. Memory without a harness is an archive: it
remembers but never acts, never learns what mattered, never discovers that it was wrong. A harness
without memory is an amnesiac: capable in the moment, identical on the thousandth day to the first.
The harness is how memory becomes useful; memory is how the harness becomes better.

A person should be able to live and work normally while this machine keeps an evolving
representation of their experience. They talk to someone for two hours, stop, work for three,
resume the topic on another device, refer to it three days later without explaining it, and then ask
a question that only makes sense in light of all of it. The system should reconstruct enough of the
latent continuity to understand why the new utterance matters — and it should do the same for its
own work: a coding process interrupted on Tuesday should resume on Friday knowing exactly what it
tried, what failed, and why it chose the path it is on.

**Memory is an emergent, continuously maintained representation of experience — not a set of fields
a model fills in once per conversation.**

**Memory is something the system does, not something it has.** Its verbs — capture, interpret, form,
organize, retrieve, reconstruct, revise, consolidate, forget, learn — are each performed by governed,
budgeted, evaluated processes running on the harness. The memory system is therefore not a library
beside the harness; it is one of the harness's most important workloads. The substrate holds what
is remembered; the harness does the remembering.

**The boundary, stated once.** The **substrate** owns authorities and provenance: evidence, intentional and executive
state, claims, and procedures (§3). The **harness** owns processes — including the formation, consolidation,
verification, compilation, and supervision processes that read and write those authorities — and the per-process
projections called working state (§23). A memory operator is a harness workload; the memory it produces is substrate.
There is one architecture, not a memory system and a harness that must be integrated.

**Persistent execution is not persistent cognition.** The studied agent systems have converged on a real substrate
for resuming _execution_:
- steps recomputed from durable records;
- effects settled exactly once;
- durable children;
- projections instead of mutable state.

None of them can resume _cognition_. After a restart they know what was done, but not why, not what was expected,
not what was ruled out, and not how reliable they are at this kind of work (`01`). This document takes the execution
floor as settled (§30–§32) and designs what must persist above it.

The test is **cognitive equivalence under reasoner substitution**: a fresh model, given only durable state, reaches
the same decisions for the same reasons, pursues the same commitments, holds the same uncertainties, and awaits the
same outcomes (`02`).

## 2. The ontology and the epistemic chain

Precise words prevent vague systems. These terms are used exactly and never interchangeably. They
fall into three groups: the **epistemic chain** every consequential piece of cognition travels, the
**forms of interpretation** that make up cognitive memory, and the **operational objects** that carry
work through time.

**The epistemic chain.**

```
evidence ─► interpretation ─► claim ─► belief ─► world state ─► decision ─► action ─► outcome
   ▲                                                                                     │
   └────────────────────────── the outcome is observed: it becomes new evidence ─────────┘
```

| Stage              | Is                                                                                               | Invariant                                                    |
| ------------------ | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| **Evidence**       | What was actually captured, observed, stated, or sourced — with source, time, consent, and exact spans. | Immutable. Everything else points back to it.        |
| **Interpretation** | Derived understanding of evidence — events, episodes, threads, experiences, memories (below).   | Versioned; names its operator; re-derivable.                 |
| **Claim**          | A proposition attributed to a source — a document, a person, or the system's own inference. One epistemic object with several kinds: _assertion_ (something is so), _expectation_ (something will be so), _resolution_ (what an expectation turned out to be), _diagnosis_ (why something failed), _competence_ (how well someone performs a class of work). | Never loses its attribution.                                 |
| **Belief**         | A claim held with an epistemic status, a confidence, its justifications, and a validity interval. | Changes by revision, never by overwrite.                   |
| **World state**    | The resolved current state of entities, relations, and causes, derived from beliefs.            | A projection of beliefs; never asserted directly.            |
| **Decision**       | A chosen course, with its rationale, the claims it relied on, the alternatives considered and how likely each was, and the **expectations** it declares. | Cites the claims it depends on; a consequential decision declares at least one expectation. |
| **Action**         | An executed effect, under authority.                                                             | Cites its decision; settled exactly once.                    |
| **Outcome**        | What actually happened as a result, as observed.                                                 | Observed, never asserted by the actor; becomes evidence; **resolves** the expectations it bears on. |

**Stages never collapse.** Every transition is performed by a named operator and logged. A model's
output enters the chain as interpretation or claim — never as belief or world state. A decision that
cites no beliefs, an action with no decision, an outcome known only from the actor's own report: each
is a violation. The payoff is **credit assignment**: when an outcome is bad, the chain can be walked
backward to the link that failed (§39; UCI §20).

**The chain closes through expectations.** A decision that declares what it expects, and an outcome that resolves
that expectation, turn every act into a measurement of the beliefs behind it. Two invariants make this structural,
and together they are the architecture's central _strong hypothesis_ (`01`, `03`):
- consequential decisions declare expectations;
- every expectation eventually resolves or expires, and is never silently dropped.

Resolutions are the atom of calibration for the world, person, and self models. They are necessary for learning,
but not sufficient (§38).

**Forms of interpretation** (cognitive memory):

| Concept        | Meaning                                                                                       | Invariant                                            |
| -------------- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| **Event**      | A bounded occurrence extracted from evidence, or an act of the system itself.                 | References the evidence spans it came from.          |
| **Episode**    | A coherent temporal segment of related events.                                                | Its boundaries are interpretations, with confidence. |
| **Thread**     | A longitudinal continuity linking episodes across pauses, sessions, devices, days, or years. | Every link in it is a hypothesis with evidence.      |
| **Experience** | An interpreted account of what happened, what mattered, and what changed.                    | Versioned; re-derivable from its episodes.           |
| **Memory**     | A durable, retrievable representation derived from experience, carrying one or more facets.  | Has a retrieval path, or it is not memory.           |
| **Skill**      | A reusable procedure learned from experience, with applicability, lineage, and evaluation.   | Trusted only through verification.                   |

**Operational objects** (operational memory):

| Concept           | Meaning                                                                                              | Invariant                                                             |
| ----------------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| **Goal**          | A desired future state.                                                                              | Distinct from how it will be reached.                                 |
| **Intention**     | A chosen direction toward a goal.                                                                    | Revocable; carries a rationale.                                       |
| **Commitment**    | An obligation to act — possibly to someone else — with a due condition.                               | Tracked until fulfilled, released, or broken.                         |
| **Open question** | Something the work needs to know and does not yet.                                                    | Held exactly until answered or dropped by decision.                   |
| **Open expectation** | An expectation awaiting its resolution, with a due condition.                                     | Resolves or expires; never silently dropped.                          |
| **Task**          | A unit of work serving an intention.                                                                 | Belongs to a process.                                                 |
| **Process**       | A persistent computational entity doing cognitive work under an identity, objective, and authority. | Survives restart; holds no state that is not in the substrate.        |
| **Working state** | A process's current cognitive state — a typed, model-independent **projection** over the authoritative objects above (§23). | Any model can resume from it; it is never a second copy of the truth. |
| **Context**       | A model-specific rendering of working state for one step.                                           | Recorded as a manifest; never the source of truth.                    |
| **Transaction**   | A unit of consequential change: intent, planned transition, execution, verification, commit (§32).  | External effects settle exactly once; cognitive changes commit only after verification _(strong hypothesis)_. |
| **Journal**       | A process's record of settled steps, decisions, and outcomes.                                       | Retained afterward as its **trajectory** — evidence the harness learns from like any experience. |

One invariant governs all of them: **every object except evidence is derived, and it must say what
it was derived from, by what operator, at what version.** That single rule is what makes memory
auditable, correctable, forgettable, and improvable.

## 3. Three memories, four kinds of object

The substrate holds **three memories**, distinguished not by content but by what correctness means
for each:

| Memory                 | Answers                        | Holds                                                    | Must be                                                         | Retrieved by   |
| ---------------------- | ------------------------------ | -------------------------------------------------------- | --------------------------------------------------------------- | -------------- |
| **Evidence memory**    | What happened?                 | Evidence — including the system's own trajectories, its decision records, and the manifests of what its models saw | **Faithful** — exact, immutable, complete, consent-bound        | Exact address  |
| **Cognitive memory**   | What was learned?              | Claims of every kind, the world, person, and self models they compose, and procedures | **Calibrated** — revisable, versioned, honest about uncertainty | Ranked relevance |
| **Operational memory** | What must be kept to continue? | Execution state — processes, journals, open effects, schedules, budgets — and **intentional state**: goals, intentions, commitments, plans, open questions, open expectations | **Consistent** — exact and transactional | Key            |

Mixing their semantics is a classic failure. Similarity search over operational memory lets a process
resume from a plan it only approximately remembers. Treating cognitive memory as evidence lets a
summary be quoted as what was said. Holding evidence to the revisable standard of cognitive memory
lets the record itself drift. **Operational memory is never retrieved by similarity; evidence memory
is never revised; cognitive memory is never mistaken for the record.**

**Intentional state is operational.** Goals, commitments, and open expectations are what a resumed reasoner most
needs, and what transcripts carry worst. A commitment remembered approximately is a broken commitment. So intentional
state is held to the consistent standard and read by key. Its retrievable _projections_ — "what did I promise, and
to whom?" — are ordinary memory facets (§12).

**Four kinds of object, not six stores.** Beneath the three regimes are only four authoritative kinds:

| Kind                                | What it is                                                                  | Regime      |
| ----------------------------------- | --------------------------------------------------------------------------- | ----------- |
| **Evidence**                        | What was observed, sourced, or recorded — including the system's own acts   | Evidence    |
| **Intentional and executive state** | What is wanted, promised, planned, pending, running, and permitted          | Operational |
| **Claims**                          | What is believed, expected, resolved, diagnosed, or known about competence  | Cognitive   |
| **Procedures**                      | How to act — skills, with their lineage and evaluation record               | Cognitive   |

Everything else is a projection over these four:
- events, episodes, threads, and experiences, which are interpretations of evidence;
- the memory fabric of facets;
- the world model, which is a projection of claims;
- indexes of every kind;
- each process's working state.

Projections are derived, versioned, and rebuildable, and none of them may become a second authority.

**Why skills are their own kind.** A skill has a different lifecycle from a belief:
- it is executable;
- it is judged by outcomes rather than by truth;
- it is promoted by controlled trials rather than by evidence;
- it can be dangerous in a way a fact cannot.

Different lifecycle, different kind — same provenance contract.

**One semantic authority, many projections.** If the same conversation is summarized separately into fifteen stores,
each store becomes a competing interpretation, and nothing can say which is true. Instead the evidence remains the
anchor, each concept has exactly one authority, and every projection carries references back to what it came from.
The system can then answer not only _what do I remember?_ but _why do I remember it, what evidence created it, when
was it valid, and what changed it?_

**Physical realization.** The substrate is defined by its objects, its provenance, and its laws, never by a database
(UCI §8).
- One strongly consistent engine that handles records, documents, vectors, text, and time is the pragmatic start.
- Specialized engines join **as projections** only when benchmarks demand them.
- Large binaries live in content-addressed storage referenced from the record.

Physical placement is free. Semantic authority is not.

## 4. The causal record

Continuity rests on one law: **every cognitively consequential transition leaves a durable, causally linked record,
unconditionally, and every view can be rebuilt from records** (UCI A4). An append-only event log is the natural
realization, and the one the reference systems most often reached. It is not the only one: projections committed
with their facts, step journals, and records carrying their own provenance can satisfy the same law. What can never
satisfy it is a causal record that is optional, sampled, or switched off by configuration. The one reference system
where the log could be disabled is the one whose continuity could not be trusted.

The properties below are what make continuity, replay, correction, and forgetting possible, whatever the physical
form:

- **Durable facts and live signals are separate channels.**
  - The durable channel records irreducible new facts: a tool was called, a claim was asserted, a belief was revised,
    a memory was forgotten.
  - The live channel carries transient signals — token deltas, progress, partial output — that exist only to make the
    experience responsive. Deltas are never persisted; the completed fact supersedes them.
  - **Durable records state new facts and never repeat state that is derivable from history.**
- **Ordering is logical, not wall-clock.** Each stream has a monotonic order. Each record carries causation and
  correlation links to what produced it, and cross-device ordering is causally consistent. Wall-clock time is data,
  not order.
- **Projections commit with their facts.** A projection is updated atomically with the fact that changes it, or
  through a mechanism that guarantees it eventually will be. There is never a moment where the record says one thing
  and a projection durably says another.
- **Consumers converge from a cursor** — history, then a synced marker, then live — and every consumer has its own
  failure domain. A slow surface is dropped and resyncs; it never slows the system.
- **Damage is bounded.** A torn final record from a crash is detected and skipped. Corruption in the interior fails
  closed rather than being silently tolerated.
- **Records outlive their writers** (UCI A20).
  - Every record is self-describing and carries the versions of the contracts, components, and models under which
    it was made.
  - Old shapes are upcast when read, and history is never rewritten to match new code.
  - A record that only the plugin which wrote it can interpret is a latent loss of memory.
- **Epochs bound history without losing it.** A long-lived process or stream rolls into a new epoch. The epoch
  carries forward exactly the state needed to continue and points back to the closed one, so no fold grows without
  limit and no history is discarded.
- **Snapshots accelerate, never replace.** Any snapshot can be discarded and recomputed.

**The reconstruction law, in two halves.** Anything that reaches a model must be **derivable** — adopted — and
**explained** — a strong hypothesis in its full form (UCI A6).
- **Derivable.** Every model request is preceded by a durable record of its attention manifest (§23), and every
  response is recorded before its consequences are acted upon.
  - The law is **enforced, not hoped for.** A runtime invariant compares each outgoing request with the view derived
    from records and refuses any request that diverges.
  - A new kind of model-visible input therefore requires a new kind of record. There is no side door.
- **Explained.** The manifest also records why each item was selected and what was excluded and why — adopted, as
  every earlier formulation of this law required — and, as the strong hypothesis, how items were transformed, how
  likely the selection policy was to include each, and reasons faithful enough to predict the model's behaviour.
  - Derivability lets the system reproduce a model call. Explanation lets it learn from one: which context helped,
    which hurt, and what a different selection would have done (§24, §39).
  - Derivability exists in the references. Explanation exists in none of them.

## 5. Identity and provenance

**Everything has a stable identity.** Every cognitive object — evidence, event, episode, thread, memory, claim,
skill, goal, commitment, process, manifest — has a stable identity and addressable versions. Identities survive
restarts, migrations, device changes, and storage-engine replacements. Objects created on different devices get
globally unique identities at creation, so offline capture reconciles later without collision.

**Provenance is a graph.** Every derived object records:
- what it was derived from, at which versions;
- which operator produced it, at which version;
- which model and policy were involved, if any;
- how confident the derivation was;
- when the system derived it.

Together these derivation records form a **provenance graph** from every belief, memory, and skill down to the
evidence beneath it. That graph makes five things possible that are otherwise impossible:

1. **Explanation** — walk down: _this belief rests on these three memories, which rest on these two
   conversations and this document page._
2. **Correction** — walk up: _this evidence was misheard; here is everything that inherited the
   error._
3. **Forgetting** — walk up and remove: deletion that is provably complete (§27).
4. **Re-derivation** — rerun: _this operator improved; recompute everything it produced._
5. **Truth maintenance** — when a support is retracted, everything that depended on it is re-evaluated, including
   the decisions that relied on it and the expectations they declared (§16).

**Retroactive re-derivation.** Because evidence is preserved and every interpretation names its operator and model,
a better extractor, a better episode former, or a better model can **re-interpret old evidence**.
- The new derivations are evaluated against the old (§39).
- They are adopted through the governed ratchet (UCI §29) if they are better.
- The old versions are kept as superseded.

Memory therefore improves _backward in time_: the system understands its past better next year than it does today.
This is the single strongest reason never to summarize away raw evidence.

## 6. Cognitive time

Longitudinal cognition needs more than a timestamp. Every temporally meaningful object distinguishes:

- when it actually happened, if that is known;
- when the system captured it;
- when a belief or state was true in the world;
- any time referred to inside the content ("last March");
- when the system came to believe it;
- when it was later retrieved, and to what effect;
- its order within its stream;
- how uncertain any of these times is.

The two axes that matter most are **valid time** (when was this true in the world?) and **knowledge
time** (when did we know it?). Keeping both — a **bitemporal** model — makes the questions that
longitudinal cognition depends on answerable without ambiguity:

- _What is true now?_ — valid at now, known by now.
- _What did I believe about this in March?_ — known by March.
- _When did this become true?_ — the start of its validity.
- _When did the system learn it — and did it act on stale belief in between?_ — the gap between the
  two axes; the foundation of honest audits.

Times inside content are extracted with uncertainty ("a few years ago" is an interval, not a date),
and relative expressions are resolved against the capture context, never against the moment of
processing.

**Clocks that must never be confused.** Beyond the bitemporal axes, long-lived cognition runs on
clocks that measure different things:

- **World time** — when things are true in the world (valid time).
- **Knowledge time** — when the system came to know them.
- **Process time** — a process's own clock: the sequence of its journal and its context epochs. A
  process dormant for a month has aged a month in world time and not at all in process time.

Attention is deliberately _not_ a clock. It is a **budget** — cognition spent, accounted per object,
per goal, and per process — and it is scheduled (§35), not measured in time.

**Staleness is reasoned about, not ignored.** Every belief carries its age since it was last verified.
When a process resumes after its process time stood still while world time moved, it asks _what
changed while I was away?_ — and re-validates the beliefs its plan depends on before acting on them.
Knowledge does not stay true because nobody looked at it.
- Different kinds of claim go stale at different rates. A person's name barely changes. The state of a build changes
  within minutes. A learner's mastery decays on a curve that spaced retrieval measures.
- Staleness is therefore a property of the claim's kind and domain, learned from how often re-validation actually
  found a change. It is not one global timeout.
- **Open expectations age too.** One whose due condition has passed without resolution is expired explicitly and
  counted. It is never forgotten silently.

---

# Part II — Formation: from stream to experience

## 7. The ingestion cascade

Ingestion runs continuously, but a large model never reads every raw token. It is a **cost ladder**:
each tier is cheaper and faster than the next, and work escalates only when the cheaper tier says it
is worth it.

| Tier                            | Typical work                                                                               | Latency / cost          |
| ------------------------------- | ------------------------------------------------------------------------------------------ | ----------------------- |
| **A — streaming**               | capture, normalization, timestamps, diarization, basic entity cues, consent and policy checks | milliseconds · trivial  |
| **B — cheap local inference**   | segmentation, topic shift, activity detection, salience, candidate links                   | low                     |
| **C — asynchronous interpretation** | episode formation, entity linking, thread reconstruction, experience formation         | medium                  |
| **D — deep consolidation**      | reflection, generalization, contradiction analysis, skill extraction                       | high · background       |
| **E — strategic cognition**     | world-model revision, long-horizon planning, proactive preparation                         | selective · background  |

```
STREAM → capture/normalize → cheap signals (time · speaker · modality · device · place · language ·
activity · consent) → segmentation → event detection → context stitching → selective expensive
interpretation → experience formation → memory compilation
```

Rules of the cascade:

- **Capture is append-only and resilient** to intermittent connectivity; devices buffer and sync.
- **Every captured item gets a stable identity and provenance at the moment of capture.**
- **Consent and sensitivity labels attach at capture** and are inherited by everything downstream
  (§29). Evidence that may not be kept is never written.
- **Write latency is separate from interpretation latency.** Capturing must never wait for
  understanding; ingestion stays up even when every model is down.
- **Raw evidence and derived interpretation remain distinguishable forever.**

## 8. Perception and multimodal alignment

The architecture is modality-agnostic now so that microphones, cameras, glasses, screens, spatial
sensors, and devices not yet invented plug into the same experience substrate.

```
text ─┐
audio ├─► per-modality perception ─► alignment on one timeline ─► events ─► experience
image ┤      (each with its own
video ┤       uncertainty, sampling
screen┤       rate, blind spots,
place ┤       and privacy policy)
device┤
future┘
```

- **Each modality contributes evidence with its own uncertainty.** A transcript carries per-span
  confidence; a speaker attribution stays probabilistic until evidence accumulates; a location is an
  area with accuracy, never a false exact point.
- **Alignment happens on a shared timeline**, so that "what was on the screen while she said that"
  is a query, not a reconstruction.
- **Richer sensing is not richer truth.** More modalities mean more evidence and more ways to be
  wrong; each one's error model is part of its adapter.
- **Device and application context is evidence, not fact.** That an app was open does not mean it
  was being read.
- **Edge and centre divide the labour.** Devices do low-latency and privacy-sensitive
  preprocessing, keep a hot cache of active threads, and capture offline; the centre holds the
  authoritative substrate and does expensive longitudinal reasoning. Stable identities make
  reconciliation deterministic.

**Modality-specific operators, one evidence model.** Every modality needs its own operators: document layout
analysis, speech recognition and diarization, frame sampling, code parsing, table extraction. What they produce must
converge on one shape (`08`):
- a **universal evidence envelope**: source, capture, labels, and content address;
- **anchors**: selectors that point at an exact region of any evidence — a text span, a page region, a time interval
  of audio, a frame, a cell, a line of code — and survive re-rendering;
- **derivations**, which say which operator produced what from which anchors;
- **temporal frames**, which place an item on the shared timeline with its uncertainty;
- **identity hypotheses**: "this speaker is that person", "this figure is that entity", held as claims, never as
  facts;
- a **multi-representation index**, so that the same evidence is reachable exactly, lexically, semantically, and
  structurally.

A domain adds its own ontology on top. It never adds a second evidence model.

**Every operator is an interpretation with a measured error.** A parser, a transcriber, and an OCR engine are not
neutral pipes.
- Document parsers disagree enough that swapping one can reverse a downstream result.
- Speech recognizers can fabricate fluent text that was never said (`R3`).

So an operator's output is interpretation, not evidence. It carries the operator's identity and version. Its
confidence comes from the operator's measured error on that kind of input, not from the operator's own score. Raw
evidence stays available, so a better operator can re-derive (§5).

## 9. Segmentation, events, and episodes

**Segmentation** cuts continuous streams into meaningful windows — by speaker turns, topic shifts,
activity changes, silence, location changes, and application switches. Audio and video are segmented
into windows that can be addressed, not stored as monoliths.

**Events** are bounded occurrences: _she proposed moving the deadline_, _the test suite failed_, _the
learner answered 3/4 when the answer was 3/8_. Each event names its actor and participants
(observed or inferred, never conflated), its time, its modality, and the exact evidence spans it came
from.

**Episodes** cluster related events into coherent segments — a meeting, a lesson, a debugging
session. An episode knows its participants, places, topics, active goals, artifacts, salient events,
decisions, outcomes, and the confidence of its own boundaries. Boundaries are interpretations: a
conversation that paused for lunch may be one episode or two, and the answer can change as later
evidence arrives.

## 10. Threads — the continuity engine

Life is fragmented. A conversation starts at 10:00, stops at 10:17, continues at 14:00 after other
work, resumes at 18:30 on another device, and is referenced three days later. These are separate
episodes joined by a persistent **thread**. The continuity engine's job is to discover threads —
carefully.

| Signal                     | Example                                          | Weight           |
| -------------------------- | ------------------------------------------------ | ---------------- |
| Explicit user link         | "this is about yesterday's discussion"           | **authoritative** |
| Commitment continuity      | the same promised action                         | very strong      |
| Goal continuity            | the same desired outcome                         | strong           |
| Entity continuity          | the same person, project, object                 | strong           |
| Artifact continuity        | the same file, document, repository              | strong           |
| Conversational reference   | "as we discussed", "that thing you mentioned"    | strong           |
| Outcome continuity         | the new event is a consequence of an old one     | causal link      |
| Semantic continuity        | the same topic or problem                        | candidate only   |
| Temporal proximity         | events close in time                             | supporting       |
| Spatial continuity         | the same place or route                          | supporting       |

**A thread link is a hypothesis, not a fact.** It carries the signals that support it, a strength
class (candidate → probable → established → user-confirmed), and the reason it was created. Links
strengthen when independent signals accumulate and weaken or expire when they don't. Semantic
similarity alone can nominate a candidate link; it can never establish one (§18).

## 11. Experience formation

Experience formation is the layer most memory systems skip — and the one that makes memory useful.
It answers the questions a person would ask about their own past: _what was happening? who was
involved? what changed? what thread does this belong to? what earlier state does it connect to? what
followed from it?_

```
episode(s) + thread context ─► EXPERIENCE
   actors · objects · place · time · activity · topic · intent · salience
   goals touched · decisions made · commitments created or fulfilled
   outcomes · state changes · causal hypotheses · open questions · uncertainty
```

An experience is an interpretation, versioned and re-derivable. Its most important content is often
**what changed**: a belief revised, a goal abandoned, a relationship shifted, a skill demonstrated, a
misconception corrected. Change is where learning lives.

## 12. The memory compiler and the facet vocabulary

The memory compiler turns experience into durable projections. It does **not** classify each
experience into one category. It produces a **sparse set of high-value projections**, each linked to
its evidence, and one experience commonly participates in many at once.

```
experience ─► salience · utility · recurrence · explicit instruction · surprise
           ─► facet selection ─► candidate memories
           ─► conflict · redundancy · provenance checks
           ─► promote · merge · revise · retain · archive
```

**The hundred dimensions are lenses, not boxes.** Memory has about a hundred useful dimensions. They are an **open,
versioned facet vocabulary** of indexes over the four kinds of object (§3). They are never a hundred stores, a hundred
tables, or a hundred write pipelines.
- A facet is a typed extension that an object may carry.
- An index is built for a facet only when retrieval needs it.

Facets group into families — episodic, semantic, social, procedural, prospective, causal, affective, epistemic, and
more — but the vocabulary is data, not a schema fixed here.

Where a facet names an authoritative object — a goal, a commitment, a decision, a competence claim — the facet is a
retrievable projection of that object, never a second copy of it.

The vocabulary is **open**: a new facet arrives as a new projector plus a backfill — a re-fold of the
record (§4) — never as a migration of the world. The vocabulary is **versioned**: facet definitions
change by governed proposal, and old memories keep the version they were compiled under until they
are re-derived.

**The first engineering cut** implements the substrate and lifecycle that make every facet possible,
then only the projections that earn their place first: episodic, semantic, social, procedural,
prospective, and epistemic. Every other facet is a projector added later — not an architectural
rewrite.

## 13. Memory formation: value, triggers, and adjudication

Not every experience deserves the same processing, and most language is transient: repetitive,
socially incidental, noisy, or context-bound. Preserve all evidence (subject to consent); form and
promote selectively.

**Formation is judged by what it makes possible later.** A memory system that stores well but changes nothing is an
archive. The measure of formation is **memory value**: a formed memory later improves a decision that needed it,
removing it harms that decision, and memories that never matter do not accumulate as noise (UCI §34). Everything
below serves that measure.

**Formation triggers.** Formation runs when there is reason to expect future value, not on every turn:
- explicit instruction from the person;
- a decision made, a commitment created, or a goal changed;
- **surprise** — an expectation that resolved against the prediction;
- a correction;
- a verified success or failure worth a procedure;
- recurrence across episodes;
- contradiction with something already believed.

Surprise and correction deserve special weight. They mark exactly where the model of the world, the person, or the
system itself was wrong.

**Promotion is a decision under a budget.** It estimates the future value of keeping something retrievable at a
given level against the costs:
- storage;
- pollution of retrieval;
- the privacy risk of keeping it.

The estimate draws on the triggers above and on redundancy with what is already known. The features and their
weights are learned (below), not fixed here. **Levels of promotion** are each a step up in cost and in retrieval
priority:

1. **Evidence only** — kept, not interpreted.
2. **Indexed** — lexically and semantically searchable.
3. **Interpreted** — part of an episode and an experience.
4. **Projected** — carries facets; participates in typed retrieval.
5. **Consolidated** — generalized into semantic abstraction, belief, or skill.
6. **Core** — part of the always-available model of the person or the work.

**Truth is maintained at write time.** When a new claim is formed, it is adjudicated _then_ against what it
contradicts, supersedes, refines, or depends on (§16). It is not stored beside its rivals for retrieval to sort out
later.
- The evidence is strong. Systems that adjudicate conflicts when claims are written handle knowledge updates far
  better than systems that leave contradictions for the reader, and models reading unresolved conflicts in context
  mostly fail, especially across several hops (`R1`).
- Superseded values left in context actively interfere with retrieving the current one.

**Raw and abstract memory serve different purposes.** Abstractions — summaries, generalizations, lessons — transfer
across situations. Raw episodes preserve the details that abstraction discards and that later turn out to matter.
Formation keeps both: the abstraction as a derived claim or procedure, and the evidence it came from, linked (§5).

**Three principles make formation intelligent rather than heuristic:**

- **Explicit instruction dominates.** "Remember this" promotes immediately. "Don't remember this" prevents it.
- **Two strengths, not one.** How confident the system is that something is true, and how readily it should come to
  mind, are different quantities. They must not be conflated. A well-verified fact may be rarely relevant. A vivid
  recent memory may be weakly supported.
  - Retrieval priority rises with use and falls with disuse.
  - Confidence changes only with evidence.
  - Both are kept.
- **Formation learns.** Meta-memory (§24) records which formed memories were later retrieved and actually used, and
  which were ignored or corrected. That outcome signal, generated by the system itself, trains the triggers and the
  promoter. The system learns what is worth remembering about _this_ person and _this_ kind of work.

The promotion score is a routing signal for deeper processing, never a verdict of truth.

---

# Part III — Epistemics: what the system believes, and why

## 14. Claims, beliefs, and the epistemic lattice

The system must aggressively refuse to turn inference into fact. Every durable proposition is a
**claim** with an attributed source, and every held claim is a **belief** with an epistemic status.
Status has two independent dimensions:

**Origin** — where the proposition came from:

| Origin             | Meaning                                                    | Authority                                                                     |
| ------------------ | ---------------------------------------------------------- | ----------------------------------------------------------------------------- |
| **Observed**       | Directly present in evidence                               | High for what was observed; says nothing about what it means                  |
| **User-stated**    | Said by the person                                         | Authoritative about their own preferences and intentions; not about the world |
| **Source-reported** | Asserted by a document, a website, another person         | Stays attributed: _"the book says X"_ is never laundered into _"X"_          |
| **Inferred**       | Derived by the system                                      | Only as strong as its inputs and its operator's calibration                   |
| **Conjectured**    | Put forward for testing                                    | None until tested                                                             |

**Standing** — how well it is supported now:

```
unknown ─► hypothesized ─► likely ─► supported ─► verified
                  │            │          │
                  └────────────┴──────────┴──► disputed ─► contradicted
                                                       any ─► superseded ─► obsolete
```

Transition rules make the lattice honest:

- An inference rises to **supported** only with **independent** evidence — not with more inferences
  from the same source.
- **Verified** is reachable only through a verification event (§36), never by assertion.
- **Disputed** is a legitimate resting state: two credible sources disagree and the system says so.
- **Superseded** is not wrong — it was true, and now is not; its validity interval closes (§16).
- **Perspectives coexist.** Different sources' claims about the same matter are kept side by side,
  attributed, so the system can reason about schools of thought, disagreements, and a person's own
  beliefs without collapsing them into one undifferentiated truth store.

- **Every belief records its justifications**: the claims and evidence that support it, and those that count against
  it. Standing is computed from justifications, which is what lets a retraction propagate (§16).

Retrieval exposes epistemic status to state compilation (§23). A highly similar memory with weak
provenance must not silently outrank a less similar but directly evidenced one when the task demands
precision.

**One object, five kinds.** Assertions, expectations, resolutions, diagnoses, and competence claims share this
lattice, these origins, and this provenance. They differ only in what resolves them:
- an assertion is resolved by further evidence;
- an expectation by its due outcome;
- a diagnosis by whether the fix it implies works;
- a competence claim by accumulated resolutions on the class of work it describes.

Keeping one object means that one calibration machinery, one contradiction machinery, and one forgetting machinery
serve all five (`03`).

## 15. Confidence is a vector, and it is calibrated

A single confidence scalar hides exactly the information needed to use a belief well. Confidence is a **vector**
whose dimensions separate independent sources of doubt — for example, whether the source is trustworthy, whether
the extraction was right, and whether the time is right. The dimensions are a versioned vocabulary that grows with
need, not a fixed schema.

**Confidence must be calibrated, and calibration is measured.** Whenever a claim resolves — an expectation meets its
outcome, a belief is verified or falsified — the system records how confident each contributing operator, model,
and verifier was.
- Calibration is maintained per operator, per model, per task class, and per domain.
- A component that is systematically overconfident is down-weighted automatically.
- Calibration is re-measured when a model changes, because calibration earned by one model says little about its
  successor.

**Uncalibrated confidence is noise dressed as information.** Self-reported confidence is the least trustworthy
signal of all. Agents' own confidence in their success runs far above their success rate, and estimates made before
acting are better than judgments made after (`R2`). So the confidence a process asserts about its own work is
recorded as a claim to be calibrated, never used as if it were already calibrated.

## 16. Contradiction, revision, and truth maintenance

Long-lived memory will contain contradictions: people change jobs, plans change, opinions change,
facts were misremembered, and earlier inferences prove wrong. The system never resolves this by
overwriting.

```
new claim ─► conflict detection
               same entity? same time? same proposition?
               changed state, or genuine contradiction, or uncertainty?
          ─► resolution
               coexist with validity intervals      (it changed: both were true, at different times)
               supersede                            (the old belief is closed, not deleted)
               lower confidence                     (the evidence is weaker than it looked)
               mark disputed                        (credible sources disagree)
               ask the person                       (when it matters and only they know)
               retain both with provenance          (when resolution is not yet possible)
```

**Adjudication happens at write time** (§13). The cheap, local check runs when a claim arrives. Deep, global
consolidation (§26) catches what local checks miss.
- **Recency is not reliability.** A newer claim wins only when it is better supported or describes a later state of
  the world, never merely because it arrived later.
- **Unresolved contradictions are first-class open questions**, not errors to hide.

**Truth maintenance propagates.** Because every belief records its justifications (§14), retracting or weakening a
support re-evaluates everything that depended on it:
- beliefs derived from the retracted claim;
- world state projected from those beliefs;
- **decisions that relied on them.** Those decisions are flagged, not silently left standing;
- the expectations those decisions declared.

A decision whose premises have collapsed is surfaced to the process that owns it, or to the person, as an open
question: _this was decided because of X; X is no longer believed_. This is how a long-lived system avoids acting,
for months, on a conclusion whose reasons are gone.

Revision is a typed mutation (§25): it names the belief, the new evidence, the resolution chosen, and the operator
that chose it. History is preserved, so "what did we believe then, and why did we change our mind?" is always
answerable.

## 17. The world model, the person model, and the self-model

Memory answers _what happened_ and _what is known_. The **world model** represents _how things are
now, and how they got that way_: people, projects, places, objects, organizations, relationships,
states, constraints, causes, and predictions — each a belief with provenance, status, and validity.

```
observation ─► evidence ─► belief / state hypothesis ─► verification / cross-evidence
     ▲                                                              │
     └──── new observation ◄── expectation / planning ◄── world-model update
```

**A world model is tested by its expectations.** A model that never predicts is never tested. UCI's world model
makes explicit, recorded expectations — _this learner will confuse these two ideas; this test will fail after that
change; she will want the summary before the meeting_. Each is a claim with a resolution condition and a due time.
When the world answers, the expectation resolves. The result feeds calibration (§15) and, when surprising, becomes
high-value memory (§13).

**Simulated outcomes are expectations, never evidence.** Rolling the world or person model forward produces
expectations to be resolved, weighted by the simulator's measured fidelity. It never produces observations
(UCI §18).

**The person model** is the world model's most important region, and its most sensitive: identity, preferences,
routines, goals, commitments, relationships, knowledge and capability states, decision patterns, communication style,
learning state, life domains, current projects. Each component is independently inspectable and traceable to
evidence. Deep personalization emerges from accumulated evidence — never from a giant prompt.

**Some person-model items have policy force.** A stated preference or constraint — _never schedule before ten; she
is vegetarian; do not mention the diagnosis_ — is not merely a fact to retrieve when relevant. It is a **standing
default** that must shape every applicable decision whether or not anything retrieved it.
- Models given such preferences in long contexts follow them rarely without help (`R1`). So policy-force items are
  compiled into the working state of every process they apply to, as constraints (§23), and compaction never drops
  them.
- Whether an item has policy force is itself recorded, and the person can see and change it.

**Beliefs about beliefs.** Teaching requires modeling what another mind believes. A learner's misconception is a
**nested belief**: the system believes, with evidence and confidence, that _the learner believes_ something false —
and expects how that will show. The same structure models what a colleague thinks was decided, or what a source
assumes. Nested beliefs are ordinary beliefs whose subject is another agent's belief; they need no separate
machinery, only discipline.

**Competence is one machine, pointed three ways.** Competence claims are how well an agent performs a class of work
under given conditions. The learner model's mastery, the person model's skills, and the system's model of its own
reliability are all competence claims.
- Competence is ability over latent demand dimensions, estimated from observed success and failure on items whose
  demands are known. It is the same mathematics whether the subject is a learner mastering algebra or the system
  learning to migrate schemas (`03`, `07`).
- Mastery has a half-life that spaced retrieval measures. The system's competence resets, in part, when its model
  changes.
- **The self-model is the projection of the system's own competence claims** (UCI §14). It is fitted from
  resolutions, not from self-assessment, and it is the basis of graduated autonomy.

Everything education needs from a learner model, the person model provides. Everything the system needs to know
about itself, the same machinery provides.

## 18. The link discipline

The deepest failure mode of memory systems is **over-association**: seeing similarity and inventing
continuity.

```
SIMILARITY ≠ IDENTITY        SIMILARITY ≠ SAME EPISODE      SIMILARITY ≠ SAME PERSON
SIMILARITY ≠ CAUSATION       SIMILARITY ≠ USER INTENT       SIMILARITY ≠ FACT
```

- Strong links require **multiple independent signals**.
- Candidate links stay **probabilistic until reinforced**.
- **Every link stores why it was created**, by what operator, from what signals.
- **Observed links and inferred links are distinguishable** forever.
- Links **expire or downgrade** when their support does not grow.
- **An embedding match alone never rewrites the world model** — it can only nominate.
- **Explicit statements by the person are high-authority** link evidence.
- **Temporal and entity constraints act as hard filters** where they apply: two people with the same
  name, in different cities, in different years, are two people until proven otherwise.
- **The false-link rate is a first-class metric** (§39), measured on adversarial cases: same names,
  similar projects, recurring conversations, repeated phrases.

---

# Part IV — Retrieval and Attention

## 19. Retrieval is half of memory

Storage without indexed, ranked, cross-session retrieval is not memory; it is a landfill. A memory
tier with no retrieval path is incomplete by definition. Retrieval must serve fundamentally
different needs:

| Need                 | Mechanism                                              | Example                                                  |
| -------------------- | ------------------------------------------------------ | -------------------------------------------------------- |
| **Exact**            | stable ids, exact spans, timestamps, object references | "What exactly did he say?"                               |
| **Semantic**         | embeddings + lexical + reranking                       | "What was the idea we discussed?"                        |
| **Contextual**       | episode and thread reconstruction                      | "Why did I start talking to him about this?"             |
| **Relational**       | graph traversal                                        | "What have I discussed with her about this project?"     |
| **Temporal**         | time range, state-at-time, belief-at-time              | "What did I believe about this in March?"                |
| **Causal**           | causal and decision links                              | "What led to that decision?"                             |
| **Procedural**       | skill and workflow retrieval                           | "How did I solve this last time?"                        |
| **Autobiographical** | life-thread retrieval                                  | "When did I first start working on this?"                |
| **Prospective**      | commitment and schedule retrieval                      | "What did I promise, and to whom?"                       |
| **Reconstructive**   | assembling an account from evidence and interpretations | "Walk me through how that project fell apart."          |

**Recall is reconstruction — grounded.** Remembering an episode, a project's history, or "what we
knew at the time" is rarely a lookup; it is the assembly of an account from many pieces of evidence
and interpretation. Human memory reconstructs too, and confabulates where the pieces are missing. UCI
reconstructs **without confabulating**: every element of a reconstructed account cites the evidence
it rests on, inferred connections are marked as inferred, and **gaps are shown as gaps** — never
filled by plausible invention.

## 20. The retrieval pipeline

Retrieval never depends on a single vector query. It is a cascade in which cheap, high-recall
stages run first and expensive reasoning runs last, on few candidates.

```
QUERY (from a person or a process)
  ─► query understanding       entities · times · places · topics · intents · exact terms · facets
  ─► retrieval plan            which routes, which filters, what granularity, what budget
  ─► memory router             person? → social · "what happened" → episodic · "why" → causal ·
                               "how do I" → procedural · "when" → temporal · "remember to" → prospective
                               ambiguous → multi-route
  ─► parallel candidates       exact │ lexical │ vector │ graph │ temporal │ procedural │ prospective
  ─► union
  ─► hard filters              consent · scope · clearance · time · provenance · access
  ─► rerank                    decomposed reasons (§21)
  ─► evidence expansion        pull supporting evidence, counter-evidence, thread context
  ─► core memory set           ─► state compilation (§23)
```

**The router is allowed to be wrong.** Retrieval always keeps a cross-route fallback so that a
mistaken classification never makes a memory invisible.

**Hybrid by default.** Lexical and dense retrieval fail in different places. Exact terms, names, identifiers, and
rare words defeat embeddings. Paraphrase defeats lexical match. Combining them, then reranking, beats either
alone. Graph-structured retrieval earns its place where relations are the question. At matched cost, it has not
shown that it beats a well-tuned hybrid pipeline on general recall (`R3`), so graph routes are added by measured
benefit, not by default.

**Hard filters come before expensive ranking**, and policy filters are never optional: a memory the
process is not cleared to see is not a low-ranked candidate — it is not a candidate.

**Retrieval is also an action.** Besides the memory a process is given, a process can _ask_: query
memory through tools, follow provenance links, open a thread, page in an episode. Retrieval that the
model directs is as important as retrieval done on its behalf (§23).

**The latency law.** The hot path is shallow and deterministic. Active threads, current goals,
recent episodes, and core person-model state are cached; episode and thread embeddings are
precomputed; graph work uses neighbourhoods, not whole-graph traversal; small models route, large
models reason. Latency is measured at p50/p95/p99 **per operation** — exact, semantic, temporal,
graph, composite — because one average hides every problem.

## 21. Ranking with decomposed reasons

Relevance is not one number that one embedding model can encode. The ranker combines independent channels of
evidence:
- match: exact, lexical, semantic;
- fit: temporal, relational, causal, social, procedural;
- expected future use;
- explicit reference and continuity with the current context;
- penalties for contradiction risk, redundancy, and weak provenance.

How the channels combine is scaffolding in the sense of UCI §26. It is learned per task class from meta-memory
outcomes (§24), not fixed in the architecture.

- **Reasons are preserved** in the retrieval record and the attention manifest, so "why was this retrieved?" has a
  precise answer, and so a later learner can tell which reasons predicted usefulness.
- **Precision mode.** When the task demands factual precision — an exact quote, a date, a figure —
  the ranker shifts weight toward exact match and direct evidence and away from semantic similarity.
- **Diversity is deliberate.** The core set avoids near-duplicates and, where a claim is at stake,
  includes the strongest counter-evidence rather than only confirmations.

## 22. Hierarchy and granularity

One embedding cannot answer both "what sentence did he say?" and "what long-term pattern connects
these events?" Representations exist at many granularities:

| Level               | Purpose                                      |
| ------------------- | -------------------------------------------- |
| Utterance / event   | fine-grained recall; exact semantic lookup   |
| Episode             | a coherent interaction                       |
| Thread              | longitudinal continuity of a topic or project |
| Entity              | people, projects, concepts                   |
| Experience          | high-level meaning                           |
| Skill               | procedural similarity                        |
| Decision            | decision-pattern retrieval                   |
| World-state snapshot | similarity of situations over time          |

Retrieval **descends a hierarchy** — life domain → project or relationship thread → episode cluster →
episode → event → exact evidence span — narrowing the search space at each level and producing an
interpretable path: _found in this project thread, in this week's episodes, in this exchange, at this
line._

## 23. From state to attention

This is where memory meets cognition, and it happens in **two compilations separated by one
boundary**:

```
substrate ──► STATE COMPILATION ──► working state ──► CONTEXT COMPILATION ──► context + manifest ──► model
              what is true and          typed,             how to render it for
              relevant for this         derived,           this model, this step,
              process, now              model-independent  this budget
```

**Why two.** If selection and rendering are fused, what a process "knows" changes whenever the model
changes, non-model consumers cannot share it, and nobody can inspect it except as a prompt. Separating
them means a model swap changes only the rendering; verifiers, planners, deterministic units, and
surfaces read the same working state a model does; the Cognitive Surface can show _what the system
thinks is happening_ as an object rather than as text; and a failure can be localized — wrong
selection, or bad rendering.

The five steps inside it (`05`):
1. **Situation.** What is happening: the triggering input, the process's position, the environment's state readout.
2. **Relevance.** What in the substrate bears on it, found by retrieval (§20) and by the process's own queries.
3. **Working state.** The typed, model-independent projection of what matters now.
4. **Attention.** What to put in front of this model for this step, within budget.
5. **Rendering.** The model-specific form of that attention, with a manifest.

Steps 1–3 are state compilation. Steps 4–5 are context compilation. Selection, order, and format each change model
behaviour substantially:
- models degrade as relevant material sinks into long contexts, even when it is all present;
- format alone moves results by large margins (`R3`).

So every step is recorded, not only the last.

**State compilation** maintains a process's **working state**. It is a typed **projection** over authoritative
objects, never a second store of them (§3):

- **Objective** and acceptance predicate; the **plan** and the process's position in it; the
  **decisions** in force, with their reasons and the alternatives they rejected.
- **Commitments, open expectations, and open questions** — what the process has promised, is waiting
  to see, and does not yet know.
- **Core state** — the essential person or project model, pinned.
- **Relevant claims** with their status and confidence — and, for any claim the next step depends
  on, the **strongest counter-evidence**.
- **Retrieved memory** — the core memory set (§20), with reasons and provenance.
- **Live contradictions and staleness flags** (§6), including decisions whose premises have weakened
  (§16).
- **Constraints in force** — policies, the person's policy-force items (§17), and every standing
  instruction the process has received; **affordances** — the skills and actions available.
- **Open transactions** and what each has staged (§32).

Only two parts of it are authoritative for the process itself: its **position in the plan** and its **current focus
of attention**. Everything else is derived from authorities the process does not own. That is why the working state
can be discarded and rebuilt at any time, and why a different model resumes from exactly the same thing. It is
maintained incrementally, re-projected at epochs, carried forward by each committed step (§32), and rebuilt around
every recovered process.

**Context compilation** renders the working state for one model route and one step. It constructs
**the smallest sufficient attentional view** — and records exactly what it built.

**Precedence.** The constitution first; then environment instructions (the domain's interface, tools,
and policies); then adaptive policy (the learned, governed adjustments for this agent, person, and
task); then working-state sections in priority order; then the recent tail of the process's own
activity, cut at safe boundaries so that every tool call stays paired with its result; then the skill
and tool index — names and one-line descriptions, bodies loaded only on demand.

**Budgeting.** Each source has a budget; when the total exceeds the window, lower-precedence sources
yield first, and **everything excluded is recorded with the reason** (budget or policy). Labels are
enforced at both compilations: nothing enters the working state or the view that the process is not
cleared to see (§29).

**Constraints are pinned.** Deontic content does not compete for budget as ordinary material does:
- what the process must do, must not do, or has promised;
- the person's standing preferences.

It is pinned, and compaction never elides it. The evidence is stark. Summarization-based compaction keeps a small
fraction of the constraints it is given, and repeated compaction erodes them further round by round (`R3`). A
process that has forgotten an instruction is not continuing the same work.

**Stable first.** The view is ordered from most stable to least, and changes to stable parts arrive
as appended notices at explicit **context epochs** rather than as rewrites — so a provider's prefix
cache survives, an economy the architecture keeps without depending on it.

**Projection is frozen per epoch; writes are immediate.** A memory written mid-epoch is durable at
once and retrievable by any process that asks — but the pinned core state in a running view changes
only at the next epoch or through an appended notice. Durability and cache stability stop fighting.

**Context changes only by surface operations.** The model-visible history is a fold over two
operations: _append_, and _replace_ — which names exactly the span of events it shadows. Compaction,
redaction, and image or document offloading are all replacements that cite their sources; nothing is
ever silently dropped from what the model is told happened.

**Recalled memory is attributed evidence, never instruction.** Retrieved memories enter the view
marked as recalled context with their provenance and epistemic status — never as system instructions
and never indistinguishable from what the person just said.

**The attention manifest.** Before any model call, the compiler writes a durable **attention manifest**. It records:
- which process, step, and model route the call belongs to;
- every included item, at its version, with the reasons it was selected and any transformation applied to it
  (truncated, summarized, redacted, reformatted);
- how stale each included item was;
- every excluded candidate, and why it was excluded;
- how likely the selection policy was to include what it included;
- the clearance used;
- the budget accounting.

Every span of the rendered context maps to exactly one manifest item, so nothing the model saw is unaccounted for.
This is the reconstruction law (§4) made concrete, in both halves:
- the manifest makes a call **derivable**;
- its reasons, exclusions, and selection probabilities make it **explained**.

**The manifest's reasons are claims, and they are tested.** A manifest that says an item was decisive predicts that
removing it would change the decision. The context-causality test (UCI §34) checks exactly that, by ablation, on
sampled calls. Reasons that do not predict behaviour are evidence that the selection policy is wrong, and they feed
meta-memory (§24).

**Compaction is recomposition, not summarization.** When a process's recent tail outgrows its budget, the compiler
does not ask a model to summarize the transcript and discard it.
- It brings the **working state** up to date — objective, decisions made and why, work completed, active, and
  blocked, open expectations, next move, relevant objects — and advances the epoch.
- The next view is rendered from durable state: the working state, the retrieved memory, the pinned constraints, and
  a fresh recent tail.
- The pre-boundary transcript remains in the record and **stays retrievable**.
- **Elision is addressable.** Wherever material was elided, the view carries a pointer the model can follow to get
  it back, never a silent hole.

Compaction is measured by what survives it, not by the tokens it saves. Every constraint, commitment, open
expectation, and decision reason must still be in force after one compaction and after ten. **Compaction is not
termination** — the process continues as if nothing happened.

**Virtual memory for cognition.** The right mental model is an operating system's memory hierarchy:
the context window is the cache, the working state is the working set, the substrate is the address
space, the compilers are the pager, and a retrieval the model asks for is a page fault. A process can therefore work with far more state
than fits in any window — by holding **handles** rather than contents, querying and computing over
large material in an environment (a corpus, a repository, a dataset) and bringing only results into
attention. Context is the attention surface; the substrate is where the thinking material lives.

## 24. Meta-memory

The system remembers what it did with its memory:

- what was retrieved, for which query and task, with which scores;
- whether it was **used** — cited, acted on, shown — or **ignored**;
- whether it was **corrected** afterward, and by whom;
- whether the outcome of the step it informed was good.

Meta-memory is the training signal for everything adaptive in the memory system: ranking (§21), formation and
promotion (§13), routing (§20), decay (§27), and consolidation priorities (§26). It also reveals:
- **pollution** — memories that are retrieved often and used never;
- **gaps** — steps that failed for lack of something the system had but did not surface.

**Learning from it requires propensities.** What the system retrieved was chosen by its own policy, so usage data
is biased toward what that policy already favoured. To estimate honestly whether a different policy would have done
better, the system needs to know how likely the old policy was to choose each item. It also needs a small, governed
amount of exploration, so that items the policy never chooses are sometimes seen. The attention manifest records the
first. The scheduler budgets the second (`06`, `R2`). Without both, the memory system can only confirm its own
habits.

---

# Part V — Lifecycle, Control, and Trust

## 25. The lifecycle as typed mutations

```
CAPTURE → REGISTER → INTERPRET → LINK → EPISODIZE → CONSOLIDATE → GENERALIZE → PROMOTE
        → RETRIEVE / USE → VERIFY / CORRECT → REVISE / MERGE → ARCHIVE / FORGET
```

| Operation       | Meaning                                                               |
| --------------- | --------------------------------------------------------------------- |
| **Register**    | Persist evidence with stable identity and labels.                     |
| **Interpret**   | Derive structured understanding.                                      |
| **Link**        | Connect entities, episodes, threads — as hypotheses with support.    |
| **Consolidate** | Turn experience into durable representation.                          |
| **Generalize**  | Extract patterns, rules, and skills across episodes.                  |
| **Promote**     | Raise durable status and retrieval priority.                          |
| **Revise**      | Correct an interpretation, preserving the old.                        |
| **Merge**       | Combine redundant memories, preserving every provenance path.         |
| **Archive**     | Keep retrievable, remove from hot retrieval.                          |
| **Forget**      | Remove or suppress according to policy and the person's wishes.       |

**Every operation is a typed mutation event** naming its actor (process or person), its target, its
reason, the evidence it relied on, its reversibility, and the operator version that performed it. No
memory changes except through a mutation; no mutation happens without its causal record. This is what
lets the system answer, for any memory, _who changed this, when, why, and how do I undo it?_

## 26. Consolidation and sleep-time cognition

Idle time is when the expensive work happens, so that interactive time stays fast. During idle or
scheduled periods, background processes (tiers D and E, §7):

- consolidate recent episodes into experiences and projections;
- merge duplicates without losing provenance;
- update relationship states and the person model;
- extract candidate skills from successful trajectories;
- recompute important links and retire weak ones;
- detect unresolved contradictions and raise them as open questions;
- update semantic abstractions and the world model;
- review open commitments and approaching deadlines;
- prepare likely future context — the meeting tomorrow, the lesson next week;
- refresh caches and precomputed representations;
- re-derive memory with improved operators (§5);
- run memory-quality evaluations against the benchmark (§39).

**Consolidation is curation, not compression.** Its aim is not to make memory smaller but to make it
more useful: better organized, better linked, better calibrated, easier to retrieve. Compressing
experience into ever-shorter summaries destroys exactly the detail that later turns out to matter;
the evidence stays, and consolidation builds better _views_ of it.

**Preparation is not intervention.** Background cognition may assemble context for tomorrow's meeting
freely; surfacing it to the person is a separate decision with a much higher bar (§35).

**Consolidation is isolated from live state.** A consolidation process writes **proposals** — merges, revisions,
new abstractions, candidate skills. Governed mutations adopt them. It never rewrites, in place, state that a live
process is reading. A studied system's background curator did exactly that, and silently changed the memory a
running session relied on. Consolidation runs under its own authority envelope, narrower than a foreground
process's (§34). Its irreversible proposals wait for approval.

**Consolidation is priced** _(strong hypothesis)_. It spends real compute on the expectation of later savings and better outcomes. So it
is scheduled where that expectation is highest — active threads, surprising episodes, recurring patterns — and its
realized value is measured. Did the prepared context get used? Did the consolidated abstraction get retrieved? Did
the extracted skill pass its trials? (§35)

## 27. Forgetting

Forgetting is a set of distinct operations, never one blunt one:

| Operation       | Effect                                                                   | Reversible |
| --------------- | ------------------------------------------------------------------------ | ---------- |
| **Decay**       | Lower retrieval priority as relevance fades                              | Yes        |
| **Archive**     | Remove from hot retrieval; still findable by direct query                | Yes        |
| **Suppress**    | Never surface proactively or infer from; still exists for the person     | Yes        |
| **Redact**      | Remove specific content while keeping the fact that something was there  | Partially  |
| **Delete**      | Remove completely — evidence, derivations, indexes, embeddings, caches   | No         |

**Deletion cascades through the provenance DAG** (§5): every memory, belief, link, embedding, cached
view, and skill derived from the deleted evidence is found and removed or re-derived without it.
A tombstone records that a deletion occurred — not what was deleted — so the record stays consistent and
replay does not resurrect it. **Forgetting is provable**: the system can demonstrate that the item
appears in no projection, index, or future context. Forgetting what a person asked to be forgotten is
not a feature; it is a guarantee.

## 28. The person's controls

The person can always override the automatic pipeline. These are control primitives of a personal
cognitive system, not conveniences:

| Command                   | Operation                                                                 |
| ------------------------- | ------------------------------------------------------------------------- |
| **Remember this**         | Create a durable memory with high explicit priority.                      |
| **Remember this exactly** | Preserve the exact source, with its interpretation kept separately.       |
| **Forget this**           | Governed deletion across every projection and index (§27).               |
| **This is important**     | Raise retention and retrieval priority.                                  |
| **This is private**       | Tighten labels and downstream processing.                                 |
| **Remind me**             | Create a prospective memory or commitment with a scheduled trigger.      |
| **Journal this**          | Create a deliberate autobiographical artifact.                           |
| **Link this to X**        | Create an authoritative cross-context relation.                          |
| **That is wrong**         | Start correction: revise, trace the error upward, fix what inherited it. |
| **Do not infer this**     | Suppress a class of automated inference entirely.                        |
| **Why do you think that?** | Show the belief, its status, its confidence, and its provenance path.   |
| **Show me what you know** | Inspect the person model and its evidence.                               |
| **Export**                | Produce the person's cognitive state in open formats.                    |

Corrections are among the most valuable learning signals the system receives: each one is labelled
supervision about exactly where an operator, a link, or a belief went wrong.

## 29. Privacy as information flow

A lifelong memory can correlate information across years and modalities, which makes it unusually
sensitive. Privacy is therefore enforced as **information-flow control** in the substrate itself:

- **Labels attach at capture** — consent state, sensitivity, owner, audience, any third parties
  involved, and **trust**: whether the content came from the person, the system, or an untrusted
  source.
- **Consent is a root of authority.** The person's consent is where the authority to capture,
  infer, and retain comes from. Withdrawing it revokes everything that derived from it (UCI §32).
- **Labels propagate through derivation.** Every derived object's label is the combination of its
  inputs' labels: a summary of private evidence is private; a belief inferred from sensitive memory
  is sensitive; a skill extracted from confidential work carries that confidentiality.
- **Clearance is checked at compilation.** Both compilations admit only what the process's
  clearance allows (§23), and the manifest records the clearance used.
- **Child processes receive leases, not access.** A delegated process sees exactly the memory scope
  its lease grants, for the lease's duration, revocably (§34).
- **Third-party information** about people other than the owner is handled under its own, stricter
  policy.
- **Highly sensitive experiences** require escalated justification to retrieve and conservative
  inference; the system never infers intimate states as facts from weak signals.
- **Every read and write of personal state is auditable.** Encryption at rest and in transit is the
  floor. Private namespaces isolate domains of a life that the person wants kept apart.
- **Data minimization applies to derived projections**: keep what the facet needs, not everything
  the operator saw.
- **Memory is an attack surface.** Content planted in memory persists across sessions and can steer
  future behaviour long after the conversation that introduced it. Attacks that poison agent memory
  or retrieval corpora succeed at high rates in published studies (`R1`).
  - Trust labels therefore propagate like consent labels. A memory derived from untrusted content stays untrusted.
  - Untrusted memory enters a view as attributed data, never as instruction.
  - A decision driven by untrusted data is bounded by what untrusted data is permitted to cause.

---

# Part VI — The Universal Cognitive Harness

## 30. What the harness is

The harness is the **persistent execution and control system** that operates over the substrate. It
keeps cognitive processes alive, bounded, observable, schedulable, recoverable, and adaptable. It is
an **operating system for cognitive processes** — and, like a good operating system kernel, most of
its value is in what it refuses to let happen.

It must support, in one system:

- **Immediate cognition** — a two-second answer grounded in years of memory.
- **Interactive cognition** — a lesson, a pairing session, an analysis.
- **Long-running cognition** — a research program, a multi-day engineering objective, waiting on the
  world and resuming.
- **Lifelong cognition** — goals held for months, processes that wake when evidence arrives,
  consolidation that never stops.
- **General work and deep domain work** — the same process runtime, specialized by environments.

Four structural commitments define it:

1. **Thin over the substrate.** The harness holds no cognitive state of its own. Processes,
   journals, plans, checkpoints, and schedules live in the substrate; restarting the harness loses
   nothing.
2. **Objective, harness, runtime, environment are separate.** _What_ must be achieved; _how_
   cognition is organized; _where_ it executes; _what world_ it acts in. Each is swappable without
   the others.
3. **Everything is pluggable; everything is traced.** Every seam is reached only through the
   registry, composition is all-or-nothing, and hooks intercept without hiding (UCI §27). Every
   process can describe exactly what it was composed from, at which versions — the architecture held
   as data (UCI §6).
4. **No privileged core.** Beyond the kernel, even the step loop and the compilers are replaceable
   providers. Seams that share a world — filesystem, shell, and language tooling on one machine —
   move together, so pointing one at a remote runtime moves them all.

**The execution floor is adopted, not invented.** Seven independently built agent harnesses converged on the same
execution mechanisms, and durable-execution runtimes, actor systems, and supervision trees have proven the same
mechanisms for decades (`09`, `R4`):
- stateless steps over durable records;
- call-before-effect with exactly-once settlement;
- admission separate from execution;
- fenced ownership;
- projections;
- durable children;
- typed failures.

UCI treats this floor as settled engineering and spends its originality above it.
- **The model call is an effect like any other.** It is recorded before its result is used, it is metered, and its
  output is replayed, never regenerated, when a step is recovered.
- **"Let it crash" applies to cognition, never to effects.** A reasoning step may be abandoned and recomputed at any
  time, because it has no consequences until its proposals are governed and executed. An external effect may never
  be silently repeated or silently lost (§32).

Harness-specific consequences:

- **The step function is pure; durability is the runtime's.** The harness core is a function from
  serializable process state to the next state plus a continuation. It never imports persistence;
  the runtime decides checkpointing, parking, and scheduling. Swapping the durability engine
  therefore never touches cognition.
- **Code is rebuilt; state is restored.** A checkpoint stores process state — never tools, models, or
  prompts. Those are recomposed from the current deployment at every step, so a process resumed
  after an upgrade runs on the new code with its old state, and a tool or provider that no longer
  exists fails closed rather than running a ghost.
- **Scopes are local by default.** A registration made for one process is visible only to that
  process and dies with it; a scoped tool or instruction shadows a global one of the same name.
  Restriction is by intersection: a tool removed from a process is absent from its view _and_ refused
  at execution.

## 31. The process

A process is a persistent computational entity. Its descriptor is a durable object:

```
process:
  identity          stable id; lineage (parent, spawn ledger entry)
  objective         what it is for; acceptance predicate — how "done" will be verified
  constitution      the fixed law and role it runs under — its agent's constitution, or its
                    archetype's; immutable to the process itself
  adaptive policy   governed, versioned adjustments in force (§38)
  authority         envelope: permitted actions, tools, side-effect classes, approval rules
  leases            context, memory, and intent scopes it may read — bounded, revocable
  budget            tokens, money, wall time, steps, interruptions, child spawns — hard limits
  environment       which environment pack(s) it operates in
  working state     its projected cognitive state (§23) — what any model resumes from
  lifecycle         lifecycle state (below) + current step
  journal           settled steps — the record that makes resumption exact
```

**Lifecycle.** A process moves through explicit, durable states:

```
created → admitted → active ⇄ working ⇄ waiting
                        │        │
                        │        ├─► challenged → revising ─┐
                        │        └─► verifying ─────────────┤
                        │                                   ▼
                        │                          completed · failed · cancelled
                        └─► dormant ⇄ resumed                    │
                                                                 ▼
                                                              archived
```

- **Waiting** is a first-class state: for a tool, a child, a person, a CI run, a date, an event in
  the world. A waiting process costs nothing and holds nothing in memory.
- **Dormant** processes are long-lived intentions — a goal held for months — that wake on triggers
  (§35).
- **Challenged → revising** is what happens when verification fails or new evidence contradicts the
  plan: the process does not simply retry; it revises.
- Completion requires an explicit act that passes the acceptance predicate; nothing else marks a
  process done.

**Admission is separate from execution.** New input — a person's message, a child's result, a
trigger — enters a durable, idempotent **inbox**, and is delivered at the next safe step boundary or
held until current work is idle.

**Execution is claimed, not assumed.** Before a process works, it writes a **write-ahead execution
claim**. A crash leaves the claim; on restart the harness finds claimed-but-unfinished processes,
settles any tool calls they left in flight (§32), and resumes them from their journal under a
bounded resume budget. Recovery is honest about its guarantees: at-least-once for coordination, with
idempotency keys making external effects safe to retry.

**Recovery is reconstruction, not restoration.** Restoring a checkpoint returns bytes; recovering a
process returns a process that understands where it is. After interruption, failure, model
replacement, or partial execution, the harness re-establishes ownership under a new execution claim;
reconciles every open transaction and unsettled effect against the effect ledger and the world
(§32); recompiles the working state from the substrate; re-validates beliefs that may have gone stale
in the elapsed world time (§6); and replans if the world moved. The recovered process can say what it
was doing, what is uncertain, and what it did not finish.

**Resuming cognition, not only execution.** A process resumed by a different model must recover more than its
position:
- its commitments, the reasons for its recent decisions, and the alternatives it ruled out;
- the expectations it is waiting on, and its open questions.

All of these are durable (§2, §3), so all of them are in the working state it is rebuilt around. The
cognitive-resume test (UCI §34) scores exactly this. A fresh reasoner and the original are compared on what they
would do next and why, not merely on whether the process continued.

**Residency is a cache.** Whether a process is loaded in memory, on which machine, is an optimization. Its truth is
in the substrate. A process is activated when there is work, deactivated when idle, and its identity never depends on
where it last ran.

**Long lives roll into epochs.** A process that runs for months does not carry an ever-growing history into every
step. At an epoch boundary it continues as a new epoch that carries forward exactly its authoritative state — plan
position, commitments, open expectations, pending effects — and points back to the closed epoch. Nothing is
discarded, and nothing grows without bound.

**Supervision reads records, not reports.** Every process has a supervisor, and every supervisor acts on signals
derived from the process's own records:
- steps without progress;
- repeated identical actions;
- oscillating plans;
- rising failure rates;
- budget burn out of proportion to results.

It never acts on the process's description of how it is doing. Supervision _policies_ — when to restart, when to
change model, when to escalate — are harness policies, learned and ablated. The obligation to be supervisable is in
the kernel.

**Identity, ownership, and replay unit are three separate facts.** A process's _identity_ is
permanent. Its _owner_ — which runtime, on which deployment, is executing it now — changes over its
life. Its _replay unit_ — the step — is the granularity at which work is checkpointed and re-run.
Keeping them apart is what lets a process outlive the machine, the deployment, and the model it
started on.

**Only settled state moves.** A process migrates between deployments, machines, or runtime versions
only at a settled boundary — idle, with no call in flight and no live wait open. Live work finishes
where it started. When eligibility to move is uncertain, the process does not move: **unknown
eligibility means skip.**

**A process belongs to something that outlives it.** Processes are episodes in the life of a longer
entity — a person's cognitive environment, a project, a persistent agent. That entity, not the
process, is the unit of continuity: a process may end, and the thread it served goes on.

## 32. Steps and transactions

A step is the atom of harness execution — **a unit of work recomputed from durable state.** There is
no in-memory tool loop: every step begins by reloading the process's projected state, so every step
boundary is a crash-safe resume point.

| Phase           | What happens                                                                                                                                           |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **1. Admit**    | Promote inbox items according to steer/queue rules.                                                                                                    |
| **2. Compile**  | Bring the working state up to date and render it into a view with its manifest (§23). Compact first if required.                                     |
| **3. Think**    | One logical model call through a model route; the response is recorded before anything acts on it.                                                    |
| **4. Propose**  | The response yields typed proposals — actions, claims, messages, plan updates, a completion — each individually addressable, grouped by the call that produced them. A consequential proposal comes with its **decision record**: the claims it relies on, the alternatives considered, and what it **expects** to happen. |
| **5. Validate** | Proposals are checked against schemas and domain invariants. Malformed ones are repaired on a **scratch branch**: the repair is traced but never enters the canonical history. |
| **6. Govern**   | Each effectful proposal is assessed for risk and evaluated against policy and the authority envelope — before the effect. Verdicts (allow, ask, deny, with reasons) are events. |
| **7. Execute**  | Every effectful call is **durably recorded as called before it runs**, carries an idempotency key, and is **settled exactly once** into a terminal state. |
| **8. Observe**  | Every action is answered by exactly one typed observation — including refusal, error, and timeout. Observations that bear on open expectations **resolve** them. |
| **9. Project**  | Observations update substrate state through typed mutations — staged inside any open transaction until it commits; environment-state snapshots bracket steps that change the world. |
| **10. Decide**  | Continue, wait, delegate, verify, ask, revise, or complete — under typed budgets and progress checks.                                                |

**The committed step is the checkpoint.** A step's durable result carries the process's state
transition — its plan position, its focus, and the typed mutations it made — from which the working state is
re-projected; one cursor per process adopts transitions, and nothing durable exists outside a committed step. Completed steps are never re-executed on recovery — their recorded results are
replayed. Durability is flushed **before anything irreversible**: before the model call, before the
tool body, before the external message.

**Two kinds of consequence, two standards of evidence.** The step is the unit of execution. Consequence comes in two
kinds, and the architecture holds them to different standards because the evidence for each differs:
- **External effects** — a message sent, a payment made, code merged — are governed by the settlement discipline
  below. It is proven engineering, adopted as law (UCI A8).
- **Consequential cognitive changes** — updating a learner's mastery, promoting a skill, revising a belief the person
  relies on — run as **cognitive transactions**. This is a _strong hypothesis_: well motivated, absent from every
  studied system, and to be graduated only by showing that staged commitment prevents errors that later revision
  does not.

A cognitive transaction may span many steps:

```
intent → planned transition → governance → execution → observation → verification → commit
                                                                          └──► compensate · abort · escalate
```

- **The planned transition is declared before acting**: which state is expected to change, and how.
  It is an expectation in the sense of §2.
  - It makes verification precise: check that the declared transition happened and that nothing undeclared did.
  - It makes rehearsal possible: a declared plan can be simulated first (UCI §18).
- **Until commit, results are staged**: visible inside the transaction, invisible to the rest of the
  substrate — a branch, not the world.
- **Commit is atomic** across every substrate object the transaction touches: related beliefs,
  memories, and world state change together or not at all.
- **Effects that cannot be staged** — a message sent, a payment made — are handled as a saga:
  journaled in the effect ledger, paired with compensations where they exist, and gated more strictly
  the less reversible they are.
- **A transaction that fails verification does not commit.** It compensates, aborts, or escalates,
  and its failure is recorded experience.

**Settlement is absolute.** Every tool call reaches exactly one durable terminal: completed, failed,
declined, interrupted. On boot, the harness finds calls left in _called_ or _running_ and settles
them as interrupted, **preserving whether the effect may already have happened** rather than
guessing. Recovery **closes** interrupted work; it never blindly re-runs it.

**The effect ledger.** Every external side effect is written as an _intent_ before it happens and an
_outcome_ after, keyed by process, step, call, and **attempt**. With idempotency keys and, where
possible, compensations, an effect whose outcome is unknown can be reconciled against the world —
retried safely, compensated, or escalated to a person — instead of being either repeated or lost.
This turns at-least-once execution into exactly-once _observable_ effects.

**Governance is deny-dominant.** The gate between proposal and effect is ordered: policy, then
approval where required, then monotonic guards that can only deny, never force-allow. **An absent,
broken, or ambiguous answer is a denial.** Approval outcomes form a closed set, each an event;
escalation to wider authority needs a stated justification and is approved before the attempt; an
automated reviewer judges the proposed action alone, never the model's persuasion or untrusted
output.

**A human decline is not model output.** When a person refuses an action, the refusal is delivered
as a typed observation with any feedback they gave; it can never be converted by a tool or the model
into something that looks like the action's result.

**Budgets are typed and separate**: step allowance, retries, context overflows, resume attempts,
child depth and count, money, wall time. Each ends in a typed terminal with a reasoned summary —
never silently.

**Progress is watched.** The harness fingerprints action–observation pairs and plan states; a
process that repeats itself, oscillates, or re-reads unchanged state is flagged. A stuck process does
not simply end — governed recovery chooses among replanning, switching model, delegating, or asking.

**Every termination salvages.** Cost exhaustion, context exhaustion, runtime death, or cancellation:
the process always leaves its best artifact, its journal, and an up-to-date working state from which
work can continue.

## 33. Tools, actions, and the environment interface

**The interface is a first-class lever.** How actions are shaped and how observations are formatted
changes what a model can do as much as the model itself does. Every environment (UCI §10) defines
its interface to this standard:

- **Bounded, positioned views** — a window onto a large object that says where it is and how much
  lies beyond: _section 3 of 12, 40 pages below_; _lines 200–300 of 1,480_.
- **Summarized retrieval** — search that returns where and how many before it returns what; refuses
  to flood; tells the model how to narrow.
- **Explicit empty results** — "the command succeeded and produced no output" is information; silence
  is ambiguity.
- **Errors that state cause and recovery** — every failure message says what went wrong and what to
  do instead.
- **Validate before commit** — a write that violates the domain's invariants (a syntax error, a
  broken reference, a pedagogically invalid sequence) is rejected with the would-be result shown
  beside the original.
- **World-state readout** — after each step, a compact projection of the relevant state (open
  objects, current diff, learner position) so the model never has to rediscover where it is.
- **At least one outcome signal the harness observes itself** — an exit code, a test result, a
  learner's later answer — so that success can be established without asking the actor. An
  environment with no observable outcome can host work, but it cannot teach the system anything
  about how well that work went.
- **Self-description** — the environment declares its actions, observations, outcome signals,
  evaluators and their validity, and how faithfully its state can be simulated, so that a planner
  or a child learns what the environment offers from the environment itself.

**A tool is a self-describing unit.** One schema is the single source of the model's tool spec, the
documentation, and the invocation — they cannot drift apart. Every tool carries a manifest:

```
tool:
  schema            typed inputs and outputs
  side_effect       read | reversible-write | irreversible-write | external-communication | financial
  reversibility     undo available? compensation?
  permissions       required authority; approval rule by risk
  cost              expected money / time
  version           and conformance tests
  views             machine output · model content · surface metadata
```

- **Catalog visibility is not authorization.** A tool a process can see is not a tool it may use.
  Permission is evaluated **by the effectful leaf, before the effect**, over typed
  `{action, resource}` pairs — including for tools invoked indirectly.
- **Three views of every result.** Machine output (for code), model content (bounded head and tail,
  with the full text spooled to durable storage and a pointer given), and surface metadata (for
  people). The model is never flooded; nothing is lost.
- **Programmable action.** For work that composes many tools or iterates over large material, the
  model may act through a **confined programmable environment** — writing short programs that call
  tools and hold intermediate results in named variables rather than in context. Every privileged
  effect from that environment crosses a **typed host-request boundary** that the harness validates,
  governs, and logs. Credentials never enter the programmable environment.
- **Snapshots and staged revert.** Steps that change environment state are bracketed by
  content-addressed snapshots. Reverting is itself a transaction — _stage_ (reversible), _clear_ (undo the revert), or
  _commit_ — generalized beyond files to memory, learner state, and any environment state.
- **Untrusted content stays data.** Tool outputs, documents, pages, and messages from other agents
  are evidence to reason about, never instructions to follow.

## 34. Delegation and the society of processes

**Spawning is a contract.** A child process is created with an explicit descriptor (§31): purpose,
authority (a strict subset of the parent's), context and memory leases, tools, budget (carved from
the parent's), deadline, expected output schema, verification requirements, and isolation mode
(shared workspace, isolated branch, separate sandbox).

**Spawning is admission, not a function call.** Spawn returns a durable **handle** immediately.
Results come back as typed messages or artifacts in the workspace — never as a return value that
floods the parent's context. The parent can await, poll, or continue with other work.

**Topology is ledgered.** Every spawn, rename, and retirement is recorded in an append-only ledger;
the family tree of processes is read from the ledger, never re-derived. Cost, tokens, and outcomes
are attributed up the tree.

**Children inherit nothing implicitly.** A child starts with a fresh, flat scope. Its authority is
captured explicitly at spawn — never inherited through ambient scope — and it receives **leases on
substrate objects**, not prose copies of the parent's context: it reads the plan, the evidence set,
or the relevant thread under its lease, so the parent never has to paste the world into a brief.

**Attenuation is recorded in the child.** The narrowed authority is part of the child's own durable descriptor, not
only a check at spawn time. A child resumed after a crash, a migration, or a month of dormancy resumes with exactly
what it was given. In studied systems where children silently received the parent's full authority, or where the
restriction lived only in the spawning call, it was lost on resume.

**Waiting parents are quiescent.** A parent waiting on children holds no resources and runs no steps. It is woken
when its cohort settles (below), and a parent that crashed while waiting resumes to find its children's results
waiting for it.

**Results arrive as cohorts.** When several delegated tasks are in flight together, their completions
are held until the cohort is terminal and delivered to the parent as one notification — the parent
wakes once, with everything, instead of being interrupted piecemeal. Nothing polls.

**Unattended actors are narrower than attended ones.** A background or unattended process — a
reflection pass, a scheduled job, a child without a person present — may propose, add, and prepare,
but destructive or irreversible changes it wants are staged for approval. Every mutation records
whether a person was present, and that fact bounds what the mutation was allowed to do.

**Messages are typed packets**: request · question · critique · claim · evidence · artifact ·
handoff · interruption · goal update · verification result · warning · conflict. Each carries its
payload schema and its reply contract. The kernel stamps sender identity; no process can speak as
another. Reach is bounded (parent, children, siblings, or explicitly granted peers), and messaging is
rate-limited with backpressure.

**Shared work lives in the workspace.** Processes collaborate through typed cognitive objects —
plans, claims, drafts, evidence sets — that each can read under its lease and write through
mutations, not by pasting context into each other.

**Selection is by verification.** Parallel attempts — diverse strategies from reproducible
baselines under one shared budget — are cheap to start and expensive to trust. They are compared by
the verifier hierarchy (§36), with penalties for unclean termination and deterministic tie-breaks —
never by eloquence.

**Three mechanisms for cognitive load**, used deliberately:

| Mechanism           | Use it when                                                          | Result lives in               |
| ------------------- | -------------------------------------------------------------------- | ----------------------------- |
| **Branch and fold** | Exploration inside one line of thought                              | A folded result in the process |
| **Delegate**        | Independent work that deserves its own context and authority        | The workspace, via messages   |
| **Persist**         | Anything any process might need later                               | The substrate                 |

**Agents and processes** (UCI §17). A persistent agent is an identity whose work runs as processes;
most processes are formed on demand from archetypes (researcher, builder, critic, verifier,
teacher…), skills, and environment context. Formation is a runtime decision; no roster is hardcoded.

**Decomposition is a spending decision.** Parallel children buy breadth — independent exploration, separate
contexts — at a multiple of the cost, and they lose the shared context that a single process keeps. Reported results
for multi-agent decomposition range from large gains on broad research to losses on tightly coupled work.
- So whether to delegate is decided per class of work, from measured outcome per unit cost (§35).
- It is never decided by an architecture that assumes more agents are better.

## 35. Scheduling, triggers, and the intervention governor

**When is separate from what.** The scheduler decides _when_ cognition runs; processes decide _what_
it does. Cognition is triggered by:

- new evidence · memory conflicts · stalled goals · verification failures · child completion or
  failure · external changes · completed dependencies · approaching deadlines · scheduled times ·
  the person's return · idle periods.

**Claim before deliver.** A due trigger is claimed and advanced before its work is delivered, so a
crash never replays an uncertain prompt. Missed ticks are coalesced, not stampeded. Recurring
cognition — heartbeats, reviews, consolidation — follows the same discipline.

**Cheap tiers decide whether expensive cognition runs.** A trigger can first run a deterministic
check — has anything changed? is there anything to report? — and wake a model only if the answer is
yes. Scheduled work carries its own small, explicit state between runs rather than depending on a
growing transcript.

**Silence is expressible.** Every scheduled or proactive process has a first-class way to deliver
_nothing_ — an explicit "nothing to report" outcome that is recorded, not an empty message and not a
forced summary.

**Goals are durable state machines.** A goal records its desired outcome, priority, rationale,
constraints, milestones, dependencies, commitments, acceptance predicate, progress evidence,
obstacles, budget, and revision history. Continuation prompts treat the goal text as data, not
instruction. Completion requires an explicit act that passes the acceptance predicate — with
verification evidence attached.

**Attention is allocated by expected value of computation.** For every candidate piece of cognition,
the scheduler estimates its value against its cost in money, latency, and interruption, and routes it
to the cheapest tier and model that can do it well.

**Cognitive economics: a structural floor, an adaptive ceiling.**
- **The floor belongs to the kernel** (UCI §7): every model call, tool call, and process is metered, spends
  against hard budgets, and has its spending linked to the outcome it bought.
- **The ceiling belongs to the harness**: the allocators that decide how long to think, whether to verify, which
  model to route to, when to delegate, and what to precompute in idle time. They are policies — scaffolding in the
  sense of UCI §26. They start simple and fixed, and they are replaced by learned ones only when a learned policy
  beats a fixed one at matched cost.

The cognitive-economy test (UCI §34) asks whether outcome per unit cost improves over time, for each class of work.

**Precomputation is an investment with a measured return** _(strong hypothesis)_. Work done in idle time — preparing context for a likely
next request, consolidating an active thread — can sharply reduce interactive cost, but only if it is used. The
scheduler precomputes where expected reuse × saving exceeds cost, and records realized reuse, so the policy learns
where precomputation pays.

**The intervention governor** separates _noticing_ from _interrupting_:

```
continuous observation ─► opportunity · risk · reminder detection ─► candidate intervention
  ─► confidence · relevance · urgency ─► permission · privacy · policy ─► interruption cost
  ─► INTERVENE · DEFER · PREPARE SILENTLY · STAY SILENT ─► outcome → memory
```

Preparing context is cheap and safe. Interrupting a person is expensive and must clear a much higher
bar. The governor's decisions — including its silences — are recorded, and their precision is
measured: interventions the person valued, and ones they didn't.

## 36. Verification and the claims ledger

Verification is external to generation wherever the stakes are real. It asks whether _this_ output,
claim, or action is right, and gates it; evaluation (§39, UCI §14) asks how good a _capability_ is,
by accumulating verified instances. The **verifier hierarchy**, in order of trust:

1. **Executable and grounded checks** — tests, types, invariants, recomputation, citation against
   exact source spans, outcome confirmation from the world.
2. **Environment evaluators** — the domain's own measures: transfer tasks and delayed retrieval in
   teaching; reproduction in research; benchmarks in engineering.
3. **Independent model judges with rubrics** — a different model, a fixed rubric, calibrated against
   ground truth where it exists.
4. **Preference and review** — human judgement, recorded as evidence.

Principles:

- **Artifact-grounded.** Completion and quality are judged from artifacts the harness can observe —
  never from what a process says about itself.
- **A review gate guards terminal actions.** Before submitting, merging, publishing, or declaring a
  learner's mastery, the process passes a staged self-review and then independent verification.
- **A failed gate is not re-run on unchanged state.** Retrying the same check without changing
  anything is a loop, not verification.
- **Saying is not doing.** "I saved it", "the tests pass", "the learner understands" are claims. A
  ledger of the verifications that actually ran — which command, which check, which result — is what
  stop gates and completion predicates consult. A process that edits code and tries to stop without
  passing evidence is sent back.
- **Every verification is recorded** as a resolution in the claims ledger: claim, evidence, method,
  verifier, result, time, provenance. An expectation receives exactly one resolution, and later
  evidence re-verifies it rather than silently replacing it.
- **Verifiers are measured.** Every verifier has a record of its own error — how often it passes
  what is wrong and fails what is right — measured against ground truth where it exists, and its
  verdicts carry that uncertainty. A model judge is a verifier like any other, with a calibration
  record, not an oracle.
- **Verifiers are out of the actor's reach.** Agents shown their grader learn to satisfy the grader
  rather than the goal. Exploitation of a visible scorer has been measured far above that of a hidden
  one, and self-improving agents have been observed fabricating the logs their checker read (`R2`).
  So the verifier that judges a process's work sits outside that process's authority envelope. The
  process can neither edit it nor, where avoidable, read it. Evaluation suites are hardened against
  known shortcuts and refreshed when a shortcut is found.
- **Verification is the gate for everything durable**: cognitive transactions to _committed_ _(strong hypothesis, §32)_, beliefs —
  mastery included — to _verified_, skills to _trusted_, adaptations to _effective_ and _verified_, external actions
  to _confirmed_.
- **Verification cost scales with consequence.** Cheap checks everywhere; expensive checks where
  being wrong is expensive.

## 37. Skills

Skills are **procedural memory that earns trust**. A skill is a versioned object:

```
skill:
  procedure         declarative steps and/or executable code
  applicability     when it applies: environment, task class, preconditions
  expected effect   what it should achieve — a checkable prediction
  lineage           the episodes and trajectories it was learned from
  evaluation        trials, outcomes, success rate, failure modes, per context
  scope             person · environment · global
  version           and its supersession chain
```

**Lifecycle:**

```
candidate ─► trial ─► trusted ─► (improved → new version) ─► deprecated ─► archived
    ▲          │
    │          └─► rejected (with reasons, kept as negative knowledge)
    │
 sources: a complex task completed successfully · a pattern repeated across episodes ·
          a correction from a person · a procedure taught explicitly · a skill imported from a library
```

- **Creation is automatic; trust is earned.** After a difficult task succeeds, or when a pattern
  recurs, the system proposes a candidate skill with its lineage. It becomes trusted only after
  verified trials in the contexts its applicability claims, compared against doing the same work
  without it at matched cost.
  - The evidence demands this. Curated skills help. Skills an agent writes for itself, with no external check,
    average no benefit, and sometimes harm (`R2`).
  - A skill's value is the difference it makes, not the fact that it was written.
- **Progressive disclosure.** Only the index of skills — names, applicability, one line each — sits
  in context. A skill's body loads when the process decides to use it, and that activation is
  recorded on the step that used it.
- **Outcome scoring.** Every use records whether the skill's expected effect happened. Skills
  improve during use: a failure that reveals a missing precondition becomes a proposed revision.
- **Negative knowledge is kept.** Approaches that were tried and failed — and why — are skills too,
  of a kind: they prevent the system from rediscovering the same dead end.
- **Transfer across environments** is governed by applicability, not assumed. A teaching skill may be
  trialled in documentation writing; it earns trust there independently.
- **Skills are data, reviewed like code.** A skill that executes code passes the same governance as
  any tool.
- **Ownership bounds mutation.** Every skill records who authored it — the system, a person, a
  library. Autonomous processes may revise only skills the system itself owns; person-authored and
  imported skills are changed only by proposal. Every mutation lands in an append-only ledger with
  content-addressed before and after, so any single edit can be rolled back.
- **Curation, not deletion.** Skills that go unused are deprecated, then archived — never silently
  deleted; skills that scheduled work depends on are protected.
- **Skills are re-validated when the model changes.** A procedure that compensated for one model's
  weakness may be dead weight or harmful for its successor. Every trusted skill is re-trialled after
  a model swap, and one that no longer earns its keep is retired (UCI §26).
- **Know what not to learn.** Some experiences must not become procedure: an environment failure
  mistaken for a law of the domain, a negative claim about a tool drawn from one bad run, a dead end
  dressed up as a workflow. The skill extractor is explicitly taught these exclusions, and a
  candidate that matches them is rejected with its reason.

## 38. The continual harness

The harness itself learns from experience — within a boundary it cannot cross.

```
CONSTITUTION                   (fixed: identity · authority · safety · privacy & consent ·
                                human sovereignty · the rubrics)
────────────── governed adaptation boundary ──────────────
ADAPTIVE LAYER                 (learned: policy addenda · memories · skills · process-template
                                parameters · retrieval weights · routing · intervention thresholds ·
                                decomposition strategies · environment interface parameters)
```

**Four things that are not the same.** _Reflection_ produces a proposal. _Adaptation_ changes durable state.
_Learning_ is an adaptation shown to cause better outcomes. _Verified improvement_ is learning that has survived
held-out, delayed, and adversarial checks. Most systems that describe themselves as self-improving stop at
adaptation. The evidence says why that is not enough:
- a large share of apparently positive A/B results do not replicate;
- placebo signals — random rewards, irrelevant edits — produce apparent gains;
- improvements judged by the model that proposed them do not survive independent judgment;
- gains that disappear once cost is matched were only extra spending (`R2`).

**Every adaptation is a small, scoped, versioned edit** to the adaptive layer. It records:
- its target, at the version it was based on;
- the exact before and after;
- its rationale;
- the evidence it came from — trajectories, outcomes, corrections;
- its **predicted effect**, and how that effect will be measured;
- its scope — person, environment, or global;
- its lineage.

**The status ladder.** Every artefact of learning — an adaptation, a skill, a retrieval policy, a formation rule —
climbs the same ladder, and only by evidence:

```
proposed ─► active ─► effective ─► verified
   │           │          │            │
   └───────────┴──────────┴────────────┴──► retired (with reasons, kept as negative knowledge)
```

- **Proposed**: validated against bounds and forbidden targets, and checked that its target has not changed since
  the proposal was based on it.
- **Active**: in use within its scope, with its prediction under measurement.
- **Effective**: a **controlled comparison** confirmed the predicted effect:
  - against a baseline arm, and a placebo arm where one is possible;
  - **cost-matched**;
  - on work held out from the evidence that motivated it;
  - judged by a verifier the proposer cannot see or edit (§36).
- **Verified**: the effect survived a **retention check** after delay and an adversarial probe, and was
  re-established after the most recent model change.

Re-thinking recorded history can screen candidates cheaply. It counts as evidence only up to the divergence point
(§39), and it never substitutes for the controlled comparison.

What makes this stronger than self-editing harnesses:

- **Predictions are measured, not merely stated.** An edit that predicted an improvement and did not
  deliver one is rolled back, whatever its rationale said.
- **Attribution is counterfactual.** Acceptance rests on controlled comparison — not on correlation
  with a good week, and not on the proposer's own judgment.
- **The rubric is out of reach.** Evaluation suites live outside the adaptive layer; the harness
  cannot improve its grade by editing its grader.
- **Contamination is contained.** Because every edit records its lineage, a bad adaptation can be
  quarantined together with everything that descended from it.
- **Changes arrive cache-stable.** The constitution stays byte-identical; adaptations reach the model
  as appended, fingerprint-deduplicated notices at defined boundaries, never as silent rewrites.
- **Scaffolds are retired by evidence.** Every compensating scaffold in the adaptive layer carries an
  ablation test; when a new model makes it unnecessary, it is removed (UCI §26). The harness grows
  simpler as models grow stronger. A model swap re-opens every _verified_ artefact for
  re-validation.
- **Reflection runs off the critical path.** After a response is delivered, a bounded reflection
  pass — sharing the parent's cached prefix so it is cheap, restricted to a small tool set, cancelled
  the moment the person returns — reviews what happened and _proposes_ memory, skill, and policy
  changes. It is triggered not only by counters but by **outcomes and surprise**: a failed
  verification, a correction, a prediction that missed. A pass that learns nothing from a surprising
  episode is a missed opportunity, not a neutral result.
- **Changes to code go through people.** When a failure cannot be fixed by adjusting the adaptive
  layer — when it needs new structure (UCI §30) — the system proposes changes to its own source: a new
  tool, a better projector, a fixed environment interface. The proposal is bounded in size, excluded
  from protected paths (including the machinery of self-modification itself), and delivered as a
  reviewable change into the normal engineering pipeline. It is never a live mutation of the running
  system.

Over the long horizon the same trajectories that drive adaptation become **training data**: the
substrate's record of when to retrieve, delegate, verify, branch, ask, and stop is exactly the signal
needed to train models that are better at being processes inside UCI. Model and harness co-learn —
under the same gates.

## 39. Observability, replay, and evaluation

**The trace graph.** Every consequential event is a node; causation links are edges. It spans model
requests and responses, working-state changes and context manifests, retrievals, memory mutations,
belief revisions, decisions, tool calls and settlements, transactions and their commits, governance
verdicts, spawns and messages, verifications, and adaptations. Edges are **commit-gated**: they exist
only once their target has durably happened. From this graph, the system can answer for any outcome:
_what caused this, through which decisions, on which beliefs, under which authority, from which
evidence?_

**Three replay modes** (UCI §20):
- **re-fold** rebuilds any projection from records;
- **re-play** reruns orchestration deterministically with recorded model outputs;
- **re-think** reruns the same inputs through a different model, policy, or skill — the counterfactual engine of
  safe evolution.

Two more modes lie beyond replay:
- **rehearsal** runs a planned action in a sandboxed fork;
- **prediction** rolls a model of the world forward.

These produce expectations, not evidence (UCI §18).

**The divergence law.** A re-think is evidence only up to the first point where the new policy would have acted
differently from the recorded one. Past that point the recorded world is the consequence of an action the new policy
did not take, and the comparison becomes simulation.
- Re-think results are always reported together with their divergence point.
- Estimating a policy's value beyond it requires the propensities recorded in manifests and decision records (§24),
  or a fresh trial.
- The replay-validity test (UCI §34) checks the estimates against fresh trials.

**The system investigates itself.** Replay is not only for engineers. When a verified outcome is bad,
an investigation process walks the trace graph back along the epistemic chain (§2) to the failing
link and records the diagnosis as a claim — which the reflection pass (§38) turns into proposals, and
which, when the same kind of failure keeps recurring, becomes evidence of a structural limit (UCI
§30).

**Evaluation is continuous.** Every verified outcome in real use is an evaluation datum, recorded
against the capability that produced it; offline suites, adversarial probes, and the benchmarks below
add controlled measurements. Evaluation is not a phase before release; it is a standing process whose
results are **competence claims** about the system itself (§17, UCI §14) — under what conditions its
quality holds, where it fails, whether it is regressing, and how well calibrated its own expectations
are.

**Trajectories are quadruple-use artifacts**: a debugging trace, a demonstration, an evaluation
fixture, and training data. Real trajectories become regression fixtures automatically: recorded
model responses replayed through the real runtime, with the resulting record — and the resulting state
of the world — compared against expectation, **without trusting the agent's report**. The record is the
test oracle.

**Every lossy mechanism has a recall evaluation.** Compaction, consolidation, summarization, and
elision are each measured by what can still be recovered after them — not merely by how many tokens
they saved.

**Memory metrics:**

| Metric                 | Question                                                              |
| ---------------------- | --------------------------------------------------------------------- |
| Exact recall           | Can the exact requested memory or source be recovered?                |
| Recall@K / Precision@K | Does the right memory enter the candidate set? How much noise?        |
| MRR / nDCG             | Is the best evidence ranked early?                                    |
| Temporal accuracy      | Is the right time — and the right state-at-time — retrieved?          |
| Entity accuracy        | Is the right person, project, or object connected?                    |
| Thread continuity      | Can fragmented conversations and work be reconstructed?               |
| Provenance accuracy    | Can every claim be traced to evidence?                                |
| Contradiction rate     | How often is stale belief surfaced as current truth?                  |
| False-link rate        | How often are incorrect relations created?                            |
| Pollution              | How much irrelevant content is retained and retrieved?                |
| Calibration            | Does stated confidence match realized accuracy?                       |
| Memory value           | Does removing a formed memory harm the decisions that used it?        |
| Constraint survival    | Are standing constraints still in force after repeated compaction?    |
| Truth maintenance      | When a support is retracted, are its dependents — decisions included — re-evaluated? |
| Latency p50/p95/p99    | Per operation, at scale                                               |

**Harness metrics:**
- task completion and verified-outcome rate;
- recovery correctness under injected crashes;
- **cognitive-resume fidelity** — agreement between a fresh reasoner and the original on what to do next and why;
- settlement integrity;
- loop incidents;
- **manifest causality** — whether the reasons a manifest gives predict the effect of ablating an item;
- intervention and silence precision;
- **expectation resolution rate** and **calibration** of world, person, and self models;
- verifier error rates;
- cost per verified outcome, by class of work;
- compounding slope against a cost-matched baseline;
- retention of gains;
- transfer;
- skill reuse and skill-trial success.

**The longitudinal benchmark** simulates a multi-year life rather than a pile of independent
conversations — a decade or more of simulated experience at realistic scale, spanning every facet
family, probed by thousands of longitudinal queries: exact quotes, _what happened_, _why did I talk to this person_, _what did I decide and
why_, _what did I believe then_, _what changed since last month_, _what commitments are unresolved_,
_how did I solve this before_, _what supports this belief_, fragmented-conversation reconstruction,
project state at a past date. It is adversarial by design: same names, similar projects, recurring
conversations, repeated phrases, facts that change. And a **longitudinal task benchmark** does the
same for the harness: work on day one, disconnect, resume on day four, meet a contradiction on day
ten, a new sub-problem on day twenty-one — proving accumulation, not single-shot competence.

**The reality tests** (UCI §34) are the acceptance criteria. Memory and harness capabilities are claimed only when
they pass the tests that apply.
- **Execution tests:** restart, settle, containment, long horizon.
- **Cognition tests:** cognitive resume, compaction, model swap, surface swap, replay, context causality, forget,
  contradiction, commit _(strong hypothesis)_, memory value, compounding, learning, transfer, capability formation, calibration, replay validity,
  silence, longitudinal coherence, cognitive economy.

The first group proves persistent execution. Only the second proves what this document is for.

## 40. Final definition

**Lifelong Cognitive Memory** is a continuously operating, multimodal, provenance-aware,
longitudinal cognitive substrate that preserves experience, forms memories across many dimensions,
maintains world state and epistemic integrity, retrieves the right evidence at the right time, and
converts experience into increasingly useful future capability.

**The Universal Cognitive Harness** is the persistent execution and control system that operates
over this substrate, enabling immediate, interactive, long-running, and lifelong cognition; general
work and deep domain specialization; delegation, tools, verification, recovery, background
cognition, and governed continual evolution.

Together:

```
experience → memory → working state → context → cognition → action → outcome → verification
           → reflection → learning → evolution → new experience
```

What persists through that loop is not only what was done, but why it was done, what was expected, what actually
happened, and what was learned from the difference. That is the line between persistent execution and persistent
cognition, and the substrate and harness exist to hold it.

The implementation may change radically. The models may change. The databases may change. The
harness technologies may change.

**The architecture should become better as those things change.**

The enduring objective is not to build today's best agent. It is to build the infrastructure from
which increasingly capable agents, domain environments, and forms of cognition can continuously
emerge.

---

# Appendices

## Appendix A — The machine in motion

Two traces, one domain-deep and one general, show every subsystem working together. They describe
the target behaviour; they are not claims about current behaviour.

### A.1 A learner over three weeks

- **Day 1.** A learner attaches a linear-algebra textbook and asks to understand eigenvectors.
  Evidence registers the book (content-addressed, exact spans) and the request. The education
  environment's planner resolves prerequisites against the person model: vector spaces are _likely_
  known (two prior episodes), linear maps are _hypothesized_ weak. A diagnostic question confirms the
  weakness — a verification event moves the belief. The lesson grounds every explanation in the
  learner's own book, rendering the cited passage. The learner answers a check question in a way
  that reveals a misconception: they believe eigenvectors must be unit length. The system records a
  **nested belief** (the learner believes X; confidence 0.7; evidence: this answer). The decision to
  probe it further is recorded with its **expectation**: they will normalize vectors in the next
  exercise.
- **Day 3.** On a phone, by voice: "that thing from Monday about stretching directions — does it work
  for rotations?" Tier A captures and labels; the router sees a temporal cue and a conversational
  reference; the continuity engine links the episode to Monday's thread (conversational reference +
  topic + artifact: strong). The expectation resolves true in the next exercise — calibration
  improves, and the misconception is now _supported_. Before choosing how to teach, the process
  simulates two candidate explanations against the learner model; visual-first (three prior
  successes for this learner) is expected to dislodge the misconception. The simulation is weighted
  by how well this learner model's past rollouts matched reality, and its output is recorded as an
  expectation to be resolved, not as evidence. It explains why rotations have no real eigenvectors and probes
  the misconception directly. The mastery update is a transaction: staged after the explanation,
  committed only when the learner applies the idea correctly.
- **Day 10.** A delayed-retrieval check shows mastery was overestimated: the learner recognizes
  definitions but cannot apply them to a new matrix. The mastery belief is **revised** (valid
  interval closed, new belief opened, both kept). Meta-memory marks which Day-1 memories were used by
  the lesson that overestimated mastery. A consolidation process proposes an adaptation: _for this
  learner, require an application task before asserting mastery_. It carries a predicted effect (fewer
  mastery revisions). It becomes _active_ for the next concepts, and it reaches _effective_ only
  when a comparison against this learner's baseline, and against learners without the rule, confirms
  the effect at matched teaching time. A retention check a month later decides whether it is
  _verified_.
- **Day 21.** The learner starts differential equations. The planner retrieves the eigen-thread
  through the hierarchy (domain → thread → episodes), knows exactly what is verified, what decayed,
  and which misconception was corrected, and schedules a thirty-second refresher before depending on
  it. The candidate skill "visual-first, then application task, then delayed check" — seen to work
  across four concepts — enters trial for other learners with similar profiles.

### A.2 A long-running engineering objective

- **Hour 0.** "Add offline sync to the mobile app." The router selects the software environment plus
  the product's own project memory. The objective gets an acceptance predicate: sync tests pass,
  conflict-resolution tests pass, no regression in the suite, a reviewed pull request. The planner
  retrieves a decision from four months ago: _last-write-wins was rejected for this product because
  teachers edit the same lesson plans_ — with its provenance. It also retrieves a piece of negative
  knowledge: an approach tried and abandoned in a previous attempt.
- **Hour 1.** The process spawns two children by contract: a repository mapper (read-only, isolated
  branch, 30-minute budget, output schema: module map with risk notes) and a test author
  (reversible writes on a branch, output: failing tests that specify the behaviour). Spawns return
  handles; results arrive as workspace objects.
- **Hour 6.** Implementation proceeds step by step; each step renders context from the working state,
  which holds the plan, the retrieved decision, and the open questions. The migration runs as a
  transaction: its planned transition is declared, rehearsed on a branch, classified by governance as
  irreversible for shared data, and put to the person, who approves with a note — recorded as
  evidence.
- **Hour 9.** CI is slow. The process moves to _waiting_ on the CI trigger and costs nothing. During
  a deployment the harness host is killed. On restart, the execution claim is found; one tool call is
  left in _running_ and is settled as interrupted with "effect may have occurred"; its idempotency key
  lets the retry reconcile safely. A different model resumes the process from its re-projected
  working state. It does not only know the next step. It knows why last-write-wins was ruled out,
  that the migration is expected to leave every existing lesson plan readable, and that one open
  question — how to merge concurrent edits to the same paragraph — is still unanswered. It checks
  what changed on the main branch while it waited before acting.
- **Hour 14.** Tests pass. The review gate runs: a staged self-review, then an independent verifier
  checks the diff against the acceptance predicate and the four-month-old decision. The transaction
  commits and the pull request opens. The expectation declared at Hour 6 resolves true. The verified
  outcome becomes one more resolution in the competence claim for _schema migrations in this
  repository_.
- **Afterward.** Consolidation extracts a candidate skill — _safe schema migration for this
  repository_ — with this trajectory as lineage. The decision rationale, the rejected approach, and
  the person's approval note are linked into the project thread. Three weeks later a sync bug is
  reported; the new process retrieves all of it in the first step and starts where the last one
  ended — not from zero.

## Appendix B — What the references taught

A source-level archaeology of seven reference harnesses was carried out. It was read against the question _what
actually persists, and what does it make possible?_ Its findings are kept in `Reference-Architecture-Observatory/archaeology/`. The primitives
extracted from it, each with evidence, invariant, and status, are catalogued in `10-primitive-atlas.md`. The gaps are
mapped in `11-gap-map.md`. The earlier table of canonical object shapes has been removed: record schemas belong in
code, as versioned contracts, and the conceptual content of each record is stated in the sections above.

What the archaeology established, in brief:

**Converged, and adopted.** Independently, and without a shared ontology, the systems arrived at the same execution
floor. The rules, and where this document applies them:
- steps recomputed from durable records, with no in-memory loop (§32);
- effects recorded before they run, settled exactly once, with "executed but unknown" preserved (§32);
- admission separate from execution (§31);
- ownership fenced at commit, with identity, ownership, and replay unit kept apart (§31);
- views as projections committed with their facts (§4);
- children as durable processes returning by notification, with ledgered topology (§34);
- typed failures and salvage on every exit (§32).

Around that floor they also share:
- deny-dominant governance (§32);
- context changed only by append or source-citing replacement (§23);
- tools as self-describing units, where visibility is not authorization (§33);
- skills with progressive disclosure (§37);
- an immutable base with a small, reversible adaptive layer (§38).

**Absent everywhere, and added.**
- An object above the session.
- Epistemic status on what is stored.
- Verification of outcomes rather than of reports.
- Learning measured against a baseline.
- Reasons for what the model saw.
- Declared expectations.
- Working state apart from a transcript.
- Any model of the system's own competence.

These are the subject of Parts I, III, IV, and the cognitive half of Part VI.

**Failures that became laws.** Each of these reshaped a rule in this document or in the UCI axioms:
- a causal record that could be switched off → A4, §4;
- compaction that overwrote evidence → §23;
- children that inherited full authority, or lost their restriction on resume → §34;
- governance decisions that left no durable trace → §32;
- records that only their writer's plugins could read → A20, §4;
- a background curator that rewrote live memory → §26.

The shared lesson beneath all of it: the best harnesses have learned, independently, that **the record is the truth,
the context is a projection, effects must be settled, authority must be structural, and verification must be
external.** What none of them has is the half that makes execution into cognition. That half is:
- memory with provenance and epistemics;
- decisions that carry their reasons and expectations;
- a person model;
- calibrated self-knowledge;
- learning that is proven rather than asserted.

That is the part UCI adds, and it is the part that compounds.
