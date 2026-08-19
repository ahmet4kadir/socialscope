import { parseArgs } from 'node:util';

import type { Browser, BrowserContext } from 'playwright';

import { launchContext } from '../browser/launch';
import { saveSession } from '../browser/session';
import { instagramConfig } from '../config/instagram';
import { fail } from './common';

const USAGE = 'Usage: npm run login -- --platform instagram';
const LOGIN_TIMEOUT_MS = 5 * 60 * 1000;
const POLL_MS = 2000;

async function main(): Promise<void> {
  let platform: string | undefined;
  try {
    ({
      values: { platform },
    } = parseArgs({ options: { platform: { type: 'string' } } }));
  } catch {
    fail('Unrecognized arguments.', USAGE);
  }

  if (platform === 'x') {
    fail('X login arrives in stage 3 — only instagram is supported right now.');
  }
  if (platform !== 'instagram') {
    fail('--platform must be "instagram" or "x".', USAGE);
  }

  console.log('Opening a browser window — log in to Instagram manually.');
  console.log('(2FA is fine. The session is saved automatically on success;');
  console.log(` you have ${LOGIN_TIMEOUT_MS / 60000} minutes.)`);

  let browser: Browser;
  let context: BrowserContext;
  try {
    ({ browser, context } = await launchContext({ headless: false }));
  } catch (error) {
    const detail = error instanceof Error ? (error.message.split('\n')[0] ?? '') : String(error);
    return fail(
      'Could not launch the login browser.',
      `If Playwright browsers are missing, run: npx playwright install chromium --no-shell (${detail})`,
    );
  }
  const page = await context.newPage();
  // Slow or stalled loads are fine — the poll loop below only needs cookies,
  // and the user can keep interacting with the page regardless.
  await page
    .goto(instagramConfig.urls.login, { waitUntil: 'domcontentloaded' })
    .catch(() => {});

  const deadline = Date.now() + LOGIN_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));

    let loggedIn: boolean;
    try {
      const cookies = await context.cookies(instagramConfig.urls.home);
      loggedIn = cookies.some(
        (cookie) => cookie.name === instagramConfig.sessionCookie && cookie.value !== '',
      );
    } catch {
      fail('The browser window was closed before login completed. Run the command again.');
    }

    if (loggedIn) {
      const file = await saveSession(context, 'instagram');
      await browser.close();
      console.log(`\n[ok] Logged in — session saved to ${file}`);
      console.log('     Next: npm run scrape -- --platform instagram --user <your_username> --role me');
      return;
    }
  }

  await browser.close().catch(() => {});
  fail(`Timed out after ${LOGIN_TIMEOUT_MS / 60000} minutes waiting for login. Run the command again.`);
}

main().catch((error: unknown) => {
  console.error('\n[error] Unexpected failure during login:');
  console.error(error);
  process.exit(1);
});
