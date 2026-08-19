import type { Browser, Page, Response } from 'playwright';

import {
  derivePostId,
  type DataSource,
  type NormalizedPost,
  type Platform,
} from '@socialscope/shared';

import { humanDelay, humanScroll, type DelayRange } from '../browser/humanize';
import { launchContext } from '../browser/launch';
import { hasSession, sessionFilePath } from '../browser/session';
import { dumpDebug } from './debug';
import { ScrapeError } from './errors';
import { acquireScrapeLock } from './lock';

export interface ScraperTiming {
  actionDelayMs: DelayRange;
  maxStaleScrolls: number;
  navigationTimeoutMs: number;
}

/**
 * Shared Playwright scraping skeleton: session handling, the global scrape
 * lock, human-like pacing, scroll-based loading, and JSON harvesting from
 * both inline page data and captured API responses. Platform subclasses
 * supply URLs, patterns, and the payload parser.
 */
export abstract class PlaywrightScraper implements DataSource {
  abstract readonly platform: Platform;

  protected abstract readonly timing: ScraperTiming;
  /** URL substrings whose JSON responses may carry post data. */
  protected abstract readonly apiResponsePatterns: readonly string[];

  protected abstract profileUrl(username: string): string;
  /** Extracts normalized posts from one JSON payload (pure, unit-testable). */
  protected abstract extractPosts(
    payload: unknown,
    username: string,
  ): NormalizedPost[];
  /** Harvests posts embedded in the initial HTML (inline JSON script tags). */
  protected abstract extractInlinePosts(
    page: Page,
    username: string,
  ): Promise<NormalizedPost[]>;
  /** Throws a ScrapeError if the page shows a login wall or challenge. */
  protected abstract assertPageUsable(page: Page): Promise<void>;

  async fetchPosts(username: string, limit: number): Promise<NormalizedPost[]> {
    const releaseLock = acquireScrapeLock();
    let browser: Browser | undefined;
    try {
      if (!hasSession(this.platform)) {
        throw new ScrapeError(
          `No saved ${this.platform} session found.`,
          `Run \`npm run login -- --platform ${this.platform}\` first (one-time manual login).`,
        );
      }

      let launched;
      try {
        launched = await launchContext({
          headless: process.env.HEADED !== '1',
          storageStatePath: sessionFilePath(this.platform),
        });
      } catch (error) {
        throw new ScrapeError(
          'Could not launch the scraper browser.',
          'If Playwright browsers are missing, run: npx playwright install chromium --no-shell ' +
            `(${error instanceof Error ? (error.message.split('\n')[0] ?? '') : String(error)})`,
        );
      }
      browser = launched.browser;
      const page = await launched.context.newPage();
      page.setDefaultTimeout(this.timing.navigationTimeoutMs);
      page.setDefaultNavigationTimeout(this.timing.navigationTimeoutMs);

      // Posts arrive from two directions: JSON embedded in the initial HTML
      // and XHR/GraphQL responses fired while scrolling. Both feed the same
      // parser; the map dedupes by stable post id.
      const harvested = new Map<string, NormalizedPost>();
      const collect = (posts: NormalizedPost[]): void => {
        for (const post of posts) {
          harvested.set(derivePostId(post.platform, post.url) ?? post.url, post);
        }
      };
      page.on('response', (response) => {
        void this.harvestResponse(response, username, collect);
      });

      try {
        await page.goto(this.profileUrl(username), {
          waitUntil: 'domcontentloaded',
        });
        await humanDelay(this.timing.actionDelayMs);
        await this.assertPageUsable(page);
        collect(await this.extractInlinePosts(page, username));

        let staleRounds = 0;
        while (harvested.size < limit && staleRounds < this.timing.maxStaleScrolls) {
          const before = harvested.size;
          await humanScroll(page);
          await humanDelay(this.timing.actionDelayMs);
          staleRounds = harvested.size === before ? staleRounds + 1 : 0;
        }

        if (harvested.size === 0) {
          const dump = await dumpDebug(page, this.platform, 'no-posts');
          throw new ScrapeError(
            `Captured 0 posts from ${this.platform}/@${username}.`,
            `Possible causes: the account is private or has no posts, or ${this.platform} changed its page structure ` +
              `(fix patterns in src/config/${this.platform}.ts).` +
              (dump ? ` Screenshot + HTML saved to ${dump}.*` : ''),
          );
        }

        return [...harvested.values()]
          .sort((a, b) => b.date.localeCompare(a.date))
          .slice(0, limit);
      } catch (error) {
        if (error instanceof ScrapeError) throw error;
        // Dump while the page is still alive — the finally below destroys it.
        const dump = await dumpDebug(page, this.platform, 'unexpected');
        const message = error instanceof Error ? error.message : String(error);
        throw new ScrapeError(
          `Unexpected failure while scraping ${this.platform}/@${username}: ${message}`,
          dump
            ? `Screenshot + HTML saved to ${dump}.*`
            : 'No debug dump could be captured (the page was already gone).',
        );
      }
    } finally {
      await browser?.close().catch(() => {});
      releaseLock();
    }
  }

  /**
   * Shared login-wall detector: throws (with a debug dump) when the platform
   * redirected to a login/challenge path or is showing its login form.
   * Prefixes are matched against whole path segments so usernames that merely
   * start with a blocked word don't false-positive.
   */
  protected async assertNoLoginWall(
    page: Page,
    blockedPathPrefixes: readonly string[],
    loginFormSelector: string,
  ): Promise<void> {
    const { pathname } = new URL(page.url());
    const blocked = blockedPathPrefixes.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    );
    const loginFormVisible = await page
      .locator(loginFormSelector)
      .first()
      .isVisible()
      .catch(() => false);

    if (blocked || loginFormVisible) {
      const dump = await dumpDebug(page, this.platform, 'login-wall');
      throw new ScrapeError(
        `${this.platform} is showing the login/challenge page — the saved session is missing, expired, or flagged.`,
        `Run \`npm run login -- --platform ${this.platform}\` to refresh the session.` +
          (dump ? ` Screenshot + HTML saved to ${dump}.*` : ''),
      );
    }
  }

  private async harvestResponse(
    response: Response,
    username: string,
    collect: (posts: NormalizedPost[]) => void,
  ): Promise<void> {
    try {
      const url = response.url();
      if (!this.apiResponsePatterns.some((pattern) => url.includes(pattern))) {
        return;
      }
      const contentType = response.headers()['content-type'] ?? '';
      if (!contentType.includes('json')) return;
      collect(this.extractPosts(await response.json(), username));
    } catch {
      // Non-JSON body or a teardown race — either way, not a post payload.
    }
  }
}
