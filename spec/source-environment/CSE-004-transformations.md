---
name: cse-transformations
spec:
  id: CSE-004
  title: The Transformation Algebra — Five Core Transformations and Their Laws
  domain: source-environment
  status: draft
  owner: product-architecture
  last_reviewed: 2026-07-09
  upstream_dependencies:
    - source-environment/CSE-001-foundations
    - source-environment/CSE-002-canonical-source-representation
    - source-environment/CSE-003-meaning-representation-layer
    - product/features/F04-adaptive-multimodal-explanation
    - protocols/model-invocation-protocol
  downstream_dependencies:
    - source-environment/CSE-008-source-surface-projection
    - source-environment/CSE-009-experience-catalog
  related_protocols: [cognition-packet-protocol, model-invocation-protocol, reasoning-trace-protocol]
  related_events: [source.transformation.produced, surface.frame.composed, surface.image.decided]
  related_runtime_systems: [cognitive-unit-runtime, cognitive-scheduler, multimodal-provider-abstraction]
  related_governance_systems: [governance-kernel, capability-envelope]
  related_observability_systems: [cognitive-observability, reasoning-trace]
  semantic_tags: [source-environment, transformations, representation, pedagogy, meaning-preservation]
  canonical_references:
    - source-environment/CSE-003-meaning-representation-layer#3
    - product/features/F04-adaptive-multimodal-explanation
    - surface/multimodal-provider-abstraction
---

# CSE-004 — The Transformation Algebra

## 1. Purpose

Every Cognitive Source supports five foundational transformations — the ways the same knowledge
can be legitimately re-expressed for a mind. They are first-class, governed system capabilities
with declared semantics, not ad-hoc "regenerate as X" prompts. This spec defines the
transformation kinds, the laws every transformation must obey, and the runtime/exposure model.
F04 (adaptive multimodal explanation, seven depth layers) remains the product law for *choosing*
depth; this spec owns the algebra those choices draw from.

## 2. Philosophy

Transformation is how understanding is negotiated. A learner who can only receive knowledge in
the form the author chose is captive to that author's mind. The transformation algebra is the
system's guarantee that form is never a prison: structure, representation, cognitive level,
pedagogy, and time are all independently adjustable — under an explicit contract that meaning is
preserved and losses are declared.

## 3. The Five Core Transformations

| Kind | Definition | Examples |
|---|---|---|
| **Structural** | Reorganize the same knowledge without altering truth | chapter view → concept view; paper → method/results view; lecture → question map |
| **Representational** | Convert between forms while preserving meaning | text → diagram; derivation → animation; paragraph → simulation; proof → visual intuition; code → flow graph; explanation → story |
| **Cognitive** | Adjust the level and style of understanding | simplify, deepen, abstract, concretize, compare, compress, expand; intuition-first vs. formalism-first |
| **Pedagogical** | Change *how* the same concept is taught | Socratic, worked example, faded example, project-first, research-first, misconception-first, simulation-first |
| **Temporal** | Reframe the same concept across time | as known in 1995 → as taught in 2010 → as understood today → as debated now → likely next |

The five kinds form an extensible registry, not a closed set. Registered extensions planned:
**dialogic** (knowledge as debate/teaching-back — powers the Teaching Theatre, CSE-009 §4) and
**assessment-projection** (knowledge as probes — feeds F14). Extensions register with the same
laws (§4) and manifest declarations as core kinds.

## 4. Transformation Laws

Every transformation, core or extension, must obey:

1. **Meaning-preservation contract.** Each transformation declares which MeaningUnits (CSE-003)
   it preserves and which dimensions it is lossy on. A `conceptual-compression` declares what it
   drops; a `simplify` declares which boundary conditions it elides. Undeclared loss is a defect.
2. **Refusal over approximation.** A transformation that cannot uphold its declared contract for
   a given input must refuse (evented, with reason) — never silently approximate. A proof that
   can't survive "visual intuition" without breaking its logic says so.
3. **Provenance propagation.** Output carries the input's source anchors plus the transformation
   lineage `{ kind, unit, invocation_refs }`. A diagram generated from a paragraph is inference
   *derived from* evidence; its provenance class and citation trail must say exactly that.
4. **Composability.** Transformations are typed `form → form`; outputs are valid inputs where
   types match (paper → concept view → diagram → simulation). Lineage accumulates; contracts
   compose as the intersection of preserved dimensions.
5. **Determinism.** Model-backed transformations record outputs before use (D3); generated media
   flows through the multimodal provider abstraction (SRF-004/SRF-006). Replay resolves from the
   record.
6. **Learner-warranted cost.** Expensive transformations (animation, simulation) run under
   budgeted intent leases, triggered by Enrichment Decisions (CSE-007) or explicit learner
   request — never speculatively for whole sources.

## 5. Runtime Semantics & Surface Exposure

- Transformations execute as cognitive units (manifest, envelope, packets) and emit
  `source.transformation.produced { transformation_id, kind, input_refs, output_ref, contract,
  lineage }`; surfaced results land as frames/blocks through the normal composition path
  (ADR-0030), never as a side channel.
- **The Concept Replay rail (CSE-009 §2) is a projection over this algebra:** each rail node
  (Intuition, Animation, Mathematics, Derivation, Example, Practice, Misconception, Research,
  Reflection) is an available-or-generatable transformation target for the current concept. A
  node with no artifact yet renders greyed with a "generate" affordance — the rail's shape stays
  constant; availability is honest.
- Per-learner transformation preferences (e.g., always intuition-first) are learner world-state,
  applied at Enrichment Decision time, and disclosed ("ordered intuition-first because you
  prefer it — change this").

## 6. Failure Semantics & Observability

| Failure | Behavior |
|---|---|
| Contract cannot be upheld | Refuse with evented reason; offer nearest honest alternative ("animation would break the proof; showing stepped derivation instead") |
| Provider unavailable / budget exhausted | Node stays "generatable-later"; queued under fresh lease; no silent downgrade |
| Output fails grounding audit (ADR-0027 judge) | Output quarantined, not surfaced; regeneration proposed |
| Composition type mismatch | Rejected at dispatch (typed forms), evented |

Telemetry: per-kind demand, refusal rate and reasons, grounding-audit pass rate, generation cost
per kind, downstream learning lift per kind (which transformations actually move mastery — feeds
CSE-006 §7 aggregate learning under governance).

## 7. Open Questions

- Canonical `form` type vocabulary (the algebra's type system) — needs a joint decision with
  surface block/frame typing before implementation.
- Whether Temporal transformation should read from frontier overlays (CSE-006) live or from
  layer-6 citation lineage only, with frontier as explicit augmentation.
- Simulation generation strategy: general-purpose generation vs. curated per-domain templates
  (shared with CSE-009 §4 Laboratory and the founding draft's open question) — build-vs-generate
  ADR expected at CSE-P3.
