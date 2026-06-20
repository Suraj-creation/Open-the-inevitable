/**
 * SurfaceView — the Cognitive Stage: a "theater of thought", not a dashboard. One viewport
 * (projection) over SurfaceState. The runtime is the product; this only renders. The Choreographer
 * paces the unfolding; the stage spotlights the focused concept; the living timeline lights up in
 * sync; agents are present at the edge; provenance is one tap away; narration speaks below.
 * Layout/playback are projection concerns and never enter the canonical record (ADR-0006/0007).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { CognitionBlock, SurfaceState } from "@inevitable/surface/client";
import { AgentPresencePanel } from "./components/AgentPresence";
import { CognitiveStage } from "./components/CognitiveStage";
import { LivingTimeline } from "./components/LivingTimeline";
import { NarrationTrack } from "./components/NarrationTrack";
import { ProvenancePeek } from "./components/ProvenancePeek";
import { useChoreographer } from "./useChoreographer";
import type { ConnectionStatus } from "./useSurfaceStream";

export interface SurfaceViewProps {
  readonly surfaceId: string;
  readonly state: SurfaceState | null;
  readonly status: ConnectionStatus;
  readonly onAsk: (goal: string) => void;
  readonly onExpand: (blockId: string, layer: number) => void;
}

export function SurfaceView({ surfaceId, state, status, onAsk }: SurfaceViewProps) {
  const choreo = useChoreographer(state);
  const blocks = useMemo(() => state?.blocks ?? [], [state]);

  // A facet click pins a block to the stage; live advance returns focus to the unfolding cognition.
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const lastCursor = useRef(choreo.cursor);
  useEffect(() => {
    if (choreo.cursor !== lastCursor.current) {
      lastCursor.current = choreo.cursor;
      setPinnedId(null);
    }
  }, [choreo.cursor]);

  const byId = (id: string | null): CognitionBlock | null =>
    (id && blocks.find((b) => b.block_id === id)) || null;

  let focusedBlock = byId(pinnedId);
  if (!focusedBlock && choreo.focus?.target_type === "block") {
    focusedBlock = byId(choreo.focus.target_id);
  }
  if (!focusedBlock) {
    focusedBlock =
      [...blocks].reverse().find((b) => b.block_type === "explanation") ??
      blocks[blocks.length - 1] ??
      null;
  }

  const focusConceptId =
    choreo.focus?.target_type === "concept"
      ? choreo.focus.target_id
      : (focusedBlock?.concept_ids[0] ?? null);

  const context = blocks
    .filter((b) => b.block_id !== focusedBlock?.block_id)
    .slice(-6)
    .reverse();
  const speaking = !!choreo.speakingBlockId && choreo.speakingBlockId === focusedBlock?.block_id;
  const thinking = status !== "idle" && blocks.length === 0;

  return (
    <div className="surface">
      <header className="surface-top">
        <div className="brand">
          <span className="brand-mark" aria-hidden>
            ◇
          </span>
          <span className="brand-name">The Inevitable</span>
        </div>
        <div className="surface-goal">{state?.goal ?? "a cognitive surface"}</div>
        <div className={`conn conn-${status}`}>
          <span className="conn-dot" aria-hidden />
          {status === "live" ? "live" : status}
        </div>
      </header>

      <LivingTimeline timeline={state?.timeline ?? null} focusConceptId={focusConceptId} />

      <main className="stage-wrap">
        <CognitiveStage
          block={focusedBlock}
          speaking={speaking}
          context={context}
          activeId={focusedBlock?.block_id ?? null}
          onSelect={(id) => setPinnedId(id)}
          thinking={thinking}
        />
      </main>

      <div className="rail rail-right">
        <AgentPresencePanel presence={state?.presence ?? []} />
        <ProvenancePeek surfaceId={surfaceId} block={focusedBlock} />
      </div>

      <NarrationTrack choreo={choreo} status={status} onAsk={onAsk} />
    </div>
  );
}
