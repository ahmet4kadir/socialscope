import type { Page } from 'playwright';

import type { AccountInfo, NormalizedPost } from '@socialscope/shared';

import { instagramConfig } from '../config/instagram';
import { PlaywrightScraper } from './base';
import {
  extractInstagramAccountInfo,
  extractInstagramPosts,
} from './instagram-parser';

export class InstagramScraper extends PlaywrightScraper {
  readonly platform = 'instagram' as const;

  protected readonly timing = instagramConfig.timing;
  protected readonly apiResponsePatterns = instagramConfig.apiResponsePatterns;

  protected profileUrl(username: string): string {
    return instagramConfig.urls.profile(username);
  }

  protected extractPosts(
    payload: unknown,
    usernameFilter: string | null,
  ): NormalizedPost[] {
    return extractInstagramPosts(payload, usernameFilter);
  }

  protected extractAccountInfo(payload: unknown, username: string): AccountInfo | null {
    return extractInstagramAccountInfo(payload, username);
  }

  protected override async extractInlineAccountInfo(
    page: Page,
    username: string,
  ): Promise<AccountInfo | null> {
    const blobs = await page
      .$$eval(instagramConfig.selectors.inlineDataScript, (scripts) =>
        scripts.map((script) => script.textContent ?? ''),
      )
      .catch(() => [] as string[]);
    for (const blob of blobs) {
      try {
        const info = extractInstagramAccountInfo(JSON.parse(blob), username);
        if (info?.followers != null) return info;
      } catch {
        // Not JSON we care about.
      }
    }
    return null;
  }

  protected async extractInlinePosts(
    page: Page,
    usernameFilter: string | null,
  ): Promise<NormalizedPost[]> {
    const blobs = await page
      .$$eval(instagramConfig.selectors.inlineDataScript, (scripts) =>
        scripts.map((script) => script.textContent ?? ''),
      )
      .catch(() => [] as string[]);

    const posts: NormalizedPost[] = [];
    for (const blob of blobs) {
      try {
        posts.push(...extractInstagramPosts(JSON.parse(blob), usernameFilter));
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

  protected override async dismissInterstitials(page: Page): Promise<void> {
    // The consent modal lives in a dialog; decline optional cookies so only
    // essential ones remain, then let the content load.
    const decline = page
      .getByRole('button', { name: instagramConfig.cookieDeclineButton })
      .first();
    try {
      if (await decline.isVisible({ timeout: 3000 }).catch(() => false)) {
        await decline.click();
        await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
      }
    } catch {
      // No consent modal, or it vanished on its own — nothing to do.
    }
  }
}
