import { Hono } from 'hono';
import type { Env, SessionData } from '../lib/types.js';

const fragments = new Hono<{ Bindings: Env; Variables: { session: SessionData } }>();

// ─── Fragment Models ───────────────────────────────────────────

/** GET /api/fragments/:projectId/models — list fragment models */
fragments.get('/:projectId/models', async (c) => {
  const projectId = c.req.param('projectId');
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM content_fragment_models WHERE project_id = ? ORDER BY name',
  ).bind(projectId).all();

  return c.json({
    models: (results || []).map((m) => ({
      id: m.id,
      name: m.name,
      description: m.description,
      schema: JSON.parse((m.schema as string) || '{}'),
      createdAt: m.created_at,
    })),
  });
});

/** POST /api/fragments/:projectId/models — create fragment model */
fragments.post('/:projectId/models', async (c) => {
  const projectId = c.req.param('projectId');
  const body = await c.req.json<{
    name: string;
    description?: string;
    schema: object;
  }>();

  if (!body.name || !body.schema) return c.json({ error: 'name and schema required' }, 400);

  const id = crypto.randomUUID();
  await c.env.DB.prepare(
    `INSERT INTO content_fragment_models (id, project_id, name, description, schema)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(project_id, name) DO UPDATE SET
       description = excluded.description, schema = excluded.schema, updated_at = datetime('now')`,
  ).bind(id, projectId, body.name, body.description || null, JSON.stringify(body.schema)).run();

  return c.json({ ok: true, id });
});

/** PUT /api/fragments/:projectId/models/:modelId */
fragments.put('/:projectId/models/:modelId', async (c) => {
  const { projectId, modelId } = c.req.param();
  const body = await c.req.json<{ name?: string; description?: string; schema?: object }>();

  const sets: string[] = ['updated_at = datetime(\'now\')'];
  const bindings: unknown[] = [];

  if (body.name) { sets.push('name = ?'); bindings.push(body.name); }
  if (body.description !== undefined) { sets.push('description = ?'); bindings.push(body.description); }
  if (body.schema) { sets.push('schema = ?'); bindings.push(JSON.stringify(body.schema)); }

  bindings.push(modelId, projectId);
  await c.env.DB.prepare(
    `UPDATE content_fragment_models SET ${sets.join(', ')} WHERE id = ? AND project_id = ?`,
  ).bind(...bindings).run();

  return c.json({ ok: true });
});

/** DELETE /api/fragments/:projectId/models/:modelId */
fragments.delete('/:projectId/models/:modelId', async (c) => {
  const { projectId, modelId } = c.req.param();
  await c.env.DB.prepare('DELETE FROM content_fragment_models WHERE id = ? AND project_id = ?').bind(modelId, projectId).run();
  return c.json({ ok: true });
});

// ─── Fragments ─────────────────────────────────────────────────

/** GET /api/fragments/:projectId — list fragments */
fragments.get('/:projectId', async (c) => {
  const projectId = c.req.param('projectId');
  const modelId = c.req.query('modelId');

  let query = 'SELECT f.*, m.name as model_name FROM content_fragments f JOIN content_fragment_models m ON f.model_id = m.id WHERE f.project_id = ?';
  const bindings: unknown[] = [projectId];

  if (modelId) {
    query += ' AND f.model_id = ?';
    bindings.push(modelId);
  }
  query += ' ORDER BY f.updated_at DESC LIMIT 200';

  const { results } = await c.env.DB.prepare(query).bind(...bindings).all();

  return c.json({
    fragments: (results || []).map((f) => ({
      id: f.id,
      modelId: f.model_id,
      modelName: f.model_name,
      title: f.title,
      slug: f.slug,
      data: JSON.parse((f.data as string) || '{}'),
      status: f.status,
      tags: JSON.parse((f.tags as string) || '[]'),
      createdAt: f.created_at,
      updatedAt: f.updated_at,
    })),
  });
});

