/**
 * Visual generation runtime adapters — generated imagery for the Cognitive Surface (S2.1b, SRF-006).
 *
 * Mirrors the voice-runtime pattern: the runtime returns BYTES + a mime type; the gateway bridge
 * (`createMediaGenerator`) stashes them in a media store and puts only a *reference* on the surface
 * (bytes never enter events or world-state — SRF-006 §2). `NullImageRuntime` is the deterministic
 * offline default (a pure-function SVG, replay-safe, no recording needed). A real provider (e.g.
 * Gemini Imagen) is non-deterministic — same contract, `deterministic: false`, outputs recorded (D3).
 *
 * Spec: spec/surface/inline-multimodal-artifacts.md, spec/surface/multimodal-provider-abstraction.md.
 */
import { CosError, type Result, ok, err } from "@inevitable/shared";
import { requireOptional } from "./optional";

export interface VisualGenerationInput {
  readonly prompt: string;
  readonly conceptIds: readonly string[];
}

export interface GeneratedVisual {
  readonly bytes: Uint8Array;
  readonly mimeType: string;
}

export interface ImageRuntime {
  readonly provider: string;
  readonly deterministic: boolean;
  generate(input: VisualGenerationInput): Promise<Result<GeneratedVisual, CosError>>;
}

const XML_ESCAPE: Record<string, string> = {
  "<": "&lt;",
  ">": "&gt;",
  "&": "&amp;",
  '"': "&quot;",
};

function escapeXml(value: string): string {
  return value.replace(/[<>&"]/g, (c) => XML_ESCAPE[c] ?? c);
}

/**
 * Deterministic reference image: a clean SVG "concept card" that is a pure function of the input,
 * so tests and replay are exact and no recording is needed. Declares `deterministic: true`.
 */
export class NullImageRuntime implements ImageRuntime {
  readonly provider = "null";
  readonly deterministic = true;

  async generate(input: VisualGenerationInput): Promise<Result<GeneratedVisual, CosError>> {
    const title = escapeXml((input.conceptIds[0] ?? input.prompt ?? "concept").slice(0, 48));
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 270" role="img" aria-label="${title}">` +
      `<rect width="480" height="270" rx="18" fill="#0b1020"/>` +
      `<rect x="1" y="1" width="478" height="268" rx="17" fill="none" stroke="#2b9fb8" stroke-opacity="0.4"/>` +
      `<text x="32" y="58" fill="#6d7789" font-family="sans-serif" font-size="13" letter-spacing="3">CONCEPT</text>` +
      `<text x="32" y="150" fill="#eef2f8" font-family="sans-serif" font-size="34" font-weight="600">${title}</text>` +
      `<circle cx="410" cy="210" r="34" fill="none" stroke="#5fd3e8" stroke-opacity="0.5"/>` +
      `</svg>`;
    return ok({ bytes: new TextEncoder().encode(svg), mimeType: "image/svg+xml" });
  }
}

// ---------------------------------------------------------------------------
// GeminiImageRuntime — Imagen via @google/genai (guarded dynamic import)
// ---------------------------------------------------------------------------

interface GenAiImageResponseLike {
  generatedImages?: Array<{ image?: { imageBytes?: unknown } }>;
}
interface GenAiImageModelsLike {
  generateImages(args: {
    model: string;
    prompt: string;
    config?: Record<string, unknown>;
  }): Promise<GenAiImageResponseLike>;
}
export interface GenAiImageClientLike {
  models: GenAiImageModelsLike;
}
interface GenAiImageModule {
  GoogleGenAI: new (opts: { apiKey: string }) => GenAiImageClientLike;
}

function imageError(code: string, message: string): CosError {
  return new CosError(code, message, { specRef: "spec/surface/inline-multimodal-artifacts.md" });
}

function toBytesFromUnknown(raw: unknown): Uint8Array {
  if (typeof raw === "string") {
    return Uint8Array.from(atob(raw), (c) => c.charCodeAt(0));
  }
  if (raw instanceof Uint8Array) return raw;
  // Node Buffer is array-like; covers Buffer and other TypedArrays.
  return new Uint8Array(raw as ArrayBufferLike);
}

/**
 * Real image generation via Gemini Imagen. Non-deterministic (`deterministic: false`) — the caller
 * is expected to record outputs (D3) before use, mirroring the model-runtime recording pattern.
 * Falls back gracefully: `generate()` returns `err(...)` on API failure so the surface can render
 * the null SVG card instead of hard-failing.
 */
export class GeminiImageRuntime implements ImageRuntime {
  readonly provider = "gemini-imagen";
  readonly deterministic = false;

  private constructor(
    private readonly client: GenAiImageClientLike,
    private readonly model: string,
  ) {}

  static async connect(config: {
    apiKey: string;
    model?: string;
  }): Promise<Result<GeminiImageRuntime, CosError>> {
    if (!config.apiKey) {
      return err(imageError("E_IMAGE_UNAVAILABLE", "Gemini API key not provided"));
    }
    const mod = await requireOptional<GenAiImageModule>("@google/genai");
    if (!mod.ok) return mod;
    const client = new mod.value.GoogleGenAI({ apiKey: config.apiKey });
    return ok(new GeminiImageRuntime(client, config.model ?? "imagen-4.0-fast-generate-001"));
  }

  /** Test seam: inject a fake client — no SDK, no network. */
  static fromClient(
    client: GenAiImageClientLike,
    model = "imagen-4.0-fast-generate-001",
  ): GeminiImageRuntime {
    return new GeminiImageRuntime(client, model);
  }

  async generate(input: VisualGenerationInput): Promise<Result<GeneratedVisual, CosError>> {
    const concept = (input.conceptIds[0] ?? "").replace(/-/g, " ") || input.prompt.slice(0, 60);
    // The ImagePlanner authored this prompt deliberately (image-as-cognition, ADR-0030 P4) — it is
    // the primary artifact and must reach the provider whole (generous clamp), with only a quiet
    // style suffix appended. Truncating it to a stub was a live image-quality bug.
    const planned = input.prompt.trim().slice(0, 600);
    const prompt = [
      planned || `Educational illustration for the concept "${concept}".`,
      "Clean, minimal, pedagogical illustration style; no text overlays.",
    ].join(" ");

    // One bounded retry on transient provider failure: image generation is the surface's single
    // most fragile provider call, and a lone 503 should not cost the learner the illustration.
    let lastError: CosError | null = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await this.client.models.generateImages({
          model: this.model,
          prompt,
          config: { numberOfImages: 1 },
        });
        const raw = response.generatedImages?.[0]?.image?.imageBytes;
        if (!raw) {
          return err(imageError("E_IMAGE_GENERATION_EMPTY", "Imagen returned no image bytes"));
        }
        return ok({ bytes: toBytesFromUnknown(raw), mimeType: "image/png" });
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        lastError = imageError("E_IMAGE_GENERATION_FAILED", msg);
        const transient =
          msg.includes("fetch failed") ||
          msg.includes("network") ||
          msg.includes("503") ||
          msg.includes("overloaded") ||
          msg.includes("UNAVAILABLE");
        if (!transient) break;
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
    return err(lastError ?? imageError("E_IMAGE_GENERATION_FAILED", "unknown image failure"));
  }
}
