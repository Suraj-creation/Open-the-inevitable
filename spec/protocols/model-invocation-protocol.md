```yaml
spec:
  title: Model Invocation Protocol
  domain: protocols
  status: draft
  owner: runtime-team
  last_reviewed: 2026-06-12
  upstream_dependencies:
    - kernel/cognitive-identity
    - kernel/capability-envelope
    - kernel/governance-kernel
    - protocols/cognitive-event-protocol
    - replay/deterministic-replay
  downstream_dependencies:
    - product/product-cognition-runtime
    - surface/multimodal-provider-abstraction
    - interop/infrastructure-adapters
  related_protocols:
    - cognition-packet-protocol
    - reasoning-trace-protocol
    - cognitive-event-protocol
  related_events:
    - model.output.recorded
    - model.invocation.failed
  related_runtime_systems:
    - cognitive-unit-runtime
    - execution-journal
  related_governance_systems:
    - governance-kernel
  related_observability_systems:
    - cognitive-observability
  semantic_tags: [model, llm, invocation, recording, replay, determinism, D3, adapter, gemini]
  canonical_references:
    - next-generation-cognitive-operating-system-blueprint#3.3
    - replay/deterministic-replay#determinism-levels
```

# Model Invocation Protocol

## Purpose

Define the only sanctioned way a cognitive unit invokes a generative model: a typed request through
the `ModelRuntime` adapter contract, with every non-deterministic output **recorded as an event
before use** so that replay resolves from the record and never re-invokes the provider. This
protocol realizes determinism level **D3** ("external effect values reproducible") from
[deterministic replay](../replay/deterministic-replay.md) for model I/O.

## Philosophy

Real cognition requires non-deterministic models; the COS requires determinism. The resolution is
not to forbid the model but to **bound its non-determinism at the adapter edge**: the live call
happens once, its value becomes part of the permanent event record, and from that moment the system
treats the output as immutable recorded history. The model is an *oracle consulted once*; cognition
downstream of the oracle is replayable forever. A model output that was never recorded never
happened.

## Architecture

A unit calls `ModelRuntime.generate(request)` through a **RecordingModelRuntime** wrapper provided
by the composition root. The wrapper operates in one of two modes:

- **record** — delegates to the inner provider (e.g. Gemini), publishes `model.output.recorded`
  to the bus **before** returning the result to the caller, then returns it.
- **replay** — never invokes the inner provider; resolves the result from previously recorded
  `model.output.recorded` events by invocation key, in ordinal order. A missing record **fails
  closed** with `E_MODEL_REPLAY_MISS` (replay refuses rather than fabricates).

Provider SDKs live only in `packages/adapters` behind guarded dynamic imports (ADR-0003/0005);
no vendor SDK is ever a workspace dependency, and no vendor type crosses the adapter boundary.

## Primitives

Illustrative TypeScript (canonical shape; carried by `@inevitable/contracts`):

```ts
interface ModelGenerationRequest {
  prompt: string;
  system?: string;            // system instruction / persona
  model?: string;             // provider-relative model id
  maxTokens?: number;
  temperature?: number;
  seed?: number;              // best-effort provider-side determinism
  responseSchema?: object;    // JSON Schema for structured output, when supported
  invocation_key?: string;    // deterministic identity of this call (see Runtime Semantics)
}

interface ModelGenerationResult {
  text: string;
  model: string;              // resolved model id
  finishReason?: "stop" | "max_tokens" | "refusal" | "safety" | "other";
  usage?: { inputTokens?: number; outputTokens?: number };
}
```

`model.output.recorded` payload (format_version `1.0.0`):

```json
{
  "invocation_key": "agent.explanation:cp-…:explanation",
  "ordinal": 0,
  "request": { "prompt": "…", "system": "…", "model": "…" },
  "response": { "text": "…", "model": "…", "finishReason": "stop" },
  "provider": "gemini | null | <provider-id>",
  "format_version": "1.0.0"
}
```

`model.invocation.failed` carries `{ invocation_key, provider, error_code, message }`.

## Protocols and Contracts

- **Record-before-use law:** in record mode the `model.output.recorded` event MUST be published
  before the result is returned to the caller. If publication fails, the result MUST NOT be used.
- **Replay-never-invokes law:** in replay mode the inner provider MUST NOT be invoked under any
  circumstance; absence of a recorded value is a terminal typed error.
