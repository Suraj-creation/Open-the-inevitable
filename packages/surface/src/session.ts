/**
 * SurfaceSession — the live Cognitive Surface session.
 *
 * Open one session, ask one question, watch the surface evolve: the session composes the
 * existing substrate (FiberedLearningLoop → supervisor routing → governed agent dispatches →
 * mastery recording) and manifests every step as Cognition Blocks on a living timeline.
 *
 * Canonical state = the surface.* event log + world-state graph. `state()` is a fold over
 * the bus replay; the session stores no render state of its own.
 *
 * Spec: spec/surface/cognitive-surface-runtime.md §4.4, §6.1.
 */
import type { CognitiveEvaluationEngine, ScorecardContext } from "@inevitable/evaluation";
import { createEvent, type EventBus } from "@inevitable/events";
import type {
  ConceptSeed,
  FiberedLearningLoop,
  FiberedLearningLoopResult,
  LearningLoopMasteryInput,
  OnboardingSession,
  ProductDispatchInput,
  ProductDispatchResult,
  SupervisorRoutingDecision,
} from "@inevitable/product-cognition";
import type { CognitiveEvent, ReasoningTrace } from "@inevitable/protocols";
import {
  CosError,
  CryptoIdGenerator,
  SystemClock,
  err,
  hlcInit,
  ok,
  type Clock,
  type Hlc,
  type IdGenerator,
  type Result,
} from "@inevitable/shared";
import type { WorldStateGraph } from "@inevitable/world-state";

import type { CognitionBlock } from "./blocks";
import { MCCR_ELEMENT_TYPES, type MccrElementType } from "./frames";
import { AgentContributionRuntime, contributionFromDispatch } from "./contribution";
import { SurfaceChoreographer, type VoiceSynthesizer } from "./narration";
import type { MediaGenerator } from "./providers";
import { foldSurfaceEvents, type SurfaceState } from "./projection";
import { SurfaceTimelineBuilder, type TimelineProjection } from "./timeline";
import { traceBlock, type BlockTrace } from "./trace";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Structural view of a governed dispatcher (ProductRuntimeDispatcher satisfies it). */
export interface GovernedDispatcher {
  dispatch(input: ProductDispatchInput): Promise<Result<ProductDispatchResult, CosError>>;
}

/**
 * Split an explanation block's narratable text into ordered reveal chunks (~5 words each) for
 * progressive streaming (S-UCS, ADR-0028). Whitespace tokens are preserved so concatenating the chunks
 * reproduces the source text exactly — the streamed deltas reconstruct what the whole block carries.
 */
function revealChunks(content: Record<string, unknown>): string[] {
  const layers = content["layers"] as Record<string, unknown> | undefined;
  const summary = typeof content["summary"] === "string" ? (content["summary"] as string) : "";
  const layer0 =
    layers && typeof layers["layer_0"] === "string" ? (layers["layer_0"] as string) : "";
  const text = typeof content["text"] === "string" ? (content["text"] as string) : "";
  const source = summary || layer0 || text;
  if (!source) return [];
  const tokens = source.split(/(\s+)/);
  const chunks: string[] = [];
  let buf = "";
  let words = 0;
  for (const tok of tokens) {
    buf += tok;
    if (tok.trim().length > 0) {
      words += 1;
      if (words >= 5) {
        chunks.push(buf);
        buf = "";
        words = 0;
      }
    }
  }
  if (buf) chunks.push(buf);
  return chunks;
}

// ---------------------------------------------------------------------------
// Frame-plan helpers (UCS, ADR-0030; Phase 2). Defensive readers over plain-JSON packet content,
// so the surface package stays decoupled from the planner unit's internals.
// ---------------------------------------------------------------------------

/** One planned Cognitive Frame: its title, teaching angle, layout archetype, and reserved slots. */
interface FramePlanEntry {
  readonly title: string;
  readonly sub_focus: string;
  readonly archetype: string;
  readonly slots: readonly string[];
  readonly intent: string;
}

const DEFAULT_PLAN_SLOTS: readonly string[] = ["core_concept", "definition"];

/** The single-frame plan used when no planner is wired or the planner dispatch is blocked. */
function defaultPlanEntry(title: string): FramePlanEntry {
  return {
    title,
    sub_focus: "",
    archetype: "concept-first",
    slots: [...DEFAULT_PLAN_SLOTS],
    intent: "introduce",
  };
}

/** Read the planner's `frame_plan` from a response packet's content into ordered plan entries. */
function readPlanEntries(raw: unknown): FramePlanEntry[] {
  const fp = (raw ?? {}) as Record<string, unknown>;
  const list = Array.isArray(fp["frames"]) ? (fp["frames"] as unknown[]) : [];
  const entries: FramePlanEntry[] = [];
  for (const e of list) {
    const o = (e ?? {}) as Record<string, unknown>;
    const title = typeof o["title"] === "string" ? o["title"].trim() : "";
    if (!title) continue;
    entries.push({
      title,
      sub_focus: typeof o["sub_focus"] === "string" ? o["sub_focus"] : "",
      archetype: typeof o["archetype"] === "string" ? o["archetype"] : "concept-first",
      slots: Array.isArray(o["slots"])
        ? (o["slots"] as unknown[]).filter((s): s is string => typeof s === "string")
        : [...DEFAULT_PLAN_SLOTS],
      intent: typeof o["intent"] === "string" ? o["intent"] : "build",
    });
  }
  return entries;
}

/** Build a plain text MCCR element in the shape the surface fold (`readMccr`) expects. */
function mccrTextSlot(
  slot: MccrElementType,
  text: string,
  conceptId: string,
): Record<string, unknown> {
  return {
    element_id: `el-${slot}`,
    type: slot,
    slot,
    reveal_order: Math.max(0, MCCR_ELEMENT_TYPES.indexOf(slot)),
    concept_id: conceptId,
    content: { kind: "text", text },
  };
}

export interface SurfaceSessionDeps {
  readonly session: OnboardingSession;
  readonly world: WorldStateGraph;
  readonly bus: EventBus;
  /** The existing deterministic learning cycle — routing, dispatches, mastery, journal. */
  readonly loop: FiberedLearningLoop;
  /**
   * Optional governed explanation dispatcher enabling `expand()` (Phase 2B progressive
   * deepening). Expansion re-dispatches through the SAME gate — no bypass.
   */
  readonly explanationDispatcher?: GovernedDispatcher;
  /**
   * Optional voice synthesis for narration choreography (Phase 2D-S4). Absent ⇒ text-only,
   * fully deterministic narration. Bytes never enter events — see ADR-0007.
   */
  readonly voice?: VoiceSynthesizer;
  /**
   * Optional generated-media seam (S2.1b, SRF-006). When present, an illustrative artifact is
   * generated for the focus concept and surfaced as an inline media block (recorded; bytes
   * out-of-band). Absent ⇒ no generated media (the structured concept map still renders).
   */
  readonly media?: MediaGenerator;
  /**
   * Optional research frontier dispatcher (S3.2, F10, ADR-0026). When present, dispatches
   * `agent.research` after research-readiness is detected; emits `surface.research.frontier.surfaced`
   * and contributes a research block. Absent ⇒ detection event is emitted but no block follows.
   */
  readonly researchDispatcher?: GovernedDispatcher;
  /**
   * Optional motivation dispatcher (S3.3). When present, dispatches `agent.motivation` when the
   * learner barely passed mastery (0.6 ≤ confidence < 0.75); emits `surface.motivation.surfaced`
   * and contributes a motivation block. Absent ⇒ event still emitted but no block follows.
   */
  readonly motivationDispatcher?: GovernedDispatcher;
  /**
   * Optional cognitive evaluation engine (S4.2, ADR-0027). When present, evaluates the cycle's
   * reasoning trace after step 9, emits `surface.evaluation.recorded`, and folds the record into
   * `SurfaceState.evaluation_records`. Absent ⇒ no evaluation record this cycle.
   */
  readonly evaluationEngine?: CognitiveEvaluationEngine;
  /**
   * Optional Surface Composer dispatcher (UCS, ADR-0030). When present, the focus explanation is
   * replaced by the **frame path**: the composer distills the Minimal Complete Cognitive
   * Representation (MCCR) shown on the board plus a SEPARATE paced narration script and an image
   * decision; the session emits `surface.frame.composed` + `surface.narration.script.produced` +
   * `surface.image.decided`, and voices the script with element-targeted focus. Absent ⇒ the legacy
   * explanation-block + narrated-text path runs unchanged (F16 §12 graceful fallback).
   */
  readonly composerDispatcher?: GovernedDispatcher;
  /**
   * Optional Frame Planner dispatcher (UCS, ADR-0030; Phase 2). When present, plans/sequences the
   * concept's Cognitive Frames before composition. Absent ⇒ a single composed frame per ask.
   */
  readonly framePlannerDispatcher?: GovernedDispatcher;
  /**
   * Look-ahead budget (UCS, ADR-0030; Phase 3): number of discardable speculative frames the planner
   * may pre-compose ahead of the learner. Default 0 (off) — deterministic, no speculation.
   */
  readonly lookaheadBudget?: number;
  /** CID stamped on supervisor routing blocks. */
  readonly supervisorCid?: string;
  /**
   * Optional live progressive-reveal pacing for the explanation block (S-UCS, ADR-0028). When > 0,
   * the explanation streams as ordered `surface.block.delta` chunks (paced by this many ms) before the
   * canonical whole block, so generation visibly unfolds. Absent/0 ⇒ the whole block is emitted at once
   * (the default; keeps deterministic/replay runs and tests byte-identical).
   */
  readonly streamRevealMs?: number;
  readonly clock?: Clock;
  readonly idGenerator?: IdGenerator;
  readonly nodeId?: string;
}

