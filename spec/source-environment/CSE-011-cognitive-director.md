---
name: cse-cognitive-director
spec:
  id: CSE-011
  title: The Cognitive Director — Cross-Scale Cognitive-State Orchestration
  domain: source-environment
  status: draft
  owner: product-architecture
  last_reviewed: 2026-07-10
  upstream_dependencies:
    - source-environment/CSE-005-episodic-cognition
    - source-environment/CSE-007-source-agent-society
    - source-environment/CSE-008-source-surface-projection
    - product/features/F07-realtime-cognitive-orchestration
    - product/features/F14-assessment-mastery-depth
    - architecture-decisions/ADR-0033-the-cognitive-theater
    - architecture-decisions/ADR-0025-cognitive-ensemble-orchestration
    - architecture-decisions/ADR-0026-research-mode-and-readiness-gating
    - architecture-decisions/ADR-0027-cognitive-evaluation-layer
    - architecture-decisions/ADR-0021-governed-self-evolution
    - kernel/intent-lease
  downstream_dependencies:
    - source-environment/CSE-012-cognitive-scene
    - source-environment/CSE-013-knowledge-cinematography
    - source-environment/CSE-014-cognitive-interaction-grammar
    - indexes/event-index
  related_protocols: [cognition-packet-protocol, cognitive-event-protocol, reasoning-trace-protocol, intent-lease-protocol]
  related_events: [surface.director.directive, surface.director.state.entered, surface.director.pacing.set, surface.director.rationale, surface.affect.observed, surface.attention.budgeted]
  related_runtime_systems: [cognitive-scheduler, universal-cognitive-bus, proposal-blackboard, world-state-graph, evolution-engine]
  related_governance_systems: [governance-kernel, human-governance, capability-envelope]
  related_observability_systems: [cognitive-observability, reasoning-trace, learner-outcome-telemetry]
  semantic_tags: [source-environment, cognitive-director, orchestration, pacing, cognitive-state, temporal-scale, affect, attention-economy]
  canonical_references:
    - architecture-decisions/ADR-0033-the-cognitive-theater
    - source-environment/CSE-007-source-agent-society#4
    - design/cognitive-design-language-v1#4
---

# CSE-011 — The Cognitive Director

## 1. Purpose

The Director is the organ that owns one question: **"what cognitive state should this learner
enter next, and at what pace?"** — across every temporal scale, from the next ten seconds to the
next ten years. It is the missing conductor above the surface's four tactical orchestrators
(Supervisor routing, arbiter enrichment, FramePlanner pacing, Choreographer timing). It reasons
about the *arc* of understanding; the other organs realize each step of that arc. The Director
never renders — it conducts (ADR-0033 L1).

## 2. Philosophy

- **Teaching is direction, not delivery.** A great teacher decides *when* to reveal, *when* to
  let a learner struggle, *when* to fall silent, *when* to recap, *when* to push toward the
  frontier. These are state decisions, not content decisions. The Director makes them explicit,
  inspectable, and governed.
- **The CDL names the states; the Director drives the transitions.** The design language already
  gives each cognitive state a hue (learning, discovery, practice, assessment, research,
  reflection, mastery — CDL §4). Nothing in the system decides *when to move between them* on
  pedagogical grounds. That decision is this spec.
