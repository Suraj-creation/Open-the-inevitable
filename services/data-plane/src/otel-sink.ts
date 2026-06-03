/**
 * OtelObservabilitySink — bridges Cognitive Events and metrics onto OpenTelemetry spans/counters via
 * the OTel API. With no registered SDK these calls hit the no-op tracer/meter (safe). Restricted
 * events are redacted (no payload export). Implements `@inevitable/contracts` ObservabilitySink.
 * Spec: spec/telemetry/otel-edge.md.
 */
import {
  trace as otelTrace,
  metrics as otelMetrics,
  SpanStatusCode,
  type Tracer,
  type Meter,
  type Counter,
} from "@opentelemetry/api";
import type { CognitiveEvent } from "@inevitable/protocols";
import type { ObservabilitySink } from "@inevitable/contracts";

export class OtelObservabilitySink implements ObservabilitySink {
  private readonly tracer: Tracer;
  private readonly meter: Meter;
  private readonly counters = new Map<string, Counter>();

  constructor(name = "cos-data-plane", version = "0.1.0") {
    this.tracer = otelTrace.getTracer(name, version);
    this.meter = otelMetrics.getMeter(name, version);
  }

  trace(event: CognitiveEvent): void {
    const span = this.tracer.startSpan(event.event_type, {
      attributes: {
        "cos.event_id": event.event_id,
        "cos.producer_cid": event.producer_cid,
        "cos.classification": event.classification,
        "cos.hlc": event.hlc,
      },
    });
    if (event.classification === "restricted") {
      // Redact restricted payloads from telemetry export (governance requirement).
      span.setAttribute("cos.redacted", true);
    }
    span.setStatus({ code: SpanStatusCode.OK });
    span.end();
  }

  metric(name: string, value: number, labels?: Record<string, string>): void {
    let counter = this.counters.get(name);
    if (!counter) {
      counter = this.meter.createCounter(name);
      this.counters.set(name, counter);
    }
    counter.add(value, labels);
  }
}
