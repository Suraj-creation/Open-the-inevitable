/**
 * Creative Cognition — creation as a first-class cognitive act (CSE M11 T1; CSE-016, ADR-0049).
 *
 * A `Creation` is the learner's artifact-in-progress (their words). The system is a THINKING PARTNER,
 * NOT A GHOSTWRITER (Constitution #5): it may only attach **assists** — scaffold (structure), critique
 * (adversarial findings on the learner's draft), provocation (generative questions), reference
 * (grounded pointers). There is deliberately **no field that could hold the artifact** on an assist:
 * the no-ghostwriter law is structural, not a prompt guideline. Every assist is disclosed + recorded.
 *
 * Pure types; the model-backed assist production lives in the CreationAssistUnit.
 */

/** The kinds of artifact a learner creates (CSE-016 §3.1). */
export const CREATION_KINDS = [
  "essay",
  "argument",
  "hypothesis",
  "experiment-design",
  "model",
  "prototype",
  "proof",
  "design",
  "proposal",
  "artwork",
  "dataset",
  "notebook",
] as const;
export type CreationKind = (typeof CREATION_KINDS)[number];

export function isCreationKind(value: string): value is CreationKind {
  return (CREATION_KINDS as readonly string[]).includes(value);
}

/** The assist grammar (CSE-016 §3.2). Generation of the artifact is NOT a mode (Constitution #5). */
export const CREATION_ASSIST_KINDS = ["scaffold", "critique", "provocation", "reference"] as const;
export type CreationAssistKind = (typeof CREATION_ASSIST_KINDS)[number];

export function isCreationAssistKind(value: string): value is CreationAssistKind {
  return (CREATION_ASSIST_KINDS as readonly string[]).includes(value);
}

/** scaffold: a labelled, empty structural slot the learner fills — never filled content. */
export interface ScaffoldSlot {
  readonly label: string;
  /** What belongs here, as guidance — not the content itself. */
  readonly hint: string;
}

/** critique: one adversarial finding on the learner's OWN draft — never a rewrite. */
export interface CritiqueFinding {
  readonly severity: "minor" | "major" | "blocking";
  /** Where in the draft (a short quote or section pointer). */
  readonly where: string;
  readonly issue: string;
  /** A direction to fix it — a pointer, not replacement prose. */
  readonly suggestion: string;
}

/** reference: a grounded pointer the learner may cite (provenance mandatory). */
export interface CreationReferenceRef {
  readonly label: string;
  /** The concept/source/URI this points to. */
  readonly source: string;
}

/**
 * One assist the system offered — always disclosed, always the learner's to use or decline. Exactly
 * one of `slots`/`findings`/`questions`/`refs` is present, matching `kind`. There is NO prose/content
 * field: an assist structurally cannot be the artifact (the no-ghostwriter law, CSE-016 §2).
 */
export interface CreationAssist {
  readonly assist_id: string;
  readonly kind: CreationAssistKind;
  readonly agent_cid: string;
  /** Always true — assists are never silent (CSE-016 §6 authorship integrity). */
  readonly disclosed: true;
  readonly as_of: string;
  /** scaffold */
  readonly slots?: readonly ScaffoldSlot[];
  /** critique */
  readonly findings?: readonly CritiqueFinding[];
  /** provocation */
  readonly questions?: readonly string[];
  /** reference */
  readonly refs?: readonly CreationReferenceRef[];
  /** Set when the model was unavailable and this is the deterministic minimal assist (honest). */
  readonly degraded?: boolean;
}

export type CreationStatus = "prompted" | "in_progress" | "critiqued" | "completed";

/** A learner's creation — their authored `draft` plus the disclosed assists offered along the way. */
export interface Creation {
  readonly creation_id: string;
  readonly learner_cid: string | null;
  readonly kind: CreationKind;
  readonly title: string;
  /** Concepts/source anchors it draws from (citable). */
  readonly concept_refs: readonly string[];
  /** The learner's own words — authored content, never system-generated (Constitution #5). */
  readonly draft: string;
  readonly assists: readonly CreationAssist[];
  readonly status: CreationStatus;
  readonly as_of: string;
  /**
   * When the learner has consented this creation into the shared substrate (ADR-0051), the
   * source-version id it became — now citable/fusable like any other Cognitive Source. Null until
   * contributed, and cleared again on revocation (ADR-0054). Only the learner's `draft` becomes source
   * content; assists stay disclosed provenance.
   */
  readonly contributed_as?: string | null;
}

/**
 * A durable consent record (CSE-002 §8, ADR-0054) — the unit consent is tracked + revoked in. Created
 * when a creation is contributed; a revocation flips `status` and cascades a redaction of the source.
 */
export interface ConsentEnvelope {
  readonly consent_ref: string;
  readonly creation_id: string;
  readonly source_version_id: string;
  readonly learner_cid: string | null;
  /** What the consent covers (e.g. "commons"). */
  readonly scope: string;
  readonly granted_at: string;
  readonly status: "active" | "revoked";
  readonly revoked_at: string | null;
}
