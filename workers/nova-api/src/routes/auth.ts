import { Hono } from 'hono';
import type { Env } from '../lib/types.js';
import { getGitHubAuthUrl, exchangeGitHubCode, getGitHubUser } from '../services/github.js';
import { getIMSAuthUrl, exchangeIMSCode, getIMSProfile, getIMSOrganizations } from '../services/ims.js';

const auth = new Hono<{ Bindings: Env }>();

/** GET /api/auth/github — redirect to GitHub OAuth */
auth.get('/github', (c) => {
  const state = crypto.randomUUID();
  const url = getGitHubAuthUrl(c.env.GITHUB_CLIENT_ID, state);
  return c.redirect(url);
});

/** POST /api/auth/github/callback — exchange code for session */
auth.post('/github/callback', async (c) => {
  const { code } = await c.req.json<{ code: string }>();
  if (!code) {
    return c.json({ error: 'Missing code' }, 400);
  }

  // Exchange code for GitHub access token
  const accessToken = await exchangeGitHubCode(
    c.env.GITHUB_CLIENT_ID,
    c.env.GITHUB_CLIENT_SECRET,
    code,
  );

  // Fetch GitHub user profile
  const ghUser = await getGitHubUser(accessToken);
  if (!ghUser.email) {
    return c.json({ error: 'Could not retrieve email from GitHub' }, 400);
  }

  // Upsert user
  const userId = crypto.randomUUID();
  await c.env.DB.prepare(
    `INSERT INTO users (id, github_id, email, name, avatar_url)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(github_id) DO UPDATE SET
       email = excluded.email,
       name = excluded.name,
       avatar_url = excluded.avatar_url,
       updated_at = datetime('now')`,
  )
    .bind(userId, String(ghUser.id), ghUser.email, ghUser.name || ghUser.login, ghUser.avatar_url)
    .run();

  // Get actual user ID (may be existing)
  const user = await c.env.DB.prepare('SELECT id FROM users WHERE github_id = ?')
    .bind(String(ghUser.id))
    .first<{ id: string }>();
  const actualUserId = user!.id;

  // Ensure org exists (auto-create personal org from GitHub login)
  const orgSlug = ghUser.login.toLowerCase();
  const orgId = crypto.randomUUID();
  await c.env.DB.prepare(
    `INSERT INTO orgs (id, name, slug, github_org)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(slug) DO NOTHING`,
  )
    .bind(orgId, ghUser.login, orgSlug, ghUser.login)
    .run();

  const org = await c.env.DB.prepare('SELECT id FROM orgs WHERE slug = ?')
    .bind(orgSlug)
    .first<{ id: string }>();
  const actualOrgId = org!.id;

  // Ensure membership
  await c.env.DB.prepare(
    `INSERT INTO org_members (org_id, user_id, role)
     VALUES (?, ?, 'admin')
     ON CONFLICT(org_id, user_id) DO NOTHING`,
  )
    .bind(actualOrgId, actualUserId)
    .run();

  // Create session
  const sessionToken = crypto.randomUUID();
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(sessionToken));
  const tokenHash = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days

  await c.env.DB.prepare(
    'INSERT INTO sessions (id, user_id, org_id, token_hash, expires_at) VALUES (?, ?, ?, ?, ?)',
  )
    .bind(sessionId, actualUserId, actualOrgId, tokenHash, expiresAt)
    .run();

  // Set cookie + return user info
  const cookie = `nova_session=${sessionToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}`;

  return c.json(
    {
      user: {
        id: actualUserId,
        email: ghUser.email,
        name: ghUser.name || ghUser.login,
        avatarUrl: ghUser.avatar_url,
      },
      org: { id: actualOrgId, slug: orgSlug },
    },
    200,
    { 'Set-Cookie': cookie },
  );
});

/** GET /api/auth/ims — redirect to Adobe IMS OAuth */
auth.get('/ims', (c) => {
  const state = crypto.randomUUID();
  const url = getIMSAuthUrl(c.env.IMS_CLIENT_ID, c.env.IMS_REDIRECT_URI, state);
  return c.redirect(url);
});

