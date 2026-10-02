import { afterEach, describe, expect, it } from "vitest";
import { ScriptedTutorFaculty } from "@uci/env-tutor";
import {
  compileContext,
  compileWorkingState,
  type FacultyRequest,
  type FacultyResponse,
  MAX_STEPS_AFTER_ACCEPTANCE,
  type ModelFaculty,
  type Mode,
  processStream,
  proposalDrafts,
  runStep,
  validateProposal,
  type ValidationContext,
} from "@uci/harness";
import { type CausalRecord, DAY_MS, ManualClock } from "@uci/kernel";
import { openRuntime, runUntilDone, start } from "../../src/index.js";
import { rederive } from "../../src/inspect.js";
import { cleanup, tempDir } from "./helpers.js";

/**
 * The harness contract fixes from the Tier R diagnosis (journal verdict-20261002-9813): what each
 * mode shows, what a proposal may cite, the recorded acceptance verdict, supervision, and rejection
 * messages that state the recovery.
 */
afterEach(cleanup);
const data = <T>(r: CausalRecord) => r.data as T;

/** Scripted run to the state Tier R forks from: decisions in force rely on the misconception claim. */
async function forkState(steps = 5) {
  const clock = new ManualClock();
  const rt = await openRuntime(tempDir(), clock);
  const handle = await start(rt, "P1", "w");
  const faculty = new ScriptedTutorFaculty();
  while (
    (await rt.store.read(processStream("P1"))).filter((r) => r.kind === "step.completed").length <
    steps
  )
    await runStep({ handle, faculty, env: rt.env });
  const records = await rt.store.read(processStream("P1"));
  return { rt, clock, handle, records };
}

const proposal = (extra: Record<string, unknown>) =>
  JSON.stringify({
    restatement: { objective_id: "O1", why: "mastery" },
    reexamines: [],
    decision: { choice: "practice i-4", alternatives: [], relies_on: [], rationale: "r" },
    action: { type: "practice", item_id: "i-4" },
    expectation: { statement: "correct", probability: 0.6 },
    claims: [],
    questions_closed: [],
    ...extra,
  });

async function context(rt: Awaited<ReturnType<typeof forkState>>["rt"], mode: Mode, at: string) {
  const records = await rt.store.read(processStream("P1"));
  const ws = await compileWorkingState(rt.store, records, at);
  const vc: ValidationContext = {
    ws,
    mode,
    actions: rt.env.actions.map((a) => a.name),
    practiceItemIds: rt.env.practiceItems().map((p) => p.itemId),
    acceptanceMet: false,
  };
  return { ws, vc, ctx: compileContext(ws, { id: "t", model: "t" }, mode) };
}

describe("what each mode shows", () => {
  it("floor-only shows no transcript and no bridge state; transcript adds only the transcript", async () => {
    const { rt, clock } = await forkState();
    const bridge = await context(rt, "bridge", clock.now());
    const floor = await context(rt, "floor-only", clock.now());
    const transcript = await context(rt, "transcript", clock.now());
    for (const c of [floor, transcript]) {
      expect(c.ctx.request.prompt).not.toContain("## Claims (current)");
      expect(c.ctx.request.prompt).not.toContain("## Decisions in force");
    }
    expect(floor.ctx.request.prompt).not.toContain("## Transcript");
    expect(floor.ctx.request.prompt).not.toMatch(/C\d+-\d+@v\d+/);
    expect(floor.ctx.items.some((i) => i.ref.startsWith("output:"))).toBe(false);
    expect(
      floor.ctx.exclusions.some((e) => e.reason === "ablation: floor-only arm (no transcript)"),
    ).toBe(true);
    expect(transcript.ctx.request.prompt).toContain(
      "## Transcript (your previous outputs, verbatim)",
    );
    expect(transcript.ctx.items.some((i) => i.ref.startsWith("output:"))).toBe(true);
    expect(bridge.ctx.request.prompt).not.toContain("## Transcript");
    await rt.close();
  });
});

