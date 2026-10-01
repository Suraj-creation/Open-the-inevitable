import {
  arrayOf,
  type Check,
  defineKind,
  int,
  isRecord,
  oneOf,
  optional,
  optStr,
  prob,
  shape,
  str,
} from "@uci/kernel";

/**
 * The substrate's authoritative cognitive records. Stages never collapse:
 * evidence → claim (inferred) → decision → action → observation (evidence) → resolution (verifier).
 * Model output enters only as `inferred` claims; only a verifier resolution makes anything verified.
 */

export interface ObjectiveSet {
  readonly objectiveId: string;
  readonly goal: string;
  readonly acceptance: string;
}

export interface QuestionOpened {
  readonly questionId: string;
  readonly text: string;
  readonly askedOf: "learner" | "person" | "self";
}

export interface QuestionClosed {
  readonly questionId: string;
  readonly reason: string;
}

export type ClaimKind = "assertion" | "expectation" | "resolution";
export type Origin = "inferred" | "stated-by-person" | "observed" | "verifier";
export type Standing = "conjectured" | "supported" | "verified" | "refuted";
export type ResolutionOutcome = "held" | "failed" | "indeterminate" | "expired";

export interface Derivation {
  readonly operator: string;
  readonly operatorVersion: string;
  readonly model?: string;
}

export interface VerifierIdentity {
  readonly id: string;
  readonly version: string;
  /** Measured error profile, stated honestly (e.g. "0/0 exact-match on a labelled audit set of 10"). */
  readonly measuredError: string;
  readonly actorVisible: boolean;
}

export interface ExpectationCondition {
  readonly kind: string;
  /** A practice item id, or "probe" for an item the environment selects. */
  readonly itemId?: string;
  /** Idempotency key of the action effect whose reply resolves this expectation. */
  readonly effectKey?: string;
}

/**
 * One epistemic object for assertions, expectations and resolutions (the claim-unification
 * hypothesis, PB-01). Versioned; a revision is a new version that names what it supersedes.
 */
export interface ClaimAsserted {
  readonly claimId: string;
  readonly version: number;
  readonly claimKind: ClaimKind;
  readonly subject: string;
  readonly proposition: string;
  readonly origin: Origin;
  readonly standing: Standing;
  readonly confidence: number;
  readonly validUntil?: string;
  /** Pointers: `ev:<hash>` for evidence, `rec:<stream>#<seq>` for records. Never empty. */
  readonly evidence: readonly string[];
  readonly derivation: Derivation;
  /** `<claimId>@v<version>` of the claim version this one replaces. */
  readonly supersedes?: string;
  // expectation
  readonly condition?: ExpectationCondition;
  readonly due?: string;
  readonly probability?: number;
  readonly decisionId?: string;
  // resolution
  readonly resolves?: string;
  readonly outcome?: ResolutionOutcome;
  readonly method?: string;
  readonly verifier?: VerifierIdentity;
}

export interface Alternative {
  readonly option: string;
  readonly probability: number;
  readonly rejectedBecause?: string;
}

export interface DecisionOpened {
  readonly decisionId: string;
  readonly question: string;
  readonly alternatives: readonly Alternative[];
  /** Expectation or question ids this decision is waiting on. */
  readonly pendingOn: readonly string[];
}

export interface Reexamination {
  readonly decisionId: string;
  readonly verdict: "reaffirm" | "revise" | "withdraw";
  readonly reason: string;
}

export interface DecisionMade {
  readonly decisionId: string;
  readonly choice: string;
  readonly alternatives: readonly Alternative[];
  /** Claim versions relied on, as `<claimId>@v<version>`. */
  readonly reliesOn: readonly string[];
  /** Expectation claim ids this decision declares. */
  readonly expectations: readonly string[];
  readonly rationale: string;
  readonly authority: string;
  /** Set when this decision resolves a previously opened one. */
  readonly resolves?: string;
  /** The decision this one replaces as the operative decision (e.g. the previous step's). */
  readonly supersedes?: string;
  readonly reexamines?: Reexamination;
  readonly deviatesFrom?: { readonly decisionId: string; readonly citing: readonly string[] };
}

export interface EvidenceRecorded {
  readonly evidenceHash: string;
  readonly mediaType: string;
  readonly source: "learner" | "environment" | "model-output" | "verifier" | "person";
  /** Untrusted content is data, never instructions. */
  readonly trust: "data" | "instruction";
  readonly ref?: string;
}

const derivation: Check = (v, p) =>
  isRecord(v)
    ? [
        ...str(v["operator"], `${p}.operator`),
        ...str(v["operatorVersion"], `${p}.operatorVersion`),
        ...optStr(v["model"], `${p}.model`),
      ]
    : [`${p} must be an object`];

const verifier: Check = (v, p) =>
  isRecord(v)
    ? [
        ...str(v["id"], `${p}.id`),
        ...str(v["version"], `${p}.version`),
        ...str(v["measuredError"], `${p}.measuredError`),
        ...(typeof v["actorVisible"] === "boolean" ? [] : [`${p}.actorVisible must be boolean`]),
      ]
    : [`${p} must be an object`];

