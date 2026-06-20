/**
 * @inevitable/adapters — concrete infrastructure adapters behind @inevitable/contracts plus a
 * backend-agnostic conformance harness. Reference in-memory adapters define canonical semantics;
 * NATS/Qdrant/Neo4j/Postgres adapters are dependency-optional. ADR-0005;
 * spec/interop/infrastructure-adapters.md.
 */
export { loadOptional, requireOptional } from "./optional";

export { InMemoryEventTransport, InMemoryVectorStore } from "./in-memory";

export { FileEventTransport } from "./durable";

export {
  NatsEventTransport,
  QdrantVectorStore,
  Neo4jGraphStore,
  PostgresRelationalStore,
} from "./external";

export {
  NullModelRuntime,
  GeminiModelRuntime,
  RecordingModelRuntime,
  MODEL_OUTPUT_RECORDED,
  MODEL_INVOCATION_FAILED,
  MODEL_RECORDING_FORMAT_VERSION,
  type GenAiClientLike,
  type RecordingMode,
  type RecordingModelRuntimeDeps,
} from "./model";

export {
  GeminiVoiceRuntime,
  NullVoiceRuntime,
  pcm16ToWav,
  type GenAiVoiceClientLike,
  type SynthesizedAudio,
  type VoiceRuntime,
  type VoiceSynthesisInput,
} from "./voice";

export { runEventTransportConformance, runVectorStoreConformance } from "./conformance";
