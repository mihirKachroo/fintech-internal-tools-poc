import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

export type Db = Database.Database;

const DEFAULT_PATH = path.join(process.cwd(), 'data', 'app.db');

export function databasePath(): string {
  return process.env.DATABASE_PATH ?? DEFAULT_PATH;
}

export function openDatabase(file: string = databasePath()): Db {
  if (file !== ':memory:') {
    fs.mkdirSync(path.dirname(file), { recursive: true });
  }
  const db = new Database(file);
  db.pragma('foreign_keys = ON');
  return db;
}

export function applySchema(db: Db): void {
  const schema = fs.readFileSync(path.join(import.meta.dirname, 'schema.sql'), 'utf8');
  db.exec(schema);
}
