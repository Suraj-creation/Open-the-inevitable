# Spec Governance

Specs are executable architectural law for this repository. Implementation is subordinate to the spec system.

## Spec-First Rule

If implementation changes architecture, runtime semantics, memory behavior, protocol behavior, orchestration flow, governance semantics, observability semantics, event contracts, or execution semantics:

1. Update or create the relevant spec first.
2. Validate coherence with upstream and downstream specs.
3. Update indexes and dependency maps.
4. Implement.
5. Validate implementation against the spec.
6. Feed implementation lessons back into the spec.

## Governance Responsibilities

- Keep primary architecture documents complementary.
- Keep indexes accurate.
- Keep ADRs for major choices.
- Keep reference-repo learnings connected to implementation decisions.
- Keep research notes separate from accepted architecture until reviewed.

## Invalid Implementation

Implementation is invalid if it bypasses required protocols, governance, observability, event sourcing, memory mutation contracts, leases, or documented state transitions.

