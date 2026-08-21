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
 * Optional override for the Gemini text model id (e.g. `gemini-flash-latest`, `gemini-pro-latest`).
 * Absent ⇒ the adapter's default. Lets ops swap models when Google retires a pinned id WITHOUT a code
 * change (a pinned id returning 404 otherwise degrades every call to stub cognition, silently).
 */
export function geminiModel(): string | undefined {
  const model = process.env["GEMINI_MODEL"];
  return model && model.trim() ? model.trim() : undefined;
}

/**
 * True when the gateway must reject startup if no real model is available.
 * Set `COS_STRICT_MODEL=1` (or run with `NODE_ENV=production`) to enable.
 * Prevents NullModelRuntime from silently masquerading as cognition in deployed environments.
 */
export function strictModel(): boolean {
  return process.env["COS_STRICT_MODEL"] === "1" || process.env["NODE_ENV"] === "production";
}

/**
 * The durable Postgres plane/chronicle (ADR-0034/0035): active only when BOTH
 * `COS_BACKEND=supabase` and `SUPABASE_DB_URL` are set, so dev/test runs stay offline by default.
 * (A bracketed placeholder URL — pre-credential .env — counts as unset.)
 */
export function supabaseBackendUrl(): string | undefined {
  if (process.env["COS_BACKEND"] !== "supabase") return undefined;
  const url = process.env["SUPABASE_DB_URL"];
  return url && url.trim() && !url.includes("[") ? url : undefined;
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

/**
 * Supabase Storage config for durable canonical source bytes (CSE M5, ADR-0034/0036): active only
 * when `COS_BACKEND=supabase` and both the project URL and service-role key are set (bracketed
 * placeholders count as unset). Absent ⇒ source bytes are served from process memory only.
 */
export function supabaseStorageConfig(): { url: string; serviceKey: string } | undefined {
  if (process.env["COS_BACKEND"] !== "supabase") return undefined;
  const url = process.env["SUPABASE_URL"];
  const serviceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!url?.trim() || url.includes("[")) return undefined;
  if (!serviceKey?.trim() || serviceKey.includes("[")) return undefined;
  return { url, serviceKey };
}
