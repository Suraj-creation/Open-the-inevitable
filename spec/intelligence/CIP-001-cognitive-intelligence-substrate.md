---
name: cip-cognitive-intelligence-substrate
spec:
  id: CIP-001
  title: The Cognitive Intelligence Substrate — Chronicle, Distillation, and the Intelligence Plane
  domain: intelligence
  status: draft
  owner: product-architecture
  last_reviewed: 2026-07-10
  upstream_dependencies:
    - architecture-decisions/ADR-0035-cognitive-intelligence-persistence
    - events/event-taxonomy
    - protocols/memory-mutation-protocol
    - protocols/reasoning-trace-protocol
    - world-state/world-state-graph
    - memory/memory-tiers
    - architecture-decisions/ADR-0021-governed-self-evolution
    - architecture-decisions/ADR-0027-cognitive-evaluation-layer
    - architecture-decisions/ADR-0034-supabase-persistence-graduation
    - source-environment/CSE-005-episodic-cognition
  downstream_dependencies:
    - intelligence/CIP-002-audit-and-distiller-registry
    - source-environment/CSE-010-delivery
    - indexes/event-index
  related_protocols: [memory-mutation-protocol, cognitive-event-protocol, reasoning-trace-protocol, evolution-proposal-protocol]
  related_events: [intelligence.distilled, intelligence.superseded, intelligence.quarantined, intelligence.consumed, reasoning.trace.recorded, memory.mutation.committed, world.node.created]
  related_runtime_systems: [world-state-graph, memory-tiers, cognitive-unit-runtime, cognitive-scheduler, evolution-engine]
  related_governance_systems: [governance-kernel, capability-envelope, human-governance, consent-policy]
  related_observability_systems: [cognitive-observability, reasoning-trace, learner-outcome-telemetry]
  semantic_tags: [intelligence, persistence, distillation, chronicle, compounding, episodes, personalization]
  canonical_references:
    - architecture-decisions/ADR-0035-cognitive-intelligence-persistence
    - source-environment/CSE-005-episodic-cognition
    - memory/memory-tiers
---

# CIP-001 — The Cognitive Intelligence Substrate

## 1. Purpose

The layer beneath every other subsystem: how runtime cognition becomes **compounding
intelligence**. Not a conversation store, not analytics, not telemetry — a substrate where every
persisted artifact exists because future intelligence can emerge from it, and where the system
becomes measurably better at understanding learners, knowledge, and its own cognition with every
interaction. This spec defines the two planes, the distillation law, the canonical contracts, and
the intelligence taxonomy. CIP-002 carries the subsystem audit, the distiller registry, and the
implementation plan (M3.5).

## 2. Philosophy

- **Persist cognition, not interaction.** The unit of persistence is a cognitive structure
  (a reasoning act, a decision with alternatives, a misconception's life story, an
  understanding delta) — never a chat transcript, click log, or metric.
