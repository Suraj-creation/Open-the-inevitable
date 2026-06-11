/**
 * Phase 2B acceptance — Real Cognition on the Surface.
 *
 * 1. The demo composition is deterministic under the null model.
 * 2. D3 proof: a seeded record run, replayed from its `model.output.recorded` events with the
 *    provider replaced by a tripwire, reproduces a byte-identical final frame — and the
 *    provider is never invoked during replay.
 */
import { describe, expect, test } from "vitest";
import { NullModelRuntime, RecordingModelRuntime } from "@inevitable/adapters";
import type { ModelRuntime } from "@inevitable/contracts";
import type { CognitiveEvent } from "@inevitable/protocols";
import { SeededIdGenerator } from "@inevitable/shared";
import { TextSurfaceRenderer } from "@inevitable/surface";
import { buildDemoSession, demoAsk } from "../src/wiring";

const GOAL = "Teach me Neural Networks";

function stubModel(): ModelRuntime & { calls: number } {
  const model = {
    calls: 0,
    async generate(input: { invocation_key?: string }) {
      model.calls++;
      return {
        text: JSON.stringify({
          layers: {
            layer_0: `RECORDED intuition for ${input.invocation_key ?? "?"}`,
            layer_1: "RECORDED visual model",
          },
          summary: "RECORDED summary",
          confidence: 0.77,
          reasoning: "stubbed",
        }),
        model: "stub-model",
      };
    },
    async embed() {
      return [];
    },
  };
  return model;
}

async function runSession(options: {
  seed: string;
  mode: "record" | "replay";
  inner?: ModelRuntime;
  recordings?: readonly CognitiveEvent[];
}) {
  const fixture = buildDemoSession({
    seed: options.seed,
    modelFactory: (bus, clock) =>
      new RecordingModelRuntime({
        mode: options.mode,
        bus,
        inner: options.inner,
        recordings: options.recordings,
        provider: "stub",
        clock,
        // Dedicated generator: recording-event ids never perturb the shared seeded stream,
        // keeping record and replay runs id-aligned.
        idGenerator: new SeededIdGenerator(`${options.seed}-recorder`),
      }),
  });
  await fixture.surface.start(GOAL);
  const asked = await fixture.surface.ask(demoAsk(GOAL));
  if (!asked.ok) throw asked.error;
  const explanation = asked.value.blocks.find((b) => b.block_type === "explanation")!;
  const expanded = await fixture.surface.expand(explanation.block_id, 1);
  if (!expanded.ok) throw expanded.error;
  await fixture.surface.close();
  return {
    frame: new TextSurfaceRenderer().render(fixture.surface.state()!),
    modelEvents: fixture.bus.replay({ subject: "model.>" }),
  };
}

describe("apps/cli — the first runnable surface", () => {
  test("deterministic under the null model: same seed, identical frames", async () => {
    const a = await runSession({ seed: "demo-det", mode: "record", inner: new NullModelRuntime() });
    const b = await runSession({ seed: "demo-det", mode: "record", inner: new NullModelRuntime() });
    expect(a.frame).toBe(b.frame);
    expect(a.frame).toContain("Living Timeline");
    expect(a.frame).toContain("layer_0");
  });

  test("D3: replay from recordings is byte-identical and never re-invokes the provider", async () => {
    const recorded = await runSession({ seed: "demo-d3", mode: "record", inner: stubModel() });
    expect(recorded.frame).toContain("RECORDED");
    expect(recorded.modelEvents.length).toBeGreaterThanOrEqual(3); // explanation, practice, expand

    const tripwire = stubModel();
    const replayed = await runSession({
      seed: "demo-d3",
      mode: "replay",
      inner: tripwire,
      recordings: recorded.modelEvents,
    });

    expect(replayed.frame).toBe(recorded.frame); // byte-identical surface
    expect(tripwire.calls).toBe(0); // the provider was never touched
  });
});
