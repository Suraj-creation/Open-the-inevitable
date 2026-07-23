# Event Index

Initial event families:

- `intent.*`
- `context.*`
- `agent.*`
- `reasoning.*`
- `memory.*`
- `world.*`
- `orchestration.*`
- `workflow.*`
- `governance.*`
- `security.*`
- `observability.*`
- `evolution.*`
- `surface.*`
- `source.*`
- `intelligence.*`
- `model.*`
- `gateway.*`

Every event family must define schema, producer, consumer, retention, replay, governance classification, and failure behavior.

## Canonical Specs

- Event envelope and semantics → [protocols/cognitive-event-protocol.md](../protocols/cognitive-event-protocol.md)
- Full family catalog (owners, retention, replay, classification) → [events/event-taxonomy.md](../events/event-taxonomy.md)
- Governance rules for events → [meta/event-governance.md](../meta/event-governance.md)
- Surface family (Phase 2A) → [surface/surface-event-architecture.md](../surface/surface-event-architecture.md)
- Source family (CSE, ADR-0032) → [source-environment/CSE-002-canonical-source-representation.md](../source-environment/CSE-002-canonical-source-representation.md) §9; acquisition-side `artifact.*` events remain with [F15](../product/features/F15-content-ingestion-knowledge-substrate.md) §8
- Surface source subfamily `surface.source.*` (schema 1.6.0, **implemented — CSE M5**: attached, viewport.planned/.changed, highlight.applied/.cleared, sync.bound) → [surface/surface-event-architecture.md](../surface/surface-event-architecture.md) §4; grammar/laws in [source-environment/CSE-008-source-surface-projection.md](../source-environment/CSE-008-source-surface-projection.md) §8. Remaining CSE-008 events (overlay.applied, alignment.composed, media.intent, annotation.recorded) stay proposed; activate at M9/M10/CSE-014
- Episodic projection `surface.resume.projected` (schema 1.7.0, **implemented — CSE M6**, ADR-0037: resume card from the intelligence plane's latest episode + delta artifacts) → [surface/surface-event-architecture.md](../surface/surface-event-architecture.md) §4; laws in [source-environment/CSE-005-episodic-cognition.md](../source-environment/CSE-005-episodic-cognition.md) §4
- Cognitive Theater subfamilies `surface.director.*` + `surface.scene.*` (schema 1.8.0, **implemented — CSE M7 T1**, ADR-0033/0038: director directive/state.entered/pacing.set/affect.observed/attention.budgeted; scene opened/actor.entered/evolved/lighting.changed/closed) → [surface/surface-event-architecture.md](../surface/surface-event-architecture.md) §4; grammar in [source-environment/CSE-011-cognitive-director.md](../source-environment/CSE-011-cognitive-director.md) §6 + [source-environment/CSE-012-cognitive-scene.md](../source-environment/CSE-012-cognitive-scene.md) §5. `surface.shot.*` (cinematography, CSE-013) + interaction-caused scene deltas (CSE-014) stay proposed; activate at M8
- Cognitive Theater subfamilies (additive under `surface`, ADR-0033): `surface.director.*` (+ `surface.affect.*`/`surface.attention.*`) and `surface.scene.*` **implemented at CSE M7 T1 (schema 1.8.0)** → [source-environment/CSE-011-cognitive-director.md](../source-environment/CSE-011-cognitive-director.md) §6 + [source-environment/CSE-012-cognitive-scene.md](../source-environment/CSE-012-cognitive-scene.md) §5; `surface.shot.*` (cinematography) + `surface.intent.expressed` + the extended `surface.interaction.received` grammar **implemented at CSE M8 T2 (schema 1.9.0, ADR-0039)** → [source-environment/CSE-013-knowledge-cinematography.md](../source-environment/CSE-013-knowledge-cinematography.md) §3 + [source-environment/CSE-014-cognitive-interaction-grammar.md](../source-environment/CSE-014-cognitive-interaction-grammar.md) §3
- Source fusion + Claim Graph (CSE M9, **implemented**): `source.fusion.composed`/`.concept.reconciled`/`.gap.detected` (deterministic reconciliation over the anchor index — **T1**, ADR-0040) + `source.claim.recorded`/`source.contradiction.detected` (**T2**, ADR-0041: model-backed claim extraction at L5/L6 as world-state graph nodes + cross-source contradiction detection with typed nature) + `source.fusion.synthesized` (**T3**, ADR-0042: model-backed fused *explanation* synthesis citing every contributing source, grounding + disagreement-honesty gates) + `source.frontier.updated` (**Frontier T1**, ADR-0043: frontier overlays via real web-grounded research — Gemini Google Search citations, D3-recorded; every entry backed by a real citation or dropped) + `source.timeline.updated` (**TKM T1**, ADR-0044: the Temporal Knowledge Model — per-concept Concept Timelines via web-grounded temporal research, ordered epistemic states each grounded in a real citation, honestly sparse; assembly-from-L6/claim-supersedes + the Cognitive Time Machine UI + the ADR-0026 readiness-gating pipeline remain deferred) → [source-environment/CSE-015-source-fusion.md](../source-environment/CSE-015-source-fusion.md) §5 + [source-environment/CSE-006-living-knowledge.md](../source-environment/CSE-006-living-knowledge.md) §3; `source.creation.*` (`started`/`evolved`/`critiqued`/`completed`, **M11 T1 implemented**, ADR-0049: creation as governed cognition — the four-mode assist grammar scaffold/critique/provocation/reference, the no-ghostwriter law enforced structurally, every assist disclosed; `contributed` + consent deferred) → [source-environment/CSE-016-creative-cognition.md](../source-environment/CSE-016-creative-cognition.md) §5
- Intelligence family (distillation lifecycle: distilled/superseded/quarantined/consumed; ADR-0035) → [intelligence/CIP-001-cognitive-intelligence-substrate.md](../intelligence/CIP-001-cognitive-intelligence-substrate.md) §4.2
- Model family (Phase 2B, D3 recording) → [protocols/model-invocation-protocol.md](../protocols/model-invocation-protocol.md)

