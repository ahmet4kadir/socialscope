import { NextResponse } from 'next/server';

import { engagementOf, type PostStats } from '@socialscope/shared';

import { loadFollowerSeries, loadPostStats } from '@/lib/server/analysis';
import { openDbReadonly } from '@/lib/server/db';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface PeriodStats {
  postCount: number;
  avgEngagement: number | null;
  totalEngagement: number;
  avgLikes: number | null;
  followerChange: number | null;
}

export interface TrendsResponse {
  days: number;
  current: PeriodStats;
  previous: PeriodStats;
}

function statsFor(
  posts: PostStats[],
  followers: Array<{ capturedAt: string; followers: number | null }>,
  startMs: number,
  endMs: number,
): PeriodStats {
  const inWindow = posts.filter((post) => {
    const at = Date.parse(post.postedAt);
    return Number.isFinite(at) && at >= startMs && at < endMs;
  });
  const engagements = inWindow.map(engagementOf);
  const total = engagements.reduce((sum, value) => sum + value, 0);

  const followerPoints = followers
    .filter((point) => {
      const at = Date.parse(point.capturedAt);
      return point.followers !== null && at >= startMs && at < endMs;
    })
    .sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));
  const first = followerPoints[0];
  const last = followerPoints[followerPoints.length - 1];

  return {
    postCount: inWindow.length,
    avgEngagement:
      inWindow.length > 0 ? Math.round((total / inWindow.length) * 100) / 100 : null,
    totalEngagement: total,
    avgLikes:
      inWindow.length > 0
        ? Math.round(
            (inWindow.reduce((sum, p) => sum + p.likes, 0) / inWindow.length) * 100,
          ) / 100
        : null,
    followerChange:
      first && last && first !== last
        ? (last.followers ?? 0) - (first.followers ?? 0)
        : null,
  };
}

export function GET(request: Request): NextResponse {
  const { searchParams } = new URL(request.url);
  const platform = searchParams.get('platform');
  const username = searchParams.get('username')?.toLowerCase() ?? '';
  const days = searchParams.get('days') === '7' ? 7 : 30;

  if ((platform !== 'instagram' && platform !== 'x') || username === '') {
    return NextResponse.json(
      { error: 'platform ve username parametreleri gerekli.' },
      { status: 400 },
    );
  }

  const empty: PeriodStats = {
    postCount: 0,
    avgEngagement: null,
    totalEngagement: 0,
    avgLikes: null,
    followerChange: null,
  };
  const db = openDbReadonly();
  if (!db) {
    return NextResponse.json({ days, current: empty, previous: empty });
  }

  const posts = loadPostStats(db, platform, username);
  const followers = loadFollowerSeries(db, platform, username);
  const now = Date.now();
  const windowMs = days * DAY_MS;

  const response: TrendsResponse = {
    days,
    current: statsFor(posts, followers, now - windowMs, now),
    previous: statsFor(posts, followers, now - 2 * windowMs, now - windowMs),
  };
  return NextResponse.json(response);
}
