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
 *
 * Spec: spec/surface/surface-streaming-sync-protocol.md, spec/architecture-decisions/ADR-0006.
 */
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { CognitiveEvent } from "@inevitable/protocols";
import { type CosError } from "@inevitable/shared";
import { SurfaceHost, gatewayError, type ServedSurface } from "./host";

/** The only mutation channel into a living surface. Additive by design (SRF-005 §4.3). */
export type SurfaceInteractionKind =
  | "interrupt"
  | "jump"
  | "branch"
  | "challenge"
  | "request_depth"
  | "request_simplify"
  | "request_example";

export type SurfaceCommand =
  | { type: "ask"; goal?: string }
  | { type: "expand"; block_id: string; layer: number }
  | { type: "close"; reason?: string }
  | { type: "interact"; kind: SurfaceInteractionKind; target_id?: string; note?: string };

const SNAPSHOT_COMPLETE = ": snapshot-complete\n\n";

function cors(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Last-Event-ID, Authorization",
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

  for (const event of served.surfaceStream(fromSequence)) {
    writeFrame(res, event);
  }
  res.write(SNAPSHOT_COMPLETE);

  const sub = served.subscribeStream((event) => {
    try {
      writeFrame(res, event);
    } catch {
      sub.unsubscribe();
    }
  });
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

  const url = new URL(req.url ?? "/", "http://localhost");
  const parts = url.pathname.split("/").filter(Boolean); // ["api","surface"|"learner",id?,action?,blockId?]

  // GET /api/learner/:id — resume-by-learner: the learner profile + the surfaces they own (DPS-003).
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

  if (parts[0] !== "api" || parts[1] !== "surface") {
    return sendError(res, 404, gatewayError("no such route", { path: url.pathname }));
  }

  // POST /api/surface — enter a new environment.
  // If a valid bearer token is supplied, the surface is owned by the authenticated learner.
  // If no bearer is supplied, a fresh learner is minted and their api_key is returned once.
  // An unrecognised bearer token is rejected with 401.
  if (parts.length === 2 && method === "POST") {
    const body = await readJson(req);
    const goal =
      typeof body["goal"] === "string" && (body["goal"] as string).trim()
        ? (body["goal"] as string)
        : "Teach me Neural Networks";
    const VALID_MODES = new Set(["student", "educator", "institution", "researcher", "open"]);

    // Auth: bearer token → authenticated returning learner; absent → mint fresh.
    const token = extractBearer(req);
    let authenticatedLearnerId: string | undefined;
    if (token !== undefined) {
      const caller = host.getLearnerByApiKey(token);
      if (!caller) return sendError(res, 401, gatewayError("unknown api key"));
      authenticatedLearnerId = caller.learnerId;
    }

    const created = await host.create(goal, {
      trustLevel:
        typeof body["trustLevel"] === "number" ? (body["trustLevel"] as number) : undefined,
      seed: typeof body["seed"] === "string" ? (body["seed"] as string) : undefined,
      // Bearer token wins over any learnerId in the body (prevents impersonation).
      learnerId:
        authenticatedLearnerId ??
        (typeof body["learnerId"] === "string" ? (body["learnerId"] as string) : undefined),
      mode:
        typeof body["mode"] === "string" && VALID_MODES.has(body["mode"] as string)
          ? (body["mode"] as string)
          : undefined,
    });
    if (!created.ok) return sendError(res, 400, created.error);

    // Return the api_key only when we just minted a fresh learner (no bearer was provided).
    // Returning learners already hold their key; echoing it on every request would be noisy.
    const freshLearner = token === undefined ? host.getLearner(created.value.learnerId) : undefined;
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
