# ADR-0019 — Governed Tool Runtime (P4.2)

**Status:** accepted
**Date:** 2026-06-20
**Phase:** P4.2

---

## Context

The `ToolRuntime` contract (`packages/contracts`) defines `discover()` and `invoke()` for
tool-ecosystem integration. No implementation exists. P4.2 introduces `InMemoryToolRuntime` — an
in-process adapter suitable for the CLI demo and tests — with optional governance capability
checking and event emission for observability.

---

## Decisions

### D1 — InMemoryToolRuntime in packages/adapters

The implementation lives in `packages/adapters/src/tools.ts` alongside `InMemoryVectorStore` (same
adapter layer, same in-memory reference semantics pattern).

**Why:** Adapters are the reference-semantics layer. Production implementations (MCP gateway, gRPC
tool bridge) follow the same interface in separate packages.

### D2 — Registration via register(spec, handler)

Tools are registered at composition time:
```typescript
runtime.register({ name: "search-concepts", sideEffecting: false }, async (params) => {
  ...
  return ok(result);
});
```

**Why:** Dependency injection over global registries. The composition root (wiring.ts) owns the
tool inventory. No discovery call is needed in tests.

### D3 — Governance capability check: tool.<name>

When `capabilityRegistry` and `ownerCid` are provided to the constructor, every `invoke(name, ...)` checks `capabilityRegistry.has(ownerCid, 'tool.${name}')`. If the check fails, returns
`err(new CosError('E_TOOL_CAPABILITY_DENIED', ...))` before calling the handler.

**Why:** The governance immune system (GOV-P03) must gate tool access the same way it gates agent
dispatches. A capability check at `invoke` time lets operators revoke tool access without
redeploying.

### D4 — Event emission: tool.invoked and tool.completed

When an `EventBus`, `Clock`, and `IdGenerator` are provided, `invoke(name, params)` emits:
- `tool.invoked` before calling the handler (payload: `name`, `params`)
- `tool.completed` after the handler resolves (payload: `name`, `ok`, `durationMs`)

Events are published via `bus.publish()`. If the bus is absent, emission is skipped silently.

**Why:** Observability is a kernel primitive. Tool calls must be traceable in the event log for
replay, audit, and future drift-detection on tool usage.

### D5 — Demo tool: search-concepts

`apps/cli/src/wiring.ts` registers one demo tool (`search-concepts`) that queries the
`WorldStateGraph` for concept nodes matching a keyword. This proves the full governed path:
register → discover → invoke → capability check → event emission → result.

**Why:** A real tool over real substrate state (not a mock) demonstrates the integration without
adding an external dependency.

### D6 — DemoFixture exposes tools: InMemoryToolRuntime

The `DemoFixture` interface gains a `tools` field so callers and tests can inspect registered tools,
call `discover()`, and invoke tools directly.

---

## Consequences

- `packages/adapters/src/tools.ts` — `InMemoryToolRuntime` implementing `ToolRuntime`
- `packages/adapters/src/index.ts` — export `InMemoryToolRuntime`
- `packages/adapters/tests/tools.test.ts` — unit tests (register, discover, invoke, capability
  deny, event emission)
- `apps/cli/src/wiring.ts` — wire tool runtime + register demo tool + expose in `DemoFixture`
- `spec/events/event-taxonomy.md` — `tool.*` family added
- No new packages; no new external dependencies.
