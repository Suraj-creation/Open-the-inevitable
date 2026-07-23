# ADR-0049: Creative Cognition — the Assist Grammar, Never the Ghostwriter (M11 T1)

**Status:** Accepted
**Date:** 2026-07-17
**Related:** CSE-016 (Creative Cognition), CSE-006 §5 (the Read→…→Create arc), CSE-005 (episodic
cognition — creation as mastery evidence), CSE-012/014 (Scene actor, interaction grammar), F10/F14,
ADR-0041/0042 (the claim/synthesis units this mirrors), the Constitution (#5 learning before
dependency; #7 disagreement is content), blueprint M11

## Context

The mission's arc is `Read → Understand → Master → Connect → Question → Experiment → Research →
Discover → Create`. M1–M10 built the whole left side — ingesting, understanding, fusing, and
surfacing knowledge. **M11 makes the right side first-class: creation as a cognitive act** — the
learner turning understanding into new artifacts (an argument, a hypothesis, an experiment design, a
proof, a proposal). Creation is the deepest test of understanding (CSE-016 §2) and the strongest
evidence of mastery.

The load-bearing constraint is a value, not a feature: **the system is a thinking partner, not a
ghostwriter** (Constitution #5). It may scaffold, critique, provoke, and reference — it must never
produce the learner's artifact for them. Every assist is disclosed; the human remains the author. A
system that writes the essay defeats the mission (learning before dependency). T1 encodes this law
*structurally* — not as a prompt guideline the model might drift from.

## Decisions

### 1. Creation is a governed on-demand cognition seam, mirroring fusion/frontier

A `Creation` (CSE-016 §3.1: `creation_id`, `learner_cid`, `kind`, `source_refs`, the learner's
`draft`, `assists[]`, `status`) is opened, assisted, and completed through the gateway `SourceHub`
(the same on-demand seam that hosts fusion, frontier, and timeline) — `startCreation` →
`source.creation.started`, `assistCreation` → `source.creation.evolved`/`.critiqued`,
`completeCreation` → `source.creation.completed`. The learner's draft is theirs (passed in / stored
as the artifact); the system only ever attaches **assists**. New `source.creation.*` events. (A
dedicated `CreationRegistry` and the Scene-actor/`creating`-Director integration are named
follow-ons; T1 reuses the proven seam.)

### 2. The assist grammar is four modes — and generation is not one of them

`CreationAssistUnit` (privileged `creation` agent, model-backed with deterministic fallbacks) has
exactly four modes, and **each mode's output shape is an assist, not the artifact**:

- **scaffold** → a kind-specific *structure* (an argument's claim/evidence/counter/conclusion
  skeleton; an experiment's hypothesis/method/controls/analysis template) — labelled slots the
  learner fills, never filled content.
- **critique** → adversarial *findings* on the learner's own draft (weak links, missing evidence,
  unstated assumptions, logical gaps) — each a `{severity, where, issue, suggestion}`, never a
  rewrite. This is the Debate/Critical-Thinking lens over the learner's work (Constitution #7).
- **provocation** → generative *questions* that widen the space ("what would break this?", "what
  adjacent field solves this?") — openings, never answers.
- **reference** → grounded *pointers* to concepts/sources the learner can cite (provenance
  mandatory) — reuses the source/frontier grounding; never prose.

There is **no `generate` mode.** The unit cannot return the artifact; the four output schemas
(slots / findings / questions / refs) structurally exclude "here is your essay." Co-writing on
explicit request + disclosure is a deferred, separately-gated capability (CSE-016 §2) — not T1.

### 3. Every assist is disclosed and recorded (authorship integrity)

Each assist carries `disclosed: true` + the `agent_cid` and is recorded on the creation. The web
renders assists as *the system's offering the learner chose to use or decline* ("what did the system
offer here, and did I take it?", CSE-016 §7) — never silently merged into the draft. The audit trail
is what lets a completed creation be honestly attributed (the contribution loop, deferred, depends on
it). Model assists record before use (D3); the learner's draft is authored content.

## Consequences

- The learner can turn understanding into a new artifact with a genuine thinking partner — scaffolded,
  challenged, provoked, and grounded — while remaining unambiguously the author. The mission's arc now
  has its right side.
- Creation reuses the M9 seam pattern (on-demand, model-backed, gateway-on/CLI-untouched, honest
  fallback) — one new agent + unit + event family, no new store.
- A completed creation is the substrate for the contribution loop and for re-ingestion as a Cognitive
  Source (recursive) — both deferred, both unblocked by this record.

## Deferred (named scope)

- **The contribution loop** (`source.creation.contributed` — share to a community / re-ingest as a
  source) + its consent governance (CSE-002 §8 / F11); creations as first-class Cognitive Sources.
- **Co-write-on-request** (explicit, disclosed, attributed generation) — a separately-gated capability.
- The **Director `creating` state** (lower unsolicited enrichment, raise the desirable-difficulty
  governor, CSE-011) and the **Scene-actor** `creation-canvas` (CSE-012); the **Research Workspace**
  (CSE-009 §5).
- Feeding the **Understanding Delta** (creation as `Creation`/`Discovery`-stage mastery evidence,
  CSE-005) + transfer telemetry (CSE-016 §7); per-kind scaffold libraries at depth.

## Rejected

- **A `generate` assist mode** (the system writes the artifact): the exact violation of Constitution
  #5; the four modes structurally exclude it. Co-writing is deferred and separately gated.
- **Silently merging assists into the draft**: destroys authorship integrity + the "what did I take?"
  transparency; assists are always distinct, disclosed offerings.
- **A separate creation store/app**: a creation lives on the same substrate (world-state artifact +
  on-demand seam), citing the anchors and concepts it draws from — not a bolt-on.
