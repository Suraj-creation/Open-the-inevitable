/**
 * Multimodal Provider Abstraction — the Gemini preparation layer.
 *
 * Adapter interfaces only; no vendor SDKs. Phase 2A ships a deterministic NullProvider so
 * the surface can carry image/video/voice/simulation blocks without any external dependency.
 * Gemini becomes the first real implementation in Phase 2B (in packages/adapters).
 *
 * Spec: spec/surface/multimodal-provider-abstraction.md.
 */
import { CosError, type Clock, type Result, err, ok } from "@inevitable/shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MediaModality = "image" | "video" | "voice" | "live" | "multimodal";

export interface ProviderDescriptor {
  readonly provider_id: string;
  readonly modalities: readonly MediaModality[];
  readonly version: string;
  /** Deterministic providers may run during replay; non-deterministic ones must be recorded. */
  readonly deterministic: boolean;
}

export interface MediaRequest {
  readonly request_id: string;
  readonly surface_id: string;
  readonly block_id: string | null;
  readonly prompt: string;
  readonly concept_ids: readonly string[];
  readonly constraints?: Record<string, unknown>;
}

export interface MediaArtifact {
  readonly artifact_id: string;
  readonly request_id: string;
  readonly modality: MediaModality;
  readonly provider_id: string;
  /** Reference (URI/handle) — binaries never enter events or world-state. */
  readonly content_ref: string;
  readonly mime_type: string;
  readonly created_at: string;
  readonly provenance: { readonly prompt: string; readonly model: string | null };
}

export interface ImageGenerationProvider {
  describe(): ProviderDescriptor;
  generateImage(req: MediaRequest): Promise<Result<MediaArtifact, CosError>>;
}

export interface VideoGenerationProvider {
  describe(): ProviderDescriptor;
  generateVideo(req: MediaRequest): Promise<Result<MediaArtifact, CosError>>;
}

export interface VoiceProvider {
  describe(): ProviderDescriptor;
  synthesize(req: MediaRequest): Promise<Result<MediaArtifact, CosError>>;
  transcribe(req: MediaRequest): Promise<Result<MediaArtifact, CosError>>;
}

export interface LiveSessionHandle {
  readonly session_ref: string;
  send(input: Record<string, unknown>): Promise<Result<void, CosError>>;
  close(): Promise<void>;
}

export interface LiveSessionProvider {
  describe(): ProviderDescriptor;
  open(req: MediaRequest): Promise<Result<LiveSessionHandle, CosError>>;
}

export interface MultimodalProvider {
  describe(): ProviderDescriptor;
  complete(req: MediaRequest): Promise<Result<MediaArtifact, CosError>>;
}

export function surfaceProviderError(message: string, details?: Record<string, unknown>): CosError {
  return new CosError("E_SURFACE_PROVIDER", message, {
    specRef: "spec/surface/multimodal-provider-abstraction.md",
    details,
  });
}

// ---------------------------------------------------------------------------
// MediaGenerator — the generated-media seam (S2.1b, SRF-006)
// ---------------------------------------------------------------------------

/**
 * The surface-side seam for generated media (image/video/simulation), mirroring `VoiceSynthesizer`.
 * The gateway bridges a provider runtime + media store to this interface: it stores the bytes
 * out-of-band and returns only a reference (`content_ref`) the fold records. `null` ⇒ generation
 * unavailable; the surface degrades to text/structured content (never a crash).
 */
export interface MediaGenerationRequest {
  readonly request_id: string;
  readonly surface_id: string;
  readonly block_id: string | null;
  readonly modality: "image" | "video" | "simulation";
  readonly prompt: string;
  readonly concept_ids: readonly string[];
}

export interface MediaGenerationRef {
  readonly artifact_id: string;
  readonly modality: string;
  readonly content_ref: string;
  readonly mime_type: string;
  readonly provider_id: string;
  readonly deterministic: boolean;
}

