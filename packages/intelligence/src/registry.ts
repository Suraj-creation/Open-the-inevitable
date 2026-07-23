/**
 * The distillation orchestrator — folds a chronicle segment through the registry, applies the
 * governance guards (opt-out, cohort minimum), stamps the canonical envelope, and emits the
 * `intelligence.*` lifecycle. Deterministic given (events, ctx, idGenerator/hlc seeds): the same
 * chronicle re-derives the same plane — backfill (B1) and the re-derivation drill (V) are this
 * same function over replayed logs.
 */
import {
  CryptoIdGenerator,
  SystemClock,
  hlcInit,
  hlcTick,
  hlcToString,
  type Clock,
  type Hlc,
  type IdGenerator,
} from "@inevitable/shared";
import { createEvent, type EventBus } from "@inevitable/events";
import type { CognitiveEvent } from "@inevitable/protocols";
import { INTELLIGENCE_EVENT_TYPES, newArtifactId, type IntelligenceArtifact } from "./artifact";
import { REGISTRY_V1, type DistillContext, type Distiller } from "./distillers";

export interface DistillationGovernance {
  /** Learner opted out of intelligence distillation: learner-regime distillers are skipped
   * entirely (CSE-005 §7 / ADR-0035 lock 4). Distillation entry, not read-time filtering. */
  readonly learnerOptedOut?: boolean;
  /** Cohort-minimum guard for shared-regime kinds: given a kind, returns whether the cohort
   * threshold is met. Absent ⇒ shared kinds are refused (safe default until the aggregation
   * privacy ADR lands — CSE-006 §8). */
  readonly cohortMet?: (kind: string) => boolean;
}

export interface DistillSessionInput {
  readonly events: readonly CognitiveEvent[];
  readonly ctx: DistillContext;
  readonly governance?: DistillationGovernance;
  readonly registry?: readonly Distiller[];
  readonly clock?: Clock;
  readonly idGenerator?: IdGenerator;
  readonly nodeId?: string;
}

export interface DistillSessionResult {
  readonly artifacts: readonly IntelligenceArtifact[];
  /** Kinds skipped by governance (opt-out / cohort) — reported, never silent. */
  readonly skipped: ReadonlyArray<{ distiller_id: string; reason: string }>;
}

/** Fold a chronicle segment into IntelligenceArtifacts. Pure given its injected seeds. */
export function distillSession(input: DistillSessionInput): DistillSessionResult {
  const registry = input.registry ?? REGISTRY_V1;
  const idGenerator = input.idGenerator ?? new CryptoIdGenerator();
  const clock = input.clock ?? new SystemClock();
  let hlc: Hlc = hlcInit(input.nodeId ?? "intelligence-distillation");
  const artifacts: IntelligenceArtifact[] = [];
  const skipped: Array<{ distiller_id: string; reason: string }> = [];

  for (const distiller of registry) {
    if (distiller.regime === "learner" && input.governance?.learnerOptedOut) {
      skipped.push({ distiller_id: distiller.distiller_id, reason: "learner opt-out" });
      continue;
    }
    if (distiller.regime === "shared") {
      const met = input.governance?.cohortMet;
      if (!met) {
        skipped.push({
          distiller_id: distiller.distiller_id,
          reason: "shared regime refused: no cohort guard configured (safe default)",
        });
        continue;
      }
    }
    for (const distillate of distiller.run(input.events, input.ctx)) {
      if (
        distiller.regime === "shared" &&
        input.governance?.cohortMet &&
        !input.governance.cohortMet(distillate.kind)
      ) {
        skipped.push({
          distiller_id: distiller.distiller_id,
          reason: `cohort minimum not met for ${distillate.kind}`,
        });
        continue;
      }
      if (distillate.consumers.length === 0) {
        // Admission law (ADR-0035 lock 2): intelligence without a consumer is not intelligence.
        skipped.push({ distiller_id: distiller.distiller_id, reason: "no named consumer" });
        continue;
      }
      hlc = hlcTick(hlc, clock);
      artifacts.push({
        artifact_id: newArtifactId(idGenerator),
        kind: distillate.kind,
        scope: {
          regime: distiller.regime,
          learner_cid: distiller.regime === "learner" ? input.ctx.learner_cid : null,
          tenant_id: input.ctx.tenant_id,
        },
        body: distillate.body,
        epistemics: {
          confidence: distillate.confidence,
          method: distiller.distiller_id,
          method_version: distiller.method_version,
          provenance_refs: distillate.provenance,
          supersedes: null,
          decay_policy: "none",
        },
        consumers: distillate.consumers,
        distilled_hlc: hlcToString(hlc),
      });
    }
  }
  return { artifacts, skipped };
}

/** Publish `intelligence.distilled` lifecycle events for a distillation run (state-then-emit:
 * call after the artifacts have been durably stored). */
export async function emitDistilled(
  bus: EventBus,
  artifacts: readonly IntelligenceArtifact[],
  deps: { clock?: Clock; idGenerator?: IdGenerator; nodeId?: string } = {},
): Promise<void> {
  const clock = deps.clock ?? new SystemClock();
  const idGenerator = deps.idGenerator ?? new CryptoIdGenerator();
  let hlc = hlcInit(deps.nodeId ?? "intelligence-distillation");
  for (const artifact of artifacts) {
    hlc = hlcTick(hlc, clock);
    const created = createEvent(
      {
        eventType: INTELLIGENCE_EVENT_TYPES.distilled,
        producerCid: "cog-intelligence-distillation",
        producerType: "intelligence.registry",
        payload: {
          artifact_id: artifact.artifact_id,
          kind: artifact.kind,
          regime: artifact.scope.regime,
          learner_cid: artifact.scope.learner_cid,
          method: artifact.epistemics.method,
          method_version: artifact.epistemics.method_version,
          provenance_count: artifact.epistemics.provenance_refs.length,
        },
        topic: `cos.${INTELLIGENCE_EVENT_TYPES.distilled}`,
        classification: "internal",
      },
      { clock, hlc, idGenerator },
    );
    hlc = created.hlc;
    await bus.publish(created.event);
  }
}

/**
 * G1 — deletion cascade: everything derived for a learner goes, completely (ADR-0035 lock 4).
 * Returns the surviving artifacts; callers persisting to a store use the matching store cascade.
 */
export function redactLearnerArtifacts(
  artifacts: readonly IntelligenceArtifact[],
  learnerCid: string,
): IntelligenceArtifact[] {
  return artifacts.filter((a) => a.scope.learner_cid !== learnerCid);
}
