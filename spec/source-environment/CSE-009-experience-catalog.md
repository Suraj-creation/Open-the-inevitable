---
name: cse-experience-catalog
spec:
  id: CSE-009
  title: The Experience Catalog — Projection Archetypes of the Cognitive Source Environment
  domain: source-environment
  status: draft
  owner: product-architecture
  last_reviewed: 2026-07-09
  upstream_dependencies:
    - source-environment/CSE-004-transformations
    - source-environment/CSE-005-episodic-cognition
    - source-environment/CSE-006-living-knowledge
    - source-environment/CSE-007-source-agent-society
    - source-environment/CSE-008-source-surface-projection
    - product/features/F09-living-universe-experience
    - design/cognitive-design-language-v1
  downstream_dependencies:
    - source-environment/CSE-010-delivery
    - product/features/F15-content-ingestion-knowledge-substrate
  related_protocols: [cognitive-event-protocol]
  related_events: [surface.source.*, surface.interaction.received, surface.projection.switched]
  related_runtime_systems: [surface-session, choreographer, frame-planner]
  related_governance_systems: [governance-kernel, human-governance]
  related_observability_systems: [cognitive-observability]
  semantic_tags: [source-environment, experience, projections, ux-patterns, components]
  canonical_references:
    - source-environment/CSE-008-source-surface-projection
    - design/cognitive-design-language-v1
    - product/features/F09-living-universe-experience
---

# CSE-009 — The Experience Catalog

## 1. Purpose & Status of This Catalog

The founding draft specified ~25 UI components with layouts, docking rules, and shell chrome.
This catalog preserves their *experience law* while conforming to surface doctrine: every entry
below is a **projection archetype** — a way of realizing canonical state (events, world-state,
episodes, anchors) on a client — **not** a canonical panel. Layout, docking, and arrangement are
client concerns (D5). Each entry states: purpose, canonical substrate, interaction law, and edge
cases. Visual/motion law is CDL's (`spec/design/`); this catalog never restates it.

Experience doctrine (binding, from the draft, upgraded):

1. The source is sacred; augmentation is a toggleable layer (CSE-008 §2).
2. Everything is a workspace, not a chat window; dialogue is one tool inside it.
3. Observability is ambient — "why this?" reachable from any element (CSE-008 §7).
4. Interruption is earned, not default (CSE-007 §6).
5. Progress is capability, not completion — never a bare percentage.
6. Agency is visible and one click away at the point of relevance.

## 2. Reading & Attention Archetypes

**Living Reference** — the faithful source render with the cognitive overlay (CSE-008 §§3–6).
Raw-source toggle always available. Substrate: SourceBinding + viewport plans + highlights.

**Lens Rail** — per-paragraph margin affordance (hover/long-press) with lenses: Intuition,
Explanation, Analogy, Prerequisite, Misconception, Research, Application. Lens content opens as an
anchored popover (never a takeover); "pin to surface" promotes it into frame composition.
Substrate: anchor index + enrichment decisions on demand. Edge cases: dense proofs get a split
lens (Math + Intuition side-by-side); degraded-OCR paragraphs show a confidence badge on the rail.

**Concept Replay Rail** — jump between representations of one concept:
`Intuition — Animation — Mathematics — Derivation — Example — Practice — Misconception — Research
— Reflection`. Substrate: the transformation algebra (CSE-004 §5); missing nodes render greyed
with "generate," keeping the rail's shape constant. Visited/mastered/flagged-confusing states come
from episode history. A "surprise me" affordance jumps to the unvisited node the curiosity policy
rates highest — charged against the interruption budget only if unsolicited.

**Infinite-Zoom Knowledge Canvas** — domain navigation from field level to proof level via
semantic zoom (dots → labeled nodes → rich cards → expanded cards with lens rail). Substrate:
knowledge graph + mastery states; node saturation = evidence density, fill = mastery. Large
graphs cluster with count badges ("42 concepts") rather than rendering all nodes.

## 3. Understanding & Memory Archetypes

**Understanding Map** — capability, not completion: axes (Understanding, Reasoning, Application,
Teaching, Research, Creation) each backed by an evidence drawer listing the episodes/assessments
that produced the reading. Substrate: development state + delta history (CSE-005). Never a letter
grade or percentile; always paired with a next step.

**Reflection Journal** — per-session draft entries ("What surprised you? What's still unclear?")
the learner edits or accepts; entries link to episodes; "show how my thinking changed" projects
prior entries on the same concept. Substrate: episodes + reflections; the Curiosity Trail lives
here.

**Personal Knowledge Graph** — the learner's actual cross-source history as a graph, with a
time-lapse scrubber replaying its growth. Substrate: learner world-state + episode history.

