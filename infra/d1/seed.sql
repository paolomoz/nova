-- Seed data for local development with paolomoz/nova-2 EDS project
-- Matches the org/user created by dev-login endpoint

-- Organization (matches dev-login's "dev-org" slug)
INSERT OR IGNORE INTO orgs (id, name, slug, github_org)
VALUES ('org-dev', 'Dev Org', 'dev-org', 'paolomoz');

-- User (matches dev-login's "dev-0" github_id)
INSERT OR IGNORE INTO users (id, github_id, email, name, avatar_url)
VALUES ('user-dev', 'dev-0', 'dev@localhost', 'Test User', '');

-- Org membership
INSERT OR IGNORE INTO org_members (org_id, user_id, role)
VALUES ('org-dev', 'user-dev', 'admin');

-- Project pointing to paolomoz/nova-2
INSERT OR IGNORE INTO projects (id, org_id, name, slug, da_org, da_repo, github_org, github_repo)
VALUES ('proj-nova2', 'org-dev', 'Nova 2', 'nova-2', 'paolomoz', 'nova-2', 'paolomoz', 'nova-2');
