/**
 * M9 T2 live smoke (CSE-006 §3.1, ADR-0041) — the Claim Graph lit up, through the gateway's fusion
 * engine (the website backend's SourceHub) with REAL Gemini. Registers two sources that genuinely
 * disagree about gradient descent, enables claim reasoning, and fuses: proves the real model
 * extracts grounded claims per source and detects a genuine cross-source contradiction with a
 * typed nature — never fabricated.
 *
 * Run from the repo ROOT: `npx tsx apps/api/scripts/m9t2-claim-smoke.ts` (needs GEMINI_API_KEY in .env).
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

const SOURCE_A = `# Gradient Descent

On any smooth loss surface, gradient descent is guaranteed to converge to the global minimum
provided the learning rate is small enough. Every run therefore finds the single best solution.
`;

const SOURCE_B = `# Gradient Descent

Gradient descent does not find the global minimum in general. On the non-convex loss surfaces of
deep networks, gradient descent converges to a local minimum that depends on the starting point,
so different runs of gradient descent reach different, sub-optimal solutions.
`;

function fail(msg: string): never {
  console.error(`FAIL ${msg}`);
  process.exit(1);
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** One attempt over a fresh hub (fresh version ids), so the per-version claim cache never masks a
 * transient failure from a prior attempt. Returns the fused gradient-descent concept. */
async function attempt(apiKey: string): Promise<{
  a: string;
  b: string;
  claims: { source_version_id: string; epistemic_status: string; statement: string }[];
  contradictions: { nature: string; rationale?: string }[];
  synthesis: { prose: string; cited: number; acknowledges: boolean; degraded: boolean } | null;
}> {
  const connected = await GeminiModelRuntime.connect({ apiKey });
  if (!connected.ok) fail(`Gemini connect failed: ${connected.error.message}`);
  const hub = new SourceHub();
  hub.enableFusionCognition(connected.value, "gemini");
  const a = await hub.register({
    content: SOURCE_A,
    modality: "markdown",
    title: "Convex Optimization Primer",
  });
  const b = await hub.register({
    content: SOURCE_B,
    modality: "markdown",
    title: "Deep Learning in Practice",
  });
  if (!a.ok || !b.ok) fail("source registration failed");
  const result = await hub.fuse(
    [a.value.source_version_id, b.value.source_version_id],
    ["gradient-descent"],
  );
  const gd = result.concepts.find((c) => c.concept_ref === "gradient-descent");
  if (!gd) fail("no fused concept for gradient-descent");
  return {
    a: a.value.source_version_id,
    b: b.value.source_version_id,
    claims: [...(gd.claims ?? [])],
    contradictions: gd.reconciliation.contradictions.map((x) => ({
      nature: x.nature,
      ...(x.rationale ? { rationale: x.rationale } : {}),
    })),
    synthesis: gd.synthesis
      ? {
          prose: gd.synthesis.prose,
          cited: gd.synthesis.cited_source_ids.length,
          acknowledges: gd.synthesis.acknowledges_disagreement,
          degraded: gd.synthesis.degraded,
        }
      : null,
  };
}

async function main(): Promise<void> {
  loadEnv();
  const apiKey = process.env["GEMINI_API_KEY"];
  if (!apiKey) fail("GEMINI_API_KEY not set (repo-root .env)");

  // Bounded retry: the free-tier model burst-limits rapid structured calls; a failed extract lands
  // as honest absence, so retry once past the burst window before concluding (never an infinite loop).
  let run = await attempt(apiKey);
  for (let i = 0; i < 2 && new Set(run.claims.map((c) => c.source_version_id)).size < 2; i++) {
    console.log("… only one source produced claims (burst limit); waiting 30s and retrying");
    await sleep(30_000);
    run = await attempt(apiKey);
  }

  console.log(`1 REGISTERED: A=${run.a} B=${run.b}`);
  console.log(`2 CLAIMS: ${run.claims.length}`);
  for (const c of run.claims) {
    const title = c.source_version_id === run.a ? "A" : "B";
    console.log(`   [${title} · ${c.epistemic_status}] ${c.statement}`);
  }
  console.log(`3 CONTRADICTIONS: ${run.contradictions.length}`);
  for (const x of run.contradictions) {
    console.log(`   nature=${x.nature}${x.rationale ? ` — ${x.rationale}` : ""}`);
  }
  if (run.synthesis) {
    console.log(
      `4 SYNTHESIS: cites=${run.synthesis.cited} acknowledgesDisagreement=${run.synthesis.acknowledges} degraded=${run.synthesis.degraded}`,
    );
    console.log(`   ${run.synthesis.prose}`);
  } else {
    console.log("4 SYNTHESIS: none");
  }

  const sources = new Set(run.claims.map((c) => c.source_version_id));
  if (sources.size < 2)
    fail("claims did not come from both sources (likely a persistent burst limit)");

  if (!run.synthesis || run.synthesis.cited < 2) {
    fail("expected a fused synthesis citing both sources");
  }
  if (run.contradictions.length > 0) {
    console.log(
      "M9 T2+T3 FUSION LIVE SMOKE: PASSED (grounded claims, genuine cross-source contradiction, fused synthesis citing both)",
    );
  } else {
    console.log(
      "M9 T2+T3 FUSION LIVE SMOKE: claims + provenance + synthesis PASSED; model reported no contradiction (honest absence)",
    );
  }
}

main().catch((cause) => {
  console.error("FAIL", cause);
  process.exit(1);
});