- **Pace against two budgets.** Every directive is bounded by *cognitive cost* (model/agent
  tokens) and *attention cost* (the learner's finite, depletable focus). Silence and stillness
  are first-class outputs (ADR-0033 L6).
- **Desirable difficulty over frictionless flow.** The Director deliberately schedules struggle,
  retrieval, and generation inside the zone of proximal development — the opposite of minimizing
  effort (CSE-007 §5 governor is its instrument).

## 3. Primitives

### 3.1 Cognitive States

The state space the Director navigates (aligned to CDL hues; extensible):

`orienting · learning · exploring/discovery · practicing · struggling · consolidating/reflecting
· assessing · recovering · researching · creating · mastering · resting`.

Each state declares: entry conditions, exit conditions, the enrichment posture it favors (CSE-007),
the cinematography register it favors (CSE-013), and its default pacing envelope.

### 3.2 The Cognitive Directive

The Director's only output — a typed intent the downstream organs execute *within*:

```json
{
  "directive_id": "dir_...",
  "scale": "moment | concept | lesson | module | domain | research_program | lifetime",
  "target_state": "one of §3.1",
  "pacing": { "tempo": "slow | measured | brisk", "dwell_hint_ms": 0, "silence": false },
  "intensity": "gentle | normal | demanding",
  "focus": { "concept_ref": "...", "source_anchor_ref": "..." },
  "rationale": "learner-readable reason",
  "considered": [{ "alternative_state": "...", "rejected_because": "..." }],
  "evidence_refs": ["episode/delta/evaluation refs that justified this"],
  "confidence": 0.0,
  "intent_lease_ref": "the (nested) lease this directive runs under"
}
```

`pacing.dwell_hint_ms` is a *hint*, never a canonical playback clock (ADR-0007). `considered` and
`evidence_refs` make the directive inspectable (ADR-0033 L4, CSE-007 transparency).

### 3.3 The Affective / Attention Channel

The Director consumes a typed signal stream — never covertly, never scored against the learner:

```json
{
  "affect_state": "engaged | curious | frustrated | overloaded | bored | fatigued | confident",
  "attention_budget": { "remaining": "high|medium|low|depleted", "session_minutes": 0 },
  "signals": ["behavioral evidence refs (dwell, rewind, error rate, self-explanation quality)"],
  "source": "behavioral-inference | learner-declared",
  "confidence": 0.0
}
```

Behavioral inference reuses F06's Learning-State Detection. Learner-declared check-ins ("I'm lost",
"go faster") are first-class and outrank inference. Emitted as `surface.affect.observed` /
`surface.attention.budgeted`; both are learner-visible (Understanding Map, CSE-009) and opt-out
(CSE-005 §7). Wellbeing signals (frustration/fatigue spikes) route to the Health/Companion posture
(CSE-007), which offers a break, never more content.

## 4. Architecture — The Nested Direction Loop

The Director runs a hierarchy of loops, one per temporal scale, each holding a nested Intent Lease:

```
lifetime lease        → the learner's long arc (domains, research trajectory)   [CSE-005 dev ladder]
  research_program     → a body of open questions (RIL, ADR-0026)
    domain             → a subject's concept graph (KG)
      module/course    → a sequenced set of lessons
        lesson         → one sitting's arc
          concept      → FramePlanner territory (ADR-0030)
            moment     → Choreographer/Scene territory (this ask)
```

Each loop, on each tick, computes a Directive from: current + target development stage (CSE-005),
episode history and Understanding Deltas, evaluation scorecards (ADR-0027), the affect/attention
channel (§3.3), readiness gates (ADR-0026), and the interruption/attention budget (CSE-007 §6).
**Higher scales constrain lower ones:** a `lifetime` directive toward "adaptive expertise" biases
the `lesson` loop toward under-specified problems; a `low attention_budget` at the `session` scale
forces the `moment` loop toward consolidation or rest. Directives flow *down*; realized outcomes
and affect flow *up*.

The Director publishes Directives to the blackboard; the Supervisor, FramePlanner, Enrichment loop
(CSE-007 §4), and Cinematographer (CSE-013) **subscribe and realize within** — they never override
a Directive silently; a downstream organ that cannot honor a Directive publishes a conflict
(surfaced, not hidden — ADR-0025 disagreement path).

## 5. Runtime Semantics

- The Director is a cognitive unit (manifest, identity, envelope). It reads learner/world state
  under context leases and holds the scale leases in §4.
- **Determinism.** Directive computation that uses models records outputs before use (D3); replay
  folds recorded directives and never re-derives. The behavioral heuristics are pure functions of
  recorded signals.
- **Pre-emption.** A learner interaction (CSE-014) or a hard affect signal ("I'm lost") interrupts
  the current Directive at the next safe boundary; the Director re-plans (emits a superseding
  Directive with `considered` naming what it abandoned and why).
- **Idempotent scales.** Re-entering a scale loop after restart re-derives the current Directive
  from folded state — no Director state lives outside events.

## 6. Event Subfamily — `surface.director.*` (proposed, additive under `surface`)

