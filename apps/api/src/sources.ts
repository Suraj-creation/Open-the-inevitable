/**
 * SourceHub — the gateway's Canonical Source Environment registry (CSE M5).
 *
 * One hub per host, cross-surface (the source substrate is shared; surfaces *bind* versions).
 * Registration runs the M1 pipeline: content-addressed `registerVersion` → `canonicalize`
 * (structural + visual layers via the modality adapter) — the environment is usable at the anchor
 * index (CSE-002 §4). Canonical bytes are kept for the gateway source-content route (clients
 * render natively from them and can prove fidelity by hash — ADR-0036) and durably uploaded to
 * Supabase Storage when configured (best-effort; the hash is the identity either way).
 *
 * `evidenceFor` is the SourceEvidenceProvider seam behind the surface session's viewport
 * planning: existing concept-bound anchors are preferred (canonicalization/L2 already bound
 * them); otherwise anchors are created on demand from a deterministic structural-text match —
 * **teaching attention drives canonicalization depth** (CSE-003). Only resolved anchors are
 * returned: skip, never mis-highlight (CSE-008 §12).
 *
 * Durability (ADR-0055): when constructed with a `SourcePlanePersistence`, every mutation persists
 * best-effort (versions + bytes + commons + consent envelopes + the redaction set + creations) and
 * `rehydrate()` replays registrations at boot under their ORIGINAL ids (explicit-id replay,
 * ADR-0055 D2) — so attach events in surface logs, commons entries, and consent envelopes stay
 * resolvable across restarts, and a revocation's withholding survives a deploy (content route 410).
 * Without persistence the hub stays process-lifetime (the offline default).
 */
import {
  PdfjsModalityAdapter,
  RecordingModelRuntime,
  SupabaseStorageObjectStore,
} from "@inevitable/adapters";
import { InMemoryEventBus } from "@inevitable/events";
import type { ModelRuntime } from "@inevitable/contracts";
import type { CognitionPacket } from "@inevitable/protocols";
import {
  ClaimGraphService,
  ClaimReasoningUnit,
  CreationAssistUnit,
  FrontierResearchUnit,
  FusionSynthesisUnit,
  MVP_AGENT_MANIFESTS,
  TemporalResearchUnit,
  deterministicAssist,
  type AssistProduct,
  type ClaimDispatch,
  type ConceptInput,
} from "@inevitable/product-cognition";
import {
  CodeReferenceAdapter,
  DatasetReferenceAdapter,
  MarkdownReferenceAdapter,
  NotebookReferenceAdapter,
  PlainTextReferenceAdapter,
  VideoTranscriptAdapter,
  WebReferenceAdapter,
  SOURCE_EVENT_TYPES,
  SourceEnvironmentStore,
  contentHash,
  detectGaps,
  foldSourceCognition,
  isCreationKind,
  isSourceModality,
  reconcileConcept,
  type AnchorSelector,
  type Claim,
  type ClaimSummary,
  type ConceptTimeline,
  type ConsentEnvelope,
  type Contradiction,
  type Creation,
  type CreationAssist,
  type CreationAssistKind,
  type CreationKind,
  type EpistemicState,
  type FrontierEntry,
  type FrontierOverlay,
  type FusedConcept,
  type FusedSynthesis,
  type FusionResult,
  type SourceCacheStats,
  type SourceCognitionState,
  type SourceId,
  type SourceModality,
  type SourceTreatment,
  type SourceVersionId,
  type StructuralLayerContent,
  type StructuralRegion,
} from "@inevitable/source-environment";
import { createEvent } from "@inevitable/events";
import {
  CosError,
  CryptoIdGenerator,
  SystemClock,
  err,
  hlcInit,
  ok,
  type Hlc,
  type Result,
} from "@inevitable/shared";
import type { SourceEvidenceAnchorView, SourceRegionView } from "@inevitable/surface";
import { createGovernedWebFetcher, validateCrawlUrl, type WebFetchFn } from "./crawler";
import { supabaseStorageConfig } from "./env";
import type { PersistedSourceVersion, SourcePlanePersistence } from "./source-persistence";

const MIME_BY_MODALITY: Record<string, string> = {
  pdf: "application/pdf",
  markdown: "text/markdown; charset=utf-8",
  text: "text/plain; charset=utf-8",
  code: "text/plain; charset=utf-8",
  web: "text/html; charset=utf-8",
  video: "text/vtt; charset=utf-8",
  notebook: "application/x-ipynb+json",
  dataset: "text/csv; charset=utf-8",
};

/** Registration summary returned to the upload route + used by `surface.source.attached`. */
export interface RegisteredSource {
  readonly source_id: string;
  readonly source_version_id: string;
  readonly modality: string;
  readonly title: string;
  readonly content_hash: string;
  readonly content_ref: string;
  readonly layers_available: readonly string[];
  readonly degraded_layers: readonly string[];
  readonly usable: boolean;
}

/**
 * One entry in the knowledge commons (ADR-0053): a consented, contributed creation as a discoverable
 * source. Public metadata + honest authorship only — never the learner's private data.
 */
export interface CommonsEntry {
  readonly source_version_id: string;
  readonly creation_id: string;
  readonly title: string;
  readonly kind: string;
  /** The author — attribution always travels (Constitution #4). Null for an anonymous learner. */
  readonly author_cid: string | null;
  readonly concept_refs: readonly string[];
  readonly content_hash: string;
  readonly contributed_at: string;
}

export interface ServedSourceContent {
  readonly bytes: Uint8Array;
  readonly mimeType: string;
  readonly contentHash: string;
}

/** One concept in a "teach this source" curriculum (R2c, ADR-0057 D3) — the document's own units. */
export interface SourceCurriculumConcept {
  readonly id: string;
  readonly title: string;
  readonly prerequisites: string[];
}

/** The document taught as a timeline: its concepts in teaching order + the entry concept. */
export interface SourceCurriculum {
  readonly concepts: readonly SourceCurriculumConcept[];
  readonly entry: string;
}

/**
 * Order L2 concepts so prerequisites come first (Kahn's topological sort; stable on the input order,
 * cycle-tolerant — a remaining cycle is appended in input order rather than dropped). Pure.
 */
function orderByPrerequisites(
  concepts: readonly { concept_id: string; prerequisites: readonly string[] }[],
): { concept_id: string; label: string; prerequisites: readonly string[] }[] {
  const byId = new Map(concepts.map((c) => [c.concept_id, c] as const));
  const done = new Set<string>();
  const out: (typeof concepts)[number][] = [];
  let progress = true;
  while (out.length < concepts.length && progress) {
    progress = false;
    for (const c of concepts) {
      if (done.has(c.concept_id)) continue;
      const ready = c.prerequisites.every((p) => !byId.has(p) || done.has(p));
      if (ready) {
        out.push(c);
        done.add(c.concept_id);
        progress = true;
      }
    }
  }
  // Any remaining (cyclic) concepts: append in input order — never drop a concept.
  for (const c of concepts) if (!done.has(c.concept_id)) out.push(c);
  return out as { concept_id: string; label: string; prerequisites: readonly string[] }[];
}

function hubError(message: string, details?: Record<string, unknown>): CosError {
  return new CosError("E_SOURCE_GATEWAY", message, {
    specRef: "spec/source-environment/CSE-008-source-surface-projection.md",
    details,
  });
}

/** kebab-case slug for concept-identity joins ("Gradient Descent" ⇔ "gradient-descent"). */
function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Meaning-bearing tokens of a concept title (short stopwords drop out of the match). */
function titleTokens(title: string): string[] {
  return slug(title)
    .split("-")
    .filter((t) => t.length > 3);
}

/** Claim → the fused-concept summary (source's own words, traceable to its anchors; M9 T2). */
function toSummaries(claims: readonly Claim[]): ClaimSummary[] {
  return claims.map((c) => ({
    claim_id: c.claim_id,
    statement: c.statement,
    source_version_id: c.source_version_id,
    epistemic_status: c.epistemic_status,
    anchor_refs: [...c.anchors],
  }));
}

