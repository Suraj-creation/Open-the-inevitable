/**
 * The Cognitive Interaction Grammar — interaction as cognitive intent (CSE M8 T2; CSE-014,
 * ADR-0039). The fourth Theater organ: every act a learner performs is typed COGNITIVE INTENT
 * routed to the Director and the Scene — never UI manipulation. `interpretIntent` is a pure,
 * deterministic function (kind + target + note → cognitive_intent + class + routing); free-text
 * asks that need a model are D3-recorded, deferred to when free-text lands.
 *
 * Browser-safe: pure functions + a defensive reader, no runtime imports.
 */

// ---------------------------------------------------------------------------
// The grammar (7 classes, ~25 primitives — an extensible registry, CSE-014 §3)
// ---------------------------------------------------------------------------

export type InteractionClass =
  | "attend"
  | "mark"
  | "ask"
  | "reason"
  | "express"
  | "navigate"
  | "govern-flow";

/** Where a class's cognitive intent is routed (CSE-014 §4). */
export type InteractionRouting =
  | "affect" // passive attend signals → the affect/attention channel (CSE-011 §3.3)
  | "scene-annotate" // marks → a learner-caused scene delta (CSE-012 §3.3)
  | "enrichment-reframe" // asks → re-frame cognition (enrichment, CSE-007 §4)
  | "director" // navigate/govern-flow → Director re-plan / focus (CSE-011)
  | "claim-graph" // reason → Claim Graph / contradiction (CSE-006; deep routing M9)
  | "self-explanation"; // express → self-explanation / creation (CSE-009/016; deep routing later)

interface GrammarEntry {
  readonly cls: InteractionClass;
  readonly routing: InteractionRouting;
  /** Human-readable cognitive intent template; `{t}` is replaced by the target anchor. */
  readonly intent: string;
}

/** The interaction grammar registry (CSE-014 §3). The ADR-0024 seven are aliased into it. */
export const INTERACTION_GRAMMAR: Record<string, GrammarEntry> = {
  // Attend (passive) — fed to the affect/attention channel.
  hover: { cls: "attend", routing: "affect", intent: "attending to {t}" },
  long_hover: { cls: "attend", routing: "affect", intent: "lingering on {t}" },
  pause: { cls: "attend", routing: "affect", intent: "paused at {t}" },
  dwell: { cls: "attend", routing: "affect", intent: "dwelling on {t}" },
  // Mark — learner anchors/annotations; evolve the Scene in place.
  annotate: { cls: "mark", routing: "scene-annotate", intent: "annotate {t}" },
  circle: { cls: "mark", routing: "scene-annotate", intent: "single out {t} — this matters" },
  highlight: { cls: "mark", routing: "scene-annotate", intent: "highlight {t}" },
  pin: { cls: "mark", routing: "scene-annotate", intent: "pin {t} to keep it in view" },
  // Ask — enrichment proposal at the target; may evolve the Scene.
  ask_why: { cls: "ask", routing: "enrichment-reframe", intent: "justify {t} — why is this so?" },
  ask_again: { cls: "ask", routing: "enrichment-reframe", intent: "re-explain {t}" },
  ask_simpler: {
    cls: "ask",
    routing: "enrichment-reframe",
    intent: "reduce the abstraction of {t}",
  },
  ask_deeper: { cls: "ask", routing: "enrichment-reframe", intent: "go deeper on {t}" },
  ask_example: {
    cls: "ask",
    routing: "enrichment-reframe",
    intent: "give a concrete example of {t}",
  },
  define: { cls: "ask", routing: "enrichment-reframe", intent: "define {t}" },
  // Reason — Claim Graph / contradiction (deep routing M9).
  compare: { cls: "reason", routing: "claim-graph", intent: "compare {t} with another idea" },
  challenge: { cls: "reason", routing: "claim-graph", intent: "challenge the claim at {t}" },
  prove: { cls: "reason", routing: "claim-graph", intent: "prove {t}" },
  counter: { cls: "reason", routing: "claim-graph", intent: "offer a counterexample to {t}" },
  // Express — self-explanation / creation (deep routing later); feeds Understanding Deltas.
  teach_back: { cls: "express", routing: "self-explanation", intent: "teach {t} back" },
  think_aloud: { cls: "express", routing: "self-explanation", intent: "think aloud about {t}" },
  predict: { cls: "express", routing: "self-explanation", intent: "predict from {t}" },
  // Navigate — Director + timeline/graph.
  explore: { cls: "navigate", routing: "director", intent: "explore from {t}" },
  jump: { cls: "navigate", routing: "director", intent: "jump to {t}" },
  branch: { cls: "navigate", routing: "director", intent: "branch exploration from {t}" },
  expand: { cls: "navigate", routing: "director", intent: "expand {t}" },
  collapse: { cls: "navigate", routing: "director", intent: "collapse {t}" },
  // Govern flow — Director pacing.
  interrupt: { cls: "govern-flow", routing: "director", intent: "interrupt the current cognition" },
  slow_down: { cls: "govern-flow", routing: "director", intent: "slow the pace down" },
  speed_up: { cls: "govern-flow", routing: "director", intent: "pick the pace up" },
  go_normal: { cls: "govern-flow", routing: "director", intent: "return to a neutral pace" },
  resume_guide: { cls: "govern-flow", routing: "director", intent: "resume the guided view" },
  // The ADR-0024 reshaping kinds, aliased so the legacy path keeps its grammar entry.
  request_depth: { cls: "ask", routing: "enrichment-reframe", intent: "go deeper on {t}" },
  request_simplify: {
    cls: "ask",
    routing: "enrichment-reframe",
    intent: "reduce the abstraction of {t}",
  },
  request_example: {
    cls: "ask",
    routing: "enrichment-reframe",
    intent: "give a concrete example of {t}",
  },
};

