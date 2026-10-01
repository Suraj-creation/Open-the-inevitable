/**
 * SurfaceComposerUnit — the Surface Composer agent (UCS, ADR-0030).
 *
 * Distills teaching content into THREE coherent artifacts in one reasoning pass:
 *  1. the Minimal Complete Cognitive Representation (MCCR) — distilled visual anchors shown on the
 *     board (core concept, definition, key formula, diagram, relationship, mental model, table,
 *     key example, memory cue);
 *  2. a SEPARATE paced narration script — the spoken teaching (intuition, analogy, story), whose
 *     segments target MCCR anchors via `anchor_ref`;
 *  3. an image decision — whether an illustration helps, and the prompt to generate it.
 *
 * The board becomes visual memory; the voice becomes the teacher. One model call keeps the shown
 * and the spoken coherent (no divergence). Implements the same `CognitiveUnit` ABI as
 * `ModelBackedUnit`, so the governance gate, scheduler admission, OTel span, and D3 recording all
 * apply unchanged. Model-backed with a deterministic world-state fallback so offline/seeded runs
 * still yield a real, deterministic frame.
 *
 * Spec: spec/surface/cognitive-surface-runtime.md §4.7–§4.8; ADR-0030; model-invocation-protocol.
 */
import type {
  ModelGenerationRequest,
  ModelGenerationResult,
  ModelRuntime,
} from "@inevitable/contracts";
import type {
  AgentManifest,
  CognitionPacket,
  ContextLease,
  ReasoningTrace,
  UnitDescriptor,
  UnitLifecycleState,
} from "@inevitable/protocols";
import { SCHEMA_IDS } from "@inevitable/protocols";
import type {
  CognitiveHealth,
  CognitionFrame,
  CognitiveUnit,
  Emissions,
} from "@inevitable/runtime";
import { CosError, CryptoIdGenerator, newPacketId, type IdGenerator } from "@inevitable/shared";
import { extractCompletedMccrElements, type FrameElementSink } from "./mccr-stream";

const SPEC_REF = "protocols/model-invocation-protocol";

/** Attempts allowed for one composition: the first, plus one repair/retry pass. */
const COMPOSE_ATTEMPTS = 2;

/** Compose failures worth another attempt (malformed/truncated envelope, or a transient provider fault). */
const RETRYABLE_COMPOSE_CODES: ReadonlySet<string> = new Set([
  "E_MODEL_OUTPUT_MALFORMED",
  "E_MODEL_OUTPUT_TRUNCATED",
  "E_MODEL_QUOTA_EXHAUSTED",
  "E_MODEL_UNAVAILABLE",
  "E_MODEL_TIMEOUT",
]);

function isRetryableComposeFailure(cause: unknown): boolean {
  if (!(cause instanceof CosError)) return true; // an untyped fault is assumed transient once
  if (cause.details?.["retryable"] === false) return false;
  return RETRYABLE_COMPOSE_CODES.has(cause.code);
}

/**
 * When true, a failed composition THROWS instead of degrading.
 *
 * The reason this exists: a degraded board is structurally similar enough to a taught one that a
 * green test suite could not tell them apart, so a total cognition outage shipped as a lesson. In
 * development and test the failure must be loud; in production the learner gets the honest degraded
 * state instead of a crash. `COS_ALLOW_DEGRADED_COMPOSITION=1` opts a local run back into the
 * production behaviour (needed by the tests that assert the degraded path itself).
 */
function composerStrictMode(): boolean {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
    ?.env;
  if (!env) return false;
  if (env["COS_ALLOW_DEGRADED_COMPOSITION"] === "1") return false;
  return env["NODE_ENV"] === "test" || env["VITEST"] === "true" || env["COS_STRICT_MODEL"] === "1";
}

/**
 * Repair a JSON envelope the model did not close cleanly.
 *
 * Structured-output calls fail in two mundane ways: the response is wrapped in prose/fences, or it is
 * cut off at the token budget mid-object. Both leave a valid PREFIX. Slicing to the first `{` and
 * closing the still-open strings/brackets recovers a parseable object — which usually retains every
 * completed anchor. Recovering here is strictly better than spending a second model call, and far
 * better than throwing away a nearly-complete composition.
 */
export function repairJsonEnvelope(text: string): string | null {
  const from = text.indexOf("{");
  if (from < 0) return null;
  const body = text.slice(from);

  // Walk once to learn where the envelope actually stands: whether a string is still open, which
  // brackets remain unclosed, and whether a complete object already ended (trailing prose case).
  let inString = false;
  let escaped = false;
  const open: string[] = [];
  let firstComplete = -1;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i]!;
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      if (inString) escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === "{" || ch === "[") open.push(ch === "{" ? "}" : "]");
    else if (ch === "}" || ch === "]") {
      if (open[open.length - 1] !== ch) return null;
      open.pop();
      if (open.length === 0 && firstComplete < 0) firstComplete = i;
    }
  }

  // Already-complete object with prose/fences around it: return exactly that object.
  if (firstComplete >= 0) return parseable(body.slice(0, firstComplete + 1));
  if (open.length === 0) return null;

  // Truncated. Close any open string, then try progressively more aggressive trims of the incomplete
  // trailing member. Each candidate is VALIDATED by parsing, so the function never returns a guess:
  // a truncation can end mid-value, on a key with no value, or on a bare key with no colon yet, and
  // predicting which by pattern alone is exactly the kind of near-miss that discards a good board.
  const closed = inString ? `${body}"` : body;
  const suffix = open.slice().reverse().join("");
  const candidates = [
    closed,
    closed.replace(/,\s*$/, ""),
    closed.replace(/,?\s*"[^"]*"\s*:\s*$/, ""),
    closed.replace(/,?\s*"[^"]*"\s*$/, ""),
    closed.replace(/,?\s*"[^"]*"\s*:\s*"[^"]*"\s*$/, ""),
  ];
  for (const candidate of candidates) {
    const trimmed = candidate.replace(/[,:]\s*$/, "");
    const result = parseable(trimmed + suffix);
    if (result !== null) return result;
  }
  return null;
}

