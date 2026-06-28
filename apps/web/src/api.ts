/**
 * Typed command channel to the Surface Gateway — the ONLY mutation path (SRF-005 §4.3).
 * The client proposes intents; the governed runtime decides. The client never writes canonical state.
 */
const BASE = "/api";

/** Enter a new cognitive environment; returns the surface id to stream from. */
export async function enterSurface(goal: string, mode?: string): Promise<string> {
  const res = await fetch(`${BASE}/surface`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ goal, ...(mode ? { mode } : {}) }),
  });
  const json = (await res.json()) as { ok: boolean; surface_id?: string };
  if (!json.ok || !json.surface_id) throw new Error("gateway: failed to enter surface");
  return json.surface_id;
}

export type SurfaceInteractionKind =
  | "interrupt"
  | "jump"
  | "branch"
  | "challenge"
  | "request_depth"
  | "request_simplify"
  | "request_example";

export type SurfaceCommand =
  | { type: "ask"; goal?: string }
  | { type: "expand"; block_id: string; layer: number }
  | { type: "close"; reason?: string }
  | { type: "interact"; kind: SurfaceInteractionKind; target_id?: string; note?: string };

/** Send a typed command into a living surface. Effects return over the stream, not here. */
export async function sendCommand(surfaceId: string, command: SurfaceCommand): Promise<void> {
  await fetch(`${BASE}/surface/${surfaceId}/command`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(command),
  });
}

/** The full causal chain behind one visible block — why it appeared (SRF-001 §8 Trace API). */
export interface BlockTraceView {
  readonly block_id: string;
  readonly producer_cid: string;
  readonly agent_id: string | null;
  readonly reason: string;
  readonly packet_id: string | null;
  readonly trace_id: string | null;
  readonly memory_mutation_id: string | null;
  readonly world_state_nodes: readonly { readonly id: string; readonly exists: boolean }[];
  readonly event_chain: readonly string[];
}

/** Resolve a block's provenance chain from the gateway. */
export async function fetchTrace(
  surfaceId: string,
  blockId: string,
): Promise<BlockTraceView | null> {
  const res = await fetch(`${BASE}/surface/${surfaceId}/trace/${blockId}`);
  const json = (await res.json()) as { ok: boolean; trace?: BlockTraceView };
  return json.ok && json.trace ? json.trace : null;
}
