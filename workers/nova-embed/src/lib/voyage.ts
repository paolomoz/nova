/**
 * Voyage AI embedding client.
 */

const VOYAGE_API_URL = 'https://api.voyageai.com/v1/embeddings';

export interface EmbeddingResult {
  embedding: number[];
  tokens: number;
}

export async function generateEmbeddings(
  texts: string[],
  apiKey: string,
  model: string = 'voyage-3',
): Promise<EmbeddingResult[]> {
  const response = await fetch(VOYAGE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      input: texts,
      model,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Voyage AI error: ${response.status} — ${err}`);
  }

  const data = (await response.json()) as {
    data: Array<{ embedding: number[]; index: number }>;
    usage: { total_tokens: number };
  };

  return data.data.map((d) => ({
    embedding: d.embedding,
    tokens: Math.ceil(data.usage.total_tokens / texts.length),
  }));
}

export async function generateQueryEmbedding(
  query: string,
  apiKey: string,
  model: string = 'voyage-3',
): Promise<number[]> {
  const results = await generateEmbeddings([query], apiKey, model);
  return results[0].embedding;
}
