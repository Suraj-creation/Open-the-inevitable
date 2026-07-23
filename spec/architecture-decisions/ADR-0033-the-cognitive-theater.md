# ADR-0033: The Cognitive Theater — Director, Scene, Cinematography, and Interaction

**Status:** Accepted
**Date:** 2026-07-10
**Related:** ADR-0030 (frames/MCCR/narration), ADR-0024 (surface interaction protocol), ADR-0007
(choreography), ADR-0025 (ensemble orchestration), ADR-0018 (proposal blackboard), ADR-0021
(evolution), ADR-0027 (evaluation), ADR-0032 (CSE domain), CSE-005/007/008, the CDL
(`spec/design/`), F04, F07, F09

## Context

ADR-0030 gave the surface **Cognitive Frames**: a concept is decomposed into viewport-complete
frames, each carrying a Minimal Complete Cognitive Representation (MCCR) on the board and a
separate narration script. This was a major advance over scrolling blocks. But a founder review
of the live product surfaced a structural ceiling: **the surface still behaves like a beautifully
narrated slide deck, not a place the learner inhabits.** Four gaps, each real:

1. **No conductor across time.** Four subsystems orchestrate, all tactical: the Supervisor routes
   one cycle; the arbiter enriches one frame; the FramePlanner paces within one concept; the
   Choreographer times within one frame. **Nothing decides what cognitive *state* the learner
   should enter next** across concept → lesson → chapter → domain → research program → lifetime.
   The CDL already *names* the cognitive states (learning, discovery, practice, assessment,
   research, reflection, mastery) as hues — but nothing *drives transitions between them* on
   pedagogical grounds (pacing, silence, desirable difficulty, struggle, recap, readiness).

2. **Frames are advanced, not inhabited.** A frame is composed, narrated, and superseded. It does
   not *evolve in place* under the learner's attention, questions, and manipulation. The unit is a
   slide, not a living space.

3. **Motion is styling, not grammar.** The CDL has motion verbs and ADR-0007 has choreography,
   but there is no *cinematic language of understanding* — semantic zoom, macro-to-micro,
   spotlight, dissolve, orientation shots — treated as pedagogy rather than decoration.

4. **Interaction is shallow.** ADR-0024 defines seven interaction kinds. Real cognition involves
   dozens of acts — hovering, circling, annotating, asking-simpler, proving, teaching back,
   thinking aloud — each of which should communicate *cognitive intent* to the orchestrator, not
   manipulate a UI.

These are not four features. They are one architecture: a **theater of cognition** with a
director (time), a stage (space), a camera (motion), and an audience that is also an actor
(interaction).

## Decision

Adopt the **Cognitive Theater** as the organizing architecture for how cognition is orchestrated
and experienced on the surface, specified across four new CSE specs and realized as an evolution
of — never a replacement for — the ADR-0030 frame substrate. The Theater has four organs:

1. **The Cognitive Director (CSE-011).** A new orchestration organ that owns the question *"what
   cognitive state should this learner enter next, and at what pace?"* across every temporal scale
   (moment → concept → lesson → module → domain → research program → lifetime). It emits a typed
   **Cognitive Directive** (target state, pacing, intensity, rationale) that the Supervisor,
   FramePlanner, and Enrichment loop execute *within*. It consumes learner development state
   (CSE-005), episode history, evaluation signals (ADR-0027), an **affective/attention channel**
   (new), and the interruption budget (CSE-007). It never renders; it conducts.

2. **The Cognitive Scene (CSE-012).** The frame elevated to a **living, inhabitable space**. A
   Scene has **actors** (diagrams, equations, video, simulations, images, overlays, voice — as
   choreographed cognitive elements, not widgets), **lighting** (attention + CDL state), and
   **evolution** (learner interaction and agent contribution mutate the Scene *in place* via
   scene deltas, without necessarily a new ask). A Scene is still a fold over events; MCCR remains
   its persistent skeleton; layout remains non-canonical.

3. **Knowledge Cinematography (CSE-013).** A first-class **shot grammar of understanding** binding
   CDL motion verbs and CSE-008 viewport plans into pedagogical camera moves (semantic zoom, pan,
   focus, reveal, dissolve, morph, split, merge, spotlight, orientation, macro-to-micro). Every
   shot is chosen for a cognitive reason, recorded as a decision, and realized client-side —
   canonical state carries logical shots and order, never a playback clock (ADR-0007 law extended).

4. **The Cognitive Interaction Grammar (CSE-014).** A semantic interaction vocabulary (~25
   primitives) elevating ADR-0024. Every interaction is typed **cognitive intent** delivered to
   the Director and blackboard — never UI manipulation. Interactions mutate cognition; the Scene
   is how that mutation becomes visible.

Binding locks:

- **L1 — The Director conducts; it does not render.** No Directive contains presentation. It names
  a target cognitive state, pacing, and intensity with rationale; downstream organs realize it.
- **L2 — Frames are not discarded.** A Scene is an ADR-0030 frame with an evolution channel; MCCR
  is the Scene's skeleton; the `surface.frame.*` family remains and gains additive scene events.
  A Scene with no evolution is byte-identical to today's frame (backward compatibility).
- **L3 — Everything is still a fold.** Scene deltas, shots, directives, and interactions are all
  event-sourced and replayable; layout, camera timing, and playback remain client projections
  (D5/ADR-0007). No wall-clock in canonical state.
