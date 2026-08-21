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
  FrameElementSink,
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
import {
  MCCR_ELEMENT_TYPES,
  type CognitiveFrame,
  type FrameKind,
  type MccrElementType,
} from "./frames";
import { AgentContributionRuntime, contributionFromDispatch } from "./contribution";
import { SurfaceChoreographer, type VoiceSynthesizer } from "./narration";
import type { MediaGenerator } from "./providers";
import { foldSurfaceEvents, type SurfaceState } from "./projection";
import {
  planSourceProjection,
  type SourceEvidenceAnchorView,
  type SourceEvidenceProvider,
  type FusedSynthesisView,
  type SurfaceFrontierProvider,
} from "./source-projection";
import { decideDirective, inferAffect, type DirectorSignals } from "./theater";
import {
  planRepresentation,
  expertiseFromMastery,
  type ExpertiseLevel,
  type RepresentationElementPlan,
  type RepresentationPlan,
} from "./representation";
import { planShots } from "./cinematography";
import { interpretIntent } from "./interaction";
import { SurfaceTimelineBuilder, type TimelineProjection } from "./timeline";
import { traceBlock, type BlockTrace } from "./trace";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Structural view of a governed dispatcher (ProductRuntimeDispatcher satisfies it). */
export interface GovernedDispatcher {
  dispatch(input: ProductDispatchInput): Promise<Result<ProductDispatchResult, CosError>>;
  /**
   * Optional live-streaming dispatch (ADR-0063 Phase B): attaches a `FrameElementSink` so a
   * streaming-capable unit reports content as it forms. Absent ⇒ the caller uses `dispatch` (no
   * streaming). The canonical result is identical either way.
   */
  dispatchStreaming?(
    input: ProductDispatchInput,
    sink: FrameElementSink,
  ): Promise<Result<ProductDispatchResult, CosError>>;
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

/**
 * The learner-facing text a model-backed dispatch actually produced (summary → layer_0 → text). Used
 * to put the Coach's REAL generated practice problem on the board, never the meta-prompt that
 * instructed it (UCS review N3: the board holds cognition, not the system's plumbing).
 */
function dispatchText(dispatch: ProductDispatchResult): string {
  const content = (dispatch.responsePackets[0]?.content ?? {}) as Record<string, unknown>;
  const layers = content["layers"] as Record<string, unknown> | undefined;
  const summary = typeof content["summary"] === "string" ? (content["summary"] as string) : "";
  const layer0 =
    layers && typeof layers["layer_0"] === "string" ? (layers["layer_0"] as string) : "";
  const text = typeof content["text"] === "string" ? (content["text"] as string) : "";
  return (summary || layer0 || text).trim();
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

/** A frame reserved + composed but not yet surfaced — the unit of the one-ahead compose pipeline. */
interface PreparedFrame {
  readonly frameId: string;
  readonly ordinal: number;
  readonly frameTitle: string;
  readonly artifacts: {
    mccr: Record<string, unknown>;
    scriptSegments: Record<string, unknown>[];
    imagePlan: { helps: boolean; modality: string; prompt: string | null; rationale: string };
    composerCid: string;
    composerPacketId: string | null;
    confidence: number;
    reasoning: string;
    trace: ReasoningTrace | null;
    workId: string | null;
    deferredImage: { subFocus?: string; composerPlan: Record<string, unknown> } | null;
  };
}

/** One look-ahead bet read from the planner's `frame_plan.lookahead` (UCS, ADR-0030; Phase 3). */
interface LookaheadPlanEntry {
  readonly title: string;
  readonly sub_focus: string;
  readonly archetype: string;
  readonly slots: readonly string[];
  readonly trigger_assumption: string;
}

/** Read the planner's `frame_plan.lookahead` bets from a response packet's content. */
function readLookaheadEntries(raw: unknown): LookaheadPlanEntry[] {
  const fp = (raw ?? {}) as Record<string, unknown>;
  const list = Array.isArray(fp["lookahead"]) ? (fp["lookahead"] as unknown[]) : [];
  const entries: LookaheadPlanEntry[] = [];
  for (const e of list) {
    const o = (e ?? {}) as Record<string, unknown>;
    const title = typeof o["title"] === "string" ? o["title"].trim() : "";
    const trigger =
      typeof o["trigger_assumption"] === "string" ? o["trigger_assumption"].trim() : "";
    if (!title || !trigger) continue;
    entries.push({
      title,
      sub_focus: typeof o["sub_focus"] === "string" ? o["sub_focus"] : "",
      archetype: typeof o["archetype"] === "string" ? o["archetype"] : "concept-first",
      slots: Array.isArray(o["slots"])
        ? (o["slots"] as unknown[]).filter((s): s is string => typeof s === "string")
        : [...DEFAULT_PLAN_SLOTS],
      trigger_assumption: trigger,
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

/** Map an MCCR element type to a Cognitive Scene actor kind (CSE-012 §3.2). */
function actorKindFor(type: string): string {
  switch (type) {
    case "key_formula":
      return "equation";
    case "diagram":
      return "diagram";
    case "table":
      return "table";
    case "image":
      return "image";
    case "source_viewport":
      return "citation";
    default:
      return "text-anchor";
  }
}

/**
 * Derive the Scene's actors from a composed frame's MCCR (CSE M7 T1, CSE-012 §3.2): each present
 * MCCR element becomes a cognitive actor, reusing its element id as `content_ref` (the Scene
 * composes existing content, it invents no storage). The core concept is the protagonist; the
 * source_viewport carries the evidence provenance channel. Deterministic given the id stream.
 */
function actorsFromMccr(
  mccr: Record<string, unknown>,
  idGenerator: IdGenerator,
): Array<Record<string, unknown>> {
  const actors: Array<Record<string, unknown>> = [];
  for (const type of MCCR_ELEMENT_TYPES) {
    const element = mccr[type] as Record<string, unknown> | undefined;
    if (!element) continue;
    const elementId =
      typeof element["element_id"] === "string" ? element["element_id"] : `el-${type}`;
    actors.push({
      actor_id: `act-${idGenerator.hex(8)}`,
      kind: actorKindFor(type),
      content_ref: elementId,
      role:
        type === "core_concept"
          ? "protagonist"
          : type === "source_viewport"
            ? "evidence"
            : "support",
      provenance_class: type === "source_viewport" ? "evidence" : "inference",
      can_evolve: true,
    });
  }
  return actors;
}

/**
 * Inject the frame's `source_viewport` MCCR element (CSE M5, CSE-008 §3.2): the primary resolved
 * evidence anchor on the board, in its own provenance channel. Non-destructive — the composer's
 * distilled elements are untouched; an existing `source_viewport` (unexpected) is preserved.
 */
function withSourceViewportElement(
  mccr: Record<string, unknown>,
  conceptId: string,
  anchor: SourceEvidenceAnchorView,
): Record<string, unknown> {
  if (mccr["source_viewport"]) return mccr;
  return {
    ...mccr,
    source_viewport: {
      element_id: "el-source_viewport",
      type: "source_viewport",
      slot: "source_viewport",
      reveal_order: MCCR_ELEMENT_TYPES.length, // revealed last — evidence after the distillation
      concept_id: conceptId,
      content: {
        kind: "source_viewport",
        source_version_id: anchor.source_version_id,
        anchor_ref: anchor.anchor_id,
        quote: anchor.region.quote,
        region: {
          path: anchor.region.path,
          page: anchor.region.page,
          bbox: anchor.region.bbox,
          char_start: anchor.region.char_start,
          char_end: anchor.region.char_end,
        },
      },
    },
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
   * Optional grounded frontier provider (CSE M9 LKS T1, ADR-0045). When present, research-readiness
   * surfaces the REAL web-grounded frontier (ADR-0043) instead of the ungrounded `researchDispatcher`
   * breadcrumb — grounded-or-deferred, never fabricated. Takes precedence over `researchDispatcher`;
   * absent ⇒ the legacy ungrounded path runs (CLI/tests stay byte-identical).
   */
  readonly frontierProvider?: SurfaceFrontierProvider;
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
   * Optional Representation Intelligence dispatcher (RIA; CSE-018, ADR-0058, R4-model). When present,
   * the model assigns each element's epistemic role + hierarchy (and exclusions/adaptivity); absent
   * or degraded ⇒ the deterministic `planRepresentation` floor (parity — never regresses a frame).
   */
  readonly representationDispatcher?: GovernedDispatcher;
  /**
   * Optional learner-expertise signal (CSE-018 Law 8, R4e). When present, the RepresentationPlan
   * adapts to it — an expert sees redundant scaffolding (worked examples, analogies) recede to
   * residue (expertise reversal). Absent ⇒ the un-adapted floor (parity; `adaptivity: null`). Same
   * inversion-of-control pattern as `getDepthBias`: the callback closes over live learner state, no
   * upward dependency. Live derivation from mastery history is the intended hookup (deferred).
   */
  readonly getExpertise?: () => ExpertiseLevel;
  /**
   * Optional Image Agent dispatcher (UCS, ADR-0030; Phase 4). When present, the image-as-cognition
   * decision is owned by a dedicated governed agent (decide/prompt/refine) that produces the prompt
   * plus an explanatory caption + callout labels, replacing the composer's inline `image_plan` on the
   * frame path. Absent ⇒ the composer's inline image decision drives generation (Phase 1–3 behaviour).
   */
  readonly imagePlannerDispatcher?: GovernedDispatcher;
  /**
   * Optional Grader dispatcher (F14): when present, `submitAnswer` grades a learner's actual answer to
   * a practice problem into a genuine, evidence-bearing depth-gate — mastery earned from real learner
   * evidence, never fabricated. Absent ⇒ the answer is recorded but the honest gate degrades to ungraded.
   */
  readonly assessmentDispatcher?: GovernedDispatcher;
  /**
   * Optional source-evidence seam (CSE M5, CSE-008): resolved anchors for a concept across the
   * surface's attached Canonical Source Environments. When present, composed frames carry a
   * `source_viewport` MCCR element and the session plans/emits the `surface.source.*` projection
   * (viewport plan, semantic highlights, attention contract) as a composer role. Absent ⇒ frames
   * compose exactly as before — no source projection (honest absence, F16 §12 graceful fallback).
   */
  readonly sourceEvidence?: SourceEvidenceProvider;
  /**
   * Enable the Cognitive Theater (CSE M7 T1, ADR-0033/0038): after each composed frame the
   * Director (an authored pedagogy FSM — deterministic) issues a directive naming the cognitive
   * state to enter and at what pace, the behavioral affect channel records a signal, and the
   * frame is wrapped as a living Scene (actors + lighting). All additive; absent ⇒ frames compose
   * byte-identically to today (ADR-0033 L2). The gateway sets this; the CLI/tests leave it off.
   */
  readonly theater?: boolean;
  /**
   * Look-ahead budget (UCS, ADR-0030; Phase 3): number of discardable speculative frames the planner
   * may pre-compose ahead of the learner. Default 0 (off) — deterministic, no speculation.
   */
  readonly lookaheadBudget?: number;
  /**
   * Live look-ahead budget (UCS, ADR-0030; Phase 3): when present, overrides `lookaheadBudget` per ask
   * so a governed evolution rollout can raise/lower speculation without a restart (same direction-safe
   * pattern as `getDepthBias` — the callback closes over `LiveEvolutionConfig`, no upward dependency).
   */
  readonly getLookaheadBudget?: () => number;
  /** CID stamped on supervisor routing blocks. */
  readonly supervisorCid?: string;
  /**
   * Optional live progressive-reveal pacing for the explanation block (S-UCS, ADR-0028). When > 0,
   * the explanation streams as ordered `surface.block.delta` chunks (paced by this many ms) before the
   * canonical whole block, so generation visibly unfolds. Absent/0 ⇒ the whole block is emitted at once
   * (the default; keeps deterministic/replay runs and tests byte-identical).
   */
  readonly streamRevealMs?: number;
  /**
   * Live board streaming (ADR-0063 Phase B): when true AND the composer dispatcher + model support
   * streaming, each frame's MCCR string anchors surface as `surface.frame.element.delta` the moment
   * they finish generating — the learner watches the board form before it composes. Absent/false ⇒ the
   * whole frame lands at once (the default; keeps deterministic/replay runs and every test byte-identical,
   * since the transient deltas are cleared by `surface.frame.composed` and never touch settled state).
   */
  readonly frameStreamEnabled?: boolean;
  /**
   * Whether practice + mastery-checkpoint are surfaced as on-screen Cognitive Frames. Default OFF:
   * the Cognitive Surface is a TEACHING surface — a topic is planned into concepts and each concept
   * taught as a sequence of explanatory frames (with images), and the lesson simply ends there. The
   * practice/checkpoint learning-loop still runs as the cognitive SUBSTRATE (blocks, depth gate,
   * mastery memory), but its "Practice — …" and "Ready to practice/Checkpoint — …" frames no longer
   * interrupt the teaching flow. Set true to restore them (e.g. an assessment-mode surface, or tests).
   */
  readonly surfacePracticeFrames?: boolean;
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

/**
 * The learner interaction vocabulary. The original ADR-0024 seven plus the CSE-014 grammar
 * (CSE M8 T2): Mark-class acts evolve the Scene in place; Ask-class re-frame cognition. Kept as a
 * broad string union so the grammar registry (interaction.ts) stays the single source of truth for
 * classification/routing — an unrecognized kind interprets to a safe `ask-why` (CSE-014 §7).
 */
export type SurfaceInteractionKind =
  | "interrupt"
  | "jump"
  | "branch"
  | "challenge"
  | "request_depth"
  | "request_simplify"
  | "request_example"
  // CSE-014 grammar (M8 T2) — Mark class (evolve the Scene in place):
  | "annotate"
  | "circle"
  | "highlight"
  | "pin"
  // Ask class:
  | "ask_why"
  | "ask_again"
  | "ask_simpler"
  | "ask_deeper"
  | "ask_example"
  | "define";

export interface SurfaceInteractionInput {
  readonly kind: SurfaceInteractionKind;
  /** Concept id (for jump/branch) the interaction targets. */
  readonly target_id?: string;
  /** Free-form note (e.g. the learner's challenge text). */
  readonly note?: string;
}

export interface SurfaceInteractionResult {
  readonly interaction_id: string;
  readonly effect:
    | "cancelled"
    | "refocused"
    | "dispatched"
    | "reprojected"
    | "scene-evolved"
    | "annotated";
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
  /**
   * The current ask's frame-planner look-ahead bets (UCS, ADR-0030; Phase 3), captured during
   * `dispatchFramePlan` and consumed at the end of the ask to pre-compose speculative next-step
   * frames within the governed budget. Reset at the start of every ask.
   */
  private pendingLookahead: {
    entries: LookaheadPlanEntry[];
    plannerPacketId: string | null;
  } | null = null;
  /** One ask at a time — a second ask mid-flight is refused, never a silent state reset. */
  private askInFlight = false;
  /** Detached background cognition (speculative pre-composition) — settled at next ask / close. */
  private backgroundWork: Promise<void> | null = null;
  /**
   * Cancels the in-flight background speculation (ADR-0063 Phase F). A learner `interrupt` aborts it
   * so the gateway stops paying for a now-stale look-ahead frame's image + emits. The composer
   * dispatch already in flight can't be recalled, but everything after it is skipped, and the
   * speculation leaves no trace in the event log (replay-clean).
   */
  private bgAbort: AbortController | null = null;

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
   * Bind a Canonical Source Environment to this session (CSE M5, CSE-008 §3.1): emits
   * `surface.source.attached`. Bytes never enter the event — clients fetch canonical content
   * out-of-band via the gateway source-content route (`content_ref`) and may prove fidelity by
   * hashing it against the version's content hash (ADR-0036). Idempotent at the fold (upsert by
   * `source_version_id`), so re-attachment is safe.
   */
  async attachSource(input: {
    readonly sourceId: string;
    readonly sourceVersionId: string;
    readonly modality: string;
    readonly title: string;
    readonly layersAvailable: readonly string[];
    readonly contentRef: string;
  }): Promise<Result<void, CosError>> {
    if (!this.surfaceId) return err(sessionError("surface session not started"));
    if (this.closed) return err(sessionError("surface session is closed"));
    await this.emit("surface.source.attached", {
      surface_id: this.surfaceId,
      source_id: input.sourceId,
      source_version_id: input.sourceVersionId,
      modality: input.modality,
      title: input.title,
      layers_available: input.layersAvailable,
      content_ref: input.contentRef,
    });
    return ok(undefined);
  }

  /**
   * Project a returning learner's episode resume card (CSE M6, CSE-005 §4; ADR-0037): emits
   * `surface.resume.projected`, folded latest-wins into `SurfaceState.resume_card`. The caller
   * (the gateway host) derives the card ONLY from the intelligence plane's latest episode +
   * understanding-delta artifacts — this method never sees raw history, and a learner with no
   * artifacts gets no card (honest absence, never a fabricated welcome-back).
   */
  async projectResumeCard(card: {
    readonly episodeRef: string;
    readonly deltaRef: string | null;
    readonly summary: string;
    readonly lastConceptRef: string | null;
    readonly conceptsTouched: readonly string[];
    readonly openConfusions: readonly { description: string; concept_ref: string }[];
    readonly daysSince: number;
  }): Promise<Result<void, CosError>> {
    if (!this.surfaceId) return err(sessionError("surface session not started"));
    if (this.closed) return err(sessionError("surface session is closed"));
    await this.emit("surface.resume.projected", {
      surface_id: this.surfaceId,
      episode_ref: card.episodeRef,
      delta_ref: card.deltaRef,
      summary: card.summary,
      last_concept_ref: card.lastConceptRef,
      concepts_touched: card.conceptsTouched,
      open_confusions: card.openConfusions,
      days_since: card.daysSince,
    });
    return ok(undefined);
  }

  /**
   * One ask cycle: living timeline → governed learning cycle (supervisor routing, agent
   * dispatches, mastery) → cognition blocks → timeline re-projection.
   *
   * Concurrency law: ONE ask at a time. A second ask mid-flight is refused (never silently resets
   * session state under the first — review §25); the learner interrupts via `interact` instead.
   * Any detached background cognition from the previous ask (speculation) settles first.
   */
  async ask(input: SurfaceAskInput): Promise<Result<SurfaceAskResult, CosError>> {
    if (!this.surfaceId) return err(sessionError("surface session not started"));
    if (this.closed) return err(sessionError("surface session is closed"));
    if (this.askInFlight) {
      return err(sessionError("an ask is already in flight — interrupt it or wait"));
    }
    this.askInFlight = true;
    try {
      await this.settle();
      return await this.runAsk(input);
    } finally {
      this.askInFlight = false;
    }
  }

  /**
   * Await any detached background cognition (speculative pre-composition runs OFF the ask's
   * critical path — review §22). Called automatically at the next ask and at close; tests call it
   * for quiescence before asserting on the event log.
   */
  async settle(): Promise<void> {
    const work = this.backgroundWork;
    this.backgroundWork = null;
    // settle means "let it finish" (quiescence), so drop the cancel handle rather than fire it.
    this.bgAbort = null;
    if (work) await work;
  }

  private async runAsk(input: SurfaceAskInput): Promise<Result<SurfaceAskResult, CosError>> {
    const surfaceId = this.surfaceId as string;
    const learner = this.deps.session;
    // A fresh ask clears any prior interrupt and is the reshaping baseline (S1.3).
    this.interrupted = false;
    this.lastAskInput = input;
    // A fresh ask re-plans look-ahead from scratch (UCS, ADR-0030; Phase 3).
    this.pendingLookahead = null;

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

    // 2. The governed learning cycle on the existing substrate. The learner sees each phase of the
    //    multi-step pipeline as it happens (surface.ask.progress — an ask is never silent).
    await this.emitAskProgress(
      surfaceId,
      "interpreting",
      input.concepts.find((c) => c.id === input.focusConceptId)?.title ?? input.focusConceptId,
    );
    const composerWired = !!this.deps.composerDispatcher;
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
      // Progressive first-frame delivery (ADR-0063): when a composer is wired the frame board is
      // distilled by the Composer, and the loop's explanation output is discarded — so we skip that
      // model round-trip (and its concurrent challenger) to shorten time-to-first-frame. The legacy
      // explanation-block path (no composer) still generates it.
      skipExplanation: composerWired,
      // On the composer path run ONLY supervisor routing here so Frame 1 can compose immediately;
      // practice + mastery run in a follow-up pass below, after the first frame has surfaced.
      ...(composerWired ? { only: "routing" as const } : {}),
      ...(input.assembledContextItems
        ? { assembledContextItems: input.assembledContextItems }
        : {}),
    });
    if (!loopResult.ok) return loopResult;
    let cycle = loopResult.value;
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
    // Progressive first-frame delivery (ADR-0063): Frame 1 has now surfaced. Run the deferred
    // practice + mastery model work as a follow-up pass, re-using the routing already decided (so the
    // supervisor is neither re-run nor re-emitted). This pass was split off the routing pass above so
    // the practice model call never blocked the first frame. Skipped when routing was terminal (the
    // routing-only pass early-exited, exactly as the full cycle would have) or when no composer split
    // the cycle (the legacy path already produced a full cycle in one pass).
    if (
      composerWired &&
      cycle.routing.targetAgent !== "complete" &&
      cycle.routing.targetAgent !== "revision"
    ) {
      const followUp = await this.deps.loop.run({
        session: learner,
        pathId: input.pathId,
        concepts: input.concepts,
        focusConceptId: input.focusConceptId,
        explanationPrompt: input.explanationPrompt,
        practicePrompt: input.practicePrompt,
        mastery: input.mastery,
        surfaceId,
        isInterrupted: () => this.interrupted,
        skipExplanation: true,
        only: "practice-mastery",
        precomputedRouting: cycle.routing,
        ...(input.assembledContextItems
          ? { assembledContextItems: input.assembledContextItems }
          : {}),
      });
      if (!followUp.ok) return followUp;
      cycle = { ...cycle, practice: followUp.value.practice, mastery: followUp.value.mastery };
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
      // Teaching-surface default (product): the practice FRAME is suppressed so the flow stays pure
      // teaching (the practice block + mastery substrate still run above); opt in with surfacePracticeFrames.
      if (onPlannerFramePath && this.deps.surfacePracticeFrames) {
        // Put the Coach's REAL generated problem on the board (N3), not `input.practicePrompt` (the
        // meta-instruction that produced it). The check segment `pause_after` holds so the frame
        // gives the learner time to work it before the lesson moves on.
        const practiceProblem = dispatchText(cycle.practice) || input.practicePrompt;
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
          kind: "practice",
          mccr: {
            core_concept: mccrTextSlot(
              "core_concept",
              `Practice — ${focusTitle}`,
              input.focusConceptId,
            ),
            key_example: mccrTextSlot("key_example", practiceProblem, input.focusConceptId),
          },
          segments: [
            {
              text: "Now make it your own — work through this before we move on.",
              anchor_ref: "key_example",
              intent: "check",
              pause_after: true,
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
      // UCS (ADR-0030; Phase 2): the checkpoint closes the lesson as its own Cognitive Frame. It is
      // labeled HONESTLY (review N2): only a real five-test depth gate is called "mastery verified";
      // absent a graded gate this is a readiness self-check ("taught — practice to verify"), never a
      // fabricated claim that the learner passed tests they were never given.
      // Teaching-surface default (product): the checkpoint FRAME is suppressed (the mastery is still
      // recorded above); opt in with surfacePracticeFrames for an assessment-mode surface.
      if (onPlannerFramePath && this.deps.surfacePracticeFrames) {
        const summary = !gatePassed
          ? "Not yet — let's reinforce the gaps and return."
          : depthGate
            ? `Mastery verified — ${depthGate.passedCount}/${depthGate.totalCount} depth checks passed.`
            : "Concept taught — work the practice to verify your mastery.";
        const frameTitle =
          depthGate || !gatePassed
            ? `Checkpoint — ${focusTitle}`
            : `Ready to practice — ${focusTitle}`;
        await this.composeDeterministicFrame({
          surfaceId,
          conceptId: input.focusConceptId,
          conceptNodeId,
          frameTitle,
          archetype: "concept-first",
          producerCid: input.mastery.assessorCid,
          agentId: "assessment",
          role: "assessor",
          reason: "mastery checkpoint rendered as a Cognitive Frame",
          kind: "checkpoint",
          mccr: {
            core_concept: mccrTextSlot("core_concept", frameTitle, input.focusConceptId),
            memory_cue: mccrTextSlot("memory_cue", summary, input.focusConceptId),
          },
          segments: [{ text: summary, anchor_ref: "memory_cue", intent: "reinforce" }],
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
    // Skipped when the explanation was not generated (composer frame path, ADR-0063): the evaluation
    // scores the explanation's reasoning trace, so there is nothing to evaluate.
    if (this.deps.evaluationEngine && cycle.explanation) {
      await this.resolveEvaluation(surfaceId, input, cycle);
    }

    // 11. UCS (ADR-0030; Phase 3 → ADR-0064 rolling buffer) — Governed look-ahead: after mastery,
    // pre-compose the next N concepts within the budget (N = look-ahead budget). Recorded but never
    // surfaced until a future ask promotes it. A prerequisite descent means the learner struggled on
    // THIS concept, but the path ahead is unchanged — so we still pre-warm it (ADR-0064), which is
    // exactly when instant next steps matter most.
    // DETACHED (review §22): speculation's cost is never paid inside the learner's ask latency —
    // the response returns now, the speculative events stream in behind it, and `settle()` (next
    // ask / close / tests) awaits completion.
    if (onPlannerFramePath && cycle.mastery) {
      // Cancellable (ADR-0063 Phase F): a learner interrupt aborts this stale speculation at its next
      // checkpoint, so the gateway stops before the look-ahead frame's image + emits.
      const abort = new AbortController();
      this.bgAbort = abort;
      this.backgroundWork = this.prepareLookahead({ surfaceId, input, signal: abort.signal })
        .catch(() => undefined)
        .then(() => undefined);
    }

    await this.emitAskProgress(surfaceId, "ready", focusTitle);
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
   * Plan a concept's Cognitive Frames (UCS, ADR-0030; Phase 2), then compose them as a PIPELINE.
   * The Frame Planner decomposes the concept into a progressive series of viewport-complete frames
   * (intuition → definition → example → connection); the Surface Composer distills each one's MCCR +
   * narration. Frame N+1's composition dispatch starts BEFORE frame N is voiced (one-ahead — the
   * learner listens while the next board forms; review §22 "the learner should almost never wait"),
   * while frames still SURFACE strictly in order. A blocked planner dispatch degrades to a single
   * default frame (teaching still happens). The learner's interrupt is honored between frames.
   */
  private async planAndComposeFrames(args: {
    surfaceId: string;
    input: SurfaceAskInput;
    focusTitle: string;
    conceptNodeId: string;
  }): Promise<Result<void, CosError>> {
    // Reconcile any prior-ask speculation against what the learner actually asked (UCS, ADR-0030;
    // Phase 3): a bet on THIS concept is promoted (its pre-composed opening frame surfaces + voices,
    // skipping recompute); every other pending bet is invalidated. Never surfaces until promoted.
    const promoted = await this.reconcileSpeculations(args);
    await this.emitAskProgress(args.surfaceId, "planning", args.focusTitle);
    const { plannerPacketId, frames } = await this.dispatchFramePlan(args);
    // If a speculative opening frame was promoted for this concept, it already stands as frame 1 —
    // compose only the remaining plan entries so the sequence never double-opens.
    const toCompose = promoted ? frames.slice(1) : frames;
    let next: Promise<PreparedFrame | null> | null =
      toCompose.length > 0
        ? this.prepareFrameEntry({ ...args, plan: { entry: toCompose[0]!, plannerPacketId } })
        : null;
    for (let i = 0; next !== null; i++) {
      const prepared = await next;
      // One-ahead: the next frame's composition starts now, overlapping this frame's voicing.
      next =
        i + 1 < toCompose.length && !this.interrupted
          ? this.prepareFrameEntry({
              ...args,
              plan: { entry: toCompose[i + 1]!, plannerPacketId },
            })
          : null;
      if (prepared) await this.surfaceFrameEntry({ ...args, prepared });
      if (this.interrupted) {
        // Drain the in-flight composition (its events must land coherently), then stop surfacing.
        if (next) await next;
        break;
      }
    }
    return ok(undefined);
  }

  /**
   * Reconcile pending speculative frames against the current ask (UCS, ADR-0030; Phase 3). A
   * still-speculative frame whose `concept_id` matches the focus is PROMOTED — copied into the
   * canonical frame line with a final ordinal and voiced from its recorded script (skip-recompute);
   * every other pending bet is INVALIDATED (the learner diverged). Returns true iff one was promoted.
   */
  private async reconcileSpeculations(args: {
    surfaceId: string;
    input: SurfaceAskInput;
    conceptNodeId: string;
  }): Promise<boolean> {
    const state = this.state();
    const pending = (state?.speculative_frames ?? []).filter((f) => f.status === "speculative");
    if (pending.length === 0) return false;
    // ADR-0064 rolling buffer: the focus's frame is promoted; frames for concepts STILL AHEAD on the
    // path are kept warm (the buffer survives an advance); only frames now behind or off-path are
    // discarded. `ahead` is the set of concept ids after the new focus in path order.
    const focusIndex = args.input.concepts.findIndex((c) => c.id === args.input.focusConceptId);
    const ahead = new Set(
      focusIndex >= 0 ? args.input.concepts.slice(focusIndex + 1).map((c) => c.id) : [],
    );
    let promoted = false;
    for (const spec of pending) {
      if (!promoted && spec.concept_id === args.input.focusConceptId) {
        await this.promoteSpeculation(args.surfaceId, spec, args.conceptNodeId, args.input);
        promoted = true;
      } else if (spec.concept_id && ahead.has(spec.concept_id)) {
        // Still on the road ahead — leave it speculative so the learner reaches an instant frame.
        continue;
      } else {
        await this.emit("surface.frame.speculation.invalidated", {
          surface_id: args.surfaceId,
          frame_id: spec.frame_id,
          reason: `learner advanced to ${args.input.focusConceptId}, not the predicted ${spec.concept_id ?? "unknown"}`,
        });
      }
    }
    return promoted;
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

    const startedMs = this.clock.nowMs();
    // R2a (ADR-0057 D1): when a source is bound, feed the concept's anchored passages INTO the plan
    // so the planner decomposes the DOCUMENT, not just the title. Empty ⇒ goal-mode (unchanged).
    const sourceExcerpts = await this.sourceExcerptsFor(args.input.focusConceptId, args.focusTitle);
    const dispatched = await dispatcher.dispatch({
      session: this.deps.session,
      targetAgentId: "frameplanner",
      intent: `plan frames: ${args.focusTitle}`,
      conceptIds: [args.input.focusConceptId],
      content: {
        concept_id: args.input.focusConceptId,
        concept_title: args.focusTitle,
        goal: args.input.goal,
        ...(sourceExcerpts.length > 0 ? { source_excerpts: sourceExcerpts } : {}),
        ...(args.input.explanationPrompt ? { prompt: args.input.explanationPrompt } : {}),
      },
    });
    if (!dispatched.ok) return fallback;
    const response = dispatched.value.responsePackets[0];
    const content = (response?.content ?? {}) as Record<string, unknown>;
    await this.emitDegradedIfFallback(args.surfaceId, "frameplanner", content);
    const frames = readPlanEntries(content["frame_plan"]);
    if (frames.length === 0) return fallback;

    // Capture the planner's look-ahead bets (UCS, ADR-0030; Phase 3) for end-of-ask speculation.
    const lookahead = readLookaheadEntries(content["frame_plan"]);
    this.pendingLookahead = { entries: lookahead, plannerPacketId: response?.packet_id ?? null };

    // Observatory (ADR-0029): the planner's decomposition reasoning + real latency are inspectable.
    const trace = dispatched.value.emissions.trace;
    const plannerCid = response?.source_cid ?? "agent.frameplanner";
    await this.emitFrameWorkTiming({
      surfaceId: args.surfaceId,
      agentId: "frameplanner",
      agentCid: plannerCid,
      workId: dispatched.value.workItem.work_id,
      packetId: response?.packet_id ?? null,
      workType: dispatched.value.workItem.work_type,
      startedMs,
    });
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
   * Split into prepare (reserve + compose) and surface (land + voice) so the planner path can
   * pipeline them — frame N+1 composing while frame N is voiced.
   */
  private async composeFrameViaComposer(args: {
    surfaceId: string;
    input: SurfaceAskInput;
    focusTitle: string;
    conceptNodeId: string;
    plan: { entry: FramePlanEntry; plannerPacketId: string | null } | null;
  }): Promise<Result<void, CosError>> {
    const prepared = await this.prepareFrameEntry(args);
    if (prepared) await this.surfaceFrameEntry({ ...args, prepared });
    return ok(undefined);
  }

  /**
   * Prepare one frame: reserve its layout (planner path), dispatch the composer, return the
   * artifacts UNSURFACED. Ordinals are allocated here, in call order, so pipelined preparation
   * never reorders the sequence. Returns null on a blocked/empty dispatch (observable degradation).
   */
  private async prepareFrameEntry(args: {
    surfaceId: string;
    input: SurfaceAskInput;
    focusTitle: string;
    conceptNodeId: string;
    plan: { entry: FramePlanEntry; plannerPacketId: string | null } | null;
  }): Promise<PreparedFrame | null> {
    const { surfaceId, input, focusTitle, conceptNodeId, plan } = args;
    const dispatcher = this.deps.composerDispatcher;
    if (!dispatcher) return null;

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
        kind: "teach",
        mccr_layout: this.buildFrameLayout(plan.entry.archetype, plan.entry.slots),
        planner_packet_id: plan.plannerPacketId,
        producer_cid: "agent.frameplanner",
        reason: "frame planner reserved a frame layout",
        world_state_nodes: [conceptNodeId],
      });
    }
    await this.emitAskProgress(surfaceId, "composing", frameTitle);

    // B (ADR-0063): the foreground frame streams its board as it forms (null in deterministic mode).
    const streamSink = this.frameStreamSink(surfaceId, frameId);
    const artifacts = await this.dispatchComposerForConcept({
      surfaceId,
      conceptId: input.focusConceptId,
      conceptTitle: focusTitle,
      goal: input.goal,
      ...(plan?.entry.sub_focus ? { subFocus: plan.entry.sub_focus } : {}),
      ...(plan ? { frameFocus: frameTitle } : {}),
      ...(input.explanationPrompt ? { explanationPrompt: input.explanationPrompt } : {}),
      // A.2 (ADR-0063): real frame path — defer the image off time-to-first-frame; it is resolved and
      // attached after surface.frame.composed by emitFrameArtifacts.
      deferImage: true,
      ...(streamSink ? { streamSink } : {}),
    });
    // Degrade observably: a blocked dispatch (untrusted learner / scheduler rejection) yields no
    // composed frame, exactly as the legacy path yields no explanation block (SRF-001 §10).
    if (!artifacts) return null;
    return { frameId, ordinal, frameTitle, artifacts };
  }

  /** Surface a prepared frame: land its MCCR + records, then voice its narration script. */
  private async surfaceFrameEntry(args: {
    surfaceId: string;
    input: SurfaceAskInput;
    conceptNodeId: string;
    prepared: PreparedFrame;
  }): Promise<void> {
    const { surfaceId, input, conceptNodeId, prepared } = args;
    const { artifacts } = prepared;
    await this.emitAskProgress(surfaceId, "voicing", prepared.frameTitle);
    await this.emitFrameArtifacts({
      surfaceId,
      frameId: prepared.frameId,
      ordinal: prepared.ordinal,
      conceptId: input.focusConceptId,
      frameTitle: prepared.frameTitle,
      conceptNodeId,
      mccr: artifacts.mccr,
      scriptSegments: artifacts.scriptSegments,
      imagePlan: artifacts.imagePlan,
      deferredImage: artifacts.deferredImage,
      composerCid: artifacts.composerCid,
      composerPacketId: artifacts.composerPacketId,
      confidence: artifacts.confidence,
      reasoning: artifacts.reasoning,
      trace: artifacts.trace,
      workId: artifacts.workId,
      agentId: "composer",
      role: "explainer",
      reason: "surface composer distilled the focus concept into a Cognitive Frame",
    });
  }

  /** The learner-visible phase of an in-flight ask (surface.ask.progress) — an ask is never silent. */
  private async emitAskProgress(surfaceId: string, phase: string, detail?: string): Promise<void> {
    await this.emit("surface.ask.progress", {
      surface_id: surfaceId,
      phase,
      detail: detail ?? null,
    });
  }

  /**
   * Build a live board-streaming sink for a foreground frame (ADR-0063 Phase B), or null when
   * streaming is disabled or the dispatcher can't stream. Each completed MCCR string anchor becomes a
   * transient `surface.frame.element.delta` (element id `el-<name>`, monotone seq) that the fold
   * accumulates into `streaming_frame_elements` and `surface.frame.composed` later clears — the
   * settled board is always the composed frame, so streaming never affects canonical state.
   */
  private frameStreamSink(surfaceId: string, frameId: string): FrameElementSink | null {
    if (!this.deps.frameStreamEnabled) return null;
    if (!this.deps.composerDispatcher?.dispatchStreaming) return null;
    let seq = 0;
    return {
      onElementComplete: async (name, text) => {
        await this.emit("surface.frame.element.delta", {
          surface_id: surfaceId,
          frame_id: frameId,
          element_id: `el-${name}`,
          seq: seq++,
          text_delta: text,
        });
      },
    };
  }

  /**
   * Dispatch the governed Surface Composer for one concept and return its distilled artifacts (UCS,
   * ADR-0030): the MCCR (with an inline image folded in when the composer judged one helps and a
   * generator is wired), the separate narration script segments, the image decision, and the
   * reasoning trace. Shared by the on-screen frame path and Phase 3 speculative pre-composition — the
   * caller decides whether to voice + surface (a real frame) or record silently (a speculation).
   * Returns null when the dispatch is blocked or the composer produced no MCCR (observable degradation).
   */
  private async dispatchComposerForConcept(args: {
    surfaceId: string;
    conceptId: string;
    conceptTitle: string;
    goal: string;
    subFocus?: string;
    frameFocus?: string;
    explanationPrompt?: string;
    /** A.2 (ADR-0063): defer the image (planner LLM + generation) until AFTER the board lands. */
    deferImage?: boolean;
    /** F (ADR-0063): abort a background (speculative) compose on learner interrupt — skips image + emits. */
    signal?: AbortSignal;
    /** B (ADR-0063): live board streaming — report each MCCR anchor as it forms (foreground frames only). */
    streamSink?: FrameElementSink;
  }): Promise<{
    mccr: Record<string, unknown>;
    scriptSegments: Record<string, unknown>[];
    imagePlan: { helps: boolean; modality: string; prompt: string | null; rationale: string };
    composerCid: string;
    composerPacketId: string | null;
    confidence: number;
    reasoning: string;
    trace: ReasoningTrace | null;
    workId: string | null;
    /** A.2 (ADR-0063): when deferImage, the context the surfacing step needs to resolve+attach it. */
    deferredImage: { subFocus?: string; composerPlan: Record<string, unknown> } | null;
  } | null> {
    const dispatcher = this.deps.composerDispatcher;
    if (!dispatcher) return null;
    const { surfaceId, conceptId, conceptTitle } = args;

    const startedMs = this.clock.nowMs();
    // R2a (ADR-0057 D1): feed the concept's anchored passages INTO composition so the board + voice
    // are grounded in the document (the composer quotes it, never invents beyond it). Empty ⇒ goal-mode.
    // R5 (ADR-0060): when ≥2 sources cover the concept, feed the FUSED cross-source synthesis INTO
    // composition so the frame teaches the reconciled understanding (FUSION MODE). Null ⇒ unchanged.
    // Phase C (ADR-0063): the excerpt and fusion reads are independent and emit no surface events, so
    // resolve them concurrently — one round-trip's latency instead of two before the composer runs.
    const [sourceExcerpts, fusedSynthesis] = await Promise.all([
      this.sourceExcerptsFor(conceptId, conceptTitle),
      this.fusedSynthesisFor(conceptId, conceptTitle),
    ]);
    const dispatchInput = {
      session: this.deps.session,
      targetAgentId: "composer" as const,
      intent: `compose frame: ${args.frameFocus ?? conceptTitle}`,
      conceptIds: [conceptId],
      content: {
        concept_id: conceptId,
        concept_title: conceptTitle,
        goal: args.goal,
        ...(sourceExcerpts.length > 0 ? { source_excerpts: sourceExcerpts } : {}),
        ...(fusedSynthesis ? { fused_synthesis: fusedSynthesis } : {}),
        ...(args.subFocus ? { sub_focus: args.subFocus } : {}),
        ...(args.frameFocus ? { frame_focus: args.frameFocus } : {}),
        ...(args.explanationPrompt ? { prompt: args.explanationPrompt } : {}),
      },
    };
    // B (ADR-0063): stream the board when a sink is provided (foreground frames, live mode) AND the
    // dispatcher supports it — the composer reports each MCCR anchor as it forms. Otherwise the whole
    // frame lands at once (speculation, deterministic/replay, and any dispatcher without streaming).
    const dispatched =
      args.streamSink && dispatcher.dispatchStreaming
        ? await dispatcher.dispatchStreaming(dispatchInput, args.streamSink)
        : await dispatcher.dispatch(dispatchInput);
    if (!dispatched.ok) return null;
    // Phase F (ADR-0063): the learner interrupted while this background compose was in flight. The
    // model call already ran, but skip the image (the heavy step) and ALL emits so the cancelled
    // speculation leaves no trace in the event log (the caller discards a null result).
    if (args.signal?.aborted) return null;
    const response = dispatched.value.responsePackets[0];
    const content = (response?.content ?? {}) as Record<string, unknown>;
    await this.emitDegradedIfFallback(surfaceId, "composer", content);
    const mccr = content["mccr"] as Record<string, unknown> | undefined;
    if (!mccr || typeof mccr !== "object") return null;

    const composerCid = response?.source_cid ?? "agent.composer";
    const script = (content["narration_script"] as { segments?: unknown } | undefined) ?? {};
    const scriptSegments = Array.isArray(script.segments)
      ? (script.segments as Record<string, unknown>[])
      : [];
    // The image-as-cognition decision (UCS, ADR-0030; Phase 4): a dedicated Image Agent owns it when
    // wired (decide/prompt + explanatory caption + callout labels), replacing the composer's inline
    // image_plan; otherwise the composer's inline decision drives generation (Phase 1–3 behaviour).
    const composerPlan = (content["image_plan"] as Record<string, unknown> | undefined) ?? {};
    // A.2 (ADR-0063): the image (planner LLM + Imagen ~5-15s) is the heaviest frame step. On the real
    // frame path DEFER it off time-to-first-frame — return the base board now; the surfacing step
    // resolves + attaches it after surface.frame.composed. On the speculative pre-warm path (deferImage
    // falsy) resolve inline so a promoted frame is a true skip-recompute.
    let mccrForEvent: Record<string, unknown> = mccr;
    let imagePlan: { helps: boolean; modality: string; prompt: string | null; rationale: string };
    let deferredImage: { subFocus?: string; composerPlan: Record<string, unknown> } | null = null;
    if (args.deferImage) {
      deferredImage = { ...(args.subFocus ? { subFocus: args.subFocus } : {}), composerPlan };
      imagePlan = {
        helps: false,
        modality: "none",
        prompt: null,
        rationale: "image deferred until the board lands",
      };
    } else {
      const resolved = await this.resolveFrameImage({
        surfaceId,
        conceptId,
        conceptTitle,
        ...(args.subFocus ? { subFocus: args.subFocus } : {}),
        anchors: Object.keys(mccr),
        composerPlan,
      });
      if (resolved.imageElement) mccrForEvent = { ...mccr, image: resolved.imageElement };
      imagePlan = resolved.imagePlan;
    }
    await this.emitFrameWorkTiming({
      surfaceId,
      agentId: "composer",
      agentCid: composerCid,
      workId: dispatched.value.workItem.work_id,
      packetId: response?.packet_id ?? null,
      workType: dispatched.value.workItem.work_type,
      startedMs,
    });
    return {
      mccr: mccrForEvent,
      scriptSegments,
      imagePlan,
      deferredImage,
      composerCid,
      composerPacketId: response?.packet_id ?? null,
      confidence: response?.confidence ?? 0.5,
      reasoning:
        typeof content["response_kind"] === "string" ? (content["response_kind"] as string) : "",
      trace: dispatched.value.emissions.trace ?? null,
      workId: dispatched.value.workItem.work_id,
    };
  }

  /**
   * Resolve a frame's image (A.2, ADR-0063): the Image Agent's decision (or the composer's inline
   * fallback) + generation of the artifact + the built `el-image` MCCR element. Shared by the
   * speculative pre-warm path (inline, before the frame records) and the real frame path (deferred to
   * AFTER surface.frame.composed, off time-to-first-frame). Returns the element to fold onto the board
   * (or null when no image earns its place / generation fails) plus the record-honest image decision.
   */
  private async resolveFrameImage(args: {
    surfaceId: string;
    conceptId: string;
    conceptTitle: string;
    subFocus?: string;
    anchors: string[];
    composerPlan: Record<string, unknown>;
  }): Promise<{
    imageElement: Record<string, unknown> | null;
    imagePlan: { helps: boolean; modality: string; prompt: string | null; rationale: string };
  }> {
    const { surfaceId, conceptId, conceptTitle } = args;
    const plan =
      (await this.dispatchImagePlanner({
        surfaceId,
        conceptId,
        conceptTitle,
        ...(args.subFocus ? { subFocus: args.subFocus } : {}),
        anchors: args.anchors,
      })) ?? this.composerImagePlan(args.composerPlan);

    let imageElement: Record<string, unknown> | null = null;
    let imageRendered = false;
    if (plan.helps && plan.prompt && this.deps.media) {
      const ref = await this.deps.media.generate({
        request_id: `med-${this.idGenerator.hex(8)}`,
        surface_id: surfaceId,
        block_id: null,
        modality: "image",
        prompt: plan.prompt,
        concept_ids: [conceptId],
      });
      if (ref) {
        imageRendered = true;
        await this.emit("surface.visual.generated", {
          surface_id: surfaceId,
          block_id: null,
          artifact_id: ref.artifact_id,
          modality: ref.modality,
          provider_id: ref.provider_id,
        });
        imageElement = {
          element_id: "el-image",
          type: "image",
          slot: "image",
          reveal_order: 9,
          concept_id: conceptId,
          content: {
            kind: "image",
            artifact: {
              artifact_id: ref.artifact_id,
              content_ref: ref.content_ref,
              mime_type: ref.mime_type,
              provider_id: ref.provider_id,
            },
            alt: `Illustration of ${conceptTitle}`,
            prompt: plan.prompt,
            caption: plan.caption,
            labels: plan.labels,
            // R4e (ADR-0058; CSE-018 Law 9): the image carries its own recorded rationale onto the
            // board — an image on the surface is never mute decoration; the learner can see WHY it
            // earns its place (F16 causal transparency).
            rationale: plan.rationale || null,
          },
        };
      }
    }

    // Record-honest image decision (N10): `surface.image.decided` must reflect what actually reached
    // the board, not merely intent — planned-but-not-rendered records helps:false with a reason.
    const decisionDegraded = plan.helps && !imageRendered;
    const effectiveHelps = plan.helps && imageRendered;
    return {
      imageElement,
      imagePlan: {
        helps: effectiveHelps,
        modality: effectiveHelps ? plan.modality : "none",
        prompt: plan.prompt,
        rationale: decisionDegraded
          ? `${plan.rationale} (image planned but not rendered — no generator or generation failed)`
          : plan.rationale,
      },
    };
  }

  /** Normalize the composer's inline `image_plan` into the effective image-decision shape. */
  private composerImagePlan(raw: Record<string, unknown>): {
    helps: boolean;
    modality: string;
    prompt: string | null;
    rationale: string;
    caption: string | null;
    labels: string[];
  } {
    const prompt = typeof raw["prompt"] === "string" ? (raw["prompt"] as string) : null;
    const helps = raw["helps"] === true && prompt !== null;
    return {
      helps,
      modality: helps ? "image" : "none",
      prompt: helps ? prompt : null,
      rationale: typeof raw["rationale"] === "string" ? (raw["rationale"] as string) : "",
      caption: null,
      labels: [],
    };
  }

  /**
   * Dispatch the governed Image Agent (UCS, ADR-0030; Phase 4) to own the image-as-cognition decision:
   * whether an image helps, its prompt, and the explanatory caption + callout labels. Surfaces the
   * agent's reasoning to the Observatory (ADR-0029). Returns null when no image planner is wired or the
   * dispatch is blocked/empty — the caller then falls back to the composer's inline decision.
   */
  private async dispatchImagePlanner(args: {
    surfaceId: string;
    conceptId: string;
    conceptTitle: string;
    subFocus?: string;
    anchors: string[];
  }): Promise<{
    helps: boolean;
    modality: string;
    prompt: string | null;
    rationale: string;
    caption: string | null;
    labels: string[];
  } | null> {
    const dispatcher = this.deps.imagePlannerDispatcher;
    if (!dispatcher) return null;
    const startedMs = this.clock.nowMs();
    const dispatched = await dispatcher.dispatch({
      session: this.deps.session,
      targetAgentId: "imageplanner",
      intent: `plan image: ${args.conceptTitle}`,
      conceptIds: [args.conceptId],
      content: {
        concept_id: args.conceptId,
        concept_title: args.conceptTitle,
        ...(args.subFocus ? { sub_focus: args.subFocus } : {}),
        anchors: args.anchors,
        mode: "decide",
      },
    });
    if (!dispatched.ok) return null;
    const response = dispatched.value.responsePackets[0];
    const content = (response?.content ?? {}) as Record<string, unknown>;
    await this.emitDegradedIfFallback(args.surfaceId, "imageplanner", content);
    const raw = content["image_plan"] as Record<string, unknown> | undefined;
    if (!raw) return null;

    // Observatory (ADR-0029): the image agent's decide/refine reasoning + real latency are inspectable.
    const trace = dispatched.value.emissions.trace;
    await this.emitFrameWorkTiming({
      surfaceId: args.surfaceId,
      agentId: "imageplanner",
      agentCid: response?.source_cid ?? "agent.imageplanner",
      workId: dispatched.value.workItem.work_id,
      packetId: response?.packet_id ?? null,
      workType: dispatched.value.workItem.work_type,
      startedMs,
    });
    if (trace) {
      await this.emit("surface.agent.reasoning.summary", {
        surface_id: args.surfaceId,
        agent_cid: response?.source_cid ?? "agent.imageplanner",
        agent_id: "imageplanner",
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

    const prompt = typeof raw["prompt"] === "string" ? (raw["prompt"] as string) : null;
    const helps = raw["helps"] === true && prompt !== null;
    const labels = Array.isArray(raw["labels"])
      ? (raw["labels"] as unknown[]).filter((l): l is string => typeof l === "string")
      : [];
    return {
      helps,
      modality: helps ? "image" : "none",
      prompt: helps ? prompt : null,
      rationale: typeof raw["rationale"] === "string" ? (raw["rationale"] as string) : "",
      caption: helps && typeof raw["caption"] === "string" ? (raw["caption"] as string) : null,
      labels: helps ? labels : [],
    };
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
    segments: { text: string; anchor_ref: string | null; intent: string; pause_after?: boolean }[];
    /** Pedagogical role (ADR-0055 D6): practice/assessment/checkpoint frames set this. */
    kind?: FrameKind;
  }): Promise<void> {
    const frameId = `cfr-${this.idGenerator.hex(12)}`;
    const ordinal = this.nextFrameOrdinal();
    await this.emit("surface.frame.planned", {
      surface_id: args.surfaceId,
      frame_id: frameId,
      ordinal,
      concept_id: args.conceptId,
      title: args.frameTitle,
      kind: args.kind ?? "teach",
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
      scriptSegments: args.segments.map((s) => ({ ...s, pause_after: s.pause_after ?? false })),
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
      ...(args.kind ? { kind: args.kind } : {}),
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
    /** Pedagogical role of this frame (ADR-0055 D6); defaults to `teach`. */
    kind?: FrameKind;
    /** A.2 (ADR-0063): when set, resolve + attach the image AFTER the board lands (real frame path). */
    deferredImage?: { subFocus?: string; composerPlan: Record<string, unknown> } | null;
  }): Promise<void> {
    const { surfaceId, frameId } = args;

    // CSE M5 (CSE-008 §3.2): resolved source evidence for this concept joins the board as a
    // `source_viewport` element — the source's own words in the evidence provenance channel.
    // Best-effort: a provider failure degrades to a frame without source projection, never a
    // failed composition. Injected BEFORE the composed emit so the fold carries it canonically.
    const evidence = await this.sourceEvidenceFor(args.conceptId, args.frameTitle);
    let mccr =
      evidence.length > 0
        ? withSourceViewportElement(args.mccr, args.conceptId, evidence[0]!)
        : args.mccr;
    let imagePlan = args.imagePlan;

    // The frame's MCCR lands (the only thing on the board), with multi-producer provenance.
    await this.emit("surface.frame.composed", {
      surface_id: surfaceId,
      frame_id: frameId,
      ordinal: args.ordinal,
      concept_id: args.conceptId,
      title: args.frameTitle,
      kind: args.kind ?? "teach",
      mccr,
      confidence: args.confidence,
      reasoning: args.reasoning,
      composer_packet_id: args.composerPacketId,
      producer_cid: args.composerCid,
      reason: args.reason,
      world_state_nodes: [args.conceptNodeId],
    });

    // A.2 (ADR-0063): resolve + attach the DEFERRED image now that the board has landed. Re-emit
    // surface.frame.composed with the image folded in — the fold upserts by frame_id (ADR-0030), so a
    // second composed is a byte-safe enrichment of the already-usable board, not a new frame. Update
    // imagePlan so image.decided records the honest outcome; representation below then sees the image.
    if (args.deferredImage) {
      const resolved = await this.resolveFrameImage({
        surfaceId,
        conceptId: args.conceptId,
        conceptTitle: args.frameTitle,
        ...(args.deferredImage.subFocus ? { subFocus: args.deferredImage.subFocus } : {}),
        anchors: Object.keys(mccr),
        composerPlan: args.deferredImage.composerPlan,
      });
      imagePlan = resolved.imagePlan;
      if (resolved.imageElement) {
        mccr = { ...mccr, image: resolved.imageElement };
        await this.emit("surface.frame.composed", {
          surface_id: surfaceId,
          frame_id: frameId,
          ordinal: args.ordinal,
          concept_id: args.conceptId,
          title: args.frameTitle,
          kind: args.kind ?? "teach",
          mccr,
          confidence: args.confidence,
          reasoning: args.reasoning,
          composer_packet_id: args.composerPacketId,
          producer_cid: args.composerCid,
          reason: `${args.reason} (image attached)`,
          world_state_nodes: [args.conceptNodeId],
        });
      }
    }

    // R4a (ADR-0058): the RIA's RepresentationPlan — each element's hierarchy + epistemic role, over
    // the closed MCCR vocabulary. Deterministic parity floor (metadata over the same elements), so it
    // never changes the render; R4b consumes the roles, R4d makes it model-backed. Emitted after the
    // composed frame so the plan references existing element ids.
    const planElements = Object.values(mccr)
      .filter(
        (v): v is { element_id: string; type: string } =>
          !!v &&
          typeof v === "object" &&
          typeof (v as { element_id?: unknown }).element_id === "string" &&
          typeof (v as { type?: unknown }).type === "string",
      )
      .map((v) => ({ element_id: v.element_id, type: v.type }));
    if (planElements.length > 0) {
      const plan = await this.planRepresentationFor(frameId, args.conceptId, planElements);
      await this.emit("surface.representation.planned", {
        surface_id: surfaceId,
        frame_id: frameId,
        composition: plan.composition,
        exclusions: plan.exclusions,
        density: plan.density,
        plan_kind: plan.plan_kind,
        adaptivity: plan.adaptivity,
      });
    }

    // The image decision + the SEPARATE narration script are recorded (the spoken teaching, off the
    // board). Shared with Phase 3 speculation — a prepared frame records these too, but is not voiced.
    const script = await this.recordFrameArtifacts({
      surfaceId,
      frameId,
      mccr,
      scriptSegments: args.scriptSegments,
      imagePlan,
    });

    // Source projection as a composer role (CSE M5; SRF-002 law 12): the viewport plan, semantic
    // highlights, and the attention contract land AFTER the composed frame + recorded script, so
    // every binding references existing segment ids. Deterministic given anchors + the id stream.
    if (evidence.length > 0) {
      const planned = planSourceProjection({
        frameId,
        scriptId: script.scriptId,
        segmentIds: script.segmentIds,
        // R2d (ADR-0057 D4): the segments carry text + slot so the binder is semantic + gated + typed.
        segments: script.segments,
        anchors: evidence,
        hex: (bytes) => this.idGenerator.hex(bytes),
      });
      if (planned) {
        await this.emit("surface.source.viewport.planned", {
          surface_id: surfaceId,
          ...planned.plan,
        });
        for (const highlight of planned.highlights) {
          await this.emit("surface.source.highlight.applied", {
            surface_id: surfaceId,
            ...highlight,
          });
        }
        await this.emit("surface.source.sync.bound", { surface_id: surfaceId, ...planned.sync });
        await this.emit("surface.source.viewport.changed", {
          surface_id: surfaceId,
          ...planned.initialChange,
        });
      }
    }

    // The Cognitive Theater (CSE M7 T1, ADR-0033/0038): the Director conducts + the Scene wraps
    // this composed frame. Emitted AFTER frame.composed + source projection (so scene actors and
    // the directive_ref reference existing records; SRF-002 law 13), BEFORE the voiced narration.
    if (this.deps.theater) {
      await this.emitTheaterForFrame({
        surfaceId,
        frameId,
        conceptId: args.conceptId,
        frameTitle: args.frameTitle,
        kind: args.kind ?? "teach",
        // R2b (ADR-0057 D2): the focus source anchor the Director points at (null in goal-mode).
        sourceAnchorRef: evidence[0]?.anchor_id ?? null,
        mccr,
      });
    }

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
          pause_after: s["pause_after"] === true,
        };
      }),
    });
  }

  /**
   * The Cognitive Theater for one composed frame (CSE M7 T1; CSE-011/012, ADR-0033/0038).
   *
   * Reads the current folded signals, runs the behavioral affect channel + the authored Director
   * FSM (both pure, deterministic — replay re-derives the same directive), and emits, in law-13
   * order: `surface.affect.observed` → `surface.director.directive` → `surface.director.state.entered`
   * → `surface.scene.opened` (with the frame's MCCR elements as actors + initial lighting) →
   * `surface.scene.actor.entered` per actor → `surface.scene.lighting.changed`. The Director
   * conducts, it never renders (ADR-0033 L1); the client tints the board to the target state.
   */
  private async emitTheaterForFrame(args: {
    surfaceId: string;
    frameId: string;
    conceptId: string;
    frameTitle: string;
    kind: FrameKind;
    /** The source anchor this frame teaches FROM (R2b, ADR-0057 D2); null in goal-mode. */
    sourceAnchorRef?: string | null;
    mccr: Record<string, unknown>;
  }): Promise<void> {
    const state = this.state();
    const conceptId = args.conceptId;
    const title =
      state?.timeline?.nodes.find((n) => n.concept_id === conceptId)?.title ?? "this concept";
    const lastGate = [...(state?.depth_gates ?? [])]
      .reverse()
      .find((g) => g.concept_id === conceptId);
    const sub = {
      inDescent: (state?.prerequisite_descents ?? []).some(
        (d) => d.to_concept_id === conceptId && !d.completed,
      ),
      lastGatePassed: lastGate ? lastGate.passed : null,
      mastered:
        state?.timeline?.nodes.find((n) => n.concept_id === conceptId)?.status === "mastered",
      framesComposed: Math.max(0, (state?.frames.length ?? 1) - 1),
    };

    // Behavioral affect first — honest absence when there is no evidence (never a guessed emotion).
    const affect = inferAffect(sub);
    if (affect) {
      await this.emit("surface.affect.observed", {
        surface_id: args.surfaceId,
        affect_state: affect.affect_state,
        source: "behavioral-inference",
        signals: affect.signals,
        confidence: affect.confidence,
      });
    }

    // Typed frame kind drives the Director signals (ADR-0055 D6); the title is no longer consulted.
    const signals: DirectorSignals = {
      conceptRef: conceptId,
      conceptTitle: title,
      mastered: sub.mastered,
      lastGatePassed: sub.lastGatePassed,
      inDescent: sub.inDescent,
      frontierSurfaced: (state?.research_frontiers ?? []).some(
        (r) => r.concept_id === conceptId && r.surfaced,
      ),
      affect: affect?.affect_state ?? null,
      framesComposed: sub.framesComposed,
      isPractice: args.kind === "practice",
      isAssessment: args.kind === "assessment",
      sourceAnchorRef: args.sourceAnchorRef ?? null,
    };
    const directiveId = `dir-${this.idGenerator.hex(10)}`;
    const directive = decideDirective(signals, { directiveId, hlc: "" });
    await this.emit("surface.director.directive", {
      surface_id: args.surfaceId,
      directive_id: directive.directive_id,
      scale: directive.scale,
      target_state: directive.target_state,
      pacing: directive.pacing,
      intensity: directive.intensity,
      focus: directive.focus,
      rationale: directive.rationale,
      considered: directive.considered,
      evidence_refs: [`frame:${args.frameId}`],
      confidence: directive.confidence,
    });
    // The learner is judged to enter the target state as this frame composes (evidence = the frame).
    await this.emit("surface.director.state.entered", {
      surface_id: args.surfaceId,
      directive_id: directive.directive_id,
      scale: directive.scale,
      state: directive.target_state,
      evidence_refs: [`frame:${args.frameId}`],
    });

    // R3e (ADR-0057; CSE-011 §9/§10): the attention budget — a session-time heuristic over frames
    // composed ("start heuristic", §10). This produces the `surface.attention.budgeted` slice that
    // was declared + folded but never emitted, so the Director's silence-on-depletion (§9) and the
    // learner-visible budget rest on a real signal rather than an empty slot.
    const framesSoFar = sub.framesComposed;
    const remaining =
      framesSoFar < 5 ? "high" : framesSoFar < 9 ? "medium" : framesSoFar < 13 ? "low" : "depleted";
    await this.emit("surface.attention.budgeted", {
      surface_id: args.surfaceId,
      remaining,
      session_minutes: Math.round(framesSoFar * 0.75),
    });

    // Wrap the frame as a living Scene: its MCCR elements become actors, the protagonist is lit.
    const actors = actorsFromMccr(args.mccr, this.idGenerator);
    const protagonist = actors.find((a) => a.role === "protagonist") ?? actors[0] ?? null;
    const lighting = {
      focus_actor_ref: protagonist?.actor_id ?? null,
      cdl_state: directive.target_state,
      recession: actors.filter((a) => a.actor_id !== protagonist?.actor_id).map((a) => a.actor_id),
    };
    const sceneId = `scn-${this.idGenerator.hex(12)}`;
    await this.emit("surface.scene.opened", {
      surface_id: args.surfaceId,
      scene_id: sceneId,
      frame_ref: args.frameId,
      concept_ref: conceptId,
      state: directive.target_state,
      directive_ref: directive.directive_id,
      actors,
      lighting,
    });
    for (const actor of actors) {
      await this.emit("surface.scene.actor.entered", {
        surface_id: args.surfaceId,
        scene_id: sceneId,
        actor,
      });
    }
    await this.emit("surface.scene.lighting.changed", {
      surface_id: args.surfaceId,
      scene_id: sceneId,
      focus_actor_ref: lighting.focus_actor_ref,
      cdl_state: lighting.cdl_state,
      recession: lighting.recession,
    });

    // Cinematography (CSE M8 T2, CSE-013): the Cinematographer (a composer role) plans the scene's
    // shots — establish on open, spotlights per narration segment (the camera follows the voice),
    // a hold under demanding/silent pacing. Deterministic; realized client-side (ADR-0007). The
    // recorded script is already folded (recordFrameArtifacts ran before this), so read its segments.
    const script = (state?.narration_scripts ?? []).find((s) => s.frame_id === args.frameId);
    const shots = planShots({
      sceneId,
      actors: actors.map((a) => ({
        actor_id: a["actor_id"] as string,
        role: a["role"] as string,
        content_ref: a["content_ref"] as string,
      })),
      directive: {
        target_state: directive.target_state,
        intensity: directive.intensity,
        silence: directive.pacing.silence,
      },
      segments: (script?.segments ?? []).map((s) => ({
        segment_id: s.segment_id,
        element_id: s.reveal_ids[0] ?? null,
      })),
      hex: (bytes) => this.idGenerator.hex(bytes),
    });
    for (const shot of shots) {
      await this.emit("surface.shot.planned", { surface_id: args.surfaceId, ...shot });
    }
  }

  /**
   * Record a frame's off-board artifacts (UCS, ADR-0030): the image decision (always, so the rationale
   * is observable whether or not an image was generated) and the SEPARATE narration script keyed to the
   * frame. Shared by composed frames (which then voice) and Phase 3 speculative frames (which do not).
   */
  private async recordFrameArtifacts(args: {
    surfaceId: string;
    frameId: string;
    mccr: Record<string, unknown>;
    scriptSegments: Record<string, unknown>[];
    imagePlan: { helps: boolean; modality: string; prompt: string | null; rationale: string };
  }): Promise<{
    scriptId: string;
    segmentIds: readonly string[];
    /** Segments with text + slot for the R2d semantic source binder (ADR-0057 D4). */
    segments: ReadonlyArray<{ segment_id: string; text: string; anchor_ref: string | null }>;
  }> {
    await this.emit("surface.image.decided", {
      surface_id: args.surfaceId,
      frame_id: args.frameId,
      helps: args.imagePlan.helps,
      modality: args.imagePlan.modality,
      prompt: args.imagePlan.prompt,
      rationale: args.imagePlan.rationale,
    });
    const scriptId = `nsc-${this.idGenerator.hex(8)}`;
    const recordedSegments = args.scriptSegments.map((s, i) => {
      const anchorRef = typeof s["anchor_ref"] === "string" ? (s["anchor_ref"] as string) : null;
      return {
        segment_id: `${scriptId}-s${i}`,
        anchor_ref: anchorRef,
        intent: typeof s["intent"] === "string" ? (s["intent"] as string) : "build",
        text: typeof s["text"] === "string" ? (s["text"] as string) : "",
        reveal_ids: anchorRef ? [this.elementIdFor(args.mccr, anchorRef)].filter(Boolean) : [],
        pause_after: s["pause_after"] === true,
      };
    });
    await this.emit("surface.narration.script.produced", {
      surface_id: args.surfaceId,
      frame_id: args.frameId,
      script_id: scriptId,
      segments: recordedSegments,
    });
    return {
      scriptId,
      segmentIds: recordedSegments.map((s) => s.segment_id),
      segments: recordedSegments.map((s) => ({
        segment_id: s.segment_id,
        text: s.text,
        anchor_ref: s.anchor_ref,
      })),
    };
  }

  /**
   * Resolved source-evidence anchors for a concept (CSE M5) — best-effort over the optional
   * provider seam. A provider error yields `[]`: the frame composes without a source projection
   * (honest degradation, never a failed frame; CSE-008 §12).
   */
  private async sourceEvidenceFor(
    conceptId: string,
    conceptTitle: string,
  ): Promise<readonly SourceEvidenceAnchorView[]> {
    const provider = this.deps.sourceEvidence;
    if (!provider) return [];
    try {
      return await provider.anchorsForConcept(conceptId, conceptTitle);
    } catch {
      return [];
    }
  }

  /**
   * R2a (ADR-0057 D1): the concept's anchored source passages, compacted for the planner/composer
   * prompt — `{anchor_ref, quote, path}`, ≤3 excerpts, each quote bounded so a long region can't
   * blow the prompt budget. Empty when no source is bound (goal-mode teaching, unchanged).
   */
  private async sourceExcerptsFor(
    conceptId: string,
    conceptTitle: string,
  ): Promise<ReadonlyArray<{ anchor_ref: string; quote: string; path: string }>> {
    const anchors = await this.sourceEvidenceFor(conceptId, conceptTitle);
    return anchors.slice(0, 3).map((a) => ({
      anchor_ref: a.anchor_id,
      quote: a.region.quote.slice(0, 600),
      path: a.region.path,
    }));
  }

  /**
   * R5 (ADR-0060): the concept's fused cross-source synthesis, over the optional provider seam.
   * Null when the seam is absent, the concept isn't multi-source, or no non-degraded synthesis
   * exists — teaching then falls back to single-source/goal mode (honest absence, never a failure).
   * A provider error yields null (best-effort, never a failed frame).
   */
  private async fusedSynthesisFor(
    conceptId: string,
    conceptTitle: string,
  ): Promise<FusedSynthesisView | null> {
    const provider = this.deps.sourceEvidence;
    if (!provider?.fusedSynthesisForConcept) return null;
    try {
      const view = await provider.fusedSynthesisForConcept(conceptId, conceptTitle);
      // Fusion requires ≥2 covering sources — a single source is R2a's SOURCE MODE, not fusion.
      return view && view.source_count >= 2 ? view : null;
    } catch {
      return null;
    }
  }

  /**
   * The frame's RepresentationPlan (CSE-018, ADR-0058). Starts from the deterministic parity floor
   * (`planRepresentation`); when the RIA dispatcher is wired, the model refines each element's
   * epistemic role + hierarchy and names exclusions (plan_kind → `model`). A missing/degraded/empty
   * model plan keeps the floor — a model failure can never regress a frame (ADR-0058 D3). Density
   * stays session-computed either way. Every element keeps a role (model where assigned, else floor).
   */
  private async planRepresentationFor(
    frameId: string,
    conceptId: string,
    elements: ReadonlyArray<{ element_id: string; type: string }>,
  ): Promise<RepresentationPlan> {
    // Law 8 (R4e) + live signal (R5): an explicit `getExpertise` override wins; otherwise derive the
    // learner's expertise from their in-session mastery (null → un-adapted floor when unknown).
    const expertise =
      this.deps.getExpertise?.() ??
      expertiseFromMastery(this.state()?.timeline?.nodes ?? []) ??
      undefined;
    const base = planRepresentation({ frameId, elements, ...(expertise ? { expertise } : {}) });
    const dispatcher = this.deps.representationDispatcher;
    if (!dispatcher) return base;
    try {
      const state = this.state();
      const conceptTitle =
        state?.timeline?.nodes.find((n) => n.concept_id === conceptId)?.title ?? conceptId;
      const dispatched = await dispatcher.dispatch({
        session: this.deps.session,
        targetAgentId: "representation",
        intent: `plan representation: ${conceptTitle}`,
        conceptIds: [conceptId],
        content: { concept_id: conceptId, concept_title: conceptTitle, elements },
      });
      if (!dispatched.ok) return base;
      const content = (dispatched.value.responsePackets[0]?.content ?? {}) as Record<
        string,
        unknown
      >;
      const product = content["representation"] as
        | {
            composition?: { element_id: string; epistemic_role: string; hierarchy: string }[];
            exclusions?: string[];
            adaptivity?: string;
            degraded?: boolean;
          }
        | undefined;
      const comp = Array.isArray(product?.composition) ? product!.composition : [];
      if (!product || product.degraded || comp.length === 0) return base;
      const byId = new Map(comp.map((c) => [c.element_id, c]));
      const composition: RepresentationElementPlan[] = base.composition.map((c) => {
        const m = byId.get(c.element_id);
        return m
          ? {
              element_id: c.element_id,
              hierarchy: m.hierarchy as RepresentationElementPlan["hierarchy"],
              epistemic_role: m.epistemic_role as RepresentationElementPlan["epistemic_role"],
            }
          : c;
      });
      // Carry the model's adaptivity reasoning (Law 8) — otherwise it is emitted then discarded.
      // The expertise label comes from the session signal; the note is the model's own words.
      const modelAdaptivity =
        typeof product.adaptivity === "string" && product.adaptivity.trim()
          ? { expertise: expertise ?? "intermediate", note: product.adaptivity.trim() }
          : base.adaptivity;
      return {
        ...base,
        composition,
        exclusions: Array.isArray(product.exclusions) ? product.exclusions : [],
        adaptivity: modelAdaptivity,
        plan_kind: "model",
      };
    } catch {
      return base;
    }
  }

  /**
   * Promote a speculative frame to the canonical line (UCS, ADR-0030; Phase 3). The pre-composed MCCR
   * was folded at prepare time under this `frame_id`, so `surface.frame.promoted` copies it into
   * `frames[]` with a final ordinal (a true skip-recompute). It is voiced now from its recorded
   * narration script — the FIRST moment a speculative frame ever surfaces to the learner.
   */
  private async promoteSpeculation(
    surfaceId: string,
    spec: CognitiveFrame,
    conceptNodeId: string,
    _input: SurfaceAskInput,
  ): Promise<void> {
    const ordinal = this.nextFrameOrdinal();
    await this.emit("surface.frame.promoted", {
      surface_id: surfaceId,
      frame_id: spec.frame_id,
      ordinal,
      concept_id: spec.concept_id,
      title: spec.title,
      producer_cid: spec.provenance.producer_cid || "agent.composer",
      reason: "speculative frame promoted — the look-ahead bet held",
      world_state_nodes: [conceptNodeId],
    });
    const script = (this.state()?.narration_scripts ?? []).find(
      (s) => s.frame_id === spec.frame_id,
    );
    if (script) {
      await this.choreographer.narrateScript({
        surface_id: surfaceId,
        frame_id: spec.frame_id,
        agent_cid: spec.provenance.producer_cid || "agent.composer",
        agent_id: "composer",
        role: "explainer",
        concept_id: spec.concept_id,
        segments: script.segments.map((s) => ({
          text: s.text,
          anchor_ref: s.anchor_ref,
          element_id: s.reveal_ids[0] ?? null,
          intent: s.intent,
        })),
      });
    }
  }

  /**
   * Pre-compose look-ahead frames within the governed budget (UCS, ADR-0030; Phase 3). After a clean
   * mastery, the planner's look-ahead bet is bound to the actual NEXT concept in the path and the
   * composer distills its opening frame (pre-warming any image). The result is RECORDED
   * (`speculation.prepared` + script + image decision) but NEVER voiced or surfaced — it waits in
   * `speculative_frames[]` until a future ask promotes it. Budget 0 ⇒ no speculation (the default).
   */
  private async prepareLookahead(args: {
    surfaceId: string;
    input: SurfaceAskInput;
    signal?: AbortSignal;
  }): Promise<void> {
    const budget = this.deps.getLookaheadBudget?.() ?? this.deps.lookaheadBudget ?? 0;
    if (budget <= 0) return;
    if (args.signal?.aborted) return; // interrupted before composing began (ADR-0063 Phase F)

    // ADR-0064 rolling buffer: pre-compose the next `budget` concepts, not just one. Concepts that
    // already have a live (speculative or composed/promoted) frame are skipped, so this is an
    // idempotent top-up — each advance promotes one and re-warms the tail without recomposing.
    const upcoming = this.conceptsAhead(args.input, budget);
    if (upcoming.length === 0) return; // end of the path — nothing to look ahead to
    const plannerPacketId = this.pendingLookahead?.plannerPacketId ?? null;

    for (let i = 0; i < upcoming.length; i += 1) {
      if (args.signal?.aborted) return; // interrupted between frames — stop widening the buffer
      const nextConcept = upcoming[i]!;
      if (this.hasLiveFrameForConcept(nextConcept.id)) continue; // already warm — don't recompute
      // Each look-ahead bet lines up positionally with the concept it pre-warms.
      const bet = this.pendingLookahead?.entries[i];
      const triggerAssumption =
        bet?.trigger_assumption ??
        `learner reaches ${nextConcept.id} on the ${args.input.pathId} path`;
      const archetype = bet?.archetype ?? "concept-first";

      const artifacts = await this.dispatchComposerForConcept({
        surfaceId: args.surfaceId,
        conceptId: nextConcept.id,
        conceptTitle: nextConcept.title,
        goal: args.input.goal,
        ...(bet?.sub_focus ? { subFocus: bet.sub_focus } : {}),
        frameFocus: bet?.title ?? `Next — ${nextConcept.title}`,
        ...(args.signal ? { signal: args.signal } : {}),
      });
      if (!artifacts) continue; // blocked/empty ⇒ this one not prepared (observable degradation)
      if (args.signal?.aborted) return; // interrupted while composing — emit no speculative frame

      const frameId = `cfr-${this.idGenerator.hex(12)}`;
      const ordinal = this.nextFrameOrdinal();
      const nextConceptNodeId = `concept:${nextConcept.id}`;
      const slots = bet?.slots ?? Object.keys(artifacts.mccr);

      // The pre-composed MCCR lands in speculative_frames[] (never frames[]) with the bet it rests on.
      await this.emit("surface.frame.speculation.prepared", {
        surface_id: args.surfaceId,
        frame_id: frameId,
        ordinal,
        speculative_of: null,
        concept_id: nextConcept.id,
        title: bet?.title ?? nextConcept.title,
        kind: "teach", // look-ahead frames are always the next teach frame (ADR-0055 D6)
        trigger_assumption: triggerAssumption,
        mccr_layout: this.buildFrameLayout(archetype, slots),
        mccr: artifacts.mccr,
        planner_packet_id: plannerPacketId,
        producer_cid: artifacts.composerCid,
        reason: "frame planner pre-composed a discardable look-ahead frame",
        world_state_nodes: [nextConceptNodeId],
      });
      // Record the script + image decision under the speculative frame_id (resolvable at promotion) —
      // but DO NOT voice: a speculative frame never surfaces until promoted.
      await this.recordFrameArtifacts({
        surfaceId: args.surfaceId,
        frameId,
        mccr: artifacts.mccr,
        scriptSegments: artifacts.scriptSegments,
        imagePlan: artifacts.imagePlan,
      });
    }
  }

  /** The concept immediately after the focus in the ask's ordered concept list, or null at the end. */
  private nextConceptAfter(input: SurfaceAskInput): ConceptSeed | null {
    const index = input.concepts.findIndex((c) => c.id === input.focusConceptId);
    if (index < 0 || index + 1 >= input.concepts.length) return null;
    return input.concepts[index + 1] ?? null;
  }

  /** Up to `count` concepts after the focus, in path order (ADR-0064 rolling look-ahead). */
  private conceptsAhead(input: SurfaceAskInput, count: number): ConceptSeed[] {
    const index = input.concepts.findIndex((c) => c.id === input.focusConceptId);
    if (index < 0) return [];
    return input.concepts.slice(index + 1, index + 1 + Math.max(0, count));
  }

  /**
   * True when a concept already has a live frame — a composed/promoted frame on the canonical line
   * or a still-pending speculative frame. Keeps the rolling buffer from recomposing what's warm.
   */
  private hasLiveFrameForConcept(conceptId: string): boolean {
    const state = this.state();
    if (!state) return false;
    const live = (f: CognitiveFrame): boolean => f.status !== "invalidated";
    return (
      state.frames.some((f) => f.concept_id === conceptId && live(f)) ||
      state.speculative_frames.some((f) => f.concept_id === conceptId && f.status === "speculative")
    );
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
    // Background speculation settles before the surface closes (no events after close).
    await this.settle();
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
      ...(input.note ? { note: input.note } : {}),
    });

    // Interpret the act into typed cognitive intent (CSE-014 §3, deterministic) and record it —
    // "interaction is expression, not control": the grammar classifies + routes it.
    const intent = interpretIntent(input.kind, input.target_id ?? null, input.note ?? null);
    await this.emit("surface.intent.expressed", {
      surface_id: surfaceId,
      interaction_id: interactionId,
      kind: input.kind,
      class: intent.cls,
      cognitive_intent: intent.cognitive_intent,
      ...(intent.target_anchor_ref ? { target_anchor_ref: intent.target_anchor_ref } : {}),
    });

    let effect: SurfaceInteractionResult["effect"];
    let reason: string;
    // Mark-class acts (annotate/circle/highlight/pin) evolve the current Scene in place, driven by
    // the learner — the CSE-012 evolution channel M7 built, now with a learner-caused producer
    // (CSE-014 §4). No new ask, no teleport (spatial stability; the learner always wins, L5).
    if (intent.cls === "mark") {
      const evolved = await this.evolveSceneFromMark(surfaceId, interactionId, intent);
      effect = evolved ? "scene-evolved" : "annotated";
      reason = `learner marked ${intent.target_anchor_ref ?? "the board"} — ${intent.cognitive_intent}`;
      await this.emit("surface.interaction.applied", {
        surface_id: surfaceId,
        interaction_id: interactionId,
        effect,
        reason,
      });
      return ok({ interaction_id: interactionId, effect });
    }

    switch (input.kind) {
      case "interrupt":
        this.interrupted = true;
        // ADR-0063 Phase F: also cancel any detached background speculation — a stopped learner
        // should not have the gateway keep composing a look-ahead frame they'll never see.
        this.bgAbort?.abort();
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

  /**
   * Evolve the current Scene in place from a learner Mark (CSE M8 T2; CSE-012 §3.3, CSE-014 §4).
   * Emits a learner-caused `surface.scene.evolved` (`annotate` delta) on the most recently opened
   * Scene, carrying the interaction that produced it. Returns true when a live Scene received the
   * delta, false when there is no Scene yet (the interaction is still recorded + intent-expressed —
   * honest: an annotation with nowhere to land is not silently lost, just not scene-scoped).
   */
  private async evolveSceneFromMark(
    surfaceId: string,
    interactionId: string,
    intent: { kind: string; cognitive_intent: string; target_anchor_ref: string | null },
  ): Promise<boolean> {
    const scenes = this.state()?.scenes ?? [];
    const scene = [...scenes].reverse().find((s) => !s.closed);
    if (!scene) return false;
    await this.emit("surface.scene.evolved", {
      surface_id: surfaceId,
      scene_id: scene.scene_id,
      delta_id: `scd-${this.idGenerator.hex(8)}`,
      op: "annotate",
      cause: "learner",
      payload: {
        kind: intent.kind,
        target_anchor_ref: intent.target_anchor_ref,
        note: intent.cognitive_intent,
      },
      interaction_ref: interactionId,
    });
    return true;
  }

  /**
   * Grade a learner's actual answer to a practice problem (F14 made real). The answer is recorded as a
   * genuine interaction, graded by the Assessment unit into evidence-bearing depth tests, and emitted
   * as an HONEST `surface.assessment.gate.evaluated` + an assessment Cognitive Frame with the feedback.
   * Mastery is earned from real learner evidence — never fabricated. Absent a grader the answer is
   * recorded and the gate honestly reports "ungraded".
   */
  async submitAnswer(input: {
    conceptId: string;
    answer: string;
  }): Promise<Result<SurfaceInteractionResult, CosError>> {
    if (!this.surfaceId) return err(sessionError("surface session not started"));
    if (this.closed) return err(sessionError("surface session is closed"));
    const surfaceId = this.surfaceId;
    const answer = input.answer.trim();
    if (!answer) return err(sessionError("answer text is required"));
    const conceptId = input.conceptId;
    const conceptNodeId = `concept:${conceptId}`;
    const { title, problem } = this.findPracticeContext(conceptId);
    const interactionId = `ix-${this.idGenerator.hex(8)}`;

    // 1. The learner's answer is genuine input — recorded, folded, replayable.
    await this.emit("surface.interaction.received", {
      surface_id: surfaceId,
      interaction_id: interactionId,
      kind: "answer",
      target_id: conceptId,
      note: answer,
    });

    // 2. Grade it — genuine, evidence-bearing — or degrade honestly (recorded, ungraded).
    type Verdict = {
      passed: boolean;
      confidence: number;
      feedback: string;
      tests: { kind: string; passed: boolean; confidence: number; evidence: string }[];
      graded: boolean;
    };
    let verdict: Verdict = {
      passed: false,
      confidence: 0,
      feedback: "",
      tests: [],
      graded: false,
    };
    const dispatcher = this.deps.assessmentDispatcher;
    if (dispatcher) {
      const startedMs = this.clock.nowMs();
      const dispatched = await dispatcher.dispatch({
        session: this.deps.session,
        targetAgentId: "assessment",
        intent: `grade answer: ${title}`,
        conceptIds: [conceptId],
        content: { concept_id: conceptId, concept_title: title, problem, answer },
      });
      if (dispatched.ok) {
        const response = dispatched.value.responsePackets[0];
        const content = (response?.content ?? {}) as Record<string, unknown>;
        await this.emitDegradedIfFallback(surfaceId, "assessment", content);
        const graded = content["assessment"] as Verdict | undefined;
        if (graded) verdict = graded;
        await this.emitFrameWorkTiming({
          surfaceId,
          agentId: "assessment",
          agentCid: response?.source_cid ?? "agent.assessment",
          workId: dispatched.value.workItem.work_id,
          packetId: response?.packet_id ?? null,
          workType: dispatched.value.workItem.work_type,
          startedMs,
        });
        const trace = dispatched.value.emissions.trace;
        if (trace) {
          await this.emit("surface.agent.reasoning.summary", {
            surface_id: surfaceId,
            agent_cid: response?.source_cid ?? "agent.assessment",
            agent_id: "assessment",
            packet_id: response?.packet_id ?? null,
            work_id: dispatched.value.workItem.work_id,
            task_interpretation: trace.task_interpretation,
            strategy: trace.strategy,
            decision: trace.decision,
            self_critique: trace.self_critique ?? null,
            confidence: verdict.confidence,
            determinism_level: trace.determinism_level,
          });
        }
      }
    }

    // 3. The honest gate — driven entirely by the learner's real answer (never fabricated).
    const total = verdict.tests.length;
    const passedCount = verdict.tests.filter((t) => t.passed).length;
    await this.emit("surface.assessment.gate.evaluated", {
      surface_id: surfaceId,
      concept_id: conceptId,
      passed: verdict.passed,
      passed_count: passedCount,
      total_count: total,
      threshold: total > 0 ? Math.ceil(total * 0.8) : 0,
      graded: verdict.graded,
      tests: verdict.tests.map((t) => ({
        kind: t.kind,
        passed: t.passed,
        confidence: t.confidence,
        evidence: t.evidence,
      })),
    });

    // 4. Close the loop with an assessment frame carrying the real verdict + feedback.
    const summary = !verdict.graded
      ? "Answer recorded — live grading is unavailable right now."
      : verdict.passed
        ? `Mastery demonstrated${verdict.feedback ? ` — ${verdict.feedback}` : "."}`
        : `Not yet${verdict.feedback ? ` — ${verdict.feedback}` : " — let's revisit this together."}`;
    await this.composeDeterministicFrame({
      surfaceId,
      conceptId,
      conceptNodeId,
      frameTitle: `Assessment — ${title}`,
      archetype: "concept-first",
      producerCid: "agent.assessment",
      agentId: "assessment",
      role: "assessor",
      reason: "learner answer graded into a Cognitive Frame",
      kind: "assessment",
      mccr: {
        core_concept: mccrTextSlot("core_concept", `Assessment — ${title}`, conceptId),
        memory_cue: mccrTextSlot("memory_cue", summary, conceptId),
      },
      segments: [{ text: summary, anchor_ref: "memory_cue", intent: "reinforce" }],
    });

    await this.emit("surface.interaction.applied", {
      surface_id: surfaceId,
      interaction_id: interactionId,
      effect: "dispatched",
      reason: verdict.graded ? "learner answer graded" : "learner answer recorded (ungraded)",
    });
    if (this.timeline) {
      const refreshed = await this.timeline.refresh("answer-graded");
      if (!refreshed.ok) return refreshed;
    }
    return ok({ interaction_id: interactionId, effect: "dispatched" });
  }

  /** The concept's display title + the practice problem shown on its practice frame (for grading). */
  private findPracticeContext(conceptId: string): { title: string; problem: string } {
    const frames = this.state()?.frames ?? [];
    const conceptFrames = frames.filter((f) => f.concept_id === conceptId);
    const stripPrefix = (t: string): string =>
      t
        .replace(/^Practice —\s*/i, "")
        .replace(/^Checkpoint —\s*/i, "")
        .replace(/^Ready to practice —\s*/i, "")
        .trim();
    const title = stripPrefix(conceptFrames[0]?.title ?? conceptId) || conceptId;
    // Prefer the typed kind (ADR-0055 D6); fall back to the title only for pre-1.7.0 replays.
    const practice = [...conceptFrames]
      .reverse()
      .find((f) => f.kind === "practice" || f.title.toLowerCase().startsWith("practice"));
    const example = practice?.mccr?.key_example?.content;
    const problem = example && example.kind === "text" ? example.text : "";
    return { title, problem };
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
      // LKS T1 (ADR-0045): the grounded provider takes precedence — a proactive frontier is real +
      // cited, or honestly deferred. Only when no provider is wired do we fall back to the legacy
      // ungrounded research breadcrumb (CLI/tests), preserving ADR-0026 behavior there.
      if (this.deps.frontierProvider) {
        await this.runGroundedFrontier(surfaceId, input, blocks);
      } else if (this.deps.researchDispatcher) {
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
  /**
   * Surface the REAL web-grounded frontier after verified mastery (CSE M9 LKS T1, ADR-0045). The
   * grounded provider (ADR-0043) is asked for the mastered concept's frontier; if it returns cited
   * entries they are surfaced (`surface.research.frontier.surfaced { grounded: true, entries }`) +
   * contributed as a research block. If nothing citable is found, we DEFER honestly — a proactive
   * frontier is grounded or it is not shown (never the ungrounded breadcrumb). Best-effort: any
   * failure defers, never blocks or fabricates.
   */
  private async runGroundedFrontier(
    surfaceId: string,
    input: SurfaceAskInput,
    blocks: CognitionBlock[],
  ): Promise<void> {
    const provider = this.deps.frontierProvider;
    if (!provider) return;
    const focusTitle =
      input.concepts.find((c) => c.id === input.focusConceptId)?.title ?? input.focusConceptId;
    const conceptNodeId = `concept:${input.focusConceptId}`;

    let overlay: Awaited<ReturnType<SurfaceFrontierProvider["researchFrontier"]>> = null;
    try {
      overlay = await provider.researchFrontier(input.focusConceptId, focusTitle);
    } catch {
      overlay = null; // best-effort — treat as no grounded frontier
    }
    const entries = overlay?.entries ?? [];
    if (entries.length === 0) {
      // Honest deferral: no citable frontier ⇒ nothing surfaced (never the ungrounded breadcrumb).
      await this.emit("surface.research.frontier.deferred", {
        surface_id: surfaceId,
        concept_id: input.focusConceptId,
        confidence: input.mastery.confidence,
        reason: "no grounded frontier found",
      });
      return;
    }

    const entryPayload = entries.map((e) => ({
      kind: e.kind,
      summary: e.summary,
      external_refs: e.external_refs.map((r) => ({ uri: r.uri, title: r.title })),
    }));

    // D3: emit the surfaced event before contributing the block (grounded flag + cited entries).
    await this.emit("surface.research.frontier.surfaced", {
      surface_id: surfaceId,
      concept_id: input.focusConceptId,
      grounded: true,
      entries: entryPayload,
      confidence: input.mastery.confidence,
      gate_passed: true,
    });

    const block = await this.contributions.contribute({
      surface_id: surfaceId,
      agent_id: "frontier",
      agent_cid: "agent.frontier",
      block_type: "research",
      title: `Frontier — ${focusTitle}`,
      content: { grounded: true, entries: entryPayload },
      concept_ids: [input.focusConceptId],
      reason: "grounded frontier surfaced after verified mastery (ADR-0045)",
      world_state_nodes: [conceptNodeId],
    });
    if (block.ok) blocks.push(block.value);
  }

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

  /**
   * Surface real work-timing for a frame-path dispatch (composer/planner/imageplanner) so the Agent
   * Observatory shows honest latency for these units — not just the fiber-loop agents (ADR-0029).
   * Latency is real-clock (deterministic per event log), so under the frozen demo clock it is 0.
   */
  /**
   * Fallback health law (review §22, root-cause #1): when a unit's response carries a `fallback_reason`
   * it degraded to its deterministic path — a fact the learner-facing surface must not hide. Emit a
   * typed `surface.cognition.degraded` marker (folded into a health slice, surfaced in the HUD) so a
   * silently-degraded session is distinguishable from a healthy one. Extends ADR-0029.
   */
  private async emitDegradedIfFallback(
    surfaceId: string,
    unitId: string,
    content: Record<string, unknown>,
  ): Promise<void> {
    const reason =
      typeof content["fallback_reason"] === "string" ? content["fallback_reason"] : null;
    if (!reason) return;
    await this.emit("surface.cognition.degraded", {
      surface_id: surfaceId,
      unit_id: unitId,
      reason,
      response_kind:
        typeof content["response_kind"] === "string" ? (content["response_kind"] as string) : null,
    });
  }

  private async emitFrameWorkTiming(args: {
    surfaceId: string;
    agentId: string;
    agentCid: string;
    workId: string | null;
    packetId: string | null;
    workType: string;
    startedMs: number;
  }): Promise<void> {
    if (!args.workId) return;
    await this.emit("surface.agent.work.timing", {
      surface_id: args.surfaceId,
      agent_cid: args.agentCid,
      agent_id: args.agentId,
      work_id: args.workId,
      packet_id: args.packetId,
      work_type: args.workType,
      status: "completed",
      queue_wait_ms: 0,
      execution_ms: Math.max(0, this.clock.nowMs() - args.startedMs),
    });
  }
}
