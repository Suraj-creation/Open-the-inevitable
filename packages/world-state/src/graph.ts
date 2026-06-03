/**
 * WorldStateGraph — the materialized, versioned projection of cognition. Changes arrive only as typed
 * {@link WorldStateDelta}s, are appended to a delta log, and fold into the materialized view. Replaying
 * the log reproduces the graph exactly. Supports queries (neighbors / nodesByType / hasPath), acyclic
 * enforcement for DAG edge classes (e.g. `prerequisite_of`), and snapshot/restore for fast start and
 * forking. Spec: spec/world-state/world-state-graph.md.
 */
import {
  type Clock,
  type Hlc,
  type Result,
  CosError,
  SystemClock,
  hlcInit,
  hlcTick,
  hlcToString,
  ok,
  err,
} from "@inevitable/shared";
import {
  type WorldStateDelta,
  type WorldNode,
  type WorldEdge,
  type AppliedDelta,
  type WorldStateSnapshot,
} from "./delta";

export interface WorldStateGraphOptions {
  clock?: Clock;
  nodeId?: string;
  /** Edge types that must remain acyclic (a directed acyclic graph), e.g. `prerequisite_of`. */
  acyclicEdgeTypes?: readonly string[];
}

export interface ApplyOptions {
  proposerCid?: string;
}

export type ChangeListener = (applied: AppliedDelta) => void;

function fail(message: string): Result<number, CosError> {
  return err(new CosError("E_WORLD_STATE", message, { specRef: "world-state/world-state-graph" }));
}

export class WorldStateGraph {
  private readonly clock: Clock;
  private readonly acyclicEdgeTypes: ReadonlySet<string>;
  private readonly nodes = new Map<string, WorldNode>();
  private readonly edges = new Map<string, WorldEdge>();
  private readonly outgoing = new Map<string, Set<string>>();
  private readonly incoming = new Map<string, Set<string>>();
  private readonly deltaLog: AppliedDelta[] = [];
  private readonly listeners = new Set<ChangeListener>();
  private hlc: Hlc;
  private versionCounter = 0;

  constructor(options: WorldStateGraphOptions = {}) {
    this.clock = options.clock ?? new SystemClock();
    this.acyclicEdgeTypes = new Set(options.acyclicEdgeTypes ?? []);
    this.hlc = hlcInit(options.nodeId ?? "world-state");
  }

  get version(): number {
    return this.versionCounter;
  }

  get log(): readonly AppliedDelta[] {
    return this.deltaLog;
  }

  subscribe(listener: ChangeListener): { unsubscribe(): void } {
    this.listeners.add(listener);
    return { unsubscribe: () => void this.listeners.delete(listener) };
  }

  /** Apply a typed delta. Returns the new version on success, or a typed error (fail-closed). */
  apply(delta: WorldStateDelta, opts: ApplyOptions = {}): Result<number, CosError> {
    const validation = this.validate(delta);
    if (!validation.ok) return validation;

    this.hlc = hlcTick(this.hlc, this.clock);
    const version = ++this.versionCounter;
    const hlc = hlcToString(this.hlc);
    this.materialize(delta, version, hlc);

    const applied: AppliedDelta = { delta, version, hlc, proposerCid: opts.proposerCid };
    this.deltaLog.push(applied);
    for (const listener of this.listeners) listener(applied);
    return ok(version);
  }

  // --- queries -----------------------------------------------------------

  getNode(id: string): WorldNode | undefined {
    return this.nodes.get(id);
  }
  getEdge(id: string): WorldEdge | undefined {
    return this.edges.get(id);
  }
  nodesByType(type: string): WorldNode[] {
    return [...this.nodes.values()].filter((n) => n.type === type);
  }
  nodeCount(): number {
    return this.nodes.size;
  }
  edgeCount(): number {
    return this.edges.size;
  }

  /** Target node ids reachable by one outgoing edge (optionally filtered by edge type). */
  neighbors(id: string, edgeType?: string): string[] {
    const out = this.outgoing.get(id);
    if (!out) return [];
    const result: string[] = [];
    for (const edgeId of out) {
      const edge = this.edges.get(edgeId);
      if (edge && (edgeType === undefined || edge.type === edgeType)) result.push(edge.to);
    }
    return result;
  }

  /** Whether `to` is reachable from `from` following outgoing edges (optionally type-filtered). */
  hasPath(from: string, to: string, edgeType?: string): boolean {
    if (from === to) return true;
    const seen = new Set<string>([from]);
    const stack = [from];
    while (stack.length > 0) {
      const current = stack.pop() as string;
      for (const next of this.neighbors(current, edgeType)) {
        if (next === to) return true;
        if (!seen.has(next)) {
          seen.add(next);
          stack.push(next);
        }
      }
    }
    return false;
  }

