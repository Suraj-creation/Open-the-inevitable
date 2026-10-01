import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  compileContext,
  compileWorkingState,
  type ManifestRecorded,
  type Mode,
} from "@uci/harness";
import { canonicalJson, type CausalRecord, type CausalStore } from "@uci/kernel";
import { foldCognitiveState } from "@uci/substrate";

const dirs: string[] = [];
export function tempDir(): string {
  const d = mkdtempSync(join(tmpdir(), "uci-reality-"));
  dirs.push(d);
  return d;
}
export function cleanup(): void {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
}

/**
 * Derivability: every recorded manifest's request hash is reproduced by recompiling the working
 * state from the records that preceded it, at the instant it records, and rendering again.
 * Returns the re-rendered prompts so callers can check further properties of exactly what was sent.
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
