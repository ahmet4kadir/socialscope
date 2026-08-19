import fs from 'node:fs';
import path from 'node:path';

import { DATA_DIR } from '../paths';
import { ScrapeError } from './errors';

const LOCK_FILE = path.join(DATA_DIR, 'scrape.lock');
const STALE_AFTER_MS = 30 * 60 * 1000;

// Deliberately unlinkSync, not rmSync: rmSync({force: true}) silently fails
// to delete files inside OneDrive-synced folders on Windows (observed on
// Node 24), which would leave stale locks behind.
function removeLockFile(): void {
  try {
    fs.unlinkSync(LOCK_FILE);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
}

/**
 * Enforces "one scrape session at a time, globally" across processes (manual
 * scrapes and the tracker share this). Returns a release function; a lock
 * older than 30 minutes is treated as left over from a crash and stolen.
 */
export function acquireScrapeLock(): () => void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const fd = fs.openSync(LOCK_FILE, 'wx');
      fs.writeSync(
        fd,
        JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }),
      );
      fs.closeSync(fd);
      return removeLockFile;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      let ageMs: number;
      try {
        ageMs = Date.now() - fs.statSync(LOCK_FILE).mtimeMs;
      } catch {
        continue; // lock released between open and stat — retry
      }
      if (ageMs > STALE_AFTER_MS) {
        removeLockFile();
        continue;
      }
      throw new ScrapeError(
        'Another scrape session is already running (scrapes are strictly sequential).',
        `Wait for it to finish — or if you are sure none is running, delete ${LOCK_FILE}`,
      );
    }
  }
  throw new ScrapeError(
    'Could not acquire the scrape lock.',
    `Delete ${LOCK_FILE} manually if this persists.`,
  );
}
