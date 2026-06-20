/**
 * NarrationTrack — where the surface speaks and the learner interacts at any time. Shows the
 * current narration segment (the live, generated explanation), a transport to play/pause/scrub the
 * unfolding, a per-segment scrubber, and the ask field. Reads the Choreographer's view; owns no truth.
 */
import { useState, type FormEvent } from "react";
import type { ChoreographyView } from "../useChoreographer";
import type { ConnectionStatus } from "../useSurfaceStream";

export interface NarrationTrackProps {
  readonly choreo: ChoreographyView;
  readonly status: ConnectionStatus;
  readonly onAsk: (goal: string) => void;
}

const SPEEDS = [0.75, 1, 1.25, 1.5];

export function NarrationTrack({ choreo, status, onAsk }: NarrationTrackProps) {
  const [draft, setDraft] = useState("");
  const { segments, cursor, current, isPlaying } = choreo;

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
    <footer className="track">
      <div className="track-narration">
        <span className={`waveform ${isPlaying ? "is-live" : ""}`} aria-hidden>
          <i /> <i /> <i /> <i /> <i />
        </span>
        <p className="narration-text" aria-live="polite">
          {current ? current.text : "The surface is ready. Ask anything to begin."}
        </p>
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
