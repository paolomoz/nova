import { Hono } from 'hono';
import type { Env, SessionData } from '../lib/types.js';

const generative = new Hono<{ Bindings: Env; Variables: { session: SessionData } }>();

/** GET /api/generative/:projectId/config — list generative configs */
generative.get('/:projectId/config', async (c) => {
  const projectId = c.req.param('projectId');
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM generative_config WHERE project_id = ? ORDER BY path_pattern',
  ).bind(projectId).all();

  return c.json({
    configs: (results || []).map((r) => ({
      id: r.id,
      pathPattern: r.path_pattern,
      deliveryMode: r.delivery_mode,
      intentConfig: r.intent_config ? JSON.parse(r.intent_config as string) : {},
      confidenceThresholds: r.confidence_thresholds ? JSON.parse(r.confidence_thresholds as string) : {},
      signalConfig: r.signal_config ? JSON.parse(r.signal_config as string) : {},
      blockConstraints: r.block_constraints ? JSON.parse(r.block_constraints as string) : {},
    })),
  });
});

/** PUT /api/generative/:projectId/config — create or update generative config */
generative.put('/:projectId/config', async (c) => {
  const projectId = c.req.param('projectId');
  const body = await c.req.json<{
    pathPattern: string;
    deliveryMode: string;
    intentConfig?: object;
    confidenceThresholds?: object;
    signalConfig?: object;
    blockConstraints?: object;
  }>();

  if (!body.pathPattern) return c.json({ error: 'pathPattern required' }, 400);

  await c.env.DB.prepare(
    `INSERT INTO generative_config (id, project_id, path_pattern, delivery_mode, intent_config, confidence_thresholds, signal_config, block_constraints)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(project_id, path_pattern) DO UPDATE SET
       delivery_mode = excluded.delivery_mode,
       intent_config = excluded.intent_config,
       confidence_thresholds = excluded.confidence_thresholds,
       signal_config = excluded.signal_config,
       block_constraints = excluded.block_constraints,
       updated_at = datetime('now')`,
  ).bind(
    crypto.randomUUID(), projectId, body.pathPattern,
    body.deliveryMode || 'static',
    JSON.stringify(body.intentConfig || {}),
    JSON.stringify(body.confidenceThresholds || {}),
    JSON.stringify(body.signalConfig || {}),
    JSON.stringify(body.blockConstraints || {}),
  ).run();

  return c.json({ ok: true });
});

/** DELETE /api/generative/:projectId/config/:configId — delete a config */
generative.delete('/:projectId/config/:configId', async (c) => {
  await c.env.DB.prepare(
    'DELETE FROM generative_config WHERE id = ? AND project_id = ?',
  ).bind(c.req.param('configId'), c.req.param('projectId')).run();
  return c.json({ ok: true });
});

/** GET /api/generative/:projectId/monitoring/recent — recent generations */
generative.get('/:projectId/monitoring/recent', async (c) => {
  const projectId = c.req.param('projectId');
  const limit = parseInt(c.req.query('limit') || '50', 10);

  const { results } = await c.env.DB.prepare(
    `SELECT id, description, input, output, created_at
     FROM action_history
     WHERE project_id = ? AND action_type = 'ai_generate'
     ORDER BY created_at DESC LIMIT ?`,
  ).bind(projectId, limit).all();

  return c.json({
    generations: (results || []).map((r) => ({
      id: r.id,
      description: r.description,
      input: r.input ? JSON.parse(r.input as string) : {},
      output: r.output ? JSON.parse(r.output as string) : {},
      createdAt: r.created_at,
    })),
  });
});

/** GET /api/generative/:projectId/monitoring/stats — generation stats */
generative.get('/:projectId/monitoring/stats', async (c) => {
  const projectId = c.req.param('projectId');
  const days = parseInt(c.req.query('days') || '30', 10);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const totalResult = await c.env.DB.prepare(
    `SELECT COUNT(*) as total FROM action_history
     WHERE project_id = ? AND action_type = 'ai_generate' AND created_at >= ?`,
  ).bind(projectId, since).first<{ total: number }>();

  const dailyResult = await c.env.DB.prepare(
    `SELECT DATE(created_at) as date, COUNT(*) as count
     FROM action_history
     WHERE project_id = ? AND action_type = 'ai_generate' AND created_at >= ?
     GROUP BY DATE(created_at) ORDER BY date`,
  ).bind(projectId, since).all();

  const perfResult = await c.env.DB.prepare(
    `SELECT AVG(lcp_p75) as avg_lcp, AVG(inp_p75) as avg_inp, AVG(cls_p75) as avg_cls,
            SUM(page_views) as total_views
     FROM telemetry_daily
     WHERE project_id = ? AND is_generated = 1 AND date >= ?`,
  ).bind(projectId, since.split('T')[0]).first();

  return c.json({
    totalGenerations: totalResult?.total || 0,
    daily: (dailyResult.results || []).map((r) => ({ date: r.date, count: r.count })),
    performance: {
      avgLcp: perfResult?.avg_lcp || null,
      avgInp: perfResult?.avg_inp || null,
      avgCls: perfResult?.avg_cls || null,
      totalViews: perfResult?.total_views || 0,
    },
  });
});

export default generative;
