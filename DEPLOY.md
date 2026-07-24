# Deploying The Inevitable — free (Vercel + Render split)

The app is two pieces:

- **Web** (`apps/web`) — a static Vite SPA.
- **Gateway** (`apps/api`) — a persistent Node HTTP server with **SSE streaming**, in-memory surface
  state, and filesystem persistence. It needs a long-lived process (not serverless/edge).

This split hosts the web on **Vercel** (free static CDN) and the gateway on **Render** (free web
service). The web talks to the gateway **directly** across origins — the gateway already sends
`Access-Control-Allow-Origin: *`, so cross-origin `fetch` and the SSE `EventSource` work without a
proxy. The only wiring is one build-time env var, `VITE_API_BASE`, pointing the web at the gateway.

Config committed: `render.yaml` (gateway Blueprint), `vercel.json` (web build + SPA fallback).

## Order matters (deploy the gateway first)

`VITE_API_BASE` is inlined into the web **at build time**, so you need the gateway's URL before you
build the web.

### 1. Gateway → Render (free)

1. Render → **New → Blueprint** → connect the GitHub repo. It reads `render.yaml`.
   (Or **New → Web Service**, root = repo, Build `pnpm install --prod=false --frozen-lockfile`,
   Start `pnpm --filter @inevitable/api start`, Health check path `/api/sources/commons`.)
2. Set the secret **`GEMINI_API_KEY`** (Google AI Studio, free tier). Without it the gateway runs the
   deterministic null model — the flow works, but teaching content is placeholder.
3. Deploy. Note the URL, e.g. `https://inevitable-gateway.onrender.com`.

Render free caveats (expected): the service **spins down after ~15 min idle** (first request after
that is a cold start), and the disk is **ephemeral** — learner memory (`/tmp/cos-data`) resets on
redeploy/spindown. For durable memory, wire the Supabase adapter (`SUPABASE_BACKEND_URL`) — free tier.

### 2. Web → Vercel (free)

1. Vercel → **New Project** → import the repo. It reads `vercel.json` (build
   `pnpm --filter @inevitable/web build`, output `apps/web/dist`, SPA fallback rewrite).
2. Add an **Environment Variable**: `VITE_API_BASE = https://inevitable-gateway.onrender.com`
   (your Render URL, no trailing slash).
3. Deploy. Open the Vercel URL → enter without a topic, upload a source, and learn from it.

If you later change the gateway URL, update `VITE_API_BASE` in Vercel and redeploy the web (it's
build-time).

## Local dev is unchanged

`VITE_API_BASE` is empty locally, so the web uses relative `/api`, which the Vite dev proxy
(`vite.config.ts`) forwards to `http://localhost:8787`. Run `pnpm dev:gateway` + `pnpm dev:web`.

## Notes

- `packageManager: pnpm@9.15.0` is set, so both hosts use corepack pnpm automatically.
- The gateway reads `PORT` from the environment (Render sets it); no change needed.
- Single instance only — the host keeps surfaces in memory, so do not scale the gateway to >1
  instance on a plan that autoscales.
