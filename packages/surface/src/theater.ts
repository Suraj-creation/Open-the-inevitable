/**
 * The Cognitive Theater — Director + Scene substrate (CSE M7 T1; CSE-011/012, ADR-0033/0038).
 *
 * Two organs that change the surface from a narrated slide deck into a conducted, inhabitable
 * space:
 *  - the **Director** owns "what cognitive state should this learner enter next, and at what
 *    pace?" — in T1 an AUTHORED PEDAGOGY FSM: `decideDirective` is a pure function of folded
 *    signals (mastery, depth-gates, prerequisite descents, frontier, affect), so every Directive
 *    is deterministic and replay re-derives it identically (CSE-011 §5/§10; ADR-0033 L1);
 *  - the **Scene** elevates a composed frame into a living space with actors + lighting, wrapping
 *    (never replacing) the ADR-0030 frame — a Scene with no evolution is byte-identical to the
 *    frame (CSE-012 §2; ADR-0033 L2).
 *
 * Everything here is pure and browser-safe (part of the client fold path): defensive readers and
 * the FSM have no runtime imports. The affect channel is behavioral-inferred in T1
 * (`inferAffect`), learner-visible and opt-out (CSE-005 §7).
 */
import type { SceneShot } from "./cinematography";

// ---------------------------------------------------------------------------
// Director — cognitive states, directives, affect
// ---------------------------------------------------------------------------

/** The T1 cognitive-state space (a subset of CSE-011 §3.1, aligned to CDL hues). */
export const DIRECTOR_STATES = [
  "orienting",
  "learning",
  "practicing",
  "struggling",
  "consolidating",
  "assessing",
  "mastering",
] as const;
export type DirectorState = (typeof DIRECTOR_STATES)[number];

export type DirectiveScale = "concept" | "lesson" | "module" | "domain";
export type DirectiveTempo = "slow" | "measured" | "brisk";
export type DirectiveIntensity = "gentle" | "normal" | "demanding";

export interface DirectivePacing {
  readonly tempo: DirectiveTempo;
  readonly dwell_hint_ms: number;
  readonly silence: boolean;
}

/** The Director's only output — a typed intent downstream organs execute *within* (CSE-011 §3.2). */
export interface DirectiveRecord {
  readonly directive_id: string;
  readonly scale: DirectiveScale;
  readonly target_state: DirectorState;
  readonly pacing: DirectivePacing;
  readonly intensity: DirectiveIntensity;
  readonly focus: {
    readonly concept_ref: string | null;
    readonly source_anchor_ref: string | null;
  };
  readonly rationale: string;
  readonly considered: readonly {
    readonly alternative_state: DirectorState;
    readonly rejected_because: string;
  }[];
  readonly evidence_refs: readonly string[];
  readonly confidence: number;
  /** Set by `surface.director.state.entered` — the state the learner is judged to have entered. */
  readonly entered_state: DirectorState | null;
  readonly hlc: string;
}

export type AffectState =
  | "engaged"
  | "curious"
  | "frustrated"
  | "overloaded"
  | "bored"
  | "fatigued"
  | "confident";
export type AffectSource = "behavioral-inference" | "learner-declared";

export interface AffectSignalRecord {
  readonly affect_state: AffectState;
  readonly source: AffectSource;
  readonly signals: readonly string[];
  readonly confidence: number;
  readonly hlc: string;
}

export type AttentionRemaining = "high" | "medium" | "low" | "depleted";
export interface AttentionBudgetRecord {
  readonly remaining: AttentionRemaining;
  readonly session_minutes: number;
  readonly hlc: string;
}

// ---------------------------------------------------------------------------
// Scene — actors, lighting, evolution
// ---------------------------------------------------------------------------

export type ActorKind =
  | "text-anchor"
  | "equation"
  | "diagram"
  | "figure"
  | "table"
  | "image"
  | "video"
  | "simulation"
  | "overlay"
  | "voice"
  | "citation"
  | "annotation"
  | "creation-canvas";
export type ActorRole = "protagonist" | "support" | "evidence" | "contrast" | "aside";
export type SceneProvenanceClass = "evidence" | "inference" | "frontier";

export interface SceneActor {
  readonly actor_id: string;
  readonly kind: ActorKind;
  readonly content_ref: string;
  readonly role: ActorRole;
  readonly provenance_class: SceneProvenanceClass;
  readonly can_evolve: boolean;
}

export interface SceneLighting {
  readonly focus_actor_ref: string | null;
  readonly cdl_state: DirectorState;
  readonly recession: readonly string[];
}

export type SceneDeltaOp =
  | "actor.enter"
  | "actor.transform"
  | "actor.exit"
  | "lighting.change"
  | "reveal"
  | "annotate"
  | "branch";