export interface MediaGenerator {
  generate(request: MediaGenerationRequest): Promise<MediaGenerationRef | null>;
}

// ---------------------------------------------------------------------------
// ProviderRegistry
// ---------------------------------------------------------------------------

type AnyProvider =
  | ImageGenerationProvider
  | VideoGenerationProvider
  | VoiceProvider
  | LiveSessionProvider
  | MultimodalProvider;

/**
 * Maps modality → provider. Absent providers yield a typed error, never a crash:
 * the surface degrades to text-only blocks when a modality is unavailable.
 */
export class ProviderRegistry {
  private readonly providers = new Map<MediaModality, AnyProvider>();

  register(provider: AnyProvider): Result<void, CosError> {
    const descriptor = provider.describe();
    if (!descriptor.provider_id.trim()) {
      return err(surfaceProviderError("provider descriptor requires a provider_id"));
    }
    if (descriptor.modalities.length === 0) {
      return err(surfaceProviderError("provider must declare at least one modality"));
    }
    for (const modality of descriptor.modalities) {
      this.providers.set(modality, provider);
    }
    return ok(undefined);
  }

  get(modality: MediaModality): Result<AnyProvider, CosError> {
    const provider = this.providers.get(modality);
    if (!provider) {
      return err(
        surfaceProviderError(`no provider registered for modality "${modality}"`, { modality }),
      );
    }
    return ok(provider);
  }

  registered(): readonly MediaModality[] {
    return [...this.providers.keys()];
  }
}

// ---------------------------------------------------------------------------
// NullMultimodalProvider — Phase 2A deterministic reference implementation
// ---------------------------------------------------------------------------

const NULL_MIME: Record<MediaModality, string> = {
  image: "image/null",
  video: "video/null",
  voice: "audio/null",
  live: "application/x-live-session",
  multimodal: "application/x-multimodal",
};

/**
 * Deterministic provider: the artifact is a pure function of the request (plus the injected
 * clock), so tests and replay are exact. Declares `deterministic: true`.
 */
export class NullMultimodalProvider
  implements
    ImageGenerationProvider,
    VideoGenerationProvider,
    VoiceProvider,
    LiveSessionProvider,
    MultimodalProvider
{
  constructor(private readonly clock: Clock) {}

  describe(): ProviderDescriptor {
    return {
      provider_id: "null",
      modalities: ["image", "video", "voice", "live", "multimodal"],
      version: "1.0.0",
      deterministic: true,
    };
  }

  private artifact(modality: MediaModality, req: MediaRequest): Result<MediaArtifact, CosError> {
    return ok({
      artifact_id: `art:null:${modality}:${req.request_id}`,
      request_id: req.request_id,
      modality,
      provider_id: "null",
      content_ref: `null://${modality}/${req.request_id}`,
      mime_type: NULL_MIME[modality],
      created_at: new Date(this.clock.nowMs()).toISOString(),
      provenance: { prompt: req.prompt, model: null },
    });
  }

  async generateImage(req: MediaRequest): Promise<Result<MediaArtifact, CosError>> {
    return this.artifact("image", req);
  }

  async generateVideo(req: MediaRequest): Promise<Result<MediaArtifact, CosError>> {
    return this.artifact("video", req);
  }

  async synthesize(req: MediaRequest): Promise<Result<MediaArtifact, CosError>> {
    return this.artifact("voice", req);
  }

  async transcribe(req: MediaRequest): Promise<Result<MediaArtifact, CosError>> {
    return this.artifact("voice", req);
  }

  async open(req: MediaRequest): Promise<Result<LiveSessionHandle, CosError>> {
    return ok({
      session_ref: `null://live/${req.request_id}`,
      async send(): Promise<Result<void, CosError>> {
        return ok(undefined);
      },
      async close(): Promise<void> {
        /* deterministic no-op */
      },
    });
  }

  async complete(req: MediaRequest): Promise<Result<MediaArtifact, CosError>> {
    return this.artifact("multimodal", req);
  }
}
