import type { Database } from 'better-sqlite3';

import {
  bestHeatmapSlot,
  buildRecommendations,
  computeAccountMetrics,
  contentLengthPerformance,
  engagementHeatmap,
  hashtagEngagement,
  mediaTypeBreakdown,
  type AccountRole,
  type CompetitorSummary,
  type MediaType,
  type Platform,
  type PostStats,
  type Recommendation,
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

export interface RegistryAccount {
  platform: Platform;
  username: string;
  role: AccountRole;
}

/** All registered accounts, or [] when the registry table doesn't exist yet. */
export function loadRegistry(db: Database): RegistryAccount[] {
  try {
    return db
      .prepare('SELECT platform, username, role FROM accounts ORDER BY role DESC, username')
      .all() as RegistryAccount[];
  } catch {
    return [];
  }
}

/**
 * Evidence-cited recommendations for one account, benchmarked against every
 * other registered account. Shared by the Öneriler tab and the report export.
 */
export function recommendationsFor(
  db: Database,
  platform: Platform,
  username: string,
): Recommendation[] {
  const analysis = analyzeAccount(db, platform, username);
  const followerPoints = analysis.followers.filter((p) => p.followers !== null);
  const latest = followerPoints[followerPoints.length - 1];
  const previous = followerPoints[followerPoints.length - 2];

  const competitors: CompetitorSummary[] = loadRegistry(db)
    .filter((entry) => !(entry.platform === platform && entry.username === username))
    .map((entry) => {
      const theirAnalysis = analyzeAccount(db, entry.platform, entry.username);
      const theirFollowers = theirAnalysis.followers.filter((p) => p.followers !== null);
      return {
        username: entry.username,
        avgEngagement: theirAnalysis.metrics.avgEngagement,
        postingFrequencyPerWeek: theirAnalysis.metrics.postingFrequencyPerWeek,
        followers: theirFollowers[theirFollowers.length - 1]?.followers ?? null,
        topHashtags: theirAnalysis.hashtags.slice(0, 3).map((tag) => tag.hashtag),
      };
    })
    .filter(
      (summary) =>
        summary.avgEngagement !== null || summary.postingFrequencyPerWeek !== null,
    );

  return buildRecommendations({
    username,
    metrics: analysis.metrics,
    heatmap: analysis.heatmap,
    media: analysis.media,
    hashtags: analysis.hashtags,
    contentLength: analysis.contentLength,
    followers: {
      current: latest?.followers ?? null,
      growth:
        latest?.followers != null && previous?.followers != null
          ? latest.followers - previous.followers
          : null,
    },
    competitors,
  });
}
