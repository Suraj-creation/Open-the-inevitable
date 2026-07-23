/**
 * CDL v2 — the World configuration (spec/design/cognitive-design-language-v2.md §17).
 *
 * The single, typed source of truth for the continuous cognitive journey: the eight movements,
 * their scroll ranges, cognitive-state grade, substrate density, camera keyframes, and copy. Both
 * the WebGL layer (the living world + morph chain) and the DOM/glass layer (still-point text) read
 * from this so they stay one choreography driven by one clock (GSAP/scroll). Pure data — no React,
 * no three — so it is trivially testable and replay-stable.
 */

/** Cognitive-state hues (hex, for WebGL) — mirror the CDL token palette. */
export const HUES = {
  void: "#09080b",
  ink: "#f0f1f5",
  learning: "#57c9de",
  discovery: "#ffc46b",
  practice: "#63dfa1",
  assessment: "#a78bff",
  research: "#7fa8ff",
  reflection: "#d8b8ad",
  mastery: "#ffd98e",
  confusion: "#ff9d6b",
} as const;

export type MovementId = "M0" | "M1" | "M2" | "M3" | "M4" | "M5" | "M6" | "M7";

/** The living-substrate form a movement resolves the particles into (the morph targets). */
export type SubstrateForm =
  | "mote" // a single point of light
  | "cloud" // diffuse curiosity particles
  | "neuron" // a firing neural bloom
  | "graph" // the knowledge-graph constellation
  | "companion" // a quiet path + companion light
  | "ladder" // the ascent through warming strata
  | "civilization" // a global network of points
  | "settle"; // decelerating to a still constellation

export interface MovementCopy {
  readonly eyebrow?: string;
  /** The Canon headline (kinetic, materializes at the still point). */
  readonly canon: string;
  /** The Gloss paragraph (≤ ~40 words). */
  readonly gloss?: string;
  /** Optional ordered labels revealed across the movement (e.g. the ladder rungs). */
  readonly labels?: readonly string[];
  /** Optional sequential lines (the M7 paradigm reveal). */
  readonly lines?: readonly string[];
}

export interface Movement {
  readonly id: MovementId;
  readonly name: string;
  /**
   * The movement's ANCHOR — its still point, as a normalized journey position (0..1). The world
   * rests here (one legible idea); between consecutive anchors it morphs continuously to the next.
   * Anchor-based (not ranges) so the morph is seamless across boundaries: the `to`-form of one
   * segment is the `from`-form of the next, guaranteeing no cut.
   */
  readonly at: number;
  readonly form: SubstrateForm;
  /** The cognitive-state hue that grades this region. */
  readonly hue: string;
  /** Substrate density 0..1 (ambient rest → cognitive peak). */
  readonly density: number;
  /** World luminance 0..1 (the ignorance→contribution brightness tide). */
  readonly luminance: number;
  /** Camera dolly on z (larger = further back); the world sits near z=0. */
  readonly cameraZ: number;
  /** Camera vertical pan (the ascent cranes up in M5). */
  readonly cameraY: number;
  readonly copy: MovementCopy;
}

/**
 * The eight movements. Ranges are contiguous and cover [0,1]; the gaps between one movement's
 * `still` and the next are where the continuous morph transitions play (no hard cuts).
 */
