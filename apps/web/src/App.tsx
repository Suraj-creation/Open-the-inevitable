/**
 * App — composition root for the visible surface. Enters a cognitive environment, streams its
 * live event log, folds it into state, and renders the Cognitive Stage. Intents flow out as governed
 * commands; effects flow back as ordinary frames over the same stream.
 */
import { useState, type FormEvent } from "react";
import { enterSurface, sendCommand } from "./api";
import { SurfaceView } from "./SurfaceView";
import { useSurfaceStream } from "./useSurfaceStream";

export function App() {
  const [surfaceId, setSurfaceId] = useState<string | null>(null);
  const [goal, setGoal] = useState("Teach me Neural Networks");
  const [entering, setEntering] = useState(false);
  const stream = useSurfaceStream(surfaceId);

  const enter = async (): Promise<void> => {
    const trimmed = goal.trim();
    if (!trimmed) return;
    setEntering(true);
    try {
      const id = await enterSurface(trimmed);
      setSurfaceId(id);
      // Enter the environment, then begin thinking — effects arrive live over the stream.
      await sendCommand(id, { type: "ask", goal: trimmed });
    } finally {
      setEntering(false);
    }
  };

  if (!surfaceId) {
    const submit = (event: FormEvent): void => {
      event.preventDefault();
      void enter();
    };
    return (
      <div className="enter">
        <div className="enter-aura" aria-hidden />
        <div className="enter-card">
          <span className="enter-eyebrow">Cognitive Operating System</span>
          <h1 className="enter-title">
            Watch understanding <em>unfold</em>.
          </h1>
          <p className="enter-sub">
            A living surface where cognition becomes visible — agents think, concepts take the
            stage, and a path forms as you learn.
          </p>
          <form className="enter-form" onSubmit={submit}>
            <input
              className="enter-input"
              value={goal}
              onChange={(event) => setGoal(event.target.value)}
              placeholder="What do you want to understand?"
              aria-label="What do you want to understand?"
            />
            <button type="submit" className="enter-go" disabled={entering}>
              {entering ? "Entering…" : "Enter"}
              <span className="enter-go-icon" aria-hidden>
                →
              </span>
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <SurfaceView
      surfaceId={surfaceId}
      state={stream.state}
      status={stream.status}
      onAsk={(g) => void sendCommand(surfaceId, { type: "ask", goal: g })}
      onExpand={(blockId, layer) =>
        void sendCommand(surfaceId, { type: "expand", block_id: blockId, layer })
      }
    />
  );
}
