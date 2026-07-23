/**
 * Boot the Surface Gateway. `pnpm dev:gateway` (or PORT=8788 tsx src/main.ts).
 *
 * Pairs with `apps/web` (the visible surface): the browser connects to /api/surface/:id/stream
 * and folds the streamed surface.* log into SurfaceState live. With GEMINI_API_KEY set, blocks
 * carry real Gemini cognition (recorded as model.* events, D3); otherwise the deterministic
 * NullModelRuntime runs the identical governed path.
 */
import { resolve } from "node:path";
import { geminiApiKey, loadEnv, persistDir } from "./env";
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
});
