---
name: cognitive-surface-runtime
spec:
  id: SRF-001
  title: Cognitive Surface Runtime — Phase 2A
  domain: surface
  status: draft
  owner: product-architecture
  last_reviewed: 2026-06-11
  upstream_dependencies:
    - product/features/F16-cognitive-surface
    - product/features/F09-living-universe-experience
    - product/features/F02-dynamic-cognitive-navigation
    - product/features/F07-realtime-cognitive-orchestration
    - product/product-cognition-runtime
    - agents/supervisor-agent
    - world-state/world-state-graph
    - events/event-taxonomy
    - execution/cognitive-execution-engine
    - memory/memory-tiers
    - kernel/governance-kernel
  downstream_dependencies:
    - surface/surface-event-architecture
    - surface/surface-timeline-engine
    - surface/multimodal-provider-abstraction
    - packages/surface
  related_protocols:
    [cognition-packet-protocol, cognitive-event-protocol, memory-mutation-protocol, reasoning-trace-protocol]
  related_events:
    [surface.created, surface.block.generated, surface.block.modified, surface.timeline.updated, surface.agent.joined, surface.agent.contributed, surface.memory.attached, surface.reasoning.recorded, surface.session.closed]
  related_runtime_systems:
    [cognitive-unit-runtime, deterministic-execution-engine, world-state-graph, universal-cognitive-bus]
  related_governance_systems: [governance-kernel, capability-envelope, context-lease, intent-lease]
  related_observability_systems: [cognitive-observability, reasoning-trace, otel-edge]
  semantic_tags:
    [phase-2a, cognitive-surface, cognition-block, projection, replay, provenance, agent-contribution, living-timeline]
  canonical_references:
    - product/features/F16-cognitive-surface
    - product/Broader-feature-product#11
    - spec/cognitive_surface/cognitive_surface_dossier
---

# Cognitive Surface Runtime

## 1. Purpose

The Cognitive Surface Runtime is the first product manifestation of the Cognitive Operating
System: a runtime where cognition itself becomes visible. It is not a whiteboard, canvas,
document editor, or presentation player. It is the place where agents work, knowledge appears,
explanations evolve, memory forms, and understanding grows — in real time, on top of the
existing substrate.

The runtime turns the invisible flow of CognitionPackets, agent outputs, world-state deltas,
and memory mutations into **typed, versioned, replayable, traceable Cognition Blocks** arranged
on a **living timeline**. The UI is merely a projection. The runtime is the product.

## 2. Philosophy

- **The surface is generated, not authored.** Every visible artifact is derived from substrate
  primitives (packets, events, world-state, memory). Nothing appears magically; everything is
  explainable.
- **State and projection are strictly separated.** The canonical record is the `surface.*`
  event log plus the world-state graph. `SurfaceState` is a deterministic fold over that record.
  Rendering state (layout, viewport, fold/expand) never enters the canonical record.
- **Cognition is visible.** Supervisor routing decisions, agent contributions, disagreements,
  and memory formation are all first-class observable events that project onto the surface.
- **Quiet, navigable, deep** (F09 §4): the surface is cinematic only when cognition demands it.
- **One surface, many projections** (F16): timeline, block-document, and future scene-graph and
  dataflow projections all derive from the same Cognition Block primitive.

## 3. Architecture

```
                       ┌────────────────────────────────────────────┐
                       │              SurfaceSession                │
                       │  (lifecycle authority, learner-bound)      │
                       └──────┬─────────────────────────┬───────────┘
                              │ asks                    │ projects
              ┌───────────────▼───────────┐   ┌─────────▼───────────┐
              │ SurfaceTimelineBuilder    │   │ SurfaceProjection   │
              │ (world-state → timeline)  │   │ (events → state)    │
              └───────────────┬───────────┘   └─────────┬───────────┘
                              │ dispatches              │ renders
              ┌───────────────▼───────────┐   ┌─────────▼───────────┐
              │ AgentContributionRuntime  │   │ SurfaceRenderer     │
              │ (packets → blocks)        │   │ (state → frame)     │
              └───────────────┬───────────┘   └─────────────────────┘
                              │ uses (governed, OTel-wrapped)
              ┌───────────────▼────────────────────────────────────┐
              │ EXISTING SUBSTRATE (do not redesign)               │
              │ ProductRuntimeDispatcher · SupervisorUnit ·        │
              │ LearningPathProjector · MasteryCheckpointRecorder ·│
              │ WorldStateGraph · EventBus · TieredMemoryStore ·   │
              │ ExecutionEngine · GovernanceEngine                 │
              └────────────────────────────────────────────────────┘
```

