import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import type { Database } from 'better-sqlite3';

import { openDb, resolveDbPath } from './connection';

const MIGRATIONS_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'migrations',
);

/**
 * Applies all pending .sql migrations in filename order, each inside a
 * transaction. Safe to call on every startup: applied migrations are recorded
 * in _migrations and skipped.
 */
export function migrate(db: Database): { applied: string[] } {
  db.exec(
    'CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)',
  );

  const appliedRows = db.prepare('SELECT name FROM _migrations').all() as {
    name: string;
  }[];
  const alreadyApplied = new Set(appliedRows.map((row) => row.name));

  const pending = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith('.sql'))
    .sort()
    .filter((file) => !alreadyApplied.has(file));

  for (const file of pending) {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    db.transaction(() => {
      db.exec(sql);
      db.prepare('INSERT INTO _migrations (name, applied_at) VALUES (?, ?)').run(
        file,
        new Date().toISOString(),
      );
    })();
  }

  return { applied: pending };
}

const isDirectRun =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  const db = openDb();
  try {
    const { applied } = migrate(db);
    console.log(`Database: ${resolveDbPath()}`);
    if (applied.length === 0) {
      console.log('Schema is up to date, no migrations to apply.');
    } else {
      console.log(`Applied ${applied.length} migration(s):`);
      for (const name of applied) console.log(`  - ${name}`);
    }
  } finally {
    db.close();
  }
}
