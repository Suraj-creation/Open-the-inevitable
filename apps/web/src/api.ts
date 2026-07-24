/**
 * Typed command channel to the Surface Gateway — the ONLY mutation path (SRF-005 §4.3).
 * The client proposes intents; the governed runtime decides. The client never writes canonical state.
 */
/**
 * Origin of the Surface Gateway. Empty in local dev + same-origin deploys → relative `/api` (the
 * Vite proxy / same host serves it). For a split deploy (web on Vercel, gateway on Render), set
 * `VITE_API_BASE` to the gateway's absolute origin at build time; the gateway sends `Access-Control-
 * Allow-Origin: *`, so cross-origin fetch AND the SSE EventSource work without a proxy (ADR-0062).
 */
export const API_BASE = import.meta.env.VITE_API_BASE ?? "";
const BASE = `${API_BASE}/api`;
const LEARNER_STORE_KEY = "inevitable.learner";

interface LearnerCredential {
  readonly learnerId: string;
  readonly apiKey: string;
}

/** The learner's durable credential from a prior visit — so understanding compounds across sessions. */
function readCredential(): LearnerCredential | null {
  try {
    const raw = globalThis.localStorage?.getItem(LEARNER_STORE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LearnerCredential>;
    return parsed.learnerId && parsed.apiKey
      ? { learnerId: parsed.learnerId, apiKey: parsed.apiKey }
      : null;
  } catch {
    return null;
  }
}

function writeCredential(cred: LearnerCredential): void {
  try {
    globalThis.localStorage?.setItem(LEARNER_STORE_KEY, JSON.stringify(cred));
  } catch {
    /* storage unavailable (private mode / SSR) — identity is best-effort */
  }
}

/**
 * Enter a new cognitive environment; returns the surface id to stream from. If we hold a learner
 * credential from a prior visit, we authenticate as that learner so the gateway seeds the new surface
 * with their prior mastery (F05 continuity — a returning learner never starts from zero). A freshly
 * minted learner's api_key is captured and persisted for next time.
 */
export async function enterSurface(goal: string, mode?: string): Promise<string> {
  const cred = readCredential();
  const res = await fetch(`${BASE}/surface`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(cred ? { Authorization: `Bearer ${cred.apiKey}` } : {}),
    },
    body: JSON.stringify({ goal, ...(mode ? { mode } : {}) }),
  });
  const json = (await res.json()) as {
    ok: boolean;
    surface_id?: string;
    learner_id?: string;
    api_key?: string;
  };
  if (!json.ok || !json.surface_id) throw new Error("gateway: failed to enter surface");
  if (json.learner_id && json.api_key) {
    writeCredential({ learnerId: json.learner_id, apiKey: json.api_key });
  }
  return json.surface_id;
}

export type SurfaceInteractionKind =
  | "interrupt"
  | "jump"
  | "branch"
  | "challenge"
  | "request_depth"
  | "request_simplify"
  | "request_example"
  // CSE-014 grammar (M8 T2): Mark (evolve the Scene in place) + Ask (re-frame cognition).
  | "annotate"
  | "circle"
  | "highlight"
  | "pin"
  | "ask_why"
  | "ask_simpler"
  | "ask_deeper"
  | "ask_example"
  | "define";

export type SurfaceCommand =
  | { type: "ask"; goal?: string }
  | { type: "advance"; concept_id?: string }
  | { type: "answer"; concept_id: string; text: string }
  | { type: "expand"; block_id: string; layer: number }
  | { type: "close"; reason?: string }
  | { type: "interact"; kind: SurfaceInteractionKind; target_id?: string; note?: string };

/**
 * Send a typed command into a living surface. Effects return over the stream, not here.
 * Throws on a transport/gateway error so callers can surface a real error state (never fail silently).
 */
