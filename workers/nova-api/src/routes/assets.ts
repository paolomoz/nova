import { Hono } from 'hono';
import type { Env, SessionData } from '../lib/types.js';

const assets = new Hono<{ Bindings: Env; Variables: { session: SessionData } }>();

/** GET /api/assets/:projectId/list — list assets */
assets.get('/:projectId/list', async (c) => {
  const projectId = c.req.param('projectId');
  const path = c.req.query('path') || '/';
  const search = c.req.query('search');

  let query: string;
  const bindings: unknown[] = [projectId];

  if (search) {
    query = `SELECT * FROM assets WHERE project_id = ? AND (
      name LIKE ? OR alt_text LIKE ? OR tags LIKE ?
    ) ORDER BY updated_at DESC LIMIT 100`;
    const pattern = `%${search}%`;
    bindings.push(pattern, pattern, pattern);
  } else {
    query = `SELECT * FROM assets WHERE project_id = ? AND path LIKE ? ORDER BY name LIMIT 200`;
    bindings.push(path === '/' ? '%' : `${path}%`);
  }

  const { results } = await c.env.DB.prepare(query).bind(...bindings).all();

  return c.json({
    assets: (results || []).map((r) => ({
      id: r.id,
      path: r.path,
      name: r.name,
      mimeType: r.mime_type,
      size: r.size,
      width: r.width,
      height: r.height,
      altText: r.alt_text,
      tags: r.tags ? JSON.parse(r.tags as string) : [],
      colorPalette: r.color_palette ? JSON.parse(r.color_palette as string) : [],
      updatedAt: r.updated_at,
    })),
  });
});

/** POST /api/assets/:projectId/upload — upload asset to R2 */
assets.post('/:projectId/upload', async (c) => {
  const projectId = c.req.param('projectId');
  const formData = await c.req.formData();
  const file = formData.get('file') as File | null;
  const path = formData.get('path') as string || '/media';

  if (!file) return c.json({ error: 'file required' }, 400);
  if (!c.env.ASSETS) return c.json({ error: 'R2 storage not configured' }, 503);

  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  const r2Key = `${projectId}${path}/${file.name}`;
  const fullPath = `${path}/${file.name}`;

  // Upload to R2
  await c.env.ASSETS.put(r2Key, file.stream(), {
    httpMetadata: { contentType: file.type },
    customMetadata: { projectId, originalName: file.name },
  });

  // Auto-generate alt text and tags for images
  let altText = '';
  let tags: string[] = [];
  let width: number | null = null;
  let height: number | null = null;

  if (file.type.startsWith('image/')) {
    // Extract image dimensions and generate metadata via Claude
    try {
      const { alt, autoTags } = await generateImageMetadata(file.name, file.type, c.env.ANTHROPIC_API_KEY);
      altText = alt;
      tags = autoTags;
    } catch { /* non-fatal */ }
  }

  // Save metadata to D1
  const id = crypto.randomUUID();
  await c.env.DB.prepare(
    `INSERT INTO assets (id, project_id, path, name, mime_type, size, width, height, alt_text, tags, r2_key, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(project_id, path) DO UPDATE SET
       mime_type = excluded.mime_type, size = excluded.size,
       alt_text = excluded.alt_text, tags = excluded.tags,
       r2_key = excluded.r2_key, updated_at = datetime('now')`,
  ).bind(
    id, projectId, fullPath, file.name, file.type, file.size,
    width, height, altText, JSON.stringify(tags), r2Key,
    c.get('session').userId,
  ).run();

  return c.json({
    ok: true,
    asset: { id, path: fullPath, name: file.name, mimeType: file.type, altText, tags },
  });
});

/** GET /api/assets/:projectId/file — serve asset from R2 */
assets.get('/:projectId/file', async (c) => {
  const projectId = c.req.param('projectId');
  const path = c.req.query('path');
  if (!path) return c.json({ error: 'path required' }, 400);

  const r2Key = `${projectId}${path}`;
  if (!c.env.ASSETS) return c.json({ error: 'R2 storage not configured' }, 503);
  const object = await c.env.ASSETS.get(r2Key);

  if (!object) return c.json({ error: 'Asset not found' }, 404);

  return new Response(object.body, {
    headers: {
      'Content-Type': object.httpMetadata?.contentType || 'application/octet-stream',
      'Cache-Control': 'public, max-age=31536000',
    },
  });
});