export interface InterpretedIntent {
  readonly kind: string;
  readonly cls: InteractionClass;
  readonly routing: InteractionRouting;
  readonly cognitive_intent: string;
  readonly target_anchor_ref: string | null;
}

/**
 * Interpret a learner interaction into typed cognitive intent (CSE-014 §3, deterministic). An
 * unknown kind is honestly classified as a generic `ask-why` at the target (never a guessed
 * wrong intent, CSE-014 §7); a free-text `note` enriches the intent string but never changes the
 * routing (model-backed free-text interpretation is a named later increment).
 */
export function interpretIntent(
  kind: string,
  targetId: string | null,
  note?: string | null,
): InterpretedIntent {
  const entry = INTERACTION_GRAMMAR[kind] ?? {
    cls: "ask" as InteractionClass,
    routing: "enrichment-reframe" as InteractionRouting,
    intent: "justify {t} — why is this so?",
  };
  const target = targetId ?? "the current focus";
  let cognitive_intent = entry.intent.replace("{t}", target);
  if (note && note.trim()) cognitive_intent += ` — "${note.trim().slice(0, 120)}"`;
  return {
    kind,
    cls: entry.cls,
    routing: entry.routing,
    cognitive_intent,
    target_anchor_ref: targetId,
  };
}

// ---------------------------------------------------------------------------
// Fold record + reader
// ---------------------------------------------------------------------------

export interface ExpressedIntentRecord {
  readonly interaction_id: string;
  readonly kind: string;
  readonly cls: InteractionClass;
  readonly cognitive_intent: string;
  readonly target_anchor_ref: string | null;
  readonly hlc: string;
}

type Raw = Record<string, unknown>;
const str = (v: unknown, fallback = ""): string => (typeof v === "string" ? v : fallback);
const strOrNull = (v: unknown): string | null => (typeof v === "string" ? v : null);

export function readExpressedIntent(payload: Raw, hlc: string): ExpressedIntentRecord {
  return {
    interaction_id: str(payload["interaction_id"]),
    kind: str(payload["kind"]),
    cls: str(payload["class"], "ask") as InteractionClass,
    cognitive_intent: str(payload["cognitive_intent"]),
    target_anchor_ref: strOrNull(payload["target_anchor_ref"]),
    hlc,
  };
}
