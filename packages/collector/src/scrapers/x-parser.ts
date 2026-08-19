import {
  extractHashtags,
  type MediaType,
  type NormalizedPost,
} from '@socialscope/shared';

// X delivers tweets inside GraphQL wrappers that get reshuffled regularly,
// but the tweet "result" object itself (rest_id + legacy counters) has been
// stable for years. As with Instagram, walk the payload and recognize tweet
// objects structurally instead of hardcoding wrapper paths.

const MAX_DEPTH = 30;

type Json = Record<string, unknown>;

function looksLikeTweetResult(obj: Json): boolean {
  if (typeof obj.rest_id !== 'string' || !/^\d+$/.test(obj.rest_id)) return false;
  const { legacy } = obj;
  if (!legacy || typeof legacy !== 'object') return false;
  const tweet = legacy as Json;
  return (
    typeof tweet.full_text === 'string' &&
    typeof tweet.created_at === 'string' &&
    typeof tweet.favorite_count === 'number'
  );
}

/**
 * Extracts every original tweet found anywhere in a JSON payload, normalized
 * and filtered to the expected account. Pure retweets are skipped (their
 * content belongs to another author). Pure function — unit-testable.
 */
export function extractXPosts(
  payload: unknown,
  expectedUsername: string,
): NormalizedPost[] {
  const found = new Map<string, NormalizedPost>();
  walk(payload, 0, (result) => {
    const post = toNormalizedPost(result, expectedUsername);
    if (post) found.set(post.url, post);
  });
  return [...found.values()];
}

function walk(value: unknown, depth: number, onTweet: (t: Json) => void): void {
  if (depth > MAX_DEPTH || value === null || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    for (const item of value) walk(item, depth + 1, onTweet);
    return;
  }
  const obj = value as Json;
  if (looksLikeTweetResult(obj)) {
    // Don't descend into a matched tweet: a quoted tweet nested inside would
    // otherwise surface as a phantom post of this account.
    onTweet(obj);
    return;
  }
  for (const child of Object.values(obj)) walk(child, depth + 1, onTweet);
}

function toNormalizedPost(
  result: Json,
  expectedUsername: string,
): NormalizedPost | null {
  const legacy = result.legacy as Json;

  // Pure retweets carry someone else's content — not this account's output.
  if (legacy.retweeted_status_result !== undefined) return null;

  const username = readScreenName(result) ?? expectedUsername;
  if (username.toLowerCase() !== expectedUsername.toLowerCase()) return null;

  // created_at format: "Wed Oct 10 20:19:24 +0000 2018"
  const date = new Date(legacy.created_at as string);
  if (Number.isNaN(date.getTime())) return null;

  const text = legacy.full_text as string;
  const media = readMedia(legacy);
  const views = readViews(result);
  // Retweets and quote tweets are both reshares of this post.
  const shares = (count(legacy.retweet_count) ?? 0) + (count(legacy.quote_count) ?? 0);

  return {
    date: date.toISOString(),
    platform: 'x',
    username: username.toLowerCase(),
    content_text: text,
    likes: count(legacy.favorite_count) ?? 0,
    comments: count(legacy.reply_count) ?? 0,
    shares,
    ...(views !== undefined ? { views } : {}),
    media_type: media.type,
    hashtags: readHashtags(legacy, text),
    url: `https://x.com/${username.toLowerCase()}/status/${result.rest_id as string}`,
    ...(media.thumbnail !== undefined ? { thumbnail_url: media.thumbnail } : {}),
  };
}

function count(value: unknown): number | undefined {
  return typeof value === 'number' && value >= 0 ? value : undefined;
}

function getPath(obj: Json, path: readonly string[]): unknown {
  let current: unknown = obj;
  for (const key of path) {
    if (!current || typeof current !== 'object') return undefined;
    current = (current as Json)[key];
  }
  return current;
}

function readScreenName(result: Json): string | undefined {
  const user = getPath(result, ['core', 'user_results', 'result']);
  if (!user || typeof user !== 'object') return undefined;
  // screen_name moved from user.legacy to user.core in newer payloads.
  for (const path of [
    ['legacy', 'screen_name'],
    ['core', 'screen_name'],
  ] as const) {
    const value = getPath(user as Json, path);
    if (typeof value === 'string' && value !== '') return value;
  }
  return undefined;
}

function readViews(result: Json): number | undefined {
  const raw = getPath(result, ['views', 'count']);
  if (typeof raw === 'number') return raw >= 0 ? raw : undefined;
  if (typeof raw === 'string' && /^\d+$/.test(raw)) return Number(raw);
  return undefined;
}

function readMedia(legacy: Json): { type: MediaType; thumbnail?: string } {
  const container = legacy.extended_entities ?? legacy.entities;
  const media =
    container && typeof container === 'object' ? (container as Json).media : undefined;
  if (!Array.isArray(media)) return { type: 'text' };
  const items = media.filter((item): item is Json => !!item && typeof item === 'object');
  if (items.length === 0) return { type: 'text' };

  const kinds = new Set(
    items.map((item) => (typeof item.type === 'string' ? item.type : 'photo')),
  );
  const type: MediaType =
    kinds.has('video') || kinds.has('animated_gif')
      ? 'video'
      : items.length > 1
        ? 'carousel'
        : 'image';

  const first = items[0];
  const thumbnail =
    first && typeof first.media_url_https === 'string' && first.media_url_https !== ''
      ? first.media_url_https
      : undefined;
  return { type, ...(thumbnail !== undefined ? { thumbnail } : {}) };
}

function readHashtags(legacy: Json, text: string): string[] {
  const entityTags = getPath(legacy, ['entities', 'hashtags']);
  if (Array.isArray(entityTags)) {
    const tags = new Set<string>();
    for (const tag of entityTags) {
      if (tag && typeof tag === 'object') {
        const value = (tag as Json).text;
        if (typeof value === 'string' && value !== '') tags.add(value.toLowerCase());
      }
    }
    if (tags.size > 0) return [...tags];
  }
  return extractHashtags(text);
}
