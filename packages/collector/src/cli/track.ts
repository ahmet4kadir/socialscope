import { parseArgs } from 'node:util';

import { derivePostId, type Platform, type PostRow } from '@socialscope/shared';

import { openDb } from '../db/connection';
import { migrate } from '../db/migrate';
import {
  enrollTracking,
  getAccountRole,
  insertSnapshot,
  isActivelyTracked,
  saveScrapedPosts,
} from '../db/repo';
import { ScrapeError } from '../scrapers/errors';
import { scraperFor } from '../scrapers/factory';
import { fail } from './common';

const USAGE = 'Usage: npm run track -- --url <post_url>';

function platformFromUrl(url: string): Platform | null {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    if (host === 'instagram.com') return 'instagram';
    if (host === 'x.com' || host === 'twitter.com') return 'x';
  } catch {
    // Not a URL at all.
  }
  return null;
}

async function main(): Promise<void> {
  let url: string | undefined;
  try {
    ({
      values: { url },
    } = parseArgs({ options: { url: { type: 'string' } } }));
  } catch {
    return fail('Unrecognized arguments.', USAGE);
  }
  if (!url) return fail('--url is required.', USAGE);

  const platform = platformFromUrl(url);
  if (!platform) {
    return fail('The URL must be an instagram.com or x.com post link.', USAGE);
  }
  const postId = derivePostId(platform, url);
  if (!postId) {
    return fail(`That does not look like a ${platform} post URL.`, USAGE);
  }

  const db = openDb();
  try {
    migrate(db);

    if (isActivelyTracked(db, postId)) {
      const row = db
        .prepare('SELECT auto_stop_at FROM tracked_posts WHERE post_id = ?')
        .get(postId) as { auto_stop_at: string };
      console.log(`Already tracking ${postId} — auto-stop at ${row.auto_stop_at}.`);
      return;
    }

    // Fetch the post live: baseline snapshot, and the post row itself if we
    // have never seen this post before.
    console.log(`Fetching ${url} for a baseline snapshot…`);
    const post = await scraperFor(platform).fetchPost(url);

    const known = db.prepare('SELECT * FROM posts WHERE id = ?').get(postId) as
      | PostRow
      | undefined;
    if (known) {
      insertSnapshot(db, postId, post);
    } else {
      const role = getAccountRole(db, platform, post.username) ?? 'competitor';
      saveScrapedPosts(db, { platform, username: post.username, role }, [post]);
      console.log(
        `New account @${post.username} registered as "${role}" (change it by re-scraping with --role).`,
      );
    }

    const { autoStopAt } = enrollTracking(db, postId);
    console.log(`\n[ok] Tracking ${postId} (@${post.username}).`);
    console.log('     Schedule: hourly snapshots (±10 min) for 24h, then every 6h.');
    console.log(`     Auto-stop: ${autoStopAt}`);
    console.log('     Make sure the tracker is running: npm run tracker');
  } finally {
    db.close();
  }
}

main().catch((error: unknown) => {
  if (error instanceof ScrapeError) fail(error.message, error.hint);
  console.error('\n[error] Unexpected failure while enrolling the post:');
  console.error(error);
  process.exit(1);
});
