import { createMiddleware } from 'hono/factory';
import type { Env, SessionData } from '../lib/types.js';

/**
 * Tenant isolation middleware.
 * Ensures all project-scoped operations are within the user's org.
 */
export const tenantMiddleware = createMiddleware<{
  Bindings: Env;
  Variables: { session: SessionData };
}>(async (c, next) => {
  const session = c.get('session');
  const projectId = c.req.param('projectId') || c.req.query('projectId');

  if (projectId) {
    // Verify the project belongs to the user's org
    const project = await c.env.DB.prepare(
      'SELECT id FROM projects WHERE id = ? AND org_id = ?',
    )
      .bind(projectId, session.orgId)
      .first();

    if (!project) {
      return c.json({ error: 'Project not found or access denied' }, 404);
    }
  }

  await next();
});
