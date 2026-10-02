import {
  canonicalJson,
  type CausalRecord,
  type CausalStore,
  type Clock,
  type Draft,
  type Envelope,
  type EvidenceDraft,
  evidenceHash,
  foldLedger,
  InvalidRecordError,
  orphanSettlements,
  unreconciled,
} from "@uci/kernel";
import type { EnvironmentPack } from "./ports.js";
import { draftViolations, type ProcessHandle, processStream, write } from "./writer.js";

export interface StartOptions {
  readonly store: CausalStore;
  readonly clock: Clock;
  readonly processId: string;
  readonly entityId: string;
  readonly owner: string;
  readonly envelope: Envelope;
  readonly grantedBy: string;
  readonly objective: {
    readonly objectiveId: string;
    readonly goal: string;
    readonly acceptance: string;
  };
  readonly env: EnvironmentPack;
}

/**
 * Create a process in one commit: the claim, the authority, the objective, the environment's
 * affordances (as evidence) and which environment it is bound to. A crash leaves either nothing or
 * a whole process, never a stream without an authority envelope.
 */
export async function startProcess(o: StartOptions): Promise<ProcessHandle> {
  const stream = processStream(o.processId);
  const meta = { processId: o.processId, entityId: o.entityId };
  if ((await o.store.read(stream)).length)
    throw new Error(`process ${o.processId} already exists; resume it instead`);
  const description = canonicalJson({
    actions: o.env.actions,
    practiceItems: o.env.practiceItems(),
  });
  const descriptionHash = evidenceHash("application/json", description);
  const drafts: Draft[] = [
    // An envelope with an admission policy is authority.granted@2.
    {
      kind: "authority.granted",
      v: o.envelope.admits ? 2 : 1,
      data: { envelope: o.envelope, grantedBy: o.grantedBy },
    },
    { kind: "objective.set", v: 1, data: o.objective },
    {
      kind: "evidence.recorded",
      v: 1,
      data: {
        evidenceHash: descriptionHash,
        mediaType: "application/json",
        source: "environment",
        trust: "instruction",
        ref: "environment-description",
      },
    },
    {
      kind: "environment.bound",
      v: 1,
      data: { packId: o.env.id, version: o.env.version, descriptionHash },
    },
  ];
  const violations = draftViolations([], drafts);
  if (violations.length) throw new InvalidRecordError(violations);
  const { fence, records } = await o.store.claim(stream, o.owner, o.clock.now(), meta, drafts, [
    { mediaType: "application/json", content: description },
  ]);
  return { store: o.store, stream, meta, fence, clock: o.clock, seen: [...records] };
}

export interface ResumeOptions {
  readonly store: CausalStore;
  readonly clock: Clock;
  readonly processId: string;
  readonly owner: string;
  readonly env: EnvironmentPack;
  /** Identifies the faculty the process resumes under, for the continuity notice. */
  readonly faculty: string;
  readonly resumeBudget?: number;
}

export interface Resumed {
  readonly handle: ProcessHandle;
  readonly escalated: boolean;
  /** Consecutive recoveries without step progress, this one included (0 for a hydration). */
  readonly resumeAttempt: number;
  /** True when the previous owner died mid-step and this claim recovered the process. */
  readonly recovered: boolean;
}

/** Records that mark ownership or a start, not work: a stream ending in them is at a boundary. */
const BOUNDARY_KINDS = new Set([
  "lease.claimed",
  "continuity.notice",
  "authority.granted",
  "objective.set",
  "environment.bound",
  "process.waiting",
]);

/**
 * Whether the previous owner left work in flight: anything recorded after the last completed step
 * (or after the start, if no step completed) other than ownership and start records. A process at
 * a step boundary was interrupted by nothing; a process mid-step was.
 */
export function interruptedMidStep(records: readonly CausalRecord[]): boolean {
  const lastStep = records.findLastIndex((r) => r.kind === "step.completed");
  return records
    .slice(lastStep + 1)
    .some(
      (r) =>
        !BOUNDARY_KINDS.has(r.kind) &&
        !(
          r.kind === "evidence.recorded" &&
          (r.data as { ref?: string }).ref === "environment-description"
        ),
    );
}

