/**
 * Deterministic local embedding (DPS-005). A token-hashing bag-of-words vector: every token increments
 * one dimension (chosen by an FNV-1a hash), then the vector is L2-normalized so cosine similarity
 * measures token overlap. No model call, no vendor, no randomness — so retrieval is replay-safe and
 * fully offline. Model-backed embeddings (better semantics, recorded for replay) are a future refinement
 * behind the same seam. Spec: spec/persistence/context-lease-bounded-retrieval.md.
 */

export const DEFAULT_EMBED_DIM = 96;

/** Lowercase alphanumeric tokens; everything else is a separator. Deterministic. */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 0);
}

/** FNV-1a (32-bit) hash of a token, as an unsigned integer. */
function fnv1a(token: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < token.length; i++) {
    hash ^= token.charCodeAt(i);
    // hash *= 16777619, kept in 32-bit unsigned range
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/** Embed text into a fixed-dimension, L2-normalized bag-of-words vector. */
export function embedText(text: string, dim: number = DEFAULT_EMBED_DIM): number[] {
  const vector = new Array<number>(dim).fill(0);
  for (const token of tokenize(text)) {
    const i = fnv1a(token) % dim;
    vector[i] = (vector[i] ?? 0) + 1;
  }
  let norm = 0;
  for (const value of vector) norm += value * value;
  if (norm === 0) return vector;
  const inv = 1 / Math.sqrt(norm);
  for (let i = 0; i < dim; i++) vector[i] = (vector[i] ?? 0) * inv;
  return vector;
}
