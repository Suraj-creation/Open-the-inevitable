import { afterEach, beforeAll, describe, expect, test } from "vitest";
import { type AddressInfo } from "node:net";
import { type Server } from "node:http";
import type { CognitiveEvent } from "@inevitable/protocols";
import { foldSurfaceEvents } from "@inevitable/surface";
import { ok, type Result, type CosError } from "@inevitable/shared";
import { createGatewayServer } from "../src/server";
import { SurfaceHost } from "../src/host";
import type { WebFetchResult } from "../src/crawler";

// Keep the suite hermetic + deterministic: never let an ambient Gemini key turn these into live
// network calls. The host resolves the model from the environment (apps/api/src/host.ts).
beforeAll(() => {
  delete process.env["GEMINI_API_KEY"];
});

// ---------------------------------------------------------------------------
// Harness — start the gateway on an ephemeral port, drive it over real HTTP.
// ---------------------------------------------------------------------------

let active: Server | null = null;

afterEach(async () => {
  if (active) await new Promise<void>((resolve) => active!.close(() => resolve()));
  active = null;
});

function start(): Promise<string> {
  const server = createGatewayServer();
  active = server;
  return new Promise((resolve) => {
    server.listen(0, () => {
      const { port } = server.address() as AddressInfo;
      resolve(`http://127.0.0.1:${port}`);
    });
  });
}

/** Start a gateway with an injected fake web-fetch so crawl tests stay hermetic (no network). */
function startWithCrawler(
  fetchFake: (url: URL) => Promise<Result<WebFetchResult, CosError>>,
): Promise<string> {
  const host = new SurfaceHost({ webFetch: fetchFake });
  const server = createGatewayServer(host);
  active = server;
  return new Promise((resolve) => {
    server.listen(0, () => {
      const { port } = server.address() as AddressInfo;
      resolve(`http://127.0.0.1:${port}`);
    });
  });
}

async function createSurface(base: string, body: Record<string, unknown>): Promise<string> {
  const res = await fetch(`${base}/api/surface`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as { ok: boolean; surface_id: string };
  expect(json.ok).toBe(true);
  return json.surface_id;
}

async function command(base: string, id: string, cmd: Record<string, unknown>): Promise<Response> {
  return fetch(`${base}/api/surface/${id}/command`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cmd),
  });
}

