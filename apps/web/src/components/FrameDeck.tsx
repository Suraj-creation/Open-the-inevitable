/**
 * FrameDeck — the progressive frame projection (UCS, ADR-0030; Phase 2).
 *
 * Renders the active Cognitive Frame and choreographs the transition to the next: as the narration
 * cursor crosses a frame boundary (`activeFrameId` changes), the prior frame cross-dissolves out while
 * the incoming frame rises in. The N+1 frame is buffered off-stage so its image pre-warms and the swap
 * is instant. Which frame is active is a pure client projection over the choreographer cursor — this
 * component reads folded state and the cursor, and owns no canonical truth (ADR-0007).
 *
 * Honors prefers-reduced-motion via the global rule (animations collapse to an instant swap).
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CognitiveFrame, SurfaceState } from "@inevitable/surface/client";
import { activeFrame, nextFrame } from "../frames";
import { FrameStage, directorStateToTint } from "./FrameStage";
import { StreamingBoard } from "./StreamingBoard";
import type { ElementAction } from "./MccrElement";

/** Duration (ms) the outgoing frame lingers while cross-dissolving — must match the CSS exit anim. */
const TRANSITION_MS = 640;
/** Shared-element continuity duration (CDL motion: the concept travels). */
const FLIP_MS = 620;

/** The CDL frame-transition vocabulary (motion explains causality, §7). */
type TransitionKind = "form" | "continue" | "descend" | "ascend";

