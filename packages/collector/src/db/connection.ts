import fs from 'node:fs';
import path from 'node:path';

import Database from 'better-sqlite3';

import { DATA_DIR, REPO_ROOT } from '../paths';

const DEFAULT_DB_PATH = path.join(DATA_DIR, 'socialscope.db');

export function resolveDbPath(): string {
  const fromEnv = process.env.DB_PATH?.trim();
  // Relative paths resolve against the repo root, not the cwd — npm runs
  // workspace scripts with cwd set to the package directory.
  return fromEnv ? path.resolve(REPO_ROOT, fromEnv) : DEFAULT_DB_PATH;
}

export function openDb(options: { readonly?: boolean } = {}): Database.Database {
  const dbPath = resolveDbPath();
  const readonly = options.readonly ?? false;
  if (!readonly) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }
  const db = new Database(dbPath, { readonly, fileMustExist: readonly });
  if (!readonly) {
    // WAL lets the web app read while the collector writes.
    db.pragma('journal_mode = WAL');
  }
  db.pragma('foreign_keys = ON');
  return db;
}