export class SourceHub {
  /** The hub's own bus so `source.*` events stay observable/replayable per CSE-002 §9. */
  readonly bus = new InMemoryEventBus();
  private readonly store = new SourceEnvironmentStore({ bus: this.bus, nodeId: "gateway-sources" });
  private readonly bytesByVersion = new Map<string, ServedSourceContent>();
  private readonly titleByVersion = new Map<string, string>();
  private pdfAdapterReady: Promise<void> | null = null;
  private storage: SupabaseStorageObjectStore | null = null;
  private storageReady: Promise<void> | null = null;
  /** Separate id/hlc stream for fusion + claim events so it never perturbs the store's seeded ids. */
  private readonly fusionIds = new CryptoIdGenerator();
  private readonly fusionClock = new SystemClock();
  private fusionHlc: Hlc = hlcInit("gateway-fusion");
  /** Claim Graph cognition (M9 T2, ADR-0041) — host-wired when a model is available; null else. */
  private claimGraph: ClaimGraphService | null = null;
  /** Fused explanation synthesis (M9 T3, ADR-0042) — wired alongside the Claim Graph; null else. */
  private synthesisUnit: FusionSynthesisUnit | null = null;
  /** Frontier research (M9 Frontier T1, ADR-0043) — wired alongside fusion cognition; null else. */
  private frontierUnit: FrontierResearchUnit | null = null;
  /** Frontier overlay cache keyed by (version, concept): researched on demand, time-versioned. */
  private readonly frontierByKey = new Map<string, FrontierOverlay>();
  /** Temporal research (M9 TKM T1, ADR-0044) — wired alongside fusion cognition; null else. */
  private temporalUnit: TemporalResearchUnit | null = null;
  /** Concept timeline cache keyed by (version, concept): researched on demand, time-versioned. */
  private readonly timelineByKey = new Map<string, ConceptTimeline>();
  /** Creative cognition (M11 T1, ADR-0049) — wired alongside fusion cognition; null else. */
  private creationUnit: CreationAssistUnit | null = null;
  /** Live creations keyed by creation_id (the learner's authored artifact + disclosed assists). */
  private readonly creationsById = new Map<string, Creation>();
  /**
   * The knowledge commons (ADR-0053): consented, contributed creations, discoverable by any learner.
   * A projection of the ADR-0051 contribution gate — only what was explicitly shared ever lands here.
   */
  private readonly commonsCatalog: CommonsEntry[] = [];
  /** Durable consent envelopes keyed by consent_ref (CSE-002 §8, ADR-0054) — the revocation unit. */
  private readonly consentEnvelopes = new Map<string, ConsentEnvelope>();
  /** Source versions whose content + reachability have been withdrawn by a revocation (ADR-0054). */
  private readonly redactedVersions = new Set<string>();
  /** Extracted-claim cache keyed by (version, concept-set): claims are shared, extracted on demand. */
  private readonly claimsByKey = new Map<string, readonly Claim[]>();
  /**
   * Fused-result cache keyed by sorted(source-version-ids)+sorted(concept-refs) (M12 T2, ADR-0050).
   * Source versions are content-addressed + immutable (new content ⇒ new version id), so the key is
   * staleness-free: a hit returns the identical FusionResult with no re-emission and no model call —
   * memoization never changes replay output.
   */
  private readonly fusionByKey = new Map<string, FusionResult>();
  /** Shared-cache hit/miss telemetry per cognition kind (CSE-002 §11; surfaced by `cognition()`). */
  private readonly cacheCounters: Record<string, { hits: number; misses: number }> = {};
  /** Monotone request-packet counter so each claim dispatch has a unique D3 invocation key. */
  private claimPacketSeq = 0;

  /** Record a memoization hit/miss for a cognition kind (M12 T2 perf telemetry). */
  private recordCache(kind: string, hit: boolean): void {
    const counter = (this.cacheCounters[kind] ??= { hits: 0, misses: 0 });
    if (hit) counter.hits += 1;
    else counter.misses += 1;
  }

  /** Snapshot the live cache telemetry into the transparency read model (M12 T2). */
  private cacheStats(): SourceCacheStats {
    const byKind = this.cacheCounters;
    let hits = 0;
    let misses = 0;
    for (const k of Object.keys(byKind)) {
      hits += byKind[k]!.hits;
      misses += byKind[k]!.misses;
    }
    const total = hits + misses;
    return {
      hits,
      misses,
      hit_rate: total === 0 ? 0 : hits / total,
      by_kind: Object.fromEntries(
        Object.entries(byKind).map(([k, v]) => [k, { hits: v.hits, misses: v.misses }]),
      ),
    };
  }

  /** The governed outbound-fetch seam (ADR-0052); injectable so the hermetic suite stays offline. */
  private readonly webFetch: WebFetchFn;
  /** Durable floor under the plane (ADR-0055 D1); null = process-lifetime (the offline default). */
  private readonly persistence: SourcePlanePersistence | null;
  /** Hub-level registry of every registered version, exactly as persisted/replayed (ADR-0055). */
  private readonly versionMeta = new Map<string, PersistedSourceVersion>();

  constructor(deps: { webFetch?: WebFetchFn; persistence?: SourcePlanePersistence } = {}) {
    this.webFetch = deps.webFetch ?? createGovernedWebFetcher();
    this.persistence = deps.persistence ?? null;
    this.store.registerAdapter(new MarkdownReferenceAdapter());
    this.store.registerAdapter(new PlainTextReferenceAdapter());
    this.store.registerAdapter(new CodeReferenceAdapter());
    this.store.registerAdapter(new WebReferenceAdapter());
    this.store.registerAdapter(new VideoTranscriptAdapter());
    this.store.registerAdapter(new NotebookReferenceAdapter());
    this.store.registerAdapter(new DatasetReferenceAdapter());
  }

  /** Snapshot the durable plane to disk, best-effort — persistence never fails a mutation. */
  private persist(): void {
    if (!this.persistence) return;
    try {
      this.persistence.saveCatalog({
        versions: [...this.versionMeta.values()],
        commons: [...this.commonsCatalog],
        consents: [...this.consentEnvelopes.values()],
        redacted: [...this.redactedVersions],
        creations: [...this.creationsById.values()],
      });
    } catch {
      /* best-effort: a failed snapshot degrades to process-lifetime, never breaks the mutation */
    }
  }

  /**
   * Rehydrate the durable plane at boot (ADR-0055 D1/D2): replay every persisted registration
   * through the SAME M1 pipeline under its ORIGINAL ids, then restore the commons, consent
   * envelopes, redaction set, and creations. A redacted version restores identity only (no store
   * registration, no bytes) — `isRedacted` keeps answering, so the content route still serves
   * 410 Gone after a deploy. Missing bytes skip the version honestly (it cannot be served or
   * canonicalized) rather than registering an unservable ghost.
   */
  async rehydrate(): Promise<void> {
    if (!this.persistence) return;
    const snapshot = this.persistence.load();
    if (!snapshot) return;

    const redacted = new Set(snapshot.redacted);
    for (const v of snapshot.versions) {
      if (redacted.has(v.version_id)) {
        this.versionMeta.set(v.version_id, v); // identity survives; content stays withheld
        continue;
      }
      const bytes = this.persistence.readBytes(v.content_hash);
      if (!bytes) continue; // bytes lost out-of-band — skip honestly, never a ghost
      if (!isSourceModality(v.modality)) continue;
      if (v.modality === "pdf") await this.ensurePdfAdapter();
      const content: string | Uint8Array =
        v.modality === "pdf" ? bytes : new TextDecoder().decode(bytes);
      const version = await this.store.registerVersion({
        source_id: v.source_id as SourceId,
        version_id: v.version_id as SourceVersionId,
        modality: v.modality,
        content,
        content_ref: v.content_ref,
        provenance: v.provenance,
      });
      if (!version.ok) continue;
      const canonicalized = await this.store.canonicalize(version.value.version_id);
      if (!canonicalized.ok) continue;
      this.bytesByVersion.set(v.version_id, {
        bytes,
        mimeType: MIME_BY_MODALITY[v.modality] ?? "application/octet-stream",
        contentHash: v.content_hash,
      });
      this.titleByVersion.set(v.version_id, v.title);
      this.versionMeta.set(v.version_id, v);
    }

    this.commonsCatalog.push(...snapshot.commons);
    for (const envelope of snapshot.consents)
      this.consentEnvelopes.set(envelope.consent_ref, envelope);
    for (const id of snapshot.redacted) this.redactedVersions.add(id);
    for (const creation of snapshot.creations)
      this.creationsById.set(creation.creation_id, creation);
    // Creation/assist ids are seq-minted (`crt-N` / `asst-N`): bump past the restored max so a
    // fresh creation after restart can never collide with a restored one.
    let maxSeq = this.claimPacketSeq;
    for (const creation of snapshot.creations) {
      const ids = [creation.creation_id, ...creation.assists.map((a) => a.assist_id)];
      for (const id of ids) {
        const n = Number(/-(\d+)$/.exec(id)?.[1] ?? Number.NaN);
        if (Number.isFinite(n) && n > maxSeq) maxSeq = n;
      }
    }
    this.claimPacketSeq = maxSeq;
  }

