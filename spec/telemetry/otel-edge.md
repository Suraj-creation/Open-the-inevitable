```yaml
spec:
  title: OpenTelemetry Edge Wiring
  domain: telemetry
  status: draft
  owner: observability-team
  last_reviewed: 2026-06-02
  upstream_dependencies:
    - observability/cognitive-observability
    - protocols/cognitive-event-protocol
    - architecture-decisions/ADR-0003-tech-stack
  downstream_dependencies:
    - deployment/service-topology
    - services/data-plane
  related_protocols: [cognitive-event-protocol, reasoning-trace-protocol]
  related_events: [observability.*]
  related_runtime_systems: [observability-sink, otel-bootstrap]
  related_governance_systems: [governance-kernel]
  related_observability_systems: [cognitive-observability, telemetry]
  semantic_tags: [opentelemetry, otel, sdk, exporter, edge, spans, metrics, instrumentation]
  canonical_references:
    - architecture-decisions/ADR-0003-tech-stack
    - observability/cognitive-observability
```

# OpenTelemetry Edge Wiring

## Purpose

Define where and how a concrete OpenTelemetry **SDK** is registered. The COS code instruments with the
OTel **API only** (`@inevitable/observability`); the SDK + exporters are wired once, at the **service
edge** (a deployable process), per [ADR-0003](../architecture-decisions/ADR-0003-tech-stack.md).

## Philosophy

Libraries instrument; the process configures. Without a registered SDK the OTel API uses a no-op
tracer, so instrumentation is always safe to leave in place and tests need no exporter. The edge
service owns environment-specific exporter choice (OTLP/HTTP, console, none).

## Architecture

```
[ @inevitable/observability: OTel API spans/metrics + ObservabilitySink ]
                         │ instrument (no-op until SDK registered)
[ services/<edge>: bootstrapOtel() ] ── registers NodeSDK + OTLP exporter (optional dep)
                         │ bridges
[ EventBus events ] ──► ObservabilitySink ──► OTel spans/metrics ──► collector
```

- `bootstrapOtel(config)` starts the Node SDK if `@opentelemetry/sdk-node` is installed; otherwise it
  is a no-op returning a `shutdown()` stub (degrades to the API no-op tracer). The SDK packages are
  **optional dependencies** loaded via guarded dynamic import — the workspace verifies offline.
- An `OtelObservabilitySink` implements `@inevitable/contracts` `ObservabilitySink`, turning bus
  `CognitiveEvent`s into spans and `metric()` calls into OTel counters/histograms.

## Governance, Failure, Testing, Evolution

- Exported telemetry must respect classification (restricted payloads are redacted before export).
- Exporter unavailable → buffered/dropped per config, logged; never blocks cognition.
- Tests: the sink maps events→spans/metrics deterministically against an in-memory tracer/meter;
  bootstrap is a safe no-op without the SDK; service starts and shuts down cleanly.
- Evolution: add Langfuse/Prometheus sinks behind the same `ObservabilitySink` contract; trace context
  propagation across services and fibers.
```
