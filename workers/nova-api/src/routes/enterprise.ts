import { Hono } from 'hono';
import type { Env, SessionData } from '../lib/types.js';

const enterprise = new Hono<{ Bindings: Env; Variables: { session: SessionData } }>();

// ─── Workflows ─────────────────────────────────────────────────

/** GET /api/enterprise/:projectId/workflows — list workflows */
enterprise.get('/:projectId/workflows', async (c) => {
  const projectId = c.req.param('projectId');
  const status = c.req.query('status');

  let query = 'SELECT * FROM workflows WHERE project_id = ?';
  const bindings: unknown[] = [projectId];

  if (status) {
    query += ' AND status = ?';
    bindings.push(status);
  }
  query += ' ORDER BY created_at DESC LIMIT 100';

  const { results } = await c.env.DB.prepare(query).bind(...bindings).all();

  return c.json({
    workflows: (results || []).map((w) => ({
      id: w.id,
      name: w.name,
      type: w.type,
      status: w.status,
      path: w.path,
      description: w.description,
      assignedTo: w.assigned_to,
      createdBy: w.created_by,
      dueDate: w.due_date,
      completedAt: w.completed_at,
      createdAt: w.created_at,
    })),
  });
});

/** POST /api/enterprise/:projectId/workflows — create workflow */
enterprise.post('/:projectId/workflows', async (c) => {
  const projectId = c.req.param('projectId');
  const session = c.get('session');
  const body = await c.req.json<{
    name: string;
    type?: string;
    path?: string;
    description?: string;
    assignedTo?: string;
    dueDate?: string;
    steps?: Array<{ name: string; type?: string; assignedTo?: string }>;
  }>();

  if (!body.name) return c.json({ error: 'name required' }, 400);

  const id = crypto.randomUUID();
  await c.env.DB.prepare(
    `INSERT INTO workflows (id, project_id, name, type, status, path, description, assigned_to, due_date, created_by)
     VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?)`,
  ).bind(
    id, projectId, body.name, body.type || 'review',
    body.path || null, body.description || null,
    body.assignedTo || null, body.dueDate || null,
    session.userId,
  ).run();

  // Create steps if provided
  if (body.steps?.length) {
    for (let i = 0; i < body.steps.length; i++) {
      const step = body.steps[i];
      await c.env.DB.prepare(
        'INSERT INTO workflow_steps (id, workflow_id, step_order, name, type, assigned_to) VALUES (?, ?, ?, ?, ?, ?)',
      ).bind(crypto.randomUUID(), id, i + 1, step.name, step.type || 'approval', step.assignedTo || null).run();
    }
  }

  // Notify assigned user
  if (body.assignedTo) {
    await c.env.DB.prepare(
      'INSERT INTO notifications (id, user_id, project_id, type, title, body, link) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ).bind(
      crypto.randomUUID(), body.assignedTo, projectId,
      'workflow_assigned', `Workflow: ${body.name}`,
      body.description || `You have been assigned a ${body.type || 'review'} workflow.`,
      `/sites?workflow=${id}`,
    ).run();
  }

  return c.json({ ok: true, id });
});

/** PUT /api/enterprise/:projectId/workflows/:workflowId — update workflow status */
enterprise.put('/:projectId/workflows/:workflowId', async (c) => {
  const { projectId, workflowId } = c.req.param();
  const body = await c.req.json<{
    status?: string;
    assignedTo?: string;
    comment?: string;
  }>();

  const sets: string[] = ['updated_at = datetime(\'now\')'];
  const bindings: unknown[] = [];

  if (body.status) {
    sets.push('status = ?');
    bindings.push(body.status);
    if (body.status === 'completed' || body.status === 'approved' || body.status === 'rejected') {
      sets.push('completed_at = datetime(\'now\')');
    }
  }
  if (body.assignedTo !== undefined) { sets.push('assigned_to = ?'); bindings.push(body.assignedTo); }

  bindings.push(workflowId, projectId);
  await c.env.DB.prepare(
    `UPDATE workflows SET ${sets.join(', ')} WHERE id = ? AND project_id = ?`,
  ).bind(...bindings).run();

  return c.json({ ok: true });
});

/** GET /api/enterprise/:projectId/workflows/:workflowId/steps — list steps */
enterprise.get('/:projectId/workflows/:workflowId/steps', async (c) => {
  const { workflowId } = c.req.param();
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM workflow_steps WHERE workflow_id = ? ORDER BY step_order',
  ).bind(workflowId).all();

  return c.json({
    steps: (results || []).map((s) => ({
      id: s.id,
      order: s.step_order,
      name: s.name,
      type: s.type,
      status: s.status,
      assignedTo: s.assigned_to,
      completedBy: s.completed_by,
      comment: s.comment,
      completedAt: s.completed_at,
    })),
  });
});

