# ADR-0048: The Video Modality (M10 T3)

**Status:** Accepted
**Date:** 2026-07-17
**Related:** ADR-0046 (code) + ADR-0047 (web) — the modality-extension seam this completes; CSE-002
§3.2 (the eight layers — L4 `temporal`) §4/§7 (the adapter seam), CSE-004 (the Temporal
transformation), SRF-003 (the timeline engine), F16 (the Cognitive Surface), blueprint M10
("Video/web/code modalities. Temporal layer, concept scrubber, governed media intents.")

## Context

M10 T1 (code) and T2 (web) added the two text modalities. **Video** is the third and the M10
headline — and the one that introduces a genuinely new dimension: **time**. A video's content is its
timed transcript (captions): a sequence of cues, each `[start, end] → text`. That maps directly onto
two things the CSE already has:

- The **structural layer** — each cue is an anchor-addressable region (a segment of the talk).
- The **L4 `temporal` layer** — one of the eight canonical layers (CSE-002 §3.2), declared since M1
  but never implemented. It is exactly the home for per-region timecodes.

As with web T2, the one hard part — here, **audio → text transcription** — is a governed external
capability (a ToolRuntime/model invocation, CSE-002 §7). T3 follows the T2 pattern: the client (or an
upstream ingestion) supplies the **timed transcript**, and T3 turns it into structural + temporal
layers. Live transcription is deferred, exactly as the web crawler was.

## Decisions

### 1. Video is a text modality (its transcript) that also yields the L4 temporal layer

`VideoTranscriptAdapter` (`packages/source-environment/reference-adapters.ts`; modality `video`,
already in `SOURCE_MODALITIES`) implements `parse(transcript) → ParsedSource`. It accepts the common
timed-transcript formats — **WebVTT**, **SRT**, and a **JSON** array of `{start, end, text}` — and
produces:

- a **structural layer**: one region per cue (a `paragraph`, path `para-<n>`), so the transcript is
  anchor-addressable and the whole M1–M9 pipeline (concepts, anchors, fusion, frontier, timeline)
  works over it unchanged;
- a **temporal (L4) layer**: `{ segments: [{ region_path, start_ms, end_ms }], duration_ms }`,
  mapping each region to its place in time.

`ParsedSource` gains an optional `temporal?: TemporalLayerContent`; `SourceEnvironmentStore.canonicalize`
records it in the same pass it records the PDF `visual` layer (ADR-0036) — a clean precedent. No new
event: the temporal layer lands via the existing `source.layer.constructed`.

### 2. Deterministic, dependency-free transcript parsing; transcription deferred

Timecodes (`HH:MM:SS.mmm` / `HH:MM:SS,mmm` / `MM:SS.mmm`) parse to milliseconds; cues become regions
in document (time) order → byte-identical layers for the same transcript. No media/subtitle library
becomes a substrate dependency (CSE-002 §7). Empty/garbled input with no parseable cue is refused
(`E_SOURCE_PARSE_EMPTY`). **Audio→text transcription** (the media capability) and **live media
delivery** stay deferred — the client supplies the transcript, as it supplies web HTML.

### 3. The temporal layer powers the concept scrubber (substrate now, full UI later)

The L4 layer is the data substrate for the Cognitive Time Machine's *concept scrubber* (jump to where
a concept is discussed) and the Temporal transformation (CSE-004). T3 lands the layer + a basic
timecode-annotated rendering; the full interactive scrubber (concept → seek) is a named follow-on.

## Consequences

- A learner can turn a lecture/talk into a full Canonical Source Environment — its segments become
  concepts + anchors, and (modality-agnostically) fuse across sources, gain a grounded frontier, and
  a temporal model. **M10's three modalities (code, web, video) are complete.**
- The declared-but-empty L4 `temporal` layer is now implemented — the first temporal source layer,
  the substrate for time-based navigation.
- The modality seam is proven a third time; adapters remain the only extension point.

## Deferred (named scope)

- **Audio→text transcription** (a governed media ToolRuntime/model capability) — T3 ingests a
  provided transcript.
- **The full interactive concept scrubber** (concept → timecode seek, a scrubbable timeline UI) and
  the **Temporal transformation** (CSE-004) — T3 lands the temporal substrate + timecode display.
- **Governed media intents** (play/seek/clip as first-class interactions — blueprint M10) and
  **video frame/keyframe visual layer** (L3 over video) — later.
- **Speaker/diarization + chapter structure** (headings from chapter markers) — T3 is flat cues.

## Rejected

- **A binary/media adapter that decodes video** in T3: the learnable content is the transcript; media
  decode + transcription is a governed capability (CSE-002 §7), deferred like the web crawler.
- **Inventing timecodes** when a transcript is untimed: a plain (untimed) transcript is just `text`
  modality — the `video` modality requires real cue timings (no fabricated time, per the CSE honesty
  law). An untimed transcript with no cues is refused.
- **A new event/schema for timing**: the L4 `temporal` layer already exists in the eight-layer model;
  timing lands there via the existing layer-construction event.
