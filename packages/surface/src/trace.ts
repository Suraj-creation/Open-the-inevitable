/**
 * Trace capture — every visible artifact traces back to its sources.
 *
 * Resolves the full provenance chain of a block: block → announcing event → packet →
 * agent CID → world-state nodes → memory mutation. Nothing appears magically; everything
 * is explainable.
 *
 * Spec: spec/surface/cognitive-surface-runtime.md §8 (Trace API).
 */
import type { CognitiveEvent } from "@inevitable/protocols";
import { CosError, err, ok, type Result } from "@inevitable/shared";
import type { WorldStateGraph } from "@inevitable/world-state";

import type { SurfaceState } from "./projection";

export interface BlockTrace {
  readonly block_id: string;
  readonly block_type: string;
  readonly version: number;
  readonly packet_id: string | null;
  readonly producer_cid: string;
  readonly agent_id: string | null;
  readonly source_event_id: string | null;
  readonly trace_id: string | null;
  readonly memory_mutation_id: string | null;
  readonly world_state_nodes: readonly { readonly id: string; readonly exists: boolean }[];
  readonly reason: string;
  /** Event ids of every surface event referencing this block, in bus order. */
  readonly event_chain: readonly string[];
}

function referencesBlock(event: CognitiveEvent, blockId: string): boolean {
  const payload = (event.payload ?? {}) as Record<string, unknown>;
  if (payload["block_id"] === blockId) return true;
  const block = payload["block"] as { block_id?: string } | undefined;
  if (block?.block_id === blockId) return true;
  const blockIds = payload["block_ids"] as readonly string[] | undefined;
  return Array.isArray(blockIds) && blockIds.includes(blockId);
}

export function traceBlock(
  state: SurfaceState,
  world: WorldStateGraph,
  events: readonly CognitiveEvent[],
  blockId: string,
): Result<BlockTrace, CosError> {
  const block = state.blocks.find((b) => b.block_id === blockId);
  if (!block) {
    return err(
      new CosError("E_SURFACE_TRACE", `block ${blockId} not present in surface state`, {
        specRef: "spec/surface/cognitive-surface-runtime.md",
        details: { blockId, surfaceId: state.surface_id },
      }),
    );
  }

  return ok({
    block_id: block.block_id,
    block_type: block.block_type,
    version: block.version,
    packet_id: block.provenance.packet_id,
    producer_cid: block.provenance.producer_cid,
    agent_id: block.provenance.agent_id,
    source_event_id: block.provenance.source_event_id,
    trace_id: block.provenance.trace_id,
    memory_mutation_id: block.provenance.memory_mutation_id,
    world_state_nodes: block.provenance.world_state_nodes.map((id) => ({
      id,
      exists: world.getNode(id) !== undefined,
    })),
    reason: block.provenance.reason,
    event_chain: events.filter((e) => referencesBlock(e, blockId)).map((e) => e.event_id),
  });
}
