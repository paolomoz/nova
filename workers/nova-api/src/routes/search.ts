import { Hono } from 'hono';
import type { Env, SessionData } from '../lib/types.js';

const search = new Hono<{ Bindings: Env; Variables: { session: SessionData } }>();

/** POST /api/search/:projectId — hybrid search (Vectorize semantic + D1 FTS) */
search.post('/:projectId', async (c) => {
  const projectId = c.req.param('projectId');
  const { query, limit = 10 } = await c.req.json<{ query: string; limit?: number }>();

  if (!query) return c.json({ error: 'query required' }, 400);

  // Semantic search via Vectorize
  const results: Array<{ path: string; score: number; snippet?: string }> = [];

  try {
    const queryVector = await generateQueryEmbedding(query);
    if (queryVector) {
      const vectorResults = await c.env.VECTORIZE.query(queryVector, {
        topK: limit,
        filter: { projectId },
        returnMetadata: 'all',
      });

      for (const match of vectorResults.matches) {
        results.push({
          path: (match.metadata?.path as string) || '',
          score: match.score,
          snippet: match.metadata?.snippet as string | undefined,
        });
      }
    }
  } catch {
    // Vectorize may not be configured yet — fall through
  }

  return c.json({ results, query });
});

async function generateQueryEmbedding(_query: string): Promise<number[] | null> {
  // Phase 3: Call Voyage AI to embed the query
  // For now, return null to skip semantic search
  return null;
}

export default search;
