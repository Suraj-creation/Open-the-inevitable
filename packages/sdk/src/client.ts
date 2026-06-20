/**
 * CosClient — typed HTTP client for the COS Surface Gateway.
 *
 * Spec: spec/cognitive-developer-platform/SDK-001-platform-sdk.md, ADR-0022.
 *
 * §2 law check: this file has zero imports from @inevitable/* packages.
 * All types are defined in ./types.ts (also zero substrate deps).
 */
import { CosClientError, type CosCommand, type CosLearner, type CosSurface } from "./types.js";

export interface CosClientOptions {
  readonly baseUrl: string;
  /** Injectable fetch for testing (defaults to globalThis.fetch). */
  readonly fetch?: typeof globalThis.fetch;
}

export class CosClient {
  private readonly base: string;
  private readonly fetcher: typeof globalThis.fetch;

  constructor(opts: CosClientOptions) {
    this.base = opts.baseUrl.replace(/\/$/, "");
    this.fetcher = opts.fetch ?? globalThis.fetch.bind(globalThis);
  }

  /** Create a new cognitive learning surface. POST /api/surface. */
  async createSurface(params: { learnerId?: string; goal?: string } = {}): Promise<CosSurface> {
    const res = await this.fetcher(`${this.base}/api/surface`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      const msg =
        (body["error"] as { message?: string } | undefined)?.message ?? "create surface failed";
      throw new CosClientError(msg, res.status);
    }
    const body = (await res.json()) as {
      surface_id: string;
      learner_id: string;
      goal: string;
    };
    return { surfaceId: body["surface_id"], learnerId: body["learner_id"], goal: body["goal"] };
  }

  /** Send any command to a living surface. POST /api/surface/:id/command. */
  async sendCommand(surfaceId: string, command: CosCommand): Promise<Record<string, unknown>> {
    const res = await this.fetcher(`${this.base}/api/surface/${surfaceId}/command`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(command),
    });
    const body = (await res.json()) as Record<string, unknown>;
    if (!res.ok || body["ok"] === false) {
      const err = body["error"] as { message?: string } | undefined;
      throw new CosClientError(err?.message ?? "command failed", res.status);
    }
    return body;
  }

  /** Ask a question on a surface. Emits a learning cycle on the substrate. */
  async ask(surfaceId: string, goal: string): Promise<{ blocks: number }> {
    const body = await this.sendCommand(surfaceId, { type: "ask", goal });
    return { blocks: typeof body["blocks"] === "number" ? body["blocks"] : 0 };
  }

  /** Expand a block to a deeper explanation layer (0–6). */
  async expand(
    surfaceId: string,
    blockId: string,
    layer: number,
  ): Promise<{ block_id: string; version: number }> {
    const body = await this.sendCommand(surfaceId, {
      type: "expand",
      block_id: blockId,
      layer,
    });
    return {
      block_id: String(body["block_id"] ?? ""),
      version: typeof body["version"] === "number" ? body["version"] : 0,
    };
  }

  /** Close a surface. */
  async close(surfaceId: string, reason?: string): Promise<void> {
    await this.sendCommand(surfaceId, { type: "close", reason });
  }

  /**
   * Get the current folded SurfaceState snapshot. Returns raw JSON — callers can fold
   * with foldSurfaceEvents from @inevitable/surface/client if needed.
   */
  async getState(surfaceId: string): Promise<unknown> {
    const res = await this.fetcher(`${this.base}/api/surface/${surfaceId}/state`);
    if (!res.ok) throw new CosClientError("get state failed", res.status);
    const body = (await res.json()) as { state: unknown };
    return body["state"];
  }

  /** Get a durable learner profile and their surface history. GET /api/learner/:id. */
  async getLearner(learnerId: string): Promise<CosLearner> {
    const res = await this.fetcher(`${this.base}/api/learner/${encodeURIComponent(learnerId)}`);
    if (!res.ok) throw new CosClientError("learner not found", res.status);
    const body = (await res.json()) as {
      learner: { learner_id: string; cid: string; trust_level: number };
      surfaces: string[];
    };
    return {
      learnerId: body["learner"]["learner_id"],
      cid: body["learner"]["cid"],
      trustLevel: body["learner"]["trust_level"],
      surfaces: Array.isArray(body["surfaces"]) ? body["surfaces"] : [],
    };
  }
}
