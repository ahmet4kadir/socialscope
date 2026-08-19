-- One row per post we have ever seen. Static fields only; the moving
-- counters (likes/comments/...) live in snapshots. All timestamps ISO 8601 UTC.
CREATE TABLE posts (
  -- Platform-scoped stable id, e.g. 'instagram:DGxYz12' or 'x:1234567890'.
  id            TEXT PRIMARY KEY,
  platform      TEXT NOT NULL CHECK (platform IN ('instagram', 'x')),
  username      TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('me', 'competitor')),
  posted_at     TEXT NOT NULL,
  content_text  TEXT NOT NULL DEFAULT '',
  media_type    TEXT NOT NULL DEFAULT 'unknown'
                CHECK (media_type IN ('image', 'video', 'carousel', 'text', 'unknown')),
  -- JSON-encoded string[] of hashtags, without the leading '#'.
  hashtags_json TEXT NOT NULL DEFAULT '[]',
  url           TEXT NOT NULL UNIQUE
);

CREATE INDEX idx_posts_account ON posts (platform, username);
CREATE INDEX idx_posts_posted_at ON posts (posted_at);

-- Time series: one row per observation of a post's counters. Every scrape of
-- a post inserts a snapshot; the tracker adds hourly/6-hourly ones on top.
CREATE TABLE snapshots (
  post_id     TEXT NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
  captured_at TEXT NOT NULL,
  likes       INTEGER NOT NULL DEFAULT 0,
  comments    INTEGER NOT NULL DEFAULT 0,
  shares      INTEGER,
  views       INTEGER,
  PRIMARY KEY (post_id, captured_at)
);

CREATE INDEX idx_snapshots_captured_at ON snapshots (captured_at);

-- Posts enrolled in time-series tracking (auto-enrolled new posts on my
-- account, or manually via `npm run track -- --url <post_url>`).
-- Schedule: hourly snapshots for 24h, then every 6h, hard stop at 48h.
CREATE TABLE tracked_posts (
  post_id             TEXT PRIMARY KEY REFERENCES posts (id) ON DELETE CASCADE,
  tracking_started_at TEXT NOT NULL,
  -- tracking_started_at + 48h; the tracker only touches rows where
  -- active = 1 AND now < auto_stop_at.
  auto_stop_at        TEXT NOT NULL,
  active              INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1))
);

-- Last completed sweep per account. Backs the 6h scrape cache: a sweep of the
-- same account within the last 6h is skipped unless --force is passed.
CREATE TABLE sweeps (
  platform TEXT NOT NULL CHECK (platform IN ('instagram', 'x')),
  username TEXT NOT NULL,
  swept_at TEXT NOT NULL,
  PRIMARY KEY (platform, username)
);
