---
name: cse-cognitive-interaction-grammar
spec:
  id: CSE-014
  title: The Cognitive Interaction Grammar — Interaction as Cognitive Intent
  domain: source-environment
  status: draft
  owner: product-architecture
  last_reviewed: 2026-07-10
  upstream_dependencies:
    - source-environment/CSE-008-source-surface-projection
    - source-environment/CSE-011-cognitive-director
    - source-environment/CSE-012-cognitive-scene
    - architecture-decisions/ADR-0024-surface-interaction-protocol
    - architecture-decisions/ADR-0033-the-cognitive-theater
    - surface/surface-streaming-sync-protocol
    - kernel/governance-kernel
  downstream_dependencies:
    - source-environment/CSE-009-experience-catalog
    - source-environment/CSE-016-creative-cognition
    - indexes/event-index
  related_protocols: [cognitive-event-protocol, cognition-packet-protocol, memory-mutation-protocol]
  related_events: [surface.interaction.received, surface.interaction.applied, surface.intent.expressed, surface.scene.evolved]
  related_runtime_systems: [surface-session, proposal-blackboard, cognitive-scheduler]
  related_governance_systems: [governance-kernel, capability-envelope]
  related_observability_systems: [cognitive-observability, reasoning-trace]
  semantic_tags: [source-environment, interaction, cognitive-intent, mixed-initiative, gestures, input-grammar]
  canonical_references:
    - architecture-decisions/ADR-0024-surface-interaction-protocol
    - source-environment/CSE-011-cognitive-director
    - source-environment/CSE-007-source-agent-society#6
---

# CSE-014 — The Cognitive Interaction Grammar

## 1. Purpose

Elevates ADR-0024's seven interaction kinds into a full **semantic interaction grammar**: every
act a learner performs on the surface is typed **cognitive intent** delivered to the Director
(CSE-011) and the blackboard — never UI manipulation. Interactions manipulate *cognition*; the
Scene (CSE-012) is how that manipulation becomes visible. This is the fourth Theater organ
(ADR-0033).

## 2. Philosophy

- **Interaction is expression, not control.** When a learner circles a term, they are not drawing
  a shape — they are saying *"this, explain this."* The grammar captures the cognitive intent and
  routes it; the surface responds cognitively, not mechanically.
- **Input has meaning at every granularity.** Hover, pause, and dwell are as meaningful as an
  explicit "ask deeper." Passive signals feed the affect/attention channel (CSE-011 §3.3); active
  gestures feed the blackboard.
- **The learner always wins** (ADR-0033 L5). Any interaction pre-empts pending directives, shots,
  and actor motion; the Director re-plans around the learner rather than fighting them.
- **Governed like any input.** Every interaction is capability-checked and evented before it
  changes cognition (ADR-0024 discipline preserved).

## 3. Primitives — The Interaction Vocabulary

An **Interaction** is `{ interaction_id, kind, target_anchor_ref, args?, modality, cognitive_intent,
timestamp_hlc }`. `target_anchor_ref` uses the Source Anchor (CSE-002 §5) or an actor/MCCR element
ref, so intent always points at *something specific*. Grammar (extensible registry), grouped by
intent class:

| Class | Primitives | Cognitive intent → routed to |
|---|---|---|
| **Attend** (passive) | `hover`, `long-hover`, `pause`, `dwell`, `focus`, `blur` | affect/attention channel (CSE-011 §3.3); may trigger a lens/peek |
| **Mark** | `highlight`, `circle`, `underline`, `annotate`, `pin` | creates learner anchors/annotations (CSE-008 §5.1), committed via memory mutation |
| **Ask** | `ask-why`, `ask-again`, `ask-simpler`, `ask-deeper`, `ask-example`, `define` | enrichment proposal at the target anchor (CSE-007 §4); may evolve the Scene in place (CSE-012) |
| **Reason** | `compare`, `challenge`, `prove`, `debate`, `counter` | Claim Graph / Contradiction / Teaching Theatre (CSE-006, CSE-009) |
| **Express** | `teach-back`, `think-aloud`, `sketch`, `predict` | Self-Explanation / creation (CSE-009 §4, CSE-016); feeds Understanding Deltas |
| **Navigate** | `explore`, `jump`, `branch`, `expand`, `collapse`, `align` | Director + timeline/graph (CSE-011, CSE-008 §10) |
| **Govern flow** | `interrupt`, `slow-down`, `speed-up`, `go-normal`, `resume-guide` | Director pacing (CSE-011); `interrupt` = cooperative cancellation |

