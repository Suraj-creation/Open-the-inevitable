/** M7 live Theater smoke — assert the Director conducts + Scenes wrap frames on a real Gemini ask.
 *  Fire the ask, then poll /state (a live multi-frame ask outlives undici's header timeout). */
const BASE = `http://127.0.0.1:${process.env["PORT"] ?? 8901}`;

async function main(): Promise<void> {
  const created = await fetch(`${BASE}/api/surface`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ goal: "Teach me Gradient Descent" }),
  });
  const { surface_id } = (await created.json()) as { surface_id: string };
  console.log(`SURFACE: ${surface_id}`);
  // Fire the ask; don't await the (slow) response — poll state instead.
  void fetch(`${BASE}/api/surface/${surface_id}/command`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "ask", goal: "Teach me Gradient Descent" }),
  }).catch(() => undefined);

  for (let i = 0; i < 50; i++) {
    await new Promise((r) => setTimeout(r, 12000));
    const res = await fetch(`${BASE}/api/surface/${surface_id}/state`).catch(() => null);
    if (!res) continue;
    const s = ((await res.json()) as { state: Record<string, never> }).state as unknown as {
      director_directives: { target_state: string; rationale: string }[];
      latest_directive: { target_state: string; entered_state: string | null } | null;
      affect_signals: { affect_state: string }[];
      scenes: {
        frame_ref: string;
        state: string;
        actors: { role: string }[];
        lighting: { focus_actor_ref: string | null };
      }[];
      frames: { frame_id: string }[];
      ask_progress: { phase: string } | null;
    };
    if (s.director_directives.length > 0 && s.scenes.length > 0) {
      const states = [...new Set(s.director_directives.map((d) => d.target_state))];
      console.log(`DIRECTIVES: ${s.director_directives.length} | states: ${states.join(",")}`);
      console.log(
        `LATEST: ${s.latest_directive?.target_state} (entered=${s.latest_directive?.entered_state}) | "${s.latest_directive?.rationale.slice(0, 70)}..."`,
      );
      console.log(
        `AFFECT: ${[...new Set(s.affect_signals.map((a) => a.affect_state))].join(",") || "(none)"}`,
      );
      const scene = s.scenes[0]!;
      console.log(
        `SCENES: ${s.scenes.length} | scene[0] frame=${scene.frame_ref} state=${scene.state} actors=${scene.actors.length} protagonist=${scene.actors.some((a) => a.role === "protagonist")} focal=${scene.lighting.focus_actor_ref !== null}`,
      );
      const frameMatch = s.frames.some((f) => f.frame_id === scene.frame_ref);
      console.log(`SCENE WRAPS A REAL FRAME: ${frameMatch}`);
      if (!frameMatch || !scene.actors.some((a) => a.role === "protagonist")) {
        console.error("FAIL invariant broken");
        process.exit(1);
      }
      console.log("M7 THEATER LIVE SMOKE: ALL PROOFS PASSED");
      return;
    }
    console.log(
      `  waiting… frames=${s.frames.length} directives=${s.director_directives.length} scenes=${s.scenes.length} phase=${s.ask_progress?.phase ?? "-"}`,
    );
  }
  console.error("TIMEOUT");
  process.exit(1);
}
void main();
