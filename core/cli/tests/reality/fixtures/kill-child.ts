/**
 * Kill-test child: runs a durable process and, at the `external-performed` boundary of step N (the
 * action was delivered by the channel but not yet settled in the store), signals the parent and
 * blocks. The parent kills this OS process there.
 */
import { closeSync, openSync, writeSync } from "node:fs";
import { ScriptedTutorFaculty } from "@uci/env-tutor";
import { runStep } from "@uci/harness";
import { ManualClock } from "@uci/kernel";
import { openRuntime, start } from "../../../src/index.js";

const [dir, marker, stepArg] = process.argv.slice(2) as [string, string, string];
const killStep = Number(stepArg);
const rt = await openRuntime(dir, new ManualClock());
const handle = await start(rt, "P1", `child-${process.pid}`);
const faculty = new ScriptedTutorFaculty();
let step = 1;
for (;;) {
  const outcome = await runStep({
    handle,
    faculty,
    env: rt.env,
    crash: (point) => {
      if (point === "external-performed" && step === killStep) {
        const fd = openSync(marker, "w");
        writeSync(fd, "held");
        closeSync(fd);
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0);
      }
    },
  });
  if (outcome.status === "completed") step += 1;
  if (outcome.status === "concluded" || outcome.status === "escalated") break;
}