Canonical state lives in two substrate stores:

1. **The `surface.*` event log** on the Universal Cognitive Bus — the lifecycle record of the
   surface (blocks generated/modified, agents joined/contributed, timeline updated).
2. **The world-state graph** — surface nodes (`surface_session`, `surface_block` reference
   nodes) linked to the concept/path/mastery topology the surface visualizes.

Everything else — `SurfaceState`, the rendered frame, future scene-graph layouts — is a
deterministic projection computed from those two stores.

## 4. Primitives

### 4.1 Cognition Block

The atomic semantic unit of the surface. A block is **not** a UI widget; it is a typed,
versioned, provenance-carrying record of one unit of visible cognition.

```ts
interface CognitionBlock {
  readonly block_id: string;          // "blk-" + id
  readonly surface_id: string;
  readonly block_type: CognitionBlockType;
  readonly version: number;           // starts at 1; surface.block.modified increments
  readonly created_at: string;        // ISO timestamp from injected Clock
  readonly hlc: string;               // HLC at creation
  readonly title: string;
  readonly content: Record<string, unknown>;   // typed per block_type
  readonly concept_ids: readonly string[];
  readonly classification: "public" | "internal" | "sensitive" | "restricted";
  readonly confidence: number;        // 0..1, inherited from the producing packet
  readonly provenance: BlockProvenance;  // mandatory — see §4.2
}

type CognitionBlockType =
  | "explanation" | "concept" | "timeline" | "practice" | "assessment"
  | "memory" | "simulation" | "image" | "video" | "voice"
  | "code" | "debate" | "research" | "routing";
```

Phase 2A implements text-bearing block content for all types; `simulation`, `image`, `video`,
and `voice` blocks carry `MediaArtifact` references produced by provider adapters
(`surface/multimodal-provider-abstraction`). The type set is closed per schema version and
extended only through spec revision.

### 4.2 Block Provenance (trace capture)

Every block must trace back to its sources. Provenance is mandatory at construction; a block
without provenance is invalid and must be rejected.

```ts
interface BlockProvenance {
  readonly packet_id: string | null;       // CognitionPacket that produced the content
  readonly producer_cid: string;           // agent identity (CID) that produced it
  readonly agent_id: string | null;        // product agent id ("explanation", "supervisor", …)
  readonly source_event_id: string | null; // bus event that announced the contribution
  readonly world_state_nodes: readonly string[]; // graph nodes this block derives from
  readonly memory_mutation_id: string | null;    // memory commit backing the block, if any
  readonly trace_id: string | null;        // OTel/COS correlation id from the packet
  readonly reason: string;                 // human-readable why-this-exists
}
```

### 4.3 SurfaceState

The folded, render-ready state of one surface. Pure data; no behavior; reconstructible.

```ts
interface SurfaceState {
  readonly surface_id: string;
  readonly session_id: string;            // intent lease id binding the session
  readonly learner_cid: string;
  readonly status: "active" | "closed";
  readonly goal: string | null;
  readonly blocks: readonly CognitionBlock[];      // in generation order
  readonly timeline: TimelineProjection | null;    // surface/surface-timeline-engine
  readonly agents_joined: readonly string[];       // CIDs in join order
  readonly contributions: readonly SurfaceContributionRecord[];  // agent → block linkage
  readonly routing_decisions: readonly SurfaceRoutingRecord[];
  readonly version: number;               // count of folded events
  readonly last_hlc: string | null;
}
```

### 4.4 SurfaceSession

The lifecycle authority. Bound to one learner's `OnboardingSession` (identity + envelope +
leases). Owns surface creation, the ask cycle, agent dispatch composition, and closing.

### 4.5 SurfaceProjection

