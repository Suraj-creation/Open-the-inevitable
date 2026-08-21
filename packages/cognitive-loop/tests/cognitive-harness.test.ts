/**
 * The Cognitive Harness slice (spec/research/living-cognitive-agents/11 §3-6, §8): the harness is
 * composed from a CapabilityRegistry (transactionally), its composition is inspectable, capabilities
 * are pluggable, and — the constitutional invariant — every model request is reconstructable from the
 * durable log alone (the reconstruction law).
 */
import { CosError, ManualClock, SeededIdGenerator } from "@inevitable/shared";
import { describe, expect, it } from "vitest";
import {
  AdaptationGovernor,
  CapabilityRegistry,
  CognitiveHarness,
  ContextCompiler,
  DeterministicFaculty,
  InMemoryEventLog,
  InMemoryPolicyStore,
  LearnerSimulator,
  LOOP_EVENTS,
  Reflection,
  constitutionFromManifest,
  reconstructContextManifest,
  runLoop,
  type CognitiveOutput,
  type CompiledContext,
  type ContextManifest,
  type Faculty,
  type LearnerState,
  type LoopHarness,
} from "../src/index";

function fullRegistry(eventLog: InMemoryEventLog = new InMemoryEventLog()): CapabilityRegistry {
  return new CapabilityRegistry()
    .provide("compiler", new ContextCompiler())
    .provide("faculty", new DeterministicFaculty())
    .provide("reflection", new Reflection())
    .provide("governor", new AdaptationGovernor())
    .provide("policies", new InMemoryPolicyStore())
    .provide("eventLog", eventLog);
}

describe("Cognitive Harness — composition, inspectability, reconstruction (11 §3-6, §8)", () => {
  it("composes from the registry and describes its wiring (composition is inspectable)", () => {
    const harness = new CognitiveHarness(
      fullRegistry(),
      new ManualClock(0),
      new SeededIdGenerator("h"),
      "agent.explanation",
    );
    const manifest = harness.describe();

    expect(manifest.capabilities.map((c) => c.key).sort()).toEqual([
      "compiler",
      "eventLog",
      "faculty",
      "governor",
      "policies",
      "reflection",
    ]);
    // The protected kernel seams are marked as such.
    expect(manifest.protected_seams.slice().sort()).toEqual(["eventLog", "governor"]);
    // The concrete impl wired for each seam is visible ("what environment was this process given?").
    expect(manifest.capabilities.find((c) => c.key === "faculty")?.impl).toBe(
      "DeterministicFaculty",
    );
  });

  it("composition is transactional: a missing protected seam throws (rollback), never publishes", () => {
    // governor + eventLog (both PROTECTED) omitted.
    const registry = new CapabilityRegistry()
      .provide("compiler", new ContextCompiler())
      .provide("faculty", new DeterministicFaculty())
      .provide("reflection", new Reflection())
      .provide("policies", new InMemoryPolicyStore());
    expect(
      () =>
        new CognitiveHarness(registry, new ManualClock(0), new SeededIdGenerator("h"), "agent.x"),
    ).toThrow(CosError);
  });

  it("a capability is pluggable: swapping the faculty flows through composition", () => {
    class EchoFaculty implements Faculty {
      execute(compiled: CompiledContext): Promise<CognitiveOutput> {
        return Promise.resolve({ strategy: compiled.strategy, content: "echo", confidence: 0.9 });
      }
    }
    const harness = new CognitiveHarness(
      fullRegistry().provide("faculty", new EchoFaculty()),
      new ManualClock(0),
      new SeededIdGenerator("h"),
      "agent.x",
    );
    expect(harness.describe().capabilities.find((c) => c.key === "faculty")?.impl).toBe(
      "EchoFaculty",
    );
  });

  it("reconstruction law: every model request is reconstructable from the log alone", async () => {
    const eventLog = new InMemoryEventLog();
    const harness = new CognitiveHarness(
      fullRegistry(eventLog),
      new ManualClock(1_700_000_000_000),
      new SeededIdGenerator("h"),
      "agent.explanation",
    );
    const constitution = constitutionFromManifest({ id: "agent.explanation", role: "Explains." });
    const learner: LearnerState = { learner_cid: "cog-l", known_concepts: [], level: 0.3 };
    const loopHarness: LoopHarness = {
      constitution,
      learner,
      deps: harness.deps(new LearnerSimulator("visual-first")),
    };

    await runLoop(
      loopHarness,
      (i) => ({
        task_id: `t-${i}`,
        concept_id: "photosynthesis",
        concept_title: "Photosynthesis",
        intent: "learn",
      }),
      { episodes: 3, explorationRounds: 1 },
    );

    const compiledEvents = eventLog
      .all()
      .filter((e) => e.event_type === LOOP_EVENTS.contextCompiled);
    expect(compiledEvents.length).toBe(3);

    // Take a real request id from a compiled event, then reconstruct its manifest from the log alone.
    const firstPayload = compiledEvents[0]?.payload as Record<string, unknown>;
    const embedded = firstPayload["manifest"] as ContextManifest;
    const reconstructed = reconstructContextManifest(eventLog, embedded.request_id);

    expect(reconstructed).not.toBeNull();
    // The manifest answers "why did the model see this?": instructions, policy, capabilities, budget.
    expect(reconstructed?.system_sections.length).toBeGreaterThan(0);
    expect(reconstructed?.constitution_version).toBe(1);
    expect(reconstructed?.policy_ref).toContain("cog://policy/");
    expect(reconstructed?.capability_manifest).toContain("faculty");
    expect(reconstructed?.cognitive_object_refs).toContain(embedded.policy_ref);
  });
});
