import { describe, expect, it } from 'vitest';

import { hashtagEngagement } from './hashtags';
import type { PostStats } from './types';

const post = (hashtags: string[], likes: number): PostStats => ({
  postedAt: '2026-08-03T09:30:00.000Z',
  contentText: '',
  mediaType: 'image',
  hashtags,
  likes,
  comments: 0,
  shares: null,
  views: null,
});

describe('hashtagEngagement', () => {
  it('averages engagement per hashtag, best first', () => {
    const result = hashtagEngagement([
      post(['a', 'b'], 15),
      post([], 20),
      post(['a'], 45),
    ]);
    expect(result).toEqual([
      { hashtag: 'a', count: 2, avgEngagement: 30 },
      { hashtag: 'b', count: 1, avgEngagement: 15 },
    ]);
  });

  it('counts a hashtag once per post even if repeated', () => {
    expect(hashtagEngagement([post(['a', 'a'], 10)])).toEqual([
      { hashtag: 'a', count: 1, avgEngagement: 10 },
    ]);
  });

  it('returns an empty list when no post has hashtags', () => {
    expect(hashtagEngagement([post([], 10)])).toEqual([]);
  });
});
