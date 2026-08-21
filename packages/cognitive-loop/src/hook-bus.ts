/**
 * HookBus — the LIVE runtime-event channel (spec 11 §5): ephemeral interception, observability, and
 * transformation, kept strictly separate from the durable event log. Handlers registered on a hook run
 * in registration order as a waterfall — each may return a transformed payload (passed to the next) or
 * nothing (observe-only). It is never persisted; a meaningful live transition is PROMOTED to a durable
 * fact by the consumer (e.g. the gateway records a model invocation), never by this bus itself. This is
 * the seam that lets policy, observability, cancellation, and recording attach to cognition without the
 * cognitive core importing any of them.
 */
export type HookHandler<T> = (payload: T) => T | void | Promise<T | void>;

/** Canonical live hook points around the model faculty (extend as real consumers appear). */
export const HOOKS = {
  preModelRequest: "pre-model-request",
  postModelRequest: "post-model-request",
} as const;

export class HookBus {
  private readonly handlers = new Map<string, Array<HookHandler<unknown>>>();

  /** Register a handler for a hook; returns an unsubscribe function (live channels are revocable). */
  on<T>(hook: string, handler: HookHandler<T>): () => void {
    const stored = handler as unknown as HookHandler<unknown>;
    const list = this.handlers.get(hook) ?? [];
    list.push(stored);
    this.handlers.set(hook, list);
    return () => {
      const current = this.handlers.get(hook);
      if (!current) return;
      const index = current.indexOf(stored);
      if (index >= 0) current.splice(index, 1);
    };
  }

  /**
   * Run a hook's handlers as a waterfall: each handler observes the current payload and may return a
   * transformed one (passed onward). Returns the final (possibly transformed) payload. No handlers ⇒
   * the payload passes through unchanged.
   */
  async run<T>(hook: string, payload: T): Promise<T> {
    let current: T = payload;
    for (const handler of this.handlers.get(hook) ?? []) {
      const next = await (handler as unknown as HookHandler<T>)(current);
      if (next !== undefined) current = next as T;
    }
    return current;
  }
}
