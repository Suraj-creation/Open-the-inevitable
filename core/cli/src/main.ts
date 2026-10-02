#!/usr/bin/env node
/**
 * uci — run a durable tutoring process with a chosen faculty.
 *
 *   uci run     --faculty <scripted|claude|opus|sonnet|azure|gemini|openai> [--dir D] [--steps N]
 *   uci resume  --faculty <name> --dir D [--steps N] [--process P]
 *   uci inspect --dir D [--process P]
 *   uci spike   --faculty <name> [--steps N]       one complete live run in a temp dir; JSON summary
 *   uci migrate [--url postgres://…] [--schema uci]   apply the causal store's Postgres migrations
 *   uci battery --x <name> --y <name> [--seeds N | --seed K] [--arms A,B,..] [--cap USD] [--out DIR]
 *               the forked cognitive-resume battery (Tier R when X/Y are live); X and Y alternate
 *               by seed; results and the pre-registered rule outcomes are written to --out
 *
 * Credentials come from the repository's git-ignored .env; nothing here prints a secret.
 */
import { execFileSync } from "node:child_process";
import {
  appendFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PostgresCausalStore } from "@uci/adapters";
import { processStream, runStep, type StepOutcome } from "@uci/harness";
import { systemClock } from "@uci/kernel";
import {
  ARMS,
  type ArmName,
  type ArmResult,
  evaluate,
  runArm,
  scorerHash,
  SEEDS,
  setupFork,
} from "./battery.js";
import { FACULTY_NAMES, type FacultyName, loadEnv, makeFaculty } from "./faculty-config.js";
import { rederive, summarize } from "./inspect.js";
import { openRuntime, resume, start } from "./runtime.js";

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
}

/** Run steps until done; back off on retries so a rate-limited provider is not hammered. */
async function drive(
  run: () => Promise<StepOutcome>,
  maxSteps: number,
  log: (o: StepOutcome) => void,
): Promise<StepOutcome> {
  let last: StepOutcome = { status: "retry", step: 0 };
  let retries = 0;
  for (let i = 0; i < maxSteps; i++) {
    last = await run();
    log(last);
    if (last.status === "concluded" || last.status === "escalated") return last;
    if (last.status === "retry") {
      retries += 1;
      await new Promise((r) => setTimeout(r, Math.min(30_000, 1_000 * 2 ** Math.min(retries, 5))));
    } else retries = 0;
  }
  return last;
}

function repoRoot(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  while (!existsSync(join(dir, "pnpm-workspace.yaml")) && dirname(dir) !== dir) dir = dirname(dir);
  return dir;
}

/**
 * Run the battery. Seeds alternate which provider authors the fork (X) and which resumes (Y).
 * Spend is metered from recorded usage; after each seed the remaining spend is projected from the
 * costliest seed so far, and A_X2 (the variance baseline) is dropped first if the cap would be
 * exceeded, then the run stops (pre-registered abort rule).
 */
