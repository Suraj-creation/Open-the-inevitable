import {
  compileContext,
  compileWorkingState,
  type ManifestRecorded,
  type Mode,
  RENDERER_VERSION,
  type RequestRecorded,
} from "@uci/harness";
import {
  canonicalJson,
  type CausalRecord,
  type CausalStore,
  foldLedger,
  hashOf,
  modelUsage,
} from "@uci/kernel";
import { foldCognitiveState } from "@uci/substrate";

/**
 * Replay and derivability. Every model call's request is reconstructed: from its stored bytes
 * (request.recorded), whose hash must equal the manifest's request hash, and, when the call was
 * rendered by the renderer running now, also by recompiling the working state from the records
 * that preceded it and rendering again. A call rendered by another renderer version is replayed
 * from its bytes alone (it cannot be re-rendered, and need not be).
 */
export async function rederive(
  store: CausalStore,
  records: readonly CausalRecord[],
  options: { readonly rendererVersion?: string } = {},
): Promise<{ mismatches: number[]; prompts: string[]; replayedFromBytes: number }> {
  const current = options.rendererVersion ?? RENDERER_VERSION;
  const mismatches: number[] = [];
  const prompts: string[] = [];
  let replayedFromBytes = 0;
  for (const m of records.filter(
    (r) => r.kind === "manifest.recorded",
  ) as CausalRecord<ManifestRecorded>[]) {
    const stored = records.find(
      (r) =>
        r.seq > m.seq &&
        r.kind === "request.recorded" &&
        (r.data as RequestRecorded).requestHash === m.data.requestHash,
    ) as CausalRecord<RequestRecorded> | undefined;
    const bytes = stored
      ? await store.getEvidence(m.entityId, stored.data.evidenceHash)
      : undefined;
    const fromBytes = bytes ? (JSON.parse(bytes.content) as { prompt: string }) : undefined;
    if (stored && (!bytes || hashOf(fromBytes) !== m.data.requestHash)) mismatches.push(m.seq);
    if (m.data.rendererVersion === current) {
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
    } else if (fromBytes) {
      prompts.push(fromBytes.prompt);
      replayedFromBytes++;
    } else mismatches.push(m.seq);
    const intent = records.find((r) => r.seq > m.seq && r.kind === "effect.intended");
    if ((intent?.data as { payloadHash?: string } | undefined)?.payloadHash !== m.data.requestHash)
      mismatches.push(m.seq);
  }
  return { mismatches, prompts, replayedFromBytes };
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