  /**
   * Governed web crawl (ADR-0052): fetch a URL server-side under the SSRF policy and register the
   * page as a web-modality Cognitive Source. `validateCrawlUrl` gates the URL BEFORE any byte is
   * fetched (deny-by-default: no non-http scheme, no credentials, no private/loopback/link-local/
   * metadata host); the fetch is bounded + HTML-only + redirect-revalidated. The page becomes an
   * ordinary content-addressed source (a re-crawl of a changed page mints a new version).
   */
  async crawl(rawUrl: string): Promise<Result<RegisteredSource, CosError>> {
    const validated = validateCrawlUrl(rawUrl);
    if (!validated.ok) return validated;
    const fetched = await this.webFetch(validated.value);
    if (!fetched.ok) return fetched;
    return this.register({
      content: fetched.value.html,
      modality: "web",
      title: fetched.value.finalUrl,
      provenance: { origin: "web", attributed_source: fetched.value.finalUrl },
    });
  }

  /**
   * The deep-transparency read (CSE M12 T1, ADR-0050): fold the source plane's cognition log —
   * `source.*` events + the D3 `model.output.recorded` events — into an observable summary of what the
   * environment reasoned (layers built/degraded, claims, contradictions, syntheses, frontier/timeline
   * groundings, creation assists), with confidence, honest degradation, and provenance. Pure + read-only
   * (observation never mutates cognition); host-level (the source substrate is shared cross-surface).
   */
  cognition(recentLimit = 30): SourceCognitionState {
    return foldSourceCognition(this.bus.log, { recentLimit, cache: this.cacheStats() });
  }

  /**
   * Enable fusion cognition (M9 T2 + T3): fusion will extract each source's claims, detect genuine
   * cross-source contradictions (ADR-0041), and weave one fused explanation per concept (ADR-0042).
   * The host calls this once a real model is available; absent it, `fuse()` behaves exactly as T1
   * (honest absence — no claims, no contradictions, no synthesis). Both models are recorded on the
   * hub bus (D3, recorded-before-use). Idempotent.
   */
  enableFusionCognition(model: ModelRuntime, provider: string): void {
    if (this.claimGraph) return;
    const recorded = new RecordingModelRuntime({
      mode: "record",
      bus: this.bus,
      inner: model,
      provider,
      clock: new SystemClock(),
      idGenerator: new CryptoIdGenerator(),
    });
    const claimManifest = MVP_AGENT_MANIFESTS.find((m) => m.id === "agent.claim");
    if (!claimManifest) return;
    const unit = new ClaimReasoningUnit({ manifest: claimManifest, model: recorded });
    const dispatch: ClaimDispatch = async (input) => {
      const packet = this.buildClaimPacket(input);
      const emissions = await unit.execute(packet);
      const out = emissions.packets?.[0];
      if (!out) return err(hubError("claim unit produced no packet"));
      return ok(out);
    };
    // No `world` at the gateway yet (the shared source world-graph lands with the M2b/M3 cutover);
    // the emitted `source.claim.*`/`source.contradiction.*` events are the canonical replayable record.
    this.claimGraph = new ClaimGraphService({
      dispatch,
      emit: (eventType, payload) => this.emitHubEvent(eventType, payload, "cog-source-claim"),
    });
    const synthManifest = MVP_AGENT_MANIFESTS.find((m) => m.id === "agent.synthesis");
    if (synthManifest)
      this.synthesisUnit = new FusionSynthesisUnit({ manifest: synthManifest, model: recorded });
    const frontierManifest = MVP_AGENT_MANIFESTS.find((m) => m.id === "agent.frontier");
    if (frontierManifest)
      this.frontierUnit = new FrontierResearchUnit({ manifest: frontierManifest, model: recorded });
    const temporalManifest = MVP_AGENT_MANIFESTS.find((m) => m.id === "agent.temporal");
    if (temporalManifest)
      this.temporalUnit = new TemporalResearchUnit({ manifest: temporalManifest, model: recorded });
    const creationManifest = MVP_AGENT_MANIFESTS.find((m) => m.id === "agent.creation");
    if (creationManifest)
      this.creationUnit = new CreationAssistUnit({ manifest: creationManifest, model: recorded });
  }

  /**
   * Open a creation (M11 T1, CSE-016): the learner's artifact-in-progress. Their `draft` is theirs;
   * the system will only ever attach disclosed assists. Emits `source.creation.started`.
   */
  async startCreation(
    input: Readonly<{
      kind: string;
      title: string;
      conceptRefs: readonly string[];
      draft?: string;
      learnerCid?: string | null;
    }>,
  ): Promise<Creation> {
    this.claimPacketSeq += 1;
    const creation: Creation = {
      creation_id: `crt-${this.claimPacketSeq}`,
      learner_cid: input.learnerCid ?? null,
      kind: (isCreationKind(input.kind) ? input.kind : "essay") as CreationKind,
      title: input.title,
      concept_refs: [...input.conceptRefs],
      draft: input.draft ?? "",
      assists: [],
      status: "in_progress",
      as_of: new Date(this.fusionClock.nowMs()).toISOString(),
    };
    this.creationsById.set(creation.creation_id, creation);
    await this.emitHubEvent(
      SOURCE_EVENT_TYPES.creationStarted,
      {
        creation_id: creation.creation_id,
        learner_cid: creation.learner_cid,
        kind: creation.kind,
        concept_refs: creation.concept_refs,
      },
      "cog-source-creation",
    );
    this.persist(); // drafts are durable (ADR-0055 D1)
    return creation;
  }

  /**
   * Offer a disclosed assist over a creation (scaffold | critique | provocation | reference). The
   * system NEVER writes the artifact (Constitution #5) — the assist is structure/findings/questions/
   * refs, appended (never merged into the draft). Emits `source.creation.critiqued` for critique,
   * else `source.creation.evolved`. Returns the updated creation (or null if unknown).
   */
  async assistCreation(creationId: string, mode: string, draft?: string): Promise<Creation | null> {
    const existing = this.creationsById.get(creationId);
    if (!existing) return null;
    const assistMode = (
      ["scaffold", "critique", "provocation", "reference"].includes(mode) ? mode : "scaffold"
    ) as CreationAssistKind;
    // The learner's latest draft is theirs; record it as authored content before the assist.
    const withDraft: Creation = draft !== undefined ? { ...existing, draft } : existing;

    this.claimPacketSeq += 1;
    const asOf = new Date(this.fusionClock.nowMs()).toISOString();
    let product: AssistProduct;
    if (this.creationUnit) {
      try {
        const packet = this.buildCreationPacket(withDraft, assistMode);
        const emissions = await this.creationUnit.execute(packet);
        const content = (emissions.packets?.[0]?.content ?? {}) as Record<string, unknown>;
        product = (content["assist"] ?? {
          kind: assistMode,
          degraded: true,
        }) as unknown as AssistProduct;
      } catch {
        // Honest deterministic fallback — structure/findings/questions/refs only, never prose.
        product = deterministicAssist(assistMode, withDraft.kind, withDraft.concept_refs);
      }
    } else {
      // No model wired (deterministic gateway): the creation grammar is still available — its
      // fallback is pure and safe (no-ghostwriter law holds without a model, no D3 needed).
      product = deterministicAssist(assistMode, withDraft.kind, withDraft.concept_refs);
    }
    const assist = this.assistFromProduct(
      assistMode,
      product as unknown as Record<string, unknown>,
      asOf,
    );
    const updated: Creation = {
      ...withDraft,
      assists: [...withDraft.assists, assist],
      status: assistMode === "critique" ? "critiqued" : withDraft.status,
    };
    this.creationsById.set(creationId, updated);
    await this.emitHubEvent(
      assistMode === "critique"
        ? SOURCE_EVENT_TYPES.creationCritiqued
        : SOURCE_EVENT_TYPES.creationEvolved,
      {
        creation_id: creationId,
        assist_kind: assistMode,
        agent_cid: assist.agent_cid,
        disclosed: true,
        degraded: assist.degraded ?? false,
      },
      "cog-source-creation",
    );
    this.persist();
    return updated;
  }

