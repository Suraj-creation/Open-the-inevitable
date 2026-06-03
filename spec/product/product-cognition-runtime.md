---
name: product-cognition-runtime
spec:
  id: PCR-001
  title: Phase 1E Product Cognition Runtime
  domain: product
  status: draft
  owner: product-architecture
  last_reviewed: 2026-06-03
  upstream_dependencies:
    - product/Broader-feature-product
    - product/features/F01-cognitive-onboarding
    - product/features/F02-dynamic-cognitive-navigation
    - product/features/F03-recursive-prerequisite-intelligence
    - product/features/F05-persistent-cognitive-memory
    - product/features/F06-specialized-agent-ecosystem
    - product/features/F13-identity-personas-modes
    - product/features/F14-assessment-mastery-depth
  downstream_dependencies:
    - packages/product-cognition
  related_protocols:
    [
      cognition-packet-protocol,
      cognitive-event-protocol,
      memory-mutation-protocol,
      reasoning-trace-protocol,
      cognitive-unit-abi,
    ]
  related_events:
    [
      onboarding.completed,
      navigation.timeline.rendered,
      agent.manifest.loaded,
      mastery.checkpoint.created,
    ]
  related_runtime_systems:
    [cognitive-unit-runtime, deterministic-execution-engine, cognitive-scheduler, world-state-graph]
  related_governance_systems: [governance-kernel, capability-envelope, context-lease, intent-lease]
  related_observability_systems: [cognitive-observability, reasoning-trace, otel-edge]
  semantic_tags: [phase-1e, product-cognition, onboarding, learning-path, mastery, agent-manifest]
  canonical_references:
    - product/Broader-feature-product#19-roadmap--phasing
---

# Product Cognition Runtime

## 1. Purpose

The Product Cognition Runtime is the first implementation bridge between the completed Cognitive OS
substrate and the product feature suite. It does not implement UI, model calls, or broad pedagogy.
It turns product actions into substrate primitives: identities, envelopes, leases, world-state
deltas, memory mutations, cognitive events, and runtime-valid agent manifests.

## 2. Scope

- F01/F13: initialize a learner session with Cognitive Identity, Capability Envelope, Context
  Lease, Intent Lease, seed learner-model nodes, seed memory, and onboarding events.
- F02/F03: project a deterministic concept/prerequisite path into the world-state graph.
- F06: expose the minimal viable agent manifest catalog.
- F06/F07: dispatch product cognition work as scheduler-admitted cognition packets executed by
  runtime-hosted MVP units.
- F04/F14: compose explanation dispatch, practice dispatch, and mastery recording into a
  deterministic no-LLM learning loop.
- F14: record mastery checkpoints as graph state, memory mutations, and events.

## 3. Non-Goals

- No LLM calls.
- No UI or application screens.
- No live external adapters.
- No hidden state mutation.

## 4. Runtime Boundaries

The package composes existing substrate packages rather than introducing new substrate primitives:

| Product responsibility | Existing substrate primitive |
|---|---|
| Learner/session identity | `@inevitable/kernel` Cognitive Identity |
| Consent and permitted memory scopes | `@inevitable/kernel` Capability Envelope + Context Lease |
| Goal commitment | `@inevitable/kernel` Intent Lease |
| Learner model and prerequisite topology | `@inevitable/world-state` deltas |
| Durable learner facts and mastery evidence | `@inevitable/memory` Memory Mutation |
| Observable product lifecycle | `@inevitable/events` Cognitive Event |
| Agent catalog validity | `@inevitable/runtime` Agent Manifest loader |
| Product agent execution | `@inevitable/runtime` CognitiveUnitHost |
| Agent work admission | `@inevitable/scheduler` DepthScheduler |
| Product semantic exchange | `@inevitable/protocols` CognitionPacket + CognitiveWorkItem |
| Deterministic explanation/practice loop | LearningPathProjector + ProductRuntimeDispatcher + MasteryCheckpointRecorder |

## 5. Architecture Laws

Every operation must be deterministic under injected clock/id generator, schema-valid where a
protocol exists, event-sourced, memory-mutation-only, governance-aware through envelopes/leases, and
replayable through graph/memory/event logs.

## 6. Failure Semantics

- A failed world-state delta aborts the product action and returns the substrate error.
- A failed memory mutation aborts the product action and returns the validation error.
- Events are emitted only after the state transition they describe has succeeded.
- The package does not retry or compensate yet; durable workflow compensation belongs in later
  Phase 1E workflow work.

## 7. Implementation Guidance

Implement as `@inevitable/product-cognition`. Keep each surface narrow:

- `ProductOnboardingService` for F01/F13.
- `LearningPathProjector` for F02/F03.
- `MVP_AGENT_MANIFESTS` for F06.
- `MasteryCheckpointRecorder` for F14.

Do not add model-provider dependencies. Do not introduce database clients. Do not bypass the
existing package APIs even if direct object mutation looks simpler.

## 8. Future Evolution

The next layer after this package is a product workflow package that composes these primitives into
long-running sessions with replay, late-agent contributions, and user-facing application surfaces.
