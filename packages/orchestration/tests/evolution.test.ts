import { describe, expect, test } from "vitest";
import { ManualClock, SeededIdGenerator } from "@inevitable/shared";
import type { ProposeParams, ProposalConfiguration, SyntheticLearnerSeed } from "../src/evolution";
import { EvolutionEngine } from "../src/evolution";

const clock = new ManualClock(2_000_000);
const idGenerator = new SeededIdGenerator("evolution-test");

function makeEngine(
  opts: {
    publish?: (t: string, p: Record<string, unknown>) => void;
    guard?: (action: string) => boolean;
  } = {},
) {
  return new EvolutionEngine({ clock, idGenerator, ...opts });
}

const intermediatelearner: SyntheticLearnerSeed = {
  learnerId: "synthetic-intermediate",
  masteryMap: {
    "linear-algebra": { level: 3, confidence: 0.7 },
    calculus: { level: 2, confidence: 0.6 },
  },
  goals: ["neural-networks"],
};

const advancedLearner: SyntheticLearnerSeed = {
  learnerId: "synthetic-advanced",
  masteryMap: {
    "linear-algebra": { level: 4, confidence: 0.9 },
    calculus: { level: 4, confidence: 0.85 },
    probability: { level: 3, confidence: 0.75 },
  },
  goals: ["deep-learning"],
};

const beginnerLearner: SyntheticLearnerSeed = {
  learnerId: "synthetic-beginner",
  masteryMap: {},
  goals: ["basic-algebra"],
};

const defaultConfig: ProposalConfiguration = { parameters: {} };

const defaultParams: ProposeParams = {
  kind: "depth_adjustment",
  description: "Increase explanation depth for advanced concepts",
  configuration: { targetDepthDelta: 2, parameters: {} },
  syntheticLearners: [intermediatelearner, advancedLearner],
};

describe("EvolutionEngine.propose", () => {
  test("mints a proposal with status proposed", () => {
    const eng = makeEngine();
    const proposal = eng.propose(defaultParams);
    expect(proposal.status).toBe("proposed");
    expect(proposal.proposalId).toMatch(/^evol-/);
    expect(proposal.kind).toBe("depth_adjustment");
    expect(proposal.description).toBe("Increase explanation depth for advanced concepts");
    expect(proposal.evaluationResult).toBeUndefined();
  });

  test("emits evolution.proposal.created event", () => {
    const emitted: Array<[string, Record<string, unknown>]> = [];
    const eng = makeEngine({ publish: (t, p) => emitted.push([t, p]) });
    const proposal = eng.propose(defaultParams);
    expect(emitted).toHaveLength(1);
    expect(emitted[0]![0]).toBe("evolution.proposal.created");
    expect(emitted[0]![1]["proposal_id"]).toBe(proposal.proposalId);
    expect(emitted[0]![1]["status"]).toBe("proposed");
  });
});

describe("EvolutionEngine.get and list", () => {
  test("get returns the proposal by id", () => {
    const eng = makeEngine();
    const p = eng.propose(defaultParams);
    expect(eng.get(p.proposalId)?.proposalId).toBe(p.proposalId);
  });

  test("get returns undefined for unknown id", () => {
    const eng = makeEngine();
    expect(eng.get("evol-unknown")).toBeUndefined();
  });

  test("list returns all proposals in creation order", () => {
    const eng = makeEngine();
    const p1 = eng.propose(defaultParams);
    const p2 = eng.propose({ ...defaultParams, description: "Second proposal" });
    const all = eng.list();
    expect(all).toHaveLength(2);
    expect(all[0]!.proposalId).toBe(p1.proposalId);
    expect(all[1]!.proposalId).toBe(p2.proposalId);
  });
});

