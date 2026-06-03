```yaml
spec:
  title: Cognitive Execution Engine & Cognitive Fibers
  domain: execution
  status: draft
  owner: runtime-team
  last_reviewed: 2026-06-02
  upstream_dependencies:
    - runtime/cognitive-unit-runtime
    - kernel/cognitive-scheduler
    - kernel-internals/cognition-syscalls
    - protocols/cognition-packet-protocol
    - protocols/cognitive-event-protocol
  downstream_dependencies:
    - replay/deterministic-replay
    - orchestration/orchestration-fabric
    - scheduler/cognitive-scheduling
  related_protocols:
    - cognition-packet-protocol
    - cognitive-event-protocol
    - reasoning-trace-protocol
    - cognitive-unit-abi
  related_events:
    - agent.executing
    - agent.completed
    - reasoning.step.recorded
    - orchestration.fiber.spawned
    - orchestration.fiber.completed
  related_runtime_systems:
    - cognitive-unit-runtime
    - cognitive-scheduler
    - execution-journal
  related_governance_systems:
    - governance-kernel
    - cognitive-safety
  related_observability_systems:
    - cognitive-observability
    - reasoning-trace
  semantic_tags: [execution, fibers, cooperative-scheduling, determinism, journal, continuations, replay]
  canonical_references:
    - next-generation-cognitive-operating-system-blueprint#11
    - advanced-agent-architecture#6
```

# Cognitive Execution Engine & Cognitive Fibers

## Purpose

Define the in-process engine that executes cognitive work as **cooperatively-scheduled, deterministic
fibers**, recording every step into an append-only **execution journal** so any run can be
reconstructed exactly. This is the layer between the scheduler (which decides *what* runs next) and
the unit runtime (which knows *how* a single unit behaves): it provides cognition with threads of
control that can be paused, checkpointed, preempted, replayed, and forked.

## Philosophy

Cognition unfolds across time and must be replayable, so concurrency must be *deterministic by
construction*, not merely observable after the fact. We reject preemptive OS threads for cognitive
control flow because their interleavings are non-reproducible. Instead we use **fibers**: lightweight
cooperative coroutines that yield at explicit cognitive scheduling points. The engine, not the OS,
decides interleaving — from a deterministic policy seeded by injected `Clock` and `IdGenerator`. Given
the same routines and the same external inputs, the engine produces byte-identical journals. This is
the foundation of replay determinism levels D0–D4 (see [replay/deterministic-replay](../replay/deterministic-replay.md)).

## Architecture

```
Scheduler ──ready work──► Execution Engine ──drives──► Fibers (cooperative coroutines)
                              │                            │ yield Effect
                              │◄───────────────────────────┘
                              ├─ interprets effects (emit / spawn / await / sleep / complete)
                              ├─ appends to Execution Journal (fiberId, step, effect, hlc)
                              └─ emits orchestration.* / reasoning.* events to the bus
```

- A **Fiber** wraps a `FiberRoutine`: a generator that `yield`s typed `Effect`s and is resumed with
  typed `Resume` values. Fibers carry an id (from the injected `IdGenerator`), a priority, a parent
  id (lineage), a logical step counter, and a status FSM (`Ready → Running → Waiting → Done | Failed`).
- The **Execution Engine** owns a deterministic ready set ordered by `(priority, spawnSeq)`. On each
  tick it resumes the head fiber to its next yield, interprets the effect, and updates state. The
  engine never runs two fibers truly concurrently; "parallelism" is interleaving of cooperative steps.
- The **Execution Journal** is append-only: one entry per interpreted step. It is the source of truth
  for replay, causal tracing, and checkpoint/restore.

## Primitives

