import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env, SessionData } from './lib/types.js';
import { authMiddleware } from './middleware/auth.js';
import { tenantMiddleware } from './middleware/tenant.js';
import { computeValueScores } from './lib/value-scoring.js';
import authRoutes from './routes/auth.js';
import contentRoutes from './routes/content.js';
import searchRoutes from './routes/search.js';
import aiRoutes from './routes/ai.js';
import valueRoutes from './routes/value.js';
import brandRoutes from './routes/brand.js';
import assetsRoutes from './routes/assets.js';
import blocksRoutes from './routes/blocks.js';
import designRoutes from './routes/design.js';
import generativeRoutes from './routes/generative.js';
import enterpriseRoutes from './routes/enterprise.js';
import orgRoutes from './routes/org.js';

const app = new Hono<{ Bindings: Env; Variables: { session: SessionData } }>();

// CORS
app.use(
  '/api/*',
  cors({
    origin: (origin, c) => c.env.CORS_ORIGIN || origin,
    credentials: true,
  }),
);

// Health check
app.get('/api/health', (c) => c.json({ status: 'ok', service: 'nova-api' }));

// Public routes (no auth)
app.route('/api/auth', authRoutes);

// Protected routes
app.use('/api/*', authMiddleware);
app.use('/api/content/*', tenantMiddleware);
app.use('/api/ai/*', tenantMiddleware);
app.use('/api/search/*', tenantMiddleware);
app.use('/api/value/*', tenantMiddleware);
app.use('/api/brand/*', tenantMiddleware);
app.use('/api/assets/*', tenantMiddleware);
app.use('/api/blocks/*', tenantMiddleware);
app.use('/api/design/*', tenantMiddleware);
app.use('/api/generative/*', tenantMiddleware);
app.use('/api/enterprise/*', tenantMiddleware);

app.route('/api/content', contentRoutes);
app.route('/api/search', searchRoutes);
app.route('/api/ai', aiRoutes);
app.route('/api/value', valueRoutes);
app.route('/api/brand', brandRoutes);
app.route('/api/assets', assetsRoutes);
app.route('/api/blocks', blocksRoutes);
app.route('/api/design', designRoutes);
app.route('/api/generative', generativeRoutes);
app.route('/api/enterprise', enterpriseRoutes);
app.route('/api/org', orgRoutes);

// Scheduled handler for Operational Telemetry ingestion + value scoring
const scheduled: ExportedHandlerScheduledHandler<Env> = async (event, env, ctx) => {
  ctx.waitUntil(ingestTelemetry(env));
  ctx.waitUntil(computeAllValueScores(env));
};

async function computeAllValueScores(env: Env): Promise<void> {
  const { results: projects } = await env.DB.prepare('SELECT id FROM projects').all();
  for (const project of projects) {
    try {
      await computeValueScores(env.DB, project.id as string);
    } catch {
      // Non-fatal: skip this project
    }
  }
}

async function ingestTelemetry(env: Env): Promise<void> {
  // Fetch all projects
  const { results: projects } = await env.DB.prepare(
    'SELECT id, da_org, da_repo FROM projects',
  ).all();

  for (const project of projects) {
    try {
      // Fetch RUM data from rum.hlx.live
      const response = await fetch(
        `https://rum.hlx.live/bundles/${project.da_org}/${project.da_repo}?interval=1&granularity=1`,
      );
      if (!response.ok) continue;

      const data = (await response.json()) as {
        rumBundles: Array<{
          url: string;
          pageViews: number;
          lcpP75?: number;
          inpP75?: number;
          clsP75?: number;
        }>;
      };

      const today = new Date().toISOString().split('T')[0];

      for (const bundle of data.rumBundles || []) {
        const url = new URL(bundle.url);
        await env.DB.prepare(
          `INSERT INTO telemetry_daily (id, project_id, path, date, page_views, lcp_p75, inp_p75, cls_p75)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(project_id, path, date) DO UPDATE SET
             page_views = excluded.page_views,
             lcp_p75 = excluded.lcp_p75,
             inp_p75 = excluded.inp_p75,
             cls_p75 = excluded.cls_p75`,
        )
          .bind(
            crypto.randomUUID(),
            project.id as string,
            url.pathname,
            today,
            bundle.pageViews,
            bundle.lcpP75 ?? null,
            bundle.inpP75 ?? null,
            bundle.clsP75 ?? null,
          )
          .run();
      }
    } catch {
      // Non-fatal: skip this project
    }
  }
}

export default {
  fetch: app.fetch,
  scheduled,
};