**Cognitive Time Machine** — two modes: *Concept Timeline* (origin → milestones → current debate
→ open problems; scrub to see knowledge-as-of-then; "frontier mode" jumps to unresolved debates)
and *My Timeline* (the learner's own understanding trajectory over years). Substrate: temporal
knowledge model (CSE-006 §3.3) + delta history (CSE-005 §5). Sparse timelines collapse honestly.

**Episode Resume Card** — on reopening any source: last concept, last open confusion, days since,
what changed since (version diff + frontier updates). Substrate: CSE-005 §4.

## 4. Practice & Dialogue Archetypes

**Adaptive Worked-Example Stream** — problem cards with a visible fade state (Worked → Partially
Worked → Self-Solved) governed by the Desirable-Difficulty Governor (CSE-007 §5); learner can
always override in either direction; repeated struggle steps back framed as "want a hint?", never
demotion. Substrate: F14 assessment items + fade policy + episode outcomes.

**Self-Explanation Console** — explain-back in Text / Voice / Sketch with a live coverage
checklist of key sub-ideas; expert-structure comparison is opt-in and only after the learner's own
attempt. Voice shows live transcript; sketch supports shape recognition. Substrate: MRL
conceptual-compressions as coverage targets; results feed deltas and F14 evidence.

**Teaching Theatre** — Socratic dialogue and two-persona debate with a collapsible strategy
meta-track labeling each move ("hint," "counterexample," "reflection prompt") — expert reasoning
made visible. A "just tell me" override is always one click (Constitution #3). Substrate: dialogic
transformation (CSE-004 §3) + F06 socratic/debate agents.

**Laboratory / Cognitive Simulations** — manipulable worlds (parameter sliders → live updates)
with "reset to source example" (restores the scenario the text described, via anchors), "save
configuration" (pins to notes/research workspace), and a live "what changed and why" caption.
Substrate: simulation blocks (SRF-006) + representational transformation. Heavy compute shows an
honest compute state, never a freeze.

**Creation Panel** — creations (essays, prototypes, posters, proposals) as first-class outputs:
scoped workspaces preloaded with concept citations; finished creations feed the knowledge graph,
deltas (evidence for `Creation` stage), and the research workspace.

## 5. Exploration & Research Archetypes

**Multi-Source Alignment** — N sources concept-locked side by side, merge view, emphasis-diff
badges, explicit "not covered here" gaps (CSE-008 §10).

**Contradiction Explorer** — structured disagreement as an argument map: position cards with
Evidence / Strengths / Weaknesses / Open Questions, backed by the Claim Graph (CSE-006 §3.1).
"Take a side" drafts a learner position the Debate agent probes. **"Resolve for me" is
deliberately not offered**; value disagreements are labeled as value disagreements.

**Frontier Overlay & Research Readiness** — frontier entries render in the reserved research
channel; the readiness meter shows gap-to-research per domain as a text-first breakdown with a
"remaining gaps" list linking into the canvas; "I'm ready" self-declaration is honored (CSE-006
§5).

**Research Workspace** — the bridge from studying to contributing: Hypotheses · Notes ·
Experiments · Datasets · Citations · Argument Maps · Open Questions · Drafts; any concept card
anywhere offers "send to research workspace"; citation trails auto-populate from engaged sources.
Substrate: F10/RIL; scoped per source or merged per domain.

## 6. Presence & Governance Archetypes

**Cognitive Companion** — persistent, minimized presence; observes silently; suggestions are
dismissible cards under the shared interruption budget; full conversation only on explicit open.
On wellbeing-relevant signals it shifts to supportive tone and offers a break, never more content.

**Curiosity Engine** — timed, non-random adjacent-idea cards; "later" saves to the Curiosity
Trail; suppression states absolute (CSE-007 §6).

**Observatory** *(exists — ADR-0029)* — the live agent feed with per-row "why" expansion; CSE adds
source-scoped rows (canonicalization progress, viewport/highlight decisions, sync triggers).

**Agent Theater** — the society view: agents as nodes, negotiation as animated edges
("Reflection → Misconception: confusion signal passed"); click an edge for the plain-language
payload; per-agent toggle right there. Substrate: a projection over blackboard/orchestration
events — no new state. Conflict states surface explicitly.

**Human Sources** — connected people/communities with per-person permission scopes, session
timelines, and "link this conversation to [concept]" tagging (utterance anchors). Never
auto-ingested; consent per CSE-002 §8.

**Governance & Privacy Center** — What's Remembered (episode toggles; "forget" is real deletion
with cascade) · Which Agents Are Active · What Evidence Is Accepted (source trust) · What's Shared
for Aggregate Improvement (opt-in, plain-language, CSE-006 §7) · Audit Trail · Export Everything.
Every toggle takes effect immediately with visible confirmation.

**Onboarding** — principles before features: Principle Zero plainly stated; a two-minute live
demo of dynamic synchronization on a sample paragraph; a one-screen Constitution summary linking
to the Governance Center; first-source prompt. Every screen skippable — disclosed, never gated.

**Progressive Cognitive Modes** — learner-declared intent (`Observe → Understand → Visualize →
Practice → Apply → Teach → Research → Create`) reweighting which archetypes and agents are
emphasized. System-suggested switches require one-tap confirmation, never auto-switch. Substrate:
extends `surface.mode.set`.

## 7. Cross-Cutting Experience Patterns

- **Synchronization mechanics** — CSE-008 §6; citation markers re-trigger bindings; learner
  scroll always cancels pending motion.
- **Provenance affordances** — every generated statement and every projection carries an anchored
  "why" popover with a "full trace in Observatory" link (never navigates away).
- **Interruption throttling** — one shared budget, CSE-007 §6; suppressed items logged, never
  discarded.
- **Learning-state adaptation** — inferred states (exploring/confused/overloaded/confident/…)
  adapt pace and modality; every adaptation carries a visible "adjusted because…" tag.
- **Empty/loading/error honesty** — the pipeline loading state narrates real stages
  ("Understanding structure… Mapping concepts… Checking contradictions with your other sources…")
  so waiting teaches; failures state plainly what could and couldn't be processed; empty library
  offers a guided example source.
- **Accessibility** — CSE-008 §11 requirements apply to every archetype; Concept Replay, Teaching
  Theatre, and Self-Explanation are touch-first on small viewports; canvas and simulations offer
  an "essentials" rendering rather than a cramped squeeze.
- **Modals** — at most one true modal at a time; everything else is anchored popovers, preserving
  spatial context.

## 8. Open Questions

- Which archetypes are CSE-P1-critical vs. later (proposal in CSE-010 §3).
- Sketch-mode recognition scope for the Self-Explanation Console (freehand + basic shapes first).
- Whether Progressive Modes fold into the existing `surface.mode.set` enum or a parallel
  learner-intent field — decide with `surface/` owners at implementation.
