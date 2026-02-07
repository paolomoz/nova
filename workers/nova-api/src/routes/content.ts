import { Hono } from 'hono';
import type { Env, SessionData } from '../lib/types.js';
import { getDAClientForProject } from '../services/da-client.js';
import { getBlockLibrary } from '../lib/blocks.js';

const content = new Hono<{ Bindings: Env; Variables: { session: SessionData } }>();

function logAction(
  db: D1Database,
  userId: string,
  projectId: string,
  actionType: string,
  description: string,
  input: Record<string, unknown>,
) {
  return db
    .prepare(
      `INSERT INTO action_history (id, user_id, project_id, action_type, description, input)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(crypto.randomUUID(), userId, projectId, actionType, description, JSON.stringify(input))
    .run();
}

async function indexContent(
  db: D1Database,
  projectId: string,
  path: string,
  htmlContent: string,
) {
  // Strip HTML tags for text indexing
  const text = htmlContent
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Extract title from first heading
  const titleMatch = htmlContent.match(/<h1[^>]*>(.*?)<\/h1>/i);
  const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : path.split('/').pop() || '';

  await db
    .prepare(
      `INSERT INTO content_index (id, project_id, path, title, body, updated_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(project_id, path) DO UPDATE SET
         title = excluded.title,
         body = excluded.body,
         updated_at = datetime('now')`,
    )
    .bind(crypto.randomUUID(), projectId, path, title, text.slice(0, 10000))
    .run();
}

/** GET /api/content/:projectId/list?path=/ */
content.get('/:projectId/list', async (c) => {
  const projectId = c.req.param('projectId');
  const path = c.req.query('path') || '/';
  const client = await getDAClientForProject(c.env, projectId);
  const items = await client.list(path);
  return c.json({ items });
});

/** GET /api/content/:projectId/source?path=/en/index */
content.get('/:projectId/source', async (c) => {
  const projectId = c.req.param('projectId');
  const path = c.req.query('path');
  if (!path) return c.json({ error: 'path required' }, 400);
  const client = await getDAClientForProject(c.env, projectId);
  const source = await client.getSource(path);
  return c.json(source);
});

/** PUT /api/content/:projectId/source — create or update page */
content.put('/:projectId/source', async (c) => {
  const projectId = c.req.param('projectId');
  const { path, content: htmlContent } = await c.req.json<{ path: string; content: string }>();
  if (!path || !htmlContent) return c.json({ error: 'path and content required' }, 400);
  const client = await getDAClientForProject(c.env, projectId);
  await client.putSource(path, htmlContent);

  const session = c.get('session');
  await logAction(c.env.DB, session.userId, projectId, 'create_page', `Created/updated page at ${path}`, { path });

  // Index content for search
  try {
    await indexContent(c.env.DB, projectId, path, htmlContent);
  } catch {
    // Non-fatal: indexing failure shouldn't block page creation
  }

  // Queue embedding for semantic search
  try {
    if (c.env.EMBED_QUEUE) {
      await c.env.EMBED_QUEUE.send({ type: 'content', projectId, path, html: htmlContent });
    }
  } catch {
    // Non-fatal: embed queue failure shouldn't block page creation
  }

  return c.json({ ok: true, path });
});

/** DELETE /api/content/:projectId/source?path=/en/test */
content.delete('/:projectId/source', async (c) => {
  const projectId = c.req.param('projectId');
  const path = c.req.query('path');
  if (!path) return c.json({ error: 'path required' }, 400);
  const client = await getDAClientForProject(c.env, projectId);
  await client.deleteSource(path);

  const session = c.get('session');
  await logAction(c.env.DB, session.userId, projectId, 'delete_page', `Deleted page at ${path}`, { path });

  // Remove from search index
  try {
    await c.env.DB.prepare('DELETE FROM content_index WHERE project_id = ? AND path = ?')
      .bind(projectId, path)
      .run();
  } catch {
    // Non-fatal
  }

  return c.json({ ok: true });
});

/** POST /api/content/:projectId/copy */
content.post('/:projectId/copy', async (c) => {
  const projectId = c.req.param('projectId');
  const { source, destination } = await c.req.json<{ source: string; destination: string }>();
  if (!source || !destination) return c.json({ error: 'source and destination required' }, 400);
  const client = await getDAClientForProject(c.env, projectId);
  await client.copy(source, destination);

  const session = c.get('session');
  await logAction(c.env.DB, session.userId, projectId, 'copy_page', `Copied ${source} to ${destination}`, { source, destination });

  return c.json({ ok: true });
});

/** POST /api/content/:projectId/move — also used for rename */
content.post('/:projectId/move', async (c) => {
  const projectId = c.req.param('projectId');
  const { source, destination } = await c.req.json<{ source: string; destination: string }>();
  if (!source || !destination) return c.json({ error: 'source and destination required' }, 400);
  const client = await getDAClientForProject(c.env, projectId);
  await client.move(source, destination);

  const session = c.get('session');
  const isRename = source.split('/').slice(0, -1).join('/') === destination.split('/').slice(0, -1).join('/');
  const actionType = isRename ? 'rename_page' : 'move_page';
  const description = isRename
    ? `Renamed ${source.split('/').pop()} to ${destination.split('/').pop()}`
    : `Moved ${source} to ${destination}`;
  await logAction(c.env.DB, session.userId, projectId, actionType, description, { source, destination });

  // Update search index path
  try {
    await c.env.DB.prepare(
      'UPDATE content_index SET path = ?, updated_at = datetime(\'now\') WHERE project_id = ? AND path = ?',
    )
      .bind(destination, projectId, source)
      .run();
  } catch {
    // Non-fatal
  }

  return c.json({ ok: true });
});

/** GET /api/content/:projectId/versions?path=/en/index */
content.get('/:projectId/versions', async (c) => {
  const projectId = c.req.param('projectId');
  const path = c.req.query('path');
  if (!path) return c.json({ error: 'path required' }, 400);
  const client = await getDAClientForProject(c.env, projectId);
  const versions = await client.listVersions(path);
  return c.json({ versions });
});

/** GET /api/content/:projectId/properties?path=/en/index — page metadata + delivery mode */
content.get('/:projectId/properties', async (c) => {
  const projectId = c.req.param('projectId');
  const path = c.req.query('path');
  if (!path) return c.json({ error: 'path required' }, 400);

  // Get delivery mode from generative_config
  const config = await c.env.DB.prepare(
    `SELECT delivery_mode FROM generative_config
     WHERE project_id = ? AND (path_pattern = ? OR ? GLOB path_pattern)
     ORDER BY length(path_pattern) DESC LIMIT 1`,
  )
    .bind(projectId, path, path)
    .first<{ delivery_mode: string }>();

  // Get value annotations
  const { results: annotations } = await c.env.DB.prepare(
    'SELECT audience, situation, outcome, composite_score FROM value_scores WHERE project_id = ? AND path = ?',
  )
    .bind(projectId, path)
    .all();

  return c.json({
    path,
    deliveryMode: config?.delivery_mode || 'static',
    annotations: annotations || [],
  });
});

/** PUT /api/content/:projectId/properties — update page properties */
content.put('/:projectId/properties', async (c) => {
  const projectId = c.req.param('projectId');
  const session = c.get('session');
  const { path, deliveryMode, annotation } = await c.req.json<{
    path: string;
    deliveryMode?: string;
    annotation?: { audience?: string; situation?: string; outcome?: string };
  }>();
  if (!path) return c.json({ error: 'path required' }, 400);

  // Update delivery mode
  if (deliveryMode) {
    await c.env.DB.prepare(
      `INSERT INTO generative_config (id, project_id, path_pattern, delivery_mode)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(project_id, path_pattern) DO UPDATE SET
         delivery_mode = excluded.delivery_mode,
         updated_at = datetime('now')`,
    )
      .bind(crypto.randomUUID(), projectId, path, deliveryMode)
      .run();
  }

  // Upsert value annotation
  if (annotation) {
    await c.env.DB.prepare(
      `INSERT INTO value_scores (id, project_id, path, audience, situation, outcome)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(project_id, path, audience, situation) DO UPDATE SET
         outcome = excluded.outcome,
         updated_at = datetime('now')`,
    )
      .bind(
        crypto.randomUUID(),
        projectId,
        path,
        annotation.audience || null,
        annotation.situation || null,
        annotation.outcome || null,
      )
      .run();
  }

  await logAction(c.env.DB, session.userId, projectId, 'update_properties', `Updated properties for ${path}`, { path, deliveryMode, annotation });

  return c.json({ ok: true });
});

/** DELETE /api/content/:projectId/annotation — remove a value annotation */
content.delete('/:projectId/annotation', async (c) => {
  const projectId = c.req.param('projectId');
  const id = c.req.query('id');
  if (!id) return c.json({ error: 'id required' }, 400);
  await c.env.DB.prepare('DELETE FROM value_scores WHERE id = ? AND project_id = ?')
    .bind(id, projectId)
    .run();
  return c.json({ ok: true });
});

/** GET /api/content/:projectId/templates — page templates */
content.get('/:projectId/templates', async (c) => {
  const templates = [
    {
      id: 'blank',
      name: 'Blank Page',
      description: 'Empty page with just a heading',
      html: '<h1>New Page</h1>\n<p>Start writing your content here.</p>',
    },
    {
      id: 'hero-cards',
      name: 'Hero + Cards',
      description: 'Hero section followed by a card grid',
      html: `<h1>Page Title</h1>
<p>Hero description text goes here.</p>
<p><a href="#">Get Started</a></p>
<div class="section-metadata"><div><div>style</div><div>highlight</div></div></div>
<hr>
<div class="cards">
  <div><div><picture><img src="/media/placeholder.png" alt="Card one image"></picture></div><div><h3>Card One</h3><p>Description for card one.</p></div></div>
  <div><div><picture><img src="/media/placeholder.png" alt="Card two image"></picture></div><div><h3>Card Two</h3><p>Description for card two.</p></div></div>
  <div><div><picture><img src="/media/placeholder.png" alt="Card three image"></picture></div><div><h3>Card Three</h3><p>Description for card three.</p></div></div>
</div>`,
    },
    {
      id: 'landing',
      name: 'Landing Page',
      description: 'Full landing page with hero, features, and CTA',
      html: `<h1>Welcome to Our Product</h1>
<p>A compelling tagline that explains the value proposition.</p>
<p><a href="#">Learn More</a></p>
<div class="section-metadata"><div><div>style</div><div>highlight</div></div></div>
<hr>
<div class="columns">
  <div><div><h3>Feature One</h3><p>Explain this great feature.</p></div><div><h3>Feature Two</h3><p>Explain another great feature.</p></div><div><h3>Feature Three</h3><p>And one more for good measure.</p></div></div>
</div>
<hr>
<h2>Ready to get started?</h2>
<p>Join thousands of happy customers today.</p>
<p><a href="#">Sign Up Free</a></p>`,
    },
    {
      id: 'article',
      name: 'Article / Blog Post',
      description: 'Long-form content with heading and body',
      html: `<h1>Article Title</h1>
<p><em>Published on January 1, 2026</em></p>
<h2>Introduction</h2>
<p>Start your article here with an engaging introduction.</p>
<h2>Main Section</h2>
<p>Continue with your main content.</p>
<h2>Conclusion</h2>
<p>Wrap up with key takeaways.</p>`,
    },
    {
      id: 'faq',
      name: 'FAQ Page',
      description: 'Frequently asked questions with accordion',
      html: `<h1>Frequently Asked Questions</h1>
<p>Find answers to common questions below.</p>
<hr>
<div class="accordion">
  <div><div><h3>Question one?</h3></div><div><p>Answer to question one goes here.</p></div></div>
  <div><div><h3>Question two?</h3></div><div><p>Answer to question two goes here.</p></div></div>
  <div><div><h3>Question three?</h3></div><div><p>Answer to question three goes here.</p></div></div>
</div>`,
    },
  ];

  return c.json({ templates });
});

/** GET /api/content/:projectId/suggestions — AI suggestions based on recent actions + value + context */
content.get('/:projectId/suggestions', async (c) => {
  const projectId = c.req.param('projectId');
  const session = c.get('session');

  const { results: recentActions } = await c.env.DB.prepare(
    `SELECT action_type, description, input, created_at FROM action_history
     WHERE user_id = ? AND project_id = ?
     ORDER BY created_at DESC LIMIT 5`,
  )
    .bind(session.userId, projectId)
    .all();

  const suggestions: Array<{ text: string; prompt: string }> = [];

  for (const action of recentActions) {
    const input = JSON.parse((action.input as string) || '{}');
    switch (action.action_type) {
      case 'create_page':
        suggestions.push(
          { text: `Preview ${input.path}`, prompt: `Preview the page at ${input.path}` },
          { text: `Add content to ${input.path}`, prompt: `Add a hero section and some content to ${input.path}` },
        );
        break;
      case 'delete_page':
        suggestions.push(
          { text: 'Create a replacement page', prompt: `Create a new page to replace ${input.path}` },
        );
        break;
      case 'copy_page':
        suggestions.push(
          { text: `Edit the copy at ${input.destination}`, prompt: `Read and suggest edits for ${input.destination}` },
        );
        break;
      case 'move_page':
      case 'rename_page':
        suggestions.push(
          { text: `Check links to ${input.source}`, prompt: `Search for pages that link to ${input.source} — they may need updating` },
        );
        break;
    }
  }

  // Value-based suggestions: pages with low composite scores
  try {
    const { results: lowScorePages } = await c.env.DB.prepare(
      `SELECT path, composite_score FROM value_scores
       WHERE project_id = ? AND composite_score < 0.4 AND composite_score > 0
       ORDER BY composite_score ASC LIMIT 3`,
    ).bind(projectId).all();

    for (const page of lowScorePages) {
      suggestions.push({
        text: `Improve ${page.path}`,
        prompt: `The page ${page.path} has a low value score of ${(page.composite_score as number).toFixed(2)}. Analyze it and suggest improvements.`,
      });
    }
  } catch {
    // Non-fatal
  }

  // CWV-based suggestions: pages with poor performance
  try {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const { results: slowPages } = await c.env.DB.prepare(
      `SELECT path, AVG(lcp_p75) as avg_lcp, AVG(inp_p75) as avg_inp FROM telemetry_daily
       WHERE project_id = ? AND date >= ? AND (lcp_p75 > 2500 OR inp_p75 > 200)
       GROUP BY path LIMIT 2`,
    ).bind(projectId, since).all();

    for (const page of slowPages) {
      const issues: string[] = [];
      if ((page.avg_lcp as number) > 2500) issues.push(`LCP ${Math.round(page.avg_lcp as number)}ms`);
      if ((page.avg_inp as number) > 200) issues.push(`INP ${Math.round(page.avg_inp as number)}ms`);
      suggestions.push({
        text: `Fix performance: ${page.path}`,
        prompt: `The page ${page.path} has performance issues: ${issues.join(', ')}. What can be done to improve it?`,
      });
    }
  } catch {
    // Non-fatal
  }

  // User context-aware: tailor based on expertise
  try {
    const expertiseCtx = await c.env.DB.prepare(
      `SELECT data FROM user_context WHERE user_id = ? AND project_id = ? AND context_type = 'expertise_level'`,
    ).bind(session.userId, projectId).first<{ data: string }>();

    if (!expertiseCtx || expertiseCtx.data === 'beginner') {
      suggestions.push({
        text: 'Explore available blocks',
        prompt: 'Show me the available EDS blocks and what each one is used for.',
      });
    }
  } catch {
    // Non-fatal
  }

  // Deduplicate and limit
  const seen = new Set<string>();
  const unique = suggestions.filter((s) => {
    if (seen.has(s.text)) return false;
    seen.add(s.text);
    return true;
  });

  return c.json({ suggestions: unique.slice(0, 8) });
});

/** POST /api/content/:projectId/preview — trigger EDS preview */
content.post('/:projectId/preview', async (c) => {
  const projectId = c.req.param('projectId');
  const { path } = await c.req.json<{ path: string }>();
  if (!path) return c.json({ error: 'path required' }, 400);

  // Look up project for EDS config
  const project = await c.env.DB.prepare(
    'SELECT da_org, da_repo, github_org, github_repo FROM projects WHERE id = ?',
  )
    .bind(projectId)
    .first<{ da_org: string; da_repo: string; github_org: string; github_repo: string }>();
  if (!project) return c.json({ error: 'project not found' }, 404);

  const org = project.github_org || project.da_org;
  const site = project.github_repo || project.da_repo;

  const response = await fetch(
    `https://admin.hlx.page/preview/${org}/${site}/main${path}`,
    { method: 'POST' },
  );
  if (!response.ok) {
    return c.json({ error: `Preview failed: ${response.status}` }, 502);
  }

  const previewUrl = `https://main--${site}--${org}.aem.page${path}`;
  const session = c.get('session');
  await logAction(c.env.DB, session.userId, projectId, 'preview', `Previewed ${path}`, { path });

  return c.json({ ok: true, url: previewUrl });
});

