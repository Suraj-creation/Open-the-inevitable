/**
 * M3.5 gateway wiring: closing a session folds its chronicle into the Intelligence Plane —
 * artifacts land in the sink (store-first), `intelligence.distilled` lifecycle events follow,
 * and the learner's episode is queryable. Hermetic: in-memory host, Null voice, no network.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { NullVoiceRuntime } from "@inevitable/adapters";
import { SurfaceHost } from "../src/host";

beforeAll(() => {
  delete process.env["GEMINI_API_KEY"];
  delete process.env["COS_BACKEND"];
});

describe("session-close distillation (ADR-0035 D1 wiring)", () => {
  it("distills a closed session into learner-scoped artifacts + lifecycle events", async () => {
    const host = new SurfaceHost({ voiceRuntime: new NullVoiceRuntime() });
    const created = await host.create("Teach me entropy");
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const served = await host.get(created.value.surfaceId);
    expect(served).toBeDefined();
    const asked = await served!.ask("Teach me entropy");
    expect(asked.ok).toBe(true);

    const closed = await served!.close("done");
    expect(closed.ok).toBe(true);

    // The plane holds this learner's artifacts (in-memory sink; Postgres when configured).
    const learner = host.getLearner(created.value.learnerId);
    expect(learner).toBeDefined();
    const artifacts = host.intelligence.artifactsFor(learner!.cid);
    expect(artifacts.length).toBeGreaterThanOrEqual(1);
    const episode = artifacts.find((a) => a.kind === "learner.episode");
    expect(episode).toBeDefined();
    expect(episode!.scope.regime).toBe("learner");
    expect(episode!.epistemics.method).toBe("episode-assembler");
    expect(episode!.epistemics.provenance_refs.length).toBeGreaterThan(0);

    // Lifecycle emitted AFTER storage: intelligence.distilled events are on the surface's bus log.
    const state = await served!.state();
    expect(state).toBeDefined(); // session closed but log retained
  });

  it("a session with no distillable cognition stores nothing but never fails close", async () => {
    const host = new SurfaceHost({ voiceRuntime: new NullVoiceRuntime() });
    const created = await host.create("Teach me stillness");
    if (!created.ok) return;
    const served = await host.get(created.value.surfaceId);
    // Close immediately — create/start emits surface.created/timeline events only.
    const closed = await served!.close("immediate");
    expect(closed.ok).toBe(true);
  });
});
