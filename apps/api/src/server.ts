/**
 * Surface Gateway server — the visible-surface boundary (SRF-005).
 *
 * Transport: SSE down (the canonical surface.* event log), HTTP POST up (a typed command
 * envelope routed through the governed dispatch path). The browser folds the streamed log with
 * the SAME `foldSurfaceEvents` the runtime uses, so the client is a viewport, never the source of
 * truth (replay equivalence, SRF-005 §6.2). Zero new runtime dependencies — node:http only.
 *
 * Routes:
 *   POST /api/surface                      enter a new cognitive environment   -> { surface_id }
 *   GET  /api/surface/:id/stream           SSE: snapshot + live surface.* frames (Last-Event-ID resume)
 *   POST /api/surface/:id/command          typed command envelope { ask | expand | close }
 *   GET  /api/surface/:id/state            folded SurfaceState snapshot (convenience)
 *   GET  /api/surface/:id/trace/:blockId   full provenance chain for a block
 *   GET  /api/surface/:id/media/:artifactId  out-of-band narration audio (bytes, not on the stream)
 *   POST /api/sources?modality=&title=     register + canonicalize a source (raw bytes body; CSE M5)
 *   POST /api/sources/crawl { url }        governed SSRF-safe fetch → web source (ADR-0052)
 *   GET  /api/sources/commons              the knowledge commons — contributed creations (ADR-0053)
 *   GET  /api/sources/cognition            deep-transparency read of the source plane (CSE M12 T1)
 *   GET  /api/sources/:versionId/content   canonical source bytes + X-Content-Hash (fidelity proof)
 *   POST /api/surface/:id/sources          bind a registered source { source_version_id } (CSE M5)
 *   POST /api/surface/:id/fuse             reconcile bound sources over { concept_refs } (CSE M9 T1)
 *   POST /api/surface/:id/frontier         research a concept's living frontier { concept_ref } (M9)
 *   POST /api/surface/:id/timeline         research a concept's temporal model { concept_ref } (M9)
 *   POST /api/surface/:id/creation         open a learner creation { kind, title, concept_refs } (M11)
 *   POST /api/surface/:id/creation/:cid/assist    offer a disclosed assist { mode, draft? } (M11)
 *   POST /api/surface/:id/creation/:cid/complete  complete with the learner's final { draft? } (M11)
 *   POST /api/surface/:id/creation/:cid/contribute  consent it into the substrate as a source (ADR-0051)
 *   POST /api/surface/:id/creation/:cid/revoke       revoke consent + cascade a redaction (ADR-0054)
 *
 * Spec: spec/surface/surface-streaming-sync-protocol.md, spec/architecture-decisions/ADR-0006;
 * source routes: spec/source-environment/CSE-008-source-surface-projection.md §3, ADR-0036;
 * creative cognition: spec/source-environment/CSE-016-creative-cognition.md, ADR-0049.
 */
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { CognitiveEvent } from "@inevitable/protocols";
import { type CosError } from "@inevitable/shared";
import { SurfaceHost, gatewayError, type ServedSurface } from "./host";

/** The only mutation channel into a living surface. Additive by design (SRF-005 §4.3). The
 * CSE-014 grammar (M8 T2) extends the original ADR-0024 seven — the surface session's grammar
 * registry is the single source of truth for classification/routing. */
export type SurfaceInteractionKind =
  | "interrupt"
  | "jump"
  | "branch"
  | "challenge"
  | "request_depth"
  | "request_simplify"
  | "request_example"
  | "annotate"
  | "circle"
  | "highlight"
  | "pin"
  | "ask_why"
  | "ask_again"
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

const SNAPSHOT_COMPLETE = ": snapshot-complete\n\n";

function cors(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Last-Event-ID, Authorization",
    // The client's fidelity proof (ADR-0036) hashes fetched bytes against this header.
    "Access-Control-Expose-Headers": "X-Content-Hash",
  };
}

