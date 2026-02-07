import { Hono } from 'hono';
import type { Env, SessionData } from '../lib/types.js';
import { orchestrate } from '../lib/ai/orchestrator.js';
import { getDAClientForProject } from '../services/da-client.js';

const ai = new Hono<{ Bindings: Env; Variables: { session: SessionData } }>();

/** POST /api/ai/:projectId/execute — AI command execution */
ai.post('/:projectId/execute', async (c) => {
  const projectId = c.req.param('projectId');
  const session = c.get('session');
  const { prompt } = await c.req.json<{ prompt: string }>();

  if (!prompt) return c.json({ error: 'prompt required' }, 400);

  const daClient = await getDAClientForProject(c.env, projectId);

  const result = await orchestrate({
    prompt,
    userId: session.userId,
    projectId,
    daClient,
    env: {
      ANTHROPIC_API_KEY: c.env.ANTHROPIC_API_KEY,
      DB: c.env.DB,
    },
  });

  // Log the action
  await c.env.DB.prepare(
    `INSERT INTO action_history (id, user_id, project_id, action_type, description, input, output)
     VALUES (?, ?, ?, 'ai_execute', ?, ?, ?)`,
  )
    .bind(
      crypto.randomUUID(),
      session.userId,
      projectId,
      `AI: ${prompt.slice(0, 100)}`,
      JSON.stringify({ prompt }),
      JSON.stringify({ response: result.response, toolCalls: result.toolCalls.length }),
    )
    .run();

  return c.json(result);
});

/** GET /api/ai/:projectId/history — recent AI actions */
ai.get('/:projectId/history', async (c) => {
  const projectId = c.req.param('projectId');
  const session = c.get('session');
  const limit = parseInt(c.req.query('limit') || '20', 10);

  const { results } = await c.env.DB.prepare(
    `SELECT id, action_type, description, input, output, status, created_at
     FROM action_history
     WHERE user_id = ? AND project_id = ?
     ORDER BY created_at DESC LIMIT ?`,
  )
    .bind(session.userId, projectId, limit)
    .all();

  return c.json({ actions: results });
});

export default ai;
