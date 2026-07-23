/**
 * Model runtime adapters — the Phase 2B "real cognition" seam.
 *
 * Three implementations of the `ModelRuntime` contract from `@inevitable/contracts`:
 *
 * - `NullModelRuntime` — deterministic reference: the output is a pure function of the request.
 * - `GeminiModelRuntime` — first real provider; loads `@google/genai` via guarded dynamic import
 *   (never a workspace dependency), no vendor type crosses the adapter boundary.
 * - `RecordingModelRuntime` — the D3 recording seam: record mode publishes `model.output.recorded`
 *   BEFORE the result is used; replay mode resolves from the record and never invokes the provider,
 *   failing closed on a miss.
 *
 * Spec: spec/protocols/model-invocation-protocol.md; spec/replay/deterministic-replay.md (D3).
 */
import {
  CosError,
  CryptoIdGenerator,
  SystemClock,
  hlcInit,
  hlcTick,
  type Clock,
  type Hlc,
  type IdGenerator,
} from "@inevitable/shared";
import type {
  ModelGenerationRequest,
  ModelGenerationResult,
  ModelRuntime,
} from "@inevitable/contracts";
import { createEvent, type EventBus } from "@inevitable/events";
import type { CognitiveEvent } from "@inevitable/protocols";
import { requireOptional } from "./optional";
import { ok, type Result } from "@inevitable/shared";

const SPEC_REF = "protocols/model-invocation-protocol";

export const MODEL_OUTPUT_RECORDED = "model.output.recorded";
export const MODEL_INVOCATION_FAILED = "model.invocation.failed";
export const MODEL_RECORDING_FORMAT_VERSION = "1.0.0";

function modelError(code: string, message: string, details?: Record<string, unknown>): CosError {
  return new CosError(code, message, { specRef: SPEC_REF, details });
}

// ---------------------------------------------------------------------------
// NullModelRuntime — deterministic reference implementation
// ---------------------------------------------------------------------------

/**
 * Deterministic model runtime: output is a pure function of the request. Produces the layered
 * JSON shape the ModelBackedUnit contract expects, so the whole cognition path runs offline.
 */
export class NullModelRuntime implements ModelRuntime {
  async generate(input: ModelGenerationRequest): Promise<ModelGenerationResult> {
    const subject = (input.prompt.split("\n")[0] ?? "")
      .replace(/^Intent:\s*/i, "")
      .trim()
      .slice(0, 120);
    const payload = {
      layers: {
        layer_0: `Intuition: ${subject}`,
        layer_1: `Visual model: a deterministic diagram of "${subject}"`,
      },
      summary: `Deterministic null-model response for: ${subject}`,
      confidence: 0.9,
      reasoning: "null-model: derived deterministically from the request prompt",
    };
    return {
      text: JSON.stringify(payload),
      model: input.model ?? "null-model",
      finishReason: "stop",
      usage: { inputTokens: input.prompt.length, outputTokens: 0 },
    };
  }

  async embed(text: string): Promise<number[]> {
    const vector = new Array<number>(8).fill(0);
    for (let i = 0; i < text.length; i++) {
      const slot = i % vector.length;
      vector[slot] = (vector[slot]! + text.charCodeAt(i)) % 997;
    }
    return vector;
  }
}

// ---------------------------------------------------------------------------
// GeminiModelRuntime — first real provider (guarded dynamic import)
// ---------------------------------------------------------------------------

interface GenAiGroundingChunk {
  web?: { uri?: string; title?: string };
}
interface GenAiResponseLike {
  text?: string;
  candidates?: Array<{
    finishReason?: string;
    groundingMetadata?: { groundingChunks?: GenAiGroundingChunk[] };
  }>;
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
}
interface GenAiEmbedResponseLike {
  embeddings?: Array<{ values?: number[] }>;
}
interface GenAiModelsLike {
  generateContent(args: {
    model: string;
    contents: string;
    config?: Record<string, unknown>;
  }): Promise<GenAiResponseLike>;
  embedContent(args: { model: string; contents: string }): Promise<GenAiEmbedResponseLike>;
}
/** Minimal local narrowing of the Gemini client — no vendor type crosses this boundary. */
export interface GenAiClientLike {
  models: GenAiModelsLike;
}
interface GenAiModule {
  GoogleGenAI: new (opts: { apiKey: string }) => GenAiClientLike;
}