export type SceneDeltaCause = "director" | "agent" | "learner" | "cinematography";

export interface SceneDeltaRecord {
  readonly delta_id: string;
  readonly op: SceneDeltaOp;
  readonly cause: SceneDeltaCause;
  readonly payload: Record<string, unknown>;
  readonly interaction_ref: string | null;
  readonly hlc: string;
}

/** A living Scene wrapping an ADR-0030 frame (CSE-012 §3.1). Upserts by scene_id into SurfaceState. */
export interface SceneRecord {
  readonly scene_id: string;
  readonly frame_ref: string;
  readonly concept_ref: string | null;
  readonly state: DirectorState;
  readonly directive_ref: string | null;
  readonly actors: readonly SceneActor[];
  readonly lighting: SceneLighting;
  /** The scene-delta stream that has mutated this scene in place (CSE-012 §3.3). */
  readonly evolution_log: readonly SceneDeltaRecord[];
  /** The Cinematographer's shot list over this scene (CSE M8, CSE-013 §3). */
  readonly shots: readonly SceneShot[];
  readonly closed: boolean;
  readonly hlc: string;
}

// ---------------------------------------------------------------------------
// The authored pedagogy FSM (CSE-011 §10; deterministic, replay-safe)
// ---------------------------------------------------------------------------

/**
 * The compact signal set the Director decides from — the session assembles this from folded
 * SurfaceState. Pure inputs so `decideDirective` is a total function (no I/O, no models).
 */
export interface DirectorSignals {
  readonly conceptRef: string | null;
  readonly conceptTitle: string;
  /** True when the current concept's mastery is recorded (timeline node mastered). */
  readonly mastered: boolean;
  /** Latest depth-gate outcome for this concept, if any. */
  readonly lastGatePassed: boolean | null;
  /** An open prerequisite descent targets this concept (confusion being remediated). */
  readonly inDescent: boolean;
  /** A research frontier has surfaced for this concept (verified mastery opened it). */
  readonly frontierSurfaced: boolean;
  /** The learner's latest inferred/declared affect, if any. */
  readonly affect: AffectState | null;
  /** How many frames have been composed so far this ask (0 = the opening frame). */
  readonly framesComposed: number;
  /** Whether this frame is a practice frame (title starts with "practice"). */
  readonly isPractice: boolean;
  /** Whether this frame is an assessment frame (title starts with "assessment"). */
  readonly isAssessment: boolean;
  /**
   * The source anchor this frame is taught FROM, when a source is bound (R2b, ADR-0057 D2) — the
   * pedagogically-meaningful region the Director points the learner's attention at. Null in
   * goal-mode (no source), preserving pre-R2 behavior exactly.
   */
  readonly sourceAnchorRef?: string | null;
}

const PACING: Record<DirectorState, DirectivePacing> = {
  orienting: { tempo: "measured", dwell_hint_ms: 2600, silence: false },
  learning: { tempo: "measured", dwell_hint_ms: 3200, silence: false },
  practicing: { tempo: "measured", dwell_hint_ms: 3600, silence: false },
  struggling: { tempo: "slow", dwell_hint_ms: 4200, silence: false },
  consolidating: { tempo: "slow", dwell_hint_ms: 3000, silence: true },
  assessing: { tempo: "measured", dwell_hint_ms: 3400, silence: false },
  mastering: { tempo: "brisk", dwell_hint_ms: 2400, silence: false },
};

const INTENSITY: Record<DirectorState, DirectiveIntensity> = {
  orienting: "gentle",
  learning: "normal",
  practicing: "normal",
  struggling: "gentle",
  consolidating: "gentle",
  assessing: "demanding",
  mastering: "demanding",
};

/**
 * The authored pedagogy FSM: choose the target cognitive state from the current signals, with a
 * learner-readable rationale and the alternative it rejected. Deterministic — the same signals
 * always yield the same directive (replay-safe; CSE-011 §5).
 *
 * Priority order encodes the pedagogy (desirable difficulty over frictionless flow, CSE-011 §2):
 *  struggle/confusion first (slow down, support) → assessment → practice → frontier/mastery →
 *  the opening orientation beat → steady learning.
 */
