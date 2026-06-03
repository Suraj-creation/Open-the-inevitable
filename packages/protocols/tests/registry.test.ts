import { describe, it, expect } from "vitest";
import { SchemaRegistry, defaultRegistry, parseSchemaId } from "../src/registry";
import { SCHEMA_IDS } from "../src/schema-ids";

describe("SchemaRegistry", () => {
  it("indexes canonical schemas by id", () => {
    expect(defaultRegistry.has(SCHEMA_IDS.cognitionPacket)).toBe(true);
    expect(defaultRegistry.get(SCHEMA_IDS.cognitiveEvent)?.title).toBe("CognitiveEvent");
    expect(defaultRegistry.list().length).toBe(16);
  });

  it("parses well-formed schema ids and rejects malformed ones", () => {
    expect(parseSchemaId("cos:protocol:cognition-packet:1.0.0")).toEqual({
      kind: "protocol",
      name: "cognition-packet",
      version: "1.0.0",
    });
    expect(parseSchemaId("garbage")).toBeNull();
  });

  it("resolves the latest schema by bare name", () => {
    const latest = defaultRegistry.getLatest("cognition-packet");
    expect(latest?.$id).toBe(SCHEMA_IDS.cognitionPacket);
  });

  it("rejects duplicate registration", () => {
    const registry = new SchemaRegistry([]);
    const doc = { $id: "cos:protocol:x:1.0.0", title: "X" };
    registry.register(doc);
    expect(() => registry.register(doc)).toThrow();
  });
});