  /** Mark a creation complete with the learner's final draft. Emits `source.creation.completed`. */
  async completeCreation(creationId: string, draft?: string): Promise<Creation | null> {
    const existing = this.creationsById.get(creationId);
    if (!existing) return null;
    const updated: Creation = {
      ...existing,
      ...(draft !== undefined ? { draft } : {}),
      status: "completed",
    };
    this.creationsById.set(creationId, updated);
    await this.emitHubEvent(
      SOURCE_EVENT_TYPES.creationCompleted,
      { creation_id: creationId, kind: updated.kind, assist_count: updated.assists.length },
      "cog-source-creation",
    );
    this.persist();
    return updated;
  }

  /**
   * The contribution loop (ADR-0051): consent a COMPLETED creation into the shared substrate as a
   * first-class Cognitive Source. Only the learner's `draft` becomes source content (the disclosed
   * assists stay on the creation as the authorship trail — the No-Ghostwriter law holds through the
   * loop, CSE-016 §6). Consent-gated (CSE-002 §8): refuses unless the creation is completed AND
   * consent is explicitly given. The registered source carries `origin:"creation"` provenance back to
   * the learner + a `consent_ref`, and is thereafter attachable/anchorable/fusable like any source
   * (recursion — the system's output becomes its input). Emits `source.creation.contributed`.
   */
  async contributeCreation(
    creationId: string,
    input: Readonly<{ consent: boolean; consentRef?: string }>,
  ): Promise<Result<{ creation: Creation; source: RegisteredSource }, CosError>> {
    const existing = this.creationsById.get(creationId);
    if (!existing) return err(hubError("unknown creation", { creationId }));
    if (existing.status !== "completed") {
      return err(hubError("only a completed creation can be contributed", { creationId }));
    }
    if (!input.consent) {
      // Sharing into the shared substrate is a disclosure — never automatic (CSE-002 §8).
      return err(hubError("contribution requires explicit learner consent", { creationId }));
    }
    if (!existing.draft.trim()) {
      return err(hubError("cannot contribute an empty creation", { creationId }));
    }
    const consentRef = input.consentRef ?? `consent:creation:${creationId}`;
    const registered = await this.register({
      content: existing.draft,
      modality: "markdown",
      title: existing.title,
      provenance: {
        origin: "creation",
        attributed_source: existing.learner_cid
          ? `creation:${creationId} by ${existing.learner_cid}`
          : `creation:${creationId}`,
        consent_ref: consentRef,
      },
    });
    if (!registered.ok) return registered;

    const updated: Creation = { ...existing, contributed_as: registered.value.source_version_id };
    this.creationsById.set(creationId, updated);
    // Record the durable consent envelope (CSE-002 §8, ADR-0054) — the unit a revocation acts on.
    const grantedAt = new Date(this.fusionClock.nowMs()).toISOString();
    this.consentEnvelopes.set(consentRef, {
      consent_ref: consentRef,
      creation_id: creationId,
      source_version_id: registered.value.source_version_id,
      learner_cid: updated.learner_cid,
      scope: "commons",
      granted_at: grantedAt,
      status: "active",
      revoked_at: null,
    });
    await this.emitHubEvent(
      SOURCE_EVENT_TYPES.consentGranted,
      {
        consent_ref: consentRef,
        source_version_id: registered.value.source_version_id,
        learner_cid: updated.learner_cid,
        scope: "commons",
      },
      "cog-source-consent",
    );
    // Publish to the commons (ADR-0053) — discoverable by any learner, attributed, public metadata only.
    this.commonsCatalog.push({
      source_version_id: registered.value.source_version_id,
      creation_id: creationId,
      title: updated.title,
      kind: updated.kind,
      author_cid: updated.learner_cid,
      concept_refs: [...updated.concept_refs],
      content_hash: registered.value.content_hash,
      contributed_at: grantedAt,
    });
    await this.emitHubEvent(
      SOURCE_EVENT_TYPES.creationContributed,
      {
        creation_id: creationId,
        kind: updated.kind,
        source_version_id: registered.value.source_version_id,
        content_hash: registered.value.content_hash,
        assist_count: updated.assists.length,
        consent_ref: consentRef,
      },
      "cog-source-creation",
    );
    this.persist(); // the commons entry + consent envelope are durable (ADR-0055 D1)
    return ok({ creation: updated, source: registered.value });
  }

  /**
   * Revoke a contribution's consent and cascade a redaction (CSE-002 §8/§10, ADR-0054) — the learner's
   * sovereign right to un-share. Flips the consent envelope to `revoked` (emits `source.consent.revoked`),
   * then cascades: delist from the commons, withhold the source's bytes (its content route now returns
   * 410 Gone), block any NEW attach/fuse of it, and clear the creation's `contributed_as`. Emits
   * `source.redaction.cascaded` with the redacted counts. Redaction withdraws content + reachability
   * while preserving the version's IDENTITY, so the event log stays replayable. Already-taught downstream
   * copies are not retroactively retracted (named-deferred) — but all future disclosure stops.
   */
  async revokeContribution(creationId: string): Promise<
    Result<
      {
        creation: Creation;
        source_version_id: string;
        redacted_counts: { commons_entries: number; content_withheld: number };
      },
      CosError
    >
  > {
    const existing = this.creationsById.get(creationId);
    if (!existing) return err(hubError("unknown creation", { creationId }));
    if (!existing.contributed_as) {
      return err(hubError("creation is not contributed — nothing to revoke", { creationId }));
    }
    const versionId = existing.contributed_as;
    const envelope = [...this.consentEnvelopes.values()].find(
      (e) => e.creation_id === creationId && e.source_version_id === versionId,
    );
    if (!envelope)
      return err(hubError("no consent envelope for this contribution", { creationId }));

    // 1. Flip the durable consent envelope to revoked.
    const revokedAt = new Date(this.fusionClock.nowMs()).toISOString();
    this.consentEnvelopes.set(envelope.consent_ref, {
      ...envelope,
      status: "revoked",
      revoked_at: revokedAt,
    });
    await this.emitHubEvent(
      SOURCE_EVENT_TYPES.consentRevoked,
      {
        consent_ref: envelope.consent_ref,
        source_version_id: versionId,
        learner_cid: existing.learner_cid,
      },
      "cog-source-consent",
    );

    // 2. Cascade the redaction: delist, withhold bytes, block reuse, clear the contribution.
    const before = this.commonsCatalog.length;
    for (let i = this.commonsCatalog.length - 1; i >= 0; i -= 1) {
      if (this.commonsCatalog[i]!.source_version_id === versionId) this.commonsCatalog.splice(i, 1);
    }
    const commonsRemoved = before - this.commonsCatalog.length;
    this.redactedVersions.add(versionId);
    this.bytesByVersion.delete(versionId); // withhold content (route → 410)
    // Durable byte withholding (ADR-0055): delete the on-disk bytes too, but ONLY when no other
    // non-redacted version shares this content hash (bytes are content-addressed + may be shared).
    const redactedHash = this.versionMeta.get(versionId)?.content_hash;
    if (redactedHash) {
      const stillNeeded = [...this.versionMeta.values()].some(
        (v) =>
          v.content_hash === redactedHash &&
          v.version_id !== versionId &&
          !this.redactedVersions.has(v.version_id),
      );
      if (!stillNeeded) this.persistence?.deleteBytes(redactedHash);
    }
    const updated: Creation = { ...existing, contributed_as: null };
    this.creationsById.set(creationId, updated);

    const redactedCounts = { commons_entries: commonsRemoved, content_withheld: 1 };
    await this.emitHubEvent(
      SOURCE_EVENT_TYPES.redactionCascaded,
      {
        consent_ref: envelope.consent_ref,
        source_version_id: versionId,
        redacted_counts: redactedCounts,
      },
      "cog-source-consent",
    );
    this.persist(); // the revocation (envelope flip + redaction set) is durable (ADR-0055 D1)
    return ok({ creation: updated, source_version_id: versionId, redacted_counts: redactedCounts });
  }

  /** Whether a source version has been redacted by a consent revocation (ADR-0054). */
  isRedacted(versionId: string): boolean {
    return this.redactedVersions.has(versionId);
  }

  /** Assemble a disclosed CreationAssist from the unit's product (the no-ghostwriter fields only). */
  private assistFromProduct(
    kind: CreationAssistKind,
    product: Record<string, unknown>,
    asOf: string,
  ): CreationAssist {
    this.claimPacketSeq += 1;
    const base = {
      assist_id: `asst-${this.claimPacketSeq}`,
      kind,
      agent_cid: "agent.creation",
      disclosed: true as const,
      as_of: asOf,
      degraded: product["degraded"] === true,
    };
    if (kind === "scaffold")
      return { ...base, slots: (product["slots"] as CreationAssist["slots"]) ?? [] };
    if (kind === "critique")
      return { ...base, findings: (product["findings"] as CreationAssist["findings"]) ?? [] };
    if (kind === "provocation")
      return { ...base, questions: (product["questions"] as CreationAssist["questions"]) ?? [] };
    return { ...base, refs: (product["refs"] as CreationAssist["refs"]) ?? [] };
  }

