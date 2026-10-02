import { DAY_MS, type Draft, isRecord } from "@uci/kernel";
import type { Alternative, ClaimAsserted } from "@uci/substrate";
import type { Mode, WorkingState } from "./compile.js";

/** A faculty's reply, after validation. Field names follow proposal@1. */
export interface Proposal {
  readonly restatement: { objective_id: string; rationale_decision_id?: string; why: string };
  readonly reexamines: readonly {
    decision_id: string;
    verdict: "reaffirm" | "revise" | "withdraw";
    reason: string;
  }[];
  readonly decision: {
    choice: string;
    alternatives: readonly { option: string; probability: number; rejected_because?: string }[];
    relies_on: readonly string[];
    rationale: string;
    resolves_open_decision_id?: string;
    deviates_from_decision_id?: string;
    deviation_evidence?: readonly string[];
  };
  readonly open_decision?: {
    question: string;
    alternatives: readonly { option: string; probability: number }[];
    pending_on: readonly string[];
  };
  readonly action: {
    type: "explain" | "practice" | "assess" | "ask_person" | "conclude";
    item_id?: string;
    content?: string;
  };
  readonly expectation?: { statement: string; probability: number };
  readonly claims: readonly {
    subject: string;
    proposition: string;
    confidence: number;
    evidence: readonly string[];
    valid_for_days?: number;
    revises?: string;
  }[];
  readonly questions_closed: readonly { question_id: string; reason: string }[];
}

/**
 * The only repair allowed: deterministic syntax normalisation, recorded by operator name.
 * @1 strips a Markdown code fence; @2 also reads `null` as absence (strict structured-output
 * dialects must emit every field, so an optional field arrives as null). Content is never altered.
 */
export const SYNTAX_OPERATOR = "syntax-normalize@2";
export function normalizeSyntax(raw: string): string {
  let t = raw.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(t);
  if (fence?.[1] !== undefined) t = fence[1].trim();
  return t;
}

/** Drop object members whose value is null: in proposal@1, null and absent mean the same thing. */
export function dropNulls(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(dropNulls);
  if (isRecord(value))
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, v]) => v !== null)
        .map(([k, v]) => [k, dropNulls(v)]),
    );
  return value;
}

/** Parse a recorded reply exactly as validation does (used to replay a recorded output). */
export function parseProposal(raw: string): Proposal {
  return dropNulls(JSON.parse(normalizeSyntax(raw))) as Proposal;
}

const isStr = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;
const isProb = (v: unknown): v is number => typeof v === "number" && v >= 0 && v <= 1;
const isStrArr = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((x) => typeof x === "string");

export interface ValidationContext {
  readonly ws: WorkingState;
  readonly mode: Mode;
  readonly actions: readonly string[];
  readonly practiceItemIds: readonly string[];
  readonly acceptanceMet: boolean;
  /** "off" disables the staleness gate (H-PCS3 arm D); default on. */
  readonly staleness?: "gate" | "off";
}

/**
 * Structural and semantic validation. Every id a proposal cites must be one the call's working state
 * showed, at that version. In bridge mode the harness also enforces the cognitive gates: decisions
 * whose premise was revised must be re-examined, and stale claims cannot be relied on.
 */
