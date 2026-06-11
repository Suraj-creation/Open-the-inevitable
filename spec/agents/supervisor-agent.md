---
name: supervisor-agent
spec:
  id: AGT-SUP-001
  title: Supervisor Agent — Routing & Arbitration
  domain: agents
  status: draft
  owner: product-architecture
  last_reviewed: 2026-06-05
  upstream_dependencies:
    - product/features/F06-specialized-agent-ecosystem
    - product/features/F07-realtime-cognitive-orchestration
    - world-state/world-state-graph
    - memory/memory-tiers
    - kernel/capability-envelope
    - kernel/context-lease
    - protocols/cognition-packet-protocol
    - protocols/cognitive-event-protocol
    - runtime/cognitive-unit-runtime
  downstream_dependencies:
    - packages/product-cognition
    - product/product-cognition-runtime
  related_protocols:
    [cognition-packet-protocol, cognitive-event-protocol, reasoning-trace-protocol, cognitive-unit-abi]
  related_events:
    [supervisor.route, agent.activated, agent.output.accepted, agent.output.rejected]
  related_runtime_systems:
    [cognitive-unit-runtime, world-state-graph, cognitive-scheduler, universal-cognitive-bus]
  related_governance_systems: [governance-kernel, capability-envelope, context-lease, intent-lease]
  related_observability_systems: [cognitive-observability, otel-edge, reasoning-trace]
  semantic_tags:
    [supervisor, routing, arbitration, world-state, mastery, phase-tracking, cognitive-unit]
  canonical_references:
    - product/features/F06-specialized-agent-ecosystem#6
    - product/features/F07-realtime-cognitive-orchestration#6
    - product/product-cognition-runtime#7
---

# Supervisor Agent — Routing & Arbitration

## 1. Purpose

The Supervisor Agent is the **single routing authority** in the product-cognition runtime. It reads
the learner's current world-state (mastery checkpoints, concept phase-tracking props) and emits a
governed routing decision that selects the next specialist agent for a given concept and learner.

The Supervisor makes orchestration a **governed, observable, replayable** step. It replaces
imperative control flow ("call explanation then practice") with a world-state-driven decision that
is recorded in the event log and can be replayed to reconstruct why a learner experienced a
particular learning sequence.

## 2. Scope & Boundaries

- **In scope:** routing decisions based on mastery checkpoints and phase-tracking world-state;
  `supervisor.route` event emission; `SupervisorRoutingDecision` return in response packet content.
- **Out of scope:** evaluating the quality of explanations or practice; arbitrating disagreements
  between agents; memory mutation (read-only access to world-state and memory).
- **Non-goals:** direct agent-to-agent calls; session lifecycle management; content generation.

## 3. Identity & Manifest

The supervisor is provisioned as `agent.supervisor` with manifest ID `agent.supervisor`. Its
manifest grants:
- `capabilities`: `["agent.route", "agent.arbitrate", "governance.precheck"]`
- `memory_access.read`: `["working", "semantic", "reflective"]`
- `memory_access.write`: `[]` — the supervisor never writes memory
- `schedulerPriority`: `1` (highest priority among product agents)
- `policies`: `["product-spec-first", "governance-precheck", "reasoning-trace-required"]`

The supervisor requires an active `ContextLease` and `IntentLease` bound to the learner session.

## 4. Routing Decision Contract

### Input

The supervisor receives a `CognitionPacket` with:
- `concept_ids[0]`: the focus concept ID to route for
- `content.learnerUserId`: the learner's user ID for mastery lookups
- `intent`: `"route"` (routing request)

### Routing Logic (ordered by precedence)

1. **`complete`** — if any `mastery_checkpoint` node exists where `conceptId` matches and
   `passed = true` for the learner's `ownerUserId`.
2. **`revision`** — if any `mastery_checkpoint` node exists where `passed = false` (and no
   passing checkpoint for the same concept+user).
3. **`assessment`** — if the concept node has
   `practice_dispatched:<learnerUserId> = true`.
4. **`practice`** — if the concept node has
   `explanation_dispatched:<learnerUserId> = true`.
5. **`explanation`** — default when no prior phase evidence exists in world-state.

### Output

The supervisor returns a `CognitionPacket` (response) with `content.routing_decision`:

```json
{
  "routing_decision": {
    "targetAgent": "explanation" | "practice" | "assessment" | "revision" | "complete",
    "reason": "<human-readable reason string>",
    "conceptId": "<concept id>"
  }
}
```

