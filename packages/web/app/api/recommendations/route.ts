import { NextResponse } from 'next/server';

import {
  buildRecommendations,
  type AccountRole,
  type CompetitorSummary,
  type Platform,
  type Recommendation,
} from '@socialscope/shared';

import { analyzeAccount } from '@/lib/server/analysis';
import { openDbReadonly } from '@/lib/server/db';

interface AccountRegistryRow {
  platform: Platform;
  username: string;
  role: AccountRole;
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
    return NextResponse.json({ recommendations: [] as Recommendation[] });
  }

  const analysis = analyzeAccount(db, platform, username);
  const followerPoints = analysis.followers.filter((p) => p.followers !== null);
  const latest = followerPoints[followerPoints.length - 1];
  const previous = followerPoints[followerPoints.length - 2];

  // Every other registered account acts as a benchmark.
  let registry: AccountRegistryRow[] = [];
  try {
    registry = db
      .prepare('SELECT platform, username, role FROM accounts')
      .all() as AccountRegistryRow[];
  } catch {
    // accounts table missing — no competitors to compare against.
  }

  const competitors: CompetitorSummary[] = registry
    .filter((entry) => !(entry.platform === platform && entry.username === username))
    .map((entry) => {
      const theirAnalysis = analyzeAccount(db, entry.platform, entry.username);
      const theirFollowers = theirAnalysis.followers.filter((p) => p.followers !== null);
      return {
        username: entry.username,
        avgEngagement: theirAnalysis.metrics.avgEngagement,
        postingFrequencyPerWeek: theirAnalysis.metrics.postingFrequencyPerWeek,
        followers: theirFollowers[theirFollowers.length - 1]?.followers ?? null,
        topHashtags: theirAnalysis.hashtags.slice(0, 3).map((tag) => tag.hashtag),
      };
    })
    .filter((summary) => summary.avgEngagement !== null || summary.postingFrequencyPerWeek !== null);

  const recommendations = buildRecommendations({
    username,
    metrics: analysis.metrics,
    heatmap: analysis.heatmap,
    media: analysis.media,
    hashtags: analysis.hashtags,
    contentLength: analysis.contentLength,
    followers: {
      current: latest?.followers ?? null,
      growth:
        latest?.followers != null && previous?.followers != null
          ? latest.followers - previous.followers
          : null,
    },
    competitors,
  });

  return NextResponse.json({ recommendations });
}
