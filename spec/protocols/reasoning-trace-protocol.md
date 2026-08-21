```yaml
spec:
  title: Reasoning Trace Protocol
  domain: protocols
  status: draft
  owner: observability-team
  last_reviewed: 2026-06-02
  upstream_dependencies:
    - kernel/cognitive-identity
    - protocols/cognition-packet-protocol
    - protocols/cognitive-event-protocol
  downstream_dependencies:
    - observability/cognitive-observability
    - observability/reasoning-debugger
    - reasoning/pluggable-reasoning-engines
    - replay/deterministic-replay
  related_protocols:
    - cognition-packet-protocol
    - cognitive-event-protocol
    - cognitive-unit-abi
  related_events:
    - reasoning.started
    - reasoning.strategy.selected
    - reasoning.claim.produced
    - reasoning.uncertainty.updated
    - reasoning.completed
  related_runtime_systems:
    - cognitive-unit-runtime
    - reasoning-engine-runtime
  related_governance_systems:
    - governance-kernel
  related_observability_systems:
    - cognitive-observability
    - claim-graph
  semantic_tags: [reasoning-trace, claims, evidence, introspection, confidence, self-critique, debuggability]
  canonical_references:
    - ../architecture/uci-architecture.md#28-reasoning-trace
    - ../architecture/uci-architecture.md#132-telemetry-types
```

# Reasoning Trace Protocol

## Purpose

Define the Reasoning Trace: a **structured** execution record of how a cognitive unit reached an
output — sufficient for debugging, evaluation, and trust, without requiring unsafe exposure of raw
hidden chain-of-thought. The trace is the bridge between opaque model calls and a system that can
observe, audit, and improve its own reasoning.

## Philosophy

"The system must observe itself" (Axiom 5). A black-box LLM call is unobservable and untrustworthy at
scale. But raw hidden reasoning is both unsafe to expose and unreliable as ground truth. The reasoning
trace captures the *structured* artifacts of reasoning — interpretation, strategy, retrieved context
summaries, claims, evidence per claim, uncertainty, alternatives, governance checks, decision, and
self-critique — so the system gains introspection (claim graphs, drift, hallucination lineage,
calibration) while respecting safety and privacy boundaries.

## Architecture

A reasoning engine, invoked via the `COG_REASON`
[syscall](../kernel-internals/cognition-syscalls.md), emits a trace alongside its output
[packet](cognition-packet-protocol.md). The trace is recorded as a chain of
[Cognitive Events](cognitive-event-protocol.md) (`reasoning.*`) and assembled into a
[claim graph](../observability/cognitive-observability.md). The
[reasoning debugger](../observability/reasoning-debugger.md) consumes traces for inspection and replay.

## Primitives