export interface SurfaceAskInput {
  readonly goal: string;
  readonly pathId: string;
  readonly concepts: readonly ConceptSeed[];
  readonly focusConceptId: string;
  readonly explanationPrompt: string;
  readonly practicePrompt: string;
  readonly mastery: LearningLoopMasteryInput;
  /**
   * Assembled working-memory context from P2.4 context-lease-bounded retrieval. When present,
   * threaded into the explanation agent's prompt so the model builds on prior learner knowledge
   * instead of re-explaining it (ADR-0016). Optional — absent on first ask or for fresh learners.
   */
  readonly assembledContextItems?: ReadonlyArray<{ readonly text: string; readonly score: number }>;
}

export interface SurfaceAskResult {
  readonly routing: SupervisorRoutingDecision;
  readonly blocks: readonly CognitionBlock[];
  readonly timeline: TimelineProjection;
  readonly loop: FiberedLearningLoopResult;
  readonly state: SurfaceState;
}

function sessionError(message: string, details?: Record<string, unknown>): CosError {
  return new CosError("E_SURFACE_SESSION", message, {
    specRef: "spec/surface/cognitive-surface-runtime.md",
    details,
  });
}

// ---------------------------------------------------------------------------
// Interaction protocol (S1.3, ADR-0024)
// ---------------------------------------------------------------------------

export type SurfaceInteractionKind =
  | "interrupt"
  | "jump"
  | "branch"
  | "challenge"
  | "request_depth"
  | "request_simplify"
  | "request_example";

export interface SurfaceInteractionInput {
  readonly kind: SurfaceInteractionKind;
  /** Concept id (for jump/branch) the interaction targets. */
  readonly target_id?: string;
  /** Free-form note (e.g. the learner's challenge text). */
  readonly note?: string;
}

export interface SurfaceInteractionResult {
  readonly interaction_id: string;
  readonly effect: "cancelled" | "refocused" | "dispatched" | "reprojected";
}

// ---------------------------------------------------------------------------
// SurfaceSession
// ---------------------------------------------------------------------------

export class SurfaceSession {
  private readonly world: WorldStateGraph;
  private readonly bus: EventBus;
  private readonly clock: Clock;
  private readonly idGenerator: IdGenerator;
  private readonly contributions: AgentContributionRuntime;
  private readonly choreographer: SurfaceChoreographer;
  private readonly supervisorCid: string;
  private hlc: Hlc;

  private surfaceId: string | null = null;
  private timeline: SurfaceTimelineBuilder | null = null;
  private closed = false;
  /** Cooperative interrupt flag (S1.3, ADR-0024) — read by the loop at fiber yield points. */
  private interrupted = false;
  /** Last ask input, so reshaping interactions (depth/simplify/example) can re-frame it. */
  private lastAskInput: SurfaceAskInput | null = null;

  constructor(private readonly deps: SurfaceSessionDeps) {
    this.world = deps.world;
    this.bus = deps.bus;
    this.clock = deps.clock ?? new SystemClock();
    this.idGenerator = deps.idGenerator ?? new CryptoIdGenerator();
    this.supervisorCid = deps.supervisorCid ?? "agent.supervisor";
    this.hlc = hlcInit(deps.nodeId ?? "surface-session");
    this.contributions = new AgentContributionRuntime({
      bus: deps.bus,
      clock: this.clock,
      idGenerator: this.idGenerator,
      nodeId: `${deps.nodeId ?? "surface-session"}-contrib`,
    });
    this.choreographer = new SurfaceChoreographer({
      bus: deps.bus,
      clock: this.clock,
      idGenerator: this.idGenerator,
      nodeId: `${deps.nodeId ?? "surface-session"}-choreo`,
      ...(deps.voice ? { voice: deps.voice } : {}),
    });
  }

  /** The surface id once started. */
  id(): string | null {
    return this.surfaceId;
  }

  /**
   * Create the surface: world-state node first, then the `surface.created` event
   * (events follow state). Returns the surface id.
   */
  async start(goal?: string): Promise<Result<string, CosError>> {
    if (this.surfaceId) {
      return err(sessionError("surface session already started", { surfaceId: this.surfaceId }));
    }
    const learner = this.deps.session;
    const surfaceId = `srf-${this.idGenerator.hex(12)}`;
    const surfaceNodeId = `surface:${surfaceId}`;

    if (!this.world.getNode(learner.learnerNodeId)) {
      const learnerNode = this.world.apply({
        kind: "upsert_node",
        id: learner.learnerNodeId,
        type: "learner",
        props: { cid: learner.learnerIdentity.cid },
      });
      if (!learnerNode.ok) return learnerNode;
    }
    const nodeResult = this.world.apply({
      kind: "upsert_node",
      id: surfaceNodeId,
      type: "surface_session",
      props: {
        surfaceId,
        learnerCid: learner.learnerIdentity.cid,
        sessionId: learner.intentLease.intent_id,
        goal: goal ?? null,
        status: "active",
      },
    });
    if (!nodeResult.ok) return nodeResult;
    const edgeResult = this.world.apply({
      kind: "upsert_edge",
      id: `edge:${surfaceNodeId}:projected_for:${learner.learnerNodeId}`,
      from: surfaceNodeId,
      to: learner.learnerNodeId,
      type: "projected_for",
      props: {},
    });
    if (!edgeResult.ok) return edgeResult;

    this.surfaceId = surfaceId;
    const mode = this.deps.session.mode ?? "student";
    await this.emit("surface.created", {
      surface_id: surfaceId,
      learner_cid: learner.learnerIdentity.cid,
      session_id: learner.intentLease.intent_id,
      goal: goal ?? null,
    });
    // S4.3 — record the mode immediately after surface creation so the fold and UI can key on it.
    await this.emit("surface.mode.set", { surface_id: surfaceId, mode });
    return ok(surfaceId);
  }

  /**
   * Resume an existing surface after a restart (DPS-002): adopt the persisted `surfaceId` without
   * minting a new one. Emits and writes nothing — the surface's world-state nodes are already present
   * (restored from the snapshot) and `surface.created` is already in the hydrated event log. From here
   * the session is fully live: `ask`/`expand` run the same governed path.
   */
  resume(surfaceId: string): Result<string, CosError> {
    if (this.surfaceId) {
      return err(sessionError("surface session already started", { surfaceId: this.surfaceId }));
    }
    this.surfaceId = surfaceId;
    return ok(surfaceId);
  }

