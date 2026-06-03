/**
 * CI gate: prove every canonical schema compiles as valid JSON Schema, that every schema has at
 * least one example fixture, and that all example fixtures validate. Spec: spec/meta/protocol-governance.md
 * ("protocols should be tested with contract tests").
 */
import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { SchemaValidator } from "../src/validator";
import { SCHEMAS } from "../src/schemas";

const here = dirname(fileURLToPath(import.meta.url));
const examplesPath = join(here, "..", "fixtures", "examples.json");

async function main(): Promise<void> {
  // Compiling all schemas into the validator throws on any malformed schema.
  const validator = new SchemaValidator();

  const examples = JSON.parse(await readFile(examplesPath, "utf8")) as Record<string, unknown>;

  const failures: string[] = [];
  for (const schema of SCHEMAS) {
    const example = examples[schema.$id];
    if (example === undefined) {
      failures.push(`No example fixture for ${schema.$id}`);
      continue;
    }
    const result = validator.validate(schema.$id, example);
    if (!result.ok) {
      failures.push(`Example for ${schema.$id} failed: ${result.error.message}`);
    }
  }

  if (failures.length > 0) {
    console.error(`validate:schemas FAILED\n - ${failures.join("\n - ")}`);
    process.exit(1);
  }
  console.log(`validate:schemas OK — ${SCHEMAS.length} schemas compiled and examples validated`);
}

main().catch((error: unknown) => {
  console.error("validate:schemas crashed:", error);
  process.exit(1);
});
