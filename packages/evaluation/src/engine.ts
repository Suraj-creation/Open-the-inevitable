/**
 * CognitiveEvaluationEngine — Cognitive Evaluation Layer entry point (Layer 2, ADR-0027).
 *
 * Consumes a ReasoningTrace, selects the best scorecard, scores it (D1 pure), and emits
 * `evaluation.reasoning.completed` (permanent, replayable) on the event bus.
 *
 * Spec: spec/evaluation/cognitive-evaluation-architecture.md §5.
 */
import type { ModelRuntime } from "@inevitable/contracts";
import { createEvent, type EventBus } from "@inevitable/events";
import type { ReasoningTrace } from "@inevitable/protocols";
import {
  CryptoIdGenerator,
  SystemClock,
  hlcInit,
  hlcToString,
  type Clock,
  type Hlc,
  type IdGenerator,
} from "@inevitable/shared";

import { DEFAULT_SCORECARDS, scorecardForTrace } from "./scorecards";
import type {
  EvaluationRecord,
  ReasoningScorecard,
  ScorecardContext,
  ScorecardDimension,
  ScorecardVerdict,
} from "./types";
import { EVALUATION_PASS_THRESHOLD } from "./types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EvaluationEngineDeps {
  readonly bus: EventBus;
  readonly scorecards?: ReadonlyMap<string, ReasoningScorecard>;
  readonly model?: ModelRuntime;
  readonly clock?: Clock;
  readonly idGenerator?: IdGenerator;
  readonly nodeId?: string;
  readonly producerCid?: string;
}

export interface EvaluateResult {
  readonly verdict: ScorecardVerdict;
  readonly record: EvaluationRecord;
}

// ---------------------------------------------------------------------------
// CognitiveEvaluationEngine
// ---------------------------------------------------------------------------

export class CognitiveEvaluationEngine {
  private readonly bus: EventBus;
  private readonly scorecards: ReadonlyMap<string, ReasoningScorecard>;
  private readonly model: ModelRuntime | undefined;
  private readonly clock: Clock;
  private readonly idGenerator: IdGenerator;
  private readonly producerCid: string;
  private hlc: Hlc;

  constructor(deps: EvaluationEngineDeps) {
    this.bus = deps.bus;
    this.scorecards = deps.scorecards ?? DEFAULT_SCORECARDS;
    this.model = deps.model;
    this.clock = deps.clock ?? new SystemClock();
    this.idGenerator = deps.idGenerator ?? new CryptoIdGenerator();
    this.producerCid = deps.producerCid ?? "engine.evaluation";
    this.hlc = hlcInit(deps.nodeId ?? "evaluation-engine");
  }

  /**
   * Attempt an LLM-as-judge evaluation (D3) of the trace. Returns null on any error so the
   * caller falls back to the heuristic verdict. The model receives a concise JSON prompt and
   * must respond with a JSON object scoring five standard dimensions.
   */
  private async judgeWithModel(
    trace: ReasoningTrace,
    context: ScorecardContext,
    heuristicVerdict: ScorecardVerdict,
  ): Promise<ScorecardVerdict | null> {
    if (!this.model) return null;
    const prompt = [
      "You are a cognitive evaluation judge. Score the following learning explanation on five",
      "dimensions. Respond ONLY with valid JSON matching the schema exactly — no markdown, no prose.",
      "",
      `Schema: { "dimensions": [ { "name": string, "score": number (0-1), "evidence": string } ] }`,
      `Required dimension names (exactly): explanation, application, connection, teaching, edge_case`,
      "",
      `Concept: ${context.concept_id}`,
      `Strategy: ${trace.strategy}`,
      `Task interpretation: ${trace.task_interpretation.slice(0, 400)}`,
      `Decision: ${trace.decision.slice(0, 400)}`,
      `Self-critique: ${String(trace.self_critique ?? "").slice(0, 300)}`,
      `Claims (${trace.claims.length}): ${trace.claims
        .map((c) => c.statement)
        .join("; ")
        .slice(0, 400)}`,
    ].join("\n");

    try {
      const result = await this.model.generate({
        system: "Return only valid JSON. No markdown. No explanation. No code fences.",
        prompt,
        maxTokens: 512,
      });

      const raw = result.text
        .trim()
        .replace(/^```json\s*/i, "")
        .replace(/```\s*$/, "");
      const parsed = JSON.parse(raw) as {
        dimensions: Array<{ name: string; score: number; evidence: string }>;
      };
      if (!Array.isArray(parsed.dimensions) || parsed.dimensions.length < 5) return null;

      const dimMap = new Map(parsed.dimensions.map((d) => [d.name, d]));
      const required = ["explanation", "application", "connection", "teaching", "edge_case"];
      if (!required.every((n) => dimMap.has(n))) return null;

      const dims: ScorecardDimension[] = required.map((name) => {
        const d = dimMap.get(name)!;
        const score = Math.max(0, Math.min(1, Number(d.score) || 0));
        return {
          name,
          score,
          passed: score >= EVALUATION_PASS_THRESHOLD,
          evidence: String(d.evidence ?? ""),
        };
      });
      const overall = dims.reduce((s, d) => s + d.score, 0) / dims.length;

      return {
        scorecard_id: heuristicVerdict.scorecard_id,
        concept_id: context.concept_id,
        score: overall,
        passed: overall >= EVALUATION_PASS_THRESHOLD,
        dimension_scores: dims,
        strategy: heuristicVerdict.strategy,
        determinism_level: "D3",
      };
    } catch {
      return null;
    }
  }

  /**
   * Evaluate a reasoning trace against the best-matching scorecard.
   * When a model is available, attempts D3 LLM-as-judge; falls back to D1 heuristic.
   * Emits `evaluation.reasoning.completed` on the bus.
   */
  async evaluate(trace: ReasoningTrace, context: ScorecardContext): Promise<EvaluateResult> {
    const scorecard = scorecardForTrace(trace.strategy, this.scorecards);
    if (!scorecard) {
      throw new Error(`CognitiveEvaluationEngine: no scorecard for strategy "${trace.strategy}"`);
    }

    const heuristicVerdict = scorecard.score(trace, context);
    const verdict =
      (await this.judgeWithModel(trace, context, heuristicVerdict)) ?? heuristicVerdict;

    const created = createEvent(
      {
        eventType: "evaluation.reasoning.completed",
        producerCid: this.producerCid,
        producerType: "evaluation-engine",
        payload: {
          trace_id: trace.trace_id,
          concept_id: context.concept_id,
          scorecard_id: verdict.scorecard_id,
          score: verdict.score,
          passed: verdict.passed,
          dimension_scores: verdict.dimension_scores,
          strategy: verdict.strategy,
          determinism_level: verdict.determinism_level,
        },
        classification: "internal",
        retention: "permanent",
        replayBehavior: "replayable",
      },
      {
        clock: this.clock,
        hlc: this.hlc,
        idGenerator: this.idGenerator,
      },
    );
    this.hlc = created.hlc;

    await this.bus.publish(created.event);

    const record: EvaluationRecord = {
      concept_id: context.concept_id,
      scorecard_id: verdict.scorecard_id,
      score: verdict.score,
      passed: verdict.passed,
      dimension_scores: verdict.dimension_scores,
      hlc: hlcToString(created.hlc),
    };

    return { verdict, record };
  }
}
