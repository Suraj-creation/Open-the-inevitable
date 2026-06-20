/**
 * Model runtime adapters — D3 recording seam (spec/protocols/model-invocation-protocol.md).
 * All tests are deterministic: no network, no provider SDK installed (that absence is itself
 * a tested contract).
 */
import { describe, expect, test } from "vitest";
import type { ModelGenerationRequest, ModelRuntime } from "@inevitable/contracts";
import { InMemoryEventBus } from "@inevitable/events";
import { CosError, ManualClock, SeededIdGenerator } from "@inevitable/shared";
import {
  GeminiModelRuntime,
  NullModelRuntime,
  RecordingModelRuntime,
  type GenAiClientLike,
} from "../src/model";

function request(key = "agent.explanation:cp-001:explanation"): ModelGenerationRequest {
  return {
    prompt: "Intent: Explain gradient descent",
    system: "You are the explanation agent.",
    invocation_key: key,
  };
}

function harness(mode: "record" | "replay", inner?: ModelRuntime, recordings?: never) {
  const clock = new ManualClock(Date.UTC(2026, 5, 12));
  const idGenerator = new SeededIdGenerator("model-test");
  const bus = new InMemoryEventBus({ idGenerator });
  const runtime = new RecordingModelRuntime({
    mode,
    bus,
    inner,
    recordings,
    provider: "test",
    clock,
    idGenerator,
  });
  return { bus, runtime };
}

describe("NullModelRuntime", () => {
  test("output is a pure function of the request (replay-exact)", async () => {
    const model = new NullModelRuntime();
    const a = await model.generate(request());
    const b = await model.generate(request());
    expect(a).toEqual(b);
    expect(a.finishReason).toBe("stop");
    const parsed = JSON.parse(a.text) as { layers: { layer_0: string } };
    expect(parsed.layers.layer_0).toContain("Explain gradient descent");
  });
});

describe("RecordingModelRuntime — record mode", () => {
  test("publishes model.output.recorded BEFORE the result is returned", async () => {
    const order: string[] = [];
    const inner: ModelRuntime = {
      async generate(input) {
        order.push("inner-generate");
        return { text: `{"echo":"${input.invocation_key}"}`, model: "stub" };
      },
      async embed() {
        return [];
      },
    };
    const { bus, runtime } = harness("record", inner);
    bus.subscribe("model.>", () => {
      order.push("recorded-event");
    });

    const result = await runtime.generate(request());
    order.push("result-available");

    expect(order).toEqual(["inner-generate", "recorded-event", "result-available"]);
    expect(result.model).toBe("stub");
    const recorded = bus.replay({ subject: "model.>" });
    expect(recorded).toHaveLength(1);
    const payload = recorded[0]?.payload as Record<string, unknown>;
    expect(payload["invocation_key"]).toBe("agent.explanation:cp-001:explanation");
    expect(payload["ordinal"]).toBe(0);
    expect(payload["format_version"]).toBe("1.0.0");
  });

  test("repeated calls under the same key get increasing ordinals", async () => {
    const inner: ModelRuntime = {
      async generate() {
        return { text: "{}", model: "stub" };
      },
      async embed() {
        return [];
      },
    };
    const { bus, runtime } = harness("record", inner);
    await runtime.generate(request("k1"));
    await runtime.generate(request("k1"));
    const ordinals = bus
      .replay({ subject: "model.>" })
      .map((e) => (e.payload as Record<string, unknown>)["ordinal"]);
    expect(ordinals).toEqual([0, 1]);
  });

  test("inner failure publishes model.invocation.failed and rethrows", async () => {
    const inner: ModelRuntime = {
      async generate() {
        throw new CosError("E_MODEL_TIMEOUT", "too slow");
      },
      async embed() {
        return [];
      },
    };
    const { bus, runtime } = harness("record", inner);
    await expect(runtime.generate(request())).rejects.toMatchObject({ code: "E_MODEL_TIMEOUT" });
    const failures = bus.replay({ subject: "model.invocation.failed" });
    expect(failures).toHaveLength(1);
    expect((failures[0]?.payload as Record<string, unknown>)["error_code"]).toBe("E_MODEL_TIMEOUT");
  });
});

describe("RecordingModelRuntime — replay mode", () => {
  test("resolves from the record and NEVER invokes the inner provider", async () => {
    let innerCalls = 0;
    const inner: ModelRuntime = {
      async generate() {
        innerCalls++;
        return { text: '{"live":true}', model: "stub" };
      },
      async embed() {
        return [];
      },
    };
    // Record two outputs under one key.
    const { bus, runtime: recorder } = harness("record", inner);
    const first = await recorder.generate(request("k"));
    await recorder.generate(request("k"));
    expect(innerCalls).toBe(2);

    // Replay from the same bus log.
    const spy: ModelRuntime = {
      async generate() {
        throw new Error("replay must never invoke the provider");
      },
      async embed() {
        return [];
      },
    };
    const replayer = new RecordingModelRuntime({ mode: "replay", bus, inner: spy });
    const replayedFirst = await replayer.generate(request("k"));
    const replayedSecond = await replayer.generate(request("k"));
    expect(replayedFirst.text).toBe(first.text);
    expect(replayedSecond).not.toBeNull();
    expect(innerCalls).toBe(2); // unchanged — provider untouched during replay
  });

  test("a missing record fails closed with E_MODEL_REPLAY_MISS", async () => {
    const { runtime } = harness("replay");
    await expect(runtime.generate(request("never-recorded"))).rejects.toMatchObject({
      code: "E_MODEL_REPLAY_MISS",
    });
  });
});

describe("GeminiModelRuntime", () => {
  test("connect() resolves a client via the guarded import (SDK provisioned), never throws", async () => {
    // @google/genai is edge-provisioned at the workspace root (ADR-0005). The guarded dynamic
    // import resolves it and connect() returns a typed Result with a runtime — no network call
    // happens until generate(). If the SDK were absent, requireOptional would instead yield a
    // typed E_ADAPTER_UNAVAILABLE (a typed Result, never a throw).
    const result = await GeminiModelRuntime.connect({ apiKey: "test-key" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBeInstanceOf(GeminiModelRuntime);
  });

  test("connect() without an API key yields E_MODEL_UNAVAILABLE", async () => {
    const result = await GeminiModelRuntime.connect({ apiKey: "" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("E_MODEL_UNAVAILABLE");
  });

  test("fromClient maps request fields and finish reasons (no SDK, no network)", async () => {
    const calls: Array<Record<string, unknown>> = [];
    const fake: GenAiClientLike = {
      models: {
        async generateContent(args) {
          calls.push(args as unknown as Record<string, unknown>);
          return {
            text: '{"layers":{"layer_0":"x"}}',
            candidates: [{ finishReason: "MAX_TOKENS" }],
            usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 20 },
          };
        },
      },
    };
    const runtime = GeminiModelRuntime.fromClient(fake, "gemini-test");
    const result = await runtime.generate({
      prompt: "p",
      system: "s",
      maxTokens: 64,
      temperature: 0.2,
      responseSchema: { type: "object" },
    });
    expect(result.model).toBe("gemini-test");
    expect(result.finishReason).toBe("max_tokens");
    expect(result.usage).toEqual({ inputTokens: 10, outputTokens: 20 });
    const config = calls[0]?.["config"] as Record<string, unknown>;
    expect(config["systemInstruction"]).toBe("s");
    expect(config["maxOutputTokens"]).toBe(64);
    expect(config["responseMimeType"]).toBe("application/json");
  });
});
