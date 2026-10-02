// Diagnostic: run one uninterrupted process and print its decision trace (not a test).
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ScriptedTutorFaculty } from "@uci/env-tutor";
import { processStream } from "@uci/harness";
import { ManualClock } from "@uci/kernel";
import { openRuntime, runUntilDone, start } from "../../src/index.js";

const dir = mkdtempSync(join(tmpdir(), "uci-trace-"));
const rt = await openRuntime(dir, new ManualClock());
const handle = await start(rt, "P1", "w");
await runUntilDone({ handle, faculty: new ScriptedTutorFaculty(), env: rt.env }, 40);
for (const r of await rt.store.read(processStream("P1"))) {
  const d = r.data as Record<string, unknown>;
  if (r.kind === "decision.made")
    console.log(
      r.seq,
      "DECISION",
      d["decisionId"],
      "|",
      d["choice"],
      "| relies",
      JSON.stringify(d["reliesOn"]),
      d["reexamines"] ? `| reexamines ${JSON.stringify(d["reexamines"])}` : "",
      d["resolves"] ? `| resolves ${d["resolves"]}` : "",
    );
  else if (r.kind === "decision.opened")
    console.log(r.seq, "OPENED  ", d["decisionId"], d["question"]);
  else if (r.kind === "claim.asserted")
    console.log(
      r.seq,
      "CLAIM   ",
      d["claimKind"],
      d["claimId"],
      `v${d["version"]}`,
      d["origin"],
      d["standing"],
      d["outcome"] ?? "",
      "|",
      d["proposition"],
    );
  else if (r.kind === "input.delivered")
    console.log(
      r.seq,
      "INPUT   ",
      d["inputId"],
      d["inReplyTo"] ?? "",
      (await rt.store.getEvidence("L1", d["evidenceHash"] as string))?.content,
    );
  else if (r.kind === "question.opened" || r.kind === "question.closed")
    console.log(r.seq, r.kind.toUpperCase(), JSON.stringify(d));
  else if (r.kind === "process.concluded") console.log(r.seq, "CONCLUDED", JSON.stringify(d));
}
console.log("deliveries per key:", JSON.stringify([...rt.env.channel.keyCounts()]));
await rt.close();
rmSync(dir, { recursive: true, force: true });
