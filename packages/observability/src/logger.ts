/**
 * Structured, trace-correlated logging. No cognitive decision should be unobservable
 * (spec/meta/runtime-governance.md). Logs are structured records, optionally bound to a
 * {@link TraceContext} so they join the causal/observability graph.
 */
import type { TraceContext } from "./trace";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogRecord {
  readonly level: LogLevel;
  readonly message: string;
  readonly timestampMs: number;
  readonly fields: Readonly<Record<string, unknown>>;
  readonly traceId?: string;
  readonly spanId?: string;
  readonly cognitionId?: string;
}

export interface Logger {
  debug(message: string, fields?: Record<string, unknown>): void;
  info(message: string, fields?: Record<string, unknown>): void;
  warn(message: string, fields?: Record<string, unknown>): void;
  error(message: string, fields?: Record<string, unknown>): void;
  /** Return a child logger that stamps every record with the given trace context + fields. */
  child(ctx: TraceContext, fields?: Record<string, unknown>): Logger;
}

export interface LogSink {
  emit(record: LogRecord): void;
}

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

/** Sink that writes one JSON object per line to the console. */
export class ConsoleJsonSink implements LogSink {
  emit(record: LogRecord): void {
    console.log(JSON.stringify(record));
  }
}

/** Sink that buffers records in memory — used in tests and replay inspection. */
export class MemorySink implements LogSink {
  readonly records: LogRecord[] = [];
  emit(record: LogRecord): void {
    this.records.push(record);
  }
}

export interface StructuredLoggerOptions {
  readonly level?: LogLevel;
  readonly sink?: LogSink;
  readonly nowMs?: () => number;
  readonly base?: Record<string, unknown>;
  readonly trace?: TraceContext;
}

export class StructuredLogger implements Logger {
  private readonly minLevel: number;
  private readonly sink: LogSink;
  private readonly nowMs: () => number;
  private readonly base: Record<string, unknown>;
  private readonly trace: TraceContext | undefined;

  constructor(options: StructuredLoggerOptions = {}) {
    this.minLevel = LEVEL_ORDER[options.level ?? "info"];
    this.sink = options.sink ?? new ConsoleJsonSink();
    this.nowMs = options.nowMs ?? (() => Date.now());
    this.base = options.base ?? {};
    this.trace = options.trace;
  }

  private log(level: LogLevel, message: string, fields: Record<string, unknown> = {}): void {
    if (LEVEL_ORDER[level] < this.minLevel) return;
    const record: LogRecord = {
      level,
      message,
      timestampMs: this.nowMs(),
      fields: { ...this.base, ...fields },
      ...(this.trace
        ? {
            traceId: this.trace.traceId,
            spanId: this.trace.spanId,
            cognitionId: this.trace.cognitionId,
          }
        : {}),
    };
    this.sink.emit(record);
  }

  debug(message: string, fields?: Record<string, unknown>): void {
    this.log("debug", message, fields);
  }
  info(message: string, fields?: Record<string, unknown>): void {
    this.log("info", message, fields);
  }
  warn(message: string, fields?: Record<string, unknown>): void {
    this.log("warn", message, fields);
  }
  error(message: string, fields?: Record<string, unknown>): void {
    this.log("error", message, fields);
  }

  child(ctx: TraceContext, fields: Record<string, unknown> = {}): Logger {
    return new StructuredLogger({
      level: levelFromOrder(this.minLevel),
      sink: this.sink,
      nowMs: this.nowMs,
      base: { ...this.base, ...fields },
      trace: ctx,
    });
  }
}

function levelFromOrder(order: number): LogLevel {
  const entry = (Object.entries(LEVEL_ORDER) as Array<[LogLevel, number]>).find(
    ([, value]) => value === order,
  );
  return entry ? entry[0] : "info";
}
