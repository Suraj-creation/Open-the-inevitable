# Runtime Governance

Runtime systems must preserve identity, capability boundaries, observability, and replayability.

## Rules

- Every cognitive runtime unit has identity.
- Every unit runs under a capability envelope.
- Every context access uses a context lease.
- Every long-running workflow uses an intent lease.
- Every side-effecting action passes governance.
- Every runtime transition emits telemetry.

## Runtime Review

Before adding runtime behavior, define lifecycle states, events, failure modes, checkpoint behavior, and recovery behavior.

