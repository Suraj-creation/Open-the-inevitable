import { afterEach, beforeAll, describe, expect, test } from "vitest";
import { type AddressInfo } from "node:net";
import { type Server } from "node:http";
import { NullVoiceRuntime } from "@inevitable/adapters";
import { SurfaceHost } from "../src/host";
import { createGatewayServer } from "../src/server";

// Hermetic + deterministic: inject the Null voice runtime (no Gemini, no network).
beforeAll(() => {
  delete process.env["GEMINI_API_KEY"];
});

let active: Server | null = null;
afterEach(async () => {
  if (active) await new Promise<void>((resolve) => active!.close(() => resolve()));
  active = null;
});

function start(): Promise<string> {
  const server = createGatewayServer(new SurfaceHost({ voiceRuntime: new NullVoiceRuntime() }));
  active = server;
  return new Promise((resolve) => {
    server.listen(0, () => resolve(`http://127.0.0.1:${(server.address() as AddressInfo).port}`));
  });
}

interface NarrationState {
  state: {
    narration: {
      text: string;
      voice: {
        artifact_id: string;
        content_ref: string;
        duration_ms: number;
        provider_id: string;
      } | null;
    }[];
  };
}

describe("Surface Gateway — narration voice + out-of-band media (Phase 2D-S4)", () => {
  test("narration segments carry a voice reference, and the media route serves the audio bytes", async () => {
    const base = await start();
    const create = await fetch(`${base}/api/surface`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goal: "Teach me Neural Networks", seed: "voice-test" }),
    });
    const { surface_id } = (await create.json()) as { surface_id: string };

    const asked = await fetch(`${base}/api/surface/${surface_id}/command`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "ask", goal: "Teach me Neural Networks" }),
    });
    expect(asked.status).toBe(200);

    const stateRes = await fetch(`${base}/api/surface/${surface_id}/state`);
    const { state } = (await stateRes.json()) as NarrationState;
    expect(state.narration.length).toBeGreaterThan(0);

    const voiced = state.narration.find((s) => s.voice !== null);
    expect(voiced).toBeDefined();
    expect(voiced!.voice!.provider_id).toBe("null-voice");
    expect(voiced!.voice!.duration_ms).toBeGreaterThan(0);
    expect(voiced!.voice!.content_ref).toContain(`/api/surface/${surface_id}/media/`);

    // The audio is served out-of-band, never on the SSE stream.
    const audio = await fetch(`${base}${voiced!.voice!.content_ref}`);
    expect(audio.status).toBe(200);
    expect(audio.headers.get("content-type")).toBe("audio/wav");
    const bytes = new Uint8Array(await audio.arrayBuffer());
    expect(new TextDecoder().decode(bytes.slice(0, 4))).toBe("RIFF");
  });

  test("a missing media artifact returns 404", async () => {
    const base = await start();
    const create = await fetch(`${base}/api/surface`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goal: "x", seed: "voice-404" }),
    });
    const { surface_id } = (await create.json()) as { surface_id: string };
    const res = await fetch(`${base}/api/surface/${surface_id}/media/art-voice-nope`);
    expect(res.status).toBe(404);
  });
});
