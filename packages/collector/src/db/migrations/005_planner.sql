-- Content planner: planned posts that later get linked to the real published
-- post, closing the plan -> publish -> measure loop.
CREATE TABLE planned_posts (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  platform       TEXT NOT NULL CHECK (platform IN ('instagram', 'x')),
  username       TEXT NOT NULL,
  planned_at     TEXT NOT NULL,
  media_type     TEXT NOT NULL DEFAULT 'image'
                 CHECK (media_type IN ('image', 'video', 'carousel', 'text')),
  caption_draft  TEXT NOT NULL DEFAULT '',
  hashtags       TEXT NOT NULL DEFAULT '',
  status         TEXT NOT NULL DEFAULT 'planned'
                 CHECK (status IN ('planned', 'published', 'skipped')),
  linked_post_id TEXT REFERENCES posts (id),
  created_at     TEXT NOT NULL
);
