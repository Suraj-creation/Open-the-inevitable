import {
  type AuthorityGranted,
  canonicalJson,
  type CausalRecord,
  type Draft,
  envelopePolicy,
  type EffectIntended,
  type EffectSettled,
  evidenceHash,
  foldLedger,
  govern,
  hashOf,
  type Ledger,
  POLICY_VERSION,
  refOf,
} from "@uci/kernel";
import { type ClaimAsserted, foldCognitiveState, openExpectations } from "@uci/substrate";
import {
  compileContext,
  compileWorkingState,
  type Mode,
  RENDERER_VERSION,
  type WorkingState,
} from "./compile.js";
import { type InputAdmitted, inboxStream } from "./admit.js";
import { type AcceptanceEvaluated, type InputDelivered, REQUEST_MEDIA_TYPE } from "./kinds.js";
import { FacultyError, type EnvironmentPack, type ModelFaculty } from "./ports.js";
import { parseProposal, type Proposal, proposalDrafts, validateProposal } from "./proposal.js";
import { type ProcessHandle, readProcess, write } from "./writer.js";

/**
 * One step of a durable cognitive process. Stateless: it reads the stream, does the next durable
 * thing, and writes it back. Every phase checks what this step already did, so a rerun after a crash
 * replays a recorded model output instead of regenerating it, never re-writes a recorded decision,
 * and never re-sends an action whose delivery is confirmed or unknown.
 */
export type CrashPoint =
  | "after-admission"
  | "after-verification"
  | "after-manifest"
  | "model-started"
  | "after-model-output"
  | "after-decision"
  | "external-started"
  | "external-performed"
  | "after-settle";

export interface StepDeps {
  readonly handle: ProcessHandle;
  readonly faculty: ModelFaculty;
  readonly env: EnvironmentPack;
  readonly mode?: Mode;
  /** "off" hides lapsed validity from the faculty and disables the gate (H-PCS3 arm D). Default "gate". */
  readonly staleness?: "gate" | "off";
  /** Test seam: called at each durable boundary; throwing here simulates a crash at that point. */
  readonly crash?: (point: CrashPoint) => void;
}

export type StepStatus = "completed" | "retry" | "concluded" | "escalated" | "denied";
export interface StepOutcome {
  readonly status: StepStatus;
  readonly step: number;
  readonly detail?: string;
}

const MAX_REJECTIONS_PER_STEP = 3;
/** Transport attempts per ask (retryable failures and crash-abandoned calls alike) before a person is asked. */
export const MAX_ATTEMPTS_PER_ASK = 8;
/**
 * Supervision (reads records, never the process's account of itself): once the environment's
 * acceptance verdict is MET, a process that completes this many further steps without concluding is
 * held for a person rather than left to spend its budget.
 */
export const MAX_STEPS_AFTER_ACCEPTANCE = 2;

