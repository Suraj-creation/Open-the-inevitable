/**
 * The first "open The Inevitable" moment: a living Cognitive Surface in the terminal.
 *
 *   pnpm demo "Teach me Neural Networks"
 *
 * With GEMINI_API_KEY set, explanations/practice are real Gemini cognition recorded as
 * `model.output.recorded` events (D3). Without it, the deterministic NullModelRuntime runs the
 * identical governed path. Every block traces to packet → agent → world-state → memory.
 */
import { GeminiModelRuntime, NullModelRuntime, RecordingModelRuntime } from "@inevitable/adapters";
import type { ModelRuntime } from "@inevitable/contracts";
import { TextSurfaceRenderer } from "@inevitable/surface";
import { geminiApiKey, loadEnv } from "./env";
import { buildDemoSession } from "./wiring";

loadEnv(); // hydrate process.env from .env before resolving the model

const goal = process.argv[2] ?? "Teach me Neural Networks";

let inner: ModelRuntime;
let provider: string;
const apiKey = geminiApiKey();
if (apiKey) {
  const connected = await GeminiModelRuntime.connect({ apiKey });
  if (connected.ok) {
    inner = connected.value;
    provider = "gemini";
  } else {
    console.log(`! gemini unavailable (${connected.error.code}) — using deterministic null model`);
    inner = new NullModelRuntime();
    provider = "null";
  }
} else {
  inner = new NullModelRuntime();
  provider = "null";
}

const fixture = buildDemoSession({
  modelFactory: (bus, clock, idGenerator) =>
    new RecordingModelRuntime({ mode: "record", bus, inner, provider, clock, idGenerator }),
});
const { surface, bus } = fixture;
const renderer = new TextSurfaceRenderer();

console.log(`The Inevitable — Cognitive Surface demo (model: ${provider})\n`);
bus.subscribe("surface.>", (event) => {
  console.log(`  ⋅ ${event.event_type}`);
});
bus.subscribe("model.>", (event) => {
  console.log(`  ⋅ ${event.event_type}`);
});

const render = () => {
  const state = surface.state();
  if (state) console.log(`\n${renderer.render(state)}\n`);
};

const started = await surface.start(goal);
if (!started.ok) throw started.error;

console.log(`\nask: "${goal}"`);
const curriculum = await fixture.generateCurriculum(goal);
if (!curriculum.ok) throw curriculum.error;
const asked = await surface.ask(curriculum.value);
if (!asked.ok) throw asked.error;
render();

const explanation = asked.value.blocks.find((b) => b.block_type === "explanation");
if (explanation) {
  console.log(`expand: "${explanation.title}" → layer 1`);
  const expanded = await surface.expand(explanation.block_id, 1);
  if (!expanded.ok) throw expanded.error;
  render();

  const trace = surface.trace(explanation.block_id);
  if (trace.ok) {
    console.log("trace —", JSON.stringify(trace.value, null, 2));
  }
}

await surface.close();
const recordings = bus.replay({ subject: "model.>" }).length;
console.log(
  `\nclosed. surface events: ${bus.replay({ subject: "surface.>" }).length}, model recordings: ${recordings} (replayable, D3)`,
);
