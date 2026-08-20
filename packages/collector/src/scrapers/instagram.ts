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
    // Instagram may stack modals (cookie consent, then notifications), so try
    // each dismiss button in turn. Every step is best-effort; a missing modal
    // is the normal case and must not fail the scrape.
    for (const [index, name] of instagramConfig.dismissButtons.entries()) {
      const button = page.getByRole('button', { name }).first();
      try {
        // The first modal (cookies) is common enough to wait briefly for;
        // later ones only if already present.
        const timeout = index === 0 ? 3000 : 1000;
        if (await button.isVisible({ timeout }).catch(() => false)) {
          await button.click();
          await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
        }
      } catch {
        // Not present, or vanished on its own — move on.
      }
    }
  }
}
