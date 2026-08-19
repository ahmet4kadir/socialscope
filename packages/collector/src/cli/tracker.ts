import cron from 'node-cron';

import { hasSession } from '../browser/session';
import { openDb } from '../db/connection';
import { migrate } from '../db/migrate';
import {
  deactivateExpired,
  enrollTracking,
  getActiveTrackedPosts,
  insertSnapshot,
  isSweepFresh,
  lastSnapshotAt,
  lastSweepAt,
  listAccounts,
  recordSweep,
  saveScrapedPosts,
} from '../db/repo';
import { ScrapeError } from '../scrapers/errors';
import { scraperFor } from '../scrapers/factory';
import { cadenceMs, nextDueAt, shouldAutoEnroll } from '../tracking/schedule';

const SWEEP_LIMIT = 25;
const RETRY_DELAY_MS = 30 * 60 * 1000;

const db = openDb();
migrate(db);

// Next snapshot time per tracked post. In-memory only: after a restart it is
// recomputed from the last snapshot in the database, so an interrupted
// tracker resumes cleanly.
const nextDue = new Map<string, number>();

function log(message: string): void {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

/**
 * Sweeps every registered account (mine + competitors): refreshes posts,
 * takes a snapshot of each, and auto-enrolls fresh posts on my own accounts
 * into tracking. Respects the 6h per-account cache.
 */
async function sweepAccounts(): Promise<void> {
  const accounts = listAccounts(db);
  if (accounts.length === 0) {
    log('sweep: no registered accounts yet — add or scrape one first.');
    return;
  }

  for (const account of accounts) {
    const label = `${account.platform}/@${account.username}`;
    if (!hasSession(account.platform)) {
      log(`sweep ${label}: skipped (no ${account.platform} session saved).`);
      continue;
    }
    if (isSweepFresh(lastSweepAt(db, account.platform, account.username))) {
      log(`sweep ${label}: skipped (swept <6h ago).`);
      continue;
    }

    try {
      const posts = await scraperFor(account.platform).fetchPosts(
        account.username,
        SWEEP_LIMIT,
      );
      const result = saveScrapedPosts(db, account, posts);
      recordSweep(db, account.platform, account.username);

      let enrolled = 0;
      if (account.role === 'me') {
        const now = Date.now();
        for (const postId of result.newPostIds) {
          const row = db
            .prepare('SELECT posted_at FROM posts WHERE id = ?')
            .get(postId) as { posted_at: string } | undefined;
          if (row && shouldAutoEnroll(row.posted_at, now)) {
            enrollTracking(db, postId);
            enrolled += 1;
            log(`  auto-enrolled new post ${postId} for tracking`);
          }
        }
      }
      log(
        `sweep ${label}: ${result.saved} post(s) saved` +
          (enrolled > 0 ? `, ${enrolled} new post(s) now tracked` : ''),
      );
    } catch (error) {
      const message =
        error instanceof ScrapeError ? error.message : String(error);
      log(`sweep ${label}: FAILED — ${message}`);
    }
  }
}

/** Snapshots every tracked post that is due, one at a time. */
async function snapshotDuePosts(): Promise<void> {
  const stopped = deactivateExpired(db);
  if (stopped > 0) log(`tracking: ${stopped} post(s) reached 48h — stopped.`);

  const active = getActiveTrackedPosts(db);
  const now = Date.now();

  for (const tracked of active) {
    const cadence = cadenceMs(tracked.tracking_started_at, now);
    let due = nextDue.get(tracked.post_id);
    if (due === undefined) {
      const last =
        lastSnapshotAt(db, tracked.post_id) ?? tracked.tracking_started_at;
      due = nextDueAt(Date.parse(last), cadence, Math.random);
      nextDue.set(tracked.post_id, due);
    }
    if (now < due) continue;

    if (!hasSession(tracked.platform)) {
      log(`snapshot ${tracked.post_id}: skipped (no ${tracked.platform} session).`);
      nextDue.set(tracked.post_id, now + RETRY_DELAY_MS);
      continue;
    }

    try {
      const post = await scraperFor(tracked.platform).fetchPost(tracked.url);
      insertSnapshot(db, tracked.post_id, post);
      nextDue.set(tracked.post_id, nextDueAt(Date.now(), cadence, Math.random));
      log(
        `snapshot ${tracked.post_id}: likes=${post.likes} comments=${post.comments}` +
          (post.views !== undefined ? ` views=${post.views}` : ''),
      );
    } catch (error) {
      const message =
        error instanceof ScrapeError ? error.message : String(error);
      log(`snapshot ${tracked.post_id}: FAILED — ${message} (retry in 30min)`);
      nextDue.set(tracked.post_id, now + RETRY_DELAY_MS);
    }
  }
}

// All work runs strictly sequentially on one chain — never two browser
// sessions at once, even if a sweep and a snapshot tick coincide. (The
// cross-process scrape lock guards against other CLIs on top of this.)
let chain: Promise<void> = Promise.resolve();
function enqueue(work: () => Promise<void>): void {
  chain = chain.then(work).catch((error: unknown) => {
    log(`unexpected tracker error: ${String(error)}`);
  });
}

log('SocialScope tracker started.');
log(
  `accounts: ${listAccounts(db).length}, actively tracked posts: ${getActiveTrackedPosts(db).length}`,
);
log('schedule: account sweeps every 6h; snapshot checks every 5min; Ctrl+C to stop.');

enqueue(sweepAccounts);
enqueue(snapshotDuePosts);

cron.schedule('*/5 * * * *', () => enqueue(snapshotDuePosts));
cron.schedule('0 */6 * * *', () => enqueue(sweepAccounts));

process.on('SIGINT', () => {
  log('tracker stopping…');
  // Let any in-flight scrape finish its teardown before exiting.
  enqueue(async () => {
    db.close();
    process.exit(0);
  });
});