  /** Build a request packet for the `creation` unit. Not published on any bus. */
  private buildCreationPacket(creation: Creation, mode: CreationAssistKind): CognitionPacket {
    this.claimPacketSeq += 1;
    return {
      packet_id: `creation-${mode}-${this.claimPacketSeq}`,
      schema_version: "1.0.0",
      source_cid: "cog-source-hub",
      target_cid: "agent.creation",
      tenant_id: null,
      session_id: null,
      causation_id: null,
      correlation_id: null,
      timestamp: new Date(this.fusionClock.nowMs()).toISOString(),
      hlc: "0000000000000001-00000000-hub",
      sequence_number: 0,
      packet_type: "request",
      intent: `creation-${mode}`,
      concept_ids: [],
      domain_ids: [],
      content: {
        mode,
        kind: creation.kind,
        title: creation.title,
        draft: creation.draft,
        concept_refs: [...creation.concept_refs],
        intent_lease_id: null,
      },
      evidence: [],
      confidence: 1,
      uncertainty_estimate: 0,
      reasoning_depth: 0,
      classification: "internal",
      policy_tags: [],
      requires_human_review: false,
      priority: 4,
      expiry: null,
    } as unknown as CognitionPacket;
  }

  /**
   * Research a concept's living-knowledge frontier (M9 Frontier T1, CSE-006 §3.2): on demand, via
   * governed web search. Returns a grounded FrontierOverlay (entries backed by real citations) or an
   * honest-empty one (degraded) when frontier research is off or nothing citable is found — never a
   * fabricated frontier. Cached per (version, concept); emits `source.frontier.updated`.
   */
  async researchFrontier(
    conceptRef: string,
    versionId: string | null = null,
  ): Promise<FrontierOverlay> {
    const asOf = new Date(this.fusionClock.nowMs()).toISOString();
    const key = `${versionId ?? "*"}::${slug(conceptRef)}`;
    const cached = this.frontierByKey.get(key);
    if (cached) {
      this.recordCache("frontier", true);
      return cached;
    }
    this.recordCache("frontier", false);

    this.claimPacketSeq += 1;
    const overlayId = `fov-${this.claimPacketSeq}`;
    let entries: FrontierEntry[] = [];
    let degraded = true;
    if (this.frontierUnit) {
      try {
        const packet = this.buildFrontierPacket(conceptRef, asOf);
        const emissions = await this.frontierUnit.execute(packet);
        const content = (emissions.packets?.[0]?.content ?? {}) as Record<string, unknown>;
        entries = Array.isArray(content["entries"]) ? (content["entries"] as FrontierEntry[]) : [];
        degraded = content["degraded"] === true || entries.length === 0;
      } catch {
        entries = []; // best-effort: honest empty (never fabricated)
        degraded = true;
      }
    }
    const overlay: FrontierOverlay = {
      overlay_id: overlayId,
      concept_ref: conceptRef,
      source_version_id: versionId,
      entries,
      as_of: asOf,
      degraded,
    };
    this.frontierByKey.set(key, overlay);
    const citationCount = new Set(entries.flatMap((e) => e.external_refs.map((r) => r.uri))).size;
    await this.emitHubEvent(
      SOURCE_EVENT_TYPES.frontierUpdated,
      {
        overlay_id: overlayId,
        concept_ref: conceptRef,
        source_version_id: versionId,
        entry_count: entries.length,
        citation_count: citationCount,
        as_of: asOf,
        degraded,
      },
      "cog-source-frontier",
    );
    return overlay;
  }

  /** Build a request packet for the `frontier` unit. Not published on any bus. */
  private buildFrontierPacket(conceptRef: string, asOf: string): CognitionPacket {
    this.claimPacketSeq += 1;
    return {
      packet_id: `frontier-${this.claimPacketSeq}`,
      schema_version: "1.0.0",
      source_cid: "cog-source-hub",
      target_cid: "agent.frontier",
      tenant_id: null,
      session_id: null,
      causation_id: null,
      correlation_id: null,
      timestamp: asOf,
      hlc: "0000000000000001-00000000-hub",
      sequence_number: 0,
      packet_type: "request",
      intent: "frontier-research",
      concept_ids: [],
      domain_ids: [],
      content: { concept_ref: conceptRef, as_of: asOf, intent_lease_id: null },
      evidence: [],
      confidence: 1,
      uncertainty_estimate: 0,
      reasoning_depth: 0,
      classification: "internal",
      policy_tags: [],
      requires_human_review: false,
      priority: 4,
      expiry: null,
    } as unknown as CognitionPacket;
  }

  /**
   * Research a concept's Temporal Knowledge Model (M9 TKM T1, CSE-006 §3.3): on demand, via governed
   * web search. Returns a grounded ConceptTimeline (ordered epistemic states, each backed by a real
   * citation) or an honest-empty one (degraded) when temporal research is off or nothing citable is
   * found — never a fabricated history. Cached per (version, concept); emits `source.timeline.updated`.
   */
  async researchTimeline(
    conceptRef: string,
    versionId: string | null = null,
  ): Promise<ConceptTimeline> {
    const asOf = new Date(this.fusionClock.nowMs()).toISOString();
    const key = `${versionId ?? "*"}::${slug(conceptRef)}`;
    const cached = this.timelineByKey.get(key);
    if (cached) {
      this.recordCache("timeline", true);
      return cached;
    }
    this.recordCache("timeline", false);

    this.claimPacketSeq += 1;
    const timelineId = `tkm-${this.claimPacketSeq}`;
    let states: EpistemicState[] = [];
    let degraded = true;
    if (this.temporalUnit) {
      try {
        const packet = this.buildTimelinePacket(conceptRef, asOf);
        const emissions = await this.temporalUnit.execute(packet);
        const content = (emissions.packets?.[0]?.content ?? {}) as Record<string, unknown>;
        states = Array.isArray(content["states"]) ? (content["states"] as EpistemicState[]) : [];
        degraded = content["degraded"] === true || states.length === 0;
      } catch {
        states = []; // best-effort: honest empty (never fabricated)
        degraded = true;
      }
    }
    const timeline: ConceptTimeline = {
      timeline_id: timelineId,
      concept_ref: conceptRef,
      source_version_id: versionId,
      states,
      as_of: asOf,
      degraded,
    };
    this.timelineByKey.set(key, timeline);
    const citationCount = new Set(states.flatMap((s) => s.external_refs.map((r) => r.uri))).size;
    await this.emitHubEvent(
      SOURCE_EVENT_TYPES.timelineUpdated,
      {
        timeline_id: timelineId,
        concept_ref: conceptRef,
        source_version_id: versionId,
        state_count: states.length,
        citation_count: citationCount,
        as_of: asOf,
        degraded,
      },
      "cog-source-temporal",
    );
    return timeline;
  }

  /** Build a request packet for the `temporal` unit. Not published on any bus. */
  private buildTimelinePacket(conceptRef: string, asOf: string): CognitionPacket {
    this.claimPacketSeq += 1;
    return {
      packet_id: `timeline-${this.claimPacketSeq}`,
      schema_version: "1.0.0",
      source_cid: "cog-source-hub",
      target_cid: "agent.temporal",
      tenant_id: null,
      session_id: null,
      causation_id: null,
      correlation_id: null,
      timestamp: asOf,
      hlc: "0000000000000001-00000000-hub",
      sequence_number: 0,
      packet_type: "request",
      intent: "timeline-research",
      concept_ids: [],
      domain_ids: [],
      content: { concept_ref: conceptRef, as_of: asOf, intent_lease_id: null },
      evidence: [],
      confidence: 1,
      uncertainty_estimate: 0,
      reasoning_depth: 0,
      classification: "internal",
      policy_tags: [],
      requires_human_review: false,
      priority: 4,
      expiry: null,
    } as unknown as CognitionPacket;
  }

  /** Best-effort, lazily: the PDF adapter is edge-provisioned (guarded import, ADR-0036). */
  private ensurePdfAdapter(): Promise<void> {
    this.pdfAdapterReady ??= PdfjsModalityAdapter.connect().then((connected) => {
      if (connected.ok) this.store.registerAdapter(connected.value);
    });
    return this.pdfAdapterReady;
  }

