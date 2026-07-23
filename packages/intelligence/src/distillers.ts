/**
 * Registry-v1 distillers (CIP-002 §2) — deterministic pure folds over chronicle segments.
 * Every distiller is a total function of (events, ctx): same chronicle ⇒ byte-identical bodies
 * (the plane re-derivation drill depends on this). Model-assisted enrichment (richer episode
 * summaries) layers on later under a bumped method_version — supersedes, never overwrites.
 */
import type { CognitiveEvent } from "@inevitable/protocols";
import type { IntelligenceKind } from "./artifact";

export interface DistillContext {
  readonly learner_cid: string;
  readonly tenant_id: string;
  readonly session_id: string | null;
}

export interface Distillate {
  readonly kind: IntelligenceKind;
  readonly body: Record<string, unknown>;
  readonly confidence: number;
  /** Event ids this distillate was folded from (becomes provenance_refs). */
  readonly provenance: readonly string[];
  readonly consumers: readonly string[];
}

export interface Distiller {
  readonly distiller_id: string;
  readonly method_version: string;
  readonly regime: "learner" | "shared";
  run(events: readonly CognitiveEvent[], ctx: DistillContext): Distillate[];
}

const payloadOf = (e: CognitiveEvent): Record<string, unknown> =>
  (e.payload ?? {}) as Record<string, unknown>;
const str = (v: unknown, fallback = ""): string => (typeof v === "string" ? v : fallback);

/** `learner.episode` — the unit of lived learning (CSE-005 §3.1), folded from session events. */
export const episodeAssembler: Distiller = {
  distiller_id: "episode-assembler",
  method_version: "1.0.0",
  regime: "learner",
  run(events, ctx) {
    const provenance: string[] = [];
    const conceptRefs = new Set<string>();
    const sourceRefs = new Set<string>();
    const questions: Array<{ text: string; resolved: boolean }> = [];
    const confusions: Array<{ description: string; concept_ref: string; state: string }> = [];
    const interventions: Array<{ kind: string; ref: string; outcome: string }> = [];
    let blocks = 0;
    let masteryPasses = 0;
    let masteryFails = 0;

    for (const event of events) {
      const p = payloadOf(event);
      switch (event.event_type) {
        case "surface.frame.composed":
        case "surface.block.generated": {
          provenance.push(event.event_id);
          blocks++;
          const cid = str(p["concept_id"]);
          if (cid) conceptRefs.add(cid);
          break;
        }
        case "surface.source.attached":
        case "source.version.registered": {
          provenance.push(event.event_id);
          const vid = str(p["version_id"]);
          if (vid) sourceRefs.add(vid);
          break;
        }
        case "surface.interaction.received": {
          provenance.push(event.event_id);
          const kind = str(p["kind"]);
          if (kind === "challenge" || kind === "request_depth" || kind === "request_simplify") {
            questions.push({ text: kind, resolved: false });
          }
          break;
        }
        case "surface.assessment.gate.evaluated": {
          provenance.push(event.event_id);
          const passed = p["passed"] === true;
          if (passed) masteryPasses++;
          else {
            masteryFails++;
            confusions.push({
              description: "depth gate failed",
              concept_ref: str(p["concept_id"]),
              state: "open",
            });
          }
          break;
        }
        case "surface.prerequisite.descent.completed": {
          provenance.push(event.event_id);
          confusions.push({
            description: "confusion resolved via prerequisite descent",
            concept_ref: str(p["concept_id"]),
            state: "resolved",
          });
          break;
        }
        case "surface.image.decided":
        case "source.enrichment.decided": {
          provenance.push(event.event_id);
          interventions.push({
            kind: event.event_type === "surface.image.decided" ? "image" : "enrichment",
            ref: event.event_id,
            outcome: "pending",
          });
          break;
        }
        default:
          break;
      }
    }
    if (provenance.length === 0) return [];
    return [
      {
        kind: "learner.episode",
        body: {
          session_id: ctx.session_id,
          concept_refs: [...conceptRefs].sort(),
          source_refs: [...sourceRefs].sort(),
          questions,
          confusions,
          interventions,
          outcome: {
            summary: `${conceptRefs.size} concept(s), ${blocks} contribution(s), ${masteryPasses} gate pass(es), ${confusions.length} confusion(s)`,
          },
        },
        confidence: 0.9,
        provenance,
        consumers: ["resume-card", "understanding-map", "director-pacing"],
      },
    ];
  },
};

