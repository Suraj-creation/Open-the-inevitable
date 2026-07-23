/**
 * foldSourceCognition — the deep-transparency projection (CSE M12 T1, ADR-0050).
 *
 * A PURE, deterministic fold over the source plane's log (`source.*` cognition events + the D3
 * `model.output.recorded` events) into a `SourceCognitionState`: what the source environment reasoned
 * — layers built/degraded, claims extracted, contradictions found, syntheses woven, frontier/timeline
 * groundings, creation assists — with confidence, honest degradation, and provenance. This is an
 * OBSERVABILITY projection, deliberately separate from `foldSourceEvents` (which reconstructs store
 * state for replay). Zero Node imports — the same log folds identically anywhere (replay equivalence).
 *
 * Spec: spec/source-environment/CSE-002 §11, spec/architecture-decisions/ADR-0050.
 */
import type { CognitiveEvent } from "@inevitable/protocols";
import { SOURCE_EVENT_TYPES } from "./events";

/** The D3 recording event published before a model result may be used (adapters MODEL_OUTPUT_RECORDED). */
const MODEL_OUTPUT_RECORDED = "model.output.recorded";

/** A count per cognition family — how much the source plane actually reasoned. */
export interface SourceCognitionActivity {
  readonly versions_registered: number;
  readonly layers_constructed: number;
  readonly layers_degraded: number;
  readonly claims_recorded: number;
  readonly contradictions_detected: number;
  readonly fusions_composed: number;
  readonly syntheses: number;
  readonly frontier_updates: number;
  readonly timeline_updates: number;
  readonly creations_started: number;
  readonly creation_assists: number;
  readonly creations_completed: number;
  readonly creations_contributed: number;
  readonly consents_granted: number;
  readonly consents_revoked: number;
  readonly redactions: number;
}

/** Per (version, layer): confidence + degraded flag — reasoning quality and HONEST degradation surfaced. */
export interface SourceLayerHealth {
  readonly version_id: string;
  readonly layer: string;
  readonly confidence: number;
  readonly degraded: boolean;
}

/** Memoization telemetry — the shared-cache hit rate (CSE-002 §11), a live counter, not a log fold. */
export interface SourceCacheStats {
  readonly hits: number;
  readonly misses: number;
  /** hits / (hits + misses); 0 when nothing has been computed yet. */
  readonly hit_rate: number;
  /** Per cognition kind (fusion | frontier | timeline | claims). */
  readonly by_kind: Readonly<Record<string, { readonly hits: number; readonly misses: number }>>;
}

const EMPTY_CACHE_STATS: SourceCacheStats = { hits: 0, misses: 0, hit_rate: 0, by_kind: {} };

/** One recent cognition step, provenance-bearing (every surfaced line traces to its producer). */
export interface SourceCognitionEntry {
  readonly event_type: string;
  /** The event's HLC — the canonical ordering key. */
  readonly at: string;
  readonly producer_cid: string;
  readonly summary: string;
  readonly confidence: number | null;
  readonly degraded: boolean;
}

/** The deep-transparency read model of the source plane. */
export interface SourceCognitionState {
  readonly activity: SourceCognitionActivity;
  readonly layers: readonly SourceLayerHealth[];
  /** Count of D3 `model.output.recorded` events — real model cognition that ran. */
  readonly model_invocations: number;
  /** Cognition steps the plane marked degraded (honest "the model wasn't available / below floor"). */
  readonly degraded_count: number;
  /** The most recent cognition steps, newest first. */
  readonly recent: readonly SourceCognitionEntry[];
  /** Every source/model cognition event seen (the denominator for the activity above). */
  readonly total_events: number;
  /** Memoization telemetry (M12 T2) — live counters injected by the host, not folded from the log. */
  readonly cache: SourceCacheStats;
}

const num = (v: unknown, fallback = 0): number => (typeof v === "number" ? v : fallback);
const str = (v: unknown, fallback = ""): string => (typeof v === "string" ? v : fallback);
const arrLen = (v: unknown): number => (Array.isArray(v) ? v.length : 0);