  /** Best-effort durable bytes: Supabase Storage when configured (ADR-0034); memory otherwise. */
  private ensureStorage(): Promise<void> {
    this.storageReady ??= (async () => {
      const config = supabaseStorageConfig();
      if (!config) return;
      const created = SupabaseStorageObjectStore.create({
        url: config.url,
        serviceRoleKey: config.serviceKey,
        bucket: "cos-media",
      });
      if (!created.ok) return;
      const bucket = await created.value.ensureBucket();
      if (bucket.ok) this.storage = created.value;
    })();
    return this.storageReady;
  }

  /**
   * Register + canonicalize one source. Text modalities take a UTF-8 string; PDF takes bytes.
   * Idempotent per content hash (M1 law): re-upload returns the existing version.
   */
  async register(input: {
    readonly content: string | Uint8Array;
    readonly modality: string;
    readonly title: string;
    /** Override the default upload provenance (e.g. a contributed creation, ADR-0051). */
    readonly provenance?: {
      readonly origin: "upload" | "web" | "api" | "recording" | "fixture" | "creation";
      readonly attributed_source?: string;
      readonly consent_ref?: string | null;
    };
  }): Promise<Result<RegisteredSource, CosError>> {
    if (!isSourceModality(input.modality)) {
      return err(hubError(`unsupported modality "${input.modality}"`));
    }
    const modality = input.modality as SourceModality;
    if (modality === "pdf") await this.ensurePdfAdapter();
    await this.ensureStorage();

    const hash = contentHash(input.content);
    const bytes =
      typeof input.content === "string" ? new TextEncoder().encode(input.content) : input.content;
    const mimeType = MIME_BY_MODALITY[modality] ?? "application/octet-stream";

    // Durable bytes first (best-effort): the storage ref becomes the version's content_ref; the
    // gateway route stays the client-facing fetch path either way.
    let contentRef = `gateway://sources/${hash.slice(0, 16)}`;
    if (this.storage) {
      const put = await this.storage.put(`sources/${hash.slice(0, 16)}.${modality}`, {
        bytes,
        mimeType,
      });
      if (put.ok) contentRef = put.value.content_ref;
    }

    const version = await this.store.registerVersion({
      modality,
      content: input.content,
      content_ref: contentRef,
      provenance: {
        origin: input.provenance?.origin ?? "upload",
        attributed_source: input.provenance?.attributed_source ?? input.title,
        license_class: null,
        consent_ref: input.provenance?.consent_ref ?? null,
      },
    });
    if (!version.ok) return version;

    const canonicalized = await this.store.canonicalize(version.value.version_id);
    if (!canonicalized.ok) return canonicalized;

    this.bytesByVersion.set(version.value.version_id, { bytes, mimeType, contentHash: hash });
    this.titleByVersion.set(version.value.version_id, input.title);

    // Durable plane (ADR-0055): bytes first (the catalog must never reference missing bytes),
    // then the catalog snapshot. Best-effort — persistence never fails a registration.
    this.versionMeta.set(version.value.version_id, {
      source_id: version.value.source_id,
      version_id: version.value.version_id,
      modality,
      title: input.title,
      content_hash: hash,
      content_ref: contentRef,
      provenance: {
        origin: input.provenance?.origin ?? "upload",
        attributed_source: input.provenance?.attributed_source ?? input.title,
        license_class: null,
        consent_ref: input.provenance?.consent_ref ?? null,
      },
    });
    try {
      this.persistence?.saveBytes(hash, bytes);
    } catch {
      /* best-effort */
    }
    this.persist();

    return ok({
      source_id: version.value.source_id,
      source_version_id: version.value.version_id,
      modality,
      title: input.title,
      content_hash: hash,
      content_ref: contentRef,
      layers_available: canonicalized.value.layers_available,
      degraded_layers: canonicalized.value.degraded_layers,
      usable: canonicalized.value.usable,
    });
  }

  /** Canonical bytes for the gateway source-content route (client fidelity proof, ADR-0036). A
   * redacted version (ADR-0054) serves no bytes — the route distinguishes it via `isRedacted` (410). */
  content(versionId: string): ServedSourceContent | undefined {
    if (this.redactedVersions.has(versionId)) return undefined;
    return this.bytesByVersion.get(versionId);
  }

  /** The knowledge commons (ADR-0053): consented contributed creations, newest first, for discovery. */
  commons(): readonly CommonsEntry[] {
    return [...this.commonsCatalog].reverse();
  }

  /**
   * "Teach this source" curriculum (R2c, ADR-0057 D3): the document's own concepts in teaching
   * order, so the frame pipeline walks the DOCUMENT rather than a goal string. Prefers the L2
   * semantic concepts (prerequisite-ordered — the canonicalizer's extracted concept graph); falls
   * back to the L1 heading outline as a linear reading-order chain. Returns null when the source has
   * neither (nothing to teach in order) — the caller then stays in goal-mode. Titles are the source's
   * own labels/headings, so the evidence seam resolves each concept to its region (R2a/R2b).
   */
  curriculumFor(versionId: string): SourceCurriculum | null {
    const vid = versionId as SourceVersionId;
    const concepts = this.store.semanticConcepts(vid);
    if (concepts.length > 0) {
      const ordered = orderByPrerequisites(concepts);
      return {
        concepts: ordered.map((c) => ({
          id: c.concept_id,
          title: c.label,
          prerequisites: [...c.prerequisites],
        })),
        entry: ordered[0]!.concept_id,
      };
    }
    const headings = this.store
      .structuralRegions(vid)
      .filter((r) => r.kind === "heading" && r.text.trim().length > 0);
    if (headings.length === 0) return null;
    const seen = new Set<string>();
    const chain: SourceCurriculumConcept[] = headings.map((r, i) => {
      let id = slug(r.text) || `section-${i + 1}`;
      while (seen.has(id)) id = `${id}-${i + 1}`;
      seen.add(id);
      return { id, title: r.text.trim(), prerequisites: [] as string[] };
    });
    // Linear reading order: each section depends on the one before it (the document's own sequence).
    for (let i = 1; i < chain.length; i += 1) chain[i]!.prerequisites.push(chain[i - 1]!.id);
    return { concepts: chain, entry: chain[0]!.id };
  }

  /** Registration summary for an already-registered version (attach route). A redacted version
   * (ADR-0054) is unreachable — a NEW attach/fuse cannot bind it (returns undefined ⇒ 404). */
  registered(versionId: string): RegisteredSource | undefined {
    if (this.redactedVersions.has(versionId)) return undefined;
    const version = this.store.version(versionId as SourceVersionId);
    const environment = this.store.environment(versionId as SourceVersionId);
    if (!version || !environment) return undefined;
    return {
      source_id: version.source_id,
      source_version_id: version.version_id,
      modality: version.modality,
      title: this.titleByVersion.get(versionId) ?? version.content_hash.slice(0, 12),
      content_hash: version.content_hash,
      content_ref: version.content_ref,
      layers_available: environment.layers_available,
      degraded_layers: environment.degraded_layers,
      usable: environment.usable,
    };
  }

  /**
   * The SourceEvidenceProvider seam (CSE M5): resolved evidence anchors for a concept across the
   * given attached versions. Deterministic; returns [] when nothing matches (honest absence).
   */
  async evidenceFor(
    versionIds: readonly string[],
    conceptId: string,
    conceptTitle: string,
  ): Promise<readonly SourceEvidenceAnchorView[]> {
    for (const versionId of versionIds) {
      const views =
        this.existingAnchorViews(versionId, conceptId, conceptTitle) ??
        (await this.anchorsFromAttention(versionId, conceptId, conceptTitle));
      if (views && views.length > 0) return views;
    }
    return [];
  }

