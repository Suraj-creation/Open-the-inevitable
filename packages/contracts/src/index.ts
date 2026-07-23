/**
 * @inevitable/contracts — pluggable infrastructure adapter contracts.
 *
 * ADR-0003 mandates "contracts first, implementation choices second": every infrastructure
 * dependency sits behind an adapter so NATS/Kafka, Neo4j/Memgraph, Qdrant/pgvector, hosted/local
 * models, etc. are swappable. These are TypeScript interfaces only — implementations live in
 * `services/` and future adapter packages. Spec: next-generation-cognitive-operating-system-blueprint#3.3.
 */
import type { Result } from "@inevitable/shared";
import type { CognitiveEvent } from "@inevitable/protocols";

/** Event transport adapter (NATS JetStream, Kafka, Redis Streams). */
export interface EventTransport {
  publish(subject: string, event: CognitiveEvent): Promise<Result<{ sequence: number }>>;
  subscribe(
    subject: string,
    handler: (event: CognitiveEvent) => Promise<void> | void,
  ): Promise<{ unsubscribe(): void }>;
  replay(subject: string, fromSequence: number): AsyncIterable<CognitiveEvent>;
}

/** Durable workflow runtime adapter (Temporal-style). */
export interface WorkflowRuntime {
  start(workflowId: string, input: unknown): Promise<void>;
  signal(workflowId: string, name: string, payload: unknown): Promise<void>;
  checkpoint(workflowId: string): Promise<void>;
  resume(workflowId: string): Promise<void>;
  cancel(workflowId: string, reason: string): Promise<void>;
}

/** Graph memory adapter (Neo4j, Memgraph, Kuzu). */
export interface GraphStore {
  query<T = unknown>(query: string, params?: Record<string, unknown>): Promise<T[]>;
  mutate(query: string, params?: Record<string, unknown>): Promise<void>;
  snapshot(label: string): Promise<void>;
}

/** Vector memory adapter (Qdrant, pgvector, Weaviate). */
export interface VectorStore {
  upsert(
    collection: string,
    id: string,
    vector: number[],
    payload?: Record<string, unknown>,
  ): Promise<void>;
  search(
    collection: string,
    vector: number[],
    limit: number,
  ): Promise<Array<{ id: string; score: number }>>;
  delete(collection: string, id: string): Promise<void>;
}

/** Relational store adapter (Postgres, CockroachDB). */
export interface RelationalStore {
  query<T = unknown>(sql: string, params?: unknown[]): Promise<T[]>;
  transaction<T>(fn: (tx: RelationalStore) => Promise<T>): Promise<T>;
}

/**
 * Model generation request. `invocation_key` is the deterministic identity of the call
 * (`<unit_cid>:<packet_id>:<purpose>:<ordinal>`) used by the D3 recording seam — see
 * spec/protocols/model-invocation-protocol.md.
 */
export interface ModelGenerationRequest {
  prompt: string;
  system?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  seed?: number;
  responseSchema?: Record<string, unknown>;
  /**
   * Thinking-token budget for reasoning models (e.g. gemini-2.5-flash). Thinking tokens are drawn
   * from the output budget; on structured-output calls an uncapped thinking budget can starve the
   * visible response, so callers that need a full JSON payload bound it (0 disables thinking).
   * Adapters that do not support a thinking phase ignore this field.
   */
  thinkingBudget?: number;
  /**
   * Request web-grounded generation (a governed external fetch). The adapter attaches a search tool
   * and returns real `citations` in the result; it is mutually exclusive with `responseSchema`
   * (grounded output is lenient text, not structured JSON). CSE-006 §4: no frontier without a
   * citable origin. Adapters without web access ignore this and return no citations.
   */
  webSearch?: boolean;
  invocation_key?: string;
}

export interface ModelGenerationResult {
  text: string;
  model: string;
  finishReason?: "stop" | "max_tokens" | "refusal" | "safety" | "other";
  usage?: { inputTokens?: number; outputTokens?: number };
  /** Real grounding citations for web-grounded generation (fetchable origins). D3-recorded. */
  citations?: readonly { readonly uri: string; readonly title: string }[];
}

/** Model runtime adapter (hosted LLMs, local vLLM, future models). Capability-, not vendor-bound. */
export interface ModelRuntime {
  generate(input: ModelGenerationRequest): Promise<ModelGenerationResult>;
  embed(text: string): Promise<number[]>;
}

/** Tool runtime adapter (MCP, gRPC, REST, local sandbox). */
export interface ToolRuntime {
  discover(): Promise<Array<{ name: string; sideEffecting: boolean }>>;
  invoke(name: string, params: Record<string, unknown>): Promise<Result<unknown>>;
}

/** Observability sink adapter (OpenTelemetry, Langfuse, Prometheus). */
export interface ObservabilitySink {
  trace(event: CognitiveEvent): void;
  metric(name: string, value: number, labels?: Record<string, string>): void;
}

/** Registry of the adapter contract names this package defines (used for documentation/tests). */
export const ADAPTER_CONTRACTS = [
  "EventTransport",
  "WorkflowRuntime",
  "GraphStore",
  "VectorStore",
  "RelationalStore",
  "ModelRuntime",
  "ToolRuntime",
  "ObservabilitySink",
] as const;

export type AdapterContractName = (typeof ADAPTER_CONTRACTS)[number];
