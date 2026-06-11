---
name: product-cognition-runtime
spec:
  id: PCR-001
  title: Phase 1E Product Cognition Runtime
  domain: product
  status: draft
  owner: product-architecture
  last_reviewed: 2026-06-12
  upstream_dependencies:
    - product/Broader-feature-product
    - product/features/F01-cognitive-onboarding
    - product/features/F02-dynamic-cognitive-navigation
    - product/features/F03-recursive-prerequisite-intelligence
    - product/features/F05-persistent-cognitive-memory
    - product/features/F06-specialized-agent-ecosystem
    - product/features/F07-realtime-cognitive-orchestration
    - product/features/F13-identity-personas-modes
    - product/features/F14-assessment-mastery-depth
    - agents/supervisor-agent
  downstream_dependencies:
    - packages/product-cognition
  related_protocols:
    [
      cognition-packet-protocol,
      cognitive-event-protocol,
      memory-mutation-protocol,
      reasoning-trace-protocol,
      cognitive-unit-abi,
      model-invocation-protocol,
    ]
  related_events:
    [
      onboarding.completed,
      navigation.timeline.rendered,
      agent.manifest.loaded,
      mastery.checkpoint.created,
      supervisor.route,
      learning.fiber.supervisor.routing.requested,
      learning.fiber.dispatch.requested,
      learning.fiber.mastery.record.requested,
      model.output.recorded,
      model.invocation.failed,
    ]
  related_runtime_systems:
    [cognitive-unit-runtime, deterministic-execution-engine, cognitive-scheduler, world-state-graph]
  related_governance_systems: [governance-kernel, capability-envelope, context-lease, intent-lease]
  related_observability_systems: [cognitive-observability, reasoning-trace, otel-edge]
  semantic_tags:
    [
      phase-1e,
      product-cognition,
      onboarding,
      learning-path,
      mastery,
      agent-manifest,
      supervisor-routing,
      otel-trace-capture,
      fiber-dispatch,
      phase-2b,
      model-backed-unit,
    ]
  canonical_references:
    - product/Broader-feature-product#19-roadmap--phasing
    - agents/supervisor-agent
    - execution/cognitive-execution-engine
    - telemetry/otel-edge
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
- F04 (Phase 2B): host model-backed cognitive units that produce real generated content through
  the same governed dispatch path, under the
  [Model Invocation Protocol](../protocols/model-invocation-protocol.md).

## 3. Non-Goals

- No vendor model SDKs. Model access flows only through the `ModelRuntime` contract from
  `@inevitable/contracts`; provider SDKs live in `packages/adapters` behind guarded dynamic
  imports (Phase 2B; before 2B this read "no LLM calls").
- No UI or application screens.
- No live external adapters beyond injected `ModelRuntime` instances.
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

## 7. Supervisor Routing Contract

`SupervisorUnit` is a `CognitiveUnit` that reads world-state to determine which agent should act
next for a given concept and learner. It is the single routing authority in the product runtime.

### Routing Decision Logic

The supervisor reads world-state mastery checkpoint nodes and concept-node phase-tracking props:

| World-state signal | Routing decision |
|---|---|
| `mastery_checkpoint` node with `passed=true` for (conceptId, userId) | `complete` — mastery verified |
| `mastery_checkpoint` node with `passed=false` for (conceptId, userId) | `revision` — retry needed |
| Concept node has `practice_dispatched:<userId>=true` | `assessment` — ready for depth gate |
| Concept node has `explanation_dispatched:<userId>=true` | `practice` — explanation done |
| No signal present | `explanation` — start from scratch |

### Routing Event

Every routing decision emits a `supervisor.route` event carrying `targetAgent`, `conceptId`,
`reason`, and `producerCid`. This event is the replay-observable record of the routing decision.

### Phase Tracking

After dispatching explanation or practice, the caller writes `set_node_prop` deltas on the concept
node to record `explanation_dispatched:<userId>=true` or `practice_dispatched:<userId>=true`. This
creates the world-state signal the supervisor reads on the next routing request.

