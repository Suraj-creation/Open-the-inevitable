/**
 * SurfaceChoreographer — turns generated cognition into *synchronized, attention-directed* events.
 *
 * The static fold (blocks + timeline) says WHAT exists; the choreography sub-family says HOW
 * cognition unfolds over time: which agent is speaking, what the surface is looking at, and the
 * narration that voices an explanation segment by segment. It emits three governed event subtypes
 * — `surface.presence.updated`, `surface.narration.segment`, `surface.focus.changed` — which the
 * fold projects into the choreography slice (SurfaceState.presence/narration/focus).
 *
 * Timing law (ADR-0007): events carry only logical order (`sequence`) and durations, never a
 * playback clock. The animation schedule is a client projection; this producer never decides "when".
 * Voice is optional and out-of-band: a `VoiceSynthesizer` (Phase 2D-S4, Gemini) returns a reference
 * to an artifact, never bytes; absent a synthesizer, segments are text-only and fully deterministic.
 *
 * Spec: spec/surface/surface-event-architecture.md §4 (choreography sub-family); ADR-0007.
 */
import { createEvent, type EventBus } from "@inevitable/events";
import {
  CryptoIdGenerator,
  SystemClock,
  type Clock,
  type Hlc,
  type IdGenerator,
  hlcInit,
} from "@inevitable/shared";

import type { CognitionBlock } from "./blocks";
import type { AgentPresenceState, NarrationVoice } from "./projection";

// ---------------------------------------------------------------------------
// Text segmentation
// ---------------------------------------------------------------------------

/**
 * Split narration text into spoken/visible segments at sentence boundaries, merging short
 * sentences up to `maxLen` and hard-splitting any single over-long run. Pure and deterministic
 * (no locale/Date) so two runs of a session produce identical segments — the basis of replay.
 */
export function segmentNarration(text: string, maxLen = 240): readonly string[] {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return [];
  const sentences = normalized.match(/[^.!?]+[.!?]*/g) ?? [normalized];
  const segments: string[] = [];
  let buffer = "";
  const flush = (): void => {
    if (buffer) segments.push(buffer);
    buffer = "";
  };
  for (const raw of sentences) {
    let piece = raw.trim();
    if (!piece) continue;
    // Hard-split a single sentence longer than maxLen on word boundaries.
    while (piece.length > maxLen) {
      const head = piece.slice(0, maxLen);
      const cut = head.lastIndexOf(" ");
      const at = cut > maxLen * 0.5 ? cut : maxLen;
      flush();
      segments.push(piece.slice(0, at).trim());
      piece = piece.slice(at).trim();
    }
    if (buffer && buffer.length + 1 + piece.length > maxLen) flush();
    buffer = buffer ? `${buffer} ${piece}` : piece;
  }
  flush();
  return segments;
}

/** Ordered narration text drawn from a block: its summary, then its explanation layers in order. */
export function collectNarrationTexts(block: CognitionBlock): readonly string[] {
  const texts: string[] = [];
  const summary = block.content["summary"];
  if (typeof summary === "string" && summary.trim()) texts.push(summary.trim());
  const layers = block.content["layers"] as Record<string, unknown> | undefined;
  if (layers) {
    for (const key of Object.keys(layers).sort()) {
      const value = layers[key];
      if (typeof value === "string" && value.trim()) texts.push(value.trim());
    }
  }
  // Fall back to a plain text field if the block carries one (non-model content).
  if (texts.length === 0 && typeof block.content["text"] === "string") {
    const t = (block.content["text"] as string).trim();
    if (t) texts.push(t);
  }
  return texts;
}

// ---------------------------------------------------------------------------
// Voice seam (Phase 2D-S4)
// ---------------------------------------------------------------------------

export interface VoiceSynthesisRequest {
  readonly surface_id: string;
  readonly segment_id: string;
  readonly text: string;
  readonly concept_id: string | null;
}

/** Out-of-band voice synthesis. Returns an artifact reference (never bytes) or null on unavailability. */
export interface VoiceSynthesizer {
  synthesize(request: VoiceSynthesisRequest): Promise<NarrationVoice | null>;
}

// ---------------------------------------------------------------------------
// SurfaceChoreographer
// ---------------------------------------------------------------------------