async function battery(): Promise<void> {
  const x = arg("x", "claude") as FacultyName;
  const y = arg("y", "azure") as FacultyName;
  for (const f of [x, y])
    if (!FACULTY_NAMES.includes(f))
      throw new Error(`--x/--y must be one of ${FACULTY_NAMES.join("|")}`);
  const nSeeds = Math.min(Number(arg("seeds", String(SEEDS.length))), SEEDS.length);
  // Smoke runs: one seed and a subset of arms (never used for a pre-registered battery).
  const only = arg("seed");
  const seeds =
    only === undefined ? SEEDS.slice(0, nSeeds) : SEEDS.filter((s) => s.seed === Number(only));
  const armFilter = arg("arms")?.split(",");
  const cap = Number(arg("cap", "25"));
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const out = arg("out") ?? join(repoRoot(), ".build", "evidence", `battery-${stamp}`);
  mkdirSync(out, { recursive: true });
  const env = loadEnv();
  const head = execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: repoRoot() })
    .toString()
    .trim();
  const { dir, at } = await setupFork();
  const results: ArmResult[] = [];
  let arms: ArmName[] = ARMS.filter((a) => !armFilter || armFilter.includes(a));
  let maxSeedCost = 0;
  let stopped: string | undefined;
  for (const [i, seed] of seeds.entries()) {
    const [X, Y] = seed.seed % 2 === 0 ? [x, y] : [y, x];
    const batch = await Promise.all(
      arms.map((arm) =>
        runArm({
          src: dir,
          at,
          arm,
          seed,
          X: () => makeFaculty(X, env),
          Y: () => makeFaculty(Y, env),
          keep: true,
        }),
      ),
    );
    for (const { dir: kept, ...r } of batch) {
      // Every arm's records are kept beside the results (git-ignored), so any finding can be traced.
      if (kept) {
        cpSync(kept, join(out, "arms", `seed-${r.seed}-${r.arm}`), { recursive: true });
        rmSync(kept, { recursive: true, force: true });
      }
      results.push(r);
      appendFileSync(join(out, "runs.jsonl"), `${JSON.stringify(r)}\n`);
      console.error(
        `seed ${seed.seed} ${r.arm.padEnd(4)} ${r.x.split("/")[1]}->${r.y.split("/")[1]} ` +
          `${r.score.outcome} CR1=${r.score.CR1} CR3=${r.score.CR3} CR3b=${r.score.CR3b} ` +
          `CR5=${r.score.CR5} CR7=${r.score.CR7} rej=${r.rejections} $${r.costUsd} ${r.seconds}s` +
          (r.escalation ? ` ESC: ${r.escalation.slice(0, 120)}` : ""),
      );
    }
    const spent = results.reduce((s, r) => s + r.costUsd, 0);
    const seedCost = batch.reduce((s, r) => s + r.costUsd, 0);
    maxSeedCost = Math.max(maxSeedCost, seedCost / batch.length);
    const remaining = seeds.length - (i + 1);
    const project = (n: number) => spent + maxSeedCost * n * remaining;
    if (project(arms.length) > cap && arms.includes("A_X2"))
      arms = arms.filter((a) => a !== "A_X2");
    if (remaining && project(arms.length) > cap) {
      stopped = `projected $${project(arms.length).toFixed(2)} exceeds cap $${cap} after seed ${seed.seed}`;
      break;
    }
  }
  rmSync(dir, { recursive: true, force: true });
  const summary = {
    battery: "cognitive-resume (forked control)",
    head,
    scorer: scorerHash(),
    x,
    y,
    seeds: seeds.map((s) => s.seed),
    arms,
    cap,
    stopped: stopped ?? null,
    sampling: {
      claude: {
        models: "opus = claude-opus-5-5, sonnet = claude-sonnet-5-5, claude = UCI_CLAUDE_MODEL",
        effort: env["UCI_CLAUDE_EFFORT"] ?? "medium",
        output: "prompted schema; no temperature (rejected by the model); fallbacks default",
      },
      azure: {
        deployment: env["AZURE_OPENAI_CHAT_DEPLOYMENT"] ?? "gpt-4.1-mini",
        temperature: 0,
        output: "strict json_schema",
      },
    },
    ...evaluate(results),
  };
  writeFileSync(join(out, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
  console.log(JSON.stringify(summary, null, 2));
}

async function main(): Promise<void> {
  const command = process.argv[2];
  if (command === "battery") return battery();
  if (command === "migrate") {
    // Postgres schema for the causal store; the URL defaults to the repository .env's SUPABASE_DB_URL.
    const url = arg("url") ?? loadEnv()["SUPABASE_DB_URL"];
    if (!url) throw new Error("migrate needs --url (or SUPABASE_DB_URL in .env)");
    const report = await PostgresCausalStore.migrateSchema(url, arg("schema", "uci"));
    console.log(JSON.stringify(report));
    return;
  }
  const processId = arg("process", "P1") ?? "P1";
  const maxSteps = Number(arg("steps", "40"));
  const facultyName = arg("faculty", "scripted") as FacultyName;
  if (command !== "inspect" && !FACULTY_NAMES.includes(facultyName))
    throw new Error(`--faculty must be one of ${FACULTY_NAMES.join("|")}`);
  const dir = arg("dir") ?? mkdtempSync(join(tmpdir(), "uci-run-"));
  const rt = await openRuntime(dir, systemClock);
  const log = (o: StepOutcome) =>
    console.error(`step ${o.step}: ${o.status}${o.detail ? ` — ${o.detail.slice(0, 160)}` : ""}`);
  try {
    if (command === "run" || command === "spike") {
      const faculty = makeFaculty(facultyName);
      const handle = await start(rt, processId, `cli-${process.pid}`);
      const started = Date.now();
      const outcome = await drive(() => runStep({ handle, faculty, env: rt.env }), maxSteps, log);
      const records = await rt.store.read(processStream(processId));
      const { mismatches } = await rederive(rt.store, records);
      const deliveries = [...rt.env.channel.keyCounts().values()];
      console.log(
        JSON.stringify(
          {
            faculty: `${faculty.id}/${faculty.model}`,
            dir,
            seconds: Math.round((Date.now() - started) / 1000),
            ...summarize(records, outcome.status),
            derivabilityMismatches: mismatches.length,
            duplicateDeliveries: deliveries.filter((n) => n > 1).length,
          },
          null,
          2,
        ),
      );
    } else if (command === "resume") {
      const faculty = makeFaculty(facultyName);
      const { handle } = await resume(rt, processId, `cli-${process.pid}`, faculty);
      const outcome = await drive(() => runStep({ handle, faculty, env: rt.env }), maxSteps, log);
      console.log(
        JSON.stringify(
          summarize(await rt.store.read(processStream(processId)), outcome.status),
          null,
          2,
        ),
      );
    } else if (command === "inspect") {
      const records = await rt.store.read(processStream(processId));
      console.log(JSON.stringify(summarize(records, "inspected"), null, 2));
    } else {
      console.error(
        "usage: uci run|resume|inspect|spike --faculty <name> [--dir D] [--steps N] [--process P]",
      );
      process.exitCode = 2;
    }
  } finally {
    await rt.close();
  }
}

await main();
