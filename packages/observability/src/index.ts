/**
 * @inevitable/observability — cognitive observability foundations.
 * Spec: spec/observability/cognitive-observability.md, spec/telemetry/, spec/protocols/reasoning-trace-protocol.md.
 */
export type { TraceContext } from "./trace";
export { newRootTrace, childSpan, traceFields } from "./trace";

export type { Logger, LogLevel, LogRecord, LogSink, StructuredLoggerOptions } from "./logger";
export { StructuredLogger, ConsoleJsonSink, MemorySink } from "./logger";

export type { Counter, Histogram, Meter, MetricSnapshot } from "./metrics";
export { InMemoryMeter } from "./metrics";

export { getTracer, withSpan, SpanStatusCode } from "./otel";
export type { Span, Tracer, Attributes } from "./otel";

export type {
  AnalysisEngineOptions,
  CalibrationBin,
  ConceptOutcomeStats,
  DriftStats,
} from "./cognitive-analysis";
export { CognitiveAnalysisEngine } from "./cognitive-analysis";
