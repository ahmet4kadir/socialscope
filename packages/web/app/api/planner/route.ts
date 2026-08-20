import { NextResponse } from 'next/server';

import {
  bestHeatmapSlot,
  computeAccountMetrics,
  type MediaType,
  type Platform,
} from '@socialscope/shared';

import { analyzeAccount, loadPostStats } from '@/lib/server/analysis';
import { openDbReadonly, openDbWritable } from '@/lib/server/db';

export type PlanStatus = 'planned' | 'published' | 'skipped';

export interface PlanView {
  id: number;
  platform: Platform;
  username: string;
  plannedAt: string;
  mediaType: MediaType;
  captionDraft: string;
  hashtags: string;
  status: PlanStatus;
  linkedPostId: string | null;
  /** For published plans: how the real post actually did. */
  actual: { postedAt: string; engagement: number } | null;
  /** Account average engagement, for the planned-vs-actual comparison. */
  accountAvgEngagement: number | null;
}

export interface PlannerSuggestion {
  plannedAt: string;
  mediaType: MediaType;
  hashtags: string[];
}

const SCHEMA_HINT = 'Planlayıcı tablosu eksik; veritabanı güncellemesi gerekiyor.';

// Turkey is UTC+3 year-round (no DST since 2016), so the next occurrence of
// a weekday+hour in Istanbul time is computable with a fixed offset.
const TR_OFFSET_MS = 3 * 60 * 60 * 1000;

function nextSlotIso(dayOfWeek: number, hour: number): string {
  const nowMs = Date.now();
  for (let add = 0; add < 8; add += 1) {
    const candidate = new Date(nowMs + TR_OFFSET_MS);
    candidate.setUTCDate(candidate.getUTCDate() + add);
    if (candidate.getUTCDay() !== dayOfWeek) continue;
    candidate.setUTCHours(hour, 0, 0, 0);
    const utcMs = candidate.getTime() - TR_OFFSET_MS;
    if (utcMs > nowMs) return new Date(utcMs).toISOString();
  }
  return new Date(nowMs + 24 * 60 * 60 * 1000).toISOString();
}

export function GET(request: Request): NextResponse {
  const { searchParams } = new URL(request.url);
  const platform = searchParams.get('platform');
  const username = searchParams.get('username')?.toLowerCase() ?? '';

  const db = openDbReadonly();
  if (!db) return NextResponse.json({ plans: [], suggestion: null });

  interface PlanRow {
    id: number;
    platform: Platform;
    username: string;
    planned_at: string;
    media_type: MediaType;
    caption_draft: string;
    hashtags: string;
    status: PlanStatus;
    linked_post_id: string | null;
    actual_posted_at: string | null;
    actual_engagement: number | null;
  }
  let rows: PlanRow[];
  try {
    rows = db
      .prepare(
        `SELECT pp.id, pp.platform, pp.username, pp.planned_at, pp.media_type,
                pp.caption_draft, pp.hashtags, pp.status, pp.linked_post_id,
                p.posted_at AS actual_posted_at,
                (s.likes + s.comments + COALESCE(s.shares, 0)) AS actual_engagement
         FROM planned_posts pp
         LEFT JOIN posts p ON p.id = pp.linked_post_id
         LEFT JOIN snapshots s
           ON s.post_id = p.id
          AND s.captured_at = (SELECT MAX(captured_at) FROM snapshots WHERE post_id = p.id)
         ORDER BY pp.planned_at DESC`,
      )
      .all() as PlanRow[];
  } catch {
    return NextResponse.json({ plans: [], suggestion: null, error: SCHEMA_HINT });
  }

  // Account averages, cached per account within this request.
  const avgCache = new Map<string, number | null>();
  const avgFor = (p: Platform, u: string): number | null => {
    const key = `${p}:${u}`;
    if (!avgCache.has(key)) {
      avgCache.set(key, computeAccountMetrics(loadPostStats(db, p, u)).avgEngagement);
    }
    return avgCache.get(key) ?? null;
  };

  const plans: PlanView[] = rows.map((row) => ({
    id: row.id,
    platform: row.platform,
    username: row.username,
    plannedAt: row.planned_at,
    mediaType: row.media_type,
    captionDraft: row.caption_draft,
    hashtags: row.hashtags,
    status: row.status,
    linkedPostId: row.linked_post_id,
    actual:
      row.actual_posted_at !== null && row.actual_engagement !== null
        ? { postedAt: row.actual_posted_at, engagement: row.actual_engagement }
        : null,
    accountAvgEngagement:
      row.status === 'published' ? avgFor(row.platform, row.username) : null,
  }));

  // A prefilled suggestion for the requested account, from its own data.
  let suggestion: PlannerSuggestion | null = null;
  if ((platform === 'instagram' || platform === 'x') && username !== '') {
    const analysis = analyzeAccount(db, platform, username);
    const best = bestHeatmapSlot(analysis.heatmap);
    const topMedia = [...analysis.media]
      .filter((m) => m.mediaType !== 'unknown')
      .sort((a, b) => (b.avgEngagement ?? 0) - (a.avgEngagement ?? 0))[0];
    suggestion = {
      plannedAt: best ? nextSlotIso(best.dayOfWeek, best.hour) : nextSlotIso(4, 18),
      mediaType: (topMedia?.mediaType ?? 'image') as MediaType,
      hashtags: analysis.hashtags.slice(0, 3).map((tag) => tag.hashtag),
    };
  }

  return NextResponse.json({ plans, suggestion });
}

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json().catch(() => null)) as {
    platform?: string;
    username?: string;
    plannedAt?: string;
    mediaType?: string;
    captionDraft?: string;
    hashtags?: string;
  } | null;

  const platform = body?.platform;
  const username = body?.username?.replace(/^@/, '').trim().toLowerCase() ?? '';
  const plannedAt = body?.plannedAt ?? '';
  const mediaType = body?.mediaType ?? 'image';

  if (
    (platform !== 'instagram' && platform !== 'x') ||
    username === '' ||
    !Number.isFinite(Date.parse(plannedAt)) ||
    !['image', 'video', 'carousel', 'text'].includes(mediaType)
  ) {
    return NextResponse.json(
      { error: 'Plan için hesap, geçerli bir tarih ve içerik türü gerekli.' },
      { status: 400 },
    );
  }

  const db = openDbWritable();
  if (!db) {
    return NextResponse.json(
      { error: 'Veritabanı henüz hazır değil.' },
      { status: 409 },
    );
  }
  try {
    db.prepare(
      `INSERT INTO planned_posts (platform, username, planned_at, media_type, caption_draft, hashtags, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      platform,
      username,
      new Date(plannedAt).toISOString(),
      mediaType,
      (body?.captionDraft ?? '').slice(0, 2000),
      (body?.hashtags ?? '').slice(0, 500),
      new Date().toISOString(),
    );
  } catch {
    return NextResponse.json({ error: SCHEMA_HINT }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export function DELETE(request: Request): NextResponse {
  const id = Number(new URL(request.url).searchParams.get('id'));
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: 'Geçersiz plan.' }, { status: 400 });
  }
  const db = openDbWritable();
  if (!db) return NextResponse.json({ ok: true });
  try {
    db.prepare('DELETE FROM planned_posts WHERE id = ?').run(id);
  } catch {
    return NextResponse.json({ error: SCHEMA_HINT }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