A pure fold: `(events: CognitiveEvent[]) → SurfaceState`. Given the same event sequence it
must produce byte-identical state. This is the replay primitive.

### 4.6 SurfaceRenderer

A pure function `(state: SurfaceState) → frame`. Phase 2A ships a text renderer. Future
renderers (scene-graph, immersive) consume the same state; the runtime does not change.

## 5. Protocols and Contracts

- **Cognition Packets:** all agent work flows through `ProductRuntimeDispatcher.dispatch()` —
  schema-valid packets, scheduler admission, governance gate, OTel span. The surface runtime
  never invokes a unit directly.
- **Cognitive Events:** every surface lifecycle change is announced as a schema-valid
  `CognitiveEvent` in the `surface.*` family (see `surface/surface-event-architecture`).
  Events are emitted only after the state transition they describe has succeeded.
- **Memory Mutations:** durable surface artifacts persist through `TieredMemoryStore.commit()`
  typed mutations; `surface.memory.attached` is emitted after the commit succeeds, carrying the
  `mutation_id`.
- **World-State Deltas:** surface/world topology changes use typed `WorldStateGraph.apply()`
  deltas only (`upsert_node`, `upsert_edge`, `set_node_prop`).
- **No bare strings:** block content is structured; rendering text is derived at projection
  time, never stored as the canonical form of a contribution.

## 6. Runtime Semantics

### 6.1 Surface lifecycle

```
created ──ask*──▶ active ──close──▶ closed
```

1. **create** — `SurfaceSession.start(goal?)`:
   a. apply `upsert_node` for `surface:<id>` (`type: "surface_session"`) linking to the learner
      node; b. emit `surface.created`. Ordering law: world-state first, then event.
2. **ask** — `SurfaceSession.ask(input)` (repeatable):
   a. build/refresh the timeline (`SurfaceTimelineBuilder.build()` → `surface.timeline.updated`);
   b. dispatch the learning cycle through the supervisor and specialist dispatchers;
   c. convert every accepted agent response packet into Cognition Blocks via the
      `AgentContributionRuntime` (`surface.agent.joined` on first contribution,
      `surface.agent.contributed` + `surface.block.generated` per block);
   d. record the supervisor decision as a `routing` block and `surface.reasoning.recorded`.
3. **expand** — `SurfaceSession.expand(blockId, layer)` (Phase 2B, optional capability):
   progressive deepening of an existing explanation block per F04 layers 0–1.
   a. resolve the target block from the folded state (`E_SURFACE_SESSION` if absent or the
      session lacks an explanation dispatcher);
   b. re-dispatch through the **governed** explanation dispatcher with
      `content.layer = <layer>` and the block's concept ids — same gate, no bypass;
   c. emit `surface.explanation.expanded` (payload: `block_id`, `layer`, `layers`, `summary?`,
      `packet_id`, `agent_id`). Expansion IS the typed modification: the fold merges the
      deepened `layers` into the block's `content.layers` and increments the block `version`
      (no separate `surface.block.modified` is emitted for an expansion).
4. **close** — emit `surface.session.closed`; set `status: "closed"` prop on the surface node.
   A closed surface accepts no further contributions (late arrivals are dropped with an
   observable warning event, per F07 late-arrival policy).

### 6.2 Projection determinism

`SurfaceProjection.fold(events)` must be: order-respecting (bus log order), tolerant of
non-surface events (ignored), and total (an unknown `surface.*` subtype folds into version
count without altering blocks — forward compatibility). Replaying
`bus.replay({ subject: "surface.>" })` through the fold reconstructs `SurfaceState` exactly.

### 6.3 Block versioning

`surface.block.generated` creates version 1. Each `surface.block.modified` for the same
`block_id` increments `version` and replaces `content` (the event log retains all prior
versions; the projection holds the latest and counts versions).

### 6.4 Determinism requirements

All components accept injected `Clock` and `IdGenerator`. With `ManualClock` +
`SeededIdGenerator`, two runs of the same session produce identical event logs, identical
block ids, and identical folded state.

## 7. Event and State Transitions

The complete `surface.*` event family, payload contracts, ordering, and replay semantics are
owned by `surface/surface-event-architecture`. Summary of state-affecting transitions:

| Event | State transition in fold |
|---|---|
| `surface.created` | initialize state, `status: "active"` |
| `surface.timeline.updated` | replace `timeline` projection |
| `surface.block.generated` | append block (version 1) |
| `surface.block.modified` | replace block content, increment version |
| `surface.agent.joined` | append CID to `agents_joined` |
| `surface.agent.contributed` | record contribution metadata (block linkage) |
| `surface.reasoning.recorded` | append routing/reasoning record |
| `surface.memory.attached` | mark block as memory-backed (`memory_mutation_id`) |
| `surface.session.closed` | `status: "closed"` |

## 8. Observability

- Every dispatch underlying a contribution carries the existing OTel span
  (`cos.agent.dispatch`) plus packet `trace_id`/`span_id`; blocks copy the `trace_id` into
  provenance, making every visible artifact searchable in any OTel backend.
- `surface.reasoning.recorded` captures supervisor decisions verbatim (target agent, reason,
  concept) so orchestration is visible on the surface itself.
- The projection exposes `version` and `last_hlc` for drift detection between live state and
  a replayed reconstruction.
- Trace API: `traceBlock(state, block_id)` returns the full provenance chain
  (block → event → packet → agent CID → world-state nodes → memory mutation).

## 9. Governance and Security

- All agent work reaches the surface only through `ProductRuntimeDispatcher`, which evaluates
  the `GovernanceEngine` (GOV-P01 trust gate, GOV-P02 classification gate) **before** any
  state mutation. A blocked dispatch produces no block and no surface event.
- Blocks inherit `classification` from their producing packet; the projection never widens
  classification.
- The surface session is bound to the learner's `ContextLease` and `IntentLease`; an expired
  or revoked lease prevents new asks (fail-closed).
- Memory attachment is the only path to durability; it flows through typed memory mutations
  subject to the memory layer's own validation.

## 10. Failure Semantics

| Failure | Behavior |
|---|---|
| Timeline build fails (cycle/unknown prerequisite) | abort ask, return substrate `CosError`; no events emitted |
| Governance blocks a dispatch | skip that agent's contribution; record nothing on the surface; error surfaced to caller |
| Dispatch fails at host | no block generated for that agent; ask continues with remaining phases (degraded, observable) |
| Memory commit fails | block remains ephemeral (no `surface.memory.attached`); error returned |
| Event publish fails | state transition is considered failed; caller receives the error (events follow state, so no orphan state) |
| Fold encounters unknown `surface.*` subtype | count version, ignore payload (forward-compatible) |
| Contribution after close | dropped; `surface.contribution.dropped` warning event emitted |

No retries in Phase 2A; durable retry/compensation belongs to later workflow phases.

## 11. Testing and Validation

- **Lifecycle:** create → ask → close emits the documented event sequence in order.
- **Determinism:** two sessions with `ManualClock` + `SeededIdGenerator` produce identical
  event logs and identical folded state (deep-equal).
- **Replay:** folding `bus.replay({subject:"surface.>"})` reproduces live `SurfaceState`.
- **Provenance:** every generated block has non-empty `producer_cid` and resolvable
  provenance chain via `traceBlock`.
- **Governance:** an untrusted learner (trust_level 0) produces a surface with zero blocks
  and a returned governance error.
- **Versioning:** `surface.block.modified` increments version and is replayed correctly.
- **Renderer purity:** rendering the same state twice yields identical frames.

## 12. Evolution Strategy

- **Phase 2B:** real multimodal providers (Gemini first) behind the existing adapter
  interfaces; cached provider outputs become deterministic events (D3 recording seam).
- **Scene-graph projection:** a second projection (spatial layout) over the same blocks;
  layout state remains outside the canonical record.
- **CRDT synchronization:** multi-client live editing as a sync layer beneath the event log;
  replay semantics unchanged.
- **Blackboard integration (F07):** agent proposals flow through a versioned blackboard with
  supervisor arbitration before block generation; `surface.agent.disagreed` becomes active.
- **Seven-layer explanations (F04):** explanation blocks gain layer metadata and
  `surface.explanation.expanded` drives progressive deepening.