- **Invocation key determinism:** `invocation_key = <unit_id>:<packet_id>:<purpose>`, with a
  separate `ordinal` field counting calls under the same key within one execution (assigned by
  the recording wrapper). Under seeded runs
  (SeededIdGenerator + ManualClock) keys are identical between record and replay runs. Live
  (unseeded) runs produce audit-grade records that are not key-aligned re-runnable; this is
  accepted for Phase 2B and stated here deliberately.
- **Adapter contract:** providers implement `ModelRuntime` from `@inevitable/contracts`; the
  recording wrapper composes over any implementation, including the deterministic
  `NullModelRuntime` used in tests.

## Runtime Semantics

The wrapper assigns ordinals per invocation-key prefix monotonically from zero. Replay resolution
consumes recorded events in `(invocation_key, ordinal)` order. Timeouts are enforced by the caller
(the cognitive unit races the call against `timeoutMs`, default 20 000 ms; demo composition roots
may extend work-item `max_time_seconds` accordingly). The result's `finishReason` MUST be mapped by
adapters from provider-native values; `refusal`/`safety` are surfaced as `E_MODEL_REFUSAL` by units
that require content.

## Event and State Transitions

`model.*` family (owner: runtime; retention: permanent; replay: replayable; classification:
internal by default):

- `model.output.recorded` — the authoritative D3 record; published in record mode before use.
- `model.invocation.failed` — typed failure observation (timeout, unavailable, refusal, malformed).

Registered in the [event taxonomy](../events/event-taxonomy.md) and
[event index](../indexes/event-index.md).

## Observability

Every invocation is visible: the recording event itself, plus the dispatch-level OTel span already
wrapping `host.handle()` in the product runtime. Units populate `Emissions.trace` with the model's
reasoning summary and confidence. Failure events feed drift/availability dashboards.

## Governance and Security

- Real providers require a capability envelope granting network access and are subject to cost
  ceilings; the dispatch-boundary governance gate (GOV-P01/P02) applies unchanged because the model
  call happens *inside* `CognitiveUnit.execute()` behind the gate — there is no bypass path.
- Recorded requests/responses may contain learner data: recordings default to `internal`
  classification and MUST be classified `sensitive` when learner-identifying content is present;
  sensitive recordings replay only under authorized leases (per
  [deterministic replay](../replay/deterministic-replay.md)).
- API keys are deployment-edge configuration (`GEMINI_API_KEY`); they never appear in events,
  packets, or recordings.

## Failure Semantics

| Error | Meaning | Behavior |
|---|---|---|
| `E_MODEL_UNAVAILABLE` | SDK not installed / client not connectable | typed error from `connect()`; no partial state |
| `E_MODEL_TIMEOUT` | call exceeded `timeoutMs` | unit falls back or fails; `model.invocation.failed` |
| `E_MODEL_REFUSAL` | provider refused (safety/refusal finish) | unit falls back or fails; recorded |
| `E_MODEL_OUTPUT_MALFORMED` | output failed JSON parse/shape validation | unit falls back or fails |
| `E_MODEL_REPLAY_MISS` | replay-mode key/ordinal not found | **fail closed**; replay refuses to fabricate |
| `E_MODEL_RECORDING_FAILED` | record-mode event publish was blocked/invalid | result discarded (record-before-use law) |

Units MAY carry a deterministic fallback unit: on any typed model failure the fallback executes and
the response is stamped `response_kind: "deterministic-fallback"` with `fallback_reason` and
confidence ≤ 0.5, preserving liveness without hiding degradation.

## Testing and Validation

- Record mode publishes before resolving (bus log order asserted).
- Replay mode never invokes the inner provider (spy), resolves ordinal-ordered, and fails closed on
  a miss.
- Seeded record→replay round trip is byte-identical at the surface-frame level (the D3 acceptance
  test).
- CI installs no provider SDK and touches no network: `connect()` without the SDK yields
  `E_MODEL_UNAVAILABLE` (that is itself the test); provider mapping is tested via an injected fake
  client.

## Evolution Strategy

`format_version` versions the recording payload at the adapter edge (per the replay spec). New
fields are additive (MINOR). New providers implement `ModelRuntime` in `packages/adapters` without
touching this protocol. Streaming generation, tool-augmented invocation, and multimodal artifacts
(image/video/voice — Phase 2C) will extend the request/result envelopes additively and reuse the
same record-before-use and replay-never-invokes laws.