  /**
   * Source Fusion (CSE M9 T1, CSE-015): reconcile a set of concepts across the given attached
   * source versions into one cognitive environment. For each concept, gather each source's
   * treatment (its concept-bound anchors — the same evidence path as viewport planning, per
   * source), reconcile deterministically (corroboration when ≥2 sources cover it, complements by
   * emphasis), detect coverage gaps, and emit `source.fusion.*` on the hub bus (replayable in the
   * source domain). Provenance is never blurred — each treatment carries its source's anchor refs.
   */
  async fuse(
    versionIds: readonly string[],
    conceptRefs: readonly string[],
    learnerCid: string | null = null,
  ): Promise<FusionResult> {
    // M12 T2 (ADR-0050): memoize by the immutable source-version set + concept set. A hit returns the
    // identical result with NO re-emission and NO model call — reconciliation over content-addressed
    // versions is deterministic, so caching cannot change replay output.
    const fusionKey = `${[...versionIds].sort().join(",")}::${[...conceptRefs].map(slug).sort().join(",")}`;
    const cachedFusion = this.fusionByKey.get(fusionKey);
    if (cachedFusion) {
      this.recordCache("fusion", true);
      return cachedFusion;
    }
    this.recordCache("fusion", false);
    // M9 T2 (CSE-006 §3.1): extract each source's claims about these concepts, then detect genuine
    // cross-source contradictions. Best-effort + live-gated (a model must be wired) — absent it this
    // is honest absence and fusion falls back to the T1 coverage view unchanged.
    const claimsBySource = await this.claimsForFusion(versionIds, conceptRefs);
    const claimsAll = claimsBySource.flat();
    const contradictions = await this.detectFusionContradictions(claimsAll);

    const concepts: FusedConcept[] = [];
    for (const conceptRef of conceptRefs) {
      const treatments: SourceTreatment[] = [];
      for (const versionId of versionIds) {
        // Per-source treatment: this source's own anchors for the concept (never cross-source).
        const views =
          this.existingAnchorViews(versionId, conceptRef, conceptRef) ??
          (await this.anchorsFromAttention(versionId, conceptRef, conceptRef));
        const covering = views ?? [];
        treatments.push({
          source_version_id: versionId,
          title: this.titleByVersion.get(versionId) ?? versionId,
          anchor_refs: covering.map((v) => v.anchor_id),
          // T1 emphasis heuristic: a heading-granularity anchor reads as a definition; else intuition.
          emphasis: covering.some((v) => v.granularity === "section") ? "definition" : "intuition",
          coverage: covering.length === 0 ? "absent" : covering.length >= 2 ? "full" : "partial",
          quote: covering[0]?.region.quote ?? null,
        });
      }
      // The claims + contradictions about THIS concept (claims stay traceable to their source).
      const conceptClaims = claimsAll.filter((c) => this.claimIsAbout(c, conceptRef));
      const conceptClaimIds = new Set(conceptClaims.map((c) => c.claim_id));
      const conceptContradictions = contradictions.filter((x) =>
        x.claim_ids.some((id) => conceptClaimIds.has(id)),
      );
      const fused = reconcileConcept(conceptRef, treatments, conceptContradictions);
      let fusedConcept: FusedConcept =
        conceptClaims.length > 0 ? { ...fused, claims: toSummaries(conceptClaims) } : fused;
      // M9 T3 (CSE-015 §3.1): weave one fused explanation from the sources, on demand, when a model
      // is available. Best-effort — synthesis failure falls back to the T2 structured view.
      const synthesis = await this.synthesizeConcept(fusedConcept, conceptClaims);
      if (synthesis) {
        fusedConcept = { ...fusedConcept, synthesis };
        await this.emitHubEvent(SOURCE_EVENT_TYPES.fusionSynthesized, {
          concept_ref: conceptRef,
          source_version_ids: synthesis.cited_source_ids,
          acknowledges_disagreement: synthesis.acknowledges_disagreement,
          degraded: synthesis.degraded,
        });
      }
      concepts.push(fusedConcept);
      await this.emitHubEvent(SOURCE_EVENT_TYPES.fusionConceptReconciled, {
        concept_ref: conceptRef,
        source_version_ids: fused.reconciliation.corroborating_source_ids,
        corroborated: fused.reconciliation.corroborated,
        confidence: fused.confidence,
      });
    }
    const gaps = detectGaps(conceptRefs, concepts);
    for (const gap of gaps) {
      await this.emitHubEvent(SOURCE_EVENT_TYPES.fusionGapDetected, { ...gap });
    }
    await this.emitHubEvent(SOURCE_EVENT_TYPES.fusionComposed, {
      learner_cid: learnerCid,
      concept_refs: conceptRefs,
      source_version_ids: versionIds,
    });
    const result: FusionResult = {
      concept_refs: conceptRefs,
      source_version_ids: versionIds,
      concepts,
      gaps,
    };
    this.fusionByKey.set(fusionKey, result);
    return result;
  }

  /** Extract (cached) each source's claims about the fusion's concepts. [] when claim reasoning off. */
  private async claimsForFusion(
    versionIds: readonly string[],
    conceptRefs: readonly string[],
  ): Promise<readonly (readonly Claim[])[]> {
    if (!this.claimGraph) return [];
    const conceptKey = [...conceptRefs].map(slug).sort().join(",");
    const concepts: ConceptInput[] = conceptRefs.map((ref) => ({
      concept_id: slug(ref),
      label: ref,
    }));
    const out: (readonly Claim[])[] = [];
    for (const versionId of versionIds) {
      const key = `${versionId}::${conceptKey}`;
      const cached = this.claimsByKey.get(key);
      if (cached) {
        this.recordCache("claims", true);
        out.push(cached);
        continue;
      }
      this.recordCache("claims", false);
      const structural = this.structuralOf(versionId);
      if (!structural) {
        this.claimsByKey.set(key, []);
        continue;
      }
      const regions = structural.regions
        .filter((r) => r.text.trim().length > 0)
        .map((r) => ({ path: r.path, kind: r.kind, text: r.text }));
      try {
        const result = await this.claimGraph.extractClaims({ versionId, regions, concepts });
        const claims = result.ok ? result.value.claims : [];
        this.claimsByKey.set(key, claims);
        out.push(claims);
      } catch {
        this.claimsByKey.set(key, []); // best-effort: extraction failure ⇒ honest absence
        out.push([]);
      }
    }
    return out;
  }

  /** Cross-source contradiction detection over the extracted claims (honest [] absent ≥2 sources). */
  private async detectFusionContradictions(claims: readonly Claim[]): Promise<Contradiction[]> {
    if (!this.claimGraph || claims.length < 2) return [];
    if (new Set(claims.map((c) => c.source_version_id)).size < 2) return [];
    try {
      const detected = await this.claimGraph.detectContradictions({ claims });
      return detected.ok ? [...detected.value.contradictions] : [];
    } catch {
      return []; // best-effort: never fabricate on failure
    }
  }

  /**
   * Weave one fused explanation of a concept from its treatments + claims + contradictions (M9 T3,
   * CSE-015 §3.1). Returns null when synthesis is off or the concept has no material to weave;
   * best-effort — any failure yields null (fusion falls back to the T2 structured view).
   */
  private async synthesizeConcept(
    concept: FusedConcept,
    conceptClaims: readonly Claim[],
  ): Promise<FusedSynthesis | null> {
    if (!this.synthesisUnit) return null;
    const hasMaterial =
      concept.source_treatments.some((t) => t.coverage !== "absent") || conceptClaims.length > 0;
    if (!hasMaterial) return null;
    const claimById = new Map(conceptClaims.map((c) => [c.claim_id, c.statement]));
    const treatments = concept.source_treatments.map((t) => ({
      source_version_id: t.source_version_id,
      title: t.title,
      quote: t.quote,
      emphasis: t.emphasis,
      coverage: t.coverage,
    }));
    const claims = conceptClaims.map((c) => ({
      source_version_id: c.source_version_id,
      statement: c.statement,
      epistemic_status: c.epistemic_status,
    }));
    const contradictions = concept.reconciliation.contradictions.map((x) => ({
      nature: x.nature,
      rationale: x.rationale ?? null,
      statements: x.claim_ids
        .map((id) => claimById.get(id))
        .filter((s): s is string => typeof s === "string"),
    }));
    try {
      const packet = this.buildSynthesisPacket(
        concept.concept_ref,
        treatments,
        claims,
        contradictions,
      );
      const emissions = await this.synthesisUnit.execute(packet);
      const content = (emissions.packets?.[0]?.content ?? {}) as Record<string, unknown>;
      const synthesis = content["synthesis"] as FusedSynthesis | undefined;
      return synthesis ?? null;
    } catch {
      return null;
    }
  }

  /** Build a request packet for the `synthesis` unit. Not published on any bus. */
  private buildSynthesisPacket(
    conceptRef: string,
    treatments: readonly Record<string, unknown>[],
    claims: readonly Record<string, unknown>[],
    contradictions: readonly Record<string, unknown>[],
  ): CognitionPacket {
    this.claimPacketSeq += 1;
    return {
      packet_id: `synthesis-${this.claimPacketSeq}`,
      schema_version: "1.0.0",
      source_cid: "cog-source-hub",
      target_cid: "agent.synthesis",
      tenant_id: null,
      session_id: null,
      causation_id: null,
      correlation_id: null,
      timestamp: new Date(this.fusionClock.nowMs()).toISOString(),
      hlc: "0000000000000001-00000000-hub",
      sequence_number: 0,
      packet_type: "request",
      intent: "fusion-synthesis",
      concept_ids: [],
      domain_ids: [],
      content: {
        concept_ref: conceptRef,
        treatments,
        claims,
        contradictions,
        intent_lease_id: null,
      },
      evidence: [],
      confidence: 1,
      uncertainty_estimate: 0,
      reasoning_depth: 0,
      classification: "internal",
      policy_tags: [],
      requires_human_review: false,
      priority: 4,
      expiry: null,
    } as unknown as CognitionPacket;
  }

