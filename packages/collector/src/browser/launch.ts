import { chromium, type Browser, type BrowserContext } from 'playwright';

const VIEWPORT = { width: 1280, height: 860 };

// Realistic desktop fingerprint that masks the HeadlessChrome UA marker.
// The major version comes from the actual browser so it never drifts out of
// sync with what CDP/JS APIs report. (Real Chrome UAs are frozen at X.0.0.0.)
function userAgentFor(version: string): string {
  const major = version.split('.')[0] ?? '140';
  return `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${major}.0.0.0 Safari/537.36`;
}

export interface LaunchOptions {
  headless: boolean;
  /** Playwright storageState file with saved cookies (omit for fresh login). */
  storageStatePath?: string;
}

export async function launchContext({
  headless,
  storageStatePath,
}: LaunchOptions): Promise<{ browser: Browser; context: BrowserContext }> {
  // channel 'chromium' = the full Chromium build in new-headless mode. We
  // install with --no-shell, and the legacy headless shell is both absent and
  // easier for platforms to fingerprint.
  const browser = await chromium.launch({ headless, channel: 'chromium' });
  const context = await browser.newContext({
    userAgent: userAgentFor(browser.version()),
    viewport: VIEWPORT,
    locale: 'en-US',
    ...(storageStatePath ? { storageState: storageStatePath } : {}),
  });
  return { browser, context };
}
