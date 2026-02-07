import { generateEmbeddings } from '../lib/voyage.js';

export interface ContentChunk {
  id: string;
  projectId: string;
  path: string;
  text: string;
  metadata: Record<string, string>;
}

/**
 * Chunk HTML content into embedding-friendly pieces.
 */
export function chunkHtmlContent(
  html: string,
  path: string,
  projectId: string,
): ContentChunk[] {
  // Strip HTML tags for text extraction
  const text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!text) return [];

  // Split into ~500 char chunks with overlap
  const chunks: ContentChunk[] = [];
  const chunkSize = 500;
  const overlap = 50;

  for (let i = 0; i < text.length; i += chunkSize - overlap) {
    const chunkText = text.slice(i, i + chunkSize).trim();
    if (chunkText.length < 20) continue;

    chunks.push({
      id: `${projectId}:${path}:${chunks.length}`,
      projectId,
      path,
      text: chunkText,
      metadata: {
        projectId,
        path,
        chunkIndex: String(chunks.length),
        snippet: chunkText.slice(0, 200),
      },
    });
  }

  return chunks;
}

/**
 * Embed content chunks and upsert to Vectorize.
 */
export async function embedContent(
  chunks: ContentChunk[],
  voyageApiKey: string,
  vectorize: VectorizeIndex,
  model: string = 'voyage-3',
): Promise<number> {
  if (!chunks.length) return 0;

  // Batch embed (Voyage API supports batch)
  const batchSize = 20;
  let embedded = 0;

  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    const texts = batch.map((c) => c.text);

    const embeddings = await generateEmbeddings(texts, voyageApiKey, model);

    const vectors = batch.map((chunk, idx) => ({
      id: chunk.id,
      values: embeddings[idx].embedding,
      metadata: chunk.metadata,
    }));

    await vectorize.upsert(vectors);
    embedded += vectors.length;
  }

  return embedded;
}
