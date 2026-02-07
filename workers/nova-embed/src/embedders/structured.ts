import { generateEmbeddings } from '../lib/voyage.js';

/**
 * Structured data embedding — JSON-LD, metadata, etc.
 */
export async function embedStructuredData(
  data: Record<string, unknown>,
  id: string,
  projectId: string,
  voyageApiKey: string,
  vectorize: VectorizeIndex,
): Promise<void> {
  // Flatten structured data into text
  const text = flattenToText(data);
  if (!text) return;

  const embeddings = await generateEmbeddings([text], voyageApiKey);

  await vectorize.upsert([
    {
      id: `structured:${projectId}:${id}`,
      values: embeddings[0].embedding,
      metadata: {
        projectId,
        type: 'structured',
        id,
        snippet: text.slice(0, 200),
      },
    },
  ]);
}

function flattenToText(obj: unknown, prefix: string = ''): string {
  if (obj === null || obj === undefined) return '';
  if (typeof obj === 'string') return obj;
  if (typeof obj === 'number' || typeof obj === 'boolean') return String(obj);

  if (Array.isArray(obj)) {
    return obj.map((item, i) => flattenToText(item, `${prefix}[${i}]`)).join(' ');
  }

  if (typeof obj === 'object') {
    return Object.entries(obj as Record<string, unknown>)
      .map(([key, val]) => `${key}: ${flattenToText(val, key)}`)
      .join('. ');
  }

  return '';
}
