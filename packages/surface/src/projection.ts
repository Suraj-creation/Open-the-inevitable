/**
 * SurfaceProjection — the deterministic fold from surface.* events to SurfaceState.
 *
 * The event log is the canonical record of the surface; this fold is the replay primitive.
 * Given the same event sequence it produces byte-identical state. Unknown surface.* subtypes
 * fold into the version count only (forward compatibility). Non-surface events are ignored.
 *
 * Spec: spec/surface/cognitive-surface-runtime.md §4.3, §6.2, §7.
 */
import type { EvaluationRecord } from "@inevitable/evaluation";
import type { ProductMode } from "@inevitable/product-cognition";
import type { CognitiveEvent } from "@inevitable/protocols";

import type { CognitionBlock } from "./blocks";
import {
  type CognitiveFrame,
  type ImageDecisionRecord,
  type Mccr,
  type NarrationIntent,
  type NarrationScriptRecord,
  type StreamingFrameElementBuffer,
  readFrameLayout,
  readFrameProvenance,
  readMccr,
  readNarrationScriptSegments,
} from "./frames";
import type { TimelineProjection } from "./timeline";

export type { EvaluationRecord, ProductMode };

/** The active projection rendered on this surface: temporal cognitive graph or spatial scene canvas (S4.4). */
export type ProjectionMode = "timeline" | "scene";

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

export type FocusTargetType = "block" | "concept" | "region" | "element" | "frame";

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
  /** The Cognitive Frame this segment voices, when on the frame path (UCS, ADR-0030). */
  readonly frame_id: string | null;
  /** The MCCR slot this segment discusses (a render hint; the resolved element is in `focus`). */
  readonly anchor_ref: string | null;
  /** The pedagogical intent of this spoken segment. */
  readonly intent: NarrationIntent | null;
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

/** A surfaced proposal from an ensemble agent — competing cognition made visible (S1.2, ADR-0025). */
export interface ProposalRecord {
  readonly proposal_id: string;
  readonly agent_cid: string;
  readonly agent_id: string;
  readonly topic: string;
  readonly summary: string;
  readonly confidence: number;
  readonly hlc: string;
}

/** The arbiter's synthesis over a topic's ensemble proposals (S1.2, ADR-0025). */
export interface SynthesisRecord {
  readonly topic: string;
  readonly chosen_proposal_ids: readonly string[];
  readonly block_ids: readonly string[];
  readonly rationale: string;
  readonly producer_cid: string;
  readonly hlc: string;
}

export type InteractionKind =
  | "interrupt"
  | "jump"
  | "branch"
  | "challenge"
  | "request_depth"
  | "request_simplify"
  | "request_example";

/**
 * One depth-gate evaluation recorded on the surface (S2.2, F14). Folded from
 * `surface.assessment.gate.evaluated`; one record per concept per ask cycle.
 */
export interface DepthGateRecord {
  readonly concept_id: string;
  readonly passed: boolean;
  readonly passed_count: number;
  readonly total_count: number;
  readonly tests: readonly {
    readonly kind: string;
    readonly passed: boolean;
    readonly confidence: number;
    readonly evidence: string;
  }[];
  readonly hlc: string;
}

/**
 * A prerequisite-descent cycle recorded on the surface (S2.3, F03). Folded from
 * `surface.prerequisite.descent.started` / `surface.prerequisite.descent.completed`.
 * Signals that the loop detected confusion and remediated by visiting a prerequisite concept.
 */
export interface PrerequisiteDescentRecord {
  readonly from_concept_id: string;
  readonly to_concept_id: string;
  readonly trigger: "depth_gate_failed" | "low_confidence";
  readonly completed: boolean;
  readonly hlc: string;
}

/**
 * A research frontier detected and/or surfaced after verified mastery (S3.1, F10, ADR-0026).
 * Folded from `surface.research.frontier.detected` (pre-dispatch D3 record) and
 * `surface.research.frontier.surfaced` (post-dispatch with frontier content). Deferred events
 * (`surface.research.frontier.deferred`) contribute to the version count only.
 */
export interface ResearchFrontierRecord {
  readonly concept_id: string;
  readonly trigger_confidence: number;
  readonly trigger_gate_passed: boolean;
  readonly surfaced: boolean;
  readonly hlc: string;
}

