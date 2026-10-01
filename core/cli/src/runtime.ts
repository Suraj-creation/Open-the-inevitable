import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { SqliteCausalStore } from "@uci/adapters";
import { TutorEnvironment } from "@uci/env-tutor";
import {
  type ModelFaculty,
  PROCESS_KINDS,
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
  close(): Promise<void>;
}

export async function openRuntime(
  dataDir: string,
  clock: Clock,
  learner = { misconception: true },
  acceptanceStreak?: number,
): Promise<Runtime> {
  mkdirSync(join(dataDir, "channel"), { recursive: true });
  const store = await SqliteCausalStore.open(join(dataDir, "uci.sqlite"), {
    registry: PROCESS_KINDS,
  });
  const env = new TutorEnvironment(join(dataDir, "channel"), learner, acceptanceStreak);
  return { store, env, clock, close: () => store.close() };
}

export const DEFAULT_ENVELOPE: Envelope = {
  actions: ["explain", "practice", "assess", "ask_person"],
  effectClasses: ["model-call", "external-communication"],
  modelCallBudget: 60,
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
