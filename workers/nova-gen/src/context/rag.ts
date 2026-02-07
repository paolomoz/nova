/**
 * RAG context retrieval from Vectorize.
 * Phase 3 will implement full embedding-based retrieval.
 */

export async function getRAGContext(
  query: string,
  projectId: string,
  vectorize?: VectorizeIndex,
): Promise<string> {
  if (!vectorize) return '';

  try {
    // Phase 3: embed query via Voyage AI, then search Vectorize
    // For now return empty context
    return '';
  } catch {
    return '';
  }
}
