import { Hono } from 'hono';
import type { Env, SessionData } from '../lib/types.js';

const assets = new Hono<{ Bindings: Env; Variables: { session: SessionData } }>();

/** GET /api/assets/:projectId/list?path=/ */
assets.get('/:projectId/list', async (c) => {
  // Phase 7: Full asset management
  return c.json({ assets: [], message: 'Asset management — Phase 7' });
});

/** POST /api/assets/:projectId/upload */
assets.post('/:projectId/upload', async (c) => {
  return c.json({ error: 'Asset upload — Phase 7' }, 501);
});

export default assets;
