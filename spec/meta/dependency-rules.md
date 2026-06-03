# Dependency Rules

Spec dependencies must be explicit.

## Dependency Types

- Philosophical dependency.
- Protocol dependency.
- Runtime dependency.
- Event dependency.
- Memory dependency.
- Governance dependency.
- Observability dependency.
- Infrastructure dependency.
- Reference-repo dependency.

## Rules

- High-level specs may depend on lower-level specs, but lower-level kernel/protocol specs should avoid depending on product-facing specs.
- Protocol specs must list consumers and producers.
- Runtime specs must list required events and observability.
- Memory specs must list mutation and replay behavior.
- Governance specs must list enforcement points.