export async function runStep(deps: StepDeps): Promise<StepOutcome> {
  const { handle: h } = deps;
  const mode = deps.mode ?? "bridge";
  const crash = deps.crash ?? (() => {});
  let records = await readProcess(h);
  const step = records.filter((r) => r.kind === "step.completed").length + 1;
  if (records.some((r) => r.kind === "process.concluded")) return { status: "concluded", step };
  if (records.some((r) => r.kind === "process.escalated")) return { status: "escalated", step };
  const unsettled = [...foldLedger(records).values()].filter((e) => !e.settled);
  if (unsettled.length)
    throw new Error(
      `unsettled effects ${unsettled.map((e) => e.intended.data.effectId).join(",")}: resume the process first`,
    );

  // A. Admission: inputs the channel admitted are delivered at this boundary, exactly once.
  await deliverInputs(deps, records);
  crash("after-admission");

  // B. Verification: resolve expectations whose answers arrived; expire overdue ones explicitly.
  await verifyAndExpire(deps, await readProcess(h));
  crash("after-verification");

  // C. A validated proposal for this step: already recorded, recorded-but-unapplied, or new.
  records = await readProcess(h);
  const decisionId = `D${step}`;
  let proposal: Proposal | undefined;
  const cog = foldCognitiveState(records);
  const made = cog.made.get(decisionId);
  if (made) {
    proposal = await recordedProposal(h, records, made);
  } else {
    const obtained = await obtainProposal(deps, records, step, mode);
    if (!obtained.proposal) return obtained.outcome;
    proposal = obtained.proposal;
  }
  crash("after-decision");

  // D. The action.
  if (proposal.action.type === "conclude") {
    records = await readProcess(h);
    const probes = foldCognitiveState(records);
    const resolutions = [...probes.claims.values()]
      .map((v) => v.at(-1))
      .filter((c): c is CausalRecord<ClaimAsserted> => c?.data.method === "answer-key:probe");
    const evidence = resolutions.map((c) => `rec:${h.stream}#${c.seq}`);
    await write(h, [
      {
        kind: "process.concluded",
        v: 1,
        causes: resolutions.map((c) => ({ stream: h.stream, seq: c.seq })),
        data: { outcome: "mastery-verified", evidence },
      },
      { kind: "step.completed", v: 1, data: { step, outcome: "completed" } },
    ]);
    return { status: "concluded", step };
  }
  const acted = await performAction(deps, step, proposal);
  if (acted === "denied") return { status: "denied", step };

  await write(h, [{ kind: "step.completed", v: 1, data: { step, outcome: "completed" } }]);
  return { status: "completed", step };
}

// ---------------------------------------------------------------- A. admission

async function deliverInputs(deps: StepDeps, records: readonly CausalRecord[]): Promise<void> {
  const { handle: h } = deps;
  // The delivery cursor: inputs are admitted to inbox/<processId> and delivered in admission order,
  // each exactly once (the writer refuses a second delivery of an input id).
  const delivered = records
    .filter((r) => r.kind === "input.delivered")
    .map((r) => Number((r.data as InputDelivered).inputId.slice(1)))
    .filter((n) => Number.isInteger(n));
  const cursor = delivered.length ? Math.max(...delivered) : 0;
  const inbox = inboxStream(h.meta.processId);
  const fresh = (await h.store.read(inbox, cursor + 1)).filter((r) => r.kind === "input.admitted");
  const drafts: Draft[] = [];
  for (const admitted of fresh) {
    const input = admitted.data as InputAdmitted;
    const inputId = `I${admitted.seq}`;
    const causes = [{ stream: inbox, seq: admitted.seq }];
    // The content is already stored under this entity by admission; the labels travel with it.
    drafts.push({
      kind: "evidence.recorded",
      v: 1,
      labels: admitted.labels,
      causes,
      data: {
        evidenceHash: input.evidenceHash,
        mediaType: "text/plain",
        source: input.from === "environment" ? "environment" : input.from,
        trust: "data",
        ref: inputId,
      },
    });
    drafts.push({
      kind: "input.delivered",
      v: 1,
      labels: admitted.labels,
      causes,
      data: {
        inputId,
        from: input.from,
        evidenceHash: input.evidenceHash,
        ...(input.inReplyTo ? { inReplyTo: input.inReplyTo } : {}),
      },
    });
  }
  await write(h, drafts);
}

// ---------------------------------------------------------------- B. verification

