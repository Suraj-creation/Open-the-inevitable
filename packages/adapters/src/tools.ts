/**
 * InMemoryToolRuntime — in-process ToolRuntime adapter with governance capability checks and
 * event emission for observability.
 *
 * Tools are registered at composition time via `register(spec, handler)`. Production adapters
 * (MCP gateway, gRPC tool bridge) implement the same `ToolRuntime` contract from
 * `@inevitable/contracts`.
 *
 * Spec: ADR-0019. Contract: packages/contracts/src/index.ts (ToolRuntime).
 */
import type { ToolRuntime } from "@inevitable/contracts";
import { createEvent, type EventBus } from "@inevitable/events";
import {
  CosError,
  CryptoIdGenerator,
  SystemClock,
  err,
  hlcInit,
  ok,
  type Clock,
  type Hlc,
  type IdGenerator,
  type Result,
} from "@inevitable/shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ToolSpec {
  readonly name: string;
  readonly sideEffecting: boolean;
}

type ToolHandler = (params: Record<string, unknown>) => Promise<Result<unknown>>;

export interface InMemoryToolRuntimeOptions {
  /**
   * Optional governance capability check (ADR-0019 D3). When provided alongside `ownerCid`,
   * every `invoke(name, ...)` checks `checkCapability(ownerCid, 'tool.${name}')` before calling
   * the handler. Injected as a callback to avoid a hard dependency on `@inevitable/kernel`.
   */
  readonly checkCapability?: (ownerCid: string, capability: string) => boolean;
  /** CID of the owner/caller for capability checks. Required when `checkCapability` is set. */
  readonly ownerCid?: string;
  /** Optional event bus for observability (ADR-0019 D4). */
  readonly bus?: EventBus;
  readonly clock?: Clock;
  readonly idGenerator?: IdGenerator;
  readonly nodeId?: string;
}

// ---------------------------------------------------------------------------
// InMemoryToolRuntime
// ---------------------------------------------------------------------------

export class InMemoryToolRuntime implements ToolRuntime {
  private readonly registry = new Map<string, { spec: ToolSpec; handler: ToolHandler }>();
  private readonly clock: Clock;
  private readonly idGenerator: IdGenerator;
  private hlc: Hlc;

  constructor(private readonly options: InMemoryToolRuntimeOptions = {}) {
    this.clock = options.clock ?? new SystemClock();
    this.idGenerator = options.idGenerator ?? new CryptoIdGenerator();
    this.hlc = hlcInit(options.nodeId ?? "tool-runtime");
  }

  /** Register a tool with its handler. Call at composition time before any invocations. */
  register(spec: ToolSpec, handler: ToolHandler): void {
    this.registry.set(spec.name, { spec, handler });
  }

  async discover(): Promise<Array<{ name: string; sideEffecting: boolean }>> {
    return [...this.registry.values()].map(({ spec }) => ({
      name: spec.name,
      sideEffecting: spec.sideEffecting,
    }));
  }

  async invoke(name: string, params: Record<string, unknown>): Promise<Result<unknown>> {
    const entry = this.registry.get(name);
    if (!entry) {
      return err(
        new CosError("E_TOOL_NOT_FOUND", `tool "${name}" is not registered`, {
          specRef: "spec/architecture-decisions/ADR-0019-governed-tool-runtime.md",
          details: { name },
        }),
      );
    }

    // Governance capability check (ADR-0019 D3).
    const { checkCapability, ownerCid } = this.options;
    if (checkCapability && ownerCid) {
      const capability = `tool.${name}`;
      if (!checkCapability(ownerCid, capability)) {
        return err(
          new CosError(
            "E_TOOL_CAPABILITY_DENIED",
            `capability "${capability}" not granted to ${ownerCid}`,
            {
              specRef: "spec/architecture-decisions/ADR-0019-governed-tool-runtime.md",
              details: { name, ownerCid, capability },
            },
          ),
        );
      }
    }

    const start = this.clock.nowMs();
    await this.emitEvent("tool.invoked", { name, params });

    try {
      const result = await entry.handler(params);
      const durationMs = this.clock.nowMs() - start;
      await this.emitEvent("tool.completed", {
        name,
        ok: result.ok,
        durationMs,
        ...(result.ok ? {} : { error: result.error.message }),
      });
      return result;
    } catch (thrown: unknown) {
      const durationMs = this.clock.nowMs() - start;
      const message = thrown instanceof Error ? thrown.message : String(thrown);
      await this.emitEvent("tool.completed", { name, ok: false, durationMs, error: message });
      return err(
        new CosError("E_TOOL_HANDLER_THROWN", `tool "${name}" handler threw: ${message}`, {
          specRef: "spec/architecture-decisions/ADR-0019-governed-tool-runtime.md",
          details: { name },
        }),
      );
    }
  }

  private async emitEvent(eventType: string, payload: Record<string, unknown>): Promise<void> {
    const { bus } = this.options;
    if (!bus) return;
    const created = createEvent(
      {
        eventType,
        producerCid: this.options.ownerCid ?? "tool-runtime",
        producerType: "system.tool-runtime",
        payload,
        topic: `cos.${eventType}`,
        classification: "internal",
      },
      { clock: this.clock, hlc: this.hlc, idGenerator: this.idGenerator },
    );
    this.hlc = created.hlc;
    await bus.publish(created.event);
  }
}
