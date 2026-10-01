/**
 * proposal@1: what a faculty may say back. Provider-neutral JSON-schema subset (lowercase types,
 * optional fields simply omitted from `required`, no `nullable`), so every adapter can pass it to its
 * provider's structured-output mode without lossy translation.
 */
const str = { type: "string" };
const num = { type: "number" };
const strs = { type: "array", items: str };
const alternative = {
  type: "object",
  properties: { option: str, probability: num, rejected_because: str },
  required: ["option", "probability"],
};

export const PROPOSAL_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    restatement: {
      type: "object",
      properties: { objective_id: str, rationale_decision_id: str, why: str },
      required: ["objective_id", "why"],
    },
    reexamines: {
      type: "array",
      items: {
        type: "object",
        properties: {
          decision_id: str,
          verdict: { type: "string", enum: ["reaffirm", "revise", "withdraw"] },
          reason: str,
        },
        required: ["decision_id", "verdict", "reason"],
      },
    },
    decision: {
      type: "object",
      properties: {
        choice: str,
        alternatives: { type: "array", items: alternative },
        relies_on: strs,
        rationale: str,
        resolves_open_decision_id: str,
        deviates_from_decision_id: str,
        deviation_evidence: strs,
      },
      required: ["choice", "alternatives", "relies_on", "rationale"],
    },
    open_decision: {
      type: "object",
      properties: {
        question: str,
        alternatives: { type: "array", items: alternative },
        pending_on: strs,
      },
      required: ["question", "alternatives", "pending_on"],
    },
    action: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["explain", "practice", "assess", "ask_person", "conclude"] },
        item_id: str,
        content: str,
      },
      required: ["type"],
    },
    expectation: {
      type: "object",
      properties: { statement: str, probability: num },
      required: ["statement", "probability"],
    },
    claims: {
      type: "array",
      items: {
        type: "object",
        properties: {
          subject: str,
          proposition: str,
          confidence: num,
          evidence: strs,
          valid_for_days: num,
          revises: str,
        },
        required: ["subject", "proposition", "confidence", "evidence"],
      },
    },
    questions_closed: {
      type: "array",
      items: {
        type: "object",
        properties: { question_id: str, reason: str },
        required: ["question_id", "reason"],
      },
    },
  },
  required: ["restatement", "reexamines", "decision", "action", "claims", "questions_closed"],
};
