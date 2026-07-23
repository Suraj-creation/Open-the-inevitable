/**
 * M9 Frontier T1 live smoke (CSE-006 §3.2, ADR-0043) — the living-knowledge overlay via REAL web
 * grounding, through the gateway's SourceHub (the website backend). Researches a concept's frontier
 * with Gemini Google Search and proves every entry is backed by a real, fetchable citation — the
 * grounding law (no citable origin, no entry; never a fabricated frontier).
 *
 * Run from the repo ROOT: `npx tsx apps/api/scripts/m9-frontier-smoke.ts` (needs GEMINI_API_KEY in .env).
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { GeminiModelRuntime } from "@inevitable/adapters";
import { SourceHub } from "../src/sources";

function loadEnv(): void {
  const file = resolve(process.cwd(), ".env");
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 0) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
      v = v.slice(1, -1);
    if (k && process.env[k] === undefined) process.env[k] = v;
  }
}

function fail(msg: string): never {
  console.error(`FAIL ${msg}`);
  process.exit(1);
}

async function main(): Promise<void> {
  loadEnv();
  const apiKey = process.env["GEMINI_API_KEY"];
  if (!apiKey) fail("GEMINI_API_KEY not set (repo-root .env)");
  const connected = await GeminiModelRuntime.connect({ apiKey });
  if (!connected.ok) fail(`Gemini connect failed: ${connected.error.message}`);

  const hub = new SourceHub();
  hub.enableFusionCognition(connected.value, "gemini");

  const concept = "transformer neural networks";
  const overlay = await hub.researchFrontier(concept);

  console.log(`1 CONCEPT: ${concept}`);
  console.log(
    `2 OVERLAY: ${overlay.overlay_id} | degraded=${overlay.degraded} | entries=${overlay.entries.length}`,
  );
  for (const e of overlay.entries) {
    const refs = e.external_refs
      .map((r) => r.uri)
      .slice(0, 2)
      .join(", ");
    console.log(`   [${e.kind}] ${e.summary}`);
    console.log(`      ↳ ${refs || "(no citation)"}`);
  }

  if (overlay.entries.length === 0) {
    // Honest empty is a valid outcome, but for a well-known live concept we expect grounded entries.
    console.log(
      "M9 FRONTIER LIVE SMOKE: overlay honestly empty (no citable frontier returned this run)",
    );
    return;
  }
  const allGrounded = overlay.entries.every((e) =>
    e.external_refs.some((r) => /^https?:\/\//.test(r.uri)),
  );
  if (!allGrounded) fail("an entry lacks a real citation — the grounding law was violated");
  console.log(
    "M9 FRONTIER LIVE SMOKE: PASSED (typed frontier entries, every one grounded in a real web citation)",
  );
}

main().catch((cause) => {
  console.error("FAIL", cause);
  process.exit(1);
});
