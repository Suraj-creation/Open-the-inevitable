import { describe, it, expect } from "vitest";
import { ManualClock, SeededIdGenerator } from "@inevitable/shared";
import { InMemoryEventBus } from "@inevitable/events";
import type { CognitiveIdentity, CognitionPacket } from "@inevitable/protocols";
import { CognitiveUnitHost } from "../src/host";
import type { CognitiveUnit, Emissions } from "../src/abi";
import { ABI_VERSION } from "../src/abi";

const identity: CognitiveIdentity = {
  cid: "cog-0123456789ab",
  unit_type: "agent",
  version: "1.0.0",
  capabilities: ["echo"],
  trust_level: 5,
  parent_cid: null,
  lineage: [],
  tenant_id: null,
  created_at: "1970-01-01T00:00:01.000Z",
  governance_policies: [],
  attestation_chain: [],
};

class EchoUnit implements CognitiveUnit {
  describe() {
    return {
      unit_id: identity.cid,
      unit_type: "agent",
      version: "1.0.0",
      abi_version: ABI_VERSION,
      capabilities: ["echo"],
      input_schemas: ["cos:protocol:cognition-packet:1.0.0"],
      output_schemas: ["cos:protocol:cognition-packet:1.0.0"],
      observability_contract: ["agent.completed"],
      evolution_policy: "tunable" as const,
    };
  }
  prepare() {}
  execute(packet: CognitionPacket): Emissions {
    return { packets: [{ ...packet, packet_type: "response" }] };
  }
  reflect() {
    return null;
  }
  checkpoint() {
    return { unitId: identity.cid, state: "Executing" as const, data: {} };
  }
  restore() {}
  shutdown() {}
  health() {
    return { runtime: "ok" as const, drift: 0, confidence: 1, loadFactor: 0 };
  }
}

function inputPacket(): CognitionPacket {
  return {
    packet_id: "cp-00aa11bb22cc",
    schema_version: "1.0.0",
    source_cid: "cog-aaaaaaaaaaaa",
    packet_type: "intent",
    timestamp: "1970-01-01T00:00:01.000Z",
    hlc: "0000000000001000-00000000-node-a",
    content: { text: "ping" },
  } as CognitionPacket;
}

describe("CognitiveUnitHost", () => {
  function makeHost() {
    const bus = new InMemoryEventBus();
    const host = new CognitiveUnitHost(new EchoUnit(), identity, {
      bus,
      clock: new ManualClock(1000),
      idGenerator: new SeededIdGenerator(),
      nodeId: "node-a",
    });
    return { bus, host };
  }

  it("emits lifecycle events on activation and reaches Ready", async () => {
    const { bus, host } = makeHost();
    await host.activate();
    expect(host.state).toBe("Ready");
    expect(bus.log.map((e) => e.event_type)).toEqual(["agent.registered", "agent.ready"]);
  });

  it("drives Executing -> Publishing -> Ready and emits agent.completed", async () => {
    const { bus, host } = makeHost();
    await host.activate();
    const emissions = await host.handle(inputPacket());
    expect(emissions.packets?.[0]?.packet_type).toBe("response");
    expect(host.state).toBe("Ready");
    const types = bus.log.map((e) => e.event_type);
    expect(types).toContain("agent.executing");
    expect(types).toContain("agent.completed");
    expect(host.lifecycle.history).toContain("Publishing");
  });

  it("quarantines the unit when execute throws", async () => {
    const bus = new InMemoryEventBus();
    class ThrowingUnit extends EchoUnit {
      override execute(): Emissions {
        throw new Error("boom");
      }
    }
    const host = new CognitiveUnitHost(new ThrowingUnit(), identity, {
      bus,
      clock: new ManualClock(1000),
      idGenerator: new SeededIdGenerator(),
      nodeId: "node-a",
    });
    await host.activate();
    await expect(host.handle(inputPacket())).rejects.toThrow("boom");
    expect(host.state).toBe("Quarantined");
    expect(bus.log.map((e) => e.event_type)).toContain("agent.quarantined");
  });
});
