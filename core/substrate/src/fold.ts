import { type CausalRecord, type Draft, isPast } from "@uci/kernel";
import {
  type ClaimAsserted,
  claimRef,
  type DecisionMade,
  type DecisionOpened,
  type EvidenceRecorded,
  type ObjectiveSet,
  type QuestionClosed,
  type QuestionOpened,
} from "./records.js";

/**
 * The authoritative cognitive set, folded from records. This is state, not a cache: it is rebuilt
 * from the causal record on every step, and two folds of the same records are always identical.
 */
export interface CognitiveState {
  readonly objective?: CausalRecord<ObjectiveSet>;
  readonly questions: ReadonlyMap<
    string,
    { opened: CausalRecord<QuestionOpened>; closed?: CausalRecord<QuestionClosed> }
  >;
  /** Every version of every claim, oldest first. */
  readonly claims: ReadonlyMap<string, readonly CausalRecord<ClaimAsserted>[]>;
  readonly opened: ReadonlyMap<string, CausalRecord<DecisionOpened>>;
  readonly made: ReadonlyMap<string, CausalRecord<DecisionMade>>;
  readonly evidence: readonly CausalRecord<EvidenceRecorded>[];
}

const SUBSTRATE_PREFIXES = ["objective.", "question.", "claim.", "decision.", "evidence."];
export const isSubstrateKind = (kind: string): boolean =>
  SUBSTRATE_PREFIXES.some((p) => kind.startsWith(p));

export function foldCognitiveState(records: readonly CausalRecord[]): CognitiveState {
  let objective: CausalRecord<ObjectiveSet> | undefined;
  const questions = new Map<
    string,
    { opened: CausalRecord<QuestionOpened>; closed?: CausalRecord<QuestionClosed> }
  >();
  const claims = new Map<string, CausalRecord<ClaimAsserted>[]>();
  const opened = new Map<string, CausalRecord<DecisionOpened>>();
  const made = new Map<string, CausalRecord<DecisionMade>>();
  const evidence: CausalRecord<EvidenceRecorded>[] = [];
  for (const r of records) {
    switch (r.kind) {
      case "objective.set":
        objective = r as CausalRecord<ObjectiveSet>;
        break;
      case "question.opened": {
        const q = r as CausalRecord<QuestionOpened>;
        questions.set(q.data.questionId, { opened: q });
        break;
      }
      case "question.closed": {
        const q = r as CausalRecord<QuestionClosed>;
        const entry = questions.get(q.data.questionId);
        if (entry) entry.closed = q;
        break;
      }
      case "claim.asserted": {
        const c = r as CausalRecord<ClaimAsserted>;
        const versions = claims.get(c.data.claimId) ?? [];
        versions.push(c);
        claims.set(c.data.claimId, versions);
        break;
      }
      case "decision.opened": {
        const d = r as CausalRecord<DecisionOpened>;
        opened.set(d.data.decisionId, d);
        break;
      }
      case "decision.made": {
        const d = r as CausalRecord<DecisionMade>;
        made.set(d.data.decisionId, d);
        break;
      }
      case "evidence.recorded":
        evidence.push(r as CausalRecord<EvidenceRecorded>);
        break;
    }
  }
  return { objective, questions, claims, opened, made, evidence };
}

// ---------------------------------------------------------------- projections over the state

export function currentClaim(
  state: CognitiveState,
  claimId: string,
): CausalRecord<ClaimAsserted> | undefined {
  return state.claims.get(claimId)?.at(-1);
}

export function isCurrentRef(state: CognitiveState, ref: string): boolean {
  const [claimId] = ref.split("@v");
  const cur = claimId ? currentClaim(state, claimId) : undefined;
  return !!cur && claimRef(cur.data) === ref;
}

export function claimExists(state: CognitiveState, ref: string): boolean {
  const [claimId] = ref.split("@v");
  return !!claimId && (state.claims.get(claimId) ?? []).some((c) => claimRef(c.data) === ref);
}

export function openQuestions(state: CognitiveState): CausalRecord<QuestionOpened>[] {
  return [...state.questions.values()].filter((q) => !q.closed).map((q) => q.opened);
}

/** Opened decisions that no made decision has resolved yet. */
export function openDecisions(state: CognitiveState): CausalRecord<DecisionOpened>[] {
  const resolved = new Set([...state.made.values()].map((m) => m.data.resolves).filter(Boolean));
  return [...state.opened.values()].filter((d) => !resolved.has(d.data.decisionId));
}

