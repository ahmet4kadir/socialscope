import type { Page } from 'playwright';

import type { NormalizedPost } from '@socialscope/shared';

import { instagramConfig } from '../config/instagram';
import { PlaywrightScraper } from './base';
import { dumpDebug } from './debug';
import { ScrapeError } from './errors';
import { extractInstagramPosts } from './instagram-parser';

export class InstagramScraper extends PlaywrightScraper {
  readonly platform = 'instagram' as const;

  protected readonly timing = instagramConfig.timing;
  protected readonly apiResponsePatterns = instagramConfig.apiResponsePatterns;

  protected profileUrl(username: string): string {
    return instagramConfig.urls.profile(username);
  }

  protected extractPosts(payload: unknown, username: string): NormalizedPost[] {
    return extractInstagramPosts(payload, username);
  }

  protected async extractInlinePosts(
    page: Page,
    username: string,
  ): Promise<NormalizedPost[]> {
    const blobs = await page
      .$$eval(instagramConfig.selectors.inlineDataScript, (scripts) =>
        scripts.map((script) => script.textContent ?? ''),
      )
      .catch(() => [] as string[]);

    const posts: NormalizedPost[] = [];
    for (const blob of blobs) {
      try {
        posts.push(...extractInstagramPosts(JSON.parse(blob), username));
      } catch {
        // Not JSON we care about.
      }
    }
    return posts;
  }

  protected async assertPageUsable(page: Page): Promise<void> {
    const { pathname } = new URL(page.url());
    const blocked = instagramConfig.blockedPathPrefixes.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    );
    const loginFormVisible = await page
      .locator(instagramConfig.selectors.loginForm)
      .first()
      .isVisible()
      .catch(() => false);

    if (blocked || loginFormVisible) {
      const dump = await dumpDebug(page, this.platform, 'login-wall');
      throw new ScrapeError(
        'Instagram is showing the login/challenge page — the saved session is missing, expired, or flagged.',
        'Run `npm run login -- --platform instagram` to refresh the session.' +
          (dump ? ` Screenshot + HTML saved to ${dump}.*` : ''),
      );
    }
  }
}
