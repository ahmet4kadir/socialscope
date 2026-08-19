import type { MediaType } from '../types';
import {
  engagementOf,
  mean,
  round2,
  withValidDate,
  type PostStats,
} from './types';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface AccountMetrics {
  postCount: number;
  avgLikes: number | null;
  avgComments: number | null;
  /** Averaged only over posts where the platform reports the value. */
  avgShares: number | null;
  avgViews: number | null;
  avgEngagement: number | null;
  /** Total engagement / total views, over posts with views. Null without views. */
  engagementPerView: number | null;
  /** Posts per week across the observed posting span. Null with <2 posts. */
  postingFrequencyPerWeek: number | null;
  firstPostAt: string | null;
  lastPostAt: string | null;
}

export function computeAccountMetrics(posts: PostStats[]): AccountMetrics {
  const shares = posts.map((p) => p.shares).filter((v): v is number => v !== null);
  const views = posts.map((p) => p.views).filter((v): v is number => v !== null);

  const viewed = posts.filter((p) => p.views !== null && p.views > 0);
  const totalViews = viewed.reduce((sum, p) => sum + (p.views ?? 0), 0);
  const engagementPerView =
    totalViews > 0
      ? Math.round(
          (viewed.reduce((sum, p) => sum + engagementOf(p), 0) / totalViews) * 10000,
        ) / 10000
      : null;

  const dated = withValidDate(posts)
    .map((p) => Date.parse(p.postedAt))
    .sort((a, b) => a - b);
  const first = dated[0];
  const last = dated[dated.length - 1];
  let postingFrequencyPerWeek: number | null = null;
  if (dated.length >= 2 && first !== undefined && last !== undefined) {
    const spanDays = Math.max((last - first) / DAY_MS, 1);
    postingFrequencyPerWeek = round2(dated.length / (spanDays / 7));
  }

  return {
    postCount: posts.length,
    avgLikes: mean(posts.map((p) => p.likes)),
    avgComments: mean(posts.map((p) => p.comments)),
    avgShares: mean(shares),
    avgViews: mean(views),
    avgEngagement: mean(posts.map(engagementOf)),
    engagementPerView,
    postingFrequencyPerWeek,
    firstPostAt: first !== undefined ? new Date(first).toISOString() : null,
    lastPostAt: last !== undefined ? new Date(last).toISOString() : null,
  };
}

export interface MediaTypeMetric {
  mediaType: MediaType;
  count: number;
  /** Share of all posts, 0-100 with one decimal. */
  percentage: number;
  avgEngagement: number | null;
}

/** Post count + average engagement per media type, most used first. */
export function mediaTypeBreakdown(posts: PostStats[]): MediaTypeMetric[] {
  const groups = new Map<MediaType, PostStats[]>();
  for (const post of posts) {
    const group = groups.get(post.mediaType) ?? [];
    group.push(post);
    groups.set(post.mediaType, group);
  }
  return [...groups.entries()]
    .map(([mediaType, group]) => ({
      mediaType,
      count: group.length,
      percentage: Math.round((group.length / posts.length) * 1000) / 10,
      avgEngagement: mean(group.map(engagementOf)),
    }))
    .sort((a, b) => b.count - a.count);
}
