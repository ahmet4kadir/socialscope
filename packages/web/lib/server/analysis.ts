import type { Database } from 'better-sqlite3';

import {
  bestHeatmapSlot,
  computeAccountMetrics,
  contentLengthPerformance,
  engagementHeatmap,
  hashtagEngagement,
  mediaTypeBreakdown,
  type MediaType,
  type Platform,
  type PostStats,
} from '@socialscope/shared';

import type { AnalysisResponse, FollowerPoint } from '@/lib/api-types';

interface AnalysisRow {
  posted_at: string;
  content_text: string;
  media_type: MediaType;
  hashtags_json: string;
  likes: number;
  comments: number;
  shares: number | null;
  views: number | null;
}

/** Each post of the account with its latest snapshot, as metrics-engine input. */
export function loadPostStats(
  db: Database,
  platform: Platform,
  username: string,
): PostStats[] {
  const rows = db
    .prepare(
      `SELECT p.posted_at, p.content_text, p.media_type, p.hashtags_json,
              s.likes, s.comments, s.shares, s.views
       FROM posts p
       JOIN snapshots s
         ON s.post_id = p.id
        AND s.captured_at = (SELECT MAX(captured_at) FROM snapshots WHERE post_id = p.id)
       WHERE p.platform = ? AND p.username = ?`,
    )
    .all(platform, username) as AnalysisRow[];

  return rows.map((row) => {
    let hashtags: string[] = [];
    try {
      const parsed: unknown = JSON.parse(row.hashtags_json);
      if (Array.isArray(parsed)) {
        hashtags = parsed.filter((t): t is string => typeof t === 'string');
      }
    } catch {
      // Malformed hashtags_json — treat as no hashtags.
    }
    return {
      postedAt: row.posted_at,
      contentText: row.content_text,
      mediaType: row.media_type,
      hashtags,
      likes: row.likes,
      comments: row.comments,
      shares: row.shares,
      views: row.views,
    };
  });
}

/** The profile's own total post count from the latest account snapshot. */
export function loadProfilePostCount(
  db: Database,
  platform: Platform,
  username: string,
): number | null {
  try {
    const row = db
      .prepare(
        `SELECT post_count FROM account_snapshots
         WHERE platform = ? AND username = ? AND post_count IS NOT NULL
         ORDER BY captured_at DESC LIMIT 1`,
      )
      .get(platform, username) as { post_count: number } | undefined;
    return row?.post_count ?? null;
  } catch {
    return null; // table missing (pre-migration-003)
  }
}

export function loadFollowerSeries(
  db: Database,
  platform: Platform,
  username: string,
): FollowerPoint[] {
  try {
    return db
      .prepare(
        `SELECT captured_at AS capturedAt, followers, following
         FROM account_snapshots
         WHERE platform = ? AND username = ?
         ORDER BY captured_at`,
      )
      .all(platform, username) as FollowerPoint[];
  } catch {
    // account_snapshots table missing (pre-migration-003).
    return [];
  }
}

/** The full metrics bundle one account's Analiz view renders. */
export function analyzeAccount(
  db: Database,
  platform: Platform,
  username: string,
): AnalysisResponse {
  const posts = loadPostStats(db, platform, username);
  return {
    metrics: computeAccountMetrics(posts),
    media: mediaTypeBreakdown(posts),
    heatmap: engagementHeatmap(posts),
    hashtags: hashtagEngagement(posts),
    contentLength: contentLengthPerformance(posts),
    followers: loadFollowerSeries(db, platform, username),
    profilePostCount: loadProfilePostCount(db, platform, username),
  };
}

export { bestHeatmapSlot };
