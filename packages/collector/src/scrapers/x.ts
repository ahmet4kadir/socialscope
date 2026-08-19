import type { Page } from 'playwright';

import type { NormalizedPost } from '@socialscope/shared';

import { xConfig } from '../config/x';
import { PlaywrightScraper } from './base';
import { extractXPosts } from './x-parser';

export class XScraper extends PlaywrightScraper {
  readonly platform = 'x' as const;

  protected readonly timing = xConfig.timing;
  protected readonly apiResponsePatterns = xConfig.apiResponsePatterns;

  protected profileUrl(username: string): string {
    return xConfig.urls.profile(username);
  }

  protected extractPosts(
    payload: unknown,
    usernameFilter: string | null,
  ): NormalizedPost[] {
    return extractXPosts(payload, usernameFilter);
  }

  protected extractInlinePosts(): Promise<NormalizedPost[]> {
    // X is a pure SPA: tweets only ever arrive over the GraphQL API, which
    // the response listener already captures.
    return Promise.resolve([]);
  }

  protected assertPageUsable(page: Page): Promise<void> {
    return this.assertNoLoginWall(
      page,
      xConfig.blockedPathPrefixes,
      xConfig.selectors.loginForm,
    );
  }
}