export function decideDirective(
  signals: DirectorSignals,
  ids: { directiveId: string; hlc: string },
): Omit<DirectiveRecord, "entered_state"> {
  // R2b (ADR-0057 D2): the Director points at the source region it is teaching FROM (CSE-011 §4).
  const focus = {
    concept_ref: signals.conceptRef,
    source_anchor_ref: signals.sourceAnchorRef ?? null,
  };
  const base = {
    directive_id: ids.directiveId,
    scale: "concept" as DirectiveScale,
    focus,
    evidence_refs: [] as string[],
    hlc: ids.hlc,
  };
  const build = (
    target_state: DirectorState,
    rationale: string,
    considered: DirectiveRecord["considered"],
    confidence: number,
  ): Omit<DirectiveRecord, "entered_state"> => ({
    ...base,
    target_state,
    pacing: PACING[target_state],
    intensity: INTENSITY[target_state],
    rationale,
    considered,
    confidence,
  });

  // 1. Confusion is being remediated, or affect reads frustrated/overloaded → slow down, support.
  if (signals.inDescent || signals.affect === "frustrated" || signals.affect === "overloaded") {
    return build(
      "struggling",
      `Slowing down and supporting — ${signals.inDescent ? "a prerequisite gap opened" : "you seem to be pushing against friction"} on ${signals.conceptTitle}.`,
      [
        {
          alternative_state: "practicing",
          rejected_because: "pushing forward now would compound the confusion",
        },
      ],
      0.8,
    );
  }
  // 2. An assessment frame → assessing (prove depth, F14).
  if (signals.isAssessment) {
    return build(
      "assessing",
      `Checking real depth on ${signals.conceptTitle} — mastery is earned from evidence, never assumed.`,
      [{ alternative_state: "mastering", rejected_because: "depth is not yet verified" }],
      0.75,
    );
  }
  // 3. A failed gate → back to practice (retrieval + desirable difficulty).
  if (signals.lastGatePassed === false) {
    return build(
      "practicing",
      `Back to worked practice on ${signals.conceptTitle} — a check came up short, so retrieval will strengthen it.`,
      [
        {
          alternative_state: "learning",
          rejected_because: "re-explaining without practice rarely fixes a shaky gate",
        },
      ],
      0.72,
    );
  }
  // 4. A practice frame → practicing.
  if (signals.isPractice) {
    return build(
      "practicing",
      `Time to work it through — practice on ${signals.conceptTitle} turns recognition into understanding.`,
      [
        {
          alternative_state: "learning",
          rejected_because: "you have seen the idea; doing it is the next step",
        },
      ],
      0.7,
    );
  }
  // 5. Mastered + a frontier opened → mastering (toward the frontier, RIL-gated upstream).
  if (signals.mastered && signals.frontierSurfaced) {
    return build(
      "mastering",
      `You have mastered ${signals.conceptTitle} — picking up the pace toward its open frontier.`,
      [
        {
          alternative_state: "consolidating",
          rejected_because: "the evidence supports moving forward, not resting",
        },
      ],
      0.8,
    );
  }
  // 6. Mastered, no frontier → consolidating (let it settle; silence is a first-class output).
  if (signals.mastered) {
    return build(
      "consolidating",
      `Letting ${signals.conceptTitle} settle — a quiet beat consolidates what you just mastered.`,
      [
        {
          alternative_state: "mastering",
          rejected_because: "no frontier is open yet; consolidation compounds better here",
        },
      ],
      0.68,
    );
  }
  // 7. The opening beat of a fresh concept → orienting.
  if (signals.framesComposed === 0) {
    return build(
      "orienting",
      `Getting oriented in ${signals.conceptTitle} before the details — the shape of the idea first.`,
      [
        {
          alternative_state: "learning",
          rejected_because: "diving into details before orientation raises cognitive load",
        },
      ],
      0.7,
    );
  }
  // 8. Default — steady concept-building.
  return build(
    "learning",
    `Building ${signals.conceptTitle} step by step.`,
    [
      {
        alternative_state: "practicing",
        rejected_because: "the concept is still being built; practice comes after",
      },
    ],
    0.65,
  );
}

/**
 * Behavioral affect inference (CSE-011 §3.3; T1 behavioral-only). A pure function of the same
 * folded signals — never a covert score, learner-visible + opt-out upstream. Returns null when
 * there is no evidence to infer from (honest absence, never a guessed emotion; CSE-011 §9).
 */
