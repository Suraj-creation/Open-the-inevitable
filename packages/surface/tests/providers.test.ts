import { describe, expect, test } from "vitest";
import { ManualClock } from "@inevitable/shared";
import {
  NullMultimodalProvider,
  ProviderRegistry,
  type ImageGenerationProvider,
  type MediaRequest,
} from "../src/providers";

function request(id = "req-001"): MediaRequest {
  return {
    request_id: id,
    surface_id: "srf-prov",
    block_id: "blk-prov",
    prompt: "A diagram of a perceptron",
    concept_ids: ["perceptron"],
  };
}

describe("ProviderRegistry", () => {
  test("registers a provider for all its declared modalities", () => {
    const registry = new ProviderRegistry();
    const provider = new NullMultimodalProvider(new ManualClock(0));

    const registered = registry.register(provider);
    expect(registered.ok).toBe(true);
    expect([...registry.registered()].sort()).toEqual([
      "image",
      "live",
      "multimodal",
      "video",
      "voice",
    ]);
    expect(registry.get("image").ok).toBe(true);
  });

  test("missing modality yields a typed error, never a crash", () => {
    const registry = new ProviderRegistry();
    const result = registry.get("video");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("E_SURFACE_PROVIDER");
      expect(result.error.message).toMatch(/no provider registered/i);
    }
  });
});

describe("NullMultimodalProvider — deterministic Phase 2A reference", () => {
  test("declares itself deterministic", () => {
    const provider = new NullMultimodalProvider(new ManualClock(0));
    const descriptor = provider.describe();
    expect(descriptor.provider_id).toBe("null");
    expect(descriptor.deterministic).toBe(true);
  });

  test("same request produces an identical artifact (replay-exact)", async () => {
    const clock = new ManualClock(Date.UTC(2026, 5, 11));
    const provider = new NullMultimodalProvider(clock);

    const a = await provider.generateImage(request());
    const b = await provider.generateImage(request());
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) expect(a.value).toEqual(b.value);
  });

  test("artifact carries provenance and a reference, never inline binary", async () => {
    const provider = new NullMultimodalProvider(new ManualClock(0));
    const result = await provider.generateImage(request("req-42"));
    expect(result.ok).toBe(true);
    if (!result.ok) throw result.error;

    expect(result.value.content_ref).toBe("null://image/req-42");
    expect(result.value.provider_id).toBe("null");
    expect(result.value.provenance.prompt).toBe("A diagram of a perceptron");
  });

  test("live session handle opens, sends, and closes", async () => {
    const provider = new NullMultimodalProvider(new ManualClock(0));
    const opened = await provider.open(request("req-live"));
    expect(opened.ok).toBe(true);
    if (!opened.ok) throw opened.error;

    expect(opened.value.session_ref).toBe("null://live/req-live");
    const sent = await opened.value.send({ utterance: "hello" });
    expect(sent.ok).toBe(true);
    await opened.value.close();
  });

  test("registry consumers can use the provider through the interface type", async () => {
    const registry = new ProviderRegistry();
    registry.register(new NullMultimodalProvider(new ManualClock(0)));

    const provider = registry.get("image");
    expect(provider.ok).toBe(true);
    if (!provider.ok) throw provider.error;
    const image = await (provider.value as ImageGenerationProvider).generateImage(request());
    expect(image.ok).toBe(true);
  });
});
