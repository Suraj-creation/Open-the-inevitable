# Spec Schema

This file defines the expected schema for mature domain specs.

```yaml
spec:
  title:
  domain:
  status: draft | active | deprecated | superseded
  owner:
  last_reviewed:
  upstream_dependencies: []
  downstream_dependencies: []
  related_protocols: []
  related_events: []
  related_runtime_systems: []
  related_governance_systems: []
  related_observability_systems: []
  semantic_tags: []
  canonical_references: []
```

Required body sections:

1. Purpose
2. Philosophy
3. Architecture
4. Primitives
5. Protocols and Contracts
6. Runtime Semantics
7. Event and State Transitions
8. Observability
9. Governance and Security
10. Failure Semantics
11. Testing and Validation
12. Evolution Strategy

