/** Finish M5 proofs 4–7 by polling the surface state while the live ask completes server-side. */
const BASE = "http://127.0.0.1:8899";
const SURFACE = process.argv[2]!;

async function state(): Promise<Record<string, never>> {
  const res = await fetch(`${BASE}/api/surface/${SURFACE}/state`);
  return ((await res.json()) as { state: Record<string, never> }).state;
}

async function main(): Promise<void> {
  for (let i = 0; i < 60; i++) {
    const s = (await state()) as unknown as {
      viewport_plans: {
        frame_id: string;
        viewports: {
          emphasis: string;
          region: { page: number | null; bbox: number[] | null; quote: string };
        }[];
      }[];
      viewport_changes: { cause: string }[];
      source_highlights: { amplitude: string; role: string }[];
      sync_bindings: { frame_id: string; bindings: unknown[] }[];
      frames: {
        title: string;
        mccr: {
          source_viewport: { content: { quote: string; region: { page: number | null } } } | null;
        } | null;
      }[];
      ask_progress: { phase: string } | null;
    };
    const withEvidence = s.frames.find((f) => f.mccr?.source_viewport);
    if (s.viewport_plans.length > 0 && withEvidence) {
      const plan = s.viewport_plans[0]!;
      const vp = plan.viewports[0]!;
      console.log(
        `4 VIEWPORT PLAN: frame ${plan.frame_id} | ${plan.viewports.length} viewports | focus p${vp.region.page} bbox[${(vp.region.bbox ?? []).map((n) => Math.round(n)).join(",")}] | "${vp.region.quote.slice(0, 58)}..."`,
      );
      const focal = s.source_highlights.filter((h) => h.amplitude === "focal").length;
      console.log(
        `5 HIGHLIGHTS: ${s.source_highlights.length} applied | ${focal} focal | roles: ${[...new Set(s.source_highlights.map((h) => h.role))].join(",")}`,
      );
      const sync = s.sync_bindings.find((b) => b.frame_id === plan.frame_id);
      console.log(
        `6 ATTENTION CONTRACT: ${sync?.bindings.length ?? 0} segments bound | viewport.changed cause=plan: ${s.viewport_changes.some((c) => c.cause === "plan")}`,
      );
      const ev = withEvidence.mccr!.source_viewport!;
      console.log(
        `7 EVIDENCE ON BOARD: "${withEvidence.title}" (p${ev.content.region.page}): "${ev.content.quote.slice(0, 58)}..."`,
      );
      console.log("M5 LIVE E2E: ALL PROOFS PASSED");
      return;
    }
    console.log(
      `  waiting… frames=${s.frames.length} plans=${s.viewport_plans.length} phase=${s.ask_progress?.phase ?? "-"}`,
    );
    await new Promise((r) => setTimeout(r, 12000));
  }
  console.error("TIMEOUT waiting for projection");
  process.exit(1);
}
void main();