/**
 * Take ownership of an existing process. At a step boundary this is hydration: a claim and nothing
 * else (residency is a cache; no notice, no budget). Mid-step it is recovery by reconstruction:
 * settle every effect the crash left open, reconcile unknown external effects against the channel,
 * and record a typed continuity notice the next step will render. The resume budget counts
 * consecutive recoveries without step progress. Nothing is rebuilt from memory: the next step
 * recompiles working state from records.
 */
export async function resumeProcess(o: ResumeOptions): Promise<Resumed> {
  const stream = processStream(o.processId);
  const before = await o.store.read(stream);
  if (!before.length) throw new Error(`process ${o.processId} does not exist`);
  const meta = {
    processId: before[0]?.processId ?? o.processId,
    entityId: before[0]?.entityId ?? "",
  };
  const { fence } = await o.store.claim(stream, o.owner, o.clock.now(), meta);
  const handle: ProcessHandle = { store: o.store, stream, meta, fence, clock: o.clock, seen: [] };
  if (before.some((r) => r.kind === "process.concluded" || r.kind === "process.escalated"))
    return { handle, escalated: false, resumeAttempt: 0, recovered: false };
  if (!interruptedMidStep(before))
    return { handle, escalated: false, resumeAttempt: 0, recovered: false };

  const lastStep = before.findLastIndex((r) => r.kind === "step.completed");
  const resumeAttempt =
    before.slice(lastStep + 1).filter((r) => r.kind === "continuity.notice").length + 1;
  const budget = o.resumeBudget ?? 10;
  if (resumeAttempt > budget) {
    await write(handle, [
      {
        kind: "process.escalated",
        v: 1,
        data: {
          reason: `interrupted repeatedly: resume budget exhausted (${resumeAttempt}/${budget})`,
          detail: "held for a person",
        },
      },
    ]);
    return { handle, escalated: true, resumeAttempt, recovered: true };
  }

  const orphans = orphanSettlements(foldLedger(await o.store.read(stream)));
  await write(handle, orphans);

  const reconciledDrafts: Draft[] = [];
  const reconciledEvidence: EvidenceDraft[] = [];
  const reconciled: { effectId: string; finding: string }[] = [];
  for (const entry of unreconciled(foldLedger(await o.store.read(stream)))) {
    const effectId = entry.intended.data.effectId;
    const { finding, detail, observation } = await o.env.reconcile(meta.processId, effectId);
    reconciled.push({ effectId, finding });
    reconciledDrafts.push({
      kind: "effect.reconciled",
      v: 1,
      data: { effectId, finding, method: "channel-outbox", ...(detail ? { detail } : {}) },
    });
    // Settling is not knowing: record what the world says the effect did, as evidence.
    if (finding === "delivered" && observation) {
      reconciledEvidence.push({ mediaType: "text/plain", content: observation });
      reconciledDrafts.push({
        kind: "evidence.recorded",
        v: 1,
        data: {
          evidenceHash: evidenceHash("text/plain", observation),
          mediaType: "text/plain",
          source: "environment",
          trust: "data",
          ref: effectId,
        },
      });
    }
  }
  await write(handle, reconciledDrafts, reconciledEvidence);
  if (reconciled.some((r) => r.finding === "unanswerable")) {
    await write(handle, [
      {
        kind: "process.escalated",
        v: 1,
        data: {
          reason: "an effect's outcome could not be reconciled",
          detail: "ask the person before any retry",
        },
      },
    ]);
    return { handle, escalated: true, resumeAttempt, recovered: true };
  }

  const after = await o.store.read(stream);
  await write(handle, [
    {
      kind: "continuity.notice",
      v: 1,
      data: {
        resumeAttempt,
        interruptedAtStep: after.filter((r) => r.kind === "step.completed").length + 1,
        settled: orphans.map((d) => ({ effectId: d.data.effectId, outcome: d.data.outcome })),
        reconciled,
        faculty: o.faculty,
      },
    },
  ]);
  return { handle, escalated: false, resumeAttempt, recovered: true };
}