const condition: Check = (v, p) =>
  isRecord(v)
    ? [
        ...str(v["kind"], `${p}.kind`),
        ...optStr(v["itemId"], `${p}.itemId`),
        ...optStr(v["effectKey"], `${p}.effectKey`),
      ]
    : [`${p} must be an object`];

const alternative: Check = (v, p) =>
  isRecord(v)
    ? [
        ...str(v["option"], `${p}.option`),
        ...prob(v["probability"], `${p}.probability`),
        ...optStr(v["rejectedBecause"], `${p}.rejectedBecause`),
      ]
    : [`${p} must be an object`];

const reexamination: Check = (v, p) =>
  isRecord(v)
    ? [
        ...str(v["decisionId"], `${p}.decisionId`),
        ...oneOf("reaffirm", "revise", "withdraw")(v["verdict"], `${p}.verdict`),
        ...str(v["reason"], `${p}.reason`),
      ]
    : [`${p} must be an object`];

const deviation: Check = (v, p) =>
  isRecord(v)
    ? [...str(v["decisionId"], `${p}.decisionId`), ...arrayOf(str)(v["citing"], `${p}.citing`)]
    : [`${p} must be an object`];

const nonEmpty =
  (check: Check): Check =>
  (v, p) =>
    Array.isArray(v) && v.length === 0 ? [`${p} must not be empty`] : check(v, p);

/** Per-claim-kind and stage invariants (I-C1 … I-C4) that the field shapes alone cannot express. */
function claimInvariants(data: unknown): string[] {
  if (!isRecord(data)) return [];
  const c = data as unknown as ClaimAsserted;
  const errors: string[] = [];
  if (c.origin === "inferred" && (c.standing === "verified" || c.standing === "refuted"))
    errors.push(
      "an inferred claim can only be conjectured or supported; only a verifier resolution verifies (I-C4)",
    );
  if (c.standing === "verified" && c.origin !== "verifier")
    errors.push("verified standing requires a verifier origin (I-C2)");
  if (
    c.claimKind === "expectation" &&
    (!c.condition || c.due === undefined || c.probability === undefined || !c.decisionId)
  )
    errors.push("an expectation needs condition, due, probability and decisionId");
  if (
    c.claimKind === "resolution" &&
    (!c.resolves || !c.outcome || !c.method || !c.verifier || c.origin !== "verifier")
  )
    errors.push("a resolution needs resolves, outcome, method, verifier and verifier origin");
  if (c.claimKind !== "resolution" && c.verifier) errors.push("only resolutions carry a verifier");
  if (c.version > 1 && c.supersedes !== `${c.claimId}@v${c.version - 1}`)
    errors.push(`version ${c.version} must supersede ${c.claimId}@v${c.version - 1}`);
  return errors;
}

const claimShape = shape({
  claimId: str,
  version: int,
  claimKind: oneOf("assertion", "expectation", "resolution"),
  subject: str,
  proposition: str,
  origin: oneOf("inferred", "stated-by-person", "observed", "verifier"),
  standing: oneOf("conjectured", "supported", "verified", "refuted"),
  confidence: prob,
  validUntil: optStr,
  evidence: nonEmpty(arrayOf(str)),
  derivation,
  supersedes: optStr,
  condition: optional(condition),
  due: optStr,
  probability: optional(prob),
  decisionId: optStr,
  resolves: optStr,
  outcome: optional(oneOf("held", "failed", "indeterminate", "expired")),
  method: optStr,
  verifier: optional(verifier),
});

export const SUBSTRATE_KINDS = [
  defineKind("objective.set", 1, shape({ objectiveId: str, goal: str, acceptance: str })),
  defineKind(
    "question.opened",
    1,
    shape({ questionId: str, text: str, askedOf: oneOf("learner", "person", "self") }),
  ),
  defineKind("question.closed", 1, shape({ questionId: str, reason: str })),
  defineKind("claim.asserted", 1, (d) => [...claimShape(d), ...claimInvariants(d)]),
  defineKind(
    "decision.opened",
    1,
    shape({
      decisionId: str,
      question: str,
      alternatives: nonEmpty(arrayOf(alternative)),
      pendingOn: arrayOf(str),
    }),
  ),
  defineKind(
    "decision.made",
    1,
    shape({
      decisionId: str,
      choice: str,
      alternatives: arrayOf(alternative),
      reliesOn: arrayOf(str),
      expectations: arrayOf(str),
      rationale: str,
      authority: str,
      resolves: optStr,
      supersedes: optStr,
      reexamines: optional(reexamination),
      deviatesFrom: optional(deviation),
    }),
  ),
  defineKind(
    "evidence.recorded",
    1,
    shape({
      evidenceHash: str,
      mediaType: str,
      source: oneOf("learner", "environment", "model-output", "verifier", "person"),
      trust: oneOf("data", "instruction"),
      ref: optStr,
    }),
  ),
];

export const claimRef = (c: Pick<ClaimAsserted, "claimId" | "version">): string =>
  `${c.claimId}@v${c.version}`;
