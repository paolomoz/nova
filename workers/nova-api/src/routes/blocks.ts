import { Hono } from 'hono';
import type { Env, SessionData } from '../lib/types.js';
import { getBlockLibrary } from '../lib/blocks.js';
import { generateBlock, iterateBlock, type GeneratedBlock } from '../lib/ai/block-generator.js';
import { GitHubRepoClient } from '../services/github.js';

const blocks = new Hono<{ Bindings: Env; Variables: { session: SessionData } }>();

/** GET /api/blocks/:projectId — list block library (DB + defaults) */
blocks.get('/:projectId', async (c) => {
  const projectId = c.req.param('projectId');
  const library = await getBlockLibrary(c.env.DB, projectId);
  return c.json({ blocks: library });
});

/** GET /api/blocks/:projectId/:blockId — get single block */
blocks.get('/:projectId/:blockId', async (c) => {
  const block = await c.env.DB.prepare(
    'SELECT * FROM block_library WHERE id = ? AND project_id = ?',
  ).bind(c.req.param('blockId'), c.req.param('projectId')).first();

  if (!block) return c.json({ error: 'Block not found' }, 404);

  return c.json({
    block: {
      id: block.id,
      name: block.name,
      category: block.category,
      description: block.description,
      structureHtml: block.structure_html,
      css: block.css,
      js: block.js,
      status: block.status,
      codePath: block.code_path,
      githubBranch: block.github_branch,
      githubPrUrl: block.github_pr_url,
      generativeConfig: block.generative_config ? JSON.parse(block.generative_config as string) : {},
      valueMetadata: block.value_metadata ? JSON.parse(block.value_metadata as string) : {},
    },
  });
});

