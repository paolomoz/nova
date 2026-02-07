import type { Context } from 'hono';

export interface Env {
  // D1
  DB: D1Database;
  // KV
  SESSIONS: KVNamespace;
  DA_TOKEN_CACHE: KVNamespace;
  // Vectorize
  VECTORIZE: VectorizeIndex;
  // Queues
  EMBED_QUEUE: Queue;
  // Secrets
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  ANTHROPIC_API_KEY: string;
  CEREBRAS_API_KEY: string;
  VOYAGE_API_KEY: string;
  DA_CLIENT_ID: string;
  DA_CLIENT_SECRET: string;
  DA_SERVICE_TOKEN: string;
  GITHUB_TOKEN: string;
  ASSETS: R2Bucket;
  // Vars
  CORS_ORIGIN: string;
  DA_ADMIN_HOST?: string;
  VOYAGE_MODEL: string;
}

export interface SessionData {
  userId: string;
  orgId: string;
  sessionId: string;
}

export type AppContext = Context<{ Bindings: Env; Variables: { session: SessionData } }>;
