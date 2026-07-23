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
import { EventInspector } from "./EventInspector";
import { HealthPanel } from "./HealthPanel";
import { ProvenancePeek } from "./ProvenancePeek";
import { ReasoningPanel } from "./ReasoningPanel";
import { RepresentationPanel } from "./RepresentationPanel";

export interface PlaybackDiagnostics {
  readonly mode: string;
  readonly cursor: number;
  readonly total: number;
  readonly speed: number;
}

export interface ObservatoryProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly surfaceId: string;
  readonly state: SurfaceState | null;
  readonly focusedBlock: CognitionBlock | null;
  /** The frame the choreographer is voicing (UCS, ADR-0030) — highlights it in the composition queue. */
  readonly activeFrameId?: string | null;
  /** The raw streamed event log — the canonical record, searchable (F09 §4.1). */
  readonly events?: readonly unknown[];
  /** The client choreographer's playback state — audio/caption sync made inspectable. */
  readonly playback?: PlaybackDiagnostics | null;
}

export function Observatory({
  open,
  onClose,
  surfaceId,
  state,
  focusedBlock,
  activeFrameId = null,
  events = [],
  playback = null,
}: ObservatoryProps) {
  return (
    <Overlay
      open={open}
      onClose={onClose}
      title="Agent Observatory"
      side="right"
      className="observatory"
    >
      {/* Two audiences, two sections (review §18): what the learner cares about — the craft and the
          "why this" — vs operator instrumentation (agent states, reasoning determinism, latency). */}
      <div className="obs-section" aria-label="Understanding">
        <p className="obs-section-label">Understanding — the craft behind this lesson</p>
        <CompositionPanel
          frames={state?.frames ?? []}
          speculative={state?.speculative_frames ?? []}
          imageDecisions={state?.image_decisions ?? []}
          narrationScripts={state?.narration_scripts ?? []}
          activeFrameId={activeFrameId}
        />
        <RepresentationPanel
          representations={state?.representations ?? []}
          activeFrameId={activeFrameId}
        />
        <EnsemblePanel
          proposals={state?.proposals ?? []}
          disagreements={state?.disagreements ?? []}
          syntheses={state?.syntheses ?? []}
        />
        <ProvenancePeek surfaceId={surfaceId} block={focusedBlock} />
      </div>
      <div className="obs-section obs-section--telemetry" aria-label="Instrumentation">
        <p className="obs-section-label">Instrumentation — agents, reasoning &amp; latency</p>
        <AgentPresencePanel presence={state?.presence ?? []} />
        <ReasoningPanel
          reasoning={state?.agent_reasoning ?? []}
          timings={state?.agent_work_timings ?? []}
        />
        <HealthPanel health={state?.cognition_health ?? []} />
        {playback ? (
          <section className="playback-panel" aria-label="Playback">
            <h2 className="rail-title">Playback</h2>
            <p className="playback-line">
              <span className="playback-mode">{playback.mode}</span>
              <span className="playback-pos">
                segment {Math.min(playback.cursor + 1, playback.total)}⁄{playback.total}
              </span>
              <span className="playback-speed">{playback.speed}×</span>
            </p>
          </section>
        ) : null}
        <EventInspector events={events} />
      </div>
    </Overlay>
  );
}
