/**
 * SourceDock — the front door (CSE-017, ADR-0056): a learner brings a source in-product. Drag or
 * pick a file, paste a URL for a governed crawl, or paste text — the dock infers the modality,
 * refuses what the system can't yet understand (honestly, before upload), registers it, narrates
 * the canonicalization from the pipeline's OWN output, then asks the learner to CONSENT before use
 * (R5, ADR-0062): "Use this document" weaves it in, "Teach this source" rebuilds the lesson from it —
 * a mid-session upload never silently hijacks teaching. Thin container over pure, tested helpers.
 */
import { useCallback, useRef, useState } from "react";
import {
  attachSource,
  crawlSource,
  registerSource,
  teachSource,
  type RegisteredSourceView,
} from "../api";

/** Extension → modality, with an honest refusal for what has no adapter yet (CSE-017 §3/§5). */
export interface ModalityInference {
  readonly modality: string | null; // null ⇒ refused (no adapter yet)
  readonly binary: boolean; // true ⇒ send bytes (PDF), else UTF-8 text
  readonly note: string; // plain-language label (supported) or the honest refusal + nearest path
}

const CODE_EXTS = new Set([
  "js",
  "ts",
  "tsx",
  "jsx",
  "py",
  "rs",
  "go",
  "java",
  "c",
  "cpp",
  "h",
  "hpp",
  "rb",
  "swift",
  "kt",
  "cs",
  "php",
  "scala",
  "sh",
]);

/** Modalities the substrate accepts by name but cannot yet canonicalize — refused before upload. */
const REFUSALS: Record<string, string> = {
  epub: "E-books aren't understood yet — export the chapter as a PDF for now.",
  pptx: "Presentations aren't understood yet — export the slides as a PDF.",
  ppt: "Presentations aren't understood yet — export the slides as a PDF.",
  docx: "Word documents aren't understood yet — export as PDF, or paste the text.",
  doc: "Word documents aren't understood yet — export as PDF, or paste the text.",
  mp3: "Audio isn't understood yet (no transcription) — paste a transcript (.vtt or .srt).",
  wav: "Audio isn't understood yet (no transcription) — paste a transcript (.vtt or .srt).",
  m4a: "Audio isn't understood yet (no transcription) — paste a transcript (.vtt or .srt).",
  png: "Images aren't understood yet — bring a document that discusses them.",
  jpg: "Images aren't understood yet — bring a document that discusses them.",
  jpeg: "Images aren't understood yet — bring a document that discusses them.",
  gif: "Images aren't understood yet — bring a document that discusses them.",
  xlsx: "Spreadsheets aren't understood yet — export the sheet as a .csv.",
};

export function inferModality(filename: string): ModalityInference {
  const ext = (filename.split(".").pop() ?? "").toLowerCase();
  if (ext === "pdf") return { modality: "pdf", binary: true, note: "PDF document" };
  if (ext === "md" || ext === "markdown")
    return { modality: "markdown", binary: false, note: "Markdown document" };
  if (ext === "txt" || ext === "text")
    return { modality: "text", binary: false, note: "Plain-text document" };
  if (CODE_EXTS.has(ext)) return { modality: "code", binary: false, note: `Code (${ext})` };
  if (ext === "vtt" || ext === "srt")
    return { modality: "video", binary: false, note: "Video transcript" };
  if (ext === "ipynb") return { modality: "notebook", binary: false, note: "Jupyter notebook" };
  if (ext === "csv" || ext === "tsv")
    return { modality: "dataset", binary: false, note: "Dataset (CSV)" };
  if (ext === "html" || ext === "htm") return { modality: "web", binary: false, note: "Web page" };
  if (ext in REFUSALS) return { modality: null, binary: false, note: REFUSALS[ext]! };
  return {
    modality: null,
    binary: false,
    note: `“.${ext || "?"}” isn't a format I understand yet — try a PDF, Markdown, text, or code file.`,
  };
}

const LAYER_LABELS: Record<string, string> = {
  structural: "Mapped the document's structure",
  semantic: "Read its meaning and concepts",
  visual: "Captured the page layout",
  temporal: "Placed it on a timeline",
  scientific: "Parsed its technical content",
  citation: "Traced its citations",
  meaning: "Modelled how it teaches",
  cognitive: "Prepared it for your understanding",
};

/** Turn a registration summary into the honest loading narrative (CSE-017 §4) — no invented copy. */
export function describeLayers(source: RegisteredSourceView): {
  readonly built: readonly string[];
  readonly degraded: readonly string[];
  readonly verdict: string;
} {
  const degradedSet = new Set(source.degraded_layers);
  const built = source.layers_available
    .filter((l) => !degradedSet.has(l))
    .map((l) => LAYER_LABELS[l] ?? `Built the ${l} layer`);
  const degraded = source.degraded_layers.map(
    (l) => `${LAYER_LABELS[l] ?? `The ${l} layer`} — partial, shown honestly`,
  );
  const verdict = source.usable
    ? "Ready to teach from — deeper understanding keeps forming as you read."
    : "Not yet usable — the structure couldn't be read reliably.";
  return { built, degraded, verdict };
}

