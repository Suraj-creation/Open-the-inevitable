/**
 * SurfaceView — the Universal Cognitive Surface: one living environment, not a dashboard. The
 * Cognitive Stage (the whiteboard) is fullscreen; everything else floats over it as overlays, HUDs, and
 * launchers (F09 §4.1, the S-UCS composition law). A slim top bar carries identity, goal, the Agents
 * control, and connection; the Path launcher and Agent Observatory open on demand; narration speaks from
 * a floating transport. One viewport (projection) over SurfaceState — the runtime is the product; this
 * only renders. Layout/playback are projection concerns and never enter the canonical record (ADR-0006/7).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { CognitionBlock, SurfaceState } from "@inevitable/surface/client";
import { planSourceRender } from "@inevitable/surface/client";
import { closeSurface, type SurfaceInteractionKind } from "./api";
import { hasFrames, isPracticeFrame } from "./frames";
import { CognitiveStage } from "./components/CognitiveStage";
import { ConsolidationLayer, type Mote } from "./components/ConsolidationLayer";
import { EducatorOverlay } from "./components/EducatorOverlay";
import { FrameDeck } from "./components/FrameDeck";
import { Observatory } from "./components/Observatory";
import { DirectorBadge } from "./components/DirectorBadge";
import { AffectChip } from "./components/AffectChip";
import { FusedView } from "./components/FusedView";
import { FrontierPanel } from "./components/FrontierPanel";
import { TimelinePanel } from "./components/TimelinePanel";
import { CreationPanel } from "./components/CreationPanel";
import { SourceCognitionPanel } from "./components/SourceCognitionPanel";
import { CommonsPanel } from "./components/CommonsPanel";
import { SourceDock } from "./components/SourceDock";
import { PathLauncher, type SurfaceProjection } from "./components/PathLauncher";
import { SourceReference } from "./components/SourceReference";
import { SystemGem } from "./components/SystemGem";
import { UnderstandingMap } from "./components/UnderstandingMap";
import { VoiceLine } from "./components/VoiceLine";
import { useChoreographer } from "./useChoreographer";
import type { ConnectionStatus } from "./useSurfaceStream";

export interface SurfaceViewProps {
  readonly surfaceId: string;
  readonly state: SurfaceState | null;
  readonly status: ConnectionStatus;
  /** The raw streamed event log, for the Observatory's event inspector (F09 §4.1). */
  readonly events?: readonly unknown[];
  readonly onAsk: (goal: string) => void;
  readonly onExpand: (blockId: string, layer: number) => void;
  readonly onInteract?: (kind: SurfaceInteractionKind, targetId?: string) => void;
  /** Teach the next (or a chosen) concept on the existing path — continuity, never a restart. */
  readonly onAdvance?: (conceptId?: string) => void;
  /** Submit the learner's answer to a practice problem — graded into genuine earned mastery (F14). */
  readonly onAnswer?: (conceptId: string, text: string) => void;
}

