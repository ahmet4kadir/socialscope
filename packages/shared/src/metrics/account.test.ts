import { describe, expect, it } from 'vitest';

import { computeAccountMetrics, mediaTypeBreakdown } from './account';
import type { PostStats } from './types';

const post = (over: Partial<PostStats>): PostStats => ({
  postedAt: '2026-08-03T09:30:00.000Z',
  contentText: '',
  mediaType: 'image',
  hashtags: [],
  likes: 0,
  comments: 0,
  shares: null,
  views: null,
  ...over,
});

// Three Mondays in a row; engagements 15 / 20 / 45.
const POSTS: PostStats[] = [
  post({
    postedAt: '2026-08-03T09:30:00.000Z',
    contentText: 'x'.repeat(40),
    hashtags: ['a', 'b'],
    likes: 10,
    comments: 2,
    shares: 3,
    views: 100,
  }),
  post({
    postedAt: '2026-08-10T09:45:00.000Z',
    mediaType: 'video',
    likes: 20,
  }),
  post({
    postedAt: '2026-08-17T21:15:00.000Z',
    contentText: 'y'.repeat(200),
    hashtags: ['a'],
    likes: 30,
    comments: 10,
    shares: 5,
    views: 300,
  }),
];

describe('computeAccountMetrics', () => {
  it('computes averages, treating missing shares/views as absent, not zero', () => {
    const metrics = computeAccountMetrics(POSTS);
    expect(metrics.postCount).toBe(3);
    expect(metrics.avgLikes).toBe(20);
    expect(metrics.avgComments).toBe(4);
    expect(metrics.avgShares).toBe(4); // only posts A and C report shares
    expect(metrics.avgViews).toBe(200);
    expect(metrics.avgEngagement).toBe(26.67);
  });

  it('computes engagement per view over posts that have views', () => {
    expect(computeAccountMetrics(POSTS).engagementPerView).toBe(0.15); // 60 / 400
  });

  it('computes posting frequency across the observed span', () => {
    const metrics = computeAccountMetrics(POSTS);
    expect(metrics.postingFrequencyPerWeek).toBe(1.45); // 3 posts over 14d 11h45m
    expect(metrics.firstPostAt).toBe('2026-08-03T09:30:00.000Z');
    expect(metrics.lastPostAt).toBe('2026-08-17T21:15:00.000Z');
  });

  it('handles an empty account without crashing', () => {
    const metrics = computeAccountMetrics([]);
    expect(metrics.postCount).toBe(0);
    expect(metrics.avgEngagement).toBeNull();
    expect(metrics.engagementPerView).toBeNull();
    expect(metrics.postingFrequencyPerWeek).toBeNull();
    expect(metrics.firstPostAt).toBeNull();
  });

  it('needs at least two posts for a posting frequency', () => {
    expect(computeAccountMetrics([POSTS[0]!]).postingFrequencyPerWeek).toBeNull();
  });
});

describe('mediaTypeBreakdown', () => {
  it('groups by media type with share and average engagement', () => {
    expect(mediaTypeBreakdown(POSTS)).toEqual([
      { mediaType: 'image', count: 2, percentage: 66.7, avgEngagement: 30 },
      { mediaType: 'video', count: 1, percentage: 33.3, avgEngagement: 20 },
    ]);
  });

  it('returns an empty list for no posts', () => {
    expect(mediaTypeBreakdown([])).toEqual([]);
  });
});