/** Build the human summary + confidence + degraded for one cognition event (defensive readers). */
function describe(
  event: CognitiveEvent,
  payload: Record<string, unknown>,
): { summary: string; confidence: number | null; degraded: boolean } {
  switch (event.event_type) {
    case SOURCE_EVENT_TYPES.versionRegistered:
      return {
        summary: `registered ${str(payload["modality"], "source")} version`,
        confidence: null,
        degraded: false,
      };
    case SOURCE_EVENT_TYPES.layerConstructed:
      return {
        summary: `built the ${str(payload["layer"])} layer`,
        confidence: num(payload["confidence"], 0),
        degraded: false,
      };
    case SOURCE_EVENT_TYPES.layerDegraded:
      return {
        summary: `degraded the ${str(payload["layer"])} layer — ${str(payload["reason"], "below floor")}`,
        confidence: num(payload["confidence"], 0),
        degraded: true,
      };
    case SOURCE_EVENT_TYPES.claimRecorded:
      return {
        summary: `recorded a claim: ${str(payload["statement"]).slice(0, 80)}`,
        confidence: null,
        degraded: false,
      };
    case SOURCE_EVENT_TYPES.contradictionDetected:
      return {
        summary: `found a ${str(payload["nature"], "")} contradiction across ${arrLen(payload["source_version_ids"])} sources`,
        confidence: null,
        degraded: false,
      };
    case SOURCE_EVENT_TYPES.fusionComposed:
      return {
        summary: `fused ${arrLen(payload["source_version_ids"])} sources over ${arrLen(payload["concept_refs"])} concepts`,
        confidence: null,
        degraded: false,
      };
    case SOURCE_EVENT_TYPES.fusionConceptReconciled:
      return {
        summary: `reconciled "${str(payload["concept_ref"])}"${payload["corroborated"] ? " (corroborated)" : ""}`,
        confidence: num(payload["confidence"], 0),
        degraded: false,
      };
    case SOURCE_EVENT_TYPES.fusionGapDetected:
      return {
        summary: `named a gap: "${str(payload["concept_ref"])}" — ${str(payload["reason"])}`,
        confidence: null,
        degraded: false,
      };
    case SOURCE_EVENT_TYPES.fusionSynthesized:
      return {
        summary: `wove a fused explanation of "${str(payload["concept_ref"])}"${payload["acknowledges_disagreement"] ? " (acknowledges disagreement)" : ""}`,
        confidence: null,
        degraded: payload["degraded"] === true,
      };
    case SOURCE_EVENT_TYPES.frontierUpdated:
      return {
        summary: `grounded a frontier for "${str(payload["concept_ref"])}" — ${num(payload["entry_count"])} entries, ${num(payload["citation_count"])} citations`,
        confidence: null,
        degraded: payload["degraded"] === true,
      };
    case SOURCE_EVENT_TYPES.timelineUpdated:
      return {
        summary: `traced "${str(payload["concept_ref"])}" through time — ${num(payload["state_count"])} states, ${num(payload["citation_count"])} citations`,
        confidence: null,
        degraded: payload["degraded"] === true,
      };
    case SOURCE_EVENT_TYPES.creationStarted:
      return {
        summary: `opened a ${str(payload["kind"], "creation")}`,
        confidence: null,
        degraded: false,
      };
    case SOURCE_EVENT_TYPES.creationEvolved:
    case SOURCE_EVENT_TYPES.creationCritiqued:
      return {
        summary: `offered a ${str(payload["assist_kind"], "assist")} assist (disclosed)`,
        confidence: null,
        degraded: payload["degraded"] === true,
      };
    case SOURCE_EVENT_TYPES.creationCompleted:
      return {
        summary: `completed a ${str(payload["kind"], "creation")} (${num(payload["assist_count"])} assists)`,
        confidence: null,
        degraded: false,
      };
    case SOURCE_EVENT_TYPES.creationContributed:
      return {
        summary: `contributed a ${str(payload["kind"], "creation")} as a Cognitive Source (consented)`,
        confidence: null,
        degraded: false,
      };
    case SOURCE_EVENT_TYPES.consentGranted:
      return {
        summary: `consent granted (${str(payload["scope"], "commons")})`,
        confidence: null,
        degraded: false,
      };
    case SOURCE_EVENT_TYPES.consentRevoked:
      return { summary: `consent revoked by the learner`, confidence: null, degraded: false };
    case SOURCE_EVENT_TYPES.redactionCascaded:
      return {
        summary: `redaction cascaded — content withdrawn, delisted from the commons (sovereign)`,
        confidence: null,
        degraded: false,
      };
    case MODEL_OUTPUT_RECORDED:
      return {
        summary: `model call recorded (${str((payload["response"] as Record<string, unknown> | undefined)?.["model"], str(payload["provider"], "model"))})`,
        confidence: null,
        degraded: false,
      };
    default:
      return { summary: event.event_type, confidence: null, degraded: false };
  }
}

