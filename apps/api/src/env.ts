/**
 * Minimal zero-dependency .env loader. tsx/node do not auto-load .env across all supported
 * versions, and we avoid a `dotenv` dependency. Reads `<cwd>/.env` if present (pnpm runs the dev
 * scripts from the repo root) and sets only keys not already in the environment, so real env vars
 * always win over the file. Secrets live in .env (gitignored); they never enter the canonical record.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export function loadEnv(file: string = resolve(process.cwd(), ".env")): void {
  if (!existsSync(file)) return;
  for (const rawLine of readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

/** The Gemini API key, if set. */
export function geminiApiKey(): string | undefined {
  return process.env["GEMINI_API_KEY"];
}

/**
 * The durable-persistence directory, if set. When present, the gateway durably persists every
 * surface's event log and media to disk and can reconstruct a surface after a restart (ADR-0008).
 * Absent ⇒ in-memory only (the default; tests stay hermetic). Spec: persistence/durable-cognitive-persistence.
 */
export function persistDir(): string | undefined {
  const dir = process.env["COS_PERSIST_DIR"];
  return dir && dir.trim() ? dir : undefined;
}
