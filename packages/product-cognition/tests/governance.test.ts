import { describe, expect, test } from "vitest";
import { GovernanceEngine } from "@inevitable/governance";
import { InMemoryEventBus } from "@inevitable/events";
import type { CognitiveIdentity } from "@inevitable/protocols";
import { ManualClock, SeededIdGenerator } from "@inevitable/shared";
import { WorldStateGraph } from "@inevitable/world-state";
import { MVP_AGENT_MANIFESTS } from "../src/agent-catalog";
import { PRODUCT_DISPATCH_POLICIES } from "../src/product-dispatch-policies";
import { DeterministicMvpUnit, ProductRuntimeDispatcher } from "../src/runtime-dispatch";
import { SupervisorUnit } from "../src/supervisor";
import type { OnboardingSession } from "../src/types";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function agentIdentity(kind: string, cid: string, trustLevel = 5): CognitiveIdentity {
  const manifest = MVP_AGENT_MANIFESTS.find((m) => m.id === `agent.${kind}`)!;
  return {
    cid,
    unit_type: `agent.${kind}`,
    version: "1.0.0",
    capabilities: manifest.capabilities,
    trust_level: trustLevel,
    parent_cid: null,
    lineage: [],
    tenant_id: null,
    created_at: "2026-06-05T00:00:00.000Z",
    governance_policies: manifest.policies,
    attestation_chain: [],
  };
}

function learnerIdentity(trustLevel: number): CognitiveIdentity {
  return {
    cid: "cog-learner-gov",
    unit_type: "human.student",
    version: "1.0.0",
    capabilities: ["product.onboarding"],
    trust_level: trustLevel,
    parent_cid: null,
    lineage: [],
    tenant_id: null,
    created_at: "2026-06-05T00:00:00.000Z",
    governance_policies: [],
    attestation_chain: [],
  };
}

type ClassificationCeiling = "public" | "internal" | "sensitive" | "restricted";

function makeSession(
  trustLevel: number,
  classification: ClassificationCeiling = "internal",
): OnboardingSession {
  const identity = learnerIdentity(trustLevel);
  return {
    learnerIdentity: identity,
    capabilityEnvelope: {
      envelope_id: "env-gov-001",
      granted_to: identity.cid,
      granted_by: "kernel",
      memory_scopes: ["working", "semantic"],
      max_spawn_depth: 1,
      max_child_units: 7,
      network_access: false,
      cost_ceiling_usd: 0,
      data_classification_ceiling: classification,
      expires_at: "2026-06-05T02:00:00.000Z",
    },
    contextLease: {
      lease_id: "lease-gov-001",
      granted_to: identity.cid,
      memory_layers: ["working", "semantic"],
      allowed_users: [identity.cid],
      token_budget: 16_000,
      granted_by: "kernel",
      expires_at: "2026-06-05T02:00:00.000Z",
    },
    intentLease: {
      intent_id: "intent-gov-001",
      owner_user_id: identity.cid,
      interpreted_goal: "Learn calculus",
      scope: ["learning", "student"],
      constraints: [],
      expires_at: "2026-06-05T02:00:00.000Z",
      confidence: 1,
      held_by: [identity.cid],
    },
    learnerNodeId: `learner:${identity.cid}`,
    intentNodeId: "intent:intent-gov-001",
    seedMemoryMutationId: "mut-gov-001",
  };
}

