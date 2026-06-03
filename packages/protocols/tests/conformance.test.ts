import { describe, it, expect } from "vitest";
import { defaultValidator } from "../src/validator";
import { SCHEMAS } from "../src/schemas";
import examples from "../fixtures/examples.json";
import invalid from "../fixtures/invalid.json";

const examplesMap = examples as Record<string, unknown>;
const invalidMap = invalid as Record<string, Array<{ reason: string; payload: unknown }>>;

describe("protocol conformance", () => {
  it("registers all 16 canonical schemas", () => {
    expect(SCHEMAS.length).toBe(16);
  });

  describe("valid examples pass validation", () => {
    for (const schema of SCHEMAS) {
      it(`${schema.$id} accepts its example`, () => {
        const example = examplesMap[schema.$id];
        expect(example).toBeDefined();
        const result = defaultValidator.validate(schema.$id, example);
        if (!result.ok) throw new Error(result.error.message);
        expect(result.ok).toBe(true);
      });
    }
  });

  describe("invalid examples are rejected", () => {
    for (const [schemaId, cases] of Object.entries(invalidMap)) {
      for (const testCase of cases) {
        it(`${schemaId} rejects: ${testCase.reason}`, () => {
          expect(defaultValidator.isValid(schemaId, testCase.payload)).toBe(false);
        });
      }
    }
  });

  it("returns an error Result for unknown schema ids", () => {
    const result = defaultValidator.validate("cos:protocol:does-not-exist:1.0.0", {});
    expect(result.ok).toBe(false);
  });
});
