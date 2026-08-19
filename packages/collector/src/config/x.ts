/**
 * Everything tied to X's page structure lives here: URLs, CSS selectors, API
 * response patterns, and scrape pacing. When X changes their frontend, this
 * file is the only place that should need fixing.
 */
export const xConfig = {
  urls: {
    home: 'https://x.com/',
    login: 'https://x.com/i/flow/login',
    profile: (username: string) => `https://x.com/${encodeURIComponent(username)}`,
  },

  /** Cookie that only exists for a logged-in session. */
  sessionCookie: 'auth_token',

  /**
   * URL substrings whose JSON responses carry tweet data (UserTweets,
   * UserMedia, TweetDetail — all GraphQL).
   */
  apiResponsePatterns: ['/i/api/graphql/'],

  selectors: {
    /** Present when the login flow is shown (session missing or expired). */
    loginForm: 'input[autocomplete="username"]',
  },

  /** URL path prefixes meaning X is refusing the session. */
  blockedPathPrefixes: ['/i/flow/login', '/login', '/account/access'],

  timing: {
    /** Random pause between scraper actions, per spec: 2-6s. */
    actionDelayMs: { min: 2000, max: 6000 },
    /** Stop scrolling after this many rounds that surface no new posts. */
    maxStaleScrolls: 3,
    navigationTimeoutMs: 45_000,
  },
} as const;
