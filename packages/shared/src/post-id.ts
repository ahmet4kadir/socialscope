import type { Platform } from './types';

const ID_PATTERNS: Record<Platform, RegExp> = {
  instagram: /instagram\.com\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/,
  x: /(?:twitter|x)\.com\/[^/]+\/status\/(\d+)/,
};

/**
 * Derives the stable platform-scoped post id (posts.id in SQLite) from a post
 * URL, e.g. "instagram:DGxYz12" or "x:1234567890". Returns null for URLs that
 * don't look like a post on that platform.
 */
export function derivePostId(platform: Platform, url: string): string | null {
  const match = ID_PATTERNS[platform].exec(url);
  return match?.[1] ? `${platform}:${match[1]}` : null;
}
