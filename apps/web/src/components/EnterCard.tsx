/**
 * EnterCard — the source-first front door (R5, ADR-0062). A learner enters WITHOUT a required topic:
 * they may type what they want to understand, bring one or more sources, or both. On enter the card
 * first analyzes the sources (canonicalization narrative), then creates the surface, attaches the
 * sources, and drives teaching TOPIC-ADAPTIVELY:
 *   - source(s), no topic  → teachSource (the document becomes the timeline)
 *   - topic + source(s)     → ask {topic}, source-anchored (R2a) because sources attach first
 *   - topic only            → ask {topic} (unchanged goal-mode)
 * Entry uploads are implicitly consented (the learner chose to learn from them); mid-session uploads
 * go through the Source Dock's consent gate instead. A thin flow over tested api + Dock helpers.
 */
import { useCallback, useRef, useState, type FormEvent } from "react";
import {
  attachSource,
  crawlSource,
  enterSurface,
  registerSource,
  sendCommand,
  teachSource,
  type RegisteredSourceView,
} from "../api";
import { SiteNav } from "../site/SiteNav";
import { describeLayers, inferModality } from "./SourceDock";

/** One source staged client-side before entry. `register` runs at submit (files/text) or crawls (URL). */
interface StagedSource {
  readonly key: string;
  readonly label: string;
  readonly note: string;
  readonly refused: boolean;
  readonly register: () => Promise<RegisteredSourceView>;
}

type Phase =
  | { readonly kind: "idle" }
  | { readonly kind: "analyzing"; readonly done: readonly RegisteredSourceView[] }
  | { readonly kind: "entering" }
  | { readonly kind: "error"; readonly message: string };

const PASTE_MODALITIES: readonly { readonly value: string; readonly label: string }[] = [
  { value: "markdown", label: "Markdown" },
  { value: "text", label: "Plain text" },
  { value: "code", label: "Code" },
  { value: "video", label: "Video transcript (VTT/SRT)" },
];

let stagedSeq = 0;