/** Real grounding citations from a web-grounded response — deduped by uri, empty when ungrounded. */
function extractCitations(
  response: GenAiResponseLike,
): { readonly uri: string; readonly title: string }[] {
  const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
  const seen = new Set<string>();
  const citations: { uri: string; title: string }[] = [];
  for (const chunk of chunks) {
    const uri = chunk.web?.uri;
    if (typeof uri !== "string" || !uri || seen.has(uri)) continue;
    seen.add(uri);
    citations.push({ uri, title: chunk.web?.title ?? uri });
  }
  return citations;
}

function mapFinishReason(raw: string | undefined): ModelGenerationResult["finishReason"] {
  switch ((raw ?? "").toUpperCase()) {
    case "STOP":
      return "stop";
    case "MAX_TOKENS":
      return "max_tokens";
    case "SAFETY":
    case "PROHIBITED_CONTENT":
    case "BLOCKLIST":
      return "safety";
    case "REFUSAL":
      return "refusal";
    default:
      return "other";
  }
}

export class GeminiModelRuntime implements ModelRuntime {
  private constructor(
    private readonly client: GenAiClientLike,
    private readonly defaultModel: string,
  ) {}

  /**
   * Connect using an explicit API key (read from the environment at the composition root —
   * keys never enter events, packets, or recordings). Returns a typed error when the SDK is
   * not provisioned at the deployment edge.
   */
  static async connect(config: {
    apiKey: string;
    defaultModel?: string;
  }): Promise<Result<GeminiModelRuntime, CosError>> {
    if (!config.apiKey) {
      return {
        ok: false,
        error: modelError("E_MODEL_UNAVAILABLE", "Gemini API key not provided"),
      };
    }
    const mod = await requireOptional<GenAiModule>("@google/genai");
    if (!mod.ok) return mod;
    const client = new mod.value.GoogleGenAI({ apiKey: config.apiKey });
    return ok(new GeminiModelRuntime(client, config.defaultModel ?? "gemini-2.5-flash"));
  }

  /** Test seam: build the adapter around an injected (fake) client — no SDK, no network. */
  static fromClient(
    client: GenAiClientLike,
    defaultModel = "gemini-2.5-flash",
  ): GeminiModelRuntime {
    return new GeminiModelRuntime(client, defaultModel);
  }

  async generate(input: ModelGenerationRequest): Promise<ModelGenerationResult> {
    const config: Record<string, unknown> = {};
    if (input.system !== undefined) config["systemInstruction"] = input.system;
    if (input.maxTokens !== undefined) config["maxOutputTokens"] = input.maxTokens;
    if (input.temperature !== undefined) config["temperature"] = input.temperature;
    if (input.seed !== undefined) config["seed"] = input.seed;
    // Web-grounded generation (CSE-006 §4): attach the Google Search tool and read real citations
    // from groundingMetadata. Mutually exclusive with structured output — grounded calls parse
    // lenient text, so responseSchema is ignored when webSearch is set.
    if (input.webSearch) {
      config["tools"] = [{ googleSearch: {} }];
    } else if (input.responseSchema !== undefined) {
      config["responseMimeType"] = "application/json";
      config["responseSchema"] = input.responseSchema;
    }
    // Reasoning models (gemini-2.5-*) spend thinking tokens from the output budget. On structured
    // JSON calls an uncapped thinking phase can consume the whole budget and starve the response,
    // yielding empty text → parse failure → silent fallback. A bounded budget keeps text intact.
    if (input.thinkingBudget !== undefined) {
      config["thinkingConfig"] = { thinkingBudget: input.thinkingBudget };
    }
    const model = input.model ?? this.defaultModel;
    const RETRY_DELAYS_MS = [1000, 2000, 4000];
    let lastError: unknown;
    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
      try {
        const response = await this.client.models.generateContent({
          model,
          contents: input.prompt,
          config,
        });
        const usage = response.usageMetadata;
        const citations = extractCitations(response);
        return {
          text: response.text ?? "",
          model,
          finishReason: mapFinishReason(response.candidates?.[0]?.finishReason),
          usage:
            usage === undefined
              ? undefined
              : {
                  inputTokens: usage.promptTokenCount,
                  outputTokens: usage.candidatesTokenCount,
                },
          ...(citations.length > 0 ? { citations } : {}),
        };
      } catch (error) {
        lastError = error;
        const msg = error instanceof Error ? error.message : String(error);
        // Retry only on transient network/overload errors; bail immediately on auth errors.
        // Quota exhaustion (429 RESOURCE_EXHAUSTED) is NOT retried with long backoff here — under
        // hard quota the retries only stack multi-second delays onto an already-serialized ask and
        // still end in a fallback; fail fast so the degraded path is reached quickly and visibly.
        const isTransient =
          msg.includes("fetch failed") ||
          msg.includes("network") ||
          msg.includes("ECONNRESET") ||
          msg.includes("503") ||
          msg.includes("overloaded") ||
          msg.includes("UNAVAILABLE");
        if (!isTransient || attempt >= RETRY_DELAYS_MS.length) break;
        await new Promise((res) => setTimeout(res, RETRY_DELAYS_MS[attempt]));
      }
    }
    throw lastError;
  }

  async embed(text: string): Promise<number[]> {
    const result = await this.client.models.embedContent({
      model: "gemini-embedding-exp-03-07",
      contents: text,
    });
    const values = result.embeddings?.[0]?.values;
    if (!values || values.length === 0) {
      throw modelError("E_EMBED_EMPTY", "Gemini embedContent returned no embedding values");
    }
    return values;
  }
}