export function validateProposal(
  raw: string,
  vc: ValidationContext,
): { proposal: Proposal } | { errors: string[] } {
  let data: unknown;
  try {
    data = parseProposal(raw);
  } catch {
    return { errors: ["reply is not valid JSON"] };
  }
  const errors: string[] = [];
  if (!isRecord(data)) return { errors: ["reply must be a JSON object"] };
  const p = data as unknown as Proposal;

  // Structure.
  if (!isRecord(p.restatement) || !isStr(p.restatement.objective_id) || !isStr(p.restatement.why))
    errors.push("restatement needs objective_id and why");
  if (!Array.isArray(p.reexamines)) errors.push("reexamines must be an array");
  const d = p.decision;
  if (
    !isRecord(d) ||
    !isStr(d.choice) ||
    !isStr(d.rationale) ||
    !isStrArr(d.relies_on) ||
    !Array.isArray(d.alternatives)
  )
    errors.push("decision needs choice, alternatives, relies_on and rationale");
  else
    for (const a of d.alternatives)
      if (!isRecord(a) || !isStr(a.option) || !isProb(a.probability))
        errors.push("each alternative needs option and a probability in [0,1]");
  if (!isRecord(p.action) || !vc.actions.concat("conclude").includes(String(p.action.type)))
    errors.push(`action.type must be one of ${vc.actions.concat("conclude").join("|")}`);
  if (!Array.isArray(p.claims)) errors.push("claims must be an array");
  if (!Array.isArray(p.questions_closed)) errors.push("questions_closed must be an array");
  if (errors.length) return { errors };

  const ws = vc.ws;
  // Only what this call was shown can be cited: outside bridge mode no claim, decision or question
  // is shown, so none is citable (ids glimpsed in a transcript are text, not references).
  const bridge = vc.mode === "bridge";
  const inForce = new Set(ws.decisionsInForce.map((x) => x.id));
  const open = new Map(ws.openDecisions.map((x) => [x.id, x.value]));
  const current = new Set(bridge ? ws.claims.map((c) => c.id) : []);
  const stale = new Set(ws.claims.filter((c) => c.value.stale).map((c) => c.id));
  const superseded = new Map(ws.superseded.map((s) => [s.id, s.value.by]));
  const evidenceIds = new Set([
    ...ws.inputs.map((i) => i.id),
    ...ws.observations.map((o) => o.id),
    ...current,
  ]);
  const questions = new Set(ws.questions.map((q) => q.id));
  const list = (ids: Iterable<string>) => [...ids].join(", ") || "none";
  const reexamineHint = (id: string) =>
    `add {"decision_id": "${id}", "verdict": "reaffirm|revise|withdraw", "reason": "..."} to reexamines`;

  if (ws.objective && p.restatement.objective_id !== ws.objective.id)
    errors.push(`restatement.objective_id must be ${ws.objective.id}`);
  if (bridge) {
    const rd = p.restatement.rationale_decision_id;
    if (rd !== undefined && rd !== "" && !inForce.has(rd))
      errors.push(
        `rationale_decision_id ${rd} is not a decision in force (in force: ${list(inForce)})`,
      );
    for (const r of p.reexamines) {
      if (!isRecord(r) || !inForce.has(r.decision_id))
        errors.push(
          `reexamines ${String(r?.decision_id)}: not a decision in force (in force: ${list(inForce)})`,
        );
      else if (!["reaffirm", "revise", "withdraw"].includes(r.verdict) || !isStr(r.reason))
        errors.push(
          `reexamines ${r.decision_id}: needs a verdict (reaffirm|revise|withdraw) and a reason`,
        );
    }
    for (const ref of d.relies_on) {
      const by = superseded.get(ref);
      if (by)
        errors.push(
          `relies on ${ref}, which is superseded by ${by}: rely on ${by} or leave it out`,
        );
      else if (!current.has(ref))
        errors.push(
          `relies on ${ref}, which is not a current claim: relies_on takes current claim versions only (current: ${list(current)})`,
        );
      else if (stale.has(ref) && vc.staleness !== "off")
        errors.push(
          `relies on ${ref}, which is STALE: re-validate it first (a claim with revises "${ref}", citing evidence) or leave it out of relies_on`,
        );
    }
    for (const rev of ws.decisionsInForce.filter((x) => x.value.revised.length)) {
      if (!p.reexamines.some((r) => r.decision_id === rev.id))
        errors.push(
          `decision ${rev.id} has a revised premise (${rev.value.revised.join(", ")}): ${reexamineHint(rev.id)}`,
        );
    }
    if (d.resolves_open_decision_id) {
      const od = open.get(d.resolves_open_decision_id);
      if (!od)
        errors.push(
          `resolves_open_decision_id ${d.resolves_open_decision_id} is not an open decision`,
        );
      else if (!od.options.some((o) => d.choice.toLowerCase().includes(o.toLowerCase())))
        errors.push(
          `resolving ${d.resolves_open_decision_id} must choose one of its alternatives: ${od.options.join(" | ")}`,
        );
    }
    if (d.deviates_from_decision_id && !inForce.has(d.deviates_from_decision_id))
      errors.push(
        `deviates_from_decision_id ${d.deviates_from_decision_id} is not a decision in force`,
      );
    for (const q of p.questions_closed)
      if (!isRecord(q) || !questions.has(q.question_id) || !isStr(q.reason))
        errors.push(
          `questions_closed ${String(q?.question_id)}: not an open question, or no reason`,
        );
  }
  for (const c of p.claims) {
    if (
      !isRecord(c) ||
      !isStr(c.subject) ||
      !isStr(c.proposition) ||
      !isProb(c.confidence) ||
      !isStrArr(c.evidence) ||
      c.evidence.length === 0
    ) {
      errors.push(
        "each claim needs subject, proposition, confidence in [0,1] and at least one evidence id",
      );
      continue;
    }
    for (const e of c.evidence)
      if (!evidenceIds.has(e))
        errors.push(
          `claim evidence ${e} is not in the working state: cite ${bridge ? "inputs (I…), observations (X…) or current claims (C…@v…)" : "inputs (I…) or observations (X…)"} shown in it`,
        );
    // revises is a bridge field: outside bridge mode it takes no effect, like relies_on.
    if (bridge && c.revises !== undefined && c.revises !== "" && !current.has(c.revises))
      errors.push(
        `claim revises ${c.revises}, which is not a current claim (current: ${list(current)})`,
      );
    // Revision propagates to decisions (H-EP3): changing what a claim says obliges re-examining,
    // in the same proposal, every decision in force that relied on it. A re-validation that keeps
    // the proposition does not.
    if (bridge && c.revises && current.has(c.revises)) {
      const prior = ws.claims.find((x) => x.id === c.revises)?.value.data.proposition;
      if (prior !== undefined && prior !== c.proposition)
        for (const dep of ws.decisionsInForce.filter((x) =>
          x.value.reliesOn.includes(c.revises ?? ""),
        ))
          if (!p.reexamines.some((r) => r.decision_id === dep.id))
            errors.push(
              `revising ${c.revises} changes a premise of ${dep.id}: ${reexamineHint(dep.id)} in this same proposal`,
            );
    }
  }

  const a = p.action;
  if (a.type === "practice" && (!a.item_id || !vc.practiceItemIds.includes(a.item_id)))
    errors.push(`practice needs an item_id from the practice items (${list(vc.practiceItemIds)})`);
  if ((a.type === "explain" || a.type === "ask_person") && !isStr(a.content))
    errors.push(`${a.type} needs content`);
  if (a.type === "conclude" && !vc.acceptanceMet)
    errors.push(
      "conclude refused: acceptance does not hold on environment-selected probes (the acceptance verdict is not MET)",
    );
  if (
    (a.type === "practice" || a.type === "assess") &&
    (!isRecord(p.expectation) ||
      !isStr(p.expectation.statement) ||
      !isProb(p.expectation.probability))
  )
    errors.push(`${a.type} is consequential: declare an expectation (statement, probability)`);
  return errors.length ? { errors } : { proposal: p };
}

