/**
 * PathLauncher — PATH/timeline navigation without consuming the board (F09 §4.1). A compact floating
 * "⌗ Path" control opens the concept graph (and the scene projection) as a dismissible center overlay,
 * preserving full navigation while the whiteboard stays fullscreen. The projection toggle (timeline ↔
 * scene) lives here, in the navigation surface it controls. A pure projection of state.timeline/blocks.
 */
import type { CognitionBlock, SurfaceFocus, TimelineProjection } from "@inevitable/surface/client";
import { Overlay } from "./Overlay";
import { TimelineGraph } from "./TimelineGraph";
import { SceneCanvas } from "./SceneCanvas";

export type SurfaceProjection = "timeline" | "scene";

export interface PathLauncherProps {
  readonly open: boolean;
  readonly onToggle: () => void;
  readonly onClose: () => void;
  readonly timeline: TimelineProjection | null;
  readonly blocks: readonly CognitionBlock[];
  readonly projection: SurfaceProjection;
  readonly onProjection: (p: SurfaceProjection) => void;
  readonly focusConceptId: string | null;
  readonly focus: SurfaceFocus | null;
  readonly focusedBlockId: string | null;
  readonly onJump: (conceptId: string) => void;
  readonly onBranch: (conceptId: string) => void;
  readonly onSelectBlock: (blockId: string) => void;
}

export function PathLauncher({
  open,
  onToggle,
  onClose,
  timeline,
  blocks,
  projection,
  onProjection,
  focusConceptId,
  focus,
  focusedBlockId,
  onJump,
  onBranch,
  onSelectBlock,
}: PathLauncherProps) {
  return (
    <>
      <button
        type="button"
        className={`path-launcher ${open ? "is-open" : ""}`}
        onClick={onToggle}
        aria-expanded={open}
        aria-label="Open the learning path"
      >
        <span className="path-launcher-glyph" aria-hidden>
          ⌗
        </span>
        Path
      </button>

      <Overlay open={open} onClose={onClose} title="Path" side="center" className="path-overlay">
        <div className="proj-bar" role="group" aria-label="Surface projection">
          {(["timeline", "scene"] as const).map((p) => (
            <button
              key={p}
              type="button"
              className={`proj-chip${projection === p ? " proj-chip--active" : ""}`}
              onClick={() => onProjection(p)}
              aria-pressed={projection === p}
            >
              {p === "timeline" ? "Timeline" : "Scene"}
            </button>
          ))}
        </div>

        {projection === "timeline" ? (
          <TimelineGraph
            timeline={timeline}
            focusConceptId={focusConceptId}
            onJump={(conceptId) => {
              onJump(conceptId);
              onClose();
            }}
            onBranch={onBranch}
          />
        ) : (
          <SceneCanvas
            blocks={blocks}
            focus={focus}
            focusedBlockId={focusedBlockId}
            onSelect={(id) => {
              onSelectBlock(id);
              onClose();
            }}
          />
        )}
      </Overlay>
    </>
  );
}
