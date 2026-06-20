/**
 * ProvenancePeek — replaces the inert metadata inspector with a causality narrative. Every block on
 * the surface is explainable: this shows *why this appeared* (the agent, the reason, the world-state
 * it derives from, whether it became memory) and can resolve the full event chain from the gateway.
 */
import { useEffect, useState } from "react";
import type { CognitionBlock } from "@inevitable/surface/client";
import { fetchTrace, type BlockTraceView } from "../api";
import { identityFor } from "../agents";

export interface ProvenancePeekProps {
  readonly surfaceId: string;
  readonly block: CognitionBlock | null;
}

export function ProvenancePeek({ surfaceId, block }: ProvenancePeekProps) {
  const [trace, setTrace] = useState<BlockTraceView | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setTrace(null);
    setOpen(false);
  }, [block?.block_id]);

  if (!block) {
    return (
      <section className="provenance" aria-label="Provenance">
        <h2 className="rail-title">Why</h2>
        <p className="rail-empty">Select cognition on the stage to see why it appeared.</p>
      </section>
    );
  }

  const agent = identityFor(block.provenance.agent_id ?? block.provenance.producer_cid);
  const reveal = async (): Promise<void> => {
    setOpen(true);
    if (!trace) setTrace(await fetchTrace(surfaceId, block.block_id));
  };

  return (
    <section className="provenance" aria-label="Provenance">
      <h2 className="rail-title">Why this</h2>
      <div className="prov-card">
        <span className="prov-agent">
          <span className="prov-sigil" style={{ color: agent.accent }}>
            {agent.sigil}
          </span>
          {agent.label}
        </span>
        <p className="prov-reason">{block.provenance.reason}</p>
        <dl className="prov-facts">
          <div>
            <dt>confidence</dt>
            <dd>{Math.round(block.confidence * 100)}%</dd>
          </div>
          {block.concept_ids.length > 0 ? (
            <div>
              <dt>concept</dt>
              <dd>{block.concept_ids.join(", ")}</dd>
            </div>
          ) : null}
          {block.provenance.memory_mutation_id ? (
            <div>
              <dt>memory</dt>
              <dd>committed</dd>
            </div>
          ) : null}
        </dl>
        {open ? (
          trace ? (
            <div className="prov-trace">
              <span className="prov-trace-line">
                derives from {trace.world_state_nodes.length} world-state node
                {trace.world_state_nodes.length === 1 ? "" : "s"}
              </span>
              <span className="prov-trace-line">
                announced by {trace.event_chain.length} event
                {trace.event_chain.length === 1 ? "" : "s"}
              </span>
              {trace.packet_id ? (
                <span className="prov-trace-line">packet {trace.packet_id.slice(0, 16)}…</span>
              ) : null}
            </div>
          ) : (
            <span className="prov-trace-line">resolving chain…</span>
          )
        ) : (
          <button type="button" className="prov-more" onClick={() => void reveal()}>
            trace the full chain →
          </button>
        )}
      </div>
    </section>
  );
}
