/**
 * SurfaceHost — the long-lived session registry behind the gateway.
 *
 * Each hosted surface is a fully governed substrate composition (reusing the proven
 * `buildDemoSession` from @inevitable/cli) with its OWN bus/world/session and a per-surface
 * `CryptoIdGenerator` so ids never collide across concurrently-hosted surfaces. A surface is a
 * persistent cognitive environment: created/entered once and driven by many commands over time (SRF-005 §2).
 *
 * Durability (ADR-0008): when a persistence directory is configured, every event published on a
 * surface's bus is mirrored to a per-surface durable log and narration audio to a file media store.
 * Continuity (ADR-0009): world-state + memory snapshots are persisted alongside the log, so a restart
 * REHYDRATES a live session (restore + hydrate + `resume`) that accepts new commands — falling back to
 * read-side reconstruction only when the snapshots are absent/corrupt. The server talks to surfaces
 * only through {@link ServedSurface}, so a live surface and a restored one are interchangeable to it.
 *
 * Determinism safeguard: boundary-observability `gateway.*` events use a SEPARATE id generator so
 * they never consume from the session's seeded id stream and never perturb surface determinism.
 *
 * Spec: spec/surface/surface-streaming-sync-protocol.md, ADR-0006, ADR-0008,
 * spec/persistence/durable-cognitive-persistence.md.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  FileEventTransport,
  GeminiImageRuntime,
  GeminiModelRuntime,
  GeminiVoiceRuntime,
  NullImageRuntime,
  NullModelRuntime,
  RecordingModelRuntime,
  type ImageRuntime,
  type VoiceRuntime,
} from "@inevitable/adapters";
import {
  buildDemoSession,
  extractLearnerCognition,
  type DemoFixture,
  type DemoRestore,
} from "@inevitable/cli";
import type { ProductMode } from "@inevitable/product-cognition";
import type { ModelRuntime } from "@inevitable/contracts";
import { createEvent } from "@inevitable/events";
import type { CognitiveEvent } from "@inevitable/protocols";
import {
  CosError,
  CryptoIdGenerator,
  hlcInit,
  ok,
  err,
  type Hlc,
  type Result,
} from "@inevitable/shared";
import { foldSurfaceEvents, type SurfaceAskResult, type SurfaceState } from "@inevitable/surface";
import { geminiApiKey, persistDir, strictModel } from "./env";
import { LearnerRegistry, type LearnerRecord } from "./learners";
import {
  FileMediaStore,
  InMemoryMediaStore,
  type MediaStore,
  createMediaGenerator,
  createVoiceSynthesizer,
} from "./media";

type Surface = DemoFixture["surface"];

interface HostedSurface {
  readonly surfaceId: string;
  readonly fixture: DemoFixture;
  readonly goal: string;
  /**
   * The owning learner (DPS-003), used to capture cross-surface cognition (DPS-004). Absent only for
   * legacy surfaces rehydrated from a `meta.json` written before learner identity existed.
   */
  readonly learnerId?: string;
  /** Per-surface HLC for gateway.* observability events (separate from the session clock chain). */
  gatewayHlc: Hlc;
}

/**
 * What the gateway server needs from a surface — satisfied identically by a live session and a
 * restored (read-side) one. Live surfaces accept commands; a restored surface serves its history and
 * returns a typed signal for live commands (write-continuity after restart is Phase 2).
 */
export interface ServedSurface {
  readonly surfaceId: string;
  readonly goal: string;
  readonly live: boolean;
  state(): SurfaceState | null;
  /** surface.* events at or after `fromSequence`, in order (the SSE snapshot/resume). */
  surfaceStream(fromSequence: number): CognitiveEvent[];
  subscribeStream(handler: (event: CognitiveEvent) => void): { unsubscribe(): void };
  trace(blockId: string): ReturnType<Surface["trace"]>;
  ask(goal: string): Promise<Result<SurfaceAskResult, CosError>>;
  expand(blockId: string, layer: number): ReturnType<Surface["expand"]>;
  close(reason?: string): ReturnType<Surface["close"]>;
  /** Apply a governed learner interaction (S1.3, ADR-0024). */
  interact(input: Parameters<Surface["interact"]>[0]): ReturnType<Surface["interact"]>;
  onAttach(): void;
  onDetach(): void;
}

