/**
 * SurfaceView — the Universal Cognitive Surface: one living environment, not a dashboard. The
 * Cognitive Stage (the whiteboard) is fullscreen; everything else floats over it as overlays, HUDs, and
 * launchers (F09 §4.1, the S-UCS composition law). A slim top bar carries identity, goal, the Agents
 * control, and connection; the Path launcher and Agent Observatory open on demand; narration speaks from
 * a floating transport. One viewport (projection) over SurfaceState — the runtime is the product; this
 * only renders. Layout/playback are projection concerns and never enter the canonical record (ADR-0006/7).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { CognitionBlock, SurfaceState } from "@inevitable/surface/client";
import type { SurfaceInteractionKind } from "./api";
import { hasFrames } from "./frames";
import { AgentsButton } from "./components/AgentsButton";
import { CognitiveStage } from "./components/CognitiveStage";
import { EducatorOverlay } from "./components/EducatorOverlay";
import { FrameDeck } from "./components/FrameDeck";
import { Observatory } from "./components/Observatory";
import { PathLauncher, type SurfaceProjection } from "./components/PathLauncher";
import { TransportHud } from "./components/TransportHud";
import { useChoreographer } from "./useChoreographer";
import type { ConnectionStatus } from "./useSurfaceStream";

export interface SurfaceViewProps {
  readonly surfaceId: string;
  readonly state: SurfaceState | null;
  readonly status: ConnectionStatus;
  readonly onAsk: (goal: string) => void;
  readonly onExpand: (blockId: string, layer: number) => void;
  readonly onInteract?: (kind: SurfaceInteractionKind, targetId?: string) => void;
}

export function SurfaceView({ surfaceId, state, status, onAsk, onInteract }: SurfaceViewProps) {
  const choreo = useChoreographer(state);
  const blocks = useMemo(() => state?.blocks ?? [], [state]);
  const [projection, setProjection] = useState<SurfaceProjection>("timeline");
  const [pathOpen, setPathOpen] = useState(false);
  const [obsOpen, setObsOpen] = useState(false);

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

  // Inline multimodal (S-UCS): media that shares the focused concept renders BESIDE it, not as a
  // detached facet (F09 §4.1). It is therefore excluded from the context ribbon below.
  const MEDIA_TYPES = new Set(["image", "video", "simulation"]);
  const relatedMedia = focusedBlock
    ? blocks.filter(
        (b) =>
          b.block_id !== focusedBlock.block_id &&
          MEDIA_TYPES.has(b.block_type) &&
          b.concept_ids.some((c) => focusedBlock.concept_ids.includes(c)),
      )
    : [];
  const relatedMediaIds = new Set(relatedMedia.map((b) => b.block_id));
  const context = blocks
    .filter((b) => b.block_id !== focusedBlock?.block_id && !relatedMediaIds.has(b.block_id))
    .slice(-6)
    .reverse();
  const speaking = !!choreo.speakingBlockId && choreo.speakingBlockId === focusedBlock?.block_id;
  const thinking = status !== "idle" && blocks.length === 0;
  // An in-flight streamed explanation (S-UCS, ADR-0028): the latest transient buffer, shown forming
  // on the stage until its whole block lands (which clears the buffer). Pure projection.
  const streamingBuffers = state?.streaming_blocks ?? [];
  const streaming =
    streamingBuffers.length > 0 ? streamingBuffers[streamingBuffers.length - 1] : null;

  // UCS (ADR-0030): when the surface composes Cognitive Frames, the board renders the progressive
  // frame sequence (the FrameDeck: active frame + cross-dissolve transitions + N+1 buffering).
  // Otherwise the legacy block stage renders (graceful fallback, F16 §12).
  const framePath = hasFrames(state);

  return (
    <div className="surface">
      {/* The whiteboard fills the viewport. */}
      <main className="stage-wrap">
        {framePath ? (
          <FrameDeck
            state={state}
            activeFrameId={choreo.activeFrameId}
            highlightElementId={choreo.highlightElementId}
            thinking={thinking}
          />
        ) : (
          <CognitiveStage
            block={focusedBlock}
            speaking={speaking}
            context={context}
            activeId={focusedBlock?.block_id ?? null}
            onSelect={(id) => setPinnedId(id)}
            thinking={thinking}
            streaming={streaming ? { text: streaming.text } : null}
            relatedMedia={relatedMedia}
          />
        )}
      </main>

      {/* Slim top bar — identity, goal, Agents control, connection. */}
      <header className="surface-top">
        <div className="brand">
          <span className="brand-mark" aria-hidden>
            ◇
          </span>
          <span className="brand-name">The Inevitable</span>
        </div>
        <div className="surface-goal">{state?.goal ?? "a cognitive surface"}</div>
        <AgentsButton
          presence={state?.presence ?? []}
          active={obsOpen}
          onToggle={() => setObsOpen((o) => !o)}
        />
        <div className={`conn conn-${status}`}>
          <span className="conn-dot" aria-hidden />
          {status === "live" ? "live" : status}
        </div>
      </header>

      {/* Floating launcher → Path/concept-graph overlay (whiteboard stays clear until summoned). */}
      <PathLauncher
        open={pathOpen}
        onToggle={() => setPathOpen((o) => !o)}
        onClose={() => setPathOpen(false)}
        timeline={state?.timeline ?? null}
        blocks={blocks}
        projection={projection}
        onProjection={setProjection}
        focusConceptId={focusConceptId}
        focus={choreo.focus ?? state?.focus ?? null}
        focusedBlockId={focusedBlock?.block_id ?? null}
        onJump={(conceptId) => onInteract?.("jump", conceptId)}
        onBranch={(conceptId) => onInteract?.("branch", conceptId)}
        onSelectBlock={(id) => setPinnedId(id)}
      />

      {/* Agent Observatory — on-demand inspector overlay (replaces the permanent right rail). */}
      <Observatory
        open={obsOpen}
        onClose={() => setObsOpen(false)}
        surfaceId={surfaceId}
        state={state}
        focusedBlock={focusedBlock}
        activeFrameId={choreo.activeFrameId}
      />

      {state?.mode === "educator" && <EducatorOverlay state={state} />}

      {/* Narration speaks from a floating, auto-hiding transport HUD with word-synced highlighting. */}
      <TransportHud choreo={choreo} status={status} onAsk={onAsk} onInteract={onInteract} />
    </div>
  );
}
