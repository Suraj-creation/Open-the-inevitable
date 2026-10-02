import { describe, expect, it } from "vitest";
import { canonicalJson, sha256Hex } from "@uci/kernel";
import type { ClaimAsserted, CognitiveState } from "@uci/substrate";
import { compileContext, type Mode, type Staleness, type WorkingState } from "../src/index.js";

/**
 * The model-visible boundary, frozen (S2 criterion 4; journal criteria-20261002-cf81). S2 changes
 * storage, hosting and admission, never what a faculty sees: the rendered bytes (system prompt,
 * working-state prompt, proposal schema) for a working state exercising every section must equal
 * their value at the Tier R v2 commit 5acbfab, in every mode. A deliberate change to the boundary is
 * a new live battery's business: update these hashes only together with one.
 */
const claim = (
  claimId: string,
  version: number,
  proposition: string,
  extra: Partial<ClaimAsserted> = {},
): ClaimAsserted => ({
  claimId,
  version,
  claimKind: "assertion",
  subject: "L1",
  proposition,
  origin: "inferred",
  standing: "conjectured",
  confidence: 0.6,
  evidence: ["rec:process/P1#20"],
  derivation: { operator: "proposal@1", operatorVersion: "1" },
  ...extra,
});

const WS: WorkingState = {
  processId: "P1",
  entityId: "L1",
  step: 7,
  now: "2026-01-05T00:00:00.000Z",
  objective: {
    id: "O1",
    record: 3,
    value: {
      goal: "The learner reaches verified mastery of adding fractions with unlike denominators.",
      acceptance:
        "3 consecutive correct answers on probes selected by the environment, judged by the environment's verifier.",
    },
  },
  authority: {
    id: "A",
    record: 2,
    value: {
      actions: ["explain", "practice", "assess", "ask_person"],
      effectClasses: ["model-call", "external-communication"],
      modelCallBudget: 60,
    },
  },
  modelCallsUsed: 6,
  notice: {
    id: "N103",
    record: 103,
    value: {
      resumeAttempt: 2,
      interruptedAtStep: 6,
      settled: [{ effectId: "X6-a1", outcome: "outcome_unknown" }],
      reconciled: [{ effectId: "X6-a1", finding: "delivered" }],
      faculty: "f@1/m",
    },
  },
  decisionsInForce: [
    {
      id: "D6",
      record: 99,
      value: {
        choice: "practice i-3: practice i-3",
        alternatives: "practice p=0.7 · assess p=0.3",
        reliesOn: ["C2-1@v1", "C3-1@v1"],
        expectations: ["E6"],
        revised: ["C3-1@v1"],
      },
    },
  ],
  openDecisions: [
    {
      id: "D2-o",
      record: 40,
      value: {
        question: "When to move from practice to assessment",
        alternatives: "continue practice p=0.6 · assess p=0.4",
        options: ["continue practice", "assess"],
        pendingOn: [],
      },
    },
  ],
  claims: [
    {
      id: "C2-1@v1",
      record: 30,
      value: {
        data: claim("C2-1", 1, "The learner is fluent with multiplication facts up to 10x10.", {
          confidence: 0.7,
          standing: "supported",
          validUntil: "2026-01-04T00:00:00.000Z",
        }),
        stale: true,
      },
    },
    {
      id: "C3-1@v2",
      record: 110,
      value: {
        data: claim("C3-1", 2, "The learner does not add denominators.", { supersedes: "C3-1@v1" }),
        stale: false,
      },
    },
  ],
  superseded: [{ id: "C3-1@v1", record: 49, value: { by: "C3-1@v2" } }],
  expectations: [
    {
      id: "E6",
      record: 100,
      value: {
        data: {
          ...claim("E6", 1, "The learner answers i-3 correctly."),
          claimKind: "expectation",
          decisionId: "D6",
          due: "2026-01-07T00:00:00.000Z",
          probability: 0.3,
        },
      },
    },
  ],
  resolutions: [
    {
      id: "V-E5",
      record: 90,
      value: { resolves: "E5", outcome: "failed", verifier: "answer-key@1" },
    },
  ],
  questions: [
    {
      id: "Q4",
      record: 70,
      value: { text: "Why do you add the denominators together?", askedOf: "learner" },
    },
  ],
  inputs: [
    {
      id: "I4",
      record: 105,
      value: { from: "learner", content: "I think it's 9/10.", inReplyTo: "X6-a1" },
    },
    {
      id: "I5",
      record: 107,
      value: { from: "learner", content: "i dont add the bottoms, i just copied the 6 wrong" },
    },
  ],
  observations: [
    {
      id: "X6-a1",
      record: 101,
      value: {
        action: "practice",
        content: "Delivered practice item i-3 (2/5 + 1/2 = ?) to the learner.",
      },
    },
  ],
  transcript: [
    {
      id: "M6-k1-a1",
      record: 95,
      value: { content: '{"action":{"type":"practice","item_id":"i-3"}}' },
    },
  ],
  olderInputs: ["I1", "I2", "I3"],
  environment: {
    id: "environment",
    record: 4,
    value: {
      actions: [
        { name: "explain", description: "Send the learner an explanation.", params: ["content"] },
        {
          name: "practice",
          description: "Give the learner one practice item by id.",
          params: ["item_id"],
        },
        {
          name: "assess",
          description:
            "The environment gives the learner its next held-out assessment probe; you will not see which item.",
          params: [],
        },
        { name: "ask_person", description: "Ask the learner a question.", params: ["content"] },
      ],
      practiceItems: [
        { itemId: "i-1", prompt: "1/2 + 1/3 = ?" },
        { itemId: "i-2", prompt: "1/4 + 1/3 = ?" },
      ],
    },
  },
  probeOutcomes: ["held", "held", "held"],
  acceptance: {
    id: "A160",
    record: 160,
    value: { met: true, probes: 3, evaluator: "env-tutor@1" },
  },
  lastRejection: {
    id: "R112",
    record: 112,
    value: { step: 7, evidenceHash: "h", errors: ["example rejection"] },
  },
  cognitive: {} as CognitiveState,
};

/** The bytes a faculty receives, hashed: system prompt, rendered working state, proposal schema. */
function boundary(mode: Mode, staleness: Staleness): string {
  const { request } = compileContext(WS, { id: "f@1", model: "m" }, mode, staleness);
  return sha256Hex(
    `${request.system}\n\u0000\n${request.prompt}\n\u0000\n${canonicalJson(request.schema)}`,
  );
}

const GOLDEN: Record<string, string> = {
  "bridge/gate": "645a418f44b1e1e41f49f14396283eebc0180bf235e8f512753836c5bcd5db22",
  "bridge/off": "204b6818cf113a18bcdf14b9a22c002f87cd3bc86ebcb0f48950505689f378fe",
  "transcript/gate": "177e16365cc5161645c00bc844ce62bd5b7a4d9cfb1a9907d297ddcb3783a977",
  "floor-only/gate": "ef7d168ad9d0634ff46255a898da97142d7c80207d198c0d08764789e08c6c4f",
};

describe("the model-visible boundary is frozen", () => {
  for (const key of Object.keys(GOLDEN)) {
    const [mode, staleness] = key.split("/") as [Mode, Staleness];
    it(`${key} renders the same bytes as at the Tier R v2 commit`, () => {
      expect(boundary(mode, staleness)).toBe(GOLDEN[key]);
    });
  }
});

export { boundary };
