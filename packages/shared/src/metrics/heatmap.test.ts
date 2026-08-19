import { describe, expect, it } from 'vitest';

import { bestHeatmapSlot, engagementHeatmap } from './heatmap';
import type { PostStats } from './types';

const post = (postedAt: string, likes: number): PostStats => ({
  postedAt,
  contentText: '',
  mediaType: 'image',
  hashtags: [],
  likes,
  comments: 0,
  shares: null,
  views: null,
});

// Two posts Monday ~09:30 UTC, one Monday 21:15 UTC.
const POSTS = [
  post('2026-08-03T09:30:00.000Z', 15),
  post('2026-08-10T09:45:00.000Z', 20),
  post('2026-08-17T21:15:00.000Z', 45),
];

describe('engagementHeatmap', () => {
  it('buckets posts by weekday and hour in the requested time zone', () => {
    expect(engagementHeatmap(POSTS, 'UTC')).toEqual([
      { dayOfWeek: 1, hour: 9, count: 2, avgEngagement: 17.5 },
      { dayOfWeek: 1, hour: 21, count: 1, avgEngagement: 45 },
    ]);
  });

  it('shifts into the audience time zone (UTC 21:15 Monday → 00:15 Tuesday in Istanbul)', () => {
    expect(engagementHeatmap(POSTS, 'Europe/Istanbul')).toEqual([
      { dayOfWeek: 1, hour: 12, count: 2, avgEngagement: 17.5 },
      { dayOfWeek: 2, hour: 0, count: 1, avgEngagement: 45 },
    ]);
  });

  it('skips posts with unparseable dates and handles empty input', () => {
    expect(engagementHeatmap([], 'UTC')).toEqual([]);
    expect(engagementHeatmap([post('not-a-date', 10)], 'UTC')).toEqual([]);
  });
});

describe('bestHeatmapSlot', () => {
  it('picks the slot with the highest average engagement', () => {
    const best = bestHeatmapSlot(engagementHeatmap(POSTS, 'UTC'));
    expect(best).toEqual({ dayOfWeek: 1, hour: 21, count: 1, avgEngagement: 45 });
  });

  it('returns null when there is no data', () => {
    expect(bestHeatmapSlot([])).toBeNull();
  });
});
