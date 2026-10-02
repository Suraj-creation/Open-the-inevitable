import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ScriptedTutorFaculty } from "@uci/env-tutor";
import { azureFaculty, ClaudeFaculty, GeminiFaculty, openAIFaculty } from "@uci/faculties";
import type { ModelFaculty } from "@uci/harness";

export type FacultyName = "scripted" | "claude" | "opus" | "sonnet" | "azure" | "gemini" | "openai";
export const FACULTY_NAMES: readonly FacultyName[] = [
  "scripted",
  "claude",
  "opus",
  "sonnet",
  "azure",
  "gemini",
  "openai",
];

/**
 * Read the repository's git-ignored .env into a plain map, without touching process.env and
 * without ever printing a value. Real environment variables take precedence over the file.
 */
export function loadEnv(start = dirname(fileURLToPath(import.meta.url))): Record<string, string> {
  let dir = start;
  let file: string | undefined;
  for (let i = 0; i < 8; i++) {
    if (existsSync(join(dir, ".env")) && existsSync(join(dir, "pnpm-workspace.yaml"))) {
      file = join(dir, ".env");
      break;
    }
    dir = dirname(dir);
  }
  const values: Record<string, string> = {};
  if (file)
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = /^([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
      if (m?.[1] && m[2] !== undefined) values[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
    }
  for (const [k, v] of Object.entries(process.env))
    if (v !== undefined && /^[A-Z0-9_]+$/.test(k)) values[k] = v;
  return values;
}

function need(env: Record<string, string>, key: string): string {
  const v = env[key];
  if (!v) throw new Error(`missing ${key} (set it in the repository .env)`);
  return v;
}

/** Build a faculty by name from configuration. Model choices can be overridden by env. */
export function makeFaculty(
  name: FacultyName,
  env: Record<string, string> = loadEnv(),
): ModelFaculty {
  switch (name) {
    case "scripted":
      return new ScriptedTutorFaculty();
    case "claude":
    case "opus":
    case "sonnet":
      return new ClaudeFaculty({
        apiKey: need(env, "ANTHROPIC_API_KEY"),
        model:
          name === "opus"
            ? "claude-opus-5-5"
            : name === "sonnet"
              ? "claude-sonnet-5-5"
              : (env["UCI_CLAUDE_MODEL"] ?? "claude-opus-5-5"),
        effort: (env["UCI_CLAUDE_EFFORT"] as "low" | "medium" | "high" | undefined) ?? "medium",
      });
    case "azure":
      return azureFaculty({
        endpoint: need(env, "AZURE_OPENAI_ENDPOINT"),
        apiKey: need(env, "AZURE_OPENAI_API_KEY"),
        apiVersion: env["AZURE_OPENAI_API_VERSION"] ?? "2025-04-01-preview",
        deployment: env["AZURE_OPENAI_CHAT_DEPLOYMENT"] ?? "gpt-4.1-mini",
      });
    case "gemini":
      return new GeminiFaculty({
        apiKey: need(env, "GEMINI_API_KEY"),
        model: env["GEMINI_MODEL"] ?? "gemini-flash-latest",
      });
    case "openai":
      return openAIFaculty({
        apiKey: need(env, "OPENAI_API_KEY"),
        model: env["UCI_OPENAI_MODEL"] ?? "gpt-4.1-mini",
      });
  }
}