/**
 * Decisions in force: made, not superseded by a later operative decision, and not revised or
 * withdrawn by a re-examination. A re-examination is itself an act, not a standing decision.
 */
export function decisionsInForce(state: CognitiveState): CausalRecord<DecisionMade>[] {
  const retired = new Set<string>();
  for (const m of state.made.values()) {
    if (m.data.reexamines && m.data.reexamines.verdict !== "reaffirm")
      retired.add(m.data.reexamines.decisionId);
    if (m.data.supersedes) retired.add(m.data.supersedes);
  }
  return [...state.made.values()].filter(
    (m) => !m.data.reexamines && !retired.has(m.data.decisionId),
  );
}

/** The proposition a claim ref asserts, if that version exists. */
function propositionOf(state: CognitiveState, ref: string): string | undefined {
  const [claimId] = ref.split("@v");
  return (state.claims.get(claimId ?? "") ?? []).find((c) => claimRef(c.data) === ref)?.data
    .proposition;
}

/**
 * Decisions in force that rely on a claim whose *content* has since been revised (a re-validation
 * that only renews validity is not a revision), and that no later decision has re-examined. These
 * must be re-examined before anything relies on them (C-R3).
 */
export function premiseRevised(
  state: CognitiveState,
): { decision: CausalRecord<DecisionMade>; staleRefs: string[] }[] {
  const out: { decision: CausalRecord<DecisionMade>; staleRefs: string[] }[] = [];
  for (const d of decisionsInForce(state)) {
    const staleRefs = d.data.reliesOn.filter((ref) => {
      if (isCurrentRef(state, ref)) return false;
      const cur = currentClaim(state, ref.split("@v")[0] ?? "");
      return !cur || cur.data.proposition !== propositionOf(state, ref);
    });
    if (!staleRefs.length) continue;
    const reexaminedAfter = [...state.made.values()].some(
      (m) => m.data.reexamines?.decisionId === d.data.decisionId && m.seq > d.seq,
    );
    if (!reexaminedAfter) out.push({ decision: d, staleRefs });
  }
  return out;
}

/** Current assertion claims whose validity has lapsed. They must be re-validated before use (C-R5). */
export function staleClaims(state: CognitiveState, now: string): CausalRecord<ClaimAsserted>[] {
  return [...state.claims.keys()]
    .map((id) => currentClaim(state, id))
    .filter(
      (c): c is CausalRecord<ClaimAsserted> =>
        !!c &&
        c.data.claimKind === "assertion" &&
        !!c.data.validUntil &&
        isPast(c.data.validUntil, now),
    );
}

export function resolutionOf(
  state: CognitiveState,
  expectationId: string,
): CausalRecord<ClaimAsserted> | undefined {
  for (const versions of state.claims.values()) {
    const c = versions.at(-1);
    if (c?.data.claimKind === "resolution" && c.data.resolves === expectationId) return c;
  }
  return undefined;
}

/** Expectations with no resolution yet. `overdue` ones must be expired explicitly, never dropped. */
export function openExpectations(
  state: CognitiveState,
  now: string,
): { expectation: CausalRecord<ClaimAsserted>; overdue: boolean }[] {
  return [...state.claims.keys()]
    .map((id) => currentClaim(state, id))
    .filter(
      (c): c is CausalRecord<ClaimAsserted> =>
        !!c && c.data.claimKind === "expectation" && !resolutionOf(state, c.data.claimId),
    )
    .map((c) => ({ expectation: c, overdue: !!c.data.due && isPast(c.data.due, now) }));
}

// ---------------------------------------------------------------- cross-record write checks

/**
 * Rules that need current state, checked by the single fenced writer before append (the store
 * validates each record's shape; this validates the batch against the stream). Drafts are applied
 * in order, so a batch may declare a decision and then the expectations it names.
 */
