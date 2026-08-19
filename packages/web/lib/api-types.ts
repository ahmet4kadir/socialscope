import type { AccountRole, MediaType, Platform } from '@socialscope/shared';

// Shapes exchanged between the API routes and the client components.

export type JobKind = 'login' | 'scrape';
export type JobStatus = 'running' | 'succeeded' | 'failed';

export interface JobView {
  id: string;
  kind: JobKind;
  title: string;
  status: JobStatus;
  startedAt: string;
  finishedAt: string | null;
  /** Rolling tail of the underlying CLI's output. */
  lines: string[];
}

export interface SessionInfo {
  platform: Platform;
  saved: boolean;
  savedAt: string | null;
}

export interface AccountSummary {
  platform: Platform;
  username: string;
  role: AccountRole;
  addedAt: string;
  postCount: number;
  lastPostedAt: string | null;
  sweptAt: string | null;
  avgLikes: number | null;
  avgComments: number | null;
}

export interface PostWithMetrics {
  id: string;
  postedAt: string;
  contentText: string;
  mediaType: MediaType;
  hashtags: string[];
  url: string;
  thumbnailUrl: string | null;
  likes: number;
  comments: number;
  shares: number | null;
  views: number | null;
  capturedAt: string;
}
