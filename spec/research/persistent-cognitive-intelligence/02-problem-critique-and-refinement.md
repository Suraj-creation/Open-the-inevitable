# 02 — Current Problem · Critique · Refined Problem · First-Principles Formulation

> Part of the **Persistent Cognitive Intelligence** research program. See [`README`](README.md).
> Status: research proposal (not adopted law). This document exercises the permission to disagree.

---

## Section 04 — The Current Research Problem (as inherited)

The direction arrives formulated as:

> **Persistent Cognitive State Modeling from Natural-Language Evidence** — *Can a system continuously
> infer and update a structured, probabilistic representation of an individual's evolving knowledge,
> misconceptions, mental models, reasoning patterns, uncertainty, retention, transfer, and learning
> dynamics from natural-language interactions — and actively use that representation to determine what
> evidence it needs next and what intervention is most likely to produce durable understanding?*

This is a strong formulation. It already contains the two ideas most learner-modeling work omits:
**(a)** an *active* clause ("determine what evidence it needs next") and **(b)** an *outcome* clause
("durable understanding," not next-item-correctness). It is not a naïve "LLM tutor" framing. The
critique that follows is not a rejection; it is a sharpening in three specific places, each grounded
in what the repository and the literature actually show.

---

## Section 05 — Critique of the Current Problem

