import { Hono } from 'hono';
import type { Env, SessionData } from '../lib/types.js';
import { orchestrate, orchestrateWithPlan } from '../lib/ai/orchestrator.js';
import { getDAClientForProject } from '../services/da-client.js';
import { createSSEStream, SSE_HEADERS } from '../lib/sse.js';
import { accumulateContext } from '../lib/ai/context-accumulator.js';

const ai = new Hono<{ Bindings: Env; Variables: { session: SessionData } }>();

function buildOrchestratorEnv(env: Env) {
  return {
    ANTHROPIC_API_KEY: env.ANTHROPIC_API_KEY,
    CEREBRAS_API_KEY: env.CEREBRAS_API_KEY,
    VOYAGE_API_KEY: env.VOYAGE_API_KEY,
    VOYAGE_MODEL: env.VOYAGE_MODEL,
    DB: env.DB,
    VECTORIZE: env.VECTORIZE,
    EMBED_QUEUE: env.EMBED_QUEUE,
    FAL_API_KEY: env.FAL_API_KEY,
    ASSETS: env.ASSETS,
  };
}

/** POST /api/ai/:projectId/execute — AI command execution (single-turn, backward compat) */
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
    env: buildOrchestratorEnv(c.env),
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

/** POST /api/ai/:projectId/stream — SSE streaming with Planner→Executor→Validator pipeline */
ai.post('/:projectId/stream', async (c) => {
  const projectId = c.req.param('projectId');
  const session = c.get('session');
  const { prompt } = await c.req.json<{ prompt: string }>();

  if (!prompt) return c.json({ error: 'prompt required' }, 400);

  const daClient = await getDAClientForProject(c.env, projectId);
  const { readable, write, close } = createSSEStream();

  // Run orchestration in the background, streaming events
  const orchestrationPromise = (async () => {
    try {
      const result = await orchestrateWithPlan(
        {
          prompt,
          userId: session.userId,
          projectId,
          daClient,
          env: buildOrchestratorEnv(c.env),
        },
        write,
      );

      write({ event: 'done', data: { response: result.response, mode: result.mode, plan: result.plan, toolCalls: result.toolCalls } });

      // Log action + accumulate context (non-blocking)
      await c.env.DB.prepare(
        `INSERT INTO action_history (id, user_id, project_id, action_type, description, input, output)
         VALUES (?, ?, ?, 'ai_stream', ?, ?, ?)`,
      ).bind(
        crypto.randomUUID(),
        session.userId,
        projectId,
        `AI: ${prompt.slice(0, 100)}`,
        JSON.stringify({ prompt }),
        JSON.stringify({ response: result.response.slice(0, 500), mode: result.mode, toolCalls: result.toolCalls.length }),
      ).run();

      await accumulateContext(c.env.DB, session.userId, projectId, {
        prompt,
        toolCalls: result.toolCalls,
      });
    } catch (err) {
      write({ event: 'error', data: { error: (err as Error).message } });
    } finally {
      close();
    }
  })();

  c.executionCtx.waitUntil(orchestrationPromise);

  return new Response(readable, {
    headers: {
      ...SSE_HEADERS,
      'Access-Control-Allow-Origin': c.env.CORS_ORIGIN || c.req.header('origin') || '*',
      'Access-Control-Allow-Credentials': 'true',
    },
  });
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
