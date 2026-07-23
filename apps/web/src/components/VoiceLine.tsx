/**
 * VoiceLine — the voice of the surface as ambient chrome (CDL: chrome dissolves; the board is
 * sacred). Replaces the floating media-player HUD. Three attentional states:
 *
 *   ambient   — a hairline of light at the bottom edge: the spoken sentence (word-synced), one
 *               play/pause glyph, and the Thread of Understanding (progress as light). ≤ 2.5rem.
 *   available — on pointer approach, keyboard focus, or while paused mid-journey, the instruments
 *               rise on a glass plane: transport, steering verbs, and the ask field.
 *
 * The Thread doubles as navigation: each narration segment is a filament of the line; frame nodes
 * mark concepts and jump on click. Reads the Choreographer's view; owns no truth (ADR-0007).
 */
import { useMemo, useState, useSyncExternalStore, type FormEvent } from "react";
import type { SurfaceInteractionKind } from "../api";
import type { ProgressStore } from "../narration-player";
import type { ChoreographyView } from "../useChoreographer";
import type { ConnectionStatus } from "../useSurfaceStream";

export interface VoiceLineProps {
  readonly choreo: ChoreographyView;
  readonly status: ConnectionStatus;
  readonly onAsk: (goal: string) => void;
  readonly onInteract?: (kind: SurfaceInteractionKind, targetId?: string) => void;
  /** Frame id → title, for named frame-level navigation (never anonymous "Segment N"). */
  readonly frames?: ReadonlyArray<{ readonly frame_id: string; readonly title: string }>;
  /** The in-flight ask's phase, phrased for the learner (surface.ask.progress) — never silent. */
  readonly progressLine?: string | null;
  /** An ask is in flight: one at a time — the send affordance waits (interrupt stays live). */
  readonly busy?: boolean;
}

const INTERACTIONS: ReadonlyArray<{ kind: SurfaceInteractionKind; label: string }> = [
  { kind: "interrupt", label: "Interrupt" },
  { kind: "request_depth", label: "Go deeper" },
  { kind: "request_simplify", label: "Simpler" },
  { kind: "request_example", label: "Example" },
  { kind: "challenge", label: "Challenge" },
];

const SPEEDS = [0.75, 1, 1.25, 1.5];

/** The live narration sentence, with words highlighted up to playback progress (teleprompter-style).
 *  Subscribes to the progress store HERE — the snapshot is the spoken-word index, so the 60 Hz
 *  progress clock re-renders this one line only, and only when a word boundary crosses. */
