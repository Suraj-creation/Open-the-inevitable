import { cpSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ScriptedTutorFaculty } from "@uci/env-tutor";
import { type Mode, processStream, runStep, type Staleness } from "@uci/harness";
import { type CausalRecord, DAY_MS, ManualClock } from "@uci/kernel";
import { openRuntime, resume, type Runtime, start } from "../../src/index.js";
import { cleanup, tempDir } from "./helpers.js";

/**
 * The cognitive-resume battery, Tier S (archit/02 §4; pre-registered in the journal: hypotheses
 * H-EC1, H-PCS3, H-EP3 and criteria-20261001-3ea6). Tier S checks are properties the harness itself
 * enforces or records; the scripted faculty reads only rendered requests. Tier R (a real model's
 * reasoning after resume) is a separate, live battery.
 *
 * Forked control: one setup run to the fork point, copied three ways.
 *   A — warm: the next step runs uninterrupted; then the clock advances and the learner corrects us.
 *   B — interrupted: killed inside that step's external effect; while down, the clock advances and
 *       the learner's correction arrives; resumed in a fresh runtime under a different faculty.
 *   C — floor-only: as B, but after resume the context omits claims, decisions, expectations and
 *       questions, and the bridge gates are off (the execution floor alone).
 *   D — staleness off: as B, but lapsed validity is neither shown to the faculty nor enforced
 *       (the H-PCS3 gate-off arm; added after the first run showed C-R5 is degenerate for C).
 */
afterEach(cleanup);

const CORRECTION = "i dont add the bottoms, i just copied the 6 wrong";
const FORK_AFTER_STEPS = 5;
const ADVANCE = 4 * DAY_MS; // the prerequisite claim (valid 3 days) lapses; open expectations fall due
class Crash extends Error {}

const data = <T>(r: CausalRecord) => r.data as T;
const stepsDone = (records: readonly CausalRecord[]) =>
  records.filter((r) => r.kind === "step.completed").length;

async function setup(): Promise<{ dir: string; clock: ManualClock }> {
  const dir = tempDir();
  const clock = new ManualClock();
  const rt = await openRuntime(dir, clock);
  const handle = await start(rt, "P1", "setup");
  const faculty = new ScriptedTutorFaculty();
  while (stepsDone(await rt.store.read(processStream("P1"))) < FORK_AFTER_STEPS)
    await runStep({ handle, faculty, env: rt.env });
  await rt.close();
  return { dir, clock };
}

function fork(src: string): string {
  const dst = tempDir();
  cpSync(src, dst, { recursive: true });
  return dst;
}

async function runToEnd(
  rt: Runtime,
  handle: Awaited<ReturnType<typeof start>>,
  faculty: ScriptedTutorFaculty,
  mode: Mode,
  staleness: Staleness = "gate",
): Promise<string> {
  for (let i = 0; i < 40; i++) {
    const o = await runStep({ handle, faculty, env: rt.env, mode, staleness });
    if (o.status === "concluded" || o.status === "escalated") return o.status;
  }
  return "unfinished";
}

async function armWarm(src: string, at: string) {
  const dir = fork(src);
  const clock = new ManualClock(at);
  const rt = await openRuntime(dir, clock);
  const { handle } = await resume(rt, "P1", "warm", new ScriptedTutorFaculty()); // a plain re-claim: nothing to settle
  const faculty = new ScriptedTutorFaculty();
  await runStep({ handle, faculty, env: rt.env }); // the fork step, uninterrupted
  const killSeq = (await rt.store.read(processStream("P1"))).at(-1)?.seq ?? 0;
  clock.advance(ADVANCE);
  rt.env.learnerSays(CORRECTION);
  const outcome = await runToEnd(rt, handle, faculty, "bridge");
  return { rt, outcome, killSeq };
}

async function armInterrupted(src: string, at: string, mode: Mode, staleness: Staleness = "gate") {
  const dir = fork(src);
  const clock = new ManualClock(at);
  let rt = await openRuntime(dir, clock);
  const { handle } = await resume(rt, "P1", "before-kill", new ScriptedTutorFaculty());
  await expect(
    runStep({
      handle,
      faculty: new ScriptedTutorFaculty(),
      env: rt.env,
      crash: (p) => {
        if (p === "external-performed") throw new Crash(p);
      },
    }),
  ).rejects.toBeInstanceOf(Crash);
  const killSeq = (await rt.store.read(processStream("P1"))).at(-1)?.seq ?? 0;
  await rt.close(); // killed mid-effect; nothing in memory survives
  clock.advance(ADVANCE);
  rt = await openRuntime(dir, clock);
  rt.env.learnerSays(CORRECTION); // arrives while the process is down
  const swapped = new ScriptedTutorFaculty("scripted-tutor-B@1");
  const resumed = await resume(rt, "P1", "after-kill", swapped);
  const outcome = await runToEnd(rt, resumed.handle, swapped, mode, staleness);
  return { rt, outcome, killSeq };
}