## 8. OTel Trace-Capture Contract

`ProductRuntimeDispatcher.dispatch()` wraps `host.handle()` in an OTel span so every agent
dispatch is traceable end-to-end:

```
span name:  "cos.agent.dispatch"
attributes: cos.packet_id, cos.agent_id, cos.intent, cos.concept_ids
status:     OK on success, ERROR on host failure (message = error.message)
```

The span is created via `withSpan()` from `@inevitable/observability`. No new dependencies — the
OTel API package is already present. Without a registered SDK the span is a no-op (safe in tests).

The packet's `trace_id` and `span_id` fields are set as attributes on the span, making the COS
correlation ID searchable in any OTel backend.

## 9. Fiber Dispatch Contract

`FiberedLearningLoop` expresses the multi-step learning cycle as a `FiberRoutine` driven by the
`ExecutionEngine`. This produces a **deterministic execution journal** for D2 replay.

### Fiber Bridge Protocol

The fiber routine communicates with the async dispatch layer by emitting internal bridge events.
Each event carries a `token` and a `payload`. The engine's sink intercepts bridge events, performs
the async work, and calls `engine.resolve(token, result)`. The fiber then `awaitValue`s the token.

| Bridge event | Triggered by | Resolved with |
|---|---|---|
| `learning.fiber.supervisor.routing.requested` | fiber `emit` | `SupervisorRoutingDecision` |
| `learning.fiber.dispatch.requested` | fiber `emit` | `ProductDispatchResult` |
| `learning.fiber.mastery.record.requested` | fiber `emit` | `MasteryCheckpoint` |

### Execution Journal Phases

The fiber records `reason()` effects at each logical phase. The journal produced by
`ExecutionEngine` is the D2-replayable record of the learning cycle:

```
phase:supervisor-routing
phase:routing-decided:<targetAgent>
phase:explanation-dispatch
phase:explanation-done
phase:practice-dispatch
phase:practice-done
phase:mastery-record
phase:cycle-complete
```

### D3 Extension Point (realized in Phase 2B)

Real model calls happen inside `CognitiveUnit.execute()` and are recorded at the adapter edge by
`RecordingModelRuntime` as `model.output.recorded` events per the
[Model Invocation Protocol](../protocols/model-invocation-protocol.md) — record-before-use in
live runs; replay resolves from the record and never re-invokes the provider. Combined with the
D2 execution journal, a seeded record→replay round trip reproduces byte-identical surface frames.

## 10. Governance Contract

`ProductRuntimeDispatcher.dispatch()` evaluates an optional `GovernanceEngine` at the dispatch
boundary before any state is mutated. This makes governance a kernel primitive in the product
runtime — not an external moderation layer.

### Evaluation Request Shape

```
subjectCid:     session.learnerIdentity.cid
resource:       "product.cognition.dispatch"
action:         "dispatch.<targetAgentId>"
context:        { trustLevel: number, targetAgentId: string }
classification: session.capabilityEnvelope.data_classification_ceiling
```

### Phase 1E Baseline Policies

| Policy | ID | Blocks when |
|---|---|---|
| Trust gate | `GOV-P01-DISPATCH-TRUST` | `trust_level < 1`; or privileged agent (memory, curriculum) with `trust_level < 3`; or agent not in allowlist |
| Classification gate | `GOV-P02-DISPATCH-CLASSIFICATION` | `classification == "public"` (flags for review, not blocked) |

Both are exported as `PRODUCT_DISPATCH_POLICIES` from `@inevitable/product-cognition` and can be
registered on a `GovernanceEngine` passed into `ProductRuntimeDispatcherDeps.governance`.

### On Block

A blocked dispatch returns `err(CosError("E_PRODUCT_RUNTIME_DISPATCH"))` with `decisionId`,
`policyId`, `reason`, and `outcome` in `details`. No packet is created, no work is admitted.