async function verifyAndExpire(deps: StepDeps, records: readonly CausalRecord[]): Promise<void> {
  const { handle: h, env } = deps;
  const now = h.clock.now();
  const cog = foldCognitiveState(records);
  const ledger = foldLedger(records);
  const replies = records.filter(
    (r) => r.kind === "input.delivered",
  ) as CausalRecord<InputDelivered>[];
  const drafts: Draft[] = [];
  for (const { expectation, overdue } of openExpectations(cog, now)) {
    const e = expectation.data;
    const effects = [...ledger.values()].filter(
      (x) => x.intended.data.idempotencyKey === e.condition?.effectKey,
    );
    const effectIds = new Set(effects.map((x) => x.intended.data.effectId));
    const reply = replies.find((r) => r.data.inReplyTo && effectIds.has(r.data.inReplyTo));
    if (reply && e.condition?.kind === "answer-correct") {
      const itemId = e.condition.itemId === "probe" ? probeItem(effects) : e.condition.itemId;
      if (!itemId) continue;
      const answer =
        (await h.store.getEvidence(h.meta.entityId, reply.data.evidenceHash))?.content ?? "";
      const v = env.verify(itemId, answer);
      drafts.push(
        resolution(
          e,
          v.outcome,
          e.condition.itemId === "probe" ? "answer-key:probe" : "answer-key:practice",
          v.verifier,
          { stream: h.stream, seq: reply.seq },
          `answer to ${itemId} judged ${v.outcome}`,
        ),
      );
    } else if (overdue) {
      drafts.push(
        resolution(
          e,
          "expired",
          "expiry",
          {
            id: "harness.expiry",
            version: "1",
            measuredError: "deterministic clock comparison",
            actorVisible: false,
          },
          { stream: h.stream, seq: expectation.seq },
          `expectation ${e.claimId} passed its due time unresolved`,
        ),
      );
    }
  }
  // The environment's acceptance verdict over every probe resolution, including this batch's,
  // recorded atomically with them whenever the verdict changes.
  const probeOutcomes = [
    ...[...cog.claims.values()]
      .map((v) => v.at(-1))
      .filter(
        (c): c is CausalRecord<ClaimAsserted> =>
          c?.data.claimKind === "resolution" && c.data.method === "answer-key:probe",
      )
      .sort((a, b) => a.seq - b.seq)
      .map((c) => c.data.outcome),
    ...drafts
      .map((d) => d.data as ClaimAsserted)
      .filter((c) => c.method === "answer-key:probe")
      .map((c) => c.outcome),
  ].map((o) => (o === "held" || o === "failed" ? o : "indeterminate"));
  if (probeOutcomes.length) {
    const met = env.acceptanceMet(probeOutcomes);
    const last = records.findLast((r) => r.kind === "acceptance.evaluated") as
      | CausalRecord<AcceptanceEvaluated>
      | undefined;
    // Only a change of verdict is a new fact; supervision counts steps from the record of a change.
    if (!last || last.data.met !== met)
      drafts.push({
        kind: "acceptance.evaluated",
        v: 1,
        data: { met, probes: probeOutcomes.length, evaluator: `${env.id}@${env.version}` },
      });
  }
  await write(h, drafts);
}

function probeItem(
  effects: readonly {
    settled?: CausalRecord<EffectSettled>;
    reconciled?: CausalRecord<{ detail?: string }>;
  }[],
): string | undefined {
  for (const e of effects) {
    for (const detail of [e.settled?.data.detail, e.reconciled?.data.detail])
      if (detail?.startsWith("probe:")) return detail.slice("probe:".length);
  }
  return undefined;
}

function resolution(
  e: ClaimAsserted,
  outcome: "held" | "failed" | "indeterminate" | "expired",
  method: string,
  verifier: { id: string; version: string; measuredError: string; actorVisible: boolean },
  /** The record the resolution rests on (the reply judged, or the expectation that expired). */
  cause: { readonly stream: string; readonly seq: number },
  proposition: string,
): Draft {
  const data: ClaimAsserted = {
    claimId: `V-${e.claimId}`,
    version: 1,
    claimKind: "resolution",
    subject: e.subject,
    proposition,
    origin: "verifier",
    standing: "verified",
    confidence: 1,
    evidence: [`rec:${cause.stream}#${cause.seq}`],
    derivation: { operator: method, operatorVersion: verifier.version },
    resolves: e.claimId,
    outcome,
    method,
    verifier,
  };
  return { kind: "claim.asserted", v: 1, causes: [cause], data };
}

