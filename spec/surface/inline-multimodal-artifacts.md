---
name: inline-multimodal-artifacts
spec:
  id: SRF-006
  title: Inline Multimodal Artifacts — cognition that is seen, heard, and run
  domain: surface
  status: draft
  owner: product-architecture
  last_reviewed: 2026-06-21
  upstream_dependencies:
    - surface/cognitive-surface-runtime
    - surface/multimodal-provider-abstraction
    - surface/surface-event-architecture
    - protocols/model-invocation-protocol
    - product/features/F04-adaptive-multimodal-explanation
  downstream_dependencies:
    - packages/surface
    - packages/adapters
    - apps/web
  related_protocols: [cognitive-event-protocol, model-invocation-protocol]
  related_events:
    [surface.block.generated, surface.visual.generated, surface.simulation.started]
  related_runtime_systems: [universal-cognitive-bus, world-state-graph]
  related_governance_systems: [governance-kernel]
  related_observability_systems: [cognitive-observability]
  semantic_tags: [phase-s2, multimodal, media-artifact, provider-agnostic, replay, out-of-band]
  canonical_references:
    - surface/multimodal-provider-abstraction#1
    - surface/cognitive-surface-runtime#4
    - architecture-decisions/ADR-0007-surface-choreography-and-timing
---

# Inline Multimodal Artifacts

## 1. Purpose

The surface must render cognition that is **seen, heard, and run** — diagrams, images, voice,
and runnable simulations — not only read. SRF-004 defines the provider seam (the `ProviderRegistry`,
the modality provider interfaces, and `MediaArtifact`); this spec defines how a generated artifact
becomes an **inline cognition block** on the surface: produced through a governed dispatch, recorded
deterministically, referenced (never inlined) in events, and served out-of-band.

The learner experiences these as part of cognition appearing in place — never as an external
download or a separate viewer (F04).

## 2. Philosophy

- **Artifacts are cognition blocks, not attachments.** An image/voice/video/simulation is a typed
  `CognitionBlock` (SRF-001 §4.1) whose content carries a `MediaArtifact` reference, with the same
  mandatory provenance as any other block.
- **Provider-agnostic.** Generation flows through the SRF-004 `ProviderRegistry`; no vendor SDK
  enters the surface runtime. Gemini is a reference implementation behind the contract; `Null*`
  providers are the deterministic offline default.
- **Bytes never enter the canonical record.** Events and world-state carry only a `content_ref`
  (+ mime type, duration, dimensions); binaries are served out-of-band via the gateway media route
  (ADR-0007 already mandates this for voice — SRF-006 generalizes it to all modalities).
- **Determinism by recording, not by purity.** Non-deterministic generation (a real image/voice
  model) is bounded exactly like model text (model-invocation-protocol / D3): the artifact reference
  is recorded as an event before use; replay resolves from the record and never re-invokes the
  provider (fail-closed). Deterministic providers (`deterministic: true`) may run during replay.

## 3. Architecture

```
cognitive unit / surface           ProviderRegistry (SRF-004)        media store (out-of-band)
        │ request (prompt, concept_ids)        │                              │
        ▼                                       ▼                              │
  governed dispatch ──────────────────▶ provider.generate*() ─▶ MediaArtifact{content_ref}
        │                                                                      │ bytes
        ▼ (record-before-use, D3)                                             ▼
  surface.visual.generated  ──▶  surface.block.generated (image|voice|…)   GET /api/surface/:id/media/:artifactId
        │                                   │
        ▼                                   ▼
   foldSurfaceEvents ───────────────▶ SurfaceState.blocks[] (block.content.artifact)
```

The artifact-producing step is **governed** (capability + classification, like any dispatch) and
**recorded** (the `MediaArtifact` reference is published as `surface.visual.generated` before the
block is consumed). The block-renderer registry (provider-agnostic, keyed by `block_type`) resolves
the `content_ref` to the media route at render time.

## 4. Primitives

A multimodal block's `content` carries the artifact reference (never bytes):

```ts
interface MultimodalBlockContent {
  readonly artifact: {
    readonly artifact_id: string;
    readonly modality: "image" | "video" | "voice" | "simulation";
    readonly content_ref: string; // resolved out-of-band; never inline bytes
    readonly mime_type: string;
    readonly provider_id: string;
    readonly deterministic: boolean; // false ⇒ recorded for replay
    readonly duration_ms?: number; // voice/video
    readonly dimensions?: { readonly w: number; readonly h: number }; // image/video
  };
  readonly caption?: string; // text companion (dual-coding, F04 §9)
  readonly alt: string; // mandatory accessible description
}
```

