import fs from 'node:fs';
import { applySchema, databasePath, openDatabase } from './index.js';
import { seed } from './seed.js';

/** Drops and re-seeds the demo database. Safe to run before every demo. */
function main(): void {
  const file = databasePath();
  for (const suffix of ['', '-wal', '-shm']) {
    fs.rmSync(file + suffix, { force: true });
  }
  const db = openDatabase(file);
  applySchema(db);
  seed(db);
  db.close();
  console.log(`Seeded demo database at ${file}`);
}

main();