/** POST /api/blocks/:projectId — add block to library */
blocks.post('/:projectId', async (c) => {
  const projectId = c.req.param('projectId');
  const body = await c.req.json<{
    name: string;
    category?: string;
    description?: string;
    generativeConfig?: object;
    valueMetadata?: object;
    codePath?: string;
  }>();

  if (!body.name) return c.json({ error: 'name required' }, 400);

  const id = crypto.randomUUID();
  await c.env.DB.prepare(
    `INSERT INTO block_library (id, project_id, name, category, description, generative_config, value_metadata, code_path)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    id, projectId, body.name,
    body.category || null,
    body.description || null,
    JSON.stringify(body.generativeConfig || {}),
    JSON.stringify(body.valueMetadata || {}),
    body.codePath || null,
  ).run();

  return c.json({ ok: true, id }, 201);
});

/** PUT /api/blocks/:projectId/:blockId — update block */
blocks.put('/:projectId/:blockId', async (c) => {
  const { projectId, blockId } = c.req.param();
  const body = await c.req.json<{
    name?: string;
    category?: string;
    description?: string;
    structureHtml?: string;
    css?: string;
    js?: string;
    generativeConfig?: object;
    valueMetadata?: object;
  }>();

  const sets: string[] = ['updated_at = datetime(\'now\')'];
  const bindings: unknown[] = [];

  if (body.name !== undefined) { sets.push('name = ?'); bindings.push(body.name); }
  if (body.category !== undefined) { sets.push('category = ?'); bindings.push(body.category); }
  if (body.description !== undefined) { sets.push('description = ?'); bindings.push(body.description); }
  if (body.structureHtml !== undefined) { sets.push('structure_html = ?'); bindings.push(body.structureHtml); }
  if (body.css !== undefined) { sets.push('css = ?'); bindings.push(body.css); }
  if (body.js !== undefined) { sets.push('js = ?'); bindings.push(body.js); }
  if (body.generativeConfig !== undefined) { sets.push('generative_config = ?'); bindings.push(JSON.stringify(body.generativeConfig)); }
  if (body.valueMetadata !== undefined) { sets.push('value_metadata = ?'); bindings.push(JSON.stringify(body.valueMetadata)); }

  bindings.push(blockId, projectId);

  await c.env.DB.prepare(
    `UPDATE block_library SET ${sets.join(', ')} WHERE id = ? AND project_id = ?`,
  ).bind(...bindings).run();

  return c.json({ ok: true });
});

/** DELETE /api/blocks/:projectId/:blockId — delete block */
blocks.delete('/:projectId/:blockId', async (c) => {
  await c.env.DB.prepare(
    'DELETE FROM block_library WHERE id = ? AND project_id = ?',
  ).bind(c.req.param('blockId'), c.req.param('projectId')).run();

  return c.json({ ok: true });
});

/** POST /api/blocks/:projectId/generate — AI generates a new block */
blocks.post('/:projectId/generate', async (c) => {
  const projectId = c.req.param('projectId');
  const { intent } = await c.req.json<{ intent: string }>();

  if (!intent) return c.json({ error: 'intent required' }, 400);

  const library = await getBlockLibrary(c.env.DB, projectId);

  // Get brand profile if available
  const brand = await c.env.DB.prepare(
    'SELECT voice, visual, content_rules, design_tokens FROM brand_profiles WHERE project_id = ? LIMIT 1',
  ).bind(projectId).first();
  const brandProfile = brand ? {
    voice: JSON.parse((brand.voice as string) || '{}'),
    visual: JSON.parse((brand.visual as string) || '{}'),
    contentRules: JSON.parse((brand.content_rules as string) || '{}'),
    designTokens: JSON.parse((brand.design_tokens as string) || '{}'),
  } : null;

  let generated: GeneratedBlock;
  try {
    generated = await generateBlock(intent, library, brandProfile, {
      ANTHROPIC_API_KEY: c.env.ANTHROPIC_API_KEY,
    });
  } catch (err) {
    console.error('Block generation failed:', err);
    return c.json({ error: (err as Error).message || 'Block generation failed' }, 502);
  }

  // Save to DB as draft
  const id = crypto.randomUUID();
  await c.env.DB.prepare(
    `INSERT INTO block_library (id, project_id, name, category, description, structure_html, css, js, status, generative_config)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', '{}')
     ON CONFLICT(project_id, name) DO UPDATE SET
       category = excluded.category,
       description = excluded.description,
       structure_html = excluded.structure_html,
       css = excluded.css,
       js = excluded.js,
       status = 'draft',
       updated_at = datetime('now')`,
  ).bind(
    id, projectId, generated.name, generated.category, generated.description,
    generated.structureHtml, generated.css, generated.js,
  ).run();

  // Get the actual ID (in case of upsert)
  const row = await c.env.DB.prepare(
    'SELECT id FROM block_library WHERE project_id = ? AND name = ?',
  ).bind(projectId, generated.name).first<{ id: string }>();

  // Log action
  await c.env.DB.prepare(
    `INSERT INTO action_history (id, user_id, project_id, action_type, description, input)
     VALUES (?, ?, ?, 'generate_block', ?, ?)`,
  ).bind(
    crypto.randomUUID(),
    c.get('session').userId,
    projectId,
    `Generated block: ${generated.name}`,
    JSON.stringify({ intent }),
  ).run();

  return c.json({ ok: true, id: row?.id || id, block: generated });
});

/** POST /api/blocks/:projectId/:blockId/iterate — iterate on a block with AI */
blocks.post('/:projectId/:blockId/iterate', async (c) => {
  const { projectId, blockId } = c.req.param();
  const { feedback, history } = await c.req.json<{
    feedback: string;
    history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  }>();

  if (!feedback) return c.json({ error: 'feedback required' }, 400);

  const existing = await c.env.DB.prepare(
    'SELECT * FROM block_library WHERE id = ? AND project_id = ?',
  ).bind(blockId, projectId).first();

  if (!existing) return c.json({ error: 'Block not found' }, 404);

  const currentBlock: GeneratedBlock = {
    name: existing.name as string,
    description: (existing.description as string) || '',
    category: (existing.category as string) || 'Content',
    structureHtml: (existing.structure_html as string) || '',
    css: (existing.css as string) || '',
    js: (existing.js as string) || '',
    variants: [],
    previewHtml: '',
  };

  let updated: GeneratedBlock;
  try {
    updated = await iterateBlock(currentBlock, feedback, history || [], {
      ANTHROPIC_API_KEY: c.env.ANTHROPIC_API_KEY,
    });
  } catch (err) {
    console.error('Block iteration failed:', err);
    return c.json({ error: (err as Error).message || 'Block iteration failed' }, 502);
  }

  // Update in DB
  await c.env.DB.prepare(
    `UPDATE block_library SET
       description = ?, structure_html = ?, css = ?, js = ?, updated_at = datetime('now')
     WHERE id = ? AND project_id = ?`,
  ).bind(updated.description, updated.structureHtml, updated.css, updated.js, blockId, projectId).run();

  return c.json({ ok: true, block: updated });
});

/** POST /api/blocks/:projectId/:blockId/commit — commit block to GitHub */
blocks.post('/:projectId/:blockId/commit', async (c) => {
  const { projectId, blockId } = c.req.param();

  const block = await c.env.DB.prepare(
    'SELECT * FROM block_library WHERE id = ? AND project_id = ?',
  ).bind(blockId, projectId).first();

  if (!block) return c.json({ error: 'Block not found' }, 404);

  // Get project GitHub info
  const project = await c.env.DB.prepare(
    'SELECT github_org, github_repo FROM projects WHERE id = ?',
  ).bind(projectId).first<{ github_org: string; github_repo: string }>();

  if (!project?.github_org || !project?.github_repo) {
    return c.json({ error: 'Project has no GitHub repository configured' }, 400);
  }

  const blockName = block.name as string;
  const branchName = `nova/block-${blockName}-${Date.now()}`;
  const github = new GitHubRepoClient(c.env.GITHUB_TOKEN);

  // Create branch
  await github.createBranch(project.github_org, project.github_repo, branchName);

  // Commit block files
  const files = [
    { path: `blocks/${blockName}/${blockName}.css`, content: (block.css as string) || '' },
    { path: `blocks/${blockName}/${blockName}.js`, content: (block.js as string) || '' },
  ];

  const commit = await github.commitFiles(
    project.github_org, project.github_repo, branchName, files,
    `feat(blocks): add ${blockName} block\n\nGenerated by Nova AI`,
  );

  // Create PR
  const pr = await github.createPR(
    project.github_org, project.github_repo,
    branchName, 'main',
    `Add ${blockName} block`,
    `## New Block: ${blockName}\n\n${(block.description as string) || ''}\n\nGenerated by Nova AI block generation pipeline.`,
  );

  // Update block status in DB
  await c.env.DB.prepare(
    `UPDATE block_library SET
       status = 'committed', github_branch = ?, github_pr_url = ?,
       code_path = ?, updated_at = datetime('now')
     WHERE id = ? AND project_id = ?`,
  ).bind(branchName, pr.htmlUrl, `blocks/${blockName}`, blockId, projectId).run();

  return c.json({
    ok: true,
    commit: { sha: commit.sha, branch: branchName },
    pr: { number: pr.number, url: pr.htmlUrl },
  });
});

/** GET /api/blocks/:projectId/:blockId/preview — get preview HTML */
blocks.get('/:projectId/:blockId/preview', async (c) => {
  const block = await c.env.DB.prepare(
    'SELECT name, structure_html, css, js FROM block_library WHERE id = ? AND project_id = ?',
  ).bind(c.req.param('blockId'), c.req.param('projectId')).first();

  if (!block) return c.json({ error: 'Block not found' }, 404);

  const name = block.name as string;
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${name} Preview</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, -apple-system, sans-serif; padding: 2rem; background: #fff; color: #333; }
    img { max-width: 100%; height: auto; }
    ${(block.css as string) || ''}
  </style>
</head>
<body>
  ${(block.structure_html as string) || ''}
  <script type="module">
    ${(block.js as string) || ''}
    const blockEl = document.querySelector('.${name}');
    if (blockEl && typeof decorate !== 'undefined') decorate(blockEl);
  </script>
</body>
</html>`;

  return c.html(html);
});

export default blocks;
