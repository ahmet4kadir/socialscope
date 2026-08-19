import fs from 'node:fs';

import { openDb, resolveDbPath } from './connection';

// Prints the database location, applied migrations, and row counts per table.
// Handy for verifying the pipeline without a sqlite3 CLI installed.

const dbPath = resolveDbPath();

if (!fs.existsSync(dbPath)) {
  console.error(`No database at ${dbPath} — run \`npm run migrate\` first.`);
  process.exit(1);
}

const db = openDb({ readonly: true });
try {
  console.log(`Database: ${dbPath}`);

  const migrations = db
    .prepare('SELECT name, applied_at FROM _migrations ORDER BY name')
    .all() as { name: string; applied_at: string }[];
  console.log(`\nMigrations applied (${migrations.length}):`);
  for (const m of migrations) console.log(`  ${m.name}  (${m.applied_at})`);

  const tables = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE '\\_%' ESCAPE '\\' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    )
    .all() as { name: string }[];

  console.log('\nTables:');
  for (const { name } of tables) {
    const { count } = db
      .prepare(`SELECT COUNT(*) AS count FROM "${name}"`)
      .get() as { count: number };
    console.log(`  ${name.padEnd(15)} ${count} row(s)`);
  }
} finally {
  db.close();
}