describe("EvolutionEngine.evaluate", () => {
  test("sets status to evaluated and returns EvaluationResult", () => {
    const eng = makeEngine();
    const p = eng.propose(defaultParams);
    const result = eng.evaluate(p.proposalId);
    expect(eng.get(p.proposalId)?.status).toBe("evaluated");
    expect(result.proposalId).toBe(p.proposalId);
    expect(result.shadowResults).toHaveLength(2);
    expect(result.evaluatedAt).toBeDefined();
  });

  test("emits experiment.started and shadow_result.recorded events", () => {
    const emitted: Array<[string, Record<string, unknown>]> = [];
    const eng = makeEngine({ publish: (t, p) => emitted.push([t, p]) });
    const proposal = eng.propose(defaultParams);
    eng.evaluate(proposal.proposalId);
    const started = emitted.find((e) => e[0] === "evolution.experiment.started");
    expect(started).toBeDefined();
    expect(started![1]["proposal_id"]).toBe(proposal.proposalId);
    expect(started![1]["synthetic_learner_count"]).toBe(2);
    const recorded = emitted.filter((e) => e[0] === "evolution.shadow_result.recorded");
    expect(recorded).toHaveLength(2);
  });

  test("approve recommendation when overallPassRate >= 0.6", () => {
    const eng = makeEngine();
    const p = eng.propose(defaultParams);
    const result = eng.evaluate(p.proposalId);
    expect(result.overallPassRate).toBeGreaterThanOrEqual(0.6);
    expect(result.recommendation).toBe("approve");
  });

  test("reject recommendation when overallPassRate < 0.6 (beginner-only seed)", () => {
    const eng = makeEngine();
    const p = eng.propose({
      ...defaultParams,
      kind: "depth_adjustment",
      configuration: { targetDepthDelta: -1, parameters: {} },
      syntheticLearners: [beginnerLearner],
    });
    const result = eng.evaluate(p.proposalId);
    expect(result.recommendation).toBe("reject");
  });

  test("throws when not in proposed state", () => {
    const eng = makeEngine();
    const p = eng.propose(defaultParams);
    eng.evaluate(p.proposalId);
    expect(() => eng.evaluate(p.proposalId)).toThrow("proposed");
  });

  test("throws for unknown proposal id", () => {
    const eng = makeEngine();
    expect(() => eng.evaluate("evol-nope")).toThrow("not found");
  });
});

describe("EvolutionEngine.approve", () => {
  test("approves when recommendation is approve", () => {
    const eng = makeEngine();
    const p = eng.propose(defaultParams);
    eng.evaluate(p.proposalId);
    const approved = eng.approve(p.proposalId);
    expect(approved.status).toBe("approved");
    expect(approved.approvedAt).toBeDefined();
  });

  test("throws when not evaluated", () => {
    const eng = makeEngine();
    const p = eng.propose(defaultParams);
    expect(() => eng.approve(p.proposalId)).toThrow("evaluated");
  });

  test("throws when recommendation is reject", () => {
    const eng = makeEngine();
    const p = eng.propose({
      ...defaultParams,
      kind: "depth_adjustment",
      configuration: { targetDepthDelta: -1, parameters: {} },
      syntheticLearners: [beginnerLearner],
    });
    eng.evaluate(p.proposalId);
    expect(() => eng.approve(p.proposalId)).toThrow("rejection");
  });

  test("throws when governance guard returns false", () => {
    const eng = makeEngine({ guard: () => false });
    const p = eng.propose(defaultParams);
    eng.evaluate(p.proposalId);
    expect(() => eng.approve(p.proposalId)).toThrow("governance");
  });
});

describe("EvolutionEngine.rollout", () => {
  test("marks proposal as rolled_out and emits rollout.completed", () => {
    const emitted: Array<[string, Record<string, unknown>]> = [];
    const eng = makeEngine({ publish: (t, p) => emitted.push([t, p]) });
    const p = eng.propose(defaultParams);
    eng.evaluate(p.proposalId);
    eng.approve(p.proposalId);
    const out = eng.rollout(p.proposalId);
    expect(out.status).toBe("rolled_out");
    expect(out.rolledOutAt).toBeDefined();
    expect(emitted.some((e) => e[0] === "evolution.rollout.completed")).toBe(true);
  });

  test("throws when not approved", () => {
    const eng = makeEngine();
    const p = eng.propose(defaultParams);
    eng.evaluate(p.proposalId);
    expect(() => eng.rollout(p.proposalId)).toThrow("approved");
  });
});

