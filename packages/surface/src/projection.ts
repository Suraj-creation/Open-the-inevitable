/**
 * SurfaceProjection — the deterministic fold from surface.* events to SurfaceState.
 *
 * The event log is the canonical record of the surface; this fold is the replay primitive.
 * Given the same event sequence it produces byte-identical state. Unknown surface.* subtypes
 * fold into the version count only (forward compatibility). Non-surface events are ignored.
 *
 * Spec: spec/surface/cognitive-surface-runtime.md §4.3, §6.2, §7.
 */
import type { CognitiveEvent } from "@inevitable/protocols";

import type { CognitionBlock } from "./blocks";
import type { TimelineProjection } from "./timeline";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SurfaceRoutingRecord {
  readonly target_agent: string;
  readonly reason: string;
  readonly concept_id: string;
  readonly producer_cid: string;
  readonly hlc: string;
}

export interface SurfaceContributionRecord {
  readonly agent_cid: string;
  readonly agent_id: string;
  readonly block_ids: readonly string[];
  readonly packet_id: string | null;
}

// --- Choreography slice (Phase 2D, SRF-002 §4; ADR-0007) ---------------------
// These make cognition visible over time. They carry only logical order + durations,
// never a playback clock — the animation schedule is a client projection (ADR-0007).

export type FocusTargetType = "block" | "concept" | "region";

/** Directed attention: "look here now". */
export interface SurfaceFocus {
  readonly target_type: FocusTargetType;
  readonly target_id: string;
  readonly reason: string;
  readonly spotlight: boolean;
}

/** An out-of-band voice artifact reference (binaries never enter events — SRF-004). */
export interface NarrationVoice {
  readonly artifact_id: string;
  readonly content_ref: string;
  readonly duration_ms: number;
  readonly provider_id: string;
}

/** One unit of spoken/visible narration, in logical order. */
export interface NarrationSegment {
  readonly segment_id: string;
  readonly block_id: string | null;
  readonly concept_id: string | null;
  readonly sequence: number;
  readonly text: string;
  readonly focus: SurfaceFocus | null;
  readonly reveal_ids: readonly string[];
  readonly voice: NarrationVoice | null;
}

export type AgentPresenceState = "idle" | "thinking" | "contributing" | "speaking";

/** An agent as a first-class visible entity on the surface (the pub/sub seam). */
export interface AgentPresence {
  readonly agent_cid: string;
  readonly agent_id: string;
  readonly role: string;
  readonly state: AgentPresenceState;
  readonly block_id: string | null;
  readonly hlc: string;
}

/** A recorded multi-agent disagreement: two agents produced diverging proposals (P4.1, ADR-0018). */
export interface DisagreementRecord {
  readonly agent_cids: readonly string[];
  readonly topic: string;
  readonly concept_id: string;
  readonly resolution: { readonly winner: string; readonly reason: string };
  readonly hlc: string;
}

export interface SurfaceState {
  readonly surface_id: string;
  readonly session_id: string;
  readonly learner_cid: string;
  readonly status: "active" | "closed";
  readonly goal: string | null;
  readonly blocks: readonly CognitionBlock[];
  readonly timeline: TimelineProjection | null;
  readonly agents_joined: readonly string[];
  readonly contributions: readonly SurfaceContributionRecord[];
  readonly routing_decisions: readonly SurfaceRoutingRecord[];
  readonly narration: readonly NarrationSegment[];
  readonly focus: SurfaceFocus | null;
  readonly presence: readonly AgentPresence[];
  /** Multi-agent disagreements recorded on this surface (P4.1). Append-only for replay. */
  readonly disagreements: readonly DisagreementRecord[];
  readonly version: number;
  readonly last_hlc: string | null;
}

// ---------------------------------------------------------------------------
// Fold
// ---------------------------------------------------------------------------

interface MutableSurfaceState {
  surface_id: string;
  session_id: string;
  learner_cid: string;
  status: "active" | "closed";
  goal: string | null;
  blocks: CognitionBlock[];
  timeline: TimelineProjection | null;
  agents_joined: string[];
  contributions: SurfaceContributionRecord[];
  routing_decisions: SurfaceRoutingRecord[];
  narration: NarrationSegment[];
  focus: SurfaceFocus | null;
  presence: AgentPresence[];
  disagreements: DisagreementRecord[];
  version: number;
  last_hlc: string | null;
}

