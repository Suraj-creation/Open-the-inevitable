/**
 * InMemoryToolRuntime — governed tool runtime with capability checks and observability.
 * Spec: ADR-0019, packages/contracts/src/index.ts (ToolRuntime contract).
 */
import { describe, expect, test } from "vitest";
import { InMemoryEventBus } from "@inevitable/events";
import { ManualClock, SeededIdGenerator, ok, err, CosError } from "@inevitable/shared";
import { InMemoryToolRuntime } from "../src/tools";

function makeRuntime(opts: ConstructorParameters<typeof InMemoryToolRuntime>[0] = {}) {
  const clock = new ManualClock(Date.UTC(2026, 5, 11));
  const idGenerator = new SeededIdGenerator("tools-test");
  return new InMemoryToolRuntime({ clock, idGenerator, ...opts });
}

describe("InMemoryToolRuntime.discover", () => {
  test("returns empty array when nothing registered", async () => {
    const rt = makeRuntime();
    const tools = await rt.discover();
    expect(tools).toHaveLength(0);
  });

  test("returns registered tool specs", async () => {
    const rt = makeRuntime();
    rt.register({ name: "search-concepts", sideEffecting: false }, async () => ok("result"));
    rt.register({ name: "write-note", sideEffecting: true }, async () => ok(null));
    const tools = await rt.discover();
    expect(tools).toHaveLength(2);
    const names = tools.map((t) => t.name);
    expect(names).toContain("search-concepts");
    expect(names).toContain("write-note");
    const sideEffecting = tools.find((t) => t.name === "write-note");
    expect(sideEffecting?.sideEffecting).toBe(true);
  });
});

describe("InMemoryToolRuntime.invoke", () => {
  test("returns err when tool is not registered", async () => {
    const rt = makeRuntime();
    const result = await rt.invoke("unknown-tool", {});
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.code).toBe("E_TOOL_NOT_FOUND");
  });

  test("invokes the registered handler and returns its result", async () => {
    const rt = makeRuntime();
    rt.register({ name: "echo", sideEffecting: false }, async (params) => ok(params["text"]));
    const result = await rt.invoke("echo", { text: "hello" });
    expect(result.ok).toBe(true);
    expect(result.ok && result.value).toBe("hello");
  });

  test("propagates handler err result", async () => {
    const rt = makeRuntime();
    rt.register({ name: "fail-tool", sideEffecting: false }, async () =>
      err(new CosError("E_TOOL_FAIL", "intentional failure", {})),
    );
    const result = await rt.invoke("fail-tool", {});
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.code).toBe("E_TOOL_FAIL");
  });

  test("catches handler throws and returns err", async () => {
    const rt = makeRuntime();
    rt.register({ name: "throw-tool", sideEffecting: false }, async () => {
      throw new Error("boom");
    });
    const result = await rt.invoke("throw-tool", {});
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.code).toBe("E_TOOL_HANDLER_THROWN");
  });
});

describe("InMemoryToolRuntime — capability check", () => {
  test("denies invocation when capability is not granted", async () => {
    const rt = makeRuntime({
      checkCapability: () => false,
      ownerCid: "cog-learner",
    });
    rt.register({ name: "search-concepts", sideEffecting: false }, async () => ok("ok"));
    const result = await rt.invoke("search-concepts", {});
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.code).toBe("E_TOOL_CAPABILITY_DENIED");
  });

  test("allows invocation when capability is granted", async () => {
    const rt = makeRuntime({
      checkCapability: (cid, cap) => cid === "cog-learner" && cap === "tool.search-concepts",
      ownerCid: "cog-learner",
    });
    rt.register({ name: "search-concepts", sideEffecting: false }, async () => ok("result"));
    const result = await rt.invoke("search-concepts", {});
    expect(result.ok).toBe(true);
  });

  test("invokes without check when checkCapability is absent", async () => {
    const rt = makeRuntime({ ownerCid: "cog-learner" });
    rt.register({ name: "no-check-tool", sideEffecting: false }, async () => ok("pass"));
    const result = await rt.invoke("no-check-tool", {});
    expect(result.ok).toBe(true);
  });
});

describe("InMemoryToolRuntime — event emission", () => {
  test("emits tool.invoked and tool.completed on success", async () => {
    const bus = new InMemoryEventBus({ idGenerator: new SeededIdGenerator("emit-test") });
    const rt = makeRuntime({ bus, ownerCid: "cog-learner" });
    rt.register({ name: "echo", sideEffecting: false }, async (p) => ok(p));
    await rt.invoke("echo", { x: 1 });

    const events = bus.replay({});
    const types = events.map((e) => e.event_type);
    expect(types).toContain("tool.invoked");
    expect(types).toContain("tool.completed");
  });

  test("tool.completed carries ok=true on success", async () => {
    const bus = new InMemoryEventBus({ idGenerator: new SeededIdGenerator("emit-ok") });
    const rt = makeRuntime({ bus, ownerCid: "cog-learner" });
    rt.register({ name: "t", sideEffecting: false }, async () => ok("result"));
    await rt.invoke("t", {});

    const events = bus.replay({});
    const completed = events.find((e) => e.event_type === "tool.completed");
    expect((completed?.payload as Record<string, unknown>)?.["ok"]).toBe(true);
  });

  test("tool.completed carries ok=false on handler failure", async () => {
    const bus = new InMemoryEventBus({ idGenerator: new SeededIdGenerator("emit-fail") });
    const rt = makeRuntime({ bus, ownerCid: "cog-learner" });
    rt.register({ name: "t", sideEffecting: false }, async () =>
      err(new CosError("E_X", "fail", {})),
    );
    await rt.invoke("t", {});

    const events = bus.replay({});
    const completed = events.find((e) => e.event_type === "tool.completed");
    expect((completed?.payload as Record<string, unknown>)?.["ok"]).toBe(false);
  });

  test("no events emitted when bus is absent", async () => {
    const rt = makeRuntime();
    rt.register({ name: "t", sideEffecting: false }, async () => ok("v"));
    await expect(rt.invoke("t", {})).resolves.toMatchObject({ ok: true });
  });
});