  // --- snapshot / restore ------------------------------------------------

  snapshot(): WorldStateSnapshot {
    return {
      nodes: [...this.nodes.values()],
      edges: [...this.edges.values()],
      version: this.versionCounter,
    };
  }

  restore(snapshot: WorldStateSnapshot): void {
    this.nodes.clear();
    this.edges.clear();
    this.outgoing.clear();
    this.incoming.clear();
    for (const node of snapshot.nodes) this.nodes.set(node.id, node);
    for (const edge of snapshot.edges) {
      this.edges.set(edge.id, edge);
      this.index(edge);
    }
    this.versionCounter = snapshot.version;
  }

  // --- internals ---------------------------------------------------------

  private validate(delta: WorldStateDelta): Result<number, CosError> {
    switch (delta.kind) {
      case "upsert_node":
        return ok(0);
      case "remove_node": {
        if (!this.nodes.has(delta.id)) return fail(`remove_node: unknown node ${delta.id}`);
        const out = this.outgoing.get(delta.id);
        const inc = this.incoming.get(delta.id);
        if ((out && out.size > 0) || (inc && inc.size > 0)) {
          return fail(`remove_node: ${delta.id} has incident edges (remove edges first)`);
        }
        return ok(0);
      }
      case "upsert_edge": {
        if (!this.nodes.has(delta.from)) return fail(`upsert_edge: unknown from ${delta.from}`);
        if (!this.nodes.has(delta.to)) return fail(`upsert_edge: unknown to ${delta.to}`);
        if (
          this.acyclicEdgeTypes.has(delta.type) &&
          this.hasPath(delta.to, delta.from, delta.type)
        ) {
          return fail(
            `upsert_edge: ${delta.from}->${delta.to} would create a cycle in acyclic type '${delta.type}'`,
          );
        }
        return ok(0);
      }
      case "remove_edge":
        if (!this.edges.has(delta.id)) return fail(`remove_edge: unknown edge ${delta.id}`);
        return ok(0);
      case "set_node_prop":
        if (!this.nodes.has(delta.id)) return fail(`set_node_prop: unknown node ${delta.id}`);
        return ok(0);
      case "set_edge_prop":
        if (!this.edges.has(delta.id)) return fail(`set_edge_prop: unknown edge ${delta.id}`);
        return ok(0);
    }
  }

  private materialize(delta: WorldStateDelta, version: number, hlc: string): void {
    switch (delta.kind) {
      case "upsert_node": {
        const existing = this.nodes.get(delta.id);
        this.nodes.set(delta.id, {
          id: delta.id,
          type: delta.type,
          props: { ...(existing?.props ?? {}), ...(delta.props ?? {}) },
          version,
          hlc,
        });
        return;
      }
      case "remove_node":
        this.nodes.delete(delta.id);
        this.outgoing.delete(delta.id);
        this.incoming.delete(delta.id);
        return;
      case "upsert_edge": {
        const existing = this.edges.get(delta.id);
        const edge: WorldEdge = {
          id: delta.id,
          from: delta.from,
          to: delta.to,
          type: delta.type,
          props: { ...(existing?.props ?? {}), ...(delta.props ?? {}) },
          version,
          hlc,
        };
        this.edges.set(edge.id, edge);
        this.index(edge);
        return;
      }
      case "remove_edge": {
        const edge = this.edges.get(delta.id);
        if (edge) {
          this.outgoing.get(edge.from)?.delete(edge.id);
          this.incoming.get(edge.to)?.delete(edge.id);
          this.edges.delete(edge.id);
        }
        return;
      }
      case "set_node_prop": {
        const node = this.nodes.get(delta.id);
        if (node) {
          this.nodes.set(delta.id, {
            ...node,
            props: { ...node.props, [delta.key]: delta.value },
            version,
            hlc,
          });
        }
        return;
      }
      case "set_edge_prop": {
        const edge = this.edges.get(delta.id);
        if (edge) {
          this.edges.set(delta.id, {
            ...edge,
            props: { ...edge.props, [delta.key]: delta.value },
            version,
            hlc,
          });
        }
        return;
      }
    }
  }

  private index(edge: WorldEdge): void {
    let out = this.outgoing.get(edge.from);
    if (!out) {
      out = new Set<string>();
      this.outgoing.set(edge.from, out);
    }
    out.add(edge.id);
    let inc = this.incoming.get(edge.to);
    if (!inc) {
      inc = new Set<string>();
      this.incoming.set(edge.to, inc);
    }
    inc.add(edge.id);
  }
}
