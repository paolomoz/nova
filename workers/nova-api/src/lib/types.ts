import type { Context } from 'hono';

export interface Env {
  // D1
  DB: D1Database;
  // KV
  SESSIONS: KVNamespace;
  DA_TOKEN_CACHE: KVNamespace;
  // Vectorize
  VECTORIZE: VectorizeIndex;
  // Secrets
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  ANTHROPIC_API_KEY: string;
  DA_CLIENT_ID: string;
  DA_CLIENT_SECRET: string;
  DA_SERVICE_TOKEN: string;
  // Vars
  CORS_ORIGIN: string;
  DA_ADMIN_HOST?: string;
}

export interface SessionData {
  userId: string;
  orgId: string;
  sessionId: string;
}

export type AppContext = Context<{ Bindings: Env; Variables: { session: SessionData } }>;