function NarrationLine({
  text,
  store,
  playing,
}: {
  text: string;
  store: ProgressStore;
  playing: boolean;
}) {
  const tokens = useMemo(() => text.split(/(\s+)/), [text]);
  const wordCount = tokens.filter((t) => t.trim().length > 0).length;
  const spoken = useSyncExternalStore(
    store.subscribe,
    () => (playing ? Math.floor(Math.max(0, Math.min(1, store.get())) * wordCount) : wordCount),
    () => wordCount,
  );
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

export function VoiceLine({
  choreo,
  status,
  onAsk,
  onInteract,
  frames = [],
  progressLine = null,
  busy = false,
}: VoiceLineProps) {
  const [draft, setDraft] = useState("");
  // Per-control pending state (review §9): the pressed reshaping verb acknowledges immediately,
  // before the reshaped cognition streams back.
  const [pending, setPending] = useState<SurfaceInteractionKind | null>(null);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const { segments, cursor, current, isPlaying, progressStore } = choreo;

  // Attentional logic: approach (pointer/keyboard) summons the instruments; a learner paused
  // mid-journey is deciding what to do next, so the instruments stay present for them too.
  const pausedMidJourney = !isPlaying && segments.length > 0 && !choreo.atEnd;
  const available = hovered || focused || pausedMidJourney;

  // Segments grouped by frame — the Thread's concept nodes (navigate by idea, not "Segment N").
  const frameGroups = useMemo(() => {
    const titleById = new Map(frames.map((f) => [f.frame_id, f.title] as const));
    const groups: { frameId: string | null; title: string; start: number; count: number }[] = [];
    segments.forEach((s, i) => {
      const fid = s.frame_id ?? null;
      const last = groups[groups.length - 1];
      if (last && last.frameId === fid) last.count += 1;
      else
        groups.push({
          frameId: fid,
          title: (fid && titleById.get(fid)) || "Frame",
          start: i,
          count: 1,
        });
    });
    return groups;
  }, [segments, frames]);

  const activeFrameId = current?.frame_id ?? null;
  const activeGroupIndex = frameGroups.findIndex((g) => g.frameId === activeFrameId);
  const activeGroup = activeGroupIndex >= 0 ? frameGroups[activeGroupIndex] : null;

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
    <footer
      className="voiceline"
      data-state={available ? "available" : "ambient"}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
      }}
    >
      {/* Instruments — rise on approach (CDL motion: `yield` in reverse), collapse to nothing. */}
      <div className="vl-instruments" aria-hidden={!available}>
        <div className="transport" role="group" aria-label="Narration transport">
          <button
            type="button"
            className="t-btn"
            onClick={choreo.prev}
            disabled={cursor <= 0}
            aria-label="Previous segment"
            tabIndex={available ? 0 : -1}
          >
            ◀
          </button>
          <button
            type="button"
            className="t-btn"
            onClick={choreo.next}
            disabled={choreo.atEnd}
            aria-label="Next segment"
            tabIndex={available ? 0 : -1}
          >
            ▶
          </button>
          <button
            type="button"
            className="t-speed"
            onClick={cycleSpeed}
            aria-label="Playback speed"
            tabIndex={available ? 0 : -1}
          >
            {choreo.speed}×
          </button>
        </div>

        {onInteract && (
          <div className="interject" role="group" aria-label="Interact with the cognition">
            {INTERACTIONS.map((it) => (
              <button
                key={it.kind}
                type="button"
                className={`ij-btn ij-${it.kind}${pending === it.kind ? " is-pending" : ""}`}
                onClick={() => {
                  onInteract(it.kind);
                  if (it.kind !== "interrupt") {
                    setPending(it.kind);
                    setTimeout(() => setPending((p) => (p === it.kind ? null : p)), 2500);
                  }
                }}
                disabled={status === "connecting"}
                tabIndex={available ? 0 : -1}
              >
                {pending === it.kind ? "…" : it.label}
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
            tabIndex={available ? 0 : -1}
          />
          <button
            type="submit"
            className="ask-send"
            disabled={status === "connecting" || busy}
            title={busy ? "One ask at a time — the surface is still composing" : undefined}
            tabIndex={available ? 0 : -1}
          >
            {busy ? "…" : "Ask"}
          </button>
        </form>
      </div>

      {/* The voice — always present, never clamped away. */}
      <div className="vl-voice">
        <button
          type="button"
          className={`vl-play${isPlaying ? " is-playing" : ""}`}
          onClick={choreo.toggle}
          disabled={segments.length === 0}
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? "❚❚" : "▶"}
        </button>
        {current ? (
          <NarrationLine text={current.text} store={progressStore} playing={isPlaying} />
        ) : (
          <p className="narration-text" aria-live="polite">
            {progressLine ?? "The surface is ready. Ask anything to begin."}
          </p>
        )}
        {/* While cognition forms behind a playing narration, the phase whispers beside it. */}
        {current && progressLine ? (
          <span className="vl-progress" role="status">
            {progressLine}
          </span>
        ) : null}
        {activeGroup && frameGroups.length > 1 ? (
          <span className="vl-place" title={activeGroup.title}>
            {activeGroup.title
              .replace(/^(Practice|Checkpoint|Ready to practice|Assessment) —\s*/i, "")
              .slice(0, 28)}
            <em>
              {" "}
              · {activeGroupIndex + 1}⁄{frameGroups.length}
            </em>
          </span>
        ) : null}
      </div>

      {/* The Thread of Understanding — progress as light along the bottom edge. Each filament is
          a narration segment; nodes are concepts (frames). Filled light = journey completed. */}
      <div className="thread" role="group" aria-label="Journey through the narration">
        {segments.length === 0 ? (
          <span className="thread-empty" aria-hidden />
        ) : (
          frameGroups.map((g, gi) => (
            <span
              key={g.frameId ?? `g${gi}`}
              className={`thread-frame${g.frameId === activeFrameId ? " is-current" : ""}`}
              style={{ flexGrow: g.count }}
            >
              <button
                type="button"
                className="thread-node"
                onClick={() => choreo.scrubTo(g.start)}
                aria-label={`Go to frame: ${g.title}`}
                aria-current={g.frameId === activeFrameId ? "true" : undefined}
                title={g.title}
              />
              {segments.slice(g.start, g.start + g.count).map((s, si) => {
                const i = g.start + si;
                return (
                  <button
                    key={s.segment_id}
                    type="button"
                    className={`thread-seg${i < cursor ? " is-done" : ""}${i === cursor ? " is-current" : ""}`}
                    onClick={() => choreo.scrubTo(i)}
                    aria-label={`Segment ${i + 1}`}
                  />
                );
              })}
            </span>
          ))
        )}
      </div>
    </footer>
  );
}