function readFocus(raw: Record<string, unknown> | undefined): SurfaceFocus | null {
  if (!raw) return null;
  return {
    target_type: (raw["target_type"] as FocusTargetType | undefined) ?? "block",
    target_id: (raw["target_id"] as string | undefined) ?? "",
    reason: (raw["reason"] as string | undefined) ?? "",
    spotlight: (raw["spotlight"] as boolean | undefined) ?? true,
  };
}

function payloadOf(event: CognitiveEvent): Record<string, unknown> {
  return (event.payload ?? {}) as Record<string, unknown>;
}

/**
 * Fold a sequence of events into the state of one surface.
 *
 * @param events bus-ordered events (e.g. `bus.replay({ subject: "surface.>" })`)
 * @param surfaceId the surface to fold; defaults to the first `surface.created` encountered
 * @returns the folded state, or null when no `surface.created` matches
 */
export function foldSurfaceEvents(
  events: readonly CognitiveEvent[],
  surfaceId?: string,
): SurfaceState | null {
  let state: MutableSurfaceState | null = null;

  for (const event of events) {
    if (!event.event_type.startsWith("surface.")) continue;
    const payload = payloadOf(event);
    const eventSurfaceId = payload["surface_id"] as string | undefined;

    if (state === null) {
      if (event.event_type !== "surface.created") continue;
      if (surfaceId !== undefined && eventSurfaceId !== surfaceId) continue;
      state = {
        surface_id: eventSurfaceId ?? "",
        session_id: (payload["session_id"] as string | undefined) ?? "",
        learner_cid: (payload["learner_cid"] as string | undefined) ?? "",
        status: "active",
        goal: (payload["goal"] as string | null | undefined) ?? null,
        blocks: [],
        timeline: null,
        agents_joined: [],
        contributions: [],
        routing_decisions: [],
        narration: [],
        focus: null,
        presence: [],
        disagreements: [],
        version: 1,
        last_hlc: event.hlc,
      };
      continue;
    }

    if (eventSurfaceId !== state.surface_id) continue;
    state.version += 1;
    state.last_hlc = event.hlc;

    switch (event.event_type) {
      case "surface.block.generated": {
        const block = payload["block"] as CognitionBlock | undefined;
        if (block) {
          // Enrich provenance with the announcing event id (set at fold time to avoid
          // a circular reference at creation time — spec §4.2).
          state.blocks.push({
            ...block,
            provenance: { ...block.provenance, source_event_id: event.event_id },
          });
        }
        break;
      }
      case "surface.block.modified": {
        const blockId = payload["block_id"] as string | undefined;
        const index = state.blocks.findIndex((b) => b.block_id === blockId);
        if (index >= 0) {
          const existing = state.blocks[index] as CognitionBlock;
          state.blocks[index] = {
            ...existing,
            version: (payload["version"] as number | undefined) ?? existing.version + 1,
            content:
              (payload["content"] as Record<string, unknown> | undefined) ?? existing.content,
          };
        }
        break;
      }
      case "surface.timeline.updated": {
        const projection = payload["projection"] as TimelineProjection | undefined;
        if (projection) state.timeline = projection;
        break;
      }
      case "surface.agent.joined": {
        const cid = payload["agent_cid"] as string | undefined;
        if (cid && !state.agents_joined.includes(cid)) state.agents_joined.push(cid);
        break;
      }
      case "surface.agent.contributed": {
        state.contributions.push({
          agent_cid: (payload["agent_cid"] as string | undefined) ?? "",
          agent_id: (payload["agent_id"] as string | undefined) ?? "",
          block_ids: (payload["block_ids"] as string[] | undefined) ?? [],
          packet_id: (payload["packet_id"] as string | null | undefined) ?? null,
        });
        break;
      }
      case "surface.reasoning.recorded": {
        const decision = payload["decision"] as Record<string, unknown> | undefined;
        state.routing_decisions.push({
          target_agent: (decision?.["target_agent"] as string | undefined) ?? "",
          reason: (decision?.["reason"] as string | undefined) ?? "",
          concept_id: (decision?.["concept_id"] as string | undefined) ?? "",
          producer_cid: (payload["producer_cid"] as string | undefined) ?? "",
          hlc: event.hlc,
        });
        break;
      }
      case "surface.memory.attached": {
        const blockId = payload["block_id"] as string | undefined;
        const mutationId = payload["mutation_id"] as string | undefined;
        const index = state.blocks.findIndex((b) => b.block_id === blockId);
        if (index >= 0 && mutationId) {
          const existing = state.blocks[index] as CognitionBlock;
          state.blocks[index] = {
            ...existing,
            provenance: { ...existing.provenance, memory_mutation_id: mutationId },
          };
        }
        break;
      }
      case "surface.explanation.expanded": {
        // Progressive deepening (F04 layers): expansion IS the typed modification — the fold
        // merges the deepened layers into the block and bumps its version. Spec §6.1 step 3.
        const blockId = payload["block_id"] as string | undefined;
        const layers = payload["layers"] as Record<string, unknown> | undefined;
        const index = state.blocks.findIndex((b) => b.block_id === blockId);
        if (index >= 0 && layers) {
          const existing = state.blocks[index] as CognitionBlock;
          const existingLayers =
            (existing.content["layers"] as Record<string, unknown> | undefined) ?? {};
          state.blocks[index] = {
            ...existing,
            version: existing.version + 1,
            content: { ...existing.content, layers: { ...existingLayers, ...layers } },
          };
        }
        break;
      }
      case "surface.narration.segment": {
        const segmentId = payload["segment_id"] as string | undefined;
        if (segmentId) {
          const focus = readFocus(payload["focus"] as Record<string, unknown> | undefined);
          const voiceRaw = payload["voice"] as Record<string, unknown> | undefined;
          const voice: NarrationVoice | null = voiceRaw
            ? {
                artifact_id: (voiceRaw["artifact_id"] as string | undefined) ?? "",
                content_ref: (voiceRaw["content_ref"] as string | undefined) ?? "",
                duration_ms: (voiceRaw["duration_ms"] as number | undefined) ?? 0,
                provider_id: (voiceRaw["provider_id"] as string | undefined) ?? "",
              }
            : null;
          state.narration.push({
            segment_id: segmentId,
            block_id: (payload["block_id"] as string | null | undefined) ?? null,
            concept_id: (payload["concept_id"] as string | null | undefined) ?? null,
            sequence: (payload["sequence"] as number | undefined) ?? state.narration.length,
            text: (payload["text"] as string | undefined) ?? "",
            focus,
            reveal_ids: (payload["reveal_ids"] as string[] | undefined) ?? [],
            voice,
          });
          // A narration segment that carries a focus directive also moves the surface's attention.
          if (focus) state.focus = focus;
        }
        break;
      }
      case "surface.focus.changed": {
        const focus = readFocus(payload["focus"] as Record<string, unknown> | undefined);
        if (focus) state.focus = focus;
        break;
      }
      case "surface.presence.updated": {
        const cid = payload["agent_cid"] as string | undefined;
        if (cid) {
          const presence: AgentPresence = {
            agent_cid: cid,
            agent_id: (payload["agent_id"] as string | undefined) ?? "",
            role: (payload["role"] as string | undefined) ?? "",
            state: (payload["state"] as AgentPresenceState | undefined) ?? "idle",
            block_id: (payload["block_id"] as string | null | undefined) ?? null,
            hlc: event.hlc,
          };
          const index = state.presence.findIndex((p) => p.agent_cid === cid);
          if (index >= 0) state.presence[index] = presence;
          else state.presence.push(presence);
        }
        break;
      }
      case "surface.session.closed": {
        state.status = "closed";
        break;
      }
      case "surface.agent.disagreed": {
        const resolution = payload["resolution"] as Record<string, unknown> | undefined;
        state.disagreements.push({
          agent_cids: (payload["agent_cids"] as string[] | undefined) ?? [],
          topic: (payload["topic"] as string | undefined) ?? "",
          concept_id: (payload["concept_id"] as string | undefined) ?? "",
          resolution: {
            winner: (resolution?.["winner"] as string | undefined) ?? "",
            reason: (resolution?.["reason"] as string | undefined) ?? "",
          },
          hlc: event.hlc,
        });
        break;
      }
      default:
        // Forward-compatible: unknown surface.* subtypes (and non-state events like
        // surface.timeline.generated / surface.visual.generated) count toward version only.
        break;
    }
  }

  return state;
}
