import { Hono } from 'hono';
import type { Env, SessionData } from '../lib/types.js';

const blocks = new Hono<{ Bindings: Env; Variables: { session: SessionData } }>();

/** GET /api/blocks/:projectId — list block library */
blocks.get('/:projectId', async (c) => {
  const projectId = c.req.param('projectId');
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM block_library WHERE project_id = ? ORDER BY category, name',
  )
    .bind(projectId)
    .all();
  return c.json({ blocks: results });
});

/** POST /api/blocks/:projectId — add block to library */
blocks.post('/:projectId', async (c) => {
  const projectId = c.req.param('projectId');
  const body = await c.req.json<{
    name: string;
    category?: string;
    generativeConfig?: object;
    valueMetadata?: object;
    codePath?: string;
  }>();

  if (!body.name) return c.json({ error: 'name required' }, 400);

  await c.env.DB.prepare(
    `INSERT INTO block_library (id, project_id, name, category, generative_config, value_metadata, code_path)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      crypto.randomUUID(),
      projectId,
      body.name,
      body.category || null,
      JSON.stringify(body.generativeConfig || {}),
      JSON.stringify(body.valueMetadata || {}),
      body.codePath || null,
    )
    .run();

  return c.json({ ok: true }, 201);
});

export default blocks;