// ---------------------------------------------------------------- C. proposal

async function recordedProposal(
  h: ProcessHandle,
  records: readonly CausalRecord[],
  made: CausalRecord,
): Promise<Proposal> {
  const outputSeq = made.causes[0]?.seq;
  const output = records.find((r) => r.seq === outputSeq);
  const hash = (output?.data as { evidenceHash?: string } | undefined)?.evidenceHash;
  const text = hash ? (await h.store.getEvidence(h.meta.entityId, hash))?.content : undefined;
  if (!text)
    throw new Error(
      `decision ${(made.data as { decisionId: string }).decisionId} has no recorded model output to replay`,
    );
  // Replayed, never regenerated: this output was validated when its decision was written.
  return parseProposal(text);
}

async function obtainProposal(
  deps: StepDeps,
  records: readonly CausalRecord[],
  step: number,
  mode: Mode,
): Promise<{ proposal?: Proposal; outcome: StepOutcome }> {
  const { handle: h, faculty, env } = deps;
  const crash = deps.crash ?? (() => {});
  const now = h.clock.now();
  const ws = await compileWorkingState(h.store, records, now);
  const envelope = (
    records.find((r) => r.kind === "authority.granted") as
      | CausalRecord<AuthorityGranted>
      | undefined
  )?.data.envelope;
  if (!envelope) throw new Error("process has no authority envelope");
  const verdict = records.findLast((r) => r.kind === "acceptance.evaluated") as
    | CausalRecord<AcceptanceEvaluated>
    | undefined;
  if (verdict?.data.met) {
    const since = records.filter((r) => r.kind === "step.completed" && r.seq > verdict.seq).length;
    if (since >= MAX_STEPS_AFTER_ACCEPTANCE) {
      const reason = `supervision: acceptance verdict MET (record ${verdict.seq}) and ${since} further steps without conclude`;
      await write(h, [
        { kind: "process.escalated", v: 1, data: { reason, detail: "held for a person" } },
      ]);
      return { outcome: { status: "escalated", step, detail: reason } };
    }
  }
  const lastCompleted = records.filter((r) => r.kind === "step.completed").at(-1)?.seq ?? 0;
  const rejections = records.filter(
    (r) => r.kind === "proposal.rejected" && r.seq > lastCompleted,
  ).length;
  if (rejections >= MAX_REJECTIONS_PER_STEP) {
    await write(h, [
      {
        kind: "process.escalated",
        v: 1,
        data: {
          reason: `${rejections} proposals rejected for step ${step}`,
          detail: "held for a person",
        },
      },
    ]);
    return { outcome: { status: "escalated", step } };
  }

  // Replay a recorded, not-yet-applied output for this step before ever calling the model again.
  // A re-ask after a rejected proposal is a different logical effect, so it carries its own key.
  const key = `model:step-${step}/ask-${rejections + 1}`;
  const ledger = foldLedger(records);
  const pending = latestUnappliedOutput(records, ledger, key, lastCompleted);
  let output: CausalRecord | undefined = pending;
  let text = pending
    ? (
        await h.store.getEvidence(
          h.meta.entityId,
          (pending.data as { evidenceHash: string }).evidenceHash,
        )
      )?.content
    : undefined;

  const staleness = deps.staleness ?? "gate";
  if (!output || text === undefined) {
    const ctx = compileContext(ws, faculty, mode, staleness);
    assertNoPrivateLeak(ws, ctx.request.system, env);
    const attempt =
      1 + [...ledger.values()].filter((e) => e.intended.data.idempotencyKey === key).length;
    // Unique across asks of the same step: ask K (after K-1 rejections), transport attempt N.
    const effectId = `M${step}-k${rejections + 1}-a${attempt}`;
    if (attempt > MAX_ATTEMPTS_PER_ASK) {
      const reason = `${attempt - 1} model-call attempts failed for step ${step} ask ${rejections + 1}`;
      await write(h, [
        { kind: "process.escalated", v: 1, data: { reason, detail: "held for a person" } },
      ]);
      return { outcome: { status: "escalated", step, detail: reason } };
    }
    const verdict = govern(() =>
      envelopePolicy(envelope, ws.modelCallsUsed, {
        action: "model-call",
        effectClass: "model-call",
      }),
    );
    if (verdict.decision === "deny") {
      await write(h, [
        {
          kind: "governance.decided",
          v: 1,
          data: {
            effectId,
            action: "model-call",
            decision: "deny",
            reason: verdict.reason,
            policyVersion: POLICY_VERSION,
          },
        },
        { kind: "process.escalated", v: 1, data: { reason: verdict.reason } },
      ]);
      return { outcome: { status: "escalated", step, detail: verdict.reason } };
    }
    const intent: EffectIntended = {
      effectId,
      effectClass: "model-call",
      action: "model-call",
      idempotencyKey: key,
      attempt,
      payloadHash: ctx.requestHash,
    };
    // What the call saw carries the labels of everything it saw; its exact bytes are kept as
    // evidence so the call can be replayed even after the renderer changes.
    const seenLabels = new Map(records.map((r) => [r.seq, r.labels]));
    const manifestLabels = [
      ...new Set(ctx.items.flatMap((i) => seenLabels.get(i.record) ?? [])),
    ].sort();
    const requestBytes = canonicalJson({
      system: ctx.request.system,
      prompt: ctx.request.prompt,
      schema: ctx.request.schema,
      model: ctx.request.model,
      temperature: ctx.request.temperature,
    });
    await write(
      h,
      [
        {
          kind: "manifest.recorded",
          v: 2,
          labels: manifestLabels,
          data: {
            step,
            items: ctx.items,
            exclusions: ctx.exclusions,
            rendererVersion: RENDERER_VERSION,
            requestHash: ctx.requestHash,
            faculty: faculty.id,
            model: faculty.model,
            mode,
            staleness,
            compiledAt: now,
          },
        },
        {
          kind: "request.recorded",
          v: 1,
          labels: manifestLabels,
          data: {
            effectId,
            requestHash: ctx.requestHash,
            evidenceHash: evidenceHash(REQUEST_MEDIA_TYPE, requestBytes),
          },
        },
        {
          kind: "governance.decided",
          v: 1,
          labels: manifestLabels,
          data: {
            effectId,
            action: "model-call",
            decision: "allow",
            reason: verdict.reason,
            policyVersion: POLICY_VERSION,
          },
        },
        { kind: "effect.intended", v: 1, labels: manifestLabels, data: intent },
      ],
      [{ mediaType: REQUEST_MEDIA_TYPE, content: requestBytes, labels: manifestLabels }],
    );
    crash("after-manifest");
    await write(h, [{ kind: "effect.started", v: 1, data: { effectId } }]);
    crash("model-started");
    let response;
    try {
      response = await faculty.respond(ctx.request);
    } catch (e) {
      const fe =
        e instanceof FacultyError
          ? e
          : new FacultyError(e instanceof Error ? e.message : String(e), "ambiguous", true);
      const settled = {
        kind: "effect.settled",
        v: 1,
        data: {
          effectId,
          outcome: "failed",
          delivery: fe.delivery,
          detail: fe.message.slice(0, 500),
        },
      } as const;
      if (fe.retryable) {
        await write(h, [settled]);
        return { outcome: { status: "retry", step, detail: fe.message } };
      }
      // A definitive answer (a refusal, a rejected request) is not retried into the budget: the
      // failure and the hand-off to a person commit together.
      const reason = `faculty ${faculty.id} failed without retry: ${fe.message.slice(0, 200)}`;
      await write(h, [
        settled,
        { kind: "process.escalated", v: 1, data: { reason, detail: "held for a person" } },
      ]);
      return { outcome: { status: "escalated", step, detail: reason } };
    }
    // The raw output commits with its settlement: evidence first-class, never written apart.
    const outputHash = evidenceHash("application/json", response.text);
    const outputEvidence = [{ mediaType: "application/json", content: response.text }];
    const written = await write(
      h,
      [
        {
          kind: "effect.settled",
          v: 1,
          labels: manifestLabels,
          data: {
            effectId,
            outcome: "completed",
            delivery: "accepted",
            usage: response.usage,
            // Provenance: which model actually answered (it can differ under provider routing).
            detail: `served-by:${response.servedBy ?? faculty.model}`,
          },
        },
        {
          kind: "evidence.recorded",
          v: 1,
          // A model's output derived from everything it saw: it carries those labels.
          labels: manifestLabels,
          data: {
            evidenceHash: outputHash,
            mediaType: "application/json",
            source: "model-output",
            trust: "data",
            ref: effectId,
          },
        },
      ],
      outputEvidence,
    );
    output = written[1];
    text = response.text;
    crash("after-model-output");
  }
  if (!output || text === undefined) throw new Error("no model output");

  const validated = validateProposal(text, {
    ws,
    mode,
    // Validation checks the action exists; whether it is permitted is governance's decision,
    // made with a durable record before the effect (never a silent rejection here).
    actions: env.actions.map((a) => a.name),
    practiceItemIds: env.practiceItems().map((p) => p.itemId),
    // One authority: the environment's recorded verdict, the same one the faculty was shown.
    acceptanceMet: ws.acceptance?.value.met === true,
    staleness,
  });
  if ("errors" in validated) {
    await write(h, [
      {
        kind: "proposal.rejected",
        v: 1,
        data: {
          step,
          evidenceHash: (output.data as { evidenceHash: string }).evidenceHash,
          errors: validated.errors,
        },
      },
    ]);
    return { outcome: { status: "retry", step, detail: validated.errors.join("; ") } };
  }
  const authority = records.find((r) => r.kind === "authority.granted");
  const drafts = proposalDrafts(validated.proposal, {
    ws,
    mode,
    step,
    stream: h.stream,
    model: faculty.model,
    outputRef: `rec:${h.stream}#${output.seq}`,
    actionKey: `action:step-${step}`,
    authorityRef: `rec:${h.stream}#${authority?.seq ?? 0}`,
  }).map((d) => ({ ...d, causes: [refOf(output)] }));
  await write(h, drafts);
  return { proposal: validated.proposal, outcome: { status: "completed", step } };
}

