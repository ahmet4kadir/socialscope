-- Time series of account-level (profile) stats: follower/following/post
-- counts, captured on every sweep. Separate from post `snapshots` because
-- these describe the account, not an individual post.
CREATE TABLE account_snapshots (
  platform    TEXT NOT NULL CHECK (platform IN ('instagram', 'x')),
  username    TEXT NOT NULL,
  captured_at TEXT NOT NULL,
  followers   INTEGER,
  following   INTEGER,
  post_count  INTEGER,
  PRIMARY KEY (platform, username, captured_at)
);

CREATE INDEX idx_account_snapshots_account
  ON account_snapshots (platform, username, captured_at);
