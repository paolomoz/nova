import { createSSEStream, SSE_HEADERS, CORS_HEADERS } from './lib/sse.js';
import { orchestrate } from './pipeline/orchestrator.js';
import { getSessionContext, updateSessionContext } from './context/session.js';

interface Env {
  ANTHROPIC_API_KEY: string;
  CEREBRAS_API_KEY: string;
  VOYAGE_API_KEY: string;
  VOYAGE_MODEL: string;
  MODEL_PRESET: string;
  DEBUG: string;
  DB: D1Database;
  SESSIONS: KVNamespace;
  DA_TOKEN_CACHE: KVNamespace;
  VECTORIZE: VectorizeIndex;
  DA_CLIENT_ID: string;
  DA_CLIENT_SECRET: string;
  DA_SERVICE_TOKEN: string;
  DA_ADMIN_HOST?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    if (url.pathname === '/health') {
      return jsonResponse({ status: 'ok', service: 'nova-gen' });
    }

    if (url.pathname === '/generate' && request.method === 'POST') {
      return handleGenerate(request, env);
    }

    if (url.pathname === '/converse' && request.method === 'POST') {
      return handleConverse(request, env);
    }

    if (url.pathname === '/context' && request.method === 'POST') {
      return handleStoreContext(request, env);
    }

    // Monitoring: recent generations
    if (url.pathname === '/monitoring/recent' && request.method === 'GET') {
      return handleMonitoringRecent(url, env);
    }

    // Monitoring: stats
    if (url.pathname === '/monitoring/stats' && request.method === 'GET') {
      return handleMonitoringStats(url, env);
    }

    return new Response('Not found', { status: 404, headers: CORS_HEADERS });
  },
};

async function handleGenerate(request: Request, env: Env): Promise<Response> {
  const body = (await request.json()) as {
    query: string;
    projectId: string;
    sessionId?: string;
    intentTypes?: string[];
    brandVoice?: string;
    persistPath?: string;
    hybridScaffold?: string;
  };

  if (!body.query || !body.projectId) {
    return jsonResponse({ error: 'query and projectId required' }, 400);
  }

  const { readable, write, close } = createSSEStream();

  const sessionContext = body.sessionId
    ? await getSessionContext(body.sessionId, env.SESSIONS)
    : undefined;

  const pipelinePromise = orchestrate({
    query: body.query,
    projectId: body.projectId,
    env: {
      ANTHROPIC_API_KEY: env.ANTHROPIC_API_KEY,
      CEREBRAS_API_KEY: env.CEREBRAS_API_KEY,
      VOYAGE_API_KEY: env.VOYAGE_API_KEY,
      VOYAGE_MODEL: env.VOYAGE_MODEL,
      MODEL_PRESET: env.MODEL_PRESET,
      DB: env.DB,
      VECTORIZE: env.VECTORIZE,
      DA_CLIENT_ID: env.DA_CLIENT_ID,
      DA_CLIENT_SECRET: env.DA_CLIENT_SECRET,
      DA_SERVICE_TOKEN: env.DA_SERVICE_TOKEN,
      DA_ADMIN_HOST: env.DA_ADMIN_HOST,
      DA_TOKEN_CACHE: env.DA_TOKEN_CACHE,
    },
    write,
    sessionContext,
    intentTypes: body.intentTypes,
    brandVoice: body.brandVoice,
    persistPath: body.persistPath,
    hybridScaffold: body.hybridScaffold,
  })
    .catch((err) => {
      write({ event: 'error', data: { message: (err as Error).message } });
    })
    .finally(async () => {
      if (body.sessionId) {
        await updateSessionContext(body.sessionId, body.query, 'generated', env.SESSIONS);
      }
      await new Promise((r) => setTimeout(r, 100));
      close();
    });

  void pipelinePromise;
  return new Response(readable, { headers: SSE_HEADERS });
}

