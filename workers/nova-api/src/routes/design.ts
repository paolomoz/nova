import { Hono } from 'hono';
import type { Env, SessionData } from '../lib/types.js';

const design = new Hono<{ Bindings: Env; Variables: { session: SessionData } }>();

/** POST /api/design/:projectId/generate — AI design generation */
design.post('/:projectId/generate', async (c) => {
  // Phase 6: Design generation pipeline
  return c.json({ error: 'Design generation — Phase 6' }, 501);
});

export default design;
