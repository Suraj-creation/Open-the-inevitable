/**
 * World-State Delta Protocol — typed, append-only changes to the world-state graph. State is never
 * mutated in place; the graph is materialized by folding the delta log, which makes world-state
 * event-sourced, temporal, and replayable. Spec: spec/world-state/world-state-graph.md.
 */

export interface WorldNode {
  readonly id: string;
  readonly type: string;
  readonly props: Readonly<Record<string, unknown>>;
  /** Graph version at which this node was last written. */
  readonly version: number;
  /** HLC stamp of the last write. */
  readonly hlc: string;
}

export interface WorldEdge {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly type: string;
  readonly props: Readonly<Record<string, unknown>>;
  readonly version: number;
  readonly hlc: string;
}

export interface UpsertNodeDelta {
  readonly kind: "upsert_node";
  readonly id: string;
  readonly type: string;
  readonly props?: Record<string, unknown>;
}
export interface RemoveNodeDelta {
  readonly kind: "remove_node";
  readonly id: string;
}
export interface UpsertEdgeDelta {
  readonly kind: "upsert_edge";
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly type: string;
  readonly props?: Record<string, unknown>;
}
export interface RemoveEdgeDelta {
  readonly kind: "remove_edge";
  readonly id: string;
}
export interface SetNodePropDelta {
  readonly kind: "set_node_prop";
  readonly id: string;
  readonly key: string;
  readonly value: unknown;
}
export interface SetEdgePropDelta {
  readonly kind: "set_edge_prop";
  readonly id: string;
  readonly key: string;
  readonly value: unknown;
}

export type WorldStateDelta =
  | UpsertNodeDelta
  | RemoveNodeDelta
  | UpsertEdgeDelta
  | RemoveEdgeDelta
  | SetNodePropDelta
  | SetEdgePropDelta;

/** A committed delta and the version it produced. */
export interface AppliedDelta {
  readonly delta: WorldStateDelta;
  readonly version: number;
  readonly hlc: string;
  readonly proposerCid: string | undefined;
}

/** Serializable point-in-time view for fast start and forking. */
export interface WorldStateSnapshot {
  readonly nodes: readonly WorldNode[];
  readonly edges: readonly WorldEdge[];
  readonly version: number;
}