- **L4 — Every pedagogical decision is inspectable.** Directives, shot choices, actor entrances,
  and enrichment decisions carry rationale, rejected alternatives, contributing/dissenting agents,
  evidence, and confidence (deep cognitive transparency, CSE-007 deepened).
- **L5 — The learner always wins.** Any learner interaction pre-empts pending directives, shots,
  and actor motion; the Director re-plans rather than fighting the learner (CSE-014, CSE-008 §6).
- **L6 — Silence and stillness are first-class outputs.** The Director may choose *no state
  change*, no shot, no new actor; the interruption budget (CSE-007) governs unsolicited motion
  exactly as it governs unsolicited content.

The CDL is extended to cover the Theater's non-visual channels (audio, spatial, attention,
emotional pacing, temporal rhythm, transition grammar) as **CDL v3 scope** (proposed; owned by
`spec/design/`), so the Theater has a design language for cognition, not just for pixels.

## Alternatives Considered

- **Keep frames; add features piecemeal (a richer FramePlanner, more interaction kinds).**
  Rejected: it would bolt cross-temporal pacing onto a frame-local planner and grow the same
  slide-deck ceiling. The Director is a distinct altitude of orchestration and must be its own
  organ.
- **Rename "frame" to "scene" with no new semantics.** Rejected as vocabulary theater: the value
  is the *evolution channel* (in-place mutation) and the actor/lighting model, not the word.
- **Put the Director in `spec/orchestration/` as a generic director.** Rejected for now: its
  inputs (development state, affect, readiness, pedagogy) are learning-specific; it belongs in the
  CSE domain with tight links to orchestration. A future generalization can lift it.
- **Make cinematography purely a CDL concern.** Rejected: shot *selection* is pedagogy (a CSE
  decision); shot *rendering* is design (CDL). CSE-013 owns the grammar and selection; CDL v3 owns
  the rendering vocabulary.
- **Replace the ADR-0030 frame events with a new scene family.** Rejected: it would break replay
  of every existing session and duplicate the fold. Scenes extend the frame family additively.

## Conformance to the ten invariants (blueprint §25.4)

1. Director, Scene, and interaction coordination flow through the blackboard and typed events — no
   direct agent calls (CSE-011 §5, CSE-014 §5).
2. Any learner interaction or scene state the Director persists writes via Memory Mutation
   (CSE-014 §7, CSE-012 §7).
3. A learning journey the Director conducts holds an Intent Lease; long arcs (lesson, module) are
   nested leases (CSE-011 §4).
4. Director and Scene reads of learner/world state are Context-Leased (CSE-011 §4).
5. Actor side effects (playing video, running a simulation, generating media) are governed tool /
   model invocations (CSE-012 §6).
6. The Director and any Scene actor unit runs with manifest, identity, and envelope (CSE-011 §5).
7. The Director's *own* policy adaptation (pacing heuristics, state-transition weights) evolves
   only through Evolution Proposals (CSE-011 §8, ADR-0021).
8. Directives and shots that surface claims require the underlying content's evidence (CSE-012 §7).
9. Directives, scene deltas, shots, and interactions are all event-sourced; camera timing and
   layout are explicitly non-canonical (L3).
10. The Director and Scene organs ship observability contracts: every directive and shot carries
    rationale + rejected alternatives (L4, CSE-007 deepened).

## Consequences

**Positive.** The surface gains the missing conductor and stops being a slide deck: learners
inhabit evolving scenes, guided by cinematic attention, acting on cognition through a rich
semantic grammar, paced by a director that reasons across their whole learning life. Every
pedagogical decision becomes inspectable. All four organs are compositions over existing
substrate (blackboard, folds, leases, evaluation, evolution) — no new infrastructure, replay
preserved, backward-compatible with today's frames.

**Costs / risks.** Four new specs plus deepenings must stay coherent with `surface/` and the CDL;
the Director introduces a genuinely new control loop whose pacing heuristics need real usage data
(mitigated: conservative defaults, evolution-governed tuning, silence as default); the affective
channel raises privacy stakes (mitigated: learner-visible, opt-in, never covertly scored —
CSE-005/007); the Scene evolution channel adds a new event subfamily and a new class of replay
tests.

**Traceability.** New specs CSE-011…CSE-014 (+ CSE-015 fusion, CSE-016 creation authored
alongside); deepenings to CSE-002/005/006/007/008; CDL v3 proposal; ADR-0034 (backend) and the
CSE implementation roadmap sequence the build. Indexes, taxonomy, and ecosystem map updated.

## Open Questions

- The Director's state-transition model: hand-authored pedagogy FSM first vs. learned policy under
  evolution governance (proposed: FSM first, evolve weights only via ADR-0021).
- Affective signal sourcing: behavioral inference only vs. optional explicit learner check-ins vs.
  (far future, consented) sensor input — CSE-005 open question.
- Whether the Scene evolution channel needs CRDT semantics for multi-learner co-presence, or
  server-authoritative deltas suffice at first (defer to the co-presence phase; dossier risk #2
  favors server-authoritative first).
- Cinematography reduced-motion equivalence: every shot must have a discrete non-animated
  realization (CSE-013 §6) — needs a conformance test harness.
