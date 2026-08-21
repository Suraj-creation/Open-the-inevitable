```yaml
spec:
  title: Deterministic Replay
  domain: replay
  status: draft
  owner: runtime-team
  last_reviewed: 2026-06-02
  upstream_dependencies:
    - execution/cognitive-execution-engine
    - events/event-taxonomy
    - protocols/cognitive-event-protocol
  downstream_dependencies:
    - debugging/replay-studio
    - experimentation/replay-experiments
    - evolution/shadow-testing
  related_protocols:
    - cognitive-event-protocol
    - reasoning-trace-protocol
  related_events: [observability.replay.started, observability.replay.diverged]
  related_runtime_systems: [execution-journal, cognitive-unit-runtime]
  related_governance_systems: [governance-kernel]
  related_observability_systems: [cognitive-observability, causal-graph]
  semantic_tags: [replay, determinism, journal, event-sourcing, forking, recording]
  canonical_references:
    - ../architecture/uci-architecture.md#16-evolution
```

# Deterministic Replay

## Purpose

Define how a cognitive run is reconstructed exactly from recorded inputs. Replay is the verification
backbone for debugging, evolution shadow-tests, and incident analysis: if a run cannot be replayed, it
cannot be trusted.

## Determinism Levels

| Level | Guarantee |
|---|---|
| **D0** | Event log preserved; ordering reproducible by sequence. |
| **D1** | + HLC causal ordering reproducible. |
| **D2** | + Engine interleaving reproducible (execution journal). |
| **D3** | + External effect values reproducible (recorded resolver values for model/tool/store I/O). |
| **D4** | + Bit-identical reasoning traces given the same model recordings. |

The Phase 1D substrate guarantees **D0–D2 deterministically in-process** and provides the recording
seam (the resolver) for **D3**; D4 depends on model-output recording at the adapter edge.

**Durability (Phase 2E):** the ladder governs *fidelity*; durability is the orthogonal axis beneath
it. D0 requires "the event log preserved" — the durable file backend
([Durable Cognitive Persistence](../persistence/durable-cognitive-persistence.md), DPS-001; ADR-0008)
makes "preserved" **literal and cross-process** rather than an in-memory lifetime assumption, so
D0–D3 hold across restarts and over time. Persisting is a sink (never part of the canonical record);
replaying the durable log re-invokes no provider (model/tool I/O is already recorded as
`model.output.recorded`).

**D3 realization (Phase 2B):** model I/O is recorded by the `RecordingModelRuntime` at the adapter
edge as `model.output.recorded` events (format_version `1.0.0`) per the
[Model Invocation Protocol](../protocols/model-invocation-protocol.md): record-before-use in live
runs; replay resolves from the record by `(invocation_key, ordinal)` and never re-invokes the
provider; a missing record fails closed (`E_MODEL_REPLAY_MISS`).

## Architecture

Two append-only artifacts are the source of truth: the **event log** (`@inevitable/events` bus) and the
**execution journal** (`@inevitable/execution`). Replay re-runs the same `FiberRoutine`s with a
**replaying resolver** that returns recorded values for each `await(token)` in journaled order, and a
seeded `IdGenerator` + `ManualClock` reproducing the original ids/timestamps. A **divergence detector**
compares the live journal against the recorded one step-by-step and emits
`observability.replay.diverged` at the first mismatch (the precise causal point a change took effect).

## Recording & Forking

- **Recording**: during live execution the resolver persists `(token → value)` alongside journal
  entries; ids and HLCs are already in the journal.
- **Forking**: replay up to step *k*, then switch to live execution with new inputs/policies — the
  basis for counterfactual analysis and evolution shadow-tests.

## Governance, Failure, Testing, Evolution

- Recordings carry classification; restricted recordings replay only under authorized leases.
- A corrupted/truncated journal fails closed (replay refuses rather than fabricates).
- Tests: same-seed re-run is byte-identical (D2); an injected input change diverges at exactly the
  expected step; fork-from-k reproduces the prefix then diverges deterministically.
- Evolution: D3/D4 model-output recording formats are versioned at the adapter edge.