export interface DraftContext {
  readonly ws: WorkingState;
  readonly mode: Mode;
  readonly step: number;
  readonly stream: string;
  readonly model: string;
  /** `rec:` pointer to the evidence record holding this proposal's raw output. */
  readonly outputRef: string;
  readonly actionKey: string;
  readonly authorityRef: string;
}

/** Turn a valid proposal into substrate records, ordered so each batch-internal reference resolves. */
export function proposalDrafts(p: Proposal, dc: DraftContext): Draft[] {
  const { ws, step } = dc;
  const bridge = dc.mode === "bridge";
  const derivation = { operator: "proposal@1", operatorVersion: "1", model: dc.model };
  const recPtr = (id: string): string => {
    const all = [...ws.inputs, ...ws.observations, ...ws.claims];
    const hit = all.find((x) => x.id === id);
    return hit ? `rec:${dc.stream}#${hit.record}` : dc.outputRef;
  };
  const alts = (
    xs: readonly { option: string; probability: number; rejected_because?: string }[],
  ): Alternative[] =>
    xs.map((x) =>
      x.rejected_because
        ? { option: x.option, probability: x.probability, rejectedBecause: x.rejected_because }
        : { option: x.option, probability: x.probability },
    );
  const drafts: Draft[] = [];

  if (bridge)
    p.reexamines.forEach((r, i) =>
      drafts.push({
        kind: "decision.made",
        v: 1,
        data: {
          decisionId: `D${step}-r${i + 1}`,
          choice: `${r.verdict} ${r.decision_id}`,
          alternatives: [],
          reliesOn: [],
          expectations: [],
          rationale: r.reason,
          authority: dc.authorityRef,
          reexamines: { decisionId: r.decision_id, verdict: r.verdict, reason: r.reason },
        },
      }),
    );

  const decisionId = `D${step}`;
  // The new operative decision supersedes the previous one, unless a re-examination already retires it.
  const retiring = new Set(
    bridge ? p.reexamines.filter((r) => r.verdict !== "reaffirm").map((r) => r.decision_id) : [],
  );
  const previous = [...ws.decisionsInForce].reverse().find((x) => !retiring.has(x.id));
  const expectationId =
    p.expectation && (p.action.type === "practice" || p.action.type === "assess")
      ? `E${step}`
      : undefined;
  const deviation =
    bridge && p.decision.deviates_from_decision_id
      ? {
          decisionId: p.decision.deviates_from_decision_id,
          citing: [...(p.decision.deviation_evidence ?? [])],
        }
      : undefined;
  drafts.push({
    kind: "decision.made",
    v: 1,
    data: {
      decisionId,
      choice: `${p.action.type}${p.action.item_id ? ` ${p.action.item_id}` : ""}: ${p.decision.choice}`,
      alternatives: alts(p.decision.alternatives),
      reliesOn: bridge ? [...p.decision.relies_on] : [],
      expectations: expectationId ? [expectationId] : [],
      rationale: p.decision.rationale,
      authority: dc.authorityRef,
      ...(bridge && p.decision.resolves_open_decision_id
        ? { resolves: p.decision.resolves_open_decision_id }
        : {}),
      ...(previous ? { supersedes: previous.id } : {}),
      ...(deviation ? { deviatesFrom: deviation } : {}),
    },
  });
  if (bridge && p.open_decision)
    drafts.push({
      kind: "decision.opened",
      v: 1,
      data: {
        decisionId: `${decisionId}-o`,
        question: p.open_decision.question,
        alternatives: alts(p.open_decision.alternatives),
        pendingOn: [...p.open_decision.pending_on],
      },
    });
  if (expectationId && p.expectation) {
    const due = new Date(Date.parse(ws.now) + 2 * DAY_MS).toISOString();
    const data: ClaimAsserted = {
      claimId: expectationId,
      version: 1,
      claimKind: "expectation",
      subject: ws.entityId,
      proposition: p.expectation.statement,
      origin: "inferred",
      standing: "conjectured",
      confidence: p.expectation.probability,
      evidence: [dc.outputRef],
      derivation,
      condition: {
        kind: "answer-correct",
        itemId: p.action.type === "practice" ? (p.action.item_id ?? "") : "probe",
        effectKey: dc.actionKey,
      },
      due,
      probability: p.expectation.probability,
      decisionId,
    };
    drafts.push({ kind: "claim.asserted", v: 1, data });
  }
  p.claims.forEach((c, i) => {
    const prior =
      bridge && c.revises ? ws.claims.find((x) => x.id === c.revises)?.value.data : undefined;
    const validUntil = c.valid_for_days
      ? new Date(Date.parse(ws.now) + c.valid_for_days * DAY_MS).toISOString()
      : undefined;
    const data: ClaimAsserted = {
      claimId: prior ? prior.claimId : `C${step}-${i + 1}`,
      version: prior ? prior.version + 1 : 1,
      claimKind: "assertion",
      subject: c.subject,
      proposition: c.proposition,
      origin: "inferred",
      standing: c.confidence >= 0.7 ? "supported" : "conjectured",
      confidence: c.confidence,
      ...(validUntil ? { validUntil } : {}),
      evidence: [...new Set([...c.evidence.map(recPtr), dc.outputRef])],
      derivation,
      ...(prior ? { supersedes: `${prior.claimId}@v${prior.version}` } : {}),
    };
    drafts.push({ kind: "claim.asserted", v: 1, data });
  });
  if (bridge)
    for (const q of p.questions_closed)
      drafts.push({
        kind: "question.closed",
        v: 1,
        data: { questionId: q.question_id, reason: q.reason },
      });
  if (p.action.type === "ask_person")
    drafts.push({
      kind: "question.opened",
      v: 1,
      data: { questionId: `Q${step}`, text: p.action.content ?? "", askedOf: "learner" },
    });
  return drafts;
}
