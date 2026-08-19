import { chromium, type Browser, type BrowserContext } from 'playwright';

// Realistic desktop fingerprint (also masks the HeadlessChrome UA marker).
// Bump the Chrome version once in a while so it stays plausible.
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
const VIEWPORT = { width: 1280, height: 860 };

export interface LaunchOptions {
  headless: boolean;
  /** Playwright storageState file with saved cookies (omit for fresh login). */
  storageStatePath?: string;
}

export async function launchContext({
  headless,
  storageStatePath,
}: LaunchOptions): Promise<{ browser: Browser; context: BrowserContext }> {
  const browser = await chromium.launch({ headless });
  const context = await browser.newContext({
    userAgent: USER_AGENT,
    viewport: VIEWPORT,
    locale: 'en-US',
    ...(storageStatePath ? { storageState: storageStatePath } : {}),
  });
  return { browser, context };
}
