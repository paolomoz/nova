-- Seed data for local development with paolomoz/impeccable EDS project

-- Organization
INSERT INTO orgs (id, name, slug, github_org)
VALUES ('org-local', 'Paolo Local', 'paolomoz', 'paolomoz');

-- User
INSERT INTO users (id, github_id, email, name, avatar_url)
VALUES ('user-local', '12345', 'paolo@example.com', 'Paolo', 'https://avatars.githubusercontent.com/u/12345');

-- Org membership
INSERT INTO org_members (org_id, user_id, role)
VALUES ('org-local', 'user-local', 'admin');

-- Project pointing to paolomoz/impeccable
INSERT INTO projects (id, org_id, name, slug, da_org, da_repo, github_org, github_repo)
VALUES ('proj-impeccable', 'org-local', 'Impeccable', 'impeccable', 'paolomoz', 'impeccable', 'paolomoz', 'impeccable');

-- Session (token: "nova-test-session-token-2025", hash computed via SHA-256)
INSERT INTO sessions (id, user_id, org_id, token_hash, expires_at)
VALUES (
  'session-local',
  'user-local',
  'org-local',
  '4090e9cc6121669217fc3ed008a960f072a066cdd25d21dd62ac9c9199cf49bd',
  datetime('now', '+30 days')
);