export interface SurfaceChoreographerDeps {
  readonly bus: EventBus;
  readonly clock?: Clock;
  readonly idGenerator?: IdGenerator;
  readonly nodeId?: string;
  /** Optional voice synthesis (Phase 2D-S4). Absent ⇒ text-only narration (deterministic). */
  readonly voice?: VoiceSynthesizer;
}

export interface PresenceInput {
  readonly surface_id: string;
  readonly agent_cid: string;
  readonly agent_id: string;
  readonly role: string;
  readonly state: AgentPresenceState;
  readonly block_id?: string | null;
}

export interface NarrateBlockInput {
  readonly surface_id: string;
  readonly block: CognitionBlock;
  readonly agent_cid: string;
  readonly agent_id: string;
  readonly role: string;
  readonly concept_id: string | null;
}

export interface NarrateInput {
  readonly surface_id: string;
  readonly block_id: string;
  readonly agent_cid: string;
  readonly agent_id: string;
  readonly role: string;
  readonly concept_id: string | null;
  /** The text to voice — generated dynamically (live model output), never a pre-authored script. */
  readonly texts: readonly string[];
}

/** One spoken segment of a Cognitive Frame's narration script (UCS, ADR-0030). */
export interface NarrateScriptSegmentInput {
  readonly text: string;
  /** The MCCR slot this segment discusses (a render hint). */
  readonly anchor_ref: string | null;
  /** The resolved MCCR element id to spotlight while speaking, or null for a whole-frame remark. */
  readonly element_id: string | null;
  readonly intent: string;
  /** When true, the choreographer holds after this segment (a teaching pause / time to work). */
  readonly pause_after?: boolean;
}

export interface NarrateScriptInput {
  readonly surface_id: string;
  readonly frame_id: string;
  readonly agent_cid: string;
  readonly agent_id: string;
  readonly role: string;
  readonly concept_id: string | null;
  readonly segments: readonly NarrateScriptSegmentInput[];
}

export class SurfaceChoreographer {
  private readonly bus: EventBus;
  private readonly clock: Clock;
  private readonly idGenerator: IdGenerator;
  private readonly voice: VoiceSynthesizer | undefined;
  private hlc: Hlc;
  private seq = 0;

  constructor(deps: SurfaceChoreographerDeps) {
    this.bus = deps.bus;
    this.clock = deps.clock ?? new SystemClock();
    this.idGenerator = deps.idGenerator ?? new CryptoIdGenerator();
    this.voice = deps.voice;
    this.hlc = hlcInit(deps.nodeId ?? "surface-choreographer");
  }

  /** Announce an agent's visible activity (the pub/sub presence seam). */
  async presence(input: PresenceInput): Promise<void> {
    await this.emit("surface.presence.updated", input.agent_cid, {
      surface_id: input.surface_id,
      agent_cid: input.agent_cid,
      agent_id: input.agent_id,
      role: input.role,
      state: input.state,
      block_id: input.block_id ?? null,
    });
  }

  /** Direct the surface's attention ("look here now"). */
  async focus(
    surfaceId: string,
    producerCid: string,
    focus: {
      target_type: "block" | "concept" | "region";
      target_id: string;
      reason: string;
      spotlight?: boolean;
    },
  ): Promise<void> {
    await this.emit("surface.focus.changed", producerCid, {
      surface_id: surfaceId,
      sequence: this.nextSeq(),
      focus: { ...focus, spotlight: focus.spotlight ?? true },
    });
  }

  /**
   * Voice dynamically-generated text, segment by segment: presence(speaking) → one narration
   * segment per chunk (each spotlighting the block, with an optional out-of-band voice artifact) →
   * presence(contributing). The text is LIVE model output (or a deepened layer from an interactive
   * ask), never a pre-authored script — this is the live classroom, not a frozen lesson. Emits
   * nothing when there is no text to speak.
   */
  async narrate(input: NarrateInput): Promise<void> {
    const chunks = input.texts.flatMap((t) => segmentNarration(t));
    if (chunks.length === 0) return;

    await this.presence({
      surface_id: input.surface_id,
      agent_cid: input.agent_cid,
      agent_id: input.agent_id,
      role: input.role,
      state: "speaking",
      block_id: input.block_id,
    });

    for (const text of chunks) {
      const segmentId = `seg-${this.idGenerator.hex(8)}`;
      const voice = this.voice
        ? await this.voice.synthesize({
            surface_id: input.surface_id,
            segment_id: segmentId,
            text,
            concept_id: input.concept_id,
          })
        : null;
      await this.emit("surface.narration.segment", input.agent_cid, {
        surface_id: input.surface_id,
        segment_id: segmentId,
        block_id: input.block_id,
        concept_id: input.concept_id,
        sequence: this.nextSeq(),
        text,
        focus: { target_type: "block", target_id: input.block_id, spotlight: true },
        reveal_ids: [],
        voice,
      });
      // Record the voice artifact in the canonical log (out-of-band bytes; SRF-004).
      if (voice) {
        await this.emit("surface.visual.generated", input.agent_cid, {
          surface_id: input.surface_id,
          block_id: input.block_id,
          artifact_id: voice.artifact_id,
          modality: "voice",
          provider_id: voice.provider_id,
        });
      }
    }

    await this.presence({
      surface_id: input.surface_id,
      agent_cid: input.agent_cid,
      agent_id: input.agent_id,
      role: input.role,
      state: "contributing",
      block_id: input.block_id,
    });
  }