// ---------------------------------------------------------------------------
// RecordingModelRuntime — the D3 recording seam
// ---------------------------------------------------------------------------

export type RecordingMode = "record" | "replay";

export interface RecordingModelRuntimeDeps {
  readonly mode: RecordingMode;
  readonly bus: EventBus;
  /** Inner provider — required in record mode; never invoked in replay mode. */
  readonly inner?: ModelRuntime;
  /** Replay source override; defaults to `bus.replay({ subject: "model.>" })`. */
  readonly recordings?: readonly CognitiveEvent[];
  readonly provider?: string;
  readonly producerCid?: string;
  readonly clock?: Clock;
  readonly idGenerator?: IdGenerator;
  readonly nodeId?: string;
}

interface RecordedInvocation {
  readonly ordinal: number;
  readonly response: ModelGenerationResult;
}

/**
 * Record mode: delegate to the inner provider, publish `model.output.recorded` BEFORE the result
 * is returned (record-before-use law); a failed publish means the result must not be used.
 * Replay mode: resolve from recorded events by `(invocation_key, ordinal)`; the inner provider is
 * never invoked; a missing record fails closed with `E_MODEL_REPLAY_MISS`.
 */
export class RecordingModelRuntime implements ModelRuntime {
  private readonly mode: RecordingMode;
  private readonly bus: EventBus;
  private readonly inner: ModelRuntime | undefined;
  private readonly recordingsOverride: readonly CognitiveEvent[] | undefined;
  private readonly provider: string;
  private readonly producerCid: string;
  private readonly clock: Clock;
  private readonly idGenerator: IdGenerator;
  private readonly ordinals = new Map<string, number>();
  private replayIndex: Map<string, RecordedInvocation[]> | undefined;
  private hlc: Hlc;

  constructor(deps: RecordingModelRuntimeDeps) {
    if (deps.mode === "record" && !deps.inner) {
      throw modelError("E_MODEL_UNAVAILABLE", "record mode requires an inner ModelRuntime");
    }
    this.mode = deps.mode;
    this.bus = deps.bus;
    this.inner = deps.inner;
    this.recordingsOverride = deps.recordings;
    this.provider = deps.provider ?? "unknown";
    this.producerCid = deps.producerCid ?? "model-recorder";
    this.clock = deps.clock ?? new SystemClock();
    this.idGenerator = deps.idGenerator ?? new CryptoIdGenerator();
    this.hlc = hlcInit(deps.nodeId ?? "model-recorder");
  }

