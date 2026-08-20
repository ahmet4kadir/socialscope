import { describe, expect, it } from 'vitest';

import { computeAccountMetrics } from './metrics/account';
import type { PostStats } from './metrics/types';
import {
  buildRecommendations,
  type RecommendationInput,
} from './recommendations';

const post = (over: Partial<PostStats>): PostStats => ({
  postedAt: '2026-08-03T09:30:00.000Z',
  contentText: 'x'.repeat(40),
  mediaType: 'image',
  hashtags: [],
  likes: 10,
  comments: 0,
  shares: null,
  views: null,
  ...over,
});

function baseInput(over: Partial<RecommendationInput> = {}): RecommendationInput {
  return {
    username: 'demouser',
    // Two posts 14 days apart → 1 post/week.
    metrics: computeAccountMetrics([
      post({}),
      post({ likes: 20, postedAt: '2026-08-17T09:30:00.000Z' }),
    ]),
    heatmap: [],
    media: [],
    hashtags: [],
    contentLength: [],
    followers: { current: 300, growth: null },
    competitors: [],
    ...over,
  };
}

const ids = (input: RecommendationInput): string[] =>
  buildRecommendations(input).map((r) => r.id);

describe('buildRecommendations', () => {
  it('returns nothing when no rule has enough evidence', () => {
    expect(buildRecommendations(baseInput())).toEqual([]);
  });

  it('recommends the best posting hour only when it clearly beats the average', () => {
    const strong = baseInput({
      heatmap: [
        { dayOfWeek: 4, hour: 16, count: 2, avgEngagement: 30 },
        { dayOfWeek: 1, hour: 9, count: 2, avgEngagement: 10 },
      ],
    });
    const recs = buildRecommendations(strong);
    const bestHour = recs.find((r) => r.id === 'best-hour');
    expect(bestHour?.priority).toBe('high');
    expect(bestHour?.title).toContain('Perşembe 16:00');
    expect(bestHour?.evidence).toContain('30');

    const weak = baseInput({
      heatmap: [{ dayOfWeek: 4, hour: 16, count: 2, avgEngagement: 16 }],
    });
    expect(ids(weak)).not.toContain('best-hour');
  });

  it('flags a cadence gap against the fastest competitor', () => {
    const input = baseInput({
      competitors: [
        {
          username: 'rakip',
          avgEngagement: null,
          postingFrequencyPerWeek: 3,
          followers: null,
          topHashtags: [],
        },
      ],
    });
    const rec = buildRecommendations(input).find((r) => r.id === 'cadence');
    expect(rec?.priority).toBe('high');
    expect(rec?.evidence).toContain('@rakip');
  });

  it('suggests starting hashtags using the competitor as reference', () => {
    const input = baseInput({
      competitors: [
        {
          username: 'rakip',
          avgEngagement: null,
          postingFrequencyPerWeek: null,
          followers: null,
          topHashtags: ['kahve', 'istanbul'],
        },
      ],
    });
    const rec = buildRecommendations(input).find((r) => r.id === 'hashtag-start');
    expect(rec?.advice).toContain('#kahve');
    expect(rec?.evidence).toContain('@rakip');
  });

  it('raises a high-priority alert on follower loss', () => {
    const rec = buildRecommendations(
      baseInput({ followers: { current: 290, growth: -12 } }),
    ).find((r) => r.id === 'follower-drop');
    expect(rec?.priority).toBe('high');
    expect(rec?.evidence).toContain('12');
    expect(
      ids(baseInput({ followers: { current: 300, growth: 5 } })),
    ).not.toContain('follower-drop');
  });

  it('compares engagement per 1000 followers in both directions', () => {
    const competitors = [
      {
        username: 'rakip',
        avgEngagement: 5,
        postingFrequencyPerWeek: null,
        followers: 1000,
        topHashtags: [],
      },
    ];
    // Mine: avgEngagement 15 over 300 followers → 50/1k vs competitor 5/1k.
    const strong = buildRecommendations(baseInput({ competitors }));
    expect(strong.map((r) => r.id)).toContain('engagement-rate-strong');

    // Mine: 15 eng over 30000 followers → 0.5/1k vs competitor 5/1k.
    const weak = buildRecommendations(
      baseInput({ competitors, followers: { current: 30000, growth: null } }),
    );
    expect(weak.map((r) => r.id)).toContain('engagement-rate-weak');
  });

  it('sorts recommendations by priority', () => {
    const input = baseInput({
      heatmap: [
        { dayOfWeek: 4, hour: 16, count: 2, avgEngagement: 30 },
        { dayOfWeek: 1, hour: 9, count: 2, avgEngagement: 10 },
      ],
      competitors: [
        {
          username: 'rakip',
          avgEngagement: 5,
          postingFrequencyPerWeek: null,
          followers: 1000,
          topHashtags: ['kahve'],
        },
      ],
    });
    const recs = buildRecommendations(input);
    const priorities = recs.map((r) => r.priority);
    const order = { high: 0, medium: 1, low: 2 } as const;
    const sorted = [...priorities].sort((a, b) => order[a] - order[b]);
    expect(priorities).toEqual(sorted);
    expect(recs.length).toBeGreaterThanOrEqual(3);
  });
});
