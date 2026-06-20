/**
 * §2 Law verification: this test file must NOT import from any @inevitable/* package
 * other than @inevitable/sdk. grep "@inevitable" packages/sdk/tests → only sdk import allowed.
 *
 * Substrate packages that must stay out:
 *   @inevitable/protocols, @inevitable/kernel, @inevitable/events, @inevitable/runtime,
 *   @inevitable/memory, @inevitable/orchestration, @inevitable/governance, @inevitable/surface
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CosClient, CosClientError } from "../src/index.js";

function makeFetch(status: number, body: unknown): typeof globalThis.fetch {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  }) as unknown as typeof globalThis.fetch;
}

describe("CosClient (§2 law: zero substrate imports)", () => {
  let client: CosClient;

  beforeEach(() => {
    client = new CosClient({ baseUrl: "http://cos.test", fetch: makeFetch(200, {}) });
  });

  describe("createSurface", () => {
    it("posts to /api/surface and maps camelCase fields", async () => {
      const fetch = makeFetch(200, { surface_id: "s1", learner_id: "l1", goal: "gravity" });
      client = new CosClient({ baseUrl: "http://cos.test", fetch });
      const surface = await client.createSurface({ goal: "gravity" });
      expect(surface).toEqual({ surfaceId: "s1", learnerId: "l1", goal: "gravity" });
      const call = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
      expect(call[0]).toBe("http://cos.test/api/surface");
      expect(call[1].method).toBe("POST");
    });

    it("throws CosClientError on 4xx", async () => {
      client = new CosClient({
        baseUrl: "http://cos.test",
        fetch: makeFetch(403, { error: { message: "forbidden" } }),
      });
      await expect(client.createSurface()).rejects.toThrow(CosClientError);
    });

    it("strips trailing slash from baseUrl", async () => {
      const fetch = makeFetch(200, { surface_id: "s2", learner_id: "l2", goal: "" });
      client = new CosClient({ baseUrl: "http://cos.test/", fetch });
      await client.createSurface();
      const call = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
      expect(call[0]).toBe("http://cos.test/api/surface");
    });
  });

  describe("ask", () => {
    it("sends type:ask command and returns block count", async () => {
      const fetch = makeFetch(200, { ok: true, blocks: 3 });
      client = new CosClient({ baseUrl: "http://cos.test", fetch });
      const result = await client.ask("s1", "what is gravity");
      expect(result).toEqual({ blocks: 3 });
      const call = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
      expect(call[0]).toContain("/api/surface/s1/command");
      expect(JSON.parse(call[1].body as string)).toMatchObject({
        type: "ask",
        goal: "what is gravity",
      });
    });
  });

  describe("expand", () => {
    it("sends type:expand and returns block_id + version", async () => {
      const fetch = makeFetch(200, { ok: true, block_id: "b1", version: 2 });
      client = new CosClient({ baseUrl: "http://cos.test", fetch });
      const result = await client.expand("s1", "b1", 2);
      expect(result).toEqual({ block_id: "b1", version: 2 });
    });
  });

  describe("close", () => {
    it("sends type:close command", async () => {
      const fetch = makeFetch(200, { ok: true });
      client = new CosClient({ baseUrl: "http://cos.test", fetch });
      await expect(client.close("s1", "done")).resolves.toBeUndefined();
      const call = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
      expect(JSON.parse(call[1].body as string)).toMatchObject({ type: "close", reason: "done" });
    });
  });

  describe("getState", () => {
    it("returns parsed state object", async () => {
      const fetch = makeFetch(200, { state: { blocks: [] } });
      client = new CosClient({ baseUrl: "http://cos.test", fetch });
      const state = await client.getState("s1");
      expect(state).toEqual({ blocks: [] });
    });

    it("throws CosClientError on 404", async () => {
      client = new CosClient({
        baseUrl: "http://cos.test",
        fetch: makeFetch(404, {}),
      });
      await expect(client.getState("missing")).rejects.toThrow(CosClientError);
    });
  });

  describe("getLearner", () => {
    it("maps snake_case to camelCase", async () => {
      const fetch = makeFetch(200, {
        learner: { learner_id: "l1", cid: "cid1", trust_level: 80 },
        surfaces: ["s1", "s2"],
      });
      client = new CosClient({ baseUrl: "http://cos.test", fetch });
      const learner = await client.getLearner("l1");
      expect(learner).toEqual({
        learnerId: "l1",
        cid: "cid1",
        trustLevel: 80,
        surfaces: ["s1", "s2"],
      });
    });
  });
});
