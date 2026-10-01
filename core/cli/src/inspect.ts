import {
  compileContext,
  compileWorkingState,
  type ManifestRecorded,
  type Mode,
} from "@uci/harness";
import {
  canonicalJson,
  type CausalRecord,
  type CausalStore,
  foldLedger,
  modelUsage,
} from "@uci/kernel";
import { foldCognitiveState } from "@uci/substrate";

/**
 * Derivability: every recorded manifest's request hash is reproduced by recompiling the working
 * state from the records that preceded it, at the instant it records, and rendering again.
 */
export async function rederive(
  store: CausalStore,
  records: readonly CausalRecord[],
): Promise<{ mismatches: number[]; prompts: string[] }> {
  const mismatches: number[] = [];
  const prompts: string[] = [];
  for (const m of records.filter(
    (r) => r.kind === "manifest.recorded",
  ) as CausalRecord<ManifestRecorded>[]) {
    const prefix = records.filter((r) => r.seq < m.seq);
    const ws = await compileWorkingState(store, prefix, m.data.compiledAt);
    const ctx = compileContext(
      ws,
      { id: m.data.faculty, model: m.data.model },
      m.data.mode as Mode,
      m.data.staleness,
    );
    prompts.push(ctx.request.prompt);
    if (ctx.requestHash !== m.data.requestHash) mismatches.push(m.seq);
    const intent = records.find((r) => r.seq > m.seq && r.kind === "effect.intended");
    if ((intent?.data as { payloadHash?: string } | undefined)?.payloadHash !== m.data.requestHash)
      mismatches.push(m.seq);
  }
  return { mismatches, prompts };
}

/** A canonical fingerprint of the folded cognitive state (record bodies, not object identity). */
export function stateFingerprint(records: readonly CausalRecord[]): string {
  const s = foldCognitiveState(records);
  return canonicalJson({
    objective: s.objective?.data,
    questions: [...s.questions.entries()].map(([k, v]) => [
      k,
      v.opened.data,
      v.closed?.data ?? null,
    ]),
    claims: [...s.claims.entries()].map(([k, v]) => [k, v.map((c) => c.data)]),
    opened: [...s.opened.entries()].map(([k, v]) => [k, v.data]),
    made: [...s.made.entries()].map(([k, v]) => [k, v.data]),
  });
}

export interface RunSummary {
  readonly outcome: string;
  readonly stepsCompleted: number;
  readonly modelCalls: number;
  readonly failedCalls: number;
  readonly rejections: number;
  readonly rejectionErrors: readonly string[];
  readonly inTokens: number;
  readonly outTokens: number;
  readonly servedBy: readonly string[];
  readonly decisions: readonly string[];
  readonly reexaminations: number;
  readonly probeOutcomes: readonly string[];
}

/** What a run did, computed from its records alone. */
export function summarize(records: readonly CausalRecord[], outcome: string): RunSummary {
  const ledger = foldLedger(records);
  const usage = modelUsage(ledger);
  const settled = records
    .filter((r) => r.kind === "effect.settled")
    .map((r) => r.data as { outcome: string; detail?: string; effectId: string });
  const modelSettled = settled.filter(
    (s) => ledger.get(s.effectId)?.intended.data.effectClass === "model-call",
  );
  const rejected = records
    .filter((r) => r.kind === "proposal.rejected")
    .map((r) => (r.data as { errors: string[] }).errors);
  const made = records
    .filter((r) => r.kind === "decision.made")
    .map((r) => r.data as { choice: string; reexamines?: unknown });
  return {
    outcome,
    stepsCompleted: records.filter((r) => r.kind === "step.completed").length,
    modelCalls: usage.calls,
    failedCalls: modelSettled.filter((s) => s.outcome === "failed").length,
    rejections: rejected.length,
    rejectionErrors: [...new Set(rejected.flat())].slice(0, 12),
    inTokens: usage.inTokens,
    outTokens: usage.outTokens,
    servedBy: [
      ...new Set(
        modelSettled.map((s) => s.detail?.replace("served-by:", "") ?? "").filter(Boolean),
      ),
    ],
    decisions: made.filter((d) => !d.reexamines).map((d) => d.choice.slice(0, 90)),
    reexaminations: made.filter((d) => d.reexamines).length,
    probeOutcomes: records
      .filter(
        (r) =>
          r.kind === "claim.asserted" &&
          (r.data as { method?: string }).method === "answer-key:probe",
      )
      .map((r) => (r.data as { outcome: string }).outcome),
  };
}
