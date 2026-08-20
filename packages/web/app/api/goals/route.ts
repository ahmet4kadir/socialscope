import { NextResponse } from 'next/server';

import { computeAccountMetrics, type Platform } from '@socialscope/shared';

import { loadFollowerSeries, loadPostStats } from '@/lib/server/analysis';
import { openDbReadonly, openDbWritable } from '@/lib/server/db';

export type GoalMetric = 'followers' | 'avg_engagement' | 'posting_frequency';

export interface GoalView {
  id: number;
  platform: Platform;
  username: string;
  metric: GoalMetric;
  target: number;
  current: number | null;
  /** 0-100, clamped; null when the current value is unknown. */
  progress: number | null;
  createdAt: string;
}

const SCHEMA_HINT = 'Hedef tablosu eksik — `npm run migrate` çalıştırın.';

export function GET(): NextResponse {
  const db = openDbReadonly();
  if (!db) return NextResponse.json({ goals: [] });

  let rows: Array<{
    id: number;
    platform: Platform;
    username: string;
    metric: GoalMetric;
    target: number;
    created_at: string;
  }>;
  try {
    rows = db
      .prepare(
        'SELECT id, platform, username, metric, target, created_at FROM goals ORDER BY created_at DESC',
      )
      .all() as typeof rows;
  } catch {
    return NextResponse.json({ goals: [], error: SCHEMA_HINT });
  }

  // Current values computed live; account metrics cached per account.
  const cache = new Map<string, { avgEngagement: number | null; freq: number | null; followers: number | null }>();
  const currentFor = (platform: Platform, username: string) => {
    const key = `${platform}:${username}`;
    let entry = cache.get(key);
    if (!entry) {
      const metrics = computeAccountMetrics(loadPostStats(db, platform, username));
      const followerPoints = loadFollowerSeries(db, platform, username).filter(
        (p) => p.followers !== null,
      );
      entry = {
        avgEngagement: metrics.avgEngagement,
        freq: metrics.postingFrequencyPerWeek,
        followers: followerPoints[followerPoints.length - 1]?.followers ?? null,
      };
      cache.set(key, entry);
    }
    return entry;
  };

  const goals: GoalView[] = rows.map((row) => {
    const values = currentFor(row.platform, row.username);
    const current =
      row.metric === 'followers'
        ? values.followers
        : row.metric === 'avg_engagement'
          ? values.avgEngagement
          : values.freq;
    return {
      id: row.id,
      platform: row.platform,
      username: row.username,
      metric: row.metric,
      target: row.target,
      current,
      progress:
        current === null
          ? null
          : Math.min(100, Math.round((current / row.target) * 100)),
      createdAt: row.created_at,
    };
  });

  return NextResponse.json({ goals });
}

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json().catch(() => null)) as {
    platform?: string;
    username?: string;
    metric?: string;
    target?: number;
  } | null;

  const platform = body?.platform;
  const username = body?.username?.replace(/^@/, '').trim().toLowerCase() ?? '';
  const metric = body?.metric;
  const target = Number(body?.target);

  if (
    (platform !== 'instagram' && platform !== 'x') ||
    username === '' ||
    (metric !== 'followers' && metric !== 'avg_engagement' && metric !== 'posting_frequency') ||
    !Number.isFinite(target) ||
    target <= 0
  ) {
    return NextResponse.json(
      { error: 'Hedef için hesap, metrik ve pozitif bir değer gerekli.' },
      { status: 400 },
    );
  }

  const db = openDbWritable();
  if (!db) {
    return NextResponse.json(
      { error: 'Veritabanı henüz yok — önce `npm run migrate` çalıştırın.' },
      { status: 409 },
    );
  }
  try {
    db.prepare(
      'INSERT INTO goals (platform, username, metric, target, created_at) VALUES (?, ?, ?, ?, ?)',
    ).run(platform, username, metric, target, new Date().toISOString());
  } catch {
    return NextResponse.json({ error: SCHEMA_HINT }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export function DELETE(request: Request): NextResponse {
  const id = Number(new URL(request.url).searchParams.get('id'));
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: 'Geçersiz hedef.' }, { status: 400 });
  }
  const db = openDbWritable();
  if (!db) return NextResponse.json({ ok: true });
  try {
    db.prepare('DELETE FROM goals WHERE id = ?').run(id);
  } catch {
    return NextResponse.json({ error: SCHEMA_HINT }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
