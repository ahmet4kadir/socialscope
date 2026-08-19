import { NextResponse } from 'next/server';

import type { AccountRole, Platform } from '@socialscope/shared';

import type { AccountSummary } from '@/lib/api-types';
import { openDbReadonly } from '@/lib/server/db';

interface AccountRow {
  platform: Platform;
  username: string;
  role: AccountRole;
  post_count: number;
  last_posted_at: string | null;
  swept_at: string | null;
}

export function GET(): NextResponse {
  const db = openDbReadonly();
  if (!db) {
    return NextResponse.json({ dbReady: false, accounts: [] });
  }

  const rows = db
    .prepare(
      `SELECT p.platform, p.username, MAX(p.role) AS role,
              COUNT(*) AS post_count, MAX(p.posted_at) AS last_posted_at,
              s.swept_at
       FROM posts p
       LEFT JOIN sweeps s ON s.platform = p.platform AND s.username = p.username
       GROUP BY p.platform, p.username, s.swept_at
       ORDER BY p.platform, p.username`,
    )
    .all() as AccountRow[];

  const accounts: AccountSummary[] = rows.map((row) => ({
    platform: row.platform,
    username: row.username,
    role: row.role,
    postCount: row.post_count,
    lastPostedAt: row.last_posted_at,
    sweptAt: row.swept_at,
  }));
  return NextResponse.json({ dbReady: true, accounts });
}
