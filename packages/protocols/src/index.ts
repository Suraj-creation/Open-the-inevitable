/**
 * @inevitable/protocols — canonical COS protocol contracts.
 *
 * Canonical form: JSON Schema (Draft 2020-12) under `schemas/` (ADR-0003).
 * Generated TypeScript types (`src/generated/`) are produced by `pnpm codegen`.
 *
 * Spec anchors: spec/protocols/*, spec/kernel/*, spec/events/event-taxonomy.md.
 */
export type { SchemaDocument } from "./schemas";
export { SCHEMAS, SCHEMA_BY_ID } from "./schemas";

export { SCHEMA_IDS } from "./schema-ids";
export type { SchemaId } from "./schema-ids";

export type { ParsedSchemaId } from "./registry";
export { SchemaRegistry, defaultRegistry, parseSchemaId } from "./registry";

export type { ValidationIssue } from "./validator";
export { SchemaValidator, defaultValidator } from "./validator";

// Generated protocol types (regenerated from schemas via `pnpm codegen`).
export type * from "./generated/index";