export async function sendCommand(surfaceId: string, command: SurfaceCommand): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/surface/${surfaceId}/command`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(command),
    });
  } catch (cause) {
    throw new Error(`gateway unreachable: ${cause instanceof Error ? cause.message : "network"}`);
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `gateway rejected ${command.type} (${res.status})${detail ? `: ${detail}` : ""}`,
    );
  }
}

/**
 * Close the session as the learner leaves (ADR-0055 D4) — the trigger for intelligence distillation
 * (episodes, understanding deltas, the resume card). Uses `fetch(..., {keepalive: true})`, not
 * `navigator.sendBeacon`: the command channel is a JSON POST, and keepalive survives page dismissal
 * while carrying the `Content-Type` a beacon cannot. Best-effort and silent — a leaving page must
 * never block on it, and a failed close simply means no distillation this visit.
 */
export function closeSurface(surfaceId: string, reason: string): void {
  try {
    void fetch(`${BASE}/surface/${surfaceId}/command`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "close", reason }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* dismissal races / unavailable fetch — distillation is best-effort, never blocks leaving */
  }
}

/** The full causal chain behind one visible block — why it appeared (SRF-001 §8 Trace API). */
export interface BlockTraceView {
  readonly block_id: string;
  readonly producer_cid: string;
  readonly agent_id: string | null;
  readonly reason: string;
  readonly packet_id: string | null;
  readonly trace_id: string | null;
  readonly memory_mutation_id: string | null;
  readonly world_state_nodes: readonly { readonly id: string; readonly exists: boolean }[];
  readonly event_chain: readonly string[];
}

/** Resolve a block's provenance chain from the gateway. */
export async function fetchTrace(
  surfaceId: string,
  blockId: string,
): Promise<BlockTraceView | null> {
  const res = await fetch(`${BASE}/surface/${surfaceId}/trace/${blockId}`);
  const json = (await res.json()) as { ok: boolean; trace?: BlockTraceView };
  return json.ok && json.trace ? json.trace : null;
}

/** A cross-source contradiction between two claims (CSE M9 T2 Claim Graph, CSE-006 §3.1). */
export interface ContradictionView {
  readonly claim_ids: readonly string[];
  readonly source_version_ids: readonly string[];
  /** empirical | interpretive | value — a value/interpretive difference is never shown as factual. */
  readonly nature: "empirical" | "interpretive" | "value";
  readonly rationale?: string;
}

/** A claim a source makes about a concept, traceable to its anchors (CSE M9 T2). */
export interface ClaimView {
  readonly claim_id: string;
  readonly statement: string;
  readonly source_version_id: string;
  readonly epistemic_status: string;
  readonly anchor_refs: readonly string[];
}

/** The fused explanation of a concept — one understanding woven from all sources (CSE M9 T3). */
export interface FusedSynthesisView {
  readonly prose: string;
  readonly cited_source_ids: readonly string[];
  readonly acknowledges_disagreement: boolean;
  readonly degraded: boolean;
}

/** One concept reconciled across the surface's bound sources (CSE M9 Source Fusion, CSE-015). */
export interface FusedConceptView {
  readonly concept_ref: string;
  readonly source_treatments: readonly {
    readonly source_version_id: string;
    readonly title: string;
    readonly anchor_refs: readonly string[];
    readonly emphasis: string;
    readonly coverage: "full" | "partial" | "absent";
    readonly quote: string | null;
  }[];
  readonly reconciliation: {
    readonly corroborated: boolean;
    readonly corroborating_source_ids: readonly string[];
    readonly complements: readonly { readonly aspect: string; readonly from_source: string }[];
    readonly contradictions: readonly ContradictionView[];
  };
  readonly confidence: number;
  /** The claims each source makes about this concept (M9 T2) — absent when no model ran. */
  readonly claims?: readonly ClaimView[];
  /** The fused explanation woven from all sources (M9 T3) — absent when no model synthesized. */
  readonly synthesis?: FusedSynthesisView;
}

export interface FusionView {
  readonly concept_refs: readonly string[];
  readonly source_version_ids: readonly string[];
  readonly concepts: readonly FusedConceptView[];
  readonly gaps: readonly { readonly concept_ref: string; readonly reason: string }[];
}

/** Reconcile the surface's bound sources over a concept set — Source Fusion (CSE-015). */
export async function fuseSources(
  surfaceId: string,
  conceptRefs: readonly string[],
): Promise<FusionView | null> {
  const res = await fetch(`${BASE}/surface/${surfaceId}/fuse`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ concept_refs: conceptRefs }),
  });
  const json = (await res.json()) as { ok: boolean; fusion?: FusionView };
  return json.ok && json.fusion ? json.fusion : null;
}

/** One typed frontier link from a concept to the living edge, grounded in real citations (M9). */
export interface FrontierEntryView {
  readonly kind: string;
  readonly summary: string;
  readonly external_refs: readonly { readonly uri: string; readonly title: string }[];
  readonly as_of: string;
}

/** A concept's living-knowledge overlay (CSE M9 Frontier T1, CSE-006 §3.2). */
export interface FrontierView {
  readonly overlay_id: string;
  readonly concept_ref: string;
  readonly source_version_id: string | null;
  readonly entries: readonly FrontierEntryView[];
  readonly as_of: string;
  readonly degraded: boolean;
}

/** Research a concept's living-knowledge frontier via governed web search (CSE-006 §3.2). */
export async function researchFrontier(
  surfaceId: string,
  conceptRef: string,
): Promise<FrontierView | null> {
  const res = await fetch(`${BASE}/surface/${surfaceId}/frontier`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ concept_ref: conceptRef }),
  });
  const json = (await res.json()) as { ok: boolean; frontier?: FrontierView };
  return json.ok && json.frontier ? json.frontier : null;
}

/** One point on a concept's timeline, grounded in real citations (CSE M9 TKM T1). */
export interface EpistemicStateView {
  readonly kind: string;
  readonly label: string;
  readonly summary: string;
  readonly era: string | null;
  readonly external_refs: readonly { readonly uri: string; readonly title: string }[];
  readonly as_of: string;
}

/** A concept's Temporal Knowledge Model — its trajectory through time (CSE-006 §3.3). */
export interface TimelineView {
  readonly timeline_id: string;
  readonly concept_ref: string;
  readonly source_version_id: string | null;
  readonly states: readonly EpistemicStateView[];
  readonly as_of: string;
  readonly degraded: boolean;
}

/** Research a concept's Temporal Knowledge Model via governed web search (CSE-006 §3.3). */
export async function researchTimeline(
  surfaceId: string,
  conceptRef: string,
): Promise<TimelineView | null> {
  const res = await fetch(`${BASE}/surface/${surfaceId}/timeline`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ concept_ref: conceptRef }),
  });
  const json = (await res.json()) as { ok: boolean; timeline?: TimelineView };
  return json.ok && json.timeline ? json.timeline : null;
}

// ── Creative Cognition (CSE M11 T1, CSE-016) ─────────────────────────────────────────────────────
// The learner authors; the system only ever attaches DISCLOSED assists — never the artifact. Each
// assist is exactly one of slots / findings / questions / refs (the no-ghostwriter law is structural).

export interface ScaffoldSlotView {
  readonly label: string;
  readonly hint: string;
}

export interface CritiqueFindingView {
  readonly severity: "minor" | "major" | "blocking";
  readonly where: string;
  readonly issue: string;
  readonly suggestion: string;
}

export interface CreationReferenceRefView {
  readonly label: string;
  readonly source: string;
}

/** One disclosed assist offered over a creation — structure/findings/questions/refs, never prose. */
export interface CreationAssistView {
  readonly assist_id: string;
  readonly kind: "scaffold" | "critique" | "provocation" | "reference";
  readonly agent_cid: string;
  readonly disclosed: true;
  readonly as_of: string;
  readonly slots?: readonly ScaffoldSlotView[];
  readonly findings?: readonly CritiqueFindingView[];
  readonly questions?: readonly string[];
  readonly refs?: readonly CreationReferenceRefView[];
  readonly degraded?: boolean;
}

/** A learner's creation — their authored draft plus the disclosed assists offered along the way. */
export interface CreationView {
  readonly creation_id: string;
  readonly learner_cid: string | null;
  readonly kind: string;
  readonly title: string;
  readonly concept_refs: readonly string[];
  readonly draft: string;
  readonly assists: readonly CreationAssistView[];
  readonly status: "prompted" | "in_progress" | "critiqued" | "completed";
  readonly as_of: string;
  /** The source-version id this creation became when contributed (ADR-0051); null until then. */
  readonly contributed_as?: string | null;
}

/** Open a creation — the learner's artifact-in-progress (CSE-016 §3.1). */
export async function startCreation(
  surfaceId: string,
  input: Readonly<{ kind: string; title: string; conceptRefs: readonly string[]; draft?: string }>,
): Promise<CreationView | null> {
  const res = await fetch(`${BASE}/surface/${surfaceId}/creation`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      kind: input.kind,
      title: input.title,
      concept_refs: input.conceptRefs,
      ...(input.draft !== undefined ? { draft: input.draft } : {}),
    }),
  });
  const json = (await res.json()) as { ok: boolean; creation?: CreationView };
  return json.ok && json.creation ? json.creation : null;
}

/** Ask for a disclosed assist over the creation (scaffold|critique|provocation|reference). */
export async function assistCreation(
  surfaceId: string,
  creationId: string,
  mode: "scaffold" | "critique" | "provocation" | "reference",
  draft?: string,
): Promise<CreationView | null> {
  const res = await fetch(`${BASE}/surface/${surfaceId}/creation/${creationId}/assist`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode, ...(draft !== undefined ? { draft } : {}) }),
  });
  const json = (await res.json()) as { ok: boolean; creation?: CreationView };
  return json.ok && json.creation ? json.creation : null;
}

/** Complete a creation with the learner's final draft. */
export async function completeCreation(
  surfaceId: string,
  creationId: string,
  draft?: string,
): Promise<CreationView | null> {
  const res = await fetch(`${BASE}/surface/${surfaceId}/creation/${creationId}/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(draft !== undefined ? { draft } : {}),
  });
  const json = (await res.json()) as { ok: boolean; creation?: CreationView };
  return json.ok && json.creation ? json.creation : null;
}

