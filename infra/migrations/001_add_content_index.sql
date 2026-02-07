-- Migration 001: Add content_index table for keyword search
CREATE TABLE IF NOT EXISTS content_index (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  path TEXT NOT NULL,
  title TEXT,
  body TEXT,
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(project_id, path)
);

CREATE INDEX IF NOT EXISTS idx_content_index_project ON content_index(project_id);
