import { NextResponse } from 'next/server';

import type { AccountRole, Platform } from '@socialscope/shared';

import type { ComparisonAccount, ComparisonResponse } from '@/lib/api-types';
import { analyzeAccount, bestHeatmapSlot } from '@/lib/server/analysis';
import { openDbReadonly } from '@/lib/server/db';

interface AccountRegistryRow {
  platform: Platform;
  username: string;
  role: AccountRole;
}

export function GET(): NextResponse {
  const db = openDbReadonly();
  if (!db) {
    return NextResponse.json({ accounts: [] } satisfies ComparisonResponse);
  }

  let registry: AccountRegistryRow[];
  try {
    registry = db
      .prepare(
        'SELECT platform, username, role FROM accounts ORDER BY role DESC, username',
      )
      .all() as AccountRegistryRow[];
  } catch {
    return NextResponse.json({ accounts: [] } satisfies ComparisonResponse);
  }

  const accounts: ComparisonAccount[] = registry.map((entry) => {
    const analysis = analyzeAccount(db, entry.platform, entry.username);

    const followerPoints = analysis.followers.filter((p) => p.followers !== null);
    const latest = followerPoints[followerPoints.length - 1];
    const previous = followerPoints[followerPoints.length - 2];
    const best = bestHeatmapSlot(analysis.heatmap);
    // media[] is sorted by count; the engagement winner is what marketing wants.
    const topMedia = [...analysis.media].sort(
      (a, b) => (b.avgEngagement ?? 0) - (a.avgEngagement ?? 0),
    )[0];

    return {
      platform: entry.platform,
      username: entry.username,
      role: entry.role,
      postCount: analysis.metrics.postCount,
      profilePostCount: analysis.profilePostCount,
      avgEngagement: analysis.metrics.avgEngagement,
      avgLikes: analysis.metrics.avgLikes,
      avgComments: analysis.metrics.avgComments,
      postingFrequencyPerWeek: analysis.metrics.postingFrequencyPerWeek,
      followers: latest?.followers ?? null,
      followerGrowth:
        latest?.followers != null && previous?.followers != null
          ? latest.followers - previous.followers
          : null,
      bestSlot: best
        ? { dayOfWeek: best.dayOfWeek, hour: best.hour, avgEngagement: best.avgEngagement }
        : null,
      topMediaType: topMedia
        ? { mediaType: topMedia.mediaType, avgEngagement: topMedia.avgEngagement }
        : null,
      topHashtags: analysis.hashtags.slice(0, 3).map((tag) => tag.hashtag),
    };
  });

  return NextResponse.json({ accounts } satisfies ComparisonResponse);
}
