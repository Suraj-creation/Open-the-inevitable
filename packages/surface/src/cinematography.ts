/**
 * Knowledge Cinematography — the shot grammar of understanding (CSE M8 T2; CSE-013, ADR-0039).
 *
 * A first-class vocabulary of pedagogical camera moves over a Scene. The Cinematographer is a
 * COMPOSER ROLE (CSE-013 §8): `planShots` is a pure function of the Scene's actors, the Director's
 * directive, and the recorded narration segments — deterministic, replay-safe. Selection is
 * pedagogy (which shot, why, when); rendering is design (the CDL owns how it eases). This module
 * never sets pixels, durations-as-clocks, or easing curves (ADR-0007 / CSE-013 §2).
 *
 * Accessibility law (CSE-013 §6): EVERY shot kind carries a discrete, non-animated
 * `reduced_motion` realization. `REDUCED_MOTION_REALIZATION` is the exhaustive table; a conformance
 * test asserts every kind has one. Motion is an enhancement over the discrete form, never a barrier.
 *
 * Browser-safe: pure functions + defensive readers, no runtime imports.
 */

// ---------------------------------------------------------------------------
// Shot vocabulary
// ---------------------------------------------------------------------------

export const SHOT_KINDS = [
  "establish",
  "semantic-zoom-in",
  "semantic-zoom-out",
  "pan",
  "spotlight",
  "reveal",
  "dissolve",
  "morph",
  "split",
  "merge",
  "macro-to-micro",
  "orientation",
  "rack-focus",
  "hold",
] as const;
export type ShotKind = (typeof SHOT_KINDS)[number];

export type ShotCause = "director" | "scene" | "cinematography" | "learner";

/** One pedagogical camera move over a Scene (CSE-013 §3). Recorded; realized client-side. */
export interface SceneShot {
  readonly shot_id: string;
  readonly scene_ref: string;
  readonly kind: ShotKind;
  /** The actor this shot acts on (spotlight/rack-focus/dissolve), or null (establish/hold). */
  readonly subject: string | null;
  /** Why the view moves here, now — the pedagogical reason (CSE-013 §5, ADR-0033 L4). */
  readonly intent: string;
  /** The narration segment this shot binds to, so the move fires as the sentence is spoken. */
  readonly narration_anchor_ref: string | null;
  /** The mandatory discrete realization (CSE-013 §6) — what a reduced-motion client shows. */
  readonly reduced_motion: string;
  readonly cause: ShotCause;
  readonly hlc: string;
}

/**
 * The reduced-motion realization for every shot kind (CSE-013 §6). Discrete, non-animated — the
 * baseline a `prefers-reduced-motion` client renders; motion is layered over it. Exhaustive over
 * `ShotKind` (the conformance test enforces coverage).
 */
export const REDUCED_MOTION_REALIZATION: Record<ShotKind, string> = {
  establish: "show the whole scene at once, no zoom",
  "semantic-zoom-in": "jump to the detailed level with a level label",
  "semantic-zoom-out": "jump to the overview level with a level label",
  pan: "jump to the target region with an orientation note",
  spotlight: "instant highlight of the subject; siblings dimmed",
  reveal: "the element appears in place, no animation",
  dissolve: "before/after shown together with a 'replaced by' caption",
  morph: "before and after states side by side with a caption",
  split: "the two subjects shown side by side at once",
  merge: "the fused view shown directly with a 'combines' note",
  "macro-to-micro": "phenomenon and mechanism shown as two stills with a link note",
  orientation: "a 'you are here' label on the overview",
  "rack-focus": "instant focus swap; the prior subject dims",
  hold: "stillness — nothing moves",
};

// ---------------------------------------------------------------------------
// The composer-role planner (CSE-013 §4; deterministic)
// ---------------------------------------------------------------------------

/** An actor the shots can act on (subset of the Scene's actor, CSE-012 §3.2). */
export interface ShotActor {
  readonly actor_id: string;
  readonly role: string;
  readonly content_ref: string;
}

/** A recorded narration segment a spotlight can bind to (the segment + the element it discusses). */
export interface ShotSegment {
  readonly segment_id: string;
  /** The MCCR element id the segment spotlights (matches an actor's content_ref), or null. */
  readonly element_id: string | null;
}

