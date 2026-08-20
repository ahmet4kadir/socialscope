-- Marketing campaigns: named groups of posts measured together.
CREATE TABLE campaigns (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE campaign_posts (
  campaign_id INTEGER NOT NULL REFERENCES campaigns (id) ON DELETE CASCADE,
  post_id     TEXT NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
  PRIMARY KEY (campaign_id, post_id)
);

-- KPI targets per account. Progress is computed live from current metrics.
CREATE TABLE goals (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  platform   TEXT NOT NULL CHECK (platform IN ('instagram', 'x')),
  username   TEXT NOT NULL,
  metric     TEXT NOT NULL CHECK (metric IN ('followers', 'avg_engagement', 'posting_frequency')),
  target     REAL NOT NULL CHECK (target > 0),
  created_at TEXT NOT NULL
);
