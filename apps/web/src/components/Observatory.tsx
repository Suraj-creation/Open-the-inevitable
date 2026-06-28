/**
 * Observatory — the Agent Observatory (F09 §4.1): the on-demand overlay where every active cognitive
 * unit becomes inspectable. Phase 1 re-homes the existing presence, ensemble, and provenance panels into
 * one dismissible surface (replacing the permanent right rail); Phase 2 enriches it with per-agent
 * reasoning summaries and work timing/latency. A pure projection of SurfaceState — it owns no truth.
 */
import type { CognitionBlock, SurfaceState } from "@inevitable/surface/client";
import { Overlay } from "./Overlay";
import { AgentPresencePanel } from "./AgentPresence";
import { CompositionPanel } from "./CompositionPanel";
import { EnsemblePanel } from "./EnsemblePanel";
import { ProvenancePeek } from "./ProvenancePeek";
import { ReasoningPanel } from "./ReasoningPanel";

export interface ObservatoryProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly surfaceId: string;
  readonly state: SurfaceState | null;
  readonly focusedBlock: CognitionBlock | null;
  /** The frame the choreographer is voicing (UCS, ADR-0030) — highlights it in the composition queue. */
  readonly activeFrameId?: string | null;
}

export function Observatory({
  open,
  onClose,
  surfaceId,
  state,
  focusedBlock,
  activeFrameId = null,
}: ObservatoryProps) {
  return (
    <Overlay
      open={open}
      onClose={onClose}
      title="Agent Observatory"
      side="right"
      className="observatory"
    >
      <AgentPresencePanel presence={state?.presence ?? []} />
      <CompositionPanel
        frames={state?.frames ?? []}
        speculative={state?.speculative_frames ?? []}
        imageDecisions={state?.image_decisions ?? []}
        narrationScripts={state?.narration_scripts ?? []}
        activeFrameId={activeFrameId}
      />
      <ReasoningPanel
        reasoning={state?.agent_reasoning ?? []}
        timings={state?.agent_work_timings ?? []}
      />
      <EnsemblePanel
        proposals={state?.proposals ?? []}
        disagreements={state?.disagreements ?? []}
        syntheses={state?.syntheses ?? []}
      />
      <ProvenancePeek surfaceId={surfaceId} block={focusedBlock} />
    </Overlay>
  );
}
