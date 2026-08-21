/**
 * @inevitable/adapters — concrete infrastructure adapters behind @inevitable/contracts plus a
 * backend-agnostic conformance harness. Reference in-memory adapters define canonical semantics;
 * NATS/Qdrant/Neo4j/Postgres adapters are dependency-optional. ADR-0005;
 * spec/interop/infrastructure-adapters.md.
 */
export { loadOptional, requireOptional } from "./optional";

export { InMemoryToolRuntime, type InMemoryToolRuntimeOptions, type ToolSpec } from "./tools";

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
  MODEL_EMBEDDING_RECORDED,
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

export {
  NullImageRuntime,
  GeminiImageRuntime,
  type GenAiImageClientLike,
  type GeneratedVisual,
  type ImageRuntime,
  type VisualGenerationInput,
} from "./visual";

export {
  PostgresEventTransport,
  PgVectorStore,
  PostgresIntelligenceStore,
  PostgresLearnerStore,
  SupabaseStorageObjectStore,
  TRANSPORT_SQL,
  VECTOR_SQL,
  INTELLIGENCE_SQL,
  LEARNER_SQL,
  type IntelligenceArtifactRow,
  type LearnerCognitionRow,
  type LearnerRow,
  type LearnerSurfaceRow,
  type PgPoolLike,
  type StoredObject,
} from "./supabase";

export { PdfjsModalityAdapter } from "./pdf";

export { runEventTransportConformance, runVectorStoreConformance } from "./conformance";