  /**
   * One ask cycle: living timeline → governed learning cycle (supervisor routing, agent
   * dispatches, mastery) → cognition blocks → timeline re-projection.
   */
  async ask(input: SurfaceAskInput): Promise<Result<SurfaceAskResult, CosError>> {
    if (!this.surfaceId) return err(sessionError("surface session not started"));
    if (this.closed) return err(sessionError("surface session is closed"));
    const surfaceId = this.surfaceId;
    const learner = this.deps.session;
    // A fresh ask clears any prior interrupt and is the reshaping baseline (S1.3).
    this.interrupted = false;
    this.lastAskInput = input;

    // 1. Living timeline (one live timeline per surface; a new ask re-anchors it).
    this.timeline = new SurfaceTimelineBuilder({
      world: this.world,
      bus: this.bus,
      clock: this.clock,
      idGenerator: this.idGenerator,
      nodeId: `${surfaceId}-timeline`,
      producerCid: learner.learnerIdentity.cid,
    });
    const built = await this.timeline.build({
      surface_id: surfaceId,
      goal: input.goal,
      path_id: input.pathId,
      owner_user_id: learner.intentLease.owner_user_id,
      concepts: input.concepts,
    });
    if (!built.ok) return built;

    // 2. The governed learning cycle on the existing substrate.
    const loopResult = await this.deps.loop.run({
      session: learner,
      pathId: input.pathId,
      concepts: input.concepts,
      focusConceptId: input.focusConceptId,
      explanationPrompt: input.explanationPrompt,
      practicePrompt: input.practicePrompt,
      mastery: input.mastery,
      // Thread surfaceId so the fiber can include it in surface.agent.disagreed (P4.1, ADR-0018 D6).
      surfaceId,
      // Cooperative interrupt (S1.3, ADR-0024): the fiber early-exits at the next phase boundary.
      isInterrupted: () => this.interrupted,
      ...(input.assembledContextItems
        ? { assembledContextItems: input.assembledContextItems }
        : {}),
    });
    if (!loopResult.ok) return loopResult;
    const cycle = loopResult.value;
    const focusTitle =
      input.concepts.find((c) => c.id === input.focusConceptId)?.title ?? input.focusConceptId;
    const conceptNodeId = `concept:${input.focusConceptId}`;
    const blocks: CognitionBlock[] = [];
    // UCS (ADR-0030; Phase 2): on the planner frame path the concept is decomposed into a SEQUENCE of
    // Cognitive Frames, and practice/assessment also become frames. Requires both a composer (to distill
    // each frame) and a frame planner (to decompose). Composer-only ⇒ a single composed frame (Phase 1).
    const onPlannerFramePath = !!this.deps.composerDispatcher && !!this.deps.framePlannerDispatcher;

    // 3. Supervisor decision becomes visible: reasoning event + routing block.
    await this.emit("surface.reasoning.recorded", {
      surface_id: surfaceId,
      decision: {
        target_agent: cycle.routing.targetAgent,
        reason: cycle.routing.reason,
        concept_id: cycle.routing.conceptId,
      },
      producer_cid: this.supervisorCid,
    });
    const routingBlock = await this.contributions.contribute({
      surface_id: surfaceId,
      agent_id: "supervisor",
      agent_cid: this.supervisorCid,
      block_type: "routing",
      title: `Routing — ${focusTitle}`,
      content: {
        target_agent: cycle.routing.targetAgent,
        reason: cycle.routing.reason,
        concept_id: cycle.routing.conceptId,
      },
      concept_ids: [input.focusConceptId],
      reason: "supervisor world-state routing decision",
      world_state_nodes: [conceptNodeId],
    });
    if (!routingBlock.ok) return routingBlock;
    blocks.push(routingBlock.value);
    // The supervisor is a visible cognitive entity, not metadata.
    await this.choreographer.presence({
      surface_id: surfaceId,
      agent_cid: this.supervisorCid,
      agent_id: "supervisor",
      role: "supervisor",
      state: "contributing",
      block_id: routingBlock.value.block_id,
    });

    // 3b. A concept map of the focus and its neighbourhood — cognition made *visible* (S2.1a,
    //     SRF-006 §4 structured visual: a deterministic, client-rendered projection of the learning
    //     graph; no provider, no media event, replay-safe).
    const graph = built.value;
    const conceptMap = await this.contributions.contribute({
      surface_id: surfaceId,
      agent_id: "curriculum",
      agent_cid: "agent.curriculum",
      block_type: "concept",
      title: `Concept map — ${focusTitle}`,
      content: {
        map: {
          focus: input.focusConceptId,
          nodes: graph.nodes.map((n) => ({
            id: n.concept_id,
            title: n.title,
            layer: n.layer,
            status: n.status,
          })),
          edges: graph.edges.map((e) => ({ from: e.from, to: e.to, type: e.edge_type })),
        },
      },
      concept_ids: graph.nodes.map((n) => n.concept_id),
      reason: "concept map projected from the learning graph",
      world_state_nodes: [conceptNodeId],
    });
    if (!conceptMap.ok) return conceptMap;
    blocks.push(conceptMap.value);

    // 4. The focus concept becomes visible. When a composer is wired (UCS, ADR-0030) the board holds
    //    a distilled Cognitive Frame (MCCR) and the teaching moves to a SEPARATE narration script;
    //    otherwise the legacy explanation-block + narrated-text path runs (F16 §12 fallback).
    if (this.deps.composerDispatcher) {
      const framed = onPlannerFramePath
        ? await this.planAndComposeFrames({ surfaceId, input, focusTitle, conceptNodeId })
        : await this.composeFocusFrame({ surfaceId, input, focusTitle, conceptNodeId });
      if (!framed.ok) return framed;
    } else if (cycle.explanation) {
      const contribution = contributionFromDispatch({
        surface_id: surfaceId,
        agent_id: "explanation",
        block_type: "explanation",
        title: `Explanation — ${focusTitle}`,
        dispatch: cycle.explanation,
        reason: "explanation agent response to learner ask",
        concept_ids: [input.focusConceptId],
        world_state_nodes: [conceptNodeId],
      });
      // S-UCS: live progressive reveal of the explanation (ADR-0028) when pacing is configured;
      // otherwise (and always under a ManualClock for replay) the whole block is emitted at once.
      const paceMs = this.deps.streamRevealMs ?? 0;
      const block =
        paceMs > 0
          ? await this.contributions.contributeStreaming(
              contribution,
              revealChunks(contribution.content),
              paceMs,
            )
          : await this.contributions.contribute(contribution);
      if (!block.ok) return block;
      blocks.push(block.value);
      await this.choreographer.narrateBlock({
        surface_id: surfaceId,
        block: block.value,
        agent_cid: block.value.provenance.producer_cid,
        agent_id: "explanation",
        role: "explainer",
        concept_id: input.focusConceptId,
      });

      // 4b. Generated-media: an inline illustration for the focus concept (S2.1b, SRF-006). Gated on
      //     the trusted path (cognition happened) + a wired generator; bytes are out-of-band, the
      //     artifact reference is recorded (surface.visual.generated) BEFORE the block (D3).
      if (this.deps.media) {
        const ref = await this.deps.media.generate({
          request_id: `med-${this.idGenerator.hex(8)}`,
          surface_id: surfaceId,
          block_id: null,
          modality: "image",
          prompt: `Illustrate the concept: ${focusTitle}`,
          concept_ids: [input.focusConceptId],
        });
        if (ref) {
          await this.emit("surface.visual.generated", {
            surface_id: surfaceId,
            block_id: null,
            artifact_id: ref.artifact_id,
            modality: ref.modality,
            provider_id: ref.provider_id,
          });
          const media = await this.contributions.contribute({
            surface_id: surfaceId,
            agent_id: "explanation",
            agent_cid: block.value.provenance.producer_cid,
            block_type: "image",
            title: `Illustration — ${focusTitle}`,
            content: {
              artifact: {
                artifact_id: ref.artifact_id,
                modality: ref.modality,
                content_ref: ref.content_ref,
                mime_type: ref.mime_type,
                provider_id: ref.provider_id,
                deterministic: ref.deterministic,
              },
              alt: `Illustration of ${focusTitle}`,
            },
            concept_ids: [input.focusConceptId],
            reason: "illustrative image generated for the focus concept",
            world_state_nodes: [conceptNodeId],
          });
          if (!media.ok) return media;
          blocks.push(media.value);
        }
      }
    }
    if (cycle.practice) {
      const block = await this.contributions.contribute(
        contributionFromDispatch({
          surface_id: surfaceId,
          agent_id: "practice",
          block_type: "practice",
          title: `Practice — ${focusTitle}`,
          dispatch: cycle.practice,
          reason: "practice agent response to learner ask",
          concept_ids: [input.focusConceptId],
          world_state_nodes: [conceptNodeId],
        }),
      );
      if (!block.ok) return block;
      blocks.push(block.value);
      await this.choreographer.presence({
        surface_id: surfaceId,
        agent_cid: block.value.provenance.producer_cid,
        agent_id: "practice",
        role: "coach",
        state: "contributing",
        block_id: block.value.block_id,
      });
      // UCS (ADR-0030; Phase 2): practice becomes its own anchored Cognitive Frame — the learner
      // sees the problem as a viewport-complete state, voiced separately. The block remains the
      // canonical/observable backing; the frame is the progressive on-screen state.
      if (onPlannerFramePath) {
        await this.composeDeterministicFrame({
          surfaceId,
          conceptId: input.focusConceptId,
          conceptNodeId,
          frameTitle: `Practice — ${focusTitle}`,
          archetype: "example-led",
          producerCid: block.value.provenance.producer_cid,
          agentId: "practice",
          role: "coach",
          reason: "practice rendered as a Cognitive Frame",
          mccr: {
            core_concept: mccrTextSlot(
              "core_concept",
              `Practice — ${focusTitle}`,
              input.focusConceptId,
            ),
            key_example: mccrTextSlot("key_example", input.practicePrompt, input.focusConceptId),
          },
          segments: [
            {
              text: "Now make it your own — work through this before we move on.",
              anchor_ref: "key_example",
              intent: "check",
            },
          ],
        });
      }
    }

    // 5. Mastery evidence becomes an assessment block backed by its memory mutation.
    if (cycle.mastery) {
      const depthGate = cycle.mastery.depthGate;
      // Gate passed is the recorder's verdict (may differ from input.mastery.passed when tests run)
      const gatePassed = depthGate ? depthGate.passed : input.mastery.passed;

      // Emit the depth-gate event BEFORE the block (D3 pattern: recorded before surfaced).
      if (depthGate) {
        await this.emit("surface.assessment.gate.evaluated", {
          surface_id: surfaceId,
          concept_id: input.focusConceptId,
          passed: depthGate.passed,
          passed_count: depthGate.passedCount,
          total_count: depthGate.totalCount,
          threshold: 4,
          tests: depthGate.tests.map((t) => ({
            kind: t.kind,
            passed: t.passed,
            confidence: t.confidence,
            evidence: t.evidence,
          })),
        });
      }

      const assessmentBlock = await this.contributions.contribute({
        surface_id: surfaceId,
        agent_id: "assessment",
        agent_cid: input.mastery.assessorCid,
        block_type: "assessment",
        title: `Mastery Checkpoint — ${focusTitle}`,
        content: {
          checkpoint_node_id: cycle.mastery.checkpointNodeId,
          concept_node_id: cycle.mastery.conceptNodeId,
          passed: gatePassed,
          confidence: input.mastery.confidence,
          ...(depthGate
            ? {
                depth_gate: {
                  passed: depthGate.passed,
                  passed_count: depthGate.passedCount,
                  total_count: depthGate.totalCount,
                  tests: depthGate.tests,
                },
              }
            : {}),
        },
        concept_ids: [input.focusConceptId],
        reason: "mastery checkpoint recorded as world-state + memory evidence",
        confidence: input.mastery.confidence,
        world_state_nodes: [cycle.mastery.checkpointNodeId, cycle.mastery.conceptNodeId],
        memory_mutation_id: cycle.mastery.mutationId,
      });
      if (!assessmentBlock.ok) return assessmentBlock;
      blocks.push(assessmentBlock.value);
      await this.emit("surface.memory.attached", {
        surface_id: surfaceId,
        block_id: assessmentBlock.value.block_id,
        mutation_id: cycle.mastery.mutationId,
        memory_layer: "semantic",
      });
      await this.choreographer.presence({
        surface_id: surfaceId,
        agent_cid: input.mastery.assessorCid,
        agent_id: "assessment",
        role: "assessor",
        state: "contributing",
        block_id: assessmentBlock.value.block_id,
      });
      // UCS (ADR-0030; Phase 2): the mastery checkpoint closes the lesson as its own Cognitive Frame.
      if (onPlannerFramePath) {
        const passedSummary = gatePassed
          ? `Mastery verified — confidence ${Math.round(input.mastery.confidence * 100)}%.`
          : "Not yet — let's reinforce the gaps and return.";
        const cueText = depthGate
          ? `${depthGate.passedCount}/${depthGate.totalCount} depth checks passed.`
          : passedSummary;
        await this.composeDeterministicFrame({
          surfaceId,
          conceptId: input.focusConceptId,
          conceptNodeId,
          frameTitle: `Checkpoint — ${focusTitle}`,
          archetype: "concept-first",
          producerCid: input.mastery.assessorCid,
          agentId: "assessment",
          role: "assessor",
          reason: "mastery checkpoint rendered as a Cognitive Frame",
          mccr: {
            core_concept: mccrTextSlot(
              "core_concept",
              `Checkpoint — ${focusTitle}`,
              input.focusConceptId,
            ),
            memory_cue: mccrTextSlot("memory_cue", cueText, input.focusConceptId),
          },
          segments: [{ text: passedSummary, anchor_ref: "memory_cue", intent: "reinforce" }],
        });
      }
    }

    // 6. The world changed — re-project the living timeline.
    const refreshed = await this.timeline.refresh("learning-cycle-completed");
    if (!refreshed.ok) return refreshed;

    // 7. S2.3 — Prerequisite-descent on confusion (F03).
    // When the depth gate fails (or mastery was not passed at low confidence), descend into
    // the closest prerequisite concept, run a remedial sub-cycle, then re-project the timeline.
    const descentInfo = this.resolveConfusionDescent(input, cycle, refreshed.value);
    if (descentInfo) {
      const prereqSeed = input.concepts.find((c) => c.id === descentInfo.prereqId);
      if (prereqSeed) {
        await this.runPrerequisiteDescent(
          surfaceId,
          input,
          descentInfo.prereqId,
          descentInfo.trigger,
          blocks,
        );
        // Re-project: the prerequisite concept is now recorded as mastered in world-state.
        const afterDescent = await this.timeline.refresh("prerequisite-descent-completed");
        if (!afterDescent.ok) return afterDescent;
      }
    }

    // 8. S3.1 — Research-readiness check (F10, ADR-0026).
    // Fires only when mastery completed cleanly (no prerequisite descent — remediation first).
    // Emits `surface.research.frontier.detected` (D3) when threshold met; deferred otherwise.
    if (!descentInfo && cycle.mastery) {
      await this.resolveResearchReadiness(surfaceId, input, cycle, blocks);
    }

    // 9. S3.3 — Motivation check: barely-passed mastery sustains learner momentum.
    // Fires when mastery passed but confidence fell below the research-readiness threshold.
    if (!descentInfo && cycle.mastery) {
      await this.resolveMotivation(surfaceId, input, blocks);
    }

    // 10. S4.2 — Cognitive evaluation: score the cycle's reasoning quality (ADR-0027).
    // Builds a minimal ReasoningTrace from the explanation result, evaluates it, and emits
    // `surface.evaluation.recorded` for the fold. Engine absent ⇒ no evaluation record.
    if (this.deps.evaluationEngine) {
      await this.resolveEvaluation(surfaceId, input, cycle);
    }

    return ok({
      routing: cycle.routing,
      blocks,
      timeline: this.timeline.current() ?? refreshed.value,
      loop: cycle,
      state: this.state() as SurfaceState,
    });
  }

