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
  PgVectorStore,
  PostgresLearnerStore,
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
import type { ModelRuntime, VectorStore } from "@inevitable/contracts";
import { createEvent } from "@inevitable/events";
import type { CognitiveEvent } from "@inevitable/protocols";
import {
  CosError,
  CryptoIdGenerator,
  SystemClock,
  hlcInit,
  ok,
  err,
  type Hlc,
  type Result,
} from "@inevitable/shared";
import {
  foldSurfaceEvents,
  type FusedSynthesisView,
  type SurfaceAskInput,
  type SurfaceAskResult,
  type SurfaceState,
} from "@inevitable/surface";
import { geminiApiKey, geminiModel, persistDir, strictModel, supabaseBackendUrl } from "./env";
import { IntelligenceSink } from "./intelligence";
import { LearnerRegistry, type DurableLearnerStore, type LearnerRecord } from "./learners";
import { SourceHub, type RegisteredSource } from "./sources";
import { SourcePlanePersistence } from "./source-persistence";
import type { WebFetchFn } from "./crawler";
import type {
  ConceptTimeline,
  Creation,
  FrontierOverlay,
  FusionResult,
} from "@inevitable/source-environment";
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
  /**
   * Per-surface command queue (issue 20): mutating commands run serially so a second ask/advance can
   * never reset the session's timeline/lookahead under an in-flight one. Interleaved cognition in the
   * canonical log is a correctness hazard, not a feature.
   */
  queue: Promise<unknown>;
  /**
   * The curriculum generated on the first ask, cached so subsequent `advance` commands teach the NEXT
   * concept on the SAME path without regenerating the DAG (understanding compounds; the concept-id space
   * stays stable, so look-ahead speculation can actually promote). Set by `runAsk`, read by `runAdvance`.
   */
  curriculum?: SurfaceAskInput;
  /**
   * Source versions bound to this surface (CSE M5). The session's `sourceEvidence` seam closes over
   * this array (late-bound — sources attach after creation), so viewport planning sees exactly the
   * attached environments at teach time.
   */
  readonly sourceBindings: string[];
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
  /** Teach the next (or a requested) concept on the existing path — the continuity primitive. */
  advance(conceptId?: string): Promise<Result<SurfaceAskResult, CosError>>;
  expand(blockId: string, layer: number): ReturnType<Surface["expand"]>;
  close(reason?: string): ReturnType<Surface["close"]>;
  /** Apply a governed learner interaction (S1.3, ADR-0024). */
  interact(input: Parameters<Surface["interact"]>[0]): ReturnType<Surface["interact"]>;
  /** Grade a learner's answer to a concept's practice problem into genuine earned mastery (F14). */
  answer(conceptId: string, text: string): ReturnType<Surface["submitAnswer"]>;
  /** Bind a registered Canonical Source Environment to this surface (CSE M5, CSE-008 §3.1). */
  attachSource(sourceVersionId: string): Promise<Result<RegisteredSource, CosError>>;
  /**
   * Teach FROM a bound source: derive the curriculum from the document's own concepts/sections and
   * run the ask over it — the document becomes the timeline (R2c, ADR-0057 D3). Defaults to the
   * surface's first bound source when no id is given.
   */
  teachSource(sourceVersionId?: string): Promise<Result<SurfaceAskResult, CosError>>;
  /** Reconcile the surface's bound sources over a concept set — Source Fusion (CSE M9 T1, CSE-015). */
  fuse(conceptRefs: readonly string[]): Promise<Result<FusionResult, CosError>>;
  /** Research a concept's living-knowledge frontier via governed web search (CSE M9 Frontier T1). */
  researchFrontier(conceptRef: string): Promise<Result<FrontierOverlay, CosError>>;
  /** Research a concept's Temporal Knowledge Model via governed web search (CSE M9 TKM T1). */
  researchTimeline(conceptRef: string): Promise<Result<ConceptTimeline, CosError>>;
  /** Open a learner creation — their artifact-in-progress (CSE M11 T1, CSE-016, no-ghostwriter law). */
  startCreation(
    input: Readonly<{
      kind: string;
      title: string;
      conceptRefs: readonly string[];
      draft?: string;
    }>,
  ): Promise<Result<Creation, CosError>>;
  /** Offer a disclosed assist (scaffold|critique|provocation|reference) over a creation — never the artifact. */
  assistCreation(
    creationId: string,
    mode: string,
    draft?: string,
  ): Promise<Result<Creation, CosError>>;
  /** Mark a creation complete with the learner's final draft (CSE M11 T1). */
  completeCreation(creationId: string, draft?: string): Promise<Result<Creation, CosError>>;
  /** Consent a completed creation into the substrate as a Cognitive Source (ADR-0051, contribution). */
  contributeCreation(
    creationId: string,
    consent: boolean,
  ): Promise<Result<{ creation: Creation; source: RegisteredSource }, CosError>>;
  /** Revoke a contribution's consent and cascade a redaction (ADR-0054 — the learner's right to un-share). */
  revokeCreation(creationId: string): Promise<
    Result<
      {
        creation: Creation;
        source_version_id: string;
        redacted_counts: { commons_entries: number; content_withheld: number };
      },
      CosError
    >
  >;
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
    const connected = await GeminiModelRuntime.connect({ apiKey, defaultModel: geminiModel() });
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
  /** Resolves once the durable learner store has attached (or failed loudly). */
  private learnersReady: Promise<void> = Promise.resolve();
  /** Durable retrieval index (ADR-0065); undefined ⇒ per-surface in-memory (ephemeral) default. */
  private vectors: VectorStore | undefined;
  /** Test seam: inject a deterministic voice runtime instead of resolving Gemini by key. */
  private readonly injectedVoice: VoiceRuntime | undefined;
  /** Image runtime (S2.1b, SRF-006): injected by tests; resolved per-create in production. */
  private readonly imageRuntime: ImageRuntime | null;
  /** Intelligence Plane seam (ADR-0035): session-close distillation + chronicle mirror. */
  readonly intelligence: IntelligenceSink;
  /** The Canonical Source Environment registry (CSE M5): cross-surface; surfaces bind versions. */
  readonly sources: SourceHub;
  /**
   * Resolves once the durable source plane has been rehydrated (ADR-0055 D1). The server awaits this
   * before serving any route, so a restart never exposes a half-loaded source plane. Resolves
   * immediately when persistence is off (the offline default).
   */
  readonly ready: Promise<void>;

  constructor(
    deps: {
      voiceRuntime?: VoiceRuntime;
      /** Inject a specific image runtime (tests use this); production calls resolveImage() per-create. */
      imageRuntime?: ImageRuntime;
      persistDir?: string;
      intelligenceSink?: IntelligenceSink;
      /** Inject the governed web-fetch seam (tests use a fake so the suite stays offline; ADR-0052). */
      webFetch?: WebFetchFn;
      /** Inject the durable learner store (tests use a fake pool; ADR-0034, migration 0004). */
      learnerStore?: DurableLearnerStore;
    } = {},
  ) {
    this.persistDir = deps.persistDir ?? persistDir();
    // Durable source plane (ADR-0055): under COS_PERSIST_DIR the hub persists every mutation and
    // rehydrates registrations under their original ids so attach events / commons / consent resolve
    // across restarts. Off ⇒ process-lifetime (the offline default), `ready` resolves immediately.
    const persistence = this.persistDir ? new SourcePlanePersistence(this.persistDir) : undefined;
    this.sources = new SourceHub({
      ...(deps.webFetch ? { webFetch: deps.webFetch } : {}),
      ...(persistence ? { persistence } : {}),
    });
    this.ready = persistence ? this.sources.rehydrate() : Promise.resolve();
    this.injectedVoice = deps.voiceRuntime;
    this.imageRuntime = deps.imageRuntime ?? null;
    this.intelligence =
      deps.intelligenceSink ??
      new IntelligenceSink(supabaseBackendUrl() ? { dbUrl: supabaseBackendUrl() } : {});
    this.media = this.persistDir
      ? new FileMediaStore(join(this.persistDir, "media"))
      : new InMemoryMediaStore();
    this.learners = new LearnerRegistry({
      ...(this.persistDir ? { persistDir: this.persistDir } : {}),
      ...(deps.learnerStore ? { store: deps.learnerStore } : {}),
    });
    // Durable learner identity + carried cognition (ADR-0034, migration 0004). Attached
    // asynchronously so boot never blocks on the database; until it lands the registry serves from
    // the local tier, exactly as before. Without it, learner memory dies on every redeploy.
    const dbUrl = supabaseBackendUrl();
    if (dbUrl && !deps.learnerStore) {
      this.learnersReady = PostgresLearnerStore.connect({ connectionString: dbUrl })
        .then((result) => {
          if (result.ok) this.learners.attach(result.value);
          else console.error(`[learners] durable store unavailable: ${result.error.message}`);
        })
        .catch((cause: unknown) => {
          console.error(`[learners] durable store connect threw: ${String(cause)}`);
        });
      // Fold into `ready` so the first create() never races an unattached store and mints a learner
      // that only ever existed on the ephemeral tier.
      this.ready = Promise.all([this.ready, this.learnersReady]).then(() => undefined);
    }
    // Durable retrieval index (ADR-0065): a `PgVectorStore` over the `vectors` table so a learner's
    // semantic memory is retrievable across sessions and redeploys — "retrieval is half of memory".
    // Attached asynchronously and folded into `ready`; absent ⇒ per-surface in-memory (ephemeral),
    // the offline default. Embeddings on this path are replay-safe via RecordingModelRuntime.
    if (dbUrl) {
      const vectorsReady = PgVectorStore.connect({ connectionString: dbUrl })
        .then((result) => {
          if (result.ok) this.vectors = result.value;
          else console.error(`[vectors] durable store unavailable: ${result.error.message}`);
        })
        .catch((cause: unknown) => {
          console.error(`[vectors] durable store connect threw: ${String(cause)}`);
        });
      this.ready = Promise.all([this.ready, vectorsReady]).then(() => undefined);
    }
  }

  /** A learner profile + the surfaces they own (resume-by-learner, DPS-003). */
  async getLearner(learnerId: string): Promise<LearnerRecord | undefined> {
    return this.learners.get(learnerId);
  }

  /** Resolve a learner by API key (bearer credential). Returns undefined for unknown keys. */
  async getLearnerByApiKey(apiKey: string): Promise<LearnerRecord | undefined> {
    return this.learners.getByApiKey(apiKey);
  }

  private surfaceDir(surfaceId: string): string {
    return join(this.persistDir!, "surfaces", surfaceId);
  }

  /**
   * R5 (ADR-0060): the concept's fused cross-source synthesis as a browser-safe view for FUSION MODE
   * composition. Null unless ≥2 bound sources cover the concept with a real (non-degraded) weave —
   * so a single-source or unfused concept teaches unchanged. Best-effort: a fuse error yields null
   * (teaching falls back to single-source/goal, never a failed frame). Cheap guard skips `fuse()`
   * entirely below two sources; `fuse()` itself is memoized over the version+concept set.
   */
  private async fusedSynthesisView(
    bindings: readonly string[],
    conceptId: string,
    _conceptTitle: string,
  ): Promise<FusedSynthesisView | null> {
    if (bindings.length < 2) return null;
    try {
      const result = await this.sources.fuse(bindings, [conceptId]);
      const concept = result.concepts.find((c) => c.concept_ref === conceptId);
      if (!concept) return null;
      const synth = concept.synthesis;
      const covering = concept.source_treatments.filter((t) => t.coverage !== "absent");
      if (!synth || synth.degraded || covering.length < 2) return null;
      const titleById = new Map(
        concept.source_treatments.map((t) => [t.source_version_id, t.title] as const),
      );
      return {
        concept_ref: conceptId,
        prose: synth.prose,
        cited_sources: synth.cited_source_ids.map((id) => titleById.get(id) ?? id),
        acknowledges_disagreement: synth.acknowledges_disagreement,
        source_count: covering.length,
        treatments: covering.map((t) => ({ title: t.title, emphasis: t.emphasis })),
      };
    } catch {
      return null;
    }
  }

  /** Create + enter a new cognitive environment, returning the surface id + owning learner id. */
  async create(
    goal: string,
    options: CreateSurfaceOptions = {},
  ): Promise<Result<{ surfaceId: string; learnerId: string }, CosError>> {
    const { inner, provider } = await resolveModel();
    // CSE M9 T2+T3 (ADR-0041/0042): light up fusion cognition on the shared SourceHub when a real
    // model is available — Source Fusion then extracts each source's claims, detects genuine
    // cross-source contradictions, and weaves a fused explanation per concept. Idempotent +
    // gateway-only; with the null model, fusion stays on the T1 structured path.
    if (provider === "gemini") this.sources.enableFusionCognition(inner, provider);
    const voiceRuntime = this.injectedVoice ?? (await resolveVoice());
    const voice = voiceRuntime ? createVoiceSynthesizer(voiceRuntime, this.media) : undefined;
    const imageRuntime = this.imageRuntime ?? (await resolveImage());
    const mediaGen = createMediaGenerator(imageRuntime, this.media);
    const seed = options.seed ?? `gw-${++this.counter}`;
    // Resolve (or mint) the durable learner that will own this surface (DPS-003).
    const learner = await this.learners.resolveOrCreate({
      ...(options.learnerId !== undefined ? { learnerId: options.learnerId } : {}),
      ...(options.trustLevel !== undefined ? { trustLevel: options.trustLevel } : {}),
    });
    // A returning learner's NEW surface draws on their prior cross-surface cognition (DPS-004): load
    // the durable profile and seed it (silently) into the fresh substrate. Empty for a fresh learner.
    const learnerSeed = await this.learners.readCognition(learner.learnerId);
    // CSE M5: the session's source-evidence seam closes over this surface's (late-bound) source
    // bindings — attached after creation, read at frame-composition time.
    const sourceBindings: string[] = [];
    const fixture = buildDemoSession({
      modelFactory: (bus, clock, idGenerator) =>
        new RecordingModelRuntime({ mode: "record", bus, inner, provider, clock, idGenerator }),
      seed,
      // Real wall-clock time in production: a live surface must emit honest timestamps + HLC +
      // work-timing latencies, never the CLI fixture's frozen 2026-06-11 clock.
      clock: new SystemClock(),
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
      // B (ADR-0063): stream the board — MCCR anchors surface as they finish generating (gateway-only).
      frameStreamEnabled: true,
      // UCS (ADR-0030): the product surface renders Cognitive Frames — distilled MCCR on the board
      // with a SEPARATE narration script — not a prose explanation block. Gateway-only (CLI/tests
      // exercise the legacy explanation-block path so `expand` and the substrate stay covered).
      composer: true,
      // UCS (ADR-0030; Phase 2): decompose each concept into a progressive sequence of Cognitive
      // Frames (and render practice/assessment as frames), instead of a single composed frame.
      framePlanner: true,
      // Look-ahead budget: a rolling buffer of 3 next concepts pre-composed in the background
      // (ADR-0064, ADR-0063 Phase D) so advancing is instant and the lesson builds continuously
      // ahead of the learner. Recorded, never surfaced until promoted. Live-governable.
      lookaheadBudget: 3,
      // UCS (ADR-0030; Phase 4): the Image Agent owns the image-as-cognition decision (prompt +
      // caption + callout labels), replacing the composer's inline image_plan on the frame path.
      imagePlanner: true,
      // R4-model (CSE-018, ADR-0058): the RIA assigns each element's epistemic role + hierarchy;
      // degrades to the deterministic plan floor when the model is unavailable.
      representation: true,
      // CSE M5: source evidence for viewport planning, over whatever is attached at teach time.
      sourceEvidence: {
        anchorsForConcept: (conceptId: string, conceptTitle: string) =>
          this.sources.evidenceFor(sourceBindings, conceptId, conceptTitle),
        // R5 (ADR-0060): the concept's fused cross-source synthesis for FUSION MODE composition.
        fusedSynthesisForConcept: (conceptId: string, conceptTitle: string) =>
          this.fusedSynthesisView(sourceBindings, conceptId, conceptTitle),
      },
      // CSE M7 T1: the Cognitive Theater — the Director conducts + Scenes wrap frames. Gateway-only
      // (CLI/tests exercise the pre-Theater frame path so backward compatibility stays covered).
      theater: true,
      // CSE M9 LKS T1 (ADR-0045): on verified mastery, surface the REAL web-grounded frontier
      // (ADR-0043) — grounded-or-deferred, never the ungrounded breadcrumb. Only meaningful with a
      // real model (the SourceHub's frontier unit is wired then); with the null model it honestly
      // yields nothing and the readiness gate defers.
      frontierProvider: {
        researchFrontier: async (conceptId: string, conceptTitle: string) => {
          const overlay = await this.sources.researchFrontier(
            conceptTitle || conceptId,
            sourceBindings[0] ?? null,
          );
          return {
            concept_ref: conceptId,
            entries: overlay.entries.map((e) => ({
              kind: e.kind,
              summary: e.summary,
              external_refs: e.external_refs.map((r) => ({ uri: r.uri, title: r.title })),
            })),
            degraded: overlay.degraded,
          };
        },
      },
      ...(provider === "gemini"
        ? { evaluationModel: inner, embedFn: (t: string) => inner.embed(t) }
        : {}),
      ...(this.vectors ? { vectors: this.vectors } : {}),
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
        // W1 slice (ADR-0035): best-effort chronicle mirror into Postgres when configured.
        this.intelligence.mirror(event);
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
    await this.learners.recordSurface(learner.learnerId, { surfaceId, goal });

    const hosted: HostedSurface = {
      surfaceId,
      fixture,
      goal,
      learnerId: learner.learnerId,
      gatewayHlc: hlcInit("surface-gateway"),
      queue: Promise.resolve(),
      sourceBindings,
    };
    this.surfaces.set(surfaceId, hosted);

    // CSE M6 (ADR-0037): a returning learner's episode resume card — derived ONLY from the
    // intelligence plane's latest episode + delta artifacts. No artifacts ⇒ no card (a fresh
    // learner never gets a fabricated welcome-back). Best-effort: never fails create.
    await this.projectResumeCard(hosted, learner.cid);

    return ok({ surfaceId, learnerId: learner.learnerId });
  }

  /** Build + emit the resume card from the learner's latest episode/delta artifacts (CSE-005 §4). */
  private async projectResumeCard(hosted: HostedSurface, learnerCid: string): Promise<void> {
    try {
      const episode = await this.intelligence.latestFor(learnerCid, "learner.episode");
      if (!episode) return;
      const delta = await this.intelligence.latestFor(learnerCid, "learner.understanding-delta");
      const body = episode.body as {
        concept_refs?: string[];
        confusions?: { description?: string; concept_ref?: string; state?: string }[];
        outcome?: { summary?: string };
      };
      const conceptsTouched = Array.isArray(body.concept_refs) ? body.concept_refs : [];
      const openConfusions = (Array.isArray(body.confusions) ? body.confusions : [])
        .filter((c) => c.state === "open")
        .map((c) => ({ description: c.description ?? "", concept_ref: c.concept_ref ?? "" }));
      // distilled_hlc leads with 16 zero-padded decimal wall-clock ms digits (shared/hlc).
      const distilledMs = Number.parseInt(episode.distilled_hlc.slice(0, 16), 10);
      const daysSince =
        Number.isFinite(distilledMs) && distilledMs > 0
          ? Math.max(0, Math.floor((Date.now() - distilledMs) / 86_400_000))
          : 0;
      await hosted.fixture.surface.projectResumeCard({
        episodeRef: episode.artifact_id,
        deltaRef: delta?.artifact_id ?? null,
        summary: body.outcome?.summary ?? "",
        lastConceptRef: conceptsTouched[conceptsTouched.length - 1] ?? null,
        conceptsTouched,
        openConfusions,
        daysSince,
      });
    } catch {
      /* resume projection is best-effort — a create must never fail on it */
    }
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
      ask: (goal) =>
        this.serialize(hosted, async () => {
          const result = await this.runAsk(hosted, goal);
          this.persistSnapshots(hosted.surfaceId, fixture);
          await this.captureCognition(hosted);
          return result;
        }),
      advance: (conceptId) =>
        this.serialize(hosted, async () => {
          const result = await this.runAdvance(hosted, conceptId);
          this.persistSnapshots(hosted.surfaceId, fixture);
          await this.captureCognition(hosted);
          return result;
        }),
      expand: (blockId, layer) =>
        this.serialize(hosted, async () => {
          const result = await fixture.surface.expand(blockId, layer);
          this.persistSnapshots(hosted.surfaceId, fixture);
          return result;
        }),
      close: async (reason) => {
        const result = await fixture.surface.close(reason);
        this.persistSnapshots(hosted.surfaceId, fixture);
        // M3.5 D1 wiring (ADR-0035): fold the closed session's chronicle into the Intelligence
        // Plane — store first, then emit `intelligence.distilled`. Best-effort: never fails close.
        const learner = hosted.learnerId ? await this.learners.get(hosted.learnerId) : undefined;
        await this.intelligence.distillAndStore(
          [...fixture.bus.log],
          {
            learner_cid: learner?.cid ?? hosted.learnerId ?? `cog-unattributed-${hosted.surfaceId}`,
            tenant_id: "default",
            session_id: hosted.surfaceId,
          },
          fixture.bus,
        );
        return result;
      },
      interact: (input) =>
        this.serialize(hosted, async () => {
          const result = await fixture.surface.interact(input);
          this.persistSnapshots(hosted.surfaceId, fixture);
          // A reshaping interaction re-runs the governed cycle, so capture cross-surface cognition.
          if (result.ok && result.value.effect === "dispatched")
            await this.captureCognition(hosted);
          return result;
        }),
      answer: (conceptId, text) =>
        this.serialize(hosted, async () => {
          const result = await fixture.surface.submitAnswer({ conceptId, answer: text });
          this.persistSnapshots(hosted.surfaceId, fixture);
          // A graded answer records mastery evidence — capture cross-surface cognition.
          if (result.ok) await this.captureCognition(hosted);
          return result;
        }),
      // CSE M5: bind a registered source environment — the attach event lands on the surface's
      // canonical log, and the binding joins the evidence seam for subsequent frame composition.
      attachSource: (sourceVersionId) =>
        this.serialize(hosted, async () => {
          const registered = this.sources.registered(sourceVersionId);
          if (!registered) {
            return err(gatewayError("unknown source version", { sourceVersionId })) as Result<
              RegisteredSource,
              CosError
            >;
          }
          const attached = await fixture.surface.attachSource({
            sourceId: registered.source_id,
            sourceVersionId: registered.source_version_id,
            modality: registered.modality,
            title: registered.title,
            layersAvailable: registered.layers_available,
            contentRef: registered.content_ref,
          });
          if (!attached.ok) return attached;
          if (!hosted.sourceBindings.includes(sourceVersionId)) {
            hosted.sourceBindings.push(sourceVersionId);
          }
          this.persistSnapshots(hosted.surfaceId, fixture);
          return ok(registered);
        }),
      // R2c (ADR-0057 D3): teach FROM a bound source — the document becomes the timeline. Build the
      // curriculum from the source's own concepts/sections (in teaching order), cache it so `advance`
      // walks the rest of the document, and run the ask. The frame pipeline is now source-fed (R2a/b).
      teachSource: (sourceVersionId) =>
        this.serialize(hosted, async () => {
          const versionId = sourceVersionId ?? hosted.sourceBindings[0];
          if (!versionId) {
            return err(gatewayError("no source bound to this surface to teach from")) as Result<
              SurfaceAskResult,
              CosError
            >;
          }
          const curriculum = this.sources.curriculumFor(versionId);
          if (!curriculum || curriculum.concepts.length === 0) {
            return err(
              gatewayError("source has no teachable structure yet (no concepts or headings)", {
                versionId,
              }),
            ) as Result<SurfaceAskResult, CosError>;
          }
          const focusTitle =
            curriculum.concepts.find((c) => c.id === curriculum.entry)?.title ?? curriculum.entry;
          const input: SurfaceAskInput = {
            goal: `Teach me this document`,
            pathId: `path-source-${versionId.slice(0, 16)}`,
            concepts: curriculum.concepts.map((c) => ({
              id: c.id,
              title: c.title,
              prerequisites: c.prerequisites,
            })),
            focusConceptId: curriculum.entry,
            explanationPrompt: `Teach "${focusTitle}" directly from the source passage`,
            practicePrompt: `Give one concrete practice problem for ${focusTitle}`,
            mastery: {
              assessorCid: "cog-source-teach",
              passed: true,
              confidence: 0.7,
              evidence: [
                {
                  kind: "readiness",
                  note: "source section taught from its own passage; learner demonstration pending",
                },
              ],
            },
          };
          hosted.curriculum = input;
          const result = await fixture.surface.ask(input);
          this.persistSnapshots(hosted.surfaceId, fixture);
          return result;
        }),
      // CSE M9 T1: reconcile the surface's bound sources over a concept set (Source Fusion).
      fuse: async (conceptRefs) => {
        if (hosted.sourceBindings.length === 0) {
          return err(gatewayError("no sources bound to this surface to fuse"));
        }
        const learner = hosted.learnerId ? await this.learners.get(hosted.learnerId) : undefined;
        const result = await this.sources.fuse(
          hosted.sourceBindings,
          conceptRefs,
          learner?.cid ?? hosted.learnerId ?? null,
        );
        return ok(result);
      },
      // CSE M9 Frontier T1: research a concept's living-knowledge frontier via governed web search.
      researchFrontier: async (conceptRef) => {
        const versionId = hosted.sourceBindings[0] ?? null;
        const overlay = await this.sources.researchFrontier(conceptRef, versionId);
        return ok(overlay);
      },
      // CSE M9 TKM T1: research a concept's Temporal Knowledge Model via governed web search.
      researchTimeline: async (conceptRef) => {
        const versionId = hosted.sourceBindings[0] ?? null;
        const timeline = await this.sources.researchTimeline(conceptRef, versionId);
        return ok(timeline);
      },
      // CSE M11 T1: open a learner creation (their artifact) — the system only ever attaches assists.
      startCreation: async (input) => {
        const learner = hosted.learnerId ? await this.learners.get(hosted.learnerId) : undefined;
        const creation = await this.sources.startCreation({
          ...input,
          learnerCid: learner?.cid ?? hosted.learnerId ?? null,
        });
        return ok(creation);
      },
      // CSE M11 T1: offer a disclosed assist over a creation — never the artifact (no-ghostwriter law).
      assistCreation: async (creationId, mode, draft) => {
        const updated = await this.sources.assistCreation(creationId, mode, draft);
        if (!updated) return err(gatewayError("unknown creation", { creationId }));
        return ok(updated);
      },
      // CSE M11 T1: complete a creation with the learner's final draft.
      completeCreation: async (creationId, draft) => {
        const updated = await this.sources.completeCreation(creationId, draft);
        if (!updated) return err(gatewayError("unknown creation", { creationId }));
        return ok(updated);
      },
      // ADR-0051: consent a completed creation into the substrate as a Cognitive Source. On success
      // the new source is bound to THIS surface so the learner can immediately teach/fuse from it.
      // ADR-0055 D5: the binding goes through the SAME attachSource path every other binding uses, so
      // `surface.source.attached` lands on the canonical log — the client fold (and the Fuse gate)
      // agree with the server about what sources exist (state never changes without its event).
      contributeCreation: async (creationId, consent) => {
        const contributed = await this.sources.contributeCreation(creationId, { consent });
        if (contributed.ok) {
          const source = contributed.value.source;
          const attached = await fixture.surface.attachSource({
            sourceId: source.source_id,
            sourceVersionId: source.source_version_id,
            modality: source.modality,
            title: source.title,
            layersAvailable: source.layers_available,
            contentRef: source.content_ref,
          });
          if (attached.ok && !hosted.sourceBindings.includes(source.source_version_id)) {
            hosted.sourceBindings.push(source.source_version_id);
          }
          this.persistSnapshots(hosted.surfaceId, fixture);
        }
        return contributed;
      },
      // ADR-0054: revoke consent + cascade a redaction. Also unbind the redacted version from THIS
      // surface so a subsequent fuse can't reach the withdrawn source.
      revokeCreation: async (creationId) => {
        const revoked = await this.sources.revokeContribution(creationId);
        if (revoked.ok) {
          const idx = hosted.sourceBindings.indexOf(revoked.value.source_version_id);
          if (idx >= 0) {
            hosted.sourceBindings.splice(idx, 1);
            this.persistSnapshots(hosted.surfaceId, fixture);
          }
        }
        return revoked;
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
      advance: async () => replayOnly(),
      expand: async () => replayOnly(),
      close: async () => replayOnly(),
      interact: async () => replayOnly(),
      answer: async () => replayOnly(),
      attachSource: async () => replayOnly(),
      teachSource: async () => replayOnly(),
      fuse: async () => replayOnly(),
      researchFrontier: async () => replayOnly(),
      researchTimeline: async () => replayOnly(),
      startCreation: async () => replayOnly(),
      assistCreation: async () => replayOnly(),
      completeCreation: async () => replayOnly(),
      contributeCreation: async () => replayOnly(),
      revokeCreation: async () => replayOnly(),
      onAttach: () => {},
      onDetach: () => {},
    };
  }

  /**
   * Capture the learner-durable subset of this surface (mastery + durable-tier memory) and merge it
   * into the owning learner's cross-surface cognition profile (DPS-004), which seeds their future
   * surfaces. In-memory always; persisted when `COS_PERSIST_DIR` is set. Idempotent.
   */
  private async captureCognition(hosted: HostedSurface): Promise<void> {
    if (!hosted.learnerId) return; // legacy surface with no durable learner to attribute cognition to
    const seed = extractLearnerCognition(
      hosted.fixture.world,
      hosted.fixture.memory,
      hosted.learnerId,
    );
    await this.learners.mergeCognition(hosted.learnerId, seed);
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
      const record = await this.learners.get(learnerId);
      if (!record) return undefined;
      learner = { userId: record.learnerId, cid: record.cid, trustLevel: record.trustLevel };
    }

    const { inner, provider } = await resolveModel();
    const voiceRuntime = this.injectedVoice ?? (await resolveVoice());
    const voice = voiceRuntime ? createVoiceSynthesizer(voiceRuntime, this.media) : undefined;
    const imageRuntime = this.imageRuntime ?? (await resolveImage());
    const mediaGen = createMediaGenerator(imageRuntime, this.media);
    // CSE M5 + ADR-0055 D3: rebind the surface's sources from its own event log. The durable source
    // plane has already rehydrated (host.ready), so fold the restored surface events and re-bind
    // every attached version the hub still serves — the Living Reference, evidence seam, and Fuse
    // gate survive the restart. A version the hub no longer serves (e.g. redacted) is dropped.
    const restoredState = foldSurfaceEvents(
      restore.events.filter((e) => e.event_type.startsWith(SURFACE_SUBJECT_PREFIX)),
      surfaceId,
    );
    const sourceBindings: string[] = (restoredState?.sources ?? [])
      .map((s) => s.source_version_id)
      .filter((id): id is string => typeof id === "string" && !!this.sources.registered(id));
    const fixture = buildDemoSession({
      modelFactory: (bus, clock, idGenerator) =>
        new RecordingModelRuntime({ mode: "record", bus, inner, provider, clock, idGenerator }),
      // Real wall-clock time on rehydration too (new events after resume must not collide with the
      // fixture's frozen time). Recorded events keep their original timestamps.
      clock: new SystemClock(),
      restore,
      ...(learner ? { learner } : {}),
      ...(voice ? { voice } : {}),
      media: mediaGen,
      streamRevealMs: 45,
      // B (ADR-0063): stream the board — MCCR anchors surface as they finish generating (gateway-only).
      frameStreamEnabled: true,
      // UCS (ADR-0030): the product surface renders Cognitive Frames — distilled MCCR on the board
      // with a SEPARATE narration script — not a prose explanation block. Gateway-only (CLI/tests
      // exercise the legacy explanation-block path so `expand` and the substrate stay covered).
      composer: true,
      // UCS (ADR-0030; Phase 2): decompose each concept into a progressive sequence of Cognitive
      // Frames (and render practice/assessment as frames), instead of a single composed frame.
      framePlanner: true,
      // Rolling look-ahead buffer of 3 (ADR-0064; matches create()).
      lookaheadBudget: 3,
      // UCS (ADR-0030; Phase 4): the Image Agent owns image-as-cognition (matches create()).
      imagePlanner: true,
      // R4-model (CSE-018, ADR-0058): the RIA (matches create()).
      representation: true,
      // CSE M5: source evidence over the (re-attached) bindings — matches create().
      sourceEvidence: {
        anchorsForConcept: (conceptId: string, conceptTitle: string) =>
          this.sources.evidenceFor(sourceBindings, conceptId, conceptTitle),
        // R5 (ADR-0060): fused cross-source synthesis for FUSION MODE — matches create().
        fusedSynthesisForConcept: (conceptId: string, conceptTitle: string) =>
          this.fusedSynthesisView(sourceBindings, conceptId, conceptTitle),
      },
      // CSE M7 T1: the Cognitive Theater — matches create().
      theater: true,
      ...(provider === "gemini"
        ? { evaluationModel: inner, embedFn: (t: string) => inner.embed(t) }
        : {}),
      ...(this.vectors ? { vectors: this.vectors } : {}),
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
      queue: Promise.resolve(),
      sourceBindings,
    };
    this.surfaces.set(surfaceId, hosted);
    return hosted;
  }

  /**
   * Run a mutating command serially per surface (issue 20): each awaits the previous so two asks can
   * never interleave and corrupt the canonical log. Failures don't poison the chain for later commands.
   */
  private serialize<T>(hosted: HostedSurface, work: () => Promise<T>): Promise<T> {
    const run = hosted.queue.then(work, work);
    hosted.queue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
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
    // Cache the curriculum so `advance` can teach the next concept on this same path without
    // regenerating the DAG — the loop compounds instead of restarting (review N4/§4.9).
    hosted.curriculum = curriculum.value;
    return hosted.fixture.surface.ask(curriculum.value);
  }

  /**
   * Advance the lesson to the NEXT (or an explicitly requested) concept on the EXISTING path — the
   * continuity primitive behind path-node clicks and the "continue" affordance. Reuses the cached
   * curriculum (no regeneration, stable concept ids) and only moves the focus, so the learner's
   * mastered path is preserved and look-ahead speculation can promote. Falls back to a fresh ask when
   * no curriculum is cached yet (e.g. a rehydrated surface whose first ask predates this field).
   */
  private async runAdvance(
    hosted: HostedSurface,
    conceptId?: string,
  ): Promise<Result<SurfaceAskResult, CosError>> {
    const cached = hosted.curriculum;
    if (!cached) return this.runAsk(hosted, hosted.goal);
    const nextFocus = this.resolveNextConcept(hosted, cached, conceptId);
    if (!nextFocus) return err(gatewayError("no further concept to advance to on this path"));
    const focusTitle = cached.concepts.find((c) => c.id === nextFocus)?.title ?? nextFocus;
    const input: SurfaceAskInput = {
      ...cached,
      focusConceptId: nextFocus,
      explanationPrompt: `Explain ${focusTitle} so a motivated beginner genuinely understands it`,
      practicePrompt: `Give one concrete practice problem for ${focusTitle}`,
    };
    hosted.curriculum = input;
    await hosted.fixture.assembleContext(focusTitle);
    return hosted.fixture.surface.ask(input);
  }

  /**
   * Resolve which concept to teach next: an explicit request (must be on the path), else the first
   * concept whose mastery is not yet recorded in the folded state, else the concept after the current
   * focus in curriculum order.
   */
  private resolveNextConcept(
    hosted: HostedSurface,
    cached: SurfaceAskInput,
    requested?: string,
  ): string | null {
    const ids = cached.concepts.map((c) => c.id);
    if (requested && ids.includes(requested)) return requested;
    const state = hosted.fixture.surface.state();
    const mastered = new Set(
      (state?.timeline?.nodes ?? [])
        .filter((n) => n.status === "mastered")
        .map((n) => n.concept_id),
    );
    const firstUnmastered = ids.find((id) => !mastered.has(id));
    if (firstUnmastered) return firstUnmastered;
    const currentIdx = ids.indexOf(cached.focusConceptId);
    return ids[currentIdx + 1] ?? null;
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
