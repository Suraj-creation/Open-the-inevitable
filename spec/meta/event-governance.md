# Event Governance

Events are immutable cognition history.

## Rules

- Every event family has an owner.
- Every event schema has a version.
- Every event defines retention and replay behavior.
- Every event carries causation and correlation identifiers.
- Every event defines governance classification.
- Every event-producing implementation must be observable.

## Invalid Patterns

- Silent state mutation.
- Unversioned event payloads.
- Events without causality.
- Events without replay semantics.

