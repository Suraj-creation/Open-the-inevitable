# ADR-0022 — Platform SDK and MCP Manifestation

**Status:** Accepted  
**Date:** 2026-06-20  
**Spec:** `spec/cognitive-developer-platform/SDK-001-platform-sdk.md`  
**Replaces:** n/a  
**Related:** ADR-0006 (surface gateway transport; WebSocket explicitly deferred), ADR-0005
(guarded optional deps), §2 (substrate-independence law)

## Context

P7 hardens the §2 substrate-independence law by proving it with a real second manifestation.
The law requires that manifestations depend on the substrate via a stable public surface, not via
internal package imports. Five design decisions lock the architecture.

---

## D1: `@inevitable/sdk` has zero workspace dependencies

**Decision:** `packages/sdk/package.json` lists no `@inevitable/*` dependencies. The SDK is a
pure HTTP client using native `fetch` only. SDK types are defined inline.

**Rationale:** If the SDK imported even one substrate package (e.g. `@inevitable/protocols` for
types), the boundary would be porous — updating that package could break the SDK. A zero-dep SDK
makes the law mechanically verifiable: `grep "@inevitable" packages/sdk/src` must return empty.

Alternative considered: import types from `@inevitable/protocols` (the "contract" layer). Rejected
because the JSON Schema types in `@inevitable/protocols` describe the internal protocol, not the
HTTP response shape; structural divergence would be silent. Defining SDK types inline is an extra
10 lines and a permanent, verifiable guarantee.

---

## D2: Injectable `fetch` for unit testing (no HTTP server needed in tests)

**Decision:** `CosClient` accepts an optional `fetch?: typeof globalThis.fetch` in its constructor
options. Tests inject a mock implementation.

**Rationale:** Starting a real `apps/api` server in CI for SDK unit tests introduces flakiness
(port conflicts, startup latency, ordering). The injected `fetch` pattern gives full branch
coverage without external processes. Integration tests (confirm end-to-end against a live gateway)
are deferred to a manual/CI step and noted in `IMPLEMENTATION.md`.

---

## D3: `apps/mcp` uses a pure JSON-RPC 2.0 router (no `@modelcontextprotocol/sdk` external dep)

**Decision:** `apps/mcp` implements its own minimal stdio JSON-RPC 2.0 router (~60 lines). The
`@modelcontextprotocol/sdk` is NOT added as a new external dependency.

**Rationale:**
1. Adding `@modelcontextprotocol/sdk` introduces a new external dep that requires ongoing version
   management. The MCP wire format is simple (newline-delimited JSON-RPC 2.0); implementing the
   handful of methods needed (`initialize`, `tools/list`, `tools/call`) takes ~60 lines.
2. Keeps the proof of the §2 law self-contained — the implementation language is the only dep.
3. If the project later needs the full MCP SDK (stdio + WebSocket + auth + OAuth), it can be
   adopted then; the inline implementation is a thin layer easily swapped.

The inline implementation IS compliant MCP: it speaks the same wire protocol, handles
notifications correctly (no response for `id: null`), and returns the same JSON shapes as the full
SDK would.

---

## D4: MCP server reads `COS_API_URL` env var; defaults to `http://localhost:8787`

**Decision:** `apps/mcp` is configured entirely via environment variable. No flags, no config file.

**Rationale:** Simplest operator contract; consistent with `apps/api`'s `COS_PERSIST_DIR` and
`apps/cli`'s `GEMINI_API_KEY` pattern. Deployers set `COS_API_URL` to point at the live gateway.
Multiple MCP clients can target different gateway instances by varying the env var.

---

## D5: SDK law verification is explicit in test comments

**Decision:** Both `packages/sdk/tests/client.test.ts` and `apps/mcp/tests/rpc.test.ts` include a
comment block listing what substrate packages they must NOT import, and the `describe` block
heading names it explicitly. This makes drift visible in code review.

**Rationale:** The §2 law is only as strong as its enforcement. Making the constraint explicit in
tests (rather than relying on a separate lint rule) is lightweight, always-present, and visible to
any reader. A future lint rule (e.g. ESLint import restriction) can automate this; the comment
establishes intent until then.
