# Implementation Traceability

Every implementation artifact should be traceable to the spec system.

## Traceability Chain

```text
Vision -> Architecture Spec -> Domain Spec -> Protocol/Contract -> Implementation -> Tests -> Observability Evidence
```

## Required Links

Implementation work should identify:

- Owning spec domain.
- Related ADR.
- Protocols and contracts.
- Event families.
- Memory mutations.
- Runtime lifecycle.
- Governance checks.
- Observability hooks.
- Test coverage.

## Drift Response

If code and specs disagree, either update the spec first with rationale or correct the implementation.