/** Extract a bearer token from the `Authorization: Bearer <token>` header. */
function extractBearer(req: IncomingMessage): string | undefined {
  const header = req.headers["authorization"];
  if (typeof header !== "string") return undefined;
  const match = /^Bearer\s+(\S+)$/i.exec(header);
  return match?.[1];
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json", ...cors() });
  res.end(JSON.stringify(body));
}

function sendError(res: ServerResponse, status: number, error: CosError): void {
  sendJson(res, status, {
    ok: false,
    error: { code: error.code, message: error.message, details: error.details ?? null },
  });
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;
}

/** Upload body cap (ADR-0056 D2): a learner-facing source upload is bounded; past it → 413. */
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

/** Sentinel thrown by `readBytes` when the body exceeds the cap; the route maps it to 413. */
class PayloadTooLargeError extends Error {}

async function readBytes(req: IncomingMessage): Promise<Uint8Array> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    total += (chunk as Buffer).byteLength;
    if (total > MAX_UPLOAD_BYTES) {
      req.destroy();
      throw new PayloadTooLargeError();
    }
    chunks.push(chunk as Buffer);
  }
  return new Uint8Array(Buffer.concat(chunks));
}

function writeFrame(res: ServerResponse, event: CognitiveEvent): void {
  res.write(`id: ${event.sequence ?? 0}\n`);
  res.write(`event: surface\n`);
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

/** Attach a viewport: replay the snapshot (or resume from Last-Event-ID), then stream live frames. */
function streamSurface(served: ServedSurface, req: IncomingMessage, res: ServerResponse): void {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    ...cors(),
  });
  served.onAttach();

  const header = req.headers["last-event-id"];
  const lastId = Number(Array.isArray(header) ? header[0] : header);
  const fromSequence = Number.isFinite(lastId) ? lastId + 1 : 0;

  // Subscribe-before-replay (N11): buffer live events while the snapshot replays, then flush them —
  // deduped by sequence — so no event published mid-attach is dropped and none is sent twice.
  let lastSent = fromSequence - 1;
  let flushed = false;
  const buffer: CognitiveEvent[] = [];
  const emit = (event: CognitiveEvent): void => {
    const seq = event.sequence ?? lastSent + 1;
    if (seq <= lastSent) return; // already sent (dedupe)
    writeFrame(res, event);
    lastSent = seq;
  };
  const sub = served.subscribeStream((event) => {
    if (!flushed) {
      buffer.push(event);
      return;
    }
    try {
      emit(event);
    } catch {
      sub.unsubscribe();
    }
  });

  for (const event of served.surfaceStream(fromSequence)) emit(event);
  res.write(SNAPSHOT_COMPLETE);
  // Flush anything that streamed in during replay, then switch to live pass-through.
  for (const event of buffer) emit(event);
  buffer.length = 0;
  flushed = true;

  req.on("close", () => {
    sub.unsubscribe();
    served.onDetach();
  });
}

