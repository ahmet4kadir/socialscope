import fs from 'node:fs';

import Database from 'better-sqlite3';

import { resolveDbPath } from './paths';

// Cached connections; globalThis keeps them stable across dev hot-reloads.
// SQLite re-reads on every query, so collector writes (WAL) are visible
// without reopening.
const store = globalThis as unknown as {
  __socialscopeDb?: Database.Database;
  __socialscopeDbW?: Database.Database;
};

/** Read-only handle to the collector's database, or null if it doesn't exist yet. */
export function openDbReadonly(): Database.Database | null {
  if (store.__socialscopeDb) return store.__socialscopeDb;
  const dbPath = resolveDbPath();
  if (!fs.existsSync(dbPath)) return null;
  const db = new Database(dbPath, { readonly: true, fileMustExist: true });
  db.pragma('busy_timeout = 5000');
  store.__socialscopeDb = db;
  return db;
}

/**
 * Writable handle, used ONLY for managing the accounts registry from the
 * dashboard. All post/snapshot writes stay in the collector; WAL plus
 * busy_timeout keeps the two writers from tripping over each other.
 */
export function openDbWritable(): Database.Database | null {
  if (store.__socialscopeDbW) return store.__socialscopeDbW;
  const dbPath = resolveDbPath();
  if (!fs.existsSync(dbPath)) return null;
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');
  store.__socialscopeDbW = db;
  return db;
}
