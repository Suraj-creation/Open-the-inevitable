import { describe, expect, test } from "vitest";
import { InMemoryEventBus } from "@inevitable/events";
import type { CognitiveIdentity } from "@inevitable/protocols";
import { DepthScheduler } from "@inevitable/scheduler";
import { ManualClock, SeededIdGenerator } from "@inevitable/shared";
import type { OnboardingSession } from "../src/types";
import { MVP_AGENT_MANIFESTS } from "../src/agent-catalog";
import { DeterministicMvpUnit, ProductRuntimeDispatcher } from "../src/runtime-dispatch";

function session(): OnboardingSession {
  const learnerIdentity: CognitiveIdentity = {
    cid: "cog-000000000101",
    unit_type: "human.student",
    version: "1.0.0",
    capabilities: ["product.onboarding", "product.navigation"],
    trust_level: 5,
    parent_cid: null,
    lineage: [],
    tenant_id: null,
    created_at: "2026-06-03T00:00:00.000Z",
    governance_policies: ["product-consent", "memory-scope"],
    attestation_chain: [],
  };

  return {
    learnerIdentity,
    capabilityEnvelope: {
      envelope_id: "env-000000000101",
      granted_to: learnerIdentity.cid,
      granted_by: "kernel",
      memory_scopes: ["working", "semantic"],
      max_spawn_depth: 1,
      max_child_units: 7,
      network_access: false,
      cost_ceiling_usd: 0,
      data_classification_ceiling: "internal",
      expires_at: "2026-06-03T01:00:00.000Z",
    },
    contextLease: {
      lease_id: "lease-000000000101",
      granted_to: learnerIdentity.cid,
      memory_layers: ["working", "semantic"],
      allowed_users: ["user-1"],
      token_budget: 16_000,
      granted_by: "kernel",
      expires_at: "2026-06-03T01:00:00.000Z",
    },
    intentLease: {
      intent_id: "intent-000000000101",
      owner_user_id: "user-1",
      interpreted_goal: "Understand gradient descent",
      scope: ["learning", "student"],
      constraints: ["spec-first", "depth-preserving"],
      expires_at: "2026-06-03T01:00:00.000Z",
      confidence: 1,
      held_by: [learnerIdentity.cid],
    },
    learnerNodeId: "learner:user-1",
    intentNodeId: "intent:intent-000000000101",
    seedMemoryMutationId: "mut-0000000000000101",
  };
}