/** Read the SSE stream, parsing frames until `predicate` is satisfied, then close it. */
async function readStream(
  url: string,
  headers: Record<string, string>,
  predicate: (events: CognitiveEvent[], snapshotComplete: boolean) => boolean,
): Promise<CognitiveEvent[]> {
  const res = await fetch(url, { headers });
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  const events: CognitiveEvent[] = [];
  let buffer = "";
  let snapshotComplete = false;

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf("\n\n")) >= 0) {
      const frame = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      if (frame.startsWith(":")) {
        if (frame.includes("snapshot-complete")) snapshotComplete = true;
        continue;
      }
      const dataLine = frame.split("\n").find((l) => l.startsWith("data:"));
      if (dataLine) events.push(JSON.parse(dataLine.slice(5).trim()) as CognitiveEvent);
    }
    if (predicate(events, snapshotComplete)) {
      await reader.cancel();
      break;
    }
  }
  return events;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Surface Gateway — the visible-surface boundary (SRF-005)", () => {
  test("streamed snapshot folds to exactly the server's SurfaceState (replay equivalence)", async () => {
    const base = await start();
    const id = await createSurface(base, { goal: "Teach me Neural Networks", seed: "test-equiv" });
    const asked = await command(base, id, { type: "ask", goal: "Teach me Neural Networks" });
    expect(asked.status).toBe(200);

    const events = await readStream(`${base}/api/surface/${id}/stream`, {}, (_e, snap) => snap);
    expect(events.length).toBeGreaterThan(0);
    expect(events[0]?.event_type).toBe("surface.created");

    // The client fold of the streamed log == the server's canonical state.
    const clientState = foldSurfaceEvents(events);
    const stateRes = await fetch(`${base}/api/surface/${id}/state`);
    const { state: serverState } = (await stateRes.json()) as { state: unknown };
    expect(clientState).toEqual(serverState);

    // Cognition is visible: a Cognitive Frame was composed (UCS, ADR-0030) and the timeline exists.
    expect(clientState?.timeline).not.toBeNull();
    expect(clientState?.frames.some((f) => f.status === "composed")).toBe(true);
    // The teaching is a SEPARATE narration script, not prose on the board.
    expect(clientState?.narration_scripts.length ?? 0).toBeGreaterThan(0);
    expect(clientState?.blocks.some((b) => b.block_type === "explanation")).toBe(false);
  });

  test("SSE frames arrive in strict bus-sequence order", async () => {
    const base = await start();
    const id = await createSurface(base, { goal: "Teach me Neural Networks", seed: "test-order" });
    await command(base, id, { type: "ask", goal: "Teach me Neural Networks" });

    const events = await readStream(`${base}/api/surface/${id}/stream`, {}, (_e, snap) => snap);
    const sequences = events.map((e) => e.sequence ?? 0);
    const sorted = [...sequences].sort((a, b) => a - b);
    expect(sequences).toEqual(sorted);
    expect(new Set(sequences).size).toBe(sequences.length); // no duplicates
  });

  test("Last-Event-ID resumes from sequence with no gaps or duplicates", async () => {
    const base = await start();
    const id = await createSurface(base, { goal: "Teach me Neural Networks", seed: "test-resume" });
    await command(base, id, { type: "ask", goal: "Teach me Neural Networks" });

    const full = await readStream(`${base}/api/surface/${id}/stream`, {}, (_e, snap) => snap);
    const midpoint = full[Math.floor(full.length / 2)]!.sequence ?? 0;

    const resumed = await readStream(
      `${base}/api/surface/${id}/stream`,
      { "Last-Event-ID": String(midpoint) },
      (_e, snap) => snap,
    );
    // Every resumed event is strictly after the cursor; none before is replayed.
    expect(resumed.every((e) => (e.sequence ?? 0) > midpoint)).toBe(true);
    // Resume + cursor prefix reconstructs the full log exactly.
    const prefix = full.filter((e) => (e.sequence ?? 0) <= midpoint);
    expect([...prefix, ...resumed].map((e) => e.sequence)).toEqual(full.map((e) => e.sequence));
  });

  test("a live command's effects arrive as ordinary frames after the snapshot", async () => {
    const base = await start();
    const id = await createSurface(base, { goal: "Teach me Neural Networks", seed: "test-live" });

    // Open the stream first, then issue the ask; its effects — including the composed Cognitive
    // Frame and its narration — must arrive live as ordinary frames after the snapshot (UCS).
    // Wait for the narration script, which the ordering law places AFTER frame.composed — so reaching
    // it guarantees the composed frame was already streamed (avoids cancelling the read too early).
    const streamPromise = readStream(`${base}/api/surface/${id}/stream`, {}, (events) =>
      events.some((e) => e.event_type === "surface.narration.script.produced"),
    );
    // Give the snapshot a tick, then drive cognition.
    await new Promise((r) => setTimeout(r, 25));
    const asked = await command(base, id, { type: "ask", goal: "Teach me Neural Networks" });
    expect(asked.status).toBe(200);

    const events = await streamPromise;
    expect(events.some((e) => e.event_type === "surface.frame.composed")).toBe(true);
    expect(events.some((e) => e.event_type === "surface.narration.script.produced")).toBe(true);
  });

  test("the boundary is governed: an untrusted session produces zero agent blocks", async () => {
    const base = await start();
    const id = await createSurface(base, {
      goal: "Teach me Neural Networks",
      seed: "test-gov",
      trustLevel: 0,
    });
    // Curriculum generation is the first governed dispatch (a privileged agent, GOV-P01 trust ≥ 3).
    // An untrusted learner is blocked at the boundary, so the ask never produces agent cognition.
    // The invariant — never the HTTP code — is what matters: zero agent blocks reach the surface.
    const asked = await command(base, id, { type: "ask", goal: "Teach me Neural Networks" });
    expect(asked.ok).toBe(false);

    const stateRes = await fetch(`${base}/api/surface/${id}/state`);
    const { state } = (await stateRes.json()) as {
      state: { blocks: { block_type: string }[] };
    };
    const agentBlocks = state.blocks.filter(
      (b) => b.block_type === "explanation" || b.block_type === "practice",
    );
    expect(agentBlocks.length).toBe(0);
  });

  test("advance teaches the next concept on the SAME path (continuity, no curriculum regen)", async () => {
    const base = await start();
    const id = await createSurface(base, {
      goal: "Teach me Neural Networks",
      seed: "test-advance",
    });
    await command(base, id, { type: "ask", goal: "Teach me Neural Networks" });

    const readState = async (): Promise<{
      frames: { title: string; concept_id: string | null }[];
      timeline: { nodes: { concept_id: string }[] } | null;
    }> => {
      const res = await fetch(`${base}/api/surface/${id}/state`);
      const json = (await res.json()) as {
        state: {
          frames: { title: string; concept_id: string | null }[];
          timeline: { nodes: { concept_id: string }[] } | null;
        };
      };
      return json.state;
    };

    const before = await readState();
    const conceptsBefore = (before.timeline?.nodes ?? []).map((n) => n.concept_id);
    const framesBefore = before.frames.length;
    expect(conceptsBefore.length).toBeGreaterThan(1); // a multi-concept path exists

    // Advance to the next concept — no goal, no curriculum regeneration.
    const advanced = await command(base, id, { type: "advance" });
    expect(advanced.status).toBe(200);

    const after = await readState();
    const conceptsAfter = (after.timeline?.nodes ?? []).map((n) => n.concept_id);
    // The path is PRESERVED (same concept ids, same order) — understanding compounds, never restarts.
    expect(conceptsAfter).toEqual(conceptsBefore);
    // New frames were composed for the next concept (the lesson continued).
    expect(after.frames.length).toBeGreaterThan(framesBefore);
    // A frame now teaches a DIFFERENT concept than the first (the focus moved forward on the path).
    const taughtConcepts = new Set(after.frames.map((f) => f.concept_id));
    expect(taughtConcepts.size).toBeGreaterThan(1);
  });

  test("a learner answer is graded into an honest assessment frame (F14 — earned, never fabricated)", async () => {
    const base = await start();
    const id = await createSurface(base, { goal: "Teach me Neural Networks", seed: "test-answer" });
    await command(base, id, { type: "ask", goal: "Teach me Neural Networks" });

    const stateBefore = await fetch(`${base}/api/surface/${id}/state`);
    const before = ((await stateBefore.json()) as { state: { concepts?: unknown } }).state as {
      timeline: { nodes: { concept_id: string }[] } | null;
    };
    const conceptId = before.timeline?.nodes?.[0]?.concept_id;
    expect(typeof conceptId).toBe("string");

    // The learner answers the practice problem — a genuine interaction that gets graded.
    const answered = await command(base, id, {
      type: "answer",
      concept_id: conceptId!,
      text: "A neuron sums weighted inputs and fires when the total passes the bias threshold.",
    });
    expect(answered.status).toBe(200);

    const res = await fetch(`${base}/api/surface/${id}/state`);
    const state = ((await res.json()) as { state: unknown }).state as {
      frames: { title: string }[];
      interactions: { kind?: string }[];
      depth_gates: unknown[];
    };
    // The answer was recorded as a genuine learner interaction.
    expect(state.interactions.some((i) => i.kind === "answer")).toBe(true);
    // An honest assessment frame closed the loop (offline: ungraded, but never a fabricated pass).
    expect(state.frames.some((f) => f.title.startsWith("Assessment —"))).toBe(true);
    // A gate was evaluated from the real answer (not auto-granted at ask time).
    expect(state.depth_gates.length).toBeGreaterThan(0);
  });

  test("CSE M5: a bound source projects into taught frames — viewports, highlights, attention contract", async () => {
    const base = await start();

    // 1. Register + canonicalize a markdown source (structural layer + anchor index = usable).
    const md = [
      "# Neural Networks: A Field Guide",
      "",
      "A neural network is a composition of simple units whose weights are learned from data.",
      "",
      "Training neural networks means adjusting weights so the network's predictions improve.",
      "",
      "## History",
      "",
      "The perceptron began the story in 1958.",
    ].join("\n");
    const upload = await fetch(
      `${base}/api/sources?modality=markdown&title=${encodeURIComponent("Neural Networks Field Guide")}`,
      { method: "POST", body: md },
    );
    expect(upload.status).toBe(201);
    const { source } = (await upload.json()) as {
      source: {
        source_id: string;
        source_version_id: string;
        content_hash: string;
        usable: boolean;
        layers_available: string[];
      };
    };
    expect(source.usable).toBe(true);
    expect(source.layers_available).toContain("structural");

    // 2. The content route serves the canonical bytes; X-Content-Hash is the fidelity proof
    //    (ADR-0036 — the client can hash what it fetched and compare).
    const content = await fetch(`${base}/api/sources/${source.source_version_id}/content`);
    expect(content.status).toBe(200);
    expect(content.headers.get("x-content-hash")).toBe(source.content_hash);
    expect(await content.text()).toBe(md);

    // 3. Bind the source to a surface, then ask. Attach-before-ask: the evidence seam reads the
    //    bindings at frame-composition time.
    const id = await createSurface(base, { goal: "Teach me Neural Networks", seed: "test-source" });
    const attach = await fetch(`${base}/api/surface/${id}/sources`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source_version_id: source.source_version_id }),
    });
    expect(attach.status).toBe(200);
    await command(base, id, { type: "ask", goal: "Teach me Neural Networks" });

    // 4. The folded state carries the whole projection chain (SRF-002 1.6.0 fold slices).
    const res = await fetch(`${base}/api/surface/${id}/state`);
    const state = ((await res.json()) as { state: unknown }).state as {
      sources: { source_version_id: string; modality: string; title: string }[];
      viewport_plans: {
        frame_id: string;
        viewports: { emphasis: string; region: { quote: string } }[];
      }[];
      viewport_changes: { cause: string }[];
      source_highlights: {
        amplitude: string;
        provenance_class: string;
        frame_id: string;
        cleared: boolean;
      }[];
      sync_bindings: {
        frame_id: string;
        bindings: { segment_id: string; viewport_ref: string | null }[];
      }[];
      narration_scripts: { frame_id: string; segments: { segment_id: string }[] }[];
      frames: {
        frame_id: string;
        mccr: { source_viewport: { content: { kind: string; quote: string } } | null } | null;
      }[];
    };

    // The binding is canonical state.
    expect(state.sources).toHaveLength(1);
    expect(state.sources[0]?.modality).toBe("markdown");

    // Viewport plans landed for taught frames; the focus viewport quotes the actual source.
    expect(state.viewport_plans.length).toBeGreaterThan(0);
    const plan = state.viewport_plans[0]!;
    expect(plan.viewports[0]?.emphasis).toBe("focus");
    expect(plan.viewports[0]?.region.quote.toLowerCase()).toContain("neural");

    // Semantic highlights: evidence provenance, exactly one focal per frame (CSE-008 §5.2).
    expect(state.source_highlights.length).toBeGreaterThan(0);
    expect(state.source_highlights.every((h) => h.provenance_class === "evidence")).toBe(true);
    const focalByFrame = new Map<string, number>();
    for (const h of state.source_highlights) {
      if (h.amplitude === "focal") {
        focalByFrame.set(h.frame_id, (focalByFrame.get(h.frame_id) ?? 0) + 1);
      }
    }
    expect([...focalByFrame.values()].every((n) => n === 1)).toBe(true);

    // The attention contract binds REAL recorded narration segments to the plan's viewports.
    expect(state.sync_bindings.length).toBeGreaterThan(0);
    const bound = state.sync_bindings.find((b) => b.frame_id === plan.frame_id);
    expect(bound).toBeDefined();
    const script = state.narration_scripts.find((s) => s.frame_id === plan.frame_id);
    const scriptSegmentIds = new Set((script?.segments ?? []).map((s) => s.segment_id));
    expect(bound!.bindings.length).toBeGreaterThan(0);
    expect(bound!.bindings.every((b) => scriptSegmentIds.has(b.segment_id))).toBe(true);

    // The plan's first step was realized (`cause: "plan"`).
    expect(state.viewport_changes.some((c) => c.cause === "plan")).toBe(true);

    // Evidence joined the board: a taught frame carries the source_viewport MCCR element.
    const withEvidence = state.frames.find((f) => f.mccr?.source_viewport);
    expect(withEvidence).toBeDefined();
    expect(withEvidence!.mccr!.source_viewport!.content.kind).toBe("source_viewport");
    expect(withEvidence!.mccr!.source_viewport!.content.quote.toLowerCase()).toContain("neural");
  });

  test("CSE M6: a returning learner gets a resume card + Understanding Map from the intelligence plane", async () => {
    const base = await start();

    // Session 1: a fresh learner learns, then closes — session close distills episode + delta
    // artifacts into the intelligence plane (M3.5). Fresh learner ⇒ NO resume card.
    const created = await fetch(`${base}/api/surface`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goal: "Teach me Neural Networks", seed: "test-resume-1" }),
    });
    const first = (await created.json()) as {
      surface_id: string;
      learner_id: string;
      api_key?: string;
    };
    expect(first.api_key).toBeDefined();
    const stateFresh = await fetch(`${base}/api/surface/${first.surface_id}/state`);
    const freshState = ((await stateFresh.json()) as { state: { resume_card: unknown } }).state;
    expect(freshState.resume_card).toBeNull(); // honest absence — nothing to resume yet

    await command(base, first.surface_id, { type: "ask", goal: "Teach me Neural Networks" });
    await command(base, first.surface_id, { type: "close" });

    // Session 2: the SAME learner returns — the latest episode/delta artifacts project the card.
    const returned = await fetch(`${base}/api/surface`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${first.api_key}`,
      },
      body: JSON.stringify({ goal: "Continue Neural Networks", seed: "test-resume-2" }),
    });
    const second = (await returned.json()) as { surface_id: string; learner_id: string };
    expect(second.learner_id).toBe(first.learner_id);

    const stateRes = await fetch(`${base}/api/surface/${second.surface_id}/state`);
    const state = ((await stateRes.json()) as { state: unknown }).state as {
      resume_card: {
        episode_ref: string;
        summary: string;
        concepts_touched: string[];
        days_since: number;
      } | null;
    };
    expect(state.resume_card).not.toBeNull();
    expect(state.resume_card!.episode_ref).toMatch(/^ia-|^art|^[a-z]/); // a real artifact ref
    expect(state.resume_card!.summary.length).toBeGreaterThan(0);
    expect(state.resume_card!.concepts_touched.length).toBeGreaterThan(0);
    expect(state.resume_card!.days_since).toBe(0);

    // The Understanding Map read path: the learner's own artifacts, bearer-authed, own-only.
    const map = await fetch(`${base}/api/learner/${first.learner_id}/understanding`, {
      headers: { Authorization: `Bearer ${first.api_key}` },
    });
    expect(map.status).toBe(200);
    const mapJson = (await map.json()) as {
      episodes: { concept_refs?: string[] }[];
      deltas: unknown[];
    };
    expect(mapJson.episodes.length).toBeGreaterThan(0);
    expect(mapJson.episodes[0]?.concept_refs?.length).toBeGreaterThan(0);

    // Own-only: an unauthenticated read is refused (disclosure ≠ exposure).
    const denied = await fetch(`${base}/api/learner/${first.learner_id}/understanding`);
    expect(denied.status).toBe(401);
  });

  test("CSE M7: the Director conducts and Scenes wrap frames on a live ask (Theater T1)", async () => {
    const base = await start();
    const id = await createSurface(base, {
      goal: "Teach me Neural Networks",
      seed: "test-theater",
    });
    await command(base, id, { type: "ask", goal: "Teach me Neural Networks" });

    const res = await fetch(`${base}/api/surface/${id}/state`);
    const state = ((await res.json()) as { state: unknown }).state as {
      director_directives: { target_state: string; rationale: string; considered: unknown[] }[];
      latest_directive: { target_state: string; entered_state: string | null } | null;
      affect_signals: { source: string }[];
      scenes: {
        frame_ref: string;
        state: string;
        directive_ref: string | null;
        actors: { role: string }[];
        lighting: { focus_actor_ref: string | null; cdl_state: string };
      }[];
      frames: { frame_id: string }[];
    };

    // The Director issued directives — each with a rationale + a rejected alternative (L4).
    expect(state.director_directives.length).toBeGreaterThan(0);
    expect(state.latest_directive).not.toBeNull();
    expect(state.director_directives[0]?.rationale.length).toBeGreaterThan(0);
    expect(state.director_directives[0]?.considered.length).toBeGreaterThan(0);
    // The learner is judged to have entered the directed state (state.entered folded).
    expect(state.latest_directive?.entered_state).toBe(state.latest_directive?.target_state);

    // Scenes wrapped the composed frames: each opened scene references a real frame + directive,
    // has actors with a protagonist, and lit one focal actor (CSE-012).
    expect(state.scenes.length).toBeGreaterThan(0);
    const scene = state.scenes[0]!;
    expect(state.frames.some((f) => f.frame_id === scene.frame_ref)).toBe(true);
    expect(scene.directive_ref).not.toBeNull();
    expect(scene.actors.some((a) => a.role === "protagonist")).toBe(true);
    expect(scene.lighting.focus_actor_ref).not.toBeNull();

    // The affect channel recorded behavioral signals (learner-visible, opt-out; CSE-011 §3.3).
    expect(state.affect_signals.every((s) => s.source === "behavioral-inference")).toBe(true);
  });

  test("CSE M8: the Cinematographer plans shots, and a learner mark evolves the Scene in place (Theater T2)", async () => {
    const base = await start();
    const id = await createSurface(base, { goal: "Teach me Neural Networks", seed: "test-cine" });
    await command(base, id, { type: "ask", goal: "Teach me Neural Networks" });

    const state1 = await fetch(`${base}/api/surface/${id}/state`);
    const s1 = ((await state1.json()) as { state: unknown }).state as {
      scenes: { scene_id: string; shots: { kind: string; reduced_motion: string }[] }[];
    };
    // Cinematography: each opened scene carries a shot list that opens with an establish shot, and
    // every shot declares its reduced-motion realization (accessibility, CSE-013 §6).
    const scened = s1.scenes.find((sc) => sc.shots.length > 0);
    expect(scened).toBeDefined();
    expect(scened!.shots[0]?.kind).toBe("establish");
    expect(scened!.shots.every((sh) => sh.reduced_motion.length > 0)).toBe(true);

    // Interaction grammar: a learner annotates an anchor → typed intent + a learner-caused scene
    // delta evolves the Scene in place, without a new ask (CSE-014 §4).
    const marked = await command(base, id, {
      type: "interact",
      kind: "annotate",
      target_id: "el-core_concept",
      note: "this is the key idea",
    });
    expect(marked.status).toBe(200);
    const markedJson = (await marked.json()) as { ok: boolean; effect: string };
    expect(markedJson.ok).toBe(true);
    expect(markedJson.effect).toBe("scene-evolved");

    const state2 = await fetch(`${base}/api/surface/${id}/state`);
    const s2 = ((await state2.json()) as { state: unknown }).state as {
      expressed_intents: { kind: string; cls: string; cognitive_intent: string }[];
      scenes: { evolution_log: { op: string; cause: string; interaction_ref: string | null }[] }[];
    };
    // The intent was interpreted + classified (mark), and the mark note carried through.
    const intent = s2.expressed_intents.find((i) => i.kind === "annotate");
    expect(intent?.cls).toBe("mark");
    expect(intent?.cognitive_intent).toContain("key idea");
    // A learner-caused scene delta landed in some scene's evolution log.
    const evolved = s2.scenes.some((sc) =>
      sc.evolution_log.some((d) => d.cause === "learner" && d.op === "annotate"),
    );
    expect(evolved).toBe(true);
  });

  test("CSE M9: two sources fuse — corroboration where they overlap, an honest gap where neither covers", async () => {
    const base = await start();

    // Two markdown sources that both cover "gradient descent" but with different emphasis, and
    // neither covers "backpropagation" — the fusion must corroborate the overlap and name the gap.
    const register = async (title: string, md: string): Promise<string> => {
      const res = await fetch(
        `${base}/api/sources?modality=markdown&title=${encodeURIComponent(title)}`,
        {
          method: "POST",
          body: md,
        },
      );
      const json = (await res.json()) as { source: { source_version_id: string } };
      return json.source.source_version_id;
    };
    const a = await register(
      "Optimization Textbook",
      "# Gradient Descent\n\nGradient descent minimizes a loss function by stepping against the gradient.\n\n# Learning Rate\n\nThe learning rate sets the step size.\n",
    );
    const b = await register(
      "ML Lecture Notes",
      "# Gradient Descent\n\nGradient descent is an iterative optimization that follows the steepest downhill direction.\n",
    );

    const id = await createSurface(base, { goal: "Teach me Gradient Descent", seed: "test-fuse" });
    for (const v of [a, b]) {
      const attach = await fetch(`${base}/api/surface/${id}/sources`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_version_id: v }),
      });
      expect(attach.status).toBe(200);
    }

    const fuseRes = await fetch(`${base}/api/surface/${id}/fuse`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ concept_refs: ["gradient-descent", "backpropagation"] }),
    });
    expect(fuseRes.status).toBe(200);
    const { fusion } = (await fuseRes.json()) as {
      fusion: {
        concepts: {
          concept_ref: string;
          source_treatments: {
            source_version_id: string;
            anchor_refs: string[];
            quote: string | null;
          }[];
          reconciliation: { corroborated: boolean; contradictions: unknown[] };
          confidence: number;
        }[];
        gaps: { concept_ref: string }[];
      };
    };

    // Gradient descent is covered by BOTH sources → corroborated, provenance preserved per source.
    const gd = fusion.concepts.find((c) => c.concept_ref === "gradient-descent");
    expect(gd).toBeDefined();
    expect(gd!.reconciliation.corroborated).toBe(true);
    expect(gd!.confidence).toBeGreaterThan(0.6);
    // Every treatment stays traceable to its own source's anchors (fusion never blurs provenance).
    const covering = gd!.source_treatments.filter((t) => t.anchor_refs.length > 0);
    expect(covering.length).toBe(2);
    expect(new Set(covering.map((t) => t.source_version_id)).size).toBe(2);
    // No contradiction is fabricated from a difference in emphasis (CSE-006 honesty).
    expect(gd!.reconciliation.contradictions).toEqual([]);

    // Backpropagation is covered by NEITHER source → an honest gap, never a blank.
    expect(fusion.gaps.some((g) => g.concept_ref === "backpropagation")).toBe(true);
  });

  test("CSE M11: the learner authors; the system only ever attaches disclosed assists — never the artifact", async () => {
    const base = await start();
    const id = await createSurface(base, {
      goal: "Teach me Gradient Descent",
      seed: "test-create",
    });

    type CreationResponse = {
      ok: boolean;
      creation: {
        creation_id: string;
        kind: string;
        title: string;
        draft: string;
        status: string;
        assists: {
          assist_id: string;
          kind: string;
          agent_cid: string;
          disclosed: boolean;
          slots?: { label: string; hint: string }[];
          findings?: { issue: string }[];
          questions?: string[];
          refs?: { label: string; source: string }[];
        }[];
      };
    };

    // 1. The learner opens a creation with THEIR OWN draft — those words are authored, not generated.
    const learnerDraft = "Gradient descent walks downhill. I think the step size matters a lot.";
    const openRes = await fetch(`${base}/api/surface/${id}/creation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "essay",
        title: "Why learning rate matters",
        concept_refs: ["gradient-descent", "learning-rate"],
        draft: learnerDraft,
      }),
    });
    expect(openRes.status).toBe(201);
    const opened = (await openRes.json()) as CreationResponse;
    expect(opened.ok).toBe(true);
    expect(opened.creation.status).toBe("in_progress");
    expect(opened.creation.draft).toBe(learnerDraft);
    expect(opened.creation.assists).toEqual([]);
    const cid = opened.creation.creation_id;

    // 2. A scaffold assist returns STRUCTURE (labelled slots) — never content, never prose.
    const scaffoldRes = await fetch(`${base}/api/surface/${id}/creation/${cid}/assist`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "scaffold", draft: learnerDraft }),
    });
    expect(scaffoldRes.status).toBe(200);
    const scaffolded = (await scaffoldRes.json()) as CreationResponse;
    const scaffold = scaffolded.creation.assists.at(-1)!;
    expect(scaffold.kind).toBe("scaffold");
    expect(scaffold.disclosed).toBe(true);
    expect(scaffold.agent_cid).toBe("agent.creation");
    expect(scaffold.slots && scaffold.slots.length).toBeGreaterThan(0);
    // THE NO-GHOSTWRITER LAW, STRUCTURALLY: an assist has NO field that could hold the artifact.
    for (const forbidden of ["prose", "content", "draft", "text", "body", "essay"]) {
      expect(scaffold).not.toHaveProperty(forbidden);
    }
    // The system NEVER wrote into the learner's draft — their words are untouched by the assist.
    expect(scaffolded.creation.draft).toBe(learnerDraft);

    // 3. A critique assist returns FINDINGS on the draft (issues, not rewrites).
    const critiqueRes = await fetch(`${base}/api/surface/${id}/creation/${cid}/assist`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "critique", draft: learnerDraft }),
    });
    const critiqued = (await critiqueRes.json()) as CreationResponse;
    expect(critiqued.creation.status).toBe("critiqued");
    const critique = critiqued.creation.assists.at(-1)!;
    expect(critique.kind).toBe("critique");
    expect(Array.isArray(critique.findings)).toBe(true);

    // 4. A provocation assist returns QUESTIONS (openings, never answers).
    const provokeRes = await fetch(`${base}/api/surface/${id}/creation/${cid}/assist`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "provocation" }),
    });
    const provoked = (await provokeRes.json()) as CreationResponse;
    const provocation = provoked.creation.assists.at(-1)!;
    expect(provocation.kind).toBe("provocation");
    expect(provocation.questions && provocation.questions.length).toBeGreaterThan(0);

    // 5. Completion preserves the learner's final words verbatim — authorship is theirs, start to end.
    const finalDraft = learnerDraft + "\n\nSo the learning rate trades speed against stability.";
    const completeRes = await fetch(`${base}/api/surface/${id}/creation/${cid}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ draft: finalDraft }),
    });
    const completed = (await completeRes.json()) as CreationResponse;
    expect(completed.creation.status).toBe("completed");
    expect(completed.creation.draft).toBe(finalDraft);
    // Three assists were offered and recorded; every one disclosed.
    expect(completed.creation.assists.length).toBe(3);
    expect(completed.creation.assists.every((a) => a.disclosed === true)).toBe(true);
  });

  // ADR-0051 — the contribution loop: a completed creation, with EXPLICIT consent, re-enters the
  // substrate as a first-class Cognitive Source (recursion: the system's output becomes its input).
  test("CSE contribution loop: a consented creation becomes a citable, fusable source", async () => {
    const base = await start();
    const id = await createSurface(base, {
      goal: "Teach me Gradient Descent",
      seed: "test-contribute",
    });

    const open = await fetch(`${base}/api/surface/${id}/creation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "essay",
        title: "Why step size matters",
        concept_refs: ["gradient-descent"],
        draft: "# Step size\n\nThe learning rate trades convergence speed against stability.\n",
      }),
    });
    const cid = ((await open.json()) as { creation: { creation_id: string } }).creation.creation_id;

    // Contributing BEFORE completion is refused (only a finished artifact can be shared).
    const early = await fetch(`${base}/api/surface/${id}/creation/${cid}/contribute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ consent: true }),
    });
    expect(early.status).toBe(422);

    await fetch(`${base}/api/surface/${id}/creation/${cid}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    // Contributing WITHOUT consent is refused (sharing is never automatic — CSE-002 §8).
    const noConsent = await fetch(`${base}/api/surface/${id}/creation/${cid}/contribute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ consent: false }),
    });
    expect(noConsent.status).toBe(422);

    // With explicit consent → the draft becomes a Cognitive Source; the creation records it.
    const contribute = await fetch(`${base}/api/surface/${id}/creation/${cid}/contribute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ consent: true }),
    });
    expect(contribute.status).toBe(200);
    const contributed = (await contribute.json()) as {
      ok: boolean;
      creation: { contributed_as: string | null };
      source: { source_version_id: string; content_hash: string };
    };
    expect(contributed.ok).toBe(true);
    const newVersion = contributed.source.source_version_id;
    expect(newVersion).toBeTruthy();
    expect(contributed.creation.contributed_as).toBe(newVersion);

    // RECURSION: the contributed source is a first-class source — its canonical bytes are served
    // (content-addressed, fidelity-provable) exactly like any uploaded source.
    const content = await fetch(`${base}/api/sources/${newVersion}/content`);
    expect(content.status).toBe(200);
    expect(content.headers.get("X-Content-Hash")).toBe(contributed.source.content_hash);

    // The contribution is observable in the deep-transparency read (M12 T1), with origin provenance.
    const cognition = (await (await fetch(`${base}/api/sources/cognition?recent=100`)).json()) as {
      cognition: {
        activity: { creations_contributed: number; versions_registered: number };
        recent: { event_type: string; summary: string }[];
      };
    };
    expect(cognition.cognition.activity.creations_contributed).toBe(1);
    expect(
      cognition.cognition.recent.some(
        (e) => e.event_type === "source.creation.contributed" && e.summary.includes("consented"),
      ),
    ).toBe(true);
  });

  // ADR-0054 — the right to un-share: revoking consent cascades a redaction (delist + withhold + block
  // reuse). The consent lifecycle is fully evented; a redacted source's content returns 410 Gone.
  test("consent revocation cascades a redaction: delisted, withheld (410), reuse blocked", async () => {
    const base = await start();
    const id = await createSurface(base, { goal: "Teach me Gradient Descent", seed: "revoke-a" });

    const open = await fetch(`${base}/api/surface/${id}/creation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "essay",
        title: "On step size",
        concept_refs: ["gradient-descent"],
        draft: "# Step size\n\nThe learning rate trades speed against stability.\n",
      }),
    });
    const cid = ((await open.json()) as { creation: { creation_id: string } }).creation.creation_id;
    await fetch(`${base}/api/surface/${id}/creation/${cid}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const contribute = await fetch(`${base}/api/surface/${id}/creation/${cid}/contribute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ consent: true }),
    });
    const version = ((await contribute.json()) as { source: { source_version_id: string } }).source
      .source_version_id;

    // Contributed: it's in the commons and its content serves.
    const commonsBefore = (await (await fetch(`${base}/api/sources/commons`)).json()) as {
      commons: unknown[];
    };
    expect(commonsBefore.commons).toHaveLength(1);
    expect((await fetch(`${base}/api/sources/${version}/content`)).status).toBe(200);

    // The learner revokes → the cascade runs.
    const revoke = await fetch(`${base}/api/surface/${id}/creation/${cid}/revoke`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(revoke.status).toBe(200);
    const revoked = (await revoke.json()) as {
      ok: boolean;
      creation: { contributed_as: string | null };
      redacted_counts: { commons_entries: number; content_withheld: number };
    };
    expect(revoked.ok).toBe(true);
    expect(revoked.creation.contributed_as).toBeNull(); // no longer a live contribution
    expect(revoked.redacted_counts.commons_entries).toBe(1);

    // Delisted from the commons.
    const commonsAfter = (await (await fetch(`${base}/api/sources/commons`)).json()) as {
      commons: unknown[];
    };
    expect(commonsAfter.commons).toHaveLength(0);

    // Content WITHHELD — 410 Gone (honestly "was here, withdrawn"), not a silent 404.
    expect((await fetch(`${base}/api/sources/${version}/content`)).status).toBe(410);

    // Reuse BLOCKED — a new learner cannot attach the redacted source.
    const surfaceB = await createSurface(base, { goal: "Teach me Optimization", seed: "revoke-b" });
    const attach = await fetch(`${base}/api/surface/${surfaceB}/sources`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source_version_id: version }),
    });
    expect(attach.status).toBe(422);

    // The consent lifecycle is fully observable: granted → revoked → redaction cascaded.
    const cognition = (await (await fetch(`${base}/api/sources/cognition?recent=100`)).json()) as {
      cognition: {
        activity: { consents_granted: number; consents_revoked: number; redactions: number };
      };
    };
    expect(cognition.cognition.activity.consents_granted).toBe(1);
    expect(cognition.cognition.activity.consents_revoked).toBe(1);
    expect(cognition.cognition.activity.redactions).toBe(1);
  });

  // ADR-0053 — the knowledge commons: a consented contribution is discoverable by ANOTHER learner
  // and attachable to their surface (collective intelligence). Private/uncontributed work never leaks.
  test("knowledge commons: a consented creation is discoverable and reusable by another learner", async () => {
    const base = await start();

    // Learner A authors + completes a creation but does NOT contribute it yet.
    const surfaceA = await createSurface(base, {
      goal: "Teach me Gradient Descent",
      seed: "commons-a",
    });
    const openA = await fetch(`${base}/api/surface/${surfaceA}/creation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "essay",
        title: "Why step size matters",
        concept_refs: ["gradient-descent"],
        draft: "# Step size\n\nThe learning rate trades convergence speed for stability.\n",
      }),
    });
    const cidA = ((await openA.json()) as { creation: { creation_id: string } }).creation
      .creation_id;
    await fetch(`${base}/api/surface/${surfaceA}/creation/${cidA}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    // Privacy: a completed-but-uncontributed creation NEVER appears in the commons.
    const beforeConsent = (await (await fetch(`${base}/api/sources/commons`)).json()) as {
      commons: { source_version_id: string }[];
    };
    expect(beforeConsent.commons).toHaveLength(0);

    // A consents to share → it enters the commons, attributed.
    const contribute = await fetch(`${base}/api/surface/${surfaceA}/creation/${cidA}/contribute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ consent: true }),
    });
    const shared = (await contribute.json()) as { source: { source_version_id: string } };
    const sharedVersion = shared.source.source_version_id;

    const commons = (await (await fetch(`${base}/api/sources/commons`)).json()) as {
      ok: boolean;
      commons: {
        source_version_id: string;
        title: string;
        kind: string;
        author_cid: string | null;
        concept_refs: string[];
      }[];
    };
    expect(commons.ok).toBe(true);
    expect(commons.commons).toHaveLength(1);
    const entry = commons.commons[0]!;
    expect(entry.source_version_id).toBe(sharedVersion);
    expect(entry.title).toBe("Why step size matters");
    expect(entry.kind).toBe("essay");
    expect(entry.author_cid).toBeTruthy(); // attribution travels (Constitution #4)
    expect(entry.concept_refs).toContain("gradient-descent");

    // Learner B (a DIFFERENT surface) discovers it and attaches it — collective intelligence.
    const surfaceB = await createSurface(base, {
      goal: "Teach me Optimization",
      seed: "commons-b",
    });
    const attach = await fetch(`${base}/api/surface/${surfaceB}/sources`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source_version_id: sharedVersion }),
    });
    expect(attach.status).toBe(200);
    // Now B can fuse over the peer's contributed source — it's an ordinary bound source.
    const fuse = await fetch(`${base}/api/surface/${surfaceB}/fuse`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ concept_refs: ["gradient-descent"] }),
    });
    expect(fuse.status).toBe(200);
    const fused = (await fuse.json()) as {
      fusion: {
        concepts: { concept_ref: string; source_treatments: { source_version_id: string }[] }[];
      };
    };
    const gd = fused.fusion.concepts.find((c) => c.concept_ref === "gradient-descent");
    expect(gd?.source_treatments.some((t) => t.source_version_id === sharedVersion)).toBe(true);
  });

  // ADR-0052 — the governed web crawler: server-side fetch under an SSRF-safe policy, becoming a
  // first-class web-modality source. Hermetic: the web fetch is a fake (never real network).
  test("governed crawler: a fetched page becomes a citable web source; the SSRF policy blocks internal URLs", async () => {
    const base = await startWithCrawler(async (url) =>
      ok({
        html: `<html><body><h1>Gradient Descent</h1><p>Steps against the gradient of the loss.</p></body></html>`,
        finalUrl: url.toString(),
        contentType: "text/html",
      }),
    );

    // A public URL is fetched (via the fake) and canonicalized into a web-modality Cognitive Source.
    const crawl = await fetch(`${base}/api/sources/crawl`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://example.com/gradient-descent" }),
    });
    expect(crawl.status).toBe(201);
    const crawled = (await crawl.json()) as {
      ok: boolean;
      source: { source_version_id: string; modality: string; content_hash: string };
    };
    expect(crawled.ok).toBe(true);
    expect(crawled.source.modality).toBe("web");
    // RECURSION into the substrate: its canonical bytes serve with a matching fidelity hash.
    const content = await fetch(`${base}/api/sources/${crawled.source.source_version_id}/content`);
    expect(content.status).toBe(200);
    expect(content.headers.get("X-Content-Hash")).toBe(crawled.source.content_hash);

    // The SSRF policy refuses an internal/loopback URL at the gateway — WITHOUT any fetch (422).
    const blocked = await fetch(`${base}/api/sources/crawl`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "http://169.254.169.254/latest/meta-data/" }),
    });
    expect(blocked.status).toBe(422);
    const blockedJson = (await blocked.json()) as { ok: boolean; error: { code: string } };
    expect(blockedJson.ok).toBe(false);
    expect(blockedJson.error.code).toBe("E_CRAWL_HOST_BLOCKED");

    // A non-http scheme is refused too.
    const badScheme = await fetch(`${base}/api/sources/crawl`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "file:///etc/passwd" }),
    });
    expect(badScheme.status).toBe(422);
    expect(((await badScheme.json()) as { error: { code: string } }).error.code).toBe(
      "E_CRAWL_SCHEME_BLOCKED",
    );
  });

  test("CSE M12: the source plane's cognition is observable — deep-transparency read", async () => {
    const base = await start();

    // Before any source work, the transparency read is honestly empty (never fabricated).
    const empty = (await (await fetch(`${base}/api/sources/cognition`)).json()) as {
      ok: boolean;
      cognition: {
        activity: Record<string, number>;
        total_events: number;
        recent: { event_type: string; producer_cid: string; summary: string; degraded: boolean }[];
      };
    };
    expect(empty.ok).toBe(true);
    expect(empty.cognition.total_events).toBe(0);
    expect(empty.cognition.recent).toEqual([]);

    // Register a source (canonicalization emits source.version.registered + source.layer.constructed),
    // then open + assist a creation (source.creation.* events) — all on the shared source plane.
    const reg = await fetch(
      `${base}/api/sources?modality=markdown&title=${encodeURIComponent("Notes")}`,
      {
        method: "POST",
        body: "# Gradient Descent\n\nGradient descent minimizes a loss function by stepping against the gradient.\n",
      },
    );
    expect(reg.status).toBe(201);

    const id = await createSurface(base, {
      goal: "Teach me Gradient Descent",
      seed: "test-transparency",
    });
    const open = await fetch(`${base}/api/surface/${id}/creation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "essay",
        title: "Why step size matters",
        concept_refs: ["gradient-descent"],
      }),
    });
    const cid = ((await open.json()) as { creation: { creation_id: string } }).creation.creation_id;
    await fetch(`${base}/api/surface/${id}/creation/${cid}/assist`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "scaffold" }),
    });

    // The transparency read now reflects real cognition: layers built + a creation opened + assisted.
    const after = (await (await fetch(`${base}/api/sources/cognition?recent=50`)).json()) as {
      ok: boolean;
      cognition: {
        activity: {
          versions_registered: number;
          layers_constructed: number;
          creations_started: number;
          creation_assists: number;
        };
        total_events: number;
        recent: { event_type: string; producer_cid: string; summary: string }[];
      };
    };
    expect(after.cognition.activity.versions_registered).toBeGreaterThanOrEqual(1);
    expect(after.cognition.activity.layers_constructed).toBeGreaterThanOrEqual(1);
    expect(after.cognition.activity.creations_started).toBe(1);
    expect(after.cognition.activity.creation_assists).toBe(1);
    expect(after.cognition.total_events).toBeGreaterThan(empty.cognition.total_events);
    // Every recent entry is provenance-bearing (traces to a producer) with a human summary.
    expect(after.cognition.recent.length).toBeGreaterThan(0);
    for (const entry of after.cognition.recent) {
      expect(entry.producer_cid).toBeTruthy();
      expect(entry.summary).toBeTruthy();
      expect(
        entry.event_type.startsWith("source.") || entry.event_type === "model.output.recorded",
      ).toBe(true);
    }
  });

  // CSE M12 T3 — the full-surface E2E happy path (production hardening): one coherent walk over the
  // whole Cognitive Source Environment through the real HTTP boundary, on the deterministic path.
  test("CSE M12 E2E: register → attach → teach → fuse → frontier → timeline → create → transparency", async () => {
    const base = await start();

    const register = async (title: string, md: string): Promise<string> => {
      const res = await fetch(
        `${base}/api/sources?modality=markdown&title=${encodeURIComponent(title)}`,
        {
          method: "POST",
          body: md,
        },
      );
      expect(res.status).toBe(201);
      return ((await res.json()) as { source: { source_version_id: string } }).source
        .source_version_id;
    };
    // Two sources that overlap on "gradient descent" but neither covers "backpropagation".
    const a = await register(
      "Optimization Notes",
      "# Gradient Descent\n\nGradient descent minimizes a loss by stepping against the gradient.\n",
    );
    const b = await register(
      "Lecture Notes",
      "# Gradient Descent\n\nGradient descent follows the steepest downhill direction iteratively.\n",
    );

    const id = await createSurface(base, { goal: "Teach me Gradient Descent", seed: "test-e2e" });

    // Attach both sources to the surface.
    for (const v of [a, b]) {
      const attach = await fetch(`${base}/api/surface/${id}/sources`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_version_id: v }),
      });
      expect(attach.status).toBe(200);
    }

    // Teach: the ask composes cognition; the folded state carries a timeline + a composed frame.
    const asked = await command(base, id, { type: "ask", goal: "Teach me Gradient Descent" });
    expect(asked.status).toBe(200);
    const taught = (await (await fetch(`${base}/api/surface/${id}/state`)).json()) as {
      state: { timeline: unknown; frames: { status: string }[] } | null;
    };
    expect(taught.state?.timeline).not.toBeNull();
    expect(taught.state?.frames.some((f) => f.status === "composed")).toBe(true);

    // Fuse: corroboration where the two sources overlap; an honest gap where neither covers.
    const fuseRes = await fetch(`${base}/api/surface/${id}/fuse`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ concept_refs: ["gradient-descent", "backpropagation"] }),
    });
    expect(fuseRes.status).toBe(200);
    const { fusion } = (await fuseRes.json()) as {
      fusion: {
        concepts: { concept_ref: string; reconciliation: { corroborated: boolean } }[];
        gaps: { concept_ref: string }[];
      };
    };
    expect(
      fusion.concepts.find((c) => c.concept_ref === "gradient-descent")?.reconciliation
        .corroborated,
    ).toBe(true);
    expect(fusion.gaps.some((g) => g.concept_ref === "backpropagation")).toBe(true);

    // Frontier + timeline: with the null model these degrade HONESTLY (no fabricated frontier/history),
    // and the routes still succeed — degradation is visible, never a blank success (Constitution #4).
    const frontier = (await (
      await fetch(`${base}/api/surface/${id}/frontier`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ concept_ref: "gradient-descent" }),
      })
    ).json()) as { ok: boolean; frontier: { degraded: boolean; entries: unknown[] } };
    expect(frontier.ok).toBe(true);
    expect(frontier.frontier.degraded).toBe(true);
    expect(frontier.frontier.entries).toEqual([]);

    const timeline = (await (
      await fetch(`${base}/api/surface/${id}/timeline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ concept_ref: "gradient-descent" }),
      })
    ).json()) as { ok: boolean; timeline: { degraded: boolean; states: unknown[] } };
    expect(timeline.ok).toBe(true);
    expect(timeline.timeline.degraded).toBe(true);

    // Create: the learner authors, the system attaches a disclosed assist (never the artifact).
    const open = await fetch(`${base}/api/surface/${id}/creation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "essay",
        title: "On step size",
        concept_refs: ["gradient-descent"],
      }),
    });
    const cid = ((await open.json()) as { creation: { creation_id: string } }).creation.creation_id;
    await fetch(`${base}/api/surface/${id}/creation/${cid}/assist`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "scaffold" }),
    });

    // Transparency: the deep-transparency read reflects the WHOLE walk — sources, layers, fusion,
    // frontier/timeline (degraded), creation — every step observable and provenance-bearing.
    const cognition = (await (await fetch(`${base}/api/sources/cognition?recent=100`)).json()) as {
      cognition: {
        activity: {
          versions_registered: number;
          layers_constructed: number;
          fusions_composed: number;
          frontier_updates: number;
          timeline_updates: number;
          creations_started: number;
          creation_assists: number;
        };
        degraded_count: number;
        recent: { producer_cid: string }[];
      };
    };
    const act = cognition.cognition.activity;
    expect(act.versions_registered).toBe(2);
    expect(act.layers_constructed).toBeGreaterThanOrEqual(2);
    expect(act.fusions_composed).toBeGreaterThanOrEqual(1);
    expect(act.frontier_updates).toBeGreaterThanOrEqual(1);
    expect(act.timeline_updates).toBeGreaterThanOrEqual(1);
    expect(act.creations_started).toBe(1);
    expect(act.creation_assists).toBe(1);
    // The honest degradation (frontier + timeline with no model) is surfaced, never hidden.
    expect(cognition.cognition.degraded_count).toBeGreaterThanOrEqual(2);
    expect(cognition.cognition.recent.every((e) => e.producer_cid)).toBe(true);
  });

  // CSE M12 T2 — memoization must not change replay output (ADR-0050): re-fusing the same immutable
  // source set + concept set is a cache HIT — the identical result, with no re-emission (the log is
  // unchanged) and no model call — and the cache-hit rate is surfaced in the transparency read.
  test("CSE M12 T2: re-fusing the same sources is a cache hit — identical result, no re-emission", async () => {
    const base = await start();
    const register = async (title: string, md: string): Promise<string> => {
      const res = await fetch(
        `${base}/api/sources?modality=markdown&title=${encodeURIComponent(title)}`,
        { method: "POST", body: md },
      );
      return ((await res.json()) as { source: { source_version_id: string } }).source
        .source_version_id;
    };
    const a = await register("A", "# Gradient Descent\n\nSteps against the gradient.\n");
    const b = await register("B", "# Gradient Descent\n\nFollows the steepest descent.\n");
    const id = await createSurface(base, { goal: "Teach me Gradient Descent", seed: "test-cache" });
    for (const v of [a, b]) {
      await fetch(`${base}/api/surface/${id}/sources`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_version_id: v }),
      });
    }

    const fuse = async (): Promise<unknown> => {
      const res = await fetch(`${base}/api/surface/${id}/fuse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ concept_refs: ["gradient-descent"] }),
      });
      return ((await res.json()) as { fusion: unknown }).fusion;
    };
    const readCognition = async (): Promise<{
      total_events: number;
      cache: {
        hits: number;
        misses: number;
        by_kind: Record<string, { hits: number; misses: number }>;
      };
    }> =>
      (
        (await (await fetch(`${base}/api/sources/cognition`)).json()) as {
          cognition: {
            total_events: number;
            cache: {
              hits: number;
              misses: number;
              by_kind: Record<string, { hits: number; misses: number }>;
            };
          };
        }
      ).cognition;

    // First fuse: a cache MISS — it computes and emits the source.fusion.* events.
    const first = await fuse();
    const afterFirst = await readCognition();
    expect(afterFirst.cache.by_kind["fusion"]?.misses).toBe(1);

    // Second fuse over the SAME sources + concept: a cache HIT.
    const second = await fuse();
    const afterSecond = await readCognition();

    // The memoized result is byte-identical (deterministic reconciliation over immutable versions).
    expect(second).toEqual(first);
    // The hit re-emitted NOTHING — the source log is unchanged (caching never changes replay output).
    expect(afterSecond.total_events).toBe(afterFirst.total_events);
    // The hit is surfaced in the deep-transparency read (CSE-002 §11 cache-hit telemetry).
    expect(afterSecond.cache.by_kind["fusion"]?.hits).toBeGreaterThanOrEqual(1);
    expect(afterSecond.cache.hits).toBeGreaterThanOrEqual(1);
  });

  // CSE M12 T3 — the failure boundary (production hardening): every CSE route degrades HONESTLY,
  // returning a typed error, never a blank success (CSE-002 §10 as it manifests at the gateway).
  test("CSE M12 failure boundary: bad requests return honest typed errors, never blank success", async () => {
    const base = await start();

    // Unknown modality → 422 with a typed error naming the modality (never a silent accept).
    const badModality = await fetch(`${base}/api/sources?modality=hologram&title=x`, {
      method: "POST",
      body: "some text",
    });
    expect(badModality.status).toBe(422);
    const badModalityJson = (await badModality.json()) as {
      ok: boolean;
      error: { code: string; message: string };
    };
    expect(badModalityJson.ok).toBe(false);
    expect(badModalityJson.error.code).toBe("E_SOURCE_GATEWAY");
    expect(badModalityJson.error.message).toContain("modality");

    // Empty source body → 400 (never register a blank source).
    const empty = await fetch(`${base}/api/sources?modality=markdown&title=x`, {
      method: "POST",
      body: "",
    });
    expect(empty.status).toBe(400);

    // Unknown source version content → 404.
    const missing = await fetch(`${base}/api/sources/does-not-exist/content`);
    expect(missing.status).toBe(404);

    const id = await createSurface(base, { goal: "Teach me X", seed: "test-fail" });

    // Attach without a version id → 400.
    const badAttach = await fetch(`${base}/api/surface/${id}/sources`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(badAttach.status).toBe(400);

    // Fuse with no bound sources → typed error (nothing to reconcile — honest, not an empty success).
    const badFuse = await fetch(`${base}/api/surface/${id}/fuse`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ concept_refs: ["x"] }),
    });
    expect(badFuse.status).toBe(422);

    // Assist an unknown creation → 422 (never fabricate a creation).
    const badAssist = await fetch(`${base}/api/surface/${id}/creation/nope/assist`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "scaffold" }),
    });
    expect(badAssist.status).toBe(422);

    // Unknown surface → 404.
    const badSurface = await fetch(`${base}/api/surface/no-such-surface/state`);
    expect(badSurface.status).toBe(404);
  });

  test("an unknown command type is rejected without mutating state (extensible envelope)", async () => {
    const base = await start();
    const id = await createSurface(base, {
      goal: "Teach me Neural Networks",
      seed: "test-unknown",
    });
    const res = await command(base, id, { type: "teleport" });
    expect(res.status).toBe(400);
    const json = (await res.json()) as { ok: boolean; error: { code: string } };
    expect(json.ok).toBe(false);
    expect(json.error.code).toBe("E_SURFACE_GATEWAY");
  });
});
