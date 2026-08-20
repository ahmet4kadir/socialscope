import { NextResponse } from 'next/server';

import {
  computeAccountMetrics,
  contentLengthPerformance,
  engagementHeatmap,
  hashtagEngagement,
  mediaTypeBreakdown,
  type MediaType,
  type PostStats,
} from '@socialscope/shared';

import type { AnalysisResponse, FollowerPoint } from '@/lib/api-types';
import { openDbReadonly } from '@/lib/server/db';

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

export function GET(request: Request): NextResponse {
  const { searchParams } = new URL(request.url);
  const platform = searchParams.get('platform');
  const username = searchParams.get('username')?.toLowerCase() ?? '';

  if ((platform !== 'instagram' && platform !== 'x') || username === '') {
    return NextResponse.json(
      { error: 'platform ve username parametreleri gerekli.' },
      { status: 400 },
    );
  }

  const db = openDbReadonly();
  const empty: AnalysisResponse = {
    metrics: computeAccountMetrics([]),
    media: [],
    heatmap: [],
    hashtags: [],
    contentLength: [],
    followers: [],
  };
  if (!db) return NextResponse.json(empty);

  // Each post with its latest snapshot's counters → the metrics engine shape.
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

  const posts: PostStats[] = rows.map((row) => {
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

  let followers: FollowerPoint[] = [];
  try {
    followers = db
      .prepare(
        `SELECT captured_at AS capturedAt, followers, following
         FROM account_snapshots
         WHERE platform = ? AND username = ?
         ORDER BY captured_at`,
      )
      .all(platform, username) as FollowerPoint[];
  } catch {
    // account_snapshots table missing (pre-migration-003) — no follower data.
  }

  const response: AnalysisResponse = {
    metrics: computeAccountMetrics(posts),
    media: mediaTypeBreakdown(posts),
    heatmap: engagementHeatmap(posts),
    hashtags: hashtagEngagement(posts),
    contentLength: contentLengthPerformance(posts),
    followers,
  };
  return NextResponse.json(response);
}
