import type { Page } from 'playwright';

import type { NormalizedPost } from '@socialscope/shared';

import { instagramConfig } from '../config/instagram';
import { PlaywrightScraper } from './base';
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

  protected assertPageUsable(page: Page): Promise<void> {
    return this.assertNoLoginWall(
      page,
      instagramConfig.blockedPathPrefixes,
      instagramConfig.selectors.loginForm,
    );
  }
}