| Primitive | Description |
|---|---|
| `FiberRoutine` | `(ctx) => Generator<Effect, FiberResult, Resume>` — the cognitive coroutine body |
| `Fiber` | Runtime handle: `id`, `priority`, `parentId?`, `step`, `status`, the live generator |
| `Effect` | What a fiber asks the engine to do at a yield point (see effect set below) |
| `ExecutionJournalEntry` | `{ fiberId, step, effect, hlc, resultRef? }` appended per step |
| `ExecutionEngine` | Deterministic interpreter + scheduler over fibers |
| `EngineCheckpoint` | Serializable snapshot of fiber states + journal cursor for restore/fork |

### Effect set (minimal, extensible)

| Effect | Meaning | Resume value |
|---|---|---|
| `emit(event)` | publish a Cognitive Event to the bus | `void` |
| `spawn(routine, opts)` | create a child fiber (lineage-stamped) | child `fiberId` |
| `await(token)` | suspend until a deterministic resolver provides a value for `token` | resolved value |
| `sleepLogical(ticks)` | yield for N logical ticks (fairness / pacing) | `void` |
| `reason(step)` | record a reasoning-trace step (observability) | `void` |
| `complete(value)` | finish the fiber with a result | — (terminal) |

External I/O (model calls, tool calls, store reads) is **never** performed inside a fiber directly; it
is expressed as an `await(token)` whose value is supplied by a resolver. During live execution the
resolver calls real adapters; during replay the resolver replays recorded values — this is what makes
non-deterministic effects reproducible.

## Runtime Semantics

1. `submit(routine, opts)` creates a `Ready` fiber and enqueues it.
2. `tick()` pops the highest-priority `Ready` fiber, resumes its generator to the next `yield`,
   interprets the effect, appends a journal entry (stamping the HLC via the injected clock), and
   re-files the fiber (`Ready`, `Waiting`, or terminal).
3. `runToQuiescence()` ticks until no fiber is `Ready` (all `Waiting`, `Done`, or `Failed`).
4. `resolve(token, value)` moves any fiber `Waiting` on `token` back to `Ready` with the value.
5. Determinism: ties broken by `(priority, spawnSeq)`; ids from injected `IdGenerator`; time from
   injected `Clock`/HLC. No `Date.now()` / `Math.random()` in the engine.

## Event & State Transitions

- `orchestration.fiber.spawned` on `spawn`; `orchestration.fiber.completed` / `...failed` on terminal.
- `reasoning.step.recorded` on `reason`.
- Fiber FSM: `Ready → Running → (Waiting → Ready)* → Done | Failed`. A routine that throws transitions
  the fiber to `Failed`, appends a failure entry, and (per policy) fails or quarantines its lineage.

## Observability

Every interpreted step is journaled and carries an HLC, so the full causal interleaving is
reconstructable. The engine exposes the journal, per-fiber step counts, and quiescence state. Reasoning
steps flow to the reasoning-trace system. No cognitive step exists without a journal entry.

## Governance & Security

- `emit` and `spawn` pass through the bus/governance interceptor like any other action; a fiber cannot
  escalate capability by spawning.
- Loop protection: per-fiber and per-lineage step ceilings bound runaway recursion (cognitive-safety).
- Effects are a closed set; unknown effects fail the fiber (no arbitrary side effects).

## Failure Semantics

- Routine throw → `Failed` fiber + journal failure entry; configurable lineage policy
  (`fail-fast` cancels descendants; `isolate` quarantines only the failed fiber).
- Step ceiling exceeded → `Failed` with `loop-limit` reason.
- Deterministic recovery: restoring from an `EngineCheckpoint` + replaying the journal tail reproduces
  the pre-failure state for diagnosis or forking.

## Testing & Validation

- Determinism: two runs with the same routines + seeded `IdGenerator` + `ManualClock` produce
  identical journals.
- Cooperative fairness: `sleepLogical` and priority ordering interleave as specified.
- Checkpoint/restore/fork round-trips reproduce state.
- Loop-limit and failure-policy tests.

## Evolution Strategy

Effect set is additive and versioned. Future: distributed fibers across nodes (with HLC merge),
continuation migration, and compiler-lowered fiber graphs (cognitive-ir). Distribution must preserve
the single-writer-per-journal-segment invariant to keep replay deterministic.
