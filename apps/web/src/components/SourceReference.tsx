/**
 * SourceReference — the Living Reference pane (CSE M5, CSE-008).
 *
 * The learner's source, rendered beside the living cognition: canonical bytes fetched out-of-band
 * from the gateway source-content route and rendered NATIVELY on the client (pdf.js for PDF, the
 * source's own text for text modalities) — the rendering of record is the artifact itself, and the
 * pane proves it: sha-256(fetched bytes) is compared against the version's `X-Content-Hash`
 * (ADR-0036 fidelity proof; a mismatch shows amber, the one reserved warning hue).
 *
 * Everything cognitive here is a NON-DESTRUCTIVE overlay projection of folded state: the current
 * viewport (the planner's gaze), semantic highlights by role, and the attention contract binding
 * narration segments to viewports. Realization is client-side choreography (ADR-0007): the pane
 * follows the plan while the learner is passive, and the moment they scroll, auto-follow yields —
 * the learner always wins (CSE-008 §6.3); "Resume guide" re-syncs. Nothing here writes canonical
 * state; the pane is a viewport, never a source of truth (SRF-005).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  SourceHighlightRecord,
  SourceRenderPlacement,
  SourceViewport,
  SurfaceState,
} from "@inevitable/surface/client";
import { API_BASE } from "../api";

type Fidelity = "verifying" | "verified" | "mismatch";

interface SourceReferenceProps {
  readonly state: SurfaceState | null;
  readonly activeFrameId: string | null;
  /** The narration segment currently voicing (choreographer cursor) — drives the attention contract. */
  readonly currentSegmentId: string | null;
  /** Agent-decided placement of the region within the surface (Slice 1, CSE-008). */
  readonly placement?: SourceRenderPlacement;
}

interface FetchedSource {
  readonly bytes: Uint8Array;
  readonly serverHash: string | null;
}

/** sha-256 hex via WebCrypto; null when the runtime lacks subtle crypto (fidelity stays unproven). */
async function sha256Hex(bytes: Uint8Array): Promise<string | null> {
  try {
    const digest = await crypto.subtle.digest(
      "SHA-256",
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
    );
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return null;
  }
}