`cognitive_intent` is the typed interpretation (e.g. `ask-simpler` → `reduce-abstraction at anchor
X`), produced deterministically from kind+target+args (model only for free-text asks, D3-recorded).

## 4. Architecture

- Interactions arrive through the SRF-005 client→runtime command path (extending ADR-0024's
  envelope with the new kinds). The runtime governs (capability check), emits
  `surface.interaction.received`, interprets to `cognitive_intent` (`surface.intent.expressed`),
  and routes:
  - **Attend** → affect/attention channel (no immediate visible effect unless it crosses a lens/peek
    threshold).
  - **Mark/Express** → memory mutations (annotations, self-explanations) + possible Scene delta.
  - **Ask/Reason** → blackboard enrichment proposals → Enrichment Decision (CSE-007 §4) → Scene
    delta or new frame.
  - **Navigate/Govern flow** → Director directive re-plan (CSE-011 §5).
- `surface.interaction.applied` records the realized effect (`cancelled | refocused | dispatched |
  reprojected | scene-evolved | annotated`), closing the loop (ADR-0024 pattern, extended).
- **In-place vs. new frame** is decided as in CSE-012 §4: a bounded ask evolves the current Scene;
  a topic move opens a new frame. Interactions default to *staying in the Scene* to preserve
  spatial stability.

## 5. Runtime Semantics, Governance & Determinism

- Every interaction is capability-gated (`interact.<kind>`); untrusted or out-of-scope interactions
  degrade honestly (evented refusal), never silently.
- Passive Attend signals are aggregated (not one event per pixel of hover) into affect updates on a
  throttle; they are opt-out with the affect channel (CSE-005 §7).
- **Determinism:** interaction events are canonical and folded; free-text ask interpretation records
  before use (D3); replay reproduces the exact interaction history and its effects.
- Learner-authored marks/annotations are durable memory (mutations), survive re-render and version
  migration (anchored, CSE-002 §5.4), and feed episodes/deltas (CSE-005).

## 6. Cognitive Transparency & Observability

Every interaction's routing is inspectable: *"I asked simpler — what did the system do and why?"*
resolves to the intent interpretation, the enrichment decision it triggered, and the Scene delta
it produced (CSE-007 transparency). Telemetry: interaction frequency by class, intent-interpretation
accuracy (against learner correction), pre-emption rate (how often learners override directives —
a healthy agency signal, CSE-010 metrics), teach-back/think-aloud volume (independent-capability
signal).

## 7. Failure Semantics

| Failure | Behavior |
|---|---|
| Free-text ask uninterpretable | Fall back to a plain `ask-why` at the anchor; never guess a wrong intent |
| Interaction targets an unstable/orphaned anchor | Route to preserved-quote context (CSE-008 §12); evented |
| Capability denied | Honest evented refusal + explanation; no silent drop |
| Interrupt arrives mid-generation | Cooperative cancellation at next safe yield (ADR-0024); partial work discarded cleanly |
| Passive-signal flood | Throttled/aggregated; never overwhelms the affect channel or the event log |

## 8. Open Questions

- Sketch/draw recognition scope (freehand + shapes first; math-ink and diagram recognition later).
- Whether `think-aloud` (continuous voice) needs a distinct streaming interaction path vs. batched
  self-explanation — likely streaming for the Teaching Theatre; decide with CSE-009.
- Multi-modal interaction fusion (gaze + voice + gesture) for immersive projections (F09 frontier)
  — coordinate with CDL v3 interaction language.
