import { createSSEStream, SSE_HEADERS, CORS_HEADERS } from './lib/sse.js';
import { orchestrate } from './pipeline/orchestrator.js';
import { getSessionContext, updateSessionContext } from './context/session.js';

interface Env {
  ANTHROPIC_API_KEY: string;
  CEREBRAS_API_KEY: string;
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

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    // Health check
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ status: 'ok', service: 'nova-gen' }), {
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
    }

    // POST /generate — main SSE endpoint
    if (url.pathname === '/generate' && request.method === 'POST') {
      return handleGenerate(request, env);
    }

    // POST /context — store visitor context
    if (url.pathname === '/context' && request.method === 'POST') {
      return handleStoreContext(request, env);
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
  };

  if (!body.query || !body.projectId) {
    return new Response(JSON.stringify({ error: 'query and projectId required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
  }

  const { readable, write, close } = createSSEStream();

  // Load session context
  const sessionContext = body.sessionId
    ? await getSessionContext(body.sessionId, env.SESSIONS)
    : undefined;

  // Start pipeline in background
  const pipelinePromise = orchestrate({
    query: body.query,
    projectId: body.projectId,
    env: {
      ANTHROPIC_API_KEY: env.ANTHROPIC_API_KEY,
      CEREBRAS_API_KEY: env.CEREBRAS_API_KEY,
      MODEL_PRESET: env.MODEL_PRESET,
      DB: env.DB,
      VECTORIZE: env.VECTORIZE,
    },
    write,
    sessionContext,
    intentTypes: body.intentTypes,
    brandVoice: body.brandVoice,
  })
    .catch((err) => {
      write({ event: 'error', data: { message: (err as Error).message } });
    })
    .finally(async () => {
      // Update session context
      if (body.sessionId) {
        await updateSessionContext(body.sessionId, body.query, 'generated', env.SESSIONS);
      }
      // Small delay to ensure last event is flushed
      await new Promise((r) => setTimeout(r, 100));
      close();
    });

  // Don't await — stream starts immediately
  void pipelinePromise;

  return new Response(readable, { headers: SSE_HEADERS });
}

async function handleStoreContext(request: Request, env: Env): Promise<Response> {
  const context = await request.json();
  const id = crypto.randomUUID().replace(/-/g, '').slice(0, 12);

  await env.SESSIONS.put(`ctx_${id}`, JSON.stringify(context), {
    expirationTtl: 60 * 60,
  });

  return new Response(JSON.stringify({ id }), {
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}