  /**
   * Compose the focus concept as a SINGLE Cognitive Frame (UCS, ADR-0030; Phase 1 path). Used when a
   * composer is wired but no frame planner is — the focus explanation becomes one distilled frame.
   */
  private async composeFocusFrame(args: {
    surfaceId: string;
    input: SurfaceAskInput;
    focusTitle: string;
    conceptNodeId: string;
  }): Promise<Result<void, CosError>> {
    return this.composeFrameViaComposer({ ...args, plan: null });
  }

  /**
   * Plan a concept's Cognitive Frames (UCS, ADR-0030; Phase 2), then compose each in sequence. The
   * Frame Planner decomposes the concept into a progressive series of viewport-complete frames
   * (intuition → definition → example → connection); the Surface Composer distills each one's MCCR +
   * narration. A blocked planner dispatch degrades to a single default frame (teaching still happens).
   */
  private async planAndComposeFrames(args: {
    surfaceId: string;
    input: SurfaceAskInput;
    focusTitle: string;
    conceptNodeId: string;
  }): Promise<Result<void, CosError>> {
    const { plannerPacketId, frames } = await this.dispatchFramePlan(args);
    for (const entry of frames) {
      const composed = await this.composeFrameViaComposer({
        ...args,
        plan: { entry, plannerPacketId },
      });
      if (!composed.ok) return composed;
    }
    return ok(undefined);
  }

  /**
   * Dispatch the governed Frame Planner and read back its frame plan (UCS, ADR-0030). Surfaces the
   * planner's reasoning to the Agent Observatory (ADR-0029). A blocked/empty dispatch falls back to a
   * single default frame so the lesson is never lost.
   */
  private async dispatchFramePlan(args: {
    surfaceId: string;
    input: SurfaceAskInput;
    focusTitle: string;
  }): Promise<{ plannerPacketId: string | null; frames: FramePlanEntry[] }> {
    const dispatcher = this.deps.framePlannerDispatcher;
    const fallback = { plannerPacketId: null, frames: [defaultPlanEntry(args.focusTitle)] };
    if (!dispatcher) return fallback;

    const dispatched = await dispatcher.dispatch({
      session: this.deps.session,
      targetAgentId: "frameplanner",
      intent: `plan frames: ${args.focusTitle}`,
      conceptIds: [args.input.focusConceptId],
      content: {
        concept_id: args.input.focusConceptId,
        concept_title: args.focusTitle,
        goal: args.input.goal,
        ...(args.input.explanationPrompt ? { prompt: args.input.explanationPrompt } : {}),
      },
    });
    if (!dispatched.ok) return fallback;
    const response = dispatched.value.responsePackets[0];
    const content = (response?.content ?? {}) as Record<string, unknown>;
    const frames = readPlanEntries(content["frame_plan"]);
    if (frames.length === 0) return fallback;

    // Observatory (ADR-0029): the planner's decomposition reasoning is inspectable.
    const trace = dispatched.value.emissions.trace;
    const plannerCid = response?.source_cid ?? "agent.frameplanner";
    if (trace) {
      await this.emit("surface.agent.reasoning.summary", {
        surface_id: args.surfaceId,
        agent_cid: plannerCid,
        agent_id: "frameplanner",
        packet_id: response?.packet_id ?? null,
        work_id: dispatched.value.workItem.work_id,
        task_interpretation: trace.task_interpretation,
        strategy: trace.strategy,
        decision: trace.decision,
        self_critique: trace.self_critique ?? null,
        confidence: response?.confidence ?? 0.5,
        determinism_level: trace.determinism_level,
      });
    }
    return { plannerPacketId: response?.packet_id ?? null, frames };
  }