async function handleCommand(
  served: ServedSurface,
  command: SurfaceCommand,
  res: ServerResponse,
): Promise<void> {
  switch (command?.type) {
    case "ask": {
      const goal =
        typeof command.goal === "string" && command.goal.trim() ? command.goal : served.goal;
      const result = await served.ask(goal);
      if (!result.ok) return sendError(res, 422, result.error);
      return sendJson(res, 200, { ok: true, blocks: result.value.blocks.length });
    }
    case "advance": {
      // Teach the next (or a requested) concept on the existing path — no curriculum regeneration.
      const conceptId =
        typeof command.concept_id === "string" && command.concept_id.trim()
          ? command.concept_id.trim()
          : undefined;
      const result = await served.advance(conceptId);
      if (!result.ok) return sendError(res, 422, result.error);
      return sendJson(res, 200, { ok: true, blocks: result.value.blocks.length });
    }
    case "answer": {
      // Grade a learner's real answer into earned mastery (F14).
      if (typeof command.concept_id !== "string" || typeof command.text !== "string") {
        return sendError(
          res,
          400,
          gatewayError("answer requires concept_id (string) and text (string)"),
        );
      }
      const result = await served.answer(command.concept_id, command.text);
      if (!result.ok) return sendError(res, 422, result.error);
      return sendJson(res, 200, { ok: true, effect: result.value.effect });
    }
    case "expand": {
      if (typeof command.block_id !== "string" || typeof command.layer !== "number") {
        return sendError(
          res,
          400,
          gatewayError("expand requires block_id (string) and layer (number)"),
        );
      }
      const result = await served.expand(command.block_id, command.layer);
      if (!result.ok) return sendError(res, 422, result.error);
      return sendJson(res, 200, {
        ok: true,
        block_id: result.value.block_id,
        version: result.value.version,
      });
    }
    case "close": {
      const result = await served.close(command.reason);
      if (!result.ok) return sendError(res, 422, result.error);
      return sendJson(res, 200, { ok: true });
    }
    case "interact": {
      const valid: readonly SurfaceInteractionKind[] = [
        "interrupt",
        "jump",
        "branch",
        "challenge",
        "request_depth",
        "request_simplify",
        "request_example",
        // CSE-014 grammar (M8 T2): Mark (evolve the Scene) + Ask (re-frame cognition).
        "annotate",
        "circle",
        "highlight",
        "pin",
        "ask_why",
        "ask_again",
        "ask_simpler",
        "ask_deeper",
        "ask_example",
        "define",
      ];
      if (typeof command.kind !== "string" || !valid.includes(command.kind)) {
        return sendError(res, 400, gatewayError("interact requires a valid kind"));
      }
      const result = await served.interact({
        kind: command.kind,
        ...(command.target_id ? { target_id: command.target_id } : {}),
        ...(command.note ? { note: command.note } : {}),
      });
      if (!result.ok) return sendError(res, 422, result.error);
      return sendJson(res, 200, {
        ok: true,
        interaction_id: result.value.interaction_id,
        effect: result.value.effect,
      });
    }
    default:
      return sendError(
        res,
        400,
        gatewayError(`unknown command type "${String((command as { type?: unknown })?.type)}"`),
      );
  }
}