  /**
   * A claim is about a concept when its about_concepts carries the concept's slug, or — a fallback
   * for claims the model grounded on anchors without the exact concept id (no semantic layer at the
   * gateway yet) — when the claim's own words name the concept. The statement fallback requires ALL
   * of the concept's meaning-bearing tokens (the same token match the attention anchorer uses), so
   * it attributes honestly and never invents a topic the claim does not mention.
   */
  private claimIsAbout(claim: Claim, conceptRef: string): boolean {
    const conceptSlug = slug(conceptRef);
    if (claim.about_concepts.some((c) => c === conceptSlug || c === conceptRef)) return true;
    const tokens = titleTokens(conceptRef);
    if (tokens.length === 0) return false;
    const haystack = slug(claim.statement);
    return tokens.every(
      (t) => haystack.includes(t) || (t.endsWith("s") && haystack.includes(t.slice(0, -1))),
    );
  }

  /** Emit a `source.*` event on the hub bus (separate id/hlc stream, per CSE-002 §9). */
  private async emitHubEvent(
    eventType: string,
    payload: Record<string, unknown>,
    producerCid = "cog-source-fusion",
  ): Promise<void> {
    const created = createEvent(
      {
        eventType,
        producerCid,
        producerType: "product.source-environment",
        payload,
        topic: `cos.${eventType}`,
        classification: "internal",
      },
      { clock: this.fusionClock, hlc: this.fusionHlc, idGenerator: this.fusionIds },
    );
    this.fusionHlc = created.hlc;
    await this.bus.publish(created.event);
  }

  /** Build a request packet for the `claim` unit (extract | contrast). Not published on any bus. */
  private buildClaimPacket(
    input: Readonly<{
      mode: "extract" | "contrast";
      versionId?: string;
      regions?: readonly { path: string; kind: string; text: string }[];
      concepts?: readonly ConceptInput[];
      claims?: readonly {
        claim_id: string;
        statement: string;
        source_version_id: string;
        about_concepts: readonly string[];
      }[];
    }>,
  ): CognitionPacket {
    this.claimPacketSeq += 1;
    return {
      packet_id: `claim-${input.mode}-${this.claimPacketSeq}`,
      schema_version: "1.0.0",
      source_cid: "cog-source-hub",
      target_cid: "agent.claim",
      tenant_id: null,
      session_id: null,
      causation_id: null,
      correlation_id: null,
      timestamp: new Date(this.fusionClock.nowMs()).toISOString(),
      hlc: "0000000000000001-00000000-hub",
      sequence_number: 0,
      packet_type: "request",
      intent: `claim-${input.mode}`,
      concept_ids: [],
      domain_ids: [],
      content: {
        mode: input.mode,
        ...(input.versionId ? { version_id: input.versionId } : {}),
        ...(input.regions ? { regions: input.regions.map((r) => ({ ...r })) } : {}),
        ...(input.concepts
          ? {
              concepts: input.concepts.map((c) => ({
                concept_id: c.concept_id,
                label: c.label,
                ...(c.definition ? { definition: c.definition } : {}),
              })),
            }
          : {}),
        ...(input.claims
          ? {
              claims: input.claims.map((c) => ({
                claim_id: c.claim_id,
                statement: c.statement,
                source_version_id: c.source_version_id,
                about_concepts: [...c.about_concepts],
              })),
            }
          : {}),
        intent_lease_id: null,
      },
      evidence: [],
      confidence: 1,
      uncertainty_estimate: 0,
      reasoning_depth: 0,
      classification: "internal",
      policy_tags: [],
      requires_human_review: false,
      priority: 4,
      expiry: null,
    } as unknown as CognitionPacket;
  }

  /** Anchors already bound to this concept (L2 canonicalization or a prior teach), resolved. */
  private existingAnchorViews(
    versionId: string,
    conceptId: string,
    conceptTitle: string,
  ): readonly SourceEvidenceAnchorView[] | null {
    const index = this.store.anchorIndex(versionId as SourceVersionId);
    if (!index) return null;
    const conceptSlug = slug(conceptId);
    const titleSlug = slug(conceptTitle);
    const matched = index.list().filter((a) =>
      a.concept_refs.some((ref) => {
        const refSlug = slug(ref);
        return refSlug === conceptSlug || refSlug === titleSlug;
      }),
    );
    if (matched.length === 0) return null;
    const views: SourceEvidenceAnchorView[] = [];
    for (const anchor of matched) {
      const resolution = index.resolutionOf(anchor.anchor_id);
      if (resolution?.status !== "resolved") continue; // skip, never mis-highlight
      const region = this.regionView(versionId, resolution.region.path, resolution.region.text);
      if (region) {
        views.push({
          anchor_id: anchor.anchor_id,
          source_version_id: versionId,
          concept_ref: conceptId,
          granularity: anchor.granularity,
          region,
        });
      }
    }
    return views.length > 0 ? views : null;
  }

  /**
   * Attention-driven anchor creation (CSE-003): find the structural regions that best match the
   * concept title's tokens and anchor them for this concept — the act of teaching deepens the
   * environment. Anchors carry structural + text-quote (+ region when paginated) selectors.
   */
  private async anchorsFromAttention(
    versionId: string,
    conceptId: string,
    conceptTitle: string,
  ): Promise<readonly SourceEvidenceAnchorView[] | null> {
    const structural = this.structuralOf(versionId);
    if (!structural) return null;
    const tokens = [...new Set([...titleTokens(conceptTitle), ...titleTokens(conceptId)])];
    if (tokens.length === 0) return null;

    const scored = structural.regions
      .filter((r) => r.confidence >= 0.5 && r.text.trim().length > 0) // degraded/placeholder regions never anchor
      .map((region) => {
        const haystack = slug(region.text);
        // Singular/plural-tolerant containment ("functions" ⇔ "function") — still a real text
        // overlap requirement; a concept the source does not discuss stays unmatched (honest).
        const score = tokens.filter(
          (t) => haystack.includes(t) || (t.endsWith("s") && haystack.includes(t.slice(0, -1))),
        ).length;
        return { region, score };
      })
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score || a.region.ordinal - b.region.ordinal)
      .slice(0, 2);
    if (scored.length === 0) return null;

    const views: SourceEvidenceAnchorView[] = [];
    for (const { region } of scored) {
      const selectors: AnchorSelector[] = [
        { type: "structural", path: region.path },
        { type: "text-quote", exact: region.text },
      ];
      if (typeof region.page === "number" && region.bbox) {
        selectors.push({ type: "region", page: region.page, bbox: region.bbox });
      }
      const created = this.store.createAnchorAt({
        version_id: versionId as SourceVersionId,
        selectors,
        granularity: region.kind === "heading" ? "section" : "paragraph",
        concept_refs: [conceptId],
        created_by: "viewport-planner",
      });
      if (!created.ok) continue; // ambiguous/unresolvable ⇒ skipped, never guessed
      const view = this.regionView(versionId, region.path, region.text);
      if (view) {
        views.push({
          anchor_id: created.value.anchor_id,
          source_version_id: versionId,
          concept_ref: conceptId,
          granularity: created.value.granularity,
          region: view,
        });
      }
    }
    return views.length > 0 ? views : null;
  }

  /** Build the region view a client renders against: char span + quote + page/bbox geometry. */
  private regionView(versionId: string, path: string, text: string): SourceRegionView | null {
    const structural = this.structuralOf(versionId);
    const region: StructuralRegion | undefined = structural?.regions.find((r) => r.path === path);
    if (!region) return null;
    return {
      path,
      page: typeof region.page === "number" ? region.page : null,
      bbox: region.bbox ?? null,
      char_start: region.char_start,
      char_end: region.char_end,
      quote: text.length > 240 ? `${text.slice(0, 240)}…` : text,
    };
  }

  private structuralOf(versionId: string): StructuralLayerContent | undefined {
    const artifact = this.store.layer(versionId as SourceVersionId, "structural");
    return artifact ? (artifact.content as StructuralLayerContent) : undefined;
  }
}
