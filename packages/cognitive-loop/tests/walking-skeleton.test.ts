/**
 * The L2 walking skeleton, made executable. Each test IS one of the four measurements of the L2 exit
 * gate (spec/research/living-cognitive-agents/10 §11.5) — the gate that decides whether the Master
 * Cognitive Architecture has earned its complexity. Everything is deterministic (ManualClock +
 * SeededIdGenerator + a deterministic learner simulator) so the measurements are clean and replayable.
 */
import { ManualClock, SeededIdGenerator } from "@inevitable/shared";
import { describe, expect, it } from "vitest";
import {
  AdaptationGovernor,
  ContextCompiler,
  DeterministicFaculty,
  EXPLANATION_STRATEGIES,
  InMemoryEventLog,
  InMemoryPolicyStore,
  LearnerSimulator,
  LOOP_EVENTS,
  LoopEventEmitter,
  Reflection,
  ablationGap,
  constitutionFromManifest,
  firstWindowMean,
  lastWindowMean,
  policyRef,
  preferredStrategy,
  reconstructChain,
  runLoop,
  seedPolicy,
  type AdaptivePolicy,
  type CognitiveTask,
  type Constitution,
  type EpisodeDeps,
  type ExplanationStrategy,
  type LearnerState,
  type LoopHarness,
} from "../src/index";

const AGENT_ID = "agent.explanation";
const LEARNER_CID = "cog-learner01";

interface Harness extends LoopHarness {
  readonly log: InMemoryEventLog;
}

function buildHarness(
  preferred: ExplanationStrategy,
  constitutionOverrides?: Parameters<typeof constitutionFromManifest>[1],
): Harness {
  const clock = new ManualClock(1_700_000_000_000);
  const idGenerator = new SeededIdGenerator("walking-skeleton");
  const log = new InMemoryEventLog();
  const emitter = new LoopEventEmitter(log, AGENT_ID, clock, idGenerator, "cognitive-loop");
  const constitution: Constitution = constitutionFromManifest(
    { id: AGENT_ID, role: "Explains concepts so a learner genuinely understands." },
    constitutionOverrides,
  );
  const learner: LearnerState = { learner_cid: LEARNER_CID, known_concepts: [], level: 0.3 };
  const deps: EpisodeDeps = {
    compiler: new ContextCompiler(),
    faculty: new DeterministicFaculty(),
    learnerSim: new LearnerSimulator(preferred),
    reflection: new Reflection(),
    governor: new AdaptationGovernor(),
    policies: new InMemoryPolicyStore(),
    emitter,
    idGenerator,
  };
  return { constitution, learner, deps, log };
}

const taskFor =
  (conceptId: string) =>
  (episodeIndex: number): CognitiveTask => ({
    task_id: `task-${conceptId}-${episodeIndex}`,
    concept_id: conceptId,
    concept_title: `Concept ${conceptId}`,
    intent: "learn",
  });

/** Compile → execute → assess a single concept with a given policy (no exploration) — for transfer. */
async function singleShot(h: Harness, policy: AdaptivePolicy, conceptId: string): Promise<number> {
  const compiled = h.deps.compiler.compile({
    constitution: h.constitution,
    policy,
    learner: h.learner,
    task: taskFor(conceptId)(0),
  });
  const output = await h.deps.faculty.execute(compiled);
  return h.deps.learnerSim.assess(output).score;
}

