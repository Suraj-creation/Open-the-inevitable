import { describe, expect, it } from "vitest";
import { type CausalRecord, type Draft, KERNEL_KINDS, KindRegistry } from "@uci/kernel";
import {
  type ClaimAsserted,
  currentClaim,
  decisionsInForce,
  foldCognitiveState,
  openDecisions,
  openExpectations,
  premiseRevised,
  staleClaims,
  SUBSTRATE_KINDS,
  substrateViolations,
} from "../src/index.js";

const registry = new KindRegistry([...KERNEL_KINDS, ...SUBSTRATE_KINDS]);
const derivation = { operator: "proposal-parser", operatorVersion: "1" };

let seq = 0;
function rec(draft: Draft): CausalRecord {
  const errs = registry.validate(draft);
  if (errs.length) throw new Error(errs.join("; "));
  return {
    stream: "process/P1",
    seq: ++seq,
    kind: draft.kind,
    v: draft.v,
    at: "2026-01-01T00:00:00.000Z",
    processId: "P1",
    entityId: "L1",
    labels: draft.labels ?? [],
    causes: draft.causes ?? [],
    data: draft.data,
  };
}
const claim = (c: Partial<ClaimAsserted> & Pick<ClaimAsserted, "claimId">): Draft => ({
  kind: "claim.asserted",
  v: 1,
  data: {
    version: 1,
    claimKind: "assertion",
    subject: "L1",
    proposition: "p",
    origin: "inferred",
    standing: "conjectured",
    confidence: 0.6,
    evidence: ["ev:abc"],
    derivation,
    ...c,
  },
});
const made = (decisionId: string, reliesOn: string[], extra: object = {}): Draft => ({
  kind: "decision.made",
  v: 1,
  data: {
    decisionId,
    choice: "worked examples",
    alternatives: [
      { option: "worked examples", probability: 0.6 },
      { option: "area model", probability: 0.4, rejectedBecause: "slower" },
    ],
    reliesOn,
    expectations: [],
    rationale: "r",
    authority: "rec:process/P1#2",
    ...extra,
  },
});

describe("write-time stage invariants", () => {
  it("model output can never be verified: inferred claims cannot be verified or refuted", () => {
    expect(registry.validate(claim({ claimId: "C1", standing: "verified" })).join()).toMatch(
      /I-C4/,
    );
  });
  it("verified requires a verifier resolution", () => {
    expect(
      registry.validate(claim({ claimId: "C1", origin: "observed", standing: "verified" })).join(),
    ).toMatch(/I-C2/);
  });
  it("a claim needs evidence (I-C1) and a revision must name what it supersedes", () => {
    expect(registry.validate(claim({ claimId: "C1", evidence: [] })).join()).toMatch(
      /evidence must not be empty/,
    );
    expect(registry.validate(claim({ claimId: "C1", version: 2 })).join()).toMatch(
      /must supersede C1@v1/,
    );
  });
  it("expectations and resolutions carry their kind-specific fields", () => {
    expect(registry.validate(claim({ claimId: "E1", claimKind: "expectation" })).join()).toMatch(
      /condition, due, probability/,
    );
    expect(
      registry
        .validate(
          claim({
            claimId: "R1",
            claimKind: "resolution",
            origin: "verifier",
            standing: "supported",
          }),
        )
        .join(),
    ).toMatch(/resolves, outcome/);
  });
});

describe("supersede, never overwrite", () => {
  const records = [
    rec(claim({ claimId: "C2", proposition: "the learner adds denominators" })),
    rec(made("D3", ["C2@v1"])),
    rec(
      claim({
        claimId: "C2",
        version: 2,
        supersedes: "C2@v1",
        origin: "stated-by-person",
        standing: "supported",
        proposition: "the learner does not add denominators",
        evidence: ["ev:learner-msg"],
      }),
    ),
  ];

  it("keeps every version and answers what we believed then", () => {
    const now = foldCognitiveState(records);
    expect(now.claims.get("C2")).toHaveLength(2);
    expect(currentClaim(now, "C2")?.data.version).toBe(2);
    const then = foldCognitiveState(records.slice(0, 2));
    expect(currentClaim(then, "C2")?.data.proposition).toBe("the learner adds denominators");
  });

  it("flags decisions whose premise was superseded until they are re-examined (C-R3)", () => {
    const state = foldCognitiveState(records);
    expect(premiseRevised(state).map((p) => p.decision.data.decisionId)).toEqual(["D3"]);
    const after = foldCognitiveState([
      ...records,
      rec(
        made("D6-r1", [], {
          reexamines: { decisionId: "D3", verdict: "revise", reason: "premise gone" },
        }),
      ),
      rec(made("D6", ["C2@v2"])),
    ]);
    expect(premiseRevised(after)).toEqual([]);
    // A re-examination is an act, not a standing decision; D3 is retired; D6 is operative.
    expect(decisionsInForce(after).map((d) => d.data.decisionId)).toEqual(["D6"]);
  });

  it("a re-validation that keeps the proposition is not a revision of dependent premises", () => {
    const fluent = {
      claimId: "C6",
      proposition: "fluent with multiplication facts",
      validUntil: "2026-01-03T00:00:00.000Z",
    };
    const base = [rec(claim(fluent)), rec(made("D9", ["C6@v1"]))];
    const revalidated = [
      ...base,
      rec(
        claim({
          ...fluent,
          version: 2,
          supersedes: "C6@v1",
          validUntil: "2026-02-01T00:00:00.000Z",
          evidence: ["ev:fresh"],
        }),
      ),
    ];
    expect(premiseRevised(foldCognitiveState(revalidated))).toEqual([]);
    const contradicted = [
      ...base,
      rec(
        claim({
          claimId: "C6",
          version: 2,
          supersedes: "C6@v1",
          proposition: "not fluent",
          evidence: ["ev:fresh"],
        }),
      ),
    ];
    expect(
      premiseRevised(foldCognitiveState(contradicted)).map((p) => p.decision.data.decisionId),
    ).toEqual(["D9"]);
  });

  it("a new operative decision supersedes the previous one explicitly", () => {
    const chain = [rec(made("D10", [])), rec(made("D11", [], { supersedes: "D10" }))];
    expect(decisionsInForce(foldCognitiveState(chain)).map((d) => d.data.decisionId)).toEqual([
      "D11",
    ]);
    expect(substrateViolations(chain, [made("D12", [], { supersedes: "D10" })]).join()).toMatch(
      /not in force/,
    );
  });

  it("refuses a new decision that relies on a superseded claim version", () => {
    expect(substrateViolations(records, [made("D7", ["C2@v1"])]).join()).toMatch(/superseded/);
    expect(substrateViolations(records, [made("D7", ["C2@v2"])])).toEqual([]);
  });

  it("refuses overwriting the objective", () => {
    const withObjective = [
      rec({ kind: "objective.set", v: 1, data: { objectiveId: "O1", goal: "g", acceptance: "a" } }),
    ];
    expect(
      substrateViolations(withObjective, [
        { kind: "objective.set", v: 1, data: { objectiveId: "O2", goal: "g2", acceptance: "a" } },
      ]).join(),
    ).toMatch(/already set/);
  });
});