export function foldSourceCognition(
  events: readonly CognitiveEvent[],
  opts: { readonly recentLimit?: number; readonly cache?: SourceCacheStats } = {},
): SourceCognitionState {
  const recentLimit = opts.recentLimit ?? 30;
  const cache = opts.cache ?? EMPTY_CACHE_STATS;
  const activity = {
    versions_registered: 0,
    layers_constructed: 0,
    layers_degraded: 0,
    claims_recorded: 0,
    contradictions_detected: 0,
    fusions_composed: 0,
    syntheses: 0,
    frontier_updates: 0,
    timeline_updates: 0,
    creations_started: 0,
    creation_assists: 0,
    creations_completed: 0,
    creations_contributed: 0,
    consents_granted: 0,
    consents_revoked: 0,
    redactions: 0,
  };
  const layerByKey = new Map<string, SourceLayerHealth>();
  const entries: SourceCognitionEntry[] = [];
  let modelInvocations = 0;
  let degradedCount = 0;
  let totalEvents = 0;

  for (const event of events) {
    const isSource = event.event_type.startsWith("source.");
    const isModel = event.event_type === MODEL_OUTPUT_RECORDED;
    if (!isSource && !isModel) continue;
    totalEvents += 1;
    const payload = (event.payload ?? {}) as Record<string, unknown>;

    if (isModel) modelInvocations += 1;

    switch (event.event_type) {
      case SOURCE_EVENT_TYPES.versionRegistered:
        activity.versions_registered += 1;
        break;
      case SOURCE_EVENT_TYPES.layerConstructed:
        activity.layers_constructed += 1;
        layerByKey.set(`${str(payload["version_id"])}::${str(payload["layer"])}`, {
          version_id: str(payload["version_id"]),
          layer: str(payload["layer"]),
          confidence: num(payload["confidence"], 0),
          degraded: false,
        });
        break;
      case SOURCE_EVENT_TYPES.layerDegraded:
        activity.layers_degraded += 1;
        layerByKey.set(`${str(payload["version_id"])}::${str(payload["layer"])}`, {
          version_id: str(payload["version_id"]),
          layer: str(payload["layer"]),
          confidence: num(payload["confidence"], 0),
          degraded: true,
        });
        break;
      case SOURCE_EVENT_TYPES.claimRecorded:
        activity.claims_recorded += 1;
        break;
      case SOURCE_EVENT_TYPES.contradictionDetected:
        activity.contradictions_detected += 1;
        break;
      case SOURCE_EVENT_TYPES.fusionComposed:
        activity.fusions_composed += 1;
        break;
      case SOURCE_EVENT_TYPES.fusionSynthesized:
        activity.syntheses += 1;
        break;
      case SOURCE_EVENT_TYPES.frontierUpdated:
        activity.frontier_updates += 1;
        break;
      case SOURCE_EVENT_TYPES.timelineUpdated:
        activity.timeline_updates += 1;
        break;
      case SOURCE_EVENT_TYPES.creationStarted:
        activity.creations_started += 1;
        break;
      case SOURCE_EVENT_TYPES.creationEvolved:
      case SOURCE_EVENT_TYPES.creationCritiqued:
        activity.creation_assists += 1;
        break;
      case SOURCE_EVENT_TYPES.creationCompleted:
        activity.creations_completed += 1;
        break;
      case SOURCE_EVENT_TYPES.creationContributed:
        activity.creations_contributed += 1;
        break;
      case SOURCE_EVENT_TYPES.consentGranted:
        activity.consents_granted += 1;
        break;
      case SOURCE_EVENT_TYPES.consentRevoked:
        activity.consents_revoked += 1;
        break;
      case SOURCE_EVENT_TYPES.redactionCascaded:
        activity.redactions += 1;
        break;
      default:
        break;
    }

    const described = describe(event, payload);
    if (described.degraded) degradedCount += 1;
    entries.push({
      event_type: event.event_type,
      at: str(event.hlc),
      producer_cid: str(event.producer_cid),
      summary: described.summary,
      confidence: described.confidence,
      degraded: described.degraded,
    });
  }

  // Newest first, capped — the recent activity feed.
  const recent = entries.slice(Math.max(0, entries.length - recentLimit)).reverse();

  return {
    activity,
    layers: [...layerByKey.values()],
    model_invocations: modelInvocations,
    degraded_count: degradedCount,
    recent,
    total_events: totalEvents,
    cache,
  };
}