export function SurfaceView({
  surfaceId,
  state,
  status,
  events = [],
  onAsk,
  onInteract,
  onAdvance,
  onAnswer,
}: SurfaceViewProps) {
  const choreo = useChoreographer(state);
  const [answerText, setAnswerText] = useState("");
  const [exporting, setExporting] = useState(false);
  const [answeredFrames, setAnsweredFrames] = useState<Set<string>>(() => new Set());
  const [dismissedFrontiers, setDismissedFrontiers] = useState<Set<string>>(() => new Set());
  const blocks = useMemo(() => state?.blocks ?? [], [state]);
  const [projection, setProjection] = useState<SurfaceProjection>("timeline");
  const [pathOpen, setPathOpen] = useState(false);
  const [obsOpen, setObsOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [fuseOpen, setFuseOpen] = useState(false);
  const [frontierOpen, setFrontierOpen] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [cognitionOpen, setCognitionOpen] = useState(false);
  const [commonsOpen, setCommonsOpen] = useState(false);
  const [dockOpen, setDockOpen] = useState(false);
  // Close the session as the learner leaves (ADR-0055 D4) — the distillation trigger for episodes,
  // deltas, and the next resume card. `pagehide` (NOT `visibilitychange`, which fires on every tab
  // switch and would kill a live lesson) fires on close/navigate/bfcache; at most once per surface.
  const closedRef = useRef(false);
  useEffect(() => {
    closedRef.current = false;
    const onLeave = () => {
      if (closedRef.current) return;
      closedRef.current = true;
      closeSurface(surfaceId, "learner-left");
    };
    window.addEventListener("pagehide", onLeave);
    return () => window.removeEventListener("pagehide", onLeave);
  }, [surfaceId]);

  // The returning learner's resume card (CSE M6) — dismissible; reopenable via the map.
  const [resumeDismissed, setResumeDismissed] = useState(false);
  const resumeCard = state?.resume_card ?? null;
  // CSE M9: fusion becomes available once ≥2 sources are bound (reconcile many into one).
  const canFuse = (state?.sources?.length ?? 0) >= 2;

  // Consolidate motion (CDL §7): when a concept becomes mastered, a mote of it drifts into the
  // Path (knowledge becoming memory). We diff the mastered set across renders; the first observed
  // timeline seeds the baseline WITHOUT firing (so a resumed session's prior mastery doesn't
  // replay). A pure projection of timeline status.
  const [motes, setMotes] = useState<Mote[]>([]);
  const masteredRef = useRef<Set<string> | null>(null);
  const timeline = state?.timeline ?? null;
  useEffect(() => {
    const nodes = timeline?.nodes ?? [];
    if (nodes.length === 0) return;
    const current = new Set(nodes.filter((n) => n.status === "mastered").map((n) => n.concept_id));
    if (masteredRef.current === null) {
      masteredRef.current = current;
      return;
    }
    const prev = masteredRef.current;
    const newly = [...current].filter((c) => !prev.has(c));
    masteredRef.current = current;
    if (newly.length > 0) {
      const stamp = `${nodes.length}:${current.size}`;
      setMotes((prevMotes) => [
        ...prevMotes,
        ...newly.map((c) => ({
          id: `${c}:${stamp}`,
          title: nodes.find((n) => n.concept_id === c)?.title ?? c,
        })),
      ]);
    }
  }, [timeline]);

  // A facet click pins a block to the stage; live advance returns focus to the unfolding cognition.
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const lastCursor = useRef(choreo.cursor);
  useEffect(() => {
    if (choreo.cursor !== lastCursor.current) {
      lastCursor.current = choreo.cursor;
      setPinnedId(null);
    }
  }, [choreo.cursor]);

  const byId = (id: string | null): CognitionBlock | null =>
    (id && blocks.find((b) => b.block_id === id)) || null;

  let focusedBlock = byId(pinnedId);
  if (!focusedBlock && choreo.focus?.target_type === "block") {
    focusedBlock = byId(choreo.focus.target_id);
  }
  if (!focusedBlock) {
    focusedBlock =
      [...blocks].reverse().find((b) => b.block_type === "explanation") ??
      blocks[blocks.length - 1] ??
      null;
  }

  const focusConceptId =
    choreo.focus?.target_type === "concept"
      ? choreo.focus.target_id
      : (focusedBlock?.concept_ids[0] ?? null);

  // Inline multimodal (S-UCS): media that shares the focused concept renders BESIDE it, not as a
  // detached facet (F09 §4.1). It is therefore excluded from the context ribbon below.
  const MEDIA_TYPES = new Set(["image", "video", "simulation"]);
  const relatedMedia = focusedBlock
    ? blocks.filter(
        (b) =>
          b.block_id !== focusedBlock.block_id &&
          MEDIA_TYPES.has(b.block_type) &&
          b.concept_ids.some((c) => focusedBlock.concept_ids.includes(c)),
      )
    : [];
  const relatedMediaIds = new Set(relatedMedia.map((b) => b.block_id));
  const context = blocks
    .filter((b) => b.block_id !== focusedBlock?.block_id && !relatedMediaIds.has(b.block_id))
    .slice(-6)
    .reverse();
  const speaking = !!choreo.speakingBlockId && choreo.speakingBlockId === focusedBlock?.block_id;
  const thinking = status !== "idle" && blocks.length === 0;
  // An in-flight streamed explanation (S-UCS, ADR-0028): the latest transient buffer, shown forming
  // on the stage until its whole block lands (which clears the buffer). Pure projection.
  const streamingBuffers = state?.streaming_blocks ?? [];
  const streaming =
    streamingBuffers.length > 0 ? streamingBuffers[streamingBuffers.length - 1] : null;

  // UCS (ADR-0030): when the surface composes Cognitive Frames, the board renders the progressive
  // frame sequence (the FrameDeck: active frame + cross-dissolve transitions + N+1 buffering).
  // Otherwise the legacy block stage renders (graceful fallback, F16 §12).
  const framePath = hasFrames(state);

  // CSE M5: the Living Reference — when a source is bound, the reference pane renders it beside
  // the board (dual experience without canonical panel state, CSE-008 §3.3). Pure projection.
  const hasSource = (state?.sources?.length ?? 0) > 0;
  // Slice 1 (CSE-008): the document is an AGENT-PLACED REGION of the surface — "part of it, not over
  // it". `planSourceRender` (surface pkg, one authority) decides, for the ACTIVE frame only, whether
  // the doc is shown, where (spotlight/beside/corner), or retired — from the agent's own projection
  // (this frame's viewport plan + emphasis + highlights). No always-on full-bleed reader.
  const sourceRender = useMemo(() => {
    if (!hasSource) return { visible: false, placement: "hidden" as const, reason: "no source" };
    const plan =
      (state?.viewport_plans ?? []).find((p) => p.frame_id === choreo.activeFrameId) ?? null;
    const highlights = (state?.source_highlights ?? []).filter(
      (h) => h.frame_id === choreo.activeFrameId && !h.cleared,
    );
    const focusVp =
      plan?.viewports.find((v) => v.emphasis === "focus") ?? plan?.viewports[0] ?? null;
    return planSourceRender({
      plan,
      currentViewport: focusVp,
      hasHighlights: highlights.length > 0,
    });
  }, [hasSource, state, choreo.activeFrameId]);
  const sourcePlacementClass =
    sourceRender.placement === "spotlight"
      ? "board-plane--source-stage"
      : sourceRender.placement === "beside"
        ? "board-plane--with-source"
        : sourceRender.placement === "corner"
          ? "board-plane--source-corner"
          : "";

  // The next step on the path — the concept to teach when the learner continues. Preferred: the next
  // "available" concept; else any not-yet-mastered concept other than the current focus.
  const timelineNodes = state?.timeline?.nodes ?? [];
  const nextConcept =
    timelineNodes.find((n) => n.status === "available" && n.concept_id !== focusConceptId) ??
    timelineNodes.find((n) => n.status !== "mastered" && n.concept_id !== focusConceptId) ??
    null;
  // A natural stopping point: the narration has caught up and at least one frame has been taught.
  // The continue ribbon is PERSISTENT here (never auto-hidden) so the learner is never stranded.
  const atStoppingPoint = choreo.atEnd && (state?.frames?.length ?? 0) > 0;

  // ADR-0064 rolling buffer, made visible: the surface pre-builds the next concepts in the
  // background. Show the learner how many steps are already composed and waiting, and whether the
  // NEXT step specifically is pre-built (so "Continue" is instant, not a wait). Pure projection over
  // speculative_frames — the client owns no truth, it just reflects the buffer.
  const readyAhead = (state?.speculative_frames ?? []).filter(
    (f) => f.status === "speculative",
  ).length;
  const nextIsPrebuilt =
    !!nextConcept &&
    (state?.speculative_frames ?? []).some(
      (f) => f.status === "speculative" && f.concept_id === nextConcept.concept_id,
    );

  // The active frame; when it's a practice frame the learner is invited to ANSWER (graded → real
  // mastery, F14). One answer per frame; the affordance retires once submitted.
  const activeFrame =
    (state?.frames ?? []).find((f) => f.frame_id === choreo.activeFrameId) ?? null;
  const isPractice = isPracticeFrame(activeFrame);
  const canAnswer =
    isPractice &&
    !!onAnswer &&
    !!activeFrame?.concept_id &&
    !answeredFrames.has(activeFrame.frame_id);

  // Prerequisite descent (F03): while the surface has dived into a prerequisite (a descent that
  // targets the active frame's concept, not yet completed), a breadcrumb orients the learner —
  // the CDL `descend` motion needs a light trail back up (§7).
  const activeDescent = (state?.prerequisite_descents ?? []).find(
    (d) => !d.completed && d.to_concept_id === activeFrame?.concept_id,
  );
  const descentFromTitle = activeDescent
    ? (timelineNodes.find((n) => n.concept_id === activeDescent.from_concept_id)?.title ??
      activeDescent.from_concept_id)
    : null;

  // Fallback health (review §22): if any cognitive unit degraded to its deterministic path, say so —
  // silent degradation is a lie. Show the distinct units that fell back.
  const degradedUnits = Array.from(new Set((state?.cognition_health ?? []).map((d) => d.unit_id)));

  // Ask progress (review §9): the pipeline's phases are narrated to the learner as they happen —
  // an ask is never a silent multi-minute wait. "ready" ⇒ idle; anything else ⇒ in flight.
  const askPhase = state?.ask_progress?.phase ?? null;
  const askBusy = !!askPhase && askPhase !== "ready";
  const askProgressLine = askBusy ? phaseLine(askPhase, state?.ask_progress?.detail ?? null) : null;

  // Multi-agent disagreement made visible (review §12): when a challenger diverged, offer the learner
  // a way into "another view" (the ensemble panel) rather than leaving it buried in the Observatory.
  const hasDisagreement = (state?.disagreements?.length ?? 0) > 0;

  // Research frontier (F10, review §24): once mastery opens a frontier, curiosity becomes visible as a
  // non-modal nudge — the learner can step from learning into research.
  const frontier =
    (state?.research_frontiers ?? []).find(
      (f) => f.surfaced && !dismissedFrontiers.has(f.concept_id),
    ) ?? null;
  const frontierTitle = frontier
    ? (timelineNodes.find((n) => n.concept_id === frontier.concept_id)?.title ??
      frontier.concept_id)
    : "";

  return (
    <div className="surface">
      {/* The whiteboard fills the viewport. The board plane holds cognition; the slot column below
          it is STAGE-OWNED chrome — practice input, frontier, continue — reserved in the layout so
          nothing can ever float over an anchor (CDL: the board is sacred). */}
      <main className="stage-wrap">
        <div
          className={`board-plane${sourceRender.visible ? ` ${sourcePlacementClass}` : ""}`}
          data-source-placement={sourceRender.visible ? sourceRender.placement : "hidden"}
        >
          {descentFromTitle ? (
            <div className="descent-trail" role="status">
              <span className="descent-trail-glyph" aria-hidden>
                ↓
              </span>
              Prerequisite of <strong>{descentFromTitle}</strong>
            </div>
          ) : null}
          {framePath ? (
            <FrameDeck
              state={state}
              activeFrameId={choreo.activeFrameId}
              highlightElementId={choreo.highlightElementId}
              revealedElementIds={choreo.revealedElementIds}
              anchoredElementIds={choreo.frameAnchoredElementIds}
              {...(onInteract
                ? { onElementAction: (kind, elementId) => onInteract(kind, elementId) }
                : {})}
              thinking={thinking}
            />
          ) : (
            <CognitiveStage
              block={focusedBlock}
              speaking={speaking}
              context={context}
              activeId={focusedBlock?.block_id ?? null}
              onSelect={(id) => setPinnedId(id)}
              thinking={thinking}
              streaming={streaming ? { text: streaming.text } : null}
              relatedMedia={relatedMedia}
            />
          )}
          {/* The Living Reference (CSE M5) as an AGENT-PLACED REGION (Slice 1, CSE-008): rendered only
              when this frame references the source, placed by emphasis, retired otherwise — it emerges
              from the surface, never floats over it as an always-on panel. */}
          {sourceRender.visible ? (
            <SourceReference
              state={state}
              activeFrameId={choreo.activeFrameId}
              currentSegmentId={choreo.current?.segment_id ?? null}
              placement={sourceRender.placement}
            />
          ) : null}
        </div>

        {resumeCard && !resumeDismissed ? (
          <div className="board-slots">
            {/* CSE M6 (ADR-0037): a returning learner reopens not "where they were" but "what was
                happening in their understanding" — derived from the intelligence plane, dismissible. */}
            <div className="resume-card" role="status">
              <span className="resume-card-eyebrow">
                Welcome back{resumeCard.days_since > 0 ? ` — ${resumeCard.days_since}d since` : ""}
              </span>
              <p className="resume-card-summary">{resumeCard.summary}</p>
              {resumeCard.open_confusions.length > 0 ? (
                <p className="resume-card-confusion">
                  Still open: {resumeCard.open_confusions.map((c) => c.concept_ref).join(", ")}
                </p>
              ) : null}
              <div className="resume-card-actions">
                {resumeCard.last_concept_ref && onAdvance ? (
                  <button
                    type="button"
                    className="resume-card-btn"
                    onClick={() => onAdvance(resumeCard.last_concept_ref ?? undefined)}
                  >
                    Pick up {resumeCard.last_concept_ref} <span aria-hidden>→</span>
                  </button>
                ) : null}
                <button type="button" className="resume-card-map" onClick={() => setMapOpen(true)}>
                  See your map
                </button>
                <button
                  type="button"
                  className="resume-card-dismiss"
                  onClick={() => setResumeDismissed(true)}
                  aria-label="Dismiss"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {frontier || (canAnswer && activeFrame?.concept_id) || (atStoppingPoint && onAdvance) ? (
          <div className="board-slots">
            {/* Research frontier (F10): learning becomes research — a non-modal, dismissible nudge. */}
            {frontier ? (
              <div className="frontier-chip" role="status">
                <span className="frontier-chip-eyebrow">Research frontier</span>
                <button
                  type="button"
                  className="frontier-chip-btn"
                  onClick={() => {
                    onAsk(`Explore the open research frontier of ${frontierTitle}`);
                    setDismissedFrontiers((prev) => new Set(prev).add(frontier.concept_id));
                  }}
                >
                  You're ready for the frontier of {frontierTitle} <span aria-hidden>→</span>
                </button>
                <button
                  type="button"
                  className="frontier-chip-dismiss"
                  onClick={() =>
                    setDismissedFrontiers((prev) => new Set(prev).add(frontier.concept_id))
                  }
                  aria-label="Dismiss frontier"
                >
                  ✕
                </button>
              </div>
            ) : null}

            {/* Practice is REAL and lives ON the board plane — the workbook is on the desk, never
                floating over it. The learner answers; the answer is graded into mastery (F14). */}
            {canAnswer && activeFrame?.concept_id ? (
              <form
                className="answer-panel"
                onSubmit={(e) => {
                  e.preventDefault();
                  const text = answerText.trim();
                  if (!text || !activeFrame.concept_id) return;
                  onAnswer?.(activeFrame.concept_id, text);
                  setAnsweredFrames((prev) => new Set(prev).add(activeFrame.frame_id));
                  setAnswerText("");
                }}
              >
                <label className="answer-label" htmlFor="answer-input">
                  Your answer
                </label>
                <textarea
                  id="answer-input"
                  className="answer-input"
                  value={answerText}
                  onChange={(e) => setAnswerText(e.target.value)}
                  placeholder="Work it through in your own words…"
                  rows={3}
                />
                <button type="submit" className="answer-submit" disabled={!answerText.trim()}>
                  Submit for feedback <span aria-hidden>→</span>
                </button>
              </form>
            ) : null}

            {/* The learner is never stranded: at a stopping point, the forward slot proposes the
                next step (continuity — understanding compounds, it never restarts). */}
            {atStoppingPoint && onAdvance ? (
              <div className="next-step" role="group" aria-label="Continue learning">
                <span className="next-step-eyebrow">
                  {nextIsPrebuilt ? (
                    <>
                      <span className="next-step-spark" aria-hidden>
                        ✦
                      </span>{" "}
                      Built ahead — continues instantly
                    </>
                  ) : (
                    "Ready for what's next"
                  )}
                </span>
                <button
                  type="button"
                  className={`next-step-btn${nextIsPrebuilt ? " is-prebuilt" : ""}`}
                  onClick={() => onAdvance(nextConcept?.concept_id)}
                >
                  {nextConcept ? `Continue: ${nextConcept.title}` : "Continue"}
                  <span aria-hidden> →</span>
                </button>
                {readyAhead > 0 ? (
                  <span
                    className="next-step-buffer"
                    title="The surface is building the next steps ahead of you"
                  >
                    {readyAhead} step{readyAhead === 1 ? "" : "s"} ready ahead
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </main>

      {/* Whisper top bar — wordmark, the goal, and one living System Gem. All system state (agents,
          connection, degradation) lives in the gem's light, never as alarm chrome (CDL). */}
      <header className="surface-top">
        <div className="brand">
          <span className="brand-mark" aria-hidden>
            ◇
          </span>
          <span className="brand-name">The Inevitable</span>
        </div>
        <div className="surface-goal">{state?.goal ?? "a cognitive surface"}</div>
        {hasDisagreement ? (
          <button
            type="button"
            className="conn-another-view"
            onClick={() => setObsOpen(true)}
            title="The agents disagreed — open the ensemble to see another view."
          >
            <span aria-hidden>⇄</span> another view
          </button>
        ) : null}
        {/* Downloadable cognitive session (issue 11): every frame becomes a formatted slide, the
            narration becomes speaker notes — a study artifact, not a dead tab. */}
        {(state?.frames?.length ?? 0) > 0 ? (
          <button
            type="button"
            className="export-deck"
            disabled={exporting}
            onClick={() => {
              if (!state) return;
              setExporting(true);
              void import("./export/export-pptx")
                .then((mod) => mod.exportSessionAsPptx(state))
                .catch(() => undefined)
                .finally(() => setExporting(false));
            }}
            title="Download this session as a PowerPoint study deck"
          >
            <span aria-hidden>⭳</span> {exporting ? "Exporting…" : "Deck"}
          </button>
        ) : null}
        {/* Source Fusion (CSE M9) — reconcile many bound sources into one understanding, on demand. */}
        {canFuse ? (
          <button
            type="button"
            className="mind-open"
            onClick={() => setFuseOpen(true)}
            title="Reconcile your sources into one understanding"
          >
            <span aria-hidden>⧉</span> Fuse
          </button>
        ) : null}
        {/* Living knowledge (CSE M9 Frontier T1) — research the concept's frontier on the web. */}
        {focusConceptId ? (
          <button
            type="button"
            className="mind-open"
            onClick={() => setFrontierOpen(true)}
            title="Connect this concept to the current research frontier"
          >
            <span aria-hidden>🔭</span> Frontier
          </button>
        ) : null}
        {/* Temporal Knowledge Model (CSE M9 TKM T1) — the concept's trajectory through time. */}
        {focusConceptId ? (
          <button
            type="button"
            className="mind-open"
            onClick={() => setTimelineOpen(true)}
            title="Trace this concept through time — origin to open problems"
          >
            <span aria-hidden>⧖</span> Timeline
          </button>
        ) : null}
        {/* Creative Cognition (CSE M11 T1) — the learner authors; the system only ever assists. */}
        <button
          type="button"
          className="mind-open"
          onClick={() => setCreateOpen(true)}
          title="Make something — you author, the system offers structure, critique, questions, references"
        >
          <span aria-hidden>✎</span> Create
        </button>
        {/* The Source Dock (CSE-017, ADR-0056) — the front door: bring a PDF, page, code, or notes. */}
        <button
          type="button"
          className="mind-open"
          onClick={() => setDockOpen(true)}
          title="Bring a source to learn from — a PDF, a web page, code, a transcript, or notes"
        >
          <span aria-hidden>＋</span> Source
        </button>
        {/* The knowledge commons (ADR-0053) — discover + build on what other learners have shared. */}
        <button
          type="button"
          className="mind-open"
          onClick={() => setCommonsOpen(true)}
          title="Discover what other learners have created and shared — attach one to build on it"
        >
          <span aria-hidden>❖</span> Commons
        </button>
        {/* Deep-transparency (CSE M12 T1) — the source plane's reasoning, made observable. */}
        <button
          type="button"
          className="mind-open"
          onClick={() => setCognitionOpen(true)}
          title="See how the source environment reasoned — layers, claims, fusion, grounding, honestly degraded"
        >
          <span aria-hidden>◉</span> Runtime
        </button>
        {/* The Cognitive Director, made legible (CSE M7) — current state + pace, "why this pace". */}
        <DirectorBadge directive={state?.latest_directive ?? null} />
        {/* R3e (CSE-005 §3.5): what the system senses + the attention budget when low — visible, opt-out. */}
        <AffectChip
          affect={state?.latest_affect ?? null}
          budget={state?.attention_budget ?? null}
        />
        {/* The learner's own understanding, on demand (CSE M6) — legible, never a hidden score. */}
        <button
          type="button"
          className="mind-open"
          onClick={() => setMapOpen(true)}
          title="See how your understanding is forming"
        >
          <span aria-hidden>◔</span> Mind
        </button>
        <SystemGem
          presence={state?.presence ?? []}
          status={status}
          degradedUnits={degradedUnits}
          active={obsOpen}
          onToggle={() => setObsOpen((o) => !o)}
        />
      </header>

      {/* Floating launcher → Path/concept-graph overlay (whiteboard stays clear until summoned). */}
      <PathLauncher
        open={pathOpen}
        onToggle={() => setPathOpen((o) => !o)}
        onClose={() => setPathOpen(false)}
        timeline={state?.timeline ?? null}
        blocks={blocks}
        projection={projection}
        onProjection={setProjection}
        focusConceptId={focusConceptId}
        focus={choreo.focus ?? state?.focus ?? null}
        focusedBlockId={focusedBlock?.block_id ?? null}
        onJump={(conceptId) => (onAdvance ? onAdvance(conceptId) : onInteract?.("jump", conceptId))}
        onBranch={(conceptId) => onInteract?.("branch", conceptId)}
        onSelectBlock={(id) => setPinnedId(id)}
      />

      {/* Agent Observatory — on-demand inspector overlay (replaces the permanent right rail). */}
      <Observatory
        open={obsOpen}
        onClose={() => setObsOpen(false)}
        surfaceId={surfaceId}
        state={state}
        focusedBlock={focusedBlock}
        activeFrameId={choreo.activeFrameId}
        events={events}
        playback={{
          mode: choreo.mode,
          cursor: choreo.cursor,
          total: choreo.segments.length,
          speed: choreo.speed,
        }}
      />

      {/* Understanding Map (CSE M6) — the learner's own mind made legible; a read-side projection
          over their intelligence plane. On-demand, disclosed by construction (never covert). */}
      <UnderstandingMap open={mapOpen} onClose={() => setMapOpen(false)} state={state} />

      {/* Source Fusion (CSE M9) — many sources reconciled into one understanding, on demand. */}
      <FusedView
        surfaceId={surfaceId}
        conceptRefs={(state?.timeline?.nodes ?? []).map((n) => n.concept_id)}
        open={fuseOpen}
        onClose={() => setFuseOpen(false)}
      />

      {/* Living knowledge (CSE M9 Frontier T1) — the focus concept's research frontier, on demand. */}
      {focusConceptId ? (
        <FrontierPanel
          surfaceId={surfaceId}
          conceptRef={focusConceptId}
          conceptTitle={
            timelineNodes.find((n) => n.concept_id === focusConceptId)?.title ?? focusConceptId
          }
          open={frontierOpen}
          onClose={() => setFrontierOpen(false)}
        />
      ) : null}

      {/* Temporal Knowledge Model (CSE M9 TKM T1) — the focus concept's trajectory through time. */}
      {focusConceptId ? (
        <TimelinePanel
          surfaceId={surfaceId}
          conceptRef={focusConceptId}
          conceptTitle={
            timelineNodes.find((n) => n.concept_id === focusConceptId)?.title ?? focusConceptId
          }
          open={timelineOpen}
          onClose={() => setTimelineOpen(false)}
        />
      ) : null}

      {/* Creative Cognition (CSE M11 T1) — the learner authors; the system only ever attaches assists. */}
      <CreationPanel
        surfaceId={surfaceId}
        conceptRefs={(state?.timeline?.nodes ?? []).map((n) => n.concept_id)}
        seedTitle={
          focusConceptId
            ? (timelineNodes.find((n) => n.concept_id === focusConceptId)?.title ?? undefined)
            : undefined
        }
        open={createOpen}
        onClose={() => setCreateOpen(false)}
      />

      {/* Deep-transparency (CSE M12 T1) — the source plane's cognition, made observable. */}
      <SourceCognitionPanel open={cognitionOpen} onClose={() => setCognitionOpen(false)} />

      {/* The knowledge commons (ADR-0053) — discover + attach peers' contributed creations. */}
      <CommonsPanel
        surfaceId={surfaceId}
        open={commonsOpen}
        onClose={() => setCommonsOpen(false)}
      />

      {/* The Source Dock (CSE-017) — bring a source in-product; auto-attaches on success. */}
      <SourceDock surfaceId={surfaceId} open={dockOpen} onClose={() => setDockOpen(false)} />

      {state?.mode === "educator" && <EducatorOverlay state={state} />}

      {/* Consolidate motion — a mastered concept drifts into the Path (knowledge → memory). */}
      <ConsolidationLayer
        motes={motes}
        onDone={(id) => setMotes((m) => m.filter((x) => x.id !== id))}
      />

      {/* The Voice Line — narration as ambient light at the bottom edge, with the Thread of
          Understanding; instruments rise on approach (CDL: chrome dissolves). */}
      <VoiceLine
        choreo={choreo}
        status={status}
        onAsk={onAsk}
        onInteract={onInteract}
        frames={(state?.frames ?? []).map((f) => ({ frame_id: f.frame_id, title: f.title }))}
        progressLine={askProgressLine}
        busy={askBusy}
      />
    </div>
  );
}

/** Human phrasing for an in-flight ask's pipeline phase (surface.ask.progress). */
function phaseLine(phase: string, detail: string | null): string {
  switch (phase) {
    case "interpreting":
      return detail ? `Understanding your ask — ${detail}…` : "Understanding your ask…";
    case "planning":
      return detail ? `Choosing how to teach ${detail}…` : "Choosing what to teach…";
    case "composing":
      return detail ? `Composing the board — ${detail}…` : "Composing the board…";
    case "voicing":
      return detail ? `Giving it a voice — ${detail}…` : "Giving it a voice…";
    default:
      return "Thinking…";
  }
}
