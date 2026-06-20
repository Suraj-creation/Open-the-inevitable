import { describe, expect, test } from "vitest";
import {
  GeminiVoiceRuntime,
  NullVoiceRuntime,
  pcm16ToWav,
  type GenAiVoiceClientLike,
} from "../src/voice";

const RIFF = (bytes: Uint8Array): string => new TextDecoder().decode(bytes.slice(0, 4));

describe("pcm16ToWav", () => {
  test("wraps PCM in a 44-byte RIFF/WAVE header with correct data length", () => {
    const pcm = new Uint8Array(100);
    const wav = pcm16ToWav(pcm, 24000);
    expect(wav.byteLength).toBe(144);
    expect(RIFF(wav)).toBe("RIFF");
    expect(new TextDecoder().decode(wav.slice(8, 12))).toBe("WAVE");
    // data chunk length (little-endian uint32 at offset 40) == pcm length
    const view = new DataView(wav.buffer);
    expect(view.getUint32(40, true)).toBe(100);
    expect(view.getUint32(24, true)).toBe(24000); // sample rate
  });
});

describe("NullVoiceRuntime", () => {
  test("is deterministic: same text ⇒ identical duration and byte length, silent WAV", async () => {
    const rt = new NullVoiceRuntime();
    const a = await rt.synthesize({ text: "A perceptron weighs its inputs." });
    const b = await rt.synthesize({ text: "A perceptron weighs its inputs." });
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(a.value.durationMs).toBe(b.value.durationMs);
    expect(a.value.bytes.byteLength).toBe(b.value.bytes.byteLength);
    expect(a.value.mimeType).toBe("audio/wav");
    expect(a.value.deterministic).toBe(true);
    expect(RIFF(a.value.bytes)).toBe("RIFF");
    expect(rt.deterministic).toBe(true);
  });
});

describe("GeminiVoiceRuntime (fromClient, no SDK/network)", () => {
  function clientReturning(
    data: string | undefined,
    mime = "audio/L16;rate=24000",
  ): GenAiVoiceClientLike {
    return {
      models: {
        async generateContent() {
          return {
            candidates: [{ content: { parts: [{ inlineData: { data, mimeType: mime } }] } }],
          };
        },
      },
    };
  }

  test("decodes base64 PCM, wraps WAV, and derives duration from the sample count", async () => {
    const pcm = new Uint8Array(48000); // 24000 samples @ 24kHz, 16-bit mono ⇒ 1.0s
    const base64 = Buffer.from(pcm).toString("base64");
    const rt = GeminiVoiceRuntime.fromClient(clientReturning(base64));
    const result = await rt.synthesize({ text: "hello" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.durationMs).toBe(1000);
    expect(result.value.mimeType).toBe("audio/wav");
    expect(result.value.sampleRate).toBe(24000);
    expect(result.value.deterministic).toBe(false);
    expect(RIFF(result.value.bytes)).toBe("RIFF");
    expect(rt.provider).toBe("gemini-voice");
  });

  test("returns a typed error when the response carries no audio", async () => {
    const rt = GeminiVoiceRuntime.fromClient(clientReturning(undefined));
    const result = await rt.synthesize({ text: "hello" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("E_VOICE_EMPTY");
  });

  test("degrades to a typed error when synthesis throws", async () => {
    const rt = GeminiVoiceRuntime.fromClient({
      models: {
        async generateContent() {
          throw new Error("network down");
        },
      },
    });
    const result = await rt.synthesize({ text: "hello" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("E_VOICE_FAILED");
  });
});