function makeDispatcher(
  kind: "explanation" | "supervisor",
  governance?: GovernanceEngine,
  seed = "gov-test",
): ProductRuntimeDispatcher {
  const clock = new ManualClock(Date.UTC(2026, 5, 5));
  const idGenerator = new SeededIdGenerator(seed);
  const bus = new InMemoryEventBus({ idGenerator });
  const world = new WorldStateGraph({ acyclicEdgeTypes: ["prerequisite_of"] });
  const manifest = MVP_AGENT_MANIFESTS.find((m) => m.id === `agent.${kind}`)!;

  const unit =
    kind === "supervisor"
      ? new SupervisorUnit(manifest, world, idGenerator)
      : new DeterministicMvpUnit(manifest, idGenerator);

  return new ProductRuntimeDispatcher({
    bus,
    clock,
    idGenerator,
    agent: { identity: agentIdentity(kind, `cog-${kind}-gov`), unit },
    governance,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Governance — productDispatchTrustGate (GOV-P01)", () => {
  test("blocks dispatch when learner trust_level is 0", async () => {
    const governance = new GovernanceEngine(PRODUCT_DISPATCH_POLICIES);
    const dispatcher = makeDispatcher("explanation", governance);

    const result = await dispatcher.dispatch({
      session: makeSession(0), // untrusted learner
      targetAgentId: "explanation",
      intent: "Explain derivatives",
      conceptIds: ["derivatives"],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("E_PRODUCT_RUNTIME_DISPATCH");
      expect(result.error.message).toMatch(/governance policy blocked/i);
      expect(result.error.details?.["reason"]).toMatch(/trust_level 0/);
    }
  });

  test("allows dispatch when learner trust_level is 5", async () => {
    const governance = new GovernanceEngine(PRODUCT_DISPATCH_POLICIES);
    const dispatcher = makeDispatcher("explanation", governance, "gov-allow");

    const result = await dispatcher.dispatch({
      session: makeSession(5),
      targetAgentId: "explanation",
      intent: "Explain derivatives",
      conceptIds: ["derivatives"],
    });

    expect(result.ok).toBe(true);
  });

  test("blocks privileged agent dispatch when trust_level is 2 (below 3)", async () => {
    const governance = new GovernanceEngine(PRODUCT_DISPATCH_POLICIES);
    // 'memory' is a privileged agent requiring trust_level >= 3
    const dispatcher = makeDispatcher("explanation", governance, "gov-privileged");

    const result = await dispatcher.dispatch({
      session: makeSession(2),
      targetAgentId: "memory",
      intent: "Consolidate memory",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.details?.["reason"]).toMatch(/privileged/i);
      expect(result.error.details?.["policyId"]).toBe("GOV-P01-DISPATCH-TRUST");
    }
  });

  test("allows privileged agent dispatch when trust_level is 3", async () => {
    const clock = new ManualClock(Date.UTC(2026, 5, 5));
    const idGenerator = new SeededIdGenerator("gov-elevated");
    const bus = new InMemoryEventBus({ idGenerator });
    const memoryManifest = MVP_AGENT_MANIFESTS.find((m) => m.id === "agent.memory")!;

    const governance = new GovernanceEngine(PRODUCT_DISPATCH_POLICIES);
    const dispatcher = new ProductRuntimeDispatcher({
      bus,
      clock,
      idGenerator,
      agent: {
        identity: agentIdentity("memory", "cog-memory-gov", 5),
        unit: new DeterministicMvpUnit(memoryManifest, idGenerator),
      },
      governance,
    });

    const result = await dispatcher.dispatch({
      session: makeSession(3), // elevated trust
      targetAgentId: "memory",
      intent: "Consolidate memory",
    });

    expect(result.ok).toBe(true);
  });

  test("blocks dispatch for an agent not in the allowlist", async () => {
    const governance = new GovernanceEngine(PRODUCT_DISPATCH_POLICIES);
    const dispatcher = makeDispatcher("explanation", governance, "gov-unknown");

    const result = await dispatcher.dispatch({
      session: makeSession(5),
      // 'unknown-agent' is not in STUDENT_AGENTS or PRIVILEGED_AGENTS
      targetAgentId: "unknown-agent" as never,
      intent: "Do something",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.details?.["reason"]).toMatch(/not in the product dispatch allowlist/i);
    }
  });

  test("dispatch proceeds without governance when no engine is wired", async () => {
    // No governance engine passed — the dispatcher skips the governance gate entirely.
    const dispatcher = makeDispatcher("explanation", undefined, "gov-none");

    const result = await dispatcher.dispatch({
      session: makeSession(0), // would fail if governance were present
      targetAgentId: "explanation",
      intent: "Explain derivatives",
    });

    // Without governance, untrusted learner is allowed through (governance is optional).
    expect(result.ok).toBe(true);
  });
});

describe("Governance — productDispatchClassificationGate (GOV-P02)", () => {
  test("flags for review when classification ceiling is public", async () => {
    const governance = new GovernanceEngine(PRODUCT_DISPATCH_POLICIES);
    const dispatcher = makeDispatcher("explanation", governance, "gov-public");

    // Trust level is sufficient but classification ceiling is "public"
    const result = await dispatcher.dispatch({
      session: makeSession(5, "public"), // "public" ceiling triggers review
      targetAgentId: "explanation",
      intent: "Explain derivatives",
    });

    // "review" is NOT blocked — dispatch proceeds
    expect(result.ok).toBe(true);
  });

  test("allows dispatch with internal classification (no review required)", async () => {
    const governance = new GovernanceEngine(PRODUCT_DISPATCH_POLICIES);
    const dispatcher = makeDispatcher("explanation", governance, "gov-internal");

    const result = await dispatcher.dispatch({
      session: makeSession(5, "internal"),
      targetAgentId: "explanation",
      intent: "Explain derivatives",
    });

    expect(result.ok).toBe(true);
  });
});

describe("Governance — decision metadata", () => {
  test("error details carry decisionId and policyId on block", async () => {
    const governance = new GovernanceEngine(PRODUCT_DISPATCH_POLICIES, {
      idGenerator: new SeededIdGenerator("gov-meta"),
    });
    const dispatcher = makeDispatcher("explanation", governance, "gov-meta-disp");

    const result = await dispatcher.dispatch({
      session: makeSession(0),
      targetAgentId: "explanation",
      intent: "Explain",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(typeof result.error.details?.["decisionId"]).toBe("string");
      expect(result.error.details?.["policyId"]).toBe("GOV-P01-DISPATCH-TRUST");
      expect(result.error.details?.["outcome"]).toBe("block");
    }
  });
});
