import { engagementOf, mean, type PostStats } from './types';

export interface LengthBucketMetric {
  /** Stable bucket key, e.g. "0", "1-50", "301+". */
  bucket: string;
  minLength: number;
  maxLength: number | null;
  count: number;
  avgEngagement: number | null;
}

const BUCKETS: Array<{ bucket: string; minLength: number; maxLength: number | null }> = [
  { bucket: '0', minLength: 0, maxLength: 0 },
  { bucket: '1-50', minLength: 1, maxLength: 50 },
  { bucket: '51-150', minLength: 51, maxLength: 150 },
  { bucket: '151-300', minLength: 151, maxLength: 300 },
  { bucket: '301+', minLength: 301, maxLength: null },
];

/**
 * Caption length vs performance. Buckets with zero posts are omitted so
 * consumers can distinguish "no data" from "tried and flopped".
 */
export function contentLengthPerformance(posts: PostStats[]): LengthBucketMetric[] {
  const result: LengthBucketMetric[] = [];
  for (const { bucket, minLength, maxLength } of BUCKETS) {
    const group = posts.filter((post) => {
      const length = post.contentText.length;
      return length >= minLength && (maxLength === null || length <= maxLength);
    });
    if (group.length === 0) continue;
    result.push({
      bucket,
      minLength,
      maxLength,
      count: group.length,
      avgEngagement: mean(group.map(engagementOf)),
    });
  }
  return result;
}
