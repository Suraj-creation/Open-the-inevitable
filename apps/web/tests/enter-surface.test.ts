/**
 * enterSurface (SRF-005) — the front-door command that creates/opens a cognitive surface. It must be
 * resilient to a STALE learner credential: on a free-tier host the gateway's learner registry resets
 * on spin-down, so a returning visitor's stored api_key becomes unknown. Left unhandled the client
 * re-sends the poisoned key forever and is hard-locked out with "gateway: failed to enter surface".
 * enterSurface must instead drop the rejected credential and retry once as a fresh anonymous learner.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { enterSurface } from "../src/api";

const KEY = "inevitable.learner";

/** A minimal in-memory localStorage so the credential store is real (and inspectable) in the test. */
function installStorage(seed?: Record<string, string>): Map<string, string> {
  const map = new Map<string, string>(Object.entries(seed ?? {}));
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
  });
  return map;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("enterSurface", () => {
  beforeEach(() => {
    installStorage();
  });

  test("a fresh visitor enters without an Authorization header and persists the minted credential", async () => {
    const store = installStorage();
    const calls: RequestInit[] = [];
    vi.stubGlobal("fetch", (_url: string, init: RequestInit) => {
      calls.push(init);
      return Promise.resolve(
        new Response(
          JSON.stringify({
            ok: true,
            surface_id: "srf-new",
            learner_id: "lnr-1",
            api_key: "key-1",
          }),
          { status: 201 },
        ),
      );
    });

    const id = await enterSurface("teach me transformer", "student");

    expect(id).toBe("srf-new");
    expect(calls).toHaveLength(1);
    expect((calls[0]!.headers as Record<string, string>).Authorization).toBeUndefined();
    expect(JSON.parse(store.get(KEY)!)).toEqual({ learnerId: "lnr-1", apiKey: "key-1" });
  });

  test("a returning visitor sends its stored key as a bearer token", async () => {
    installStorage({ [KEY]: JSON.stringify({ learnerId: "lnr-old", apiKey: "key-old" }) });
    const calls: RequestInit[] = [];
    vi.stubGlobal("fetch", (_url: string, init: RequestInit) => {
      calls.push(init);
      return Promise.resolve(
        new Response(JSON.stringify({ ok: true, surface_id: "srf-known" }), { status: 201 }),
      );
    });

    const id = await enterSurface("teach me transformer", "student");

    expect(id).toBe("srf-known");
    expect(calls).toHaveLength(1);
    expect((calls[0]!.headers as Record<string, string>).Authorization).toBe("Bearer key-old");
  });

  test("a stale credential rejected with 401 is dropped, then a fresh anonymous entry succeeds", async () => {
    const store = installStorage({
      [KEY]: JSON.stringify({ learnerId: "lnr-stale", apiKey: "key-stale" }),
    });
    const calls: RequestInit[] = [];
    vi.stubGlobal("fetch", (_url: string, init: RequestInit) => {
      calls.push(init);
      // First attempt carries the stale bearer → gateway no longer knows the key → 401.
      if ((init.headers as Record<string, string>).Authorization) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              ok: false,
              error: { code: "E_SURFACE_GATEWAY", message: "unknown api key" },
            }),
            { status: 401 },
          ),
        );
      }
      // Retry with no bearer → a fresh learner is minted.
      return Promise.resolve(
        new Response(
          JSON.stringify({
            ok: true,
            surface_id: "srf-healed",
            learner_id: "lnr-fresh",
            api_key: "key-fresh",
          }),
          { status: 201 },
        ),
      );
    });

    const id = await enterSurface("teach me transformer", "student");

    // The learner enters (no lockout) and the poisoned credential is replaced with the fresh one.
    expect(id).toBe("srf-healed");
    expect(calls).toHaveLength(2);
    expect((calls[0]!.headers as Record<string, string>).Authorization).toBe("Bearer key-stale");
    expect((calls[1]!.headers as Record<string, string>).Authorization).toBeUndefined();
    expect(JSON.parse(store.get(KEY)!)).toEqual({ learnerId: "lnr-fresh", apiKey: "key-fresh" });
  });

  test("a genuine failure (no stored credential) still surfaces as an error", async () => {
    installStorage();
    vi.stubGlobal("fetch", () =>
      Promise.resolve(
        new Response(JSON.stringify({ ok: false, error: { message: "boom" } }), { status: 500 }),
      ),
    );
    await expect(enterSurface("teach me transformer", "student")).rejects.toThrow(
      "gateway: failed to enter surface",
    );
  });
});
