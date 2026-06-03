# Retrieval Optimization

The spec system must remain navigable as it grows.

## Rules

- Every spec declares semantic tags.
- Every spec links upstream and downstream dependencies.
- Every protocol has an index entry.
- Every event family has an index entry.
- Every runtime module has an index entry.
- Every governance policy has an index entry.
- Every major architecture decision has an ADR.

## Retrieval Maps

Use `spec/indexes/retrieval-map.md` for high-level lookup and `spec/indexes/dependency-graph.md` for dependency traversal.

## Duplicate Control

If two specs define the same primitive, choose one canonical definition and link the other as a projection or application.