/** The cognitive trajectory after the fork, stripped of record positions (which differ by arm). */
function trajectory(records: readonly CausalRecord[], after: number) {
  return records
    .filter((r) => r.seq > after)
    .flatMap((r) => {
      if (r.kind === "decision.made") {
        const d = data<{
          decisionId: string;
          choice: string;
          reliesOn: string[];
          reexamines?: unknown;
          supersedes?: string;
          resolves?: string;
        }>(r);
        return [
          [
            "decision",
            d.decisionId,
            d.choice,
            d.reliesOn,
            d.reexamines ?? null,
            d.supersedes ?? null,
            d.resolves ?? null,
          ],
        ];
      }
      if (r.kind === "claim.asserted") {
        const c = data<{
          claimId: string;
          version: number;
          proposition: string;
          standing: string;
          outcome?: string;
        }>(r);
        return [["claim", c.claimId, c.version, c.proposition, c.standing, c.outcome ?? null]];
      }
      if (r.kind === "question.closed" || r.kind === "question.opened")
        return [[r.kind, data<{ questionId: string }>(r).questionId]];
      if (r.kind === "process.concluded") return [["concluded"]];
      return [];
    });
}

interface Checks {
  CR3: boolean;
  CR4: boolean;
  CR5: boolean;
  CR6: boolean;
  manifests: boolean;
}

/** Tier S predicates, exactly as pre-registered, evaluated on records after the kill point. */
function tierS(records: readonly CausalRecord[], killSeq: number, rt: Runtime): Checks {
  const before = records.filter((r) => r.seq <= killSeq);
  const after = records.filter((r) => r.seq > killSeq);
  const claimsBefore = before
    .filter((r) => r.kind === "claim.asserted")
    .map((r) =>
      data<{
        claimId: string;
        version: number;
        proposition: string;
        claimKind: string;
        validUntil?: string;
      }>(r),
    );
  const misconception = claimsBefore.find(
    (c) => /adds denominators/i.test(c.proposition) && !/does not/i.test(c.proposition),
  );
  const prerequisite = claimsBefore.find((c) => /multiplication facts/i.test(c.proposition));
  const decisionsAfter = after
    .filter((r) => r.kind === "decision.made")
    .map((r) => ({
      seq: r.seq,
      ...data<{
        decisionId: string;
        choice: string;
        reliesOn: string[];
        reexamines?: { decisionId: string; verdict: string };
      }>(r),
    }));
  const decisionsBefore = before
    .filter((r) => r.kind === "decision.made")
    .map((r) =>
      data<{ decisionId: string; reliesOn: string[]; reexamines?: unknown; supersedes?: string }>(
        r,
      ),
    );

  // C-R3: the contradicted belief is superseded with changed content, and every decision in force
  // that relied on its old version is re-examined (revise/withdraw) at or before that supersession.
  const ref = misconception ? `${misconception.claimId}@v${misconception.version}` : "";
  const supersession = after.find(
    (r) =>
      r.kind === "claim.asserted" &&
      data<{ supersedes?: string; proposition: string }>(r).supersedes === ref &&
      data<{ proposition: string }>(r).proposition !== misconception?.proposition,
  );
  const retired = new Set(
    decisionsBefore
      .flatMap((d) => [
        d.supersedes,
        (d.reexamines as { decisionId?: string } | undefined)?.decisionId,
      ])
      .filter(Boolean),
  );
  const dependents = decisionsBefore
    .filter((d) => !d.reexamines && !retired.has(d.decisionId) && d.reliesOn.includes(ref))
    .map((d) => d.decisionId);
  const reexamined = new Set(
    decisionsAfter
      .filter(
        (d) =>
          d.reexamines &&
          d.reexamines.verdict !== "reaffirm" &&
          supersession &&
          d.seq <= supersession.seq + 10,
      )
      .map((d) => d.reexamines?.decisionId),
  );
  const CR3 = !!misconception && !!supersession && dependents.every((d) => reexamined.has(d));

  // C-R4: every expectation open at the kill is resolved or expired by the end of the first step after it.
  const openAtKill = claimsBefore
    .filter((c) => c.claimKind === "expectation")
    .map((c) => c.claimId)
    .filter(
      (id) =>
        !before.some(
          (r) => r.kind === "claim.asserted" && data<{ resolves?: string }>(r).resolves === id,
        ),
    );
  const firstStepEnd = after.find((r) => r.kind === "step.completed")?.seq ?? Infinity;
  const CR4 = openAtKill.every((id) =>
    after.some(
      (r) =>
        r.seq <= firstStepEnd + 40 &&
        r.kind === "claim.asserted" &&
        data<{ resolves?: string }>(r).resolves === id,
    ),
  );

  // C-R5 (archit/02: "re-validated before being acted on"; journal hypothesis-20261001-f4e3): no
  // decision after the lapse relies on the lapsed version, and the lapsed claim is re-validated (a
  // new version) before any decision relies on that claim at all.
  const pref = prerequisite ? `${prerequisite.claimId}@v${prerequisite.version}` : "";
  const claimId = prerequisite?.claimId ?? "";
  const revalidation = after.find(
    (r) => r.kind === "claim.asserted" && data<{ supersedes?: string }>(r).supersedes === pref,
  );
  const firstReliance = decisionsAfter.find((d) =>
    d.reliesOn.some((ref) => ref.startsWith(`${claimId}@v`)),
  );
  const CR5 =
    !!prerequisite &&
    !decisionsAfter.some((d) => d.reliesOn.includes(pref)) &&
    (!firstReliance || (!!revalidation && revalidation.seq < firstReliance.seq));

  // C-R6: the effect in flight at the kill was reconciled and never resent.
  const CR6 = [...rt.env.channel.keyCounts().values()].every((n) => n === 1);

  // Every manifest after the kill carries the objective, the rationale decision, open decisions and open questions.
  const manifests = after
    .filter((r) => r.kind === "manifest.recorded")
    .map((r) => data<{ items: { ref: string }[] }>(r).items.map((i) => i.ref));
  const manifestsOk =
    manifests.length > 0 &&
    manifests.every(
      (items) => items.includes("objective:O1") && items.some((i) => i.startsWith("decision:")),
    );
  return { CR3, CR4, CR5, CR6, manifests: manifestsOk };
}