/** `learner.understanding-delta` — what the session did to this mind (CSE-005 §3.2). */
export const understandingDelta: Distiller = {
  distiller_id: "understanding-delta",
  method_version: "1.0.0",
  regime: "learner",
  run(events, ctx) {
    const provenance: string[] = [];
    const touched = new Set<string>();
    const movements: Array<{ concept_ref: string; direction: "advanced" | "checked" }> = [];
    const confusionsOpened: string[] = [];
    const confusionsResolved: string[] = [];
    for (const event of events) {
      const p = payloadOf(event);
      if (event.event_type === "surface.assessment.gate.evaluated") {
        provenance.push(event.event_id);
        const concept = str(p["concept_id"]);
        touched.add(concept);
        if (p["passed"] === true) movements.push({ concept_ref: concept, direction: "advanced" });
        else confusionsOpened.push(concept);
      }
      if (event.event_type === "surface.evaluation.recorded") {
        provenance.push(event.event_id);
        const concept = str(p["concept_id"]);
        if (concept) {
          touched.add(concept);
          movements.push({ concept_ref: concept, direction: "checked" });
        }
      }
      if (event.event_type === "surface.prerequisite.descent.completed") {
        provenance.push(event.event_id);
        confusionsResolved.push(str(p["concept_id"]));
      }
    }
    if (provenance.length === 0) return [];
    return [
      {
        kind: "learner.understanding-delta",
        body: {
          session_id: ctx.session_id,
          concepts_touched: [...touched].sort(),
          mastery_movements: movements,
          confusions_opened: confusionsOpened,
          confusions_resolved: confusionsResolved,
        },
        confidence: 0.85,
        provenance,
        consumers: ["resume-card", "understanding-map", "time-machine"],
      },
    ];
  },
};

/** `learner.misconception` — life-stories: cause → correction → recurrence (CIP-001 §5). */
export const misconceptionTracker: Distiller = {
  distiller_id: "misconception-tracker",
  method_version: "1.0.0",
  regime: "learner",
  run(events) {
    const byConcept = new Map<string, { failures: string[]; corrections: string[] }>();
    for (const event of events) {
      const p = payloadOf(event);
      if (event.event_type === "surface.assessment.gate.evaluated" && p["passed"] === false) {
        const c = str(p["concept_id"]);
        const entry = byConcept.get(c) ?? { failures: [], corrections: [] };
        entry.failures.push(event.event_id);
        byConcept.set(c, entry);
      }
      if (event.event_type === "surface.prerequisite.descent.completed") {
        const c = str(p["concept_id"]);
        const entry = byConcept.get(c) ?? { failures: [], corrections: [] };
        entry.corrections.push(event.event_id);
        byConcept.set(c, entry);
      }
    }
    return [...byConcept.entries()]
      .filter(([, v]) => v.failures.length > 0)
      .map(([concept, v]) => ({
        kind: "learner.misconception" as const,
        body: {
          concept_ref: concept,
          occurrences: v.failures.length,
          corrected: v.corrections.length > 0,
          recurrence: v.failures.length > 1,
        },
        confidence: 0.8,
        provenance: [...v.failures, ...v.corrections],
        consumers: ["misconception-first-pedagogy", "revision-scheduling"],
      }));
  },
};

/** `pedagogy.intervention-outcome` — decision × subsequent result pairs (learner-scoped v1). */
export const interventionOutcome: Distiller = {
  distiller_id: "intervention-outcome",
  method_version: "1.0.0",
  regime: "learner",
  run(events) {
    const results: Distillate[] = [];
    const pending: Array<{ id: string; kind: string; concept: string }> = [];
    for (const event of events) {
      const p = payloadOf(event);
      if (
        event.event_type === "surface.image.decided" ||
        event.event_type === "source.enrichment.decided"
      ) {
        pending.push({
          id: event.event_id,
          kind: event.event_type,
          concept: str(p["concept_id"] ?? p["frame_id"]),
        });
      }
      if (event.event_type === "surface.assessment.gate.evaluated" && pending.length > 0) {
        const outcome = p["passed"] === true ? "helped" : "insufficient";
        for (const intervention of pending) {
          results.push({
            kind: "pedagogy.intervention-outcome",
            body: {
              intervention_kind: intervention.kind,
              intervention_ref: intervention.id,
              assessed_concept: str(p["concept_id"]),
              outcome,
            },
            confidence: 0.6, // temporal-correlation heuristic, honestly weak
            provenance: [intervention.id, event.event_id],
            consumers: ["enrichment-arbitration", "evolution-evidence"],
          });
        }
        pending.length = 0;
      }
    }
    return results;
  },
};

