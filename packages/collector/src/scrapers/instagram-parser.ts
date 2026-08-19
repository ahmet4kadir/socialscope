import {
  extractHashtags,
  type MediaType,
  type NormalizedPost,
} from '@socialscope/shared';

import { instagramConfig } from '../config/instagram';

// Instagram delivers post data as JSON in several wrappers (GraphQL
// connections, REST feed items, preloader caches), but the media objects
// inside share stable field names. Rather than hardcoding wrapper paths that
// change monthly, walk the payload and recognize media objects structurally.

// Depth counts every object key AND array index. Instagram's inline Relay
// wrapper (ScheduledServerJS → __bbox.require → RelayPrefetchedStreamCache →
// __bbox.result.data.…connection.edges[].node) puts media at depth ~16, so
// leave generous headroom; the cap only guards against pathological payloads.
const MAX_DEPTH = 30;
const SHORTCODE_PATTERN = /^[A-Za-z0-9_-]{5,}$/;

type Json = Record<string, unknown>;

function looksLikeMedia(obj: Json): boolean {
  return (
    typeof obj.code === 'string' &&
    SHORTCODE_PATTERN.test(obj.code) &&
    typeof obj.taken_at === 'number' &&
    (typeof obj.like_count === 'number' || typeof obj.comment_count === 'number')
  );
}

/**
 * Extracts every Instagram post found anywhere in a JSON payload, normalized
 * and filtered to the expected account. Pure function — unit-testable with
 * fixture payloads.
 */
export function extractInstagramPosts(
  payload: unknown,
  expectedUsername: string,
): NormalizedPost[] {
  const found = new Map<string, NormalizedPost>();
  walk(payload, 0, (media) => {
    const post = toNormalizedPost(media, expectedUsername);
    if (post) found.set(post.url, post);
  });
  return [...found.values()];
}

function walk(value: unknown, depth: number, onMedia: (m: Json) => void): void {
  if (depth > MAX_DEPTH || value === null || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    for (const item of value) walk(item, depth + 1, onMedia);
    return;
  }
  const obj = value as Json;
  if (looksLikeMedia(obj)) {
    // Don't descend into a media object: carousel children would otherwise
    // surface as phantom posts.
    onMedia(obj);
    return;
  }
  for (const child of Object.values(obj)) walk(child, depth + 1, onMedia);
}

function toNormalizedPost(
  media: Json,
  expectedUsername: string,
): NormalizedPost | null {
  const code = media.code as string;
  const username = readUsername(media) ?? expectedUsername;
  if (username.toLowerCase() !== expectedUsername.toLowerCase()) return null;

  const caption = readCaption(media);
  const productType = typeof media.product_type === 'string' ? media.product_type : '';
  const url =
    productType === 'clips'
      ? `https://www.instagram.com/reel/${code}/`
      : `https://www.instagram.com/p/${code}/`;

  const takenAt = media.taken_at as number;
  const takenAtSeconds = takenAt > 1e12 ? Math.round(takenAt / 1000) : takenAt;

  const views =
    count(media.play_count) ?? count(media.view_count) ?? count(media.ig_play_count);
  const shares = count(media.reshare_count);

  return {
    date: new Date(takenAtSeconds * 1000).toISOString(),
    platform: 'instagram',
    username: username.toLowerCase(),
    content_text: caption,
    // Hidden like counts come through as -1/undefined → treat as 0.
    likes: count(media.like_count) ?? 0,
    comments: count(media.comment_count) ?? 0,
    ...(shares !== undefined ? { shares } : {}),
    ...(views !== undefined ? { views } : {}),
    media_type: readMediaType(media, productType),
    hashtags: extractHashtags(caption),
    url,
  };
}

function count(value: unknown): number | undefined {
  return typeof value === 'number' && value >= 0 ? value : undefined;
}

function readUsername(media: Json): string | undefined {
  for (const key of ['user', 'owner'] as const) {
    const nested = media[key];
    if (nested && typeof nested === 'object') {
      const { username } = nested as Json;
      if (typeof username === 'string' && username) return username;
    }
  }
  return undefined;
}

function readCaption(media: Json): string {
  const { caption } = media;
  if (typeof caption === 'string') return caption;
  if (caption && typeof caption === 'object') {
    const { text } = caption as Json;
    if (typeof text === 'string') return text;
  }
  return '';
}

function readMediaType(media: Json, productType: string): MediaType {
  if (productType === 'clips') return 'video';
  if (typeof media.media_type === 'number') {
    return instagramConfig.media.typeMap[media.media_type] ?? 'unknown';
  }
  return 'unknown';
}
