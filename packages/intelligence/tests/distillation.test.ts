/**
 * M3.5 — distillation of a synthetic chronicle into the Intelligence Plane. Covers the seven
 * registry-v1 distillers, the governance guards (opt-out, cohort minimum, admission law), the
 * deletion cascade, lifecycle emission, and the plane RE-DERIVATION DRILL (same chronicle + same
 * seeds ⇒ byte-identical artifacts — the recovery property the whole layer rests on).
 */
import { describe, expect, it } from "vitest";
import { InMemoryEventBus, createEvent } from "@inevitable/events";
import type { CognitiveEvent } from "@inevitable/protocols";
import { ManualClock, SeededIdGenerator, hlcInit, type Hlc } from "@inevitable/shared";
import {
  INTELLIGENCE_EVENT_TYPES,
  REGISTRY_V1,
  distillSession,
  emitDistilled,
  redactLearnerArtifacts,
  type Distiller,
} from "../src/index";

function buildChronicle(): CognitiveEvent[] {
  const clock = new ManualClock(Date.UTC(2026, 6, 10));
  const idGenerator = new SeededIdGenerator("chronicle-fixture");
  let hlc: Hlc = hlcInit("fixture");
  const events: CognitiveEvent[] = [];
  const emit = (eventType: string, payload: Record<string, unknown>): void => {
    const created = createEvent(
      { eventType, producerCid: "cog-fixture", producerType: "test", payload },
      { clock, hlc, idGenerator },
    );
    hlc = created.hlc;
    events.push(created.event);
  };

  emit("surface.frame.composed", { concept_id: "entropy", frame_id: "frame-1" });
  emit("source.version.registered", { version_id: "srcv-thermo", source_id: "src-thermo" });
  emit("surface.interaction.received", { kind: "request_depth", target_id: "frame-1" });
  emit("surface.image.decided", { frame_id: "frame-1", helps: true, concept_id: "entropy" });
  emit("surface.assessment.gate.evaluated", { concept_id: "entropy", passed: false });
  emit("surface.prerequisite.descent.completed", { concept_id: "entropy" });
  emit("surface.assessment.gate.evaluated", { concept_id: "entropy", passed: true });
  emit("reasoning.trace.recorded", {
    agent_id: "explanation",
    packet_id: "pkt-1",
    trace: {
      strategy: "intuition-first",
      decision: "microstates analogy",
      self_critique: null,
      uncertainty_estimate: 0.1,
    },
  });
  emit("surface.evaluation.recorded", { concept_id: "entropy", score: 0.9, passed: true });
  emit("surface.proposal.proposed", {
    topic: "entropy",
    agent_id: "explanation",
    proposal_id: "p1",
  });
  emit("surface.proposal.proposed", { topic: "entropy", agent_id: "revision", proposal_id: "p2" });
  emit("surface.agent.disagreed", { topic: "entropy", agent_cids: ["a", "b"] });
  emit("surface.synthesis.recorded", { topic: "entropy", chosen_proposal_ids: ["p1"] });
  emit("memory.mutation.committed", { mutation_id: "mut-1", memory_layer: "episodic" });
  return events;
}

const CTX = { learner_cid: "cog-learner-1", tenant_id: "default", session_id: "session-1" };

function distill(events: readonly CognitiveEvent[]) {
  return distillSession({
    events,
    ctx: CTX,
    clock: new ManualClock(Date.UTC(2026, 6, 10)),
    idGenerator: new SeededIdGenerator("distill-seed"),
    nodeId: "test",
  });
}

describe("registry v1 distillers", () => {
  const chronicle = buildChronicle();
  const { artifacts } = distill(chronicle);
  const byKind = (kind: string) => artifacts.filter((a) => a.kind === kind);

  it("assembles an episode with confusions, interventions, and concept/source refs", () => {
    const [episode] = byKind("learner.episode");
    expect(episode).toBeDefined();
    const body = episode!.body as {
      concept_refs: string[];
      source_refs: string[];
      confusions: Array<{ state: string }>;
      interventions: unknown[];
    };
    expect(body.concept_refs).toContain("entropy");
    expect(body.source_refs).toContain("srcv-thermo");
    expect(body.confusions.map((c) => c.state).sort()).toEqual(["open", "resolved"]);
    expect(body.interventions.length).toBeGreaterThanOrEqual(1);
    expect(episode!.scope.regime).toBe("learner");
    expect(episode!.scope.learner_cid).toBe("cog-learner-1");
    expect(episode!.epistemics.provenance_refs.length).toBeGreaterThan(3);
  });

  it("derives an understanding delta with movements and resolved confusions", () => {
    const [delta] = byKind("learner.understanding-delta");
    const body = delta!.body as {
      concepts_touched: string[];
      mastery_movements: Array<{ direction: string }>;
      confusions_resolved: string[];
    };
    expect(body.concepts_touched).toEqual(["entropy"]);
    expect(body.mastery_movements.some((m) => m.direction === "advanced")).toBe(true);
    expect(body.confusions_resolved).toEqual(["entropy"]);
  });

  it("tracks the misconception life-story: failed, then corrected, no recurrence", () => {
    const [misconception] = byKind("learner.misconception");
    expect(misconception!.body).toMatchObject({
      concept_ref: "entropy",
      occurrences: 1,
      corrected: true,
      recurrence: false,
    });
  });

  it("pairs interventions with the outcome the next gate showed", () => {
    const outcomes = byKind("pedagogy.intervention-outcome");
    expect(outcomes.length).toBeGreaterThanOrEqual(1);
    // The image decision preceded a FAILED gate first: honest "insufficient".
    expect(outcomes[0]!.body["outcome"]).toBe("insufficient");
  });

  it("joins reasoning traces with evaluation into strategy outcomes (C1 pays off)", () => {
    const [strategy] = byKind("agent.strategy-outcome");
    expect(strategy!.body).toMatchObject({
      agent_id: "explanation",
      strategy: "intuition-first",
      decision: "microstates analogy",
      evaluation_score: 0.9,
    });
  });

  it("records ensemble collaboration per topic", () => {
    const [collab] = byKind("agent.collaboration");
    expect(collab!.body).toMatchObject({
      topic: "entropy",
      proposal_count: 2,
      disagreements: 1,
      synthesized: true,
    });
  });

  it("nominates episodic mutations for consolidation", () => {
    const [candidate] = byKind("learner.consolidation-candidate");
    expect(candidate!.body["mutation_ids"]).toEqual(["mut-1"]);
  });
});

