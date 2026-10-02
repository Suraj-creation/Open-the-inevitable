import { compileWorkingState, parseProposal, type Proposal } from "@uci/harness";
import type { CausalRecord, CausalStore } from "@uci/kernel";

/**
 * Tier R scoring: the cognitive-resume checks (archit/02 §4) evaluated mechanically from records
 * and recorded evidence only — never by a model. Pre-registered in the journal (superseding
 * hypothesis-20261001-e43d and -5bc9); the hash of this file is recorded with every result.
 *
 * "The resumed reasoner" is the first decision whose model output was produced after the kill
 * point: a decision replayed from an output recorded before the kill was authored by the original
 * model and does not count. Each check is `null` when it does not apply to a run.
 */

/**
 * An explanation that re-teaches the corrected misconception (behavioural C-R3). Pre-registered
 * wording; a mechanical proxy that can misfire on an acknowledgement, equally in every arm.
 */
export const MISCONCEPTION_TARGET =
  /\b(don'?t|do not|never|shouldn'?t|can'?t|cannot|not)\b[^.]{0,30}\badd(ing)?\b[^.]{0,20}\b(denominators?|bottoms?|bottom numbers?)\b/i;

export interface RunScore {
  /** Seq of the first post-resume decision, or null if the resumed reasoner never decided. */
  readonly firstDecision: number | null;
  /** Restatement cites the operative decision the resumed reasoner was shown. */
  readonly CR1: boolean | null;
  /** Every open decision stays open or is resolved with a listed alternative; none vanishes. */
  readonly CR2: boolean | null;
  /** Behavioural: after the correction, nothing relies on the old belief and no explanation re-teaches it. */
  readonly CR3: boolean | null;
  /** The contradicted belief was revised (new content) within two decisions of the correction. */
  readonly revised: boolean | null;
  /** No decision after the lapse relies on the lapsed version; re-validation precedes any reliance. */
  readonly CR5: boolean | null;
  /** Citation-continuity proxy: the first decision cites a decision in force (rationale, re-examination or deviation). */
  readonly CR7: boolean | null;
  /** Every open question stays open or is closed with a reason; none vanishes. */
  readonly CR8: boolean | null;
  readonly outcome: string;
}

const data = <T>(r: CausalRecord) => r.data as T;
const ref = (c: { claimId: string; version: number }) => `${c.claimId}@v${c.version}`;

interface ModelDecision {
  readonly decision: CausalRecord;
  readonly outputSeq: number;
  readonly manifestSeq: number;
  readonly proposal: Proposal | undefined;
}

/** Every decision with the model output (and manifest) that produced it. */
async function modelDecisions(
  store: CausalStore,
  records: readonly CausalRecord[],
): Promise<ModelDecision[]> {
  const out: ModelDecision[] = [];
  for (const d of records.filter((r) => r.kind === "decision.made")) {
    const output = records.findLast(
      (r) =>
        r.seq < d.seq &&
        r.kind === "evidence.recorded" &&
        data<{ source: string }>(r).source === "model-output",
    );
    if (!output) continue;
    const manifest = records.findLast((r) => r.seq < output.seq && r.kind === "manifest.recorded");
    const text = (await store.getEvidence(data<{ evidenceHash: string }>(output).evidenceHash))
      ?.content;
    let proposal: Proposal | undefined;
    try {
      proposal = text === undefined ? undefined : parseProposal(text);
    } catch {
      proposal = undefined;
    }
    out.push({ decision: d, outputSeq: output.seq, manifestSeq: manifest?.seq ?? 0, proposal });
  }
  return out;
}

export async function scoreRun(o: {
  readonly store: CausalStore;
  readonly records: readonly CausalRecord[];
  /** Last seq before the interruption (B/C/D) or after the uninterrupted fork step (A). */
  readonly killSeq: number;
  /** The learner's correction, exactly as admitted. */
  readonly correction: string;
}): Promise<RunScore> {
  const { store, records, killSeq } = o;
  const concluded = records.find((r) => r.kind === "process.concluded");
  const outcome = concluded
    ? data<{ outcome: string }>(concluded).outcome
    : records.some((r) => r.kind === "process.escalated")
      ? "escalated"
      : "unfinished";
  const decisions = (await modelDecisions(store, records)).filter((d) => d.outputSeq > killSeq);
  const first = decisions[0];
  const none: RunScore = {
    firstDecision: null,
    CR1: false,
    CR2: false,
    CR3: false,
    revised: false,
    CR5: false,
    CR7: false,
    CR8: false,
    outcome,
  };
  if (!first) return none;

  // What the resumed reasoner was shown: the state its first call was compiled from.
  const shownRecords = records.filter((r) => r.seq < first.manifestSeq);
  const manifest = records.find((r) => r.seq === first.manifestSeq);
  const shown = await compileWorkingState(
    store,
    shownRecords,
    manifest ? data<{ compiledAt: string }>(manifest).compiledAt : (records.at(-1)?.at ?? ""),
  );
  const final = await compileWorkingState(store, records, records.at(-1)?.at ?? "");
  const inForce = new Set(shown.decisionsInForce.map((d) => d.id));
  const operative = [...shown.decisionsInForce].sort((a, b) => a.record - b.record).at(-1)?.id;
  const p = first.proposal;

  const CR1 =
    operative === undefined ? null : !!p && p.restatement.rationale_decision_id === operative;

  const CR7 =
    inForce.size === 0
      ? null
      : !!p &&
        [
          p.restatement.rationale_decision_id,
          p.decision.deviates_from_decision_id,
          ...p.reexamines.map((r) => r.decision_id),
        ].some((id) => id !== undefined && inForce.has(id));

  const resolvedBy = new Set(
    records
      .filter((r) => r.kind === "decision.made" && r.seq > killSeq)
      .map((r) => data<{ resolves?: string }>(r).resolves)
      .filter((x): x is string => !!x),
  );
  const stillOpen = new Set(final.openDecisions.map((d) => d.id));
  const CR2 =
    shown.openDecisions.length === 0
      ? null
      : shown.openDecisions.every((d) => stillOpen.has(d.id) || resolvedBy.has(d.id));

  const closedWithReason = new Set(
    records
      .filter(
        (r) =>
          r.kind === "question.closed" &&
          r.seq > killSeq &&
          data<{ reason: string }>(r).reason.trim().length > 0,
      )
      .map((r) => data<{ questionId: string }>(r).questionId),
  );
  const openQuestions = new Set(final.questions.map((q) => q.id));
  const CR8 =
    shown.questions.length === 0
      ? null
      : shown.questions.every((q) => openQuestions.has(q.id) || closedWithReason.has(q.id));

  // C-R3: the contradicted belief and the correction that contradicts it.
  const atFork = await compileWorkingState(
    store,
    records.filter((r) => r.seq <= killSeq),
    records.find((r) => r.seq === killSeq)?.at ?? "",
  );
  const misconception = atFork.claims.find(
    (c) =>
      /adds denominators/i.test(c.value.data.proposition) &&
      !/does not/i.test(c.value.data.proposition),
  )?.value.data;
  let delivery: CausalRecord | undefined;
  for (const r of records.filter((x) => x.seq > killSeq && x.kind === "input.delivered")) {
    const content = (await store.getEvidence(data<{ evidenceHash: string }>(r).evidenceHash))
      ?.content;
    if (content === o.correction) {
      delivery = r;
      break;
    }
  }
  let CR3: boolean | null = null;
  let revised: boolean | null = null;
  if (misconception && delivery) {
    const misRef = ref(misconception);
    const afterCorrection = decisions.filter((d) => d.decision.seq > (delivery?.seq ?? 0));
    // Windows count model outputs, not decision records: one output can yield a re-examination
    // record, the operative decision and the claims written after them in the same batch.
    const outputs = [...new Set(afterCorrection.map((d) => d.outputSeq))];
    const inWindow = (outputSeq: number, n: number) => outputs.slice(0, n).includes(outputSeq);
    const relies = afterCorrection.some((d) =>
      data<{ reliesOn: string[] }>(d.decision).reliesOn.includes(misRef),
    );
    const reteaches = afterCorrection.some(
      (d) =>
        inWindow(d.outputSeq, 3) &&
        d.proposal?.action.type === "explain" &&
        MISCONCEPTION_TARGET.test(d.proposal.action.content ?? ""),
    );
    CR3 = !relies && !reteaches;
    const sourceOutput = (seq: number) =>
      records.findLast(
        (r) =>
          r.seq < seq &&
          r.kind === "evidence.recorded" &&
          data<{ source: string }>(r).source === "model-output",
      )?.seq ?? -1;
    revised = records.some(
      (r) =>
        r.kind === "claim.asserted" &&
        r.seq > delivery.seq &&
        inWindow(sourceOutput(r.seq), 2) &&
        data<{ supersedes?: string; proposition: string }>(r).supersedes === misRef &&
        data<{ proposition: string }>(r).proposition !== misconception.proposition,
    );
  }

  // C-R5 (as in Tier S, hypothesis-20261001-f4e3): the prerequisite belief lapses across the kill.
  const prerequisite = atFork.claims.find((c) =>
    /multiplication facts/i.test(c.value.data.proposition),
  )?.value.data;
  let CR5: boolean | null = null;
  if (prerequisite) {
    const pref = ref(prerequisite);
    const after = records.filter((r) => r.seq > killSeq);
    const made = after.filter((r) => r.kind === "decision.made");
    const revalidation = after.find(
      (r) => r.kind === "claim.asserted" && data<{ supersedes?: string }>(r).supersedes === pref,
    );
    const firstReliance = made.find((r) =>
      data<{ reliesOn: string[] }>(r).reliesOn.some((x) =>
        x.startsWith(`${prerequisite.claimId}@v`),
      ),
    );
    CR5 =
      !made.some((r) => data<{ reliesOn: string[] }>(r).reliesOn.includes(pref)) &&
      (!firstReliance || (!!revalidation && revalidation.seq < firstReliance.seq));
  }

  return { firstDecision: first.decision.seq, CR1, CR2, CR3, revised, CR5, CR7, CR8, outcome };
}

/** Pass rate over applicable runs, or null when no run applies. */
export function rate(scores: readonly RunScore[], key: keyof RunScore): number | null {
  const applicable = scores.map((s) => s[key]).filter((v): v is boolean => typeof v === "boolean");
  return applicable.length ? applicable.filter(Boolean).length / applicable.length : null;
}