Two visual paths, by determinism:

- **Generated media (`image`/`video`/`voice`)** — produced by a provider; if the provider is
  non-deterministic, recorded (D3). `simulation` blocks carry a deterministic, runnable spec
  (parameters + a sandbox handle) rather than a frozen artifact; their *execution* is client-side
  and causally transparent (the learner can ask "why did that happen?", F16).
- **Structured visuals (concept maps, tables, diagrams as data)** — these are NOT provider media;
  they are deterministic structured `concept`/`timeline` block content rendered client-side
  (no generation, no recording). SRF-006 keeps the two paths distinct: generation is recorded;
  structured rendering is pure.

## 5. Protocols and Contracts

- Generation uses the SRF-004 `MediaRequest` → `MediaArtifact` contract; the surface never calls a
  vendor directly.
- A non-deterministic artifact MUST be recorded (`surface.visual.generated` carrying the
  `MediaArtifact` reference) **before** the block that references it is generated — the
  record-before-use law (model-invocation-protocol). Replay resolves the reference from the recorded
  event; a missing record fails closed (`E_SURFACE_MEDIA_REPLAY_MISS`).
- The media route `GET /api/surface/:id/media/:artifactId` serves bytes out-of-band; events carry
  only references. Unknown/absent artifacts return 404 (already the voice behavior).
- Every multimodal block carries mandatory provenance (SRF-001 §4.2) plus a mandatory `alt`.

## 6. Runtime Semantics

- A modality with no registered provider **degrades to a typed placeholder block** (the surface
  never crashes); the placeholder records the unmet modality and the reason.
- `surface.visual.generated` precedes the `surface.block.generated` that references the artifact.
- Determinism: deterministic providers run live and on replay identically; non-deterministic
  providers run once (recorded) and are never re-invoked on replay.
- `simulation` blocks emit `surface.simulation.started`; their parameter state is canonical, their
  frame output is a client projection (never recorded frame-by-frame).

## 7. Event and State Transitions

`surface.visual.generated` is a non-state observability marker (folds into version only); the
artifact becomes visible only via the `surface.block.generated` it precedes. `MultimodalBlockContent`
folds through the existing block path (SRF-001 §7) — no new state slice is required. `surface.block.modified`
may swap an artifact (e.g. modality morphing, F04) by replacing `content.artifact`.

## 8. Observability

`surface.visual.generated` carries `block_id`, `artifact_id`, `modality`, `provider_id`, and the
`deterministic` flag, linking the artifact to its producing dispatch's trace. The provenance chain
(SRF-001 §8) resolves an artifact back to the prompt, provider, and governing packet.

## 9. Governance and Security

Generation is a governed dispatch: capability + classification ceilings apply (a provider call is a
side-effecting tool-class action). Classification propagates to the block; `alt`/caption inherit it.
A blocked generation emits no media event and degrades to a placeholder. Provider credentials are
edge-provisioned (never in the substrate), consistent with the adapter doctrine.

## 10. Failure Semantics

| Failure | Behavior |
|---|---|
| no provider for modality | typed placeholder block; `reason` recorded; surface continues |
| provider error at generation | placeholder block + degraded path; dispatch error surfaced |
| replay with missing artifact record | `E_SURFACE_MEDIA_REPLAY_MISS` (fail-closed; never re-invoke) |
| media route miss | 404 (bytes are out-of-band; the event/state remain valid) |

## 11. Testing and Validation

- A registered deterministic provider yields an inline `image`/`voice` block with a resolvable
  `content_ref`; fold places it in `blocks[]` with provenance + `alt`.
- Record→replay with a non-deterministic provider reproduces a byte-identical block from the recorded
  `surface.visual.generated`; the provider tripwire is never invoked on replay.
- A modality with no provider degrades to a typed placeholder (no throw); the existing text path is
  unaffected.
- Structured visuals (concept map / table) render deterministically with no media event.

## 12. Evolution Strategy

- **Modality morphing (F04):** a block's artifact is swapped via `surface.block.modified` when a
  comprehension signal favors a different representation.
- **Real Gemini image/video/live** behind the SRF-004 contracts (provider-agnostic; recorded).
- **Runnable simulations** with causal-transparency queries (F16) — parameter state canonical,
  frames projected; deeper sandbox/effect-journaling is a later spec.
