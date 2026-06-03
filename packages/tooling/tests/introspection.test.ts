import { describe, it, expect } from "vitest";
import { schemaCount, listSchemaIds, summarizeSchemas } from "../src/index";

describe("schema introspection", () => {
  it("reports the canonical schema count", () => {
    expect(schemaCount()).toBe(16);
    expect(listSchemaIds()).toContain("cos:protocol:cognition-packet:1.0.0");
  });

  it("summarizes schemas with parsed kind/name/version", () => {
    const summaries = summarizeSchemas();
    const packet = summaries.find((s) => s.name === "cognition-packet");
    expect(packet).toMatchObject({ kind: "protocol", version: "1.0.0", title: "CognitionPacket" });
  });
});
