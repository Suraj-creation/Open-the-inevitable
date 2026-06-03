# Tests

Verification suites live here.

Tests must map back to spec domains and implementation contracts. For cognitive infrastructure, passing tests should cover behavior, replay, governance, and failure recovery, not only happy-path functions.

## Test Boundaries

- `unit/` - package-level behavior.
- `integration/` - cross-package and service contracts.
- `replay/` - event sourcing and deterministic reconstruction.
- `governance/` - policy, approval, escalation, and audit behavior.
- `failure/` - partial failure, retries, degradation, loop containment, and recovery.

