import { createMiddleware } from 'hono/factory';
import type { Env, SessionData } from '../lib/types.js';

export const authMiddleware = createMiddleware<{
  Bindings: Env;
  Variables: { session: SessionData };
}>(async (c, next) => {
  // Extract token from cookie or Authorization header
  const cookie = c.req.header('cookie') || '';
  const match = cookie.match(/nova_session=([^;]+)/);
  const token = match?.[1] || c.req.header('authorization')?.replace('Bearer ', '');

  if (!token) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  // Hash the token and look up the session
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const tokenHash = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  const session = await c.env.DB.prepare(
    'SELECT id, user_id, org_id, expires_at FROM sessions WHERE token_hash = ?',
  )
    .bind(tokenHash)
    .first<{ id: string; user_id: string; org_id: string; expires_at: string }>();

  if (!session) {
    return c.json({ error: 'Invalid session' }, 401);
  }

  if (new Date(session.expires_at) < new Date()) {
    // Clean up expired session
    await c.env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(session.id).run();
    return c.json({ error: 'Session expired' }, 401);
  }

  c.set('session', {
    userId: session.user_id,
    orgId: session.org_id,
    sessionId: session.id,
  });

  await next();
});