type DockPhase =
  | { readonly kind: "idle" }
  | { readonly kind: "refused"; readonly note: string }
  | { readonly kind: "working"; readonly note: string }
  | { readonly kind: "done"; readonly source: RegisteredSourceView }
  | { readonly kind: "error"; readonly message: string };

const PASTE_MODALITIES: readonly { readonly value: string; readonly label: string }[] = [
  { value: "markdown", label: "Markdown" },
  { value: "text", label: "Plain text" },
  { value: "code", label: "Code" },
  { value: "video", label: "Video transcript (VTT/SRT)" },
];

export function SourceDock({
  surfaceId,
  open,
  onClose,
  onAttached,
}: {
  readonly surfaceId: string;
  readonly open: boolean;
  readonly onClose: () => void;
  /** Fired after a source is registered AND bound, so the host can refresh (Living Reference appears). */
  readonly onAttached?: (source: RegisteredSourceView) => void;
}) {
  const [phase, setPhase] = useState<DockPhase>({ kind: "idle" });
  const [url, setUrl] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [pasteModality, setPasteModality] = useState("markdown");
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // R5 (ADR-0062): registration does NOT attach. A mid-session source is only used once the learner
  // consents in the narrative ("Use this document" / "Teach this source") — never a silent hijack.
  const finish = useCallback(async (source: RegisteredSourceView) => {
    setPhase({ kind: "done", source });
  }, []);

  const ingestFile = useCallback(
    async (file: File) => {
      const inference = inferModality(file.name);
      if (!inference.modality) {
        setPhase({ kind: "refused", note: inference.note });
        return;
      }
      setPhase({ kind: "working", note: `Reading “${file.name}”…` });
      try {
        const content = inference.binary ? await file.arrayBuffer() : await file.text();
        const source = await registerSource({
          content,
          modality: inference.modality,
          title: file.name,
        });
        await finish(source);
      } catch (cause) {
        setPhase({
          kind: "error",
          message: cause instanceof Error ? cause.message : "upload failed",
        });
      }
    },
    [finish],
  );

  const ingestUrl = useCallback(async () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    setPhase({ kind: "working", note: `Fetching ${trimmed}…` });
    try {
      const source = await crawlSource(trimmed);
      await finish(source);
    } catch (cause) {
      setPhase({ kind: "error", message: cause instanceof Error ? cause.message : "crawl failed" });
    }
  }, [url, finish]);

  const ingestPaste = useCallback(async () => {
    const trimmed = pasteText.trim();
    if (!trimmed) return;
    setPhase({ kind: "working", note: "Reading your text…" });
    try {
      const source = await registerSource({
        content: pasteText,
        modality: pasteModality,
        title: `Pasted ${pasteModality}`,
      });
      await finish(source);
    } catch (cause) {
      setPhase({ kind: "error", message: cause instanceof Error ? cause.message : "failed" });
    }
  }, [pasteText, pasteModality, finish]);

  if (!open) return null;

  return (
    <div className="frontier-overlay" role="dialog" aria-label="Add a source">
      <button type="button" className="fused-scrim" onClick={onClose} aria-label="Close" />
      <div className="commons-panel source-dock">
        <header className="fused-head">
          <span className="fused-eyebrow commons-eyebrow">
            Bring anything you want to understand
          </span>
          <h2 className="fused-title">Add a source</h2>
          <button type="button" className="overlay-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>

        {phase.kind === "done" ? (
          <SourceDockNarrative
            surfaceId={surfaceId}
            source={phase.source}
            onClose={onClose}
            {...(onAttached ? { onAttached } : {})}
          />
        ) : (
          <div className="source-dock-body">
            {/* File — drag or pick */}
            <div
              className={`source-dock-drop${dragOver ? " is-drag" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const file = e.dataTransfer.files?.[0];
                if (file) void ingestFile(file);
              }}
            >
              <p className="source-dock-drop-label">
                Drop a PDF, Markdown, text, code, or transcript file
              </p>
              <button
                type="button"
                className="commons-attach-btn"
                onClick={() => fileInputRef.current?.click()}
              >
                Choose a file
              </button>
              <input
                ref={fileInputRef}
                type="file"
                className="source-dock-file-input"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void ingestFile(file);
                }}
              />
            </div>

            {/* URL — governed crawl */}
            <div className="source-dock-row">
              <input
                type="url"
                className="source-dock-input"
                placeholder="…or paste a web page URL"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void ingestUrl();
                }}
              />
              <button type="button" className="commons-attach-btn" onClick={() => void ingestUrl()}>
                Fetch
              </button>
            </div>

            {/* Paste */}
            <details className="source-dock-paste">
              <summary>…or paste text</summary>
              <textarea
                className="source-dock-textarea"
                placeholder="Paste markdown, text, code, or a transcript"
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                rows={5}
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
                <button
                  type="button"
                  className="commons-attach-btn"
                  onClick={() => void ingestPaste()}
                >
                  Add
                </button>
              </div>
            </details>

            {phase.kind === "working" ? <p className="fused-note">{phase.note}</p> : null}
            {phase.kind === "refused" ? (
              <p className="fused-note source-dock-refused">{phase.note}</p>
            ) : null}
            {phase.kind === "error" ? (
              <p className="fused-note source-dock-error">Couldn't add it — {phase.message}</p>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * The honest canonicalization narrative shown once a source is registered (CSE-017 §4), followed by
 * the CONSENT gate (R5, ADR-0062). The source is registered but not yet used: "Use this document"
 * attaches it so teaching weaves it in from the next frame; "Teach this source" attaches AND rebuilds
 * the lesson from the document now (teachSource). Nothing is used without the learner's tap.
 */
export function SourceDockNarrative({
  surfaceId,
  source,
  onClose,
  onAttached,
}: {
  readonly surfaceId: string;
  readonly source: RegisteredSourceView;
  readonly onClose: () => void;
  readonly onAttached?: (source: RegisteredSourceView) => void;
}) {
  const { built, degraded, verdict } = describeLayers(source);
  const [pending, setPending] = useState<null | "use" | "teach">(null);
  // A failed attach/teach used to be swallowed and the dock closed anyway, so an upload that never
  // reached the surface looked identical to one that did — the learner saw nothing happen and had
  // no way to retry. Degradation must be visible (CLAUDE.md §3): the dock STAYS OPEN and says why.
  const [failure, setFailure] = useState<string | null>(null);
  const [waking, setWaking] = useState(false);

  const message = (cause: unknown, fallback: string) =>
    cause instanceof Error && cause.message ? cause.message : fallback;

  const use = useCallback(async () => {
    setPending("use");
    setFailure(null);
    try {
      await attachSource(surfaceId, source.source_version_id, () => setWaking(true));
      onAttached?.(source);
      onClose();
    } catch (cause) {
      setFailure(message(cause, "Could not add this document to the lesson."));
    } finally {
      setPending(null);
      setWaking(false);
    }
  }, [surfaceId, source, onAttached, onClose]);

  const teach = useCallback(async () => {
    setPending("teach");
    setFailure(null);
    try {
      await attachSource(surfaceId, source.source_version_id, () => setWaking(true));
      onAttached?.(source);
      // Rebuild the lesson from the document — the document becomes the timeline (R2c).
      // The source IS bound at this point, so a teach failure leaves a usable "Use this document"
      // state rather than losing the upload entirely.
      await teachSource(surfaceId, source.source_version_id, () => setWaking(true));
      onClose();
    } catch (cause) {
      setFailure(message(cause, "Could not rebuild the lesson from this document."));
    } finally {
      setPending(null);
      setWaking(false);
    }
  }, [surfaceId, source, onAttached, onClose]);

  return (
    <div className="source-dock-narrative">
      <h3 className="commons-entry-title">{source.title}</h3>
      <ul className="source-dock-steps">
        {built.map((line) => (
          <li key={line} className="source-dock-step is-built">
            ✓ {line}
          </li>
        ))}
        {degraded.map((line) => (
          <li key={line} className="source-dock-step is-degraded">
            ⚠ {line}
          </li>
        ))}
      </ul>
      <p className="source-dock-verdict">{verdict}</p>
      {source.usable ? (
        <>
          <div className="source-dock-consent" role="group" aria-label="Use this source">
            <button
              type="button"
              className="commons-attach-btn"
              onClick={() => void use()}
              disabled={pending !== null}
            >
              {pending === "use" ? "Adding…" : "Use this document"}
            </button>
            <button
              type="button"
              className="commons-attach-btn source-dock-teach-btn"
              onClick={() => void teach()}
              disabled={pending !== null}
            >
              {pending === "teach" ? "Rebuilding…" : "Teach this source"}
            </button>
          </div>
          <p className="source-dock-consent-hint">
            {waking
              ? "Waking the server — this can take a few seconds on a cold start…"
              : "“Use” weaves it into the lesson as it goes. “Teach” rebuilds the lesson from the document."}
          </p>
          {failure ? (
            <p className="source-dock-failure" role="alert">
              {failure} Your document is still registered — try again.
            </p>
          ) : null}
        </>
      ) : (
        <button type="button" className="commons-attach-btn" onClick={onClose}>
          Close
        </button>
      )}
    </div>
  );
}