describe("L2 walking skeleton — the Explainer proof loop (10 §12, gate §11.5)", () => {
  it("A. longitudinal: the same learner improves episode 1 → 20, model held fixed", async () => {
    const h = buildHarness("visual-first");
    const result = await runLoop(h, taskFor("photosynthesis"), {
      episodes: 20,
      explorationRounds: 1,
    });

    const early = firstWindowMean(result.scores, 3);
    const late = lastWindowMean(result.scores, 5);
    expect(late).toBeGreaterThan(early);
    // Accumulation is real: the policy converged to the learner's true best-fit strategy.
    expect(preferredStrategy(result.finalPolicy)).toBe("visual-first");
    expect(result.finalPolicy.version).toBeGreaterThan(1);
  });

  it("D. ablation: adaptation-on beats an identical no-adaptation baseline", async () => {
    const on = await runLoop(buildHarness("visual-first"), taskFor("photosynthesis"), {
      episodes: 20,
      explorationRounds: 1,
      freezePolicy: false,
    });
    const off = await runLoop(buildHarness("visual-first"), taskFor("photosynthesis"), {
      episodes: 20,
      explorationRounds: 1,
      freezePolicy: true,
    });

    // The gain is caused by the adaptation mechanism, not the base faculty or noise.
    expect(ablationGap(on.scores, off.scores, 5)).toBeGreaterThan(0.2);
    // The frozen baseline never accumulated — it stayed at the seed version.
    expect(off.finalPolicy.version).toBe(1);
  });

  it("C. replay: every accepted policy change reconstructs to its causing outcome", async () => {
    const h = buildHarness("visual-first");
    await runLoop(h, taskFor("photosynthesis"), { episodes: 6, explorationRounds: 1 });

    const accepted = h.log.all().filter((e) => e.event_type === LOOP_EVENTS.policyAccepted);
    expect(accepted.length).toBeGreaterThan(0);

    for (const event of accepted) {
      const chain = reconstructChain(h.log, event.event_id);
      expect(chain).not.toBeNull();
      const outcomePayload = chain?.outcome.payload as Record<string, unknown>;
      expect(chain?.outcome.event_type).toBe(LOOP_EVENTS.outcomeObserved);
      expect(typeof outcomePayload["score"]).toBe("number");
      // The chain is one coherent episode end to end.
      expect(chain?.started.correlation_id).toBe(event.correlation_id);
    }
  });

  it("B. transfer: a policy learned on one concept helps a novel related concept", async () => {
    const h = buildHarness("visual-first");
    const trained = await runLoop(h, taskFor("photosynthesis"), {
      episodes: 12,
      explorationRounds: 1,
    });

    const learnedScore = await singleShot(h, trained.finalPolicy, "cellular-respiration");
    const seedScore = await singleShot(
      h,
      seedPolicy(AGENT_ID, LEARNER_CID, h.constitution.constitution_id),
      "cellular-respiration",
    );

    // The learned object captured a learner-general preference, not concept-specific memorization.
    expect(learnedScore).toBeGreaterThan(seedScore);
  });

  it("governance is real: out-of-bounds proposals are rejected; identity and lineage are preserved", () => {
    // abstract-first is deliberately forbidden by this Constitution.
    const constitution = constitutionFromManifest(
      { id: AGENT_ID, role: "Explains concepts." },
      { allowed_strategies: ["concrete-first", "visual-first"] },
    );
    const policy = seedPolicy(AGENT_ID, LEARNER_CID, constitution.constitution_id);
    const governor = new AdaptationGovernor();

    const forbidden = governor.govern({
      constitution,
      policy,
      proposal: {
        proposal_id: "p1",
        policy_ref: policy.ref,
        base_version: 1,
        strategy: "abstract-first",
        weight_delta: 0.1,
        rationale: "",
        evidence: [],
      },
    });
    expect(forbidden.accepted).toBe(false);

    const tooBig = governor.govern({
      constitution,
      policy,
      proposal: {
        proposal_id: "p2",
        policy_ref: policy.ref,
        base_version: 1,
        strategy: "visual-first",
        weight_delta: 0.9,
        rationale: "",
        evidence: [],
      },
    });
    expect(tooBig.accepted).toBe(false);

    const valid = governor.govern({
      constitution,
      policy,
      proposal: {
        proposal_id: "p3",
        policy_ref: policy.ref,
        base_version: 1,
        strategy: "visual-first",
        weight_delta: 0.2,
        rationale: "",
        evidence: [],
      },
    });
    expect(valid.accepted).toBe(true);
    expect(valid.policy?.version).toBe(2);
    expect(valid.policy?.parent_version).toBe(1);
    // Acceptance mints a new version but never touches identity.
    expect(valid.policy?.agent_id).toBe(policy.agent_id);
    expect(valid.policy?.ref).toBe(policyRef(AGENT_ID, LEARNER_CID));
  });

  it("exploration covers every strategy before the policy exploits", async () => {
    const h = buildHarness("visual-first");
    const result = await runLoop(h, taskFor("photosynthesis"), {
      episodes: 9,
      explorationRounds: 1,
    });
    const exploredStrategies = new Set(
      result.records.filter((r) => r.compiled.from_exploration).map((r) => r.compiled.strategy),
    );
    expect(exploredStrategies.size).toBe(EXPLANATION_STRATEGIES.length);
  });
});