/** `agent.strategy-outcome` — reasoning traces (C1) joined with evaluation results. */
export const strategyOutcome: Distiller = {
  distiller_id: "strategy-outcome",
  method_version: "1.0.0",
  regime: "learner",
  run(events) {
    const results: Distillate[] = [];
    const evaluations = events.filter((e) => e.event_type === "surface.evaluation.recorded");
    for (const event of events) {
      if (event.event_type !== "reasoning.trace.recorded") continue;
      const p = payloadOf(event);
      const trace = (p["trace"] ?? {}) as Record<string, unknown>;
      const evaluation = evaluations[0]; // session-scoped join, v1
      results.push({
        kind: "agent.strategy-outcome",
        body: {
          agent_id: str(p["agent_id"]),
          strategy: str(trace["strategy"]),
          decision: str(trace["decision"]),
          self_critique: trace["self_critique"] ?? null,
          uncertainty: trace["uncertainty_estimate"] ?? null,
          evaluation_score: evaluation
            ? ((payloadOf(evaluation)["score"] as number | undefined) ?? null)
            : null,
        },
        confidence: 0.75,
        provenance: [event.event_id, ...(evaluation ? [evaluation.event_id] : [])],
        consumers: ["arbiter-weighting", "evolution-evidence", "agent-theater"],
      });
    }
    return results;
  },
};

/** `agent.collaboration` — how the ensemble negotiated, per topic. */
export const collaborationDistiller: Distiller = {
  distiller_id: "collaboration-distiller",
  method_version: "1.0.0",
  regime: "learner",
  run(events) {
    const byTopic = new Map<
      string,
      { proposals: string[]; agents: Set<string>; disagreements: number; synthesis: string | null }
    >();
    for (const event of events) {
      const p = payloadOf(event);
      const topic = str(p["topic"]);
      if (!topic) continue;
      const entry = byTopic.get(topic) ?? {
        proposals: [],
        agents: new Set<string>(),
        disagreements: 0,
        synthesis: null,
      };
      if (event.event_type === "surface.proposal.proposed") {
        entry.proposals.push(event.event_id);
        entry.agents.add(str(p["agent_id"]));
      }
      if (event.event_type === "surface.agent.disagreed") entry.disagreements++;
      if (event.event_type === "surface.synthesis.recorded") entry.synthesis = event.event_id;
      byTopic.set(topic, entry);
    }
    return [...byTopic.entries()]
      .filter(([, v]) => v.proposals.length > 0)
      .map(([topic, v]) => ({
        kind: "agent.collaboration" as const,
        body: {
          topic,
          proposal_count: v.proposals.length,
          agents: [...v.agents].sort(),
          disagreements: v.disagreements,
          synthesized: v.synthesis !== null,
        },
        confidence: 0.85,
        provenance: [...v.proposals, ...(v.synthesis ? [v.synthesis] : [])],
        consumers: ["arbiter-weighting", "agent-theater"],
      }));
  },
};

/** `learner.consolidation-candidate` — episodic residue worth folding into semantic memory. */
export const consolidationDriver: Distiller = {
  distiller_id: "consolidation-driver",
  method_version: "1.0.0",
  regime: "learner",
  run(events) {
    const mutations = events.filter(
      (e) =>
        e.event_type === "memory.mutation.committed" &&
        str(payloadOf(e)["memory_layer"]) === "episodic",
    );
    if (mutations.length === 0) return [];
    return [
      {
        kind: "learner.consolidation-candidate",
        body: {
          mutation_ids: mutations.map((m) => str(payloadOf(m)["mutation_id"], m.event_id)),
          target_layer: "semantic",
        },
        confidence: 0.7,
        provenance: mutations.map((m) => m.event_id),
        consumers: ["memory-consolidation"],
      },
    ];
  },
};

export const REGISTRY_V1: readonly Distiller[] = [
  episodeAssembler,
  understandingDelta,
  misconceptionTracker,
  interventionOutcome,
  strategyOutcome,
  collaborationDistiller,
  consolidationDriver,
];