export interface CreateSurfaceOptions {
  readonly trustLevel?: number;
  /** Override the per-surface id seed (tests pin this for determinism). */
  readonly seed?: string;
  /** Resolve an existing durable learner (DPS-003); absent ⇒ mint a fresh learner. */
  readonly learnerId?: string;
  /** Product mode for the session (S4.3). Absent ⇒ "student". */
  readonly mode?: string;
}

export function gatewayError(message: string, details?: Record<string, unknown>): CosError {
  return new CosError("E_SURFACE_GATEWAY", message, {
    specRef: "spec/surface/surface-streaming-sync-protocol.md",
    details,
  });
}

async function resolveModel(): Promise<{ inner: ModelRuntime; provider: string }> {
  const apiKey = geminiApiKey();
  if (apiKey) {
    const connected = await GeminiModelRuntime.connect({ apiKey });
    if (connected.ok) return { inner: connected.value, provider: "gemini" };
  }
  if (strictModel()) {
    throw new Error(
      "[COS] NullModelRuntime is not allowed in strict-model mode (COS_STRICT_MODEL=1 or NODE_ENV=production). " +
        "Set GEMINI_API_KEY to enable real cognition.",
    );
  }
  return { inner: new NullModelRuntime(), provider: "null" };
}

/** Resolve a voice runtime for narration TTS: Gemini when keyed, else none (text-only narration). */
async function resolveVoice(): Promise<VoiceRuntime | null> {
  const apiKey = geminiApiKey();
  if (apiKey) {
    const connected = await GeminiVoiceRuntime.connect({ apiKey });
    if (connected.ok) return connected.value;
  }
  return null;
}

/** Resolve an image runtime: Gemini Imagen when keyed, else SVG null runtime (offline default). */
async function resolveImage(): Promise<ImageRuntime> {
  const apiKey = geminiApiKey();
  if (apiKey) {
    const connected = await GeminiImageRuntime.connect({ apiKey });
    if (connected.ok) return connected.value;
  }
  return new NullImageRuntime();
}

const SURFACE_SUBJECT_PREFIX = "surface.";

/**
 * Hosts live surface sessions and the gateway-boundary observability events.
 * The runtime is the product; this registry never renders — it only hosts and routes.
 */
export class SurfaceHost {
  private readonly surfaces = new Map<string, HostedSurface>();
  private readonly gatewayIds = new CryptoIdGenerator();
  private counter = 0;
  private readonly persistDir: string | undefined;
  /** Out-of-band audio for narration; the media route serves bytes from here (ADR-0007/0008). */
  readonly media: MediaStore;
  /** Durable first-class learners that own surfaces over time (DPS-003). */
  private readonly learners: LearnerRegistry;
  /** Test seam: inject a deterministic voice runtime instead of resolving Gemini by key. */
  private readonly injectedVoice: VoiceRuntime | undefined;
  /** Image runtime (S2.1b, SRF-006): injected by tests; resolved per-create in production. */
  private readonly imageRuntime: ImageRuntime | null;

  constructor(
    deps: {
      voiceRuntime?: VoiceRuntime;
      /** Inject a specific image runtime (tests use this); production calls resolveImage() per-create. */
      imageRuntime?: ImageRuntime;
      persistDir?: string;
    } = {},
  ) {
    this.injectedVoice = deps.voiceRuntime;
    this.imageRuntime = deps.imageRuntime ?? null;
    this.persistDir = deps.persistDir ?? persistDir();
    this.media = this.persistDir
      ? new FileMediaStore(join(this.persistDir, "media"))
      : new InMemoryMediaStore();
    this.learners = new LearnerRegistry(this.persistDir ? { persistDir: this.persistDir } : {});
  }

