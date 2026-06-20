---
name: multimodal-provider-abstraction
spec:
  id: SRF-004
  title: Multimodal Provider Abstraction — Gemini Preparation Layer
  domain: surface
  status: draft
  owner: product-architecture
  last_reviewed: 2026-06-11
  upstream_dependencies:
    - surface/cognitive-surface-runtime
    - product/features/F04-adaptive-multimodal-explanation
    - product/features/F16-cognitive-surface
  downstream_dependencies:
    - packages/surface
  related_protocols: [cognition-packet-protocol, cognitive-event-protocol]
  related_events: [surface.visual.generated, surface.simulation.started]
  related_runtime_systems: [universal-cognitive-bus]
  related_governance_systems: [governance-kernel, capability-envelope]
  related_observability_systems: [cognitive-observability, otel-edge]
  semantic_tags:
    [phase-2a, multimodal, provider-adapter, gemini, image, video, voice, live-session, no-vendor-lock-in]
  canonical_references:
    - surface/cognitive-surface-runtime#12
    - telemetry/otel-edge
---

# Multimodal Provider Abstraction

## 1. Purpose

Defines the adapter contracts through which the Cognitive Surface acquires generated media —
images, video, voice, live sessions, and general multimodal completion — **without vendor
lock-in**. Phase 2A ships interfaces and deterministic null implementations only; Gemini
becomes the first real implementation in Phase 2B.

## 2. Philosophy

- **Adapters only.** The surface runtime depends on interfaces; concrete providers are
  injected. No provider SDK enters `@inevitable/surface` dependencies.
- **Determinism first.** Provider outputs must be recordable as deterministic events (the D3
  recording seam): replay never re-invokes a provider.
- **Provenance always.** Every artifact carries which provider produced it, from which
  request, for which block.

## 3. Architecture

```
SurfaceSession / AgentContributionRuntime
        │ requests media
        ▼
  ProviderRegistry ──selects──▶ <Modality>Provider (interface)
        │                              │
        │                       NullProvider (Phase 2A, deterministic)
        │                       GeminiProvider (Phase 2B, packages/adapters)
        ▼
  MediaArtifact ──▶ media block content + surface.visual.generated
```

## 4. Primitives

```ts
interface ProviderDescriptor {
  readonly provider_id: string;       // "null", "gemini", …
  readonly modalities: readonly MediaModality[];
  readonly version: string;
  readonly deterministic: boolean;    // true for null/replay providers
}
type MediaModality = "image" | "video" | "voice" | "live" | "multimodal";

interface MediaRequest {
  readonly request_id: string;
  readonly surface_id: string;
  readonly block_id: string | null;   // block this artifact will attach to
  readonly prompt: string;
  readonly concept_ids: readonly string[];
  readonly constraints?: Record<string, unknown>;  // size, duration, voice id, …
}

interface MediaArtifact {
  readonly artifact_id: string;
  readonly request_id: string;
  readonly modality: MediaModality;
  readonly provider_id: string;
  readonly content_ref: string;        // URI/handle — never inline binary in events
  readonly mime_type: string;
  readonly created_at: string;
  readonly provenance: { readonly prompt: string; readonly model: string | null };
}

interface ImageGenerationProvider {
  describe(): ProviderDescriptor;
  generateImage(req: MediaRequest): Promise<Result<MediaArtifact, CosError>>;
}
interface VideoGenerationProvider {
  describe(): ProviderDescriptor;
  generateVideo(req: MediaRequest): Promise<Result<MediaArtifact, CosError>>;
}
interface VoiceProvider {
  describe(): ProviderDescriptor;
  synthesize(req: MediaRequest): Promise<Result<MediaArtifact, CosError>>;
  transcribe(req: MediaRequest): Promise<Result<MediaArtifact, CosError>>;
}
interface LiveSessionProvider {
  describe(): ProviderDescriptor;
  open(req: MediaRequest): Promise<Result<LiveSessionHandle, CosError>>;
}
interface LiveSessionHandle {
  readonly session_ref: string;
  send(input: Record<string, unknown>): Promise<Result<void, CosError>>;
  close(): Promise<void>;
}
interface MultimodalProvider {
  describe(): ProviderDescriptor;
  complete(req: MediaRequest): Promise<Result<MediaArtifact, CosError>>;
}
```

