import { describe, expect, it } from 'vitest';

import { contentLengthPerformance } from './content-length';
import type { PostStats } from './types';

const post = (contentText: string, likes: number): PostStats => ({
  postedAt: '2026-08-03T09:30:00.000Z',
  contentText,
  mediaType: 'image',
  hashtags: [],
  likes,
  comments: 0,
  shares: null,
  views: null,
});

describe('contentLengthPerformance', () => {
  it('buckets by caption length and omits empty buckets', () => {
    const result = contentLengthPerformance([
      post('', 20),
      post('x'.repeat(40), 15),
      post('y'.repeat(200), 45),
    ]);
    expect(result).toEqual([
      { bucket: '0', minLength: 0, maxLength: 0, count: 1, avgEngagement: 20 },
      { bucket: '1-50', minLength: 1, maxLength: 50, count: 1, avgEngagement: 15 },
      { bucket: '151-300', minLength: 151, maxLength: 300, count: 1, avgEngagement: 45 },
    ]);
  });

  it('puts very long captions in the open-ended bucket', () => {
    const result = contentLengthPerformance([post('z'.repeat(500), 10)]);
    expect(result).toEqual([
      { bucket: '301+', minLength: 301, maxLength: null, count: 1, avgEngagement: 10 },
    ]);
  });

  it('handles empty input', () => {
    expect(contentLengthPerformance([])).toEqual([]);
  });
});
