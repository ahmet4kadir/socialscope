import { parseArgs } from 'node:util';

import type { Browser, BrowserContext } from 'playwright';

import type { Platform } from '@socialscope/shared';

import { launchContext } from '../browser/launch';
import { saveSession } from '../browser/session';
import { instagramConfig } from '../config/instagram';
import { xConfig } from '../config/x';
import { fail } from './common';

const USAGE = 'Usage: npm run login -- --platform instagram|x';
const LOGIN_TIMEOUT_MS = 5 * 60 * 1000;
const POLL_MS = 2000;

interface LoginTarget {
  label: string;
  loginUrl: string;
  home: string;
  cookie: string;
}

const LOGIN_TARGETS: Record<Platform, LoginTarget> = {
  instagram: {
    label: 'Instagram',
    loginUrl: instagramConfig.urls.login,
    home: instagramConfig.urls.home,
    cookie: instagramConfig.sessionCookie,
  },
  x: {
    label: 'X (Twitter)',
    loginUrl: xConfig.urls.login,
    home: xConfig.urls.home,
    cookie: xConfig.sessionCookie,
  },
};

async function main(): Promise<void> {
  let platform: string | undefined;
  try {
    ({
      values: { platform },
    } = parseArgs({ options: { platform: { type: 'string' } } }));
  } catch {
    fail('Unrecognized arguments.', USAGE);
  }

  if (platform !== 'instagram' && platform !== 'x') {
    return fail('--platform must be "instagram" or "x".', USAGE);
  }
  const target = LOGIN_TARGETS[platform];

  console.log(`Opening a browser window — log in to ${target.label} manually.`);
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
    .goto(target.loginUrl, { waitUntil: 'domcontentloaded' })
    .catch(() => {});

  const deadline = Date.now() + LOGIN_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));

    let loggedIn: boolean;
    try {
      const cookies = await context.cookies(target.home);
      loggedIn = cookies.some(
        (cookie) => cookie.name === target.cookie && cookie.value !== '',
      );
    } catch {
      fail('The browser window was closed before login completed. Run the command again.');
    }

    if (loggedIn) {
      const file = await saveSession(context, platform);
      await browser.close();
      console.log(`\n[ok] Logged in — session saved to ${file}`);
      console.log(
        `     Next: npm run scrape -- --platform ${platform} --user <your_username> --role me`,
      );
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
