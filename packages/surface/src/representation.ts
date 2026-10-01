/**
 * Representation Intelligence (CSE-018, ADR-0058) — the RIA's `RepresentationPlan`.
 *
 * The RIA converts a composed frame into a plan over the CLOSED MCCR vocabulary: each element's
 * representational hierarchy (primary / supporting / residue) and its epistemic role (the KIND of
 * knowledge it is — canonical, definition, misconception, memory-cue, …), plus the exclusion list
 * (what was left out and why). The CDL renders the role; the RIA only assigns it (ADR-0058 D4).
 *
 * R4a ships the DETERMINISTIC planner: a pure function that reproduces today's element hierarchy +
 * a type→role mapping — byte-parity with the current render (a frame with no plan is identical), so
 * the RIA can never regress a frame (ADR-0058 D3). Model-backed planning (exclusion reasoning,
 * density verdict, adaptivity) layers over this floor in R4d.
 */

/**
 * The kind of knowledge an element carries (CSE-018 §4; the CDL renders each as a visual language).
 *
 * This is the ONE role authority for the whole system — MCCR board elements, explanation sections,
 * and any future producer all map into it (`ROLE_BY_TYPE` below, `coerceEpistemicRole` in
 * semantic-explanation.ts). New roles are added here or nowhere; a parallel vocabulary would break
 * "one concept, one authority" and split the visual language that makes the roles learnable.
 *
 * `orientation`, `transition`, and `question` complete the instructional arc that the seven-layer
 * explanation model (F04) and CSE-018 §4 already imply: where am I, where is this going, and what
 * am I being asked. CSE-018 §4 already lists `question`; `orientation` and `transition` were the
 * two kinds a lesson needs that had nowhere to live, so they were being rendered as ordinary prose.
 */
export type EpistemicRole =
  | "canonical"
  | "orientation"
  | "definition"
  | "reasoning"
  | "example"
  | "warning"
  | "misconception"
  | "insight"
  | "memory-cue"
  | "question"
  | "transition"
  | "observation"
  | "evidence"
  | "structural";

/** Every role, in canonical order — the exhaustive list the design layer must cover. */
export const EPISTEMIC_ROLE_ORDER: readonly EpistemicRole[] = [
  "canonical",
  "orientation",
  "definition",
  "reasoning",
  "example",
  "warning",
  "misconception",
  "insight",
  "memory-cue",
  "question",
  "transition",
  "observation",
  "evidence",
  "structural",
];

/** Where an element sits in the frame's representational hierarchy (CSE-018 §4, Law 1/3). */
export type RepresentationHierarchy = "primary" | "supporting" | "residue";

/** The learner's prior sophistication on this concept — drives expertise-reversal (CSE-018 Law 8). */
export type ExpertiseLevel = "novice" | "intermediate" | "expert";

/** How the plan was adapted to the learner (CSE-018 Law 8). Null on the un-adapted floor. */
export interface RepresentationAdaptivity {
  readonly expertise: ExpertiseLevel;
  readonly note: string;
}

export interface RepresentationElementPlan {
  readonly element_id: string;
  readonly hierarchy: RepresentationHierarchy;
  readonly epistemic_role: EpistemicRole;
}

/** Intelligent-density verdict (CSE-018 Law 3): the board's element load against a working-memory
 *  budget. `within_budget: false` is the signal to split the frame upstream, never to hide content. */
export interface RepresentationDensity {
  readonly count: number;
  readonly budget: number;
  readonly within_budget: boolean;
}

export interface RepresentationPlan {
  readonly frame_id: string;
  readonly composition: readonly RepresentationElementPlan[];
  /** Elements considered but left off the board, with why (Law 1/3). Empty on the deterministic floor. */
  readonly exclusions: readonly string[];
  /** The density verdict (Law 3) — measured deterministically; drives an upstream frame split. */
  readonly density: RepresentationDensity;
  /** `deterministic` = the parity floor; `model` = the RIA reasoned about it (R4d). */
  readonly plan_kind: "deterministic" | "model";
  /** How the plan adapted to the learner's expertise (Law 8) — null when un-adapted (parity floor). */
  readonly adaptivity: RepresentationAdaptivity | null;
  readonly hlc: string;
}

/** The working-memory density budget (CSE-018 Law 3; matches the MCCR ≤8-anchor density law). */
export const DENSITY_BUDGET = 8;

