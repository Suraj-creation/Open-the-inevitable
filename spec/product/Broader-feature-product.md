```yaml
spec:
  title: The Inevitable — Broader Feature & Product Specification
  domain: product
  status: draft
  owner: product-architecture
  last_reviewed: 2026-06-02
  upstream_dependencies:
    - vision-application/The_Inevitable_Master_Vision
    - vision-application/Vision
    - vision-application/The_Inevitable_Vision_Comprehensive
    - vision-application/Universal-Learning-Intelligence-Agent
    - architecture/uci-architecture
  downstream_dependencies:
    - product/features/F01-cognitive-onboarding
    - product/features/F02-dynamic-cognitive-navigation
    - product/features/F03-recursive-prerequisite-intelligence
    - product/features/F04-adaptive-multimodal-explanation
    - product/features/F05-persistent-cognitive-memory
    - product/features/F06-specialized-agent-ecosystem
    - product/features/F07-realtime-cognitive-orchestration
    - product/features/F08-interdisciplinary-knowledge-graph
    - product/features/F09-living-universe-experience
    - product/features/F10-research-innovation-acceleration
    - product/features/F11-institutional-collective-intelligence
    - product/features/F12-collective-cognitive-evolution
    - product/features/F13-identity-personas-modes
    - product/features/F14-assessment-mastery-depth
    - product/features/F15-content-ingestion-knowledge-substrate
    - product/features/F16-cognitive-surface
  related_protocols:
    - cognition-packet-protocol
    - cognitive-event-protocol
    - memory-mutation-protocol
    - reasoning-trace-protocol
    - cognitive-unit-abi
  related_events:
    - intent.*
    - context.*
    - agent.*
    - reasoning.*
    - memory.*
    - world.*
    - orchestration.*
    - governance.*
    - observability.*
    - evolution.*
  related_runtime_systems:
    - cognitive-unit-runtime
    - cognitive-scheduler
    - world-state-graph
  related_governance_systems:
    - governance-kernel
    - capability-envelope
    - human-governance
  related_observability_systems:
    - cognitive-observability
    - reasoning-trace
    - learner-outcome-telemetry
  semantic_tags:
    [product, prd, learning-os, uli, ualrci, knowledge-graph, agents, memory, multimodal,
     research, personalization, institutions, education, cognitive-operating-system]
  canonical_references:
    - vision-application/The_Inevitable_Master_Vision
    - vision-application/Universal-Learning-Intelligence-Agent
    - ../architecture/uci-architecture.md#3-architectural-laws
    - spec-folder-ecosystem
```

# The Inevitable — Broader Feature & Product Specification

> **This is the canonical product specification of The Inevitable.** It is the bridge between the
> civilizational vision (`spec/vision-application/`) and the executable Cognitive Operating System
> (`spec/kernel/`, `spec/protocols/`, `spec/events/`, `spec/runtime/`, and the `packages/` that
> implement them). Every feature spec under [`features/`](./features/) refines one capability pillar
> declared here. Every product decision must be derivable from this document or must update it.

---

## 0. How to Read This (Read-First Guide for Claude, Codex & Humans)

Before any **product, feature, agent-behaviour, learning-experience, pedagogy, memory, or
orchestration** work, read in this order:

