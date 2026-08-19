export type Platform = 'instagram' | 'x';

export type AccountRole = 'me' | 'competitor';

export type MediaType = 'image' | 'video' | 'carousel' | 'text' | 'unknown';

/**
 * A post normalized to the shape every data source produces
 * (Playwright scrapers, CSV import). All timestamps are ISO 8601 UTC.
 */
export interface NormalizedPost {
  /** Publication timestamp of the post. */
  date: string;
  platform: Platform;
  username: string;
  content_text: string;
  likes: number;
  comments: number;
  shares?: number;
  views?: number;
  media_type: MediaType;
  hashtags: string[];
  /** Canonical URL of the post; doubles as its stable external identifier. */
  url: string;
  /** Small preview image URL from the platform CDN, when available. */
  thumbnail_url?: string;
}

/** Account-level (profile) stats captured alongside a post scrape. */
export interface AccountInfo {
  followers: number | null;
  following: number | null;
  postCount: number | null;
}

/**
 * A source of posts for one platform. Implementations: InstagramScraper,
 * XScraper, CSV import.
 */
export interface DataSource {
  readonly platform: Platform;
  fetchPosts(username: string, limit: number): Promise<NormalizedPost[]>;
}

// ---------------------------------------------------------------------------
// Database row shapes (mirror the SQLite schema in
// packages/collector/src/db/migrations). Kept here so the collector (writer)
// and the web app (read-only) agree on one contract.
// ---------------------------------------------------------------------------

export interface PostRow {
  /** Platform-scoped stable id, e.g. "instagram:DGxYz12" or "x:1234567890". */
  id: string;
  platform: Platform;
  username: string;
  role: AccountRole;
  posted_at: string;
  content_text: string;
  media_type: MediaType;
  /** JSON-encoded string[] of hashtags (without the leading '#'). */
  hashtags_json: string;
  url: string;
  thumbnail_url: string | null;
}

export interface AccountRow {
  platform: Platform;
  username: string;
  role: AccountRole;
  added_at: string;
}

export interface SnapshotRow {
  post_id: string;
  captured_at: string;
  likes: number;
  comments: number;
  shares: number | null;
  views: number | null;
}

export interface TrackedPostRow {
  post_id: string;
  tracking_started_at: string;
  /** Hard deadline: the tracker ignores this row once now >= auto_stop_at. */
  auto_stop_at: string;
  /** SQLite boolean: 1 = still tracking, 0 = stopped. */
  active: 0 | 1;
}

export interface SweepRow {
  platform: Platform;
  username: string;
  /** Last completed account sweep; backs the 6h scrape cache. */
  swept_at: string;
}