export function EnterCard({ onEntered }: { readonly onEntered: (surfaceId: string) => void }) {
  const [topic, setTopic] = useState("");
  const [mode, setMode] = useState<"student" | "educator">("student");
  const [staged, setStaged] = useState<readonly StagedSource[]>([]);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [url, setUrl] = useState("");
  const [paste, setPaste] = useState("");
  const [pasteModality, setPasteModality] = useState("markdown");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const busy = phase.kind === "analyzing" || phase.kind === "entering";
  const usable = staged.filter((s) => !s.refused);
  const canEnter = !busy && (topic.trim().length > 0 || usable.length > 0);

  const addStaged = useCallback((s: StagedSource) => {
    setStaged((prev) => [...prev, s]);
  }, []);

  const addFile = useCallback(
    (file: File) => {
      const inf = inferModality(file.name);
      const key = `st-${stagedSeq++}`;
      if (!inf.modality) {
        addStaged({
          key,
          label: file.name,
          note: inf.note,
          refused: true,
          register: () => Promise.reject(new Error("refused")),
        });
        return;
      }
      const modality = inf.modality;
      addStaged({
        key,
        label: file.name,
        note: inf.note,
        refused: false,
        register: async () => {
          const content = inf.binary ? await file.arrayBuffer() : await file.text();
          return registerSource({ content, modality, title: file.name });
        },
      });
    },
    [addStaged],
  );

  const addUrl = useCallback(() => {
    const trimmed = url.trim();
    if (!trimmed) return;
    addStaged({
      key: `st-${stagedSeq++}`,
      label: trimmed,
      note: "Web page",
      refused: false,
      register: () => crawlSource(trimmed),
    });
    setUrl("");
  }, [url, addStaged]);

  const addPaste = useCallback(() => {
    const trimmed = paste.trim();
    if (!trimmed) return;
    const content = paste;
    const modality = pasteModality;
    addStaged({
      key: `st-${stagedSeq++}`,
      label: `Pasted ${modality}`,
      note: PASTE_MODALITIES.find((m) => m.value === modality)?.label ?? modality,
      refused: false,
      register: () => registerSource({ content, modality, title: `Pasted ${modality}` }),
    });
    setPaste("");
  }, [paste, pasteModality, addStaged]);

  const removeStaged = useCallback((key: string) => {
    setStaged((prev) => prev.filter((s) => s.key !== key));
  }, []);

  const enter = useCallback(async () => {
    const topicText = topic.trim();
    const sources = staged.filter((s) => !s.refused);
    if (!topicText && sources.length === 0) return;

    try {
      // 1. Analyze the sources first — canonicalize each, surfacing the honest narrative as we go.
      const registered: RegisteredSourceView[] = [];
      if (sources.length > 0) {
        setPhase({ kind: "analyzing", done: [] });
        for (const s of sources) {
          const view = await s.register();
          registered.push(view);
          setPhase({ kind: "analyzing", done: [...registered] });
        }
      }

      // 2. Create the surface. With no topic, derive a cosmetic goal from the primary source
      //    (teachSource sets the real timeline); with a topic, the topic is the goal.
      setPhase({ kind: "entering" });
      const derivedGoal =
        topicText || (registered[0] ? `Learn from “${registered[0].title}”` : "Learn");
      const surfaceId = await enterSurface(derivedGoal, mode);

      // 3. Attach every analyzed source (entry uploads are implicitly consented).
      for (const view of registered) {
        await attachSource(surfaceId, view.source_version_id).catch(() => {});
      }

      // 4. Drive teaching topic-adaptively.
      if (topicText) {
        await sendCommand(surfaceId, { type: "ask", goal: topicText });
      } else {
        // Source(s) only → teach the document itself (the document is the timeline, R2c).
        await teachSource(surfaceId).catch(() => {});
      }

      onEntered(surfaceId);
    } catch (cause) {
      setPhase({
        kind: "error",
        message: cause instanceof Error ? cause.message : "Could not reach the cognitive surface.",
      });
    }
  }, [topic, staged, mode, onEntered]);

  const submit = (event: FormEvent): void => {
    event.preventDefault();
    if (canEnter) void enter();
  };

  return (
    <div className="enter">
      <SiteNav onJourney />
      <div className="enter-aura" aria-hidden />
      <div className="enter-card">
        <span className="enter-eyebrow">Cognitive Operating System</span>
        <h1 className="enter-title">
          Watch understanding <em>unfold</em>.
        </h1>
        <p className="enter-sub">
          Start from a question, or bring a book, paper, or notes and learn straight from the source
          — the surface teaches from what you give it.
        </p>

        {phase.kind === "analyzing" || phase.kind === "entering" ? (
          <div className="enter-analyzing" role="status" aria-live="polite">
            <p className="enter-analyzing-title">
              {phase.kind === "entering"
                ? "Building your environment…"
                : "Understanding your sources…"}
            </p>
            <ul className="enter-analyzing-list">
              {staged
                .filter((s) => !s.refused)
                .map((s, i) => {
                  const done = phase.kind === "analyzing" ? phase.done[i] : undefined;
                  return (
                    <li key={s.key} className="enter-analyzing-item">
                      <span className="enter-analyzing-name">{s.label}</span>
                      <span className="enter-analyzing-state">
                        {done ? describeLayers(done).verdict : "analyzing…"}
                      </span>
                    </li>
                  );
                })}
            </ul>
          </div>
        ) : (
          <form className="enter-form" onSubmit={submit}>
            {phase.kind === "error" ? (
              <p className="enter-error" role="alert">
                {phase.message}
              </p>
            ) : null}
            <input
              className="enter-input"
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
              placeholder="What do you want to understand? (optional if you bring a source)"
              aria-label="What do you want to understand?"
            />

            {/* Source-first: bring one or more sources to learn from. */}
            <div className="enter-sources">
              <div className="enter-source-actions">
                <button
                  type="button"
                  className="enter-source-btn"
                  onClick={() => fileInputRef.current?.click()}
                >
                  ＋ File
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="source-dock-file-input"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) addFile(file);
                    e.currentTarget.value = "";
                  }}
                />
                <input
                  type="url"
                  className="enter-source-url"
                  placeholder="paste a web page URL"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addUrl();
                    }
                  }}
                />
                {url.trim() ? (
                  <button type="button" className="enter-source-btn" onClick={addUrl}>
                    Add URL
                  </button>
                ) : null}
              </div>

              <details className="enter-source-paste">
                <summary>…or paste text</summary>
                <textarea
                  className="source-dock-textarea"
                  placeholder="Paste markdown, text, code, or a transcript"
                  value={paste}
                  onChange={(e) => setPaste(e.target.value)}
                  rows={4}
                />
                <div className="source-dock-row">
                  <select
                    className="source-dock-input"
                    value={pasteModality}
                    onChange={(e) => setPasteModality(e.target.value)}
                    aria-label="What kind of text is this?"
                  >
                    {PASTE_MODALITIES.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                  <button type="button" className="enter-source-btn" onClick={addPaste}>
                    Add text
                  </button>
                </div>
              </details>

              {staged.length > 0 ? (
                <ul className="enter-staged">
                  {staged.map((s) => (
                    <li
                      key={s.key}
                      className={`enter-staged-item${s.refused ? " is-refused" : ""}`}
                    >
                      <span className="enter-staged-name">{s.label}</span>
                      <span className="enter-staged-note">{s.note}</span>
                      <button
                        type="button"
                        className="enter-staged-remove"
                        onClick={() => removeStaged(s.key)}
                        aria-label={`Remove ${s.label}`}
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            <div className="enter-mode-row" role="group" aria-label="Surface mode">
              {(["student", "educator"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  className={`enter-mode-chip${mode === m ? " enter-mode-chip--active" : ""}`}
                  onClick={() => setMode(m)}
                  aria-pressed={mode === m}
                >
                  {m === "student" ? "Student" : "Educator"}
                </button>
              ))}
            </div>

            <button type="submit" className="enter-go" disabled={!canEnter}>
              {usable.length > 0 && !topic.trim() ? "Learn from the source" : "Enter"}
              <span className="enter-go-icon" aria-hidden>
                →
              </span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
