# ADR-0038: Cognitive Theater T1 — the Director conducts, Scenes wrap frames

**Status:** Accepted
**Date:** 2026-07-11
**Related:** ADR-0033 (the Cognitive Theater — the four organs and binding locks L1–L6),
CSE-011 (Director), CSE-012 (Scene), ADR-0030 (frames/MCCR/narration — the substrate this wraps),
ADR-0007 (choreography/no-clock law), CSE-005 (development state, affect), SRF-002 (schema 1.8.0),
blueprint M7 (T1)

## Context

ADR-0033 adopted the Cognitive Theater as four organs — Director (time), Scene (space),
Cinematography (motion), Interaction Grammar (audience-as-actor). It is deliberately large. M7
lands the **first tranche (T1): the two organs that change the architecture** — the Director and
the Scene — leaving Cinematography (CSE-013) and the full Interaction Grammar (CSE-014) for M8,
where they have real shots and interactions to act on. Three decisions fix T1's shape.

## Decisions

### 1. The Director is an authored pedagogy FSM, deterministic and replay-safe (T1)

CSE-011 §10 and ADR-0033's open question both resolve to **"authored FSM first, evolve weights
only under ADR-0021."** T1 honors that literally: the Director's directive computation is a
**pure function of folded surface signals** — current mastery, depth-gate outcomes,
prerequisite descents, research frontiers, and the affect channel — not a model call. This makes
every Directive deterministic (replay folds recorded directives; the FSM re-derives identically),
keeps the new control loop cheap, and defers learned policy to a governed evolution increment.

The T1 state space (a subset of CSE-011 §3.1, aligned to CDL hues):
`orienting · learning · practicing · struggling · consolidating · assessing · mastering`. The
scale is `concept` (the ask's territory); the nested lifetime/module loops (CSE-011 §4) are a
named later increment. The **affect channel** (CSE-011 §3.3) is T1-live but behavioral-only:
`inferAffect` maps recorded signals to `{engaged, confident, frustrated, overloaded}` — a
depth-gate failure or prerequisite descent reads *frustrated/struggling*; clean passes read
*confident*; learner-declared check-ins (M8, CSE-014) will outrank inference when they land.
Silence/stillness is a first-class directive output (ADR-0033 L6): a directive may set
`pacing.silence` with no state change.

### 2. Scenes wrap frames additively — a Scene with no evolution is byte-identical to a frame (L2)

Per ADR-0033 L2, T1 does **not** replace the `surface.frame.*` family. When the composer produces
a frame *and* the Director assigns it a target state, the session additionally emits
`surface.scene.opened` (wrapping `surface.frame.composed`) with the frame's MCCR elements as
**actors** and an initial **lighting** (focal actor = the protagonist, CDL state = the directive's
target state). Actors reuse MCCR element ids + the `source_viewport` (CSE-008) — the Scene composes
existing content, it invents no new storage (CSE-012 §2). A 1.7.0 log with no scene events folds
to the identical frame view. The **evolution channel** (`surface.scene.evolved` scene deltas)
lands its first path in T1 — a Director-caused `lighting.change`/`reveal` — while
interaction-caused deltas (circle, annotate, ask-here) arrive with the CSE-014 grammar in M8.

### 3. One additive event subfamily pair at schema 1.8.0; the Director never renders (L1)

`surface.director.*` and `surface.scene.*` join `surface` at schema **1.8.0**, additive and
replay-preserving. The Director's only output is the typed **Directive** (target state, pacing,
intensity, rationale, considered alternatives, evidence refs, confidence — CSE-011 §3.2); it
contains **no presentation** (L1). The web surface *realizes* a directive by tinting the board to
the target state's CDL hue and offering a "why this pace" affordance over the rationale — a client
projection, exactly as playback timing is (ADR-0007/L3). All directives, scenes, actors, deltas,
and affect signals are folds; no wall-clock, no `active_scene_id` in canonical state.

## Consequences

- The surface gains its missing conductor: a `latest_directive` fold slice the composer and the UI
  read, and an affect channel that makes the learner's cognitive state legible (feeding the
  Understanding Map, CSE-009, alongside M6's episodes).
- Backward compatibility is total: `theater` is a session dep flag (gateway on; CLI/tests off), so
  every existing frame test folds byte-identically (L2 proven by the unchanged suite).
- The FSM's transition weights and pacing envelopes are the **only** thing that later evolves, and
  only through ADR-0021 proposals — no silent pacing drift (CSE-011 §8).
- Deferred with named scope: the nested lifetime/module/domain Director loops (CSE-011 §4); the
  cinematography shot grammar (CSE-013); interaction-caused scene deltas + the ~25-primitive
  grammar (CSE-014); learner-declared affect check-ins; CDL v3's non-visual channels.

## Rejected

- A model-backed Director in T1 (would make directives non-deterministic and add latency before
  the FSM has proven its shape; CSE-011 §10 explicitly sequences FSM-first).
- A separate `scene` event family (would fork the fold and break replay of every frame session —
  ADR-0033 rejected this; scenes extend `surface.frame.*` additively).
- Emitting scenes/directives always-on (would change every existing session's byte-for-byte fold;
  the `theater` flag preserves L2 until the UI consumes them).