**Critique 1 — "Learner state" is too narrow; the deeper object is a *Belief State*.** The formulation
scopes the model to *an individual learner's knowledge*. But the repository already contains a second,
structurally identical construct that is *not* about the learner: the **Claim Graph**, which assigns
*domain claims* an epistemic status (`established | supported | contested | speculative | superseded`)
with provenance and contradiction detection (ADR-0040/0041). And the long-horizon vision requires a
third: a *researcher's belief over hypotheses*. These three are the same computational object — a
persistent, provenance-bearing probability distribution over latent variables of a
system-of-interest, updated by typed evidence — instantiated over three different systems (a human's
competence, a domain's truth, a hypothesis space). **Scoping the research to "learner state" would
build the first instantiation as a one-off and miss that UCI's real need is the shared primitive.** A
research program that names the general object is more defensible *and* more useful to UCI, because it
unifies rather than fragments (the codebase's dominant failure mode; see [`01 §03`](01-synthesis-and-uci-map.md)).

**Critique 2 — "From Natural-Language Evidence" over-fixes the modality.** Language is the correct
*first* channel: it is the richest, the most tractable, and the one UCI already ingests (asks,
answers, teach-backs, source text). But naming it in the problem statement risks two errors. First, it
implies a **direct map** `utterance → state`, which the surface investigation shows is exactly what
UCI (rightly) avoids — the Director and MRL insert an *interpretation/grounding* step, and the
literature's strongest cautionary result (Scarlatos et al. 2026, *"Simulated Students… Substance or
Illusion?"*) is that language→cognition inference is *unreliable* and near-chance for misconceptions.
Second, UCI's own evidence is already multi-channel: interaction events (`interrupt/jump/challenge/
request_depth`), depth-gate outcomes, attention/affect signals, source anchors. **The boundary should
be "Cognitive Evidence" — a channel-agnostic, interpreted, provenance-stamped record — with language
as channel #1, not the definition.**

**Critique 3 — The formulation understates that UCI *already models* this, badly.** The most important
critique is not conceptual but empirical: the problem statement reads as greenfield, but the ground
truth (from actual code) is that UCI computes a learner model in **four fragmented, point-estimate,
passively-recorded places**, none of them probabilistic in any real sense:

- Every `confidence` is a **scalar**; in the intelligence distillers it is a **hardcoded constant**
  per distiller (0.6–0.9) with *zero dependence on evidence* (`packages/intelligence/src/distillers.ts`).
- Belief update is a **fixed non-Bayesian rule** (`reinforce_concept → c+(1−c)·conf`; `packages/memory`).
- Calibration is measured but **aggregate, not per-learner**, and feeds nothing back (ADR-0017).
- The only "what next" is `nextConcept()`, which walks **prerequisite topology, not uncertainty**.

Therefore the honest research problem is **not "can we model the learner from language"** (partially
done in UCI; substantially done in the KT literature). It is **"can we replace UCI's fragmented,
point-estimate, passive learner-state machinery with a *single, calibrated, actively-maintained*
probabilistic belief substrate — without losing the provenance, replayability, and scrutability UCI
already has, and without duplicating the four representations that exist."** That is a systems problem,
and systems problems are where the defensible novelty lives (the literature agent's conclusion:
components are solved; unification + closed-loop + long-horizon-provenance for a *human* state is not).

**Two things the formulation gets exactly right and must be preserved.** (1) The *active* clause — it
is the largest true gap in UCI and the least commoditized capability in the literature after item-
selection in CAT. (2) The *durable-understanding* outcome target — it forces causal, not correlational,
evaluation, which is the honest bar and the one UCI's evaluation layer is being built to hold.

---

## Section 06 — The Refined Research Problem

> **Persistent Cognitive Intelligence.** Can a cognitive operating system construct and maintain a
> *single, persistent, probabilistic, provenance-bearing model of an evolving cognitive state* — a
> **Belief State** over the latent variables of a system-of-interest (first: a human learner's
> knowledge, mental models, misconceptions, reasoning patterns, retention, and transfer) — by
> **interpreting heterogeneous evidence** (language first, then interaction, assessment, attention,
> and multimodal channels) into typed, weighted **Cognitive Evidence**; **update that belief with
> calibrated uncertainty** under a principled (Bayesian / state-space) revision rule rather than a
> fixed heuristic; and **actively choose the next action** — a question, probe, counterexample, or
> intervention — that **maximizes expected information gain about the state and expected durable
> improvement of it**, attributing outcomes *causally* rather than by correlation — all while
> preserving the provenance, interpretability, replayability, and learner control that make the model
> auditable and correctable?

Scoping notes that make this tractable and lawful:

- **First instantiation:** the learner. The general primitive (Belief State) is *defined* generally
  but *validated* on the learner, because education is the environment with the richest evidence,
  the clearest ground-truth proxy (delayed retention / transfer tests), and an existing substrate
  (F05, depth gates, the chronicle).
- **Not a new store:** the Belief State is a **projection** over the existing event log + world-state,
  reconciling the four fragmented representations, exactly as "everything is a projection of unified
  world-state" (`CLAUDE.md` §2). This is the anti-duplication constraint stated as a requirement.
- **Gated on measurement:** no downstream system may depend on the probabilistic state until the
  Cognitive Evaluation Layer can score its **per-learner calibration** (ADR-0023 Layer 2 gate).
- **Honest about fidelity:** the language→cognition inference is treated as a *hypothesis-generating*
  step whose fidelity must be *measured*, never asserted (per Scarlatos et al. 2026).

---

## Section 07 — First-Principles Formulation

Stripping to the irreducible. Five questions (the originating prompt's §25), answered from first
principles, then the deepest construct.

**Why does this problem exist?** Because intelligence that improves through experience requires a
*persistent internal variable* that experience updates and action consults. A system with no such
variable cannot compound — each interaction starts cold. Education makes the need visceral (a learner
*is* an evolving latent state), but the need is general: any agent that must "learn, remember, reason,
adapt, research, and discover over arbitrarily long horizons" (the program's animating question)
needs a persistent, updatable model of the thing it is reasoning about.

**Why do existing AI systems fail at it?** Three failure modes, each visible in both the literature
and UCI. (1) **Statelessness / retrieval-as-memory:** LLM agents externalize memory as retrievable
episodes (MemGPT, Generative Agents) — a *log*, not a *calibrated model of competence*; retrieval
avoids catastrophic forgetting but never yields a posterior. (2) **Point estimation:** KT models and
UCI alike collapse belief to a scalar mastery probability, discarding *uncertainty about the
uncertainty* — so the system cannot know what it does not know about the learner, which is exactly
what active diagnosis needs. (3) **Passive accumulation:** systems record what happened; they do not
*act to reduce their own uncertainty*. UCI's `nextConcept` (topology) and Director FSM (authored
rules) are both passive in this precise sense.

**Why is persistence necessary?** Because the quantities that matter — retention, forgetting,
transfer, conceptual restructuring, the correction of a misconception — are **only observable across
time**. A single session cannot distinguish "learned" from "crammed"; only a persistent trajectory
with later probes can. Durable understanding is a *longitudinal* claim, so its model must be
longitudinal. UCI's event-sourced, time-travelable substrate is what makes this affordable rather than
aspirational.

**Why is language valuable evidence?** Because language is the highest-bandwidth window into the
*structure* of a mental model, not merely its *correctness*. A correct/incorrect item reveals a bit; an
explanation, a teach-back, or a wrong-but-coherent account reveals the *shape* of the learner's model —
which p-prims fired, which analogy misled, which ontological category was mis-assigned (diSessa; Chi;
Brown & Burton's coherent "bugs"). This is why the five-test depth protocol centers *explanation* and
*teaching*. But language's richness is matched by its *unreliability* as a direct signal, which is why
it must pass through interpretation into weighted evidence, never a direct map to state.

**Why does solving this matter beyond education?** Because the same construct — a persistent,
provenance-bearing, uncertainty-calibrated belief over a system's latent variables, actively
maintained by information-seeking action — is the substrate of *any* long-horizon intelligence:
a researcher's belief over hypotheses (Kosmos's "structured world model," 2025), a physician's over a
patient, an engineer's over a system, an autonomous agent's over its environment. Education is the
first laboratory because it has the richest evidence and the cleanest ground truth; the primitive is
universal.

**The deepest construct.** The prompt asks whether learner state, world state, agent state, knowledge
state, intention, mental models, memory, belief, uncertainty, goals, curiosity, and attention are
separate concepts or manifestations of something deeper. The first-principles answer:

> They are manifestations of a single primitive — a **Belief**: a *persistent, provenance-bearing,
> uncertainty-quantified probability distribution over the latent variables of a system-of-interest,
> updated by typed evidence and queried to select maximally-informative action.* "Learner cognitive
> state" is a Belief over a human's latent competence and mental models. "Knowledge / world state" is
> a Belief over a domain's truth — **UCI already builds this as the Claim Graph, with epistemic
> status.** "Agent / research state" is a Belief over a hypothesis space. Memory is the *substrate*
> that persists Beliefs; evidence is what *updates* them; uncertainty is their *variance*; goals and
> curiosity are the *utility function* over information gain that selects action; attention is the
> *budget* that action selection spends. Intention and reasoning state are Beliefs the system holds
> about *itself*.

This is the elevation the prompt invited: **not "persistent learner state," but the persistent
Belief as a first-class UCI primitive**, of which learner-modeling is the first, and the Claim Graph
is the already-existing second. The rest of the program develops this construct concretely — as
Cognitive State ([`03 §08`](03-the-cognitive-primitives.md)), Cognitive Evidence ([`03 §09`](03-the-cognitive-primitives.md)),
and the active loop ([`04`](04-diagnosis-intervention-and-dynamics.md)) — and shows it is a projection over
the existing substrate, not a new one.