async function route(host: SurfaceHost, req: IncomingMessage, res: ServerResponse): Promise<void> {
  const method = req.method ?? "GET";
  if (method === "OPTIONS") {
    res.writeHead(204, cors());
    res.end();
    return;
  }

  // ADR-0055 D1: never serve a route over a half-rehydrated source plane. Resolves immediately
  // when persistence is off (the offline default), so this is a no-op cost there.
  await host.ready;

  const url = new URL(req.url ?? "/", "http://localhost");
  const parts = url.pathname.split("/").filter(Boolean); // ["api","surface"|"learner",id?,action?,blockId?]

  // GET /api/learner/:id[/understanding] — learner-scoped reads (DPS-003; CSE M6 ADR-0037).
  // Requires a valid bearer token that belongs to the requested learner (callers only read their own).
  if (parts[0] === "api" && parts[1] === "learner" && method === "GET") {
    const learnerId = parts[2];
    if (!learnerId) return sendError(res, 404, gatewayError("missing learner id"));
    const token = extractBearer(req);
    if (!token)
      return sendError(res, 401, gatewayError("Authorization: Bearer <api_key> required"));
    const caller = host.getLearnerByApiKey(token);
    if (!caller) return sendError(res, 401, gatewayError("unknown api key"));
    if (caller.learnerId !== learnerId)
      return sendError(res, 403, gatewayError("api key does not belong to this learner"));
    const learner = host.getLearner(learnerId);
    if (!learner) return sendError(res, 404, gatewayError("unknown learner", { learnerId }));

    // CSE M6 — the Understanding Map's read path: a projection over the learner's intelligence
    // plane (episodes + understanding deltas). Evidence, never a score (CSE-005 §3.4); disclosed
    // and learner-visible by construction (this route IS the disclosure).
    if (parts[3] === "understanding") {
      const artifacts = await host.intelligence.learnerArtifacts(learner.cid);
      return sendJson(res, 200, {
        ok: true,
        learner_id: learner.learnerId,
        episodes: artifacts
          .filter((a) => a.kind === "learner.episode")
          .map((a) => ({ artifact_id: a.artifact_id, distilled_hlc: a.distilled_hlc, ...a.body })),
        deltas: artifacts
          .filter((a) => a.kind === "learner.understanding-delta")
          .map((a) => ({ artifact_id: a.artifact_id, distilled_hlc: a.distilled_hlc, ...a.body })),
      });
    }

    return sendJson(res, 200, {
      ok: true,
      learner: {
        learner_id: learner.learnerId,
        cid: learner.cid,
        trust_level: learner.trustLevel,
        display_name: learner.displayName,
        created_at: learner.createdAt,
      },
      surfaces: learner.surfaces,
    });
  }

  // CSE M5 — Canonical Source Environment routes (CSE-008 §3; ADR-0036).
  if (parts[0] === "api" && parts[1] === "sources") {
    // POST /api/sources?modality=pdf|markdown|text&title=… — raw bytes body, register + canonicalize.
    if (parts.length === 2 && method === "POST") {
      const modality = url.searchParams.get("modality") ?? "";
      const title = url.searchParams.get("title") ?? "Untitled source";
      let bytes: Uint8Array;
      try {
        bytes = await readBytes(req);
      } catch (cause) {
        if (cause instanceof PayloadTooLargeError) {
          return sendError(
            res,
            413,
            gatewayError("source exceeds the 25 MiB upload limit", { maxBytes: MAX_UPLOAD_BYTES }),
          );
        }
        throw cause;
      }
      if (bytes.byteLength === 0) return sendError(res, 400, gatewayError("empty source body"));
      // Text modalities canonicalize from UTF-8 text; binary (PDF) from bytes (ADR-0036 seam).
      const content = modality === "pdf" ? bytes : Buffer.from(bytes).toString("utf8");
      const registered = await host.sources.register({ content, modality, title });
      if (!registered.ok) return sendError(res, 422, registered.error);
      return sendJson(res, 201, { ok: true, source: registered.value });
    }
    // ADR-0052 — POST /api/sources/crawl { url }: governed server-side fetch → web-modality source.
    // The SSRF policy gates the URL before any byte is fetched (deny-by-default).
    if (parts.length === 3 && parts[2] === "crawl" && method === "POST") {
      const body = await readJson(req);
      const url = typeof body["url"] === "string" ? body["url"].trim() : "";
      if (!url) return sendError(res, 400, gatewayError("crawl requires a url (string)"));
      const crawled = await host.sources.crawl(url);
      if (!crawled.ok) return sendError(res, 422, crawled.error);
      return sendJson(res, 201, { ok: true, source: crawled.value });
    }
    // ADR-0053 — GET /api/sources/commons: the knowledge commons (consented contributed creations,
    // discoverable by any learner). Host-level; only what was explicitly contributed appears.
    if (parts.length === 3 && parts[2] === "commons" && method === "GET") {
      return sendJson(res, 200, { ok: true, commons: host.sources.commons() });
    }
    // CSE M12 T1 (ADR-0050) — GET /api/sources/cognition: the deep-transparency read of the source
    // plane (host-level; the source substrate is shared cross-surface). Read-only, best-effort.
    if (parts.length === 3 && parts[2] === "cognition" && method === "GET") {
      const limitRaw = Number(url.searchParams.get("recent"));
      const recentLimit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 200) : 30;
      return sendJson(res, 200, { ok: true, cognition: host.sources.cognition(recentLimit) });
    }
    // GET /api/sources/:versionId/content — canonical bytes; X-Content-Hash is the fidelity proof.
    if (parts.length === 4 && parts[3] === "content" && method === "GET") {
      // ADR-0054: a redacted version returns 410 Gone (honestly "was here, withdrawn"), not a 404.
      if (host.sources.isRedacted(parts[2] ?? "")) {
        return sendError(
          res,
          410,
          gatewayError("source withdrawn by consent revocation", { versionId: parts[2] }),
        );
      }
      const served = host.sources.content(parts[2] ?? "");
      if (!served) {
        return sendError(res, 404, gatewayError("unknown source version", { versionId: parts[2] }));
      }
      res.writeHead(200, {
        "Content-Type": served.mimeType,
        "X-Content-Hash": served.contentHash,
        "Cache-Control": "public, max-age=31536000, immutable", // content-addressed: immutable
        ...cors(),
      });
      res.end(Buffer.from(served.bytes));
      return;
    }
    return sendError(res, 404, gatewayError("no such route", { path: url.pathname, method }));
  }

  if (parts[0] !== "api" || parts[1] !== "surface") {
    return sendError(res, 404, gatewayError("no such route", { path: url.pathname }));
  }

  // POST /api/surface — enter a new environment.
  // If a valid bearer token is supplied, the surface is owned by the authenticated learner.
  // Otherwise (no bearer, OR an unknown one) a fresh learner is minted and their api_key is returned
  // once. An unknown bearer is deliberately NOT a 401 here: surfaces are anonymously creatable, and a
  // free-tier gateway resets its learner registry on spin-down, so a returning visitor's key routinely
  // goes stale. Hard-rejecting entry would brick them (the client re-sends the same key forever). We
  // heal instead — mint fresh and hand back a new api_key. (Private learner-scoped READ routes keep
  // their strict 401; those protect real data, whereas creating a surface never did.)
  if (parts.length === 2 && method === "POST") {
    const body = await readJson(req);
    const goal =
      typeof body["goal"] === "string" && (body["goal"] as string).trim()
        ? (body["goal"] as string)
        : "Teach me Neural Networks";
    const VALID_MODES = new Set(["student", "educator", "institution", "researcher", "open"]);

    // Auth: a valid bearer authenticates a returning learner; no bearer OR an unknown one → anonymous.
    const token = extractBearer(req);
    const caller = token !== undefined ? host.getLearnerByApiKey(token) : undefined;
    const authenticated = caller !== undefined;

    const created = await host.create(goal, {
      trustLevel:
        typeof body["trustLevel"] === "number" ? (body["trustLevel"] as number) : undefined,
      seed: typeof body["seed"] === "string" ? (body["seed"] as string) : undefined,
      // A recognised bearer wins over any learnerId in the body (prevents impersonation); an unknown
      // bearer falls through to the body's learnerId, else a fresh mint (resolveOrCreate never spoofs).
      learnerId:
        caller?.learnerId ??
        (typeof body["learnerId"] === "string" ? (body["learnerId"] as string) : undefined),
      mode:
        typeof body["mode"] === "string" && VALID_MODES.has(body["mode"] as string)
          ? (body["mode"] as string)
          : undefined,
    });
    if (!created.ok) return sendError(res, 400, created.error);

    // Echo the api_key whenever the caller was NOT an already-authenticated returning learner — i.e.
    // a fresh mint (no bearer) OR a stale/unknown bearer we just healed — so the client can (re)store
    // it. An authenticated learner already holds their key; echoing it every request would be noisy.
    const freshLearner = authenticated ? undefined : host.getLearner(created.value.learnerId);
    return sendJson(res, 201, {
      ok: true,
      surface_id: created.value.surfaceId,
      learner_id: created.value.learnerId,
      ...(freshLearner ? { api_key: freshLearner.apiKey } : {}),
      goal,
    });
  }

  const surfaceId = parts[2];
  const action = parts[3];
  if (!surfaceId) return sendError(res, 404, gatewayError("missing surface id"));

  const served = await host.get(surfaceId);
  if (!served) return sendError(res, 404, gatewayError("unknown surface", { surfaceId }));

  if (action === "stream" && method === "GET") return streamSurface(served, req, res);

  if (action === "state" && method === "GET") {
    return sendJson(res, 200, { ok: true, state: served.state() });
  }

  if (action === "trace" && parts[4] && method === "GET") {
    const trace = served.trace(parts[4]);
    if (!trace.ok) return sendError(res, 404, trace.error);
    return sendJson(res, 200, { ok: true, trace: trace.value });
  }

  // Out-of-band media (narration audio): bytes never travel on the event stream (ADR-0007).
  if (action === "media" && parts[4] && method === "GET") {
    const media = host.media.get(parts[4]);
    if (!media) {
      return sendError(
        res,
        404,
        gatewayError("media artifact not found", { artifactId: parts[4] }),
      );
    }
    res.writeHead(200, {
      "Content-Type": media.mimeType,
      "Cache-Control": "public, max-age=3600",
      ...cors(),
    });
    res.end(Buffer.from(media.bytes));
    return;
  }

  // CSE M5 — POST /api/surface/:id/sources { source_version_id }: bind a registered source.
  if (action === "sources" && method === "POST") {
    const body = await readJson(req);
    const versionId = body["source_version_id"];
    if (typeof versionId !== "string" || !versionId.trim()) {
      return sendError(res, 400, gatewayError("attach requires source_version_id (string)"));
    }
    const attached = await served.attachSource(versionId.trim());
    if (!attached.ok) return sendError(res, 422, attached.error);
    return sendJson(res, 200, { ok: true, source: attached.value });
  }

  // R2c (ADR-0057 D3) — POST /api/surface/:id/teach-source { source_version_id? }: teach FROM a
  // bound source; the document's own concepts/sections become the curriculum (the timeline).
  if (action === "teach-source" && method === "POST") {
    const body = await readJson(req);
    const versionId =
      typeof body["source_version_id"] === "string" && body["source_version_id"].trim()
        ? body["source_version_id"].trim()
        : undefined;
    const taught = await served.teachSource(versionId);
    if (!taught.ok) return sendError(res, 422, taught.error);
    return sendJson(res, 200, { ok: true, blocks: taught.value.blocks.length });
  }

  // CSE M9 T1 — POST /api/surface/:id/fuse { concept_refs }: reconcile the surface's bound sources
  // over a concept set into one cognitive environment (Source Fusion, CSE-015).
  if (action === "fuse" && method === "POST") {
    const body = await readJson(req);
    const conceptRefs = Array.isArray(body["concept_refs"])
      ? (body["concept_refs"] as unknown[]).filter((c): c is string => typeof c === "string")
      : [];
    if (conceptRefs.length === 0) {
      return sendError(res, 400, gatewayError("fuse requires a non-empty concept_refs (string[])"));
    }
    const fused = await served.fuse(conceptRefs);
    if (!fused.ok) return sendError(res, 422, fused.error);
    return sendJson(res, 200, { ok: true, fusion: fused.value });
  }

  // CSE M9 Frontier T1 — POST /api/surface/:id/frontier { concept_ref }: research a concept's
  // living-knowledge frontier via governed web search (CSE-006 §3.2).
  if (action === "frontier" && method === "POST") {
    const body = await readJson(req);
    const conceptRef = typeof body["concept_ref"] === "string" ? body["concept_ref"].trim() : "";
    if (!conceptRef) {
      return sendError(res, 400, gatewayError("frontier requires a concept_ref (string)"));
    }
    const overlay = await served.researchFrontier(conceptRef);
    if (!overlay.ok) return sendError(res, 422, overlay.error);
    return sendJson(res, 200, { ok: true, frontier: overlay.value });
  }

  // CSE M9 TKM T1 — POST /api/surface/:id/timeline { concept_ref }: research a concept's Temporal
  // Knowledge Model (its trajectory through time) via governed web search (CSE-006 §3.3).
  if (action === "timeline" && method === "POST") {
    const body = await readJson(req);
    const conceptRef = typeof body["concept_ref"] === "string" ? body["concept_ref"].trim() : "";
    if (!conceptRef) {
      return sendError(res, 400, gatewayError("timeline requires a concept_ref (string)"));
    }
    const timeline = await served.researchTimeline(conceptRef);
    if (!timeline.ok) return sendError(res, 422, timeline.error);
    return sendJson(res, 200, { ok: true, timeline: timeline.value });
  }

  // CSE M11 T1 — Creative Cognition (CSE-016). The learner authors; the system only ever attaches
  // disclosed assists (scaffold|critique|provocation|reference) — never the artifact (no-ghostwriter law).
  if (action === "creation" && method === "POST") {
    const creationId = parts[4];
    const sub = parts[5];
    const body = await readJson(req);
    // POST /api/surface/:id/creation — open a creation.
    if (!creationId) {
      const kind = typeof body["kind"] === "string" ? body["kind"].trim() : "";
      const title = typeof body["title"] === "string" ? body["title"].trim() : "";
      if (!kind || !title) {
        return sendError(
          res,
          400,
          gatewayError("creation requires kind (string) and title (string)"),
        );
      }
      const conceptRefs = Array.isArray(body["concept_refs"])
        ? (body["concept_refs"] as unknown[]).filter((c): c is string => typeof c === "string")
        : [];
      const draft = typeof body["draft"] === "string" ? body["draft"] : undefined;
      const created = await served.startCreation({ kind, title, conceptRefs, draft });
      if (!created.ok) return sendError(res, 422, created.error);
      return sendJson(res, 201, { ok: true, creation: created.value });
    }
    // POST /api/surface/:id/creation/:cid/assist { mode, draft? } — offer a disclosed assist.
    if (sub === "assist") {
      const mode = typeof body["mode"] === "string" ? body["mode"].trim() : "";
      if (!mode) {
        return sendError(
          res,
          400,
          gatewayError("assist requires mode (scaffold|critique|provocation|reference)"),
        );
      }
      const draft = typeof body["draft"] === "string" ? body["draft"] : undefined;
      const assisted = await served.assistCreation(creationId, mode, draft);
      if (!assisted.ok) return sendError(res, 422, assisted.error);
      return sendJson(res, 200, { ok: true, creation: assisted.value });
    }
    // POST /api/surface/:id/creation/:cid/complete { draft? } — mark complete with final draft.
    if (sub === "complete") {
      const draft = typeof body["draft"] === "string" ? body["draft"] : undefined;
      const completed = await served.completeCreation(creationId, draft);
      if (!completed.ok) return sendError(res, 422, completed.error);
      return sendJson(res, 200, { ok: true, creation: completed.value });
    }
    // POST /api/surface/:id/creation/:cid/contribute { consent } — consent it into the substrate as a
    // Cognitive Source (ADR-0051). Requires explicit consent; refuses an incomplete/unconsented share.
    if (sub === "contribute") {
      const consent = body["consent"] === true;
      const contributed = await served.contributeCreation(creationId, consent);
      if (!contributed.ok) return sendError(res, 422, contributed.error);
      return sendJson(res, 200, {
        ok: true,
        creation: contributed.value.creation,
        source: contributed.value.source,
      });
    }
    // POST /api/surface/:id/creation/:cid/revoke — revoke consent + cascade a redaction (ADR-0054).
    if (sub === "revoke") {
      const revoked = await served.revokeCreation(creationId);
      if (!revoked.ok) return sendError(res, 422, revoked.error);
      return sendJson(res, 200, {
        ok: true,
        creation: revoked.value.creation,
        redacted_counts: revoked.value.redacted_counts,
      });
    }
    return sendError(res, 404, gatewayError("no such creation route", { path: url.pathname }));
  }

  if (action === "command" && method === "POST") {
    const command = (await readJson(req)) as unknown as SurfaceCommand;
    return handleCommand(served, command, res);
  }

  return sendError(res, 404, gatewayError("no such route", { path: url.pathname, method }));
}

/** Build the gateway HTTP server. Pass a shared host for tests; defaults to a fresh registry. */
export function createGatewayServer(host: SurfaceHost = new SurfaceHost()): Server {
  return createServer((req, res) => {
    route(host, req, res).catch((cause: unknown) => {
      sendError(res, 400, gatewayError("gateway request failed", { cause: String(cause) }));
    });
  });
}