  /** A learner profile + the surfaces they own (resume-by-learner, DPS-003). */
  getLearner(learnerId: string): LearnerRecord | undefined {
    return this.learners.get(learnerId);
  }

  /** Resolve a learner by API key (bearer credential). Returns undefined for unknown keys. */
  getLearnerByApiKey(apiKey: string): LearnerRecord | undefined {
    return this.learners.getByApiKey(apiKey);
  }

  private surfaceDir(surfaceId: string): string {
    return join(this.persistDir!, "surfaces", surfaceId);
  }

  /** Create + enter a new cognitive environment, returning the surface id + owning learner id. */
  async create(
    goal: string,
    options: CreateSurfaceOptions = {},
  ): Promise<Result<{ surfaceId: string; learnerId: string }, CosError>> {
    const { inner, provider } = await resolveModel();
    const voiceRuntime = this.injectedVoice ?? (await resolveVoice());
    const voice = voiceRuntime ? createVoiceSynthesizer(voiceRuntime, this.media) : undefined;
    const imageRuntime = this.imageRuntime ?? (await resolveImage());
    const mediaGen = createMediaGenerator(imageRuntime, this.media);
    const seed = options.seed ?? `gw-${++this.counter}`;
    // Resolve (or mint) the durable learner that will own this surface (DPS-003).
    const learner = this.learners.resolveOrCreate({
      ...(options.learnerId !== undefined ? { learnerId: options.learnerId } : {}),
      ...(options.trustLevel !== undefined ? { trustLevel: options.trustLevel } : {}),
    });
    // A returning learner's NEW surface draws on their prior cross-surface cognition (DPS-004): load
    // the durable profile and seed it (silently) into the fresh substrate. Empty for a fresh learner.
    const learnerSeed = this.learners.readCognition(learner.learnerId);
    const fixture = buildDemoSession({
      modelFactory: (bus, clock, idGenerator) =>
        new RecordingModelRuntime({ mode: "record", bus, inner, provider, clock, idGenerator }),
      seed,
      // Crypto ids so concurrently-hosted surfaces never collide (the seeded generator is
      // seed-independent, so distinct seeds alone would mint identical surface ids).
      idGenerator: new CryptoIdGenerator(),
      learner: { userId: learner.learnerId, cid: learner.cid, trustLevel: learner.trustLevel },
      ...(learnerSeed ? { learnerSeed } : {}),
      ...(voice ? { voice } : {}),
      media: mediaGen,
      ...(options.mode ? { mode: options.mode as ProductMode } : {}),
      // Live progressive reveal: stream the explanation as it unfolds (S-UCS, ADR-0028). Gateway-only;
      // the CLI/tests leave this off so deterministic runs emit the whole block at once.
      streamRevealMs: 45,
      // UCS (ADR-0030): the product surface renders Cognitive Frames — distilled MCCR on the board
      // with a SEPARATE narration script — not a prose explanation block. Gateway-only (CLI/tests
      // exercise the legacy explanation-block path so `expand` and the substrate stay covered).
      composer: true,
      // UCS (ADR-0030; Phase 2): decompose each concept into a progressive sequence of Cognitive
      // Frames (and render practice/assessment as frames), instead of a single composed frame.
      framePlanner: true,
      ...(provider === "gemini"
        ? { evaluationModel: inner, embedFn: (t: string) => inner.embed(t) }
        : {}),
    });

    // Durable sink: one subscription. The surface id (the log's home) is only known after start(),
    // so buffer the surface's first events in memory, then flush them once the id exists and write
    // every subsequent event straight to the durable log. No event is missed; nothing double-written.
    let finalLog: FileEventTransport | undefined;
    const buffer: CognitiveEvent[] = [];
    if (this.persistDir) {
      fixture.bus.subscribe(">", async (event) => {
        if (finalLog) await finalLog.publish(event.event_type, event);
        else buffer.push(event);
      });
    }

    const started = await fixture.surface.start(goal);
    if (!started.ok) return err(started.error);
    const surfaceId = started.value;

    if (this.persistDir) {
      const dir = this.surfaceDir(surfaceId);
      mkdirSync(dir, { recursive: true });
      writeFileSync(
        join(dir, "meta.json"),
        JSON.stringify({ goal, seed, learnerId: learner.learnerId }),
        "utf8",
      );
      finalLog = new FileEventTransport(join(dir, "events.jsonl"));
      for (const event of buffer) await finalLog.publish(event.event_type, event);
      buffer.length = 0;
      this.persistSnapshots(surfaceId, fixture); // world + memory snapshots for live rehydration
    }
    this.learners.recordSurface(learner.learnerId, { surfaceId, goal });

    const hosted: HostedSurface = {
      surfaceId,
      fixture,
      goal,
      learnerId: learner.learnerId,
      gatewayHlc: hlcInit("surface-gateway"),
    };
    this.surfaces.set(surfaceId, hosted);
    return ok({ surfaceId, learnerId: learner.learnerId });
  }

