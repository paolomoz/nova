import { Hono } from 'hono';
import type { Env, SessionData } from '../lib/types.js';

const search = new Hono<{ Bindings: Env; Variables: { session: SessionData } }>();

interface SearchResult {
  path: string;
  title: string;
  snippet: string;
  score: number;
  source: 'keyword' | 'semantic';
}

/** POST /api/search/:projectId — hybrid search (D1 keyword + Vectorize semantic) */
search.post('/:projectId', async (c) => {
  const projectId = c.req.param('projectId');
  const { query, limit = 20 } = await c.req.json<{ query: string; limit?: number }>();

  if (!query) return c.json({ error: 'query required' }, 400);

  const results: SearchResult[] = [];

  // 1. D1 keyword search (LIKE-based, immediate availability)
  try {
    const keywords = query
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2);

    if (keywords.length > 0) {
      // Build LIKE conditions for each keyword against title and body
      const conditions = keywords.map(() => '(LOWER(title) LIKE ? OR LOWER(body) LIKE ?)').join(' AND ');
      const bindings: string[] = [projectId];
      for (const kw of keywords) {
        bindings.push(`%${kw}%`, `%${kw}%`);
      }

      const sql = `SELECT path, title, body FROM content_index WHERE project_id = ? AND ${conditions} LIMIT ?`;
      bindings.push(String(limit));

      const { results: rows } = await c.env.DB.prepare(sql).bind(...bindings).all();

      for (const row of rows) {
        const body = (row.body as string) || '';
        const title = (row.title as string) || '';

        // Score based on keyword density
        let score = 0;
        const lowerBody = body.toLowerCase();
        const lowerTitle = title.toLowerCase();
        for (const kw of keywords) {
          if (lowerTitle.includes(kw)) score += 3;
          const bodyMatches = lowerBody.split(kw).length - 1;
          score += Math.min(bodyMatches, 5);
        }

        // Extract snippet around first keyword match
        let snippet = '';
        for (const kw of keywords) {
          const idx = lowerBody.indexOf(kw);
          if (idx !== -1) {
            const start = Math.max(0, idx - 60);
            const end = Math.min(body.length, idx + kw.length + 60);
            snippet = (start > 0 ? '...' : '') + body.slice(start, end).trim() + (end < body.length ? '...' : '');
            break;
          }
        }
        if (!snippet) snippet = body.slice(0, 120).trim() + (body.length > 120 ? '...' : '');

        results.push({
          path: row.path as string,
          title: title || (row.path as string).split('/').pop() || '',
          snippet,
          score: score / (keywords.length * 5), // Normalize to 0-1ish
          source: 'keyword',
        });
      }
    }
  } catch {
    // D1 search failed — continue with semantic only
  }

  // 2. Vectorize semantic search (if available)
  try {
    const queryVector = await generateQueryEmbedding(query, c.env);
    if (queryVector && c.env.VECTORIZE) {
      const vectorResults = await c.env.VECTORIZE.query(queryVector, {
        topK: limit,
        filter: { projectId },
        returnMetadata: 'all',
      });

      for (const match of vectorResults.matches) {
        const path = (match.metadata?.path as string) || '';
        // Avoid duplicates from keyword search
        if (!results.some((r) => r.path === path)) {
          results.push({
            path,
            title: (match.metadata?.title as string) || path.split('/').pop() || '',
            snippet: (match.metadata?.snippet as string) || '',
            score: match.score,
            source: 'semantic',
          });
        }
      }
    }
  } catch {
    // Vectorize not configured — keyword results only
  }

  // Sort by score descending
  results.sort((a, b) => b.score - a.score);

  return c.json({ results: results.slice(0, limit), query });
});

async function generateQueryEmbedding(query: string, env: Env): Promise<number[] | null> {
  if (!env.VOYAGE_API_KEY) return null;
  const response = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.VOYAGE_API_KEY}`,
    },
    body: JSON.stringify({
      input: [query],
      model: env.VOYAGE_MODEL || 'voyage-3',
    }),
  });
  if (!response.ok) return null;
  const data = (await response.json()) as {
    data: Array<{ embedding: number[] }>;
  };
  return data.data[0]?.embedding ?? null;
}

export default search;
