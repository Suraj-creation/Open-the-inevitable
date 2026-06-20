/**
 * Product-cognition governance policies — enforced at the dispatch boundary.
 *
 * Governance is a kernel primitive (spec/kernel/governance-kernel.md). Every agent dispatch
 * in the product runtime must pass through the governance gate before work is admitted.
 *
 * Policies here are minimal-viable baselines for Phase 1E.  Real deployments should extend
 * them with tenant-scoped, domain-specific, and pedagogy-aware rules.
 *
 * Spec: spec/product/product-cognition-runtime.md §10.
 */
import type { Policy, PolicyOutcome, PolicyRequest } from "@inevitable/governance";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Agents available to standard learners (trust_level >= 1). */
const STUDENT_AGENTS = new Set([
  "supervisor",
  "explanation",
  "practice",
  "assessment",
  "revision",
  // Interpreting a learner's own goal is fundamental to asking and low-risk (DPS intent inference).
  "intent",
]);

/** Agents that require elevated trust (trust_level >= 3). */
const PRIVILEGED_AGENTS = new Set(["memory", "curriculum"]);

const MINIMUM_TRUST = 1;
const ELEVATED_TRUST = 3;

// ---------------------------------------------------------------------------
// GOV-P01 — trust gate
// ---------------------------------------------------------------------------

/**
 * GOV-P01: Block agent dispatch when the learner's `trust_level` is insufficient.
 * - Untrusted learners (trust_level < 1) cannot dispatch any cognitive work.
 * - Elevated agents (memory, curriculum) require trust_level >= 3.
 */
export const productDispatchTrustGate: Policy = {
  id: "GOV-P01-DISPATCH-TRUST",
  version: "1.0.0",
  type: "access",
  priority: 10,
  appliesTo(request: PolicyRequest): boolean {
    return request.action.startsWith("dispatch.");
  },
  evaluate(request: PolicyRequest): PolicyOutcome {
    const trustLevel = (request.context?.["trustLevel"] as number | undefined) ?? 0;
    const agentId = request.action.slice("dispatch.".length);

    if (trustLevel < MINIMUM_TRUST) {
      return {
        decision: "block",
        reason: `trust_level ${trustLevel} insufficient for product dispatch (minimum: ${MINIMUM_TRUST})`,
        evidence: ["GOV-P01"],
      };
    }

    if (PRIVILEGED_AGENTS.has(agentId) && trustLevel < ELEVATED_TRUST) {
      return {
        decision: "block",
        reason: `trust_level ${trustLevel} insufficient for privileged agent "${agentId}" (minimum: ${ELEVATED_TRUST})`,
        evidence: ["GOV-P01"],
      };
    }

    if (!STUDENT_AGENTS.has(agentId) && !PRIVILEGED_AGENTS.has(agentId)) {
      return {
        decision: "block",
        reason: `agent "${agentId}" is not in the product dispatch allowlist`,
        evidence: ["GOV-P01"],
      };
    }

    return { decision: "allow", reason: "trust level sufficient for requested agent" };
  },
};

// ---------------------------------------------------------------------------
// GOV-P02 — classification gate
// ---------------------------------------------------------------------------

/**
 * GOV-P02: Flag dispatch for human review when the session's classification ceiling is "public".
 * Cognitive agents operate on learner data that is at minimum "internal" classification;
 * dispatching under a "public" ceiling requires a review checkpoint.
 */
export const productDispatchClassificationGate: Policy = {
  id: "GOV-P02-DISPATCH-CLASSIFICATION",
  version: "1.0.0",
  type: "data",
  priority: 20,
  appliesTo(request: PolicyRequest): boolean {
    return request.action.startsWith("dispatch.") && request.classification !== undefined;
  },
  evaluate(request: PolicyRequest): PolicyOutcome {
    if (request.classification === "public") {
      return {
        decision: "review",
        reason:
          'session classification ceiling is "public"; dispatch flagged for review before execution',
        reviewPath: "governance/classification-review",
        evidence: ["GOV-P02"],
      };
    }
    return {
      decision: "allow",
      reason: `classification ceiling "${request.classification}" permits dispatch`,
    };
  },
};

// ---------------------------------------------------------------------------
// Bundled policy set
// ---------------------------------------------------------------------------

export const PRODUCT_DISPATCH_POLICIES: readonly Policy[] = [
  productDispatchTrustGate,
  productDispatchClassificationGate,
];
