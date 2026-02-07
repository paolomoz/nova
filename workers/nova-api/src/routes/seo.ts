import { Hono } from 'hono';
import type { Env, SessionData } from '../lib/types.js';

const seo = new Hono<{ Bindings: Env; Variables: { session: SessionData } }>();

/** GET /api/seo/:projectId — list all SEO metadata */
seo.get('/:projectId', async (c) => {
  const projectId = c.req.param('projectId');
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM seo_metadata WHERE project_id = ? ORDER BY path',
  ).bind(projectId).all();

  return c.json({
    pages: (results || []).map((r) => ({
      id: r.id,
      path: r.path,
      title: r.title,
      description: r.description,
      keywords: JSON.parse((r.keywords as string) || '[]'),
      canonicalUrl: r.canonical_url,
      ogImage: r.og_image,
      structuredData: JSON.parse((r.structured_data as string) || '{}'),
      robots: r.robots,
      internalLinks: JSON.parse((r.internal_links as string) || '[]'),
      seoScore: r.seo_score,
      llmCitabilityScore: r.llm_citability_score,
      updatedAt: r.updated_at,
    })),
  });
});

/** GET /api/seo/:projectId/page — get SEO for a specific path */
seo.get('/:projectId/page', async (c) => {
  const projectId = c.req.param('projectId');
  const path = c.req.query('path');
  if (!path) return c.json({ error: 'path required' }, 400);

  const row = await c.env.DB.prepare(
    'SELECT * FROM seo_metadata WHERE project_id = ? AND path = ?',
  ).bind(projectId, path).first();

  if (!row) return c.json({ seo: null });

  return c.json({
    seo: {
      id: row.id,
      path: row.path,
      title: row.title,
      description: row.description,
      keywords: JSON.parse((row.keywords as string) || '[]'),
      canonicalUrl: row.canonical_url,
      ogImage: row.og_image,
      structuredData: JSON.parse((row.structured_data as string) || '{}'),
      robots: row.robots,
      internalLinks: JSON.parse((row.internal_links as string) || '[]'),
      seoScore: row.seo_score,
      llmCitabilityScore: row.llm_citability_score,
    },
  });
});

/** PUT /api/seo/:projectId/page — update SEO metadata */
seo.put('/:projectId/page', async (c) => {
  const projectId = c.req.param('projectId');
  const body = await c.req.json<{
    path: string;
    title?: string;
    description?: string;
    keywords?: string[];
    canonicalUrl?: string;
    ogImage?: string;
    structuredData?: object;
    robots?: string;
  }>();

  if (!body.path) return c.json({ error: 'path required' }, 400);

  await c.env.DB.prepare(
    `INSERT INTO seo_metadata (id, project_id, path, title, description, keywords, canonical_url, og_image, structured_data, robots)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(project_id, path) DO UPDATE SET
       title = COALESCE(excluded.title, seo_metadata.title),
       description = COALESCE(excluded.description, seo_metadata.description),
       keywords = COALESCE(excluded.keywords, seo_metadata.keywords),
       canonical_url = COALESCE(excluded.canonical_url, seo_metadata.canonical_url),
       og_image = COALESCE(excluded.og_image, seo_metadata.og_image),
       structured_data = COALESCE(excluded.structured_data, seo_metadata.structured_data),
       robots = COALESCE(excluded.robots, seo_metadata.robots),
       updated_at = datetime('now')`,
  ).bind(
    crypto.randomUUID(), projectId, body.path,
    body.title || null, body.description || null,
    body.keywords ? JSON.stringify(body.keywords) : null,
    body.canonicalUrl || null, body.ogImage || null,
    body.structuredData ? JSON.stringify(body.structuredData) : null,
    body.robots || null,
  ).run();

  return c.json({ ok: true });
});

