---
name: cse-creative-cognition
spec:
  id: CSE-016
  title: Creative Cognition — Creation as a First-Class Cognitive Capability
  domain: source-environment
  status: draft
  owner: product-architecture
  last_reviewed: 2026-07-10
  upstream_dependencies:
    - source-environment/CSE-005-episodic-cognition
    - source-environment/CSE-006-living-knowledge
    - source-environment/CSE-009-experience-catalog
    - source-environment/CSE-012-cognitive-scene
    - source-environment/CSE-014-cognitive-interaction-grammar
    - product/features/F10-research-innovation-acceleration
    - product/features/F14-assessment-mastery-depth
    - architecture-decisions/ADR-0026-research-mode-and-readiness-gating
  downstream_dependencies:
    - source-environment/CSE-010-delivery
    - indexes/event-index
  related_protocols: [cognitive-event-protocol, memory-mutation-protocol, reasoning-trace-protocol]
  related_events: [source.creation.started, source.creation.evolved, source.creation.critiqued, source.creation.completed, source.creation.contributed]
  related_runtime_systems: [cognitive-unit-runtime, world-state-graph, proposal-blackboard]
  related_governance_systems: [governance-kernel, capability-envelope, human-governance]
  related_observability_systems: [cognitive-observability, reasoning-trace, learner-outcome-telemetry]
  semantic_tags: [source-environment, creation, creativity, invention, hypothesis, authoring, research, contribution]
  canonical_references:
    - source-environment/CSE-006-living-knowledge#5
    - source-environment/CSE-009-experience-catalog#4
    - product/features/F10-research-innovation-acceleration
---

# CSE-016 — Creative Cognition

## 1. Purpose

Understanding is not the terminus. The mission's arc is
`Read → Understand → Master → Connect → Question → Experiment → Research → Discover → Create`
(CSE-006 §5). Most of the CSE domain serves the left of that arrow; this spec makes the **right**
first-class: **creation as a cognitive act** — writing, hypothesis generation, design, invention,
model construction, experiment planning, paper authoring — the process by which a learner turns
understanding into new artifacts and, ultimately, new knowledge contributed back to humanity.

## 2. Philosophy

- **Creation is the deepest test of understanding.** You do not fully understand until you can
  make something new with it. Creation is therefore both an *outcome* and the strongest *evidence*
  of mastery (feeds F14 depth verification and the `Creation`/`Discovery` stages, CSE-005 §3.3).
- **The system is a thinking partner, not a ghostwriter** (Constitution #5: learning before
  dependency). It scaffolds, critiques, and provokes — it does not produce the learner's artifact
  for them. Every assist is disclosed; the human remains the author.
- **Creation lives on the same substrate.** A creation is a durable Scene actor (`creation-canvas`,
  CSE-012 §3.2) and a world-state artifact — not a separate app. It cites the source anchors and
  concepts it draws from, and it can itself become a Cognitive Source (recursive: a learner's
  paper is ingestible, CSE-002).

> **Implementation status — §2/§3/§5 core landed at M11 T1 (ADR-0049).** The `Creation` primitive +
> the **four-mode assist grammar** (scaffold / critique / provocation / reference) ship as governed
> cognition (the privileged `creation` agent, `CreationAssistUnit`), with the **no-ghostwriter law
> enforced structurally** — there is no generate mode; each mode's output is an assist (slots /
> findings / questions / refs), never the artifact. Every assist is disclosed + recorded.
> `source.creation.started/evolved/critiqued/completed` emit on the hub bus.
>
> **The contribution loop landed (ADR-0051).** A completed creation can be consented into the
> substrate as a first-class Cognitive Source: `contributeCreation` registers the learner's `draft`
> (only the draft — assists stay disclosed provenance, so the no-ghostwriter law holds through the
> loop) with `origin:"creation"` provenance + a `consent_ref`, canonicalizes it, records
> `contributed_as`, and emits `source.creation.contributed`. Consent-gated (refuses incomplete or
> unconsented). The contributed source is thereafter attachable/anchorable/fusable like any source
> (recursion). **Deferred:** community sharing/discovery (F11); the durable consent envelope +
> revoke→redaction cascade; co-write-on-request; the Director `creating` state + the Scene-actor
> canvas; the Research Workspace; feeding the Understanding Delta.

## 3. Primitives

### 3.1 `Creation`

