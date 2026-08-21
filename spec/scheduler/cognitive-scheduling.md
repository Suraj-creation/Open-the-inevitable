```yaml
spec:
  title: Cognitive Scheduling — Preemption, Fairness, Budgets & Backpressure
  domain: scheduler
  status: draft
  owner: kernel-team
  last_reviewed: 2026-06-02
  upstream_dependencies:
    - kernel/cognitive-scheduler
    - execution/cognitive-execution-engine
    - protocols/cognitive-work-item
    - kernel/capability-envelope
  downstream_dependencies:
    - scaling/load-shedding
    - cognitive-economics/reasoning-budgets
  related_protocols: [cognitive-work-item, cognitive-event-protocol]
  related_events: [orchestration.work.scheduled, orchestration.work.preempted, governance.budget.exceeded, orchestration.work.shed]
  related_runtime_systems: [cognitive-scheduler, execution-engine]
  related_governance_systems: [governance-kernel, capability-envelope]
  related_observability_systems: [cognitive-observability]
  semantic_tags: [scheduler, preemption, fairness, budgets, backpressure, load-shedding, qos, determinism]
  canonical_references:
    - kernel/cognitive-scheduler
    - ../architecture/uci-architecture.md#13-cognitive-observability
```

# Cognitive Scheduling — Preemption, Fairness, Budgets & Backpressure

## Purpose

Deepen the Phase 1C ready queue ([kernel/cognitive-scheduler](../kernel/cognitive-scheduler.md)) into a
production scheduler that arbitrates contended cognitive resources with **preemption, fairness,
budgets, and backpressure/load-shedding** — deterministically.

## Philosophy

Scheduling is a governed kernel decision, not best-effort. Priority alone starves; pure fairness
ignores urgency. We combine **priority** (work-item `priority`, 1 = highest), **weighted fairness**
across requesters/tenants (no actor monopolizes cognition), **budgets** (time/cost ceilings enforced
before and during execution), and **backpressure** (bounded queues that shed the least-valuable work
under pressure). All decisions are deterministic given inputs and emit observability events.

## Primitives

| Primitive | Description |
|---|---|
| `DepthScheduler` | admits work items, dispatches by priority+fairness, supports preemption & shedding |
| `FairnessPolicy` | weighted round-robin across `requester_cid`/tenant to bound starvation |
| `Budget` | per-requester remaining time/cost; `charge()`/`canAfford()`; `governance.budget.exceeded` on breach |
| `BackpressurePolicy` | max queue depth; admission control; sheds lowest-priority/over-budget items |
| `RunningSlot` | bounded concurrency; a higher-priority arrival may preempt a lower-priority slot |

## Runtime Semantics

1. **Admission**: `submit(item)` checks backpressure (queue full → shed lowest-value or reject) and
   budget (no remaining budget → reject with `governance.budget.exceeded`).
2. **Dispatch**: `next()` selects by priority, breaking cross-requester ties via the fairness policy
   (least-recently-served eligible requester), then submission order — fully deterministic.
3. **Preemption**: with bounded `RunningSlot`s, an arriving item of strictly higher priority preempts
   the lowest-priority running item; the preempted item is re-queued with its progress (cooperative —
   the execution engine yields at the next scheduling point) and `orchestration.work.preempted` emits.
4. **Budgets**: dispatch charges estimated cost; overruns during execution trigger budget re-check and
   may preempt/cancel.
5. **Backpressure/shedding**: above the high-water mark, the scheduler sheds the lowest-priority and
   over-budget items first, emitting `orchestration.work.shed` — never silently (no-silent-caps law).

## Events, Observability, Governance, Failure, Testing, Evolution

- Events: `orchestration.work.scheduled|preempted|shed`, `governance.budget.exceeded`.
- Observable: queue depth, per-requester service counts, preemption/shed counts, budget utilization.
- Governance: budgets and risk-class gates are policy-driven; high-risk work may require review.
- Failure: under overload the scheduler degrades predictably (shed by value), never deadlocks; a
  starved requester is provably bounded by the fairness weight.
- Tests: priority+FIFO baseline preserved; fairness prevents starvation under a flooding requester;
  preemption returns the right item; budget exhaustion rejects/cancels; shedding drops the
  lowest-value work and emits events; determinism across identical input sequences.
- Evolution: pedagogy-aware and cost-aware (cognitive-economics) scoring; multi-region/sharded
  scheduling (scaling); deadline-driven EDF mode.
