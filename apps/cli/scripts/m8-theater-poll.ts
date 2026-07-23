/** M8 live Theater T2 smoke — shots planned on a real Gemini ask + a learner mark evolves the Scene.
 *  Fire the ask, poll /state for shots, then interact(annotate) and confirm the scene delta. */
const BASE = `http://127.0.0.1:${process.env["PORT"] ?? 8902}`;

interface TheaterState {
  scenes: {
    scene_id: string;
    frame_ref: string;
    shots: { kind: string; reduced_motion: string }[];
    evolution_log: { op: string; cause: string }[];
  }[];
  expressed_intents: { kind: string; cls: string }[];
  frames: { frame_id: string }[];
  ask_progress: { phase: string } | null;
}

async function getState(id: string): Promise<TheaterState | null> {
  const res = await fetch(`${BASE}/api/surface/${id}/state`).catch(() => null);
  if (!res) return null;
  return ((await res.json()) as { state: TheaterState }).state;
}

async function main(): Promise<void> {
  const created = await fetch(`${BASE}/api/surface`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ goal: "Teach me Gradient Descent" }),
  });
  const { surface_id } = (await created.json()) as { surface_id: string };
  console.log(`SURFACE: ${surface_id}`);
  void fetch(`${BASE}/api/surface/${surface_id}/command`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "ask", goal: "Teach me Gradient Descent" }),
  }).catch(() => undefined);

  for (let i = 0; i < 50; i++) {
    await new Promise((r) => setTimeout(r, 12000));
    const s = await getState(surface_id);
    if (!s) continue;
    const scened = s.scenes.find((sc) => sc.shots.length > 0);
    if (scened) {
      const kinds = [...new Set(scened.shots.map((sh) => sh.kind))];
      const allRealized = s.scenes.every((sc) =>
        sc.shots.every((sh) => sh.reduced_motion.length > 0),
      );
      console.log(
        `SHOTS: scene ${scened.scene_id} has ${scened.shots.length} shots | kinds: ${kinds.join(",")} | reduced-motion on all: ${allRealized}`,
      );

      // Now the learner marks the board — the Scene must evolve in place.
      const marked = await fetch(`${BASE}/api/surface/${surface_id}/command`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "interact",
          kind: "annotate",
          target_id: "el-core_concept",
          note: "the key idea",
        }),
      });
      const markedJson = (await marked.json()) as { ok: boolean; effect: string };
      console.log(`MARK: effect=${markedJson.effect}`);
      const after = await getState(surface_id);
      const intent = after?.expressed_intents.find((x) => x.kind === "annotate");
      const evolved = after?.scenes.some((sc) =>
        sc.evolution_log.some((d) => d.cause === "learner" && d.op === "annotate"),
      );
      console.log(
        `INTENT: ${intent ? `${intent.kind} → ${intent.cls}` : "(none)"} | SCENE EVOLVED (learner): ${evolved}`,
      );
      if (
        kinds[0] !== "establish" ||
        !allRealized ||
        markedJson.effect !== "scene-evolved" ||
        !intent ||
        !evolved
      ) {
        console.error("FAIL invariant broken");
        process.exit(1);
      }
      console.log("M8 THEATER T2 LIVE SMOKE: ALL PROOFS PASSED");
      return;
    }
    console.log(
      `  waiting… frames=${s.frames.length} scenes=${s.scenes.length} phase=${s.ask_progress?.phase ?? "-"}`,
    );
  }
  console.error("TIMEOUT");
  process.exit(1);
}
void main();
