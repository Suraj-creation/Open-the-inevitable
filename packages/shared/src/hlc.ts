/**
 * Hybrid Logical Clock — causal ordering across distributed nodes whose wall clocks diverge.
 *
 * Spec: spec/protocols/cognition-packet-protocol.md, spec/protocols/cognitive-event-protocol.md,
 *       advanced-agent-architecture#2.3. Physical time comes from an injected {@link Clock}.
 */
import type { Clock } from "./clock";

export interface Hlc {
  readonly physicalMs: number;
  readonly logical: number;
  readonly nodeId: string;
}

export function hlcInit(nodeId: string): Hlc {
  return { physicalMs: 0, logical: 0, nodeId };
}

/** Advance the local clock for a locally generated event. */
export function hlcTick(prev: Hlc, clock: Clock): Hlc {
  const wall = clock.nowMs();
  if (wall > prev.physicalMs) {
    return { physicalMs: wall, logical: 0, nodeId: prev.nodeId };
  }
  return { physicalMs: prev.physicalMs, logical: prev.logical + 1, nodeId: prev.nodeId };
}

/** Merge a received remote clock into the local clock (on inbound packet/event). */
export function hlcReceive(local: Hlc, remote: Hlc, clock: Clock): Hlc {
  const wall = clock.nowMs();
  const maxPhysical = Math.max(wall, local.physicalMs, remote.physicalMs);
  if (maxPhysical === local.physicalMs && maxPhysical === remote.physicalMs) {
    return {
      physicalMs: maxPhysical,
      logical: Math.max(local.logical, remote.logical) + 1,
      nodeId: local.nodeId,
    };
  }
  if (maxPhysical === local.physicalMs) {
    return { physicalMs: maxPhysical, logical: local.logical + 1, nodeId: local.nodeId };
  }
  if (maxPhysical === remote.physicalMs) {
    return { physicalMs: maxPhysical, logical: remote.logical + 1, nodeId: local.nodeId };
  }
  return { physicalMs: maxPhysical, logical: 0, nodeId: local.nodeId };
}

/** Total-order comparison: negative if a<b, 0 if equal, positive if a>b. */
export function hlcCompare(a: Hlc, b: Hlc): number {
  if (a.physicalMs !== b.physicalMs) return a.physicalMs - b.physicalMs;
  if (a.logical !== b.logical) return a.logical - b.logical;
  return a.nodeId < b.nodeId ? -1 : a.nodeId > b.nodeId ? 1 : 0;
}

export function hlcHappensBefore(a: Hlc, b: Hlc): boolean {
  return hlcCompare(a, b) < 0;
}

/** Lexicographically sortable encoding: `<16-digit ms>-<8-digit logical>-<nodeId>`. */
export function hlcToString(h: Hlc): string {
  const ms = String(h.physicalMs).padStart(16, "0");
  const logical = String(h.logical).padStart(8, "0");
  return `${ms}-${logical}-${h.nodeId}`;
}

export function hlcParse(s: string): Hlc {
  const firstDash = s.indexOf("-");
  const secondDash = s.indexOf("-", firstDash + 1);
  if (firstDash < 0 || secondDash < 0) {
    throw new Error(`Invalid HLC string: ${s}`);
  }
  const physicalMs = Number(s.slice(0, firstDash));
  const logical = Number(s.slice(firstDash + 1, secondDash));
  const nodeId = s.slice(secondDash + 1);
  return { physicalMs, logical, nodeId };
}