  /**
   * Compose ONE Cognitive Frame via the Surface Composer (UCS, ADR-0030). When a `plan` is given the
   * frame's layout is first reserved (`surface.frame.planned`, planner path), and the composer is
   * steered to the frame's `sub_focus` so each frame distills DIFFERENT anchors. Generates the planned
   * image inline (when it helps); then emits composed → image.decided → script.produced → reasoning →
   * voiced narration. A blocked/empty dispatch degrades observably (no composed frame; SRF-001 §10).
   */
  private async composeFrameViaComposer(args: {
    surfaceId: string;
    input: SurfaceAskInput;
    focusTitle: string;
    conceptNodeId: string;
    plan: { entry: FramePlanEntry; plannerPacketId: string | null } | null;
  }): Promise<Result<void, CosError>> {
    const { surfaceId, input, focusTitle, conceptNodeId, plan } = args;
    const dispatcher = this.deps.composerDispatcher;
    if (!dispatcher) return ok(undefined);

    const frameId = `cfr-${this.idGenerator.hex(12)}`;
    const ordinal = this.nextFrameOrdinal();
    const frameTitle = plan ? plan.entry.title : `Frame — ${focusTitle}`;

    // Reserve the frame's layout before content lands (planner path; SRF-002 law 8).
    if (plan) {
      await this.emit("surface.frame.planned", {
        surface_id: surfaceId,
        frame_id: frameId,
        ordinal,
        concept_id: input.focusConceptId,
        title: frameTitle,
        mccr_layout: this.buildFrameLayout(plan.entry.archetype, plan.entry.slots),
        planner_packet_id: plan.plannerPacketId,
        producer_cid: "agent.frameplanner",
        reason: "frame planner reserved a frame layout",
        world_state_nodes: [conceptNodeId],
      });
    }

    const dispatched = await dispatcher.dispatch({
      session: this.deps.session,
      targetAgentId: "composer",
      intent: `compose frame: ${frameTitle}`,
      conceptIds: [input.focusConceptId],
      content: {
        concept_id: input.focusConceptId,
        concept_title: focusTitle,
        goal: input.goal,
        ...(plan?.entry.sub_focus ? { sub_focus: plan.entry.sub_focus } : {}),
        ...(plan ? { frame_focus: frameTitle } : {}),
        ...(input.explanationPrompt ? { prompt: input.explanationPrompt } : {}),
      },
    });
    // Degrade observably: a blocked dispatch (untrusted learner / scheduler rejection) yields no
    // composed frame, exactly as the legacy path yields no explanation block (SRF-001 §10).
    if (!dispatched.ok) return ok(undefined);
    const response = dispatched.value.responsePackets[0];
    const content = (response?.content ?? {}) as Record<string, unknown>;
    const mccr = content["mccr"] as Record<string, unknown> | undefined;
    if (!mccr || typeof mccr !== "object") return ok(undefined);

    const composerCid = response?.source_cid ?? "agent.composer";
    const script = (content["narration_script"] as { segments?: unknown } | undefined) ?? {};
    const scriptSegments = Array.isArray(script.segments)
      ? (script.segments as Record<string, unknown>[])
      : [];
    const imagePlanRaw = (content["image_plan"] as Record<string, unknown> | undefined) ?? {};
    const helps = imagePlanRaw["helps"] === true;
    const prompt =
      typeof imagePlanRaw["prompt"] === "string" ? (imagePlanRaw["prompt"] as string) : null;
    const modality =
      typeof imagePlanRaw["modality"] === "string" ? imagePlanRaw["modality"] : "none";
    const rationale =
      typeof imagePlanRaw["rationale"] === "string" ? (imagePlanRaw["rationale"] as string) : "";

    // Image-as-cognition: when the composer judged an image helps and a generator is wired, generate
    // it and fold it into the MCCR as the `image` element (in the concept's region).
    let mccrForEvent: Record<string, unknown> = mccr;
    if (helps && prompt && this.deps.media) {
      const ref = await this.deps.media.generate({
        request_id: `med-${this.idGenerator.hex(8)}`,
        surface_id: surfaceId,
        block_id: null,
        modality: "image",
        prompt,
        concept_ids: [input.focusConceptId],
      });
      if (ref) {
        await this.emit("surface.visual.generated", {
          surface_id: surfaceId,
          block_id: null,
          artifact_id: ref.artifact_id,
          modality: ref.modality,
          provider_id: ref.provider_id,
        });
        mccrForEvent = {
          ...mccr,
          image: {
            element_id: "el-image",
            type: "image",
            slot: "image",
            reveal_order: 9,
            concept_id: input.focusConceptId,
            content: {
              kind: "image",
              artifact: {
                artifact_id: ref.artifact_id,
                content_ref: ref.content_ref,
                mime_type: ref.mime_type,
                provider_id: ref.provider_id,
              },
              alt: `Illustration of ${focusTitle}`,
              prompt,
            },
          },
        };
      }
    }

    await this.emitFrameArtifacts({
      surfaceId,
      frameId,
      ordinal,
      conceptId: input.focusConceptId,
      frameTitle,
      conceptNodeId,
      mccr: mccrForEvent,
      scriptSegments,
      imagePlan: { helps, modality, prompt, rationale },
      composerCid,
      composerPacketId: response?.packet_id ?? null,
      confidence: response?.confidence ?? 0.5,
      reasoning:
        typeof content["response_kind"] === "string" ? (content["response_kind"] as string) : "",
      trace: dispatched.value.emissions.trace ?? null,
      workId: dispatched.value.workItem.work_id,
      agentId: "composer",
      role: "explainer",
      reason: "surface composer distilled the focus concept into a Cognitive Frame",
    });
    return ok(undefined);
  }

  /**
   * Compose a frame deterministically — no model call (UCS, ADR-0030; Phase 2). Used for practice and
   * assessment frames, whose MCCR is built from cycle results. Reserves the layout, lands the MCCR, and
   * voices a short script — the same event shape as a composed frame, fully replay-deterministic.
   */
  private async composeDeterministicFrame(args: {
    surfaceId: string;
    conceptId: string;
    conceptNodeId: string;
    frameTitle: string;
    archetype: string;
    producerCid: string;
    agentId: string;
    role: string;
    reason: string;
    mccr: Record<string, unknown>;
    segments: { text: string; anchor_ref: string | null; intent: string }[];
  }): Promise<void> {
    const frameId = `cfr-${this.idGenerator.hex(12)}`;
    const ordinal = this.nextFrameOrdinal();
    await this.emit("surface.frame.planned", {
      surface_id: args.surfaceId,
      frame_id: frameId,
      ordinal,
      concept_id: args.conceptId,
      title: args.frameTitle,
      mccr_layout: this.buildFrameLayout(args.archetype, Object.keys(args.mccr)),
      planner_packet_id: null,
      producer_cid: args.producerCid,
      reason: args.reason,
      world_state_nodes: [args.conceptNodeId],
    });
    await this.emitFrameArtifacts({
      surfaceId: args.surfaceId,
      frameId,
      ordinal,
      conceptId: args.conceptId,
      frameTitle: args.frameTitle,
      conceptNodeId: args.conceptNodeId,
      mccr: args.mccr,
      scriptSegments: args.segments.map((s) => ({ ...s, pause_after: false })),
      imagePlan: { helps: false, modality: "none", prompt: null, rationale: "deterministic frame" },
      composerCid: args.producerCid,
      composerPacketId: null,
      confidence: 1,
      reasoning: "deterministic-frame",
      trace: null,
      workId: null,
      agentId: args.agentId,
      role: args.role,
      reason: args.reason,
    });
  }

