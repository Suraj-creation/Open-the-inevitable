/**
 * Model runtime adapters — D3 recording seam (spec/protocols/model-invocation-protocol.md).
 * All tests are deterministic: no network, no provider SDK installed (that absence is itself
 * a tested contract).
 */
import { describe, expect, test } from "vitest";
import type {
  ModelGenerationRequest,
  ModelGenerationResult,
  ModelRuntime,
  ModelStreamChunk,
} from "@inevitable/contracts";
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

describe("RecordingModelRuntime — embeddings (ADR-0065, replay-safe)", () => {
  test("record → replay reproduces the exact vector and never re-invokes the provider", async () => {
    let innerEmbeds = 0;
    const inner: ModelRuntime = {
      async generate() {
        return { text: "{}", model: "stub" };
      },
      async embed(text) {
        innerEmbeds++;
        // A deterministic but text-dependent vector so a wrong lookup would be caught.
        return [text.length, text.charCodeAt(0) ?? 0, 0.5];
      },
    };
    const { bus, runtime: recorder } = harness("record", inner);
    const vEntropy = await recorder.embed("entropy");
    const vBoltzmann = await recorder.embed("boltzmann");
    expect(innerEmbeds).toBe(2);

    // Replay from the same bus log — the provider must never be touched.
    const spy: ModelRuntime = {
      async generate() {
        throw new Error("replay must not generate");
      },
      async embed() {
        throw new Error("replay must never invoke the embedding provider");
      },
    };
    const replayer = new RecordingModelRuntime({ mode: "replay", bus, inner: spy });
    // Keyed by text (embedding is a pure function), so order is irrelevant on replay.
    expect(await replayer.embed("boltzmann")).toEqual(vBoltzmann);
    expect(await replayer.embed("entropy")).toEqual(vEntropy);
    expect(innerEmbeds).toBe(2); // provider untouched during replay
  });

  test("record-before-use: model.embedding.recorded is published before embed() returns", async () => {
    const order: string[] = [];
    const inner: ModelRuntime = {
      async generate() {
        return { text: "{}", model: "stub" };
      },
      async embed() {
        order.push("inner-embed");
        return [1, 2, 3];
      },
    };
    const { bus, runtime } = harness("record", inner);
    bus.subscribe("model.>", () => {
      order.push("recorded-event");
    });
    await runtime.embed("x");
    expect(order).toEqual(["inner-embed", "recorded-event"]);
  });

  test("a missing embedding record fails closed with E_MODEL_REPLAY_MISS", async () => {
    const { runtime } = harness("replay");
    await expect(runtime.embed("never-embedded")).rejects.toMatchObject({
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
        async embedContent() {
          return { embeddings: [{ values: [0.1, 0.2] }] };
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

  test("webSearch attaches the search tool (not responseSchema) and returns real citations", async () => {
    const calls: Array<Record<string, unknown>> = [];
    const fake: GenAiClientLike = {
      models: {
        async generateContent(args) {
          calls.push(args as unknown as Record<string, unknown>);
          return {
            text: "Recent work explores second-order methods.",
            candidates: [
              {
                finishReason: "STOP",
                groundingMetadata: {
                  groundingChunks: [
                    { web: { uri: "https://arxiv.org/abs/2401.00001", title: "A Survey" } },
                    { web: { uri: "https://arxiv.org/abs/2401.00001", title: "dup — dropped" } },
                    { web: { title: "no uri — dropped" } },
                  ],
                },
              },
            ],
          };
        },
        async embedContent() {
          return { embeddings: [{ values: [0.1] }] };
        },
      },
    };
    const runtime = GeminiModelRuntime.fromClient(fake, "gemini-test");
    const result = await runtime.generate({
      prompt: "frontier of gradient descent",
      webSearch: true,
      responseSchema: { type: "object" }, // ignored under webSearch (mutually exclusive)
    });
    const config = calls[0]?.["config"] as Record<string, unknown>;
    expect(config["tools"]).toEqual([{ googleSearch: {} }]);
    expect(config["responseMimeType"]).toBeUndefined(); // schema not sent with grounding
    expect(result.citations).toEqual([
      { uri: "https://arxiv.org/abs/2401.00001", title: "A Survey" },
    ]); // deduped by uri; entries without a uri dropped
  });

  test("citations round-trip through record → replay (D3 time-honesty)", async () => {
    const inner: ModelRuntime = {
      async generate() {
        return {
          text: "grounded",
          model: "stub",
          citations: [{ uri: "https://example.org/x", title: "X" }],
        };
      },
      async embed() {
        return [];
      },
    };
    const { bus, runtime: recorder } = harness("record", inner);
    const recorded = await recorder.generate(request("frontier:k"));
    expect(recorded.citations).toEqual([{ uri: "https://example.org/x", title: "X" }]);
    const replayer = new RecordingModelRuntime({ mode: "replay", bus });
    const replayed = await replayer.generate(request("frontier:k"));
    expect(replayed.citations).toEqual([{ uri: "https://example.org/x", title: "X" }]);
  });
});

// ---------------------------------------------------------------------------
// Live token streaming (ADR-0063 Phase B)
// ---------------------------------------------------------------------------

async function drain(
  stream: AsyncIterable<ModelStreamChunk>,
): Promise<{ deltas: string[]; text: string; final: ModelGenerationResult | undefined }> {
  const deltas: string[] = [];
  let final: ModelGenerationResult | undefined;
  for await (const chunk of stream) {
    if (chunk.textDelta) deltas.push(chunk.textDelta);
    if (chunk.result) final = chunk.result;
  }
  return { deltas, text: deltas.join(""), final };
}

/** An async iterable of Gemini-shaped response chunks; the last carries finishReason + usage. */
function geminiChunks(pieces: string[]): AsyncIterable<{
  text?: string;
  candidates?: Array<{ finishReason?: string }>;
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
}> {
  return {
    async *[Symbol.asyncIterator]() {
      for (let i = 0; i < pieces.length; i++) {
        const last = i === pieces.length - 1;
        yield {
          text: pieces[i]!,
          ...(last
            ? {
                candidates: [{ finishReason: "STOP" }],
                usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 9 },
              }
            : {}),
        };
      }
    },
  };
}

describe("GeminiModelRuntime.generateStream", () => {
  test("yields ordered text deltas then a terminal result whose text is the concatenation", async () => {
    const pieces = ['{"mccr":{"core', '_concept":"Ent', 'ropy"}}'];
    const fake: GenAiClientLike = {
      models: {
        async generateContent() {
          return { text: pieces.join(""), candidates: [{ finishReason: "STOP" }] };
        },
        generateContentStream() {
          return Promise.resolve(geminiChunks(pieces));
        },
        async embedContent() {
          return { embeddings: [{ values: [0.1] }] };
        },
      },
    };
    const runtime = GeminiModelRuntime.fromClient(fake, "gemini-test");
    const { deltas, text, final } = await drain(runtime.generateStream({ prompt: "p" }));
    expect(deltas).toEqual(pieces); // ordered, incremental
    expect(text).toBe('{"mccr":{"core_concept":"Entropy"}}');
    expect(final?.text).toBe(text); // terminal result equals what generate() would return
    expect(final?.model).toBe("gemini-test");
    expect(final?.finishReason).toBe("stop");
    expect(final?.usage).toEqual({ inputTokens: 5, outputTokens: 9 });
  });

  test("throws E_MODEL_STREAM_UNSUPPORTED when the client cannot stream (caller falls back)", async () => {
    const fake: GenAiClientLike = {
      models: {
        async generateContent() {
          return { text: "whole" };
        },
        async embedContent() {
          return { embeddings: [{ values: [0.1] }] };
        },
      },
    };
    const runtime = GeminiModelRuntime.fromClient(fake, "gemini-test");
    await expect(drain(runtime.generateStream({ prompt: "p" }))).rejects.toMatchObject({
      code: "E_MODEL_STREAM_UNSUPPORTED",
    });
  });
});

describe("RecordingModelRuntime.generateStream", () => {
  test("record mode tees inner deltas, records the whole result, and replay (via generate) resolves it", async () => {
    const pieces = ['{"a":', "1}"];
    const inner: ModelRuntime = {
      async generate() {
        return { text: pieces.join(""), model: "stub", finishReason: "stop" };
      },
      async embed() {
        return [];
      },
      generateStream(_input) {
        return {
          async *[Symbol.asyncIterator]() {
            for (const p of pieces) yield { textDelta: p };
            yield {
              textDelta: "",
              result: { text: pieces.join(""), model: "stub", finishReason: "stop" },
            };
          },
        };
      },
    };
    const { bus, runtime: recorder } = harness("record", inner);
    const { deltas, text, final } = await drain(recorder.generateStream(request("stream:k")));
    expect(deltas).toEqual(pieces);
    expect(final?.text).toBe(text);
    // The whole output was recorded (record-before-use), so a flag-off replay via generate() finds it.
    const recorded = bus
      .replay({ subject: "model.>" })
      .filter((e) => e.event_type === "model.output.recorded");
    expect(recorded).toHaveLength(1);
    const replayer = new RecordingModelRuntime({ mode: "replay", bus });
    const replayed = await replayer.generate(request("stream:k"));
    expect(replayed.text).toBe(text);
  });

  test("replay mode yields a single terminal chunk from the record (no intermediate deltas)", async () => {
    const inner: ModelRuntime = {
      async generate() {
        return { text: '{"x":1}', model: "stub", finishReason: "stop" };
      },
      async embed() {
        return [];
      },
    };
    const { bus, runtime: recorder } = harness("record", inner);
    await recorder.generate(request("replaystream:k")); // records ordinal 0
    const replayer = new RecordingModelRuntime({ mode: "replay", bus });
    const { deltas, final } = await drain(replayer.generateStream(request("replaystream:k")));
    expect(deltas).toEqual([]); // deterministic: no live deltas on replay
    expect(final?.text).toBe('{"x":1}');
  });

  test("non-streaming inner degrades to a single whole result (no deltas) and still records", async () => {
    const inner: ModelRuntime = {
      async generate() {
        return { text: "whole-output", model: "stub", finishReason: "stop" };
      },
      async embed() {
        return [];
      },
    };
    const { bus, runtime: recorder } = harness("record", inner);
    const { deltas, final } = await drain(recorder.generateStream(request("nostream:k")));
    expect(deltas).toEqual([]);
    expect(final?.text).toBe("whole-output");
    const recorded = bus
      .replay({ subject: "model.>" })
      .filter((e) => e.event_type === "model.output.recorded");
    expect(recorded).toHaveLength(1);
  });
});
