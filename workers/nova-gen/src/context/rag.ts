/**
 * RAG context retrieval from Vectorize via Voyage AI embeddings.
 */

export async function getRAGContext(
  query: string,
  projectId: string,
  vectorize?: VectorizeIndex,
  voyageApiKey?: string,
  voyageModel?: string,
): Promise<string> {
  if (!vectorize || !voyageApiKey) return '';

  try {
    // Embed query via Voyage AI
    const embResponse = await fetch('https://api.voyageai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${voyageApiKey}`,
      },
      body: JSON.stringify({ input: [query], model: voyageModel || 'voyage-3' }),
    });

    if (!embResponse.ok) return '';

    const embData = (await embResponse.json()) as {
      data: Array<{ embedding: number[] }>;
    };
    const queryVector = embData.data[0]?.embedding;
    if (!queryVector) return '';

    // Query Vectorize with 3s timeout for cold start safety
    const vectorResults = await Promise.race([
      vectorize.query(queryVector, {
        topK: 5,
        filter: { projectId },
        returnMetadata: 'all',
      }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000)),
    ]);

    if (!vectorResults) return '';

    const contexts = vectorResults.matches
      .filter((m) => m.score > 0.5)
      .map((m) => {
        const path = (m.metadata?.path as string) || '';
        const title = (m.metadata?.title as string) || '';
        const snippet = (m.metadata?.snippet as string) || '';
        return `[${title || path}] (score: ${m.score.toFixed(2)}): ${snippet}`;
      });

    if (contexts.length === 0) return '';

    return `Relevant content from this site:\n${contexts.join('\n')}`;
  } catch {
    return '';
  }
}
