/**
 * The loop driver and the four L2 measurements (§11.5). `runLoop` seeds the Adaptive Policy once,
 * then runs N episodes — round-robin exploration for the first few so every strategy gathers evidence,
 * then exploitation of the policy argmax. The helpers below compute the gate's four measurements from
 * the returned scores and the durable event log:
 *
 *   A. longitudinal  — lastWindowMean > firstWindowMean (same learner improves)
 *   B. transfer      — a policy learned on one concept helps a novel related concept (test-composed)
 *   C. replay        — reconstructChain walks an accepted change back to its causing outcome
 *   D. ablation      — adaptation-on final window beats an identical adaptation-off run
 */
import { policyRef, seedPolicy } from "./adaptive-policy";
import type { AdaptivePolicy } from "./adaptive-policy";
import type { Constitution } from "./constitution";
import { EXPLANATION_STRATEGIES } from "./constitution";
import type { CognitiveTask, LearnerState } from "./context-compiler";
import type { CognitiveEvent } from "@inevitable/protocols";
import { LOOP_EVENTS } from "./events";
import type { CognitiveEventLog } from "./events";
import { runEpisode } from "./episode";
import type { EpisodeDeps, EpisodeRecord } from "./episode";

export interface LoopConfig {
  readonly episodes: number;
  /** Rounds of round-robin exploration; the first `explorationRounds * |strategies|` episodes explore. */
  readonly explorationRounds: number;
  /** When true, accepted policies are not persisted — the adaptation-off ablation baseline. */
  readonly freezePolicy?: boolean;
}

export interface LoopHarness {
  readonly constitution: Constitution;
  readonly learner: LearnerState;
  readonly deps: EpisodeDeps;
}

export interface LoopResult {
  readonly records: readonly EpisodeRecord[];
  readonly finalPolicy: AdaptivePolicy;
  readonly scores: readonly number[];
}

export async function runLoop(
  harness: LoopHarness,
  taskFor: (episodeIndex: number) => CognitiveTask,
  config: LoopConfig,
): Promise<LoopResult> {
  const { constitution, learner, deps } = harness;
  const ref = policyRef(constitution.agent_id, learner.learner_cid);
  if (!deps.policies.get(ref)) {
    deps.policies.put(
      seedPolicy(constitution.agent_id, learner.learner_cid, constitution.constitution_id),
    );
  }

  const strategies = EXPLANATION_STRATEGIES;
  const exploreUntil = config.explorationRounds * strategies.length;
  const records: EpisodeRecord[] = [];
  const scores: number[] = [];

  for (let i = 0; i < config.episodes; i += 1) {
    const base = taskFor(i);
    const explore = i < exploreUntil ? strategies[i % strategies.length] : undefined;
    const task: CognitiveTask = explore ? { ...base, explore_strategy: explore } : base;
    const record = await runEpisode(deps, {
      episodeIndex: i,
      constitution,
      learner,
      task,
      freezePolicy: config.freezePolicy ?? false,
    });
    records.push(record);
    scores.push(record.assessment.score);
  }

  const finalPolicy = deps.policies.get(ref);
  if (!finalPolicy) {
    // Unreachable: seeded above. Guarded for the type system.
    throw new Error(`policy vanished at ${ref}`);
  }
  return { records, finalPolicy, scores };
}

// ---------------------------------------------------------------------------
// Measurement helpers
// ---------------------------------------------------------------------------

export function windowMean(scores: readonly number[], from: number, count: number): number {
  const slice = scores.slice(from, from + count);
  if (slice.length === 0) return 0;
  return slice.reduce((a, b) => a + b, 0) / slice.length;
}

export function firstWindowMean(scores: readonly number[], window: number): number {
  return windowMean(scores, 0, window);
}

export function lastWindowMean(scores: readonly number[], window: number): number {
  return windowMean(scores, Math.max(0, scores.length - window), window);
}

/** Metric A: net gain from the first window to the last window of a single run. */
export function longitudinalGain(scores: readonly number[], window: number): number {
  return lastWindowMean(scores, window) - firstWindowMean(scores, window);
}

/** Metric D: how much the adaptation-on final window beats the adaptation-off baseline. */
export function ablationGap(
  onScores: readonly number[],
  offScores: readonly number[],
  window: number,
): number {
  return lastWindowMean(onScores, window) - lastWindowMean(offScores, window);
}

// ---------------------------------------------------------------------------
// Metric C — replay / attribution
// ---------------------------------------------------------------------------

export interface CausalChain {
  readonly accepted: CognitiveEvent;
  readonly proposed: CognitiveEvent;
  readonly reflection: CognitiveEvent;
  readonly outcome: CognitiveEvent;
  readonly output: CognitiveEvent;
  readonly compiled: CognitiveEvent;
  readonly started: CognitiveEvent;
}

/**
 * Reconstruct — from the event log alone — WHY a policy change happened: walk `causation_id` back from
 * an accepted-policy event through proposal → reflection → outcome → output → compiled → episode.
 * Returns null if any link is missing or mistyped, which is itself the attribution guarantee.
 */
export function reconstructChain(
  log: CognitiveEventLog,
  acceptedEventId: string,
): CausalChain | null {
  const byId = new Map<string, CognitiveEvent>(log.all().map((e) => [e.event_id, e]));
  const accepted = byId.get(acceptedEventId);
  if (!accepted || accepted.event_type !== LOOP_EVENTS.policyAccepted) return null;

  const proposed = parentOfType(byId, accepted, LOOP_EVENTS.policyProposed);
  const reflection = proposed && parentOfType(byId, proposed, LOOP_EVENTS.reflectionRecorded);
  const outcome = reflection && parentOfType(byId, reflection, LOOP_EVENTS.outcomeObserved);
  const output = outcome && parentOfType(byId, outcome, LOOP_EVENTS.outputProduced);
  const compiled = output && parentOfType(byId, output, LOOP_EVENTS.contextCompiled);
  const started = compiled && parentOfType(byId, compiled, LOOP_EVENTS.episodeStarted);

  if (!proposed || !reflection || !outcome || !output || !compiled || !started) return null;
  return { accepted, proposed, reflection, outcome, output, compiled, started };
}

function parentOfType(
  byId: Map<string, CognitiveEvent>,
  child: CognitiveEvent,
  expectedType: string,
): CognitiveEvent | null {
  const pid = child.causation_id;
  if (!pid) return null;
  const parent = byId.get(pid);
  return parent && parent.event_type === expectedType ? parent : null;
}