/**
 * Contribute a completed creation into the shared substrate as a Cognitive Source (ADR-0051).
 * Consent is explicit and required — the learner's draft becomes citable/fusable; the assists stay
 * disclosed provenance. Returns the updated creation (with `contributed_as`) or null if refused.
 */
export async function contributeCreation(
  surfaceId: string,
  creationId: string,
  consent: boolean,
): Promise<CreationView | null> {
  const res = await fetch(`${BASE}/surface/${surfaceId}/creation/${creationId}/contribute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ consent }),
  });
  const json = (await res.json()) as { ok: boolean; creation?: CreationView };
  return json.ok && json.creation ? json.creation : null;
}

/** Revoke a contribution's consent + cascade a redaction (ADR-0054 — the right to un-share). The
 * source is delisted from the commons, its bytes withheld, and reuse blocked. Returns the updated
 * creation (`contributed_as` cleared) or null if refused. */
export async function revokeCreation(
  surfaceId: string,
  creationId: string,
): Promise<CreationView | null> {
  const res = await fetch(`${BASE}/surface/${surfaceId}/creation/${creationId}/revoke`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  const json = (await res.json()) as { ok: boolean; creation?: CreationView };
  return json.ok && json.creation ? json.creation : null;
}

// ── Source Cognition — deep-transparency read of the source plane (CSE M12 T1, ADR-0050) ──────────
// The source environment's reasoning made observable: what it built, doubted, grounded, degraded.

export interface SourceCognitionActivityView {
  readonly versions_registered: number;
  readonly layers_constructed: number;
  readonly layers_degraded: number;
  readonly claims_recorded: number;
  readonly contradictions_detected: number;
  readonly fusions_composed: number;
  readonly syntheses: number;
  readonly frontier_updates: number;
  readonly timeline_updates: number;
  readonly creations_started: number;
  readonly creation_assists: number;
  readonly creations_completed: number;
  readonly creations_contributed: number;
  readonly consents_granted: number;
  readonly consents_revoked: number;
  readonly redactions: number;
}

export interface SourceLayerHealthView {
  readonly version_id: string;
  readonly layer: string;
  readonly confidence: number;
  readonly degraded: boolean;
}

export interface SourceCognitionEntryView {
  readonly event_type: string;
  readonly at: string;
  readonly producer_cid: string;
  readonly summary: string;
  readonly confidence: number | null;
  readonly degraded: boolean;
}

export interface SourceCacheStatsView {
  readonly hits: number;
  readonly misses: number;
  readonly hit_rate: number;
  readonly by_kind: Readonly<Record<string, { readonly hits: number; readonly misses: number }>>;
}

export interface SourceCognitionView {
  readonly activity: SourceCognitionActivityView;
  readonly layers: readonly SourceLayerHealthView[];
  readonly model_invocations: number;
  readonly degraded_count: number;
  readonly recent: readonly SourceCognitionEntryView[];
  readonly total_events: number;
  readonly cache: SourceCacheStatsView;
}

/** Fetch the source plane's deep-transparency read (host-level; the substrate is shared). */
export async function fetchSourceCognition(recent = 40): Promise<SourceCognitionView | null> {
  const res = await fetch(`${BASE}/sources/cognition?recent=${recent}`);
  const json = (await res.json()) as { ok: boolean; cognition?: SourceCognitionView };
  return json.ok && json.cognition ? json.cognition : null;
}

// ── The knowledge commons — discovery of contributed creations (ADR-0053) ────────────────────────
// Only consented contributions appear; each entry is public metadata + honest authorship.

export interface CommonsEntryView {
  readonly source_version_id: string;
  readonly creation_id: string;
  readonly title: string;
  readonly kind: string;
  readonly author_cid: string | null;
  readonly concept_refs: readonly string[];
  readonly content_hash: string;
  readonly contributed_at: string;
}

/** Browse the knowledge commons — what peers have made and shared, for you to build on. */
export async function fetchCommons(): Promise<readonly CommonsEntryView[]> {
  const res = await fetch(`${BASE}/sources/commons`);
  const json = (await res.json()) as { ok: boolean; commons?: readonly CommonsEntryView[] };
  return json.ok && json.commons ? json.commons : [];
}

/** Bind a source (e.g. a commons entry) to the current surface so you can teach/fuse from it. */
export async function attachSource(surfaceId: string, sourceVersionId: string): Promise<boolean> {
  const res = await fetch(`${BASE}/surface/${surfaceId}/sources`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source_version_id: sourceVersionId }),
  });
  const json = (await res.json()) as { ok: boolean };
  return json.ok === true;
}

/**
 * Teach FROM a bound source (R2c, ADR-0057 D3): the document's own concepts/sections become the
 * curriculum — the document IS the timeline. Optional `sourceVersionId` targets one bound source;
 * omitted, the gateway teaches the surface's primary source. Returns true when a timeline was built
 * (frames stream in over the surface); throws the gateway's message on refusal (no usable structure).
 */
export async function teachSource(surfaceId: string, sourceVersionId?: string): Promise<boolean> {
  const res = await fetch(`${BASE}/surface/${surfaceId}/teach-source`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(sourceVersionId ? { source_version_id: sourceVersionId } : {}),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(detail || `gateway could not teach from this source (${res.status})`);
  }
  const json = (await res.json()) as { ok: boolean };
  return json.ok === true;
}

// ── Source acquisition — the Source Dock's ingest path (CSE-017, ADR-0056) ───────────────────────
// A learner brings a source in-product: raw bytes for a file, a URL for a governed crawl. The
// registration summary IS the honest loading narrative (which layers built, which degraded, usable).

/** A registered source — the gateway's registration summary (mirror of the API `RegisteredSource`). */
export interface RegisteredSourceView {
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
 * Register a source from raw content (CSE-017 §3): text modalities take a string, binary (PDF)
 * takes bytes. The gateway content-addresses + canonicalizes it. Throws the gateway's own message
 * on refusal (unsupported modality, oversized upload, parse failure) so the dock shows it verbatim.
 */
export async function registerSource(input: {
  content: string | ArrayBuffer | Uint8Array;
  modality: string;
  title: string;
}): Promise<RegisteredSourceView> {
  const query = `modality=${encodeURIComponent(input.modality)}&title=${encodeURIComponent(input.title)}`;
  // Binary content ships as a Blob (a clean BodyInit for raw bytes); text ships as a string.
  let body: BodyInit;
  if (typeof input.content === "string") {
    body = input.content;
  } else {
    const bytes =
      input.content instanceof Uint8Array ? input.content : new Uint8Array(input.content);
    body = new Blob([bytes as BlobPart]);
  }
  const res = await fetch(`${BASE}/sources?${query}`, {
    method: "POST",
    headers: {
      "Content-Type": input.modality === "pdf" ? "application/pdf" : "text/plain; charset=utf-8",
    },
    body,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(detail || `gateway rejected source (${res.status})`);
  }
  const json = (await res.json()) as { ok: boolean; source?: RegisteredSourceView };
  if (!json.ok || !json.source) throw new Error("gateway: source registration failed");
  return json.source;
}

/**
 * Register a web page by URL via the governed server-side crawler (ADR-0052). SSRF-safe,
 * deny-by-default; a blocked URL throws the gateway's policy explanation for the dock to show.
 */
export async function crawlSource(url: string): Promise<RegisteredSourceView> {
  const res = await fetch(`${BASE}/sources/crawl`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(detail || `gateway rejected crawl (${res.status})`);
  }
  const json = (await res.json()) as { ok: boolean; source?: RegisteredSourceView };
  if (!json.ok || !json.source) throw new Error("gateway: crawl failed");
  return json.source;
}
