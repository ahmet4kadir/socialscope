import fs from 'node:fs';

import Database from 'better-sqlite3';

import { resolveDbPath } from './paths';

// One cached read-only connection; globalThis keeps it stable across dev
// hot-reloads. SQLite re-reads on every query, so collector writes (WAL)
// are visible without reopening.
const store = globalThis as unknown as { __socialscopeDb?: Database.Database };

/** Read-only handle to the collector's database, or null if it doesn't exist yet. */
export function openDbReadonly(): Database.Database | null {
  if (store.__socialscopeDb) return store.__socialscopeDb;
  const dbPath = resolveDbPath();
  if (!fs.existsSync(dbPath)) return null;
  const db = new Database(dbPath, { readonly: true, fileMustExist: true });
  store.__socialscopeDb = db;
  return db;
}
