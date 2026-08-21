import type { SceneVisual } from "./cinematic";

const MARK_COUNT: Readonly<Record<SceneVisual, number>> = {
  field: 10,
  ascent: 6,
  constitution: 6,
  surface: 5,
  sources: 6,
  topology: 6,
  frontier: 7,
  timeline: 3,
  settle: 4,
};

export function InstrumentVisual({ visual }: { readonly visual: SceneVisual }) {
  return (
    <div className="instrument-visual" data-visual={visual} aria-hidden="true">
      <div className="instrument-visual-field">
        {Array.from({ length: MARK_COUNT[visual] }, (_, index) => (
          <span className="instrument-mark" key={index} />
        ))}
      </div>
    </div>
  );
}
