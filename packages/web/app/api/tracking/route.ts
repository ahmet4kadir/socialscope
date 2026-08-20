import { NextResponse } from 'next/server';

import {
  computePostTimeSeries,
  type MediaType,
  type Platform,
  type PostTimeSeriesMetrics,
  type SnapshotPoint,
} from '@socialscope/shared';

import { openDbReadonly } from '@/lib/server/db';

export interface TrackedPostView {
  postId: string;
  platform: Platform;
  username: string;
  postedAt: string;
  contentText: string;
  mediaType: MediaType;
  url: string;
  thumbnailUrl: string | null;
  trackingStartedAt: string;
  autoStopAt: string;
  status: 'active' | 'stopped';
  series: PostTimeSeriesMetrics;
}

interface TrackedRow {
  post_id: string;
  tracking_started_at: string;
  auto_stop_at: string;
  active: 0 | 1;
  platform: Platform;
  username: string;
  posted_at: string;
  content_text: string;
  media_type: MediaType;
  url: string;
  thumbnail_url: string | null;
}

interface SnapshotRow {
  captured_at: string;
  likes: number;
  comments: number;
  shares: number | null;
  views: number | null;
}

export function GET(): NextResponse {
  const db = openDbReadonly();
  if (!db) return NextResponse.json({ posts: [] });

  const rows = db
    .prepare(
      `SELECT tp.post_id, tp.tracking_started_at, tp.auto_stop_at, tp.active,
              p.platform, p.username, p.posted_at, p.content_text, p.media_type,
              p.url, p.thumbnail_url
       FROM tracked_posts tp
       JOIN posts p ON p.id = tp.post_id
       ORDER BY tp.tracking_started_at DESC`,
    )
    .all() as TrackedRow[];

  const snapshotStmt = db.prepare(
    `SELECT captured_at, likes, comments, shares, views
     FROM snapshots WHERE post_id = ? ORDER BY captured_at`,
  );
  const now = new Date().toISOString();

  const posts: TrackedPostView[] = rows.map((row) => {
    const snapshots: SnapshotPoint[] = (snapshotStmt.all(row.post_id) as SnapshotRow[]).map(
      (snap) => ({
        capturedAt: snap.captured_at,
        likes: snap.likes,
        comments: snap.comments,
        shares: snap.shares,
        views: snap.views,
      }),
    );
    return {
      postId: row.post_id,
      platform: row.platform,
      username: row.username,
      postedAt: row.posted_at,
      contentText: row.content_text,
      mediaType: row.media_type,
      url: row.url,
      thumbnailUrl: row.thumbnail_url,
      trackingStartedAt: row.tracking_started_at,
      autoStopAt: row.auto_stop_at,
      status: row.active === 1 && row.auto_stop_at > now ? 'active' : 'stopped',
      series: computePostTimeSeries(row.posted_at, snapshots),
    };
  });

  return NextResponse.json({ posts });
}