describe("the plane re-derivation drill (V)", () => {
  it("same chronicle + same seeds ⇒ byte-identical artifacts, twice", () => {
    const chronicle = buildChronicle();
    const first = distill(chronicle);
    const second = distill(chronicle);
    expect(second.artifacts).toEqual(first.artifacts);
    expect(first.artifacts.length).toBeGreaterThanOrEqual(6);
  });
});

describe("governance (G1)", () => {
  const chronicle = buildChronicle();

  it("learner opt-out skips every learner-regime distiller — reported, not silent", () => {
    const result = distillSession({
      events: chronicle,
      ctx: CTX,
      governance: { learnerOptedOut: true },
    });
    expect(result.artifacts).toHaveLength(0);
    expect(result.skipped.length).toBe(REGISTRY_V1.length);
    expect(result.skipped.every((s) => s.reason === "learner opt-out")).toBe(true);
  });

  it("shared-regime kinds are refused without a cohort guard (safe default)", () => {
    const sharedDistiller: Distiller = {
      distiller_id: "shared-test",
      method_version: "1.0.0",
      regime: "shared",
      run: () => [
        {
          kind: "pedagogy.intervention-outcome",
          body: { aggregate: true },
          confidence: 0.9,
          provenance: ["evt-x"],
          consumers: ["evolution-evidence"],
        },
      ],
    };
    const refused = distillSession({ events: chronicle, ctx: CTX, registry: [sharedDistiller] });
    expect(refused.artifacts).toHaveLength(0);
    expect(refused.skipped[0]?.reason).toMatch(/no cohort guard/);

    const belowMinimum = distillSession({
      events: chronicle,
      ctx: CTX,
      registry: [sharedDistiller],
      governance: { cohortMet: () => false },
    });
    expect(belowMinimum.artifacts).toHaveLength(0);
    expect(belowMinimum.skipped[0]?.reason).toMatch(/cohort minimum/);

    const met = distillSession({
      events: chronicle,
      ctx: CTX,
      registry: [sharedDistiller],
      governance: { cohortMet: () => true },
    });
    expect(met.artifacts).toHaveLength(1);
    expect(met.artifacts[0]?.scope.learner_cid).toBeNull(); // shared regime carries no learner
  });

  it("the admission law drops distillates with no named consumer", () => {
    const consumerless: Distiller = {
      distiller_id: "consumerless",
      method_version: "1.0.0",
      regime: "learner",
      run: () => [
        {
          kind: "learner.episode",
          body: {},
          confidence: 1,
          provenance: ["evt-y"],
          consumers: [],
        },
      ],
    };
    const result = distillSession({ events: chronicle, ctx: CTX, registry: [consumerless] });
    expect(result.artifacts).toHaveLength(0);
    expect(result.skipped[0]?.reason).toBe("no named consumer");
  });

  it("the deletion cascade removes every learner artifact, keeps shared", () => {
    const { artifacts } = distill(chronicle);
    const survivors = redactLearnerArtifacts(artifacts, "cog-learner-1");
    expect(survivors).toHaveLength(0); // registry v1 is all learner-scoped
    const untouched = redactLearnerArtifacts(artifacts, "cog-someone-else");
    expect(untouched).toEqual(artifacts);
  });
});

describe("lifecycle emission", () => {
  it("publishes intelligence.distilled per artifact on the bus (family registered)", async () => {
    const chronicle = buildChronicle();
    const { artifacts } = distill(chronicle);
    const idGenerator = new SeededIdGenerator("emit-seed");
    const bus = new InMemoryEventBus({ idGenerator });
    await emitDistilled(bus, artifacts, {
      clock: new ManualClock(Date.UTC(2026, 6, 10)),
      idGenerator,
      nodeId: "test",
    });
    const distilled = bus.log.filter((e) => e.event_type === INTELLIGENCE_EVENT_TYPES.distilled);
    expect(distilled).toHaveLength(artifacts.length);
    const payload = distilled[0]?.payload as Record<string, unknown>;
    expect(payload["method_version"]).toBe("1.0.0");
    expect(typeof payload["provenance_count"]).toBe("number");
  });
});