/** Return the text when it parses as JSON, else null (the repair validates rather than guesses). */
function parseable(text: string): string | null {
  try {
    JSON.parse(text);
    return text;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Output contract (plain shapes — the surface package folds these into a CognitiveFrame)
// ---------------------------------------------------------------------------

/** The canonical reveal order of MCCR slots (deterministic). */
const SLOT_ORDER = [
  "core_concept",
  "definition",
  "key_formula",
  "diagram",
  "relationship",
  "mental_model",
  "table",
  "key_example",
  "process",
  "code",
  "misconception",
  "memory_cue",
] as const;

type ComposerSlot = (typeof SLOT_ORDER)[number];

/** An MCCR element in the shape the surface fold (`readMccr`) expects. */
export interface ComposerElement {
  readonly element_id: string;
  readonly type: ComposerSlot;
  readonly slot: string;
  readonly reveal_order: number;
  readonly concept_id: string | null;
  readonly content: Record<string, unknown>;
}

export interface ComposerNarrationSegment {
  readonly text: string;
  readonly anchor_ref: ComposerSlot | null;
  readonly intent: "introduce" | "build" | "illustrate" | "connect" | "check" | "reinforce";
  readonly pause_after: boolean;
}

export interface ComposerImagePlan {
  readonly helps: boolean;
  readonly modality: "image" | "none";
  readonly prompt: string | null;
  readonly rationale: string;
}

export interface ComposerOutput {
  /** Keyed by slot name; only the slots the composer chose to fill are present (others null). */
  readonly mccr: Partial<Record<ComposerSlot, ComposerElement>>;
  readonly narration_script: { readonly segments: readonly ComposerNarrationSegment[] };
  readonly image_plan: ComposerImagePlan;
}

export interface SurfaceComposerUnitDeps {
  readonly manifest: AgentManifest;
  readonly model: ModelRuntime;
  readonly timeoutMs?: number;
  readonly idGenerator?: IdGenerator;
  /** Live depth bias (P5.2): >0 favors deeper/formal anchors, <0 favors intuition. */
  readonly getDepthBias?: () => number;
}

const TEXT_SLOTS: ReadonlySet<string> = new Set([
  "core_concept",
  "definition",
  "mental_model",
  "key_example",
  "memory_cue",
]);

const VALID_INTENTS: ReadonlySet<string> = new Set([
  "introduce",
  "build",
  "illustrate",
  "connect",
  "check",
  "reinforce",
]);

const OUTPUT_CONTRACT_SCHEMA: Record<string, unknown> = {
  type: "object",
  required: ["mccr", "narration_script"],
  properties: {
    mccr: {
      type: "object",
      properties: {
        core_concept: { type: "string" },
        definition: { type: "string" },
        mental_model: { type: "string" },
        key_example: { type: "string" },
        misconception: {
          type: "object",
          properties: {
            wrong: { type: "string" },
            correction: { type: "string" },
          },
        },
        memory_cue: { type: "string" },
        key_formula: {
          type: "object",
          properties: {
            latex: { type: "string" },
            plain: { type: "string" },
            lines: { type: "array", items: { type: "string" } },
            line_labels: { type: "array", items: { type: "string" } },
          },
        },
        process: {
          type: "object",
          properties: {
            steps: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  text: { type: "string" },
                  detail: { type: "string" },
                },
              },
            },
          },
        },
        code: {
          type: "object",
          properties: {
            language: { type: "string" },
            lines: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  text: { type: "string" },
                  note: { type: "string" },
                },
              },
            },
          },
        },
        relationship: {
          type: "object",
          properties: {
            from: { type: "string" },
            to: { type: "string" },
            relation: { type: "string" },
            text: { type: "string" },
          },
        },
        diagram: {
          type: "object",
          properties: {
            kind: { type: "string" },
            // Non-empty item properties: Gemini structured output rejects OBJECT array items with
            // empty `properties` (400 INVALID_ARGUMENT), which would 400 every composer call.
            nodes: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  label: { type: "string" },
                  group: { type: "string" },
                },
              },
            },
            edges: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  from: { type: "string" },
                  to: { type: "string" },
                  relation: { type: "string" },
                },
              },
            },
          },
        },
        table: {
          type: "object",
          properties: {
            headers: { type: "array", items: { type: "string" } },
            rows: { type: "array", items: { type: "array", items: { type: "string" } } },
          },
        },
      },
    },
    narration_script: {
      type: "object",
      required: ["segments"],
      properties: {
        segments: {
          type: "array",
          items: {
            type: "object",
            required: ["text"],
            properties: {
              text: { type: "string" },
              anchor_ref: { type: "string" },
              intent: { type: "string" },
              pause_after: { type: "boolean" },
            },
          },
        },
      },
    },
    image_plan: {
      type: "object",
      properties: {
        helps: { type: "boolean" },
        prompt: { type: "string" },
        rationale: { type: "string" },
      },
    },
  },
};

function composerError(code: string, message: string, details?: Record<string, unknown>): CosError {
  return new CosError(code, message, { specRef: SPEC_REF, details });
}

function conceptIdOf(packet: CognitionPacket): string {
  const content = (packet.content ?? {}) as Record<string, unknown>;
  if (typeof content["concept_id"] === "string" && content["concept_id"].trim()) {
    return content["concept_id"];
  }
  return packet.concept_ids?.[0] ?? "concept";
}

