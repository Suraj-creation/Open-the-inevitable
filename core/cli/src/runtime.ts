import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { SqliteCausalStore } from "@uci/adapters";
import { TutorEnvironment } from "@uci/env-tutor";
import {
  type AdmissionResult,
  admitInput,
  type ModelFaculty,
  PROCESS_KINDS,
  processStream,
  type ProcessHandle,
  resumeProcess,
  runStep,
  startProcess,
  type StepDeps,
  type StepOutcome,
} from "@uci/harness";
import type { CausalStore, Clock, Envelope } from "@uci/kernel";

/**
 * The composition root: one place where engines, environment and faculty meet. Everything durable
 * lives under `dataDir`: the causal store (uci.sqlite) and the environment's own channel (channel/),
 * which are deliberately separate so the channel survives anything the process does.
 */
export interface Runtime {
  readonly store: CausalStore;
  readonly env: TutorEnvironment;
  readonly clock: Clock;
  /**
   * The learner sends a message unprompted (e.g. a correction): admitted to the process's inbox
   * under the learner's principal, delivered at its next step. `key` makes a resubmission the
   * same admission; omitted, every call is a new message.
   */
  say(processId: string, content: string, key?: string): Promise<AdmissionResult>;
  close(): Promise<void>;
}

/** In this composition the learner is the process's entity: its principal is the entity id. */
async function learnerOf(store: CausalStore, processId: string): Promise<string> {
  const head = (await store.read(processStream(processId), 1))[0];
  if (!head) throw new Error(`process ${processId} does not exist`);
  return head.entityId;
}

/** Opens the causal store for a data directory. Default: SQLite at `<dataDir>/uci.sqlite`. */
export type StoreFactory = (dataDir: string) => Promise<CausalStore>;
export const sqliteStore: StoreFactory = (dataDir) =>
  SqliteCausalStore.open(join(dataDir, "uci.sqlite"), { registry: PROCESS_KINDS });

export async function openRuntime(
  dataDir: string,
  clock: Clock,
  learner = { misconception: true },
  acceptanceStreak?: number,
  openStore: StoreFactory = sqliteStore,
): Promise<Runtime> {
  mkdirSync(join(dataDir, "channel"), { recursive: true });
  const store = await openStore(dataDir);
  const env = new TutorEnvironment(
    join(dataDir, "channel"),
    learner,
    acceptanceStreak,
    async (reply) =>
      admitInput(store, clock, { ...reply, principal: await learnerOf(store, reply.processId) }),
  );
  const say = async (processId: string, content: string, key?: string) =>
    admitInput(store, clock, {
      processId,
      key: key ?? `say:${randomUUID()}`,
      from: "learner",
      principal: await learnerOf(store, processId),
      content,
      labels: ["consent:learning", "source:learner"],
    });
  return { store, env, clock, say, close: () => store.close() };
}

export const DEFAULT_ENVELOPE: Envelope = {
  actions: ["explain", "practice", "assess", "ask_person"],
  effectClasses: ["model-call", "external-communication"],
  modelCallBudget: 60,
  // Only the learner (the process's entity, L1 here) may submit input.
  admits: [{ principal: "L1", role: "person" }],
};

export const OBJECTIVE = {
  objectiveId: "O1",
  goal: "The learner reaches verified mastery of adding fractions with unlike denominators.",
  acceptance:
    "3 consecutive correct answers on probes selected by the environment, judged by the environment's verifier.",
};

export async function start(rt: Runtime, processId: string, owner: string): Promise<ProcessHandle> {
  return startProcess({
    store: rt.store,
    clock: rt.clock,
    processId,
    entityId: "L1",
    owner,
    envelope: DEFAULT_ENVELOPE,
    grantedBy: "owner",
    objective: OBJECTIVE,
    env: rt.env,
  });
}

export async function resume(rt: Runtime, processId: string, owner: string, faculty: ModelFaculty) {
  return resumeProcess({
    store: rt.store,
    clock: rt.clock,
    processId,
    owner,
    env: rt.env,
    faculty: `${faculty.id}/${faculty.model}`,
  });
}

/** Run steps until the process concludes, escalates, or `maxSteps` attempts pass. */
export async function runUntilDone(
  deps: Omit<StepDeps, "handle"> & { handle: ProcessHandle },
  maxSteps = 60,
  onStep?: (o: StepOutcome) => void,
): Promise<StepOutcome> {
  let last: StepOutcome = { status: "retry", step: 0 };
  for (let i = 0; i < maxSteps; i++) {
    last = await runStep(deps);
    onStep?.(last);
    if (last.status === "concluded" || last.status === "escalated") return last;
  }
  return last;
}