export const MOVEMENTS: readonly Movement[] = [
  {
    id: "M0",
    name: "Ignition",
    at: 0.03,
    form: "mote",
    hue: HUES.learning,
    density: 0.3,
    luminance: 0.32,
    cameraZ: 14,
    cameraY: 0,
    copy: {
      eyebrow: "UNIVERSAL COGNITIVE INFRASTRUCTURE",
      lines: [
        "Civilization advanced by building infrastructure —",
        "transportation, energy, communication, computation.",
        "The next frontier is infrastructure for understanding.",
      ],
      canon: "Intelligence that grows minds.",
      gloss:
        "The Inevitable is a long-term effort to build it: an operating system for human understanding — carrying anyone from first curiosity to genuine mastery, and onward toward discovery.",
    },
  },
  {
    id: "M1",
    name: "Curiosity",
    at: 0.16,
    form: "cloud",
    hue: HUES.discovery,
    density: 0.45,
    luminance: 0.4,
    cameraZ: 12,
    cameraY: 0,
    copy: {
      canon: "Every mind starts with a question.",
      gloss:
        "Curiosity is the most powerful force in learning — and the most easily wasted. Understanding should begin there, not stop there.",
    },
  },
  {
    id: "M2",
    name: "Thought becomes structure",
    at: 0.3,
    form: "neuron",
    hue: HUES.learning,
    density: 0.62,
    luminance: 0.5,
    cameraZ: 10,
    cameraY: 0,
    copy: {
      canon: "Answers evaporate. Understanding compounds.",
      gloss:
        "Today's AI is a brilliant stranger who forgets you between sentences. The Inevitable is built the opposite way — every interaction leaves a trace, forms memory, and builds on the last.",
    },
  },
  {
    id: "M3",
    name: "Understanding made visible",
    at: 0.44,
    form: "graph",
    hue: HUES.learning,
    density: 0.8,
    luminance: 0.62,
    cameraZ: 9,
    cameraY: 0,
    copy: {
      canon: "Watch understanding unfold.",
      gloss:
        "Agents think in the open. Concepts take the stage. A path forms as you learn. Cognition — usually hidden inside a model — becomes a place you can see, question, and navigate.",
    },
  },
  {
    id: "M4",
    name: "The Companion",
    at: 0.57,
    form: "companion",
    hue: HUES.reflection,
    density: 0.5,
    luminance: 0.46,
    cameraZ: 8,
    cameraY: 0,
    copy: {
      canon: "It learns you, and stays with you.",
      gloss:
        "A lifelong cognitive companion — it remembers how you think, meets you where you are, and grows with you across every subject and every season of your life.",
    },
  },
  {
    id: "M5",
    name: "The ascent",
    at: 0.7,
    form: "ladder",
    hue: HUES.mastery,
    density: 0.72,
    luminance: 0.78,
    cameraZ: 10,
    cameraY: 6,
    copy: {
      canon: "From your first question to your first contribution.",
      labels: ["Understanding", "Mastery", "Innovation", "Contribution"],
      gloss:
        "Education is the first gateway, not the destination. The same infrastructure that builds understanding carries a mind onward — across the most-neglected gap in education, from knowing a field to advancing it.",
    },
  },
  {
    id: "M6",
    name: "Civilization",
    at: 0.84,
    form: "civilization",
    hue: HUES.mastery,
    density: 1.0,
    luminance: 0.7,
    cameraZ: 20,
    cameraY: 0,
    copy: {
      canon: "One cognitive layer for human understanding.",
      gloss:
        "Learners, educators, researchers, and institutions — each with persistent memory, collective intelligence, and pedagogy that improves itself through governed evolution. Not replacing human thought. Helping humanity think better.",
    },
  },
  {
    id: "M7",
    name: "The Inevitable",
    at: 0.97,
    form: "settle",
    hue: HUES.learning,
    density: 0.4,
    luminance: 0.4,
    cameraZ: 13,
    cameraY: 0,
    copy: {
      canon: "The Inevitable.",
      lines: [
        "Agriculture scaled food.",
        "Industry scaled production.",
        "Computing scaled calculation.",
        "The Internet scaled information.",
        "Universal Cognitive Infrastructure scales understanding.",
      ],
    },
  },
];

/** Total journey height as a multiple of the viewport (scroll length of the whole world). */
export const JOURNEY_VH = MOVEMENTS.length * 1.4;

/** Substrate particle budget by device tier (perf: capped, degrades gracefully). */
export const PARTICLE_BUDGET = { high: 4200, mid: 2000, low: 800 } as const;

