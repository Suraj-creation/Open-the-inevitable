/**
 * FrameDeck — the progressive frame projection (UCS, ADR-0030; Phase 2).
 *
 * Renders the active Cognitive Frame and choreographs the transition to the next: as the narration
 * cursor crosses a frame boundary (`activeFrameId` changes), the prior frame cross-dissolves out while
 * the incoming frame rises in. The N+1 frame is buffered off-stage so its image pre-warms and the swap
 * is instant. Which frame is active is a pure client projection over the choreographer cursor — this
 * component reads folded state and the cursor, and owns no canonical truth (ADR-0007).
 *
 * Honors prefers-reduced-motion via the global rule (animations collapse to an instant swap).
 */
import { useEffect, useRef, useState } from "react";
import type { CognitiveFrame, SurfaceState } from "@inevitable/surface/client";
import { activeFrame, nextFrame } from "../frames";
import { FrameStage } from "./FrameStage";

/** Duration (ms) the outgoing frame lingers while cross-dissolving — must match the CSS exit anim. */
const TRANSITION_MS = 640;

export function FrameDeck({
  state,
  activeFrameId,
  highlightElementId,
  thinking,
}: {
  readonly state: SurfaceState | null;
  readonly activeFrameId: string | null;
  readonly highlightElementId: string | null;
  readonly thinking: boolean;
}) {
  const active = activeFrame(state, activeFrameId);
  const upcoming = nextFrame(state, activeFrameId);

  // Track the frame leaving the stage so it can cross-dissolve out (one transition at a time).
  const [outgoing, setOutgoing] = useState<CognitiveFrame | null>(null);
  const lastActive = useRef<CognitiveFrame | null>(null);
  useEffect(() => {
    const prev = lastActive.current;
    lastActive.current = active;
    if (prev && active && prev.frame_id !== active.frame_id) {
      setOutgoing(prev);
      const t = setTimeout(() => setOutgoing(null), TRANSITION_MS);
      return () => clearTimeout(t);
    }
    return;
  }, [active]);

  if (!active) {
    return (
      <div className="frame-deck">
        <FrameStage frame={null} highlightElementId={null} thinking={thinking} />
      </div>
    );
  }

  return (
    <div className="frame-deck">
      {outgoing && outgoing.frame_id !== active.frame_id ? (
        <FrameStage
          key={outgoing.frame_id}
          frame={outgoing}
          highlightElementId={null}
          thinking={false}
          phase="exit"
        />
      ) : null}
      <FrameStage
        key={active.frame_id}
        frame={active}
        highlightElementId={highlightElementId}
        thinking={thinking}
        phase="enter"
      />
      {/* N+1 buffer: pre-warm the next frame's image so its transition is instant. */}
      <FramePrewarm frame={upcoming} />
    </div>
  );
}

/** Off-stage pre-warm of the next frame's heavy assets (its illustration). Renders nothing visible. */
function FramePrewarm({ frame }: { readonly frame: CognitiveFrame | null }) {
  const content = frame?.mccr?.image?.content;
  const ref = content && content.kind === "image" ? (content.artifact?.content_ref ?? null) : null;
  if (!ref) return null;
  return (
    <div className="frame-prewarm" aria-hidden>
      <img src={ref} alt="" decoding="async" loading="eager" />
    </div>
  );
}
