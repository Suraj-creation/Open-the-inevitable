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

/** Model runtime adapter (hosted LLMs, local vLLM, future models). Capability-, not vendor-bound. */
export interface ModelRuntime {
  generate(input: {
    prompt: string;
    model?: string;
    maxTokens?: number;
  }): Promise<{ text: string; model: string }>;
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