/** POST /api/seo/:projectId/analyze — AI-powered SEO analysis */
seo.post('/:projectId/analyze', async (c) => {
  const projectId = c.req.param('projectId');
  const { path } = await c.req.json<{ path: string }>();

  if (!path) return c.json({ error: 'path required' }, 400);

  // Get page content
  const content = await c.env.DB.prepare(
    'SELECT title, body FROM content_index WHERE project_id = ? AND path = ?',
  ).bind(projectId, path).first<{ title: string; body: string }>();

  if (!content) return c.json({ error: 'Page not found in index' }, 404);

  // Get existing SEO data
  const existingSeo = await c.env.DB.prepare(
    'SELECT * FROM seo_metadata WHERE project_id = ? AND path = ?',
  ).bind(projectId, path).first();

  // Get internal pages for linking suggestions
  const { results: pages } = await c.env.DB.prepare(
    'SELECT path, title FROM content_index WHERE project_id = ? AND path != ? LIMIT 50',
  ).bind(projectId, path).all();

  const pageList = (pages || []).map((p) => `${p.path}: ${p.title}`).join('\n');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': c.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: `Analyze this page for SEO and LLM citability. Return JSON only.

Page: ${path}
Title: ${content.title || 'none'}
Content (first 2000 chars):
${(content.body || '').slice(0, 2000)}

Existing meta description: ${existingSeo?.description || 'none'}

Available internal pages for linking:
${pageList}

Return JSON: {
  "seoScore": <0-100>,
  "llmCitabilityScore": <0-100>,
  "suggestedTitle": "...",
  "suggestedDescription": "...",
  "suggestedKeywords": ["..."],
  "structuredData": { "@context": "https://schema.org", "@type": "...", ... },
  "internalLinks": [{"targetPath": "...", "anchorText": "...", "reason": "..."}],
  "issues": [{"severity": "high"|"medium"|"low", "description": "...", "fix": "..."}],
  "llmIssues": [{"description": "...", "fix": "..."}]
}

For LLM citability, consider: clear factual statements, proper attribution, structured data, freshness indicators, expertise signals, and comprehensive coverage.

Respond with ONLY JSON.`,
      }],
    }),
  });

  if (!response.ok) return c.json({ error: 'Analysis failed' }, 500);

  const data = (await response.json()) as { content: Array<{ text?: string }> };
  const resultText = data.content[0]?.text || '';
  const jsonStr = resultText.replace(/^```json?\s*/m, '').replace(/\s*```$/m, '').trim();
  const result = JSON.parse(jsonStr);

  // Save scores to SEO metadata
  await c.env.DB.prepare(
    `INSERT INTO seo_metadata (id, project_id, path, seo_score, llm_citability_score, internal_links)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(project_id, path) DO UPDATE SET
       seo_score = excluded.seo_score, llm_citability_score = excluded.llm_citability_score,
       internal_links = excluded.internal_links, updated_at = datetime('now')`,
  ).bind(
    crypto.randomUUID(), projectId, path,
    result.seoScore, result.llmCitabilityScore,
    JSON.stringify(result.internalLinks || []),
  ).run();

  return c.json({ ok: true, analysis: result });
});

/** POST /api/seo/:projectId/generate-structured-data — generate JSON-LD */
seo.post('/:projectId/generate-structured-data', async (c) => {
  const projectId = c.req.param('projectId');
  const { path, type } = await c.req.json<{ path: string; type?: string }>();

  if (!path) return c.json({ error: 'path required' }, 400);

  const content = await c.env.DB.prepare(
    'SELECT title, body FROM content_index WHERE project_id = ? AND path = ?',
  ).bind(projectId, path).first<{ title: string; body: string }>();

  if (!content) return c.json({ error: 'Page not found in index' }, 404);

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': c.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `Generate JSON-LD structured data for this page. ${type ? `Use @type "${type}".` : 'Infer the best @type.'}

Page: ${path}
Title: ${content.title || ''}
Content: ${(content.body || '').slice(0, 1500)}

Return ONLY a valid JSON-LD object (starting with { "@context": "https://schema.org" }).`,
      }],
    }),
  });

  if (!response.ok) return c.json({ error: 'Generation failed' }, 500);

  const data = (await response.json()) as { content: Array<{ text?: string }> };
  const resultText = data.content[0]?.text || '';
  const jsonStr = resultText.replace(/^```json?\s*/m, '').replace(/\s*```$/m, '').trim();
  const structuredData = JSON.parse(jsonStr);

  // Save to SEO metadata
  await c.env.DB.prepare(
    `INSERT INTO seo_metadata (id, project_id, path, structured_data)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(project_id, path) DO UPDATE SET
       structured_data = excluded.structured_data, updated_at = datetime('now')`,
  ).bind(crypto.randomUUID(), projectId, path, JSON.stringify(structuredData)).run();

  return c.json({ ok: true, structuredData });
});

export default seo;