  /**
   * Look up a surface for the server: live if hosted; else rehydrate a LIVE session from the durable
   * snapshots (DPS-002) so it accepts new commands; else fall back to read-side reconstruction
   * (DPS-001) when the world/memory snapshots are absent or corrupt. Async because rehydration
   * resolves the model runtime.
   */
  async get(surfaceId: string): Promise<ServedSurface | undefined> {
    const hosted = this.surfaces.get(surfaceId);
    if (hosted) return this.liveServed(hosted);
    if (this.persistDir) {
      const dir = this.surfaceDir(surfaceId);
      if (existsSync(join(dir, "events.jsonl"))) {
        const rehydrated = await this.rehydrate(surfaceId, dir);
        return rehydrated ? this.liveServed(rehydrated) : this.resumedServed(surfaceId, dir);
      }
    }
    return undefined;
  }

  private liveServed(hosted: HostedSurface): ServedSurface {
    const { fixture } = hosted;
    return {
      surfaceId: hosted.surfaceId,
      goal: hosted.goal,
      live: true,
      state: () => fixture.surface.state(),
      surfaceStream: (fromSequence) => fixture.bus.replay({ subject: "surface.>", fromSequence }),
      subscribeStream: (handler) => fixture.bus.subscribe("surface.>", handler),
      trace: (blockId) => fixture.surface.trace(blockId),
      // Commands re-persist the world + memory snapshots so a later restart rehydrates the latest state.
      // An ask runs the learning cycle (mastery), so it also captures the learner's cross-surface
      // cognition (DPS-004) into the durable profile that seeds their future surfaces.
      ask: async (goal) => {
        const result = await this.runAsk(hosted, goal);
        this.persistSnapshots(hosted.surfaceId, fixture);
        this.captureCognition(hosted);
        return result;
      },
      expand: async (blockId, layer) => {
        const result = await fixture.surface.expand(blockId, layer);
        this.persistSnapshots(hosted.surfaceId, fixture);
        return result;
      },
      close: async (reason) => {
        const result = await fixture.surface.close(reason);
        this.persistSnapshots(hosted.surfaceId, fixture);
        return result;
      },
      interact: async (input) => {
        const result = await fixture.surface.interact(input);
        this.persistSnapshots(hosted.surfaceId, fixture);
        // A reshaping interaction re-runs the governed cycle, so capture cross-surface cognition.
        if (result.ok && result.value.effect === "dispatched") this.captureCognition(hosted);
        return result;
      },
      onAttach: () => this.emitBoundaryEvent(hosted, "gateway.stream.attached"),
      onDetach: () => this.emitBoundaryEvent(hosted, "gateway.stream.detached"),
    };
  }

