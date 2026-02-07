import { Hono } from 'hono';
import type { Env, SessionData } from '../lib/types.js';

const generative = new Hono<{ Bindings: Env; Variables: { session: SessionData } }>();

/** GET /api/generative/:projectId/config — list generative configs */
generative.get('/:projectId/config', async (c) => {
  const projectId = c.req.param('projectId');
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM generative_config WHERE project_id = ? ORDER BY path_pattern',
  )
    .bind(projectId)
    .all();
  return c.json({ configs: results });
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
  )
    .bind(
      crypto.randomUUID(),
      projectId,
      body.pathPattern,
      body.deliveryMode || 'static',
      JSON.stringify(body.intentConfig || {}),
      JSON.stringify(body.confidenceThresholds || {}),
      JSON.stringify(body.signalConfig || {}),
      JSON.stringify(body.blockConstraints || {}),
    )
    .run();

  return c.json({ ok: true });
});

export default generative;