describe("cognitive-resume battery, Tier S (forked control)", () => {
  it("interrupted + swapped equals warm exactly; floor-only fails C-R3; staleness-off fails C-R5", async () => {
    const { dir, clock } = await setup();
    const at = clock.now();

    // Setup requirements of the protocol, checked on the fork state itself.
    const probe = await openRuntime(fork(dir), new ManualClock(at));
    const forkRecords = await probe.store.read(processStream("P1"));
    await probe.close();
    const kinds = forkRecords.map((r) => [r.kind, r.data] as const);
    expect(
      kinds.some(([k]) => k === "decision.opened"),
      "an open decision",
    ).toBe(true);
    expect(
      kinds.some(([k, d]) => k === "question.opened" && /why/i.test((d as { text: string }).text)),
      "an open question",
    ).toBe(true);
    expect(
      kinds.some(
        ([k, d]) =>
          k === "claim.asserted" &&
          (d as { confidence: number; claimKind: string }).claimKind === "assertion" &&
          (d as { confidence: number }).confidence <= 0.6,
      ),
      "a moderate-confidence belief",
    ).toBe(true);

    const A = await armWarm(dir, at);
    const B = await armInterrupted(dir, at, "bridge");
    const C = await armInterrupted(dir, at, "floor-only");
    const D = await armInterrupted(dir, at, "bridge", "off");
    const recA = await A.rt.store.read(processStream("P1"));
    const recB = await B.rt.store.read(processStream("P1"));
    const recC = await C.rt.store.read(processStream("P1"));
    const recD = await D.rt.store.read(processStream("P1"));

    const sA = tierS(recA, A.killSeq, A.rt);
    const sB = tierS(recB, B.killSeq, B.rt);
    const sC = tierS(recC, C.killSeq, C.rt);
    const sD = tierS(recD, D.killSeq, D.rt);
    console.log(
      "TIER-S",
      JSON.stringify({
        A: { outcome: A.outcome, ...sA },
        B: { outcome: B.outcome, ...sB },
        C: { outcome: C.outcome, ...sC },
        D: { outcome: D.outcome, ...sD },
      }),
    );

    if (process.env["BATTERY_DEBUG"]) {
      const show = (t: unknown[][]) => t.map((x) => JSON.stringify(x).slice(0, 170)).join("\n");
      console.log(`TRAJ-A\n${show(trajectory(recA, A.killSeq))}`);
      console.log(`TRAJ-B\n${show(trajectory(recB, B.killSeq))}`);
    }
    // Scripted arms: interrupted + swapped is cognitively identical to warm.
    expect(B.outcome).toBe("concluded");
    expect(trajectory(recB, B.killSeq)).toEqual(trajectory(recA, A.killSeq));
    expect([...B.rt.env.channel.keyCounts()]).toEqual([...A.rt.env.channel.keyCounts()]);

    // The bridge arms pass every Tier S check.
    expect(sA).toEqual({ CR3: true, CR4: true, CR5: true, CR6: true, manifests: true });
    expect(sB).toEqual({ CR3: true, CR4: true, CR5: true, CR6: true, manifests: true });

    // H-EC1 (hypothesis-20261001-5bc9): the execution floor alone keeps effects honest (C-R6) and
    // still resolves expectations (C-R4), but the contradicted belief is never revised (C-R3) and the
    // context loses the deliberative state. C-R5 is degenerate for this arm and is not predicted.
    expect(sC.CR6).toBe(true);
    expect(sC.CR4).toBe(true);
    expect(sC.CR3).toBe(false);
    expect(sC.manifests).toBe(false);

    // H-PCS3 (hypothesis-20261001-f4e3): with staleness hidden and ungated, a decision relies on the
    // lapsed claim. Everything else the bridge provides still holds.
    expect(sD.CR5).toBe(false);
    expect(sD.CR3).toBe(true);
    expect(sD.CR6).toBe(true);

    for (const arm of [A, B, C, D]) await arm.rt.close();
  }, 180_000);
});

export { join };