describe("EvolutionEngine.rollback", () => {
  test("rolls back from approved state", () => {
    const eng = makeEngine();
    const p = eng.propose(defaultParams);
    eng.evaluate(p.proposalId);
    eng.approve(p.proposalId);
    const rb = eng.rollback(p.proposalId);
    expect(rb.status).toBe("rolled_back");
    expect(rb.rolledBackAt).toBeDefined();
  });

  test("rolls back from rolled_out state", () => {
    const eng = makeEngine();
    const p = eng.propose(defaultParams);
    eng.evaluate(p.proposalId);
    eng.approve(p.proposalId);
    eng.rollout(p.proposalId);
    const rb = eng.rollback(p.proposalId);
    expect(rb.status).toBe("rolled_back");
  });

  test("emits evolution.rollback.completed on first rollback", () => {
    const emitted: Array<[string, Record<string, unknown>]> = [];
    const eng = makeEngine({ publish: (t, p) => emitted.push([t, p]) });
    const p = eng.propose(defaultParams);
    eng.evaluate(p.proposalId);
    eng.approve(p.proposalId);
    eng.rollback(p.proposalId);
    expect(emitted.some((e) => e[0] === "evolution.rollback.completed")).toBe(true);
  });

  test("rollback is idempotent — repeated call returns current state without re-emitting", () => {
    const emitted: Array<[string, Record<string, unknown>]> = [];
    const eng = makeEngine({ publish: (t, p) => emitted.push([t, p]) });
    const p = eng.propose(defaultParams);
    eng.evaluate(p.proposalId);
    eng.approve(p.proposalId);
    eng.rollback(p.proposalId);
    eng.rollback(p.proposalId);
    expect(emitted.filter((e) => e[0] === "evolution.rollback.completed")).toHaveLength(1);
  });

  test("data preserved after rollback (evaluation result intact)", () => {
    const eng = makeEngine();
    const p = eng.propose(defaultParams);
    eng.evaluate(p.proposalId);
    eng.approve(p.proposalId);
    eng.rollback(p.proposalId);
    const found = eng.get(p.proposalId);
    expect(found?.evaluationResult).toBeDefined();
    expect(found?.status).toBe("rolled_back");
  });

  test("throws when rolling back from proposed state", () => {
    const eng = makeEngine();
    const p = eng.propose(defaultParams);
    expect(() => eng.rollback(p.proposalId)).toThrow("proposed");
  });

  test("throws for unknown proposal id", () => {
    const eng = makeEngine();
    expect(() => eng.rollback("evol-nope")).toThrow("not found");
  });
});

describe("ShadowEvaluator — deterministic projection", () => {
  test("strategy_shift yields higher pass rate than baseline", () => {
    const eng = makeEngine();
    const p = eng.propose({
      kind: "strategy_shift",
      description: "Example-first strategy",
      configuration: defaultConfig,
      syntheticLearners: [intermediatelearner],
    });
    const result = eng.evaluate(p.proposalId);
    expect(result.shadowResults[0]!.simulatedPassRate).toBeGreaterThan(0.5);
    expect(result.shadowResults[0]!.confidenceDelta).toBeGreaterThan(0);
  });

  test("empty synthetic learners yields overallPassRate 0 and recommend reject", () => {
    const eng = makeEngine();
    const p = eng.propose({
      ...defaultParams,
      syntheticLearners: [],
    });
    const result = eng.evaluate(p.proposalId);
    expect(result.overallPassRate).toBe(0);
    expect(result.recommendation).toBe("reject");
  });
});