1. **This document** — the product thesis, capability pillars, and the map from product to architecture.
2. **The relevant feature spec(s)** under [`spec/product/features/`](./features/) — see the
   [Feature Spec Index](#15-feature-spec-index).
3. **The owning architecture specs** for the cognitive primitives the feature touches
   (`spec/kernel/`, `spec/protocols/`, `spec/events/`, `spec/runtime/`, `spec/memory/`,
   `spec/world-state/`, `spec/orchestration/`, `spec/curriculum/`, `spec/pedagogy/`).
4. **The vision source** in `spec/vision-application/` when intent or philosophy is ambiguous.

This document is **product law subordinate to architecture law**. Where a product requirement and an
architecture invariant (the ten non-negotiable laws, blueprint §25.4) appear to conflict, the
architecture invariant wins and the requirement must be expressed *through* the invariant (events,
leases, memory mutations, governed capabilities), never around it. See
[§14 — Product → Architecture Mapping](#14-how-the-product-maps-onto-the-cognitive-operating-system).

**One-line product definition:**

> The Inevitable is a **Cognitive Operating System for Human Learning, Understanding, Creation, and
> Intellectual Evolution** — a system that takes any human, from any starting point, and constructs
> the complete architecture of understanding beneath them until mastery becomes inevitable, then
> carries them onward from mastery to original contribution.

---

## 1. Product Thesis

The Inevitable is **not** an educational app, a tutoring chatbot, a course marketplace, or a learning
management system. Those are products that *deliver content*. The Inevitable is an operating system
that *constructs understanding* — a living cognitive substrate in which knowledge is a navigable,
multidisciplinary graph; learning is active construction rather than passive consumption; and every
interaction is governed, observable, replayable, and memory-forming.

Three claims define the product:

1. **Knowledge is a graph, not a syllabus.** Every concept rests on a hidden dependency tree. The
   product's primary job is to make that tree explicit, personal, and navigable — to *see the
   complete landscape of human knowledge*, locate exactly where a learner stands within it, and build
   bridges from that precise position to any destination.

2. **Any human can learn anything — the barrier is never age or IQ, only the structure of delivery.**
   The product guarantees a path from a *Zero-Knowledge Starting Point* (a concept any human can grasp
   from everyday experience) to advanced, research-level understanding of any domain. This
   **Universal Accessibility Guarantee** is an architectural requirement, not a slogan.

3. **Education does not end at competence — it ends at contribution.** The product carries learners
   through the full pipeline *Ignorance → Understanding → Mastery → Innovation → Original
   Contribution*, deliberately bridging the most-neglected transition in all of education: from
   *understanding a field* to *advancing it*.

The product exists to **compress the journey from curiosity → understanding → mastery → creation →
innovation** while never compromising depth — and to do so for *every human entity that interacts
with knowledge*, not only students.

---

## 2. The Problem Being Solved

Human understanding is interconnected, recursive, multidisciplinary, evolving, and contextual.
Education systems are linear, fragmented, and rigid. The product attacks ten structural failures
(synthesized from `vision-application/The_Inevitable_Master_Vision` §III):

1. **Fragmentation of knowledge** — disciplines are siloed; the interconnections where breakthroughs
   live are never surfaced.
2. **Prerequisite blindness** — learners meet concepts without the foundations they silently require;
   confusion is misdiagnosed as inability.
3. **No visibility of the learning journey** — learners cannot see where they are, what they're
   missing, or where they can go next.
4. **Static content in a dynamic world** — the living research frontier never reaches the learner.
5. **Passive consumption instead of active construction.**
6. **One-size-fits-all pacing and structure.**
7. **Education stops before innovation** — at competence/mastery, never reaching contribution.
8. **No integration layer** — tools don't share context; learning is discontinuous.
9. **Shallow personalization** — systems adapt *content* but not *cognitive depth*.
10. **Loss of curiosity** — systems reward answers over questions.

The product's response is a single coherent system in which the knowledge graph, the agent ecosystem,
the memory substrate, and the orchestration fabric jointly eliminate these failure modes — and do so
with the observability, governance, and replayability of a true operating system.

---

## 3. Who It Is For — Identity-, Cognition-, and Goal-Aware

The product is built for **any human entity interacting with knowledge**, and for the institutions
that organize them. It is identity-aware and goal-aware, not merely grade-aware. Onboarding is
*cognitive context initialization*, never form-filling (see [F01](./features/F01-cognitive-onboarding.md)).

| Persona class | Examples | Primary jobs |
|---|---|---|
| **Individual learners** | children, school students, college students, career-changers, lifelong learners | learn anything deeply in least time; navigate from zero to mastery; build toward creation |
| **Educators** | teachers, tutors, professors, academicians | co-architect pedagogy; offload repetition; shape the system with their teaching signature |
| **Researchers & creators** | scientists, PhD students, independent researchers, innovators | survey frontiers, identify gaps, generate and test hypotheses, produce original contribution |
| **Institutions** | schools, colleges, universities, research orgs | evolving intelligence ecosystems; institutional knowledge memory; collective cognition growth |
| **Organizations** | companies, medical/non-educational institutes, government bodies | domain upskilling, organizational learning, knowledge compounding, decision support |

Every persona has a **Default** experience (global best practices) and a **Personalized Default**
(self-defined / self-trained). Every persona also has access to an **Open Mode** — an
explore-anything surface unconstrained by grade, domain, or current path. Persona and mode modeling
is specified in [F13 — Identity, Personas & Modes](./features/F13-identity-personas-modes.md).

### 3.1 Persona Journeys at a Glance

These are *narrative* journeys — concrete enough to anchor design decisions, not prescriptive enough
to constrain the system. Every journey traverses the same substrate (ULI + UALRCI, memory,
orchestration, agents) but the surface, defaults, and emphases differ.

**The 7-year-old curious about black holes.**
Onboarding asks identity class → child, then a single soft branch (favourite thing to think about,
something she finds amazing). She types "black holes." The system does **not** dump astrophysics on
her. ULI traces the prerequisite tree to Zero-Knowledge points — *"things fall down"*, *"some things
are very heavy"*, *"light is what you see"* — and renders a horizontal timeline she can scroll. The
Explanation Agent uses Layer-0 story and Layer-1 visuals (animated marble on a stretched sheet),
the Socratic Agent asks her what she thinks would happen if the marble was the Sun, and the
Simulation Agent proposes a small interactive she can poke. The Memory system stores not the
chat log but a compressed semantic trace — "interested in gravity, comfortable with spatial
analogies, age-7 vocabulary" — which every other agent inherits. Two weeks later, when she returns,
she does not start over; the path knows exactly where she stopped.

**The class-10 student preparing for boards while curious about deep learning.**
Onboarding: student → CBSE class 10 → subjects/board context. The default surface shows her
syllabus-aligned timelines per subject; the **Open Mode** sits one tap away. She uploads her physics
textbook PDF. The system reads it end-to-end, builds a per-PDF knowledge graph, and lets her
**select any line or paragraph to expand** into a deep contextual explanation in a split pane. She
opens Open Mode and asks "what is deep learning?" — UALRCI's compression strategies engage, mapping
exactly which class-10 concepts (functions, slopes, statistics) transfer, and constructing a
chronological path that does not wait for college. The Assessment Agent generates exam papers in
her board's exact format; the Research Agent quietly seeds frontier breadcrumbs so curiosity has
somewhere to go.

**The 45-year-old non-technical career-changer learning to program.**
Onboarding: individual learner → career changer → goal: "build a software product." The system
assumes zero programming background but probes for transferable strengths (he's a chef → systems
thinking, sequencing, recipe abstractions). ULI builds a path that starts at logical thinking and
pattern recognition long *before* any code. The Code Helper Agent runs the seven-layer programming
pedagogy; the dual-pane editor (per the *agentic code editor* horizon) shows code on one half and
conversational-English logic on the other. Spaced repetition and interleaving compress what would
have been years into months — **without** skipping foundations.

**The PhD researcher entering an adjacent field.**
Onboarding skips most defaults — she explicitly declares her domain expertise and the new field.
ULI builds a *transfer-optimized* path: it identifies isomorphisms between her field and the new
one, lights up the cross-domain bridges in the knowledge graph, and routes her quickly to Stage
4–5. UALRCI's Novel Contribution Engine surfaces gap analyses, scale-transformation hypotheses,
and unexplored cross-pollinations. The Research Agent maintains a live frontier map; the Innovation
Agent stress-tests her hypotheses against the failure library.

**The educator co-architecting pedagogy.**
A teacher enters Educator Mode. She uploads her day plan, her past notes, and her teaching
philosophy. The system parses her *teaching signature* — her analogies, her sequencing
preferences, her tolerance for digression — and reshapes the DSP layer for *her* students. Her
agent talks to her students' agents: confusion clusters surface as a heat-map of her class, and
the Curriculum Agent proposes path corrections she can accept, reject, or modify. Live
classroom transcription continuously converts spoken instruction into structured Notebooks, and
those Notebooks evolve into a living Contemporary Book that reflects *her actual classroom*.

**The institution evolving as an intelligence ecosystem.**
A university provisions the platform across departments. It owns its own institutional memory
substrate, governance policies, and educator/student/researcher cohorts. Cross-cohort analytics
(strictly anonymized) reveal which prerequisite chains break most often, which pedagogies converge
on mastery fastest, and where the institution's research frontier is concentrated. New curricula
can be evolved through governed proposals, shadow-tested on synthetic learners, and rolled out with
replay-based safety gates. Educator agents, student agents, departmental agents, and an
institutional Supervisor coordinate through the bus — never via hidden direct calls.

**The organization upskilling a domain workforce.**
A hospital network deploys the platform to bring nurses to current evidence-based practice. Each
nurse gets a goal-aware path; the Assessment Agent enforces depth verification with clinical
edge-case tests; the Research Agent surfaces just-published guideline changes; the Socio-Ethical
Agent embeds patient-safety reasoning into every path. Institutional memory captures organizational
learning — a knowledge asset that compounds.

Every journey above runs through the **same** primitives — Cognitive Identity, capability
envelopes, context/intent leases, cognition packets, events, memory mutations, reasoning traces.
Persona affects defaults, surfaces, governance posture, and modality weighting; it never affects
which laws apply. See [F13](./features/F13-identity-personas-modes.md).

---

## 4. The Product Promise — The Outcome Pipeline

The product's North Star is the **Transformation Pipeline**:

```
IGNORANCE → UNDERSTANDING → MASTERY → INNOVATION → ORIGINAL CONTRIBUTION
 (Stage 0)   (Stage 1–3)    (Stage 4)  (Stage 5)      (Stage 6)
   └────────── ULI governs 0–4 ──────────┘ └──── UALRCI governs 4–6 ────┘
```

Success is **not** lessons completed, courses finished, or facts memorized. Success is that a learner
becomes capable of **independent advanced reasoning, novel idea creation, and contributing new
knowledge to humanity**. This metric flows down into every feature's success criteria and into the
observability layer (see [§16](#16-success-metrics--north-star)).

---

## 5. The Cognitive Spine — ULI + UALRCI

c*.

### 5.1 Universal Learning Intelligence (ULI) — the foundation builder

ULI is the fusion of six roles in one system: world-class teacher, curriculum designer, cognitive
scientist, educational psychologist, knowledge-graph engineer, and personalized mentor. Its axiom:

> **No concept exists independently. Every concept depends on smaller concepts.**

For any learning goal, ULI executes: **Understand → Identify → Decompose → Construct → Rebuild →
Deliver** — recursively decomposing the target into a directed acyclic prerequisite graph until every
branch terminates at a *Zero-Knowledge Starting Point*, then ascending through **seven layers of
understanding** (0 Intuition/Story · 1 Visual/Spatial · 2 Conceptual Framework · 3
Mathematical/Logical · 4 Applied/Practical · 5 Advanced/Connective · 6 Research/Generative).

ULI is detailed across [F03 — Recursive Prerequisite Intelligence](./features/F03-recursive-prerequisite-intelligence.md),
[F04 — Adaptive Multimodal Explanation](./features/F04-adaptive-multimodal-explanation.md), and
[F08 — Interdisciplinary Knowledge Graph](./features/F08-interdisciplinary-knowledge-graph.md).

### 5.2 Universal Accelerated Learning & Research Creation Intelligence (UALRCI) — the accelerator/creator

UALRCI activates on top of ULI to (a) **compress timelines** without sacrificing depth and (b)
**transition learners into creators**. It applies seven evidence-based acceleration strategies
(prerequisite parallelization, transfer-learning exploitation, cognitive-load optimization, spaced
repetition, interleaving, elaborative interrogation, dual coding) and enforces a **five-test depth
guarantee** (Explanation, Application, Connection, Teaching, Edge-Case) before any concept is marked
learned. It then drives the Research Transition (awareness → capability → contribution) and the Novel
Contribution Engine (gap analysis, cross-domain synthesis, scale transformation, constraint
manipulation, failure analysis). UALRCI is detailed in
[F10 — Research & Innovation Acceleration](./features/F10-research-innovation-acceleration.md) and
[F14 — Assessment, Mastery & Depth Verification](./features/F14-assessment-mastery-depth.md).

### 5.3 Dynamic System Prompting (DSP) — the adaptive instruction layer

Every agent's instruction layer is **living**: it is continuously rewritten in real time from the
learner's evolving context, progress, cognitive state, and goals, and from educator/institutional
training. DSP is the mechanism by which "infinite explanations, each adapted to a learner" is
realized at scale. DSP is governed (no agent silently self-rewrites outside policy), versioned, and
replayable. See [F04](./features/F04-adaptive-multimodal-explanation.md) and
[F12 — Collective Cognitive Evolution](./features/F12-collective-cognitive-evolution.md).

---

## 6. End-to-End Experience Walkthrough

A single narrative thread, showing how the pillars compose. (Each step links to its owning feature.)

1. **Arrival → Cognitive Onboarding.** The system asks the *minimum* required to build context —
   "are you a student / educator / institution / company / researcher?", then a short branch (grade,
   institution type, domain, aspiration). It never over-asks; understanding deepens through
   interaction. A **Cognitive Identity** and an initial **learner model** are created.
   → [F01](./features/F01-cognitive-onboarding.md), [F13](./features/F13-identity-personas-modes.md)

2. **Intent → Dynamic Cognitive Navigation.** The learner asks a question, uploads a PDF, names a
   topic, or starts from curiosity. The system infers intent, then renders a **horizontal learning
   timeline** from basic → advanced, covering every prerequisite, with branch points and
   interdisciplinary bridges. The learner can always drop into **Open Mode** to ask anything.
   → [F02](./features/F02-dynamic-cognitive-navigation.md), [F15](./features/F15-content-ingestion-knowledge-substrate.md)

3. **Decomposition → Recursive Prerequisite Intelligence.** Behind the timeline, ULI builds the
   learner-specific knowledge graph: recursive prerequisite descent to zero-knowledge points,
   difficulty gradients, mastery checkpoints, cross-domain bridges.
   → [F03](./features/F03-recursive-prerequisite-intelligence.md), [F08](./features/F08-interdisciplinary-knowledge-graph.md)

4. **Explanation → Adaptive Multimodal Delivery.** Each concept is taught through the seven layers,
   delivered in the modality that best fits the concept and the learner — text, diagrams,
   simulations, whiteboard, interactive timelines, stories, analogies, and (on the immersive
   roadmap) AR/VR/holographic. Explanations adapt live via DSP.
   → [F04](./features/F04-adaptive-multimodal-explanation.md), [F09](./features/F09-living-universe-experience.md)

5. **Continuous cognition → Real-Time Orchestration + Specialized Agents.** While the learner works,
   a constellation of agents observes the cognition event stream and acts: a Research Agent surfaces a
   frontier idea on the whiteboard; a Revision Agent detects forgetting risk; a Motivation Agent
   senses disengagement; a Curriculum Agent restructures the path; a Simulation Agent proposes a
   visual. All simultaneously, all coordinated through the bus and blackboard — never via hidden
   direct calls.
   → [F06](./features/F06-specialized-agent-ecosystem.md), [F07](./features/F07-realtime-cognitive-orchestration.md)

6. **Persistence → Cognitive Memory.** After each session the memory system stores **only what
   matters**, in compressed semantic form, and continuously updates, consolidates, decays, and
   redacts. All agents subscribe to the relevant memory streams, so context is shared in real time.
   → [F05](./features/F05-persistent-cognitive-memory.md)

7. **Verification → Assessment & Mastery.** Advancement is gated by the five-test depth protocol and
   mastery checkpoints, not by lesson completion. Question banks and exam papers can be generated in
   every permutation from the learner's actual material.
   → [F14](./features/F14-assessment-mastery-depth.md)

8. **Elevation → Research & Innovation.** Once mastery emerges, UALRCI shifts into research mode:
   frontier mapping, gap identification, hypothesis generation, and a first original-contribution
   project.
   → [F10](./features/F10-research-innovation-acceleration.md)

9. **Scale → Institutional & Collective Intelligence.** Educators co-architect pedagogy; institutions
   become evolving intelligence ecosystems with collective memory; agent-to-agent communication spans
   learner ↔ educator ↔ institution.
   → [F11](./features/F11-institutional-collective-intelligence.md)

10. **Evolution → Collective Cognitive Evolution.** The platform improves its own pedagogy,
    orchestration, memory policies, and learning paths through governed proposals, shadow tests,
    replay, and rollback.
    → [F12](./features/F12-collective-cognitive-evolution.md)

### 6.1 Worked Example — One Learner, Stage 0 to Stage 6

> *Maya, 19, first-year undergraduate, wants to "really understand machine learning."*

**Day 0 — Onboarding.** Identity class → student, college, year. One soft branch: "what do you want
to be able to *do*?" → "build models that help people." A Cognitive Identity is created; an Intent
Lease is opened on the goal *"understanding-grade ML competence with research transition"*; a
context lease is granted to the Curriculum, Explanation, and Memory agents within the scope of
that intent. Onboarding never asks more than is needed; the rest is inferred over the next sessions.

**Day 1 — Decomposition.** ULI runs Understand → Identify → Decompose → Construct → Rebuild over the
goal. The learner sees a horizontal timeline: at the right, "modern deep learning"; at the left,
six Zero-Knowledge starting points (number sense; functions as input-output machines; what
"learning from examples" means; basic Python intent; the idea of a vector as an arrow; the idea of
"likelihood"). She can scroll between them and tap any node to dive deeper. The Memory system
silently records *which* foundations the learner accepted with confidence and which she paused on.

**Days 2–14 — Layered ascent.** Each concept she meets is taught through the seven layers,
calibrated to her current state. When she stumbles on the chain rule, the system does not
re-explain the chain rule — it *descends* (via prerequisite repair) into composite functions and
the function-machine intuition until the chain rule lands, then ascends again. The Revision Agent
schedules spaced reviews; the Practice Agent interleaves problems; the Socratic Agent runs
elaborative interrogation. Memory consolidates every night — what mattered is kept in compressed
semantic form; chat logs are not.

**Day 15 — A research seed appears.** Mid-session, the World-Today Agent surfaces, on a side
whiteboard, a paragraph: *"A paper this week reframed your topic as an information-bottleneck
problem. Want to look later?"* It does **not** interrupt; it leaves a bookmark in her timeline.
The agent emitted a `world.observation.surfaced` event with a reasoning trace; governance approved
the surfacing under her current consent envelope.

**Day 40 — Depth-verified competence.** Five-test depth gates fire as she advances. Where she
can explain, apply to a novel problem, connect to two adjacent concepts, teach to a hypothetical
beginner, and identify edge cases — the concept is marked mastered. Where she cannot, the system
refuses to advance, and the Curriculum Agent restructures around the gap.

**Day 70 — Mastery → Innovation.** UALRCI shifts mode. The Research Agent constructs a frontier map
for her sub-area. The Innovation Agent runs gap analysis, cross-domain synthesis (her side-interest
in linguistics produces a transfer-learning hypothesis no syllabus would have produced), and the
failure library surfaces three approaches that did not work and *why*. Maya's path forks: she can
continue depth, or she can scope a first contribution.

**Day 110 — Original Contribution scoped.** She picks a tractable contribution. Mentor, Research,
and Innovation agents support scoping, literature positioning, and execution planning. The
Communication Agent helps her draft the write-up. Every step is observable, replayable, and
governed; her work product is hers — the platform's role is leverage, not authorship.

**Throughout — The substrate at work.** None of this was a fixed course. Maya navigated a
*learner-specific*, *living* knowledge graph. Every agent acted on shared memory streams and
cognition packets across the bus. Every governed action emitted an event and a reasoning trace.
At any point a teacher, a parent (with consent), or a future Maya could replay any decision.

This story is not a marketing scenario; it is the **product specification's contract** — every
feature spec under [`features/`](./features/) refines a piece of it.

---

## 7. The Twelve Capability Pillars (and their feature specs)

The product surface decomposes into twelve capability pillars. Sixteen feature specs refine them
(some pillars span more than one spec). This is the authoritative pillar → feature map.

| # | Capability Pillar | Feature spec(s) |
|---|---|---|
| P1 | **Cognitive Onboarding & Context Initialization** | [F01](./features/F01-cognitive-onboarding.md) |
| P2 | **Dynamic Cognitive Navigation** (intent → living timeline) | [F02](./features/F02-dynamic-cognitive-navigation.md) |
| P3 | **Recursive Prerequisite Intelligence** (ULI core) | [F03](./features/F03-recursive-prerequisite-intelligence.md) |
| P4 | **Adaptive Multimodal Explanation** (7 layers, DSP, infinite explanations) | [F04](./features/F04-adaptive-multimodal-explanation.md) |
| P5 | **Persistent Cognitive Memory** (hierarchical, compressed, distributive) | [F05](./features/F05-persistent-cognitive-memory.md) |
| P6 | **Specialized Agent Ecosystem** (30+ agents on the ULI/UALRCI substrate) | [F06](./features/F06-specialized-agent-ecosystem.md) |
| P7 | **Real-Time Cognitive Orchestration** | [F07](./features/F07-realtime-cognitive-orchestration.md) |
| P8 | **Interdisciplinary Intelligence & Knowledge Graph** | [F08](./features/F08-interdisciplinary-knowledge-graph.md) |
| P9 | **Living-Universe Experience** (UX philosophy, canvas, immersive roadmap) | [F09](./features/F09-living-universe-experience.md) |
| P10 | **Research & Innovation Acceleration** (UALRCI) | [F10](./features/F10-research-innovation-acceleration.md) |
| P11 | **Institutional & Collective Intelligence** + Educator Mode | [F11](./features/F11-institutional-collective-intelligence.md) |
| P12 | **Collective Cognitive Evolution** (governed self-improvement) | [F12](./features/F12-collective-cognitive-evolution.md) |
| — | **Identity, Personas & Dual Modes** (cross-cutting) | [F13](./features/F13-identity-personas-modes.md) |
| — | **Assessment, Mastery & Depth Verification** (cross-cutting) | [F14](./features/F14-assessment-mastery-depth.md) |
| — | **Content Ingestion & Universal Knowledge Substrate** (cross-cutting) | [F15](./features/F15-content-ingestion-knowledge-substrate.md) |
| — | **The Cognitive Surface — Universal Multimodal Substrate** (cross-cutting) | [F16](./features/F16-cognitive-surface.md) |

---

## 8. The Agent Ecosystem (overview)

Agents are **cognitive runtime containers**, not prompts. Each is a Cognitive Unit with a manifest, a
Cognitive Identity, a capability envelope, context/intent leases, and observability hooks (see
[`spec/runtime/cognitive-unit-runtime.md`](../runtime/cognitive-unit-runtime.md)). Every agent is a
*manifestation of ULI/UALRCI* applied to a specialized function. A **Supervisor/Orchestrator** uses
the shared learner model, knowledge graph, and mastery state as the single source of truth for which
agent to activate, what to deliver, when to intervene, and how to respond.

Canonical agent catalog (30+; the catalog is extensible and itself governed):

| Agent | Function |
|---|---|
| **Supervisor / Orchestrator** | Routes, arbitrates, sequences agents from learner state |
| **Curriculum / Planner** | Builds and resequences the dependency graph and learning path |
| **Explanation / Teacher** | Seven-layer concept delivery at the right abstraction |
| **Socratic** | Guided-discovery questioning that surfaces and fills gaps |
| **Practice** | Adaptive problem sets targeting actual gaps |
| **Assessment / Evaluator** | Five-test depth verification, mastery gating, exam generation |
| **Revision** | Spaced reinforcement, forgetting-risk detection |
| **Memory** | Memory optimization, compression, consolidation, retrieval |
| **Research** | Frontier mapping, paper survey, contribution opportunities |
| **Innovation** | Cross-domain synthesis, hypothesis and novelty generation |
| **Reflection / Metacognition** | Self-explanation, learning-about-learning |
| **Motivation / Goal** | Engagement, encouragement, long-term trajectory |
| **Debate** | Perspective expansion, steelmanning, dialectic |
| **Simulation** | Experiential/visual learning, 3D/real-physics scenarios |
| **Communication / Public-Speaking** | Articulation, writing, speech coaching |
| **World-Today** | Connects concepts to current events and breakthroughs |
| **Auto Note Builder** | Structures notes/books from sessions and live classes |
| **Code Helper** | Seven-layer programming pedagogy and production-grade guidance |
| **Socio-Ethical** | Embeds values, ethics, civic reasoning across paths |
| **Identical / Digital-Twin** | Lifelong personal agent; deep continuity (roadmap) |

Full catalog, manifests, lifecycle, and agent-to-agent semantics:
[F06](./features/F06-specialized-agent-ecosystem.md).

### 8.1 Agent Behavior Patterns — How Agents Show Up in Real Time

Agents are not consulted, one at a time, on user demand. They **observe** the cognition event
stream and the shared blackboard, and they **show up** when the learner's state matches their
activation predicate. Each surfacing is a governed, observable action — never a hidden direct
call from one agent to another.

**Pattern A — Just-in-time research seed.** While the learner studies backpropagation, the
Research Agent watches the `learning.concept.engaged` stream. Its activation predicate fires when
the concept matches its frontier index. It surfaces — *non-modally, on the whiteboard* — a single
breadcrumb: *"This week's frontier here is …"*. Reasoning trace is emitted; the learner is in
control of whether to follow.

**Pattern B — Forgetting-risk repair.** The Revision Agent runs decay modeling against the
learner's confidence per concept. When predicted retention falls below a threshold, it does not
quiz; it weaves a micro-recall question into the next natural beat of the session. If the recall
succeeds, decay is updated. If it fails, the Curriculum Agent is notified and the path bends
toward reinforcement before progressing.

**Pattern C — Disengagement detected.** The Motivation Agent senses dwell-time patterns,
abandonment signals, or affective cues. It does not nag. It proposes — to the Supervisor — a path
restructure (a shorter loop, a different modality, a real-world hook) and, if approved, the
Curriculum Agent reshapes the next ten minutes.

**Pattern D — Disagreement is first-class.** The Curriculum Agent and the Innovation Agent
disagree about whether Maya is ready for an early research seed. Their disagreement is published
as a `disagreement.raised` event; the Supervisor either arbitrates with a documented rationale, or
escalates to human governance (in Educator/Institutional Mode). Hidden agent-to-agent overrides
are an integrity violation.

**Pattern E — Live classroom co-presence.** In a real classroom, the Transcription Agent converts
speech to structured notes; the Note Builder restructures them; the Hyperlink Agent makes every
key term clickable into a contextual explanation; the Question-Generation Agent silently
constructs a per-student question bank for tonight's practice; the Examination Paper Generator can
synthesize a board-format paper on demand. All of this is event-sourced; all of it is replayable;
all of it is gated by educator and institutional consent.

**Pattern F — Educator's signature propagates.** The educator's agent updates its DSP layer in
response to her feedback. The change is versioned. Her students' agents inherit the updated
teaching signature within governed bounds; learners can always see *whose pedagogy* shaped a given
explanation, and can opt for the global default.

These patterns are intentionally narrative. They are not API contracts; they are the *behavior
shape* every agent specification must produce. The mechanics — bus, blackboard, scheduler,
governance kernel, reasoning traces — are owned by `spec/orchestration/`, `spec/scheduler/`,
`spec/governance/`, and `spec/observability/`.

---

## 9. The Memory Architecture (overview)

> *The single most-emphasized infrastructure requirement: a system that, after any session, stores
> **only what is required**, in the most efficient compressed form; then continuously creates,
> updates, consolidates, and deletes memory; and distributes it so that **every agent** has the
> learner's context in real time.*

The memory system is **not** chat history. It is a hierarchical, cognition-aware, distributive
substrate with typed tiers (working / episodic / semantic / procedural / reflective / collective),
governed entirely through the **Memory Mutation Protocol** — no agent ever writes to a store
directly. Memory is evidence-backed, reversible, decayable, consolidatable, redactable, and
replayable; it emits `memory.*` events and projects into the world-state graph. Agents **subscribe**
to relevant memory streams so context propagation is real-time and event-driven, not request/response.
Full model, tiering, compression, decay, consolidation, privacy, and distribution semantics:
[F05](./features/F05-persistent-cognitive-memory.md), grounded in
[`spec/memory/`](../memory/) and [`spec/world-state/`](../world-state/).

---

## 10. Real-Time Cognitive Orchestration (overview)

Orchestration is continuous, not turn-based. While a learner interacts, agents observe the cognition
event stream and a shared **blackboard**, and may surface contributions in real time (a research
pointer, a revision nudge, a simulation suggestion, a path restructure) — all mediated by the
**Universal Cognitive Bus**, all governed, all observable, all replayable. Disagreement between agents
is a first-class, surfaced signal, not a hidden race. Full model:
[F07](./features/F07-realtime-cognitive-orchestration.md), grounded in
[`spec/orchestration/`](../orchestration/) and [`spec/events/event-taxonomy.md`](../events/event-taxonomy.md).

---

## 11. Multimodal & Immersive Experience

Explanations are delivered through the optimal representational system(s) for the concept and
learner: text, diagrams, interactive whiteboards, simulations, interactive timelines, stories,
analogies, visualizations, and interdisciplinary maps. **Dual coding** (≥2 representations per
concept) is a default. The experience must feel like *navigating a living universe of knowledge* —
exploratory, fluid, immersive, contextual — not dashboard-, menu-, or chatbot-centric.

The immersive roadmap (explicitly future-staged, not MVP) extends to AR/VR environments,
holographic classrooms, pure real-physics 3D simulations, and zero-latency voice mode with automatic
documentation behind every dialogue. UX philosophy and the immersive roadmap:
[F09 — Living-Universe Experience](./features/F09-living-universe-experience.md).

> **The Cognitive Surface — convergence at the substrate, not the application.** All of these
> modalities are not separate apps bolted together; they are **projections of one representational
> substrate** — the *Cognitive Surface*. Its thesis (grounded in deep research,
> [`spec/research/cognitive-surface-frontier-research.md`](../research/cognitive-surface-frontier-research.md))
> is that the whiteboard, the living document, the presentation, the Canva/Word-class authoring
> canvas, the notebook, the knowledge-graph explorer, the simulation stage, and (on the long horizon)
> an IDE / pair-programming co-editor are all *manifestations* projected from a single **typed
> Cognition Block** primitive — rendered three ways (scene-graph, block-document, dataflow-DAG),
> synchronized as a per-property CRDT, and journaled as events so the entire surface is a
> deterministically-replayable, governed projection of the world-state graph. **F09 owns what the
> surface *feels* like; [F16 — The Cognitive Surface](./features/F16-cognitive-surface.md) owns the
> substrate it is built from.** Agents render onto it via *typed mutations* (never opaque HTML), so
> every rendered element is event-sourced, reasoning-traced, and governed — the difference between
> "another whiteboard" and a surface where a provably-correct cognitive process becomes visible.

### 11.1 Content, Material & Knowledge Substrate

The platform is a **knowledge-ingesting cognitive substrate**, not a content-delivery surface that
points outward at videos. Any artifact a learner brings becomes a first-class object in the learner-
specific knowledge graph.

| Inflow | Behavior |
|---|---|
| **PDF / DOCX / text upload** | Read end-to-end on ingestion; semantic graph built per document; every term/keyword/paragraph becomes selectable and explainable in a split pane (the *select-to-expand* pattern); the document's concept graph is unified with the learner's master graph |
| **Topic / curiosity prompt** | Triggers ULI's recursive decomposition into a learner-specific timeline |
| **Live classroom audio/video** | Streamed transcription → structured Notebooks → Contemporary Book → question bank → exam papers (Pattern E above) |
| **Web / external corpora** | Universal scraping & inference flow (F15), strictly governed, source-attributed, and consent-gated |
| **Whiteboard / canvas inputs** | First-class artifacts the learner draws, manipulates, and re-asks against — the canvas is a cognitive surface, not a notepad |
| **Voice (roadmap)** | Zero-latency voice mode; the system writes structured documentation behind every dialogue automatically |
| **Multimodal/sensor (roadmap)** | Vision-based companion, mood detection, ambient inputs — strictly opt-in, strictly governed |

> **The total-recording requirement, precisely.** The vision states that *"the whole database is
> actually storing everything"* and that every theory, output, and interaction is preserved. The
> product realises this through the **event store** (canonical record of every cognition event)
> plus **per-artifact provenance in memory** — *not* by hoarding raw chat logs. Every important
> action is replayable; every memory is reversible, decayable, and redactable. Total recall does
> not mean total surveillance: the recording substrate is the audit trail, not the cognitive
> store, and access to it is governed by capability envelopes and human-governance overrides.

Living artifacts produced from this substrate include:

- **Living Notebooks** — auto-built from any session or class, hyperlinked at every concept term
- **Contemporary Books** — Notebooks consolidated across sessions/chapters into a per-learner,
  per-class, or per-cohort living textbook that reflects *actual* taught experience, not a generic
  textbook
- **Question banks** — generated from the learner's own ingested material, in every permutation,
  at every difficulty
- **Exam papers** — synthesized in the exact format of the learner's board/standard/cohort
- **Hypothesis & contribution drafts** (Stage 5–6) — research seeds, gap maps, novel-contribution
  proposals scoped from the learner's frontier exposure

Full ingestion model, provenance, deduplication, conflict resolution, retention, and the storage
↔ memory ↔ world-state separation: [F15](./features/F15-content-ingestion-knowledge-substrate.md),
[F05](./features/F05-persistent-cognitive-memory.md), grounded in [`spec/storage/`](../storage/),
[`spec/events/`](../events/), and [`spec/replay/`](../replay/).

---

## 12. Modes & Personas

- **Student Mode** — learners own their pedagogy; multi-agent tutors handle scaffolding, practice,
  structure; Default and Personalized Default.
- **Educator Mode** — teachers co-create pedagogy: they train, inspire, and reshape the DSP layer
  with their philosophy and feedback; the system learns each educator's *teaching signature*; the
  educator's agent communicates with student agents. Default and Personalized Default for Educator.
- **Institution / Organization Mode** — adaptive learning systems, dynamically evolving curricula,
  collective cognition tracking, institutional knowledge memory.
- **Open Mode** — available within every mode: ask anything, from any discipline, unconstrained by
  grade or current path.

Persona/mode modeling, switching, and the Default/Personalized-Default mechanics:
[F13](./features/F13-identity-personas-modes.md). Institutional and educator depth:
[F11](./features/F11-institutional-collective-intelligence.md).

### 12.1 The Identical Agent — Personal Digital Twin

A long-horizon product surface: every learner (and every educator) progressively gains an
**Identical Agent** — a personal digital twin that *knows the user better than anyone else does*
within strict consent and capability envelopes. It is not a chatbot wrapper; it is a long-lived
Cognitive Unit with persistent memory, its own capability envelope, and a documented lifecycle.

**Roles the Identical Agent collapses into one continuous companion:**

| Role | Function |
|---|---|
| Personal Mentor | Knows thoughts, struggles, aspirations, and live context |
| Unfailing Companion | Persistent memory and continuity across years and devices |
| Motivator & Inspirer | Goals, curiosity, perseverance — surfaced when needed, not nagged |
| Personalized Teacher | Trained on the user's history, voice, and style |
| Per-Minute Goal Setter | Goal granularity from hours down to minutes when the user opts in |
| Critical Challenger | Retrospects, projects probable futures, surfaces gaps |
| Communication Manager | Drafts, prioritizes, and proposes responses on the user's behalf |
| Public-Speaking Aide | Real-time speaking support drawn from the user's own knowledge graph |
| Memory Coach | Spaced recall assignments, active retrieval, lifelong retention |

**Lifecycle (governed):** *Provisioning* (the user explicitly creates the twin; consent envelope
scoped) → *Bootstrap* (the twin starts from the learner model already in the world-state graph) →
*Continuous shaping* (every consented interaction refines the twin's model, never raw surveillance)
→ *Snapshotting & portability* (the user can export, snapshot, branch, or terminate the twin) →
*Termination & data erasure* (right to deletion is first-class; redaction propagates through
memory and events).

**Privacy floor.** Continuous observation requires *explicit, granular, revocable* consent.
Minors and institutional contexts carry stricter defaults; observation is paused by default in
governed contexts (exams, regulated domains). The Identical Agent never escapes the governance
kernel.

**Collective intelligence boundary.** Aggregated, anonymized patterns across millions of
Identical Agents power *collective* upgrades to pedagogy, orchestration, and the substrate
itself — but raw personal context never leaves the user's envelope. Individuation is preserved;
homogenization is not the goal.

Identical Agent design, lifecycle, and consent model are owned by
[F06 — Specialized Agent Ecosystem](./features/F06-specialized-agent-ecosystem.md) (catalog),
[F05 — Persistent Cognitive Memory](./features/F05-persistent-cognitive-memory.md) (substrate),
and require a dedicated ADR for privacy/portability semantics (see §20 Open Questions).

### 12.2 Foundational Substrate — The Six Pillars of Knowledge

The product's *content* substrate is organised around six pillars of knowledge drawn from the
civilizational vision. These are not subjects to be graded; they are *foundations to be lived*
and they cut across every persona's learning path. Every learner's knowledge graph is implicitly
labeled along these dimensions, and the Socio-Ethical Agent and Reflection Agent embed them into
every path without making them a separate course.

1. **Communication & Linguistic Knowledge** — expression, articulation, listening, writing,
   cross-cultural communication.
2. **Social Knowledge** — socio-economic dynamics, political systems, human rights, governance,
   sustainable development.
3. **Spiritual Knowledge** — purpose, meaning, mindfulness, contemplative inquiry; wisdom
   traditions held with cultural neutrality and respect.
4. **Scientific Knowledge** — pure and applied sciences, mathematics, engineering, the scientific
   method.
5. **Cultural & Aesthetic Knowledge** — arts, heritage, traditions, creative expression.
6. **Ethical & Moral Knowledge** — epistemology, ethics, critical thinking, integrity, justice.

These pillars are platform-level invariants: a learning path that builds advanced technical
competence while ignoring the ethical, social, and communicative dimensions of the domain is
considered *under-specified* and the Socio-Ethical Agent will surface what is missing. See the
vision sources `vision-application/The_Inevitable_Vision_Comprehensive.md` §II-A and
`vision-application/Vision.md` §VII.

---

## 13. Research, Innovation & Collective Evolution

The product is not limited to learning existing knowledge — it accelerates innovation. UALRCI
surfaces research papers and emerging ideas, builds interdisciplinary connections, generates
hypotheses, identifies unexplored gaps, and helps learners transition into creators and researchers
([F10](./features/F10-research-innovation-acceleration.md)). At the system level, the platform itself
continuously evolves — refining pedagogy, orchestration, memory policy, and learning paths — through
**governed** proposals, evaluation, shadow tests, replay, and rollback
([F12](./features/F12-collective-cognitive-evolution.md)). Collective intelligence emerges from
anonymized, structured learning data across millions of journeys.

---

## 14. How the Product Maps onto the Cognitive Operating System

This is the load-bearing section: every product capability is realized **through** the COS
primitives. No feature may bypass these mappings.

| Product concept | COS primitive / spec | Implementing package |
|---|---|---|
| A learner, educator, agent, tool, or institution as an actor | **Cognitive Identity (CID)** — `spec/kernel/cognitive-identity.md` | `@inevitable/kernel` |
| What an agent is allowed to do (tools, memory scopes, models, ceilings) | **Capability Envelope** — `spec/kernel/capability-envelope.md` | `@inevitable/kernel`, `@inevitable/governance` |
| Bounded, revocable access to a learner's context | **Context Lease** — `spec/kernel/context-lease.md` | `@inevitable/kernel` |
| A long-running goal commitment (a multi-week learning journey) | **Intent Lease** — `spec/kernel/intent-lease.md` | `@inevitable/kernel` |
| Any typed semantic exchange between units (never a bare string) | **Cognition Packet** — `spec/protocols/cognition-packet-protocol.md` | `@inevitable/protocols` |
| Every meaningful state change (intent, context, learning, memory) | **Cognitive Event** — `spec/protocols/cognitive-event-protocol.md`, `spec/events/event-taxonomy.md` | `@inevitable/events` |
| Every memory write (store/update/consolidate/decay/redact) | **Memory Mutation** — `spec/protocols/memory-mutation-protocol.md` | `@inevitable/memory` |
| The record of *why* an agent did what it did | **Reasoning Trace** — `spec/protocols/reasoning-trace-protocol.md` | `@inevitable/observability` |
| The plug-in contract every agent implements | **Cognitive Unit ABI** — `spec/protocols/cognitive-unit-abi.md` | `@inevitable/runtime` |
| The knowledge graph, learner model, mastery state | **World-State Graph** — `spec/world-state/` *(Phase 1D)* | `@inevitable/world-state` *(planned)* |
| Real-time agent coordination | **Blackboard / Bus** — `spec/orchestration/`, `spec/communication/` | `@inevitable/orchestration`, `@inevitable/events` |
| Pedagogy- and cost-aware agent scheduling | **Cognitive Scheduler** — `spec/kernel/cognitive-scheduler.md` | `@inevitable/scheduler` |
| Policy enforcement on every side-effecting action | **Governance Kernel** — `spec/kernel/governance-kernel.md` | `@inevitable/governance` |
| Deterministic reconstruction of any learning journey | **Event sourcing + Replay** — `spec/replay/` *(Phase 1D)* | `@inevitable/events` + replay engine *(planned)* |
| Self-improvement of pedagogy/orchestration | **Evolution** — `spec/evolution/` | governed proposal pipeline *(planned)* |

**Architecture-law conformance (blueprint §25.4) is mandatory for every feature:** no bare-string
exchange; no memory write without a memory mutation; context/intent access only via leases;
side-effecting capability grants pass governance; no runtime without manifest + identity + envelope;
events carry causality + versioning; cognitive decisions emit reasoning traces; nothing important
bypasses event sourcing. Each feature spec restates the subset of laws it must honor.

---

## 15. Feature Spec Index

| ID | Title | Pillar | Status |
|---|---|---|---|
| [F01](./features/F01-cognitive-onboarding.md) | Cognitive Onboarding & Context Initialization | P1 | draft |
| [F02](./features/F02-dynamic-cognitive-navigation.md) | Dynamic Cognitive Navigation & Learning Timeline | P2 | draft |
| [F03](./features/F03-recursive-prerequisite-intelligence.md) | Recursive Prerequisite Intelligence (ULI Core) | P3 | draft |
| [F04](./features/F04-adaptive-multimodal-explanation.md) | Adaptive Multimodal Explanation & Dynamic System Prompting | P4 | draft |
| [F05](./features/F05-persistent-cognitive-memory.md) | Persistent Cognitive Memory System | P5 | draft |
| [F06](./features/F06-specialized-agent-ecosystem.md) | Specialized Agent Ecosystem | P6 | draft |
| [F07](./features/F07-realtime-cognitive-orchestration.md) | Real-Time Cognitive Orchestration | P7 | draft |
| [F08](./features/F08-interdisciplinary-knowledge-graph.md) | Interdisciplinary Intelligence & Knowledge Graph | P8 | draft |
| [F09](./features/F09-living-universe-experience.md) | Living-Universe Experience & Immersive Roadmap | P9 | draft |
| [F10](./features/F10-research-innovation-acceleration.md) | Research & Innovation Acceleration (UALRCI) | P10 | draft |
| [F11](./features/F11-institutional-collective-intelligence.md) | Institutional & Collective Intelligence + Educator Mode | P11 | draft |
| [F12](./features/F12-collective-cognitive-evolution.md) | Collective Cognitive Evolution (Governed Self-Improvement) | P12 | draft |
| [F13](./features/F13-identity-personas-modes.md) | Identity, Personas & Dual Modes | cross-cutting | draft |
| [F14](./features/F14-assessment-mastery-depth.md) | Assessment, Mastery & Depth Verification | cross-cutting | draft |
| [F15](./features/F15-content-ingestion-knowledge-substrate.md) | Content Ingestion & Universal Knowledge Substrate | cross-cutting | draft |
| [F16](./features/F16-cognitive-surface.md) | The Cognitive Surface — Universal Multimodal Substrate | cross-cutting | draft |

See [`features/README.md`](./features/README.md) for the shared feature-spec template and authoring
conventions.

---

## 16. Success Metrics & North Star

**North Star:** *learners reaching independent advanced reasoning and original contribution* — the
rate and depth at which humans move along the Stage 0 → Stage 6 pipeline, per unit time, without loss
of depth.

Representative metric families (each feature spec defines its own; all are emitted as observability
signals, never vanity counters):

- **Understanding depth** — five-test depth pass rate; transfer to novel problems; explanation quality.
- **Acceleration** — time-to-mastery vs. traditional baselines (target 4–6× compression) *with* depth held constant.
- **Prerequisite resolution** — proportion of confusion events traced to and repaired at the true missing foundation.
- **Memory quality** — retention curves, retrieval precision, compression ratio, decay accuracy.
- **Orchestration quality** — usefulness/timeliness of real-time agent contributions; disagreement-resolution quality.
- **Research transition** — learners reaching Stage 5/6; quality of generated hypotheses; original contributions produced.
- **Engagement & curiosity** — sustained exploration, question-asking rate, return-to-learn continuity.
- **Equity** — comparable outcomes across age, background, language, geography, and device/network conditions.
- **System health (OS-grade)** — reasoning-trace coverage, replay determinism, governance-decision auditability, drift.

---

## 17. Governance, Safety, Privacy & Ethics

Governance is a **kernel primitive**, not a moderation add-on. Product-level commitments:

- **Consent & data sovereignty** — observation, memory formation, and cross-agent context sharing are
  consented, scoped by leases, and revocable; minors and institutional contexts carry stricter defaults.
- **Anonymization for collective intelligence** — collective datasets are aggregated anonymously;
  personalization data is structured knowledge, not raw surveillance.
- **Pedagogical integrity** — depth is never sacrificed for speed; "acceleration by omission" is a
  governance violation. Hallucination containment and source-grounding are required for research
  surfacing.
- **Cognitive safety** — recursive-cognition stabilization, loop protection, and self-modification
  limits apply to agents and to DSP self-rewrites.
- **Human governance** — educators/institutions retain override and review authority; escalation paths
  are first-class. See [`spec/human-governance/`](../human-governance/) and [`spec/cognitive-safety/`](../cognitive-safety/).
- **Auditability & replay** — every governed decision and cognitive decision is observable and
  replayable; "code that violates governance is invalid implementation."

Each feature spec carries a Governance/Safety/Privacy section instantiating these commitments.

### 17.1 Operational Privacy & Consent UX

- Consent is **granular, scoped, and revocable** per agent, per memory tier, per data domain, per
  outflow (e.g., collective-intelligence aggregation).
- Default consent posture for minors and institutional contexts is **minimum** — observation
  scopes must be explicitly broadened.
- A learner can **inspect their own learner model** — see what the system believes about them, see
  every memory mutation that produced that belief, edit, redact, or erase any of it. This is a
  product-level commitment, not an admin feature.
- Every governance decision is observable; learners and educators can replay *why* the system
  surfaced a particular suggestion at a particular moment.
- "Acceleration by omission" — speeding up by skipping prerequisites — is a **governance
  violation**, not an optimization. Depth is non-negotiable.

---

## 18. Non-Goals & Boundaries

- **Not** a content marketplace, LMS, or quiz-bank product; those framings actively mislead design.
- **Not** screen-time maximizing — immersion serves understanding, not engagement-for-its-own-sake.
- The **conversational programming language**, **custom OS/hardware**, and **post-binary computation**
  visions (Grand Vision II) are *adjacent long-horizon programs*, **out of scope** for this product
  specification except where they inform the developer-experience and runtime roadmap. They are
  tracked in `spec/vision-application/` and may spawn their own product specs later.
- This spec defines **what** and **why** at the product altitude; **how** at the architecture altitude
  lives in the owning domain specs; **how** at the code altitude lives in `packages/` / `services/`.

---

## 19. Roadmap & Phasing

Product capability is sequenced on top of the COS implementation phases (see
[`spec/implementation-roadmaps/`](../implementation-roadmaps/)). Indicative phasing — **specs first**,
then implementation, for each capability:

- **Foundation (Phase 1A–1C, complete):** spec ecosystem; kernel/protocol/event/runtime specs; twelve
  foundational packages; canonical JSON Schemas; green CI.
- **Substrate (Phase 1D):** world-state graph + memory tiers; scheduler depth; deterministic
  execution engine + cognitive fibers; transport/store adapters behind `@inevitable/contracts`; OTel
  SDK at the `services/` edge. *This is the substrate that the product pillars run on.*
- **Product MVP slice (Phase 1E+):** F01 onboarding → F02 navigation → F03 prerequisite graph →
  F04 explanation → F05 memory → F14 assessment, with a minimal viable agent set
  (Supervisor, Curriculum, Explanation, Practice, Assessment, Revision, Memory) on the substrate.
- **Orchestration & ecosystem:** F06 full agent catalog → F07 real-time orchestration → F08
  interdisciplinary graph.
- **Acceleration & creation:** F10 research/innovation → F12 evolution.
- **Scale & immersion:** F11 institutional/collective → F09 immersive roadmap (AR/VR/holographic/voice).

Each feature spec carries its own MVP → advanced → frontier phasing.

---

## 20. Open Questions

- Canonical schema for the **learner model** (cognitive profile, confidence per concept, decay state)
  — to be fixed alongside the world-state graph spec in Phase 1D.
- Boundary between **DSP self-rewriting** and **evolution proposals** — when does an adaptation require
  a governed proposal vs. an in-policy live adjustment?
- **Identical/Digital-Twin** consent, portability, and lifecycle model (continuous observation) —
  highest privacy sensitivity; likely its own ADR.
- Modality-selection policy: how the system *chooses* representations (and how that choice is
  evaluated and learned).
- Offline-first / edge constraints for the Universal Accessibility Guarantee (rural/low-connectivity).
- **Cognitive Surface substrate primitive & the collaboration-vs-replay tension** — the CRDT library
  (Yjs / Automerge / Loro) and the canonical-ordering protocol that lets real-time collaboration,
  event-sourcing, and *deterministic* replay coexist. A recommended direction is captured in
  [F16](./features/F16-cognitive-surface.md) and the research dossier
  [`spec/research/cognitive-surface-frontier-research.md`](../research/cognitive-surface-frontier-research.md);
  it warrants a dedicated ADR co-owned with the world-state and events domains.

---

*This is a living document. It will be updated as features are detailed, the substrate lands, and
implementation lessons feed back. Nothing here is final; everything here is derivable, traceable, and
inevitable.*
