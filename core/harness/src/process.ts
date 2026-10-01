import {
  canonicalJson,
  type CausalStore,
  type Clock,
  type Draft,
  type Envelope,
  foldLedger,
  orphanSettlements,
  unreconciled,
} from "@uci/kernel";
import type { EnvironmentPack } from "./ports.js";
import { type ProcessHandle, processStream, write } from "./writer.js";

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

/** Create a process: claim its stream, then record authority, objective and the environment's affordances. */
export async function startProcess(o: StartOptions): Promise<ProcessHandle> {
  const stream = processStream(o.processId);
  const meta = { processId: o.processId, entityId: o.entityId };
  if ((await o.store.read(stream)).length)
    throw new Error(`process ${o.processId} already exists; resume it instead`);
  const { fence } = await o.store.claim(stream, o.owner, o.clock.now(), meta);
  const handle: ProcessHandle = { store: o.store, stream, meta, fence, clock: o.clock };
  const description = canonicalJson({
    actions: o.env.actions,
    practiceItems: o.env.practiceItems(),
  });
  const evidenceHash = await o.store.putEvidence("application/json", description);
  await write(handle, [
    { kind: "authority.granted", v: 1, data: { envelope: o.envelope, grantedBy: o.grantedBy } },
    { kind: "objective.set", v: 1, data: o.objective },
    {
      kind: "evidence.recorded",
      v: 1,
      data: {
        evidenceHash,
        mediaType: "application/json",
        source: "environment",
        trust: "instruction",
        ref: "environment-description",
      },
    },
  ]);
  return handle;
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
  readonly resumeAttempt: number;
}

/**
 * Recovery by reconstruction. Re-claims the stream (the claim is the durable resume counter, taken
 * before anything else), settles every effect the crash left open, reconciles unknown external
 * effects against the channel, and records a typed continuity notice the next step will render.
 * Nothing is rebuilt from memory: the next step recompiles working state from records.
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
  const handle: ProcessHandle = { store: o.store, stream, meta, fence, clock: o.clock };
  const resumeAttempt = before.filter((r) => r.kind === "lease.claimed").length;
  const budget = o.resumeBudget ?? 10;
  if (before.some((r) => r.kind === "process.concluded" || r.kind === "process.escalated"))
    return { handle, escalated: false, resumeAttempt };
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
    return { handle, escalated: true, resumeAttempt };
  }

  const orphans = orphanSettlements(foldLedger(await o.store.read(stream)));
  await write(handle, orphans);

  const reconciledDrafts: Draft[] = [];
  const reconciled: { effectId: string; finding: string }[] = [];
  for (const entry of unreconciled(foldLedger(await o.store.read(stream)))) {
    const effectId = entry.intended.data.effectId;
    const { finding, detail, observation } = await o.env.reconcile(effectId);
    reconciled.push({ effectId, finding });
    reconciledDrafts.push({
      kind: "effect.reconciled",
      v: 1,
      data: { effectId, finding, method: "channel-outbox", ...(detail ? { detail } : {}) },
    });
    // Settling is not knowing: record what the world says the effect did, as evidence.
    if (finding === "delivered" && observation) {
      const evidenceHash = await o.store.putEvidence("text/plain", observation);
      reconciledDrafts.push({
        kind: "evidence.recorded",
        v: 1,
        data: {
          evidenceHash,
          mediaType: "text/plain",
          source: "environment",
          trust: "data",
          ref: effectId,
        },
      });
    }
  }
  await write(handle, reconciledDrafts);
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
    return { handle, escalated: true, resumeAttempt };
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
  return { handle, escalated: false, resumeAttempt };
}
