import cron from 'node-cron';

import { hasSession } from '../browser/session';
import { openDb } from '../db/connection';
import { migrate } from '../db/migrate';
import {
  countArchivedPosts,
  deactivateExpired,
  enrollTracking,
  getActiveTrackedPosts,
  insertSnapshot,
  isSweepFresh,
  lastSnapshotAt,
  lastSweepAt,
  latestProfilePostCount,
  listAccounts,
  recordAccountSnapshot,
  recordSweep,
  saveScrapedPosts,
} from '../db/repo';
import { ScrapeError } from '../scrapers/errors';
import { scraperFor } from '../scrapers/factory';
import { cadenceMs, nextDueAt, shouldAutoEnroll } from '../tracking/schedule';

const SWEEP_LIMIT = 25;
const RETRY_DELAY_MS = 30 * 60 * 1000;

// Archive deepening: once a day, ONE account's history is fetched a step
// deeper, so the local archive grows slowly instead of hammering platforms.
const DEEPEN_STEP = 25;
const ARCHIVE_CAP = Math.max(
  SWEEP_LIMIT,
  Number(process.env.ARCHIVE_CAP ?? 100) || 100,
);

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
      const { posts, account: info } = await scraperFor(account.platform).fetchProfile(
        account.username,
        SWEEP_LIMIT,
      );
      const result = saveScrapedPosts(db, account, posts);
      recordAccountSnapshot(db, account.platform, account.username, info);
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

/**
 * Deepens ONE account's archive per day: fetches DEEPEN_STEP posts beyond
 * what the archive already holds, until ARCHIVE_CAP or the profile's real
 * post count is reached. Picks the account with the smallest archive first.
 */
async function deepenOneArchive(): Promise<void> {
  const candidates = listAccounts(db)
    .filter((account) => hasSession(account.platform))
    .map((account) => ({
      account,
      archived: countArchivedPosts(db, account.platform, account.username),
      total: latestProfilePostCount(db, account.platform, account.username),
    }))
    .filter(
      ({ archived, total }) =>
        archived < ARCHIVE_CAP && (total === null || archived < total),
    )
    .sort((a, b) => a.archived - b.archived);

  const next = candidates[0];
  if (!next) {
    log('deepen: every archive is complete or at cap — nothing to do.');
    return;
  }

  const { account, archived } = next;
  const target = Math.min(archived + DEEPEN_STEP, ARCHIVE_CAP);
  const label = `${account.platform}/@${account.username}`;
  log(`deepen ${label}: archive ${archived} → hedef ${target} gönderi`);
  try {
    const { posts, account: info } = await scraperFor(account.platform).fetchProfile(
      account.username,
      target,
    );
    const result = saveScrapedPosts(db, account, posts);
    recordAccountSnapshot(db, account.platform, account.username, info);
    recordSweep(db, account.platform, account.username);
    const nowArchived = countArchivedPosts(db, account.platform, account.username);
    log(
      `deepen ${label}: ${result.saved} post(s) saved, archive now ${nowArchived}` +
        (result.newPostIds.length > 0 ? ` (+${result.newPostIds.length} new)` : ' (feed exhausted?)'),
    );
  } catch (error) {
    const message = error instanceof ScrapeError ? error.message : String(error);
    log(`deepen ${label}: FAILED — ${message}`);
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
log(
  `schedule: sweeps every 6h; snapshot checks every 5min; archive deepening daily 03:30 (cap ${ARCHIVE_CAP}); Ctrl+C to stop.`,
);

enqueue(sweepAccounts);
enqueue(snapshotDuePosts);

cron.schedule('*/5 * * * *', () => enqueue(snapshotDuePosts));
cron.schedule('0 */6 * * *', () => enqueue(sweepAccounts));
cron.schedule('30 3 * * *', () => enqueue(deepenOneArchive));

process.on('SIGINT', () => {
  log('tracker stopping…');
  // Let any in-flight scrape finish its teardown before exiting.
  enqueue(async () => {
    db.close();
    process.exit(0);
  });
});
