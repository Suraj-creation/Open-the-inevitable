/**
 * SDK-only types — zero imports from substrate packages.
 * Structurally compatible with apps/api JSON responses.
 * Spec: spec/cognitive-developer-platform/SDK-001-platform-sdk.md, ADR-0022.
 */

/** A COS learning surface handle returned by createSurface(). */
export interface CosSurface {
  readonly surfaceId: string;
  readonly learnerId: string;
  readonly goal: string;
}

/** A durable learner profile returned by getLearner(). */
export interface CosLearner {
  readonly learnerId: string;
  readonly cid: string;
  readonly trustLevel: number;
  readonly surfaces: ReadonlyArray<string>;
}

/** The only mutation channel into a living surface (mirrors SurfaceCommand in apps/api). */
export type CosCommand =
  | { readonly type: "ask"; readonly goal: string }
  | { readonly type: "expand"; readonly block_id: string; readonly layer: number }
  | { readonly type: "close"; readonly reason?: string };

/** A single frame from the surface SSE stream (envelope subset). */
export interface CosStreamFrame {
  readonly eventType: string;
  readonly payload: unknown;
  readonly sequence?: number;
}

/** Thrown when the gateway returns a non-ok HTTP response. */
export class CosClientError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "CosClientError";
    this.status = status;
  }
}
