import { Hono } from 'hono';
import type { Env, SessionData } from '../lib/types.js';

const org = new Hono<{ Bindings: Env; Variables: { session: SessionData } }>();

/** GET /api/org — get current org */
org.get('/', async (c) => {
  const session = c.get('session');
  const result = await c.env.DB.prepare('SELECT * FROM orgs WHERE id = ?')
    .bind(session.orgId)
    .first();
  return c.json({ org: result });
});

/** GET /api/org/projects — list projects in current org */
org.get('/projects', async (c) => {
  const session = c.get('session');
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM projects WHERE org_id = ? ORDER BY name',
  )
    .bind(session.orgId)
    .all();
  return c.json({ projects: results });
});

/** POST /api/org/projects — create project */
org.post('/projects', async (c) => {
  const session = c.get('session');
  const body = await c.req.json<{
    name: string;
    slug: string;
    daOrg: string;
    daRepo: string;
    githubOrg?: string;
    githubRepo?: string;
  }>();

  if (!body.name || !body.slug || !body.daOrg || !body.daRepo) {
    return c.json({ error: 'name, slug, daOrg, and daRepo are required' }, 400);
  }

  const projectId = crypto.randomUUID();
  await c.env.DB.prepare(
    `INSERT INTO projects (id, org_id, name, slug, da_org, da_repo, github_org, github_repo)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      projectId,
      session.orgId,
      body.name,
      body.slug,
      body.daOrg,
      body.daRepo,
      body.githubOrg || null,
      body.githubRepo || null,
    )
    .run();

  return c.json({ id: projectId }, 201);
});

/** GET /api/org/members — list org members */
org.get('/members', async (c) => {
  const session = c.get('session');
  const { results } = await c.env.DB.prepare(
    `SELECT u.id, u.email, u.name, u.avatar_url, m.role
     FROM org_members m JOIN users u ON u.id = m.user_id
     WHERE m.org_id = ?`,
  )
    .bind(session.orgId)
    .all();
  return c.json({ members: results });
});

export default org;