function conceptTitleOf(packet: CognitionPacket): string {
  const content = (packet.content ?? {}) as Record<string, unknown>;
  for (const key of ["concept_title", "title", "goal"]) {
    const v = content[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return packet.intent ?? "the concept";
}

function goalOf(packet: CognitionPacket): string {
  const content = (packet.content ?? {}) as Record<string, unknown>;
  if (typeof content["goal"] === "string" && content["goal"].trim()) return content["goal"];
  return packet.intent ?? conceptTitleOf(packet);
}

/** One anchored source passage the frame is taught FROM (R2a, ADR-0057 D1). */
interface SourceExcerpt {
  readonly anchor_ref: string;
  readonly quote: string;
  readonly path: string;
}

/** Read the source excerpts threaded into the packet (empty ⇒ goal-mode; nothing changes). */
function sourceExcerptsOf(packet: CognitionPacket): SourceExcerpt[] {
  const raw = ((packet.content ?? {}) as Record<string, unknown>)["source_excerpts"];
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((e): e is Record<string, unknown> => !!e && typeof e === "object")
    .map((e) => ({
      anchor_ref: typeof e["anchor_ref"] === "string" ? e["anchor_ref"] : "",
      quote: typeof e["quote"] === "string" ? e["quote"] : "",
      path: typeof e["path"] === "string" ? e["path"] : "",
    }))
    .filter((e) => e.quote.trim().length > 0);
}

/** Format the excerpts as a numbered, path-labeled block for the prompt. */
function sourceBlock(excerpts: readonly SourceExcerpt[]): string {
  return excerpts.map((e, i) => `[${i + 1}] ${e.path || "passage"}: "${e.quote}"`).join("\n");
}

/** The fused cross-source synthesis threaded in for FUSION MODE (R5, ADR-0060). */
interface FusedSynthesisInput {
  readonly prose: string;
  readonly acknowledges_disagreement: boolean;
  readonly treatments: readonly { readonly title: string; readonly emphasis: string }[];
}

/** Read the fused synthesis threaded into the packet (null ⇒ not multi-source; nothing changes). */
function fusedSynthesisOf(packet: CognitionPacket): FusedSynthesisInput | null {
  const raw = ((packet.content ?? {}) as Record<string, unknown>)["fused_synthesis"];
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const prose = typeof r["prose"] === "string" ? r["prose"].trim() : "";
  if (!prose) return null;
  const treatmentsRaw = Array.isArray(r["treatments"]) ? (r["treatments"] as unknown[]) : [];
  return {
    prose,
    acknowledges_disagreement: r["acknowledges_disagreement"] === true,
    treatments: treatmentsRaw
      .map((t) => {
        const to = (t ?? {}) as Record<string, unknown>;
        return {
          title: typeof to["title"] === "string" ? to["title"] : "",
          emphasis: typeof to["emphasis"] === "string" ? to["emphasis"] : "",
        };
      })
      .filter((t) => t.title.length > 0),
  };
}

function buildElement(
  slot: ComposerSlot,
  content: Record<string, unknown>,
  conceptId: string,
): ComposerElement {
  return {
    element_id: `el-${slot}`,
    type: slot,
    slot,
    reveal_order: SLOT_ORDER.indexOf(slot),
    concept_id: conceptId,
    content,
  };
}

/**
 * The HONEST degraded composition: what the board holds when cognition could not be produced.
 *
 * This function used to fabricate teaching — a `definition` reading "<title> — a foundational concept
 * on the path to <goal>" and a narration line "Let's build an understanding of <title>." Neither was
 * grounded in anything; they were sentences shaped like teaching, standing in for cognition that had
 * failed. That is precisely what CLAUDE.md §3 forbids ("No fake cognition": generated language is not
 * by itself evidence of cognition). It also hid the failure from the learner, who saw a lesson rather
 * than an outage.
 *
 * So the degraded frame now asserts only what is TRUE: the concept's own title (a fact about the path,
 * not a claim about the subject) and, in provenance, why cognition is missing and whether retrying can
 * recover it. It authors NO teaching prose and NO narration voice — an empty script is honest silence,
 * where an invented sentence was a lie. The surface renders this as a degraded state with a retry
 * affordance (never as a lesson), and the existing `surface.cognition.degraded` health event still fires.
 */
export function degradedComposition(packet: CognitionPacket): ComposerOutput {
  const conceptId = conceptIdOf(packet);
  const title = conceptTitleOf(packet);
  return {
    mccr: {
      core_concept: buildElement("core_concept", { kind: "text", text: title }, conceptId),
    },
    narration_script: { segments: [] },
    image_plan: {
      helps: false,
      modality: "none",
      prompt: null,
      rationale: "degraded composition does not plan generated media",
    },
  };
}

/**
 * Parse + validate the composer output contract. Throws E_MODEL_OUTPUT_MALFORMED on bad shape.
 * When `fallbackTitle` is provided and the model produced real anchors but omitted `core_concept`,
 * a minimal core_concept is synthesized from the title rather than discarding the whole rich
 * response (partial salvage — a good frame missing only its heading should not degrade to fallback).
 */
export function parseComposerOutput(
  text: string,
  conceptId: string,
  fallbackTitle?: string,
): ComposerOutput {
  const trimmed = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  let raw: unknown;
  try {
    raw = JSON.parse(trimmed);
  } catch {
    // Repair before conceding: a fenced//prose-wrapped or budget-truncated envelope leaves a valid
    // prefix whose completed anchors are perfectly usable (see `repairJsonEnvelope`).
    const repaired = repairJsonEnvelope(trimmed);
    if (repaired === null) {
      throw composerError("E_MODEL_OUTPUT_MALFORMED", "composer output is not valid JSON", {
        sample: trimmed.slice(0, 200),
      });
    }
    try {
      raw = JSON.parse(repaired);
    } catch {
      throw composerError(
        "E_MODEL_OUTPUT_MALFORMED",
        "composer output is not valid JSON even after repair",
        { sample: trimmed.slice(0, 200) },
      );
    }
  }
  const obj = raw as { mccr?: unknown; narration_script?: unknown; image_plan?: unknown };
  const mccrRaw = (obj.mccr ?? {}) as Record<string, unknown>;
  const mccr: Partial<Record<ComposerSlot, ComposerElement>> = {};

  for (const slot of SLOT_ORDER) {
    const value = mccrRaw[slot];
    if (value === undefined || value === null) continue;
    const content = elementContentFrom(slot, value);
    if (content) mccr[slot] = buildElement(slot, content, conceptId);
  }
  // The board must be non-empty: require at least a core concept. If the model produced other real
  // anchors but omitted core_concept, salvage the frame by synthesizing one from the concept title
  // (only when a title is available) rather than discarding a rich composition.
  if (!mccr.core_concept) {
    const hasOtherAnchors = Object.keys(mccr).length > 0;
    if (fallbackTitle && fallbackTitle.trim() && hasOtherAnchors) {
      mccr.core_concept = buildElement(
        "core_concept",
        { kind: "text", text: fallbackTitle.trim() },
        conceptId,
      );
    } else {
      throw composerError(
        "E_MODEL_OUTPUT_MALFORMED",
        "composer output is missing a core_concept anchor",
      );
    }
  }

  const scriptRaw = (obj.narration_script ?? {}) as { segments?: unknown };
  const segmentsRaw = Array.isArray(scriptRaw.segments) ? scriptRaw.segments : [];
  const segments: ComposerNarrationSegment[] = [];
  for (const entry of segmentsRaw) {
    const s = (entry ?? {}) as Record<string, unknown>;
    const segText = typeof s["text"] === "string" ? s["text"].trim() : "";
    if (!segText) continue;
    const anchorRaw = typeof s["anchor_ref"] === "string" ? s["anchor_ref"].trim() : "";
    // A dangling anchor_ref (points at a slot the composer left empty) is nulled out (ADR-0030 risk #6).
    const anchor_ref =
      anchorRaw &&
      (SLOT_ORDER as readonly string[]).includes(anchorRaw) &&
      mccr[anchorRaw as ComposerSlot]
        ? (anchorRaw as ComposerSlot)
        : null;
    const intentRaw = typeof s["intent"] === "string" ? s["intent"].trim() : "";
    const intent = (
      VALID_INTENTS.has(intentRaw) ? intentRaw : "build"
    ) as ComposerNarrationSegment["intent"];
    segments.push({
      text: segText,
      anchor_ref,
      intent,
      pause_after: typeof s["pause_after"] === "boolean" ? s["pause_after"] : false,
    });
  }
  if (segments.length === 0) {
    // A frame with no spoken teaching is invalid — the voice is the teacher.
    throw composerError("E_MODEL_OUTPUT_MALFORMED", "composer output produced no narration script");
  }

  const imgRaw = (obj.image_plan ?? {}) as Record<string, unknown>;
  const helps = typeof imgRaw["helps"] === "boolean" ? imgRaw["helps"] : false;
  const prompt =
    helps && typeof imgRaw["prompt"] === "string" && imgRaw["prompt"].trim()
      ? imgRaw["prompt"].trim()
      : null;
  const image_plan: ComposerImagePlan = {
    helps: helps && prompt !== null,
    modality: helps && prompt !== null ? "image" : "none",
    prompt,
    rationale: typeof imgRaw["rationale"] === "string" ? imgRaw["rationale"] : "",
  };

  return { mccr, narration_script: { segments }, image_plan };
}

/** Coerce a raw slot value into the MCCR element content discriminated union. */
function elementContentFrom(slot: ComposerSlot, value: unknown): Record<string, unknown> | null {
  if (TEXT_SLOTS.has(slot)) {
    const txt = typeof value === "string" ? value.trim() : "";
    return txt ? { kind: "text", text: txt } : null;
  }
  const v = (value ?? {}) as Record<string, unknown>;
  if (slot === "key_formula") {
    const latex = typeof v["latex"] === "string" ? v["latex"] : "";
    const plain = typeof v["plain"] === "string" ? v["plain"] : "";
    const lines = Array.isArray(v["lines"])
      ? (v["lines"] as unknown[])
          .filter((l): l is string => typeof l === "string")
          .map((l) => l.trim())
          .filter((l) => l.length > 0)
      : [];
    // R4c (ADR-0058): optional per-line transformation labels for the derivation grammar.
    const lineLabels = Array.isArray(v["line_labels"])
      ? (v["line_labels"] as unknown[]).map((l) => (typeof l === "string" ? l.trim() : ""))
      : undefined;
    return latex || plain || lines.length > 0
      ? {
          kind: "formula",
          latex: latex || lines[0] || "",
          plain: plain || latex,
          lines,
          ...(lineLabels ? { line_labels: lineLabels } : {}),
        }
      : null;
  }
  if (slot === "misconception") {
    // R4e (ADR-0058; CSE-013 dissolve grammar). Structured object → the dissolve (wrong→correction).
    // A bare string (legacy prompt / degraded output) stays plain text so nothing is lost.
    if (typeof value === "string") {
      const txt = value.trim();
      return txt ? { kind: "text", text: txt } : null;
    }
    const wrong = typeof v["wrong"] === "string" ? v["wrong"].trim() : "";
    const correction = typeof v["correction"] === "string" ? v["correction"].trim() : "";
    if (wrong && correction) return { kind: "misconception", wrong, correction };
    // Only one side given: there is no dissolve to show, but the surviving text still teaches.
    const txt = correction || wrong;
    return txt ? { kind: "text", text: txt } : null;
  }
  if (slot === "process") {
    // R4e (ADR-0058; CSE-018 §6 process/algorithm grammar): an ordered procedure. Each step is an
    // object {text, detail?}; a bare string is accepted as the step text (robustness).
    const stepsRaw = Array.isArray(v["steps"]) ? (v["steps"] as unknown[]) : [];
    const steps = stepsRaw
      .map((s) => {
        const so = (s ?? {}) as Record<string, unknown>;
        const text =
          typeof so["text"] === "string"
            ? so["text"].trim()
            : typeof s === "string"
              ? s.trim()
              : "";
        const detail = typeof so["detail"] === "string" ? so["detail"].trim() : "";
        return { text, detail: detail || null };
      })
      .filter((s) => s.text.length > 0);
    return steps.length > 0 ? { kind: "process", steps } : null;
  }
  if (slot === "code") {
    // R4e (ADR-0058; CSE-018 §6 code grammar): source lines the learner reads. Each line is
    // {text, note?}; a bare string is the line text. Blank lines are kept (code spacing matters),
    // but the element only exists if at least one line carries actual code.
    const language = typeof v["language"] === "string" ? v["language"].trim() : "";
    const linesRaw = Array.isArray(v["lines"]) ? (v["lines"] as unknown[]) : [];
    const lines = linesRaw
      .map((l) => {
        if (typeof l === "string") return { text: l, note: null as string | null };
        const lo = (l ?? {}) as Record<string, unknown>;
        const text = typeof lo["text"] === "string" ? lo["text"] : "";
        const note = typeof lo["note"] === "string" ? lo["note"].trim() : "";
        return { text, note: note || null };
      })
      .filter((l) => typeof l.text === "string");
    return lines.some((l) => l.text.trim().length > 0)
      ? { kind: "code", language: language || "text", lines }
      : null;
  }
  if (slot === "relationship") {
    const from = typeof v["from"] === "string" ? v["from"] : "";
    const to = typeof v["to"] === "string" ? v["to"] : "";
    if (!from || !to) return null;
    return {
      kind: "relationship",
      from,
      to,
      relation: typeof v["relation"] === "string" ? v["relation"] : "",
      text: typeof v["text"] === "string" ? v["text"] : "",
    };
  }
  if (slot === "diagram") {
    const kind = typeof v["kind"] === "string" ? v["kind"] : "none";
    const nodes = Array.isArray(v["nodes"]) ? v["nodes"] : [];
    const edges = Array.isArray(v["edges"]) ? v["edges"] : [];
    if (nodes.length === 0) return null;
    return { kind: "diagram", diagram: { kind, nodes, edges } };
  }
  if (slot === "table") {
    const headers = Array.isArray(v["headers"]) ? v["headers"] : [];
    const rows = Array.isArray(v["rows"]) ? v["rows"] : [];
    if (headers.length === 0 && rows.length === 0) return null;
    return { kind: "table", headers, rows };
  }
  return null;
}

function descriptorFromManifest(manifest: AgentManifest): UnitDescriptor {
  const memory = manifest.memory_access;
  return {
    unit_id: manifest.id,
    unit_type: manifest.id,
    version: manifest.version,
    abi_version: manifest.abi_version,
    capabilities: manifest.capabilities,
    input_schemas: [SCHEMA_IDS.cognitionPacket],
    output_schemas: [SCHEMA_IDS.cognitionPacket],
    policy_needs: manifest.policies,
    memory_scope_needs: [...(memory.read ?? []), ...(memory.write ?? [])],
    observability_contract: manifest.observability.required_events ?? [],
    resource_budget: manifest.resources,
    evolution_policy: "frozen",
  };
}

export class SurfaceComposerUnit implements CognitiveUnit {
  private readonly manifest: AgentManifest;
  private readonly model: ModelRuntime;
  private readonly timeoutMs: number;
  private readonly idGenerator: IdGenerator;
  private readonly getDepthBias: () => number;
  private preparedLeaseId: string | null = null;
  /**
   * Transient live-streaming sink (ADR-0063 Phase B), set per-dispatch by the runtime dispatcher's
   * `dispatchStreaming` around `host.handle` and cleared after. When present AND the model supports
   * `generateStream`, `execute` streams the composition and reports each MCCR string anchor as it
   * completes. Absent (the default, and always in deterministic/replay mode) ⇒ the whole-response
   * path runs, unchanged — so streaming never affects settled state or existing tests.
   */
  private streamSink: FrameElementSink | null = null;

  constructor(deps: SurfaceComposerUnitDeps) {
    this.manifest = deps.manifest;
    this.model = deps.model;
    this.timeoutMs = deps.timeoutMs ?? 60_000;
    this.idGenerator = deps.idGenerator ?? new CryptoIdGenerator();
    this.getDepthBias = deps.getDepthBias ?? (() => 0);
  }

  describe(): UnitDescriptor {
    return descriptorFromManifest(this.manifest);
  }

  prepare(lease: ContextLease): void {
    this.preparedLeaseId = lease.lease_id;
  }

  /** Attach (or clear) the live board-streaming sink for the NEXT execute (ADR-0063 Phase B). */
  setStreamSink(sink: FrameElementSink | null): void {
    this.streamSink = sink;
  }

  async execute(packet: CognitionPacket): Promise<Emissions> {
    // Repair-then-retry before conceding. A composition is expensive and its two commonest failures
    // are both recoverable: a malformed/truncated JSON envelope (recovered by repairing the text, or
    // by one retry with the thinking phase trimmed so the response budget survives) and a transient
    // provider fault such as a quota window (recovered by simply asking again). Conceding on the
    // first fault is what made a recoverable hiccup look like a taught lesson.
    let firstCause: unknown;
    for (let attempt = 0; attempt < COMPOSE_ATTEMPTS; attempt++) {
      try {
        return await this.executeWithModel(packet, attempt);
      } catch (cause) {
        if (attempt === 0) firstCause = cause;
        if (attempt === COMPOSE_ATTEMPTS - 1) break;
        if (!isRetryableComposeFailure(cause)) break;
      }
    }

    const cause = firstCause;
    const code = cause instanceof CosError ? cause.code : "E_MODEL_UNAVAILABLE";
    // A degradation must never pass unnoticed in development or test: the whole reason this class of
    // bug shipped is that a green suite could not distinguish a taught frame from a degraded one.
    if (composerStrictMode()) {
      throw cause instanceof Error
        ? cause
        : composerError(code, "composition failed and strict mode forbids degrading");
    }
    const composition = degradedComposition(packet);
    const detail = cause instanceof CosError ? cause.details : undefined;
    const retryAfterMs =
      typeof detail?.["retryAfterMs"] === "number" ? detail["retryAfterMs"] : null;
    const response = this.buildResponsePacket(packet, composition, {
      kind: "degraded-composition",
      model: "degraded",
      confidence: 0,
      fallbackReason: code,
      degraded: {
        cause_code: code,
        retryable: detail?.["retryable"] === true,
        retry_after_ms: retryAfterMs,
        message: cause instanceof Error ? cause.message.slice(0, 300) : String(cause).slice(0, 300),
      },
    });
    return { packets: [response], trace: this.buildTrace(packet, composition, "degraded") };
  }

  private async executeWithModel(packet: CognitionPacket, attempt = 0): Promise<Emissions> {
    const base = this.buildRequest(packet);
    // On a retry, spend the whole budget on the response: an uncapped thinking phase eating the
    // output budget is the documented root cause of truncated composer JSON.
    const request: ModelGenerationRequest = attempt === 0 ? base : { ...base, thinkingBudget: 0 };
    // ADR-0063 Phase B: when a live sink is attached AND the model can stream, distill the board from
    // the token stream and report each MCCR string anchor the moment it completes. Otherwise the
    // whole-response path runs (the default + deterministic/replay). Either way the assembled `result`
    // is authoritative — parsed identically below — so settled state is stream-independent.
    const sink = this.streamSink;
    const result =
      sink && typeof this.model.generateStream === "function"
        ? await this.withTimeout(this.streamAndAssemble(request, sink))
        : await this.withTimeout(this.model.generate(request));
    if (result.finishReason === "refusal" || result.finishReason === "safety") {
      throw composerError("E_MODEL_REFUSAL", `model refused generation (${result.finishReason})`, {
        invocation_key: request.invocation_key,
      });
    }
    if (result.finishReason === "max_tokens") {
      // Truncation must be named truthfully — a cut-off composition degrading as "malformed output"
      // hides the real cause (budget) from the health slice (review §7.1).
      throw composerError(
        "E_MODEL_OUTPUT_TRUNCATED",
        "composition cut off at token budget; JSON is incomplete",
        { invocation_key: request.invocation_key, text_length: result.text.length },
      );
    }
    const composition = parseComposerOutput(
      result.text,
      conceptIdOf(packet),
      conceptTitleOf(packet),
    );
    const response = this.buildResponsePacket(packet, composition, {
      kind: "model-composition",
      model: result.model,
      confidence: 0.83,
    });
    return { packets: [response], trace: this.buildTrace(packet, composition, result.model) };
  }

  /**
   * Stream the composition (ADR-0063 Phase B): accumulate the token deltas, and each time a new MCCR
   * string anchor's value fully arrives, report it through the sink (→ `surface.frame.element.delta`).
   * Returns the whole assembled result (terminal chunk) — authoritative, parsed identically to the
   * non-streamed path. A mid-stream failure degrades to a single whole `generate()` (no more deltas);
   * the already-reported anchors are transient previews that `surface.frame.composed` then clears.
   */
  private async streamAndAssemble(
    request: ModelGenerationRequest,
    sink: FrameElementSink,
  ): Promise<ModelGenerationResult> {
    const stream = this.model.generateStream;
    if (!stream) return this.model.generate(request);
    let accumulated = "";
    const reported = new Set<string>();
    let final: ModelGenerationResult | undefined;
    try {
      for await (const chunk of stream.call(this.model, request)) {
        if (chunk.textDelta) {
          accumulated += chunk.textDelta;
          for (const element of extractCompletedMccrElements(accumulated)) {
            if (!reported.has(element.name)) {
              reported.add(element.name);
              await sink.onElementComplete(element.name, element.text);
            }
          }
        }
        if (chunk.result) final = chunk.result;
      }
    } catch {
      // Stream broke mid-flight — fall back to a whole generation (deterministic path also retries).
      return this.model.generate(request);
    }
    return final ?? this.model.generate(request);
  }

  private buildRequest(packet: CognitionPacket): ModelGenerationRequest {
    const title = conceptTitleOf(packet);
    const goal = goalOf(packet);
    const excerpts = sourceExcerptsOf(packet);
    const fusion = fusedSynthesisOf(packet);
    const bias = this.getDepthBias();
    const depthGuidance =
      bias > 0.15
        ? "Favor formal precision: include the key formula and a structured diagram or table."
        : bias < -0.15
          ? "Favor intuition: keep anchors spare; prefer a mental model and a vivid example."
          : "Balance intuition and precision.";
    const system = [
      `You are "${this.manifest.id}". ${this.manifest.role}`,
      "The BOARD must hold the Minimal COMPLETE Cognitive Representation (MCCR): the distilled",
      "visual anchors a learner should keep in view — what a world-class educator would leave on the",
      "whiteboard after teaching this. The VOICE (narration script) carries the actual teaching —",
      "intuition, analogy, story, reasoning. NEVER put teaching prose on the board, and NEVER merely",
      "restate the board in the narration. They are complementary: the board is memory, the voice is",
      "the teacher. When the voice stops, the board alone must let the learner reconstruct the idea.",
      "Respond with JSON only (no markdown fences) matching:",
      '{"mccr":{"core_concept":"short noun phrase","definition":"1-2 precise sentences that fully state the concept","key_formula":{"latex":"...","plain":"spoken form","lines":["optional multi-line derivation, one LaTeX line each, top to bottom"],"line_labels":["optional transformation label per line: substitute, factor, simplify, by induction, …"]},"diagram":{"kind":"node-graph|flow|axes|tree|cycle","nodes":[{"id":"n1","label":"..."}],"edges":[{"from":"n1","to":"n2","relation":"..."}]},"relationship":{"from":"A","to":"B","relation":"...","text":"..."},"mental_model":"a vivid analogy in a phrase","table":{"headers":["..."],"rows":[["..."]]},"key_example":"one tight WORKED instance with its answer, not just a name","process":{"steps":[{"text":"an ordered step of a procedure or algorithm","detail":"optional clarifying sub-line"}]},"code":{"language":"python","lines":[{"text":"a source line, indentation preserved","note":"optional annotation for a salient line"}]},"misconception":{"wrong":"the single most common false belief, stated exactly as the learner would think it","correction":"what is actually true, which the wrong belief resolves into"},"memory_cue":"a mnemonic"},"narration_script":{"segments":[{"text":"spoken teaching sentence","anchor_ref":"core_concept|definition|key_formula|diagram|relationship|mental_model|table|key_example|process|code|misconception|memory_cue","intent":"introduce|build|illustrate|connect|check|reinforce","pause_after":false}]},"image_plan":{"helps":true,"prompt":"a concrete illustration prompt","rationale":"why it helps"}}',
      "DENSITY LAW: core_concept and definition are REQUIRED. Beyond them, fill EVERY slot that",
      "genuinely carries cognition for this concept — a well-taught frame typically lands 5–7 anchors.",
      "A near-empty board wastes the learner's visual memory; a padded board buries it. Never invent",
      "filler to hit a count, and never drop a formula, worked example, misconception, or diagram the",
      "concept truly has. Total anchors ≤ 8 so one frame fits one screen without scrolling.",
      "QUALITY LAW: definitions are complete sentences, not fragments. key_example is WORKED — inputs,",
      "steps compressed, result. If the concept has a derivation worth seeing, use key_formula.lines",
      "(up to ~10 lines) — and when a step's move isn't obvious, give the matching key_formula.line_labels",
      "entry (the transformation: substitute, factor, simplify, by induction), so the derivation reads",
      "as constructed reasoning, not just stacked equations. diagram nodes/edges must encode real structure (causality, flow, hierarchy),",
      "never decoration. misconception is a DISSOLVE object: wrong = the false belief in the learner's",
      "own voice, correction = the truth it resolves into — so the surface can show wrong receding into",
      "right, not two facts side by side. Give both halves or omit the slot.",
      "process is for a PROCEDURE or ALGORITHM the learner must be able to follow: ordered steps, each",
      "one concrete action (optionally a short detail). Use it when the concept is a how-to or a",
      "sequence of moves — not for a list of facts (that is not a process). The board reveals the steps",
      "one at a time as you speak them.",
      "code is for real SOURCE the learner reads: lines with indentation preserved, and a note only on",
      "the lines that carry the lesson (not every line). Use it when the concept IS code — a function,",
      "a snippet, a data structure — never to paraphrase prose as pseudo-code.",
      "Each narration segment's anchor_ref must name a slot you filled (or be omitted for a",
      "whole-frame remark). 4–7 narration segments; each teaches something the board cannot say alone.",
      "image_plan.helps is true only when a generated illustration genuinely aids understanding",
      "(then give a concrete prompt).",
      // R2a (ADR-0057 D1): when teaching FROM a source, ground the board + voice in the passage.
      ...(excerpts.length > 0
        ? [
            "SOURCE MODE: you are teaching FROM the document passage(s) below. The narration must quote",
            "or closely paraphrase the passage and name its figures/equations; the MCCR distills what",
            "the passage says. Never assert anything the passage does not support — if it lacks a",
            "formula/example, do not invent one. The passage itself is added to the board automatically.",
          ]
        : []),
      // R5 (ADR-0060): teaching a concept reconciled across SEVERAL sources — weave, don't flatten.
      ...(fusion
        ? [
            "FUSION MODE: this concept is covered by SEVERAL sources, reconciled into the synthesis",
            "below. Teach that woven understanding — cite each source by name where it contributes,",
            "compose their complementary emphases into ONE coherent frame, and where sources DISAGREE",
            "surface it honestly (as a misconception or a relationship anchor), never flatten it. The",
            "fused synthesis is your ground truth; add nothing outside it.",
          ]
        : []),
      depthGuidance,
    ].join("\n");
    const sourceSuffix =
      excerpts.length > 0
        ? `\n\nSOURCE PASSAGES (teach from these):\n${sourceBlock(excerpts)}`
        : "";
    const fusionSuffix = fusion
      ? `\n\nFUSED SYNTHESIS (teach this reconciled understanding):\n${fusion.prose}\n\nContributing sources: ${fusion.treatments
          .map((t) => `${t.title} (${t.emphasis})`)
          .join("; ")}${
          fusion.acknowledges_disagreement
            ? "\n(These sources DISAGREE somewhere — surface it, do not smooth it.)"
            : ""
        }`
      : "";
    return {
      prompt: `Concept to teach: ${title}\nLearner goal: ${goal}${sourceSuffix}${fusionSuffix}`,
      system,
      // The combined MCCR + narration + image_plan payload is large; give it ample room and bound
      // the reasoning-model thinking phase so JSON is never truncated (the composer-flakiness root cause).
      maxTokens: 8192,
      thinkingBudget: 2048,
      responseSchema: OUTPUT_CONTRACT_SCHEMA,
      invocation_key: `${this.manifest.id}:${packet.packet_id}:compose`,
    };
  }

  private buildResponsePacket(
    packet: CognitionPacket,
    composition: ComposerOutput,
    meta: {
      kind: string;
      model: string;
      confidence: number;
      fallbackReason?: string;
      /** Present only on the degraded path: the truthful reason cognition is missing. */
      degraded?: {
        cause_code: string;
        retryable: boolean;
        retry_after_ms: number | null;
        message: string;
      };
    },
  ): CognitionPacket {
    return {
      packet_id: newPacketId(this.idGenerator),
      schema_version: packet.schema_version,
      source_cid: packet.target_cid ?? this.manifest.id,
      target_cid: packet.source_cid,
      tenant_id: packet.tenant_id ?? null,
      session_id: packet.session_id ?? null,
      causation_id: packet.packet_id,
      correlation_id: packet.correlation_id ?? packet.packet_id,
      timestamp: packet.timestamp,
      hlc: packet.hlc,
      sequence_number: (packet.sequence_number ?? 0) + 1,
      packet_type: "response",
      intent: packet.intent ?? null,
      concept_ids: packet.concept_ids ?? [],
      domain_ids: packet.domain_ids ?? [],
      content: {
        handled_by: this.manifest.id,
        response_kind: meta.kind,
        mccr: composition.mccr,
        narration_script: composition.narration_script,
        image_plan: composition.image_plan,
        model: meta.model,
        ...(meta.fallbackReason ? { fallback_reason: meta.fallbackReason } : {}),
        ...(meta.degraded ? { degraded: meta.degraded } : {}),
        prepared_lease_id: this.preparedLeaseId,
      },
      evidence: [
        { kind: "surface-composition", source_packet_id: packet.packet_id, model: meta.model },
      ],
      confidence: meta.confidence,
      uncertainty_estimate: 1 - meta.confidence,
      reasoning_depth: (packet.reasoning_depth ?? 0) + 1,
      classification: packet.classification ?? "internal",
      policy_tags: packet.policy_tags ?? [],
      requires_human_review: false,
      priority: packet.priority,
      expiry: packet.expiry ?? null,
      trace_id: packet.trace_id,
      span_id: packet.span_id,
    };
  }

  private buildTrace(
    packet: CognitionPacket,
    composition: ComposerOutput,
    model: string,
  ): ReasoningTrace {
    const anchorCount = Object.keys(composition.mccr).length;
    const segmentCount = composition.narration_script.segments.length;
    return {
      trace_id: packet.trace_id ?? "",
      producer_cid: this.manifest.id,
      session_id: packet.session_id ?? null,
      task_interpretation: `compose a Cognitive Frame for "${conceptTitleOf(packet)}"`,
      strategy: "distill-board-anchors + author-separate-narration",
      claims: [
        {
          claim_id: `${packet.packet_id}-claim-0`,
          statement: `${anchorCount} MCCR anchors, ${segmentCount} narration segments, image ${composition.image_plan.helps ? "planned" : "not planned"}`,
          confidence: model === "deterministic" ? 0.5 : 0.83,
        },
      ],
      decision: `composed an MCCR + narration split via ${model}`,
      uncertainty_estimate: model === "deterministic" ? 0.5 : 0.17,
      self_critique:
        model === "deterministic"
          ? "deterministic fallback — minimal board, no media; degradation is visible"
          : null,
      determinism_level: model === "deterministic" ? "D2" : "D3",
    };
  }

  private async withTimeout(work: Promise<ModelGenerationResult>): Promise<ModelGenerationResult> {
    const timers = globalThis as {
      setTimeout?: (fn: () => void, ms: number) => unknown;
      clearTimeout?: (handle: unknown) => void;
    };
    if (!timers.setTimeout) return work;
    let handle: unknown;
    const timeout = new Promise<never>((_, reject) => {
      handle = timers.setTimeout!(() => {
        reject(composerError("E_MODEL_TIMEOUT", `model call exceeded ${this.timeoutMs}ms`));
      }, this.timeoutMs);
    });
    try {
      return await Promise.race([work, timeout]);
    } finally {
      timers.clearTimeout?.(handle);
    }
  }

  reflect(): string | null {
    return null;
  }

  checkpoint(): CognitionFrame {
    return {
      unitId: this.manifest.id,
      state: "Ready" as UnitLifecycleState,
      data: { preparedLeaseId: this.preparedLeaseId },
    };
  }

  restore(frame: CognitionFrame): void {
    this.preparedLeaseId =
      typeof frame.data["preparedLeaseId"] === "string" ? frame.data["preparedLeaseId"] : null;
  }

  shutdown(): void {
    this.preparedLeaseId = null;
  }

  health(): CognitiveHealth {
    return { runtime: "ok", drift: 0, confidence: 1, loadFactor: 0 };
  }
}
