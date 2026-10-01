import { FacultyError } from "@uci/harness";

/**
 * Provider dialects of the provider-neutral proposal schema. The harness speaks one schema
 * (lowercase JSON-schema types, optional fields omitted from `required`); each provider gets a
 * faithful translation, never a different contract.
 */
type Schema = Record<string, unknown>;

function mapSchema(schema: Schema, visit: (node: Schema) => Schema): Schema {
  const node: Schema = { ...schema };
  if (node["properties"] && typeof node["properties"] === "object") {
    node["properties"] = Object.fromEntries(
      Object.entries(node["properties"] as Record<string, Schema>).map(([k, v]) => [
        k,
        mapSchema(v, visit),
      ]),
    );
  }
  if (node["items"] && typeof node["items"] === "object")
    node["items"] = mapSchema(node["items"] as Schema, visit);
  return visit(node);
}

/** Claude structured outputs and OpenAI json_schema: every object closed with additionalProperties:false. */
export function closedObjects(schema: Schema): Schema {
  return mapSchema(schema, (n) =>
    n["type"] === "object" ? { ...n, additionalProperties: false } : n,
  );
}

/**
 * OpenAI strict structured outputs: every object closed and every property required. An optional
 * property becomes "this type or null"; the harness reads null as absent (syntax-normalize@2), so
 * the contract is unchanged while the provider can guarantee the shape.
 */
export function strictObjects(schema: Schema): Schema {
  return mapSchema(schema, (n) => {
    if (n["type"] !== "object" || !n["properties"]) return n;
    const props = n["properties"] as Record<string, Schema>;
    const required = new Set((n["required"] as string[] | undefined) ?? []);
    const properties = Object.fromEntries(
      Object.entries(props).map(([k, v]) => [
        k,
        required.has(k) ? v : { anyOf: [v, { type: "null" }] },
      ]),
    );
    return { ...n, properties, required: Object.keys(props), additionalProperties: false };
  });
}

/** Gemini responseSchema: OpenAPI-style uppercase types; no additionalProperties keyword. */
export function geminiSchema(schema: Schema): Schema {
  return mapSchema(schema, (n) => {
    const { additionalProperties: _drop, ...rest } = n;
    return typeof rest["type"] === "string"
      ? { ...rest, type: (rest["type"] as string).toUpperCase() }
      : rest;
  });
}

/**
 * Classify a provider failure by what may have happened to the request. Status codes from the
 * provider mean it was received and rejected; no status means the request may or may not have
 * reached it (ambiguous). Retry safety is decided from delivery, never guessed from text.
 */
export function classify(error: unknown, provider: string): FacultyError {
  const e = error as { status?: unknown; message?: unknown; name?: unknown };
  const status = typeof e?.status === "number" ? e.status : undefined;
  const message = `${provider}: ${String(e?.message ?? error)
    .replace(/sk-[A-Za-z0-9_-]{8,}/g, "[redacted]")
    .slice(0, 400)}`;
  if (status === undefined) return new FacultyError(message, "ambiguous", true);
  if (status === 408 || status === 409 || status === 429 || status >= 500)
    return new FacultyError(message, "rejected", true);
  return new FacultyError(message, "rejected", false);
}

export const DEFAULT_TIMEOUT_MS = 180_000;