export function substrateViolations(
  records: readonly CausalRecord[],
  drafts: readonly Draft[],
): string[] {
  const errors: string[] = [];
  const working: CausalRecord[] = [...records];
  let nextSeq = (records.at(-1)?.seq ?? 0) + 1;
  const pendingExpectations: { decisionId: string; ids: readonly string[] }[] = [];
  for (const draft of drafts) {
    if (!isSubstrateKind(draft.kind)) {
      working.push(asRecord(draft, nextSeq++));
      continue;
    }
    const state = foldCognitiveState(working);
    errors.push(...draftViolations(state, draft));
    if (draft.kind === "decision.made") {
      const d = draft.data as DecisionMade;
      pendingExpectations.push({ decisionId: d.decisionId, ids: d.expectations });
    }
    working.push(asRecord(draft, nextSeq++));
  }
  const final = foldCognitiveState(working);
  for (const p of pendingExpectations)
    for (const id of p.ids) {
      const e = currentClaim(final, id);
      if (!e || e.data.claimKind !== "expectation" || e.data.decisionId !== p.decisionId)
        errors.push(
          `decision ${p.decisionId} declares expectation ${id}, which is not an expectation bound to it`,
        );
    }
  return errors;
}

function draftViolations(state: CognitiveState, draft: Draft): string[] {
  switch (draft.kind) {
    case "objective.set":
      return state.objective
        ? ["the objective is already set; change it by a decision, not by overwrite"]
        : [];
    case "question.opened": {
      const q = draft.data as QuestionOpened;
      return state.questions.has(q.questionId) ? [`question ${q.questionId} already exists`] : [];
    }
    case "question.closed": {
      const q = draft.data as QuestionClosed;
      const entry = state.questions.get(q.questionId);
      return !entry
        ? [`question ${q.questionId} does not exist`]
        : entry.closed
          ? [`question ${q.questionId} is already closed`]
          : [];
    }
    case "claim.asserted": {
      const c = draft.data as ClaimAsserted;
      const versions = state.claims.get(c.claimId) ?? [];
      const errs: string[] = [];
      if (c.version === 1 && versions.length)
        errs.push(`claim ${c.claimId} already exists; revise it with a new version`);
      if (c.version > 1 && versions.at(-1)?.data.version !== c.version - 1)
        errs.push(`claim ${c.claimId}: version ${c.version} does not follow the current version`);
      if (c.claimKind === "resolution" && c.resolves) {
        const target = currentClaim(state, c.resolves);
        if (!target || target.data.claimKind !== "expectation")
          errs.push(`resolution targets ${c.resolves}, which is not an expectation`);
        else if (resolutionOf(state, c.resolves))
          errs.push(`expectation ${c.resolves} is already resolved (exactly one resolution)`);
      }
      if (c.claimKind === "expectation" && c.decisionId && !state.made.has(c.decisionId))
        errs.push(
          `expectation ${c.claimId} names decision ${c.decisionId}, which has not been made`,
        );
      return errs;
    }
    case "decision.opened": {
      const d = draft.data as DecisionOpened;
      return state.opened.has(d.decisionId) || state.made.has(d.decisionId)
        ? [`decision ${d.decisionId} already exists`]
        : [];
    }
    case "decision.made": {
      const d = draft.data as DecisionMade;
      const errs: string[] = [];
      if (state.made.has(d.decisionId)) errs.push(`decision ${d.decisionId} is already made`);
      if (d.resolves && !openDecisions(state).some((o) => o.data.decisionId === d.resolves))
        errs.push(`decision ${d.resolves} is not open`);
      if (
        d.reexamines &&
        !decisionsInForce(state).some((m) => m.data.decisionId === d.reexamines?.decisionId)
      )
        errs.push(
          `decision ${d.reexamines.decisionId} is not in force, so it cannot be re-examined`,
        );
      if (d.supersedes && !decisionsInForce(state).some((m) => m.data.decisionId === d.supersedes))
        errs.push(`decision ${d.supersedes} is not in force, so it cannot be superseded`);
      for (const ref of d.reliesOn) {
        if (!claimExists(state, ref)) errs.push(`relies on ${ref}, which does not exist`);
        else if (!isCurrentRef(state, ref))
          errs.push(`relies on ${ref}, which has been superseded`);
      }
      return errs;
    }
    default:
      return [];
  }
}

function asRecord(draft: Draft, seq: number): CausalRecord {
  return {
    stream: "",
    seq,
    kind: draft.kind,
    v: draft.v,
    at: "",
    processId: "",
    entityId: "",
    labels: draft.labels ?? [],
    causes: draft.causes ?? [],
    data: draft.data,
  };
}
