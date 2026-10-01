/* TEMPORARY diagnostic probe: reproduce the live composer call, report the EXACT failure. */
import { GeminiModelRuntime } from "@inevitable/adapters";
import { SurfaceComposerUnit } from "@inevitable/product-cognition";
import { geminiApiKey, geminiModel, loadEnv } from "../src/env.js";

loadEnv();
const key = geminiApiKey();
console.log("key present:", !!key, "| model override:", geminiModel() ?? "(default)");
if (!key) process.exit(1);

const connected = await GeminiModelRuntime.connect({ apiKey: key, defaultModel: geminiModel() });
if (!connected.ok) {
  console.log("CONNECT FAILED:", connected.error.code, connected.error.message);
  process.exit(1);
}
const model = connected.value;

const excerpt =
  "Capital letters are used for random variables and major algorithm variables. Lower case letters " +
  "are used for the values of random variables and for scalar functions. Quantities that are required " +
  "to be real-valued vectors are written in bold and in lower case (even if random variables)...";

const packet = {
  packet_id: "pkt-probe-1",
  intent: { goal: "Teach me this document" },
  content: {
    concept_id: "c-summary-of-notation",
    concept_title: "Summary of Notation",
    goal: "Teach me this document",
    source_excerpts: [
      {
        source_version_id: "srcv-probe",
        title: "SuttonBartoIPRLBook2ndEd.pdf",
        quote: excerpt,
        path: "p13/blk-1",
        page: 13,
      },
    ],
  },
  provenance: {},
} as never;

const unit = new SurfaceComposerUnit({
  manifest: {
    id: "composer",
    role: "Surface Composer: distills teaching content into the MCCR.",
  } as never,
  model,
});

const built = (unit as unknown as { buildRequest(p: unknown): Record<string, never> }).buildRequest(
  packet,
);
console.log("\n--- request ---");
console.log("maxTokens:", built["maxTokens"], "thinkingBudget:", built["thinkingBudget"]);
console.log("system chars:", String(built["system"]).length);
console.log("prompt:", JSON.stringify(built["prompt"]).slice(0, 400));

try {
  const t0 = Date.now();
  const res = await model.generate(built as never);
  console.log("\n--- raw model result ---");
  console.log("ms:", Date.now() - t0, "| model:", res.model, "| finishReason:", res.finishReason);
  console.log("text length:", res.text.length);
  console.log("text head:", res.text.slice(0, 700));
  console.log("...text tail:", res.text.slice(-250));
} catch (e) {
  const err = e as { code?: string; message?: string; details?: unknown };
  console.log("\n--- raw model THREW ---");
  console.log("code:", err.code, "| message:", err.message);
  console.log("details:", JSON.stringify(err.details ?? {}).slice(0, 900));
}

console.log("\n--- through execute() (what the learner actually gets) ---");
const em = await unit.execute(packet);
const p = (em.packets[0] ?? {}) as { content?: Record<string, never>; provenance?: unknown };
const content = p.content ?? {};
console.log("provenance:", JSON.stringify(p.provenance ?? {}).slice(0, 500));
console.log("anchors:", Object.keys((content["mccr"] as object) ?? {}));
console.log(
  "narration segs:",
  ((content["narration_script"] as { segments?: unknown[] })?.segments ?? []).length,
);
