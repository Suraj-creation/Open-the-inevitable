# Packages

Reusable cognitive operating system primitives live here.

Packages should be protocol-first, observable, independently testable, and spec-traceable.

## Package Boundaries

- `kernel/` - cognitive kernel primitives.
- `protocols/` - packet, event, memory, runtime, governance, and interop contracts.
- `events/` - event taxonomy, envelopes, replay helpers, and validation.
- `runtime/` - cognitive unit and agent runtime abstractions.
- `memory/` - memory adapters, mutations, consolidation, and retrieval contracts.
- `world-state/` - shared temporal world-state graph primitives.
- `orchestration/` - routing, director, blackboard, and coordination primitives.
- `governance/` - policy, approval, escalation, and audit primitives.
- `observability/` - cognitive traces, metrics, replay metadata, and anomaly signals.
- `shared/` - low-level shared utilities only.
- `testing/` - reusable test harnesses, contract tests, and simulation fixtures.
- `product-cognition/` - Phase 1E bridge from product feature specs to substrate primitives,
  runtime dispatch, deterministic MVP units, explanation/practice loops, and mastery checkpoints.
