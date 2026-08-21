/**
 * Boot the Surface Gateway. `pnpm dev:gateway` (or PORT=8788 tsx src/main.ts).
 *
 * Pairs with `apps/web` (the visible surface): the browser connects to /api/surface/:id/stream
 * and folds the streamed surface.* log into SurfaceState live. With GEMINI_API_KEY set, blocks
 * carry real Gemini cognition (recorded as model.* events, D3); otherwise the deterministic
 * NullModelRuntime runs the identical governed path.
 */
import { resolve } from "node:path";
import { GeminiModelRuntime } from "@inevitable/adapters";
import { geminiApiKey, geminiModel, loadEnv, persistDir } from "./env";
import { SurfaceHost } from "./host";
import { createGatewayServer } from "./server";

loadEnv(); // hydrate process.env from .env before any session resolves its model

// Durable by default in dev so understanding compounds ACROSS restarts (a returning learner resumes
// their path and prior mastery — F05). Opt out with COS_PERSIST_DIR="" ; production sets it explicitly.
// Only the dev entrypoint defaults this; the SurfaceHost/tests stay in-memory unless told otherwise.
if (process.env["COS_PERSIST_DIR"] === undefined && process.env["NODE_ENV"] !== "production") {
  process.env["COS_PERSIST_DIR"] = resolve(process.cwd(), ".cos-data");
}

const port = Number(process.env["PORT"] ?? 8787);
const host = new SurfaceHost();
const server = createGatewayServer(host);

/**
 * Startup liveness probe. `resolveModel()` reports `provider:"gemini"` for ANY non-empty key —
 * `connect()` never touches the network — so a REVOKED/expired/quota-exhausted key boots the gateway
 * green and then silently degrades every real call to deterministic stub cognition (the failure is
 * recorded as `model.invocation.failed` on the bus, but no operator watches the event log). This
 * one-shot probe actually exercises the key at boot and prints an unmissable banner when it is
 * present-but-dead, so the "looks live, teaches generic" trap can never pass unnoticed again. It is
 * non-fatal (a transient boot-time blip must not take the site down) and never runs without a key,
 * so hermetic/offline runs are unaffected.
 */
async function probeModelLiveness(apiKey: string): Promise<void> {
  const model = geminiModel();
  const connected = await GeminiModelRuntime.connect({ apiKey, defaultModel: model });
  if (!connected.ok) {
    console.error(
      `[COS] MODEL PROVIDER UNAVAILABLE: ${connected.error.code} — the Gemini SDK is not provisioned. ` +
        `The gateway will serve DEGRADED stub cognition, not real teaching.`,
    );
    return;
  }
  try {
    // thinkingBudget:0 so a reasoning model returns visible text (else the whole budget is thinking).
    await connected.value.generate({ prompt: "ping", maxTokens: 8, thinkingBudget: 0 });
    console.log(
      JSON.stringify({
        service: "surface-gateway",
        model_liveness: "ok",
        model: model ?? "default",
      }),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      [
        "",
        "==================================================================",
        "[COS] GEMINI_API_KEY IS SET BUT THE PROVIDER REJECTED A LIVE CALL.",
        `      reason: ${message}`,
        "      The gateway booted, but EVERY model call will fall back to",
        "      deterministic stub cognition — uploads will be taught with",
        "      generic, NON-source-grounded content until the key is fixed.",
        "      Rotate/replace GEMINI_API_KEY (Google AI Studio, AIza… key).",
        "==================================================================",
        "",
      ].join("\n"),
    );
  }
}

server.listen(port, () => {
  console.log(
    JSON.stringify({
      service: "surface-gateway",
      status: "listening",
      port,
      model: geminiApiKey() ? "gemini" : "null",
      persistence: persistDir() ? "durable" : "in-memory",
      hint: `POST http://localhost:${port}/api/surface { "goal": "Teach me Neural Networks" }`,
    }),
  );
  // Fire-and-forget: never blocks the listen callback, never rejects (the probe swallows its own errors).
  const apiKey = geminiApiKey();
  if (apiKey) void probeModelLiveness(apiKey);
});
