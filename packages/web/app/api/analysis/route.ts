import { NextResponse } from 'next/server';

import { computeAccountMetrics } from '@socialscope/shared';

import type { AnalysisResponse } from '@/lib/api-types';
import { analyzeAccount } from '@/lib/server/analysis';
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
    const empty: AnalysisResponse = {
      metrics: computeAccountMetrics([]),
      media: [],
      heatmap: [],
      hashtags: [],
      contentLength: [],
      followers: [],
    };
    return NextResponse.json(empty);
  }

  return NextResponse.json(analyzeAccount(db, platform, username));
}