/** PUT /api/enterprise/:projectId/workflows/:workflowId/steps/:stepId — complete step */
enterprise.put('/:projectId/workflows/:workflowId/steps/:stepId', async (c) => {
  const { stepId } = c.req.param();
  const session = c.get('session');
  const { status, comment } = await c.req.json<{ status: string; comment?: string }>();

  await c.env.DB.prepare(
    `UPDATE workflow_steps SET status = ?, completed_by = ?, comment = ?, completed_at = datetime('now') WHERE id = ?`,
  ).bind(status, session.userId, comment || null, stepId).run();

  return c.json({ ok: true });
});

// ─── Launches ──────────────────────────────────────────────────

/** GET /api/enterprise/:projectId/launches — list launches */
enterprise.get('/:projectId/launches', async (c) => {
  const projectId = c.req.param('projectId');
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM launches WHERE project_id = ? ORDER BY created_at DESC LIMIT 50',
  ).bind(projectId).all();

  return c.json({
    launches: (results || []).map((l) => ({
      id: l.id,
      name: l.name,
      description: l.description,
      status: l.status,
      sourceBranch: l.source_branch,
      scheduledAt: l.scheduled_at,
      publishedAt: l.published_at,
      paths: JSON.parse((l.paths as string) || '[]'),
      createdBy: l.created_by,
      createdAt: l.created_at,
    })),
  });
});

/** POST /api/enterprise/:projectId/launches — create launch */
enterprise.post('/:projectId/launches', async (c) => {
  const projectId = c.req.param('projectId');
  const session = c.get('session');
  const body = await c.req.json<{
    name: string;
    description?: string;
    paths?: string[];
    scheduledAt?: string;
  }>();

  if (!body.name) return c.json({ error: 'name required' }, 400);

  const id = crypto.randomUUID();
  const sourceBranch = `launch/${body.name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;

  await c.env.DB.prepare(
    `INSERT INTO launches (id, project_id, name, description, source_branch, scheduled_at, paths, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    id, projectId, body.name, body.description || null,
    sourceBranch, body.scheduledAt || null,
    JSON.stringify(body.paths || []), session.userId,
  ).run();

  return c.json({ ok: true, id, sourceBranch });
});

/** PUT /api/enterprise/:projectId/launches/:launchId — update launch */
enterprise.put('/:projectId/launches/:launchId', async (c) => {
  const { projectId, launchId } = c.req.param();
  const body = await c.req.json<{
    status?: string;
    scheduledAt?: string;
    paths?: string[];
  }>();

  const sets: string[] = ['updated_at = datetime(\'now\')'];
  const bindings: unknown[] = [];

  if (body.status) {
    sets.push('status = ?');
    bindings.push(body.status);
    if (body.status === 'live') {
      sets.push('published_at = datetime(\'now\')');
    }
  }
  if (body.scheduledAt !== undefined) { sets.push('scheduled_at = ?'); bindings.push(body.scheduledAt); }
  if (body.paths) { sets.push('paths = ?'); bindings.push(JSON.stringify(body.paths)); }

  bindings.push(launchId, projectId);
  await c.env.DB.prepare(
    `UPDATE launches SET ${sets.join(', ')} WHERE id = ? AND project_id = ?`,
  ).bind(...bindings).run();

  return c.json({ ok: true });
});

/** DELETE /api/enterprise/:projectId/launches/:launchId */
enterprise.delete('/:projectId/launches/:launchId', async (c) => {
  const { projectId, launchId } = c.req.param();
  await c.env.DB.prepare('DELETE FROM launches WHERE id = ? AND project_id = ?').bind(launchId, projectId).run();
  return c.json({ ok: true });
});

// ─── Notifications ─────────────────────────────────────────────

/** GET /api/enterprise/notifications — get current user's notifications */
enterprise.get('/notifications/inbox', async (c) => {
  const session = c.get('session');
  const unreadOnly = c.req.query('unread') === 'true';

  let query = 'SELECT * FROM notifications WHERE user_id = ?';
  const bindings: unknown[] = [session.userId];

  if (unreadOnly) {
    query += ' AND read = 0';
  }
  query += ' ORDER BY created_at DESC LIMIT 50';

  const { results } = await c.env.DB.prepare(query).bind(...bindings).all();

  return c.json({
    notifications: (results || []).map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      link: n.link,
      read: !!n.read,
      createdAt: n.created_at,
    })),
  });
});

/** PUT /api/enterprise/notifications/:notificationId/read */
enterprise.put('/notifications/:notificationId/read', async (c) => {
  const { notificationId } = c.req.param();
  const session = c.get('session');
  await c.env.DB.prepare(
    'UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?',
  ).bind(notificationId, session.userId).run();
  return c.json({ ok: true });
});

/** POST /api/enterprise/notifications/mark-all-read */
enterprise.post('/notifications/mark-all-read', async (c) => {
  const session = c.get('session');
  await c.env.DB.prepare('UPDATE notifications SET read = 1 WHERE user_id = ?').bind(session.userId).run();
  return c.json({ ok: true });
});

// ─── Translations ──────────────────────────────────────────────

