#!/usr/bin/env node
/**
 * uci — run a durable tutoring process with a chosen faculty.
 *
 *   uci run     --faculty <scripted|claude|azure|gemini|openai> [--dir D] [--steps N] [--process P]
 *   uci resume  --faculty <name> --dir D [--steps N] [--process P]
 *   uci inspect --dir D [--process P]
 *   uci spike   --faculty <name> [--steps N]       one complete live run in a temp dir; JSON summary
 *
 * Credentials come from the repository's git-ignored .env; nothing here prints a secret.
 */
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { processStream, runStep, type StepOutcome } from "@uci/harness";
import { systemClock } from "@uci/kernel";
import { FACULTY_NAMES, type FacultyName, makeFaculty } from "./faculty-config.js";
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

async function main(): Promise<void> {
  const command = process.argv[2];
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
