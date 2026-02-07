import { Hono } from 'hono';
import type { Env } from '../lib/types.js';
import { getGitHubAuthUrl, exchangeGitHubCode, getGitHubUser } from '../services/github.js';

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

export default auth;
