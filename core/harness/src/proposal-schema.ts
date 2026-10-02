/**
 * proposal@1: what a faculty may say back. Provider-neutral JSON-schema subset (lowercase types,
 * optional fields simply omitted from `required`, no `nullable`), so every adapter can translate it
 * to its provider's structured-output dialect without changing the contract. Descriptions state
 * exactly which ids each field accepts; they are part of the contract the model reads.
 */
const str = (description?: string) =>
  description ? { type: "string", description } : { type: "string" };
const num = (description?: string) =>
  description ? { type: "number", description } : { type: "number" };
const strs = (description: string) => ({ type: "array", items: { type: "string" }, description });
const alternative = {
  type: "object",
  properties: {
    option: str(),
    probability: num("Probability in [0,1] that this option is best."),
    rejected_because: str(),
  },
  required: ["option", "probability"],
};

export const PROPOSAL_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    restatement: {
      type: "object",
      description: "Restate the objective and the reason for the current plan.",
      properties: {
        objective_id: str("The objective id, e.g. O1."),
        rationale_decision_id: str(
          "A decision in force (D...) whose reasoning you continue, if any.",
        ),
        why: str(),
      },
      required: ["objective_id", "why"],
    },
    reexamines: {
      type: "array",
      description:
        "Decisions in force (D...) you re-examine now. Required for every decision marked PREMISE REVISED, and for every decision in force that relies on a claim you revise in this proposal.",
      items: {
        type: "object",
        properties: {
          decision_id: str("A decision in force, D..."),
          verdict: { type: "string", enum: ["reaffirm", "revise", "withdraw"] },
          reason: str(),
        },
        required: ["decision_id", "verdict", "reason"],
      },
    },
    decision: {
      type: "object",
      properties: {
        choice: str("What you decide to do now."),
        alternatives: {
          type: "array",
          items: alternative,
          description:
            "Candidate actions for this step with their probability of being best; include the chosen action.",
        },
        relies_on: strs(
          "Claim versions this decision relies on: ids like C3-1@v1 ONLY. Never decisions (D...), inputs (I...) or observations (X...). May be empty.",
        ),
        rationale: str(),
        resolves_open_decision_id: str(
          "Set only when this decision resolves an open decision (D...-o); the choice must be one of its listed alternatives.",
        ),
        deviates_from_decision_id: str(
          "Set only when deliberately departing from a decision in force (D...).",
        ),
        deviation_evidence: strs(
          "Ids of evidence recorded after that decision which justify the deviation.",
        ),
      },
      required: ["choice", "alternatives", "relies_on", "rationale"],
    },
    open_decision: {
      type: "object",
      description:
        "Optional: a decision you are deliberately leaving open until something resolves.",
      properties: {
        question: str(),
        alternatives: { type: "array", items: alternative },
        pending_on: strs("Expectation (E...) or question (Q...) ids it waits on."),
      },
      required: ["question", "alternatives", "pending_on"],
    },
    action: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["explain", "practice", "assess", "ask_person", "conclude"] },
        item_id: str("For practice: a practice item id from the list, e.g. i-1."),
        content: str("For explain and ask_person: the text sent to the learner."),
      },
      required: ["type"],
    },
    expectation: {
      type: "object",
      description: "Required for practice and assess: what you expect, declared before acting.",
      properties: {
        statement: str(),
        probability: num("Your probability in [0,1] that the learner answers correctly."),
      },
      required: ["statement", "probability"],
    },
    claims: {
      type: "array",
      description: "New beliefs you infer, or revisions of current claims. May be empty.",
      items: {
        type: "object",
        properties: {
          subject: str(),
          proposition: str(),
          confidence: num("In [0,1]."),
          evidence: strs(
            "Ids of inputs (I...), observations (X...) or current claims (C...@v...) supporting it. At least one.",
          ),
          valid_for_days: num(
            "How long this belief stays valid without re-checking, if it can go stale.",
          ),
          revises: str(
            "The current version (C...@v...) of the same belief this updates (a re-validation or a revision). A different belief is a new claim: leave revises out.",
          ),
        },
        required: ["subject", "proposition", "confidence", "evidence"],
      },
    },
    questions_closed: {
      type: "array",
      description: "Open questions (Q...) you close now, each with a reason. May be empty.",
      items: {
        type: "object",
        properties: { question_id: str("An open question, Q..."), reason: str() },
        required: ["question_id", "reason"],
      },
    },
  },
  required: ["restatement", "reexamines", "decision", "action", "claims", "questions_closed"],
};
