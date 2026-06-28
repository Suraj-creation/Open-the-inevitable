# ADR-0023: Recognize the Emergent Cognitive Architecture Layers

**Status:** Accepted
**Date:** 2026-06-20
**Supersedes:** none
**Related:** [ADR-0003](ADR-0003-tech-stack.md) (technology stack), [ADR-0021](ADR-0021-governed-self-evolution.md) (governed self-evolution), the Cognitive Unit ABI (`spec/protocols/cognitive-unit-abi.md`), `spec/architecture/Tech-Stack.md`

## Context

The technology strategy (`spec/architecture/Tech-Stack.md`) maps how the COS **runs** — the
infrastructure substrate: contracts, adapters, events, world-state, memory, governance, determinism. A
forward-looking architectural review then asked a different question: *if this architecture succeeds and
evolves toward the destination in `spec/vision-application/`, what architectural layers inevitably
emerge?* The review reasoned from the vision and trajectory rather than from existing files — and
deliberately treated the many empty spec folders (`spec/evaluation/`, `spec/cognition/`,
`spec/reasoning/`, `spec/research/`, …) as **reserved homes for deep vision**, not as evidence of
absence.

Six candidate dimensions were evaluated: a Cognitive Capability layer, a Capability Factory, AI
Evaluation infrastructure, Knowledge infrastructure, Research infrastructure, and Autonomous Improvement
infrastructure. The Capability and Capability-Factory dimensions are the same layer (the factory is *how
capabilities emerge over time*), yielding **five** layers. Grounding in the vision is direct: ULI's six
roles are reusable cognitive functions composed into agents; the "Research-Grade Knowledge Pipeline /
GitHub for knowledge" is knowledge as first-class; UALRCI's Deep-Understanding tests and "evaluate their
own outputs for genuine contribution" are evaluation; the Novel Contribution Engine is research;
"self-evolving products that co-evolve, continuously upgrading one another" is recursive self-improvement.

The decision to make: do these layers deserve first-class architectural recognition *now*, before they
are implemented — and if so, where, and with what discipline so that recognizing them does not violate
the constitution's burden-of-proof-on-additions and no-premature-abstraction laws?

## Decision

1. **Recognize five emergent cognitive-architecture layers as first-class architectural direction**,
   owned by a new canonical document `spec/architecture/Cognitive-Architecture.md` (the companion to
   `Tech-Stack.md`: *runs* vs *thinks*):
   - **Cognitive Capability Layer** — reusable cognitive functions (composed into agents).
   - **Cognitive Evaluation Layer** — measuring cognition (reasoning/memory/planning/retrieval/intent/
     research/agent evaluation, benchmarks, regression).
   - **Knowledge Layer** — knowledge as a first-class lifecycle (provenance, validation, evolution,
     discovery, relationships).
   - **Research Layer** — creating new knowledge (experiments, hypotheses, evidence, findings).
   - **Autonomous Improvement Layer** — the platform applying the above four to itself (recursive,
     governed, gated).

2. **Adopt the discipline that every layer is a *composition over the existing substrate*, not new
   infrastructure.** Each layer is assembled from cognitive units (the ABI), the event log, world-state,
   memory, the eight adapter contracts, governance, and determinism/replay. No layer may introduce a new
   store, broker, or vendor; infrastructure is acquired only through the eight adapter contracts.

3. **Gate each layer behind an activation trigger.** A layer crosses from direction into implementation
   only on an explicit trigger, behind a contract, with conformance/replay/governance tests, and **its own
   ADR**. Recognizing a layer here is not authorization to build it.

4. **Fix the dependency order**: Capability → {Knowledge, Evaluation} → Research → Autonomous Improvement.
   Two consequences are binding: **Evaluation (Layer 2) is the gate for trustworthy Research and
   Autonomous Improvement** and is the recommended next cognitive-architecture investment; **Autonomous
   Improvement (Layer 5) is deliberately last**, gated additionally on Cognitive IR and governance
   maturity, because premature structural self-modification is the highest-risk capability in the system.

5. **Resolve the "capability" terminology collision**: *Cognitive Capability* (a unit's function) is
   distinct from the governance *Capability Envelope* (a permission grant); their registries (Capability
   **Catalog** vs governance `CapabilityRegistry`) keep distinct names. A glossary entry should pin both.

## Alternatives Considered

- **Do nothing (leave the layers implicit).** Rejected: the layers are already implied across the vision,
  the product features, and the half-built fragments (`ShadowEvaluator`, `CognitiveAnalysisEngine`,
  `KnowledgeGraphEngine`, `EvolutionEngine`). Leaving them unnamed invites duplication, terminology drift
  (the capability collision), and substrate decisions that accidentally foreclose them.
- **Fully specify each layer now.** Rejected: that is premature over-specification of systems the vision
  intentionally leaves open, and it violates burden-of-proof-on-additions. Direction now; specification on
  trigger.
- **Scatter the layers into their individual domain specs immediately.** Rejected as the *first* step: it
  fragments a coherent, dependency-ordered story across empty folders and loses the emergence structure.
  The deepening specs still live in those domains (`spec/cognition/`, `spec/evaluation/`, etc.) — but the
  map that relates them belongs in one place first.
- **Record only in Tech-Stack.md.** Rejected: Tech-Stack owns *infrastructure technology* and explicitly
  scopes out cognitive architecture; overloading it would blur the very boundary that makes it useful.

## Consequences

- **Discoverability & coherence.** One canonical map names the layers, their boundaries, their dependency
  order, and how each composes over the substrate; `CLAUDE.md` §3 points to it alongside Tech-Stack.
- **No new infrastructure surface.** Because every layer composes over existing primitives, this ADR adds
  zero dependencies and does not change `pnpm verify`. The substrate stays offline-green.
- **A clear next investment.** The Evaluation layer is identified as the highest-leverage
  cognitive-architecture gap, because governed self-evolution and verified mastery both depend on it.
- **Guardrails on self-modification.** Autonomous Improvement is explicitly sequenced last and multiply
  gated, making the most dangerous capability the hardest to activate by accident.
- **Obligations.** Each layer's deepening spec is authored before its implementation (spec-first); each
  activation is a major decision requiring its own ADR and an §25.4 coherence check; the Capability
  Catalog and governance `CapabilityRegistry` must not share a name in code.

## Open Questions

- Does the Capability Catalog (Layer 1) warrant a runtime *discovery* mechanism, or is composition-time
  resolution sufficient until federation? (Tied to the deferred unit-registry.)
- Is the Knowledge Layer best expressed as an index spec (`spec/knowledge/`) or as coordinated additions
  to `spec/world-state/` + `spec/memory/` + `spec/epistemology/`? — settle when Layer 3 activates.
- What is the minimal first version of the Evaluation layer that is trustworthy enough to gate a real
  self-evolution rollout (replacing the `ShadowEvaluator`'s placeholder formula)? — the subject of the
  expected follow-up ADR when Layer 2 activates.