  /**
   * Emit a composed frame's artifacts in canonical order (UCS, ADR-0030; SRF-002 laws 8/10): the MCCR
   * (`surface.frame.composed`), the image decision, the SEPARATE narration script, an optional reasoning
   * summary, then the voiced narration (each segment spotlighting its MCCR element). Shared by the
   * model-backed composer path and the deterministic practice/assessment frames.
   */
  private async emitFrameArtifacts(args: {
    surfaceId: string;
    frameId: string;
    ordinal: number;
    conceptId: string;
    frameTitle: string;
    conceptNodeId: string;
    mccr: Record<string, unknown>;
    scriptSegments: Record<string, unknown>[];
    imagePlan: { helps: boolean; modality: string; prompt: string | null; rationale: string };
    composerCid: string;
    composerPacketId: string | null;
    confidence: number;
    reasoning: string;
    trace: ReasoningTrace | null;
    workId: string | null;
    agentId: string;
    role: string;
    reason: string;
  }): Promise<void> {
    const { surfaceId, frameId, mccr } = args;

    // The frame's MCCR lands (the only thing on the board), with multi-producer provenance.
    await this.emit("surface.frame.composed", {
      surface_id: surfaceId,
      frame_id: frameId,
      ordinal: args.ordinal,
      concept_id: args.conceptId,
      title: args.frameTitle,
      mccr,
      confidence: args.confidence,
      reasoning: args.reasoning,
      composer_packet_id: args.composerPacketId,
      producer_cid: args.composerCid,
      reason: args.reason,
      world_state_nodes: [args.conceptNodeId],
    });

    // The image decision is recorded whether or not an image was generated (observable rationale).
    await this.emit("surface.image.decided", {
      surface_id: surfaceId,
      frame_id: frameId,
      helps: args.imagePlan.helps,
      modality: args.imagePlan.modality,
      prompt: args.imagePlan.prompt,
      rationale: args.imagePlan.rationale,
    });

    // The SEPARATE narration script is recorded (the spoken teaching, off the board).
    const scriptId = `nsc-${this.idGenerator.hex(8)}`;
    const recordedSegments = args.scriptSegments.map((s, i) => {
      const anchorRef = typeof s["anchor_ref"] === "string" ? (s["anchor_ref"] as string) : null;
      return {
        segment_id: `${scriptId}-s${i}`,
        anchor_ref: anchorRef,
        intent: typeof s["intent"] === "string" ? (s["intent"] as string) : "build",
        text: typeof s["text"] === "string" ? (s["text"] as string) : "",
        reveal_ids: anchorRef ? [this.elementIdFor(mccr, anchorRef)].filter(Boolean) : [],
        pause_after: s["pause_after"] === true,
      };
    });
    await this.emit("surface.narration.script.produced", {
      surface_id: surfaceId,
      frame_id: frameId,
      script_id: scriptId,
      segments: recordedSegments,
    });

    // Observability (ADR-0029): the composer's reasoning is inspectable in the Agent Observatory.
    if (args.trace) {
      await this.emit("surface.agent.reasoning.summary", {
        surface_id: surfaceId,
        agent_cid: args.composerCid,
        agent_id: args.agentId,
        packet_id: args.composerPacketId,
        work_id: args.workId,
        task_interpretation: args.trace.task_interpretation,
        strategy: args.trace.strategy,
        decision: args.trace.decision,
        self_critique: args.trace.self_critique ?? null,
        confidence: args.confidence,
        determinism_level: args.trace.determinism_level,
      });
    }

    // Voice the script — each segment spotlights the MCCR element it discusses.
    await this.choreographer.narrateScript({
      surface_id: surfaceId,
      frame_id: frameId,
      agent_cid: args.composerCid,
      agent_id: args.agentId,
      role: args.role,
      concept_id: args.conceptId,
      segments: args.scriptSegments.map((s) => {
        const anchorRef = typeof s["anchor_ref"] === "string" ? (s["anchor_ref"] as string) : null;
        return {
          text: typeof s["text"] === "string" ? (s["text"] as string) : "",
          anchor_ref: anchorRef,
          element_id: anchorRef ? this.elementIdFor(mccr, anchorRef) : null,
          intent: typeof s["intent"] === "string" ? (s["intent"] as string) : "build",
        };
      }),
    });
  }

  /** Allocate the next sparse, monotone frame ordinal (UCS, ADR-0030 risk #2). */
  private nextFrameOrdinal(): number {
    return ((this.state()?.frames.length ?? 0) + 1) * 1000;
  }

  /** Build a frame layout skeleton (slots → element ids/types/reveal-order) for surface.frame.planned. */
  private buildFrameLayout(
    archetype: string,
    slots: readonly string[],
  ): {
    archetype: string;
    slots: { element_id: string; type: string; slot: string; reveal_order: number }[];
  } {
    return {
      archetype,
      slots: slots.map((s) => ({
        element_id: `el-${s}`,
        type: s,
        slot: s,
        reveal_order: Math.max(0, MCCR_ELEMENT_TYPES.indexOf(s as MccrElementType)),
      })),
    };
  }

  /** Resolve an MCCR slot name (anchor_ref) to the element_id of the filled element, or null. */
  private elementIdFor(mccr: Record<string, unknown>, anchorRef: string): string | null {
    const el = mccr[anchorRef] as Record<string, unknown> | undefined;
    return el && typeof el["element_id"] === "string" ? (el["element_id"] as string) : null;
  }

  /**
   * Progressive deepening (Phase 2B, F04 layers 0–1): re-dispatch the explanation agent for a
   * deeper layer of an existing block through the governed dispatcher, then announce
   * `surface.explanation.expanded` — the typed modification the fold applies to the block.
   * Spec: spec/surface/cognitive-surface-runtime.md §6.1 step 3.
   */
  async expand(blockId: string, layer: number): Promise<Result<CognitionBlock, CosError>> {
    if (!this.surfaceId) return err(sessionError("surface session not started"));
    if (this.closed) return err(sessionError("surface session is closed"));
    const dispatcher = this.deps.explanationDispatcher;
    if (!dispatcher) {
      return err(sessionError("expand() requires an explanationDispatcher", { blockId }));
    }
    const state = this.state();
    const block = state?.blocks.find((b) => b.block_id === blockId);
    if (!block) return err(sessionError("block not found on this surface", { blockId }));

    const dispatched = await dispatcher.dispatch({
      session: this.deps.session,
      targetAgentId: "explanation",
      intent: `expand: ${block.title}`,
      conceptIds: block.concept_ids,
      content: { layer, block_id: blockId },
      maxTimeSeconds: 30,
    });
    if (!dispatched.ok) return dispatched;
    const response = dispatched.value.responsePackets[0];
    const responseContent = (response?.content ?? {}) as Record<string, unknown>;
    const layers = (responseContent["layers"] as Record<string, unknown> | undefined) ?? {};
    const summary = responseContent["summary"];

    await this.emit("surface.explanation.expanded", {
      surface_id: this.surfaceId,
      block_id: blockId,
      layer,
      layers,
      ...(typeof summary === "string" ? { summary } : {}),
      packet_id: dispatched.value.packet.packet_id,
      agent_id: "explanation",
    });

    const expanded = this.state()?.blocks.find((b) => b.block_id === blockId);
    if (!expanded) return err(sessionError("block disappeared after expansion", { blockId }));

    // The learner asked to go deeper — so the surface speaks the newly-generated layer live.
    // Interaction drives dynamic (re-)explanation; nothing here is pre-authored.
    const deepenedTexts = Object.keys(layers)
      .sort()
      .map((key) => layers[key])
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0);
    await this.choreographer.narrate({
      surface_id: this.surfaceId,
      block_id: blockId,
      agent_cid: expanded.provenance.producer_cid,
      agent_id: "explanation",
      role: "explainer",
      concept_id: expanded.concept_ids[0] ?? null,
      texts: deepenedTexts,
    });

