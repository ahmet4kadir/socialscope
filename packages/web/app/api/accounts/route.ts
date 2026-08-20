import { NextResponse } from 'next/server';

import type { AccountRole, Platform } from '@socialscope/shared';

import type { AccountSummary } from '@/lib/api-types';
import { openDbReadonly, openDbWritable } from '@/lib/server/db';

const USERNAME_PATTERN = /^[a-z0-9._]{1,40}$/i;

interface DashboardRow {
  platform: Platform;
  username: string;
  role: AccountRole;
  added_at: string;
  post_count: number;
  last_posted_at: string | null;
  swept_at: string | null;
  avg_likes: number | null;
  avg_comments: number | null;
}

interface FollowerRow {
  followers: number | null;
  following: number | null;
  prev_followers: number | null;
  post_count: number | null;
}

/** Where the daily archive deepening stops (mirrors the tracker's ARCHIVE_CAP). */
const ARCHIVE_CAP = Math.max(25, Number(process.env.ARCHIVE_CAP ?? 100) || 100);

export function GET(): NextResponse {
  const db = openDbReadonly();
  if (!db) {
    return NextResponse.json({ dbReady: false, accounts: [] });
  }

  let rows: DashboardRow[];
  try {
    rows = db
      .prepare(
        `SELECT a.platform, a.username, a.role, a.added_at,
                COUNT(p.id) AS post_count,
                MAX(p.posted_at) AS last_posted_at,
                sw.swept_at,
                ROUND(AVG(snap.likes), 1) AS avg_likes,
                ROUND(AVG(snap.comments), 1) AS avg_comments
         FROM accounts a
         LEFT JOIN posts p
           ON p.platform = a.platform AND p.username = a.username
         LEFT JOIN (
           SELECT s.post_id, s.likes, s.comments
           FROM snapshots s
           WHERE s.captured_at = (SELECT MAX(captured_at) FROM snapshots WHERE post_id = s.post_id)
         ) snap ON snap.post_id = p.id
         LEFT JOIN sweeps sw
           ON sw.platform = a.platform AND sw.username = a.username
         GROUP BY a.platform, a.username, a.role, a.added_at, sw.swept_at
         ORDER BY a.role DESC, a.username`,
      )
      .all() as DashboardRow[];
  } catch {
    // accounts table missing → migration 002 hasn't run yet.
    return NextResponse.json({
      dbReady: false,
      accounts: [],
      error: 'Veritabanı şeması eski, `npm run migrate` çalıştırın.',
    });
  }

  // Latest two follower snapshots per account → current count + growth delta.
  const followerStmt = db.prepare(
    `SELECT followers, following, prev_followers, post_count FROM (
       SELECT followers, following, post_count,
              LEAD(followers) OVER (ORDER BY captured_at DESC) AS prev_followers,
              ROW_NUMBER() OVER (ORDER BY captured_at DESC) AS rn
       FROM account_snapshots
       WHERE platform = ? AND username = ?
     ) WHERE rn = 1`,
  );

  const accounts: AccountSummary[] = rows.map((row) => {
    let followers: number | null = null;
    let following: number | null = null;
    let followerGrowth: number | null = null;
    let profilePostCount: number | null = null;
    try {
      const f = followerStmt.get(row.platform, row.username) as FollowerRow | undefined;
      if (f) {
        followers = f.followers;
        following = f.following;
        profilePostCount = f.post_count;
        followerGrowth =
          f.followers !== null && f.prev_followers !== null
            ? f.followers - f.prev_followers
            : null;
      }
    } catch {
      // account_snapshots table missing (pre-migration-003), leave nulls.
    }
    return {
      profilePostCount,
      platform: row.platform,
      username: row.username,
      role: row.role,
      addedAt: row.added_at,
      postCount: row.post_count,
      lastPostedAt: row.last_posted_at,
      sweptAt: row.swept_at,
      avgLikes: row.avg_likes,
      avgComments: row.avg_comments,
      followers,
      following,
      followerGrowth,
    };
  });
  return NextResponse.json({ dbReady: true, accounts, archiveCap: ARCHIVE_CAP });
}

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json().catch(() => null)) as {
    platform?: string;
    username?: string;
    role?: string;
  } | null;

  if (body?.platform !== 'instagram' && body?.platform !== 'x') {
    return NextResponse.json({ error: 'Geçersiz platform.' }, { status: 400 });
  }
  const username = body.username?.replace(/^@/, '').trim().toLowerCase() ?? '';
  if (!USERNAME_PATTERN.test(username)) {
    return NextResponse.json(
      { error: 'Geçersiz kullanıcı adı, harf, rakam, nokta ve alt çizgi kullanın.' },
      { status: 400 },
    );
  }
  if (body.role !== 'me' && body.role !== 'competitor') {
    return NextResponse.json(
      { error: 'Hesap rolünü seçin: benim hesabım mı, rakip mi?' },
      { status: 400 },
    );
  }

  const db = openDbWritable();
  if (!db) {
    return NextResponse.json(
      { error: 'Veritabanı henüz yok, önce `npm run migrate` çalıştırın.' },
      { status: 409 },
    );
  }
  try {
    db.prepare(
      `INSERT INTO accounts (platform, username, role, added_at) VALUES (?, ?, ?, ?)
       ON CONFLICT (platform, username) DO UPDATE SET role = excluded.role`,
    ).run(body.platform, username, body.role, new Date().toISOString());
  } catch {
    return NextResponse.json(
      { error: 'Hesap kaydedilemedi, veritabanı şeması eski olabilir, `npm run migrate` çalıştırın.' },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true });
}

export function DELETE(request: Request): NextResponse {
  const { searchParams } = new URL(request.url);
  const platform = searchParams.get('platform');
  const username = searchParams.get('username')?.toLowerCase() ?? '';

  if ((platform !== 'instagram' && platform !== 'x') || username === '') {
    return NextResponse.json(
      { error: 'platform ve username parametreleri gerekli.' },
      { status: 400 },
    );
  }

  const db = openDbWritable();
  if (!db) {
    return NextResponse.json({ ok: true }); // nothing to remove
  }
  // Only the registry entry is removed; scraped posts/snapshots stay and
  // reappear if the account is added again.
  db.prepare('DELETE FROM accounts WHERE platform = ? AND username = ?').run(
    platform,
    username,
  );
  return NextResponse.json({ ok: true });
}
