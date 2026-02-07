import { Hono } from 'hono';
import type { Env, SessionData } from '../lib/types.js';

const brand = new Hono<{ Bindings: Env; Variables: { session: SessionData } }>();

/** GET /api/brand/:projectId — list brand profiles */
brand.get('/:projectId', async (c) => {
  const projectId = c.req.param('projectId');
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM brand_profiles WHERE project_id = ?',
  )
    .bind(projectId)
    .all();

  return c.json({
    profiles: (results || []).map((r) => ({
      id: r.id,
      name: r.name,
      voice: JSON.parse((r.voice as string) || '{}'),
      visual: JSON.parse((r.visual as string) || '{}'),
      contentRules: JSON.parse((r.content_rules as string) || '{}'),
      designTokens: JSON.parse((r.design_tokens as string) || '{}'),
      updatedAt: r.updated_at,
    })),
  });
});

/** GET /api/brand/:projectId/:name — get brand profile */
brand.get('/:projectId/:name', async (c) => {
  const projectId = c.req.param('projectId');
  const name = c.req.param('name');
  const profile = await c.env.DB.prepare(
    'SELECT * FROM brand_profiles WHERE project_id = ? AND name = ?',
  )
    .bind(projectId, name)
    .first();
  if (!profile) return c.json({ error: 'Brand profile not found' }, 404);
  return c.json({
    profile: {
      id: profile.id,
      name: profile.name,
      voice: JSON.parse((profile.voice as string) || '{}'),
      visual: JSON.parse((profile.visual as string) || '{}'),
      contentRules: JSON.parse((profile.content_rules as string) || '{}'),
      designTokens: JSON.parse((profile.design_tokens as string) || '{}'),
      updatedAt: profile.updated_at,
    },
  });
});

/** PUT /api/brand/:projectId/:name — create or update brand profile */
brand.put('/:projectId/:name', async (c) => {
  const projectId = c.req.param('projectId');
  const name = c.req.param('name');
  const body = await c.req.json<{
    voice?: object;
    visual?: object;
    contentRules?: object;
    designTokens?: object;
  }>();

  await c.env.DB.prepare(
    `INSERT INTO brand_profiles (id, project_id, name, voice, visual, content_rules, design_tokens)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(project_id, name) DO UPDATE SET
       voice = excluded.voice,
       visual = excluded.visual,
       content_rules = excluded.content_rules,
       design_tokens = excluded.design_tokens,
       updated_at = datetime('now')`,
  )
    .bind(
      crypto.randomUUID(),
      projectId,
      name,
      JSON.stringify(body.voice || {}),
      JSON.stringify(body.visual || {}),
      JSON.stringify(body.contentRules || {}),
      JSON.stringify(body.designTokens || {}),
    )
    .run();

  return c.json({ ok: true });
});

/** DELETE /api/brand/:projectId/:name — delete brand profile */
brand.delete('/:projectId/:name', async (c) => {
  const projectId = c.req.param('projectId');
  const name = c.req.param('name');

  if (name === 'default') return c.json({ error: 'Cannot delete default profile' }, 400);

  await c.env.DB.prepare(
    'DELETE FROM brand_profiles WHERE project_id = ? AND name = ?',
  ).bind(projectId, name).run();

  return c.json({ ok: true });
});

/** POST /api/brand/:projectId/validate-voice — validate text against brand voice */
brand.post('/:projectId/validate-voice', async (c) => {
  const projectId = c.req.param('projectId');
  const { text, profileName } = await c.req.json<{ text: string; profileName?: string }>();

  if (!text) return c.json({ error: 'text required' }, 400);

  const bp = await c.env.DB.prepare(
    'SELECT voice, content_rules FROM brand_profiles WHERE project_id = ? AND name = ?',
  ).bind(projectId, profileName || 'default').first();

  if (!bp) return c.json({ error: 'Brand profile not found' }, 404);

  const voice = JSON.parse((bp.voice as string) || '{}');
  const contentRules = JSON.parse((bp.content_rules as string) || '{}');

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
        content: `Score this text against the brand voice profile. Return JSON only.

Brand Voice Profile:
- Tone: ${voice.tone || 'not specified'}
- Personality: ${voice.personality || 'not specified'}
- Do's: ${JSON.stringify(voice.dos || [])}
- Don'ts: ${JSON.stringify(voice.donts || [])}

Content Rules:
${JSON.stringify(contentRules)}

Text to evaluate:
"""
${text}
"""

Return JSON: {
  "score": <0-100>,
  "issues": [{"severity": "high"|"medium"|"low", "description": "...", "suggestion": "..."}],
  "strengths": ["..."],
  "rewriteSuggestion": "..." or null
}

Respond with ONLY JSON.`,
      }],
    }),
  });

  if (!response.ok) return c.json({ error: 'Validation failed' }, 500);

  const data = (await response.json()) as { content: Array<{ text?: string }> };
  const resultText = data.content[0]?.text || '';
  const jsonStr = resultText.replace(/^```json?\s*/m, '').replace(/\s*```$/m, '').trim();
  const result = JSON.parse(jsonStr);

  return c.json({ ok: true, validation: result });
});

