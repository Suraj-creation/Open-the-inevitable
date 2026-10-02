import { cpSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { ScriptedTutorFaculty } from "@uci/env-tutor";
import {
  type ModelFaculty,
  type Mode,
  processStream,
  runStep,
  type Staleness,
  type StepOutcome,
} from "@uci/harness";
import { type CausalRecord, DAY_MS, ManualClock, sha256Hex } from "@uci/kernel";
import { rederive } from "./inspect.js";
import { openRuntime, resume, type Runtime, start } from "./runtime.js";
import { rate, type RunScore, scoreRun } from "./tier-r-score.js";

/**
 * The cognitive-resume battery as a runnable protocol (Tier S scripted, Tier R live). Same forked
 * control as core/cli/tests/reality/battery.test.ts: a scripted setup to the fork point, copied per
 * arm; the fork step itself is taken by faculty X.
 *   A_X  warm: X takes the fork step, then the clock advances, the learner corrects, X continues.
 *   A_X2 a second A_X batch: the variance baseline.
 *   A_Y  warm swap: as A_X, but Y continues after the fork step (provider without interruption).
 *   B    interrupted: X's fork step is killed inside its external effect; while down, the clock
 *        advances and the correction arrives; Y resumes in a fresh runtime.
 *   C    as B, floor-only context (no claims, decisions, expectations, questions).
 *   D    as B, staleness hidden and ungated.
 */
export type ArmName = "A_X" | "A_X2" | "A_Y" | "B" | "C" | "D";
export const ARMS: readonly ArmName[] = ["A_X", "A_X2", "A_Y", "B", "C", "D"];

export interface Seed {
  readonly seed: number;
  readonly correction: string;
}

/** Five scenario variants: the learner's correction, worded differently, always the same fact. */
export const SEEDS: readonly Seed[] = [
  { seed: 0, correction: "i dont add the bottoms, i just copied the 6 wrong" },
  {
    seed: 1,
    correction: "no, i know you dont add the denominators. i wrote 6 instead of 12 by mistake",
  },
  {
    seed: 2,
    correction: "wait, im not adding the bottom numbers. i just got the times table wrong",
  },
  { seed: 3, correction: "thats not it, i use a common denominator, i just multiplied wrong" },
  { seed: 4, correction: "i never add the denominators! i slipped on 2 times 3" },
];

export const FORK_AFTER_STEPS = 5;
export const ADVANCE_MS = 4 * DAY_MS;
const MAX_STEPS_AFTER_FORK = 25;

/** USD per million tokens, by faculty id (Anthropic list price 2026-09; Azure gpt-4.1-mini list). */
export const PRICE: Readonly<Record<string, { in: number; out: number }>> = {
  "anthropic-claude@1": { in: 4, out: 20 },
  "azure-openai@1": { in: 0.4, out: 1.6 },
};

export interface ArmResult {
  readonly seed: number;
  readonly arm: ArmName;
  readonly x: string;
  readonly y: string;
  readonly killedInsideEffect: boolean;
  readonly score: RunScore;
  readonly modelCalls: number;
  readonly rejections: number;
  readonly costUsd: number;
  readonly servedBy: readonly string[];
  readonly duplicateDeliveries: number;
  readonly derivabilityMismatches: number;
  readonly seconds: number;
}

class Crash extends Error {}
const data = <T>(r: CausalRecord) => r.data as T;
const stepsDone = (records: readonly CausalRecord[]) =>
  records.filter((r) => r.kind === "step.completed").length;

/** The scripted setup to the fork point. Returns the data dir and the fork instant. */
export async function setupFork(): Promise<{ dir: string; at: string }> {
  const dir = mkdtempSync(join(tmpdir(), "uci-fork-"));
  const clock = new ManualClock();
  const rt = await openRuntime(dir, clock);
  const handle = await start(rt, "P1", "setup");
  const faculty = new ScriptedTutorFaculty();
  while (stepsDone(await rt.store.read(processStream("P1"))) < FORK_AFTER_STEPS)
    await runStep({ handle, faculty, env: rt.env });
  await rt.close();
  return { dir, at: clock.now() };
}

/** Steps with exponential backoff on retries (a rate-limited provider is never hammered). */
async function runToEnd(
  step: () => Promise<StepOutcome>,
  backoffMs: number,
): Promise<StepOutcome["status"] | "unfinished"> {
  let retries = 0;
  for (let i = 0; i < MAX_STEPS_AFTER_FORK + 10; i++) {
    const o = await step();
    if (o.status === "concluded" || o.status === "escalated") return o.status;
    if (o.status === "retry") {
      retries += 1;
      if (backoffMs)
        await new Promise((r) => setTimeout(r, Math.min(30_000, backoffMs * 2 ** retries)));
    } else retries = 0;
  }
  return "unfinished";
}

/** X takes the fork step; with `kill`, the process dies inside the step's external effect. */
async function forkStep(rt: Runtime, faculty: ModelFaculty, kill: boolean, backoffMs: number) {
  const { handle } = await resume(rt, "P1", "fork", faculty);
  for (let i = 0; i < 8; i++) {
    try {
      const o = await runStep({
        handle,
        faculty,
        env: rt.env,
        ...(kill
          ? {
              crash: (p: string) => {
                if (p === "external-performed") throw new Crash(p);
              },
            }
          : {}),
      });
      if (o.status !== "retry") return { handle, killed: false };
      if (backoffMs) await new Promise((r) => setTimeout(r, backoffMs * 2 ** i));
    } catch (e) {
      if (e instanceof Crash) return { handle, killed: true };
      throw e;
    }
  }
  return { handle, killed: false };
}

function costOf(records: readonly CausalRecord[]): number {
  let faculty = "";
  let usd = 0;
  for (const r of records) {
    if (r.kind === "manifest.recorded") faculty = data<{ faculty: string }>(r).faculty;
    const usage =
      r.kind === "effect.settled"
        ? data<{ usage?: { inTokens: number; outTokens: number } }>(r).usage
        : undefined;
    const price = PRICE[faculty];
    if (usage && price) usd += (usage.inTokens * price.in + usage.outTokens * price.out) / 1e6;
  }
  return usd;
}

export async function runArm(o: {
  readonly src: string;
  readonly at: string;
  readonly arm: ArmName;
  readonly seed: Seed;
  readonly X: () => ModelFaculty;
  readonly Y: () => ModelFaculty;
  readonly backoffMs?: number;
  /** Keep the arm's data directory for diagnosis instead of deleting it; its path is returned. */
  readonly keep?: boolean;
}): Promise<ArmResult & { readonly dir?: string }> {
  const started = Date.now();
  const backoff = o.backoffMs ?? 1_000;
  const dir = mkdtempSync(join(tmpdir(), `uci-arm-${o.arm}-`));
  cpSync(o.src, dir, { recursive: true });
  const clock = new ManualClock(o.at);
  let rt = await openRuntime(dir, clock);
  const X = o.X();
  const Y = o.Y();
  const interrupted = o.arm === "B" || o.arm === "C" || o.arm === "D";
  const fork = await forkStep(rt, X, interrupted, backoff);
  const killSeq = (await rt.store.read(processStream("P1"))).at(-1)?.seq ?? 0;
  let outcome: string;
  const mode: Mode = o.arm === "C" ? "floor-only" : "bridge";
  const staleness: Staleness = o.arm === "D" ? "off" : "gate";
  if (interrupted) {
    await rt.close(); // killed: nothing in memory survives
    clock.advance(ADVANCE_MS);
    rt = await openRuntime(dir, clock);
    rt.env.learnerSays(o.seed.correction); // arrives while the process is down
    const { handle } = await resume(rt, "P1", "after-kill", Y);
    outcome = await runToEnd(
      () => runStep({ handle, faculty: Y, env: rt.env, mode, staleness }),
      backoff,
    );
  } else {
    clock.advance(ADVANCE_MS);
    rt.env.learnerSays(o.seed.correction);
    const next = o.arm === "A_Y" ? Y : X;
    outcome = await runToEnd(
      () => runStep({ handle: fork.handle, faculty: next, env: rt.env }),
      backoff,
    );
  }
  void outcome;
  const records = await rt.store.read(processStream("P1"));
  const score = await scoreRun({
    store: rt.store,
    records,
    killSeq,
    correction: o.seed.correction,
  });
  const { mismatches } = await rederive(rt.store, records);
  const servedBy = new Set(
    records
      .filter((r) => r.kind === "effect.settled")
      .map((r) => data<{ detail?: string }>(r).detail ?? "")
      .filter((d) => d.startsWith("served-by:"))
      .map((d) => d.slice("served-by:".length)),
  );
  const result: ArmResult = {
    seed: o.seed.seed,
    arm: o.arm,
    x: `${X.id}/${X.model}`,
    y: `${Y.id}/${Y.model}`,
    killedInsideEffect: fork.killed,
    score,
    modelCalls: records.filter(
      (r) =>
        r.kind === "effect.intended" &&
        data<{ effectClass: string }>(r).effectClass === "model-call",
    ).length,
    rejections: records.filter((r) => r.kind === "proposal.rejected").length,
    costUsd: Math.round(costOf(records) * 10_000) / 10_000,
    servedBy: [...servedBy],
    duplicateDeliveries: [...rt.env.channel.keyCounts().values()].filter((n) => n > 1).length,
    derivabilityMismatches: mismatches.length,
    seconds: Math.round((Date.now() - started) / 1000),
  };
  await rt.close();
  if (o.keep) return { ...result, dir };
  rmSync(dir, { recursive: true, force: true });
  return result;
}

/** The scorer's identity: results are only comparable under the same scoring code. */
export function scorerHash(): string {
  const file = fileURLToPath(new URL("./tier-r-score.ts", import.meta.url));
  return sha256Hex(readFileSync(file, "utf8").replace(/\r\n/g, "\n")).slice(0, 16);
}

const CHECKS = ["CR1", "CR2", "CR3", "CR7", "CR8"] as const;

/** Rates per arm and the pre-registered pass rules (hypotheses e43d/5bc9/f4e3, superseded). */
export function evaluate(results: readonly ArmResult[]) {
  const by = (arm: ArmName) => results.filter((r) => r.arm === arm).map((r) => r.score);
  const rates = Object.fromEntries(
    ARMS.map((arm) => [
      arm,
      {
        n: by(arm).length,
        ...Object.fromEntries(
          (["CR1", "CR2", "CR3", "revised", "CR5", "CR7", "CR8"] as const).map((k) => [
            k,
            rate(by(arm), k),
          ]),
        ),
        mastery:
          by(arm).length === 0
            ? null
            : by(arm).filter((s) => s.outcome === "mastery-verified").length / by(arm).length,
      },
    ]),
  ) as unknown as Record<ArmName, Record<string, number | null>>;
  const meanA = (k: string) => {
    const a = [rates.A_X[k], rates.A_X2[k]].filter((v): v is number => typeof v === "number");
    return a.length ? a.reduce((s, v) => s + v, 0) / a.length : null;
  };
  const pcs4 = Object.fromEntries(
    CHECKS.map((k) => {
      const b = rates.B[k];
      const a = meanA(k);
      return [k, b === null || b === undefined || a === null ? null : b >= a - 0.2];
    }),
  );
  const b3 = rates.B["CR3"];
  const c3 = rates.C["CR3"];
  const ec1 = typeof b3 === "number" && typeof c3 === "number" ? b3 - c3 >= 0.4 : null;
  const b5 = rates.B["CR5"];
  const d5 = rates.D["CR5"];
  const pcs3 = typeof b5 === "number" && typeof d5 === "number" ? b5 === 1 && d5 <= 0.6 : null;
  const duplicates = results.reduce((s, r) => s + r.duplicateDeliveries, 0);
  const bm = rates.B["mastery"];
  const am = meanA("mastery");
  const outcome = typeof bm === "number" && am !== null ? bm >= am - 0.2 : null;
  return {
    rates,
    variance: Object.fromEntries(
      CHECKS.map((k) => {
        const x = rates.A_X[k];
        const y = rates.A_X2[k];
        return [k, typeof x === "number" && typeof y === "number" ? Math.abs(x - y) : null];
      }),
    ),
    rules: {
      "H-PCS4": pcs4,
      "H-EC1": ec1,
      "H-PCS3": pcs3,
      zeroDuplicates: duplicates === 0,
      sameOutcome: outcome,
    },
    spendUsd: Math.round(results.reduce((s, r) => s + r.costUsd, 0) * 100) / 100,
  };
}