/** A governed learner interaction — the canonical record of *how the learner engaged* (S1.3, ADR-0024). */
export interface InteractionRecord {
  readonly interaction_id: string;
  readonly kind: InteractionKind;
  readonly target_id: string | null;
  /** Set by `surface.interaction.applied`: how the runtime realized the intent. */
  readonly effect: "cancelled" | "refocused" | "dispatched" | "reprojected" | null;
  readonly reason: string | null;
  readonly hlc: string;
}

// --- Streaming & agent-observability slice (S-UCS, SRF-002; ADR-0028/0029) ---
// Make generation and reasoning visible as they happen. `streaming_blocks` is transient (cleared
// by the whole-block event); reasoning/timing carry order + durations, never a playback clock.

/** A transient buffer of in-flight streamed block text, cleared by `surface.block.generated` (ADR-0028). */
export interface StreamingBlockBuffer {
  readonly block_id: string;
  readonly text: string;
  readonly last_seq: number;
}

/** A surfaced summary of an agent's reasoning trace, for the Agent Observatory (ADR-0029). */
export interface AgentReasoningRecord {
  readonly agent_cid: string;
  readonly agent_id: string;
  readonly packet_id: string | null;
  readonly work_id: string | null;
  readonly task_interpretation: string;
  readonly strategy: string;
  readonly decision: string;
  readonly self_critique: string | null;
  readonly confidence: number;
  readonly determinism_level: string;
  readonly hlc: string;
}

export type AgentWorkStatus = "admitted" | "dispatched" | "executing" | "completed" | "failed";