### On Review

A `review` outcome allows the dispatch to proceed but the implementation SHOULD mark
`packet.requires_human_review = true` (future enhancement; currently surfaces in the error details).

## 11. Model-Backed Unit Contract (Phase 2B)

`ModelBackedUnit` is a `CognitiveUnit` that produces real generated cognition through an injected
`ModelRuntime` (from `@inevitable/contracts`), flowing through the **same** governed dispatch path
as `DeterministicMvpUnit` — same ABI, same governance gate, same scheduler admission, same OTel
span. There is no separate "model path".

### Construction

```
ModelBackedUnit({
  manifest,            // agent manifest (persona source)
  model,               // ModelRuntime (typically RecordingModelRuntime-wrapped)
  role,                // "explanation" | "practice" | "assessment"
  fallback?,           // optional deterministic CognitiveUnit
  world?,              // optional WorldStateGraph for context enrichment
  timeoutMs?,          // default 20_000
})
```

### Prompt Assembly

- **System prompt** = manifest persona/role + layer-first pedagogy instruction: lead with Layer 0
  (Story/Intuition); include Layer 1 (Visual Understanding — described visual/mental model) when
  the request asks for it. Output MUST be JSON.
- **User prompt** = packet intent + concept ids/titles (+ requested layer from
  `packet.content["layer"]`, when present).
- **Invocation key** = `<manifest_id>:<packet_id>:<role>` per the protocol (the recording
  wrapper assigns the per-key `ordinal`).

### Output Contract

The model MUST return JSON parseable to:

```json
{
  "layers": { "layer_0": "…", "layer_1": "…(optional)" },
  "summary": "…",
  "confidence": 0.0,
  "reasoning": "…"
}
```

The response packet mirrors the deterministic unit's shape with
`response_kind: "model-cognition"`, `content.layers`/`content.summary` carrying the generated
material, model-supplied `confidence` (clamped to [0,1]), and `Emissions.trace` populated from
`reasoning`.

### Fallback Semantics

On any typed model failure (`E_MODEL_TIMEOUT`, `E_MODEL_REFUSAL`, `E_MODEL_OUTPUT_MALFORMED`,
`E_MODEL_UNAVAILABLE`): if a `fallback` unit is configured, execute it and stamp the response
`response_kind: "deterministic-fallback"` with `fallback_reason` and confidence ≤ 0.5. Without a
fallback, the unit throws — the existing host quarantine + dispatcher recovery path applies.
Degradation is always visible, never silent.

## 12. Implementation Guidance

Implement as `@inevitable/product-cognition`. Keep each surface narrow:

- `ProductOnboardingService` for F01/F13.
- `LearningPathProjector` for F02/F03.
- `MVP_AGENT_MANIFESTS` for F06.
- `MasteryCheckpointRecorder` for F14.
- `SupervisorUnit` (extends `DeterministicMvpUnit`) for supervisor routing + confidence-weighted gating.
- `ProductRuntimeDispatcher` with OTel span wrapping and governance gate.
- `FiberedLearningLoop` for fiber-based multi-step cognitive sequences.
- `PRODUCT_DISPATCH_POLICIES` for baseline governance policy set.
- `ModelBackedUnit` for Phase 2B model-backed cognition (interface-only dependency on
  `@inevitable/contracts`).

Do not add model-provider SDK dependencies — provider SDKs live in `packages/adapters` behind
guarded dynamic imports; this package depends only on the `ModelRuntime` interface. Do not
introduce database clients. Do not bypass the existing package APIs even if direct object
mutation looks simpler.

## 13. Future Evolution

The next layer after this package is a product workflow package that composes these primitives into
long-running sessions with replay, late-agent contributions, and user-facing application surfaces.

Phase 2C extends model-backed cognition to media modalities (image/voice/live) through the same
recording seam, and deepens the F04 seven-layer model beyond layers 0–1.