  private resumedServed(surfaceId: string, dir: string): ServedSurface {
    const events = new FileEventTransport(join(dir, "events.jsonl")).readAll();
    const surfaceEvents = events.filter((e) => e.event_type.startsWith(SURFACE_SUBJECT_PREFIX));
    let goal = "";
    try {
      goal =
        (JSON.parse(readFileSync(join(dir, "meta.json"), "utf8")) as { goal?: string }).goal ?? "";
    } catch {
      /* meta optional */
    }
    const replayOnly = (): Result<never, CosError> =>
      err(
        gatewayError("surface restored read-only; live continuity after restart is Phase 2", {
          surfaceId,
        }),
      );
    return {
      surfaceId,
      goal,
      live: false,
      state: () => foldSurfaceEvents(surfaceEvents, surfaceId),
      surfaceStream: (fromSequence) =>
        surfaceEvents.filter((e) => (e.sequence ?? 0) >= fromSequence),
      subscribeStream: () => ({ unsubscribe: () => {} }),
      trace: () => replayOnly(),
      ask: async () => replayOnly(),
      expand: async () => replayOnly(),
      close: async () => replayOnly(),
      interact: async () => replayOnly(),
      onAttach: () => {},
      onDetach: () => {},
    };
  }

  /**
   * Capture the learner-durable subset of this surface (mastery + durable-tier memory) and merge it
   * into the owning learner's cross-surface cognition profile (DPS-004), which seeds their future
   * surfaces. In-memory always; persisted when `COS_PERSIST_DIR` is set. Idempotent.
   */
  private captureCognition(hosted: HostedSurface): void {
    if (!hosted.learnerId) return; // legacy surface with no durable learner to attribute cognition to
    const seed = extractLearnerCognition(
      hosted.fixture.world,
      hosted.fixture.memory,
      hosted.learnerId,
    );
    this.learners.mergeCognition(hosted.learnerId, seed);
  }

  /** Persist the world + memory snapshots for live rehydration (DPS-002). No-op without persistence. */
  private persistSnapshots(surfaceId: string, fixture: DemoFixture): void {
    if (!this.persistDir) return;
    const dir = this.surfaceDir(surfaceId);
    writeFileSync(join(dir, "world.json"), JSON.stringify(fixture.world.snapshot()), "utf8");
    writeFileSync(join(dir, "memory.json"), JSON.stringify(fixture.memory.history()), "utf8");
  }