describe("staleness and expectations", () => {
  it("detects lapsed validity (C-R5) and overdue expectations (C-R4)", () => {
    const records = [
      rec(claim({ claimId: "C6", validUntil: "2026-01-05T00:00:00.000Z" })),
      rec(made("D3", ["C6@v1"], { expectations: ["E4"] })),
      rec(
        claim({
          claimId: "E4",
          claimKind: "expectation",
          condition: { kind: "answer-correct", itemId: "i-7" },
          due: "2026-01-03T00:00:00.000Z",
          probability: 0.55,
          decisionId: "D3",
        }),
      ),
    ];
    const state = foldCognitiveState(records);
    expect(staleClaims(state, "2026-01-02T00:00:00.000Z")).toEqual([]);
    expect(staleClaims(state, "2026-01-10T00:00:00.000Z").map((c) => c.data.claimId)).toEqual([
      "C6",
    ]);
    expect(
      openExpectations(state, "2026-01-10T00:00:00.000Z").map((e) => [
        e.expectation.data.claimId,
        e.overdue,
      ]),
    ).toEqual([["E4", true]]);
  });

  it("allows exactly one resolution per expectation, only from a verifier", () => {
    const base = [
      rec(made("D3", [], { expectations: ["E4"] })),
      rec(
        claim({
          claimId: "E4",
          claimKind: "expectation",
          condition: { kind: "answer-correct", itemId: "i-7" },
          due: "2026-01-03T00:00:00.000Z",
          probability: 0.55,
          decisionId: "D3",
        }),
      ),
    ];
    const resolution = claim({
      claimId: "R1",
      claimKind: "resolution",
      origin: "verifier",
      standing: "verified",
      resolves: "E4",
      outcome: "held",
      method: "answer-key",
      verifier: {
        id: "answer-key",
        version: "1",
        measuredError: "0/0 exact-match",
        actorVisible: false,
      },
    });
    expect(substrateViolations(base, [resolution])).toEqual([]);
    const resolved = [...base, rec(resolution)];
    expect(openExpectations(foldCognitiveState(resolved), "2026-01-10T00:00:00.000Z")).toEqual([]);
    const again = claim({
      claimId: "R2",
      claimKind: "resolution",
      origin: "verifier",
      standing: "verified",
      resolves: "E4",
      outcome: "failed",
      method: "answer-key",
      verifier: {
        id: "answer-key",
        version: "1",
        measuredError: "0/0 exact-match",
        actorVisible: false,
      },
    });
    expect(substrateViolations(resolved, [again]).join()).toMatch(/already resolved/);
  });

  it("a decision must declare only expectations bound to it, possibly later in the same batch", () => {
    const decision = made("D9", [], { expectations: ["E9"] });
    const exp = claim({
      claimId: "E9",
      claimKind: "expectation",
      condition: { kind: "answer-correct", itemId: "i-2" },
      due: "2026-01-03T00:00:00.000Z",
      probability: 0.5,
      decisionId: "D9",
    });
    expect(substrateViolations([], [decision, exp])).toEqual([]);
    expect(substrateViolations([], [decision]).join()).toMatch(/not an expectation bound to it/);
  });
});

describe("open decisions", () => {
  it("stay open until a made decision resolves them (C-R2)", () => {
    const opened = rec({
      kind: "decision.opened",
      v: 1,
      data: {
        decisionId: "D5",
        question: "next probe type",
        alternatives: [
          { option: "same-type", probability: 0.5 },
          { option: "harder", probability: 0.5 },
        ],
        pendingOn: ["E4"],
      },
    });
    expect(openDecisions(foldCognitiveState([opened])).map((d) => d.data.decisionId)).toEqual([
      "D5",
    ]);
    const resolved = rec(made("D8", [], { resolves: "D5" }));
    expect(openDecisions(foldCognitiveState([opened, resolved]))).toEqual([]);
  });
});
