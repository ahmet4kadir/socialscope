import { NextResponse } from 'next/server';

import type { Recommendation } from '@socialscope/shared';

import { recommendationsFor } from '@/lib/server/analysis';
import { openDbReadonly } from '@/lib/server/db';

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
    return NextResponse.json({ recommendations: [] as Recommendation[] });
  }

  return NextResponse.json({ recommendations: recommendationsFor(db, platform, username) });
}
