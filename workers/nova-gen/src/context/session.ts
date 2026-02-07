import type { SessionContext, QueryHistoryItem } from '@nova/shared-types';

const CONTEXT_PREFIX = 'ctx_';
const CONTEXT_TTL = 60 * 60; // 1 hour

/**
 * Session context management — KV-backed visitor session for generative pipeline.
 */
export async function getSessionContext(
  sessionId: string,
  kv?: KVNamespace,
): Promise<SessionContext | undefined> {
  if (!kv || !sessionId) return undefined;

  try {
    const data = await kv.get(`${CONTEXT_PREFIX}${sessionId}`, { type: 'json' });
    return data as SessionContext | undefined;
  } catch {
    return undefined;
  }
}

export async function updateSessionContext(
  sessionId: string,
  query: string,
  intentType: string,
  kv?: KVNamespace,
): Promise<void> {
  if (!kv || !sessionId) return;

  const existing = await getSessionContext(sessionId, kv);
  const previousQueries: QueryHistoryItem[] = existing?.previousQueries || [];

  previousQueries.push({
    query,
    intentType,
    timestamp: Date.now(),
  });

  // Keep last 10 queries
  if (previousQueries.length > 10) {
    previousQueries.splice(0, previousQueries.length - 10);
  }

  const context: SessionContext = {
    ...existing,
    previousQueries,
  };

  await kv.put(`${CONTEXT_PREFIX}${sessionId}`, JSON.stringify(context), {
    expirationTtl: CONTEXT_TTL,
  });
}

export async function storeSessionContext(
  context: SessionContext,
  kv?: KVNamespace,
): Promise<string | undefined> {
  if (!kv) return undefined;

  const id = crypto.randomUUID().replace(/-/g, '').slice(0, 12);

  await kv.put(`${CONTEXT_PREFIX}${id}`, JSON.stringify(context), {
    expirationTtl: CONTEXT_TTL,
  });

  return id;
}
