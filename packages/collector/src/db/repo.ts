import type { Database } from 'better-sqlite3';

import {
  derivePostId,
  type AccountRole,
  type NormalizedPost,
  type Platform,
} from '@socialscope/shared';

export interface ScrapedAccount {
  platform: Platform;
  username: string;
  role: AccountRole;
}

export interface SaveResult {
  saved: number;
  /** Posts whose URL didn't yield a stable id (malformed scrape data). */
  skipped: number;
  snapshotAt: string;
}

/**
 * Writes one account sweep's results in one transaction: upserts each post,
 * records a snapshot of its counters, and aligns the role of ALL the
 * account's posts (so reclassifying an account with a different --role can't
 * leave it split across both roles).
 */
export function saveScrapedPosts(
  db: Database,
  account: ScrapedAccount,
  posts: NormalizedPost[],
): SaveResult {
  const { role } = account;
  const snapshotAt = new Date().toISOString();

  const upsertPost = db.prepare(`
    INSERT INTO posts (id, platform, username, role, posted_at, content_text, media_type, hashtags_json, url)
    VALUES (@id, @platform, @username, @role, @posted_at, @content_text, @media_type, @hashtags_json, @url)
    ON CONFLICT (id) DO UPDATE SET
      role = excluded.role,
      content_text = excluded.content_text,
      media_type = excluded.media_type,
      hashtags_json = excluded.hashtags_json
  `);
  const insertSnapshot = db.prepare(`
    INSERT OR REPLACE INTO snapshots (post_id, captured_at, likes, comments, shares, views)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const alignRole = db.prepare(
    'UPDATE posts SET role = ? WHERE platform = ? AND username = ?',
  );

  let saved = 0;
  let skipped = 0;
  db.transaction(() => {
    alignRole.run(role, account.platform, account.username);
    for (const post of posts) {
      const id = derivePostId(post.platform, post.url);
      if (!id) {
        skipped += 1;
        continue;
      }
      upsertPost.run({
        id,
        platform: post.platform,
        username: post.username,
        role,
        posted_at: post.date,
        content_text: post.content_text,
        media_type: post.media_type,
        hashtags_json: JSON.stringify(post.hashtags),
        url: post.url,
      });
      insertSnapshot.run(
        id,
        snapshotAt,
        post.likes,
        post.comments,
        post.shares ?? null,
        post.views ?? null,
      );
      saved += 1;
    }
  })();

  return { saved, skipped, snapshotAt };
}

/** Role this account was saved with previously, if we've seen it before. */
export function getAccountRole(
  db: Database,
  platform: Platform,
  username: string,
): AccountRole | null {
  const row = db
    .prepare(
      'SELECT role FROM posts WHERE platform = ? AND username = ? LIMIT 1',
    )
    .get(platform, username) as { role: AccountRole } | undefined;
  return row?.role ?? null;
}

export function lastSweepAt(
  db: Database,
  platform: Platform,
  username: string,
): string | null {
  const row = db
    .prepare(
      'SELECT swept_at FROM sweeps WHERE platform = ? AND username = ?',
    )
    .get(platform, username) as { swept_at: string } | undefined;
  return row?.swept_at ?? null;
}

export function recordSweep(
  db: Database,
  platform: Platform,
  username: string,
  sweptAt = new Date().toISOString(),
): void {
  db.prepare(
    'INSERT OR REPLACE INTO sweeps (platform, username, swept_at) VALUES (?, ?, ?)',
  ).run(platform, username, sweptAt);
}

export const SWEEP_CACHE_MS = 6 * 60 * 60 * 1000;

/** True if the account was swept recently enough to skip (the 6h cache). */
export function isSweepFresh(
  sweptAt: string | null,
  now: number = Date.now(),
): boolean {
  if (sweptAt === null) return false;
  const sweptMs = Date.parse(sweptAt);
  return Number.isFinite(sweptMs) && now - sweptMs < SWEEP_CACHE_MS;
}