/** POST /api/brand/:projectId/check-visual — check visual compliance */
brand.post('/:projectId/check-visual', async (c) => {
  const projectId = c.req.param('projectId');
  const { css, html, profileName } = await c.req.json<{ css?: string; html?: string; profileName?: string }>();

  const bp = await c.env.DB.prepare(
    'SELECT visual, design_tokens FROM brand_profiles WHERE project_id = ? AND name = ?',
  ).bind(projectId, profileName || 'default').first();

  if (!bp) return c.json({ error: 'Brand profile not found' }, 404);

  const visual = JSON.parse((bp.visual as string) || '{}');
  const designTokens = JSON.parse((bp.design_tokens as string) || '{}');

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
        content: `Check this code against the brand visual guidelines. Return JSON only.

Brand Visual Guidelines:
- Colors: ${JSON.stringify(visual.colors || {})}
- Typography: ${JSON.stringify(visual.typography || {})}
- Spacing: ${JSON.stringify(visual.spacing || {})}

Design Tokens:
${JSON.stringify(designTokens)}

${css ? `CSS:\n\`\`\`css\n${css}\n\`\`\`` : ''}
${html ? `HTML:\n\`\`\`html\n${html}\n\`\`\`` : ''}

Return JSON: {
  "compliant": true|false,
  "score": <0-100>,
  "issues": [{"type": "color"|"typography"|"spacing"|"layout", "severity": "high"|"medium"|"low", "description": "...", "fix": "..."}],
  "suggestions": ["..."]
}

Respond with ONLY JSON.`,
      }],
    }),
  });

  if (!response.ok) return c.json({ error: 'Check failed' }, 500);

  const data = (await response.json()) as { content: Array<{ text?: string }> };
  const resultText = data.content[0]?.text || '';
  const jsonStr = resultText.replace(/^```json?\s*/m, '').replace(/\s*```$/m, '').trim();
  const result = JSON.parse(jsonStr);

  return c.json({ ok: true, check: result });
});

/** POST /api/brand/:projectId/audit — full brand audit across content */
brand.post('/:projectId/audit', async (c) => {
  const projectId = c.req.param('projectId');
  const { profileName } = await c.req.json<{ profileName?: string }>();

  const bp = await c.env.DB.prepare(
    'SELECT voice, visual, content_rules, design_tokens FROM brand_profiles WHERE project_id = ? AND name = ?',
  ).bind(projectId, profileName || 'default').first();

  if (!bp) return c.json({ error: 'Brand profile not found' }, 404);

  // Sample content from content_index
  const { results: pages } = await c.env.DB.prepare(
    'SELECT path, title, body FROM content_index WHERE project_id = ? LIMIT 20',
  ).bind(projectId).all();

  if (!pages || pages.length === 0) return c.json({ ok: true, audit: { score: 100, pages: [], summary: 'No content to audit.' } });

  const voice = JSON.parse((bp.voice as string) || '{}');
  const contentRules = JSON.parse((bp.content_rules as string) || '{}');

  const pageSnippets = pages.map((p) => `### ${p.path}\n${(p.body as string || '').slice(0, 500)}`).join('\n\n');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': c.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: `Audit this website content for brand consistency. Return JSON only.

Brand Voice:
- Tone: ${voice.tone || 'not specified'}
- Personality: ${voice.personality || 'not specified'}
- Do's: ${JSON.stringify(voice.dos || [])}
- Don'ts: ${JSON.stringify(voice.donts || [])}

Content Rules:
${JSON.stringify(contentRules)}

Page Content:
${pageSnippets}

Return JSON: {
  "overallScore": <0-100>,
  "summary": "1-2 sentence overview",
  "pages": [{"path": "...", "score": <0-100>, "issues": ["..."], "suggestions": ["..."]}],
  "trends": ["common issues across pages"],
  "recommendations": ["top priority improvements"]
}

Respond with ONLY JSON.`,
      }],
    }),
  });

  if (!response.ok) return c.json({ error: 'Audit failed' }, 500);

  const data = (await response.json()) as { content: Array<{ text?: string }> };
  const resultText = data.content[0]?.text || '';
  const jsonStr = resultText.replace(/^```json?\s*/m, '').replace(/\s*```$/m, '').trim();
  const result = JSON.parse(jsonStr);

  return c.json({ ok: true, audit: result });
});

export default brand;
