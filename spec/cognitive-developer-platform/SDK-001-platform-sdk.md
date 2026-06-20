```yaml
spec:
  id: SDK-001
  title: Platform SDK and Second Manifestation
  domain: cognitive-developer-platform
  status: active
  owner: platform-team
  last_reviewed: 2026-06-20
  upstream_dependencies:
    - surface/surface-streaming-sync-protocol (SRF-005)
    - architecture-decisions/ADR-0006 (surface gateway transport)
  downstream_dependencies:
    - apps/api (the gateway this SDK targets)
    - apps/mcp (MCP manifestation using this SDK)
  related_protocols:
    - cognitive-event-protocol (event envelope shape emitted by the gateway stream)
  related_events:
    - surface.*
  related_runtime_systems:
    - surface-gateway (apps/api)
  related_governance_systems: []
  related_observability_systems: []
  semantic_tags:
    - sdk
    - platform
    - manifestation
    - http-client
    - mcp
    - second-manifestation
  non_goals:
    - WebSocket / duplex transport (deferred per ADR-0006 until multi-writer needs it)
    - Authentication / per-user tokens (deferred to P8+)
    - Streaming parse of the SSE stream within the SDK (callers use EventSource or fetch + stream)
    - Importing any substrate package (@inevitable/events, @inevitable/kernel, etc.) into the SDK
    - The MCP server is a proof-of-concept, not a production-grade MCP implementation
```

# SDK-001 — Platform SDK and Second Manifestation

## Purpose

Demonstrate the §2 substrate-independence law by:

1. Publishing `@inevitable/sdk` — a typed HTTP client with **zero substrate package imports** that
   can drive the full cognitive pipeline via `apps/api`'s stable HTTP surface.
2. Building `apps/mcp` — a pure stdio MCP server that imports **only** `@inevitable/sdk` and
   Node.js builtins, proving that a new cognitive manifestation requires zero changes to the
   substrate packages.

The law states: *dependencies point inward — manifestations depend on the substrate, the substrate
on its contracts, contracts on nothing — and no vendor, model, transport, or store leaks past its
adapter.* This phase makes that law verifiably true for a second manifestation.

## `@inevitable/sdk` — Platform Client

The SDK is a typed HTTP wrapper over the `apps/api` surface gateway interface. It has:

- **Zero workspace dependencies** — no `@inevitable/*` imports
- **Native `fetch`** (Node 18+ / browser) — no HTTP library
- Injectable `fetch` for testing

### API

```
CosClient(opts: { baseUrl: string; fetch?: typeof globalThis.fetch })

  createSurface(params?: { learnerId?: string; goal?: string }): Promise<CosSurface>
    → POST /api/surface → { surfaceId, learnerId, goal }

  ask(surfaceId, goal): Promise<{ blocks: number }>
    → POST /api/surface/:id/command { type: "ask", goal }

  expand(surfaceId, blockId, layer): Promise<{ block_id: string; version: number }>
    → POST /api/surface/:id/command { type: "expand", block_id, layer }

  close(surfaceId, reason?): Promise<void>
    → POST /api/surface/:id/command { type: "close", reason }

  getState(surfaceId): Promise<unknown>
    → GET /api/surface/:id/state → state (raw JSON; caller folds with foldSurfaceEvents if needed)

  getLearner(learnerId): Promise<CosLearner>
    → GET /api/learner/:id → { learnerId, cid, trustLevel, surfaces }
```

Errors throw `CosClientError` (carries `status: number` and a message). This is the only SDK
exception type — callers can catch it uniformly.

### Types

```
CosSurface        { surfaceId, learnerId, goal }
CosLearner        { learnerId, cid, trustLevel, surfaces }
CosCommand        { type: "ask" | "expand" | "close"; ... }
CosClientError    extends Error { status: number }
```

These types are defined inside `@inevitable/sdk` — they do NOT import from `@inevitable/protocols`
or any other substrate package. They are structurally compatible with the API's JSON response shape.

## `apps/mcp` — MCP Manifestation

A minimal stdio-transport MCP server using a pure JSON-RPC 2.0 router (no
`@modelcontextprotocol/sdk` — zero new external deps). It exposes 4 MCP tools:

| Tool | Description |
|---|---|
| `cos_create_surface` | Create a cognitive learning surface |
| `cos_ask` | Ask a question on a surface |
| `cos_get_state` | Get the current surface state |
| `cos_expand` | Expand a block to a deeper explanation layer |

The server reads `COS_API_URL` (defaults to `http://localhost:8787`) and routes all tool calls
through `@inevitable/sdk`. **No direct imports from `packages/`.**

### Architecture law check

- `@inevitable/sdk` imports from: nothing (`globalThis.fetch` only)
- `apps/mcp` imports from: `@inevitable/sdk`, Node.js builtins only
- **Both have zero direct imports from `packages/adapters`, `packages/events`, `packages/kernel`,
  etc.** The substrate is untouched — zero changes to any `packages/` or `apps/api` file.

This is the verifiable proof of the §2 law.

## Protocol

The MCP stdio transport is newline-delimited JSON-RPC 2.0:

```
stdin  → one JSON-RPC request per line
stdout → one JSON-RPC response per line (notifications produce no response)
```

MCP methods handled: `initialize`, `notifications/initialized`, `tools/list`, `tools/call`.

## Testing

- **`@inevitable/sdk`:** unit tests with injected mock `fetch` — verifies URL construction, request
  bodies, response parsing, and `CosClientError` on failure. No real HTTP server needed.
- **`apps/mcp`:** unit tests for the `RpcRouter` (method dispatch, notifications, unknown methods)
  and `callTool` (correct SDK calls per tool name, unknown tool error).

## Verification

The §2 law holds if and only if:

1. `packages/sdk/src/` contains **zero** imports from `@inevitable/*` packages
2. `apps/mcp/src/` contains **zero** imports from `@inevitable/*` packages except `@inevitable/sdk`
3. `pnpm verify` stays green with no changes to `packages/` or `apps/api`

These checks are explicit in the test comments and verifiable by `grep "@inevitable" packages/sdk/src apps/mcp/src`.
