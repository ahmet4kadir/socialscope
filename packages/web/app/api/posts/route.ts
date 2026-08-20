import { NextResponse } from 'next/server';

import type { MediaType } from '@socialscope/shared';

import type { PostWithMetrics } from '@/lib/api-types';
import { openDbReadonly } from '@/lib/server/db';

interface PostRowWithSnapshot {
  id: string;
  posted_at: string;
  content_text: string;
  media_type: MediaType;
  hashtags_json: string;
  url: string;
  thumbnail_url: string | null;
  likes: number;
  comments: number;
  shares: number | null;
  views: number | null;
  captured_at: string;
  tracked_active: 0 | 1 | null;
  auto_stop_at: string | null;
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
  if (!db) {
    return NextResponse.json({ posts: [] });
  }

  // Latest snapshot per post: counters live in snapshots, not posts.
  const rows = db
    .prepare(
      `SELECT p.id, p.posted_at, p.content_text, p.media_type, p.hashtags_json, p.url,
              p.thumbnail_url, s.likes, s.comments, s.shares, s.views, s.captured_at,
              tp.active AS tracked_active, tp.auto_stop_at
       FROM posts p
       JOIN snapshots s
         ON s.post_id = p.id
        AND s.captured_at = (SELECT MAX(captured_at) FROM snapshots WHERE post_id = p.id)
       LEFT JOIN tracked_posts tp ON tp.post_id = p.id
       WHERE p.platform = ? AND p.username = ?
       ORDER BY p.posted_at DESC`,
    )
    .all(platform, username) as PostRowWithSnapshot[];

  const posts: PostWithMetrics[] = rows.map((row) => {
    let hashtags: string[] = [];
    try {
      const parsed: unknown = JSON.parse(row.hashtags_json);
      if (Array.isArray(parsed)) hashtags = parsed.filter((t): t is string => typeof t === 'string');
    } catch {
      // Malformed hashtags_json, treat as no hashtags rather than failing.
    }
    return {
      id: row.id,
      postedAt: row.posted_at,
      contentText: row.content_text,
      mediaType: row.media_type,
      hashtags,
      url: row.url,
      thumbnailUrl: row.thumbnail_url,
      likes: row.likes,
      comments: row.comments,
      shares: row.shares,
      views: row.views,
      capturedAt: row.captured_at,
      tracking:
        row.tracked_active === null
          ? null
          : row.tracked_active === 1 &&
              (row.auto_stop_at ?? '') > new Date().toISOString()
            ? 'active'
            : 'stopped',
    };
  });
  return NextResponse.json({ posts });
}