/** Conversational website mode — multi-turn chat sharing the generation pipeline */
async function handleConverse(request: Request, env: Env): Promise<Response> {
  const body = (await request.json()) as {
    query: string;
    projectId: string;
    sessionId: string;
  };

  if (!body.query || !body.projectId || !body.sessionId) {
    return jsonResponse({ error: 'query, projectId, and sessionId required' }, 400);
  }

  const { readable, write, close } = createSSEStream();

  const sessionContext = await getSessionContext(body.sessionId, env.SESSIONS);

  // Load project config for intent types
  let intentTypes: string[] | undefined;
  try {
    const config = await env.DB.prepare(
      `SELECT intent_config FROM generative_config WHERE project_id = ? AND path_pattern = '/**' LIMIT 1`,
    ).bind(body.projectId).first<{ intent_config: string }>();
    if (config?.intent_config) {
      const parsed = JSON.parse(config.intent_config);
      if (Array.isArray(parsed.types)) intentTypes = parsed.types;
    }
  } catch { /* use defaults */ }

  const pipelinePromise = orchestrate({
    query: body.query,
    projectId: body.projectId,
    env: {
      ANTHROPIC_API_KEY: env.ANTHROPIC_API_KEY,
      CEREBRAS_API_KEY: env.CEREBRAS_API_KEY,
      VOYAGE_API_KEY: env.VOYAGE_API_KEY,
      VOYAGE_MODEL: env.VOYAGE_MODEL,
      MODEL_PRESET: env.MODEL_PRESET,
      DB: env.DB,
      VECTORIZE: env.VECTORIZE,
    },
    write,
    sessionContext,
    intentTypes,
  })
    .catch((err) => {
      write({ event: 'error', data: { message: (err as Error).message } });
    })
    .finally(async () => {
      await updateSessionContext(body.sessionId, body.query, 'conversation', env.SESSIONS);
      await new Promise((r) => setTimeout(r, 100));
      close();
    });

  void pipelinePromise;
  return new Response(readable, { headers: SSE_HEADERS });
}

async function handleStoreContext(request: Request, env: Env): Promise<Response> {
  const context = await request.json();
  const id = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
  await env.SESSIONS.put(`ctx_${id}`, JSON.stringify(context), { expirationTtl: 60 * 60 });
  return jsonResponse({ id });
}

/** Get recent generations for monitoring dashboard */
async function handleMonitoringRecent(url: URL, env: Env): Promise<Response> {
  const projectId = url.searchParams.get('projectId');
  if (!projectId) return jsonResponse({ error: 'projectId required' }, 400);

  const limit = parseInt(url.searchParams.get('limit') || '50', 10);
  const { results } = await env.DB.prepare(
    `SELECT id, description, input, output, created_at
     FROM action_history
     WHERE project_id = ? AND action_type = 'ai_generate'
     ORDER BY created_at DESC LIMIT ?`,
  ).bind(projectId, limit).all();

  return jsonResponse({
    generations: (results || []).map((r) => ({
      id: r.id,
      description: r.description,
      input: r.input ? JSON.parse(r.input as string) : {},
      output: r.output ? JSON.parse(r.output as string) : {},
      createdAt: r.created_at,
    })),
  });
}

/** Get generation stats for monitoring dashboard */
async function handleMonitoringStats(url: URL, env: Env): Promise<Response> {
  const projectId = url.searchParams.get('projectId');
  if (!projectId) return jsonResponse({ error: 'projectId required' }, 400);

  const days = parseInt(url.searchParams.get('days') || '30', 10);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const totalResult = await env.DB.prepare(
    `SELECT COUNT(*) as total FROM action_history
     WHERE project_id = ? AND action_type = 'ai_generate' AND created_at >= ?`,
  ).bind(projectId, since).first<{ total: number }>();

  const dailyResult = await env.DB.prepare(
    `SELECT DATE(created_at) as date, COUNT(*) as count
     FROM action_history
     WHERE project_id = ? AND action_type = 'ai_generate' AND created_at >= ?
     GROUP BY DATE(created_at) ORDER BY date`,
  ).bind(projectId, since).all();

  // Get generated page telemetry
  const perfResult = await env.DB.prepare(
    `SELECT AVG(lcp_p75) as avg_lcp, AVG(inp_p75) as avg_inp, AVG(cls_p75) as avg_cls,
            SUM(page_views) as total_views
     FROM telemetry_daily
     WHERE project_id = ? AND is_generated = 1 AND date >= ?`,
  ).bind(projectId, since.split('T')[0]).first();

  return jsonResponse({
    totalGenerations: totalResult?.total || 0,
    daily: (dailyResult.results || []).map((r) => ({ date: r.date, count: r.count })),
    performance: {
      avgLcp: perfResult?.avg_lcp || null,
      avgInp: perfResult?.avg_inp || null,
      avgCls: perfResult?.avg_cls || null,
      totalViews: perfResult?.total_views || 0,
    },
  });
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}