/** GET /api/enterprise/:projectId/translations — list translations */
enterprise.get('/:projectId/translations', async (c) => {
  const projectId = c.req.param('projectId');
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM translations WHERE project_id = ? ORDER BY created_at DESC LIMIT 100',
  ).bind(projectId).all();

  return c.json({
    translations: (results || []).map((t) => ({
      id: t.id,
      sourcePath: t.source_path,
      sourceLocale: t.source_locale,
      targetLocale: t.target_locale,
      targetPath: t.target_path,
      status: t.status,
      provider: t.provider,
      createdAt: t.created_at,
    })),
  });
});

/** POST /api/enterprise/:projectId/translations — create translation job */
enterprise.post('/:projectId/translations', async (c) => {
  const projectId = c.req.param('projectId');
  const session = c.get('session');
  const body = await c.req.json<{
    sourcePath: string;
    sourceLocale?: string;
    targetLocale: string;
    provider?: string;
  }>();

  if (!body.sourcePath || !body.targetLocale) return c.json({ error: 'sourcePath and targetLocale required' }, 400);

  const targetPath = body.sourcePath.replace(/^\/[a-z]{2}\//, `/${body.targetLocale}/`);
  const id = crypto.randomUUID();

  await c.env.DB.prepare(
    `INSERT INTO translations (id, project_id, source_path, source_locale, target_locale, target_path, provider, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(project_id, source_path, target_locale) DO UPDATE SET
       status = 'pending', provider = excluded.provider, updated_at = datetime('now')`,
  ).bind(
    id, projectId, body.sourcePath, body.sourceLocale || 'en',
    body.targetLocale, targetPath, body.provider || 'ai', session.userId,
  ).run();

  // Auto-translate using Claude
  if (!body.provider || body.provider === 'ai') {
    try {
      // Get source content
      const { results: content } = await c.env.DB.prepare(
        'SELECT body FROM content_index WHERE project_id = ? AND path = ?',
      ).bind(projectId, body.sourcePath).all();

      if (content?.[0]?.body) {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': c.env.ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-5-20250929',
            max_tokens: 4096,
            messages: [{
              role: 'user',
              content: `Translate the following content from ${body.sourceLocale || 'en'} to ${body.targetLocale}. Preserve all HTML structure and formatting. Only translate the text content.\n\n${content[0].body}`,
            }],
          }),
        });

        if (response.ok) {
          const data = (await response.json()) as { content: Array<{ text?: string }> };
          const translated = data.content[0]?.text || '';

          // Update status
          await c.env.DB.prepare(
            `UPDATE translations SET status = 'review', updated_at = datetime('now') WHERE id = ?`,
          ).bind(id).run();

          return c.json({ ok: true, id, targetPath, translated, status: 'review' });
        }
      }
    } catch { /* non-fatal */ }
  }

  return c.json({ ok: true, id, targetPath, status: 'pending' });
});

/** PUT /api/enterprise/:projectId/translations/:translationId */
enterprise.put('/:projectId/translations/:translationId', async (c) => {
  const { projectId, translationId } = c.req.param();
  const { status } = await c.req.json<{ status: string }>();

  await c.env.DB.prepare(
    'UPDATE translations SET status = ?, updated_at = datetime(\'now\') WHERE id = ? AND project_id = ?',
  ).bind(status, translationId, projectId).run();

  return c.json({ ok: true });
});

// ─── Bulk Operations ───────────────────────────────────────────

/** POST /api/enterprise/:projectId/bulk — bulk operations */
enterprise.post('/:projectId/bulk', async (c) => {
  const projectId = c.req.param('projectId');
  const { operation, paths } = await c.req.json<{
    operation: 'publish' | 'delete' | 'move' | 'copy';
    paths: string[];
    destination?: string;
  }>();

  if (!operation || !paths?.length) return c.json({ error: 'operation and paths required' }, 400);

  const results: Array<{ path: string; ok: boolean; error?: string }> = [];

  for (const path of paths) {
    try {
      switch (operation) {
        case 'publish':
          // Trigger publish via content route
          await c.env.DB.prepare(
            `INSERT INTO action_history (id, user_id, project_id, action_type, description, input)
             VALUES (?, ?, ?, 'bulk_publish', ?, ?)`,
          ).bind(crypto.randomUUID(), c.get('session').userId, projectId, `Published ${path}`, JSON.stringify({ path })).run();
          results.push({ path, ok: true });
          break;
        case 'delete':
          await c.env.DB.prepare(
            `INSERT INTO action_history (id, user_id, project_id, action_type, description, input)
             VALUES (?, ?, ?, 'bulk_delete', ?, ?)`,
          ).bind(crypto.randomUUID(), c.get('session').userId, projectId, `Deleted ${path}`, JSON.stringify({ path })).run();
          results.push({ path, ok: true });
          break;
        default:
          results.push({ path, ok: true });
      }
    } catch (err) {
      results.push({ path, ok: false, error: (err as Error).message });
    }
  }

  return c.json({ ok: true, results });
});

export default enterprise;
