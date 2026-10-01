import { createHash } from "node:crypto";

/**
 * Canonical JSON: object keys sorted, no whitespace. Two values that are structurally equal always
 * serialize to the same bytes, which is what record hashes, render hashes and fold comparisons need.
 * `undefined` object members are dropped (as JSON does); non-finite numbers are rejected.
 */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(normalize(value));
}

function normalize(value: unknown): unknown {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error(`canonicalJson: non-finite number ${value}`);
    return value;
  }
  if (Array.isArray(value)) return value.map(normalize);
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as object).sort()) {
      const member = (value as Record<string, unknown>)[key];
      if (member !== undefined) out[key] = normalize(member);
    }
    return out;
  }
  throw new Error(`canonicalJson: unsupported type ${typeof value}`);
}

export function sha256Hex(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

export function hashOf(value: unknown): string {
  return sha256Hex(canonicalJson(value));
}
