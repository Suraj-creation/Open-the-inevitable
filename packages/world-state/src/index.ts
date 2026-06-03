/**
 * @inevitable/world-state — unified, versioned world-state graph folded from typed deltas.
 * Spec: spec/world-state/world-state-graph.md.
 */
export type {
  WorldNode,
  WorldEdge,
  WorldStateDelta,
  UpsertNodeDelta,
  RemoveNodeDelta,
  UpsertEdgeDelta,
  RemoveEdgeDelta,
  SetNodePropDelta,
  SetEdgePropDelta,
  AppliedDelta,
  WorldStateSnapshot,
} from "./delta";

export type { WorldStateGraphOptions, ApplyOptions, ChangeListener } from "./graph";
export { WorldStateGraph } from "./graph";
