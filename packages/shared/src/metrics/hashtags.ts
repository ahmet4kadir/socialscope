import { engagementOf, mean, type PostStats } from './types';

export interface HashtagMetric {
  hashtag: string;
  count: number;
  avgEngagement: number | null;
}

/**
 * Average engagement of posts using each hashtag, best-performing first
 * (ties: more used wins). Hashtags are already normalized to lowercase by
 * the scrapers.
 */
export function hashtagEngagement(posts: PostStats[]): HashtagMetric[] {
  const groups = new Map<string, number[]>();
  for (const post of posts) {
    const engagement = engagementOf(post);
    for (const hashtag of new Set(post.hashtags)) {
      const group = groups.get(hashtag) ?? [];
      group.push(engagement);
      groups.set(hashtag, group);
    }
  }

  return [...groups.entries()]
    .map(([hashtag, engagements]) => ({
      hashtag,
      count: engagements.length,
      avgEngagement: mean(engagements),
    }))
    .sort(
      (a, b) =>
        (b.avgEngagement ?? 0) - (a.avgEngagement ?? 0) || b.count - a.count,
    );
}