/** GET /api/fragments/:projectId/:fragmentId — get single fragment */
fragments.get('/:projectId/:fragmentId', async (c) => {
  const { projectId, fragmentId } = c.req.param();
  const row = await c.env.DB.prepare(
    'SELECT f.*, m.name as model_name, m.schema as model_schema FROM content_fragments f JOIN content_fragment_models m ON f.model_id = m.id WHERE f.id = ? AND f.project_id = ?',
  ).bind(fragmentId, projectId).first();

  if (!row) return c.json({ error: 'Fragment not found' }, 404);

  return c.json({
    fragment: {
      id: row.id,
      modelId: row.model_id,
      modelName: row.model_name,
      modelSchema: JSON.parse((row.model_schema as string) || '{}'),
      title: row.title,
      slug: row.slug,
      data: JSON.parse((row.data as string) || '{}'),
      status: row.status,
      tags: JSON.parse((row.tags as string) || '[]'),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    },
  });
});

/** POST /api/fragments/:projectId — create fragment */
fragments.post('/:projectId', async (c) => {
  const projectId = c.req.param('projectId');
  const session = c.get('session');
  const body = await c.req.json<{
    modelId: string;
    title: string;
    slug: string;
    data: object;
    status?: string;
    tags?: string[];
  }>();

  if (!body.modelId || !body.title || !body.slug) return c.json({ error: 'modelId, title, and slug required' }, 400);

  const id = crypto.randomUUID();
  await c.env.DB.prepare(
    `INSERT INTO content_fragments (id, project_id, model_id, title, slug, data, status, tags, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    id, projectId, body.modelId, body.title, body.slug,
    JSON.stringify(body.data || {}), body.status || 'draft',
    JSON.stringify(body.tags || []), session.userId,
  ).run();

  return c.json({ ok: true, id });
});

/** PUT /api/fragments/:projectId/:fragmentId — update fragment */
fragments.put('/:projectId/:fragmentId', async (c) => {
  const { projectId, fragmentId } = c.req.param();
  const body = await c.req.json<{
    title?: string;
    data?: object;
    status?: string;
    tags?: string[];
  }>();

  const sets: string[] = ['updated_at = datetime(\'now\')'];
  const bindings: unknown[] = [];

  if (body.title) { sets.push('title = ?'); bindings.push(body.title); }
  if (body.data) { sets.push('data = ?'); bindings.push(JSON.stringify(body.data)); }
  if (body.status) { sets.push('status = ?'); bindings.push(body.status); }
  if (body.tags) { sets.push('tags = ?'); bindings.push(JSON.stringify(body.tags)); }

  bindings.push(fragmentId, projectId);
  await c.env.DB.prepare(
    `UPDATE content_fragments SET ${sets.join(', ')} WHERE id = ? AND project_id = ?`,
  ).bind(...bindings).run();

  return c.json({ ok: true });
});

/** DELETE /api/fragments/:projectId/:fragmentId */
fragments.delete('/:projectId/:fragmentId', async (c) => {
  const { projectId, fragmentId } = c.req.param();
  await c.env.DB.prepare('DELETE FROM content_fragments WHERE id = ? AND project_id = ?').bind(fragmentId, projectId).run();
  return c.json({ ok: true });
});

/** POST /api/fragments/:projectId/generate — AI-generate fragment content */
fragments.post('/:projectId/generate', async (c) => {
  const projectId = c.req.param('projectId');
  const { modelId, prompt } = await c.req.json<{ modelId: string; prompt: string }>();

  if (!modelId || !prompt) return c.json({ error: 'modelId and prompt required' }, 400);

  const model = await c.env.DB.prepare(
    'SELECT * FROM content_fragment_models WHERE id = ? AND project_id = ?',
  ).bind(modelId, projectId).first();

  if (!model) return c.json({ error: 'Model not found' }, 404);

  const schema = JSON.parse((model.schema as string) || '{}');

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
        content: `Generate content for a "${model.name}" content fragment based on this prompt:
"${prompt}"

The content must match this JSON schema:
${JSON.stringify(schema, null, 2)}

Return JSON matching the schema. Include a "title" and "slug" field in addition to the schema fields.
Format: { "title": "...", "slug": "...", "data": { ...schema-matching data... } }

Respond with ONLY JSON.`,
      }],
    }),
  });

  if (!response.ok) return c.json({ error: 'Generation failed' }, 500);

  const data = (await response.json()) as { content: Array<{ text?: string }> };
  const resultText = data.content[0]?.text || '';
  const jsonStr = resultText.replace(/^```json?\s*/m, '').replace(/\s*```$/m, '').trim();
  const result = JSON.parse(jsonStr);

  return c.json({ ok: true, generated: result });
});

export default fragments;
