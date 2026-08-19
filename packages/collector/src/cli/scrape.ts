import { parseArgs } from 'node:util';

import type { AccountRole, DataSource } from '@socialscope/shared';

import { openDb, resolveDbPath } from '../db/connection';
import { migrate } from '../db/migrate';
import {
  getAccountRole,
  isSweepFresh,
  lastSweepAt,
  recordSweep,
  saveScrapedPosts,
} from '../db/repo';
import { ScrapeError } from '../scrapers/errors';
import { scraperFor } from '../scrapers/factory';
import { fail } from './common';

const USAGE =
  'Usage: npm run scrape -- --platform instagram|x --user <username> [--role me|competitor] [--limit 25] [--force]';
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 30;

async function main(): Promise<void> {
  let values;
  try {
    ({ values } = parseArgs({
      options: {
        platform: { type: 'string' },
        user: { type: 'string' },
        role: { type: 'string' },
        limit: { type: 'string' },
        force: { type: 'boolean', default: false },
      },
    }));
  } catch {
    return fail('Unrecognized arguments.', USAGE);
  }

  if (values.platform !== 'instagram' && values.platform !== 'x') {
    return fail('--platform must be "instagram" or "x".', USAGE);
  }
  const platform = values.platform;

  const username = values.user?.replace(/^@/, '').trim().toLowerCase();
  if (!username) return fail('--user is required.', USAGE);

  const limit = values.limit === undefined ? DEFAULT_LIMIT : Number(values.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    return fail(
      `--limit must be an integer between 1 and ${MAX_LIMIT} (the tool deliberately scrapes small volumes).`,
    );
  }

  if (values.role !== undefined && values.role !== 'me' && values.role !== 'competitor') {
    return fail('--role must be "me" or "competitor".', USAGE);
  }

  const db = openDb();
  try {
    migrate(db);

    const role: AccountRole | null =
      (values.role as AccountRole | undefined) ?? getAccountRole(db, platform, username);
    if (!role) {
      return fail(
        `@${username} is new — say whose account it is.`,
        'Re-run with --role me or --role competitor (remembered afterwards).',
      );
    }

    const sweptAt = lastSweepAt(db, platform, username);
    if (!values.force && isSweepFresh(sweptAt)) {
      console.log(
        `Skipping @${username}: already swept at ${sweptAt} (less than 6h ago). Pass --force to scrape anyway.`,
      );
      return;
    }

    console.log(`Scraping ${platform}/@${username} (${role}, up to ${limit} posts)…`);
    const scraper: DataSource = scraperFor(platform);
    const posts = await scraper.fetchPosts(username, limit);

    const result = saveScrapedPosts(db, { platform, username, role }, posts);
    recordSweep(db, platform, username);

    const skippedNote = result.skipped > 0 ? `, skipped ${result.skipped} malformed` : '';
    console.log(`\n[ok] Captured ${posts.length} post(s); saved ${result.saved} with a snapshot each${skippedNote}.`);
    console.log(`     Database: ${resolveDbPath()}`);
    console.log('     Inspect with: npm run db:status');
  } finally {
    db.close();
  }
}

main().catch((error: unknown) => {
  if (error instanceof ScrapeError) fail(error.message, error.hint);
  console.error('\n[error] Unexpected failure during scrape:');
  console.error(error);
  process.exit(1);
});
