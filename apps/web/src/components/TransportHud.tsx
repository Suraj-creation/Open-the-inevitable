/**
 * TransportHud — narration speaks here, and the learner interacts at any time, from a floating HUD
 * (F09 §4.1). The current narration sentence streams with word-level highlighting synced to playback
 * (a client projection over the Choreographer's progress, ADR-0007); the transport, scrubber,
 * interaction controls, and ask field auto-hide on idle and return on intent. Reads the Choreographer's
 * view; owns no truth.
 */
import { useMemo, useState, type FormEvent } from "react";
import type { SurfaceInteractionKind } from "../api";
import type { ChoreographyView } from "../useChoreographer";
import type { ConnectionStatus } from "../useSurfaceStream";
import { useAutoHide } from "../useAutoHide";

export interface TransportHudProps {
  readonly choreo: ChoreographyView;
  readonly status: ConnectionStatus;
  readonly onAsk: (goal: string) => void;
  readonly onInteract?: (kind: SurfaceInteractionKind, targetId?: string) => void;
}

const INTERACTIONS: ReadonlyArray<{ kind: SurfaceInteractionKind; label: string }> = [
  { kind: "interrupt", label: "Interrupt" },
  { kind: "request_depth", label: "Go deeper" },
  { kind: "request_simplify", label: "Simpler" },
  { kind: "request_example", label: "Example" },
  { kind: "challenge", label: "Challenge" },
];

const SPEEDS = [0.75, 1, 1.25, 1.5];

/** The live narration sentence, with words highlighted up to playback progress (teleprompter-style). */
function NarrationLine({ text, progress }: { text: string; progress: number }) {
  const tokens = useMemo(() => text.split(/(\s+)/), [text]);
  const wordCount = tokens.filter((t) => t.trim().length > 0).length;
  const spoken = Math.floor(Math.max(0, Math.min(1, progress)) * wordCount);
  let wordIndex = -1;
  return (
    <p className="narration-text" aria-live="polite">
      {tokens.map((tok, i) => {
        if (tok.trim().length === 0) return <span key={i}>{tok}</span>;
        wordIndex += 1;
        const cls = wordIndex < spoken ? "w-spoken" : wordIndex === spoken ? "w-active" : "w-ahead";
        return (
          <span key={i} className={`nw ${cls}`}>
            {tok}
          </span>
        );
      })}
    </p>
  );
}

export function TransportHud({ choreo, status, onAsk, onInteract }: TransportHudProps) {
  const [draft, setDraft] = useState("");
  const active = useAutoHide();
  const { segments, cursor, current, isPlaying, progress } = choreo;

  const submit = (event: FormEvent): void => {
    event.preventDefault();
    const goal = draft.trim();
    if (goal) onAsk(goal);
    setDraft("");
  };

  const cycleSpeed = (): void => {
    const i = SPEEDS.indexOf(choreo.speed);
    choreo.setSpeed(SPEEDS[(i + 1) % SPEEDS.length] ?? 1);
  };

  return (
    <footer className={`track ${active ? "is-active" : "is-idle"}`} data-active={active}>
      <div className="track-narration">
        <span className={`waveform ${isPlaying ? "is-live" : ""}`} aria-hidden>
          <i /> <i /> <i /> <i /> <i />
        </span>
        {current ? (
          <NarrationLine text={current.text} progress={isPlaying ? progress : 1} />
        ) : (
          <p className="narration-text" aria-live="polite">
            The surface is ready. Ask anything to begin.
          </p>
        )}
      </div>

      <div className="track-controls">
        <div className="transport" role="group" aria-label="Narration transport">
          <button
            type="button"
            className="t-btn"
            onClick={choreo.prev}
            disabled={cursor <= 0}
            aria-label="Previous segment"
          >
            ◀
          </button>
          <button
            type="button"
            className="t-btn t-play"
            onClick={choreo.toggle}
            disabled={segments.length === 0}
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? "❚❚" : "▶"}
          </button>
          <button
            type="button"
            className="t-btn"
            onClick={choreo.next}
            disabled={choreo.atEnd}
            aria-label="Next segment"
          >
            ▶
          </button>
          <button
            type="button"
            className="t-speed"
            onClick={cycleSpeed}
            aria-label="Playback speed"
          >
            {choreo.speed}×
          </button>
        </div>

        <div className="scrubber" role="group" aria-label="Narration progress">
          {segments.length === 0 ? (
            <span className="scrubber-empty" />
          ) : (
            segments.map((s, i) => (
              <button
                key={s.segment_id}
                type="button"
                className={`tick ${i === cursor ? "is-current" : ""} ${i < cursor ? "is-done" : ""}`}
                onClick={() => choreo.scrubTo(i)}
                aria-label={`Segment ${i + 1}`}
              />
            ))
          )}
        </div>

        {onInteract && (
          <div className="interject" role="group" aria-label="Interact with the cognition">
            {INTERACTIONS.map((it) => (
              <button
                key={it.kind}
                type="button"
                className={`ij-btn ij-${it.kind}`}
                onClick={() => onInteract(it.kind)}
                disabled={status === "connecting"}
              >
                {it.label}
              </button>
            ))}
          </div>
        )}

        <form className="ask" onSubmit={submit}>
          <input
            className="ask-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Ask the surface anything…"
            aria-label="Ask the surface"
          />
          <button type="submit" className="ask-send" disabled={status === "connecting"}>
            Ask
          </button>
        </form>
      </div>
    </footer>
  );
}
