# ADR-0029: Surface Agent-Observability Events (Reasoning Summary + Work Timing)

**Status:** Accepted
**Date:** 2026-06-26
**Related:** ADR-0007 (surface choreography & timing), ADR-0017/DPS-007 (observability analysis),
ADR-0025 (cognitive ensemble orchestration), SRF-001/SRF-002, cognitive-unit-abi,
reasoning-trace-protocol, F09 (living-universe experience)

## Context

The Cognitive Surface already folds rich agent data — presence, contributions, routing decisions,
proposals, disagreements, syntheses — but the experience exposes little of it, and two things needed for
a true **Agent Observatory** are not surfaced at all:

- **Reasoning traces.** Model-backed units already *build* a `ReasoningTrace` (task interpretation,
  strategy, claims, decision, self-critique, determinism) and return it in `Emissions.trace`, but the
  runtime host never publishes it, so the viewport cannot show *how* an agent reasoned.
- **Work timing / latency.** Agent lifecycle events (`agent.executing`/`completed`) carry no
  start/end timing, so per-agent latency and progress are invisible.

Surfacing latency must not violate replay determinism: wall-clock latency legitimately differs across
live runs, and ADR-0007 forbids baking a playback clock into the fold.

## Decision

Add two additive `surface.*` events (SRF-002, `schema_version` 1.3.0) and one ABI obligation:

1. **`surface.agent.reasoning.summary`** — a structured summary of an agent's `ReasoningTrace`
   (`task_interpretation`, `strategy`, `decision`, `self_critique?`, `confidence`, `determinism_level`;
   **never** raw private memory or chain-of-thought). Folds by **append** into `agent_reasoning[]`.
2. **`surface.agent.work.timing`** — a work item's lifecycle transition
   (`admitted→dispatched→executing→completed|failed`) with real latency (`queue_wait_ms?`,
   `execution_ms?`). Folds by **upsert on `work_id`** into `agent_work_timings[]`.
3. **ABI obligation (close the `outcome` contract).** When `execute()` returns `emissions.trace`, the
   runtime publishes it to the bus as `reasoning.completed` (`reasoning.*` family, recorded-observation),
   satisfying the unit's `observability_contract` and feeding DPS-007. The surface summary is a
   *projection* of that trace for the viewport, not a replacement for the canonical bus record.

**Determinism treatment.** Latency values come from the real clock, so `agent_work_timings` is
deterministic *per event log* (re-folding the same log is byte-identical) but legitimately differs across
live runs. Crucially these values **never enter canonical block content**, so content-determinism
(SRF-001 §6.4, the `ManualClock`+`SeededIdGenerator` tests) is unaffected. Reasoning summaries are
derived from the recorded model output (D3), so they replay exactly.

## Alternatives Considered

- **Stream raw `ReasoningTrace` to the client.** Rejected: leaks model internals / private context past
  the governance boundary; the surface emits a structured *summary* only.
- **Compute timing client-side from frame arrival.** Rejected: arrival time is transport jitter, not the
  agent's real latency, and isn't replayable; emitting measured latency as event data is both accurate
  and deterministic-per-log.
- **Put latency in the block / a canonical content field.** Rejected: would couple block content to
  wall-clock and break content-determinism. Timing lives in its own append/upsert slice.
- **Only fix the host (`reasoning.completed`) and have the viewport subscribe to `reasoning.*`.**
  Insufficient: `reasoning.*` is a different family the surface fold ignores (family isolation, like
  `gateway.*`); the viewport needs a `surface.*` projection to render in-band with the rest of state.

## Consequences

- **Observability:** the Observatory can show per-agent responsibility, reasoning, decision trace,
  confidence, latency, and completion — "nothing important stays hidden" (F09 §4.1).
- **Replay/determinism:** preserved; timing is per-log deterministic and excluded from content; reasoning
  summaries derive from recorded outputs.
- **Governance:** events are emitted only within governed dispatch; summaries carry no private memory and
  inherit the session classification ceiling (SRF-002 §5/§9).
- **Evolution:** additive and forward-compatible; older folds ignore the new subtypes. `health()`-based
  drift/confidence sampling (`surface.agent.health.sampled`) is a possible future addition behind the
  same pattern.
- **Negative:** more events per ask cycle (one reasoning summary + several timing transitions per agent);
  acceptable given retention and the observability value. The Observatory must render empty states when
  an agent emits no reasoning (e.g. deterministic stub units).

## Open Questions

- Periodic `health()` sampling (drift/confidence trends) vs. on-completion only — deferred.
- Cross-agent dependency edges (which agent's work spawned which) — represented today via routing +
  work_id correlation; a richer dependency graph is future work.
