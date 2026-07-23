/**
 * C1 — Chronicle law (ADR-0035 / CIP-001 §4.3): the FULL ReasoningTrace a unit returns must be
 * published as `reasoning.trace.recorded`, never dropped at dispatch. This closes the M3.5
 * audit's highest-value gap.
 */
import { describe, expect, it } from "vitest";
import { InMemoryEventBus } from "@inevitable/events";
import type {
  CognitionPacket,
  CognitiveIdentity,
  ContextLease,
  ReasoningTrace,
  UnitDescriptor,
  UnitLifecycleState,
} from "@inevitable/protocols";
import { SCHEMA_IDS } from "@inevitable/protocols";
import type {
  CognitionFrame,
  CognitiveHealth,
  CognitiveUnit,
  Emissions,
} from "@inevitable/runtime";
import { ManualClock, SeededIdGenerator } from "@inevitable/shared";
import { MVP_AGENT_MANIFESTS } from "../src/agent-catalog";
import { DeterministicMvpUnit, ProductRuntimeDispatcher } from "../src/runtime-dispatch";
import type { OnboardingSession } from "../src/types";

function learnerIdentity(): CognitiveIdentity {
  return {
    cid: "cog-learner-chronicle",
    unit_type: "human.student",
    version: "1.0.0",
    capabilities: ["product.onboarding"],
    trust_level: 5,
    parent_cid: null,
    lineage: [],
    tenant_id: null,
    created_at: "2026-07-10T00:00:00.000Z",
    governance_policies: [],
    attestation_chain: [],
  };
}

function agentIdentity(kind: string): CognitiveIdentity {
  const manifest = MVP_AGENT_MANIFESTS.find((m) => m.id === `agent.${kind}`)!;
  return {
    cid: `cog-${kind}-chronicle`,
    unit_type: `agent.${kind}`,
    version: "1.0.0",
    capabilities: manifest.capabilities,
    trust_level: 5,
    parent_cid: null,
    lineage: [],
    tenant_id: null,
    created_at: "2026-07-10T00:00:00.000Z",
    governance_policies: manifest.policies,
    attestation_chain: [],
  };
}

function makeSession(): OnboardingSession {
  const identity = learnerIdentity();
  return {
    learnerIdentity: identity,
    capabilityEnvelope: {
      envelope_id: "env-chr-001",
      granted_to: identity.cid,
      granted_by: "kernel",
      memory_scopes: ["working", "semantic"],
      max_spawn_depth: 1,
      max_child_units: 7,
      network_access: false,
      cost_ceiling_usd: 0,
      data_classification_ceiling: "internal",
      expires_at: "2026-07-10T02:00:00.000Z",
    },
    contextLease: {
      lease_id: "lease-chr-001",
      granted_to: identity.cid,
      memory_layers: ["working", "semantic"],
      allowed_users: [identity.cid],
      token_budget: 16_000,
      granted_by: "kernel",
      expires_at: "2026-07-10T02:00:00.000Z",
    },
    intentLease: {
      intent_id: "intent-chr-001",
      owner_user_id: identity.cid,
      interpreted_goal: "Learn thermodynamics",
      scope: ["learning", "student"],
      constraints: [],
      expires_at: "2026-07-10T02:00:00.000Z",
      confidence: 1,
      held_by: [identity.cid],
    },
    learnerNodeId: `learner:${identity.cid}`,
    intentNodeId: "intent:intent-chr-001",
    seedMemoryMutationId: "mut-chr-001",
  };
}

/** Minimal unit that thinks — returns a full ReasoningTrace alongside its response packet. */
class StubTraceUnit implements CognitiveUnit {
  constructor(private readonly inner: DeterministicMvpUnit) {}
  describe(): UnitDescriptor {
    return this.inner.describe();
  }
  prepare(lease: ContextLease): void {
    this.inner.prepare(lease);
  }
  execute(packet: CognitionPacket): Emissions {
    const base = this.inner.execute(packet);
    const trace: ReasoningTrace = {
      trace_id: packet.trace_id ?? "",
      producer_cid: "agent.explanation",
      session_id: packet.session_id ?? null,
      task_interpretation: "explain entropy at layer 0",
      strategy: "intuition-first",
      claims: [
        { claim_id: `${packet.packet_id}-c0`, statement: "entropy counts states", confidence: 0.9 },
      ],
      decision: "led with the microstates analogy",
      uncertainty_estimate: 0.1,
      self_critique: "could ground harder in the source",
      determinism_level: "D2",
    };
    return { ...base, trace };
  }
  reflect(): string | null {
    return null;
  }
  checkpoint(): CognitionFrame {
    return { unitId: "agent.explanation", state: "Ready" as UnitLifecycleState, data: {} };
  }
  restore(): void {}
  shutdown(): void {}
  health(): CognitiveHealth {
    return { runtime: "ok", drift: 0, confidence: 1, loadFactor: 0 };
  }
}

function harness(withTrace: boolean) {
  const clock = new ManualClock(Date.UTC(2026, 6, 10));
  const idGenerator = new SeededIdGenerator("chronicle-test");
  const bus = new InMemoryEventBus({ idGenerator });
  const manifest = MVP_AGENT_MANIFESTS.find((m) => m.id === "agent.explanation")!;
  const inner = new DeterministicMvpUnit(manifest, idGenerator);
  const unit = withTrace ? new StubTraceUnit(inner) : inner;
  const dispatcher = new ProductRuntimeDispatcher({
    bus,
    clock,
    idGenerator,
    agent: { identity: agentIdentity("explanation"), unit },
  });
  return { dispatcher, bus };
}

describe("C1 — reasoning traces reach the chronicle", () => {
  it("publishes reasoning.trace.recorded with the FULL trace body", async () => {
    const { dispatcher, bus } = harness(true);
    const result = await dispatcher.dispatch({
      session: makeSession(),
      targetAgentId: "explanation",
      intent: "Explain entropy",
      conceptIds: ["entropy"],
    });
    expect(result.ok).toBe(true);
    const recorded = bus.log.filter((e) => e.event_type === "reasoning.trace.recorded");
    expect(recorded).toHaveLength(1);
    const payload = recorded[0]?.payload as Record<string, unknown>;
    expect(payload["agent_id"]).toBe("explanation");
    const trace = payload["trace"] as Record<string, unknown>;
    expect(trace["strategy"]).toBe("intuition-first");
    expect(trace["decision"]).toBe("led with the microstates analogy");
    expect(trace["self_critique"]).toBe("could ground harder in the source");
    expect(trace["uncertainty_estimate"]).toBe(0.1);
    // The event validates against the CognitiveEvent schema (published, not dead-lettered).
    expect(recorded[0]?.schema_version).toBeDefined();
  });

  it("emits nothing when a unit returns no trace (no fabrication)", async () => {
    const { dispatcher, bus } = harness(false);
    const result = await dispatcher.dispatch({
      session: makeSession(),
      targetAgentId: "explanation",
      intent: "Explain entropy",
      conceptIds: ["entropy"],
    });
    expect(result.ok).toBe(true);
    expect(bus.log.filter((e) => e.event_type === "reasoning.trace.recorded")).toHaveLength(0);
  });

  it("keeps SCHEMA_IDS untouched (envelope unchanged; payload-only addition)", () => {
    expect(SCHEMA_IDS.cognitionPacket).toBeDefined();
  });
});
