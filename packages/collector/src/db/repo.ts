import type { Database } from 'better-sqlite3';

import {
  derivePostId,
  type AccountRole,
  type AccountRow,
  type NormalizedPost,
  type Platform,
} from '@socialscope/shared';

import { autoStopAt } from '../tracking/schedule';

export interface ScrapedAccount {
  platform: Platform;
  username: string;
  role: AccountRole;
}

export interface SaveResult {
  saved: number;
  /** Posts whose URL didn't yield a stable id (malformed scrape data). */
  skipped: number;
  /** Ids that were first seen in this save (candidates for auto-tracking). */
  newPostIds: string[];
  snapshotAt: string;
}

/** Registers (or re-classifies) an account in the analysis registry. */
export function upsertAccount(
  db: Database,
  account: ScrapedAccount,
  addedAt = new Date().toISOString(),
): void {
  db.prepare(
    `INSERT INTO accounts (platform, username, role, added_at) VALUES (?, ?, ?, ?)
     ON CONFLICT (platform, username) DO UPDATE SET role = excluded.role`,
  ).run(account.platform, account.username, account.role, addedAt);
}

/**
 * Writes one account sweep's results in one transaction: registers the
 * account, upserts each post, records a snapshot of its counters, and aligns
 * the role of ALL the account's posts (so reclassifying an account with a
 * different --role can't leave it split across both roles).
 */
export function saveScrapedPosts(
  db: Database,
  account: ScrapedAccount,
  posts: NormalizedPost[],
): SaveResult {
  const { role } = account;
  const snapshotAt = new Date().toISOString();

  const upsertPost = db.prepare(`
    INSERT INTO posts (id, platform, username, role, posted_at, content_text, media_type, hashtags_json, url, thumbnail_url)
    VALUES (@id, @platform, @username, @role, @posted_at, @content_text, @media_type, @hashtags_json, @url, @thumbnail_url)
    ON CONFLICT (id) DO UPDATE SET
      role = excluded.role,
      content_text = excluded.content_text,
      media_type = excluded.media_type,
      hashtags_json = excluded.hashtags_json,
      thumbnail_url = COALESCE(excluded.thumbnail_url, thumbnail_url)
  `);
  const insertSnapshot = db.prepare(`
    INSERT OR REPLACE INTO snapshots (post_id, captured_at, likes, comments, shares, views)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const alignRole = db.prepare(
    'UPDATE posts SET role = ? WHERE platform = ? AND username = ?',
  );
  const postExists = db.prepare('SELECT 1 FROM posts WHERE id = ?');

  let saved = 0;
  let skipped = 0;
  const newPostIds: string[] = [];
  db.transaction(() => {
    upsertAccount(db, account);
    alignRole.run(role, account.platform, account.username);
    for (const post of posts) {
      const id = derivePostId(post.platform, post.url);
      if (!id) {
        skipped += 1;
        continue;
      }
      if (postExists.get(id) === undefined) newPostIds.push(id);
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
        thumbnail_url: post.thumbnail_url ?? null,
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

  return { saved, skipped, newPostIds, snapshotAt };
}

/** One extra time-series observation for an already-known post. */
export function insertSnapshot(
  db: Database,
  postId: string,
  post: NormalizedPost,
  capturedAt = new Date().toISOString(),
): void {
  db.prepare(
    `INSERT OR REPLACE INTO snapshots (post_id, captured_at, likes, comments, shares, views)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(postId, capturedAt, post.likes, post.comments, post.shares ?? null, post.views ?? null);
}

/** Role this account is registered with, if it's in the registry. */
export function getAccountRole(
  db: Database,
  platform: Platform,
  username: string,
): AccountRole | null {
  const row = db
    .prepare('SELECT role FROM accounts WHERE platform = ? AND username = ?')
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

/** All registered accounts (dashboard cards + the tracker's sweep list). */
export function listAccounts(db: Database): AccountRow[] {
  return db
    .prepare('SELECT platform, username, role, added_at FROM accounts ORDER BY platform, username')
    .all() as AccountRow[];
}

// ---------------------------------------------------------------------------
// Tracking
// ---------------------------------------------------------------------------

export interface ActiveTrackedPost {
  post_id: string;
  tracking_started_at: string;
  auto_stop_at: string;
  platform: Platform;
  username: string;
  url: string;
  posted_at: string;
}

/**
 * Enrolls (or re-enrolls) a post in time-series tracking. Re-enrolling an
 * expired post restarts its 48h window; an actively tracked post is left
 * untouched by callers (check isActivelyTracked first).
 */
export function enrollTracking(
  db: Database,
  postId: string,
  startedAt = new Date().toISOString(),
): { autoStopAt: string } {
  const stopAt = autoStopAt(startedAt);
  db.prepare(
    `INSERT INTO tracked_posts (post_id, tracking_started_at, auto_stop_at, active)
     VALUES (?, ?, ?, 1)
     ON CONFLICT (post_id) DO UPDATE SET
       tracking_started_at = excluded.tracking_started_at,
       auto_stop_at = excluded.auto_stop_at,
       active = 1`,
  ).run(postId, startedAt, stopAt);
  return { autoStopAt: stopAt };
}

export function isActivelyTracked(db: Database, postId: string, now = new Date().toISOString()): boolean {
  return (
    db
      .prepare('SELECT 1 FROM tracked_posts WHERE post_id = ? AND active = 1 AND auto_stop_at > ?')
      .get(postId, now) !== undefined
  );
}

/** Flips expired rows to inactive; returns how many were stopped. */
export function deactivateExpired(db: Database, now = new Date().toISOString()): number {
  return db
    .prepare('UPDATE tracked_posts SET active = 0 WHERE active = 1 AND auto_stop_at <= ?')
    .run(now).changes;
}

export function getActiveTrackedPosts(
  db: Database,
  now = new Date().toISOString(),
): ActiveTrackedPost[] {
  return db
    .prepare(
      `SELECT tp.post_id, tp.tracking_started_at, tp.auto_stop_at,
              p.platform, p.username, p.url, p.posted_at
       FROM tracked_posts tp
       JOIN posts p ON p.id = tp.post_id
       WHERE tp.active = 1 AND tp.auto_stop_at > ?
       ORDER BY tp.tracking_started_at`,
    )
    .all(now) as ActiveTrackedPost[];
}

export function lastSnapshotAt(db: Database, postId: string): string | null {
  const row = db
    .prepare('SELECT MAX(captured_at) AS at FROM snapshots WHERE post_id = ?')
    .get(postId) as { at: string | null };
  return row.at;
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
