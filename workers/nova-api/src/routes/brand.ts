import { Hono } from 'hono';
import type { Env, SessionData } from '../lib/types.js';

const brand = new Hono<{ Bindings: Env; Variables: { session: SessionData } }>();

/** GET /api/brand/:projectId — list brand profiles */
brand.get('/:projectId', async (c) => {
  const projectId = c.req.param('projectId');
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM brand_profiles WHERE project_id = ?',
  )
    .bind(projectId)
    .all();
  return c.json({ profiles: results });
});

/** GET /api/brand/:projectId/:name — get brand profile */
brand.get('/:projectId/:name', async (c) => {
  const projectId = c.req.param('projectId');
  const name = c.req.param('name');
  const profile = await c.env.DB.prepare(
    'SELECT * FROM brand_profiles WHERE project_id = ? AND name = ?',
  )
    .bind(projectId, name)
    .first();
  if (!profile) return c.json({ error: 'Brand profile not found' }, 404);
  return c.json({ profile });
});

/** PUT /api/brand/:projectId/:name — create or update brand profile */
brand.put('/:projectId/:name', async (c) => {
  const projectId = c.req.param('projectId');
  const name = c.req.param('name');
  const body = await c.req.json<{
    voice?: object;
    visual?: object;
    contentRules?: object;
    designTokens?: object;
  }>();

  await c.env.DB.prepare(
    `INSERT INTO brand_profiles (id, project_id, name, voice, visual, content_rules, design_tokens)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(project_id, name) DO UPDATE SET
       voice = excluded.voice,
       visual = excluded.visual,
       content_rules = excluded.content_rules,
       design_tokens = excluded.design_tokens,
       updated_at = datetime('now')`,
  )
    .bind(
      crypto.randomUUID(),
      projectId,
      name,
      JSON.stringify(body.voice || {}),
      JSON.stringify(body.visual || {}),
      JSON.stringify(body.contentRules || {}),
      JSON.stringify(body.designTokens || {}),
    )
    .run();

  return c.json({ ok: true });
});

export default brand;