Canonical JSON Schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "cos:protocol:reasoning-trace:1.0.0",
  "title": "ReasoningTrace",
  "type": "object",
  "required": ["trace_id", "producer_cid", "task_interpretation", "strategy", "claims", "decision"],
  "properties": {
    "trace_id": { "type": "string" },
    "producer_cid": { "type": "string" },
    "session_id": { "type": ["string", "null"] },
    "task_interpretation": { "type": "string" },
    "strategy": { "type": "string", "description": "chain | tree | graph | debate | reflection | planner-executor | symbolic | retrieval-grounded | simulation | causal | socratic | consensus" },
    "retrieved_context": { "type": "array", "items": { "type": "object" }, "description": "summaries + provenance, not raw private memory" },
    "claims": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["claim_id", "statement", "confidence"],
        "properties": {
          "claim_id": { "type": "string" },
          "statement": { "type": "string" },
          "evidence": { "type": "array", "items": { "type": "object" } },
          "confidence": { "type": "number", "minimum": 0, "maximum": 1 },
          "support_status": { "type": "string", "enum": ["supported","weakly_supported","contested","unsupported"] }
        }
      }
    },
    "tool_calls": { "type": "array", "items": { "type": "object" } },
    "uncertainty_estimate": { "type": "number", "minimum": 0, "maximum": 1 },
    "alternatives_considered": { "type": "array", "items": { "type": "object" } },
    "governance_checks": { "type": "array", "items": { "type": "string" }, "description": "GovernanceDecision ids" },
    "decision": { "type": "string" },
    "self_critique": { "type": ["string", "null"] },
    "determinism_level": { "type": "string", "enum": ["D0","D1","D2","D3","D4"] }
  },
  "additionalProperties": false
}
```

Illustrative TypeScript:

```ts
interface ReasoningClaim { claimId: string; statement: string; evidence: Array<Record<string,unknown>>; confidence: number; supportStatus: "supported"|"weakly_supported"|"contested"|"unsupported"; }
interface ReasoningTrace {
  traceId: string; producerCid: string; sessionId: string | null;
  taskInterpretation: string; strategy: string;
  retrievedContext: Array<Record<string, unknown>>; claims: ReasoningClaim[];
  toolCalls: Array<Record<string, unknown>>; uncertaintyEstimate: number;
  alternativesConsidered: Array<Record<string, unknown>>; governanceChecks: string[];
  decision: string; selfCritique: string | null;
  determinismLevel: "D0"|"D1"|"D2"|"D3"|"D4";
}
```

## Protocols and Contracts

- Emitted by every reasoning engine via the [ABI](cognitive-unit-abi.md) `execute()` and `reflect()`
  steps; `reflect()` populates `self_critique`.
- Each claim carries its own evidence and `support_status`, feeding the
  [claim graph](../observability/cognitive-observability.md).
- `governance_checks` references the [governance decisions](../kernel/governance-kernel.md) applied.
- `determinism_level` declares replay fidelity (D0–D4, blueprint §26.8).

## Runtime Semantics

The trace is produced incrementally: `reasoning.started → reasoning.strategy.selected →
reasoning.claim.produced* → reasoning.uncertainty.updated* → reasoning.completed`. Model/tool calls
inside the trace are recorded as `recorded-observation` events so replay reconstructs the trace
without live calls (D2–D3).

## Event and State Transitions

Each phase emits a `reasoning.*` event referencing `trace_id`. The completed trace is immutable;
revisions during reflection append new events rather than rewriting.

## Observability

Traces are the raw material for: evidence-coverage and claim-support metrics, unsupported-assertion
counts, confidence curves, hallucination lineage (unsupported claims propagating across units), and
reasoning-drift detection. The [reasoning debugger](../observability/reasoning-debugger.md) replays
and inspects them.

## Governance and Security

Traces summarize retrieved context with provenance rather than embedding raw private memory, honoring
[context lease](../kernel/context-lease.md) redaction. High-risk outputs require evidence
(`support_status` ≠ `unsupported`) per the architecture law; failing claims route to human review.
Trace classification follows the most restrictive contributing source.

## Failure Semantics

- **Missing trace on a production unit** → invalid (architecture law: *no production cognitive unit
  without an observability contract*); output flagged untrusted.
- **Unsupported claim in high-risk context** → blocked / escalated by governance.
- **Trace store outage** → buffer; never silently drop a production trace; degrade to reduced
  sampling only for low-risk units.

## Testing and Validation

- **Unit:** trace schema; per-claim evidence/support invariants; determinism level enum.
- **Integration:** reasoning-engine emits well-formed incremental events.
- **Observability:** claim graph and drift metrics computed correctly from traces.
- **Replay:** recorded-observation reconstruction at declared determinism level.

## Evolution Strategy

New strategies and trace fields are additive under [protocol versioning](cognitive-unit-abi.md).
Changes to what counts as sufficient evidence are governance-critical (risk class E4) and tie into the
[epistemology layer](../epistemology/) (Phase 1E+). Trace standards feed
[evolution evaluation](../evolution/evolution-proposals.md) of reasoning engines.
