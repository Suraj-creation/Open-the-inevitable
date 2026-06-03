/**
 * Schema Registry — indexes canonical protocol schemas by `$id` and by name+version, and
 * exposes version resolution. Spec: spec/protocols/cognitive-unit-abi.md (protocol versioning),
 * spec/meta/protocol-governance.md.
 */
import { SCHEMAS, type SchemaDocument } from "./schemas";

export interface ParsedSchemaId {
  /** e.g. "protocol" or "registry" */
  readonly kind: string;
  /** e.g. "cognition-packet" */
  readonly name: string;
  /** semver, e.g. "1.0.0" */
  readonly version: string;
}

const SCHEMA_ID_PATTERN = /^cos:([a-z-]+):([a-z0-9-]+):(\d+\.\d+\.\d+)$/;

/** Parse a `cos:<kind>:<name>:<version>` id, or null if malformed. */
export function parseSchemaId(id: string): ParsedSchemaId | null {
  const match = SCHEMA_ID_PATTERN.exec(id);
  if (!match) return null;
  const [, kind, name, version] = match;
  if (kind === undefined || name === undefined || version === undefined) return null;
  return { kind, name, version };
}

function compareSemver(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    const da = pa[i] ?? 0;
    const db = pb[i] ?? 0;
    if (da !== db) return da - db;
  }
  return 0;
}

export class SchemaRegistry {
  private readonly byId = new Map<string, SchemaDocument>();
  private readonly byName = new Map<string, SchemaDocument[]>();

  constructor(schemas: readonly SchemaDocument[] = SCHEMAS) {
    for (const schema of schemas) this.register(schema);
  }

  register(schema: SchemaDocument): void {
    if (this.byId.has(schema.$id)) {
      throw new Error(`Duplicate schema id: ${schema.$id}`);
    }
    this.byId.set(schema.$id, schema);
    const parsed = parseSchemaId(schema.$id);
    if (parsed) {
      const versions = this.byName.get(parsed.name) ?? [];
      versions.push(schema);
      this.byName.set(parsed.name, versions);
    }
  }

  has(id: string): boolean {
    return this.byId.has(id);
  }

  get(id: string): SchemaDocument | undefined {
    return this.byId.get(id);
  }

  /** Resolve the highest-semver schema registered under a bare name. */
  getLatest(name: string): SchemaDocument | undefined {
    const versions = this.byName.get(name);
    if (!versions || versions.length === 0) return undefined;
    return [...versions].sort((a, b) => {
      const va = parseSchemaId(a.$id)?.version ?? "0.0.0";
      const vb = parseSchemaId(b.$id)?.version ?? "0.0.0";
      return compareSemver(vb, va);
    })[0];
  }

  list(): SchemaDocument[] {
    return [...this.byId.values()];
  }

  ids(): string[] {
    return [...this.byId.keys()];
  }
}

export const defaultRegistry = new SchemaRegistry();