describe("ProductRuntimeDispatcher", () => {
  test("admits product work and executes a deterministic MVP agent through the runtime host", async () => {
    const clock = new ManualClock(Date.UTC(2026, 5, 3));
    const idGenerator = new SeededIdGenerator("runtime-dispatch");
    const bus = new InMemoryEventBus({ idGenerator });
    const manifest = MVP_AGENT_MANIFESTS.find((candidate) => candidate.id === "agent.explanation");
    if (!manifest) throw new Error("agent.explanation manifest missing");

    const agentIdentity: CognitiveIdentity = {
      cid: "cog-000000000202",
      unit_type: "agent.explanation",
      version: "1.0.0",
      capabilities: manifest.capabilities,
      trust_level: 5,
      parent_cid: null,
      lineage: [],
      tenant_id: null,
      created_at: "2026-06-03T00:00:00.000Z",
      governance_policies: manifest.policies,
      attestation_chain: [],
    };
    const dispatcher = new ProductRuntimeDispatcher({
      bus,
      clock,
      idGenerator,
      agent: {
        identity: agentIdentity,
        unit: new DeterministicMvpUnit(manifest),
      },
    });

    const result = await dispatcher.dispatch({
      session: session(),
      targetAgentId: "explanation",
      intent: "Explain gradient descent intuitively",
      conceptIds: ["gradient-descent"],
      content: { question: "Why does stepping opposite the gradient reduce loss?" },
      priority: 2,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw result.error;

    expect(result.value.workItem).toMatchObject({
      work_type: "student_interaction",
      requester_cid: "cog-000000000101",
      target_unit_type: "agent.explanation",
      packet_ref: result.value.packet.packet_id,
      priority: 2,
    });
    expect(result.value.packet).toMatchObject({
      source_cid: "cog-000000000101",
      target_cid: "cog-000000000202",
      packet_type: "intent",
      intent: "Explain gradient descent intuitively",
      concept_ids: ["gradient-descent"],
      classification: "internal",
    });
    expect(result.value.responsePackets).toHaveLength(1);
    expect(result.value.responsePackets[0]).toMatchObject({
      source_cid: "cog-000000000202",
      target_cid: "cog-000000000101",
      packet_type: "response",
      causation_id: result.value.packet.packet_id,
      correlation_id: result.value.packet.correlation_id,
      content: {
        handled_by: "agent.explanation",
        intent: "Explain gradient descent intuitively",
        concepts: ["gradient-descent"],
        response_kind: "deterministic-product-cognition",
      },
    });
    expect(bus.replay({ subject: "agent.>" }).map((event) => event.event_type)).toEqual([
      "agent.registered",
      "agent.ready",
      "agent.executing",
      "agent.completed",
    ]);
  });

  test("returns a typed error when the scheduler rejects the work item (budget exceeded)", async () => {
    const budgets = new Map([["cog-000000000101", { costRemaining: 0 }]]);
    const clock = new ManualClock(Date.UTC(2026, 5, 3));
    const idGenerator = new SeededIdGenerator("runtime-dispatch-reject");
    const bus = new InMemoryEventBus({ idGenerator });
    const manifest = MVP_AGENT_MANIFESTS.find((m) => m.id === "agent.explanation")!;
    const agentIdentity: CognitiveIdentity = {
      cid: "cog-000000000303",
      unit_type: "agent.explanation",
      version: "1.0.0",
      capabilities: manifest.capabilities,
      trust_level: 5,
      parent_cid: null,
      lineage: [],
      tenant_id: null,
      created_at: "2026-06-03T00:00:00.000Z",
      governance_policies: manifest.policies,
      attestation_chain: [],
    };
    const dispatcher = new ProductRuntimeDispatcher({
      bus,
      clock,
      idGenerator,
      scheduler: new DepthScheduler({ budgets }),
      agent: { identity: agentIdentity, unit: new DeterministicMvpUnit(manifest, idGenerator) },
    });

    const result = await dispatcher.dispatch({
      session: session(),
      targetAgentId: "explanation",
      intent: "Should be rejected",
      costBudgetUsd: 1.0, // exceeds the 0-cost budget
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("E_PRODUCT_RUNTIME_DISPATCH");
      expect(result.error.details?.["reason"]).toBe("budget");
    }
  });

  test("returns a typed error and resets activation when the unit host fails", async () => {
    const clock = new ManualClock(Date.UTC(2026, 5, 3));
    const idGenerator = new SeededIdGenerator("runtime-dispatch-fail");
    const bus = new InMemoryEventBus({ idGenerator });
    const manifest = MVP_AGENT_MANIFESTS.find((m) => m.id === "agent.explanation")!;
    const agentIdentity: CognitiveIdentity = {
      cid: "cog-000000000404",
      unit_type: "agent.explanation",
      version: "1.0.0",
      capabilities: manifest.capabilities,
      trust_level: 5,
      parent_cid: null,
      lineage: [],
      tenant_id: null,
      created_at: "2026-06-03T00:00:00.000Z",
      governance_policies: manifest.policies,
      attestation_chain: [],
    };

    // Unit that throws on execute
    class ThrowingUnit extends DeterministicMvpUnit {
      override execute(): never {
        throw new Error("simulated execution failure");
      }
    }

    const dispatcher = new ProductRuntimeDispatcher({
      bus,
      clock,
      idGenerator,
      agent: { identity: agentIdentity, unit: new ThrowingUnit(manifest, idGenerator) },
    });

    const first = await dispatcher.dispatch({
      session: session(),
      targetAgentId: "explanation",
      intent: "This will fail",
    });
    expect(first.ok).toBe(false);
    if (!first.ok) expect(first.error.code).toBe("E_PRODUCT_RUNTIME_DISPATCH");

    // After failure the dispatcher resets activated; second dispatch re-activates cleanly
    // (the host is in Quarantined state so re-activation goes through lifecycle reset).
    // We just confirm the dispatcher does not become permanently stuck.
    const second = await dispatcher.dispatch({
      session: session(),
      targetAgentId: "explanation",
      intent: "This will also fail (same throwing unit)",
    });
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.error.code).toBe("E_PRODUCT_RUNTIME_DISPATCH");
  });
});
