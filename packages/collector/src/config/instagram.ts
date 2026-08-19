import type { MediaType } from '@socialscope/shared';

/**
 * Everything tied to Instagram's page structure lives here: URLs, CSS
 * selectors, API response patterns, and scrape pacing. When Instagram changes
 * their frontend, this file is the only place that should need fixing.
 */
export const instagramConfig = {
  urls: {
    home: 'https://www.instagram.com/',
    login: 'https://www.instagram.com/accounts/login/',
    profile: (username: string) =>
      `https://www.instagram.com/${encodeURIComponent(username)}/`,
  },

  /** Cookie that only exists for a logged-in session. */
  sessionCookie: 'sessionid',

  /**
   * URL substrings whose JSON responses carry post data (profile timeline
   * GraphQL queries and the REST feed endpoint).
   */
  apiResponsePatterns: ['/graphql/query', '/api/v1/feed/user/'],

  selectors: {
    /** Initial post data is server-rendered into these blobs. */
    inlineDataScript: 'script[type="application/json"]',
    /** Present when the login page is shown (session missing or expired). */
    loginForm: 'input[name="username"]',
  },

  /**
   * URL path prefixes meaning Instagram is refusing the session. Matched
   * against whole path segments so usernames like "challengemtv" don't
   * false-positive.
   */
  blockedPathPrefixes: ['/accounts/login', '/challenge'],

  timing: {
    /** Random pause between scraper actions, per spec: 2-6s. */
    actionDelayMs: { min: 2000, max: 6000 },
    /** Stop scrolling after this many rounds that surface no new posts. */
    maxStaleScrolls: 3,
    navigationTimeoutMs: 45_000,
  },

  media: {
    /** Instagram media_type codes → our MediaType. */
    typeMap: { 1: 'image', 2: 'video', 8: 'carousel' } as Record<
      number,
      MediaType
    >,
  },
} as const;
