/**
 * OpenTelemetry bridge. The COS instruments with the OTel *API* only; a concrete SDK/exporter
 * is wired at the deployment edge (ADR-0003). Without a registered provider these calls use the
 * no-op tracer, so instrumentation is always safe to leave in place.
 */
import { trace, SpanStatusCode } from "@opentelemetry/api";
import type { Span, Tracer, Attributes } from "@opentelemetry/api";

export function getTracer(name = "cos", version = "0.1.0"): Tracer {
  return trace.getTracer(name, version);
}

/** Run `fn` inside an active span, recording success/error status and always ending the span. */
export async function withSpan<T>(
  name: string,
  fn: (span: Span) => Promise<T> | T,
  attributes?: Attributes,
): Promise<T> {
  const tracer = getTracer();
  return tracer.startActiveSpan(name, async (span) => {
    try {
      if (attributes) span.setAttributes(attributes);
      const result = await fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    } finally {
      span.end();
    }
  });
}

export { SpanStatusCode } from "@opentelemetry/api";
export type { Span, Tracer, Attributes } from "@opentelemetry/api";