- **The chronicle is the truth; the intelligence plane is the comprehension.** Everything that
  happens is already event-sourced (law #9). Intelligence is a *derived, re-derivable* fold over
  that truth — richer than the log, never a rival to it.
- **Distillation is cognition.** Turning a week of episodes into "this learner reasons
  visually-first and stalls on symbolic abstraction" is itself an act of understanding — so it
  runs as governed, confidence-carrying, evented cognition, not as an ETL job.
- **The admission question** for every schema, event, and artifact: *can future intelligence
  emerge from this — and who consumes it?* Yes with a named consumer → distill and persist. No →
  it is observability or nothing.
- **Compounding has two speeds.** Learner-scoped intelligence compounds immediately (this
  learner's next frame is already better). Shared intelligence compounds only through governed
  evolution (ADR-0021) — the platform gets smarter *deliberately*, never by silent drift.

## 3. Architecture — Two Planes, One Law

```
            RUNTIME COGNITION (units, agents, arbiters, director…)
                    │ emits (law #9 — strengthened: full traces, no drops)
                    ▼
  CHRONICLE PLANE   events · memory mutations · world deltas · recorded model outputs
  (append-only truth; Postgres event/transport tables; replayable)
                    │ folded by
                    ▼
  DISTILLERS        governed cognitive units (registry in CIP-002)
  (evented lifecycle: intelligence.distilled / superseded / quarantined)
                    │ write via Memory Mutations + World-State Deltas ONLY
                    ▼
  INTELLIGENCE PLANE   IntelligenceArtifacts as graph nodes/edges + tiered memory
  (durable on Postgres under RLS; versioned; provenance-linked; re-derivable)
                    │ consumed by
                    ▼
            FUTURE COGNITION (director pacing, enrichment selection, MRL selection,
            resume cards, evolution proposals, research routing, personalization)
```

The law (ADR-0035 lock 1): **one chronicle, one distillation path, no third way.** A subsystem
that wants persistence emits to the chronicle and/or registers a distiller. Nothing else.

## 4. Primitives

### 4.1 `IntelligenceArtifact` (the canonical persistence contract)

Every distilled structure, regardless of kind, carries one envelope:

```json
{
  "artifact_id": "int-…",
  "kind": "one of the taxonomy (§5), extensible via registry",
  "scope": { "regime": "learner | shared", "learner_cid": "… | null", "tenant_id": "…" },
  "body": { "kind-specific typed structure" },
  "epistemics": {
    "confidence": 0.0,
    "method": "distiller id",
    "method_version": "semver — re-distillation with a better method supersedes",
    "provenance_refs": ["chronicle segment refs: event ids/ranges, mutation ids, trace ids"],
    "supersedes": "int-… | null",
    "decay_policy": "none | salience | ttl:<duration>"
  },
  "consumers": ["named consumers that admitted it (ADR-0035 lock 2)"],
  "distilled_hlc": "…"
}
```

Physically: a world-state node (`type: "intelligence:<kind>"`) with edges to the concepts,
sources, anchors, learners, and agents it concerns, and/or a typed memory mutation into the
appropriate tier — chosen per kind in the registry (CIP-002 §3). Never a bespoke table per
subsystem.

### 4.2 The Distiller contract

A distiller is a cognitive unit (manifest, envelope, leases) declaring:

```
{ distiller_id, consumes: [chronicle patterns], produces: [artifact kinds],
  admission: { consumers: [named], regime: learner|shared, cohort_minimum? },
  cadence: streaming | episode-close | session-close | scheduled,
  determinism: D1 (pure fold) | D3 (model-assisted, recorded) }
```

Lifecycle events (`intelligence.*` family): `intelligence.distilled { artifact_id, kind, scope,
method, provenance_count }`, `intelligence.superseded { artifact_id, by }`,
`intelligence.quarantined { artifact_id, reason }` (failed grounding/consistency audit —
ADR-0027 applies to distillates too), `intelligence.consumed { artifact_id, consumer, use }`
(closing the loop: consumption is chronicled so unused intelligence is detected and the registry
pruned — an admission test that keeps enforcing itself).

### 4.3 Chronicle strengthening (closing the evaporation gaps)

Part of this layer's contract is that the chronicle actually receives cognition:

1. **Full reasoning traces are chronicled.** `reasoning.trace.recorded` (family `reasoning`,
   already registered) carries the complete `ReasoningTrace` from every dispatch — closing the
   drop confirmed in `ProductRuntimeDispatcher`. Surface summaries (ADR-0029) remain projections.
2. **Rejected alternatives are part of the record.** Transparency envelopes (CSE-007 §6a) —
   considered/rejected/dissent — are chronicle content, not display sugar.
3. **Nothing else changes at the source.** Units keep emitting exactly as today; the chronicle
   was always the design — this closes its leaks.

## 5. The Intelligence Taxonomy

The founder's categories, mapped onto owning primitives — each kind names its consumer (admission
law). Initial taxonomy; the registry (CIP-002) extends it:

| Kind family | Distilled from (chronicle) | Body (essence) | Primary consumers |
|---|---|---|---|
| **Learner cognition** (`learner.episode`, `learner.understanding-delta`, `learner.misconception`, `learner.reasoning-style`, `learner.curiosity-pattern`, `learner.confidence-calibration`) | surface/interaction/assessment events, depth gates, self-explanations | CSE-005 Episodes + Understanding Deltas; misconception life-stories (cause→correction→recurrence); disclosed thinking-pattern observations | Director pacing (CSE-011), enrichment/MRL selection, resume cards, Understanding Map, revision scheduling |
| **Agent cognition** (`agent.strategy-outcome`, `agent.rejected-alternative`, `agent.collaboration`) | reasoning traces, proposals/arbitrations, disagreements, timing/health events | which strategy a unit chose, what it rejected and why, how the ensemble negotiated, what the outcome was (linked to evaluation + learner result) | arbiter weighting, prompt-assembly context, evolution proposal evidence, Agent Theater |
| **Pedagogical intelligence** (`pedagogy.intervention-outcome`, `pedagogy.sequence-effectiveness`, `pedagogy.analogy-effectiveness`) | enrichment decisions + episode intervention outcomes + evaluation scorecards | intervention → outcome pairs per concept/stage; effectiveness aggregates (shared regime: cohort-minimum + evolution-only consumption) | Desirable-Difficulty Governor, EvolutionEngine proposals, MRL candidate priors (CSE-003 §7) |
| **Source intelligence** (`source.confusion-density`, `source.explanation-weakness`, `source.revisit-pattern`, `source.research-opportunity`) | source viewport/highlight/interaction events + episode confusions anchored to sources | per-anchor: where learners stall, revisit, break through; which passages under-explain | canonicalization prioritization (CSE-002 §4), frontier overlays (CSE-006), fusion weighting (CSE-015), educator views |
| **Surface intelligence** (`surface.attention-pattern`, `surface.pacing-fit`) | choreography/scene/shot/interaction events (M5+/Theater) | attention movement, pacing fit per learner per state | Cinematographer (CSE-013), Director tempo (CSE-011) |
| **Question intelligence** (`question.evolution`, `question.resolution`) | ask/interaction events + episode questions | a question's life: intent, prerequisites surfaced, how it resolved, what it seeded | curiosity engine, research routing (CSE-006 §5) |
| **Research & creative intelligence** (`research.hypothesis-lineage`, `creative.development`) | research workspace + creation events (CSE-016) | idea/hypothesis lineage, evidence accumulation | RIL routing, contribution loop |

Rules: every kind declares its regime (learner/shared); shared kinds are born under cohort
minimums; the `learner.reasoning-style`/`curiosity-pattern` kinds inherit CSE-005 §3.3/§3.5
governance verbatim (disclosed, learner-visible, opt-out, deletable — modeling *learning*, never
personal traits: ADR-0035 lock 5).

## 6. Personalization Doctrine

Personalization emerges from the plane, not from stored conversations: the Director reads the
learner's episode history, delta trajectory, misconception life-stories, and reasoning-style
observations; enrichment selection reads intervention-outcome history ("analogies from physics
worked; proofs-first did not"); resume reads deltas. All of it is inspectable by the learner
(Understanding Map / world-model inspector, CSE-005 §3.4) — the learner can see exactly the model
the system holds, contest it, and delete it. Personalization that cannot be shown to the learner
is forbidden.

## 7. Governance, Privacy, Failure

- **RLS at the substrate**: learner-scoped artifacts are row-isolated; deletion is a real cascade
  (artifact + edges + derived aggregates recomputed); export-everything includes the plane.
- **Shared regime**: cohort minimum enforced at distillation (not at read); consumption only via
  evolution proposals until the aggregation-privacy ADR (CSE-006 §8) lands.
- **Quarantine over deletion** for quality failures: an artifact failing grounding/consistency
  audit is quarantined (evented), preserved for method improvement, excluded from consumers.
- **Failure semantics**: distiller death → chronicle unaffected, re-run idempotent (artifacts
  version by provenance-range); malformed chronicle segment → quarantine + skip, never a stalled
  plane; plane loss → full re-derivation from chronicle (the recovery drill *is* the replay test).

## 8. Non-Goals

No chat/conversation store; no analytics warehouse; no engagement metrics; no psychographic
profiling; no direct-write path for agents into the plane; no per-subsystem bespoke storage ever
again.

## 9. Open Questions

Carried in ADR-0035 (cadence, family status, superseded retention) plus: how surface intelligence
kinds phase in before M5 exists (answer proposed in CIP-002: registry entries land with their
producing milestones — the substrate is built once, kinds arrive forever).