### Phase-Tracking Convention

After the calling loop dispatches an agent, it must update the concept node's world-state so the
supervisor can read phase progress on subsequent routing requests:

| After dispatching | Write delta |
|---|---|
| `explanation` agent | `set_node_prop` on `concept:<id>`: key `explanation_dispatched:<userId>` = `true` |
| `practice` agent | `set_node_prop` on `concept:<id>`: key `practice_dispatched:<userId>` = `true` |

## 5. Events

The supervisor emits one event per routing decision:

- **`supervisor.route`** — emitted by the `FiberedLearningLoop` after extracting the routing
  decision from the supervisor's response packet. Carries: `targetAgent`, `conceptId`, `reason`,
  `producerCid`, `sessionId`.

This event is the replay-observable record of the routing decision. It enables causal tracing:
"the learner received explanation because the supervisor observed no prior explanation in world-state."

## 6. Implementation

`SupervisorUnit` extends `DeterministicMvpUnit` and overrides `execute()` to:

1. Extract `conceptId` from `packet.concept_ids[0]` and `learnerUserId` from `packet.content`.
2. Call `this.route(conceptId, learnerUserId)` which queries the injected `WorldStateGraph`.
3. Embed the `SupervisorRoutingDecision` in the response packet's `content.routing_decision`.
4. Return the enriched emissions.

The `WorldStateGraph` is injected at construction time as a read-only dependency (bound via the
learner's context lease in the full runtime; direct injection in Phase 1E).

## 7. Observability

- Every `execute()` call appends a reasoning step to the journal via `reason()` effect in the
  fiber routine that invokes it (see `FiberedLearningLoop`).
- The `supervisor.route` event is the observable decision record.
- OTel span on the dispatcher wrapping the supervisor's `host.handle()` provides trace linkage.

## 8. Governance

- The supervisor reads world-state through an active `ContextLease` granted to the learner session.
- `memory_access.write: []` — the supervisor cannot mutate memory; it only reads.
- All capabilities (`agent.route`, `agent.arbitrate`) are granted in the manifest and checked by
  the Governance Kernel before execution.

## 9. Failure Semantics

| Failure | Behavior |
|---|---|
| No concept node in world-state | Default to `explanation` — start from scratch |
| World-state graph unavailable | Return `explanation` with reason `"world-state-unavailable"` |
| Packet missing `concept_ids` | Return `explanation` with reason `"no-concept-id-in-packet"` |

The supervisor is fail-safe: an unknown state always defaults to explanation (the safest start).

## 10. Confidence-Weighted Routing

A passing mastery checkpoint with low confidence indicates the learner guessed or was aided rather
than achieving genuine mastery. The supervisor enforces a `MASTERY_CONFIDENCE_THRESHOLD = 0.6`:

| Condition | Route to |
|---|---|
| `passed=true` AND `max(confidence) >= 0.6` | `complete` |
| `passed=true` AND `max(confidence) < 0.6` | `revision` (low-confidence reinforcement) |
| `passed=false` | `revision` (assessment failed) |

The reason string on low-confidence revision reads: `"mastery passed but confidence X.XX below threshold 0.6"`.

This rule applies to the **highest confidence** among all passing checkpoints for the concept, so a
learner cannot be stuck in revision if they later achieve a high-confidence pass.

## 11. Testing

- Route to `explanation` when world-state has no prior evidence for the concept.
- Route to `practice` when concept node has `explanation_dispatched:<userId>=true`.
- Route to `assessment` when concept node has `practice_dispatched:<userId>=true`.
- Route to `revision` when a `mastery_checkpoint` node has `passed=false`.
- Route to `complete` when a `mastery_checkpoint` node has `passed=true` and `confidence >= 0.6`.
- Route to `revision` (low-confidence) when `passed=true` but `confidence < 0.6`.
- Assert `supervisor.route` event in bus log after each routing cycle.

## 12. Evolution

- Add multi-concept routing: when multiple concepts are active, route to the highest-priority
  unmastered concept.
- Arbitration: when multiple agents propose conflicting actions, the supervisor arbitrates and emits
  a `disagreement.resolved` event.
- Blackboard integration: supervisor reads from the versioned blackboard (F07) rather than directly
  from world-state, so proposals from other agents are visible before routing.