/** POST /api/auth/ims/callback — exchange IMS code for session */
auth.post('/ims/callback', async (c) => {
  const { code } = await c.req.json<{ code: string }>();
  if (!code) return c.json({ error: 'Missing code' }, 400);

  const tokens = await exchangeIMSCode(
    c.env.IMS_CLIENT_ID, c.env.IMS_CLIENT_SECRET, code, c.env.IMS_REDIRECT_URI,
  );

  const imsUser = await getIMSProfile(tokens.access_token);
  const imsOrgs = await getIMSOrganizations(tokens.access_token);

  // Upsert user
  const userId = crypto.randomUUID();
  await c.env.DB.prepare(
    `INSERT INTO users (id, ims_id, email, name, avatar_url)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(ims_id) DO UPDATE SET
       email = excluded.email, name = excluded.name,
       avatar_url = excluded.avatar_url, updated_at = datetime('now')`,
  ).bind(userId, imsUser.userId, imsUser.email, imsUser.displayName, imsUser.avatarUrl).run();

  const user = await c.env.DB.prepare('SELECT id FROM users WHERE ims_id = ?')
    .bind(imsUser.userId).first<{ id: string }>();
  const actualUserId = user!.id;

  // Sync IMS organizations
  let primaryOrgId = '';
  for (const imsOrg of imsOrgs) {
    const orgId = crypto.randomUUID();
    await c.env.DB.prepare(
      `INSERT INTO orgs (id, name, slug, settings)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(slug) DO UPDATE SET name = excluded.name, updated_at = datetime('now')`,
    ).bind(orgId, imsOrg.orgName, imsOrg.orgId.toLowerCase(), JSON.stringify({ imsOrgId: imsOrg.orgId, orgType: imsOrg.orgType })).run();

    const org = await c.env.DB.prepare('SELECT id FROM orgs WHERE slug = ?')
      .bind(imsOrg.orgId.toLowerCase()).first<{ id: string }>();
    if (!primaryOrgId) primaryOrgId = org!.id;

    await c.env.DB.prepare(
      'INSERT INTO org_members (org_id, user_id, role) VALUES (?, ?, ?) ON CONFLICT(org_id, user_id) DO NOTHING',
    ).bind(org!.id, actualUserId, 'author').run();
  }

  // Fallback to personal org if no IMS orgs
  if (!primaryOrgId) {
    const orgSlug = imsUser.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '-');
    const orgId = crypto.randomUUID();
    await c.env.DB.prepare(
      'INSERT INTO orgs (id, name, slug) VALUES (?, ?, ?) ON CONFLICT(slug) DO NOTHING',
    ).bind(orgId, imsUser.displayName, orgSlug).run();

    const org = await c.env.DB.prepare('SELECT id FROM orgs WHERE slug = ?')
      .bind(orgSlug).first<{ id: string }>();
    primaryOrgId = org!.id;

    await c.env.DB.prepare(
      'INSERT INTO org_members (org_id, user_id, role) VALUES (?, ?, ?) ON CONFLICT(org_id, user_id) DO NOTHING',
    ).bind(primaryOrgId, actualUserId, 'admin').run();
  }

  // Create session
  const sessionToken = crypto.randomUUID();
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(sessionToken));
  const tokenHash = Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, '0')).join('');

  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  await c.env.DB.prepare(
    'INSERT INTO sessions (id, user_id, org_id, token_hash, expires_at) VALUES (?, ?, ?, ?, ?)',
  ).bind(sessionId, actualUserId, primaryOrgId, tokenHash, expiresAt).run();

  const cookie = `nova_session=${sessionToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}`;

  return c.json({
    user: { id: actualUserId, email: imsUser.email, name: imsUser.displayName, avatarUrl: imsUser.avatarUrl },
    org: { id: primaryOrgId },
    orgs: imsOrgs.map((o) => ({ orgId: o.orgId, name: o.orgName })),
  }, 200, { 'Set-Cookie': cookie });
});

/** POST /api/auth/switch-org — switch active organization */
auth.post('/switch-org', async (c) => {
  const cookie = c.req.header('cookie') || '';
  const match = cookie.match(/nova_session=([^;]+)/);
  const token = match?.[1];
  if (!token) return c.json({ error: 'Unauthorized' }, 401);

  const { orgId } = await c.req.json<{ orgId: string }>();
  if (!orgId) return c.json({ error: 'orgId required' }, 400);

  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(token));
  const tokenHash = Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, '0')).join('');

  // Verify user is a member of the target org
  const session = await c.env.DB.prepare('SELECT user_id FROM sessions WHERE token_hash = ?').bind(tokenHash).first<{ user_id: string }>();
  if (!session) return c.json({ error: 'Invalid session' }, 401);

  const membership = await c.env.DB.prepare(
    'SELECT 1 FROM org_members WHERE org_id = ? AND user_id = ?',
  ).bind(orgId, session.user_id).first();
  if (!membership) return c.json({ error: 'Not a member of this org' }, 403);

  // Update session org
  await c.env.DB.prepare('UPDATE sessions SET org_id = ? WHERE token_hash = ?').bind(orgId, tokenHash).run();

  return c.json({ ok: true });
});

/** GET /api/auth/orgs — list user's organizations */
auth.get('/orgs', async (c) => {
  const cookie = c.req.header('cookie') || '';
  const match = cookie.match(/nova_session=([^;]+)/);
  const token = match?.[1] || c.req.header('authorization')?.replace('Bearer ', '');
  if (!token) return c.json({ error: 'Unauthorized' }, 401);

  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(token));
  const tokenHash = Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, '0')).join('');

  const session = await c.env.DB.prepare('SELECT user_id FROM sessions WHERE token_hash = ?').bind(tokenHash).first<{ user_id: string }>();
  if (!session) return c.json({ error: 'Unauthorized' }, 401);

  const { results } = await c.env.DB.prepare(
    `SELECT o.id, o.name, o.slug, om.role FROM orgs o
     JOIN org_members om ON om.org_id = o.id
     WHERE om.user_id = ?`,
  ).bind(session.user_id).all();

  return c.json({
    orgs: (results || []).map((r) => ({
      id: r.id, name: r.name, slug: r.slug, role: r.role,
    })),
  });
});

