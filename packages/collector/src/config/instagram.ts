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
   * URL substrings whose JSON responses carry post or profile data: profile
   * timeline GraphQL queries, the REST feed endpoint, and the profile-info
   * endpoint (which carries follower/following counts).
   */
  apiResponsePatterns: [
    '/graphql', // matches both /graphql/query and /api/graphql
    '/api/v1/feed/user/',
    '/api/v1/users/web_profile_info/',
  ],

  selectors: {
    /** Initial post data is server-rendered into these blobs. */
    inlineDataScript: 'script[type="application/json"]',
    /** Present when the login page is shown (session missing or expired). */
    loginForm: 'input[name="username"]',
  },

  /**
   * Buttons that dismiss interstitial modals blocking the content. These
   * appear when the session's stored choices didn't travel with it (e.g. on
   * a server in another region): the cookie-consent dialog (decline optional
   * cookies, keeping only essential ones) and the "Turn on Notifications" /
   * "Save your login info?" prompts (Not Now). Matched case-insensitively;
   * the browser locale is forced to en-US. Tried in order, each optional.
   */
  dismissButtons: [
    /decline optional cookies|only allow essential cookies/i,
    /not now/i,
  ],

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