/** An agent work item's lifecycle + real latency, upserted by `work_id` (ADR-0029). */
export interface AgentWorkTimingRecord {
  readonly agent_cid: string;
  readonly agent_id: string;
  readonly work_id: string;
  readonly packet_id: string | null;
  readonly work_type: string;
  readonly status: AgentWorkStatus;
  readonly queue_wait_ms: number | null;
  readonly execution_ms: number | null;
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
  /** Transient in-flight streamed block text, cleared by the whole-block event (S-UCS, ADR-0028). */
  readonly streaming_blocks: readonly StreamingBlockBuffer[];
  /** Surfaced per-contribution reasoning summaries (S-UCS, ADR-0029). Append-only for replay. */
  readonly agent_reasoning: readonly AgentReasoningRecord[];
  /** Per-work-item lifecycle + latency, upserted by work_id (S-UCS, ADR-0029). */
  readonly agent_work_timings: readonly AgentWorkTimingRecord[];
  /** Canonical Cognitive Frame line, upserted by frame_id (UCS, ADR-0030). Render-sort by ordinal. */
  readonly frames: readonly CognitiveFrame[];
  /** Discardable look-ahead frames, upserted by frame_id; never shown until promoted (UCS, ADR-0030). */
  readonly speculative_frames: readonly CognitiveFrame[];
  /** Separate spoken-teaching scripts, upserted by script_id (UCS, ADR-0030). */
  readonly narration_scripts: readonly NarrationScriptRecord[];
  /** Whether-an-image-helps decisions, append-only (UCS, ADR-0030). */
  readonly image_decisions: readonly ImageDecisionRecord[];
  /** Transient in-flight streamed MCCR element text, cleared by surface.frame.composed (UCS, ADR-0030). */
  readonly streaming_frame_elements: readonly StreamingFrameElementBuffer[];
  /** Multi-agent disagreements recorded on this surface (P4.1). Append-only for replay. */
  readonly disagreements: readonly DisagreementRecord[];
  /** Ensemble proposals surfaced on this surface (S1.2). Append-only for replay. */
  readonly proposals: readonly ProposalRecord[];
  /** Arbiter syntheses over ensemble proposals (S1.2). Append-only for replay. */
  readonly syntheses: readonly SynthesisRecord[];
  /** Governed learner interactions on this surface (S1.3). Append-only for replay. */
  readonly interactions: readonly InteractionRecord[];
  /** Depth-gate evaluation outcomes per concept (S2.2, F14). Append-only for replay. */
  readonly depth_gates: readonly DepthGateRecord[];
  /** Prerequisite-descent cycles triggered by confusion (S2.3, F03). Append-only for replay. */
  readonly prerequisite_descents: readonly PrerequisiteDescentRecord[];
  /** Research frontiers detected and/or surfaced after verified mastery (S3.1, F10). Append-only for replay. */
  readonly research_frontiers: readonly ResearchFrontierRecord[];
  /** Whether a motivation block was surfaced this session after marginal mastery (S3.3). */
  readonly motivation_surfaced: boolean;
  /** Cognitive evaluation records for reasoning cycles this session (S4.2, ADR-0027). Append-only for replay. */
  readonly evaluation_records: readonly EvaluationRecord[];
  /** The product mode this surface session is operating under (S4.3). Defaults to "student". */
  readonly mode: ProductMode;
  /** The active projection layer on this surface: timeline-graph or scene-graph canvas (S4.4). Defaults to "timeline". */
  readonly current_projection: ProjectionMode;
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
  streaming_blocks: StreamingBlockBuffer[];
  agent_reasoning: AgentReasoningRecord[];
  agent_work_timings: AgentWorkTimingRecord[];
  frames: CognitiveFrame[];
  speculative_frames: CognitiveFrame[];
  narration_scripts: NarrationScriptRecord[];
  image_decisions: ImageDecisionRecord[];
  streaming_frame_elements: StreamingFrameElementBuffer[];
  disagreements: DisagreementRecord[];
  proposals: ProposalRecord[];
  syntheses: SynthesisRecord[];
  interactions: InteractionRecord[];
  depth_gates: DepthGateRecord[];
  prerequisite_descents: PrerequisiteDescentRecord[];
  research_frontiers: ResearchFrontierRecord[];
  motivation_surfaced: boolean;
  evaluation_records: EvaluationRecord[];
  mode: ProductMode;
  current_projection: ProjectionMode;
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

/** Upsert a Cognitive Frame into a list by frame_id (UCS, ADR-0030). */
function upsertFrame(list: CognitiveFrame[], frame: CognitiveFrame): void {
  const i = list.findIndex((f) => f.frame_id === frame.frame_id);
  if (i >= 0) list[i] = frame;
  else list.push(frame);
}

/** Read a full MCCR from a payload when present, else null (planned/speculative may lack content). */
function readMccrOrNull(raw: Record<string, unknown> | undefined, frameId: string): Mccr | null {
  return raw ? readMccr(raw, frameId) : null;
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
        streaming_blocks: [],
        agent_reasoning: [],
        agent_work_timings: [],
        frames: [],
        speculative_frames: [],
        narration_scripts: [],
        image_decisions: [],
        streaming_frame_elements: [],
        disagreements: [],
        proposals: [],
        syntheses: [],
        interactions: [],
        depth_gates: [],
        prerequisite_descents: [],
        research_frontiers: [],
        motivation_surfaced: false,
        evaluation_records: [],
        mode: (payload["mode"] as ProductMode | undefined) ?? "student",
        current_projection: "timeline",
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
          // S-UCS: the canonical whole block supersedes any streaming buffer for it, so the
          // settled state is identical whether or not deltas streamed (ADR-0028, replay equivalence).
          const streamIndex = state.streaming_blocks.findIndex(
            (s) => s.block_id === block.block_id,
          );
          if (streamIndex >= 0) state.streaming_blocks.splice(streamIndex, 1);
        }
        break;
      }
      case "surface.block.delta": {
        // S-UCS streaming: accumulate ordered chunks into the transient buffer (ADR-0028). The
        // buffer is cleared by surface.block.generated, so it never affects settled state.
        const blockId = payload["block_id"] as string | undefined;
        if (blockId) {
          const delta = (payload["text_delta"] as string | undefined) ?? "";
          const seq = (payload["seq"] as number | undefined) ?? 0;
          const index = state.streaming_blocks.findIndex((s) => s.block_id === blockId);
          if (index >= 0) {
            const existing = state.streaming_blocks[index] as StreamingBlockBuffer;
            state.streaming_blocks[index] = {
              block_id: blockId,
              text: existing.text + delta,
              last_seq: seq,
            };
          } else {
            state.streaming_blocks.push({ block_id: blockId, text: delta, last_seq: seq });
          }
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
      case "surface.graph.entrypoint.changed": {
        const ep = payload["entry_point"] as TimelineProjection["entry_point"] | undefined;
        if (state.timeline && ep) state.timeline = { ...state.timeline, entry_point: ep };
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
            frame_id: (payload["frame_id"] as string | null | undefined) ?? null,
            anchor_ref: (payload["anchor_ref"] as string | null | undefined) ?? null,
            intent: (payload["intent"] as NarrationIntent | null | undefined) ?? null,
          });
          // A narration segment that carries a focus directive also moves the surface's attention.
          if (focus) state.focus = focus;
          // UCS (ADR-0030): link the segment to the frame it voices, in order.
          const frameId = payload["frame_id"] as string | undefined;
          if (frameId) {
            const fi = state.frames.findIndex((fr) => fr.frame_id === frameId);
            if (fi >= 0) {
              const fr = state.frames[fi] as CognitiveFrame;
              state.frames[fi] = { ...fr, segment_ids: [...fr.segment_ids, segmentId] };
            }
          }
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
      case "surface.agent.reasoning.summary": {
        // S-UCS: a structured summary of an agent's reasoning trace, for the Observatory (ADR-0029).
        state.agent_reasoning.push({
          agent_cid: (payload["agent_cid"] as string | undefined) ?? "",
          agent_id: (payload["agent_id"] as string | undefined) ?? "",
          packet_id: (payload["packet_id"] as string | null | undefined) ?? null,
          work_id: (payload["work_id"] as string | null | undefined) ?? null,
          task_interpretation: (payload["task_interpretation"] as string | undefined) ?? "",
          strategy: (payload["strategy"] as string | undefined) ?? "",
          decision: (payload["decision"] as string | undefined) ?? "",
          self_critique: (payload["self_critique"] as string | null | undefined) ?? null,
          confidence: (payload["confidence"] as number | undefined) ?? 0,
          determinism_level: (payload["determinism_level"] as string | undefined) ?? "",
          hlc: event.hlc,
        });
        break;
      }
      case "surface.agent.work.timing": {
        // S-UCS: an agent work item's lifecycle + real latency, upserted by work_id (ADR-0029).
        const workId = payload["work_id"] as string | undefined;
        if (workId) {
          const record: AgentWorkTimingRecord = {
            agent_cid: (payload["agent_cid"] as string | undefined) ?? "",
            agent_id: (payload["agent_id"] as string | undefined) ?? "",
            work_id: workId,
            packet_id: (payload["packet_id"] as string | null | undefined) ?? null,
            work_type: (payload["work_type"] as string | undefined) ?? "",
            status: (payload["status"] as AgentWorkStatus | undefined) ?? "completed",
            queue_wait_ms: (payload["queue_wait_ms"] as number | null | undefined) ?? null,
            execution_ms: (payload["execution_ms"] as number | null | undefined) ?? null,
            hlc: event.hlc,
          };
          const index = state.agent_work_timings.findIndex((t) => t.work_id === workId);
          if (index >= 0) state.agent_work_timings[index] = record;
          else state.agent_work_timings.push(record);
        }
        break;
      }
      case "surface.frame.planned": {
        // UCS (ADR-0030): reserve a frame's layout before content lands. Never downgrade a
        // composed/promoted frame back to planned (ordering law 8).
        const frameId = payload["frame_id"] as string | undefined;
        if (frameId) {
          const existing = state.frames.find((fr) => fr.frame_id === frameId);
          if (!existing || existing.status === "planned") {
            upsertFrame(state.frames, {
              frame_id: frameId,
              surface_id: state.surface_id,
              ordinal: (payload["ordinal"] as number | undefined) ?? 0,
              status: "planned",
              concept_id: (payload["concept_id"] as string | null | undefined) ?? null,
              title: (payload["title"] as string | undefined) ?? "",
              layout: readFrameLayout(
                payload["mccr_layout"] as Record<string, unknown> | undefined,
              ),
              mccr: null,
              segment_ids: [],
              speculative_of: null,
              invalidation_reason: null,
              trigger_assumption: null,
              provenance: {
                ...readFrameProvenance(payload),
                source_event_id: event.event_id,
              },
              version: 0,
              hlc: event.hlc,
            });
          }
        }
        break;
      }
      case "surface.frame.composed": {
        // UCS (ADR-0030): the frame's full MCCR lands; upsert by frame_id, status composed.
        const frameId = payload["frame_id"] as string | undefined;
        if (frameId) {
          const existing = state.frames.find((fr) => fr.frame_id === frameId);
          upsertFrame(state.frames, {
            frame_id: frameId,
            surface_id: state.surface_id,
            ordinal: (payload["ordinal"] as number | undefined) ?? existing?.ordinal ?? 0,
            status: "composed",
            concept_id:
              (payload["concept_id"] as string | null | undefined) ?? existing?.concept_id ?? null,
            title: (payload["title"] as string | undefined) ?? existing?.title ?? "",
            layout:
              readFrameLayout(payload["mccr_layout"] as Record<string, unknown> | undefined) ??
              existing?.layout ??
              null,
            mccr: readMccr(payload["mccr"] as Record<string, unknown> | undefined, frameId),
            segment_ids: existing?.segment_ids ?? [],
            speculative_of: existing?.speculative_of ?? null,
            invalidation_reason: null,
            trigger_assumption: existing?.trigger_assumption ?? null,
            provenance: {
              ...readFrameProvenance(payload),
              source_event_id: event.event_id,
            },
            version: 1,
            hlc: event.hlc,
          });
          // Clear transient element buffers for this frame: settled state is delta-independent
          // (UCS replay equivalence, mirrors ADR-0028).
          state.streaming_frame_elements = state.streaming_frame_elements.filter(
            (b) => b.frame_id !== frameId,
          );
        }
        break;
      }
      case "surface.frame.element.delta": {
        // UCS (ADR-0030): accumulate streamed MCCR element text into the transient buffer. The
        // buffer is cleared by surface.frame.composed, so it never affects settled state.
        const frameId = payload["frame_id"] as string | undefined;
        const elementId = payload["element_id"] as string | undefined;
        if (frameId && elementId) {
          const delta = (payload["text_delta"] as string | undefined) ?? "";
          const seq = (payload["seq"] as number | undefined) ?? 0;
          const index = state.streaming_frame_elements.findIndex(
            (b) => b.frame_id === frameId && b.element_id === elementId,
          );
          if (index >= 0) {
            const existing = state.streaming_frame_elements[index] as StreamingFrameElementBuffer;
            state.streaming_frame_elements[index] = {
              frame_id: frameId,
              element_id: elementId,
              text: existing.text + delta,
              last_seq: seq,
            };
          } else {
            state.streaming_frame_elements.push({
              frame_id: frameId,
              element_id: elementId,
              text: delta,
              last_seq: seq,
            });
          }
        }
        break;
      }
      case "surface.narration.script.produced": {
        // UCS (ADR-0030): the separate spoken-teaching script for a frame. Upsert by script_id.
        const scriptId = payload["script_id"] as string | undefined;
        const frameId = payload["frame_id"] as string | undefined;
        if (scriptId && frameId) {
          const record: NarrationScriptRecord = {
            script_id: scriptId,
            frame_id: frameId,
            segments: readNarrationScriptSegments(payload["segments"]),
            hlc: event.hlc,
          };
          const index = state.narration_scripts.findIndex((s) => s.script_id === scriptId);
          if (index >= 0) state.narration_scripts[index] = record;
          else state.narration_scripts.push(record);
        }
        break;
      }
      case "surface.image.decided": {
        // UCS (ADR-0030): the whether-an-image-helps decision (append-only, observable).
        const frameId = payload["frame_id"] as string | undefined;
        if (frameId) {
          state.image_decisions.push({
            frame_id: frameId,
            helps: (payload["helps"] as boolean | undefined) ?? false,
            modality: (payload["modality"] as "image" | "none" | undefined) ?? "none",
            prompt: (payload["prompt"] as string | null | undefined) ?? null,
            rationale: (payload["rationale"] as string | undefined) ?? "",
            hlc: event.hlc,
          });
        }
        break;
      }
      case "surface.frame.speculation.prepared": {
        // UCS (ADR-0030): a discardable look-ahead frame. Lives in speculative_frames[] until
        // promoted; never rendered as on-screen state.
        const frameId = payload["frame_id"] as string | undefined;
        if (frameId) {
          upsertFrame(state.speculative_frames, {
            frame_id: frameId,
            surface_id: state.surface_id,
            ordinal: (payload["ordinal"] as number | undefined) ?? 0,
            status: "speculative",
            concept_id: (payload["concept_id"] as string | null | undefined) ?? null,
            title: (payload["title"] as string | undefined) ?? "",
            layout: readFrameLayout(payload["mccr_layout"] as Record<string, unknown> | undefined),
            mccr: readMccrOrNull(payload["mccr"] as Record<string, unknown> | undefined, frameId),
            segment_ids: [],
            speculative_of: (payload["speculative_of"] as string | null | undefined) ?? null,
            invalidation_reason: null,
            trigger_assumption:
              (payload["trigger_assumption"] as string | null | undefined) ?? null,
            provenance: {
              ...readFrameProvenance(payload),
              source_event_id: event.event_id,
            },
            version: 0,
            hlc: event.hlc,
          });
        }
        break;
      }
      case "surface.frame.speculation.invalidated": {
        // UCS (ADR-0030): a prepared speculative frame no longer matches; mark it invalidated.
        // Never copied into frames[] — provably absent from on-screen state.
        const frameId = payload["frame_id"] as string | undefined;
        const index = state.speculative_frames.findIndex((f) => f.frame_id === frameId);
        if (index >= 0) {
          const existing = state.speculative_frames[index] as CognitiveFrame;
          state.speculative_frames[index] = {
            ...existing,
            status: "invalidated",
            invalidation_reason: (payload["reason"] as string | undefined) ?? "",
            hlc: event.hlc,
          };
        }
        break;
      }
      case "surface.frame.promoted": {
        // UCS (ADR-0030): a speculative frame matched a real signal — copy it into the canonical
        // frame line with a final ordinal, and mark the speculative entry promoted.
        const frameId = payload["frame_id"] as string | undefined;
        const index = state.speculative_frames.findIndex((f) => f.frame_id === frameId);
        if (frameId && index >= 0) {
          const spec = state.speculative_frames[index] as CognitiveFrame;
          const finalOrdinal = (payload["ordinal"] as number | undefined) ?? spec.ordinal;
          upsertFrame(state.frames, {
            ...spec,
            status: "promoted",
            ordinal: finalOrdinal,
            speculative_of: frameId,
            hlc: event.hlc,
          });
          state.speculative_frames[index] = { ...spec, status: "promoted", hlc: event.hlc };
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
      case "surface.proposal.proposed": {
        const proposalId = payload["proposal_id"] as string | undefined;
        if (proposalId) {
          state.proposals.push({
            proposal_id: proposalId,
            agent_cid: (payload["agent_cid"] as string | undefined) ?? "",
            agent_id: (payload["agent_id"] as string | undefined) ?? "",
            topic: (payload["topic"] as string | undefined) ?? "",
            summary: (payload["summary"] as string | undefined) ?? "",
            confidence: (payload["confidence"] as number | undefined) ?? 0,
            hlc: event.hlc,
          });
        }
        break;
      }
      case "surface.synthesis.recorded": {
        state.syntheses.push({
          topic: (payload["topic"] as string | undefined) ?? "",
          chosen_proposal_ids: (payload["chosen_proposal_ids"] as string[] | undefined) ?? [],
          block_ids: (payload["block_ids"] as string[] | undefined) ?? [],
          rationale: (payload["rationale"] as string | undefined) ?? "",
          producer_cid: (payload["producer_cid"] as string | undefined) ?? "",
          hlc: event.hlc,
        });
        break;
      }
      case "surface.interaction.received": {
        const interactionId = payload["interaction_id"] as string | undefined;
        if (interactionId) {
          state.interactions.push({
            interaction_id: interactionId,
            kind: (payload["kind"] as InteractionRecord["kind"] | undefined) ?? "jump",
            target_id: (payload["target_id"] as string | null | undefined) ?? null,
            effect: null,
            reason: null,
            hlc: event.hlc,
          });
        }
        break;
      }
      case "surface.interaction.applied": {
        const interactionId = payload["interaction_id"] as string | undefined;
        const index = state.interactions.findIndex((i) => i.interaction_id === interactionId);
        if (index >= 0) {
          const existing = state.interactions[index] as InteractionRecord;
          state.interactions[index] = {
            ...existing,
            effect:
              (payload["effect"] as InteractionRecord["effect"] | undefined) ?? existing.effect,
            reason: (payload["reason"] as string | undefined) ?? existing.reason,
          };
        }
        break;
      }
      case "surface.assessment.gate.evaluated": {
        // Depth-gate outcome for a concept (S2.2, F14). One record per concept per cycle.
        const conceptId = payload["concept_id"] as string | undefined;
        if (conceptId) {
          const rawTests = (payload["tests"] as unknown[]) ?? [];
          state.depth_gates.push({
            concept_id: conceptId,
            passed: (payload["passed"] as boolean | undefined) ?? false,
            passed_count: (payload["passed_count"] as number | undefined) ?? 0,
            total_count: (payload["total_count"] as number | undefined) ?? 0,
            tests: rawTests.map((t) => {
              const tr = t as Record<string, unknown>;
              return {
                kind: (tr["kind"] as string | undefined) ?? "",
                passed: (tr["passed"] as boolean | undefined) ?? false,
                confidence: (tr["confidence"] as number | undefined) ?? 0,
                evidence: (tr["evidence"] as string | undefined) ?? "",
              };
            }),
            hlc: event.hlc,
          });
        }
        break;
      }
      case "surface.prerequisite.descent.started": {
        // Prerequisite-descent initiated (S2.3, F03): confusion detected, sub-cycle beginning.
        const fromId = payload["from_concept_id"] as string | undefined;
        const toId = payload["to_concept_id"] as string | undefined;
        if (fromId && toId) {
          state.prerequisite_descents.push({
            from_concept_id: fromId,
            to_concept_id: toId,
            trigger:
              (payload["trigger"] as PrerequisiteDescentRecord["trigger"] | undefined) ??
              "depth_gate_failed",
            completed: false,
            hlc: event.hlc,
          });
        }
        break;
      }
      case "surface.prerequisite.descent.completed": {
        // Mark the most-recent matching descent record as completed.
        const fromId = payload["from_concept_id"] as string | undefined;
        const toId = payload["to_concept_id"] as string | undefined;
        if (fromId && toId) {
          for (let j = state.prerequisite_descents.length - 1; j >= 0; j--) {
            const d = state.prerequisite_descents[j];
            if (d && d.from_concept_id === fromId && d.to_concept_id === toId && !d.completed) {
              state.prerequisite_descents[j] = { ...d, completed: true };
              break;
            }
          }
        }
        break;
      }
      case "surface.research.frontier.detected": {
        // D3 pre-dispatch record: readiness confirmed, research agent will be dispatched (S3.1).
        const conceptId = payload["concept_id"] as string | undefined;
        if (conceptId) {
          state.research_frontiers.push({
            concept_id: conceptId,
            trigger_confidence: (payload["confidence"] as number | undefined) ?? 0,
            trigger_gate_passed: (payload["gate_passed"] as boolean | undefined) ?? false,
            surfaced: false,
            hlc: event.hlc,
          });
        }
        break;
      }
      case "surface.research.frontier.surfaced": {
        // Research agent dispatched and frontier block recorded (S3.2). Mark last matching
        // detection record as surfaced; creates a new record if no prior detection (edge case).
        const conceptId = payload["concept_id"] as string | undefined;
        if (conceptId) {
          let found = false;
          for (let j = state.research_frontiers.length - 1; j >= 0; j--) {
            const r = state.research_frontiers[j];
            if (r && r.concept_id === conceptId && !r.surfaced) {
              state.research_frontiers[j] = { ...r, surfaced: true };
              found = true;
              break;
            }
          }
          if (!found) {
            state.research_frontiers.push({
              concept_id: conceptId,
              trigger_confidence: (payload["confidence"] as number | undefined) ?? 0,
              trigger_gate_passed: (payload["gate_passed"] as boolean | undefined) ?? false,
              surfaced: true,
              hlc: event.hlc,
            });
          }
        }
        break;
      }
      case "surface.motivation.surfaced": {
        state.motivation_surfaced = true;
        break;
      }
      case "surface.mode.set": {
        // S4.3: surface mode set or changed (educator/researcher/institution/student/open).
        const m = payload["mode"] as ProductMode | undefined;
        if (m) state.mode = m;
        break;
      }
      case "surface.evaluation.recorded": {
        // Cognitive evaluation record for a reasoning cycle (S4.2, ADR-0027). Append-only.
        const conceptId = payload["concept_id"] as string | undefined;
        const scorecardId = payload["scorecard_id"] as string | undefined;
        if (conceptId && scorecardId) {
          state.evaluation_records.push({
            concept_id: conceptId,
            scorecard_id: scorecardId,
            score: (payload["score"] as number | undefined) ?? 0,
            passed: (payload["passed"] as boolean | undefined) ?? false,
            dimension_scores:
              (payload["dimension_scores"] as EvaluationRecord["dimension_scores"] | undefined) ??
              [],
            hlc: (payload["hlc"] as string | undefined) ?? event.hlc,
          });
        }
        break;
      }
      case "surface.projection.switched": {
        // S4.4: learner toggled the surface projection layer.
        const to = payload["to"] as ProjectionMode | undefined;
        if (to === "timeline" || to === "scene") state.current_projection = to;
        break;
      }
      case "surface.scene.block.placed": {
        // S4.4: block spatial position recorded for observability only (D5: layout non-canonical).
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
