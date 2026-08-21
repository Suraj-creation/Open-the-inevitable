/**
 * Default governance policies (illustrative baselines from ../../../spec/architecture/uci-architecture.md#14-governance).
 * Real deployments register tenant/domain policies; these establish the enforcement shape.
 */
import type { Policy, PolicyRequest, PolicyOutcome } from "./policy";

const PII_PATTERNS: RegExp[] = [
  /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/, // phone
  /\b[\w.+-]+@[\w-]+\.[a-z]{2,}\b/i, // email
  /\b\d{3}-\d{2}-\d{4}\b/, // SSN-like
];

function payloadText(request: PolicyRequest): string {
  return request.payload ? JSON.stringify(request.payload) : "";
}

/** GOV-001: block PII in public / learner-facing payloads. */
export const noPiiInPublicOutput: Policy = {
  id: "GOV-001-NO-PII",
  version: "1.0.0",
  type: "data",
  priority: 1,
  appliesTo: (request) =>
    request.classification === "public" || request.action === "publish.student_facing",
  evaluate: (request): PolicyOutcome => {
    const text = payloadText(request);
    const hit = PII_PATTERNS.some((pattern) => pattern.test(text));
    return hit
      ? {
          decision: "block",
          reason: "PII detected in public / learner-facing output",
          evidence: ["GOV-001"],
        }
      : { decision: "allow", reason: "no PII detected" };
  },
};

/** GOV-002: low-confidence agent responses require human review. */
export const lowConfidenceRequiresReview: Policy = {
  id: "GOV-002-LOW-CONF",
  version: "1.0.0",
  type: "evidence",
  priority: 2,
  appliesTo: (request) =>
    request.action === "agent.response" && typeof request.payload?.confidence === "number",
  evaluate: (request): PolicyOutcome => {
    const confidence = request.payload?.confidence as number;
    return confidence < 0.3
      ? {
          decision: "review",
          reason: `confidence ${confidence} below review threshold 0.3`,
          modifiedPayload: { ...request.payload, requires_human_review: true },
          reviewPath: "human-governance/low-confidence",
        }
      : { decision: "allow", reason: "confidence acceptable" };
  },
};

export const DEFAULT_POLICIES: readonly Policy[] = [
  noPiiInPublicOutput,
  lowConfidenceRequiresReview,
];
