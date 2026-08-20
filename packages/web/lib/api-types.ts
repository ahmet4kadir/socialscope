import type {
  AccountMetrics,
  AccountRole,
  HashtagMetric,
  HeatmapCell,
  LengthBucketMetric,
  MediaType,
  MediaTypeMetric,
  Platform,
} from '@socialscope/shared';

// Shapes exchanged between the API routes and the client components.

export type JobKind = 'login' | 'scrape' | 'track';
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
  followers: number | null;
  following: number | null;
  /** Follower change since the previous account snapshot; null if <2 snapshots. */
  followerGrowth: number | null;
  /** The profile's real total post count, if captured. */
  profilePostCount: number | null;
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
  /** null = never tracked; 'active' = being tracked; 'stopped' = 48h window over. */
  tracking: 'active' | 'stopped' | null;
}

export interface FollowerPoint {
  capturedAt: string;
  followers: number | null;
  following: number | null;
}

/** Everything the Analiz tab renders for one account. */
export interface AnalysisResponse {
  metrics: AccountMetrics;
  media: MediaTypeMetric[];
  heatmap: HeatmapCell[];
  hashtags: HashtagMetric[];
  contentLength: LengthBucketMetric[];
  followers: FollowerPoint[];
  /** The profile's real total post count (archive holds a growing subset). */
  profilePostCount: number | null;
}

/** One column of the Karşılaştırma (benchmarking) table. */
export interface ComparisonAccount {
  platform: Platform;
  username: string;
  role: AccountRole;
  postCount: number;
  profilePostCount: number | null;
  avgEngagement: number | null;
  avgLikes: number | null;
  avgComments: number | null;
  postingFrequencyPerWeek: number | null;
  followers: number | null;
  followerGrowth: number | null;
  /** Best posting slot: [dayOfWeek 0=Sunday, hour] plus its avg engagement. */
  bestSlot: { dayOfWeek: number; hour: number; avgEngagement: number | null } | null;
  topMediaType: { mediaType: MediaType; avgEngagement: number | null } | null;
  topHashtags: string[];
}

export interface ComparisonResponse {
  accounts: ComparisonAccount[];
}