| Event | Emitted when | Payload core |
|---|---|---|
| `surface.director.directive` | a Directive is issued | full Directive (§3.2) |
| `surface.director.state.entered` | the learner is judged to have entered a target state | scale, state, evidence_refs |
| `surface.director.pacing.set` | pacing/intensity changed without a state change | tempo, intensity, reason |
| `surface.director.rationale` | expanded rationale requested for the Observatory | directive_id, considered[], evidence_refs |
| `surface.affect.observed` | an affect/attention signal was recorded | affect_state, attention_budget, source, confidence |
| `surface.attention.budgeted` | the attention budget was (re)computed | remaining, session_minutes |

## 7. Observability & Cognitive Transparency

Every Directive is answerable: *"why this state, why now, why this pace, what did you consider,
who informed it, how sure are you?"* resolves from the Directive's `rationale` / `considered` /
`evidence_refs` / `confidence` in the Observatory and Agent Theater (CSE-009). Telemetry: directive
volume per scale, state-transition distribution, silence rate, attention-budget accuracy, affect
detection precision (against learner-declared ground truth), realized-vs-directed drift (how often
downstream organs could not honor a Directive).

## 8. Governance & Evolution

- The affect channel is opt-in and learner-visible; disabling it drops the Director to
  behavioral-only pacing (still functional).
- The Director's **policy** — state-transition weights, pacing envelopes, difficulty scheduling —
  adapts only through Evolution Proposals (ADR-0021): proposed → shadow-tested against synthetic
  learners → governance-approved → rolled out via `LiveEvolutionConfig`. No silent pacing drift.
- Directives never override the learner's explicit agency (a "just teach me normally" request
  pins the Director to neutral pacing — Constitution #3).

## 9. Failure Semantics

| Failure | Behavior |
|---|---|
| Affect signal unavailable/low-confidence | Fall back to behavioral inference, then to neutral pacing; never guess an emotional state |
| Downstream organ cannot honor a Directive | Conflict surfaced (ADR-0025); Director re-plans or degrades to the last honorable Directive |
| Evaluation/readiness inputs missing | Directive issued at reduced confidence; risky transitions (e.g. → research) withheld until evidence exists |
| Attention budget depleted mid-lesson | Director forces consolidation/rest directive; suppresses all unsolicited enrichment (CSE-007 §6) |
| Director itself errors | Surface degrades to pre-Director behavior (Supervisor + FramePlanner alone); evented; no learner-facing break |

## 10. Open Questions

- FSM vs. learned policy for state transitions (proposed: authored FSM first; evolve weights only
  under ADR-0021).
- Attention-budget model: session-time heuristic vs. a depletion model informed by task difficulty
  and affect — start heuristic.
- Whether `lifetime`/`research_program` scales belong to the Director or to a distinct
  long-horizon planner in RIL (F10) — joint decision at CSE-P-Theater; leaning: Director owns the
  loop, RIL supplies the research goal set.

## 11. Implementation status (R2, ADR-0057)

The Director FSM is built (authored, replay-safe) and its directive drives the stage tint + the
"why this pace" affordance. Until R2 its `focus.source_anchor_ref` (§4, the directive schema) was
structurally `null` — the organ meant to choose the pedagogically-meaningful region never pointed at
one. **R2 fulfils §4**: `decideDirective` now sets `source_anchor_ref` to the focus concept's
resolved anchor, and an expert-gaze ranking (model-backed, lexical fallback) chooses the MOST
meaningful region rather than lexical top-2 — the Director selecting where the learner's attention
goes, as specified. **R3b** then makes the pacing channel real: the client's playback hold between
segments is derived from the directive's `pacing` (tempo scales the teacher's-pause; `silence: true`
holds the surface deliberately still even on an unmarked segment — CSE-011 §9), replacing the fixed
1400 ms constant. **R3e** then lit up the attention channel: `emitTheaterForFrame` now PRODUCES
`surface.attention.budgeted` (a session-time heuristic over frames composed, §10's "start
heuristic") — the slice was folded but never emitted — and the web renders the sensed affect + a low
budget as a learner-visible, opt-out chip (§8/§3.5; affect is behavioral inference, never a hidden
score). **Deferred:** the full depletion model informed by task difficulty + affect (§10); the
model-backed expert-gaze region ranking (R2 deferral).
