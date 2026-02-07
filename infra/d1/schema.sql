-- Nova D1 Schema
-- Multi-tenant foundation

CREATE TABLE orgs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  github_org TEXT,
  settings TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  github_id TEXT UNIQUE,
  ims_id TEXT UNIQUE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  avatar_url TEXT,
  preferences TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE org_members (
  org_id TEXT NOT NULL REFERENCES orgs(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  role TEXT NOT NULL DEFAULT 'author',
  PRIMARY KEY (org_id, user_id)
);

CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES orgs(id),
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  da_org TEXT NOT NULL,
  da_repo TEXT NOT NULL,
  github_org TEXT,
  github_repo TEXT,
  delivery_config TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(org_id, slug)
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  org_id TEXT NOT NULL REFERENCES orgs(id),
  token_hash TEXT UNIQUE NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Content value layer
CREATE TABLE value_scores (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  path TEXT NOT NULL,
  audience TEXT,
  situation TEXT,
  outcome TEXT,
  engagement_score REAL DEFAULT 0,
  conversion_score REAL DEFAULT 0,
  seo_score REAL DEFAULT 0,
  cwv_score REAL DEFAULT 0,
  composite_score REAL DEFAULT 0,
  sample_size INTEGER DEFAULT 0,
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(project_id, path, audience, situation)
);

-- Brand profiles
CREATE TABLE brand_profiles (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  name TEXT NOT NULL DEFAULT 'default',
  voice TEXT DEFAULT '{}',
  visual TEXT DEFAULT '{}',
  content_rules TEXT DEFAULT '{}',
  design_tokens TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(project_id, name)
);

-- AI action history
CREATE TABLE action_history (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  project_id TEXT NOT NULL REFERENCES projects(id),
  action_type TEXT NOT NULL,
  description TEXT,
  input TEXT,
  output TEXT,
  status TEXT DEFAULT 'completed',
  created_at TEXT DEFAULT (datetime('now'))
);

-- User context (accumulated patterns)
CREATE TABLE user_context (
  user_id TEXT NOT NULL REFERENCES users(id),
  project_id TEXT NOT NULL REFERENCES projects(id),
  context_type TEXT NOT NULL,
  data TEXT NOT NULL,
  updated_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, project_id, context_type)
);

-- Generative config per project/page
CREATE TABLE generative_config (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  path_pattern TEXT NOT NULL,
  delivery_mode TEXT NOT NULL DEFAULT 'static',
  intent_config TEXT DEFAULT '{}',
  confidence_thresholds TEXT DEFAULT '{}',
  signal_config TEXT DEFAULT '{}',
  block_constraints TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(project_id, path_pattern)
);

-- Block library metadata
CREATE TABLE block_library (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  name TEXT NOT NULL,
  category TEXT,
  description TEXT,
  structure_html TEXT,
  css TEXT,
  js TEXT,
  status TEXT DEFAULT 'draft',         -- draft, committed, published
  github_branch TEXT,
  github_pr_url TEXT,
  generative_config TEXT DEFAULT '{}',
  value_metadata TEXT DEFAULT '{}',
  code_path TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(project_id, name)
);

-- Operational Telemetry data (aggregated)
CREATE TABLE telemetry_daily (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  path TEXT NOT NULL,
  date TEXT NOT NULL,
  page_views INTEGER DEFAULT 0,
  lcp_p75 REAL,
  inp_p75 REAL,
  cls_p75 REAL,
  engagement_checkpoints TEXT DEFAULT '{}',
  conversion_events INTEGER DEFAULT 0,
  is_generated INTEGER DEFAULT 0,
  UNIQUE(project_id, path, date)
);

-- Asset metadata
CREATE TABLE assets (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  path TEXT NOT NULL,
  name TEXT NOT NULL,
  mime_type TEXT,
  size INTEGER,
  width INTEGER,
  height INTEGER,
  alt_text TEXT,
  tags TEXT DEFAULT '[]',               -- JSON array of auto-generated tags
  color_palette TEXT DEFAULT '[]',      -- JSON array of dominant colors
  r2_key TEXT,
  created_by TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(project_id, path)
);

CREATE INDEX idx_assets_project ON assets(project_id);
CREATE INDEX idx_assets_path ON assets(project_id, path);

-- Content search index (keyword search)
CREATE TABLE content_index (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  path TEXT NOT NULL,
  title TEXT,
  body TEXT,
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(project_id, path)
);

CREATE INDEX idx_content_index_project ON content_index(project_id);

-- Indexes
CREATE INDEX idx_value_scores_project ON value_scores(project_id);
CREATE INDEX idx_value_scores_path ON value_scores(project_id, path);
CREATE INDEX idx_action_history_user ON action_history(user_id, project_id);
CREATE INDEX idx_action_history_recent ON action_history(created_at DESC);
CREATE INDEX idx_telemetry_project_date ON telemetry_daily(project_id, date);
CREATE INDEX idx_sessions_token ON sessions(token_hash);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);