/** Linear interpolation helper (shared by camera/luminance/density interpolation). */
export const lerp = (a: number, b: number, t: number): number =>
  a + (b - a) * Math.max(0, Math.min(1, t));

/** Smoothstep for eased interpolation between movements. */
export const smoothstep = (t: number): number => {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
};

/** Fraction of each anchor→anchor segment held STILL at the start (the legible rest before morph). */
export const HOLD = 0.34;

/** The movement whose anchor is the nearest at-or-before a normalized progress (the current still). */
export function movementAt(progress: number): Movement {
  const p = Math.max(0, Math.min(1, progress));
  let cur = MOVEMENTS[0]!;
  for (const m of MOVEMENTS) {
    if (m.at <= p + 1e-6) cur = m;
    else break;
  }
  return cur;
}

/**
 * Interpolated world state at a normalized journey progress — the eased blend between the current
 * movement (`from`, at its anchor) and the next (`to`), so hue/density/luminance/camera and the
 * substrate morph all transition continuously. Because `to`-form of one segment equals `from`-form
 * of the next, the world never cuts (CDL v2 §5).
 */
export interface WorldState {
  readonly progress: number;
  readonly from: Movement;
  readonly to: Movement;
  readonly fromIndex: number;
  readonly toIndex: number;
  /** Morph factor 0..1 from `from` to `to` (0 while at from's still, ramps after HOLD). */
  readonly blend: number;
  readonly density: number;
  readonly luminance: number;
  readonly cameraZ: number;
  readonly cameraY: number;
}

export function worldStateAt(progress: number): WorldState {
  const p = Math.max(0, Math.min(1, progress));
  // Find the segment [anchor i, anchor i+1] containing p.
  let i = 0;
  for (let k = 0; k < MOVEMENTS.length - 1; k++) {
    if (p >= MOVEMENTS[k]!.at) i = k;
  }
  if (p < MOVEMENTS[0]!.at) i = 0;
  const from = MOVEMENTS[i]!;
  const to = MOVEMENTS[Math.min(i + 1, MOVEMENTS.length - 1)]!;
  const span = Math.max(1e-6, to.at - from.at);
  const seg = Math.max(0, Math.min(1, (p - from.at) / span));
  // Still for the first HOLD of the segment, then ease the morph to completion by the next anchor.
  const blend = seg <= HOLD ? 0 : smoothstep((seg - HOLD) / (1 - HOLD));
  return {
    progress: p,
    from,
    to,
    fromIndex: i,
    toIndex: Math.min(i + 1, MOVEMENTS.length - 1),
    blend,
    density: lerp(from.density, to.density, blend),
    luminance: lerp(from.luminance, to.luminance, blend),
    cameraZ: lerp(from.cameraZ, to.cameraZ, blend),
    cameraY: lerp(from.cameraY, to.cameraY, blend),
  };
}

/**
 * Opacity (0..1) of a movement's still-point copy at a given progress — full at its anchor, fading
 * out as the world morphs away toward either neighbour. Drives the DOM/glass text layer so exactly
 * one idea is legible at each still, and copy is gone during transitions.
 */
export function stillOpacityAt(index: number, progress: number): number {
  const m = MOVEMENTS[index];
  if (!m) return 0;
  const prev = MOVEMENTS[index - 1];
  const next = MOVEMENTS[index + 1];
  const p = Math.max(0, Math.min(1, progress));
  const d = p - m.at;
  if (d >= 0) {
    // Past the anchor: the last movement stays lit through the end; others fade toward the next.
    if (!next) return 1;
    const span = next.at - m.at;
    const t = span > 0 ? d / span : 1;
    return 1 - smoothstep((t - HOLD * 0.6) / 0.5);
  }
  // Before the anchor: the first movement is lit at the top of the page; others fade in from prev.
  if (!prev) return 1;
  const span = m.at - prev.at;
  const t = span > 0 ? -d / span : 1;
  return 1 - smoothstep((t - HOLD * 0.6) / 0.5);
}
