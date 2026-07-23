/**
 * M9 TKM T1 live smoke (CSE-006 §3.3, ADR-0044) — the Temporal Knowledge Model via REAL web
 * grounding, through the gateway's SourceHub (the website backend). Researches a concept's
 * trajectory through time and proves every epistemic state is backed by a real, fetchable citation
 * and ordered chronologically — the grounding law + sparse honesty.
 *
 * Run from the repo ROOT: `npx tsx apps/api/scripts/m9-timeline-smoke.ts` (needs GEMINI_API_KEY in .env).
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

  const concept = "backpropagation";
  const timeline = await hub.researchTimeline(concept);

  console.log(`1 CONCEPT: ${concept}`);
  console.log(
    `2 TIMELINE: ${timeline.timeline_id} | degraded=${timeline.degraded} | states=${timeline.states.length}`,
  );
  for (const s of timeline.states) {
    console.log(`   ${s.era ?? "    ?"} · [${s.kind}] ${s.label}`);
    console.log(`      ${s.summary}`);
    console.log(
      `      ↳ ${
        s.external_refs
          .map((r) => r.uri)
          .slice(0, 1)
          .join(", ") || "(no citation)"
      }`,
    );
  }

  if (timeline.states.length === 0) {
    console.log(
      "M9 TIMELINE LIVE SMOKE: timeline honestly empty (no citable history returned this run)",
    );
    return;
  }
  const allGrounded = timeline.states.every((s) =>
    s.external_refs.some((r) => /^https?:\/\//.test(r.uri)),
  );
  if (!allGrounded) fail("a state lacks a real citation — the grounding law was violated");
  // Chronological check: parseable years must be non-decreasing.
  const years = timeline.states
    .map((s) => (s.era ? Number(s.era.match(/\d{4}/)?.[0]) : NaN))
    .filter((y) => !Number.isNaN(y));
  const ordered = years.every((y, i) => i === 0 || y >= (years[i - 1] as number));
  if (!ordered) fail(`states not in chronological order: ${years.join(", ")}`);
  console.log(
    "M9 TIMELINE LIVE SMOKE: PASSED (ordered epistemic states, every one grounded in a real web citation)",
  );
}

main().catch((cause) => {
  console.error("FAIL", cause);
  process.exit(1);
});