/** POST /api/content/:projectId/publish — publish to live */
content.post('/:projectId/publish', async (c) => {
  const projectId = c.req.param('projectId');
  const { path } = await c.req.json<{ path: string }>();
  if (!path) return c.json({ error: 'path required' }, 400);

  const project = await c.env.DB.prepare(
    'SELECT da_org, da_repo, github_org, github_repo FROM projects WHERE id = ?',
  )
    .bind(projectId)
    .first<{ da_org: string; da_repo: string; github_org: string; github_repo: string }>();
  if (!project) return c.json({ error: 'project not found' }, 404);

  const org = project.github_org || project.da_org;
  const site = project.github_repo || project.da_repo;

  const response = await fetch(
    `https://admin.hlx.page/live/${org}/${site}/main${path}`,
    { method: 'POST' },
  );
  if (!response.ok) {
    return c.json({ error: `Publish failed: ${response.status}` }, 502);
  }

  const liveUrl = `https://main--${site}--${org}.aem.live${path}`;
  const session = c.get('session');
  await logAction(c.env.DB, session.userId, projectId, 'publish', `Published ${path}`, { path });

  return c.json({ ok: true, url: liveUrl });
});

/** GET /api/content/:projectId/assets?path=/ — list media assets */
content.get('/:projectId/assets', async (c) => {
  const projectId = c.req.param('projectId');
  const path = c.req.query('path') || '/media';
  const client = await getDAClientForProject(c.env, projectId);
  const items = await client.list(path);
  // Filter to only media files
  const mediaExts = ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'mp4', 'pdf'];
  const mediaItems = items.filter((item: { ext?: string }) =>
    item.ext && mediaExts.includes(item.ext.toLowerCase()),
  );
  return c.json({ assets: mediaItems });
});

/** POST /api/content/:projectId/assets — upload media */
content.post('/:projectId/assets', async (c) => {
  const projectId = c.req.param('projectId');
  const formData = await c.req.formData();
  const file = formData.get('file') as File | null;
  const uploadPath = formData.get('path') as string | null;
  if (!file || !uploadPath) return c.json({ error: 'file and path required' }, 400);

  const client = await getDAClientForProject(c.env, projectId);
  const url = await client.uploadMedia(uploadPath, file, file.name);

  const session = c.get('session');
  await logAction(c.env.DB, session.userId, projectId, 'upload_asset', `Uploaded ${file.name} to ${uploadPath}`, { path: uploadPath, name: file.name });

  return c.json({ ok: true, url, path: uploadPath });
});

/** GET /api/content/:projectId/block-library — EDS block catalog */
content.get('/:projectId/block-library', async (c) => {
  const projectId = c.req.param('projectId');
  const blocks = await getBlockLibrary(c.env.DB, projectId);
  return c.json({ blocks });
});

export default content;