export function FrameDeck({
  state,
  activeFrameId,
  highlightElementId,
  revealedElementIds,
  anchoredElementIds,
  onElementAction,
  thinking,
}: {
  readonly state: SurfaceState | null;
  readonly activeFrameId: string | null;
  readonly highlightElementId: string | null;
  /** Active-frame elements the narration has revealed so far (staged reveal, UCS, ADR-0030). */
  readonly revealedElementIds?: ReadonlySet<string>;
  /** Active-frame elements any segment references (orphans reveal immediately). */
  readonly anchoredElementIds?: ReadonlySet<string>;
  /** Act on the lesson from a specific anchor on the active frame (F16, CSE-014). */
  readonly onElementAction?: (kind: ElementAction, elementId: string) => void;
  readonly thinking: boolean;
}) {
  const active = activeFrame(state, activeFrameId);
  const upcoming = nextFrame(state, activeFrameId);

  // CSE M7 T1: the Director's target state for the active frame's Scene drives the board's CDL hue
  // (the Director conducts, the client realizes — ADR-0033 L1). Prefer the frame's own Scene state;
  // fall back to the surface's latest directive; null ⇒ FrameStage's title heuristic tints it.
  const activeScene = (state?.scenes ?? []).find((s) => s.frame_ref === active?.frame_id) ?? null;
  const directedState = directorStateToTint(
    activeScene?.state ?? state?.latest_directive?.target_state,
  );
  // CSE M8 T2: anchors the learner marked (annotate scene deltas on this frame's Scene) render with
  // a durable mark — the learner's acts on cognition become visible on the board (CSE-014).
  const markedElementIds = new Set(
    (activeScene?.evolution_log ?? [])
      .filter((d) => d.op === "annotate")
      .map((d) => (d.payload["target_anchor_ref"] as string | undefined) ?? "")
      .filter((ref) => ref.length > 0),
  );
  // R3c (ADR-0057; CSE-013): the Cinematographer's latest shot over this frame's Scene realizes as a
  // subtle, pedagogically-meaningful camera move on the board. `data-shot` is the consumer of the
  // shot grammar that was folded-but-unrendered; reduced-motion falls back to the discrete baseline.
  const shots = activeScene?.shots ?? [];
  const activeShot = shots.length > 0 ? shots[shots.length - 1] : null;
  // R3d (ADR-0057; CSE-012 §4): the Scene's lighting recedes its non-focal actors. Map the recession
  // actor refs → their element ids (actor.content_ref) so siblings dim while the focus reads full.
  const recededElementIds = new Set<string>();
  if (activeScene?.lighting?.recession?.length) {
    const byActor = new Map((activeScene.actors ?? []).map((a) => [a.actor_id, a.content_ref]));
    for (const actorId of activeScene.lighting.recession) {
      const ref = byActor.get(actorId);
      if (ref) recededElementIds.add(ref);
    }
  }
  // R4b (ADR-0058; CSE-018 Law 5): the RIA's plan for this frame — each element's epistemic role +
  // hierarchy, so the board renders the KIND of knowledge in the CDL's visual language.
  const activePlan = (state?.representations ?? []).find((r) => r.frame_id === active?.frame_id);
  const elementRoles = new Map<string, { role: string; hierarchy: string }>();
  for (const c of activePlan?.composition ?? []) {
    elementRoles.set(c.element_id, { role: c.epistemic_role, hierarchy: c.hierarchy });
  }
  const deckRef = useRef<HTMLDivElement | null>(null);

  // Track the frame leaving the stage so it can cross-dissolve out (one transition at a time).
  const [outgoing, setOutgoing] = useState<CognitiveFrame | null>(null);
  // Motion explains causality (CDL §7): staying on the SAME concept (explanation → its practice)
  // is a lateral "continue" — thought moving forward; diving into a prerequisite is a spatial
  // "descend" (zoom in); returning is "ascend"; anything else is a new concept that "form"s.
  const [transition, setTransition] = useState<TransitionKind>("form");
  const descents = state?.prerequisite_descents ?? [];
  const lastActive = useRef<CognitiveFrame | null>(null);
  useEffect(() => {
    const prev = lastActive.current;
    lastActive.current = active;
    if (prev && active && prev.frame_id !== active.frame_id) {
      const prevC = prev.concept_id;
      const activeC = active.concept_id;
      let kind: TransitionKind = "form";
      if (prevC && prevC === activeC) kind = "continue";
      else if (descents.some((d) => d.to_concept_id === activeC && d.from_concept_id === prevC))
        kind = "descend";
      else if (descents.some((d) => d.from_concept_id === activeC && d.to_concept_id === prevC))
        kind = "ascend";
      setTransition(kind);
      setOutgoing(prev);
      const t = setTimeout(() => setOutgoing(null), TRANSITION_MS);
      return () => clearTimeout(t);
    }
    return;
  }, [active]);

  // Shared-element continuity (CDL §7 `continue`): when a concept continues into its own next
  // frame (e.g. explanation → its practice), the core-concept anchor MORPHS from its old position
  // to its new one instead of the whole stage sliding — the idea itself travels, the rest
  // crossfades. Manual FLIP via the Web Animations API (both frames are briefly co-mounted, which
  // the View Transition API can't express); honors reduced-motion by skipping the animation.
  useLayoutEffect(() => {
    if (transition !== "continue" || !outgoing) return;
    const deck = deckRef.current;
    if (!deck) return;
    if (typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches)
      return;
    const outCore = deck.querySelector<HTMLElement>(".frame-stage--exit .mccr-el--core_concept");
    const inCore = deck.querySelector<HTMLElement>(".frame-stage--enter .mccr-el--core_concept");
    if (!outCore || !inCore || typeof inCore.animate !== "function") return;
    const from = outCore.getBoundingClientRect();
    const to = inCore.getBoundingClientRect();
    const dx = from.left + from.width / 2 - (to.left + to.width / 2);
    const dy = from.top + from.height / 2 - (to.top + to.height / 2);
    if (Math.abs(dx) < 4 && Math.abs(dy) < 4) return; // no meaningful travel
    const scale = to.width > 0 ? Math.max(0.6, Math.min(1.6, from.width / to.width)) : 1;
    // The incoming concept flies in from where it just was; its outgoing twin yields instantly so
    // the learner sees one idea in motion, not two.
    outCore.style.opacity = "0";
    inCore.animate(
      [
        { transform: `translate(${dx}px, ${dy}px) scale(${scale})`, opacity: 1 },
        { transform: "none", opacity: 1 },
      ],
      { duration: FLIP_MS, easing: "cubic-bezier(0.32, 0.72, 0, 1)", fill: "both" },
    );
  }, [outgoing, transition]);

  if (!active) {
    // ADR-0063 Phase B: no frame has surfaced yet, but the composer may be STREAMING one — show its
    // anchors forming (from the transient buffer) instead of a bare "Composing…" pulse.
    const forming = state?.streaming_frame_elements ?? [];
    return (
      <div className="frame-deck">
        {forming.length > 0 ? (
          <StreamingBoard elements={forming} />
        ) : (
          <FrameStage frame={null} highlightElementId={null} thinking={thinking} />
        )}
      </div>
    );
  }

  return (
    <div
      className="frame-deck"
      data-transition={transition}
      {...(activeShot ? { "data-shot": activeShot.kind } : {})}
      ref={deckRef}
    >
      {outgoing && outgoing.frame_id !== active.frame_id ? (
        <FrameStage
          key={outgoing.frame_id}
          frame={outgoing}
          highlightElementId={null}
          thinking={false}
          phase="exit"
        />
      ) : null}
      <FrameStage
        key={active.frame_id}
        frame={active}
        highlightElementId={highlightElementId}
        thinking={thinking}
        phase="enter"
        staged
        directedState={directedState}
        markedElementIds={markedElementIds}
        recededElementIds={recededElementIds}
        elementRoles={elementRoles}
        {...(revealedElementIds ? { revealedElementIds } : {})}
        {...(anchoredElementIds ? { anchoredElementIds } : {})}
        {...(onElementAction ? { onElementAction } : {})}
      />
      {/* N+1 buffer: pre-warm the next frame's image so its transition is instant. */}
      <FramePrewarm frame={upcoming} />
    </div>
  );
}

/** Off-stage pre-warm of the next frame's heavy assets (its illustration). Renders nothing visible. */
function FramePrewarm({ frame }: { readonly frame: CognitiveFrame | null }) {
  const content = frame?.mccr?.image?.content;
  const ref = content && content.kind === "image" ? (content.artifact?.content_ref ?? null) : null;
  if (!ref) return null;
  return (
    <div className="frame-prewarm" aria-hidden>
      <img src={ref} alt="" decoding="async" loading="eager" />
    </div>
  );
}
