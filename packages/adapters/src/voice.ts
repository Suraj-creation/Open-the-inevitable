/**
 * Voice runtime adapters — synthesized narration for the Cognitive Surface (Phase 2D-S4).
 *
 * - `NullVoiceRuntime` — deterministic reference: a silent WAV whose duration is a pure function of
 *   the text, so tests and replay are exact (no network, no vendor).
 * - `GeminiVoiceRuntime` — real TTS via `@google/genai` (guarded dynamic import; no vendor type
 *   crosses the boundary). Gemini returns base64 PCM; we wrap it in a WAV container so any browser
 *   <audio> can play it, and derive the clip duration from the sample count.
 *
 * Bytes never enter events or world-state (SRF-004 / ADR-0007): callers store the audio out-of-band
 * (a media store) and put only a reference + duration on the surface. Synthesis is non-deterministic
 * for Gemini, so its descriptor declares `deterministic: false` and outputs must be recorded.
 */
import { CosError, ok, type Result } from "@inevitable/shared";
import { requireOptional } from "./optional";

const SPEC_REF = "surface/multimodal-provider-abstraction";

function voiceError(code: string, message: string, details?: Record<string, unknown>): CosError {
  return new CosError(code, message, { specRef: SPEC_REF, details });
}

export interface SynthesizedAudio {
  /** A self-contained WAV byte stream (16-bit PCM), playable by a browser <audio> element. */
  readonly bytes: Uint8Array;
  readonly mimeType: string;
  readonly durationMs: number;
  readonly sampleRate: number;
  readonly model: string;
  readonly deterministic: boolean;
}

export interface VoiceSynthesisInput {
  readonly text: string;
  readonly voiceName?: string;
}

export interface VoiceRuntime {
  readonly provider: string;
  readonly deterministic: boolean;
  synthesize(input: VoiceSynthesisInput): Promise<Result<SynthesizedAudio, CosError>>;
}

// ---------------------------------------------------------------------------
// WAV helpers (16-bit PCM, mono)
// ---------------------------------------------------------------------------

/** Wrap raw little-endian 16-bit PCM in a minimal 44-byte WAV header. */
export function pcm16ToWav(pcm: Uint8Array, sampleRate: number): Uint8Array {
  const blockAlign = 2; // mono * 16-bit
  const byteRate = sampleRate * blockAlign;
  const buffer = new ArrayBuffer(44 + pcm.byteLength);
  const view = new DataView(buffer);
  const writeStr = (offset: number, s: string): void => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + pcm.byteLength, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // audio format = PCM
  view.setUint16(22, 1, true); // channels = mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // bits per sample
  writeStr(36, "data");
  view.setUint32(40, pcm.byteLength, true);
  new Uint8Array(buffer, 44).set(pcm);
  return new Uint8Array(buffer);
}

function durationMsForPcm(pcmByteLength: number, sampleRate: number): number {
  // 16-bit mono ⇒ 2 bytes/sample.
  return Math.round((pcmByteLength / 2 / sampleRate) * 1000);
}

/** Parse the sample rate from a Gemini audio mime like "audio/L16;rate=24000". */
function sampleRateFromMime(mime: string | undefined, fallback = 24000): number {
  const match = /rate=(\d+)/.exec(mime ?? "");
  return match ? Number(match[1]) : fallback;
}

// ---------------------------------------------------------------------------
// NullVoiceRuntime — deterministic reference
// ---------------------------------------------------------------------------

/** Deterministic: a silent clip whose duration is a pure function of the text (≈ reading time). */
export class NullVoiceRuntime implements VoiceRuntime {
  readonly provider = "null-voice";
  readonly deterministic = true;
  private readonly sampleRate = 24000;

  async synthesize(input: VoiceSynthesisInput): Promise<Result<SynthesizedAudio, CosError>> {
    const durationMs = Math.min(9000, Math.max(1200, input.text.length * 42));
    const samples = Math.round((durationMs / 1000) * this.sampleRate);
    const pcm = new Uint8Array(samples * 2); // all-zero ⇒ silence
    return ok({
      bytes: pcm16ToWav(pcm, this.sampleRate),
      mimeType: "audio/wav",
      durationMs,
      sampleRate: this.sampleRate,
      model: "null-voice",
      deterministic: true,
    });
  }
}

// ---------------------------------------------------------------------------
// GeminiVoiceRuntime — real TTS (guarded dynamic import)
// ---------------------------------------------------------------------------

interface GenAiInlineData {
  data?: string; // base64
  mimeType?: string;
}
interface GenAiVoiceResponse {
  candidates?: Array<{ content?: { parts?: Array<{ inlineData?: GenAiInlineData }> } }>;
}
interface GenAiVoiceModels {
  generateContent(args: {
    model: string;
    contents: string;
    config?: Record<string, unknown>;
  }): Promise<GenAiVoiceResponse>;
}
/** Minimal local narrowing of the Gemini client for audio — no vendor type crosses this boundary. */
export interface GenAiVoiceClientLike {
  models: GenAiVoiceModels;
}
interface GenAiModule {
  GoogleGenAI: new (opts: { apiKey: string }) => GenAiVoiceClientLike;
}

export class GeminiVoiceRuntime implements VoiceRuntime {
  readonly provider = "gemini-voice";
  readonly deterministic = false;

  private constructor(
    private readonly client: GenAiVoiceClientLike,
    private readonly model: string,
    private readonly voiceName: string,
  ) {}

  static async connect(config: {
    apiKey: string;
    model?: string;
    voiceName?: string;
  }): Promise<Result<GeminiVoiceRuntime, CosError>> {
    if (!config.apiKey) {
      return { ok: false, error: voiceError("E_VOICE_UNAVAILABLE", "Gemini API key not provided") };
    }
    const mod = await requireOptional<GenAiModule>("@google/genai");
    if (!mod.ok) return mod;
    const client = new mod.value.GoogleGenAI({ apiKey: config.apiKey });
    return ok(
      new GeminiVoiceRuntime(
        client,
        config.model ?? "gemini-2.5-flash-preview-tts",
        config.voiceName ?? "Kore",
      ),
    );
  }

  /** Test seam: build the adapter around an injected (fake) client — no SDK, no network. */
  static fromClient(
    client: GenAiVoiceClientLike,
    model = "gemini-2.5-flash-preview-tts",
    voiceName = "Kore",
  ): GeminiVoiceRuntime {
    return new GeminiVoiceRuntime(client, model, voiceName);
  }

  async synthesize(input: VoiceSynthesisInput): Promise<Result<SynthesizedAudio, CosError>> {
    let response: GenAiVoiceResponse;
    try {
      response = await this.client.models.generateContent({
        model: this.model,
        contents: input.text,
        config: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: input.voiceName ?? this.voiceName },
            },
          },
        },
      });
    } catch (cause) {
      return {
        ok: false,
        error: voiceError("E_VOICE_FAILED", "Gemini voice synthesis failed", {
          cause: cause instanceof Error ? cause.message : String(cause),
        }),
      };
    }

    const part = response.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
    const base64 = part?.inlineData?.data;
    if (!base64) {
      return { ok: false, error: voiceError("E_VOICE_EMPTY", "Gemini returned no audio data") };
    }
    const sampleRate = sampleRateFromMime(part?.inlineData?.mimeType);
    const pcm = Uint8Array.from(Buffer.from(base64, "base64"));
    return ok({
      bytes: pcm16ToWav(pcm, sampleRate),
      mimeType: "audio/wav",
      durationMs: durationMsForPcm(pcm.byteLength, sampleRate),
      sampleRate,
      model: this.model,
      deterministic: false,
    });
  }
}