```json
{
  "creation_id": "crt_...",
  "learner_cid": "...",
  "kind": "essay | argument | hypothesis | experiment-design | model | prototype | proof | design | proposal | artwork | dataset | notebook",
  "source_refs": ["source anchors / concepts it draws from"],
  "artifact_ref": "content_ref (out-of-band; text/code/media)",
  "structure": "kind-specific scaffold (e.g. claim/evidence/counter-evidence for an argument)",
  "assists": [{ "kind": "scaffold|critique|provocation|reference", "agent_cid": "...", "disclosed": true }],
  "development_evidence_ref": "the mastery evidence this creation constitutes (CSE-005)",
  "status": "prompted | in_progress | critiqued | completed | contributed"
}
```

### 3.2 Creation modes (the assist grammar)

The system's role, always disclosed, always the learner's to invoke or decline:

- **Scaffold** — structure without content (an argument skeleton, an experiment template, a proof
  outline). The learner fills it.
- **Critique** — adversarial review of the learner's draft (weak links, missing evidence,
  unstated assumptions) — the Critical-Thinking/Debate agents (F06) over the learner's own work.
- **Provocation** — generative prompts that widen the space ("what would break this?", "what
  adjacent field solves this?") — never answers, only openings.
- **Reference** — grounded retrieval of relevant sources/claims/frontier (CSE-006) the learner can
  cite. Provenance mandatory.

Generation-of-the-artifact-itself is **not** a mode (Constitution #5). The system may co-write only
where the learner explicitly requests it *and* it is disclosed and attributed in the artifact.

## 4. Architecture

- A creation opens from any concept (CSE-009 §4 Creation Panel) or interaction (`teach-back`,
  `predict`, `sketch` — CSE-014) via `source.creation.started`. It is a durable Scene actor
  (CSE-012) with its own scoped workspace (text/code/canvas/notebook).
- Assists flow through the blackboard as enrichment proposals (CSE-007 §4) but with an inverted
  default: in creation, **the system proposes less and provokes more** (the Director, CSE-011,
  enters a `creating` state that lowers unsolicited enrichment and raises the desirable-difficulty
  governor).
- Creations feed: the **Understanding Delta** (evidence for `Creation`/`Discovery` stages,
  CSE-005), the **Personal Knowledge Graph** (CSE-009), and — at readiness (ADR-0026) — the
  **Research Workspace** (CSE-009 §5) as hypotheses/experiments/drafts.
- **Contribution loop:** a completed creation may be `contributed` — shared to a community
  (governed, CSE-002 §8 / F11) or ingested back as a Cognitive Source. This is the mission's
  end-state: the learner adds to the knowledge others learn from. Emits
  `source.creation.contributed`.

## 5. Event Subfamily — `source.creation.*`

| Event | Emitted when | Payload core |
|---|---|---|
| `source.creation.started` | a creation opens | creation_id, kind, source_refs[] |
| `source.creation.evolved` | a draft delta / assist applied | creation_id, op, assist? (disclosed) |
| `source.creation.critiqued` | adversarial review produced | creation_id, findings[], agent_cid |
| `source.creation.completed` | learner marks it done | creation_id, development_evidence_ref |
| `source.creation.contributed` | shared/ingested back | creation_id, destination (community|source-ingest), consent_ref |

## 6. Governance, Integrity & Determinism

- **Authorship integrity:** every system assist is recorded and, for `contributed` creations,
  disclosed in the artifact's provenance. A creation cannot be `contributed` as the learner's
  original work if undisclosed generation occurred — the audit trail enforces this.
- **Consent:** contribution to a community or re-ingestion requires explicit consent and inherits
  the governance of human/institutional sharing (CSE-002 §8, F11).
- **Determinism:** creation content is learner-authored (canonical via mutations); system assists
  that use models record before use (D3). Replay reconstructs the creation's full development
  history including which assists were offered, accepted, or declined.

| Failure | Behavior |
|---|---|
| Assist generation fails | Learner keeps working uninterrupted; assist retried/offered later; never blocks authoring |
| Creation cites an unstable anchor | Preserved-quote citation (CSE-008 §12); flagged for the learner to re-source |
| Contribution consent absent | Contribution blocked with explanation; creation stays private |

## 7. Observability

Telemetry (capability-not-engagement, CSE-010): creations per learner over time, transfer evidence
(creations applying a concept in a novel context — a core success metric), assist-decline rate
(healthy independence signal), critique-to-revision loops, contribution rate (the mission's
north-star tail metric). Every assist is inspectable ("what did the system offer here, and did I
take it?").

## 8. Open Questions

- Per-kind scaffold libraries: hand-authored vs. generated-per-domain (shared build-vs-generate
  decision with CSE-004 §7 simulations).
- Where the line sits between "co-write on request" and authorship integrity for academic contexts
  (institutional policy input needed, F11).
- Whether creations should be first-class Cognitive Sources immediately on completion or only on
  explicit re-ingestion (leaning: explicit, to keep the source library learner-curated).
