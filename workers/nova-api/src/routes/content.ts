import { Hono } from 'hono';
import type { Env, SessionData } from '../lib/types.js';
import { getDAClientForProject } from '../services/da-client.js';

const content = new Hono<{ Bindings: Env; Variables: { session: SessionData } }>();

/** GET /api/content/:projectId/list?path=/ */
content.get('/:projectId/list', async (c) => {
  const projectId = c.req.param('projectId');
  const path = c.req.query('path') || '/';
  const client = await getDAClientForProject(c.env, projectId);
  const items = await client.list(path);
  return c.json({ items });
});

/** GET /api/content/:projectId/source?path=/en/index */
content.get('/:projectId/source', async (c) => {
  const projectId = c.req.param('projectId');
  const path = c.req.query('path');
  if (!path) return c.json({ error: 'path required' }, 400);
  const client = await getDAClientForProject(c.env, projectId);
  const source = await client.getSource(path);
  return c.json(source);
});

/** PUT /api/content/:projectId/source — create or update page */
content.put('/:projectId/source', async (c) => {
  const projectId = c.req.param('projectId');
  const { path, content: htmlContent } = await c.req.json<{ path: string; content: string }>();
  if (!path || !htmlContent) return c.json({ error: 'path and content required' }, 400);
  const client = await getDAClientForProject(c.env, projectId);
  await client.putSource(path, htmlContent);

  // Log action
  const session = c.get('session');
  await c.env.DB.prepare(
    `INSERT INTO action_history (id, user_id, project_id, action_type, description, input)
     VALUES (?, ?, ?, 'create_page', ?, ?)`,
  )
    .bind(
      crypto.randomUUID(),
      session.userId,
      projectId,
      `Created/updated page at ${path}`,
      JSON.stringify({ path }),
    )
    .run();

  return c.json({ ok: true, path });
});

/** DELETE /api/content/:projectId/source?path=/en/test */
content.delete('/:projectId/source', async (c) => {
  const projectId = c.req.param('projectId');
  const path = c.req.query('path');
  if (!path) return c.json({ error: 'path required' }, 400);
  const client = await getDAClientForProject(c.env, projectId);
  await client.deleteSource(path);

  const session = c.get('session');
  await c.env.DB.prepare(
    `INSERT INTO action_history (id, user_id, project_id, action_type, description, input)
     VALUES (?, ?, ?, 'delete_page', ?, ?)`,
  )
    .bind(
      crypto.randomUUID(),
      session.userId,
      projectId,
      `Deleted page at ${path}`,
      JSON.stringify({ path }),
    )
    .run();

  return c.json({ ok: true });
});

/** POST /api/content/:projectId/copy */
content.post('/:projectId/copy', async (c) => {
  const projectId = c.req.param('projectId');
  const { source, destination } = await c.req.json<{ source: string; destination: string }>();
  if (!source || !destination) return c.json({ error: 'source and destination required' }, 400);
  const client = await getDAClientForProject(c.env, projectId);
  await client.copy(source, destination);
  return c.json({ ok: true });
});

/** POST /api/content/:projectId/move */
content.post('/:projectId/move', async (c) => {
  const projectId = c.req.param('projectId');
  const { source, destination } = await c.req.json<{ source: string; destination: string }>();
  if (!source || !destination) return c.json({ error: 'source and destination required' }, 400);
  const client = await getDAClientForProject(c.env, projectId);
  await client.move(source, destination);
  return c.json({ ok: true });
});

/** GET /api/content/:projectId/versions?path=/en/index */
content.get('/:projectId/versions', async (c) => {
  const projectId = c.req.param('projectId');
  const path = c.req.query('path');
  if (!path) return c.json({ error: 'path required' }, 400);
  const client = await getDAClientForProject(c.env, projectId);
  const versions = await client.listVersions(path);
  return c.json({ versions });
});

export default content;
