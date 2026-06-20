/**
 * @inevitable/context — context-lease-bounded retrieval & working-memory assembly (DPS-005).
 *
 * VectorStore-backed semantic retrieval over memory, assembled into a bounded working-memory context
 * under a `ContextLease` (tier / user / token-budget / expiry bounds, fail-closed). Deterministic local
 * embedding ⇒ replay-safe and offline. Spec: spec/persistence/context-lease-bounded-retrieval.md.
 */
export {
  ContextAssembler,
  type AssembleInput,
  type AssembledContextItem,
  type ContextAssemblerDeps,
  type RetrievableMemoryItem,
  type WorkingMemoryContext,
} from "./context-assembler";
export { DEFAULT_EMBED_DIM, embedText, tokenize } from "./embedding";