    return ok(expanded);
  }

  /** Close the surface. State first, then the terminal event. */
  async close(reason = "session-ended"): Promise<Result<void, CosError>> {
    if (!this.surfaceId) return err(sessionError("surface session not started"));
    if (this.closed) return ok(undefined);
    const setStatus = this.world.apply({
      kind: "set_node_prop",
      id: `surface:${this.surfaceId}`,
      key: "status",
      value: "closed",
    });
    if (!setStatus.ok) return setStatus;
    this.closed = true;
    await this.emit("surface.session.closed", {
      surface_id: this.surfaceId,
      block_count: this.state()?.blocks.length ?? 0,
      reason,
    });
    return ok(undefined);
  }

  /**
   * Apply a governed learner interaction (S1.3, ADR-0024). Every interaction is recorded as
   * `surface.interaction.received` → effect → `surface.interaction.applied`, so it folds into
   * `SurfaceState` and replays exactly. `interrupt` is cooperative (the in-flight loop early-exits
   * at its next phase boundary); `jump`/`branch` refocus; reshaping kinds re-frame the last ask
   * through the same governed path.
   */
  async interact(
    input: SurfaceInteractionInput,
  ): Promise<Result<SurfaceInteractionResult, CosError>> {
    if (!this.surfaceId) return err(sessionError("surface session not started"));
    if (this.closed) return err(sessionError("surface session is closed"));
    const surfaceId = this.surfaceId;
    const interactionId = `ix-${this.idGenerator.hex(8)}`;
    await this.emit("surface.interaction.received", {
      surface_id: surfaceId,
      interaction_id: interactionId,
      kind: input.kind,
      ...(input.target_id ? { target_id: input.target_id } : {}),
    });

    let effect: SurfaceInteractionResult["effect"];
    let reason: string;
    switch (input.kind) {
      case "interrupt":
        this.interrupted = true;
        effect = "cancelled";
        reason = "learner interrupted the active cognition";
        break;
      case "jump":
        await this.focusConcept(surfaceId, input.target_id, "learner jumped to a concept");
        effect = "refocused";
        reason = "focus moved to the requested node";
        break;
      case "branch":
        await this.focusConcept(surfaceId, input.target_id, "learner branched exploration");
        effect = "reprojected";
        reason = "exploration branched from the requested node";
        break;
      default: {
        // Reshaping intents (challenge / request_depth / request_simplify / request_example):
        // re-frame the last ask through the same governed path.
        const reframed = this.reframeAsk(input);
        if (reframed) {
          const result = await this.ask(reframed);
          if (!result.ok) return result;
        }
        effect = "dispatched";
        reason = `re-framed cognition for ${input.kind}`;
        break;
      }
    }

    await this.emit("surface.interaction.applied", {
      surface_id: surfaceId,
      interaction_id: interactionId,
      effect,
      reason,
    });
    return ok({ interaction_id: interactionId, effect });
  }

  private async focusConcept(
    surfaceId: string,
    targetId: string | undefined,
    reason: string,
  ): Promise<void> {
    if (!targetId) return;
    await this.emit("surface.focus.changed", {
      surface_id: surfaceId,
      sequence: this.state()?.narration.length ?? 0,
      focus: { target_type: "concept", target_id: targetId, reason, spotlight: true },
    });
  }

  private reframeAsk(input: SurfaceInteractionInput): SurfaceAskInput | null {
    const base = this.lastAskInput;
    if (!base) return null;
    const concept = base.focusConceptId;
    const prompt =
      input.kind === "challenge"
        ? `Critically challenge and stress-test the explanation of ${concept}.`
        : input.kind === "request_depth"
          ? `Explain ${concept} in greater depth and rigor.`
          : input.kind === "request_simplify"
            ? `Explain ${concept} far more simply, starting from intuition.`
            : input.kind === "request_example"
              ? `Explain ${concept} through a concrete worked example.`
              : base.explanationPrompt;
    return { ...base, explanationPrompt: prompt };
  }

  // ---------------------------------------------------------------------------
  // S2.3 — Prerequisite-descent helpers (F03)
  // ---------------------------------------------------------------------------

  /**
   * Detect a confusion signal and identify the closest prerequisite to visit.
   * Primary trigger: depth gate explicitly failed (≥ 4 required, fewer passed).
   * Fallback: mastery not passed at low confidence (no depth tests run).
   */
  private resolveConfusionDescent(
    input: SurfaceAskInput,
    cycle: FiberedLearningLoopResult,
    timeline: TimelineProjection,
  ): { prereqId: string; trigger: "depth_gate_failed" | "low_confidence" } | null {
    const depthGate = cycle.mastery?.depthGate;
    const gateExplicitlyFailed = depthGate != null && !depthGate.passed;
    const lowConfidenceFailure =
      depthGate == null && !input.mastery.passed && input.mastery.confidence < 0.5;
    if (!gateExplicitlyFailed && !lowConfidenceFailure) return null;

    const trigger: "depth_gate_failed" | "low_confidence" = gateExplicitlyFailed
      ? "depth_gate_failed"
      : "low_confidence";

    // First direct prerequisite edge from the projected timeline graph.
    const prereqEdge = timeline.edges.find(
      (e) => e.edge_type === "prerequisite_of" && e.to === input.focusConceptId,
    );
    if (!prereqEdge) return null;
    return { prereqId: prereqEdge.from, trigger };
  }

  /**
   * Run a remedial sub-cycle on a prerequisite concept (S2.3, F03).
   * Emits `surface.prerequisite.descent.started` before the sub-cycle (D3 record-before-use)
   * and `surface.prerequisite.descent.completed` after. Best-effort — failure is swallowed
   * so the main `ask()` still returns the primary cycle result.
   */
  private async runPrerequisiteDescent(
    surfaceId: string,
    input: SurfaceAskInput,
    prereqId: string,
    trigger: "depth_gate_failed" | "low_confidence",
    blocks: CognitionBlock[],
  ): Promise<void> {
    const prereqTitle = input.concepts.find((c) => c.id === prereqId)?.title ?? prereqId;
    const conceptNodeId = `concept:${prereqId}`;

    // D3: record the descent BEFORE executing the sub-cycle.
    await this.emit("surface.prerequisite.descent.started", {
      surface_id: surfaceId,
      from_concept_id: input.focusConceptId,
      to_concept_id: prereqId,
      trigger,
    });

    // Descent banner block: makes the transition visible on the surface.
    const focusTitle =
      input.concepts.find((c) => c.id === input.focusConceptId)?.title ?? input.focusConceptId;
    const bannerReason =
      trigger === "depth_gate_failed"
        ? `Depth gate failed on "${focusTitle}" — visiting prerequisite first`
        : `Low-confidence mastery on "${focusTitle}" — visiting prerequisite first`;
    const banner = await this.contributions.contribute({
      surface_id: surfaceId,
      agent_id: "supervisor",
      agent_cid: this.supervisorCid,
      block_type: "routing",
      title: `Prerequisite Descent — ${prereqTitle}`,
      content: {
        target_agent: prereqId,
        reason: bannerReason,
        concept_id: prereqId,
      },
      concept_ids: [prereqId],
      reason: "prerequisite-descent initiated by supervisor",
      world_state_nodes: [conceptNodeId],
    });
    if (banner.ok) blocks.push(banner.value);

    let succeeded = false;
    try {
      const descentMastery: LearningLoopMasteryInput = {
        assessorCid: input.mastery.assessorCid,
        passed: true,
        confidence: 0.65,
        evidence: [
          { note: "prerequisite-descent remedial visit", prereq_for: input.focusConceptId },
        ],
      };
      const cycleResult = await this.deps.loop.run({
        session: this.deps.session,
        pathId: input.pathId,
        concepts: input.concepts,
        focusConceptId: prereqId,
        explanationPrompt: `Explain the prerequisite concept: ${prereqTitle}`,
        practicePrompt: `Practice the prerequisite concept: ${prereqTitle}`,
        mastery: descentMastery,
        surfaceId,
        isInterrupted: () => this.interrupted,
      });
      if (cycleResult.ok) {
        const cycle = cycleResult.value;
        if (cycle.explanation) {
          const block = await this.contributions.contribute(
            contributionFromDispatch({
              surface_id: surfaceId,
              agent_id: "explanation",
              block_type: "explanation",
              title: `Prerequisite — ${prereqTitle}`,
              dispatch: cycle.explanation,
              reason: "prerequisite-descent: remediating gap in learner knowledge",
              concept_ids: [prereqId],
              world_state_nodes: [conceptNodeId],
            }),
          );
          if (block.ok) blocks.push(block.value);
        }
        if (cycle.mastery) {
          const gatePassed = cycle.mastery.depthGate
            ? cycle.mastery.depthGate.passed
            : descentMastery.passed;
          const assessBlock = await this.contributions.contribute({
            surface_id: surfaceId,
            agent_id: "assessment",
            agent_cid: input.mastery.assessorCid,
            block_type: "assessment",
            title: `Prerequisite Check — ${prereqTitle}`,
            content: {
              checkpoint_node_id: cycle.mastery.checkpointNodeId,
              concept_node_id: cycle.mastery.conceptNodeId,
              passed: gatePassed,
              confidence: descentMastery.confidence,
              prerequisite_for: input.focusConceptId,
            },
            concept_ids: [prereqId],
            reason: "prerequisite-descent mastery checkpoint",
            confidence: descentMastery.confidence,
            world_state_nodes: [cycle.mastery.checkpointNodeId, cycle.mastery.conceptNodeId],
            memory_mutation_id: cycle.mastery.mutationId,
          });
          if (assessBlock.ok) blocks.push(assessBlock.value);
        }
        succeeded = true;
      }
    } catch {
      // Best-effort: swallow errors so the primary ask() result is unaffected.
    }

    await this.emit("surface.prerequisite.descent.completed", {
      surface_id: surfaceId,
      from_concept_id: input.focusConceptId,
      to_concept_id: prereqId,
      succeeded,
    });
  }

  // ---------------------------------------------------------------------------
  // S3.1 — Research-readiness helpers (F10, ADR-0026)
  // ---------------------------------------------------------------------------

  /**
   * Check whether the learner has reached research-readiness after a mastery cycle.
   * Threshold: `depthGate.passed === true && confidence >= 0.75` (gate-backed primary),
   * or `mastery.passed && confidence >= 0.85` (fallback when no depth tests ran).
   *
   * D3: emits `surface.research.frontier.detected` BEFORE any research agent is dispatched
   * (S3.2 wires the actual agent; this method only records the readiness intent).
   * When below threshold but mastery passed: emits `surface.research.frontier.deferred`.
   */
  private async resolveResearchReadiness(
    surfaceId: string,
    input: SurfaceAskInput,
    cycle: FiberedLearningLoopResult,
    blocks: CognitionBlock[],
  ): Promise<void> {
    const RESEARCH_READINESS_THRESHOLD = 0.75;
    const FALLBACK_READINESS_THRESHOLD = 0.85;
    const depthGate = cycle.mastery?.depthGate;

    const gateReady =
      depthGate != null &&
      depthGate.passed &&
      input.mastery.confidence >= RESEARCH_READINESS_THRESHOLD;
    const fallbackReady =
      depthGate == null &&
      input.mastery.passed &&
      input.mastery.confidence >= FALLBACK_READINESS_THRESHOLD;

    if (gateReady || fallbackReady) {
      // D3: record the readiness intent BEFORE any research agent dispatch.
      await this.emit("surface.research.frontier.detected", {
        surface_id: surfaceId,
        concept_id: input.focusConceptId,
        confidence: input.mastery.confidence,
        gate_passed: depthGate?.passed ?? false,
      });
      if (this.deps.researchDispatcher) {
        await this.runResearchFrontier(surfaceId, input, blocks);
      }
    } else {
      const anyMasteryPassed = (depthGate?.passed ?? false) || input.mastery.passed;
      if (anyMasteryPassed) {
        await this.emit("surface.research.frontier.deferred", {
          surface_id: surfaceId,
          concept_id: input.focusConceptId,
          confidence: input.mastery.confidence,
          reason: "confidence below research readiness threshold",
        });
      }
    }
  }

  /**
   * Dispatch the research agent and contribute a frontier block (S3.2, F10, ADR-0026).
   * D3 ordering: `surface.research.frontier.detected` was already emitted (the intent); this
   * method emits `surface.research.frontier.surfaced` AFTER the block is recorded — following
   * the same pattern as all other surface block emissions. Best-effort: errors are swallowed so
   * the primary `ask()` result is unaffected even when the research dispatch fails.
   */
  private async runResearchFrontier(
    surfaceId: string,
    input: SurfaceAskInput,
    blocks: CognitionBlock[],
  ): Promise<void> {
    if (!this.deps.researchDispatcher) return;
    const focusTitle =
      input.concepts.find((c) => c.id === input.focusConceptId)?.title ?? input.focusConceptId;
    const conceptNodeId = `concept:${input.focusConceptId}`;

    try {
      const dispatched = await this.deps.researchDispatcher.dispatch({
        session: this.deps.session,
        targetAgentId: "research",
        intent: `research frontier: ${focusTitle}`,
        conceptIds: [input.focusConceptId],
        content: {
          concept_id: input.focusConceptId,
          concept_title: focusTitle,
          context: input.goal,
        },
        maxTimeSeconds: 30,
      });
      if (!dispatched.ok) return;

      const response = dispatched.value.responsePackets[0];
      const rc = (response?.content ?? {}) as Record<string, unknown>;
      const frontier = typeof rc["frontier"] === "string" ? rc["frontier"] : "";
      const gap = typeof rc["gap"] === "string" ? rc["gap"] : "";
      const hypothesis_seed =
        typeof rc["hypothesis_seed"] === "string" ? rc["hypothesis_seed"] : "";
      const source_note = typeof rc["source_note"] === "string" ? rc["source_note"] : "";

      if (!frontier) return;

      // D3: emit the surfaced event before contributing the block.
      await this.emit("surface.research.frontier.surfaced", {
        surface_id: surfaceId,
        concept_id: input.focusConceptId,
        frontier,
        gap,
        hypothesis_seed,
        source_note,
        confidence: input.mastery.confidence,
        gate_passed: true,
      });

      const block = await this.contributions.contribute({
        surface_id: surfaceId,
        agent_id: "research",
        agent_cid: response?.source_cid ?? "agent.research",
        block_type: "research",
        title: `Research Frontier — ${focusTitle}`,
        content: { frontier, gap, hypothesis_seed, source_note },
        concept_ids: [input.focusConceptId],
        reason: "research frontier surfaced after verified mastery",
        world_state_nodes: [conceptNodeId],
      });
      if (block.ok) blocks.push(block.value);

      // Seed the `frontier_of` KG edge so the timeline graph can project it.
      const frontierSlug =
        frontier
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "")
          .slice(0, 60) || "frontier";
      const frontierNodeId = `concept:${frontierSlug}`;
      if (!this.world.getNode(frontierNodeId)) {
        this.world.apply({
          kind: "upsert_node",
          id: frontierNodeId,
          type: "concept",
          props: {
            label: frontier.slice(0, 80),
            layer: 6,
            domain: "research",
            ephemeral: true,
          },
        });
      }
      this.world.apply({
        kind: "upsert_edge",
        id: `edge:${conceptNodeId}:frontier_of:${frontierNodeId}`,
        from: conceptNodeId,
        to: frontierNodeId,
        type: "frontier_of",
        props: {},
      });
    } catch {
      // Best-effort: swallow errors so the primary ask() result is unaffected.
    }
  }

  // ---------------------------------------------------------------------------
  // S3.3 — Motivation helpers
  // ---------------------------------------------------------------------------

  /**
   * Surface a motivating message when the learner barely passed mastery.
   * Fires when mastery passed AND confidence is in [MOTIVATION_LOW, RESEARCH_READINESS_THRESHOLD).
   * D3: emits `surface.motivation.surfaced` before any agent dispatch.
   */
  private async resolveMotivation(
    surfaceId: string,
    input: SurfaceAskInput,
    blocks: CognitionBlock[],
  ): Promise<void> {
    const MOTIVATION_LOW = 0.6;
    const MOTIVATION_HIGH = 0.75; // same as RESEARCH_READINESS_THRESHOLD
    const conf = input.mastery.confidence;
    if (!input.mastery.passed || conf < MOTIVATION_LOW || conf >= MOTIVATION_HIGH) return;

    // D3: record the intent before any agent dispatch.
    await this.emit("surface.motivation.surfaced", {
      surface_id: surfaceId,
      concept_id: input.focusConceptId,
      confidence: conf,
    });

    if (this.deps.motivationDispatcher) {
      await this.runMotivation(surfaceId, input, blocks);
    }
  }

  /**
   * Dispatch the motivation agent and contribute a motivation block (S3.3).
   * Best-effort: errors are swallowed so the primary ask() result is unaffected.
   */
  private async runMotivation(
    surfaceId: string,
    input: SurfaceAskInput,
    blocks: CognitionBlock[],
  ): Promise<void> {
    if (!this.deps.motivationDispatcher) return;
    const focusTitle =
      input.concepts.find((c) => c.id === input.focusConceptId)?.title ?? input.focusConceptId;
    try {
      const dispatched = await this.deps.motivationDispatcher.dispatch({
        session: this.deps.session,
        targetAgentId: "motivation",
        intent: `motivation: barely passed ${focusTitle}`,
        conceptIds: [input.focusConceptId],
        content: {
          concept_id: input.focusConceptId,
          concept_title: focusTitle,
          confidence: input.mastery.confidence,
          context: input.goal,
        },
        maxTimeSeconds: 20,
      });
      if (!dispatched.ok) return;

      const response = dispatched.value.responsePackets[0];
      const rc = (response?.content ?? {}) as Record<string, unknown>;
      const message = typeof rc["message"] === "string" ? rc["message"] : "";
      if (!message) return;

      const block = await this.contributions.contribute({
        surface_id: surfaceId,
        agent_id: "motivation",
        agent_cid: response?.source_cid ?? "agent.motivation",
        block_type: "motivation",
        title: `Keep going — ${focusTitle}`,
        content: { message, confidence: input.mastery.confidence },
        concept_ids: [input.focusConceptId],
        reason: "barely-passed mastery — sustaining learner momentum",
        world_state_nodes: [],
      });
      if (block.ok) blocks.push(block.value);
    } catch {
      // Best-effort: swallow errors so the primary ask() result is unaffected.
    }
  }

  // ---------------------------------------------------------------------------
  // S4.2 — Cognitive evaluation (ADR-0027)
  // ---------------------------------------------------------------------------

  private async resolveEvaluation(
    surfaceId: string,
    input: SurfaceAskInput,
    cycle: FiberedLearningLoopResult,
  ): Promise<void> {
    const engine = this.deps.evaluationEngine;
    if (!engine) return;

    const explanation = cycle.explanation;
    const depthGate = cycle.mastery?.depthGate;

    const trace: ReasoningTrace = {
      trace_id: `surface-eval-${surfaceId}-${this.idGenerator.hex(6)}`,
      producer_cid: explanation?.packet.source_cid ?? this.supervisorCid,
      task_interpretation: `explanation for concept ${input.focusConceptId}`,
      strategy: "chain",
      claims: explanation
        ? [
            {
              claim_id: "c0",
              statement:
                ((explanation.packet.content as Record<string, unknown> | undefined)?.[
                  "layer_0"
                ] as string | undefined) ?? input.explanationPrompt,
              confidence: explanation.packet.confidence ?? 0.5,
            },
          ]
        : [],
      decision: input.explanationPrompt,
      determinism_level: "D1",
    };

    const context: ScorecardContext = {
      concept_id: input.focusConceptId,
      masteryConfidence: input.mastery.confidence,
      depthGate: depthGate
        ? {
            passed: depthGate.passed,
            passed_count: depthGate.passedCount,
            total_count: depthGate.totalCount,
            tests: depthGate.tests.map((t) => ({
              kind: t.kind,
              passed: t.passed,
              confidence: t.confidence,
            })),
          }
        : undefined,
    };

    try {
      const { record } = await engine.evaluate(trace, context);
      await this.emit("surface.evaluation.recorded", {
        surface_id: surfaceId,
        concept_id: record.concept_id,
        scorecard_id: record.scorecard_id,
        score: record.score,
        passed: record.passed,
        dimension_scores: record.dimension_scores,
        hlc: record.hlc,
      });
    } catch {
      // Best-effort: swallow errors so the primary ask() result is unaffected.
    }
  }

  /**
   * The current surface state — a pure fold over the replayed `surface.*` event log.
   * There is no other state store; replay IS the state path.
   */
  state(): SurfaceState | null {
    if (!this.surfaceId) return null;
    return foldSurfaceEvents(this.surfaceEvents(), this.surfaceId);
  }

  /** Full provenance chain for one visible artifact. */
  trace(blockId: string): Result<BlockTrace, CosError> {
    const state = this.state();
    if (!state) return err(sessionError("surface session not started"));
    return traceBlock(state, this.world, this.surfaceEvents(), blockId);
  }

  private surfaceEvents(): readonly CognitiveEvent[] {
    return this.bus.replay({ subject: "surface.>" });
  }

  private async emit(eventType: string, payload: Record<string, unknown>): Promise<void> {
    const created = createEvent(
      {
        eventType,
        producerCid: this.deps.session.learnerIdentity.cid,
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
