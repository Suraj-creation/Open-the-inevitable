/**
 * M11 T1 live smoke (CSE-016, ADR-0049) — Creative Cognition through the gateway's SourceHub (the
 * website backend), with a REAL Gemini model. Proves the no-ghostwriter law empirically: the system
 * offers the four disclosed assists (scaffold | critique | provocation | reference) over the learner's
 * OWN draft, and NONE of them is — or can carry — the artifact. Every assist is structure / findings /
 * questions / refs; there is no prose field for a model to ghostwrite into; the learner's draft is
 * never modified by the system.
 *
 * Run from the repo ROOT: `npx tsx apps/api/scripts/m11-creation-smoke.ts` (needs GEMINI_API_KEY in .env).
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { GeminiModelRuntime } from "@inevitable/adapters";
import { SourceHub } from "../src/sources";

function loadEnv(): void {
  const file = resolve(process.cwd(), ".env");
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 0) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
      v = v.slice(1, -1);
    if (k && process.env[k] === undefined) process.env[k] = v;
  }
}

function fail(msg: string): never {
  console.error(`FAIL ${msg}`);
  process.exit(1);
}

// A field on an assist that would let it BE the artifact — the no-ghostwriter law forbids all of them.
const FORBIDDEN_FIELDS = ["prose", "content", "draft", "text", "body", "essay", "answer"];

async function main(): Promise<void> {
  loadEnv();
  const apiKey = process.env["GEMINI_API_KEY"];
  if (!apiKey) fail("GEMINI_API_KEY not set (repo-root .env)");
  const connected = await GeminiModelRuntime.connect({ apiKey });
  if (!connected.ok) fail(`Gemini connect failed: ${connected.error.message}`);

  const hub = new SourceHub();
  hub.enableFusionCognition(connected.value, "gemini");

  // The learner's OWN words — authored, never generated. The system must never touch this.
  const learnerDraft =
    "Gradient descent walks downhill on the loss surface. I think the learning rate is the most " +
    "important knob, but I'm not sure why exactly.";
  const creation = await hub.startCreation({
    kind: "essay",
    title: "Why the learning rate matters most",
    conceptRefs: ["gradient-descent", "learning-rate"],
    draft: learnerDraft,
    learnerCid: "learner-smoke",
  });
  console.log(
    `1 CREATION: ${creation.creation_id} | kind=${creation.kind} | status=${creation.status}`,
  );
  console.log(`   draft (learner's words): "${creation.draft.slice(0, 60)}…"`);

  const modes = ["scaffold", "critique", "provocation", "reference"] as const;
  let current = creation;
  for (const mode of modes) {
    const updated = await hub.assistCreation(current.creation_id, mode, current.draft);
    if (!updated) fail(`assist ${mode} returned null`);
    current = updated;
    const assist = updated.assists.at(-1)!;

    // Law 1 — disclosed, attributed.
    if (assist.disclosed !== true) fail(`${mode} assist not disclosed`);
    if (assist.agent_cid !== "agent.creation") fail(`${mode} assist wrong agent_cid`);

    // Law 2 — structural no-ghostwriter: the assist has NO field that could hold the artifact.
    for (const forbidden of FORBIDDEN_FIELDS) {
      if (forbidden in (assist as Record<string, unknown>)) {
        fail(`${mode} assist carries a forbidden artifact field "${forbidden}"`);
      }
    }

    // Law 3 — the right shape for the mode.
    let shape = "";
    if (mode === "scaffold") {
      if (!assist.slots || assist.slots.length === 0) fail("scaffold produced no slots");
      shape = `${assist.slots.length} slots: ${assist.slots.map((s) => s.label).join(", ")}`;
    } else if (mode === "critique") {
      if (!Array.isArray(assist.findings)) fail("critique produced no findings array");
      shape = `${assist.findings.length} findings`;
    } else if (mode === "provocation") {
      if (!assist.questions || assist.questions.length === 0)
        fail("provocation produced no questions");
      shape = `${assist.questions.length} questions; e.g. "${assist.questions[0]}"`;
    } else {
      if (!assist.refs) fail("reference produced no refs array");
      shape = `${assist.refs.length} refs`;
    }
    console.log(`2 ASSIST [${mode}] degraded=${assist.degraded ?? false} → ${shape}`);

    // Law 4 — the learner's draft is NEVER modified by the system.
    if (updated.draft !== learnerDraft) fail(`the system modified the learner's draft on ${mode}!`);
  }

  const completed = await hub.completeCreation(current.creation_id, learnerDraft);
  if (!completed) fail("completeCreation returned null");
  if (completed.status !== "completed") fail("creation not marked completed");
  if (completed.draft !== learnerDraft) fail("completion altered the learner's draft");
  console.log(
    `3 COMPLETE: status=${completed.status} | assists=${completed.assists.length} | draft intact=${completed.draft === learnerDraft}`,
  );

  // At least one assist must be genuinely model-backed (not the deterministic fallback) — else this
  // isn't a live proof. Scaffold/provocation degrade rarely; require at least one non-degraded assist.
  const modelBacked = completed.assists.some((a) => a.degraded !== true);
  if (!modelBacked) fail("every assist was degraded — the model path did not run");

  console.log(
    "M11 CREATION LIVE SMOKE: PASSED (four disclosed assists, model-backed, no-ghostwriter law " +
      "structural — no assist is or carries the artifact; the learner's draft was never touched)",
  );
}

main().catch((cause) => {
  console.error("FAIL", cause);
  process.exit(1);
});
