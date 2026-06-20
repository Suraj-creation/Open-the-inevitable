/**
 * Minimal zero-dependency .env loader (mirrors apps/api/src/env.ts). Reads `<cwd>/.env` if present
 * — `pnpm demo` runs from the repo root — and sets only keys not already in the environment.
 * Secrets live in .env (gitignored) and never enter the canonical record.
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