export function inferAffect(
  signals: Pick<DirectorSignals, "inDescent" | "lastGatePassed" | "mastered" | "framesComposed">,
): { affect_state: AffectState; signals: string[]; confidence: number } | null {
  if (signals.inDescent || signals.lastGatePassed === false) {
    return {
      affect_state: "frustrated",
      signals: [signals.inDescent ? "prerequisite-descent-open" : "depth-gate-failed"],
      confidence: 0.6,
    };
  }
  if (signals.mastered) {
    return { affect_state: "confident", signals: ["mastery-recorded"], confidence: 0.6 };
  }
  if (signals.framesComposed >= 3) {
    // Many frames deep with no mastery yet — a soft signal of engagement, low confidence.
    return { affect_state: "engaged", signals: ["sustained-attention"], confidence: 0.4 };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Defensive readers — plain-JSON payloads → typed records (deterministic, fold-grade)
// ---------------------------------------------------------------------------

type Raw = Record<string, unknown>;
const str = (v: unknown, fallback = ""): string => (typeof v === "string" ? v : fallback);
const num = (v: unknown, fallback = 0): number => (typeof v === "number" ? v : fallback);
const strOrNull = (v: unknown): string | null => (typeof v === "string" ? v : null);
const bool = (v: unknown): boolean => v === true;

export function readDirective(payload: Raw, hlc: string): DirectiveRecord {
  const pacingRaw = (payload["pacing"] ?? {}) as Raw;
  const focusRaw = (payload["focus"] ?? {}) as Raw;
  const consideredRaw = Array.isArray(payload["considered"])
    ? (payload["considered"] as unknown[])
    : [];
  return {
    directive_id: str(payload["directive_id"]),
    scale: str(payload["scale"], "concept") as DirectiveScale,
    target_state: str(payload["target_state"], "learning") as DirectorState,
    pacing: {
      tempo: str(pacingRaw["tempo"], "measured") as DirectiveTempo,
      dwell_hint_ms: num(pacingRaw["dwell_hint_ms"]),
      silence: bool(pacingRaw["silence"]),
    },
    intensity: str(payload["intensity"], "normal") as DirectiveIntensity,
    focus: {
      concept_ref: strOrNull(focusRaw["concept_ref"]),
      source_anchor_ref: strOrNull(focusRaw["source_anchor_ref"]),
    },
    rationale: str(payload["rationale"]),
    considered: consideredRaw.map((c) => {
      const cr = (c ?? {}) as Raw;
      return {
        alternative_state: str(cr["alternative_state"], "learning") as DirectorState,
        rejected_because: str(cr["rejected_because"]),
      };
    }),
    evidence_refs: Array.isArray(payload["evidence_refs"])
      ? (payload["evidence_refs"] as unknown[]).map((r) => str(r))
      : [],
    confidence: num(payload["confidence"]),
    entered_state: null,
    hlc,
  };
}

export function readAffectSignal(payload: Raw, hlc: string): AffectSignalRecord {
  return {
    affect_state: str(payload["affect_state"], "engaged") as AffectState,
    source: str(payload["source"], "behavioral-inference") as AffectSource,
    signals: Array.isArray(payload["signals"])
      ? (payload["signals"] as unknown[]).map((s) => str(s))
      : [],
    confidence: num(payload["confidence"]),
    hlc,
  };
}

export function readAttentionBudget(payload: Raw, hlc: string): AttentionBudgetRecord {
  return {
    remaining: str(payload["remaining"], "high") as AttentionRemaining,
    session_minutes: num(payload["session_minutes"]),
    hlc,
  };
}

export function readSceneActor(raw: Raw): SceneActor {
  return {
    actor_id: str(raw["actor_id"]),
    kind: str(raw["kind"], "text-anchor") as ActorKind,
    content_ref: str(raw["content_ref"]),
    role: str(raw["role"], "support") as ActorRole,
    provenance_class: str(raw["provenance_class"], "inference") as SceneProvenanceClass,
    can_evolve: raw["can_evolve"] !== false,
  };
}

export function readSceneLighting(raw: Raw | undefined): SceneLighting {
  const r = raw ?? {};
  return {
    focus_actor_ref: strOrNull(r["focus_actor_ref"]),
    cdl_state: str(r["cdl_state"], "learning") as DirectorState,
    recession: Array.isArray(r["recession"])
      ? (r["recession"] as unknown[]).map((x) => str(x))
      : [],
  };
}

export function readSceneOpened(payload: Raw, hlc: string): SceneRecord {
  const actorsRaw = Array.isArray(payload["actors"]) ? (payload["actors"] as unknown[]) : [];
  return {
    scene_id: str(payload["scene_id"]),
    frame_ref: str(payload["frame_ref"]),
    concept_ref: strOrNull(payload["concept_ref"]),
    state: str(payload["state"], "learning") as DirectorState,
    directive_ref: strOrNull(payload["directive_ref"]),
    actors: actorsRaw.map((a) => readSceneActor((a ?? {}) as Raw)),
    lighting: readSceneLighting(payload["lighting"] as Raw | undefined),
    evolution_log: [],
    shots: [],
    closed: false,
    hlc,
  };
}

export function readSceneDelta(payload: Raw, hlc: string): SceneDeltaRecord {
  return {
    delta_id: str(payload["delta_id"]),
    op: str(payload["op"], "reveal") as SceneDeltaOp,
    cause: str(payload["cause"], "director") as SceneDeltaCause,
    payload: (payload["payload"] ?? {}) as Record<string, unknown>,
    interaction_ref: strOrNull(payload["interaction_ref"]),
    hlc,
  };
}