`ProviderRegistry` maps modality → provider, validates `describe()` on registration, and
exposes `get(modality)`; absent providers yield a typed `CosError` (`E_SURFACE_PROVIDER`),
never a crash.

## 5. Protocols and Contracts

- Requests/artifacts are plain data, id-stamped by the injected `IdGenerator`.
- `content_ref` is a reference (URI, storage key); binaries never enter events or world-state.
- A successful artifact attached to a block emits `surface.visual.generated`.

## 6. Runtime Semantics

`NullProvider` (Phase 2A reference implementation, all modalities): returns a deterministic
artifact whose `content_ref` is derived from the request (`null://<modality>/<request_id>`),
making tests and replay exact. It declares `deterministic: true`.

D3 recording seam: when a non-deterministic provider lands, the call site records
`(request_id → artifact)` as an event before block attachment; replay resolves from the
record, never the provider. **Realized in Phase 2B** for the text-generation modality by the
[Model Invocation Protocol](../protocols/model-invocation-protocol.md): `RecordingModelRuntime`
in `packages/adapters` wraps any `ModelRuntime` (Gemini first), publishing
`model.output.recorded` before use in record mode and resolving from the record (never the
provider, failing closed on a miss) in replay mode.

**Phase 2D — voice (realized).** Narration voice ships through a `VoiceRuntime` adapter in
`packages/adapters` (`GeminiVoiceRuntime`, guarded dynamic import; `NullVoiceRuntime`, the
deterministic silent-clip reference). Gemini returns base64 PCM, which the adapter wraps in a WAV
container and stamps with a duration derived from the sample count. Per ADR-0007, the audio bytes
are stored **out-of-band** (the gateway `MediaStore`, served by `GET /api/surface/:id/media/:artifactId`)
and never enter events or world-state; the narration event carries only `voice {artifact_id,
content_ref, duration_ms, provider_id}`. `GeminiVoiceRuntime` declares `deterministic: false`, so its
output reference is recorded in the event log (the segment's `voice` ref + `surface.visual.generated`);
durable cross-process audio persistence is deferred (the event log still replays the timing exactly).
Image/video/live adopt the same seam next.

## 7. Event and State Transitions

| Transition | Event |
|---|---|
| artifact attached to block | `surface.visual.generated` |
| live/simulation session opened | `surface.simulation.started` |

## 8. Observability

Provider calls at real call sites are wrapped in OTel spans (`cos.provider.<modality>`)
carrying `provider_id`, `request_id`, `surface_id`. Null provider calls are still traced.

## 9. Governance and Security

Provider invocation is a side-effecting capability: real providers (Phase 2B) require
`network_access: true` in the capability envelope and pass the governance gate before
invocation. Cost ceilings (`cost_ceiling_usd`) bound provider spend. Null providers bypass
neither check — the gate is structural.

## 10. Failure Semantics

| Failure | Behavior |
|---|---|
| no provider registered for modality | `CosError("E_SURFACE_PROVIDER")`; block proceeds without media |
| provider call fails | error returned; no artifact, no event; block remains text-only (degraded, observable) |
| artifact attach after session close | dropped per late-arrival policy |

## 11. Testing and Validation

- Registry: register/get/missing-modality error paths.
- Null determinism: same request ⇒ identical artifact.
- Event: attaching an artifact emits `surface.visual.generated` with provider provenance.
- Structural: `@inevitable/surface` has no provider SDK dependencies (package.json audit).

## 12. Evolution Strategy

Phase 2B (shipped): `GeminiModelRuntime` + `RecordingModelRuntime` + `NullModelRuntime` in
`packages/adapters` (guarded dynamic import of the Gemini SDK, per ADR-0003 adapter doctrine)
realize the text-generation path with D3 recorded-output replay — see the
[Model Invocation Protocol](../protocols/model-invocation-protocol.md). Phase 2D (shipped):
`GeminiVoiceRuntime` + `NullVoiceRuntime` realize narration voice with out-of-band audio + a
recorded reference (see §6). Next: `GeminiImageProvider`, `GeminiLiveProvider`,
`GeminiMultimodalProvider` implementing the media interfaces above through the same recording seam.
Additional vendors register beside Gemini without surface changes.