export interface PlanShotsInput {
  readonly sceneId: string;
  readonly actors: readonly ShotActor[];
  readonly directive: {
    readonly target_state: string;
    readonly intensity: string;
    readonly silence: boolean;
  };
  readonly segments: readonly ShotSegment[];
  /** Id stream (the session generator) — seeded ⇒ byte-identical shot lists on replay. */
  readonly hex: (bytes: number) => string;
}

/**
 * Plan a Scene's shot list from its actors + directive + narration (CSE-013 §4). The grammar:
 *  1. an `establish` shot opens every Scene — orient before detail (CSE-013 §3);
 *  2. a `hold` follows when the directive is `demanding` or `silence` — deliberate stillness so the
 *     learner thinks (ADR-0033 L6), *instead of* per-segment spotlights;
 *  3. otherwise a `spotlight` per narration segment that names an on-stage actor — the camera
 *     follows the voice, bound via `narration_anchor_ref` (CSE-013 §4).
 * Deterministic: same actors + directive + segments + id stream ⇒ byte-identical shots.
 */
export function planShots(input: PlanShotsInput): SceneShot[] {
  const protagonist = input.actors.find((a) => a.role === "protagonist") ?? input.actors[0] ?? null;
  const shots: SceneShot[] = [];
  const shot = (
    kind: ShotKind,
    subject: string | null,
    intent: string,
    narrationRef: string | null,
    cause: ShotCause = "cinematography",
  ): SceneShot => ({
    shot_id: `sht-${input.hex(8)}`,
    scene_ref: input.sceneId,
    kind,
    subject,
    intent,
    narration_anchor_ref: narrationRef,
    reduced_motion: REDUCED_MOTION_REALIZATION[kind],
    cause,
    hlc: "",
  });

  // 1. Establish — orient before detail.
  shots.push(
    shot(
      "establish",
      protagonist?.actor_id ?? null,
      "orient the learner in the whole scene before the parts",
      null,
      "scene",
    ),
  );

  // 2. A demanding or silent directive favors stillness over camera motion (ADR-0033 L6).
  if (input.directive.intensity === "demanding" || input.directive.silence) {
    shots.push(
      shot(
        "hold",
        protagonist?.actor_id ?? null,
        input.directive.silence
          ? "a quiet beat — let the learner consolidate"
          : "hold still under demanding work — do not distract the effort",
        null,
        "director",
      ),
    );
    return shots;
  }

  // 3. A spotlight per narration segment that names an on-stage actor (the camera follows the voice).
  const actorByContent = new Map(input.actors.map((a) => [a.content_ref, a]));
  for (const segment of input.segments) {
    if (!segment.element_id) continue;
    const actor = actorByContent.get(segment.element_id);
    if (!actor) continue;
    shots.push(
      shot(
        "spotlight",
        actor.actor_id,
        `direct attention to ${actor.content_ref} as the narration discusses it`,
        segment.segment_id,
      ),
    );
  }
  return shots;
}

// ---------------------------------------------------------------------------
// Defensive reader
// ---------------------------------------------------------------------------

type Raw = Record<string, unknown>;
const str = (v: unknown, fallback = ""): string => (typeof v === "string" ? v : fallback);
const strOrNull = (v: unknown): string | null => (typeof v === "string" ? v : null);

export function readShot(payload: Raw, hlc: string): SceneShot {
  const kind = str(payload["kind"], "establish") as ShotKind;
  return {
    shot_id: str(payload["shot_id"]),
    scene_ref: str(payload["scene_ref"]),
    kind: SHOT_KINDS.includes(kind) ? kind : "establish",
    subject: strOrNull(payload["subject"]),
    intent: str(payload["intent"]),
    narration_anchor_ref: strOrNull(payload["narration_anchor_ref"]),
    reduced_motion: str(
      payload["reduced_motion"],
      REDUCED_MOTION_REALIZATION[SHOT_KINDS.includes(kind) ? kind : "establish"],
    ),
    cause: str(payload["cause"], "cinematography") as ShotCause,
    hlc,
  };
}