  async generate(input: ModelGenerationRequest): Promise<ModelGenerationResult> {
    const key = input.invocation_key ?? "anonymous";
    const ordinal = this.ordinals.get(key) ?? 0;
    this.ordinals.set(key, ordinal + 1);

    if (this.mode === "replay") return this.resolveFromRecord(key, ordinal);

    const inner = this.inner!;
    let response: ModelGenerationResult;
    try {
      response = await inner.generate(input);
    } catch (error) {
      await this.emit(MODEL_INVOCATION_FAILED, {
        invocation_key: key,
        ordinal,
        provider: this.provider,
        error_code: error instanceof CosError ? error.code : "E_MODEL_UNAVAILABLE",
        message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }

    // Record-before-use law: the recording event is published before the caller may use the value.
    const published = await this.emit(MODEL_OUTPUT_RECORDED, {
      invocation_key: key,
      ordinal,
      request: {
        prompt: input.prompt,
        system: input.system ?? null,
        model: input.model ?? null,
        maxTokens: input.maxTokens ?? null,
        temperature: input.temperature ?? null,
        seed: input.seed ?? null,
      },
      response: {
        text: response.text,
        model: response.model,
        finishReason: response.finishReason ?? null,
        ...(response.citations ? { citations: response.citations } : {}),
      },
      provider: this.provider,
      format_version: MODEL_RECORDING_FORMAT_VERSION,
    });
    if (published.status !== "published" && published.status !== "modified") {
      throw modelError(
        "E_MODEL_RECORDING_FAILED",
        `model output recording was not published (status: ${published.status}); result must not be used`,
        { invocation_key: key, ordinal, reason: published.reason },
      );
    }
    return response;
  }

  async embed(text: string): Promise<number[]> {
    if (this.mode === "replay") {
      throw modelError("E_MODEL_REPLAY_MISS", "embed() results are not recorded in Phase 2B");
    }
    return this.inner!.embed(text);
  }

  private resolveFromRecord(key: string, ordinal: number): ModelGenerationResult {
    if (!this.replayIndex) this.replayIndex = this.buildReplayIndex();
    const entries = this.replayIndex.get(key) ?? [];
    const match = entries.find((entry) => entry.ordinal === ordinal);
    if (!match) {
      throw modelError(
        "E_MODEL_REPLAY_MISS",
        `no recorded model output for invocation_key "${key}" ordinal ${ordinal}; replay refuses to fabricate`,
        { invocation_key: key, ordinal },
      );
    }
    return match.response;
  }

  private buildReplayIndex(): Map<string, RecordedInvocation[]> {
    const source = this.recordingsOverride ?? this.bus.replay({ subject: "model.>" });
    const index = new Map<string, RecordedInvocation[]>();
    for (const event of source) {
      if (event.event_type !== MODEL_OUTPUT_RECORDED) continue;
      const payload = event.payload as {
        invocation_key?: string;
        ordinal?: number;
        response?: {
          text?: string;
          model?: string;
          finishReason?: string | null;
          citations?: readonly { uri: string; title: string }[];
        };
      };
      const key = payload.invocation_key ?? "anonymous";
      const response: ModelGenerationResult = {
        text: payload.response?.text ?? "",
        model: payload.response?.model ?? "recorded",
        ...(payload.response?.finishReason
          ? { finishReason: payload.response.finishReason as ModelGenerationResult["finishReason"] }
          : {}),
        ...(payload.response?.citations ? { citations: payload.response.citations } : {}),
      };
      const list = index.get(key) ?? [];
      list.push({ ordinal: payload.ordinal ?? 0, response });
      index.set(key, list);
    }
    for (const list of index.values()) list.sort((a, b) => a.ordinal - b.ordinal);
    return index;
  }

  private async emit(eventType: string, payload: Record<string, unknown>) {
    this.hlc = hlcTick(this.hlc, this.clock);
    const created = createEvent(
      {
        eventType,
        producerCid: this.producerCid,
        producerType: "runtime.model-recorder",
        payload,
        topic: `cos.${eventType}`,
        classification: "internal",
        retention: "permanent",
        replayBehavior: "replayable",
      },
      { clock: this.clock, hlc: this.hlc, idGenerator: this.idGenerator },
    );
    this.hlc = created.hlc;
    return this.bus.publish(created.event);
  }
}
