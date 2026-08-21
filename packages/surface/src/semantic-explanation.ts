/**
 * Structured Semantic Explanation — the explanation block rendered as typed, role-tagged semantic
 * objects instead of an unstructured prose blob (the first Student-Mode surface slice).
 *
 * It reuses the ONE role authority — `EpistemicRole` (CSE-018 / representation.ts) — and the ONE
 * design authority — the Cognitive Design Language (the CDL renders each role token-driven via
 * `data-epistemic-role`, exactly as MCCR board elements already are). It introduces NO new colours
 * and NO parallel design system: it maps the existing F04 seven-layer explanation model onto the
 * existing epistemic roles, so the explanation joins the structured, token-styled surface the board
 * already enjoys. Deterministic and pure — the structuring is a fold over the layers, not cognition.
 */
import type { EpistemicRole } from "./representation";

/**
 * The version of the explanation-layer → epistemic-role mapping. Stamped onto every structured
 * explanation block so a learner's artifacts stay reproducible if the mapping is later revised
 * (a governed change, never silent — CDL versioning discipline).
 */
export const EXPLANATION_ROLE_VOCAB_VERSION = "cdl.epistemic-role.v1";

/**
 * A typed, role-tagged unit of explanation content — the semantic surface object the renderer styles
 * token-driven by role (`data-epistemic-role`). It is durable on the block (provenance-carried,
 * replayable), never a render-time-only derivation.
 */
export interface SemanticSection {
  /** The originating layer key (e.g. "layer_0") — stable identity for React keys and provenance. */
  readonly key: string;
  /** The KIND of knowledge, from the canonical `EpistemicRole` vocabulary (representation.ts). */
  readonly role: EpistemicRole;
  /** The human-facing role label (the section is legible without relying on colour — accessibility). */
  readonly title: string;
  readonly text: string;
  /** Canonical reveal order (0-based). */
  readonly order: number;
}

/**
 * The F04 seven-layer explanation model → its epistemic role, using ONLY existing roles. Layers with
 * no distinct hue in the CDL (structural, reasoning, observation) still carry their role for legibility
 * and future treatment; layers with a committed hue (insight, definition, example, evidence) signal it.
 */
const LAYER_ROLE: Readonly<
  Record<string, { readonly role: EpistemicRole; readonly title: string }>
> = {
  layer_0: { role: "insight", title: "Intuition & story" },
  layer_1: { role: "structural", title: "Visual model" },
  layer_2: { role: "definition", title: "Definition" },
  layer_3: { role: "reasoning", title: "Formal framework" },
  layer_4: { role: "example", title: "Worked example" },
  layer_5: { role: "observation", title: "Extensions" },
  layer_6: { role: "evidence", title: "Frontier" },
};

/** Canonical layer order (the reveal sequence intuition → frontier). */
const LAYER_ORDER: readonly string[] = [
  "layer_0",
  "layer_1",
  "layer_2",
  "layer_3",
  "layer_4",
  "layer_5",
  "layer_6",
];

/** Map one explanation layer key to its epistemic role (total — unknown keys → "observation"). */
export function explanationSectionRole(layerKey: string): EpistemicRole {
  return LAYER_ROLE[layerKey]?.role ?? "observation";
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Structure a layered explanation into typed, role-tagged semantic sections (deterministic, pure).
 * Canonical layers render first in reveal order; any extra keys (forward-compatibility) follow in
 * sorted order as `observation`. Empty / non-string layers are skipped.
 */
export function structureExplanation(
  layers: Record<string, unknown> | undefined,
): SemanticSection[] {
  if (!layers) return [];
  const sections: SemanticSection[] = [];
  let order = 0;
  for (const key of LAYER_ORDER) {
    const value = layers[key];
    if (!isNonEmptyString(value)) continue;
    const meta = LAYER_ROLE[key];
    if (!meta) continue;
    sections.push({ key, role: meta.role, title: meta.title, text: value, order });
    order += 1;
  }
  for (const key of Object.keys(layers).sort()) {
    if (key in LAYER_ROLE) continue;
    const value = layers[key];
    if (!isNonEmptyString(value)) continue;
    sections.push({ key, role: "observation", title: key, text: value, order });
    order += 1;
  }
  return sections;
}

/** The canonical EpistemicRole set as a runtime guard for coercion (representation.ts is the type). */
const EPISTEMIC_ROLES: ReadonlySet<string> = new Set<EpistemicRole>([
  "canonical",
  "definition",
  "reasoning",
  "example",
  "warning",
  "misconception",
  "insight",
  "memory-cue",
  "observation",
  "evidence",
  "structural",
]);

/** Aliases a producing faculty may use → the canonical EpistemicRole (the integration boundary). */
const ROLE_ALIASES: Readonly<Record<string, EpistemicRole>> = {
  intuition: "insight",
  analogy: "insight",
  story: "insight",
  derivation: "reasoning",
  math: "reasoning",
  mathematical: "reasoning",
  application: "example",
  applied: "example",
  code: "example",
  visual: "structural",
  diagram: "structural",
  summary: "observation",
  frontier: "evidence",
};

/** Coerce an arbitrary role string (from a model faculty) to a valid EpistemicRole. Unknown → observation. */
export function coerceEpistemicRole(role: string): EpistemicRole {
  const key = role.trim().toLowerCase();
  if (EPISTEMIC_ROLES.has(key)) return key as EpistemicRole;
  return ROLE_ALIASES[key] ?? "observation";
}

/**
 * Build durable, ordered SemanticSections from a faculty's role-tagged output — the integration
 * boundary between a Cognitive Harness faculty (spec 11, OutputSection) and the surface. Arbitrary
 * role strings are coerced to the canonical EpistemicRole; empty text is skipped.
 */
export function sectionsFromRoleTexts(
  items: readonly { readonly role: string; readonly title: string; readonly text: string }[],
): SemanticSection[] {
  const sections: SemanticSection[] = [];
  let order = 0;
  for (const item of items) {
    if (typeof item.text !== "string" || item.text.trim().length === 0) continue;
    sections.push({
      key: `section-${order}`,
      role: coerceEpistemicRole(item.role),
      title: item.title,
      text: item.text,
      order,
    });
    order += 1;
  }
  return sections;
}