/** The newest completed model output for this step that no rejection and no decision has consumed. */
function latestUnappliedOutput(
  records: readonly CausalRecord[],
  ledger: Ledger,
  key: string,
  after: number,
): CausalRecord | undefined {
  const completed = new Set(
    [...ledger.values()]
      .filter(
        (e) => e.intended.data.idempotencyKey === key && e.settled?.data.outcome === "completed",
      )
      .map((e) => e.intended.data.effectId),
  );
  const output = [...records]
    .reverse()
    .find(
      (r) =>
        r.seq > after &&
        r.kind === "evidence.recorded" &&
        (r.data as { source: string; ref?: string }).source === "model-output" &&
        completed.has((r.data as { ref: string }).ref),
    );
  if (!output) return undefined;
  const consumed = records.some(
    (r) => r.seq > output.seq && (r.kind === "proposal.rejected" || r.kind === "decision.made"),
  );
  return consumed ? undefined : output;
}

/** Answer keys must never reach a rendered request; checked on everything the harness or environment authored. */
function assertNoPrivateLeak(ws: WorkingState, system: string, env: EnvironmentPack): void {
  const authored = [
    system,
    JSON.stringify(ws.environment?.value ?? {}),
    ...ws.observations.map((o) => o.value.content),
  ].join("\n");
  for (const secret of env.verifierPrivate())
    if (secret && authored.includes(secret))
      throw new Error("verifier-private content would enter the context");
}

