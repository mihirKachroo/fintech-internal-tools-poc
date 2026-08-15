import { applySchema, databasePath, openDatabase } from './db/index.js';
import { seed } from './db/seed.js';
import { createApp } from './app.js';

const PORT = Number(process.env.PORT ?? 3000);

function main(): void {
  const db = openDatabase();
  const hasSchema = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'refunds'")
    .get();
  if (!hasSchema) {
    applySchema(db);
    seed(db);
    console.log('Initialised and seeded a fresh demo database.');
  }
  createApp(db).listen(PORT, () => {
    console.log(`Internal Tools Kernel on http://localhost:${PORT} (db: ${databasePath()})`);
  });
}

main();
