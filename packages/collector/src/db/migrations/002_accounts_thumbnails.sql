-- Registry of accounts to analyze. Feeds the dashboard cards and, from stage
-- 4 on, the tracker's periodic sweep list. Scraping an account registers it
-- automatically; the dashboard can also add/remove accounts directly.
CREATE TABLE accounts (
  platform TEXT NOT NULL CHECK (platform IN ('instagram', 'x')),
  username TEXT NOT NULL,
  role     TEXT NOT NULL CHECK (role IN ('me', 'competitor')),
  added_at TEXT NOT NULL,
  PRIMARY KEY (platform, username)
);

-- Accounts scraped before this migration keep working.
INSERT INTO accounts (platform, username, role, added_at)
SELECT platform, username, MAX(role), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM posts
GROUP BY platform, username;

-- Latest known preview image URL per post (platform CDN; refreshed on each
-- scrape because these URLs are signed and eventually expire).
ALTER TABLE posts ADD COLUMN thumbnail_url TEXT;