// ---------------------------------------------------------------- D. action

async function performAction(
  deps: StepDeps,
  step: number,
  proposal: Proposal,
): Promise<"done" | "denied"> {
  const { handle: h, env } = deps;
  const crash = deps.crash ?? (() => {});
  const records = await readProcess(h);
  const ledger = foldLedger(records);
  const key = `action:step-${step}`;
  const attempts = [...ledger.values()].filter((e) => e.intended.data.idempotencyKey === key);
  if (
    attempts.some(
      (e) => e.settled?.data.outcome === "completed" || e.reconciled?.data.finding === "delivered",
    )
  )
    return "done";
  if (
    records.some(
      (r) =>
        r.kind === "governance.decided" &&
        (r.data as { decision: string; effectId: string }).decision === "deny" &&
        (r.data as { effectId: string }).effectId.startsWith(`X${step}-`),
    )
  )
    return "denied";

  const envelope = (
    records.find((r) => r.kind === "authority.granted") as CausalRecord<AuthorityGranted>
  ).data.envelope;
  const effectId = `X${step}-a${attempts.length + 1}`;
  // The action derives from this step's decision: its effect records cite it, so labels follow.
  const decision = records.find(
    (r) =>
      r.kind === "decision.made" && (r.data as { decisionId: string }).decisionId === `D${step}`,
  );
  const fromDecision = decision ? [{ stream: h.stream, seq: decision.seq }] : [];
  const params: Record<string, string> = {};
  if (proposal.action.item_id) params["item_id"] = proposal.action.item_id;
  if (proposal.action.content) params["content"] = proposal.action.content;
  const action = proposal.action.type;
  const verdict = govern(() =>
    envelopePolicy(envelope, 0, { action, effectClass: "external-communication" }),
  );
  if (verdict.decision === "deny") {
    await write(h, [
      {
        kind: "governance.decided",
        v: 1,
        data: {
          effectId,
          action,
          decision: "deny",
          reason: verdict.reason,
          policyVersion: POLICY_VERSION,
        },
      },
      { kind: "step.completed", v: 1, data: { step, outcome: "failed", detail: verdict.reason } },
    ]);
    return "denied";
  }
  await write(h, [
    {
      kind: "governance.decided",
      v: 1,
      data: {
        effectId,
        action,
        decision: "allow",
        reason: verdict.reason,
        policyVersion: POLICY_VERSION,
      },
    },
    {
      kind: "effect.intended",
      v: 1,
      causes: fromDecision,
      data: {
        effectId,
        effectClass: "external-communication",
        action,
        idempotencyKey: key,
        attempt: attempts.length + 1,
        payloadHash: hashOf(params),
      },
    },
  ]);
  const intended = (await readProcess(h)).findLast(
    (r) => r.kind === "effect.intended" && (r.data as { effectId: string }).effectId === effectId,
  );
  const fromIntent = intended ? [{ stream: h.stream, seq: intended.seq }] : [];
  await write(h, [{ kind: "effect.started", v: 1, causes: fromIntent, data: { effectId } }]);
  crash("external-started");
  const result = await env.perform({
    processId: h.meta.processId,
    effectId,
    idempotencyKey: key,
    action,
    params,
  });
  crash("external-performed");
  const observationHash = evidenceHash("text/plain", result.observation);
  await write(
    h,
    [
      {
        kind: "effect.settled",
        v: 1,
        causes: fromIntent,
        data: {
          effectId,
          outcome: result.delivery === "accepted" ? "completed" : "failed",
          delivery: result.delivery,
          ...(result.probeItemId ? { detail: `probe:${result.probeItemId}` } : {}),
        },
      },
      {
        kind: "evidence.recorded",
        v: 1,
        causes: fromIntent,
        data: {
          evidenceHash: observationHash,
          mediaType: "text/plain",
          source: "environment",
          trust: "data",
          ref: effectId,
        },
      },
    ],
    [{ mediaType: "text/plain", content: result.observation }],
  );
  crash("after-settle");
  return "done";
}