/** PUT /api/auth/preferences — update user preferences */
auth.put('/preferences', async (c) => {
  const cookie = c.req.header('cookie') || '';
  const match = cookie.match(/nova_session=([^;]+)/);
  const token = match?.[1];
  if (!token) return c.json({ error: 'Unauthorized' }, 401);

  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(token));
  const tokenHash = Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, '0')).join('');

  const session = await c.env.DB.prepare('SELECT user_id FROM sessions WHERE token_hash = ?').bind(tokenHash).first<{ user_id: string }>();
  if (!session) return c.json({ error: 'Unauthorized' }, 401);

  const preferences = await c.req.json();
  await c.env.DB.prepare('UPDATE users SET preferences = ?, updated_at = datetime(\'now\') WHERE id = ?')
    .bind(JSON.stringify(preferences), session.user_id).run();

  return c.json({ ok: true });
});

/** POST /api/auth/logout — destroy session */
auth.post('/logout', async (c) => {
  const cookie = c.req.header('cookie') || '';
  const match = cookie.match(/nova_session=([^;]+)/);
  const token = match?.[1];

  if (token) {
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(token));
    const tokenHash = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    await c.env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(tokenHash).run();
  }

  return c.json({ ok: true }, 200, {
    'Set-Cookie': 'nova_session=; Path=/; HttpOnly; Max-Age=0',
  });
});

/** GET /api/auth/me — get current user */
auth.get('/me', async (c) => {
  // Quick check without full middleware (allows unauthenticated 401)
  const cookie = c.req.header('cookie') || '';
  const match = cookie.match(/nova_session=([^;]+)/);
  const token = match?.[1] || c.req.header('authorization')?.replace('Bearer ', '');

  if (!token) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(token));
  const tokenHash = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  const row = await c.env.DB.prepare(
    `SELECT u.id, u.email, u.name, u.avatar_url, u.preferences,
            s.org_id, o.slug as org_slug, o.name as org_name
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     JOIN orgs o ON o.id = s.org_id
     WHERE s.token_hash = ? AND s.expires_at > datetime('now')`,
  )
    .bind(tokenHash)
    .first();

  if (!row) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  return c.json({
    user: {
      id: row.id,
      email: row.email,
      name: row.name,
      avatarUrl: row.avatar_url,
      preferences: JSON.parse((row.preferences as string) || '{}'),
    },
    org: {
      id: row.org_id,
      slug: row.org_slug,
      name: row.org_name,
    },
  });
});

/** POST /api/auth/dev-login — create a test session (local dev only) */
auth.post('/dev-login', async (c) => {
  if (c.env.DEV_MODE !== 'true') {
    return c.json({ error: 'Forbidden' }, 403);
  }

  // Upsert test user
  const userId = crypto.randomUUID();
  await c.env.DB.prepare(
    `INSERT INTO users (id, github_id, email, name, avatar_url)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(github_id) DO UPDATE SET
       email = excluded.email,
       name = excluded.name,
       updated_at = datetime('now')`,
  )
    .bind(userId, 'dev-0', 'dev@localhost', 'Test User', '')
    .run();

  const user = await c.env.DB.prepare('SELECT id FROM users WHERE github_id = ?')
    .bind('dev-0')
    .first<{ id: string }>();
  const actualUserId = user!.id;

  // Upsert test org
  const orgId = crypto.randomUUID();
  await c.env.DB.prepare(
    `INSERT INTO orgs (id, name, slug)
     VALUES (?, ?, ?)
     ON CONFLICT(slug) DO NOTHING`,
  )
    .bind(orgId, 'Dev Org', 'dev-org')
    .run();

  const org = await c.env.DB.prepare('SELECT id FROM orgs WHERE slug = ?')
    .bind('dev-org')
    .first<{ id: string }>();
  const actualOrgId = org!.id;

  // Ensure membership
  await c.env.DB.prepare(
    `INSERT INTO org_members (org_id, user_id, role)
     VALUES (?, ?, 'admin')
     ON CONFLICT(org_id, user_id) DO NOTHING`,
  )
    .bind(actualOrgId, actualUserId)
    .run();

  // Create session
  const sessionToken = crypto.randomUUID();
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(sessionToken));
  const tokenHash = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  await c.env.DB.prepare(
    'INSERT INTO sessions (id, user_id, org_id, token_hash, expires_at) VALUES (?, ?, ?, ?, ?)',
  )
    .bind(sessionId, actualUserId, actualOrgId, tokenHash, expiresAt)
    .run();

  const cookie = `nova_session=${sessionToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}`;

  return c.json(
    {
      user: {
        id: actualUserId,
        email: 'dev@localhost',
        name: 'Test User',
        avatarUrl: '',
      },
      org: { id: actualOrgId, slug: 'dev-org' },
    },
    200,
    { 'Set-Cookie': cookie },
  );
});

export default auth;