describe("what a proposal may cite", () => {
  it("outside bridge mode claims are not citable and revises takes no effect", async () => {
    const { rt, clock } = await forkState();
    const { ws, vc } = await context(rt, "transcript", clock.now());
    const claim = ws.claims.find((c) => /adds denominators/.test(c.value.data.proposition));
    expect(claim).toBeDefined();
    const ref = claim?.id ?? "";
    const input = ws.inputs.at(-1)?.id ?? "";

    const citesClaim = validateProposal(
      proposal({ claims: [{ subject: "L1", proposition: "x", confidence: 0.5, evidence: [ref] }] }),
      vc,
    );
    expect("errors" in citesClaim && citesClaim.errors.join()).toMatch(
      /claim evidence C\d+-\d+@v\d+ is not in the working state: cite inputs \(I…\) or observations \(X…\)/,
    );

    const revises = validateProposal(
      proposal({
        claims: [
          {
            subject: "L1",
            proposition: "does not add denominators",
            confidence: 0.8,
            evidence: [input],
            revises: ref,
          },
        ],
      }),
      vc,
    );
    expect("proposal" in revises).toBe(true);
    if (!("proposal" in revises)) return;
    const drafts = proposalDrafts(revises.proposal, {
      ws,
      mode: "transcript",
      step: ws.step,
      stream: "process/P1",
      model: "t",
      outputRef: "rec:process/P1#1",
      actionKey: "action:x",
      authorityRef: "rec:process/P1#1",
    });
    const asserted = drafts.filter(
      (d) =>
        d.kind === "claim.asserted" &&
        data<{ claimKind: string }>(d as never).claimKind === "assertion",
    );
    expect(asserted).toHaveLength(1);
    expect((asserted[0]?.data as { supersedes?: string }).supersedes).toBeUndefined();
    await rt.close();
  });

  it("a rejection states the recovery: revising a relied-on claim names the reexamines entry to add", async () => {
    const { rt, clock } = await forkState();
    const { ws, vc } = await context(rt, "bridge", clock.now());
    const claim = ws.claims.find((c) => /adds denominators/.test(c.value.data.proposition));
    const dependent = ws.decisionsInForce.find((d) => d.value.reliesOn.includes(claim?.id ?? ""));
    expect(dependent).toBeDefined();
    const r = validateProposal(
      proposal({
        claims: [
          {
            subject: "L1",
            proposition: "The learner does not add denominators.",
            confidence: 0.8,
            evidence: [ws.inputs.at(-1)?.id ?? ""],
            revises: claim?.id,
          },
        ],
      }),
      vc,
    );
    expect("errors" in r && r.errors.join()).toContain(
      `revising ${claim?.id} changes a premise of ${dependent?.id}: add {"decision_id": "${dependent?.id}", "verdict": "reaffirm|revise|withdraw", "reason": "..."} to reexamines in this same proposal`,
    );
    await rt.close();
  });

  it("relying on a stale claim names how to re-validate it", async () => {
    const { rt, clock } = await forkState();
    clock.advance(4 * DAY_MS);
    const { ws, vc } = await context(rt, "bridge", clock.now());
    const stale = ws.claims.find((c) => c.value.stale);
    expect(stale).toBeDefined();
    const r = validateProposal(
      proposal({
        reexamines: ws.decisionsInForce
          .filter((d) => d.value.revised.length)
          .map((d) => ({ decision_id: d.id, verdict: "reaffirm", reason: "r" })),
        decision: { choice: "c", alternatives: [], relies_on: [stale?.id], rationale: "r" },
      }),
      vc,
    );
    expect("errors" in r && r.errors.join()).toContain(
      `relies on ${stale?.id}, which is STALE: re-validate it first (a claim with revises "${stale?.id}", citing evidence) or leave it out of relies_on`,
    );
    await rt.close();
  });
});

describe("the acceptance verdict", () => {
  it("is recorded atomically with the probe resolution that decides it, shown to the faculty, and gates conclude", async () => {
    const rt = await openRuntime(tempDir(), new ManualClock());
    const handle = await start(rt, "P1", "w");
    const outcome = await runUntilDone({
      handle,
      faculty: new ScriptedTutorFaculty(),
      env: rt.env,
    });
    expect(outcome.status).toBe("concluded");
    const records = await rt.store.read(processStream("P1"));
    const verdicts = records.filter((r) => r.kind === "acceptance.evaluated");
    const met = verdicts.find((r) => data<{ met: boolean }>(r).met);
    expect(met).toBeDefined();
    const deciding = records.findLast(
      (r) =>
        r.seq < (met?.seq ?? 0) &&
        r.kind === "claim.asserted" &&
        data<{ method?: string }>(r).method === "answer-key:probe",
    );
    expect(deciding?.seq).toBe((met?.seq ?? 0) - 1);
    const { prompts, mismatches } = await rederive(rt.store, records);
    expect(mismatches).toEqual([]);
    expect(prompts.at(-1)).toContain("Acceptance verdict (environment env-tutor@1): MET");
    expect(prompts.at(-1)).toContain(
      "MET. The objective's acceptance holds; conclude is now permitted.",
    );
    const lastManifest = records.findLast((r) => r.kind === "manifest.recorded");
    expect(
      data<{ items: { ref: string }[] }>(lastManifest as CausalRecord).items.some((i) =>
        i.ref.startsWith("acceptance:"),
      ),
    ).toBe(true);
    await rt.close();
  });
});

/** Behaves like the scripted reasoner, but never concludes: it keeps assessing. */
class NeverConcludes implements ModelFaculty {
  readonly id = "never-concludes@1";
  readonly model = "never-concludes@1";
  private readonly inner = new ScriptedTutorFaculty();
  async respond(request: FacultyRequest): Promise<FacultyResponse> {
    const r = await this.inner.respond(request);
    const p = JSON.parse(r.text) as { action: { type: string }; expectation?: unknown };
    if (p.action.type !== "conclude") return r;
    p.action = { type: "assess" };
    p.expectation = { statement: "correct", probability: 0.9 };
    return { ...r, text: JSON.stringify(p) };
  }
}

describe("supervision", () => {
  it(`holds a process for a person ${MAX_STEPS_AFTER_ACCEPTANCE} steps after acceptance is met without conclude`, async () => {
    const rt = await openRuntime(tempDir(), new ManualClock());
    const handle = await start(rt, "P1", "w");
    const outcome = await runUntilDone({ handle, faculty: new NeverConcludes(), env: rt.env });
    expect(outcome.status).toBe("escalated");
    const records = await rt.store.read(processStream("P1"));
    const escalated = records.find((r) => r.kind === "process.escalated");
    expect(data<{ reason: string }>(escalated as CausalRecord).reason).toMatch(
      /^supervision: acceptance verdict MET/,
    );
    expect(records.some((r) => r.kind === "process.concluded")).toBe(false);
    await rt.close();
  });
});