  /**
   * Voice a Cognitive Frame's narration script (UCS, ADR-0030): one narration segment per script
   * segment, each spotlighting the MCCR element it discusses (`focus.target_type:"element"`), or the
   * whole frame when it has no anchor. The script is the SEPARATE spoken teaching — never the board's
   * MCCR text. Unlike `narrate()`, segments are not re-chunked: the composer already paced them, and
   * re-chunking would break the 1:1 anchor↔segment alignment. Emits nothing when there is no script.
   */
  async narrateScript(input: NarrateScriptInput): Promise<void> {
    const segments = input.segments.filter((s) => s.text.trim().length > 0);
    if (segments.length === 0) return;

    await this.presence({
      surface_id: input.surface_id,
      agent_cid: input.agent_cid,
      agent_id: input.agent_id,
      role: input.role,
      state: "speaking",
      block_id: null,
    });

    for (const seg of segments) {
      const segmentId = `seg-${this.idGenerator.hex(8)}`;
      const voice = this.voice
        ? await this.voice.synthesize({
            surface_id: input.surface_id,
            segment_id: segmentId,
            text: seg.text,
            concept_id: input.concept_id,
          })
        : null;
      const focus = seg.element_id
        ? {
            target_type: "element",
            target_id: seg.element_id,
            reason: `narration discusses ${seg.anchor_ref ?? "this element"}`,
            spotlight: true,
          }
        : {
            target_type: "frame",
            target_id: input.frame_id,
            reason: "frame overview",
            spotlight: true,
          };
      await this.emit("surface.narration.segment", input.agent_cid, {
        surface_id: input.surface_id,
        segment_id: segmentId,
        block_id: null,
        frame_id: input.frame_id,
        anchor_ref: seg.anchor_ref,
        intent: seg.intent,
        concept_id: input.concept_id,
        sequence: this.nextSeq(),
        text: seg.text,
        focus,
        reveal_ids: seg.element_id ? [seg.element_id] : [],
        pause_after: seg.pause_after === true,
        voice,
      });
      if (voice) {
        await this.emit("surface.visual.generated", input.agent_cid, {
          surface_id: input.surface_id,
          block_id: null,
          artifact_id: voice.artifact_id,
          modality: "voice",
          provider_id: voice.provider_id,
        });
      }
    }

    await this.presence({
      surface_id: input.surface_id,
      agent_cid: input.agent_cid,
      agent_id: input.agent_id,
      role: input.role,
      state: "contributing",
      block_id: null,
    });
  }

  /** Narrate a freshly-generated block (its summary + explanation layers). */
  async narrateBlock(input: NarrateBlockInput): Promise<void> {
    await this.narrate({
      surface_id: input.surface_id,
      block_id: input.block.block_id,
      agent_cid: input.agent_cid,
      agent_id: input.agent_id,
      role: input.role,
      concept_id: input.concept_id,
      texts: collectNarrationTexts(input.block),
    });
  }

  private nextSeq(): number {
    return this.seq++;
  }

  private async emit(
    eventType: string,
    producerCid: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const created = createEvent(
      {
        eventType,
        producerCid,
        producerType: "product.surface",
        payload,
        topic: `cos.${eventType}`,
        classification: "internal",
      },
      { clock: this.clock, hlc: this.hlc, idGenerator: this.idGenerator },
    );
    this.hlc = created.hlc;
    await this.bus.publish(created.event);
  }
}
