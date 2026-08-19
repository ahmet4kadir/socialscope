import type { MediaType } from '../types';

/**
 * The minimal post shape the metrics engine works on. Both the web app's DB
 * rows and NormalizedPost map onto this trivially.
 */
export interface PostStats {
  postedAt: string;
  contentText: string;
  mediaType: MediaType;
  hashtags: string[];
  likes: number;
  comments: number;
  shares: number | null;
  views: number | null;
}

/** One time-series observation of a post's counters. */
export interface SnapshotPoint {
  capturedAt: string;
  likes: number;
  comments: number;
  shares: number | null;
  views: number | null;
}

/**
 * Engagement = likes + comments + shares. Views are reach, not engagement,
 * so they stay separate. (Follower counts aren't scraped, so "engagement
 * rate" here is per-post and per-view, not per-follower.)
 */
export function engagementOf(post: {
  likes: number;
  comments: number;
  shares?: number | null;
}): number {
  return post.likes + post.comments + (post.shares ?? 0);
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Mean of a list, rounded to 2 decimals; null for an empty list. */
export function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return round2(values.reduce((sum, v) => sum + v, 0) / values.length);
}

/** Posts with an unparseable date can't be placed in time — drop them. */
export function withValidDate<T extends { postedAt: string }>(posts: T[]): T[] {
  return posts.filter((post) => Number.isFinite(Date.parse(post.postedAt)));
}
