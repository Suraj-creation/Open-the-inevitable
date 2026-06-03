/**
 * Runtime contract validation. Every protocol payload that crosses a boundary (bus publish,
 * syscall, memory mutation) is validated against its canonical JSON Schema before use.
 * Spec: spec/protocols/*, spec/kernel-internals/cognition-syscalls.md (validation at the boundary).
 */
import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import { ProtocolValidationError, ok, err, type Result } from "@inevitable/shared";
import { SCHEMAS, type SchemaDocument } from "./schemas";

export interface ValidationIssue {
  readonly path: string;
  readonly message: string;
  readonly keyword: string;
}

export class SchemaValidator {
  private readonly ajv: Ajv2020;

  constructor(schemas: readonly SchemaDocument[] = SCHEMAS) {
    this.ajv = new Ajv2020({ allErrors: true, strict: false });
    addFormats(this.ajv);
    for (const schema of schemas) {
      this.ajv.addSchema(schema, schema.$id);
    }
  }

  /** Validate `data` against the schema registered under `schemaId`. */
  validate<T = unknown>(schemaId: string, data: unknown): Result<T, ProtocolValidationError> {
    const validateFn = this.ajv.getSchema(schemaId);
    if (!validateFn) {
      return err(
        new ProtocolValidationError(`Unknown schema: ${schemaId}`, {
          specRef: "spec/meta/protocol-governance.md",
        }),
      );
    }
    if (validateFn(data)) {
      return ok(data as T);
    }
    const issues: ValidationIssue[] = (validateFn.errors ?? []).map((e) => ({
      path: e.instancePath === "" ? "/" : e.instancePath,
      message: e.message ?? "invalid",
      keyword: e.keyword,
    }));
    const summary = issues.map((i) => `${i.path} ${i.message}`).join("; ");
    return err(
      new ProtocolValidationError(`Validation failed for ${schemaId}: ${summary}`, {
        details: { schemaId, issues },
      }),
    );
  }

  isValid(schemaId: string, data: unknown): boolean {
    const validateFn = this.ajv.getSchema(schemaId);
    return validateFn ? Boolean(validateFn(data)) : false;
  }

  /** Throwing variant for trust boundaries where invalid data is exceptional. */
  assertValid<T = unknown>(schemaId: string, data: unknown): T {
    const result = this.validate<T>(schemaId, data);
    if (!result.ok) throw result.error;
    return result.value;
  }
}

export const defaultValidator = new SchemaValidator();
