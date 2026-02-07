import { Hono } from 'hono';
import type { Env, SessionData } from '../lib/types.js';

const value = new Hono<{ Bindings: Env; Variables: { session: SessionData } }>();

/** GET /api/value/:projectId/scores?path=/en/index */
value.get('/:projectId/scores', async (c) => {
  const projectId = c.req.param('projectId');
  const path = c.req.query('path');

  let query = 'SELECT * FROM value_scores WHERE project_id = ?';
  const bindings: string[] = [projectId];

  if (path) {
    query += ' AND path = ?';
    bindings.push(path);
  }

  query += ' ORDER BY composite_score DESC LIMIT 100';

  const { results } = await c.env.DB.prepare(query).bind(...bindings).all();
  return c.json({ scores: results });
});

/** GET /api/value/:projectId/telemetry?path=/en/index&days=30 */
value.get('/:projectId/telemetry', async (c) => {
  const projectId = c.req.param('projectId');
  const path = c.req.query('path');
  const days = parseInt(c.req.query('days') || '30', 10);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  let query = 'SELECT * FROM telemetry_daily WHERE project_id = ? AND date >= ?';
  const bindings: string[] = [projectId, since];

  if (path) {
    query += ' AND path = ?';
    bindings.push(path);
  }

  query += ' ORDER BY date DESC';

  const { results } = await c.env.DB.prepare(query).bind(...bindings).all();
  return c.json({ telemetry: results });
});

export default value;