export function SourceReference({
  state,
  activeFrameId,
  currentSegmentId,
  placement = "beside",
}: SourceReferenceProps) {
  // ── Derive the frame's projection from folded state (pure; the fold is the only truth). ──────
  const plan = useMemo(
    () => (state?.viewport_plans ?? []).find((p) => p.frame_id === activeFrameId) ?? null,
    [state, activeFrameId],
  );
  const sources = useMemo(() => state?.sources ?? [], [state]);
  // The source the current teaching is anchored to (the plan's, else the most recent).
  const taughtSource = useMemo(() => {
    if (plan) return sources.find((s) => s.source_version_id === plan.source_version_id) ?? null;
    return sources[sources.length - 1] ?? null;
  }, [sources, plan]);
  // Multi-source Living Reference (Phase 3, E): the learner can browse ANY attached document; the
  // pane defaults to the taught source and a manual selection is honored until the next frame
  // (learner-priority, CSE-008 §6.3). Only the taught source carries the live viewport/highlights.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  useEffect(() => setSelectedId(null), [activeFrameId]);
  const source = useMemo(() => {
    if (selectedId) return sources.find((s) => s.source_version_id === selectedId) ?? taughtSource;
    return taughtSource;
  }, [selectedId, sources, taughtSource]);
  const isTaught =
    !!source && !!taughtSource && source.source_version_id === taughtSource.source_version_id;
  const sync = useMemo(
    () => (state?.sync_bindings ?? []).find((b) => b.frame_id === activeFrameId) ?? null,
    [state, activeFrameId],
  );
  const highlights = useMemo(
    () =>
      (state?.source_highlights ?? []).filter((h) => h.frame_id === activeFrameId && !h.cleared),
    [state, activeFrameId],
  );

  // The attention contract: map the CURRENT narration segment to its recorded-script twin by
  // position (narrateScript voices non-empty script segments 1:1, in order), then to its binding.
  const currentBinding = useMemo(() => {
    if (!sync || sync.bindings.length === 0) return null;
    const frameNarration = (state?.narration ?? []).filter((n) => n.frame_id === activeFrameId);
    const narrationIndex = frameNarration.findIndex((n) => n.segment_id === currentSegmentId);
    if (narrationIndex < 0) return sync.bindings[0] ?? null;
    const script = (state?.narration_scripts ?? []).find((s) => s.frame_id === activeFrameId);
    const voiced = (script?.segments ?? []).filter((s) => s.text.trim().length > 0);
    const scriptSegmentId = voiced[narrationIndex]?.segment_id;
    return (
      sync.bindings.find((b) => b.segment_id === scriptSegmentId) ??
      sync.bindings[Math.min(narrationIndex, sync.bindings.length - 1)] ??
      null
    );
  }, [sync, state, activeFrameId, currentSegmentId]);

  const currentViewport: SourceViewport | null = useMemo(() => {
    if (!plan || plan.viewports.length === 0) return null;
    if (currentBinding?.viewport_ref) {
      const bound = plan.viewports.find((v) => v.viewport_id === currentBinding.viewport_ref);
      if (bound) return bound;
    }
    return plan.viewports[0] ?? null;
  }, [plan, currentBinding]);
  const focalRefs = useMemo(() => new Set(currentBinding?.highlight_refs ?? []), [currentBinding]);

  // ── Canonical bytes + fidelity proof (fetched once per version; content-addressed = immutable). ──
  const versionId = source?.source_version_id ?? null;
  const [fetched, setFetched] = useState<FetchedSource | null>(null);
  const [fidelity, setFidelity] = useState<Fidelity>("verifying");
  useEffect(() => {
    if (!versionId) return;
    let cancelled = false;
    setFetched(null);
    setFidelity("verifying");
    void (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/sources/${versionId}/content`);
        if (!res.ok) return;
        const serverHash = res.headers.get("x-content-hash");
        const bytes = new Uint8Array(await res.arrayBuffer());
        if (cancelled) return;
        setFetched({ bytes, serverHash });
        const computed = await sha256Hex(bytes);
        if (cancelled) return;
        setFidelity(
          computed && serverHash
            ? computed === serverHash
              ? "verified"
              : "mismatch"
            : "verifying",
        );
      } catch {
        /* pane degrades to quotes below; never a crash */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [versionId]);

  // ── Learner priority (CSE-008 §4.3): any manual scroll pauses auto-follow until resume/next frame.
  const [override, setOverride] = useState(false);
  useEffect(() => setOverride(false), [activeFrameId]);
  const onLearnerScroll = useCallback(() => setOverride(true), []);

  if (!source) return null;

  return (
    <aside
      className="source-reference"
      aria-label={`Source: ${source.title}`}
      data-modality={source.modality}
      data-placement={placement}
    >
      <header className="source-reference-head">
        <span className="source-reference-eyebrow">Source</span>
        <h3 className="source-reference-title">{source.title}</h3>
        <span
          className={`source-fidelity source-fidelity--${fidelity}`}
          title={
            fidelity === "verified"
              ? "Rendered from the exact canonical bytes (hash verified)"
              : fidelity === "mismatch"
                ? "Fetched bytes do not match the canonical hash"
                : "Verifying canonical bytes…"
          }
        >
          {fidelity === "verified" ? "✓ exact" : fidelity === "mismatch" ? "⚠ altered" : "…"}
        </span>
        {override ? (
          <button
            type="button"
            className="source-resume-guide"
            onClick={() => setOverride(false)}
            title="Follow the guided view again"
          >
            Resume guide
          </button>
        ) : null}
        {/* Multi-source (Phase 3, E): switch between every attached document; the taught one is
            marked with a dot, and browsing another shows a return affordance. */}
        {sources.length > 1 ? (
          <div className="source-switcher" role="group" aria-label="Attached documents">
            {sources.map((s) => {
              const taught = s.source_version_id === taughtSource?.source_version_id;
              const shownNow = s.source_version_id === source?.source_version_id;
              return (
                <button
                  key={s.source_version_id}
                  type="button"
                  className="source-switch-chip"
                  data-shown={shownNow ? "true" : "false"}
                  data-taught={taught ? "true" : "false"}
                  onClick={() => setSelectedId(taught ? null : s.source_version_id)}
                  aria-pressed={shownNow}
                  title={taught ? `${s.title} — being taught now` : s.title}
                >
                  {s.title.length > 22 ? `${s.title.slice(0, 21)}…` : s.title}
                  {taught ? (
                    <span className="source-switch-dot" aria-hidden>
                      ●
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        ) : null}
        {!isTaught && taughtSource ? (
          <button
            type="button"
            className="source-resume-guide"
            onClick={() => setSelectedId(null)}
            title="Return to the document being taught"
          >
            ↩ Back to the taught source
          </button>
        ) : null}
      </header>

      {/* Only the taught source carries the live viewport/highlights; browsing another attached
          document is free reading until "Resume guide" returns to the taught source. */}
      {source.modality === "pdf" ? (
        <PdfViewport
          bytes={fetched?.bytes ?? null}
          viewport={isTaught ? currentViewport : null}
          highlights={isTaught ? highlights : []}
          focalRefs={isTaught ? focalRefs : new Set<string>()}
          follow={isTaught && !override}
          onLearnerScroll={onLearnerScroll}
        />
      ) : (
        <TextViewport
          bytes={fetched?.bytes ?? null}
          viewport={isTaught ? currentViewport : null}
          highlights={isTaught ? highlights : []}
          focalRefs={isTaught ? focalRefs : new Set<string>()}
          follow={isTaught && !override}
          onLearnerScroll={onLearnerScroll}
        />
      )}
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Text modalities — the source's own text, highlight overlays by char match
// ---------------------------------------------------------------------------

interface ViewportProps {
  readonly bytes: Uint8Array | null;
  readonly viewport: SourceViewport | null;
  readonly highlights: readonly SourceHighlightRecord[];
  /** Highlight ids the CURRENT narration binding references — these carry the focal light. */
  readonly focalRefs: ReadonlySet<string>;
  readonly follow: boolean;
  readonly onLearnerScroll: () => void;
}

/** Strip the hub's display-truncation ellipsis so quotes locate in the raw text. */
function quoteNeedle(quote: string): string {
  return quote.endsWith("…") ? quote.slice(0, -1) : quote;
}

function TextViewport({
  bytes,
  viewport,
  highlights,
  focalRefs,
  follow,
  onLearnerScroll,
}: ViewportProps) {
  const text = useMemo(() => (bytes ? new TextDecoder().decode(bytes) : null), [bytes]);
  const paneRef = useRef<HTMLDivElement | null>(null);
  const markRef = useRef<HTMLElement | null>(null);

  // Locate each highlight's quote in the raw source (exact match; not found ⇒ skipped, never
  // guessed — the quote still reads below via the viewport chip).
  const segments = useMemo(() => {
    if (!text) return null;
    const found = highlights
      .map((h) => {
        const needle = quoteNeedle(h.region.quote);
        const at = needle ? text.indexOf(needle) : -1;
        return at >= 0 ? { start: at, end: at + needle.length, highlight: h } : null;
      })
      .filter((m): m is NonNullable<typeof m> => m !== null)
      .sort((a, b) => a.start - b.start);
    // Non-overlapping walk: later overlapping matches drop (one light per span).
    const parts: Array<
      | { kind: "plain"; text: string }
      | { kind: "mark"; text: string; highlight: SourceHighlightRecord }
    > = [];
    let cursor = 0;
    for (const m of found) {
      if (m.start < cursor) continue;
      if (m.start > cursor) parts.push({ kind: "plain", text: text.slice(cursor, m.start) });
      parts.push({ kind: "mark", text: text.slice(m.start, m.end), highlight: m.highlight });
      cursor = m.end;
    }
    if (cursor < text.length) parts.push({ kind: "plain", text: text.slice(cursor) });
    return parts;
  }, [text, highlights]);

  // Guided attention: glide the focal mark into view — unless the learner has taken the wheel.
  const focalAnchor = viewport?.anchor_ref ?? null;
  useEffect(() => {
    if (!follow) return;
    markRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [focalAnchor, follow, segments]);

  if (!text) {
    // Bytes not yet fetched: the viewport's preserved quote renders — honest, never blank.
    return viewport ? (
      <blockquote className="source-quote-fallback">{viewport.region.quote}</blockquote>
    ) : null;
  }

  return (
    <div
      className="source-text-pane"
      ref={paneRef}
      onWheel={onLearnerScroll}
      onTouchMove={onLearnerScroll}
    >
      <pre className="source-text">
        {(segments ?? []).map((part, i) =>
          part.kind === "plain" ? (
            <span key={i}>{part.text}</span>
          ) : (
            <mark
              key={i}
              ref={part.highlight.anchor_ref === focalAnchor ? markRef : undefined}
              className="source-highlight"
              data-role={part.highlight.role}
              data-amplitude={
                focalRefs.has(part.highlight.highlight_id) ? "focal" : part.highlight.amplitude
              }
              title={`${part.highlight.role} — ${part.highlight.decided_by}`}
            >
              {part.text}
            </mark>
          ),
        )}
      </pre>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PDF — client-native pdf.js render of the canonical bytes (ADR-0036), bbox overlays
// ---------------------------------------------------------------------------

interface RenderedPage {
  readonly page: number;
  readonly width: number; // CSS px
  readonly height: number;
  readonly scale: number; // CSS px per PDF unit
  readonly pdfHeight: number; // PDF units
}

function PdfViewport({
  bytes,
  viewport,
  highlights,
  focalRefs,
  follow,
  onLearnerScroll,
}: ViewportProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const paneRef = useRef<HTMLDivElement | null>(null);
  const [rendered, setRendered] = useState<RenderedPage | null>(null);
  const [failed, setFailed] = useState(false);
  const pageNumber = viewport?.region.page ?? 1;

  useEffect(() => {
    if (!bytes || typeof document === "undefined") return;
    let cancelled = false;
    void (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
        pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
        // pdfjs transfers (detaches) the buffer to its worker — hand it a copy (M4 gotcha).
        const task = pdfjs.getDocument({ data: bytes.slice() });
        const doc = await task.promise;
        const page = await doc.getPage(Math.max(1, Math.min(pageNumber, doc.numPages)));
        const paneWidth = paneRef.current?.clientWidth ?? 420;
        const base = page.getViewport({ scale: 1 });
        const scale = Math.max(0.5, (paneWidth - 16) / base.width);
        const view = page.getViewport({ scale });
        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;
        const dpr = typeof devicePixelRatio === "number" ? devicePixelRatio : 1;
        canvas.width = Math.floor(view.width * dpr);
        canvas.height = Math.floor(view.height * dpr);
        canvas.style.width = `${view.width}px`;
        canvas.style.height = `${view.height}px`;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        await page.render({ canvasContext: ctx, canvas, viewport: view }).promise;
        if (!cancelled) {
          setRendered({
            page: pageNumber,
            width: view.width,
            height: view.height,
            scale,
            pdfHeight: base.height,
          });
        }
        await task.destroy();
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bytes, pageNumber]);

  // Guided attention: glide the pane to the focal region's overlay position.
  const focalBbox = viewport?.region.bbox ?? null;
  useEffect(() => {
    if (!follow || !rendered || !focalBbox || !paneRef.current) return;
    const [, y, , h] = focalBbox;
    const top = (rendered.pdfHeight - (y + h)) * rendered.scale;
    paneRef.current.scrollTo({ top: Math.max(0, top - 48), behavior: "smooth" });
  }, [rendered, focalBbox, follow]);

  if (failed || !bytes) {
    // Honest degradation: the preserved quote carries the evidence while pixels are unavailable.
    return viewport ? (
      <blockquote className="source-quote-fallback">{viewport.region.quote}</blockquote>
    ) : null;
  }

  const pageHighlights = highlights.filter(
    (h) => h.region.page === (rendered?.page ?? pageNumber) && h.region.bbox,
  );

  return (
    <div
      className="source-pdf-pane"
      ref={paneRef}
      onWheel={onLearnerScroll}
      onTouchMove={onLearnerScroll}
    >
      <div className="source-pdf-page" style={rendered ? { width: rendered.width } : undefined}>
        <canvas ref={canvasRef} className="source-pdf-canvas" />
        {rendered
          ? pageHighlights.map((h) => {
              const [x, y, w, hh] = h.region.bbox!;
              return (
                <span
                  key={h.highlight_id}
                  className="source-highlight source-highlight--box"
                  data-role={h.role}
                  data-amplitude={focalRefs.has(h.highlight_id) ? "focal" : h.amplitude}
                  title={`${h.role} — ${h.decided_by}`}
                  style={{
                    left: x * rendered.scale - 3,
                    top: (rendered.pdfHeight - (y + hh)) * rendered.scale - 3,
                    width: w * rendered.scale + 6,
                    height: hh * rendered.scale + 6,
                  }}
                />
              );
            })
          : null}
      </div>
      {rendered ? <div className="source-pdf-pageno">p. {rendered.page}</div> : null}
    </div>
  );
}