/** MCCR element type → its epistemic role (Law 5). Deterministic; the CDL renders the role. */
const ROLE_BY_TYPE: Record<string, EpistemicRole> = {
  core_concept: "canonical",
  definition: "definition",
  key_formula: "reasoning",
  diagram: "structural",
  relationship: "structural",
  mental_model: "insight",
  table: "observation",
  key_example: "example",
  // `process` is a procedure to follow and `code` is source to read: both are worked, followable
  // instances, so they carry `example` rather than falling through to the `observation` default.
  process: "example",
  code: "example",
  misconception: "misconception",
  memory_cue: "memory-cue",
  image: "observation",
  source_viewport: "evidence",
};

/** MCCR element type → its representational hierarchy. Unmapped types are `supporting` (the default). */
const HIERARCHY_BY_TYPE: Record<string, RepresentationHierarchy> = {
  core_concept: "primary",
  definition: "primary",
  memory_cue: "residue",
};

export function epistemicRoleFor(type: string): EpistemicRole {
  return ROLE_BY_TYPE[type] ?? "observation";
}

export function hierarchyFor(type: string): RepresentationHierarchy {
  return HIERARCHY_BY_TYPE[type] ?? "supporting";
}

/**
 * Roles that are pure SCAFFOLDING (CSE-018 Law 8): a worked example or a spelled-out analogy helps a
 * novice build the schema, but for an expert it is redundant — the classic expertise-reversal effect.
 * For an expert these recede from `supporting` to `residue` (folded first, never deleted).
 */
const SCAFFOLD_ROLES: ReadonlySet<EpistemicRole> = new Set(["example", "insight"]);

const ADAPTIVITY_NOTE: Record<ExpertiseLevel, string> = {
  novice: "Full scaffolding — worked examples and analogies kept prominent.",
  intermediate: "Balanced scaffolding for a developing learner.",
  expert: "Compressed — redundant scaffolding (examples, analogies) receded (expertise reversal).",
};

/**
 * Derive a coarse expertise estimate from the learner's in-session mastery (R5; the live signal for
 * Law 8). Prior mastery of related concepts is an honest proxy for domain sophistication — as the
 * learner masters more of the path with high confidence, the board compresses scaffolding. Returns
 * `null` when there is no mastery evidence yet: the learner is unknown, so the plan stays at the
 * un-adapted floor rather than guessing. A `getExpertise` session override supersedes this.
 */
export function expertiseFromMastery(
  nodes: readonly { readonly status: string; readonly confidence: number | null }[],
): ExpertiseLevel | null {
  const mastered = nodes.filter((n) => n.status === "mastered");
  if (mastered.length === 0) return null; // no evidence → un-adapted floor (honest absence)
  const avgConfidence = mastered.reduce((s, n) => s + (n.confidence ?? 0.7), 0) / mastered.length;
  const ratio = nodes.length > 0 ? mastered.length / nodes.length : 0;
  if (ratio >= 0.6 && avgConfidence >= 0.8) return "expert"; // broad, deep mastery of the path
  if (mastered.length <= 1 || avgConfidence < 0.65) return "novice";
  return "intermediate";
}

/**
 * The deterministic RepresentationPlan (R4a): a pure projection of the frame's elements onto the
 * hierarchy + role vocabulary. Parity with today's render (the plan is metadata over the same
 * elements in the same order); a frame with no plan is byte-identical to one with this plan.
 */
export function planRepresentation(input: {
  readonly frameId: string;
  readonly elements: readonly { readonly element_id: string; readonly type: string }[];
  /** Law 8 expertise-reversal. Absent ⇒ un-adapted floor (parity — no demotion, `adaptivity: null`). */
  readonly expertise?: ExpertiseLevel;
}): RepresentationPlan {
  const count = input.elements.length;
  const level = input.expertise;
  const composition = input.elements.map((e) => {
    const base = hierarchyFor(e.type);
    const role = epistemicRoleFor(e.type);
    // Expertise reversal (Law 8): only an EXPERT demotes scaffold supporting anchors to residue.
    // Novice/intermediate keep the floor hierarchy, so scaffolding stays available to those who need it.
    const hierarchy: RepresentationHierarchy =
      level === "expert" && base === "supporting" && SCAFFOLD_ROLES.has(role) ? "residue" : base;
    return { element_id: e.element_id, hierarchy, epistemic_role: role };
  });
  return {
    frame_id: input.frameId,
    composition,
    exclusions: [],
    density: { count, budget: DENSITY_BUDGET, within_budget: count <= DENSITY_BUDGET },
    plan_kind: "deterministic",
    adaptivity: level ? { expertise: level, note: ADAPTIVITY_NOTE[level] } : null,
    hlc: "",
  };
}