/** PUT /api/assets/:projectId/:assetId — update asset metadata */
assets.put('/:projectId/:assetId', async (c) => {
  const { projectId, assetId } = c.req.param();
  const body = await c.req.json<{
    altText?: string;
    tags?: string[];
  }>();

  const sets: string[] = ['updated_at = datetime(\'now\')'];
  const bindings: unknown[] = [];

  if (body.altText !== undefined) { sets.push('alt_text = ?'); bindings.push(body.altText); }
  if (body.tags !== undefined) { sets.push('tags = ?'); bindings.push(JSON.stringify(body.tags)); }

  bindings.push(assetId, projectId);

  await c.env.DB.prepare(
    `UPDATE assets SET ${sets.join(', ')} WHERE id = ? AND project_id = ?`,
  ).bind(...bindings).run();

  return c.json({ ok: true });
});

/** DELETE /api/assets/:projectId/:assetId — delete asset */
assets.delete('/:projectId/:assetId', async (c) => {
  const { projectId, assetId } = c.req.param();

  // Get R2 key before deleting
  const asset = await c.env.DB.prepare(
    'SELECT r2_key FROM assets WHERE id = ? AND project_id = ?',
  ).bind(assetId, projectId).first<{ r2_key: string }>();

  if (asset?.r2_key && c.env.ASSETS) {
    await c.env.ASSETS.delete(asset.r2_key);
  }

  await c.env.DB.prepare(
    'DELETE FROM assets WHERE id = ? AND project_id = ?',
  ).bind(assetId, projectId).run();

  return c.json({ ok: true });
});

/** POST /api/assets/:projectId/generate — AI image generation */
assets.post('/:projectId/generate', async (c) => {
  const projectId = c.req.param('projectId');
  const { prompt, style } = await c.req.json<{ prompt: string; style?: string }>();

  if (!prompt) return c.json({ error: 'prompt required' }, 400);

  // Use Claude to refine the prompt, then describe what would be generated
  // In production, this would call an image generation API (Gemini, DALL-E, etc.)
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': c.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `Refine this image generation prompt for a website asset. Style: ${style || 'professional, modern'}.

Original prompt: "${prompt}"

Return JSON: { "refinedPrompt": "...", "suggestedAltText": "...", "suggestedTags": ["tag1", "tag2"], "suggestedFileName": "..." }

Respond with ONLY JSON.`,
      }],
    }),
  });

  if (!response.ok) return c.json({ error: 'Failed to process prompt' }, 500);

  const data = (await response.json()) as { content: Array<{ text?: string }> };
  const text = data.content[0]?.text || '';
  const jsonStr = text.replace(/^```json?\s*/m, '').replace(/\s*```$/m, '').trim();
  const result = JSON.parse(jsonStr);

  return c.json({
    ok: true,
    generation: {
      refinedPrompt: result.refinedPrompt,
      suggestedAltText: result.suggestedAltText,
      suggestedTags: result.suggestedTags,
      suggestedFileName: result.suggestedFileName,
      note: 'Image generation API integration pending — prompt has been refined',
    },
  });
});

/** Helper: generate image metadata using Claude */
async function generateImageMetadata(
  fileName: string,
  mimeType: string,
  anthropicApiKey: string,
): Promise<{ alt: string; autoTags: string[] }> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': anthropicApiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 256,
      messages: [{
        role: 'user',
        content: `Generate alt text and tags for an image named "${fileName}" (type: ${mimeType}).
Return JSON: { "alt": "descriptive alt text", "tags": ["tag1", "tag2", "tag3"] }
Respond with ONLY JSON.`,
      }],
    }),
  });

  if (!response.ok) return { alt: fileName.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '), autoTags: [] };

  const data = (await response.json()) as { content: Array<{ text?: string }> };
  const text = data.content[0]?.text || '';
  const jsonStr = text.replace(/^```json?\s*/m, '').replace(/\s*```$/m, '').trim();
  const result = JSON.parse(jsonStr);
  return { alt: result.alt || '', autoTags: result.tags || [] };
}

export default assets;