  /**
   * Rehydrate a persisted surface into a LIVE session (DPS-002): restore world + memory + event log,
   * `resume()` the existing id, and re-attach the durable sink so new events keep appending. Returns
   * undefined when the world/memory snapshots are missing or corrupt (caller falls back to read-side).
   */
  private async rehydrate(surfaceId: string, dir: string): Promise<HostedSurface | undefined> {
    const worldPath = join(dir, "world.json");
    const memoryPath = join(dir, "memory.json");
    if (!existsSync(worldPath) || !existsSync(memoryPath)) return undefined;

    let restore: DemoRestore;
    let goal = "";
    let learnerId: string | undefined;
    try {
      const meta = JSON.parse(readFileSync(join(dir, "meta.json"), "utf8")) as {
        goal?: string;
        learnerId?: string;
      };
      goal = meta.goal ?? "";
      learnerId = meta.learnerId;
      restore = {
        worldSnapshot: JSON.parse(readFileSync(worldPath, "utf8")) as DemoRestore["worldSnapshot"],
        memoryMutations: JSON.parse(
          readFileSync(memoryPath, "utf8"),
        ) as DemoRestore["memoryMutations"],
        events: new FileEventTransport(join(dir, "events.jsonl")).readAll(),
        surfaceId,
      };
    } catch {
      return undefined; // corrupt snapshot → read-side fallback
    }

    // Resume under the SAME learner (DPS-003) so a new ask keeps the right identity/trust. If the
    // surface names a learner we cannot load, fall back to read-side rather than rehydrate wrongly.
    let learner: { userId: string; cid: string; trustLevel: number } | undefined;
    if (learnerId !== undefined) {
      const record = this.learners.get(learnerId);
      if (!record) return undefined;
      learner = { userId: record.learnerId, cid: record.cid, trustLevel: record.trustLevel };
    }

    const { inner, provider } = await resolveModel();
    const voiceRuntime = this.injectedVoice ?? (await resolveVoice());
    const voice = voiceRuntime ? createVoiceSynthesizer(voiceRuntime, this.media) : undefined;
    const imageRuntime = this.imageRuntime ?? (await resolveImage());
    const mediaGen = createMediaGenerator(imageRuntime, this.media);
    const fixture = buildDemoSession({
      modelFactory: (bus, clock, idGenerator) =>
        new RecordingModelRuntime({ mode: "record", bus, inner, provider, clock, idGenerator }),
      restore,
      ...(learner ? { learner } : {}),
      ...(voice ? { voice } : {}),
      media: mediaGen,
      streamRevealMs: 45,
      // UCS (ADR-0030): the product surface renders Cognitive Frames — distilled MCCR on the board
      // with a SEPARATE narration script — not a prose explanation block. Gateway-only (CLI/tests
      // exercise the legacy explanation-block path so `expand` and the substrate stay covered).
      composer: true,
      // UCS (ADR-0030; Phase 2): decompose each concept into a progressive sequence of Cognitive
      // Frames (and render practice/assessment as frames), instead of a single composed frame.
      framePlanner: true,
      ...(provider === "gemini"
        ? { evaluationModel: inner, embedFn: (t: string) => inner.embed(t) }
        : {}),
    });
    const resumed = fixture.surface.resume(surfaceId);
    if (!resumed.ok) return undefined;

    // Re-attach the durable sink: history is already on disk and hydrate did not re-deliver, so this
    // captures only NEW events, appending them after the existing log.
    const log = new FileEventTransport(join(dir, "events.jsonl"));
    fixture.bus.subscribe(">", async (event) => {
      await log.publish(event.event_type, event);
    });

    const hosted: HostedSurface = {
      surfaceId,
      fixture,
      goal,
      ...(learnerId !== undefined ? { learnerId } : {}),
      gatewayHlc: hlcInit("surface-gateway"),
    };
    this.surfaces.set(surfaceId, hosted);
    return hosted;
  }

  /**
   * Run one ask cycle over the living environment (governed; events flow to the stream).
   * The curriculum agent generates a concept DAG for the goal first, so any goal yields its own
   * living timeline (PCR §12); the learning cycle then runs over that curriculum.
   */
  private async runAsk(
    hosted: HostedSurface,
    goal: string,
  ): Promise<Result<SurfaceAskResult, CosError>> {
    // Intent inference (kernel/intent-inference): interpret the goal into the session's intent lease.
    // Best-effort — a blocked/failed interpretation (e.g. an untrusted learner) must not change the
    // existing ask-degradation behavior; the cycle's own governance gates remain the decider.
    await hosted.fixture.inferIntent(goal);
    // Context-lease-bounded retrieval (DPS-005): assemble the learner's relevant prior knowledge into
    // working memory for this ask, bounded by their context lease. A fresh learner assembles nothing.
    await hosted.fixture.assembleContext(goal);
    const curriculum = await hosted.fixture.generateCurriculum(goal);
    if (!curriculum.ok) return err(curriculum.error);
    return hosted.fixture.surface.ask(curriculum.value);
  }

  /** Emit a `gateway.*` boundary-observability event (recorded-observation, never folded). */
  private emitBoundaryEvent(
    hosted: HostedSurface,
    eventType: "gateway.stream.attached" | "gateway.stream.detached",
  ): void {
    const created = createEvent(
      {
        eventType,
        producerCid: "cog-surface-gateway",
        producerType: "gateway.surface",
        payload: { surface_id: hosted.surfaceId },
        classification: "internal",
        retention: "1d",
        replayBehavior: "recorded-observation",
      },
      { clock: hosted.fixture.clock, hlc: hosted.gatewayHlc, idGenerator: this.gatewayIds },
    );
    hosted.gatewayHlc = created.hlc;
    void hosted.fixture.bus.publish(created.event);
  }
}
