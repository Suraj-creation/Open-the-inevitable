/**
 * @inevitable/tooling — developer introspection over the canonical protocol registry.
 * Spec: spec/tooling/, spec/developer-experience/. Phase 1C: schema/protocol listing helpers.
 * Cognition IDE, replay studio, and graph debugger arrive later (spec/cognitive-developer-platform/).
 */
import { SCHEMAS, SCHEMA_IDS, parseSchemaId, type SchemaDocument } from "@inevitable/protocols";

export { SCHEMA_IDS };

export function listSchemaIds(): string[] {
  return SCHEMAS.map((schema) => schema.$id);
}

export function schemaCount(): number {
  return SCHEMAS.length;
}

export interface SchemaSummary {
  readonly id: string;
  readonly title: string;
  readonly kind: string;
  readonly name: string;
  readonly version: string;
}

export function summarizeSchemas(): SchemaSummary[] {
  return SCHEMAS.map((schema: SchemaDocument) => {
    const parsed = parseSchemaId(schema.$id);
    return {
      id: schema.$id,
      title: schema.title,
      kind: parsed?.kind ?? "unknown",
      name: parsed?.name ?? schema.$id,
      version: parsed?.version ?? "0.0.0",
    };
  });
}
