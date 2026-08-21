```yaml
spec:
  title: Cognitive Scheduler
  domain: kernel
  status: draft
  owner: kernel-team
  last_reviewed: 2026-06-02
  upstream_dependencies:
    - kernel/cognitive-identity
    - kernel/capability-envelope
    - kernel/governance-kernel
  downstream_dependencies:
    - kernel-internals/cognition-syscalls
    - runtime/cognitive-unit-runtime
    - orchestration/hierarchical-directors
    - scheduler/cost-aware-scheduling
  related_protocols:
    - cognition-packet-protocol
    - cognitive-event-protocol
  related_events:
    - orchestration.task.routed
    - system.resource.threshold
    - workflow.suspended
    - workflow.resumed
  related_runtime_systems:
    - cognitive-unit-runtime
    - agent-population-manager
  related_governance_systems:
    - governance-kernel
    - capability-envelope
  related_observability_systems:
    - cognitive-observability
  semantic_tags: [scheduler, priority, fairness, preemption, budget, qos, backpressure, pedagogy-aware]
  canonical_references:
    - ../architecture/uci-architecture.md#55-cognitive-scheduler
```

# Cognitive Scheduler

## Purpose

Define the Cognitive Scheduler: the kernel service that decides *which cognitive unit runs where and
when*. It is the Linux CFS scheduler and the Kubernetes scheduler combined, adapted for probabilistic
reasoning — arbitrating priority, fairness, deadlines, cost budgets, semantic affinity, memory
locality, region constraints, and risk class. Routing ("which unit") is an input to scheduling, not a
substitute for it.

## Philosophy

Cognition is a scarce, costly, latency-sensitive resource. Without a scheduler, the system either
starves interactive learners behind background consolidation or burns budget on low-value reasoning.
Scheduling must be **priority-aware, fair, preemptible, budget-bounded, and pedagogy-aware** — a live
classroom interaction or a safety review must be able to interrupt background evolution.

## Architecture

The scheduler consumes scheduling requests (`COG_SCHEDULE` [syscall](../kernel-internals/cognition-syscalls.md)),
computes priority, and dispatches work to units acquired from the
[Agent Population Manager](../runtime/cognitive-unit-runtime.md) (warm pools). It honors the requester's
[capability envelope](capability-envelope.md) (regions, models, cost ceiling) and yields to
[governance](governance-kernel.md) preemption.

```
COG_SCHEDULE ─► ready queue (priority) ─► dispatch ─► unit (warm pool)
   inputs: intent priority, user tier/fairness, capability match, memory locality,
           region, load, cost budget, trust/policy, reasoning depth, deadline, risk, cache
   outputs: assigned unit, runtime zone, resource lease, context lease ref, model route,
            timeout policy, retry policy, observability contract
```

## Primitives

**CognitiveWorkItem** — canonical JSON Schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "cos:protocol:cognitive-work-item:1.0.0",
  "title": "CognitiveWorkItem",
  "type": "object",
  "required": ["work_id", "work_type", "requester_cid", "priority"],
  "properties": {
    "work_id": { "type": "string" },
    "work_type": { "type": "string", "enum": ["student_interaction","assessment","curriculum_planning","memory_consolidation","evolution","safety_review","analytics"] },
    "requester_cid": { "type": "string" },
    "target_unit_type": { "type": ["string","null"] },
    "packet_ref": { "type": ["string","null"], "description": "Cognition Packet id" },
    "priority": { "type": "integer", "minimum": 1, "maximum": 10, "description": "1 = highest" },
    "deadline_ms": { "type": ["integer","null"] },
    "max_time_seconds": { "type": "number", "minimum": 0 },
    "cost_budget_usd": { "type": ["number","null"] },
    "region_hint": { "type": ["string","null"] },
    "risk_class": { "type": "string", "enum": ["low","medium","high"] }
  },
  "additionalProperties": false
}
```

Illustrative TypeScript:

```ts
interface CognitiveWorkItem {
  workId: string;
  workType: "student_interaction"|"assessment"|"curriculum_planning"|"memory_consolidation"|"evolution"|"safety_review"|"analytics";
  requesterCid: string;
  targetUnitType: string | null;
  packetRef: string | null;
  priority: number;                  // 1 highest .. 10 lowest
  deadlineMs: number | null;
  maxTimeSeconds: number;
  costBudgetUsd: number | null;
  regionHint: string | null;
  riskClass: "low" | "medium" | "high";
}
```

Priority order (default): `safety_review < student_interaction < assessment < curriculum_planning <
memory_consolidation < evolution` (lower number = scheduled first), with deadline-boost and fairness
adjustments.

## Protocols and Contracts

- `submit(work_item) → handle` — enqueue (`COG_SCHEDULE`).
- `dispatch()` — main loop: pop highest priority, check deadline, acquire unit, execute under timeout.
- `preempt(work_id, reason)` — governance/safety/resource-driven interruption; checkpoints the unit.
- `report_load() → LoadMetrics` — feeds autoscaling and backpressure.

## Runtime Semantics

Cooperative by default; **preemptive** under policy, safety, or resource pressure. Past-deadline items
are rejected with `system.resource.threshold`. The scheduler applies **backpressure** to producers
when the [bus](../communication/universal-cognitive-bus.md) or pools saturate, and performs
**load-shedding** (pause evolution/analytics, defer consolidation, collapse to core agents) per
blueprint §22.4. Memory-locality preference co-locates a learner's session near its memory partition.

## Event and State Transitions

- `orchestration.task.routed` — work dispatched to a unit.
- `system.resource.threshold` — deadline miss, queue depth, or budget pressure.
- `workflow.suspended` / `workflow.resumed` — preemption checkpoints.

Work item: `Submitted → Queued → Dispatched → (Running) → Completed | Preempted | Rejected`.

## Observability

Queue depth, wait time, preemption rate, deadline-miss rate, cost-per-work-type, and fairness
deviation are exported. Scheduling decisions are evented and replayable (frozen during replay for
determinism, supporting stable routing at levels D2+).

## Governance and Security

The scheduler enforces `cost_ceiling_usd`, `regions_allowed`, and `models_allowed` from the
[capability envelope](capability-envelope.md), and yields to governance preemption. It cannot widen a
unit's envelope. Region constraints enforce data sovereignty.

## Failure Semantics

- **Pool exhaustion** → cold-start or queue with backpressure; shed low-priority work.
- **Deadline miss before dispatch** → reject with event; caller decides fallback.
- **Unit timeout** → reject work, release/quarantine unit, optional retry per policy.
- **Scheduler crash** → ready queue is reconstructable from the event log (event-sourced); in-flight
  items recovered from unit checkpoints.

## Testing and Validation

- **Unit:** priority computation; deadline boosting; fairness; budget enforcement.
- **Integration:** preemption checkpoints and resumes; load-shedding order correct.
- **Failure:** pool exhaustion, timeout, and crash-recovery paths.
- **Replay:** scheduling decisions reconstructable; stable under frozen replay.
- **Governance:** envelope ceilings and region constraints honored.

## Evolution Strategy

Scheduling heuristics (priority weights, autoscale thresholds, fairness policy) are evolvable via
[Evolution Proposals](../evolution/evolution-proposals.md) (risk class E1). The threading model
([cognitive fibers](../runtime/cognitive-unit-runtime.md)) and cost-aware economics deepen this in
Phase 1D+ ([scheduler/](../scheduler/) domain).
